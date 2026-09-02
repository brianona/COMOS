import 'dotenv/config';
process.env.TZ = 'Asia/Manila';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { addDays, isBefore, format } from 'date-fns';
import net from 'net';
import dns from 'dns';
import { google } from 'googleapis';
import { GoogleGenAI, Type } from "@google/genai";
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<{ req?: any }>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const __dirname = path.resolve();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'vessel-cert-secret-key';

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import WordExtractor from 'word-extractor';
import mammoth from 'mammoth';
import { GraphifyEngine } from './src/services/graphifyScanner';
import { globalRealtimeEngine, extractTableAndDomainFromSql } from './server_realtime';

const graphifyEngine = new GraphifyEngine();

let globalPool: mysql.Pool | null = null;

let cachedOutboundIp: string | null = null;
let lastOutboundIpTime = 0;

const getOutboundIp = async (): Promise<string> => {
  if (cachedOutboundIp && Date.now() - lastOutboundIpTime < 180000) {
    return cachedOutboundIp;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json() as any;
      if (data && data.ip) {
        cachedOutboundIp = String(data.ip).trim();
        lastOutboundIpTime = Date.now();
        return cachedOutboundIp;
      }
    }
  } catch (err) {}
  return cachedOutboundIp || '34.96.48.60';
};

const getB2Settings = async () => {
  let b2KeyId = process.env.B2_APPLICATION_KEY_ID || '';
  let b2Key = process.env.B2_APPLICATION_KEY || '';
  let b2Bucket = process.env.B2_BUCKET_NAME || '';
  let b2Endpoint = process.env.B2_ENDPOINT || '';

  if (globalPool) {
    try {
      const [rows] = await globalPool.query(
        'SELECT setting_key, setting_value FROM settings WHERE setting_key IN ("B2_APPLICATION_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET_NAME", "B2_ENDPOINT")'
      );
      for (const row of rows as any[]) {
        if (row.setting_key === 'B2_APPLICATION_KEY_ID' && row.setting_value) b2KeyId = row.setting_value;
        if (row.setting_key === 'B2_APPLICATION_KEY' && row.setting_value) b2Key = row.setting_value;
        if (row.setting_key === 'B2_BUCKET_NAME' && row.setting_value) b2Bucket = row.setting_value;
        if (row.setting_key === 'B2_ENDPOINT' && row.setting_value) b2Endpoint = row.setting_value;
      }
    } catch (e) {
      // Ignore database errors during early startup or if table is not yet created
    }
  }

  return {
    B2_APPLICATION_KEY_ID: b2KeyId,
    B2_APPLICATION_KEY: b2Key,
    B2_BUCKET_NAME: b2Bucket,
    B2_ENDPOINT: b2Endpoint,
  };
};

const isB2Configured = async () => {
  const s = await getB2Settings();
  return !!(s.B2_APPLICATION_KEY_ID && s.B2_APPLICATION_KEY && s.B2_BUCKET_NAME && s.B2_ENDPOINT);
};

const getB2Client = async () => {
  const s = await getB2Settings();
  if (!s.B2_APPLICATION_KEY_ID || !s.B2_APPLICATION_KEY || !s.B2_ENDPOINT) {
    return null;
  }
  return new S3Client({
    endpoint: s.B2_ENDPOINT.startsWith('http') 
      ? s.B2_ENDPOINT 
      : `https://${s.B2_ENDPOINT}`,
    credentials: {
      accessKeyId: s.B2_APPLICATION_KEY_ID,
      secretAccessKey: s.B2_APPLICATION_KEY,
    },
    region: s.B2_ENDPOINT.split('.')[1] || 'us-east-005',
  });
};

const uploadFileToB2 = async (key: string, buffer: Buffer, mimeType: string): Promise<string> => {
  const client = await getB2Client();
  const s = await getB2Settings();
  if (!client || !s.B2_BUCKET_NAME) {
    throw new Error('Backblaze B2 is not configured.');
  }
  await client.send(
    new PutObjectCommand({
      Bucket: s.B2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return key;
};

const getFileFromB2 = async (key: string): Promise<Buffer> => {
  const client = await getB2Client();
  const s = await getB2Settings();
  if (!client || !s.B2_BUCKET_NAME) {
    throw new Error('Backblaze B2 is not configured.');
  }
  const response = await client.send(
    new GetObjectCommand({
      Bucket: s.B2_BUCKET_NAME,
      Key: key,
    })
  );
  if (!response.Body) {
    throw new Error('Empty response body from B2');
  }
  const chunks = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

// Modifies the binary buffer to store a reference pointer if B2 is configured, or leaves it alone
const handleFileUpload = async (filename: string, mimetype: string, buffer: Buffer, typeSlug: string): Promise<Buffer> => {
  if (await isB2Configured()) {
    try {
      const sanitizeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${typeSlug}/${Date.now()}_${sanitizeName}`;
      await uploadFileToB2(key, buffer, mimetype);
      return Buffer.from(`B2_KEY:${key}`);
    } catch (err: any) {
      console.error(`Failed to upload file to Backblaze B2, falling back to database:`, err.message || err);
    }
  }
  return buffer;
};

// Parses base64 data URL into binary buffer and mimetype
const parseBase64DataUrl = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    return {
      mimetype: matches[1],
      buffer: Buffer.from(matches[2], 'base64')
    };
  }
  return null;
};

// Checks if the retrieved DB data is a reference pointer to B2 and resolves it, or returns raw DB buffer
const handleFileRetrieve = async (dbData: any): Promise<Buffer> => {
  if (!dbData) return dbData;
  const buf = Buffer.isBuffer(dbData) ? dbData : Buffer.from(dbData);
  if (buf.length > 7 && buf.toString('utf8', 0, 7) === 'B2_KEY:') {
    const b2Key = buf.toString('utf8', 7);
    if (await isB2Configured()) {
      try {
        return await getFileFromB2(b2Key);
      } catch (err: any) {
        console.error(`Failed to fetch file from B2 (key: ${b2Key}):`, err.message || err);
        throw new Error(`Failed to retrieve file from remote storage: ${err.message}`);
      }
    } else {
      throw new Error(`File is stored on Backblaze B2, but B2 configuration is missing/invalid on this server.`);
    }
  }
  return buf;
};

const deleteFileFromB2 = async (key: string): Promise<void> => {
  const client = await getB2Client();
  const s = await getB2Settings();
  if (!client || !s.B2_BUCKET_NAME) {
    throw new Error('Backblaze B2 is not configured.');
  }
  await client.send(
    new DeleteObjectCommand({
      Bucket: s.B2_BUCKET_NAME,
      Key: key,
    })
  );
};

const handleFileDelete = async (dbData: any): Promise<void> => {
  if (!dbData) return;
  try {
    const buf = Buffer.isBuffer(dbData) ? dbData : Buffer.from(dbData);
    if (buf.length > 7 && buf.toString('utf8', 0, 7) === 'B2_KEY:') {
      const b2Key = buf.toString('utf8', 7);
      if (await isB2Configured()) {
        await deleteFileFromB2(b2Key);
        console.log(`Successfully deleted file from Backblaze B2 (key: ${b2Key})`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to delete file from Backblaze B2:`, err.message || err);
  }
};

async function startServer() {
  console.log('Starting server initialization...');
  const app = express();
  
  let pool: mysql.Pool | null = null;
  let dbError: string | null = null;
  let resolvedDbHost: string = 'localhost';
  let dbUserUsed: string = 'root';
  let dbNameUsed: string = 'vessel_cert';
  let dbPassSource: string = 'fallback';
  let dbPassLength: number = 0;
  let initializeTables: ((activePool: mysql.Pool) => Promise<void>) | null = null;

  try {
    let dbHost = process.env.DB_HOST || 'localhost';
    resolvedDbHost = dbHost;
    if (dbHost !== 'localhost' && !net.isIP(dbHost)) {
      try {
        console.log(`Resolving DNS for DB_HOST '${dbHost}' to IPv4...`);
        const addresses = await dns.promises.resolve4(dbHost);
        if (addresses && addresses.length > 0) {
          console.log(`Successfully resolved database host ${dbHost} to IPv4: ${addresses[0]}`);
          dbHost = addresses[0];
          resolvedDbHost = dbHost;
        } else {
          console.log(`No IPv4 addresses found for ${dbHost}.`);
        }
      } catch (dnsErr: any) {
        console.error(`DNS lookup failed list for ${dbHost}:`, dnsErr.message);
      }
    }

    const dbUser = process.env.DB_USER || 'u525815427_comi_admin';
    const dbName = process.env.DB_NAME || 'u525815427_COMOS';
    
    let dbPass = '';
    if (process.env.CUSTOM_DB_PASSWORD !== undefined) {
      dbPass = process.env.CUSTOM_DB_PASSWORD;
      dbPassSource = 'process.env.CUSTOM_DB_PASSWORD';
    } else {
      dbPass = process.env.DB_PASSWORD || '';
      dbPassSource = process.env.DB_PASSWORD ? 'process.env.DB_PASSWORD' : 'not_configured_in_env';
    }
    
    const dbPort = Number(process.env.DB_PORT) || 3306;

    dbUserUsed = dbUser;
    dbNameUsed = dbName;
    dbPassLength = dbPass.length;

    console.log(`Connecting to MySQL with Host: ${dbHost}, Port: ${dbPort}, User: ${dbUser}, Database: ${dbName}, Password Length: ${dbPass ? dbPass.length : 0}`);

    console.log('Initializing MySQL connection pool...');
    pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPass,
      database: dbName,
      port: dbPort,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
    globalPool = pool;

    const rawExecute = pool.execute.bind(pool);
    const rawQuery = pool.query.bind(pool);
    const rawGetConnection = pool.getConnection.bind(pool);

    const formatQueryDetails = (sql: any, values?: any): string => {
      let sqlStr = typeof sql === 'string' ? sql : (sql && sql.sql) ? sql.sql : String(sql);
      sqlStr = sqlStr.replace(/\s+/g, ' ').trim();

      const queryValues = (typeof values !== 'function' && values !== undefined) 
        ? values 
        : (typeof sql === 'object' && sql ? sql.values : undefined);

      if (queryValues === undefined || queryValues === null || typeof queryValues === 'function') {
        return sqlStr;
      }

      let formattedValues: string;
      try {
        if (Array.isArray(queryValues)) {
          const sanitized = queryValues.map(v => {
            if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
              return `<Buffer ${v.length} bytes>`;
            }
            if (typeof v === 'string' && v.length > 500) {
              return v.substring(0, 500) + '... [truncated]';
            }
            return v;
          });
          formattedValues = JSON.stringify(sanitized);
        } else if (typeof queryValues === 'object') {
          formattedValues = JSON.stringify(queryValues, (key, val) => {
            if (Buffer.isBuffer(val) || val instanceof Uint8Array) return `<Buffer ${val.length} bytes>`;
            if (typeof val === 'string' && val.length > 500) return val.substring(0, 500) + '... [truncated]';
            return val;
          });
        } else {
          formattedValues = String(queryValues);
        }
      } catch (e) {
        formattedValues = '[Unserializable params]';
      }

      return `${sqlStr} | Params: ${formattedValues}`;
    };

    const logQueryToAudit = async (sql: any, values?: any) => {
      try {
        const sqlStr = typeof sql === 'string' ? sql : (sql && sql.sql) ? sql.sql : String(sql);

        // DO NOT log queries targeting audit_logs itself to avoid infinite loops!
        if (/audit_logs/i.test(sqlStr)) {
          return;
        }

        const store = asyncLocalStorage.getStore();
        const req = store?.req;
        
        // Do NOT log system database updates (background queries, migration queries, or non-user requests)
        if (!req || !req.user) {
          return;
        }

        const userId = req.user.id ?? null;
        const username = req.user.username ?? req.user.role;

        if (!username || username === 'SYSTEM' || String(username).startsWith('SYSTEM') || userId === null) {
          return;
        }

        const match = sqlStr.trim().match(/^([A-Za-z]+)/);
        const verb = match ? match[1].toUpperCase() : 'QUERY';

        // Limit logging to ADD (INSERT/REPLACE), UPDATE, and DELETE queries only
        if (!['INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(verb)) {
          return;
        }

        const action = `DB_${verb}`;

        const details = formatQueryDetails(sql, values);

        await rawExecute('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)', [
          userId,
          username,
          action,
          details
        ]);
      } catch (err) {
        // Silently swallow errors (e.g. before audit_logs table exists during initial boot)
      }
    };

    const notifyDbChangeFromSql = (sql: any) => {
      try {
        const changeInfo = extractTableAndDomainFromSql(sql);
        if (changeInfo) {
          const store = asyncLocalStorage.getStore();
          const req = store?.req;
          globalRealtimeEngine.notifyChange({
            domain: changeInfo.domain,
            action: changeInfo.verb.toLowerCase(),
            table: changeInfo.table,
            userId: req?.user?.id ?? null,
            username: req?.user?.username ?? req?.user?.role ?? null
          });
        }
      } catch (err) {
        // Ignore notification errors
      }
    };

    pool.query = (async (...args: any[]) => {
      const res = await rawQuery(...args);
      logQueryToAudit(args[0], args[1]);
      notifyDbChangeFromSql(args[0]);
      return res;
    }) as any;

    pool.execute = (async (...args: any[]) => {
      const res = await rawExecute(...args);
      logQueryToAudit(args[0], args[1]);
      notifyDbChangeFromSql(args[0]);
      return res;
    }) as any;

    pool.getConnection = (async () => {
      const conn = await rawGetConnection();
      const rawConnExecute = conn.execute.bind(conn);
      const rawConnQuery = conn.query.bind(conn);

      conn.query = (async (...args: any[]) => {
        const res = await rawConnQuery(...args);
        logQueryToAudit(args[0], args[1]);
        notifyDbChangeFromSql(args[0]);
        return res;
      }) as any;

      conn.execute = (async (...args: any[]) => {
        const res = await rawConnExecute(...args);
        logQueryToAudit(args[0], args[1]);
        notifyDbChangeFromSql(args[0]);
        return res;
      }) as any;

      return conn;
    }) as any;
    
    let tablesInitialized = false;
    initializeTables = async (activePool: mysql.Pool) => {
      if (tablesInitialized) return;
      console.log('Initializing database tables...');
      await activePool.query('SELECT 1'); // Simple connection test
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS teams (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE
        )
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        team_id INT,
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);

    // Migration: Add vessel_id and email to users and update role to include 'vessel'
    try {
      const [columns]: any = await pool.query('SHOW COLUMNS FROM users');
      const columnNames = columns.map((c: any) => c.Field);
      
      if (!columnNames.includes('vessel_id')) {
        console.log('Migrating users table: Adding vessel_id...');
        await pool.query('ALTER TABLE users ADD COLUMN vessel_id INT');
        await pool.query('ALTER TABLE users ADD FOREIGN KEY (vessel_id) REFERENCES vessels(id)');
      }
      
      if (!columnNames.includes('email')) {
        console.log('Migrating users table: Adding email...');
        await pool.query('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
      }
      
      if (!columnNames.includes('device_id')) {
        console.log('Migrating users table: Adding device_id...');
        await pool.query('ALTER TABLE users ADD COLUMN device_id TEXT');
      } else {
        try {
          await pool.query('ALTER TABLE users MODIFY COLUMN device_id TEXT');
        } catch (e) {}
      }

      if (!columnNames.includes('is_verified')) {
        console.log('Migrating users table: Adding is_verified...');
        await pool.query('ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE');
      }

      if (!columnNames.includes('plain_password')) {
        console.log('Migrating users table: Adding plain_password...');
        await pool.query('ALTER TABLE users ADD COLUMN plain_password VARCHAR(255)');
      }
    } catch (e: any) {
      console.error('Error during users table migration:', e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_registration_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        device_code VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        label VARCHAR(255) DEFAULT NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    try {
      const [drCols]: any = await pool.query("SHOW COLUMNS FROM device_registration_requests LIKE 'label'");
      if (drCols.length === 0) {
        console.log('Migrating device_registration_requests: Adding label column...');
        await pool.query('ALTER TABLE device_registration_requests ADD COLUMN label VARCHAR(255)');
      }
    } catch (e: any) {
      console.error('Error during device_registration_requests table migration:', e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_teams (
        user_id INT NOT NULL,
        team_id INT NOT NULL,
        PRIMARY KEY (user_id, team_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    // Migration: Move existing team_id from users to user_teams
    try {
      const [usersWithTeams]: any = await pool.query('SELECT id, team_id FROM users WHERE team_id IS NOT NULL');
      for (const u of usersWithTeams) {
        await pool.execute('INSERT IGNORE INTO user_teams (user_id, team_id) VALUES (?, ?)', [u.id, u.team_id]);
      }
      // Optional: We could drop users.team_id here, but let's keep it for safety for now
    } catch (e: any) {
      console.error('Migration to user_teams failed:', e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vessels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        team_id INT,
        owner ENUM('Nissen', 'Goodwill') NOT NULL DEFAULT 'Nissen',
        fleet_status VARCHAR(255) NOT NULL DEFAULT 'In Active Fleet',
        photo_data LONGBLOB,
        photo_mimetype VARCHAR(255),
        flag VARCHAR(255),
        date_built VARCHAR(255),
        min_fuel_consumption VARCHAR(255),
        max_fuel_consumption VARCHAR(255),
        type VARCHAR(255) DEFAULT 'Bulk Carrier',
        email VARCHAR(255),
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);

    // Migration: Ensure owner and photo columns exist (Run after table creation)
    try {
      const [columns]: any = await pool.query('SHOW COLUMNS FROM vessels');
      const columnNames = columns.map((c: any) => c.Field);
      
      const hasOwner = columnNames.includes('owner');
      if (!hasOwner) {
        console.log('Adding "owner" column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN owner ENUM('Nissen', 'Goodwill') NOT NULL DEFAULT 'Nissen'");
        console.log('"owner" column added successfully.');
      }

      if (!columnNames.includes('photo_data')) {
        console.log('Adding photo columns to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN photo_data LONGBLOB");
        await pool.query("ALTER TABLE vessels ADD COLUMN photo_mimetype VARCHAR(255)");
      }

      if (!columnNames.includes('next_port')) {
        console.log('Adding route columns to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN next_port VARCHAR(255)");
        await pool.query("ALTER TABLE vessels ADD COLUMN route_status VARCHAR(255)");
        await pool.query("ALTER TABLE vessels ADD COLUMN eta_atb VARCHAR(255)");
        await pool.query("ALTER TABLE vessels ADD COLUMN etd_atd VARCHAR(255)");
        await pool.query("ALTER TABLE vessels ADD COLUMN cargo VARCHAR(255)");
      }

      if (!columnNames.includes('operation_type')) {
        console.log('Adding operation_type column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN operation_type VARCHAR(255)");
      }

      if (!columnNames.includes('remark_from_vessel')) {
        console.log('Adding remark_from_vessel column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN remark_from_vessel TEXT");
      }

      if (!columnNames.includes('flag')) {
        console.log('Adding flag column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN flag VARCHAR(255)");
      }

      if (!columnNames.includes('date_built')) {
        console.log('Adding date_built column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN date_built VARCHAR(255)");
      }

      if (!columnNames.includes('min_fuel_consumption')) {
        console.log('Adding min_fuel_consumption column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN min_fuel_consumption VARCHAR(255)");
      }

      if (!columnNames.includes('max_fuel_consumption')) {
        console.log('Adding max_fuel_consumption column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN max_fuel_consumption VARCHAR(255)");
      }

      if (!columnNames.includes('type')) {
        console.log('Adding type column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN type VARCHAR(255) DEFAULT 'Bulk Carrier'");
      }

      if (!columnNames.includes('fleet_status')) {
        console.log('Adding fleet_status column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN fleet_status VARCHAR(255) NOT NULL DEFAULT 'In Active Fleet'");
      }

      // Ensure all existing vessels have 'In Active Fleet' status
      await pool.query("UPDATE vessels SET fleet_status = 'In Active Fleet' WHERE fleet_status IS NULL OR fleet_status = ''");

      const chartererFields = [
        'charterer_min_hsfo', 'charterer_max_hsfo',
        'charterer_min_lsfo', 'charterer_max_lsfo',
        'charterer_min_mgo', 'charterer_max_mgo',
        'charterer_min_mdo', 'charterer_max_mdo'
      ];

      for (const field of chartererFields) {
        if (!columnNames.includes(field)) {
          console.log(`Adding ${field} column to vessels table...`);
          await pool.query(`ALTER TABLE vessels ADD COLUMN ${field} VARCHAR(50) NULL`);
        }
      }

      if (!columnNames.includes('shackles')) {
        console.log('Adding shackles column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN shackles VARCHAR(255)");
      }

      if (!columnNames.includes('loading_status')) {
        console.log('Adding loading_status column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN loading_status VARCHAR(255)");
      }

      if (!columnNames.includes('email')) {
        console.log('Adding email column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN email VARCHAR(255)");
      }

      if (!columnNames.includes('etb')) {
        console.log('Adding etb column to vessels table...');
        await pool.query("ALTER TABLE vessels ADD COLUMN etb VARCHAR(255)");
      }
    } catch (e: any) {
      console.error('Error during vessels table migration:', e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT,
        team_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        expiration_date DATE NOT NULL,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id),
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);

    // Migration: Add team_id to certificates and make vessel_id nullable
    try {
      const [columns]: any = await pool.query('SHOW COLUMNS FROM certificates');
      const columnNames = columns.map((c: any) => c.Field);
      
      if (!columnNames.includes('team_id')) {
        console.log('Migrating certificates table: Adding team_id...');
        await pool.query('ALTER TABLE certificates ADD COLUMN team_id INT');
        await pool.query('UPDATE certificates c JOIN vessels v ON c.vessel_id = v.id SET c.team_id = v.team_id');
        await pool.query('ALTER TABLE certificates MODIFY COLUMN team_id INT NOT NULL');
        await pool.query('ALTER TABLE certificates ADD FOREIGN KEY (team_id) REFERENCES teams(id)');
      }
      
      const vesselIdCol = columns.find((c: any) => c.Field === 'vessel_id');
      if (vesselIdCol && vesselIdCol.Null === 'NO') {
        console.log('Migrating certificates table: Making vessel_id nullable...');
        await pool.query('ALTER TABLE certificates MODIFY COLUMN vessel_id INT NULL');
      }

      // Drop unique key if it exists as it might conflict with null vessel_id
      try {
        await pool.query('ALTER TABLE certificates DROP INDEX idx_cert_vessel_name');
      } catch (e) {}

      // Migration: Add access_type to certificates
      if (!columnNames.includes('access_type')) {
        console.log('Migrating certificates table: Adding access_type...');
        await pool.query("ALTER TABLE certificates ADD COLUMN access_type ENUM('office', 'vessel', 'any') NOT NULL DEFAULT 'office'");
        // Explicitly update existing ones to 'office'
        await pool.query("UPDATE certificates SET access_type = 'office'");
        console.log('Existing certificates tagged as office only.');
      }

      if (!columnNames.includes('certificate_number')) {
        console.log('Migrating certificates table: Adding certificate_number and date_issued...');
        await pool.query("ALTER TABLE certificates ADD COLUMN certificate_number VARCHAR(255)");
        await pool.query("ALTER TABLE certificates ADD COLUMN date_issued DATE");
      }
    } catch (e: any) {
      console.error('Error during certificates table migration:', e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        certificate_id INT NOT NULL,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (certificate_id) REFERENCES certificates(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        certificate_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(255),
        data LONGBLOB,
        file_type ENUM('certificate', 'supporting') NOT NULL DEFAULT 'certificate',
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (certificate_id) REFERENCES certificates(id)
      )
    `);

    // Migration for existing files table
    try {
      const [columns]: any = await pool.query('SHOW COLUMNS FROM files');
      const columnNames = columns.map((c: any) => c.Field);
      if (!columnNames.includes('data')) {
        console.log('Migrating files table: Adding data and mimetype columns...');
        await pool.query('ALTER TABLE files ADD COLUMN data LONGBLOB');
        await pool.query('ALTER TABLE files ADD COLUMN mimetype VARCHAR(255)');
      }
      if (!columnNames.includes('file_type')) {
        console.log('Migrating files table: Adding file_type column...');
        await pool.query("ALTER TABLE files ADD COLUMN file_type ENUM('certificate', 'supporting') NOT NULL DEFAULT 'certificate'");
      }
    } catch (e: any) {
      console.error('Error during files table migration:', e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(255) NOT NULL UNIQUE,
        setting_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try {
      await pool.query('ALTER TABLE settings MODIFY COLUMN setting_value LONGTEXT');
    } catch (e: any) {
      console.warn('Could not upgrade settings.setting_value to LONGTEXT:', e.message);
    }

    // Migration for Soft Delete: Add deleted_at column to all relevant tables
    try {
      const tables = [
        'teams', 'users', 'vessels', 'certificates', 'notes', 'files',
        'departure_attachments', 'departure_reports', 'arrival_attachments',
        'noon_attachments', 'arrival_reports', 'noon_reports', 'other_reports',
        'fuel_analysis_reports', 'fuel_analysis_files',
        'lube_oil_ldr_reports', 'lube_oil_ldr_files',
        'lube_oil_analysis_reports', 'lube_oil_analysis_files',
        'bunker_bdn_reports', 'bunker_bdn_files',
        'crew_members', 'audit_records', 'audit_comments', 'non_conformities', 'trouble_reports',
        'spare_parts_requisitions', 'requisition_attachments',
        'sms_uploads', 'sms_forms', 'sms_submission_periods',
        'sms_orders', 'sms_order_vessels', 'sms_order_items', 'sms_order_uploads', 'sms_order_templates',
        'flags'
      ];
      
      for (const table of tables) {
        try {
          const [columns]: any = await pool.query(`SHOW COLUMNS FROM ${table}`);
          const columnNames = columns.map((c: any) => c.Field);
          if (!columnNames.includes('deleted_at')) {
            console.log(`Migrating ${table} table: Adding deleted_at...`);
            await pool.query(`ALTER TABLE ${table} ADD COLUMN deleted_at DATETIME NULL`);
          }
        } catch (tblErr: any) {
          // Table might not be created yet if ordered later in startup; ignore or log
        }
      }
    } catch (e: any) {
      console.error('Error during soft delete migration:', e.message);
    }

    // Seed default settings if missing
    const [settingRows]: any = await pool.query('SELECT COUNT(*) as count FROM settings');
    if (settingRows[0].count === 0) {
      const defaultSettings = [
        ['RESEND_API_KEY', process.env.RESEND_API_KEY || ''],
        ['SMTP_FROM', process.env.SMTP_FROM || ''],
        ['DESTINATION_EMAIL', process.env.DESTINATION_EMAIL || 'IT@cleanocean.com.ph'],
        ['ENABLE_EMAIL_ALERTS', process.env.ENABLE_EMAIL_ALERTS || 'true'],
        ['ALERT_SCHEDULE_TYPE', 'interval'],
        ['ALERT_INTERVAL_HOURS', '24'],
        ['ALERT_TIME', '08:00'],
        ['VESSEL_ALERT_SCHEDULE_TYPE', 'interval'],
        ['VESSEL_ALERT_INTERVAL_HOURS', '24'],
        ['VESSEL_ALERT_TIME', '08:00'],
        ['LAST_ALERT_LOG', 'No alerts sent yet.']
      ];
      for (const [key, val] of defaultSettings) {
        await pool.execute('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        username VARCHAR(255),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Delete any past system database updates logged in audit_logs
    try {
      await pool.query("DELETE FROM audit_logs WHERE username = 'SYSTEM' OR username LIKE 'SYSTEM%' OR user_id IS NULL");
    } catch (_) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS departure_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(255),
        data LONGBLOB,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS departure_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        user_id INT NOT NULL,
        voyage_number VARCHAR(100),
        utc_date_time DATETIME NOT NULL,
        departure_port VARCHAR(255) NOT NULL,
        eu_uk_status VARCHAR(50),
        position_long VARCHAR(50),
        position_lat VARCHAR(50),
        operation_type VARCHAR(100),
        cargo_status VARCHAR(50),
        rob_type VARCHAR(50),
        rob_hsfo DECIMAL(10, 2),
        rob_lsfo DECIMAL(10, 2),
        rob_mgo DECIMAL(10, 2),
        rob_mdo DECIMAL(10, 2),
        rob_fw DECIMAL(10, 2),
        foc_port_hsfo DECIMAL(10, 2),
        foc_port_lsfo DECIMAL(10, 2),
        foc_port_mgo DECIMAL(10, 2),
        foc_port_mdo DECIMAL(10, 2),
        attachment_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (attachment_id) REFERENCES departure_attachments(id) ON DELETE SET NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS arrival_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(255),
        data LONGBLOB,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS noon_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        data LONGBLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS arrival_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        user_id INT NOT NULL,
        voyage_number VARCHAR(100),
        utc_date_time DATETIME NOT NULL,
        arrival_port VARCHAR(255) NOT NULL,
        eu_uk_status VARCHAR(50),
        position_long VARCHAR(50),
        position_lat VARCHAR(50),
        operation_type VARCHAR(100),
        cargo_status VARCHAR(50),
        total_time_at_sea VARCHAR(50),
        total_distance VARCHAR(50),
        rob_type VARCHAR(50),
        rob_hsfo DECIMAL(10, 2),
        rob_lsfo DECIMAL(10, 2),
        rob_mgo DECIMAL(10, 2),
        rob_mdo DECIMAL(10, 2),
        rob_fw DECIMAL(10, 2),
        foc_sea_hsfo DECIMAL(10, 2),
        foc_sea_lsfo DECIMAL(10, 2),
        foc_sea_mgo DECIMAL(10, 2),
        foc_sea_mdo DECIMAL(10, 2),
        agent_detail TEXT,
        attachment_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (attachment_id) REFERENCES arrival_attachments(id) ON DELETE SET NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS noon_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        user_id INT NOT NULL,
        voyage_number VARCHAR(100),
        utc_date_time DATETIME NOT NULL,
        position_long VARCHAR(50),
        position_lat VARCHAR(50),
        distance_to_go VARCHAR(50),
        cargo_status VARCHAR(50),
        rob_hsfo DECIMAL(10, 2),
        rob_lsfo DECIMAL(10, 2),
        rob_mgo DECIMAL(10, 2),
        rob_mdo DECIMAL(10, 2),
        foc_hsfo DECIMAL(10, 2),
        foc_lsfo DECIMAL(10, 2),
        foc_mgo DECIMAL(10, 2),
        foc_mdo DECIMAL(10, 2),
        attachment_id INT,
        weather_notation VARCHAR(255) NULL,
        swell_scale_21 VARCHAR(255) NULL,
        wind_scale VARCHAR(255) NULL,
        wave_scale VARCHAR(255) NULL,
        weather_image LONGTEXT NULL,
        remarks TEXT NULL,
        destination_port VARCHAR(255) NULL,
        eta_utc DATETIME NULL,
        agent_details TEXT NULL,
        charterer_min_hsfo VARCHAR(50) NULL,
        charterer_max_hsfo VARCHAR(50) NULL,
        charterer_min_lsfo VARCHAR(50) NULL,
        charterer_max_lsfo VARCHAR(50) NULL,
        charterer_min_mgo VARCHAR(50) NULL,
        charterer_max_mgo VARCHAR(50) NULL,
        charterer_min_mdo VARCHAR(50) NULL,
        charterer_max_mdo VARCHAR(50) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (attachment_id) REFERENCES noon_attachments(id) ON DELETE SET NULL
      )
    `);

    try {
      await pool.query(`ALTER TABLE noon_reports ADD COLUMN remarks TEXT NULL`);
      console.log('Added remarks column to noon_reports table');
    } catch (e) {
      // Column might already exist, ignore error
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS other_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        user_id INT NOT NULL,
        voyage_number VARCHAR(100),
        utc_date_time DATETIME NOT NULL,
        port VARCHAR(255),
        eu_uk_status VARCHAR(50),
        position_long VARCHAR(50),
        position_lat VARCHAR(50),
        operation_type VARCHAR(100),
        cargo_status VARCHAR(50),
        rob_type VARCHAR(50),
        rob_hsfo DECIMAL(10, 2),
        rob_lsfo DECIMAL(10, 2),
        rob_mgo DECIMAL(10, 2),
        rob_mdo DECIMAL(10, 2),
        rob_fw DECIMAL(10, 2),
        foc_port_hsfo DECIMAL(10, 2),
        foc_port_lsfo DECIMAL(10, 2),
        foc_port_mgo DECIMAL(10, 2),
        foc_port_mdo DECIMAL(10, 2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create tables for Fuel Analysis reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fuel_analysis_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        date DATE NOT NULL,
        bdn_number VARCHAR(255) NOT NULL,
        analysis_ref_number VARCHAR(255) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        viscosity VARCHAR(255) NULL,
        density VARCHAR(255) NULL,
        water_content VARCHAR(255) NULL,
        sulfur_content VARCHAR(255) NULL,
        status VARCHAR(50) NOT NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fuel_analysis_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        mimetype VARCHAR(255) NULL,
        data LONGBLOB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES fuel_analysis_reports(id) ON DELETE CASCADE
      )
    `);

    // Create tables for Lube Oil LDR reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lube_oil_ldr_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        date DATE NOT NULL,
        ldr_number VARCHAR(255) NOT NULL,
        product_type VARCHAR(255) NOT NULL,
        quantity VARCHAR(255) NULL,
        supplier VARCHAR(255) NULL,
        viscosity VARCHAR(255) NULL,
        density VARCHAR(255) NULL,
        sulfur_content VARCHAR(255) NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lube_oil_ldr_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        mimetype VARCHAR(255) NULL,
        data LONGBLOB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES lube_oil_ldr_reports(id) ON DELETE CASCADE
      )
    `);

    // Create tables for Lube Oil Analysis reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lube_oil_analysis_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        date DATE NOT NULL,
        machinery_sampled VARCHAR(255) NOT NULL,
        viscosity VARCHAR(255) NULL,
        water_content VARCHAR(255) NULL,
        tbn VARCHAR(255) NULL,
        insolubles VARCHAR(255) NULL,
        status VARCHAR(50) NOT NULL,
        remarks TEXT NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lube_oil_analysis_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        mimetype VARCHAR(255) NULL,
        data LONGBLOB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES lube_oil_analysis_reports(id) ON DELETE CASCADE
      )
    `);

    // Create tables for Bunker BDN
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bunker_bdn_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id INT NOT NULL,
        date DATE NOT NULL,
        bdn_number VARCHAR(255) NOT NULL,
        fuel_type VARCHAR(255) NOT NULL,
        quantity VARCHAR(255) NULL,
        supplier VARCHAR(255) NULL,
        viscosity VARCHAR(255) NULL,
        density VARCHAR(255) NULL,
        sulfur_content VARCHAR(255) NULL,
        remarks TEXT NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bunker_bdn_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        mimetype VARCHAR(255) NULL,
        data LONGBLOB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES bunker_bdn_reports(id) ON DELETE CASCADE
      )
    `);

    // Create table for Crew Members
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crew_members (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rank_name VARCHAR(255) NOT NULL,
        nationality VARCHAR(255) NULL,
        sign_on_date DATE NULL,
        passport_no VARCHAR(100) NULL,
        seaman_book_no VARCHAR(100) NULL,
        status VARCHAR(50) NULL,
        contract_duration INT NULL,
        next_medical_exam DATE NULL,
        next_safety_training DATE NULL,
        vessel_id VARCHAR(50) NULL,
        birthdate DATE NULL,
        contact_number VARCHAR(100) NULL,
        photo LONGTEXT NULL,
        hiring_status VARCHAR(100) DEFAULT 'for rehire',
        si_comments TEXT NULL,
        extensions_count INT DEFAULT 0,
        contract_end_date DATE NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create table for Crew Onboard History
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crew_history (
        id VARCHAR(100) PRIMARY KEY,
        crew_id VARCHAR(100) NOT NULL,
        vessel_id VARCHAR(50) NULL,
        vessel_name VARCHAR(255) NULL,
        rank_name VARCHAR(255) NULL,
        sign_on_date DATE NULL,
        disembark_date DATE NULL,
        remarks TEXT NULL,
        age_at_contract INT NULL,
        contact_at_contract VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await pool.query("ALTER TABLE crew_history ADD COLUMN age_at_contract INT NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_history ADD COLUMN contact_at_contract VARCHAR(255) NULL");
    } catch (_) {}

    // Dynamic schema updates for existing database environments
    try {
      await pool.query("ALTER TABLE crew_members ADD COLUMN birthdate DATE NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members ADD COLUMN contact_number VARCHAR(100) NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members ADD COLUMN photo LONGTEXT NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members ADD COLUMN hiring_status VARCHAR(100) DEFAULT 'for rehire'");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members ADD COLUMN si_comments TEXT NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members ADD COLUMN extensions_count INT DEFAULT 0");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members ADD COLUMN contract_end_date DATE NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY sign_on_date DATE NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY passport_no VARCHAR(100) NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY seaman_book_no VARCHAR(100) NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY next_medical_exam DATE NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY next_safety_training DATE NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY nationality VARCHAR(255) NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY status VARCHAR(50) NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY contract_duration INT NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE crew_members MODIFY vessel_id VARCHAR(50) NULL");
    } catch (_) {}

    // Migration: Add remarks to Lube Oil Analysis and Bunker BDN reports
    try {
      await pool.query("ALTER TABLE lube_oil_analysis_reports ADD COLUMN remarks TEXT NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE bunker_bdn_reports ADD COLUMN remarks TEXT NULL");
    } catch (_) {}

    // Create table for Audit Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_records (
        id VARCHAR(100) PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        vessel_id VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        inspector_name VARCHAR(255) NOT NULL,
        inspector_organization VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        findings_count INT NOT NULL,
        scope TEXT NOT NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await pool.query("ALTER TABLE audit_records ADD COLUMN report_file_name VARCHAR(255) NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE audit_records ADD COLUMN report_file_mimetype VARCHAR(255) NULL");
    } catch (_) {}
    try {
      await pool.query("ALTER TABLE audit_records ADD COLUMN report_file_data LONGBLOB NULL");
    } catch (_) {}

    // Create table for Audit Comments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_comments (
        id VARCHAR(100) PRIMARY KEY,
        audit_id VARCHAR(100) NOT NULL,
        author VARCHAR(255) NOT NULL,
        author_email VARCHAR(255) NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create table for Non Conformities (Audits settings)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS non_conformities (
        id VARCHAR(100) PRIMARY KEY,
        audit_id VARCHAR(100) NOT NULL,
        vessel_id VARCHAR(100) NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        raised_date DATE NOT NULL,
        due_date DATE NOT NULL,
        closeout_date DATE NULL,
        status VARCHAR(50) NOT NULL,
        action_plan TEXT NOT NULL,
        inspector_name VARCHAR(255) NOT NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create table for Trouble Reports (Defects)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trouble_reports (
        id VARCHAR(100) PRIMARY KEY,
        vessel_id VARCHAR(100) NOT NULL,
        deficiency_number VARCHAR(255) NOT NULL,
        date_found DATE NOT NULL,
        deficiency TEXT NOT NULL,
        classification VARCHAR(255) NOT NULL,
        sub_classification VARCHAR(255) NULL,
        others_detail VARCHAR(255) NULL,
        status VARCHAR(50) NOT NULL,
        action_taken TEXT NULL,
        date_resolved DATE NULL,
        reporter_name VARCHAR(255) NOT NULL,
        pms_code VARCHAR(100) NULL,
        rectification_file_name VARCHAR(255) NULL,
        rectification_file_size VARCHAR(50) NULL,
        rectification_file_data LONGBLOB NULL,
        comi_file_name VARCHAR(255) NULL,
        comi_file_size VARCHAR(50) NULL,
        comi_file_data LONGBLOB NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create table for Spare Parts Requisitions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spare_parts_requisitions (
        id VARCHAR(100) PRIMARY KEY,
        storage_key VARCHAR(255) NOT NULL,
        data_json LONGTEXT NOT NULL,
        deleted_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create table for Requisition Attachments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requisition_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        mimetype VARCHAR(255) NULL,
        data LONGBLOB NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create table for Threshold Chat Messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS threshold_chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id VARCHAR(100) NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_id VARCHAR(100) NOT NULL,
        message_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create table for SMS Uploads
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vessel_id VARCHAR(100) NOT NULL,
        vessel_name VARCHAR(255) NOT NULL,
        month VARCHAR(50) NOT NULL,
        year VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size VARCHAR(50) NOT NULL,
        file_data LONGBLOB NOT NULL,
        file_mimetype VARCHAR(255) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL
      )
    `);

    // Create table for SMS Forms (MySQL replacement for LocalStorage/Firebase)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_forms (
        id VARCHAR(100) PRIMARY KEY,
        category VARCHAR(255) NOT NULL,
        formCode VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        formDate VARCHAR(255) NOT NULL,
        scope VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL DEFAULT 'Form',
        vesselType VARCHAR(255) NULL DEFAULT 'All Vessels',
        removeFilenameRestriction TINYINT(1) DEFAULT 0,
        deleted_at DATETIME NULL
      )
    `);

    try {
      const [smsCols]: any = await pool.query('SHOW COLUMNS FROM sms_forms');
      const smsColNames = smsCols.map((c: any) => c.Field);
      if (!smsColNames.includes('vesselType')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN vesselType VARCHAR(255) NULL DEFAULT 'All Vessels'");
      }
      if (!smsColNames.includes('removeFilenameRestriction')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN removeFilenameRestriction TINYINT(1) DEFAULT 0");
      }
      if (!smsColNames.includes('allowedFileTypes')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN allowedFileTypes VARCHAR(255) NULL");
      }
      if (!smsColNames.includes('sort_order')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN sort_order INT DEFAULT 0");
      }
      if (!smsColNames.includes('isHira')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN isHira TINYINT(1) DEFAULT 0");
      }
      if (!smsColNames.includes('template_file_name')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN template_file_name VARCHAR(255) NULL");
      }
      if (!smsColNames.includes('template_file_data')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN template_file_data LONGBLOB NULL");
      }
      if (!smsColNames.includes('template_file_mimetype')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN template_file_mimetype VARCHAR(255) NULL");
      }
      if (!smsColNames.includes('template_file_size')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN template_file_size INT NULL");
      }
      if (!smsColNames.includes('template_files')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN template_files LONGTEXT NULL");
      }
      if (!smsColNames.includes('isAcknowledgementRequired')) {
        await pool.query("ALTER TABLE sms_forms ADD COLUMN isAcknowledgementRequired TINYINT(1) DEFAULT 0");
      }

      const [uploadCols]: any = await pool.query('SHOW COLUMNS FROM sms_uploads');
      const uploadColNames = uploadCols.map((c: any) => c.Field);
      if (!uploadColNames.includes('is_acknowledged')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN is_acknowledged TINYINT(1) DEFAULT 0");
      }
      if (!uploadColNames.includes('ack_file_name')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN ack_file_name VARCHAR(255) NULL");
      }
      if (!uploadColNames.includes('ack_file_data')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN ack_file_data LONGBLOB NULL");
      }
      if (!uploadColNames.includes('ack_file_mimetype')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN ack_file_mimetype VARCHAR(255) NULL");
      }
      if (!uploadColNames.includes('ack_file_size')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN ack_file_size VARCHAR(50) NULL");
      }
      if (!uploadColNames.includes('ack_uploaded_at')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN ack_uploaded_at DATETIME NULL");
      }
      if (!uploadColNames.includes('ack_uploaded_by')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN ack_uploaded_by VARCHAR(255) NULL");
      }
      if (!uploadColNames.includes('category')) {
        await pool.query("ALTER TABLE sms_uploads ADD COLUMN category VARCHAR(255) NULL");
      }
    } catch (e: any) {
      console.error('Error migrating sms_forms columns:', e.message);
    }

    // Create table for SMS Submission Periods (MySQL replacement for LocalStorage/Firebase)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_submission_periods (
        vessel_id VARCHAR(100) NOT NULL,
        vessel_name VARCHAR(255) NOT NULL,
        month VARCHAR(50) NOT NULL,
        year VARCHAR(50) NOT NULL,
        deleted_at DATETIME NULL,
        PRIMARY KEY (vessel_id)
      )
    `);

    // Seed default SMS forms if missing
    try {
      const [formRows]: any = await pool.query('SELECT COUNT(*) as count FROM sms_forms');
      if (formRows[0].count === 0) {
        console.log('Seeding initial SMS forms...');
        const initialForms = [
          { id: 'f_1', category: '1. Monthly', formCode: 'COMI-SM-1-1', description: 'ME & DG Jacket Cooling Fresh Water & BOILER Water condition Report', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_2', category: '1. Monthly', formCode: 'COMI-SM-1-2', description: 'Check List For Certificates & Documents', formDate: '22 May 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_3', category: '1. Monthly', formCode: 'COMI-SM-1-3', description: 'Deck Part Monthly Maintenance Report', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_4', category: '1. Monthly', formCode: 'COMI-SM-1-3A', description: 'Deck Part Monthly Maintenance Report for Container (for 1952 T.E.U)', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_5', category: '1. Monthly', formCode: 'COMI-SM-1-3B', description: 'Deck Part Monthly Maintenance Report for Container (for 2822 T.E.U)', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_6', category: '1. Monthly', formCode: 'COMI-SM-1-4', description: 'Engine Part Monthly Maintenance Report', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_7', category: '1. Monthly', formCode: 'COMI-SM-1-5', description: 'Lube Oil Consumption Report', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_8', category: '2. Voyage', formCode: 'COMI-SM-2-1', description: 'Voyage Pre-Departure & Voyage Plan Checklist', formDate: '12 January 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_9', category: '2. Voyage', formCode: 'COMI-SM-2-2', description: 'Pre-Arrival & Port Operations Checklist', formDate: '20 February 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_10', category: '2. Voyage', formCode: 'COMI-SM-2-3', description: 'Pilot Boarding & Watch handover Guidelines', formDate: '15 March 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_11', category: '3. Quarterly', formCode: 'COMI-SM-3-1', description: 'Enclosed Space Entry & Rescue Drill Report', formDate: '10 January 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_12', category: '3. Quarterly', formCode: 'COMI-SM-3-2', description: 'Lifeboat Launching & Emergency Steering Gear Review', formDate: '28 February 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_13', category: '4A. Semi Annual', formCode: 'COMI-SM-4-1', description: 'Safety Committee Meeting & Officer Review Minutes', formDate: '05 March 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_14', category: '4A. Semi Annual', formCode: 'COMI-SM-4-2', description: 'Onboard Safety Training & Drills Assessment Log', formDate: '18 April 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_15', category: '4B. Annually', formCode: 'COMI-SM-4A-1', description: "Master's Review and Evaluation of Safety Management System (SMS)", formDate: '14 May 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_16', category: '4B. Annually', formCode: 'COMI-SM-4A-2', description: 'Annual Fire-Fighting & Safety Appliance Certificate Verification', formDate: '10 June 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_17', category: '5. Occasional', formCode: 'COMI-SM-5-1', description: 'Hot Work Authorization Permit', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_18', category: '5. Occasional', formCode: 'COMI-SM-5-2', description: 'Enclosed Space Entry Permit', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_19', category: '5. Occasional', formCode: 'COMI-SM-5-3', description: 'Working At Height / Overboard Permit', formDate: '12 January 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_20', category: '6. Letter Form', formCode: 'COMI-SM-6-1', description: 'Safety Equipment Requisition Letter', formDate: '11 February 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_21', category: '6. Letter Form', formCode: 'COMI-SM-6-2', description: 'Non-Conformity Formal Letter of Protest', formDate: '05 April 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_22', category: '7. Company Records (Office)', formCode: 'COMI-SM-7-1', description: 'Internal Fleet Audit Inspection Findings & Actions', formDate: '22 March 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_23', category: '7. Company Records (Office)', formCode: 'COMI-SM-7-2', description: 'Management Review Committee Records', formDate: '10 May 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_24', category: '8. Safety and Security Forms', formCode: 'COMI-SM-8-1', description: 'ISPS Code Onboard Security Assessment Worksheet', formDate: '18 June 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_25', category: '8. Safety and Security Forms', formCode: 'COMI-SM-8-2', description: 'Continuous Synopsis Record (CSR) Tracking Log', formDate: '01 July 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_26', category: '9. Free Form', formCode: 'COMI-SM-9-1', description: 'Safety Suggestion Card / Hazard Identification Form', formDate: '28 November 2025', scope: 'All Vessels', type: 'Form' },
          { id: 'f_27', category: '9. Free Form', formCode: 'COMI-SM-9-2', description: 'Near-Miss Incident Narrative Report', formDate: '12 January 2026', scope: 'All Vessels', type: 'Form' },
          { id: 'f_malta_deck', category: '1. Monthly', formCode: 'COMI-SM-1-8-DECK-MALTA', description: 'Malta Flag State Deck Log & Safety Maintenance Checklist', formDate: '28 November 2025', scope: 'All Malta Vessels', type: 'Form' },
          { id: 'f_malta_engine', category: '1. Monthly', formCode: 'COMI-SM-1-8-ENGINE-MALTA', description: 'Malta Flag State Engine Log & Auxiliary Equipment Checklist', formDate: '28 November 2025', scope: 'All Malta Vessels', type: 'Form' }
        ];
        for (const form of initialForms) {
          await pool.execute(
            'INSERT INTO sms_forms (id, category, formCode, description, formDate, scope, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [form.id, form.category, form.formCode, form.description, form.formDate, form.scope, form.type]
          );
        }
      } else {
        // Ensure Malta forms exist for existing databases as well
        await pool.execute(
          'INSERT IGNORE INTO sms_forms (id, category, formCode, description, formDate, scope, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['f_malta_deck', '1. Monthly', 'COMI-SM-1-8-DECK-MALTA', 'Malta Flag State Deck Log & Safety Maintenance Checklist', '28 November 2025', 'All Malta Vessels', 'Form']
        );
        await pool.execute(
          'INSERT IGNORE INTO sms_forms (id, category, formCode, description, formDate, scope, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['f_malta_engine', '1. Monthly', 'COMI-SM-1-8-ENGINE-MALTA', 'Malta Flag State Engine Log & Auxiliary Equipment Checklist', '28 November 2025', 'All Malta Vessels', 'Form']
        );
      }

      // Automatically update existing records with legacy or alternative section labels
      try {
        await pool.query("UPDATE sms_forms SET category = '4A. Semi Annual' WHERE category IN ('4. Semi Annual', '4.A Semi Annual', '4A Semi Annual')");
        await pool.query("UPDATE sms_forms SET category = '4B. Annually' WHERE category IN ('4A. Annually', '4B. Anually', '4B Annually')");
        await pool.query("UPDATE sms_uploads SET category = '4A. Semi Annual' WHERE category IN ('4. Semi Annual', '4.A Semi Annual', '4A Semi Annual')");
        await pool.query("UPDATE sms_uploads SET category = '4B. Annually' WHERE category IN ('4A. Annually', '4B. Anually', '4B Annually')");

        // Correct COMI-SM-1-16 template filename and trim form codes
        await pool.query("UPDATE sms_forms SET template_file_name = 'COMI-SM-1-16 Purifier Report (Self ejector) (22 May 2026).doc' WHERE formCode = 'COMI-SM-1-16' AND (template_file_name LIKE '%COMI-SM-1-6%' OR template_file_name IS NULL)");
        await pool.query("UPDATE sms_order_items SET form_code = TRIM(form_code)");
        await pool.query("UPDATE sms_forms SET formCode = TRIM(formCode)");
      } catch (e: any) {
        console.warn('Note on updating SMS form categories in database:', e.message);
      }
    } catch (err: any) {
      console.error('Failed to seed initial SMS forms:', err.message);
    }

    // Seed default SMS submission periods if missing
    try {
      const [periodRows]: any = await pool.query('SELECT COUNT(*) as count FROM sms_submission_periods');
      if (periodRows[0].count === 0) {
        console.log('Seeding initial SMS submission periods...');
        const initialSubmissions = [
          { vesselId: 'v1', vesselName: 'AQUAGRACE', month: 'June', year: '2026' },
          { vesselId: 'v2', vesselName: 'BELFORTE', month: 'June', year: '2026' },
          { vesselId: 'v3', vesselName: 'CD HUELVA', month: 'June', year: '2026' },
          { vesselId: 'v4', vesselName: 'CD MANZANILLO', month: 'June', year: '2026' },
          { vesselId: 'v5', vesselName: 'CL KIWAMI', month: 'June', year: '2026' },
          { vesselId: 'v6', vesselName: 'CNC CHEETAH', month: 'June', year: '2026' },
          { vesselId: 'v7', vesselName: 'CNC MARS', month: 'June', year: '2026' },
          { vesselId: 'v8', vesselName: 'CNC NEPTUNE', month: 'June', year: '2026' },
          { vesselId: 'v9', vesselName: 'CNC PUMA', month: 'May', year: '2026' },
          { vesselId: 'v10', vesselName: 'COPENHAGEN COMMERCE', month: 'June', year: '2026' },
          { vesselId: 'v11', vesselName: 'EASTERN HAWK', month: 'June', year: '2026' },
          { vesselId: 'v12', vesselName: 'HANDY MERCHANT', month: 'June', year: '2026' },
          { vesselId: 'v13', vesselName: 'LIGNUM NETWORK', month: 'June', year: '2026' }
        ];
        for (const sub of initialSubmissions) {
          await pool.execute(
            'INSERT INTO sms_submission_periods (vessel_id, vessel_name, month, year) VALUES (?, ?, ?, ?)',
            [sub.vesselId, sub.vesselName, sub.month, sub.year]
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to seed initial SMS submission periods:', err.message);
    }

    // Seed default SMS uploads if missing
    try {
      const [uploadRows]: any = await pool.query('SELECT COUNT(*) as count FROM sms_uploads');
      if (uploadRows[0].count === 0) {
        console.log('Seeding initial SMS uploads...');
        const initialUploads = [
          { vesselId: 'v3', vesselName: 'CD HUELVA', month: 'June', year: '2026', fileName: 'CD_HUELVA_June_2026_SMS_Package.zip', fileSize: '14.2 MB' },
          { vesselId: 'v6', vesselName: 'CNC CHEETAH', month: 'June', year: '2026', fileName: 'CNC_CHEETAH_June_2026_Forms.pdf', fileSize: '8.4 MB' },
          { vesselId: 'v8', vesselName: 'CNC NEPTUNE', month: 'June', year: '2026', fileName: 'CNC_NEPTUNE_SMS_June26.zip', fileSize: '18.1 MB' },
          { vesselId: 'v9', vesselName: 'CNC PUMA', month: 'May', year: '2026', fileName: 'CNC_PUMA_May_Submission.pdf', fileSize: '12.5 MB' },
          { vesselId: 'v12', vesselName: 'HANDY MERCHANT', month: 'April', year: '2026', fileName: 'HandyMerchant_SMS_April_2026.zip', fileSize: '15.9 MB' },
          { vesselId: 'v13', vesselName: 'LIGNUM NETWORK', month: 'June', year: '2026', fileName: 'LignumNet_June2026_SafetyForms.zip', fileSize: '22.0 MB' }
        ];
        for (const up of initialUploads) {
          const dummyBuffer = Buffer.from('Dummy SMS package content for ' + up.fileName);
          await pool.execute(
            'INSERT INTO sms_uploads (vessel_id, vessel_name, month, year, file_name, file_size, file_data, file_mimetype) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [up.vesselId, up.vesselName, up.month, up.year, up.fileName, up.fileSize, dummyBuffer, 'application/zip']
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to seed initial SMS uploads:', err.message);
    }

    // Create tables for SMS Order Lists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_orders (
        id VARCHAR(100) PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        deadline_date VARCHAR(50) NOT NULL,
        instructions TEXT NULL,
        created_by_id VARCHAR(100) NOT NULL,
        created_by_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_order_vessels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        vessel_id VARCHAR(100) NOT NULL,
        vessel_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        completed_at DATETIME NULL,
        deleted_at DATETIME NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        form_id VARCHAR(100) NOT NULL,
        form_code VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        form_date VARCHAR(255) NULL,
        type VARCHAR(50) DEFAULT 'Form',
        is_hira TINYINT(1) DEFAULT 0,
        remove_filename_restriction TINYINT(1) DEFAULT 0,
        allowed_file_types VARCHAR(255) NULL,
        template_file_name VARCHAR(255) NULL,
        template_files LONGTEXT NULL,
        sort_order INT DEFAULT 0,
        deleted_at DATETIME NULL
      )
    `);

    try {
      await pool.query('ALTER TABLE sms_order_items ADD COLUMN form_date VARCHAR(255) NULL');
    } catch (e) {
      // Column might already exist
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_order_uploads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        vessel_id VARCHAR(100) NOT NULL,
        vessel_name VARCHAR(255) NOT NULL,
        form_id VARCHAR(100) NOT NULL,
        form_code VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size VARCHAR(50) NOT NULL,
        file_mimetype VARCHAR(255) NOT NULL,
        file_data LONGBLOB NOT NULL,
        b2_folder_path VARCHAR(255) NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by VARCHAR(255) NOT NULL,
        checked_at DATETIME NULL,
        checked_by VARCHAR(255) NULL,
        deleted_at DATETIME NULL
      )
    `);

    try {
      await pool.query('ALTER TABLE sms_order_uploads ADD COLUMN checked_at DATETIME NULL');
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query('ALTER TABLE sms_order_uploads ADD COLUMN checked_by VARCHAR(255) NULL');
    } catch (e) {
      // Column might already exist
    }

    try {
      await pool.query('ALTER TABLE sms_order_uploads ADD COLUMN replace_requested_at DATETIME NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE sms_order_uploads ADD COLUMN replace_requested_by VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE sms_order_uploads ADD COLUMN replace_reason TEXT NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE sms_order_uploads ADD COLUMN item_id INT NULL');
    } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_order_upload_reads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        upload_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_upload (user_id, upload_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_order_templates (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        item_form_ids TEXT NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL
      )
    `);

    // Seed default SMS orders and templates if missing
    try {
      const [orderRows]: any = await pool.query('SELECT COUNT(*) as count FROM sms_orders');
      if (orderRows[0].count === 0) {
        console.log('Seeding initial SMS orders...');
        const initialOrderId1 = 'ord_sample_1';
        await pool.execute(
          `INSERT INTO sms_orders (id, label, deadline_date, instructions, created_by_id, created_by_name) VALUES (?, ?, ?, ?, ?, ?)`,
          [initialOrderId1, 'Annual Safety & Environmental Audit 2026', '2026-09-15', 'Please ensure all monthly cooling water tests, equipment checklists, and enclosed space drill records are scanned and uploaded with complete officer signatures prior to deadline.', '1', 'Superintendent (PIC)']
        );

        const vList = [
          { vesselId: 'v3', vesselName: 'CD HUELVA' },
          { vesselId: 'v6', vesselName: 'CNC CHEETAH' },
          { vesselId: 'v8', vesselName: 'CNC NEPTUNE' }
        ];
        for (const v of vList) {
          await pool.execute(
            `INSERT INTO sms_order_vessels (order_id, vessel_id, vessel_name, status) VALUES (?, ?, ?, ?)`,
            [initialOrderId1, v.vesselId, v.vesselName, 'Pending']
          );
        }

        const fList = [
          { formId: 'f_1', formCode: 'COMI-SM-1-1', category: '1. Monthly', description: 'ME & DG Jacket Cooling Fresh Water & BOILER Water condition Report', type: 'Form', isHira: 0 },
          { formId: 'f_2', formCode: 'COMI-SM-1-2', category: '1. Monthly', description: 'Check List For Certificates & Documents', type: 'Form', isHira: 0 },
          { formId: 'f_11', formCode: 'COMI-SM-3-1', category: '3. Quarterly', description: 'Enclosed Space Entry & Rescue Drill Report', type: 'Form', isHira: 0 },
          { formId: 'f_hira', formCode: 'COMI-SM-5-HIRA', category: '5. Occasional', description: 'Hazard Identification & Risk Assessment (HIRA) Form', type: 'Form', isHira: 1 }
        ];
        let sIdx = 1;
        for (const f of fList) {
          await pool.execute(
            `INSERT INTO sms_order_items (order_id, form_id, form_code, category, description, type, is_hira, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [initialOrderId1, f.formId, f.formCode, f.category, f.description, f.type, f.isHira, sIdx++]
          );
        }

        // Seed initial saved template
        await pool.execute(
          `INSERT INTO sms_order_templates (id, title, description, item_form_ids, created_by) VALUES (?, ?, ?, ?, ?)`,
          ['tpl_standard_audit', 'Standard Pre-Audit & Risk Assessment Pack', 'Standard 4-form pack for routine annual and quarterly audits.', JSON.stringify(['f_1', 'f_2', 'f_11', 'f_hira']), 'Management']
        );
      }
    } catch (e: any) {
      console.error('Error seeding initial SMS orders:', e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS flags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        deleted_at DATETIME NULL
      )
    `);

    try {
      await pool.query('ALTER TABLE flags ADD COLUMN deleted_at DATETIME NULL');
    } catch (e) {}

    try {
      const [flagRows]: any = await pool.query('SELECT COUNT(*) as count FROM flags');
      if (flagRows[0].count === 0) {
        console.log('Seeding initial flags...');
        const initialFlags = ['Panama', 'Marshall Islands', 'Liberia', 'Singapore', 'Bahamas', 'Malta', 'Cyprus'];
        for (const flag of initialFlags) {
          await pool.execute('INSERT INTO flags (name) VALUES (?)', [flag]);
        }
      }
    } catch (err: any) {
      console.error('Failed to seed initial flags:', err.message);
    }

    try {
      await pool.query('ALTER TABLE departure_reports ADD COLUMN voyage_number VARCHAR(100)');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE arrival_reports ADD COLUMN voyage_number VARCHAR(100)');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN voyage_number VARCHAR(100)');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN attachment_id INT, ADD FOREIGN KEY (attachment_id) REFERENCES noon_attachments(id) ON DELETE SET NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN weather_notation VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN swell_scale_21 VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN wind_scale VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN wave_scale VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN weather_image LONGTEXT NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN destination_port VARCHAR(255) NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN eta_utc DATETIME NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN agent_details TEXT NULL');
    } catch (e) {}

    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_min_hsfo VARCHAR(50) NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_max_hsfo VARCHAR(50) NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_min_lsfo VARCHAR(50) NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_max_lsfo VARCHAR(50) NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_min_mgo VARCHAR(50) NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_max_mgo VARCHAR(50) NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_min_mdo VARCHAR(50) NULL');
    } catch (e) {}
    try {
      await pool.query('ALTER TABLE noon_reports ADD COLUMN charterer_max_mdo VARCHAR(50) NULL');
    } catch (e) {}

    // Migration for existing databases: ensure new keys exist
      const newKeys = [
        ['RESEND_API_KEY', process.env.RESEND_API_KEY || ''],
        ['ALERT_SCHEDULE_TYPE', 'interval'],
        ['ALERT_INTERVAL_HOURS', '24'],
        ['ALERT_TIME', '08:00'],
        ['VESSEL_ALERT_SCHEDULE_TYPE', 'interval'],
        ['VESSEL_ALERT_INTERVAL_HOURS', '24'],
        ['VESSEL_ALERT_TIME', '08:00']
      ];
      for (const [key, val] of newKeys) {
        await pool.execute('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
      }

      // Sync vessel's next_port with latest arrival report
      try {
        console.log('Syncing vessels next_port with latest arrival reports...');
        await pool.query(`
          UPDATE vessels v
          JOIN (
              SELECT ar1.vessel_id, ar1.arrival_port
              FROM arrival_reports ar1
              JOIN (
                  SELECT vessel_id, MAX(utc_date_time) as max_utc
                  FROM arrival_reports
                  WHERE deleted_at IS NULL
                  GROUP BY vessel_id
              ) ar2 ON ar1.vessel_id = ar2.vessel_id AND ar1.utc_date_time = ar2.max_utc
              WHERE ar1.deleted_at IS NULL
          ) latest_arrival ON v.id = latest_arrival.vessel_id
          SET v.next_port = latest_arrival.arrival_port
        `);
        console.log('Sync completed.');
      } catch (e: any) {
        console.error('Error syncing next_port:', e.message);
      }

    // Seed initial data if empty
    const [teamRows]: any = await pool.query('SELECT COUNT(*) as count FROM teams');
    if (teamRows[0].count === 0) {
      console.log('Seeding initial data...');
      const teams = ['Team A', 'Team B', 'Team D', 'Team C'];
      for (const name of teams) {
        await pool.execute('INSERT INTO teams (name) VALUES (?)', [name]);
      }
      
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await pool.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin']);
    } else {
      // Migration: Rename existing teams
      console.log('Running team name migration...');
      await activePool.execute("UPDATE teams SET name = 'Team A' WHERE name = 'Team Alpha'");
      await activePool.execute("UPDATE teams SET name = 'Team B' WHERE name = 'Team Beta'");
      await activePool.execute("UPDATE teams SET name = 'Team C' WHERE name = 'Team Delta'");
      await activePool.execute("UPDATE teams SET name = 'Team D' WHERE name = 'Team Gamma'");
    }
    tablesInitialized = true;
    console.log('Database initialized successfully.');
  };

  if (pool) {
    initializeTables(pool).then(() => {
      dbError = null;
      if (pool) (pool as any)._dbErrorCode = null;
    }).catch(err => {
      console.error('DATABASE INITIALIZATION FAILED:', err.message || err);
      dbError = err.message || 'Database initialization failed';
      if (pool) (pool as any)._dbErrorCode = err.code || null;
    });
  }
} catch (err: any) {
  console.error('DATABASE POOL CREATION FAILED:', err);
  dbError = err.message;
  if (pool) (pool as any)._dbErrorCode = err.code;
}

  // File Upload Setup (Database-backed)
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage
  });
  
  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Content Security Policy (CSP) & Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
      "img-src 'self' data: blob: https: http: https://*.tile.openstreetmap.org https://unpkg.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "connect-src 'self' ws: wss: https:; " +
      "worker-src 'self' blob: https://unpkg.com; " +
      "frame-src 'self'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';"
    );
    // Other helpful security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    next();
  });

  app.use((req, res, next) => {
    asyncLocalStorage.run({ req }, next);
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Database availability middleware
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/db-status') return next();
    if (!pool || dbError) {
      return res.status(503).json({ 
        error: 'Database not available', 
        details: dbError || 'Connection pool not initialized',
        setup_instructions: 'Please configure DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in the Secrets panel.'
      });
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      connected: !!pool && !dbError,
      status: pool && !dbError ? 'ok' : 'degraded', 
      database: pool && !dbError ? 'connected' : 'disconnected',
      error: dbError,
      timestamp: new Date().toISOString() 
    });
  });

  app.get('/api/db-status', async (req, res) => {
    try {
      const host = process.env.DB_HOST || 'localhost';
      const port = Number(process.env.DB_PORT) || 3306;
      const outboundIp = await getOutboundIp();

      // Quick TCP check for port 3306 first (1.5s timeout)
      let tcpCheck = 'PENDING';
      try {
        tcpCheck = await new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(1500);
          socket.on('connect', () => { socket.destroy(); resolve('OPEN'); });
          socket.on('timeout', () => { socket.destroy(); resolve('TIMEOUT'); });
          socket.on('error', (err) => { socket.destroy(); resolve(`ERROR: ${err.message}`); });
          socket.connect(port, host);
        }) as string;
      } catch (e: any) {
        tcpCheck = `EXCEPTION: ${e.message}`;
      }

      // If TCP port is open and pool exists, verify with SELECT 1 and initialize tables
      if (tcpCheck === 'OPEN' && pool) {
        try {
          await pool.query('SELECT 1');
          if (initializeTables) await initializeTables(pool);
          dbError = null;
          (pool as any)._dbErrorCode = null;
        } catch (pingErr: any) {
          dbError = pingErr.message;
          (pool as any)._dbErrorCode = pingErr.code;
        }
      } else if (tcpCheck !== 'OPEN') {
        dbError = `connect ${tcpCheck === 'TIMEOUT' ? 'ETIMEDOUT' : tcpCheck}`;
        if (pool) (pool as any)._dbErrorCode = tcpCheck === 'TIMEOUT' ? 'ETIMEDOUT' : 'TCP_ERROR';
      }

      res.json({ 
        connected: !!pool && !dbError && tcpCheck === 'OPEN',
        error: dbError,
        errorCode: (pool as any)?._dbErrorCode || null,
        tcpStatus: tcpCheck,
        webStatus: 'SKIPPED',
        outboundIp: outboundIp,
        diagnostics: {
          resolvedDbHost,
          dbUserUsed,
          dbNameUsed,
          dbPassSource,
          dbPassLength,
          dbPortUsed: port
        },
        config: {
          host,
          user: dbUserUsed,
          database: dbNameUsed,
          port
        }
      });
    } catch (err: any) {
      console.error('CRITICAL ERROR in /api/db-status:', err);
      res.status(500).json({ 
        error: 'Internal Server Error in status check', 
        details: err.message
      });
    }
  });

  app.post('/api/retry-db', async (req, res) => {
    try {
      if (pool) {
        try {
          await pool.query('SELECT 1');
          if (initializeTables) await initializeTables(pool);
          dbError = null;
          (pool as any)._dbErrorCode = null;
        } catch (pingErr: any) {
          dbError = pingErr.message;
          (pool as any)._dbErrorCode = pingErr.code;
        }
      }
      const host = process.env.DB_HOST || 'localhost';
      const port = Number(process.env.DB_PORT) || 3306;
      const outboundIp = await getOutboundIp();

      res.json({
        connected: !!pool && !dbError,
        error: dbError,
        errorCode: (pool as any)?._dbErrorCode || null,
        outboundIp
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/public-settings', async (req, res) => {
    if (!pool) return res.json({});
    try {
      const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings WHERE setting_key IN ("APP_LOGO")');
      const settings = (rows as any[]).reduce((acc, row) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
      }, {});
      res.json(settings);
    } catch (e: any) {
      console.error('Failed to fetch public settings:', e);
      res.json({});
    }
  });

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // ==================== REALTIME LONG-POLLING API ====================
  app.get('/api/realtime/poll', authenticate, (req: any, res: any) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const lastVersion = parseInt(String(req.query.version || '0'), 10) || 0;
      const timeoutMs = parseInt(String(req.query.timeout || '20000'), 10) || 20000;
      const domainsStr = req.query.domains ? String(req.query.domains) : '';
      const domains = domainsStr ? domainsStr.split(',').map((d: string) => d.trim()).filter(Boolean) : undefined;
      const subscriberId = `${req.user?.id || 'u'}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      req.on('close', () => {
        globalRealtimeEngine.removeSubscriber(subscriberId);
      });

      globalRealtimeEngine.registerSubscriber(subscriberId, res, req.user, lastVersion, domains, timeoutMs);
    } catch (e: any) {
      console.warn('Realtime poll error:', e?.message || e);
      if (!res.headersSent) {
        res.status(500).json({ error: e.message, version: globalRealtimeEngine.getVersion() });
      }
    }
  });

  app.get('/api/realtime/status', (req: any, res: any) => {
    res.json({
      status: 'active',
      version: globalRealtimeEngine.getVersion(),
      activeSubscribers: globalRealtimeEngine.getSubscriberCount(),
      timestamp: Date.now()
    });
  });

  app.post('/api/realtime/notify', authenticate, (req: any, res: any) => {
    const { domain, action, table, meta } = req.body || {};
    if (domain) {
      globalRealtimeEngine.notifyChange({
        domain,
        action: action || 'update',
        table: table || domain,
        userId: req.user?.id ?? null,
        username: req.user?.username ?? req.user?.role ?? null,
        meta
      });
    }
    res.json({ success: true, version: globalRealtimeEngine.getVersion() });
  });

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  const isTeamPicOrAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'team_pic' && req.user.role !== 'user') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  const canAddCertificate = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'team_pic' && req.user.role !== 'vessel' && req.user.role !== 'user') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  const logAudit = async (userId: number | null, username: string | null, action: string, details: string) => {
    try {
      if (!userId || !username || username === 'SYSTEM' || String(username).startsWith('SYSTEM')) {
        return;
      }
      await pool.execute('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)', [userId, username, action, details]);
    } catch (err) {
      console.error('Failed to log audit:', err);
    }
  };

  const syncVesselNextPort = async (vesselId: number) => {
    try {
      const [latest]: any = await pool.execute(
        'SELECT arrival_port FROM arrival_reports WHERE vessel_id = ? AND deleted_at IS NULL ORDER BY utc_date_time DESC LIMIT 1',
        [vesselId]
      );
      if (latest.length > 0) {
        await pool.execute('UPDATE vessels SET next_port = ? WHERE id = ?', [latest[0].arrival_port, vesselId]);
      } else {
        await pool.execute('UPDATE vessels SET next_port = NULL WHERE id = ?', [vesselId]);
      }
    } catch (err) {
      console.error(`Failed to sync next_port for vessel ${vesselId}:`, err);
    }
  };

  // Auth Routes
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const [rows]: any = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const [userTeams]: any = await pool.execute('SELECT team_id FROM user_teams WHERE user_id = ?', [user.id]);
    const teamIds = userTeams.map((ut: any) => ut.team_id);
    
    let vesselName = null;
    let vesselId = user.vessel_id;
    if (vesselId) {
      try {
        const [vRows]: any = await pool.execute('SELECT name FROM vessels WHERE id = ?', [vesselId]);
        if (vRows.length > 0) vesselName = vRows[0].name;
      } catch (err) {}
    } else if (user.role === 'vessel') {
      try {
        const [vRows]: any = await pool.execute('SELECT id, name FROM vessels WHERE name = ? OR LOWER(name) = ? OR LOWER(name) LIKE ?', [user.username, user.username.toLowerCase(), `%${user.username.toLowerCase()}%`]);
        if (vRows.length > 0) {
          vesselId = vRows[0].id;
          vesselName = vRows[0].name;
        }
      } catch (err) {}
    }

    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      team_ids: teamIds, 
      vessel_id: vesselId,
      vessel_name: vesselName,
      device_id: user.device_id,
      is_verified: !!user.is_verified
    }, JWT_SECRET);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        team_ids: teamIds, 
        vessel_id: vesselId,
        vessel_name: vesselName,
        device_id: user.device_id,
        is_verified: !!user.is_verified
      } 
    });
  });

  // Helper to extract hardware fingerprint from device ID
  function extractDeviceFingerprint(id: string | null | undefined): string | null {
    if (!id || typeof id !== 'string') return null;
    const m = id.match(/fp_([a-fA-F0-9]+)/);
    return m ? m[1].toLowerCase() : null;
  }

  interface ServerDeviceItem {
    id: string;
    label: string;
    created_at?: string;
  }

  function parseServerDeviceList(raw: string | null | undefined): ServerDeviceItem[] {
    if (!raw) return [];
    const trimmed = String(raw).trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any, idx: number) => {
            if (typeof item === 'string') {
              return {
                id: item,
                label: `Device ${idx + 1}`,
                created_at: new Date().toISOString()
              };
            }
            if (item && typeof item === 'object' && item.id) {
              return {
                id: String(item.id),
                label: item.label ? String(item.label) : `Device ${idx + 1}`,
                created_at: item.created_at || new Date().toISOString()
              };
            }
            return null;
          }).filter(Boolean) as ServerDeviceItem[];
        }
      } catch (e) {}
    }
    return trimmed.split(',').map((s, idx) => ({
      id: s.trim(),
      label: `Device ${idx + 1}`,
      created_at: new Date().toISOString()
    })).filter(d => Boolean(d.id));
  }

  // Device Registration Routes
  app.post('/api/device/register', authenticate, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { device_id, device_code, label } = req.body;
    const user_id = req.user.id;
    try {
      // For vessel users, check if they already have verified devices
      const [userRows]: any = await pool.execute(
        'SELECT device_id, is_verified, role FROM users WHERE id = ?',
        [user_id]
      );
      if (userRows.length > 0) {
        const user = userRows[0];
        if (user.role === 'vessel') {
          const registeredDevices = parseServerDeviceList(user.device_id);

          // 1. Direct exact match
          const exactIndex = registeredDevices.findIndex(d => d.id === device_id);
          if (exactIndex !== -1) {
            if (label && label.trim() && !registeredDevices[exactIndex].label) {
              registeredDevices[exactIndex].label = label.trim();
              await pool.execute('UPDATE users SET device_id = ? WHERE id = ?', [JSON.stringify(registeredDevices), user_id]);
            }
            return res.json({ success: true, already_registered: true, message: 'Device is already registered and verified.' });
          }

          // 2. Hardware profile / fingerprint match (Survives Edge/browser storage clearing)
          const incomingFp = extractDeviceFingerprint(device_id);
          if (incomingFp) {
            const matchIndex = registeredDevices.findIndex(d => extractDeviceFingerprint(d.id) === incomingFp);
            if (matchIndex !== -1) {
              // Update registered device entry with new random seed while maintaining verified status and label
              registeredDevices[matchIndex].id = device_id;
              if (label && label.trim()) {
                registeredDevices[matchIndex].label = label.trim();
              }
              const newDeviceIdStr = JSON.stringify(registeredDevices);
              await pool.execute(
                'UPDATE users SET device_id = ?, is_verified = TRUE WHERE id = ?',
                [newDeviceIdStr, user_id]
              );
              return res.json({ 
                success: true, 
                already_registered: true, 
                device_id: newDeviceIdStr,
                message: 'Hardware profile recognized. Device registration restored automatically.' 
              });
            }
          }

          if (registeredDevices.length >= 2) {
            return res.status(400).json({ error: 'You have reached the maximum limit of 2 registered devices for this vessel account. Please contact an Administrator to remove an existing device.' });
          }
        }
      }

      // Clear any pending requests for this user first
      await pool.execute("DELETE FROM device_registration_requests WHERE user_id = ? AND status = 'pending'", [user_id]);
      
      const deviceLabel = label && String(label).trim() ? String(label).trim() : null;
      await pool.execute(
        'INSERT INTO device_registration_requests (user_id, device_id, device_code, label) VALUES (?, ?, ?, ?)',
        [user_id, device_id, device_code, deviceLabel]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/device/status', authenticate, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const user_id = req.user.id;
    try {
      const [rows]: any = await pool.execute(
        'SELECT is_verified, device_id FROM users WHERE id = ?',
        [user_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
      
      const [pending]: any = await pool.execute(
        "SELECT * FROM device_registration_requests WHERE user_id = ? AND status = 'pending'",
        [user_id]
      );

      res.json({ 
        is_verified: !!rows[0].is_verified, 
        device_id: rows[0].device_id,
        has_pending_request: pending.length > 0
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/device-requests', authenticate, isTeamPicOrAdmin, async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const [rows]: any = await pool.query(`
        SELECT dr.*, u.username, v.name as vessel_name 
        FROM device_registration_requests dr
        JOIN users u ON dr.user_id = u.id
        LEFT JOIN vessels v ON u.vessel_id = v.id
        WHERE dr.status = 'pending'
        ORDER BY dr.created_at DESC
      `);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/registered-devices', authenticate, isTeamPicOrAdmin, async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const [rows]: any = await pool.query(`
        SELECT u.id, u.username, u.device_id, u.is_verified, v.name as vessel_name 
        FROM users u
        LEFT JOIN vessels v ON u.vessel_id = v.id
        WHERE u.role = 'vessel' AND u.device_id IS NOT NULL AND u.is_verified = TRUE
        ORDER BY v.name ASC, u.username ASC
      `);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update a device's label (Accessible to Admin, Management/team_pic, PIC/user)
  app.post('/api/admin/update-device-label', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { user_id, device_id, label } = req.body;
    if (!user_id || !device_id) {
      return res.status(400).json({ error: 'user_id and device_id are required' });
    }

    try {
      const [userRows]: any = await pool.execute('SELECT id, username, device_id FROM users WHERE id = ?', [user_id]);
      if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

      const devices = parseServerDeviceList(userRows[0].device_id);
      const target = devices.find(d => d.id === device_id);
      if (!target) {
        return res.status(404).json({ error: 'Device not found for this user' });
      }

      const newLabel = label && String(label).trim() ? String(label).trim() : target.label;
      target.label = newLabel;

      const newDeviceIdStr = JSON.stringify(devices);
      await pool.execute('UPDATE users SET device_id = ? WHERE id = ?', [newDeviceIdStr, user_id]);

      await logAudit(
        req.user.id,
        req.user.username,
        'UPDATE_DEVICE_LABEL',
        `Updated device label to "${newLabel}" for vessel account "${userRows[0].username}"`
      );

      res.json({ success: true, message: 'Device label updated successfully', device_id: newDeviceIdStr });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Remove device (individual or all)
  app.post('/api/admin/remove-device', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { user_id, device_id: deviceIdToRemove } = req.body;
    try {
      const [userRows]: any = await pool.execute('SELECT id, username, device_id FROM users WHERE id = ?', [user_id]);
      if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

      const username = userRows[0].username;

      if (deviceIdToRemove) {
        // Remove specific device from list
        let devices = parseServerDeviceList(userRows[0].device_id);
        const removedDevice = devices.find(d => d.id === deviceIdToRemove);
        const removedLabel = removedDevice ? removedDevice.label : 'Device';
        devices = devices.filter(d => d.id !== deviceIdToRemove);

        const newDeviceIdStr = devices.length > 0 ? JSON.stringify(devices) : null;
        const isVerified = devices.length > 0 ? 1 : 0;
        await pool.execute('UPDATE users SET device_id = ?, is_verified = ? WHERE id = ?', [newDeviceIdStr, isVerified, user_id]);
        
        await logAudit(
          req.user.id,
          req.user.username,
          'REMOVE_DEVICE',
          `Removed device "${removedLabel}" (${deviceIdToRemove.slice(0, 16)}...) from vessel account "${username}"`
        );

        return res.json({ 
          success: true, 
          message: `Device "${removedLabel}" removed successfully`, 
          device_id: newDeviceIdStr, 
          is_verified: !!isVerified 
        });
      }

      // Default: Remove all devices for this user
      await pool.execute('UPDATE users SET device_id = NULL, is_verified = FALSE WHERE id = ?', [user_id]);
      
      await logAudit(
        req.user.id,
        req.user.username,
        'REMOVE_ALL_DEVICES',
        `Removed all registered devices for vessel account "${username}"`
      );

      res.json({ success: true, message: 'All device registrations removed' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/verify-device', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { request_id, status, label } = req.body; // status: 'approved' | 'rejected', label?: string
    try {
      if (status === 'approved') {
        const [requests]: any = await pool.execute(
          'SELECT * FROM device_registration_requests WHERE id = ?',
          [request_id]
        );
        const request = requests[0];
        if (request) {
          const [userRows]: any = await pool.execute(
            'SELECT id, username, device_id, is_verified, role FROM users WHERE id = ?',
            [request.user_id]
          );
          if (userRows.length > 0) {
            const user = userRows[0];
            const registeredDevices = parseServerDeviceList(user.device_id);

            const assignedLabel = (label && String(label).trim()) || 
                                 (request.label && String(request.label).trim()) || 
                                 `Device ${registeredDevices.length + 1}`;

            const requestFp = extractDeviceFingerprint(request.device_id);
            let updated = false;

            if (requestFp) {
              const matchIndex = registeredDevices.findIndex(d => extractDeviceFingerprint(d.id) === requestFp);
              if (matchIndex !== -1) {
                registeredDevices[matchIndex] = {
                  id: request.device_id,
                  label: assignedLabel,
                  created_at: new Date().toISOString()
                };
                updated = true;
              }
            }

            if (!updated) {
              const exactIndex = registeredDevices.findIndex(d => d.id === request.device_id);
              if (exactIndex !== -1) {
                registeredDevices[exactIndex].label = assignedLabel;
                updated = true;
              }
            }

            if (!updated) {
              if (user.role === 'vessel' && registeredDevices.length >= 2) {
                return res.status(400).json({ error: 'Maximum registered devices (2) limit reached for this vessel account. Please remove an existing device first.' });
              }
              registeredDevices.push({
                id: request.device_id,
                label: assignedLabel,
                created_at: new Date().toISOString()
              });
            }

            const newDeviceIdStr = JSON.stringify(registeredDevices);
            await pool.execute(
              'UPDATE users SET device_id = ?, is_verified = TRUE WHERE id = ?',
              [newDeviceIdStr, request.user_id]
            );

            await logAudit(
              req.user.id,
              req.user.username,
              'APPROVE_DEVICE',
              `Approved device "${assignedLabel}" for vessel account "${user.username}"`
            );
          }
        }
      } else if (status === 'rejected') {
        const [requests]: any = await pool.execute('SELECT dr.*, u.username FROM device_registration_requests dr JOIN users u ON dr.user_id = u.id WHERE dr.id = ?', [request_id]);
        if (requests.length > 0) {
          await logAudit(
            req.user.id,
            req.user.username,
            'REJECT_DEVICE',
            `Rejected device registration request for vessel account "${requests[0].username}"`
          );
        }
      }

      await pool.execute(
        'UPDATE device_registration_requests SET status = ? WHERE id = ?',
        [status, request_id]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Settings Routes (Admin)
  app.get('/api/admin/settings', authenticate, isAdmin, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
      const settings = (rows as any[]).reduce((acc, row) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
      }, {});
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/settings', authenticate, isAdmin, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const settings = req.body;
    try {
      for (const [key, value] of Object.entries(settings)) {
        await (pool as any).query(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [key, value, value]
        );
      }
      await startAlertScheduler();
      await logAudit((req as any).user.id, (req as any).user.username, 'UPDATE_SETTINGS', `Updated system settings`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin Logo Management
  app.post('/api/admin/logo', authenticate, isAdmin, upload.single('logo'), async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      let logoValue = '';
      if (req.file) {
        const mime = req.file.mimetype || 'image/png';
        const base64 = req.file.buffer.toString('base64');
        logoValue = `data:${mime};base64,${base64}`;
      } else if (req.body?.logo) {
        logoValue = String(req.body.logo).trim();
      }

      if (!logoValue) {
        return res.status(400).json({ error: 'No logo file or image URL provided' });
      }

      await (pool as any).query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        ['APP_LOGO', logoValue, logoValue]
      );

      await logAudit((req as any).user.id, (req as any).user.username, 'UPDATE_LOGO', `Updated system branding logo`);
      
      try {
        globalRealtimeEngine?.notifyChange?.({ domain: 'settings', action: 'update', table: 'settings' });
      } catch (e) {}

      res.json({ success: true, logo: logoValue });
    } catch (e: any) {
      console.error('Error saving system logo:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/admin/logo', authenticate, isAdmin, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      await (pool as any).query(
        'DELETE FROM settings WHERE setting_key = "APP_LOGO"'
      );

      await logAudit((req as any).user.id, (req as any).user.username, 'RESET_LOGO', `Reset system logo to default COMOS logo`);
      
      try {
        globalRealtimeEngine?.notifyChange?.({ domain: 'settings', action: 'update', table: 'settings' });
      } catch (e) {}

      res.json({ success: true });
    } catch (e: any) {
      console.error('Error resetting system logo:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/test-smtp', authenticate, isAdmin, async (req, res) => {
    let { resend_api_key, from } = req.body;
    console.log(`Testing Resend API Key...`);
    
    // Fallback to process.env if not provided in request body
    if (!resend_api_key) {
      resend_api_key = process.env.RESEND_API_KEY;
    }

    if (!resend_api_key || resend_api_key.trim() === '') {
      return res.status(400).json({ error: 'Resend API Key is required. Please enter it in Settings or set RESEND_API_KEY in the Secrets menu.' });
    }

    try {
      const resend = new Resend(resend_api_key);
      const currentUser = (req as any).user;
      const fromEmail = from || 'onboarding@resend.dev';
      const toEmail = currentUser.email || (currentUser.username.includes('@') ? currentUser.username : 'IT@cleanocean.com.ph');
      
      if (!toEmail || !toEmail.includes('@')) {
        throw new Error(`Invalid recipient email address: "${toEmail}". Please ensure your user profile has a valid email address.`);
      }

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: 'Resend API Connection Test',
        html: '<strong>If you are reading this, your Resend API settings are working correctly!</strong>'
      });

      if (error) {
        throw error;
      }
      
      console.log('Test email sent successfully via Resend to:', toEmail);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Resend Test Failed Detailed Error:', e);
      res.status(500).json({ 
        error: e.message || 'Unknown Resend error'
      });
    }
  });

  app.post('/api/admin/test-b2', authenticate, isAdmin, async (req, res) => {
    const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT } = req.body;
    
    if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME || !B2_ENDPOINT) {
      return res.status(400).json({ error: 'All B2 fields are required for testing.' });
    }

    try {
      const client = new S3Client({
        endpoint: B2_ENDPOINT.startsWith('http') ? B2_ENDPOINT : `https://${B2_ENDPOINT}`,
        credentials: {
          accessKeyId: B2_APPLICATION_KEY_ID,
          secretAccessKey: B2_APPLICATION_KEY,
        },
        region: B2_ENDPOINT.split('.')[1] || 'us-east-005',
      });

      // We'll test with a simple put & delete of a tiny test file to verify full write/delete permissions
      const testKey = `test_connection_${Date.now()}.txt`;
      await client.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: testKey,
          Body: Buffer.from('B2 Connection Test'),
          ContentType: 'text/plain',
        })
      );

      // Clean up the test file
      await client.send(
        new DeleteObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: testKey,
        })
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error('B2 Connection Test Failed:', err);
      res.status(500).json({ error: err.message || 'Failed to connect or perform write/delete operations on Backblaze B2.' });
    }
  });

  app.get('/api/admin/storage-status', authenticate, isAdmin, async (req, res) => {
    try {
      const categories: Array<{
        id: string;
        label: string;
        fileCount: number;
        totalBytes: number;
        formattedSize: string;
        b2Count: number;
      }> = [];

      let grandTotalBytes = 0;
      let grandTotalFiles = 0;
      let grandTotalB2Files = 0;

      const parseSizeBytes = (sizeStr: any, blobLen: number = 0): number => {
        if (typeof sizeStr === 'number' && sizeStr > 0) return sizeStr;
        if (sizeStr && typeof sizeStr === 'string') {
          const cleaned = sizeStr.trim();
          const match = cleaned.match(/^([\d\.]+)\s*(bytes|b|kb|mb|gb|tb)?$/i);
          if (match) {
            const num = parseFloat(match[1]);
            const unit = (match[2] || 'bytes').toLowerCase();
            if (!isNaN(num)) {
              if (unit === 'kb') return Math.round(num * 1024);
              if (unit === 'mb') return Math.round(num * 1024 * 1024);
              if (unit === 'gb') return Math.round(num * 1024 * 1024 * 1024);
              if (unit === 'tb') return Math.round(num * 1024 * 1024 * 1024 * 1024);
              return Math.round(num);
            }
          }
        }
        return blobLen > 0 ? blobLen : 0;
      };

      const isB2Blob = (data: any): boolean => {
        if (!data) return false;
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        return buf.length > 7 && buf.toString('utf8', 0, 7) === 'B2_KEY:';
      };

      const formatBytes = (bytes: number, decimals = 1) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
      };

      // 1. SMS Uploads
      let smsRows: any[] = [];
      try {
        const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM sms_uploads WHERE deleted_at IS NULL');
        smsRows = rows;
      } catch (e) {}
      let smsBytes = 0;
      let smsB2Count = 0;
      smsRows.forEach((r: any) => {
        smsBytes += parseSizeBytes(r.file_size, r.blob_len);
        if (isB2Blob(r.file_data)) smsB2Count++;
      });
      categories.push({
        id: 'sms_uploads',
        label: 'SMS Package Uploads',
        fileCount: smsRows.length,
        totalBytes: smsBytes,
        formattedSize: formatBytes(smsBytes),
        b2Count: smsB2Count
      });

      // 2. Vessel Certificates & Files
      let certRows: any[] = [];
      try {
        const [rows]: any = await pool.query('SELECT OCTET_LENGTH(file_data) as blob_len, file_data FROM files');
        certRows = rows;
      } catch (e) {}
      let certBytes = 0;
      let certB2Count = 0;
      certRows.forEach((r: any) => {
        certBytes += r.blob_len || 0;
        if (isB2Blob(r.file_data)) certB2Count++;
      });
      categories.push({
        id: 'certificates',
        label: 'Certificates & Documents',
        fileCount: certRows.length,
        totalBytes: certBytes,
        formattedSize: formatBytes(certBytes),
        b2Count: certB2Count
      });

      // 3. Voyage Reports Attachments (Departure, Arrival, Noon)
      let depRows: any[] = [];
      let arrRows: any[] = [];
      let noonRows: any[] = [];
      try { const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM departure_attachments'); depRows = rows; } catch (e) {}
      try { const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM arrival_attachments'); arrRows = rows; } catch (e) {}
      try { const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM noon_attachments'); noonRows = rows; } catch (e) {}
      
      let voyageBytes = 0;
      let voyageB2Count = 0;
      const allVoyage = [...depRows, ...arrRows, ...noonRows];
      allVoyage.forEach((r: any) => {
        voyageBytes += parseSizeBytes(r.file_size, r.blob_len);
        if (isB2Blob(r.file_data)) voyageB2Count++;
      });
      categories.push({
        id: 'voyage_reports',
        label: 'Voyage Report Attachments',
        fileCount: allVoyage.length,
        totalBytes: voyageBytes,
        formattedSize: formatBytes(voyageBytes),
        b2Count: voyageB2Count
      });

      // 4. Fuel & Lube Oil Analysis Files
      let fuelRows: any[] = [];
      let ldrRows: any[] = [];
      let loaRows: any[] = [];
      let bdnRows: any[] = [];
      try { const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM fuel_analysis_files'); fuelRows = rows; } catch (e) {}
      try { const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM lube_oil_ldr_files'); ldrRows = rows; } catch (e) {}
      try { const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM lube_oil_analysis_files'); loaRows = rows; } catch (e) {}
      try { const [rows]: any = await pool.query('SELECT file_size, OCTET_LENGTH(file_data) as blob_len, file_data FROM bunker_bdn_files'); bdnRows = rows; } catch (e) {}
      
      let fuelBytes = 0;
      let fuelB2Count = 0;
      const allFuel = [...fuelRows, ...ldrRows, ...loaRows, ...bdnRows];
      allFuel.forEach((r: any) => {
        fuelBytes += parseSizeBytes(r.file_size, r.blob_len);
        if (isB2Blob(r.file_data)) fuelB2Count++;
      });
      categories.push({
        id: 'fuel_lube_reports',
        label: 'Fuel & Lube Oil Analysis Files',
        fileCount: allFuel.length,
        totalBytes: fuelBytes,
        formattedSize: formatBytes(fuelBytes),
        b2Count: fuelB2Count
      });

      // 5. Requisitions Attachments
      let reqRows: any[] = [];
      try { const [rows]: any = await pool.query('SELECT size, OCTET_LENGTH(data) as blob_len, data FROM requisition_attachments'); reqRows = rows; } catch (e) {}
      let reqBytes = 0;
      let reqB2Count = 0;
      reqRows.forEach((r: any) => {
        reqBytes += parseSizeBytes(r.size, r.blob_len);
        if (isB2Blob(r.data)) reqB2Count++;
      });
      categories.push({
        id: 'requisitions',
        label: 'Spare Parts Requisition Attachments',
        fileCount: reqRows.length,
        totalBytes: reqBytes,
        formattedSize: formatBytes(reqBytes),
        b2Count: reqB2Count
      });

      // Grand totals
      categories.forEach(c => {
        grandTotalBytes += c.totalBytes;
        grandTotalFiles += c.fileCount;
        grandTotalB2Files += c.b2Count;
      });

      const b2Configured = await isB2Configured();
      const b2Settings = await getB2Settings();

      res.json({
        success: true,
        totalBytes: grandTotalBytes,
        totalFiles: grandTotalFiles,
        formattedTotal: formatBytes(grandTotalBytes),
        b2Configured,
        b2Bucket: b2Configured ? b2Settings.B2_BUCKET_NAME : null,
        b2StoredFilesCount: grandTotalB2Files,
        categories
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Team Routes
  app.get('/api/teams', authenticate, async (req, res) => {
    const [teams] = await pool.query('SELECT * FROM teams WHERE deleted_at IS NULL');
    res.json(teams);
  });

  // Flag Routes
  app.get('/api/flags', authenticate, async (req, res) => {
    try {
      const [flags] = await pool.query('SELECT * FROM flags WHERE deleted_at IS NULL ORDER BY name ASC');
      res.json(flags);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/flags', authenticate, isAdmin, async (req: any, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Flag name is required' });
    }
    try {
      const [existing]: any = await pool.execute('SELECT id, deleted_at FROM flags WHERE name = ?', [name.trim()]);
      if (existing.length > 0) {
        if (existing[0].deleted_at) {
          // Restore if previously deleted
          await pool.execute('UPDATE flags SET deleted_at = NULL WHERE id = ?', [existing[0].id]);
          await logAudit(req.user.id, req.user.username, 'RESTORE_FLAG', `Restored flag: ${name.trim()}`);
          return res.json({ id: existing[0].id, name: name.trim() });
        }
        return res.status(400).json({ error: 'A flag with this name already exists' });
      }

      const [result]: any = await pool.execute('INSERT INTO flags (name) VALUES (?)', [name.trim()]);
      await logAudit(req.user.id, req.user.username, 'CREATE_FLAG', `Created flag: ${name.trim()}`);
      res.json({ id: result.insertId, name: name.trim() });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: 'A flag with this name already exists' });
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.put('/api/flags/:id', authenticate, isAdmin, async (req: any, res) => {
    const { name } = req.body;
    const { id } = req.params;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Flag name is required' });
    }
    try {
      await pool.execute('UPDATE flags SET name = ? WHERE id = ?', [name.trim(), id]);
      await logAudit(req.user.id, req.user.username, 'UPDATE_FLAG', `Updated flag ID ${id} to: ${name}`);
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: 'A flag with this name already exists' });
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.delete('/api/flags/:id', authenticate, isAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      await pool.execute('UPDATE flags SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      await logAudit(req.user.id, req.user.username, 'DELETE_FLAG', `Soft-deleted flag ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // User Routes (Admin)
  app.get('/api/users', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
      const [users]: any = await pool.query('SELECT id, username, role, vessel_id, email, device_id, is_verified, plain_password FROM users WHERE deleted_at IS NULL');
      const usersWithTeams = await Promise.all(users.map(async (u: any) => {
        const [teams]: any = await pool.execute('SELECT team_id FROM user_teams WHERE user_id = ?', [u.id]);
        return { ...u, team_ids: teams.map((t: any) => t.team_id) };
      }));
      
      // If team_pic, filter users? Actually, let's allow them to see all for now as the prompt says "admin and TEAM PIC", 
      // but if we want to be strict, we'd filter by team.
      // For now, satisfy the requirement of "remote registered devices".
      res.json(usersWithTeams);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/users/change-password', authenticate, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
      const [rows]: any = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
      if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.execute('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', [hashedPassword, newPassword, req.user.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/users', authenticate, isTeamPicOrAdmin, async (req, res) => {
    let { username, password, role, team_ids, vessel_id, email, notify } = req.body;

    // Automatically set vessel email if role is vessel or vessel_id is provided
    if ((role === 'vessel' || vessel_id) && vessel_id) {
      try {
        const [vessels]: any = await pool.execute('SELECT email FROM vessels WHERE id = ?', [vessel_id]);
        if (vessels.length > 0 && vessels[0].email) {
          if (!email || role === 'vessel') {
            email = vessels[0].email;
          }
        }
      } catch (err) {
        console.error('Error auto-setting vessel user email:', err);
      }
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result]: any = await conn.execute(
        'INSERT INTO users (username, password, plain_password, role, vessel_id, email) VALUES (?, ?, ?, ?, ?, ?)', 
        [username, hashedPassword, password, role || 'user', vessel_id || null, email || null]
      );
      const userId = result.insertId;
      
      if (team_ids && Array.isArray(team_ids)) {
        for (const teamId of team_ids) {
          await conn.execute('INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)', [userId, teamId]);
        }
      }
      
      await conn.commit();
      await logAudit((req as any).user.id, (req as any).user.username, 'CREATE_USER', `Created user: ${username} with role ${role}`);
      
      console.log(`Debug: Creating user. Notify: ${notify}, Email: ${email}`);
      if (notify && email) {
        try {
          console.log(`Debug: Attempting to send email to ${email}`);
          await sendEmail({
            to: email,
            subject: 'Welcome to COMOS - Account Credentials',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #2563eb;">Welcome to COMOS</h2>
                <p>Hello,</p>
                <p>An account has been created for you on the COMOS platform.</p>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0;"><strong>Username:</strong> ${username}</p>
                  <p style="margin: 0;"><strong>Initial Password:</strong> ${password}</p>
                </div>
                <p>You can access COMOS via <a href="https://comos.cc" style="color: #2563eb; text-decoration: none; font-weight: bold;">https://comos.cc</a></p>
                <p>Please log in and change your password if needed.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 12px; color: #64748b;">Automated notification from COMOS System.</p>
              </div>
            `
          });
          console.log(`Debug: Email sent successfully to ${email}`);
        } catch (err: any) {
          console.error('Failed to send welcome email notification:', err);
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  });

  app.put('/api/users/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    let { username, team_ids, role, password, vessel_id, email, device_id, is_verified } = req.body;

    // Automatically set vessel email if role is vessel or vessel_id is provided
    if ((role === 'vessel' || vessel_id) && vessel_id) {
      try {
        const [vessels]: any = await pool.execute('SELECT email FROM vessels WHERE id = ?', [vessel_id]);
        if (vessels.length > 0 && vessels[0].email) {
          if (!email || role === 'vessel') {
            email = vessels[0].email;
          }
        }
      } catch (err) {
        console.error('Error auto-setting vessel user email on update:', err);
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        await conn.execute(
          'UPDATE users SET username = ?, role = ?, password = ?, plain_password = ?, vessel_id = ?, email = ?, device_id = ?, is_verified = ? WHERE id = ?', 
          [username, role, hashedPassword, password, vessel_id || null, email || null, device_id || null, is_verified ? 1 : 0, req.params.id]
        );
      } else {
        await conn.execute(
          'UPDATE users SET username = ?, role = ?, vessel_id = ?, email = ?, device_id = ?, is_verified = ? WHERE id = ?', 
          [username, role, vessel_id || null, email || null, device_id || null, is_verified ? 1 : 0, req.params.id]
        );
      }
      
      // Update teams
      await conn.execute('DELETE FROM user_teams WHERE user_id = ?', [req.params.id]);
      if (team_ids && Array.isArray(team_ids)) {
        for (const teamId of team_ids) {
          await conn.execute('INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)', [req.params.id, teamId]);
        }
      }
      
      await conn.commit();
      await logAudit((req as any).user.id, (req as any).user.username, 'UPDATE_USER', `Updated user ID ${req.params.id}: ${username}`);
      res.json({ success: true });
    } catch (e: any) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  });

  // Vessel Routes
  app.get('/api/vessels', authenticate, async (req: any, res) => {
    let vessels;
    if (req.user.role === 'admin') {
      [vessels] = await pool.query("SELECT v.id, v.name, v.team_id, v.owner, COALESCE(v.fleet_status, 'In Active Fleet') as fleet_status, v.email, v.next_port, v.route_status, v.shackles, v.loading_status, v.eta_atb, v.etb, v.etd_atd, v.cargo, v.operation_type, v.remark_from_vessel, v.flag, v.date_built, v.min_fuel_consumption, v.max_fuel_consumption, v.charterer_min_hsfo, v.charterer_max_hsfo, v.charterer_min_lsfo, v.charterer_max_lsfo, v.charterer_min_mgo, v.charterer_max_mgo, v.charterer_min_mdo, v.charterer_max_mdo, v.type, t.name as team_name, (v.photo_data IS NOT NULL) as has_photo FROM vessels v LEFT JOIN teams t ON v.team_id = t.id WHERE v.deleted_at IS NULL");
    } else if (req.user.role === 'vessel') {
      const vesselId = req.user.vessel_id;
      if (!vesselId) {
        return res.json([]);
      }
      [vessels] = await pool.execute("SELECT v.id, v.name, v.team_id, v.owner, COALESCE(v.fleet_status, 'In Active Fleet') as fleet_status, v.email, v.next_port, v.route_status, v.shackles, v.loading_status, v.eta_atb, v.etb, v.etd_atd, v.cargo, v.operation_type, v.remark_from_vessel, v.flag, v.date_built, v.min_fuel_consumption, v.max_fuel_consumption, v.charterer_min_hsfo, v.charterer_max_hsfo, v.charterer_min_lsfo, v.charterer_max_lsfo, v.charterer_min_mgo, v.charterer_max_mgo, v.charterer_min_mdo, v.charterer_max_mdo, v.type, t.name as team_name, (v.photo_data IS NOT NULL) as has_photo FROM vessels v LEFT JOIN teams t ON v.team_id = t.id WHERE v.id = ? AND v.deleted_at IS NULL", [vesselId]);
    } else {
      const teamIds = req.user.team_ids || [];
      if (teamIds.length === 0) {
        return res.json([]);
      }
      const placeholders = teamIds.map(() => '?').join(',');
      const params = [...teamIds];
      [vessels] = await pool.execute(`SELECT v.id, v.name, v.team_id, v.owner, COALESCE(v.fleet_status, 'In Active Fleet') as fleet_status, v.email, v.next_port, v.route_status, v.shackles, v.loading_status, v.eta_atb, v.etb, v.etd_atd, v.cargo, v.operation_type, v.remark_from_vessel, v.flag, v.date_built, v.min_fuel_consumption, v.max_fuel_consumption, v.charterer_min_hsfo, v.charterer_max_hsfo, v.charterer_min_lsfo, v.charterer_max_lsfo, v.charterer_min_mgo, v.charterer_max_mgo, v.charterer_min_mdo, v.charterer_max_mdo, v.type, t.name as team_name, (v.photo_data IS NOT NULL) as has_photo FROM vessels v LEFT JOIN teams t ON v.team_id = t.id WHERE v.team_id IN (${placeholders}) AND v.deleted_at IS NULL`, params);
    }
    res.json(vessels);
  });

  app.get('/api/vessels/:id/photo', authenticate, async (req, res) => {
    try {
      const [rows]: any = await pool.execute('SELECT photo_data, photo_mimetype FROM vessels WHERE id = ?', [req.params.id]);
      if (rows.length === 0 || !rows[0].photo_data) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      const retrievedData = await handleFileRetrieve(rows[0].photo_data);
      res.setHeader('Content-Type', rows[0].photo_mimetype || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(retrievedData);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/vessels', authenticate, isTeamPicOrAdmin, upload.single('photo'), async (req: any, res) => {
    const { name, team_id, owner, flag, date_built, min_fuel_consumption, max_fuel_consumption, type, fleet_status, email } = req.body;
    try {
      // If team_pic or user, they can only add to their own teams
      if ((req.user.role === 'team_pic' || req.user.role === 'user') && team_id && !req.user.team_ids.includes(Number(team_id))) {
        return res.status(403).json({ error: 'You can only add vessels to your assigned teams' });
      }
      
      const photoData = req.file ? await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'vessel_photos') : null;
      const photoMimetype = req.file ? req.file.mimetype : null;

      await pool.execute(
        'INSERT INTO vessels (name, team_id, owner, fleet_status, flag, date_built, min_fuel_consumption, max_fuel_consumption, type, email, photo_data, photo_mimetype) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [name, team_id || null, owner || 'Nissen', fleet_status || 'In Active Fleet', flag || null, date_built || null, min_fuel_consumption || null, max_fuel_consumption || null, type || 'Bulk Carrier', email || null, photoData, photoMimetype]
      );
      await logAudit(req.user.id, req.user.username, 'CREATE_VESSEL', `Created vessel: ${name}`);
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: 'A vessel with this name already exists' });
      } else {
        res.status(400).json({ error: e.message });
      }
    }
  });

  app.put('/api/vessels/:id', authenticate, isTeamPicOrAdmin, upload.single('photo'), async (req: any, res) => {
    const { name, team_id, owner, flag, date_built, min_fuel_consumption, max_fuel_consumption, type, fleet_status, email } = req.body;
    try {
      const [vessels]: any = await pool.execute('SELECT team_id FROM vessels WHERE id = ?', [req.params.id]);
      if (vessels.length === 0) return res.status(404).json({ error: 'Vessel not found' });
      
      if (req.user.role === 'team_pic' || req.user.role === 'user') {
        const oldTeamId = vessels[0].team_id;
        if (!req.user.team_ids.includes(oldTeamId)) return res.status(403).json({ error: 'Forbidden' });
        if (team_id && !req.user.team_ids.includes(Number(team_id))) return res.status(403).json({ error: 'Forbidden' });
      }

      const photoData = req.file ? await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'vessel_photos') : undefined;
      const photoMimetype = req.file ? req.file.mimetype : undefined;

      if (photoData !== undefined) {
        await pool.execute(
          'UPDATE vessels SET name = ?, team_id = ?, owner = ?, fleet_status = ?, flag = ?, date_built = ?, min_fuel_consumption = ?, max_fuel_consumption = ?, type = ?, email = ?, photo_data = ?, photo_mimetype = ? WHERE id = ?', 
          [name, team_id || null, owner, fleet_status || 'In Active Fleet', flag || null, date_built || null, min_fuel_consumption || null, max_fuel_consumption || null, type || 'Bulk Carrier', email || null, photoData, photoMimetype, req.params.id]
        );
      } else {
        await pool.execute(
          'UPDATE vessels SET name = ?, team_id = ?, owner = ?, fleet_status = ?, flag = ?, date_built = ?, min_fuel_consumption = ?, max_fuel_consumption = ?, type = ?, email = ? WHERE id = ?', 
          [name, team_id || null, owner, fleet_status || 'In Active Fleet', flag || null, date_built || null, min_fuel_consumption || null, max_fuel_consumption || null, type || 'Bulk Carrier', email || null, req.params.id]
        );
      }
      
      await logAudit(req.user.id, req.user.username, 'UPDATE_VESSEL', `Updated vessel ID ${req.params.id}: ${name}`);
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: 'A vessel with this name already exists' });
      } else {
        res.status(400).json({ error: e.message });
      }
    }
  });

  app.put('/api/vessels/:id/charterer-thresholds', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    const {
      charterer_min_hsfo, charterer_max_hsfo,
      charterer_min_lsfo, charterer_max_lsfo,
      charterer_min_mgo, charterer_max_mgo,
      charterer_min_mdo, charterer_max_mdo
    } = req.body;
    try {
      const [vessels]: any = await pool.execute('SELECT id FROM vessels WHERE id = ?', [req.params.id]);
      if (vessels.length === 0) return res.status(404).json({ error: 'Vessel not found' });

      await pool.execute(`
        UPDATE vessels SET
          charterer_min_hsfo = ?, charterer_max_hsfo = ?,
          charterer_min_lsfo = ?, charterer_max_lsfo = ?,
          charterer_min_mgo = ?, charterer_max_mgo = ?,
          charterer_min_mdo = ?, charterer_max_mdo = ?
        WHERE id = ?
      `, [
        charterer_min_hsfo || null, charterer_max_hsfo || null,
        charterer_min_lsfo || null, charterer_max_lsfo || null,
        charterer_min_mgo || null, charterer_max_mgo || null,
        charterer_min_mdo || null, charterer_max_mdo || null,
        req.params.id
      ]);

      await logAudit(req.user.id, req.user.username, 'UPDATE_VESSEL_THRESHOLDS', `Updated vessel ID ${req.params.id} charterer thresholds`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/vessels/:id/threshold-chat', authenticate, async (req: any, res) => {
    try {
      const [messages]: any = await pool.execute(
        'SELECT id, vessel_id, author_name, author_id, message_text, created_at FROM threshold_chat_messages WHERE vessel_id = ? ORDER BY created_at ASC',
        [req.params.id]
      );
      res.json(messages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/vessels/:id/threshold-chat', authenticate, async (req: any, res) => {
    const { message_text } = req.body;
    if (!message_text || !message_text.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    try {
      const [vessels]: any = await pool.execute('SELECT id FROM vessels WHERE id = ?', [req.params.id]);
      if (vessels.length === 0) return res.status(404).json({ error: 'Vessel not found' });

      await pool.execute(
        'INSERT INTO threshold_chat_messages (vessel_id, author_name, author_id, message_text) VALUES (?, ?, ?, ?)',
        [req.params.id, req.user.username, String(req.user.id), message_text.trim()]
      );

      await logAudit(req.user.id, req.user.username, 'ADD_THRESHOLD_CHAT_MESSAGE', `Added chat message to vessel ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/vessels/:id/route', authenticate, async (req: any, res) => {
    const { next_port, route_status, eta_atb, etb, etd_atd, cargo, operation_type, remark_from_vessel, shackles, loading_status } = req.body;
    try {
      const [vessels]: any = await pool.execute('SELECT id, team_id FROM vessels WHERE id = ?', [req.params.id]);
      if (vessels.length === 0) return res.status(404).json({ error: 'Vessel not found' });
      const vessel = vessels[0];

      // Authorization check
      let hasAccess = false;
      if (req.user.role === 'admin') {
        hasAccess = true;
      } else if (req.user.role === 'vessel') {
        hasAccess = req.user.vessel_id === vessel.id;
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        hasAccess = req.user.team_ids.includes(vessel.team_id);
      }

      if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

      await pool.execute(
        'UPDATE vessels SET next_port = ?, route_status = ?, eta_atb = ?, etb = ?, etd_atd = ?, cargo = ?, operation_type = ?, remark_from_vessel = ?, shackles = ?, loading_status = ? WHERE id = ?',
        [next_port || null, route_status || null, eta_atb || null, etb || null, etd_atd || null, cargo || null, operation_type || null, remark_from_vessel || null, shackles || null, loading_status || null, req.params.id]
      );

      await logAudit(req.user.id, req.user.username, 'UPDATE_VESSEL_ROUTE', `Updated route for vessel ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/vessels/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      const [vesselRows]: any = await pool.execute('SELECT name FROM vessels WHERE id = ?', [req.params.id]);
      const vesselName = vesselRows.length > 0 ? vesselRows[0].name : 'Unknown';

      // Soft delete cascade for certificates, notes, and files
      const [certs]: any = await pool.execute('SELECT id FROM certificates WHERE vessel_id = ? AND deleted_at IS NULL', [req.params.id]);
      for (const cert of certs) {
        await pool.execute('UPDATE notes SET deleted_at = CURRENT_TIMESTAMP WHERE certificate_id = ? AND deleted_at IS NULL', [cert.id]);
        await pool.execute('UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE certificate_id = ? AND deleted_at IS NULL', [cert.id]);
      }
      await pool.execute('UPDATE certificates SET deleted_at = CURRENT_TIMESTAMP WHERE vessel_id = ? AND deleted_at IS NULL', [req.params.id]);
      await pool.execute('UPDATE vessels SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_VESSEL', `Soft deleted vessel: ${vesselName} (ID: ${req.params.id})`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Soft delete vessel error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // SMS Routes
  app.get('/api/sms/uploads', authenticate, async (req, res) => {
    try {
      const [rows]: any = await pool.query(
        'SELECT id, vessel_id as vesselId, vessel_name as vesselName, month, year, file_name as fileName, file_size as fileSize, category, uploaded_at as uploadedAt, is_acknowledged as isAcknowledged, ack_file_name as ackFileName, ack_file_size as ackFileSize, ack_uploaded_at as ackUploadedAt, ack_uploaded_by as ackUploadedBy FROM sms_uploads WHERE deleted_at IS NULL ORDER BY uploaded_at DESC'
      );
      const mapped = rows.map((r: any) => ({
        ...r,
        isAcknowledged: Boolean(r.isAcknowledged)
      }));
      res.json(mapped);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/upload-acknowledgement/:id', authenticate, upload.single('file'), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { id } = req.params;
    try {
      const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'sms_acknowledgements');
      const fileSizeStr = req.file.size > 1024 * 1024 
        ? `${(req.file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(req.file.size / 1024).toFixed(0)} KB`;

      await pool.execute(
        `UPDATE sms_uploads SET is_acknowledged = 1, ack_file_name = ?, ack_file_data = ?, ack_file_mimetype = ?, ack_file_size = ?, ack_uploaded_at = CURRENT_TIMESTAMP, ack_uploaded_by = ? WHERE id = ?`,
        [req.file.originalname, uploadData, req.file.mimetype, fileSizeStr, req.user?.username || 'Office User', id]
      );

      if (req.user) {
        await logAudit(req.user.id, req.user.username, 'UPLOAD_SMS_ACKNOWLEDGEMENT', `Uploaded SMS acknowledgement file: ${req.file.originalname} for upload ID ${id}`);
      }

      res.json({
        success: true,
        ackFileName: req.file.originalname,
        ackFileSize: fileSizeStr
      });
    } catch (err: any) {
      console.error('Error uploading SMS acknowledgement:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sms/download-acknowledgement/:id', authenticate, async (req, res) => {
    try {
      const [rows]: any = await pool.execute('SELECT ack_file_name, ack_file_mimetype, ack_file_data FROM sms_uploads WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
      if (rows.length === 0 || !rows[0].ack_file_data) {
        return res.status(404).json({ error: 'Acknowledged file not found' });
      }
      const row = rows[0];
      const retrievedBuffer = await handleFileRetrieve(row.ack_file_data);
      res.setHeader('Content-Type', row.ack_file_mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.ack_file_name || 'Acknowledged_Report.pdf')}"`);
      res.send(retrievedBuffer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/upload', authenticate, upload.single('file'), async (req: any, res) => {
    const { vessel_id, vessel_name, month, year, file_size, category } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
      const uploadedBuffer = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'sms_uploads');
      const [result]: any = await pool.execute(
        'INSERT INTO sms_uploads (vessel_id, vessel_name, month, year, file_name, file_size, file_data, file_mimetype, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [vessel_id, vessel_name, month, year, req.file.originalname, file_size, uploadedBuffer, req.file.mimetype, category || null]
      );
      res.json({
        success: true,
        upload: {
          id: result.insertId,
          vesselId: vessel_id,
          vesselName: vessel_name,
          month,
          year,
          fileName: req.file.originalname,
          category: category || null,
          uploadedAt: new Date().toISOString(),
          fileSize: file_size
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/download/:id', authenticate, async (req, res) => {
    try {
      const [rows]: any = await pool.execute('SELECT file_name, file_mimetype, file_data FROM sms_uploads WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'File not found' });
      const row = rows[0];
      const retrievedBuffer = await handleFileRetrieve(row.file_data);
      res.setHeader('Content-Type', row.file_mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.file_name)}"`);
      res.send(retrievedBuffer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/sms/upload/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE sms_uploads SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? OR file_name = ?', [req.params.id, req.params.id]);
      if (req.user) {
        await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_SMS_UPLOAD', `Soft deleted SMS upload ID/file ${req.params.id}`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // SMS Forms Routes
  app.get('/api/sms/forms', authenticate, async (req, res) => {
    try {
      const [rows]: any = await pool.query('SELECT * FROM sms_forms WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC');
      const processed = rows.map((r: any) => ({
        ...r,
        removeFilenameRestriction: Boolean(r.removeFilenameRestriction),
        isHira: Boolean(r.isHira),
        isAcknowledgementRequired: Boolean(r.isAcknowledgementRequired),
        allowedFileTypes: typeof r.allowedFileTypes === 'string' ? JSON.parse(r.allowedFileTypes) : r.allowedFileTypes,
        template_file_data: r.template_file_data ? (Buffer.isBuffer(r.template_file_data) ? r.template_file_data.toString('utf-8') : String(r.template_file_data)) : undefined,
        template_files: typeof r.template_files === 'string' ? (() => { try { return JSON.parse(r.template_files); } catch(e) { return []; } })() : (r.template_files || [])
      }));
      res.json(processed);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fast Server-side Bulk Template ZIP Download (All Sections or single category)
  app.get('/api/sms/templates/download-all-zip', authenticate, async (req: any, res) => {
    try {
      const categoryFilter = req.query.category ? String(req.query.category).trim() : null;
      
      let query = 'SELECT id, category, formCode, description, type, template_file_name, template_file_data, template_file_mimetype, template_files FROM sms_forms WHERE deleted_at IS NULL';
      const params: any[] = [];
      if (categoryFilter) {
        query += ' AND (category = ? OR TRIM(category) = ?)';
        params.push(categoryFilter, categoryFilter);
      }
      query += ' ORDER BY category ASC, sort_order ASC, formCode ASC, id ASC';

      const [forms]: any = await pool.query(query, params);

      if (!forms || forms.length === 0) {
        return res.status(404).json({ error: 'No forms found to package templates.' });
      }

      const zip = new JSZip();
      const fileEntries: { folder: string; filename: string; buffer: Buffer }[] = [];

      // Process forms in parallel batches of 25 for blazing fast assembly
      const BATCH_SIZE = 25;
      for (let i = 0; i < forms.length; i += BATCH_SIZE) {
        const batch = forms.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (form: any) => {
          try {
            const rawCat = form.category || '1. Monthly';
            const safeFolderName = categoryFilter ? '' : rawCat.replace(/[\/\\?%*:|"<>]/g, '_');
            const code = (form.formCode || 'SMS_FORM').trim();
            let formFilesAdded = 0;

            // 1. Multiple template files attached
            if (form.template_files) {
              let tFiles: any[] = [];
              try {
                tFiles = typeof form.template_files === 'string' ? JSON.parse(form.template_files) : form.template_files;
              } catch (e) {
                tFiles = [];
              }
              if (Array.isArray(tFiles) && tFiles.length > 0) {
                for (const tf of tFiles) {
                  if (tf && tf.data) {
                    try {
                      let str = String(tf.data);
                      let buf: Buffer;
                      if (str.startsWith('B2_KEY:')) {
                        buf = await handleFileRetrieve(Buffer.from(str));
                      } else if (str.startsWith('data:')) {
                        const base64Part = str.split(',')[1] || str;
                        buf = Buffer.from(base64Part, 'base64');
                      } else {
                        buf = Buffer.from(str, 'base64');
                      }
                      const rawName = tf.name ? tf.name : `${code}_Template.docx`;
                      fileEntries.push({ folder: safeFolderName, filename: rawName, buffer: buf });
                      formFilesAdded++;
                    } catch (err: any) {
                      console.warn(`Template file unpack error for ${code}:`, err.message);
                    }
                  }
                }
              }
            }

            // 2. Single template file
            if (formFilesAdded === 0 && form.template_file_data) {
              try {
                const rawDataForBuffer = form.template_file_data;
                let fileBuf: Buffer;
                if (Buffer.isBuffer(rawDataForBuffer) && rawDataForBuffer.length > 7 && rawDataForBuffer.toString('utf8', 0, 7) === 'B2_KEY:') {
                  fileBuf = await handleFileRetrieve(rawDataForBuffer);
                } else {
                  let str = Buffer.isBuffer(rawDataForBuffer) ? rawDataForBuffer.toString('utf-8') : String(rawDataForBuffer);
                  if (str.startsWith('B2_KEY:')) {
                    fileBuf = await handleFileRetrieve(Buffer.from(str));
                  } else if (str.startsWith('data:')) {
                    const base64Part = str.split(',')[1] || str;
                    fileBuf = Buffer.from(base64Part, 'base64');
                  } else {
                    fileBuf = Buffer.isBuffer(rawDataForBuffer) ? rawDataForBuffer : Buffer.from(rawDataForBuffer, 'base64');
                  }
                }
                const rawName = form.template_file_name ? form.template_file_name : `${code}_Template.docx`;
                fileEntries.push({ folder: safeFolderName, filename: rawName, buffer: fileBuf });
                formFilesAdded++;
              } catch (err: any) {
                console.warn(`Single template unpack error for ${code}:`, err.message);
              }
            }

            // 3. Clean standard specification text template fallback if no uploaded template
            if (formFilesAdded === 0) {
              const desc = (form.description || 'SMS Checklist / Form').trim();
              const cleanDesc = desc.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
              const content = `SAFETY MANAGEMENT SYSTEM (SMS) TEMPLATE\n` +
                `==================================================\n` +
                `Form Code: ${code}\n` +
                `Category: ${rawCat}\n` +
                `Type: ${form.type || 'Form'}\n` +
                `Description: ${desc}\n` +
                `Generated: ${new Date().toISOString()}\n\n` +
                `Instructions:\n` +
                `This is an approved standard form placeholder. When filing submissions for ${code},\n` +
                `ensure all vessel measurements, checks, and officer sign-offs are documented.\n`;
              fileEntries.push({
                folder: safeFolderName,
                filename: `${code}_${cleanDesc}_Standard_Template.txt`,
                buffer: Buffer.from(content, 'utf-8')
              });
              formFilesAdded++;
            }
          } catch (e: any) {
            console.error(`Error processing form ${form.formCode}:`, e.message);
          }
        }));
      }

      const usedNames = new Set<string>();
      for (const entry of fileEntries) {
        const targetFolder = entry.folder ? (zip.folder(entry.folder) || zip) : zip;
        let nameCandidate = entry.filename.replace(/[\/\\?%*:|"<>]/g, '_');
        const uniqueKey = (entry.folder ? entry.folder + '/' : '') + nameCandidate;
        if (usedNames.has(uniqueKey)) {
          const lastDot = nameCandidate.lastIndexOf('.');
          const base = lastDot !== -1 ? nameCandidate.substring(0, lastDot) : nameCandidate;
          const ext = lastDot !== -1 ? nameCandidate.substring(lastDot) : '';
          let counter = 1;
          while (usedNames.has((entry.folder ? entry.folder + '/' : '') + `${base}_${counter}${ext}`)) {
            counter++;
          }
          nameCandidate = `${base}_${counter}${ext}`;
        }
        usedNames.add((entry.folder ? entry.folder + '/' : '') + nameCandidate);
        targetFolder.file(nameCandidate, entry.buffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 4 }
      });

      const safeName = categoryFilter
        ? `SMS_Templates_${categoryFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : `SMS_All_Templates_Master_Catalog_${new Date().getFullYear()}`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
      res.send(zipBuffer);
    } catch (e: any) {
      console.error('Error generating master template zip:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Fast Server-side Bulk Uploads / Submissions ZIP Download
  app.get('/api/sms/uploads/download-all-zip', authenticate, async (req: any, res) => {
    try {
      const categoryFilter = req.query.category ? String(req.query.category).trim() : null;
      const vesselFilter = req.query.vesselId ? String(req.query.vesselId).trim() : null;

      let query = 'SELECT id, vessel_id as vesselId, vessel_name as vesselName, month, year, file_name as fileName, category, file_data FROM sms_uploads WHERE deleted_at IS NULL';
      const params: any[] = [];
      if (categoryFilter) {
        query += ' AND (category = ? OR TRIM(category) = ?)';
        params.push(categoryFilter, categoryFilter);
      }
      if (vesselFilter) {
        query += ' AND vessel_id = ?';
        params.push(vesselFilter);
      }
      query += ' ORDER BY category ASC, vessel_name ASC, year DESC, month DESC, id DESC';

      const [uploads]: any = await pool.query(query, params);
      if (!uploads || uploads.length === 0) {
        return res.status(404).json({ error: 'No SMS uploads found to download.' });
      }

      const zip = new JSZip();
      const fileEntries: { folder: string; filename: string; buffer: Buffer }[] = [];

      const BATCH_SIZE = 25;
      for (let i = 0; i < uploads.length; i += BATCH_SIZE) {
        const batch = uploads.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (up: any) => {
          try {
            const rawCat = (up.category || '1. Monthly').replace(/[\/\\?%*:|"<>]/g, '_');
            const rawVessel = (up.vesselName || 'Vessel').replace(/[\/\\?%*:|"<>]/g, '_');
            const folder = `${rawCat}/${rawVessel}/${up.month || 'M'}_${up.year || 'Y'}`;
            
            let buf: Buffer | null = null;
            if (up.file_data) {
              const raw = up.file_data;
              if (Buffer.isBuffer(raw) && raw.length > 7 && raw.toString('utf8', 0, 7) === 'B2_KEY:') {
                buf = await handleFileRetrieve(raw);
              } else {
                let str = Buffer.isBuffer(raw) ? raw.toString('utf-8') : String(raw);
                if (str.startsWith('B2_KEY:')) {
                  buf = await handleFileRetrieve(Buffer.from(str));
                } else if (str.startsWith('data:')) {
                  const base64Part = str.split(',')[1] || str;
                  buf = Buffer.from(base64Part, 'base64');
                } else {
                  buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'base64');
                }
              }
            }

            if (!buf) {
              buf = Buffer.from(`Missing file payload for ${up.fileName}`, 'utf-8');
            }

            fileEntries.push({ folder, filename: up.fileName || 'file.bin', buffer: buf });
          } catch (err: any) {
            console.warn(`Upload unpack error for ${up.fileName}:`, err.message);
          }
        }));
      }

      const usedNames = new Set<string>();
      for (const entry of fileEntries) {
        const targetFolder = zip.folder(entry.folder) || zip;
        let nameCandidate = entry.filename.replace(/[\/\\?%*:|"<>]/g, '_');
        const uniqueKey = entry.folder + '/' + nameCandidate;
        if (usedNames.has(uniqueKey)) {
          const lastDot = nameCandidate.lastIndexOf('.');
          const base = lastDot !== -1 ? nameCandidate.substring(0, lastDot) : nameCandidate;
          const ext = lastDot !== -1 ? nameCandidate.substring(lastDot) : '';
          let counter = 1;
          while (usedNames.has(entry.folder + '/' + `${base}_${counter}${ext}`)) {
            counter++;
          }
          nameCandidate = `${base}_${counter}${ext}`;
        }
        usedNames.add(entry.folder + '/' + nameCandidate);
        targetFolder.file(nameCandidate, entry.buffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 3 }
      });

      const safeName = categoryFilter
        ? `SMS_Submissions_${categoryFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        : `SMS_All_Submissions_All_Sections_${new Date().getFullYear()}`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
      res.send(zipBuffer);
    } catch (e: any) {
      console.error('Error generating master uploads zip:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/forms/:id/download-template', authenticate, async (req, res) => {
    try {
      let [rows]: any = await pool.execute(
        'SELECT formCode, description, template_file_name, template_file_data, template_file_mimetype, template_files FROM sms_forms WHERE id = ? AND deleted_at IS NULL',
        [req.params.id]
      );
      if (!rows || rows.length === 0) {
        [rows] = await pool.execute(
          'SELECT formCode, description, template_file_name, template_file_data, template_file_mimetype, template_files FROM sms_forms WHERE (formCode = ? OR TRIM(formCode) = TRIM(?)) AND deleted_at IS NULL',
          [req.params.id, req.params.id]
        );
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'No template file found for this form.' });
      }
      const item = rows[0];
      let tName = item.template_file_name;
      let rawData = item.template_file_data;
      let tMime = item.template_file_mimetype;

      if (req.query.fileIndex !== undefined || req.query.filename) {
        let tFiles: any[] = [];
        try {
          tFiles = typeof item.template_files === 'string' ? JSON.parse(item.template_files) : (item.template_files || []);
        } catch (e) {
          tFiles = [];
        }
        let selectedFile: any = null;
        if (req.query.fileIndex !== undefined) {
          const idx = parseInt(String(req.query.fileIndex), 10);
          if (!isNaN(idx) && tFiles[idx]) {
            selectedFile = tFiles[idx];
          }
        }
        if (!selectedFile && req.query.filename) {
          selectedFile = tFiles.find((f: any) => f.name === req.query.filename);
        }
        if (selectedFile && selectedFile.data) {
          tName = selectedFile.name || tName;
          rawData = selectedFile.data;
          tMime = selectedFile.mimetype || tMime;
        }
      }

      if (!rawData) {
        return res.status(404).json({ error: 'No template file uploaded for this form.' });
      }
      const rawDataForBuffer = rawData;
      let buffer: Buffer;
      if (Buffer.isBuffer(rawDataForBuffer) && rawDataForBuffer.length > 7 && rawDataForBuffer.toString('utf8', 0, 7) === 'B2_KEY:') {
        buffer = await handleFileRetrieve(rawDataForBuffer);
      } else {
        let str = Buffer.isBuffer(rawDataForBuffer) ? rawDataForBuffer.toString('utf-8') : String(rawDataForBuffer);
        if (str.startsWith('B2_KEY:')) {
          buffer = await handleFileRetrieve(Buffer.from(str));
        } else if (str.startsWith('data:')) {
          const base64Part = str.split(',')[1] || str;
          buffer = Buffer.from(base64Part, 'base64');
        } else {
          buffer = Buffer.isBuffer(rawDataForBuffer) ? rawDataForBuffer : Buffer.from(rawDataForBuffer, 'base64');
        }
      }

      const isInline = req.query.inline === 'true' || req.query.inline === '1' || req.path.endsWith('/view-template');
      res.setHeader('Content-Type', tMime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(tName || 'form_template')}"`);
      res.send(buffer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/forms/:id/view-template', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [rows]: any = await pool.execute(
        'SELECT template_file_name, template_file_data, template_file_mimetype, template_files FROM sms_forms WHERE id = ?',
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Form template not found' });
      }
      const form = rows[0];
      let rawDataForBuffer = form.template_file_data;
      let tName = form.template_file_name;
      let tMime = form.template_file_mimetype;

      if (!rawDataForBuffer && form.template_files) {
        try {
          const parsed = typeof form.template_files === 'string' ? JSON.parse(form.template_files) : form.template_files;
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawDataForBuffer = parsed[0].data || parsed[0].content || parsed[0].file_data;
            tName = parsed[0].name || parsed[0].fileName || tName;
            tMime = parsed[0].type || parsed[0].mimetype || tMime;
          }
        } catch (err) {
          console.error('Error parsing template_files array:', err);
        }
      }

      if (!rawDataForBuffer) {
        return res.status(404).json({ error: 'No template file uploaded for this form' });
      }

      const buffer = await handleFileRetrieve(rawDataForBuffer);
      res.setHeader('Content-Type', tMime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(tName || 'form_template')}"`);
      res.send(buffer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/forms', authenticate, async (req, res) => {
    const { id, category, formCode, description, formDate, scope, type, vesselType, removeFilenameRestriction, allowedFileTypes, sort_order, isHira, isAcknowledgementRequired, template_file_name, template_file_data, template_file_mimetype, template_file_size, template_files } = req.body;
    const allowedTypesVal = Array.isArray(allowedFileTypes) ? JSON.stringify(allowedFileTypes) : (allowedFileTypes || null);
    const orderVal = typeof sort_order === 'number' ? sort_order : 0;
    const isHiraVal = isHira ? 1 : 0;
    const isAckReqVal = isAcknowledgementRequired ? 1 : 0;
    const tFileName = template_file_name || null;
    const tFileMime = template_file_mimetype || null;
    const tFileSize = typeof template_file_size === 'number' ? template_file_size : null;

    try {
      const activeId = id && String(id).trim() ? String(id).trim() : ('f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

      let [exists]: any = await pool.execute(
        'SELECT id, template_file_name, template_file_data, template_file_mimetype, template_file_size, template_files FROM sms_forms WHERE id = ?',
        [activeId]
      );
      
      let finalTFileName = tFileName;
      let finalTFileData: Buffer | null = null;
      let finalTFileMime = tFileMime;
      let finalTFileSize = tFileSize;

      if (template_file_data !== undefined) {
        if (template_file_data) {
          let fileBuf: Buffer;
          let mime = tFileMime || 'application/octet-stream';
          if (typeof template_file_data === 'string' && template_file_data.startsWith('data:')) {
            const parsed = parseBase64DataUrl(template_file_data);
            if (parsed) {
              mime = parsed.mimetype;
              fileBuf = parsed.buffer;
            } else {
              fileBuf = Buffer.from(template_file_data);
            }
          } else if (Buffer.isBuffer(template_file_data)) {
            fileBuf = template_file_data;
          } else if (typeof template_file_data === 'string' && template_file_data.startsWith('B2_KEY:')) {
            fileBuf = Buffer.from(template_file_data);
          } else {
            fileBuf = Buffer.from(String(template_file_data), 'base64');
          }

          if (fileBuf.length > 7 && fileBuf.toString('utf8', 0, 7) === 'B2_KEY:') {
            finalTFileData = fileBuf;
          } else {
            finalTFileData = await handleFileUpload(tFileName || `template_${activeId}`, mime, fileBuf, 'sms_templates');
          }
          finalTFileMime = mime;
        } else {
          finalTFileName = null;
          finalTFileData = null;
          finalTFileMime = null;
          finalTFileSize = null;
        }
      } else if (exists && exists.length > 0) {
        finalTFileName = exists[0].template_file_name;
        finalTFileData = exists[0].template_file_data;
        finalTFileMime = exists[0].template_file_mimetype;
        finalTFileSize = exists[0].template_file_size;
      }

      let finalTemplateFilesVal: string | null = null;
      if (template_files !== undefined) {
        if (Array.isArray(template_files) && template_files.length > 0) {
          const processedFiles = [];
          for (let idx = 0; idx < template_files.length; idx++) {
            const tf = template_files[idx];
            if (!tf || !tf.name) continue;
            let fileDataStr = tf.data;
            if (tf.data) {
              let fileBuf: Buffer | null = null;
              let mime = tf.mimetype || 'application/octet-stream';
              if (typeof tf.data === 'string' && tf.data.startsWith('data:')) {
                const parsed = parseBase64DataUrl(tf.data);
                if (parsed) {
                  mime = parsed.mimetype;
                  fileBuf = parsed.buffer;
                } else {
                  fileBuf = Buffer.from(tf.data);
                }
              } else if (Buffer.isBuffer(tf.data)) {
                fileBuf = tf.data;
              } else if (typeof tf.data === 'string' && tf.data.startsWith('B2_KEY:')) {
                fileDataStr = tf.data;
              } else if (typeof tf.data === 'string') {
                fileBuf = Buffer.from(tf.data, 'base64');
              }
              if (fileBuf) {
                if (fileBuf.length > 7 && fileBuf.toString('utf8', 0, 7) === 'B2_KEY:') {
                  fileDataStr = fileBuf.toString('utf8');
                } else {
                  const uploadedBuf = await handleFileUpload(`${tf.name}_${idx}_${activeId}`, mime, fileBuf, 'sms_templates');
                  if (uploadedBuf.length > 7 && uploadedBuf.toString('utf8', 0, 7) === 'B2_KEY:') {
                    fileDataStr = uploadedBuf.toString('utf8');
                  } else {
                    fileDataStr = tf.data;
                  }
                }
              }
            }
            processedFiles.push({
              name: tf.name,
              data: fileDataStr,
              mimetype: tf.mimetype || 'application/octet-stream',
              size: typeof tf.size === 'number' ? tf.size : null
            });
          }
          finalTemplateFilesVal = JSON.stringify(processedFiles);
        } else {
          finalTemplateFilesVal = null;
        }
      } else if (exists && exists.length > 0) {
        finalTemplateFilesVal = exists[0].template_files || null;
      }

      if (exists && exists.length > 0) {
        await pool.execute(
          'UPDATE sms_forms SET category = ?, formCode = ?, description = ?, formDate = ?, scope = ?, type = ?, vesselType = ?, removeFilenameRestriction = ?, allowedFileTypes = ?, sort_order = ?, isHira = ?, isAcknowledgementRequired = ?, template_file_name = ?, template_file_data = ?, template_file_mimetype = ?, template_file_size = ?, template_files = ?, deleted_at = NULL WHERE id = ?',
          [category, formCode, description, formDate, scope, type || 'Form', vesselType || 'All Vessels', removeFilenameRestriction ? 1 : 0, allowedTypesVal, orderVal, isHiraVal, isAckReqVal, finalTFileName, finalTFileData, finalTFileMime, finalTFileSize, finalTemplateFilesVal, activeId]
        );
      } else {
        await pool.execute(
          'INSERT INTO sms_forms (id, category, formCode, description, formDate, scope, type, vesselType, removeFilenameRestriction, allowedFileTypes, sort_order, isHira, isAcknowledgementRequired, template_file_name, template_file_data, template_file_mimetype, template_file_size, template_files) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [activeId, category, formCode, description, formDate, scope, type || 'Form', vesselType || 'All Vessels', removeFilenameRestriction ? 1 : 0, allowedTypesVal, orderVal, isHiraVal, isAckReqVal, finalTFileName, finalTFileData, finalTFileMime, finalTFileSize, finalTemplateFilesVal]
        );
      }
      res.json({ success: true, id: activeId });
    } catch (e: any) {
      console.error('Error in POST /api/sms/forms:', e);
      res.status(500).json({ error: e.message || 'Failed to save form.' });
    }
  });

  app.post('/api/sms/forms/reorder', authenticate, async (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Invalid payload: expected an array of items' });
    try {
      for (const item of items) {
        if (item && item.id) {
          await pool.execute('UPDATE sms_forms SET sort_order = ? WHERE id = ?', [item.sort_order ?? 0, item.id]);
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/sms/forms/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE sms_forms SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      if (req.user) {
        await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_SMS_FORM', `Soft deleted SMS form ID ${req.params.id}`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // SMS Submission Periods Routes
  app.get('/api/sms/submission-periods', authenticate, async (req, res) => {
    try {
      const [rows]: any = await pool.query('SELECT * FROM sms_submission_periods WHERE deleted_at IS NULL');
      const mapped = rows.map((r: any) => ({
        vesselId: String(r.vessel_id),
        vesselName: r.vessel_name,
        month: r.month,
        year: r.year
      }));
      res.json(mapped);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/submission-periods', authenticate, async (req, res) => {
    const { vesselId, vesselName, month, year } = req.body;
    try {
      const [exists]: any = await pool.execute('SELECT vessel_id FROM sms_submission_periods WHERE vessel_id = ?', [vesselId]);
      if (exists.length > 0) {
        await pool.execute(
          'UPDATE sms_submission_periods SET vessel_name = ?, month = ?, year = ?, deleted_at = NULL WHERE vessel_id = ?',
          [vesselName, month, year, vesselId]
        );
      } else {
        await pool.execute(
          'INSERT INTO sms_submission_periods (vessel_id, vessel_name, month, year) VALUES (?, ?, ?, ?)',
          [vesselId, vesselName, month, year]
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/sms/submission-periods/:vesselId', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE sms_submission_periods SET deleted_at = CURRENT_TIMESTAMP WHERE vessel_id = ?', [req.params.vesselId]);
      if (req.user) {
        await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_SMS_SUBMISSION_PERIOD', `Soft deleted SMS submission period for vessel ID ${req.params.vesselId}`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== SMS VESSEL MATCHING HELPERS ====================
  const normalizeVesselName = (s: string) => {
    return (s || '')
      .toLowerCase()
      .replace(/^m\/?v\.?\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  async function getVesselUserIdentity(poolRef: any, userObj: any) {
    if (!poolRef || !userObj) return { vesselId: null, vesselName: null };
    let vId = userObj.vessel_id != null ? String(userObj.vessel_id) : null;
    let vName: string | null = null;

    try {
      if (!vId && userObj.id) {
        const [uRows]: any = await poolRef.execute('SELECT vessel_id, username, role FROM users WHERE id = ?', [userObj.id]);
        if (uRows.length > 0 && uRows[0].vessel_id) {
          vId = String(uRows[0].vessel_id);
        }
      }

      if (vId) {
        const cleanId = vId.replace(/^v/i, '').trim();
        const [vRows]: any = await poolRef.execute('SELECT id, name FROM vessels WHERE id = ? OR id = ? OR name = ?', [vId, cleanId, vId]);
        if (vRows.length > 0) {
          vName = vRows[0].name;
        }
      }

      if (!vName && userObj.username) {
        const uTrim = userObj.username.trim();
        const [vRows]: any = await poolRef.execute(
          'SELECT id, name FROM vessels WHERE name = ? OR LOWER(name) = ? OR LOWER(name) LIKE ?',
          [uTrim, uTrim.toLowerCase(), `%${uTrim.toLowerCase()}%`]
        );
        if (vRows.length > 0) {
          if (!vId) vId = String(vRows[0].id);
          vName = vRows[0].name;
        }
      }
    } catch (err) {
      console.error('Error getting vessel user identity:', err);
    }

    return { vesselId: vId, vesselName: vName };
  }

  function checkVesselMatch(
    vesselId: string | number | null | undefined,
    vesselName: string | null | undefined,
    targetId: string | number | null | undefined,
    targetName: string | null | undefined,
    username?: string | null
  ): boolean {
    const vIdStr = vesselId != null ? String(vesselId).trim() : '';
    const vIdClean = vIdStr.replace(/^v/i, '').trim();
    const vNameTrim = (vesselName || '').trim();
    const vNameNorm = normalizeVesselName(vNameTrim);

    const tIdStr = targetId != null ? String(targetId).trim() : '';
    const tIdClean = tIdStr.replace(/^v/i, '').trim();
    const tNameTrim = (targetName || '').trim();
    const tNameNorm = normalizeVesselName(tNameTrim);

    const uTrim = (username || '').trim();
    const uNorm = normalizeVesselName(uTrim);

    // 1. Direct ID match (handles '4', 'v4', etc.)
    if (tIdClean && vIdClean && (tIdClean === vIdClean || tIdStr === vIdStr)) {
      return true;
    }

    // 2. Direct name match (case-insensitive)
    if (tNameTrim && vNameTrim && tNameTrim.toLowerCase() === vNameTrim.toLowerCase()) {
      return true;
    }
    if (uTrim && vNameTrim && uTrim.toLowerCase() === vNameTrim.toLowerCase()) {
      return true;
    }
    if (tNameTrim && vIdStr && tNameTrim.toLowerCase() === vIdStr.toLowerCase()) {
      return true;
    }

    // 3. Normalized name match (removes MV, symbols, spaces)
    if (tNameNorm && vNameNorm && (tNameNorm === vNameNorm || tNameNorm.includes(vNameNorm) || vNameNorm.includes(tNameNorm))) {
      return true;
    }
    if (uNorm && vNameNorm && (uNorm === vNameNorm || uNorm.includes(vNameNorm) || vNameNorm.includes(uNorm))) {
      return true;
    }

    return false;
  }

  function checkFormUploadMatch(u: any, item: any): boolean {
    if (!u || !item) return false;

    // 0. Direct item_id match (if explicitly linked to this order item)
    if (u.item_id != null && item.id != null && String(u.item_id) === String(item.id)) {
      return true;
    }

    const uFormId = u.form_id != null ? String(u.form_id).trim() : '';
    const itemFormId = item.form_id != null ? String(item.form_id).trim() : '';

    const uCode = u.form_code != null ? String(u.form_code).trim().toUpperCase() : '';
    const fCode = item.form_code != null ? String(item.form_code).trim().toUpperCase() : '';

    const fDesc = item.description != null ? String(item.description).toUpperCase() : '';
    const fName = u.file_name != null ? String(u.file_name).toUpperCase() : '';

    const combinedItemText = `${fCode} ${fDesc}`.toUpperCase();
    const combinedFileText = `${uCode} ${fName}`.toUpperCase();

    const hasQualifierConflict = (): boolean => {
      if (!fDesc && !fCode) return false;

      // 1. Department checks (Deck, Engine, Catering)
      const isDeckItem = combinedItemText.includes('DECK');
      const isEngineItem = combinedItemText.includes('ENGINE') || combinedItemText.includes('(ENG)') || combinedItemText.includes(' ENGINE ') || combinedItemText.includes('-ENG') || combinedItemText.includes('_ENG');
      const isCateringItem = combinedItemText.includes('CATERING') || combinedItemText.includes('(CAT)') || combinedItemText.includes('GALLEY') || combinedItemText.includes('STEWARD');

      const isDeckFile = combinedFileText.includes('DECK');
      const isEngineFile = combinedFileText.includes('ENGINE') || combinedFileText.includes('_ENG') || combinedFileText.includes('-ENG') || combinedFileText.includes(' ENG.') || combinedFileText.includes('(ENG)');
      const isCateringFile = combinedFileText.includes('CATERING') || combinedFileText.includes('_CAT') || combinedFileText.includes('-CAT') || combinedFileText.includes('GALLEY');

      if ((isDeckItem || isEngineItem || isCateringItem) && (isDeckFile || isEngineFile || isCateringFile)) {
        if (isDeckItem && !isDeckFile) return true;
        if (isEngineItem && !isEngineFile) return true;
        if (isCateringItem && !isCateringFile) return true;
      }

      // 2. Flag / Jurisdiction checks (e.g. Malta, Singapore vs Panama vs Liberia etc.)
      const flagsList = ['MALTA', 'SINGAPORE', 'PANAMA', 'LIBERIA', 'MARSHALL', 'BAHAMAS', 'CYPRUS', 'TUVALU', 'VANUATU', 'ANTIGUA', 'HONG KONG'];
      const itemFlags = flagsList.filter(flg => combinedItemText.includes(flg));
      const fileFlags = flagsList.filter(flg => combinedFileText.includes(flg));

      if (itemFlags.length > 0 && fileFlags.length > 0) {
        const hasCommonFlag = itemFlags.some(flg => fileFlags.includes(flg));
        if (!hasCommonFlag) return true;
      }

      // 3. Sub-code suffix checks (e.g. COMI-SM-1-8 vs COMI-SM-1-8A vs COMI-SM-1-3A vs COMI-SM-1-3)
      if (fCode) {
        const escapedCode = fCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const extendedCodeRegex = new RegExp(`(^|[^A-Z0-9])${escapedCode}[-_]?([A-Z0-9]+)`, 'i');
        const match = combinedFileText.match(extendedCodeRegex);
        if (match && match[2]) {
          const subToken = match[2].toUpperCase();
          const cleanFCode = fCode.replace(/[^A-Z0-9]/g, '');
          const isPartOfFCode = cleanFCode.endsWith(subToken) || fCode.toUpperCase().includes(subToken);
          const isYear = /^(202[0-9]|203[0-9])$/.test(subToken);
          const isPartOfDesc = fDesc.includes(subToken) || subToken.length > 3;
          if (!isPartOfFCode && !isYear && !isPartOfDesc) {
            return true;
          }
        }
      }

      return false;
    };

    // 1. Direct form_id match
    if (uFormId && itemFormId && uFormId === itemFormId) {
      if (hasQualifierConflict()) return false;
      return true;
    }

    // 2. Exact or normalized form_code match
    if (uCode && fCode) {
      const uNorm = uCode.replace(/[^A-Z0-9]/g, '');
      const fNorm = fCode.replace(/[^A-Z0-9]/g, '');
      if (uCode === fCode || uNorm === fNorm) {
        if (hasQualifierConflict()) return false;
        return true;
      }
    }

    // 3. Match by form_code token in file_name
    if (fName && fCode) {
      const escapedCode = fCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[^A-Z0-9]/g, '[^A-Z0-9]');
      const regex = new RegExp(`(^|[^A-Z0-9])${escapedCode}([^A-Z0-9]|$)`, 'i');
      if (regex.test(fName)) {
        if (hasQualifierConflict()) return false;
        return true;
      }
    }

    return false;
  }

  // ==================== SMS ORDER LIST ROUTES ====================
  app.get('/api/sms/orders', authenticate, async (req: any, res) => {
    try {
      const isVessel = req.user.role === 'vessel';
      let assignedVesselId: string | null = null;
      let assignedVesselName: string | null = null;

      if (isVessel) {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        assignedVesselId = idInfo.vesselId;
        assignedVesselName = idInfo.vesselName;
      }

      // Fetch all active orders
      const [orders]: any = await pool.query(
        'SELECT o.id, o.label, o.deadline_date, o.instructions, o.created_by_id, o.created_by_name, o.created_at, o.updated_at FROM sms_orders o WHERE o.deleted_at IS NULL ORDER BY o.created_at DESC'
      );

      if (orders.length === 0) {
        return res.json([]);
      }

      const orderIds = orders.map((o: any) => o.id);
      const placeholders = orderIds.map(() => '?').join(',');
      const [vessels]: any = await pool.query(
        `SELECT id, order_id, vessel_id, vessel_name, status, completed_at FROM sms_order_vessels WHERE order_id IN (${placeholders}) AND deleted_at IS NULL`,
        orderIds
      );

      const [items]: any = await pool.query(
        `SELECT id, order_id, form_id, form_code, category, description, form_date, type, is_hira, remove_filename_restriction, allowed_file_types, template_file_name, sort_order FROM sms_order_items WHERE order_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC`,
        orderIds
      );

      const [uploads]: any = await pool.query(
        `SELECT id, order_id, vessel_id, vessel_name, form_id, form_code, item_id, file_name, file_size, file_mimetype, b2_folder_path, uploaded_at, uploaded_by, checked_at, checked_by, replace_requested_at, replace_requested_by, replace_reason FROM sms_order_uploads WHERE order_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY uploaded_at DESC`,
        orderIds
      );

      // Read status per logged-on user
      const currentUserId = String(req.user.id || req.user.username);
      const userReadMap = new Map<number, string>();
      if (!isVessel) {
        try {
          const [userReads]: any = await pool.query(
            'SELECT upload_id, read_at FROM sms_order_upload_reads WHERE user_id = ?',
            [currentUserId]
          );
          userReads.forEach((r: any) => userReadMap.set(r.upload_id, r.read_at));
        } catch (e: any) {
          console.warn('Note on fetching user upload reads:', e.message);
        }
      }

      const results = [];

      for (const o of orders) {
        const orderVessels = vessels.filter((v: any) => v.order_id === o.id);

        // For vessel users, only include orders assigned to their vessel
        if (isVessel) {
          const isAssigned = orderVessels.some((v: any) =>
            checkVesselMatch(v.vessel_id, v.vessel_name, assignedVesselId, assignedVesselName, req.user.username)
          );
          if (!isAssigned) {
            continue;
          }
        }

        const orderItems = items.filter((i: any) => i.order_id === o.id).map((it: any) => {
          let parsedAllowed: string[] = [];
          try {
            if (it.allowed_file_types) {
              parsedAllowed = Array.isArray(it.allowed_file_types) ? it.allowed_file_types : JSON.parse(it.allowed_file_types);
            }
          } catch {
            parsedAllowed = [];
          }
          return {
            ...it,
            is_hira: Boolean(it.is_hira),
            remove_filename_restriction: Boolean(it.remove_filename_restriction),
            allowed_file_types: parsedAllowed
          };
        }).sort((a: any, b: any) =>
          String(a.form_code || '').localeCompare(String(b.form_code || ''), undefined, { numeric: true, sensitivity: 'base' })
        );

        const orderUploads = uploads.filter((u: any) => u.order_id === o.id).map((u: any) => {
          const isRead = isVessel ? true : userReadMap.has(u.id);
          const readAt = isRead ? userReadMap.get(u.id) || u.checked_at || u.uploaded_at : null;
          return {
            ...u,
            is_read: isRead,
            read_at: readAt,
            checked_at: readAt,
            checked_by: isRead ? (req.user.username || 'You') : null
          };
        });

        const totalItemsCount = orderItems.length;

        const mappedVessels = orderVessels.map((v: any) => {
          const vUploads = orderUploads.filter((u: any) => 
            checkVesselMatch(u.vessel_id, u.vessel_name, v.vessel_id, v.vessel_name)
          );
          const distinctFormsUploaded = orderItems.filter((item: any) => {
            return vUploads.some((u: any) => checkFormUploadMatch(u, item));
          }).length;
          const isCompleted = (totalItemsCount > 0 && distinctFormsUploaded >= totalItemsCount) || v.status === 'Completed';
          return {
            ...v,
            submittedCount: isCompleted ? totalItemsCount : distinctFormsUploaded,
            totalRequiredCount: totalItemsCount,
            totalFilesUploaded: vUploads.length,
            status: isCompleted ? 'Completed' : (v.status || 'Pending')
          };
        });

        const allCompleted = mappedVessels.length > 0 && mappedVessels.every((v: any) => v.status === 'Completed');
        const anyCompleted = mappedVessels.some((v: any) => v.status === 'Completed' || v.submittedCount > 0);
        
        let overallStatus = 'Pending';
        if (allCompleted) {
          overallStatus = 'Completed';
        } else if (o.deadline_date && new Date(o.deadline_date) < new Date(new Date().setHours(0, 0, 0, 0)) && !allCompleted) {
          overallStatus = 'Overdue';
        } else if (anyCompleted) {
          overallStatus = 'In Progress';
        }

        let vesselProgress = null;
        if (isVessel) {
          const myVessel = mappedVessels.find((v: any) =>
            checkVesselMatch(v.vessel_id, v.vessel_name, assignedVesselId, assignedVesselName, req.user.username)
          ) || mappedVessels[0];
          if (myVessel) {
            vesselProgress = {
              submittedCount: myVessel.submittedCount,
              totalRequiredCount: totalItemsCount,
              totalFilesUploaded: myVessel.totalFilesUploaded,
              status: myVessel.status
            };
          }
        }

        const returnedUploads = isVessel
          ? orderUploads.filter((u: any) => checkVesselMatch(u.vessel_id, u.vessel_name, assignedVesselId, assignedVesselName, req.user.username))
          : orderUploads;

        results.push({
          id: o.id,
          label: o.label,
          deadlineDate: o.deadline_date,
          instructions: o.instructions,
          createdById: o.created_by_id,
          createdByName: o.created_by_name,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
          vessels: mappedVessels,
          items: orderItems,
          uploads: returnedUploads,
          totalItemsCount,
          totalVesselsCount: mappedVessels.length,
          overallStatus,
          vesselProgress
        });
      }

      res.json(results);
    } catch (e: any) {
      console.error('Error fetching SMS orders:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/orders/sidebar-status', authenticate, async (req: any, res) => {
    try {
      if (!pool) {
        return res.json({
          statusColor: 'normal',
          urgentCount: 0,
          uncheckedCount: 0,
          hasUrgentDeadline: false,
          hasUncheckedUploads: false
        });
      }

      const isVessel = req.user.role === 'vessel';
      const currentUserId = String(req.user.id || req.user.username);
      let assignedVesselId: string | null = null;
      let assignedVesselName: string | null = null;

      if (isVessel) {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        assignedVesselId = idInfo.vesselId;
        assignedVesselName = idInfo.vesselName;
      }

      const [orders]: any = await pool.execute(
        'SELECT id, label, deadline_date FROM sms_orders WHERE deleted_at IS NULL'
      );

      if (orders.length === 0) {
        return res.json({
          statusColor: 'normal',
          urgentCount: 0,
          uncheckedCount: 0,
          hasUrgentDeadline: false,
          hasUncheckedUploads: false
        });
      }

      const orderIds = orders.map((o: any) => o.id);
      const placeholders = orderIds.map(() => '?').join(',');

      const [vessels]: any = await pool.query(
        `SELECT order_id, vessel_id, vessel_name, status FROM sms_order_vessels WHERE order_id IN (${placeholders}) AND deleted_at IS NULL`,
        orderIds
      );

      const [items]: any = await pool.query(
        `SELECT order_id, form_id FROM sms_order_items WHERE order_id IN (${placeholders}) AND deleted_at IS NULL`,
        orderIds
      );

      const [uploads]: any = await pool.query(
        `SELECT id, order_id, vessel_id, vessel_name, form_id, form_code, file_name, uploaded_by, replace_requested_at FROM sms_order_uploads WHERE order_id IN (${placeholders}) AND deleted_at IS NULL`,
        orderIds
      );

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let urgentCount = 0;
      let uncheckedCount = 0;
      let replaceRequestedCount = 0;
      let pendingFilesCount = 0;

      for (const order of orders) {
        const orderItems = items.filter((i: any) => i.order_id === order.id);
        const totalItems = orderItems.length;
        const orderVessels = vessels.filter((v: any) => v.order_id === order.id);

        let isCompletedForUser = false;

        if (isVessel) {
          const myV = orderVessels.find((v: any) =>
            checkVesselMatch(v.vessel_id, v.vessel_name, assignedVesselId, assignedVesselName, req.user.username)
          );
          if (!myV) continue;
          const myUploads = uploads.filter((u: any) =>
            checkVesselMatch(u.vessel_id, u.vessel_name, myV.vessel_id, myV.vessel_name) && u.order_id === order.id
          );

          let vReplaceReq = 0;
          let vPending = 0;

          const verifiedCount = orderItems.filter((item: any) => {
            const itemUps = myUploads.filter((u: any) => checkFormUploadMatch(u, item));
            const hasValidUpload = itemUps.some((u: any) => !u.replace_requested_at);
            const hasReplaceReq = itemUps.some((u: any) => u.replace_requested_at);
            
            if (hasReplaceReq && !hasValidUpload) {
              vReplaceReq++;
              vPending++;
            } else if (!hasValidUpload) {
              vPending++;
            }

            return hasValidUpload;
          }).length;

          replaceRequestedCount += vReplaceReq;
          pendingFilesCount += vPending;

          isCompletedForUser = (totalItems > 0 && verifiedCount >= totalItems) || myV.status === 'Completed';
        } else {
          const allDone = orderVessels.length > 0 && orderVessels.every((v: any) => {
            if (v.status === 'Completed') return true;
            const vUps = uploads.filter((u: any) =>
              checkVesselMatch(u.vessel_id, u.vessel_name, v.vessel_id, v.vessel_name) && u.order_id === order.id
            );
            const verified = orderItems.filter((item: any) => {
              return vUps.some((u: any) => checkFormUploadMatch(u, item) && !u.replace_requested_at);
            }).length;
            return totalItems > 0 && verified >= totalItems;
          });
          isCompletedForUser = allDone;
        }

        if (!isCompletedForUser && order.deadline_date) {
          const parts = order.deadline_date.split('-');
          if (parts.length === 3) {
            const dDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const diffDays = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            // Deadline within 7 days or overdue
            if (diffDays <= 7) {
              urgentCount++;
            }
          }
        }
      }

      // Unread/unchecked uploads for THIS specific logged-on office/management user
      if (!isVessel && uploads.length > 0) {
        try {
          const [userReads]: any = await pool.query(
            'SELECT upload_id FROM sms_order_upload_reads WHERE user_id = ?',
            [currentUserId]
          );
          const userReadSet = new Set<number>(userReads.map((r: any) => r.upload_id));
          const unreadUploads = uploads.filter((u: any) => !userReadSet.has(u.id));
          uncheckedCount = unreadUploads.length;
        } catch (e: any) {
          console.warn('Note on checking unread count:', e.message);
        }
      }

      let statusColor: 'red' | 'orange' | 'normal' = 'normal';
      if (isVessel) {
        if (replaceRequestedCount > 0 || urgentCount > 0) {
          statusColor = 'red';
        } else if (pendingFilesCount > 0) {
          statusColor = 'orange';
        }
      } else {
        if (urgentCount > 0) {
          statusColor = 'red';
        } else if (uncheckedCount > 0) {
          statusColor = 'orange';
        }
      }

      res.json({
        statusColor,
        urgentCount,
        uncheckedCount,
        replaceRequestedCount,
        pendingFilesCount,
        hasUrgentDeadline: urgentCount > 0,
        hasUncheckedUploads: uncheckedCount > 0,
        hasReplaceRequests: replaceRequestedCount > 0
      });
    } catch (e: any) {
      console.warn('Handled warning in /api/sms/orders/sidebar-status:', e?.message || e);
      res.json({
        statusColor: 'normal',
        urgentCount: 0,
        uncheckedCount: 0,
        replaceRequestedCount: 0,
        pendingFilesCount: 0,
        hasUrgentDeadline: false,
        hasUncheckedUploads: false,
        hasReplaceRequests: false
      });
    }
  });

  // Request Vessel to Replace File
  const handleRequestUploadReplacement = async (req: any, res: any) => {
    const allowedRoles = ['admin', 'team_pic', 'management', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admin, PIC, and management roles can request file replacement.' });
    }
    const { uploadId } = req.params;
    const { reason } = req.body || {};
    const requester = req.user.username || req.user.name || 'Management';
    try {
      await pool.execute(
        'UPDATE sms_order_uploads SET replace_requested_at = CURRENT_TIMESTAMP, replace_requested_by = ?, replace_reason = ? WHERE id = ?',
        [requester, reason || 'Management requested replacement of this file.', uploadId]
      );
      res.json({
        success: true,
        uploadId: Number(uploadId),
        replace_requested_at: new Date().toISOString(),
        replace_requested_by: requester,
        replace_reason: reason || 'Management requested replacement of this file.'
      });
    } catch (e: any) {
      console.error('Error requesting replacement:', e);
      res.status(500).json({ error: e.message });
    }
  };

  app.post('/api/sms/orders/upload/:uploadId/request-replacement', authenticate, handleRequestUploadReplacement);
  app.post('/api/sms/orders/uploads/:uploadId/request-replacement', authenticate, handleRequestUploadReplacement);

  // Cancel Replacement Request
  const handleCancelUploadReplacement = async (req: any, res: any) => {
    const allowedRoles = ['admin', 'team_pic', 'management', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admin, PIC, and management roles can modify replacement requests.' });
    }
    const { uploadId } = req.params;
    try {
      await pool.execute(
        'UPDATE sms_order_uploads SET replace_requested_at = NULL, replace_requested_by = NULL, replace_reason = NULL WHERE id = ?',
        [uploadId]
      );
      res.json({ success: true, uploadId: Number(uploadId) });
    } catch (e: any) {
      console.error('Error canceling replacement request:', e);
      res.status(500).json({ error: e.message });
    }
  };

  app.post('/api/sms/orders/upload/:uploadId/cancel-replacement-request', authenticate, handleCancelUploadReplacement);
  app.post('/api/sms/orders/uploads/:uploadId/cancel-replacement-request', authenticate, handleCancelUploadReplacement);

  // Mark single upload read for the logged on user
  const handleMarkUploadReadForUser = async (req: any, res: any) => {
    if (req.user.role === 'vessel') {
      return res.status(403).json({ error: 'Vessel users cannot mark orders as checked' });
    }
    const { uploadId } = req.params;
    const currentUserId = String(req.user.id || req.user.username);
    try {
      await pool.execute(
        'INSERT INTO sms_order_upload_reads (user_id, upload_id, read_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP',
        [currentUserId, uploadId]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('Error marking SMS upload as read for user:', e);
      res.status(500).json({ error: e.message });
    }
  };

  app.post('/api/sms/orders/upload/:uploadId/check', authenticate, handleMarkUploadReadForUser);
  app.post('/api/sms/orders/upload/:uploadId/mark-read', authenticate, handleMarkUploadReadForUser);

  // Mark order uploads read for the logged on user
  const handleMarkOrderReadForUser = async (req: any, res: any) => {
    if (req.user.role === 'vessel') {
      return res.status(403).json({ error: 'Vessel users cannot mark orders as checked' });
    }
    const { id: orderId } = req.params;
    const vesselId = req.query.vessel_id || req.body?.vessel_id;
    const currentUserId = String(req.user.id || req.user.username);
    try {
      let query = 'SELECT id FROM sms_order_uploads WHERE order_id = ? AND deleted_at IS NULL';
      const params: any[] = [orderId];
      if (vesselId) {
        query += ' AND (vessel_id = ? OR vessel_name = ?)';
        params.push(String(vesselId), String(vesselId));
      }
      const [ups]: any = await pool.query(query, params);
      for (const u of ups) {
        await pool.execute(
          'INSERT INTO sms_order_upload_reads (user_id, upload_id, read_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP',
          [currentUserId, u.id]
        );
      }
      res.json({ success: true, count: ups.length });
    } catch (e: any) {
      console.error('Error marking SMS order uploads as read for user:', e);
      res.status(500).json({ error: e.message });
    }
  };

  app.post('/api/sms/orders/:id/mark-checked', authenticate, handleMarkOrderReadForUser);
  app.post('/api/sms/orders/:id/mark-read', authenticate, handleMarkOrderReadForUser);

  // Mark all order uploads read for the logged on user
  const handleMarkAllOrdersReadForUser = async (req: any, res: any) => {
    if (req.user.role === 'vessel') {
      return res.status(403).json({ error: 'Vessel users cannot mark orders as checked' });
    }
    const currentUserId = String(req.user.id || req.user.username);
    try {
      const [ups]: any = await pool.query('SELECT id FROM sms_order_uploads WHERE deleted_at IS NULL');
      for (const u of ups) {
        await pool.execute(
          'INSERT INTO sms_order_upload_reads (user_id, upload_id, read_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP',
          [currentUserId, u.id]
        );
      }
      res.json({ success: true, count: ups.length });
    } catch (e: any) {
      console.error('Error marking all SMS order uploads as read for user:', e);
      res.status(500).json({ error: e.message });
    }
  };

  app.post('/api/sms/orders/mark-all-checked', authenticate, handleMarkAllOrdersReadForUser);
  app.post('/api/sms/orders/mark-all-read', authenticate, handleMarkAllOrdersReadForUser);

  // ----------------------------------------------------
  // GRAPHIFY KNOWLEDGE GRAPH & ARCHITECTURE API
  // ----------------------------------------------------
  app.get('/api/graphify/graph', authenticate, async (req: any, res) => {
    try {
      const graph = graphifyEngine.getGraph();
      res.json(graph);
    } catch (e: any) {
      console.error('Error fetching Graphify graph:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/graphify/rescan', authenticate, async (req: any, res) => {
    try {
      // Recompute metrics
      graphifyEngine.calculateMetrics();
      const graph = graphifyEngine.getGraph();

      // Persist to graphify.json & GRAPHIFY.md if possible
      try {
        const jsonPath = path.join(process.cwd(), 'graphify.json');
        fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2), 'utf-8');
        const mdPath = path.join(process.cwd(), 'GRAPHIFY.md');
        fs.writeFileSync(mdPath, graphifyEngine.exportMarkdown(), 'utf-8');
      } catch (err) {
        console.warn('Could not write local graphify files:', err);
      }

      res.json({ success: true, graph, message: 'Codebase knowledge graph re-scanned and synchronized.' });
    } catch (e: any) {
      console.error('Error rescanning Graphify graph:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/graphify/impact', authenticate, async (req: any, res) => {
    try {
      const nodeId = String(req.query.nodeId || '');
      if (!nodeId) {
        return res.status(400).json({ error: 'nodeId query parameter is required' });
      }
      const impact = graphifyEngine.analyzeImpact(nodeId);
      if (!impact) {
        return res.status(404).json({ error: 'Node not found in Graphify knowledge base' });
      }
      res.json(impact);
    } catch (e: any) {
      console.error('Error calculating Graphify impact:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/graphify/markdown', authenticate, async (req: any, res) => {
    try {
      const md = graphifyEngine.exportMarkdown();
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(md);
    } catch (e: any) {
      console.error('Error generating Graphify markdown:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/orders/:id', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [orderRows]: any = await pool.execute(
        'SELECT * FROM sms_orders WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      if (orderRows.length === 0) {
        return res.status(404).json({ error: 'SMS Order not found' });
      }
      const o = orderRows[0];

      const [vessels]: any = await pool.execute(
        'SELECT id, order_id, vessel_id, vessel_name, status, completed_at FROM sms_order_vessels WHERE order_id = ? AND deleted_at IS NULL',
        [id]
      );

      if (req.user.role === 'vessel') {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        const assignedVesselId = idInfo.vesselId;
        const assignedVesselName = idInfo.vesselName;

        const isAssigned = vessels.some((v: any) =>
          checkVesselMatch(v.vessel_id, v.vessel_name, assignedVesselId, assignedVesselName, req.user.username)
        );
        if (!isAssigned) {
          return res.status(403).json({ error: 'This order is not assigned to your vessel.' });
        }
      }

      const [items]: any = await pool.execute(
        'SELECT id, order_id, form_id, form_code, category, description, form_date, type, is_hira, remove_filename_restriction, allowed_file_types, template_file_name, sort_order FROM sms_order_items WHERE order_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC',
        [id]
      );

      const [uploads]: any = await pool.execute(
        `SELECT id, order_id, vessel_id, vessel_name, form_id, form_code, item_id, file_name, file_size, file_mimetype, b2_folder_path, uploaded_at, uploaded_by, checked_at, checked_by, replace_requested_at, replace_requested_by, replace_reason FROM sms_order_uploads WHERE order_id = ? AND deleted_at IS NULL ORDER BY uploaded_at DESC`,
        [id]
      );

      const orderItems = items.map((it: any) => {
        let parsedAllowed: string[] = [];
        try {
          if (it.allowed_file_types) {
            parsedAllowed = Array.isArray(it.allowed_file_types) ? it.allowed_file_types : JSON.parse(it.allowed_file_types);
          }
        } catch {
          parsedAllowed = [];
        }
        return {
          ...it,
          is_hira: Boolean(it.is_hira),
          remove_filename_restriction: Boolean(it.remove_filename_restriction),
          allowed_file_types: parsedAllowed
        };
      }).sort((a: any, b: any) =>
        String(a.form_code || '').localeCompare(String(b.form_code || ''), undefined, { numeric: true, sensitivity: 'base' })
      );

      const totalItemsCount = orderItems.length;

      let returnedUploads = uploads;
      if (req.user.role === 'vessel') {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        returnedUploads = uploads.filter((u: any) =>
          checkVesselMatch(u.vessel_id, u.vessel_name, idInfo.vesselId, idInfo.vesselName, req.user.username)
        );
      }

      const mappedVessels = vessels.map((v: any) => {
        const vUploads = uploads.filter((u: any) => checkVesselMatch(u.vessel_id, u.vessel_name, v.vessel_id, v.vessel_name));
        const distinctFormsUploaded = orderItems.filter((item: any) => {
          return vUploads.some((u: any) => checkFormUploadMatch(u, item));
        }).length;
        const isCompleted = (totalItemsCount > 0 && distinctFormsUploaded >= totalItemsCount) || v.status === 'Completed';
        return {
          ...v,
          submittedCount: isCompleted ? totalItemsCount : distinctFormsUploaded,
          totalRequiredCount: totalItemsCount,
          totalFilesUploaded: vUploads.length,
          status: isCompleted ? 'Completed' : (v.status || 'Pending')
        };
      });

      res.json({
        id: o.id,
        label: o.label,
        deadlineDate: o.deadline_date,
        instructions: o.instructions,
        createdById: o.created_by_id,
        createdByName: o.created_by_name,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        vessels: mappedVessels,
        items: orderItems,
        uploads: returnedUploads
      });
    } catch (e: any) {
      console.error('Error fetching single SMS order:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/orders', authenticate, async (req: any, res) => {
    if (req.user.role === 'vessel') {
      return res.status(403).json({ error: 'Vessel users are not authorized to create or modify order lists' });
    }
    const { id, label, deadlineDate, instructions, vessels, items } = req.body;
    if (!label || !deadlineDate) {
      return res.status(400).json({ error: 'Label and Deadline Date are required' });
    }
    if (!vessels || !Array.isArray(vessels) || vessels.length === 0) {
      return res.status(400).json({ error: 'Please select at least one target vessel' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please select at least one form or checklist item' });
    }

    try {
      const orderId = id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const [existing]: any = await pool.execute('SELECT id FROM sms_orders WHERE id = ?', [orderId]);

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE sms_orders SET label = ?, deadline_date = ?, instructions = ?, updated_at = CURRENT_TIMESTAMP, deleted_at = NULL WHERE id = ?',
          [label, deadlineDate, instructions || '', orderId]
        );
        await pool.execute('UPDATE sms_order_vessels SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ?', [orderId]);
        await pool.execute('UPDATE sms_order_items SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ?', [orderId]);
      } else {
        await pool.execute(
          'INSERT INTO sms_orders (id, label, deadline_date, instructions, created_by_id, created_by_name) VALUES (?, ?, ?, ?, ?, ?)',
          [orderId, label, deadlineDate, instructions || '', String(req.user.id || '1'), req.user.username || 'Management']
        );
      }

      for (const v of vessels) {
        await pool.execute(
          'INSERT INTO sms_order_vessels (order_id, vessel_id, vessel_name, status) VALUES (?, ?, ?, ?)',
          [orderId, String(v.vessel_id || v.id), v.vessel_name || v.name, 'Pending']
        );
      }

      let sortOrder = 1;
      for (const item of items) {
        const allowedTypesStr = Array.isArray(item.allowed_file_types || item.allowedFileTypes)
          ? JSON.stringify(item.allowed_file_types || item.allowedFileTypes)
          : null;
        await pool.execute(
          'INSERT INTO sms_order_items (order_id, form_id, form_code, category, description, form_date, type, is_hira, remove_filename_restriction, allowed_file_types, template_file_name, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            orderId,
            item.form_id || item.id,
            item.form_code || item.formCode,
            item.category || '1. Monthly',
            item.description || '',
            item.form_date || item.formDate || null,
            item.type || 'Form',
            (item.is_hira || item.isHira) ? 1 : 0,
            (item.remove_filename_restriction || item.removeFilenameRestriction) ? 1 : 0,
            allowedTypesStr,
            item.template_file_name || null,
            sortOrder++
          ]
        );
      }

      await logAudit(
        req.user.id,
        req.user.username,
        existing.length > 0 ? 'UPDATE_SMS_ORDER' : 'CREATE_SMS_ORDER',
        `${existing.length > 0 ? 'Updated' : 'Created'} SMS Order: "${label}" (ID: ${orderId}) for ${vessels.length} vessel(s)`
      );

      res.json({ success: true, id: orderId });
    } catch (e: any) {
      console.error('Error saving SMS order:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/sms/orders/:id', authenticate, async (req: any, res) => {
    if (req.user.role === 'vessel') {
      return res.status(403).json({ error: 'Vessel users cannot delete order lists' });
    }
    const { id } = req.params;
    try {
      await pool.execute('UPDATE sms_orders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      await pool.execute('UPDATE sms_order_vessels SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ?', [id]);
      await pool.execute('UPDATE sms_order_items SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ?', [id]);
      await pool.execute('UPDATE sms_order_uploads SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ?', [id]);

      await logAudit(req.user.id, req.user.username, 'DELETE_SMS_ORDER', `Deleted SMS order list ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Error deleting SMS order:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/orders/:id/upload', authenticate, upload.array('files'), async (req: any, res) => {
    const { id: orderId } = req.params;
    const { vessel_id, vessel_name, form_id, form_code, item_id } = req.body;
    const files = (req.files || []) as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    try {
      const [orderRows]: any = await pool.execute('SELECT * FROM sms_orders WHERE id = ? AND deleted_at IS NULL', [orderId]);
      if (orderRows.length === 0) {
        return res.status(404).json({ error: 'SMS Order not found' });
      }
      const order = orderRows[0];

      // Check if multiple files is permitted for this item
      let allowsMultiple = false;
      if (item_id) {
        const [itemRows]: any = await pool.execute(
          'SELECT is_hira, form_code FROM sms_order_items WHERE order_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1',
          [orderId, item_id]
        );
        if (itemRows && itemRows.length > 0) {
          allowsMultiple = Boolean(itemRows[0].is_hira);
        }
      } else if (form_id || form_code) {
        const [itemRows]: any = await pool.execute(
          'SELECT is_hira, form_code FROM sms_order_items WHERE order_id = ? AND (form_id = ? OR form_code = ?) AND deleted_at IS NULL LIMIT 1',
          [orderId, form_id || '', form_code || '']
        );
        if (itemRows && itemRows.length > 0) {
          allowsMultiple = Boolean(itemRows[0].is_hira);
        }
      }

      if (!allowsMultiple && files.length > 1) {
        return res.status(400).json({
          error: `Multiple files are not allowed for form "${form_code || 'selected requirement'}" because Multiple Files is not enabled. Please upload only 1 file.`
        });
      }

      const targetVesselId = String(vessel_id || req.user?.vessel_id || '');
      const targetVesselName = vessel_name || req.user?.username || 'Vessel';

      // If single file requirement, replace any existing active file for this requirement
      if (!allowsMultiple && (item_id || form_id || form_code)) {
        if (item_id) {
          await pool.execute(
            'UPDATE sms_order_uploads SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?) AND item_id = ? AND deleted_at IS NULL',
            [orderId, targetVesselId, targetVesselName, item_id]
          );
        } else if (form_id) {
          await pool.execute(
            'UPDATE sms_order_uploads SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?) AND form_id = ? AND deleted_at IS NULL',
            [orderId, targetVesselId, targetVesselName, String(form_id)]
          );
        } else {
          await pool.execute(
            'UPDATE sms_order_uploads SET deleted_at = CURRENT_TIMESTAMP WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?) AND form_code = ? AND deleted_at IS NULL',
            [orderId, targetVesselId, targetVesselName, String(form_code)]
          );
        }
      }

      const sanitize = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const vNameClean = sanitize(targetVesselName);
      const folderName = `${sanitize(order.label)}_${vNameClean}_${sanitize(order.deadline_date)}`;
      const typeSlug = `sms_orders/${folderName}`;

      const uploadedResults = [];

      for (const file of files) {
        const uploadData = await handleFileUpload(file.originalname, file.mimetype, file.buffer, typeSlug);
        const fileSizeStr = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${(file.size / 1024).toFixed(0)} KB`;

        const [insertResult]: any = await pool.execute(
          `INSERT INTO sms_order_uploads (order_id, vessel_id, vessel_name, form_id, form_code, item_id, file_name, file_size, file_mimetype, file_data, b2_folder_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            targetVesselId,
            targetVesselName,
            form_id || '',
            form_code || '',
            item_id || null,
            file.originalname,
            fileSizeStr,
            file.mimetype,
            uploadData,
            folderName,
            req.user?.username || 'Vessel User'
          ]
        );

        uploadedResults.push({
          id: insertResult.insertId,
          fileName: file.originalname,
          fileSize: fileSizeStr,
          folderName
        });
      }

      // Re-evaluate completion status for this vessel
      const [orderItemsRows]: any = await pool.execute(
        'SELECT id, form_id, form_code, description FROM sms_order_items WHERE order_id = ? AND deleted_at IS NULL',
        [orderId]
      );
      const [orderUploadsRows]: any = await pool.execute(
        'SELECT id, form_id, form_code, item_id, file_name, vessel_id, vessel_name FROM sms_order_uploads WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?) AND deleted_at IS NULL',
        [orderId, targetVesselId, targetVesselName]
      );

      const requiredCount = orderItemsRows.length;
      const doneCount = orderItemsRows.filter((item: any) => {
        return orderUploadsRows.some((u: any) => checkFormUploadMatch(u, item));
      }).length;

      if (requiredCount > 0 && doneCount >= requiredCount) {
        await pool.execute(
          'UPDATE sms_order_vessels SET status = "Completed", completed_at = CURRENT_TIMESTAMP WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?)',
          [orderId, targetVesselId, targetVesselName]
        );
      } else {
        await pool.execute(
          'UPDATE sms_order_vessels SET status = "Pending", completed_at = NULL WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?)',
          [orderId, targetVesselId, targetVesselName]
        );
      }

      await logAudit(
        req.user.id,
        req.user.username,
        'UPLOAD_SMS_ORDER_FILE',
        `Uploaded ${files.length} file(s) for Order "${order.label}" (${form_code || 'General'}) by ${vessel_name || 'Vessel'}`
      );

      res.json({
        success: true,
        uploadedCount: files.length,
        results: uploadedResults,
        isCompleted: requiredCount > 0 && doneCount >= requiredCount
      });
    } catch (e: any) {
      console.error('Error uploading files for SMS Order:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/orders/without-order', authenticate, upload.array('files'), async (req: any, res) => {
    const { vessel_id, vessel_name, label, instructions, category, form_code, form_id } = req.body;
    const files = (req.files || []) as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files selected for upload.' });
    }

    try {
      const isVessel = req.user.role === 'vessel';
      const targetVesselId = String(vessel_id || req.user?.vessel_id || (isVessel ? req.user?.id : 'v1'));
      const targetVesselName = vessel_name || (isVessel ? req.user?.username : 'Vessel');

      // Create an order ID
      const orderId = `ord_direct_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const nowStr = new Date().toISOString().slice(0, 10);
      const submissionLabel = label && label.trim() 
        ? label.trim() 
        : `Direct Submission - ${targetVesselName} (${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`;
      const submissionInstructions = instructions && instructions.trim()
        ? instructions.trim()
        : 'Submitted directly by vessel without a prior company order.';

      // Insert Order
      await pool.execute(
        `INSERT INTO sms_orders (id, label, deadline_date, instructions, created_by_id, created_by_name) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          submissionLabel,
          nowStr,
          submissionInstructions,
          String(req.user?.id || 'vessel'),
          req.user?.username || targetVesselName
        ]
      );

      // Insert Order Vessel (marked Completed immediately)
      await pool.execute(
        `INSERT INTO sms_order_vessels (order_id, vessel_id, vessel_name, status, completed_at) VALUES (?, ?, ?, 'Completed', CURRENT_TIMESTAMP)`,
        [orderId, targetVesselId, targetVesselName]
      );

      // Load active forms from catalog for metadata matching
      const [allForms]: any = await pool.query('SELECT id, formCode, category, description, type, isHira, removeFilenameRestriction, allowedFileTypes FROM sms_forms WHERE deleted_at IS NULL');
      const formByCodeMap = new Map<string, any>();
      const formByIdMap = new Map<string, any>();
      allForms.forEach((f: any) => {
        if (f.formCode) formByCodeMap.set(f.formCode.toLowerCase(), f);
        if (f.id) formByIdMap.set(String(f.id), f);
      });

      const sanitize = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const vNameClean = sanitize(targetVesselName);
      const folderName = `${sanitize(submissionLabel)}_${vNameClean}_${sanitize(nowStr)}`;
      const typeSlug = `sms_orders/${folderName}`;

      const uploadedResults = [];
      const createdItemFormIds = new Set<string>();

      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        let fileFormCode = form_code || '';
        let fileFormId = form_id || '';
        let fileCategory = category || 'General / Ad-hoc';
        let fileDesc = 'Directly submitted document';
        let fileType = 'Form';

        // If not explicitly provided, try to match by filename prefix
        if (!fileFormCode) {
          const lowerName = file.originalname.toLowerCase();
          for (const form of allForms) {
            if (form.formCode && (lowerName.startsWith(form.formCode.toLowerCase()) || lowerName.includes(form.formCode.toLowerCase()))) {
              fileFormCode = form.formCode;
              fileFormId = String(form.id);
              fileCategory = form.category || fileCategory;
              fileDesc = form.description || fileDesc;
              fileType = form.type || 'Form';
              break;
            }
          }
        } else {
          const matched = formByCodeMap.get(fileFormCode.toLowerCase()) || formByIdMap.get(String(fileFormId));
          if (matched) {
            fileFormId = String(matched.id);
            fileCategory = matched.category || fileCategory;
            fileDesc = matched.description || fileDesc;
            fileType = matched.type || 'Form';
          }
        }

        if (!fileFormCode) {
          fileFormCode = 'ADHOC-' + (idx + 1);
          fileFormId = 'adhoc_' + (idx + 1);
        }

        // Insert item record if not already created for this order
        const itemKey = `${fileFormId}_${fileFormCode}`;
        if (!createdItemFormIds.has(itemKey)) {
          createdItemFormIds.add(itemKey);
          await pool.execute(
            `INSERT INTO sms_order_items (order_id, form_id, form_code, category, description, type, is_hira, remove_filename_restriction, sort_order) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)`,
            [orderId, fileFormId, fileFormCode, fileCategory, fileDesc, fileType, idx + 1]
          );
        }

        const uploadData = await handleFileUpload(file.originalname, file.mimetype, file.buffer, typeSlug);
        const fileSizeStr = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${(file.size / 1024).toFixed(0)} KB`;

        const [insertResult]: any = await pool.execute(
          `INSERT INTO sms_order_uploads (order_id, vessel_id, vessel_name, form_id, form_code, file_name, file_size, file_mimetype, file_data, b2_folder_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            targetVesselId,
            targetVesselName,
            fileFormId,
            fileFormCode,
            file.originalname,
            fileSizeStr,
            file.mimetype,
            uploadData,
            folderName,
            req.user?.username || targetVesselName
          ]
        );

        uploadedResults.push({
          id: insertResult.insertId,
          fileName: file.originalname,
          fileSize: fileSizeStr,
          formCode: fileFormCode,
          folderName
        });
      }

      await logAudit(
        req.user.id,
        req.user.username,
        'UPLOAD_SMS_WITHOUT_ORDER',
        `Direct upload of ${files.length} file(s) without order by ${targetVesselName} ("${submissionLabel}")`
      );

      res.json({
        success: true,
        orderId,
        label: submissionLabel,
        uploadedCount: files.length,
        results: uploadedResults
      });
    } catch (e: any) {
      console.error('Error in direct SMS upload without order:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/orders/download-upload/:uploadId', authenticate, async (req: any, res) => {
    try {
      const { uploadId } = req.params;
      const [rows]: any = await pool.execute(
        'SELECT vessel_id, vessel_name, file_name, file_mimetype, file_data FROM sms_order_uploads WHERE id = ? AND deleted_at IS NULL',
        [uploadId]
      );
      if (rows.length === 0 || !rows[0].file_data) {
        return res.status(404).json({ error: 'Uploaded file not found' });
      }
      const row = rows[0];
      if (req.user.role === 'vessel') {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        const isMatch = checkVesselMatch(row.vessel_id, row.vessel_name, idInfo.vesselId, idInfo.vesselName, req.user.username);
        if (!isMatch) {
          return res.status(403).json({ error: 'Access denied: You cannot download files submitted by other vessels.' });
        }
      }
      const retrievedBuffer = await handleFileRetrieve(row.file_data);
      res.setHeader('Content-Type', row.file_mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.file_name)}"`);
      res.send(retrievedBuffer);
    } catch (e: any) {
      console.error('Error downloading SMS order file:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/orders/view-upload/:uploadId', authenticate, async (req: any, res) => {
    try {
      const { uploadId } = req.params;
      const [rows]: any = await pool.execute(
        'SELECT vessel_id, vessel_name, file_name, file_mimetype, file_data FROM sms_order_uploads WHERE id = ? AND deleted_at IS NULL',
        [uploadId]
      );
      if (rows.length === 0 || !rows[0].file_data) {
        return res.status(404).json({ error: 'Uploaded file not found' });
      }
      const row = rows[0];
      if (req.user.role === 'vessel') {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        const isMatch = checkVesselMatch(row.vessel_id, row.vessel_name, idInfo.vesselId, idInfo.vesselName, req.user.username);
        if (!isMatch) {
          return res.status(403).json({ error: 'Access denied: You cannot view files submitted by other vessels.' });
        }
      }
      const retrievedBuffer = await handleFileRetrieve(row.file_data);
      res.setHeader('Content-Type', row.file_mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name)}"`);
      res.send(retrievedBuffer);
    } catch (e: any) {
      console.error('Error viewing SMS order file:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/orders/:id/download-zip', authenticate, async (req: any, res) => {
    try {
      const { id: orderId } = req.params;
      const vesselId = req.query.vessel_id;

      const [orderRows]: any = await pool.execute('SELECT * FROM sms_orders WHERE id = ? AND deleted_at IS NULL', [orderId]);
      if (orderRows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      const order = orderRows[0];

      let query = 'SELECT id, vessel_name, form_code, file_name, file_data FROM sms_order_uploads WHERE order_id = ? AND deleted_at IS NULL';
      let params = [orderId];
      if (vesselId) {
        query += ' AND vessel_id = ?';
        params.push(String(vesselId));
      }

      let [uploads]: any = await pool.execute(query, params);
      if (req.user.role === 'vessel') {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        uploads = uploads.filter((u: any) =>
          checkVesselMatch(u.vessel_id, u.vessel_name, idInfo.vesselId, idInfo.vesselName, req.user.username)
        );
      }
      if (uploads.length === 0) {
        return res.status(404).json({ error: 'No files have been uploaded yet for your vessel in this order.' });
      }

      const zip = new JSZip();
      for (const up of uploads) {
        try {
          const fileBuf = await handleFileRetrieve(up.file_data);
          const sanitize = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const vFolder = sanitize(up.vessel_name || 'Vessel');
          zip.folder(vFolder)?.file(up.file_name, fileBuf);
        } catch (err: any) {
          console.error(`Failed to pack file ${up.file_name} into ZIP:`, err.message);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const safeLabel = String(order.label || 'SMS_Order').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeLabel}_Uploads.zip"`);
      res.send(zipBuffer);
    } catch (e: any) {
      console.error('Error generating ZIP for SMS order:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/orders/:id/download-templates-zip', authenticate, async (req: any, res) => {
    try {
      const { id: orderId } = req.params;

      const [orderRows]: any = await pool.execute('SELECT * FROM sms_orders WHERE id = ? AND deleted_at IS NULL', [orderId]);
      if (orderRows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      const order = orderRows[0];

      const [items]: any = await pool.execute(
        'SELECT form_id, form_code, category, description, template_file_name FROM sms_order_items WHERE order_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, id ASC',
        [orderId]
      );

      if (items.length === 0) {
        return res.status(404).json({ error: 'No form items found for this order.' });
      }

      const zip = new JSZip();
      const usedFileNames = new Set<string>();
      let packedCount = 0;

      const getUniqueZipFileName = (preferredName: string, fallbackCode: string): string => {
        let cleanName = preferredName ? preferredName.trim() : `${fallbackCode}_Template`;
        if (!usedFileNames.has(cleanName)) {
          usedFileNames.add(cleanName);
          return cleanName;
        }

        const lastDot = cleanName.lastIndexOf('.');
        const base = lastDot !== -1 ? cleanName.substring(0, lastDot) : cleanName;
        const ext = lastDot !== -1 ? cleanName.substring(lastDot) : '';

        let candidate = `${base}_${fallbackCode}${ext}`;
        let counter = 1;
        while (usedFileNames.has(candidate)) {
          candidate = `${base}_${fallbackCode}_${counter}${ext}`;
          counter++;
        }
        usedFileNames.add(candidate);
        return candidate;
      };

      const fileEntries: { filename: string; buffer: Buffer }[] = [];

      await Promise.all(
        items.map(async (item: any) => {
          try {
            const cleanFormId = (item.form_id || '').trim();
            const cleanCode = (item.form_code || '').trim();
            const cleanDesc = (item.description || '').trim();

            let fRows: any = [];
            if (cleanFormId) {
              const [rows]: any = await pool.execute(
                'SELECT id, formCode, description, template_file_name, template_file_data, template_files FROM sms_forms WHERE id = ? AND deleted_at IS NULL',
                [cleanFormId]
              );
              fRows = rows;
            }

            if ((!fRows || fRows.length === 0) && cleanCode && cleanDesc) {
              const [rows]: any = await pool.execute(
                'SELECT id, formCode, description, template_file_name, template_file_data, template_files FROM sms_forms WHERE (formCode = ? OR TRIM(formCode) = ?) AND description = ? AND deleted_at IS NULL',
                [cleanCode, cleanCode, cleanDesc]
              );
              fRows = rows;
            }

            if ((!fRows || fRows.length === 0) && cleanCode) {
              const [rows]: any = await pool.execute(
                'SELECT id, formCode, description, template_file_name, template_file_data, template_files FROM sms_forms WHERE (formCode = ? OR TRIM(formCode) = ?) AND deleted_at IS NULL',
                [cleanCode, cleanCode]
              );
              fRows = rows;
            }

            let hasCustomFile = false;
            if (fRows && fRows.length > 0) {
              const formObj = fRows[0];

              if (formObj.template_files) {
                let tFiles: any[] = [];
                try {
                  tFiles = typeof formObj.template_files === 'string' ? JSON.parse(formObj.template_files) : (formObj.template_files || []);
                } catch (e) {
                  tFiles = [];
                }

                await Promise.all(
                  tFiles.map(async (tf: any) => {
                    if (tf && tf.data) {
                      try {
                        let str = String(tf.data);
                        let buf: Buffer;
                        if (str.startsWith('B2_KEY:')) {
                          buf = await handleFileRetrieve(Buffer.from(str));
                        } else if (str.startsWith('data:')) {
                          const base64Part = str.split(',')[1] || str;
                          buf = Buffer.from(base64Part, 'base64');
                        } else {
                          buf = Buffer.from(str, 'base64');
                        }
                        const rawName = tf.name || `${cleanCode || formObj.formCode}_Template`;
                        fileEntries.push({ filename: rawName, buffer: buf });
                        hasCustomFile = true;
                      } catch (tfErr: any) {
                        console.warn(`Could not retrieve template file ${tf.name}:`, tfErr.message);
                      }
                    }
                  })
                );
              }

              if (!hasCustomFile && formObj.template_file_data) {
                try {
                  const rawDataForBuffer = formObj.template_file_data;
                  let fileBuf: Buffer;
                  if (Buffer.isBuffer(rawDataForBuffer) && rawDataForBuffer.length > 7 && rawDataForBuffer.toString('utf8', 0, 7) === 'B2_KEY:') {
                    fileBuf = await handleFileRetrieve(rawDataForBuffer);
                  } else {
                    let str = Buffer.isBuffer(rawDataForBuffer) ? rawDataForBuffer.toString('utf-8') : String(rawDataForBuffer);
                    if (str.startsWith('B2_KEY:')) {
                      fileBuf = await handleFileRetrieve(Buffer.from(str));
                    } else if (str.startsWith('data:')) {
                      const base64Part = str.split(',')[1] || str;
                      fileBuf = Buffer.from(base64Part, 'base64');
                    } else {
                      fileBuf = Buffer.isBuffer(rawDataForBuffer) ? rawDataForBuffer : Buffer.from(rawDataForBuffer, 'base64');
                    }
                  }

                  let rawName = formObj.template_file_name || `${cleanCode || formObj.formCode}_Template`;

                  // Special fix if template_file_name was misnamed (e.g. COMI-SM-1-16 having COMI-SM-1-6)
                  if (cleanCode === 'COMI-SM-1-16' && (rawName.includes('COMI-SM-1-6') || !rawName.includes('1-16'))) {
                    rawName = 'COMI-SM-1-16 Purifier Report (Self ejector) (22 May 2026).doc';
                  }

                  fileEntries.push({ filename: rawName, buffer: fileBuf });
                  hasCustomFile = true;
                } catch (dataErr: any) {
                  console.warn(`Could not retrieve template data for ${cleanCode}:`, dataErr.message);
                }
              }
            }

            if (!hasCustomFile) {
              const readme = `SMS FORM TEMPLATE / SPECIFICATION\n=================================\n\nOrder: ${order.label}\nForm Code: ${cleanCode || item.form_code}\nCategory: ${item.category || 'SMS Form'}\nDescription: ${item.description || 'Checklist / Form'}\n\nPlease complete your official vessel report adhering to this requirement.\n`;
              fileEntries.push({
                filename: `${cleanCode || item.form_code}_Specification.txt`,
                buffer: Buffer.from(readme, 'utf-8')
              });
            }
          } catch (itemErr: any) {
            console.error(`Failed packing template for ${item.form_code}:`, itemErr.message);
          }
        })
      );

      for (const entry of fileEntries) {
        const uniqueName = getUniqueZipFileName(entry.filename, 'Form');
        zip.file(uniqueName, entry.buffer);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const safeLabel = String(order.label || 'SMS_Order').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeLabel}_Form_Templates.zip"`);
      res.send(zipBuffer);
    } catch (e: any) {
      console.error('Error generating templates ZIP for SMS order:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/sms/orders/upload/:uploadId', authenticate, async (req: any, res) => {
    try {
      const { uploadId } = req.params;
      const [rows]: any = await pool.execute('SELECT order_id, vessel_id, vessel_name, file_name FROM sms_order_uploads WHERE id = ?', [uploadId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Upload not found' });
      }
      const item = rows[0];
      if (req.user.role === 'vessel') {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        const isMatch = checkVesselMatch(item.vessel_id, item.vessel_name, idInfo.vesselId, idInfo.vesselName, req.user.username);
        if (!isMatch) {
          return res.status(403).json({ error: 'Access denied: You cannot delete uploads belonging to other vessels.' });
        }
      }

      await pool.execute('UPDATE sms_order_uploads SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [uploadId]);

      // Re-evaluate completion status
      const [orderItemsRows]: any = await pool.execute(
        'SELECT id, form_id, form_code, description FROM sms_order_items WHERE order_id = ? AND deleted_at IS NULL',
        [item.order_id]
      );
      const [orderUploadsRows]: any = await pool.execute(
        'SELECT id, form_id, form_code, item_id, file_name, vessel_id, vessel_name FROM sms_order_uploads WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?) AND deleted_at IS NULL',
        [item.order_id, item.vessel_id, item.vessel_name]
      );

      const requiredCount = orderItemsRows.length;
      const doneCount = orderItemsRows.filter((it: any) => {
        return orderUploadsRows.some((u: any) => checkFormUploadMatch(u, it));
      }).length;

      if (doneCount < requiredCount) {
        await pool.execute(
          'UPDATE sms_order_vessels SET status = "Pending", completed_at = NULL WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?)',
          [item.order_id, item.vessel_id, item.vessel_name]
        );
      } else if (requiredCount > 0 && doneCount >= requiredCount) {
        await pool.execute(
          'UPDATE sms_order_vessels SET status = "Completed", completed_at = CURRENT_TIMESTAMP WHERE order_id = ? AND (vessel_id = ? OR vessel_name = ?)',
          [item.order_id, item.vessel_id, item.vessel_name]
        );
      }

      await logAudit(req.user.id, req.user.username, 'DELETE_SMS_ORDER_FILE', `Deleted uploaded file: ${item.file_name}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Error deleting SMS order file:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // SMS Order Templates
  app.get('/api/sms/order-reports', authenticate, async (req: any, res) => {
    try {
      const isVessel = req.user.role === 'vessel';
      const currentUserId = String(req.user.id || req.user.username);
      let assignedVesselId: string | null = null;
      let assignedVesselName: string | null = null;

      if (isVessel) {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        assignedVesselId = idInfo.vesselId;
        assignedVesselName = idInfo.vesselName;
      }

      let userReadSet = new Set<number>();
      if (!isVessel) {
        try {
          const [userReads]: any = await pool.query(
            'SELECT upload_id FROM sms_order_upload_reads WHERE user_id = ?',
            [currentUserId]
          );
          userReadSet = new Set<number>(userReads.map((r: any) => r.upload_id));
        } catch (e) {}
      }

      // Fetch all active orders
      const [orders]: any = await pool.query('SELECT * FROM sms_orders WHERE deleted_at IS NULL');
      const orderMap = new Map<string, any>();
      orders.forEach((o: any) => orderMap.set(String(o.id), o));

      // Fetch all active items
      const [items]: any = await pool.query('SELECT * FROM sms_order_items WHERE deleted_at IS NULL');
      const itemMap = new Map<string, any>();
      items.forEach((it: any) => {
        itemMap.set(`${it.order_id}_${it.form_id}`, it);
        if (it.form_code) {
          itemMap.set(`${it.order_id}_${it.form_code}`, it);
        }
      });

      // Fetch all forms
      const [forms]: any = await pool.query('SELECT id, formCode, description, category FROM sms_forms WHERE deleted_at IS NULL');
      const formMap = new Map<string, any>();
      forms.forEach((f: any) => {
        formMap.set(String(f.id), f);
        if (f.formCode) {
          formMap.set(String(f.formCode), f);
        }
      });

      // Fetch vessels
      const [vessels]: any = await pool.query('SELECT v.id, v.name, v.flag, v.type, v.owner, v.team_id, t.name AS team_name FROM vessels v LEFT JOIN teams t ON v.team_id = t.id');
      const vesselMap = new Map<string, any>();
      vessels.forEach((v: any) => {
        vesselMap.set(String(v.id), v);
        if (v.name) {
          vesselMap.set(v.name.toLowerCase().trim(), v);
          const cleanName = v.name.toLowerCase().replace(/^m\/?v\.?\s+/i, '').trim();
          vesselMap.set(cleanName, v);
        }
      });

      // Fetch active uploads
      const [uploads]: any = await pool.execute(
        'SELECT * FROM sms_order_uploads WHERE deleted_at IS NULL ORDER BY uploaded_at DESC'
      );

      const filteredUploads = isVessel
        ? uploads.filter((u: any) =>
            checkVesselMatch(u.vessel_id, u.vessel_name, assignedVesselId, assignedVesselName, req.user.username)
          )
        : uploads;

      const mapped = filteredUploads.map((u: any) => {
        const order = orderMap.get(String(u.order_id)) || {};
        const item = itemMap.get(`${u.order_id}_${u.form_id}`) || itemMap.get(`${u.order_id}_${u.form_code}`) || {};
        const form = formMap.get(String(u.form_id)) || formMap.get(String(u.form_code)) || {};
        
        const cleanVesselName = (u.vessel_name || '').toLowerCase().replace(/^m\/?v\.?\s+/i, '').trim();
        const vessel = vesselMap.get(String(u.vessel_id)) || vesselMap.get((u.vessel_name || '').toLowerCase().trim()) || vesselMap.get(cleanVesselName) || {};

        const isRead = isVessel ? true : userReadSet.has(u.id);

        return {
          id: u.id,
          orderId: u.order_id,
          orderLabel: order.label || 'SMS Order',
          orderDeadline: order.deadline_date || '',
          orderInstructions: order.instructions || '',
          vesselId: u.vessel_id || vessel.id || '',
          vesselName: u.vessel_name || vessel.name || 'Vessel',
          vesselFlag: vessel.flag || null,
          vesselType: vessel.type || null,
          vesselOwner: vessel.owner || null,
          vesselTeamName: vessel.team_name || null,
          formId: u.form_id || item.form_id || form.id || '',
          formCode: u.form_code || item.form_code || form.formCode || '',
          formDescription: item.description || form.description || u.form_code || u.file_name || 'Safety Report',
          category: item.category || form.category || '1. Monthly',
          type: item.type || 'Form',
          isHira: Boolean(item.is_hira),
          fileName: u.file_name,
          fileSize: u.file_size,
          fileMimetype: u.file_mimetype,
          uploadedAt: u.uploaded_at,
          uploadedBy: u.uploaded_by,
          checkedAt: u.checked_at,
          checkedBy: u.checked_by,
          isRead
        };
      });

      res.json(mapped);
    } catch (e: any) {
      console.error('Error fetching SMS order reports:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/order-reports/download-batch', authenticate, async (req: any, res) => {
    try {
      const { uploadIds } = req.body;
      if (!uploadIds || !Array.isArray(uploadIds) || uploadIds.length === 0) {
        return res.status(400).json({ error: 'No report upload IDs provided' });
      }

      const placeholders = uploadIds.map(() => '?').join(',');
      let [uploads]: any = await pool.query(
        `SELECT u.id, u.order_id, o.label as order_label, u.vessel_id, u.vessel_name, u.form_code, u.file_name, u.file_data, u.file_mimetype 
         FROM sms_order_uploads u
         LEFT JOIN sms_orders o ON u.order_id = o.id
         WHERE u.id IN (${placeholders}) AND u.deleted_at IS NULL`,
        uploadIds
      );

      if (req.user.role === 'vessel') {
        const idInfo = await getVesselUserIdentity(pool, req.user);
        uploads = uploads.filter((u: any) =>
          checkVesselMatch(u.vessel_id, u.vessel_name, idInfo.vesselId, idInfo.vesselName, req.user.username)
        );
      }

      if (uploads.length === 0) {
        return res.status(404).json({ error: 'No files found for requested IDs' });
      }

      const zip = new JSZip();
      const sanitize = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_');

      for (const up of uploads) {
        try {
          const fileBuf = await handleFileRetrieve(up.file_data);
          const orderFolder = sanitize(up.order_label || 'SMS_Order');
          const vesselFolder = sanitize(up.vessel_name || 'Vessel');
          zip.folder(`${orderFolder}/${vesselFolder}`)?.file(up.file_name, fileBuf);
        } catch (err: any) {
          console.error(`Failed to pack file ${up.file_name}:`, err.message);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const timestamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="SMS_Order_Reports_Batch_${timestamp}.zip"`);
      res.send(zipBuffer);
    } catch (e: any) {
      console.error('Error generating batch ZIP for SMS reports:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sms/order-templates', authenticate, async (req: any, res) => {
    try {
      const [rows]: any = await pool.query('SELECT * FROM sms_order_templates WHERE deleted_at IS NULL ORDER BY created_at DESC');
      const mapped = rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        itemFormIds: r.item_form_ids ? JSON.parse(r.item_form_ids) : [],
        createdBy: r.created_by,
        createdAt: r.created_at
      }));
      res.json(mapped);
    } catch (e: any) {
      console.error('Error fetching SMS order templates:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sms/order-templates', authenticate, async (req: any, res) => {
    if (req.user.role === 'vessel') {
      return res.status(403).json({ error: 'Vessel users cannot manage order templates' });
    }
    const { id, title, description, itemFormIds } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Template title is required' });
    }
    try {
      const tId = id || `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const formIdsStr = JSON.stringify(itemFormIds || []);
      const [existing]: any = await pool.execute('SELECT id FROM sms_order_templates WHERE id = ?', [tId]);

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE sms_order_templates SET title = ?, description = ?, item_form_ids = ?, deleted_at = NULL WHERE id = ?',
          [title, description || '', formIdsStr, tId]
        );
      } else {
        await pool.execute(
          'INSERT INTO sms_order_templates (id, title, description, item_form_ids, created_by) VALUES (?, ?, ?, ?, ?)',
          [tId, title, description || '', formIdsStr, req.user?.username || 'Management']
        );
      }
      res.json({ success: true, id: tId });
    } catch (e: any) {
      console.error('Error saving SMS order template:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/sms/order-templates/:id', authenticate, async (req: any, res) => {
    if (req.user.role === 'vessel') {
      return res.status(403).json({ error: 'Vessel users cannot delete order templates' });
    }
    try {
      await pool.execute('UPDATE sms_order_templates SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Error deleting SMS order template:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Certificate Routes
  app.get('/api/certificates', authenticate, async (req: any, res) => {
    let query = `
      SELECT c.*, 
      DATE_FORMAT(c.expiration_date, '%Y-%m-%d') as expiration_date, 
      DATE_FORMAT(c.date_issued, '%Y-%m-%d') as date_issued,
      v.name as vessel_name, v.owner, t.name as team_name,
      (SELECT COUNT(*) FROM files f WHERE f.certificate_id = c.id AND f.deleted_at IS NULL) > 0 as has_file
      FROM certificates c 
      LEFT JOIN vessels v ON c.vessel_id = v.id
      JOIN teams t ON c.team_id = t.id
      WHERE c.deleted_at IS NULL
    `;
    let params: any[] = [];
    if (req.user.role === 'vessel') {
      query += ` AND c.vessel_id = ? AND c.access_type IN ('vessel', 'any')`;
      params = [req.user.vessel_id];
    } else if (req.user.role === 'user' || req.user.role === 'team_pic') {
      const teamIds = req.user.team_ids || [];
      if (teamIds.length === 0) {
        return res.json([]);
      }
      const placeholders = teamIds.map(() => '?').join(',');
      query += ` AND c.team_id IN (${placeholders}) AND c.access_type IN ('office', 'vessel', 'any')`;
      params = teamIds;
    }
    const [certs] = await pool.execute(query, params);
    res.json(certs);
  });

  app.post('/api/ocr', authenticate, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('OCR error: GEMINI_API_KEY environment variable is not set');
        return res.status(500).json({ error: 'GEMINI_API_KEY secret is not configured. Please add it via Settings > Secrets.' });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const base64Data = req.file.buffer.toString('base64');
      const dataPart = {
        inlineData: {
          data: base64Data,
          mimeType: req.file.mimetype,
        }
      };

      let response = null;
      let retries = 3;
      let delayMs = 1500;
      let lastError: any = null;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.0-flash",
            contents: {
              parts: [
                dataPart,
                { text: `You are a high-precision OCR engine. Your task is to extract core certificate metadata and their exact spatial locations.
              
              COORDINATE SYSTEM:
              - Use a 0-1000 normalized coordinate system for "rect".
              - Format: {"ymin": int, "xmin": int, "ymax": int, "xmax": int}
              - 0,0 is TOP-LEFT. 1000,1000 is BOTTOM-RIGHT.
              
              RULES:
              1. The "rect" MUST be a TIGHT bounding box around the SPECIFIC text value extracted.
              2. EXCLUDE labels from the rect (e.g., if the document says "Vessel: MARITIME GOVERNOR", your vessel_name is "MARITIME GOVERNOR" and the rect should ONLY cover "MARITIME GOVERNOR").
              3. For dates, if they are spread across the page, provide the rect that covers the full date string.
              4. If the certificate title (cert_type) is multi-line, the rect should encompass all lines of the title.
              5. Accuracy is paramount. If you are unsure of the exact location, provide your best estimate based on the visual flow.

              FIELDS TO EXTRACT:
              - vessel_name: Name of the ship/vessel.
              - cert_type: Full title of the certificate.
              - certificate_number: The unique ID/No of the document.
              - date_issued: When it was issued (YYYY-MM-DD).
              - expiration_date: When it expires (YYYY-MM-DD).

              Return JSON only.` }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  vessel_name: { type: Type.STRING, nullable: true },
                  vessel_rect: { 
                    type: Type.OBJECT, 
                    properties: {
                      ymin: { type: Type.NUMBER },
                      xmin: { type: Type.NUMBER },
                      ymax: { type: Type.NUMBER },
                      xmax: { type: Type.NUMBER }
                    },
                    description: "Bounding box of the vessel name value", 
                    nullable: true 
                  },
                  cert_type: { type: Type.STRING, nullable: true },
                  cert_type_rect: { 
                    type: Type.OBJECT, 
                    properties: {
                      ymin: { type: Type.NUMBER },
                      xmin: { type: Type.NUMBER },
                      ymax: { type: Type.NUMBER },
                      xmax: { type: Type.NUMBER }
                    },
                    description: "Bounding box of the certificate title", 
                    nullable: true 
                  },
                  certificate_number: { type: Type.STRING, nullable: true },
                  number_rect: { 
                    type: Type.OBJECT, 
                    properties: {
                      ymin: { type: Type.NUMBER },
                      xmin: { type: Type.NUMBER },
                      ymax: { type: Type.NUMBER },
                      xmax: { type: Type.NUMBER }
                    },
                    description: "Bounding box of the certificate number value", 
                    nullable: true 
                  },
                  date_issued: { type: Type.STRING, description: "YYYY-MM-DD", nullable: true },
                  issued_rect: { 
                    type: Type.OBJECT, 
                    properties: {
                      ymin: { type: Type.NUMBER },
                      xmin: { type: Type.NUMBER },
                      ymax: { type: Type.NUMBER },
                      xmax: { type: Type.NUMBER }
                    },
                    description: "Bounding box of the issue date value", 
                    nullable: true 
                  },
                  expiration_date: { type: Type.STRING, description: "YYYY-MM-DD", nullable: true },
                  expiration_rect: { 
                    type: Type.OBJECT, 
                    properties: {
                      ymin: { type: Type.NUMBER },
                      xmin: { type: Type.NUMBER },
                      ymax: { type: Type.NUMBER },
                      xmax: { type: Type.NUMBER }
                    },
                    description: "Bounding box of the expiration date value", 
                    nullable: true 
                  }
                }
              }
            }
          });
          break; // Suceeded!
        } catch (err: any) {
          lastError = err;
          console.warn(`Server-side OCR attempt ${attempt} of ${retries} failed:`, err.message || err);
          if (attempt < retries) {
            await sleep(delayMs);
            delayMs *= 1.5; // Exponential scale
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to contact generative AI model after retries.");
      }

      const text = response.text || '';
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonStr);
      res.json(data);
    } catch (e: any) {
      console.error("Server-side OCR processing failed:", e);
      res.status(500).json({ error: e.message || "Failed to process OCR" });
    }
  });

  app.post('/api/certificates', authenticate, canAddCertificate, upload.single('file'), async (req: any, res) => {
    const { vessel_id, team_id, name, certificate_number, date_issued, expiration_date, access_type } = req.body;
    try {
      if (req.user.role === 'vessel') {
        if (Number(vessel_id) !== req.user.vessel_id) {
          return res.status(403).json({ error: 'Vessel users can only add certificates to their own vessel' });
        }
        if (access_type !== 'vessel') {
          return res.status(403).json({ error: 'Vessel users can only add ship certificates' });
        }
      }

      if (req.user.role === 'team_pic' || req.user.role === 'user') {
        if (team_id && !req.user.team_ids.includes(Number(team_id))) return res.status(403).json({ error: 'Forbidden' });
        if (vessel_id && vessel_id !== 'all') {
          const [vRows]: any = await pool.execute('SELECT team_id FROM vessels WHERE id = ?', [vessel_id]);
          if (vRows.length > 0 && !req.user.team_ids.includes(vRows[0].team_id)) return res.status(403).json({ error: 'Forbidden' });
        }
        if (vessel_id === 'all') return res.status(403).json({ error: 'PIC/Management roles cannot add certificates to all vessels' });
      }
      const finalAccessType = access_type || 'office';
      const finalDateIssued = date_issued || null;
      const finalCertNumber = certificate_number || null;
      
      const saveFile = async (certId: number) => {
        if (req.file) {
          const { file_type } = req.body;
          const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'certificates');
          await pool.execute(
            'INSERT INTO files (certificate_id, filename, original_name, mimetype, file_type, data) VALUES (?, ?, ?, ?, ?, ?)', 
            [certId, req.file.originalname, req.file.originalname, req.file.mimetype, file_type || 'certificate', uploadData]
          );
        }
      };

      if (vessel_id === 'all') {
        const [vessels]: any = await pool.query('SELECT id, team_id FROM vessels');
        for (const v of vessels) {
          const [result]: any = await pool.execute('INSERT INTO certificates (vessel_id, team_id, name, certificate_number, date_issued, expiration_date, access_type) VALUES (?, ?, ?, ?, ?, ?, ?)', [v.id, v.team_id, name, finalCertNumber, finalDateIssued, expiration_date, finalAccessType]);
          await saveFile(result.insertId);
        }
        await logAudit(req.user.id, req.user.username, 'CREATE_CERTIFICATE', `Created certificate: ${name} for ALL vessels`);
      } else if (vessel_id) {
        // Get team_id from vessel if not provided
        let finalTeamId = team_id;
        if (!finalTeamId) {
          const [vRows]: any = await pool.execute('SELECT team_id FROM vessels WHERE id = ?', [vessel_id]);
          if (vRows.length > 0) finalTeamId = vRows[0].team_id;
        }
        const [result]: any = await pool.execute('INSERT INTO certificates (vessel_id, team_id, name, certificate_number, date_issued, expiration_date, access_type) VALUES (?, ?, ?, ?, ?, ?, ?)', [vessel_id, finalTeamId, name, finalCertNumber, finalDateIssued, expiration_date, finalAccessType]);
        await saveFile(result.insertId);
        await logAudit(req.user.id, req.user.username, 'CREATE_CERTIFICATE', `Created certificate: ${name} for vessel ID ${vessel_id}`);
      } else {
        // Non-vessel related
        const [result]: any = await pool.execute('INSERT INTO certificates (vessel_id, team_id, name, certificate_number, date_issued, expiration_date, access_type) VALUES (?, ?, ?, ?, ?, ?, ?)', [null, team_id, name, finalCertNumber, finalDateIssued, expiration_date, finalAccessType]);
        await saveFile(result.insertId);
        await logAudit(req.user.id, req.user.username, 'CREATE_CERTIFICATE', `Created certificate: ${name} for team ID ${team_id}`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/certificates/:id', authenticate, async (req: any, res) => {
    const { name, vessel_id, team_id, expiration_date, date_issued, certificate_number, access_type } = req.body;
    try {
      const [certs]: any = await pool.execute('SELECT * FROM certificates WHERE id = ?', [req.params.id]);
      if (certs.length === 0) return res.status(404).json({ error: 'Certificate not found' });
      const cert = certs[0];

      if (req.user.role === 'admin' || req.user.role === 'team_pic' || req.user.role === 'user') {
        const finalName = name !== undefined ? name : cert.name;
        const finalVesselId = vessel_id !== undefined ? vessel_id : cert.vessel_id;
        const finalExpirationDate = expiration_date !== undefined ? expiration_date : cert.expiration_date;
        const finalDateIssued = date_issued !== undefined ? date_issued : cert.date_issued;
        const finalCertNumber = certificate_number !== undefined ? certificate_number : cert.certificate_number;
        const finalAccessType = access_type !== undefined ? access_type : cert.access_type;
        
        let finalTeamId = team_id !== undefined ? team_id : cert.team_id;
        if (vessel_id && team_id === undefined) {
          const [vRows]: any = await pool.execute('SELECT team_id FROM vessels WHERE id = ?', [vessel_id]);
          if (vRows.length > 0) finalTeamId = vRows[0].team_id;
        }

        await pool.execute('UPDATE certificates SET name = ?, vessel_id = ?, team_id = ?, expiration_date = ?, date_issued = ?, certificate_number = ?, access_type = ? WHERE id = ?', 
          [finalName, finalVesselId || null, finalTeamId, finalExpirationDate, finalDateIssued, finalCertNumber, finalAccessType, req.params.id]);
        await logAudit(req.user.id, req.user.username, 'UPDATE_CERTIFICATE', `Updated certificate ID ${req.params.id}: ${finalName}`);
      } else {
        // Non-admins can update expiration date, date issued, and certificate number
        const finalExpirationDate = expiration_date !== undefined ? expiration_date : cert.expiration_date;
        const finalDateIssued = date_issued !== undefined ? date_issued : cert.date_issued;
        const finalCertNumber = certificate_number !== undefined ? certificate_number : cert.certificate_number;

        if (req.user.role === 'vessel') {
          if (cert.vessel_id !== req.user.vessel_id || !['vessel', 'any'].includes(cert.access_type)) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        } else if (req.user.role === 'user' || req.user.role === 'team_pic') {
          if (!req.user.team_ids.includes(cert.team_id) || !['office', 'vessel', 'any'].includes(cert.access_type)) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        }

        await pool.execute('UPDATE certificates SET expiration_date = ?, date_issued = ?, certificate_number = ? WHERE id = ?', [finalExpirationDate, finalDateIssued, finalCertNumber, req.params.id]);
        await logAudit(req.user.id, req.user.username, 'UPDATE_CERTIFICATE_FIELDS', `Updated fields for certificate: ${cert.name} (ID: ${req.params.id})`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/users/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      // Soft delete notes
      await pool.execute('UPDATE notes SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND deleted_at IS NULL', [req.params.id]);
      await pool.execute('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit((req as any).user.id, (req as any).user.username, 'SOFT_DELETE_USER', `Soft deleted user ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Soft delete user error:', e);
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/certificates/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      const [certRows]: any = await pool.execute('SELECT name, team_id FROM certificates WHERE id = ?', [req.params.id]);
      if (certRows.length === 0) return res.status(404).json({ error: 'Certificate not found' });
      const cert = certRows[0];

      if (req.user.role === 'team_pic' || req.user.role === 'user') {
        if (!req.user.team_ids.includes(cert.team_id)) return res.status(403).json({ error: 'Forbidden' });
      }
      // Soft delete notes and files
      await pool.execute('UPDATE notes SET deleted_at = CURRENT_TIMESTAMP WHERE certificate_id = ? AND deleted_at IS NULL', [req.params.id]);
      await pool.execute('UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE certificate_id = ? AND deleted_at IS NULL', [req.params.id]);
      await pool.execute('UPDATE certificates SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_CERTIFICATE', `Soft deleted certificate: ${cert.name} (ID: ${req.params.id})`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Soft delete certificate error:', e);
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/admin/audit-logs', authenticate, isAdmin, async (req, res) => {
    try {
      const [logs] = await pool.query(`
        SELECT * FROM audit_logs 
        WHERE action NOT LIKE 'DB_SELECT%' 
          AND action NOT LIKE 'DB_SHOW%' 
          AND action NOT LIKE 'DB_SET%' 
          AND action NOT LIKE 'DB_USE%'
          AND action NOT LIKE 'DB_DESCRIBE%'
          AND action NOT LIKE 'DB_EXPLAIN%'
        ORDER BY created_at DESC LIMIT 1000
      `);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Google Docs User Guide Integration
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  app.get('/api/auth/google/url', authenticate, (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in settings.' });
    }

    // Automatically construct redirect URI if not provided
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const url = auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
      const auth = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await auth.getToken(code as string);
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h2 style="color: #1e3a8a; margin-bottom: 0.5rem;">Authentication Successful</h2>
              <p style="color: #64748b;">You can close this window now.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'GOOGLE_AUTH_SUCCESS', 
                    tokens: ${JSON.stringify(tokens)} 
                  }, '*');
                  setTimeout(() => window.close(), 1000);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (e: any) {
      res.status(500).send(`Authentication failed: ${e.message}`);
    }
  });

  app.post('/api/google/generate-guide', authenticate, async (req: any, res) => {
    const { tokens } = req.body;
    if (!tokens) return res.status(400).json({ error: 'Tokens required' });

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials(tokens);
      const docs = google.docs({ version: 'v1', auth });

      const title = `COMOS Vessel Manager - User Guide (${format(new Date(), 'MMM dd, yyyy')})`;
      const doc = await docs.documents.create({
        requestBody: { title }
      });

      const documentId = doc.data.documentId;
      const content = `COMOS Vessel Manager
USER GUIDE

1. OVERVIEW
COMOS (Cleanocean Monitoring System) is a professional vessel certificate management application. It helps ensure compliance by tracking expirations, managing documents, and facilitating communication between the office and the vessel.

2. DASHBOARD
The Dashboard provides a high-level overview of your fleet's compliance status. 
- Analytics: View total vessels, active certificates, and critical alerts.
- Compliance Gauges: Visual indicators of "Safe," "Expiring Soon," and "Critical/Expired" documents.

3. VESSEL LIST
- Filter & Search: Quickly find vessels by name or assigned Team.
- Vessel Health: Color-coded icons show the status of the most critical certificate for each vessel.
- Port Tracking: Real-time tracking of Next Port and ETA for all vessels.

4. CERTIFICATE TRACKING
- Detail View: Click any vessel to see its full list of certificates.
- Statuses: 
  * Blue: Active (valid)
  * Orange: Expiring Soon (30-90 days)
  * Red: Expired or Critical (<30 days)
- Pinned Notes: Use the chat interface within each certificate to log correspondence or specific instructions.

5. COMMUNICATION (CHAT)
- Each certificate features a "Messaging" area. 
- This replaces fragmented email threads, keeping all certificate-related discussion in one auditable place.
- Notes are auto-scrolled to the latest entry to feel like a modern chat app.

6. SLIDESHOW (KIOSK MODE)
- Designed for office displays or bridge monitors.
- Automatically cycles through vessels, highlighting their most critical expiring certificates.
- Images are preloaded for smooth transitions.

7. AUTOMATED EMAIL ALERTS
- The system automatically scans for expiring certificates daily.
- It sends consolidated reports to IT and Team PICs based on the schedule configured in Admin Settings.

8. ADMINISTRATION
- User Roles: 
  * Admin: Full system control.
  * Team PIC: Manages vessels assigned to their team(s).
  * User: Read-only access to office documents.
  * Vessel: Access to certificates for their specific ship only.
- Audit Logs: Track every change made in the system for accountability.

--------------------------------------------------
Generated by COMOS System
`;

      await docs.documents.batchUpdate({
        documentId: documentId!,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content
              }
            }
          ]
        }
      });

      await logAudit(req.user.id, req.user.username, 'GENERATE_GUIDE', `Generated Google Doc User Guide: ${documentId}`);
      res.json({ success: true, documentId, url: `https://docs.google.com/document/d/${documentId}/edit` });
    } catch (e: any) {
      console.error('Failed to generate guide:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Notes Routes
  app.get('/api/certificates/:id/notes', authenticate, async (req, res) => {
    const [notes] = await pool.execute(`
      SELECT n.*, u.username 
      FROM notes n 
      JOIN users u ON n.user_id = u.id 
      WHERE n.certificate_id = ? AND n.deleted_at IS NULL
      ORDER BY n.created_at DESC
    `, [req.params.id]);
    res.json(notes);
  });

  app.post('/api/certificates/:id/notes', authenticate, async (req: any, res) => {
    const { content } = req.body;
    await pool.execute('INSERT INTO notes (certificate_id, user_id, content) VALUES (?, ?, ?)', [req.params.id, req.user.id, content]);
    res.json({ success: true });
  });

  // File Routes
  app.get('/api/certificates/:id/files', authenticate, async (req, res) => {
    const [files] = await pool.execute('SELECT id, certificate_id, filename, original_name, mimetype, file_type, upload_date FROM files WHERE certificate_id = ? AND deleted_at IS NULL', [req.params.id]);
    res.json(files);
  });

  app.post('/api/certificates/:id/files', authenticate, upload.single('file'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { file_type } = req.body;
    try {
      const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'certificates');
      const [insertResult]: any = await pool.execute(
        'INSERT INTO files (certificate_id, filename, original_name, mimetype, file_type, data) VALUES (?, ?, ?, ?, ?, ?)', 
        [req.params.id, req.file.originalname, req.file.originalname, req.file.mimetype, file_type || 'certificate', uploadData]
      );
      await logAudit(req.user.id, req.user.username, 'UPLOAD_FILE', `Uploaded ${file_type || 'certificate'} file: ${req.file.originalname} to certificate ID ${req.params.id}`);
      res.json({ 
        id: insertResult.insertId,
        certificate_id: Number(req.params.id),
        filename: req.file.originalname,
        original_name: req.file.originalname,
        mimetype: req.file.mimetype,
        file_type: file_type || 'certificate',
        upload_date: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('File upload failed:', err);
      res.status(500).json({ error: 'Failed to save file to database' });
    }
  });

  app.get('/api/files/:filename', authenticate, async (req, res) => {
    try {
      // Note: In this new version, we might want to fetch by ID or filename. 
      // Since the old code used filename, we'll try to find by filename first.
      const [files]: any = await pool.execute('SELECT * FROM files WHERE filename = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1', [req.params.filename]);
      
      if (files.length > 0 && files[0].data) {
        const file = files[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        // Add headers to help with PDF preview issues
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'File not found in database' });
      }
    } catch (err: any) {
      console.error('File retrieval failed:', err);
      res.status(500).json({ error: 'Error retrieving file' });
    }
  });

  app.delete('/api/files/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      if (req.user.role === 'team_pic' || req.user.role === 'user') {
        const [files]: any = await pool.execute('SELECT c.team_id FROM files f JOIN certificates c ON f.certificate_id = c.id WHERE f.id = ?', [req.params.id]);
        if (files.length > 0 && !req.user.team_ids.includes(files[0].team_id)) return res.status(403).json({ error: 'Forbidden' });
      }
      // Soft delete from database
      await pool.execute('UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_FILE', `Soft deleted file ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Departure Reports Routes
  app.get('/api/departure-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT dr.*, v.name as vessel_name, da.original_name as attachment_name
        FROM departure_reports dr
        JOIN vessels v ON dr.vessel_id = v.id
        LEFT JOIN departure_attachments da ON dr.attachment_id = da.id
        WHERE dr.deleted_at IS NULL
      `;
      let params: any[] = [];

      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND dr.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }

      query += ' ORDER BY dr.utc_date_time DESC';
      const [reports] = await pool.execute(query, params);
      res.json(reports);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/departure-reports', authenticate, upload.single('report_file'), async (req: any, res) => {
    try {
      let attachmentId = null;
      if (req.file) {
        const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'departure');
        const [result]: any = await pool.execute(
          'INSERT INTO departure_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, uploadData]
        );
        attachmentId = result.insertId;
      }

      const {
        vessel_id,
        voyage_number,
        utc_date_time,
        departure_port,
        eu_uk_status,
        position_long,
        position_lat,
        operation_type,
        cargo_status,
        rob_type,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        rob_fw,
        foc_port_hsfo,
        foc_port_lsfo,
        foc_port_mgo,
        foc_port_mdo
      } = req.body;

      await pool.execute(`
        INSERT INTO departure_reports (
          vessel_id, user_id, voyage_number, utc_date_time, departure_port, eu_uk_status,
          position_long, position_lat, operation_type, cargo_status, rob_type,
          rob_hsfo, rob_lsfo, rob_mgo, rob_mdo, rob_fw,
          foc_port_hsfo, foc_port_lsfo, foc_port_mgo, foc_port_mdo,
          attachment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vessel_id, req.user.id, voyage_number, utc_date_time, departure_port, eu_uk_status,
        position_long, position_lat, operation_type, cargo_status, rob_type,
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0, rob_fw || 0,
        foc_port_hsfo || 0, foc_port_lsfo || 0, foc_port_mgo || 0, foc_port_mdo || 0,
        attachmentId
      ]);

      await logAudit(req.user.id, req.user.username, 'CREATE_DEPARTURE_REPORT', `Created departure report for vessel ID ${vessel_id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to create departure report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/departure-reports/:id', authenticate, upload.single('report_file'), async (req: any, res) => {
    try {
      const { id } = req.params;

      if (req.user.role === 'vessel') {
        const [latest]: any = await pool.execute(`
          SELECT id FROM departure_reports 
          WHERE vessel_id = ? AND deleted_at IS NULL 
          ORDER BY utc_date_time DESC, id DESC LIMIT 1
        `, [req.user.vessel_id]);
        if (latest.length > 0 && latest[0].id !== Number(id)) {
          return res.status(403).json({ error: 'Vessel users can only edit the latest departure report' });
        }

        const [expired]: any = await pool.execute(`
          SELECT id FROM departure_reports 
          WHERE id = ? AND created_at < NOW() - INTERVAL 24 HOUR
        `, [id]);
        if (expired.length > 0) {
          return res.status(403).json({ error: 'Vessel users can only edit or update voyage reports within 24 hours after posting' });
        }
      }

      let attachmentId = req.body.attachment_id || null;

      if (req.file) {
        const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'departure');
        const [result]: any = await pool.execute(
          'INSERT INTO departure_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, uploadData]
        );
        attachmentId = result.insertId;
      }

      const {
        voyage_number,
        utc_date_time,
        departure_port,
        eu_uk_status,
        position_long,
        position_lat,
        operation_type,
        cargo_status,
        rob_type,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        rob_fw,
        foc_port_hsfo,
        foc_port_lsfo,
        foc_port_mgo,
        foc_port_mdo
      } = req.body;

      await pool.execute(`
        UPDATE departure_reports SET
          voyage_number = ?, utc_date_time = ?, departure_port = ?, eu_uk_status = ?,
          position_long = ?, position_lat = ?, operation_type = ?, cargo_status = ?, rob_type = ?,
          rob_hsfo = ?, rob_lsfo = ?, rob_mgo = ?, rob_mdo = ?, rob_fw = ?,
          foc_port_hsfo = ?, foc_port_lsfo = ?, foc_port_mgo = ?, foc_port_mdo = ?,
          attachment_id = ?
        WHERE id = ?
      `, [
        voyage_number, utc_date_time, departure_port, eu_uk_status,
        position_long, position_lat, operation_type, cargo_status, rob_type,
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0, rob_fw || 0,
        foc_port_hsfo || 0, foc_port_lsfo || 0, foc_port_mgo || 0, foc_port_mdo || 0,
        attachmentId, id
      ]);

      await logAudit(req.user.id, req.user.username, 'UPDATE_DEPARTURE_REPORT', `Updated departure report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to update departure report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/departure-attachments/:id', authenticate, async (req, res) => {
    try {
      const [attachments]: any = await pool.execute('SELECT * FROM departure_attachments WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
      if (attachments.length > 0 && attachments[0].data) {
        const file = attachments[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'Attachment not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/arrival-attachments/:id', authenticate, async (req, res) => {
    try {
      const [attachments]: any = await pool.execute('SELECT * FROM arrival_attachments WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
      if (attachments.length > 0 && attachments[0].data) {
        const file = attachments[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'Attachment not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/noon-attachments/:id', authenticate, async (req, res) => {
    try {
      const [attachments]: any = await pool.execute('SELECT * FROM noon_attachments WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
      if (attachments.length > 0 && attachments[0].data) {
        const file = attachments[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'Attachment not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Arrival Reports Routes
  app.get('/api/arrival-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT ar.*, v.name as vessel_name, aa.original_name as attachment_name
        FROM arrival_reports ar
        JOIN vessels v ON ar.vessel_id = v.id
        LEFT JOIN arrival_attachments aa ON ar.attachment_id = aa.id
        WHERE ar.deleted_at IS NULL
      `;
      let params: any[] = [];

      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND ar.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }

      query += ' ORDER BY ar.utc_date_time DESC';
      const [reports] = await pool.execute(query, params);
      res.json(reports);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/arrival-reports', authenticate, upload.single('report_file'), async (req: any, res) => {
    try {
      let attachmentId = null;
      if (req.file) {
        const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'arrival');
        const [result]: any = await pool.execute(
          'INSERT INTO arrival_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, uploadData]
        );
        attachmentId = result.insertId;
      }

      const {
        vessel_id,
        voyage_number,
        utc_date_time,
        arrival_port,
        eu_uk_status,
        position_long,
        position_lat,
        operation_type,
        cargo_status,
        total_time_at_sea,
        total_distance,
        rob_type,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        rob_fw,
        foc_sea_hsfo,
        foc_sea_lsfo,
        foc_sea_mgo,
        foc_sea_mdo,
        agent_detail
      } = req.body;

      await pool.execute(`
        INSERT INTO arrival_reports (
          vessel_id, user_id, voyage_number, utc_date_time, arrival_port, eu_uk_status,
          position_long, position_lat, operation_type, cargo_status,
          total_time_at_sea, total_distance, rob_type,
          rob_hsfo, rob_lsfo, rob_mgo, rob_mdo, rob_fw,
          foc_sea_hsfo, foc_sea_lsfo, foc_sea_mgo, foc_sea_mdo,
          agent_detail, attachment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vessel_id, req.user.id, voyage_number, utc_date_time, arrival_port, eu_uk_status,
        position_long, position_lat, operation_type, cargo_status,
        total_time_at_sea, total_distance, rob_type,
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0, rob_fw || 0,
        foc_sea_hsfo || 0, foc_sea_lsfo || 0, foc_sea_mgo || 0, foc_sea_mdo || 0,
        agent_detail, attachmentId
      ]);

      await logAudit(req.user.id, req.user.username, 'CREATE_ARRIVAL_REPORT', `Created arrival report for vessel ID ${vessel_id}`);
      
      await syncVesselNextPort(vessel_id);

      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to create arrival report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/arrival-reports/:id', authenticate, upload.single('report_file'), async (req: any, res) => {
    try {
      const { id } = req.params;

      if (req.user.role === 'vessel') {
        const [latest]: any = await pool.execute(`
          SELECT id FROM arrival_reports 
          WHERE vessel_id = ? AND deleted_at IS NULL 
          ORDER BY utc_date_time DESC, id DESC LIMIT 1
        `, [req.user.vessel_id]);
        if (latest.length > 0 && latest[0].id !== Number(id)) {
          return res.status(403).json({ error: 'Vessel users can only edit the latest arrival report' });
        }

        const [expired]: any = await pool.execute(`
          SELECT id FROM arrival_reports 
          WHERE id = ? AND created_at < NOW() - INTERVAL 24 HOUR
        `, [id]);
        if (expired.length > 0) {
          return res.status(403).json({ error: 'Vessel users can only edit or update voyage reports within 24 hours after posting' });
        }
      }

      let attachmentId = req.body.attachment_id || null;

      if (req.file) {
        const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'arrival');
        const [result]: any = await pool.execute(
          'INSERT INTO arrival_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, uploadData]
        );
        attachmentId = result.insertId;
      }

      const {
        voyage_number,
        utc_date_time,
        arrival_port,
        eu_uk_status,
        position_long,
        position_lat,
        operation_type,
        cargo_status,
        total_time_at_sea,
        total_distance,
        rob_type,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        rob_fw,
        foc_sea_hsfo,
        foc_sea_lsfo,
        foc_sea_mgo,
        foc_sea_mdo,
        agent_detail
      } = req.body;

      await pool.execute(`
        UPDATE arrival_reports SET
          voyage_number = ?, utc_date_time = ?, arrival_port = ?, eu_uk_status = ?,
          position_long = ?, position_lat = ?, operation_type = ?, cargo_status = ?,
          total_time_at_sea = ?, total_distance = ?, rob_type = ?,
          rob_hsfo = ?, rob_lsfo = ?, rob_mgo = ?, rob_mdo = ?, rob_fw = ?,
          foc_sea_hsfo = ?, foc_sea_lsfo = ?, foc_sea_mgo = ?, foc_sea_mdo = ?,
          agent_detail = ?, attachment_id = ?
        WHERE id = ?
      `, [
        voyage_number, utc_date_time, arrival_port, eu_uk_status,
        position_long, position_lat, operation_type, cargo_status,
        total_time_at_sea, total_distance, rob_type,
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0, rob_fw || 0,
        foc_sea_hsfo || 0, foc_sea_lsfo || 0, foc_sea_mgo || 0, foc_sea_mdo || 0,
        agent_detail, attachmentId, id
      ]);

      await logAudit(req.user.id, req.user.username, 'UPDATE_ARRIVAL_REPORT', `Updated arrival report ID ${id}`);
      
      const [reportRows]: any = await pool.execute('SELECT vessel_id FROM arrival_reports WHERE id = ?', [id]);
      if (reportRows.length > 0) {
        await syncVesselNextPort(reportRows[0].vessel_id);
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to update arrival report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Noon Reports Routes
  app.get('/api/noon-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT nr.*, v.name as vessel_name, na.original_name as attachment_name
        FROM noon_reports nr
        JOIN vessels v ON nr.vessel_id = v.id
        LEFT JOIN noon_attachments na ON nr.attachment_id = na.id
        WHERE nr.deleted_at IS NULL
      `;
      let params: any[] = [];

      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND nr.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }

      query += ' ORDER BY nr.utc_date_time DESC';
      const [reports] = await pool.execute(query, params);
      res.json(reports);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/noon-reports', authenticate, upload.single('report_file'), async (req: any, res) => {
    try {
      console.log('Received noon report submission:', req.body);
      const {
        vessel_id,
        voyage_number,
        utc_date_time,
        position_long,
        position_lat,
        distance_to_go,
        cargo_status,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        foc_hsfo,
        foc_lsfo,
        foc_mgo,
        foc_mdo,
        weather_notation,
        swell_scale_21,
        wind_scale,
        wave_scale,
        weather_image,
        remarks,
        destination_port,
        eta_utc,
        agent_details,
        charterer_min_hsfo,
        charterer_max_hsfo,
        charterer_min_lsfo,
        charterer_max_lsfo,
        charterer_min_mgo,
        charterer_max_mgo,
        charterer_min_mdo,
        charterer_max_mdo
      } = req.body;

      if (!vessel_id) {
        return res.status(400).json({ error: 'Vessel ID is required' });
      }

      // Fetch vessel's current thresholds as fallback/default
      const [vesselRows]: any = await pool.execute(
        'SELECT charterer_min_hsfo, charterer_max_hsfo, charterer_min_lsfo, charterer_max_lsfo, charterer_min_mgo, charterer_max_mgo, charterer_min_mdo, charterer_max_mdo FROM vessels WHERE id = ?',
        [vessel_id]
      );
      let vMinHsfo = null, vMaxHsfo = null, vMinLsfo = null, vMaxLsfo = null, vMinMgo = null, vMaxMgo = null, vMinMdo = null, vMaxMdo = null;
      if (vesselRows.length > 0) {
        vMinHsfo = vesselRows[0].charterer_min_hsfo;
        vMaxHsfo = vesselRows[0].charterer_max_hsfo;
        vMinLsfo = vesselRows[0].charterer_min_lsfo;
        vMaxLsfo = vesselRows[0].charterer_max_lsfo;
        vMinMgo = vesselRows[0].charterer_min_mgo;
        vMaxMgo = vesselRows[0].charterer_max_mgo;
        vMinMdo = vesselRows[0].charterer_min_mdo;
        vMaxMdo = vesselRows[0].charterer_max_mdo;
      }

      const isAuthorized = req.user.role === 'admin' || req.user.role === 'team_pic' || req.user.role === 'user';
      const cMinHsfo = isAuthorized ? (charterer_min_hsfo || vMinHsfo) : vMinHsfo;
      const cMaxHsfo = isAuthorized ? (charterer_max_hsfo || vMaxHsfo) : vMaxHsfo;
      const cMinLsfo = isAuthorized ? (charterer_min_lsfo || vMinLsfo) : vMinLsfo;
      const cMaxLsfo = isAuthorized ? (charterer_max_lsfo || vMaxLsfo) : vMaxLsfo;
      const cMinMgo = isAuthorized ? (charterer_min_mgo || vMinMgo) : vMinMgo;
      const cMaxMgo = isAuthorized ? (charterer_max_mgo || vMaxMgo) : vMaxMgo;
      const cMinMdo = isAuthorized ? (charterer_min_mdo || vMinMdo) : vMinMdo;
      const cMaxMdo = isAuthorized ? (charterer_max_mdo || vMaxMdo) : vMaxMdo;

      let attachmentId = null;
      if (req.file) {
        console.log('Processing attachment for noon report:', req.file.originalname);
        const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'noon');
        const [result]: any = await pool.execute(
          'INSERT INTO noon_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, uploadData]
        );
        attachmentId = result.insertId;
      }

      await pool.execute(`
        INSERT INTO noon_reports (
          vessel_id, user_id, voyage_number, utc_date_time, position_long, position_lat,
          distance_to_go, cargo_status, rob_hsfo, rob_lsfo, rob_mgo, rob_mdo,
          foc_hsfo, foc_lsfo, foc_mgo, foc_mdo, attachment_id,
          weather_notation, swell_scale_21, wind_scale, wave_scale, weather_image, remarks,
          destination_port, eta_utc, agent_details,
          charterer_min_hsfo, charterer_max_hsfo, charterer_min_lsfo, charterer_max_lsfo,
          charterer_min_mgo, charterer_max_mgo, charterer_min_mdo, charterer_max_mdo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vessel_id, req.user.id, voyage_number, utc_date_time, position_long, position_lat,
        distance_to_go, cargo_status, 
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0,
        foc_hsfo || 0, foc_lsfo || 0, foc_mgo || 0, foc_mdo || 0,
        attachmentId,
        weather_notation || null, swell_scale_21 || null, wind_scale || null, wave_scale || null, weather_image || null,
        remarks || null,
        destination_port || null, eta_utc && eta_utc.trim() !== '' ? eta_utc : null, agent_details || null,
        cMinHsfo, cMaxHsfo, cMinLsfo, cMaxLsfo,
        cMinMgo, cMaxMgo, cMinMdo, cMaxMdo
      ]);

      await logAudit(req.user.id, req.user.username, 'CREATE_NOON_REPORT', `Created noon report for vessel ID ${vessel_id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to create noon report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/noon-reports/:id', authenticate, upload.single('report_file'), async (req: any, res) => {
    try {
      const { id } = req.params;

      if (req.user.role === 'vessel') {
        const [latest]: any = await pool.execute(`
          SELECT id FROM noon_reports 
          WHERE vessel_id = ? AND deleted_at IS NULL 
          ORDER BY utc_date_time DESC, id DESC LIMIT 1
        `, [req.user.vessel_id]);
        if (latest.length > 0 && latest[0].id !== Number(id)) {
          return res.status(403).json({ error: 'Vessel users can only edit the latest noon report' });
        }

        const [expired]: any = await pool.execute(`
          SELECT id FROM noon_reports 
          WHERE id = ? AND created_at < NOW() - INTERVAL 24 HOUR
        `, [id]);
        if (expired.length > 0) {
          return res.status(403).json({ error: 'Vessel users can only edit or update voyage reports within 24 hours after posting' });
        }
      }

      const {
        voyage_number,
        utc_date_time,
        position_long,
        position_lat,
        distance_to_go,
        cargo_status,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        foc_hsfo,
        foc_lsfo,
        foc_mgo,
        foc_mdo,
        weather_notation,
        swell_scale_21,
        wind_scale,
        wave_scale,
        weather_image,
        remarks,
        destination_port,
        eta_utc,
        agent_details,
        charterer_min_hsfo,
        charterer_max_hsfo,
        charterer_min_lsfo,
        charterer_max_lsfo,
        charterer_min_mgo,
        charterer_max_mgo,
        charterer_min_mdo,
        charterer_max_mdo
      } = req.body;

      const isAuthorized = req.user.role === 'admin' || req.user.role === 'team_pic' || req.user.role === 'user';
      let cMinHsfo, cMaxHsfo, cMinLsfo, cMaxLsfo, cMinMgo, cMaxMgo, cMinMdo, cMaxMdo;

      const [oldReport]: any = await pool.execute(
        'SELECT vessel_id, charterer_min_hsfo, charterer_max_hsfo, charterer_min_lsfo, charterer_max_lsfo, charterer_min_mgo, charterer_max_mgo, charterer_min_mdo, charterer_max_mdo FROM noon_reports WHERE id = ?',
        [id]
      );
      const reportVesselId = oldReport.length > 0 ? oldReport[0].vessel_id : null;

      // Fetch vessel's current thresholds as fallback
      let vMinHsfo = null, vMaxHsfo = null, vMinLsfo = null, vMaxLsfo = null, vMinMgo = null, vMaxMgo = null, vMinMdo = null, vMaxMdo = null;
      if (reportVesselId) {
        const [vessels]: any = await pool.execute(
          'SELECT charterer_min_hsfo, charterer_max_hsfo, charterer_min_lsfo, charterer_max_lsfo, charterer_min_mgo, charterer_max_mgo, charterer_min_mdo, charterer_max_mdo FROM vessels WHERE id = ?',
          [reportVesselId]
        );
        if (vessels.length > 0) {
          vMinHsfo = vessels[0].charterer_min_hsfo;
          vMaxHsfo = vessels[0].charterer_max_hsfo;
          vMinLsfo = vessels[0].charterer_min_lsfo;
          vMaxLsfo = vessels[0].charterer_max_lsfo;
          vMinMgo = vessels[0].charterer_min_mgo;
          vMaxMgo = vessels[0].charterer_max_mgo;
          vMinMdo = vessels[0].charterer_min_mdo;
          vMaxMdo = vessels[0].charterer_max_mdo;
        }
      }

      if (isAuthorized) {
        cMinHsfo = charterer_min_hsfo || vMinHsfo;
        cMaxHsfo = charterer_max_hsfo || vMaxHsfo;
        cMinLsfo = charterer_min_lsfo || vMinLsfo;
        cMaxLsfo = charterer_max_lsfo || vMaxLsfo;
        cMinMgo = charterer_min_mgo || vMinMgo;
        cMaxMgo = charterer_max_mgo || vMaxMgo;
        cMinMdo = charterer_min_mdo || vMinMdo;
        cMaxMdo = charterer_max_mdo || vMaxMdo;
      } else {
        if (oldReport.length > 0) {
          cMinHsfo = oldReport[0].charterer_min_hsfo !== null ? oldReport[0].charterer_min_hsfo : vMinHsfo;
          cMaxHsfo = oldReport[0].charterer_max_hsfo !== null ? oldReport[0].charterer_max_hsfo : vMaxHsfo;
          cMinLsfo = oldReport[0].charterer_min_lsfo !== null ? oldReport[0].charterer_min_lsfo : vMinLsfo;
          cMaxLsfo = oldReport[0].charterer_max_lsfo !== null ? oldReport[0].charterer_max_lsfo : vMaxLsfo;
          cMinMgo = oldReport[0].charterer_min_mgo !== null ? oldReport[0].charterer_min_mgo : vMinMgo;
          cMaxMgo = oldReport[0].charterer_max_mgo !== null ? oldReport[0].charterer_max_mgo : vMaxMgo;
          cMinMdo = oldReport[0].charterer_min_mdo !== null ? oldReport[0].charterer_min_mdo : vMinMdo;
          cMaxMdo = oldReport[0].charterer_max_mdo !== null ? oldReport[0].charterer_max_mdo : vMaxMdo;
        } else {
          cMinHsfo = vMinHsfo; cMaxHsfo = vMaxHsfo; cMinLsfo = vMinLsfo; cMaxLsfo = vMaxLsfo;
          cMinMgo = vMinMgo; cMaxMgo = vMaxMgo; cMinMdo = vMinMdo; cMaxMdo = vMaxMdo;
        }
      }

      let attachmentId = null;
      if (req.file) {
        const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'noon');
        const [result]: any = await pool.execute(
          'INSERT INTO noon_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, uploadData]
        );
        attachmentId = result.insertId;
      } else {
        const [old]: any = await pool.execute('SELECT attachment_id FROM noon_reports WHERE id = ?', [id]);
        if (old.length > 0) attachmentId = old[0].attachment_id;
      }

      await pool.execute(`
        UPDATE noon_reports SET
          voyage_number = ?, utc_date_time = ?, position_long = ?, position_lat = ?,
          distance_to_go = ?, cargo_status = ?, rob_hsfo = ?, rob_lsfo = ?,
          rob_mgo = ?, rob_mdo = ?, foc_hsfo = ?, foc_lsfo = ?,
          foc_mgo = ?, foc_mdo = ?, attachment_id = ?,
          weather_notation = ?, swell_scale_21 = ?, wind_scale = ?, wave_scale = ?,
          weather_image = ?, remarks = ?,
          destination_port = ?, eta_utc = ?, agent_details = ?,
          charterer_min_hsfo = ?, charterer_max_hsfo = ?, charterer_min_lsfo = ?, charterer_max_lsfo = ?,
          charterer_min_mgo = ?, charterer_max_mgo = ?, charterer_min_mdo = ?, charterer_max_mdo = ?
        WHERE id = ?
      `, [
        voyage_number, utc_date_time, position_long, position_lat,
        distance_to_go, cargo_status, 
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0,
        foc_hsfo || 0, foc_lsfo || 0, foc_mgo || 0, foc_mdo || 0,
        attachmentId,
        weather_notation || null, swell_scale_21 || null, wind_scale || null, wave_scale || null,
        weather_image || null, remarks || null,
        destination_port || null, eta_utc && eta_utc.trim() !== '' ? eta_utc : null, agent_details || null,
        cMinHsfo, cMaxHsfo, cMinLsfo, cMaxLsfo,
        cMinMgo, cMaxMgo, cMinMdo, cMaxMdo,
        id
      ]);

      await logAudit(req.user.id, req.user.username, 'UPDATE_NOON_REPORT', `Updated noon report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to update noon report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/noon-reports/:id/charterer-thresholds', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    const { id } = req.params;
    const {
      charterer_min_hsfo, charterer_max_hsfo,
      charterer_min_lsfo, charterer_max_lsfo,
      charterer_min_mgo, charterer_max_mgo,
      charterer_min_mdo, charterer_max_mdo
    } = req.body;
    try {
      await pool.execute(`
        UPDATE noon_reports SET
          charterer_min_hsfo = ?, charterer_max_hsfo = ?,
          charterer_min_lsfo = ?, charterer_max_lsfo = ?,
          charterer_min_mgo = ?, charterer_max_mgo = ?,
          charterer_min_mdo = ?, charterer_max_mdo = ?
        WHERE id = ?
      `, [
        charterer_min_hsfo || null, charterer_max_hsfo || null,
        charterer_min_lsfo || null, charterer_max_lsfo || null,
        charterer_min_mgo || null, charterer_max_mgo || null,
        charterer_min_mdo || null, charterer_max_mdo || null,
        id
      ]);
      await logAudit(req.user.id, req.user.username, 'UPDATE_NOON_REPORT_THRESHOLDS', `Updated thresholds for noon report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Other Reports Routes
  app.get('/api/other-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT orr.*, v.name as vessel_name
        FROM other_reports orr
        JOIN vessels v ON orr.vessel_id = v.id
        WHERE orr.deleted_at IS NULL
      `;
      let params: any[] = [];

      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND orr.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }

      query += ' ORDER BY orr.utc_date_time DESC';
      const [reports] = await pool.execute(query, params);
      res.json(reports);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/other-reports', authenticate, async (req: any, res) => {
    try {
      const {
        vessel_id,
        voyage_number,
        utc_date_time,
        port,
        eu_uk_status,
        position_long,
        position_lat,
        operation_type,
        cargo_status,
        rob_type,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        rob_fw,
        foc_port_hsfo,
        foc_port_lsfo,
        foc_port_mgo,
        foc_port_mdo
      } = req.body;

      await pool.execute(`
        INSERT INTO other_reports (
          vessel_id, user_id, voyage_number, utc_date_time, port, eu_uk_status,
          position_long, position_lat, operation_type, cargo_status, rob_type,
          rob_hsfo, rob_lsfo, rob_mgo, rob_mdo, rob_fw,
          foc_port_hsfo, foc_port_lsfo, foc_port_mgo, foc_port_mdo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vessel_id, req.user.id, voyage_number, utc_date_time, port, eu_uk_status,
        position_long, position_lat, operation_type, cargo_status, rob_type,
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0, rob_fw || 0,
        foc_port_hsfo || 0, foc_port_lsfo || 0, foc_port_mgo || 0, foc_port_mdo || 0
      ]);

      await logAudit(req.user.id, req.user.username, 'CREATE_OTHER_REPORT', `Created other report for vessel ID ${vessel_id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to create other report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/other-reports/:id', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;

      if (req.user.role === 'vessel') {
        const [latest]: any = await pool.execute(`
          SELECT id FROM other_reports 
          WHERE vessel_id = ? AND deleted_at IS NULL 
          ORDER BY utc_date_time DESC, id DESC LIMIT 1
        `, [req.user.vessel_id]);
        if (latest.length > 0 && latest[0].id !== Number(id)) {
          return res.status(403).json({ error: 'Vessel users can only edit the latest other report' });
        }

        const [expired]: any = await pool.execute(`
          SELECT id FROM other_reports 
          WHERE id = ? AND created_at < NOW() - INTERVAL 24 HOUR
        `, [id]);
        if (expired.length > 0) {
          return res.status(403).json({ error: 'Vessel users can only edit or update voyage reports within 24 hours after posting' });
        }
      }

      const {
        voyage_number,
        utc_date_time,
        port,
        eu_uk_status,
        position_long,
        position_lat,
        operation_type,
        cargo_status,
        rob_type,
        rob_hsfo,
        rob_lsfo,
        rob_mgo,
        rob_mdo,
        rob_fw,
        foc_port_hsfo,
        foc_port_lsfo,
        foc_port_mgo,
        foc_port_mdo
      } = req.body;

      await pool.execute(`
        UPDATE other_reports SET
          voyage_number = ?, utc_date_time = ?, port = ?, eu_uk_status = ?,
          position_long = ?, position_lat = ?, operation_type = ?, cargo_status = ?, rob_type = ?,
          rob_hsfo = ?, rob_lsfo = ?, rob_mgo = ?, rob_mdo = ?, rob_fw = ?,
          foc_port_hsfo = ?, foc_port_lsfo = ?, foc_port_mgo = ?, foc_port_mdo = ?
        WHERE id = ?
      `, [
        voyage_number, utc_date_time, port, eu_uk_status,
        position_long, position_lat, operation_type, cargo_status, rob_type,
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0, rob_fw || 0,
        foc_port_hsfo || 0, foc_port_lsfo || 0, foc_port_mgo || 0, foc_port_mdo || 0,
        id
      ]);

      await logAudit(req.user.id, req.user.username, 'UPDATE_OTHER_REPORT', `Updated other report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to update other report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Email Alert Logic
  let lastEmailSentAt = 0;
  const EMAIL_RATE_LIMIT_MS = 1100; // Resend limit is 2/sec, so 1.1s is safe

  async function getSmtpSettings() {
    if (!pool) return null;
    try {
      const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
      return (rows as any[]).reduce((acc, row) => {
        acc[row.setting_key] = row.setting_value;
        return acc;
      }, {});
    } catch (e) {
      return null;
    }
  }

  async function sendEmail({ to, subject, html, from }: { to: string | string[], subject: string, html: string, from?: string }) {
    const settings = await getSmtpSettings();
    const apiKey = settings?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      console.warn('RESEND_API_KEY is missing in both settings and environment. Email will not be sent.');
      return null;
    }

    // Rate limiting logic
    const now = Date.now();
    const timeSinceLast = now - lastEmailSentAt;
    if (timeSinceLast < EMAIL_RATE_LIMIT_MS) {
      const waitTime = EMAIL_RATE_LIMIT_MS - timeSinceLast;
      await sleep(waitTime);
    }
    lastEmailSentAt = Date.now();
    
    const resend = new Resend(apiKey);
    const fromEmail = from || settings?.SMTP_FROM || process.env.SMTP_FROM || 'onboarding@resend.dev';
    console.log(`Debug: Sending email from ${fromEmail} to ${to}`);
    
    try {
      console.log(`Debug: Payload: from=${fromEmail}, to=${to}, subject=${subject}`);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html,
      });
      
      if (error) {
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Resend email error:', error);
      throw error;
    }
  }

  // Certificate Expiration Check Logic
  const lastCheckTimestamps: Record<string, number> = {
    office: 0,
    vessel: 0,
    all: 0,
  };
  let officeAlertTimeout: NodeJS.Timeout | null = null;
  let vesselAlertTimeout: NodeJS.Timeout | null = null;

  async function startAlertScheduler() {
    await startOfficeAlertScheduler();
    await startVesselAlertScheduler();
  }

  async function startOfficeAlertScheduler() {
    if (officeAlertTimeout) clearTimeout(officeAlertTimeout);
    
    try {
      const settings = await getSmtpSettings();
      if (settings?.ENABLE_EMAIL_ALERTS === 'false') {
        console.log('Office Alert scheduler: Alerts are disabled.');
        return;
      }

      const type = settings?.ALERT_SCHEDULE_TYPE || 'interval';
      let ms = 24 * 60 * 60 * 1000; // Default 24h

      if (type === 'interval') {
        const hours = parseInt(settings?.ALERT_INTERVAL_HOURS || '24');
        ms = hours * 60 * 60 * 1000;
        console.log(`Office Alert scheduler: Next check in ${hours} hours.`);
      } else {
        const times = (settings?.ALERT_TIME || '08:00').split(',');
        const now = new Date();
        let nextCheck: Date | null = null;

        for (const time of times) {
          const [h, m] = time.split(':').map(Number);
          const candidate = new Date();
          candidate.setHours(h, m, 0, 0);
          if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
          
          if (!nextCheck || candidate < nextCheck) {
            nextCheck = candidate;
          }
        }

        if (nextCheck) {
          ms = nextCheck.getTime() - now.getTime();
          console.log(`Office Alert scheduler: Next check at ${nextCheck.toLocaleString()}.`);
        } else {
          ms = 24 * 60 * 60 * 1000; // Fallback
        }
      }

      officeAlertTimeout = setTimeout(async () => {
        await checkExpirations('office');
        startOfficeAlertScheduler();
      }, ms);
    } catch (err) {
      console.error('Failed to start office alert scheduler:', err);
      officeAlertTimeout = setTimeout(startOfficeAlertScheduler, 60 * 60 * 1000);
    }
  }

  async function startVesselAlertScheduler() {
    if (vesselAlertTimeout) clearTimeout(vesselAlertTimeout);
    
    try {
      const settings = await getSmtpSettings();
      if (settings?.ENABLE_EMAIL_ALERTS === 'false') {
        console.log('Vessel Alert scheduler: Alerts are disabled.');
        return;
      }

      const type = settings?.VESSEL_ALERT_SCHEDULE_TYPE || 'interval';
      let ms = 24 * 60 * 60 * 1000; // Default 24h

      if (type === 'interval') {
        const hours = parseInt(settings?.VESSEL_ALERT_INTERVAL_HOURS || '24');
        ms = hours * 60 * 60 * 1000;
        console.log(`Vessel Alert scheduler: Next check in ${hours} hours.`);
      } else {
        const times = (settings?.VESSEL_ALERT_TIME || '08:00').split(',');
        const now = new Date();
        let nextCheck: Date | null = null;

        for (const time of times) {
          const [h, m] = time.split(':').map(Number);
          const candidate = new Date();
          candidate.setHours(h, m, 0, 0);
          if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
          
          if (!nextCheck || candidate < nextCheck) {
            nextCheck = candidate;
          }
        }

        if (nextCheck) {
          ms = nextCheck.getTime() - now.getTime();
          console.log(`Vessel Alert scheduler: Next check at ${nextCheck.toLocaleString()}.`);
        } else {
          ms = 24 * 60 * 60 * 1000; // Fallback
        }
      }

      vesselAlertTimeout = setTimeout(async () => {
        await checkExpirations('vessel');
        startVesselAlertScheduler();
      }, ms);
    } catch (err) {
      console.error('Failed to start vessel alert scheduler:', err);
      vesselAlertTimeout = setTimeout(startVesselAlertScheduler, 60 * 60 * 1000);
    }
  }

  async function checkExpirations(targetType?: 'office' | 'vessel'): Promise<number> {
    console.log(`Checking certificate expirations${targetType ? ` for ${targetType}` : ''}...`);
    if (!pool) return 0;

    // 1. In-memory deduplication check (to catch rapid double calls in the same process)
    const nowTimestamp = Date.now();
    const typeKey = targetType || 'all';
    // If it ran within the last 10 seconds, skip to prevent double execution
    if (nowTimestamp - lastCheckTimestamps[typeKey] < 10000) {
      console.log(`Skipping checkExpirations('${typeKey}') - executed too recently in memory.`);
      return 0;
    }
    lastCheckTimestamps[typeKey] = nowTimestamp;

    let totalEmailsSent = 0;
    try {
      const settings = await getSmtpSettings();

      // 2. Database-backed deduplication (to catch duplicates across multiple running container processes)
      if (targetType && settings) {
        const lastSentKey = targetType === 'office' ? 'LAST_OFFICE_ALERT_SENT_AT' : 'LAST_VESSEL_ALERT_SENT_AT';
        const lastSentStr = settings[lastSentKey];
        if (lastSentStr) {
          const lastSent = new Date(lastSentStr);
          const diffMs = Date.now() - lastSent.getTime();
          
          // Minimum safe interval between automated runs of the same target type is 4 hours
          let minIntervalMs = 4 * 60 * 60 * 1000;
          
          const scheduleType = targetType === 'office' ? 
            settings.ALERT_SCHEDULE_TYPE : 
            settings.VESSEL_ALERT_SCHEDULE_TYPE;
          
          if (scheduleType === 'interval') {
            const hoursKey = targetType === 'office' ? 'ALERT_INTERVAL_HOURS' : 'VESSEL_ALERT_INTERVAL_HOURS';
            const hours = parseInt(settings[hoursKey] || '24');
            // If the user's custom interval is less than 4h, safety window is 80% of their interval
            if (hours < 4) {
              minIntervalMs = hours * 0.8 * 60 * 60 * 1000;
            }
          }
          
          if (diffMs < minIntervalMs) {
            console.log(`Skipping automated ${targetType} alert check. Already checked/sent successfully in DB ${(diffMs / 1000 / 60).toFixed(1)} minutes ago.`);
            return 0;
          }
        }
      }

      let query = `
        SELECT c.*, COALESCE(v.name, 'General') as vessel_name, t.name as team_name
        FROM certificates c
        LEFT JOIN vessels v ON c.vessel_id = v.id
        JOIN teams t ON c.team_id = t.id
        WHERE c.deleted_at IS NULL
      `;
      
      let params: any[] = [];
      if (targetType === 'office') {
        query += " AND c.access_type IN (?, ?)";
        params = ['office', 'any'];
      } else if (targetType === 'vessel') {
        query += " AND c.access_type IN (?, ?) AND c.vessel_id IS NOT NULL";
        params = ['vessel', 'any'];
      }

      const [certs]: any = await pool.query(query, params);

      const today = new Date();
      const sixtyDaysFromNow = addDays(today, 60);
      const thirtyDaysFromNow = addDays(today, 30);

      // Group alerts by team and by vessel (for Ship certificates)
      const teamAlerts: Record<string, { teamName: string, alerts: any[] }> = {};
      const vesselAlerts: Record<number, { vesselName: string, alerts: any[], email: string | null }> = {};

      for (const cert of certs) {
        const expDate = new Date(cert.expiration_date);
        if (isBefore(expDate, sixtyDaysFromNow)) {
          let status = 'EXPIRING';
          if (isBefore(expDate, today)) status = 'EXPIRED';
          else if (isBefore(expDate, thirtyDaysFromNow)) status = 'EXPIRING SOON';
          
          const alertData = { ...cert, status };
          
          // Office/Any certificates go to team alerts for office check
          if (targetType === 'office' || (!targetType && (cert.access_type === 'office' || cert.access_type === 'any'))) {
            if (!teamAlerts[cert.team_id]) {
              teamAlerts[cert.team_id] = { teamName: cert.team_name, alerts: [] };
            }
            teamAlerts[cert.team_id].alerts.push(alertData);
          }

          // Vessel certificates go to vessel alerts for vessel check
          if (targetType === 'vessel' || (!targetType && (cert.access_type === 'vessel' || (cert.access_type === 'any' && cert.vessel_id)))) {
            if (cert.vessel_id) {
              if (!vesselAlerts[cert.vessel_id]) {
                // Find the email of the user assigned to this vessel
                const [vesselUsers]: any = await pool.execute("SELECT email FROM users WHERE role = 'vessel' AND vessel_id = ? AND email IS NOT NULL", [cert.vessel_id]);
                const email = vesselUsers.length > 0 ? vesselUsers[0].email : null;
                vesselAlerts[cert.vessel_id] = { vesselName: cert.vessel_name, alerts: [], email };
              }
              vesselAlerts[cert.vessel_id].alerts.push(alertData);
            }
          }
        }
      }

      const teamAlertCount = Object.values(teamAlerts).reduce((acc, team) => acc + team.alerts.length, 0);
      const vesselAlertCount = Object.values(vesselAlerts).reduce((acc, v) => acc + v.alerts.length, 0);
      console.log(`Found ${certs.length} total certificates. Team alerts: ${teamAlertCount}, Vessel alerts: ${vesselAlertCount}.`);

      if (teamAlertCount === 0 && vesselAlertCount === 0) {
        console.log('No certificates require alerts at this time.');
        await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Last check: ${new Date().toLocaleString()}. No alerts found.`, 'LAST_ALERT_LOG']);
        if (targetType) {
          const lastSentKey = targetType === 'office' ? 'LAST_OFFICE_ALERT_SENT_AT' : 'LAST_VESSEL_ALERT_SENT_AT';
          await pool.execute(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [lastSentKey, new Date().toISOString(), new Date().toISOString()]
          );
        }
        return 0;
      }

      if (settings?.ENABLE_EMAIL_ALERTS === 'false') {
        console.log('Email alerts are disabled in settings.');
        await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Last check: ${new Date().toLocaleString()}. Alerts are disabled.`, 'LAST_ALERT_LOG']);
        if (targetType) {
          const lastSentKey = targetType === 'office' ? 'LAST_OFFICE_ALERT_SENT_AT' : 'LAST_VESSEL_ALERT_SENT_AT';
          await pool.execute(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [lastSentKey, new Date().toISOString(), new Date().toISOString()]
          );
        }
        return 0;
      }
      const alertRecipient = settings?.DESTINATION_EMAIL || 'IT@cleanocean.com.ph';
      const senderEmail = settings?.SMTP_FROM || process.env.SMTP_FROM || 'onboarding@resend.dev';

      if (settings?.RESEND_API_KEY || process.env.RESEND_API_KEY) {
        // Track unique cert IDs sent per recipient email to avoid sending duplicate alerts
        const sentRecipientCertMap = new Map<string, Set<number>>();

        // Send Team Alerts
        for (const teamId in teamAlerts) {
          const { teamName, alerts } = teamAlerts[teamId];
          if (alerts.length === 0) continue;

          const recipientKey = alertRecipient.toLowerCase().trim();
          if (!sentRecipientCertMap.has(recipientKey)) {
            sentRecipientCertMap.set(recipientKey, new Set<number>());
          }
          const sentSet = sentRecipientCertMap.get(recipientKey)!;
          const freshAlerts = alerts.filter(a => !sentSet.has(a.id));

          if (freshAlerts.length > 0) {
            await sendConsolidatedEmail(teamName, freshAlerts, alertRecipient, senderEmail);
            freshAlerts.forEach(a => sentSet.add(a.id));
            totalEmailsSent++;
          }
        }

        // Send Vessel Alerts
        for (const vesselId in vesselAlerts) {
          const { vesselName, alerts, email } = vesselAlerts[vesselId];
          if (alerts.length === 0 || !email) continue;

          const recipientKey = email.toLowerCase().trim();
          if (!sentRecipientCertMap.has(recipientKey)) {
            sentRecipientCertMap.set(recipientKey, new Set<number>());
          }
          const sentSet = sentRecipientCertMap.get(recipientKey)!;
          const freshAlerts = alerts.filter(a => !sentSet.has(a.id));

          if (freshAlerts.length > 0) {
            await sendConsolidatedEmail(`Vessel: ${vesselName}`, freshAlerts, email, senderEmail);
            freshAlerts.forEach(a => sentSet.add(a.id));
            totalEmailsSent++;
          }
        }
      } else {
        console.warn('RESEND_API_KEY incomplete in both settings and environment. Skipping email alerts.');
        await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Last check: ${new Date().toLocaleString()}. Resend API settings incomplete (Missing API Key).`, 'LAST_ALERT_LOG']);
      }
      if (targetType) {
        const lastSentKey = targetType === 'office' ? 'LAST_OFFICE_ALERT_SENT_AT' : 'LAST_VESSEL_ALERT_SENT_AT';
        await pool.execute(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [lastSentKey, new Date().toISOString(), new Date().toISOString()]
        );
      }
      console.log(`Certificate expiration check completed. Sent ${totalEmailsSent} alert email(s).`);
      return totalEmailsSent;
    } catch (err) {
      console.error('Error during certificate expiration check:', err);
      return 0;
    }
  }

  async function sendConsolidatedEmail(name: string, alerts: any[], recipient: string, senderEmail: string) {
    console.log(`Sending consolidated alert for ${name} (${alerts.length} certificates) to ${recipient}`);

    try {
      const tableRows = alerts.map(alert => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${alert.vessel_name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${alert.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${alert.expiration_date}</td>
          <td style="border: 1px solid #ddd; padding: 8px; color: ${alert.status === 'EXPIRED' ? '#d9534f' : '#f0ad4e'}; font-weight: bold;">${alert.status}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px;">
          <div style="background-color: #fff3cd; color: #856404; padding: 10px; border: 1px solid #ffeeba; border-radius: 5px; margin-bottom: 20px; text-align: center; font-weight: bold;">
            NOTICE: This system is currently in its TESTING PERIOD. Table data in this email are dummy data and doesn't reflect the actual data from our operations.
          </div>
          <h2 style="color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px;">Certificate/Service Report Expiration Alerts: ${name}</h2>
          <p>The following certificates/service reports for <b>${name}</b> require attention:</p>
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Vessel</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Certificate/Service Report Name</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Expiration Date</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <p style="margin-top: 30px; font-size: 0.85em; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
            This is an automated notification from the <b>COMOS Vessel Certificate/Service Report System</b>.
          </p>
        </div>
      `;

      await sendEmail({
        from: `"COMOS" <${senderEmail}>`,
        to: recipient,
        subject: `[COMOS] Certificate/Service Report Alerts: ${name}`,
        html: htmlContent
      });
      console.log(`Consolidated email alert sent to ${recipient} for ${name}`);
      await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Last check: ${new Date().toLocaleString()}. Alert sent to ${recipient} for ${name} (${alerts.length} certs).`, 'LAST_ALERT_LOG']);
    } catch (e: any) {
      console.error(`Failed to send consolidated email to ${recipient} for ${name}:`, e);
      await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Last check: ${new Date().toLocaleString()}. FAILED to send to ${recipient}: ${e.message}`, 'LAST_ALERT_LOG']);
    }
  }

  // Start alert scheduler
  await startAlertScheduler();

  app.post('/api/admin/test-email', authenticate, isAdmin, async (req, res) => {
    try {
      console.log('[Manual Trigger] Testing email alerts...');
      const settings = await getSmtpSettings();
      const apiKey = settings?.RESEND_API_KEY || process.env.RESEND_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ 
          error: 'Resend API Key is missing. Please configure it in settings or the Secrets menu.' 
        });
      }

      const alertRecipient = settings?.DESTINATION_EMAIL || 'IT@cleanocean.com.ph';
      const senderEmail = settings?.SMTP_FROM || 'onboarding@resend.dev';

      // Run actual expiration check first
      const alertEmailsSent = await checkExpirations();

      // If no alert emails were generated (no expiring certificates), send 1 test email to verify Resend connectivity
      if (alertEmailsSent === 0) {
        await sendEmail({
          from: `"COMOS System Test" <${senderEmail}>`,
          to: alertRecipient,
          subject: '[COMOS] Resend Configuration Test',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <div style="background-color: #fff3cd; color: #856404; padding: 10px; border: 1px solid #ffeeba; border-radius: 5px; margin-bottom: 20px; text-align: center; font-weight: bold;">
                NOTICE: This system is currently in its TESTING PERIOD.
              </div>
              <h2 style="color: #2c3e50;">Resend Configuration Test</h2>
              <p>This is a test email from the <b>COMOS Vessel Certificate/Service Report System</b> using Resend.</p>
              <p>Your Resend API settings for <b>${alertRecipient}</b> are working correctly. No expiring certificates were found at this time.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 0.8em; color: #7f8c8d;">Timestamp: ${new Date().toLocaleString()}</p>
            </div>
          `
        });
        await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Manual Test: ${new Date().toLocaleString()}. Connectivity test email sent.`, 'LAST_ALERT_LOG']);
        return res.json({ message: `Test email sent successfully to ${alertRecipient}. No expiring certificates found.` });
      }

      await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Manual Test: ${new Date().toLocaleString()}. ${alertEmailsSent} alert email(s) sent.`, 'LAST_ALERT_LOG']);
      res.json({ message: `Expiration alert scan triggered. ${alertEmailsSent} alert email(s) sent successfully.` });
    } catch (error: any) {
      console.error('Manual email test failed:', error);
      await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Manual Test: ${new Date().toLocaleString()}. FAILED: ${error.message}`, 'LAST_ALERT_LOG']);
      res.status(500).json({ 
        error: 'Failed to send test email.', 
        details: error.message 
      });
    }
  });

  // Report Delete Routes (Soft Delete)
  app.delete('/api/departure-reports/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      await pool.execute('UPDATE departure_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_DEPARTURE_REPORT', `Soft deleted departure report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/arrival-reports/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      const [reportRows]: any = await pool.execute('SELECT vessel_id FROM arrival_reports WHERE id = ?', [req.params.id]);
      await pool.execute('UPDATE arrival_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_ARRIVAL_REPORT', `Soft deleted arrival report ID ${req.params.id}`);
      
      if (reportRows.length > 0) {
        await syncVesselNextPort(reportRows[0].vessel_id);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/noon-reports/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      await pool.execute('UPDATE noon_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_NOON_REPORT', `Soft deleted noon report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/other-reports/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      await pool.execute('UPDATE other_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_OTHER_REPORT', `Soft deleted other report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Recycle Bin Routes (Admin only)
  app.get('/api/admin/recycle-bin', authenticate, isTeamPicOrAdmin, async (req, res) => {
    try {
      const types = [
        'vessels', 'users', 'certificates', 'files', 
        'departure_reports', 'arrival_reports', 'noon_reports', 'other_reports',
        'fuel_analysis_reports', 'fuel_analysis_files',
        'lube_oil_ldr_reports', 'lube_oil_ldr_files',
        'lube_oil_analysis_reports', 'lube_oil_analysis_files',
        'bunker_bdn_reports', 'bunker_bdn_files',
        'crew_members', 'audit_records', 'non_conformities', 'trouble_reports',
        'spare_parts_requisitions', 'requisition_attachments',
        'sms_uploads', 'sms_forms', 'sms_submission_periods',
        'sms_orders', 'sms_order_uploads', 'sms_order_templates',
        'flags', 'teams'
      ];
      const results: any = {};
      
      for (const type of types) {
        let query = `SELECT * FROM ${type} WHERE deleted_at IS NOT NULL`;
        if (type === 'vessels') {
          query = `SELECT v.*, t.name as team_name, v.name as title FROM vessels v LEFT JOIN teams t ON v.team_id = t.id WHERE v.deleted_at IS NOT NULL`;
        } else if (type === 'users') {
          query = `SELECT u.id, u.username, u.username as title, u.role, u.email, v.name as vessel_name, u.deleted_at FROM users u LEFT JOIN vessels v ON u.vessel_id = v.id WHERE u.deleted_at IS NOT NULL`;
        } else if (type === 'certificates') {
          query = `SELECT c.*, v.name as vessel_name, t.name as team_name, c.name as title FROM certificates c LEFT JOIN vessels v ON c.vessel_id = v.id LEFT JOIN teams t ON c.team_id = t.id WHERE c.deleted_at IS NOT NULL`;
        } else if (type === 'files') {
          query = `SELECT f.*, c.name as certificate_name, v.name as vessel_name, f.original_name as title FROM files f JOIN certificates c ON f.certificate_id = c.id LEFT JOIN vessels v ON c.vessel_id = v.id WHERE f.deleted_at IS NOT NULL`;
        } else if (type === 'fuel_analysis_files') {
          query = `SELECT f.*, r.bunker_port, v.name as vessel_name, f.file_name as title FROM fuel_analysis_files f JOIN fuel_analysis_reports r ON f.report_id = r.id LEFT JOIN vessels v ON r.vessel_id = v.id WHERE f.deleted_at IS NOT NULL`;
        } else if (type === 'lube_oil_ldr_files') {
          query = `SELECT f.*, r.machinery_name, v.name as vessel_name, f.file_name as title FROM lube_oil_ldr_files f JOIN lube_oil_ldr_reports r ON f.report_id = r.id LEFT JOIN vessels v ON r.vessel_id = v.id WHERE f.deleted_at IS NOT NULL`;
        } else if (type === 'lube_oil_analysis_files') {
          query = `SELECT f.*, r.machinery_name, v.name as vessel_name, f.file_name as title FROM lube_oil_analysis_files f JOIN lube_oil_analysis_reports r ON f.report_id = r.id LEFT JOIN vessels v ON r.vessel_id = v.id WHERE f.deleted_at IS NOT NULL`;
        } else if (type === 'bunker_bdn_files') {
          query = `SELECT f.*, r.bunker_port, v.name as vessel_name, f.file_name as title FROM bunker_bdn_files f JOIN bunker_bdn_reports r ON f.report_id = r.id LEFT JOIN vessels v ON r.vessel_id = v.id WHERE f.deleted_at IS NOT NULL`;
        } else if (type === 'requisition_attachments') {
          query = `SELECT a.*, spr.requisition_no, spr.vessel_name, a.file_name as title FROM requisition_attachments a JOIN spare_parts_requisitions spr ON a.requisition_id = spr.id WHERE a.deleted_at IS NOT NULL`;
        } else if (type.includes('report') && !type.includes('attachment') && !type.includes('file')) {
          query = `SELECT r.*, v.name as vessel_name FROM ${type} r LEFT JOIN vessels v ON r.vessel_id = v.id WHERE r.deleted_at IS NOT NULL`;
        } else if (type === 'crew_members') {
          query = `SELECT c.*, v.name as vessel_name, c.name as title FROM crew_members c LEFT JOIN vessels v ON c.vessel_id = v.id WHERE c.deleted_at IS NOT NULL`;
        } else if (type === 'non_conformities') {
          query = `SELECT nc.*, v.name as vessel_name FROM non_conformities nc LEFT JOIN vessels v ON nc.vessel_id = v.id WHERE nc.deleted_at IS NOT NULL`;
        } else if (type === 'audit_records') {
          query = `SELECT ar.*, v.name as vessel_name FROM audit_records ar LEFT JOIN vessels v ON ar.vessel_id = v.id WHERE ar.deleted_at IS NOT NULL`;
        } else if (type === 'trouble_reports') {
          query = `SELECT tr.*, v.name as vessel_name FROM trouble_reports tr LEFT JOIN vessels v ON tr.vessel_id = v.id WHERE tr.deleted_at IS NOT NULL`;
        } else if (type === 'spare_parts_requisitions') {
          query = `SELECT spr.*, spr.requisition_no as title FROM spare_parts_requisitions spr WHERE spr.deleted_at IS NOT NULL`;
        } else if (type === 'sms_uploads') {
          query = `SELECT u.id, u.vessel_id, u.vessel_name, u.month, u.year, u.file_name, u.file_size, u.uploaded_at, u.deleted_at, u.file_name as title, u.file_name as name FROM sms_uploads u WHERE u.deleted_at IS NOT NULL`;
        } else if (type === 'sms_forms') {
          query = `SELECT f.*, f.formCode as name, f.formCode as title FROM sms_forms f WHERE f.deleted_at IS NOT NULL`;
        } else if (type === 'sms_submission_periods') {
          query = `SELECT sp.*, sp.vessel_id as id, sp.vessel_name as name, sp.vessel_name as title FROM sms_submission_periods sp WHERE sp.deleted_at IS NOT NULL`;
        } else if (type === 'sms_orders') {
          query = `SELECT o.*, o.label as name, o.label as title, (SELECT COUNT(*) FROM sms_order_vessels ov WHERE ov.order_id = o.id) as vessel_count, (SELECT COUNT(*) FROM sms_order_items oi WHERE oi.order_id = o.id) as item_count FROM sms_orders o WHERE o.deleted_at IS NOT NULL`;
        } else if (type === 'sms_order_uploads') {
          query = `SELECT u.*, u.file_name as name, u.file_name as title, o.label as order_label FROM sms_order_uploads u LEFT JOIN sms_orders o ON u.order_id = o.id WHERE u.deleted_at IS NOT NULL`;
        } else if (type === 'sms_order_templates') {
          query = `SELECT t.*, t.title as name, t.title as title_display FROM sms_order_templates t WHERE t.deleted_at IS NOT NULL`;
        } else if (type === 'flags') {
          query = `SELECT f.*, f.name as name, f.name as title FROM flags f WHERE f.deleted_at IS NOT NULL`;
        } else if (type === 'teams') {
          query = `SELECT t.*, t.name as name, t.name as title FROM teams t WHERE t.deleted_at IS NOT NULL`;
        }
        
        try {
          const [rows] = await pool.query(query);
          results[type] = rows;
        } catch (queryErr: any) {
          results[type] = [];
        }
      }
      
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/recycle-bin/restore', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    const { type, id, ids } = req.body;
    try {
      const validTypes = [
        'vessels', 'users', 'certificates', 'files', 
        'departure_reports', 'arrival_reports', 'noon_reports', 'other_reports',
        'fuel_analysis_reports', 'fuel_analysis_files',
        'lube_oil_ldr_reports', 'lube_oil_ldr_files',
        'lube_oil_analysis_reports', 'lube_oil_analysis_files',
        'bunker_bdn_reports', 'bunker_bdn_files',
        'crew_members', 'audit_records', 'non_conformities', 'trouble_reports',
        'spare_parts_requisitions', 'requisition_attachments',
        'sms_uploads', 'sms_forms', 'sms_submission_periods',
        'sms_orders', 'sms_order_uploads', 'sms_order_templates',
        'flags', 'teams'
      ];
      if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
      
      const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);
      if (targetIds.length === 0) return res.status(400).json({ error: 'No IDs provided' });

      for (const targetId of targetIds) {
        if (type === 'sms_submission_periods') {
          await pool.execute('UPDATE sms_submission_periods SET deleted_at = NULL WHERE vessel_id = ? OR vessel_id = ?', [targetId, String(targetId)]);
        } else if (type === 'sms_orders') {
          await pool.execute('UPDATE sms_orders SET deleted_at = NULL WHERE id = ?', [targetId]);
          await pool.execute('UPDATE sms_order_vessels SET deleted_at = NULL WHERE order_id = ?', [targetId]);
          await pool.execute('UPDATE sms_order_items SET deleted_at = NULL WHERE order_id = ?', [targetId]);
          await pool.execute('UPDATE sms_order_uploads SET deleted_at = NULL WHERE order_id = ?', [targetId]);
        } else if (type === 'spare_parts_requisitions') {
          await pool.execute('UPDATE spare_parts_requisitions SET deleted_at = NULL WHERE id = ?', [targetId]);
          await pool.execute('UPDATE requisition_attachments SET deleted_at = NULL WHERE requisition_id = ?', [targetId]);
        } else if (type === 'certificates') {
          await pool.execute('UPDATE certificates SET deleted_at = NULL WHERE id = ?', [targetId]);
          await pool.execute('UPDATE files SET deleted_at = NULL WHERE certificate_id = ?', [targetId]);
        } else {
          await pool.execute(`UPDATE ${type} SET deleted_at = NULL WHERE id = ?`, [targetId]);
        }
        
        // Cascading restore for child files/attachments
        if (type === 'fuel_analysis_reports') {
          await pool.execute('UPDATE fuel_analysis_files SET deleted_at = NULL WHERE report_id = ?', [targetId]);
        } else if (type === 'lube_oil_ldr_reports') {
          await pool.execute('UPDATE lube_oil_ldr_files SET deleted_at = NULL WHERE report_id = ?', [targetId]);
        } else if (type === 'lube_oil_analysis_reports') {
          await pool.execute('UPDATE lube_oil_analysis_files SET deleted_at = NULL WHERE report_id = ?', [targetId]);
        } else if (type === 'bunker_bdn_reports') {
          await pool.execute('UPDATE bunker_bdn_files SET deleted_at = NULL WHERE report_id = ?', [targetId]);
        } else if (type === 'audit_records') {
          await pool.execute('UPDATE audit_comments SET deleted_at = NULL WHERE audit_id = ?', [targetId]);
          await pool.execute('UPDATE non_conformities SET deleted_at = NULL WHERE audit_id = ?', [targetId]);
        }
        
        await logAudit(req.user.id, req.user.username, 'RESTORE_ITEM', `Restored ${type} ID ${targetId}`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/recycle-bin/permanent-delete', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    const { type, id, ids } = req.body;
    try {
      const validTypes = [
        'vessels', 'users', 'certificates', 'files', 
        'departure_reports', 'arrival_reports', 'noon_reports', 'other_reports',
        'fuel_analysis_reports', 'fuel_analysis_files',
        'lube_oil_ldr_reports', 'lube_oil_ldr_files',
        'lube_oil_analysis_reports', 'lube_oil_analysis_files',
        'bunker_bdn_reports', 'bunker_bdn_files',
        'crew_members', 'audit_records', 'non_conformities', 'trouble_reports',
        'spare_parts_requisitions', 'requisition_attachments',
        'sms_uploads', 'sms_forms', 'sms_submission_periods',
        'sms_orders', 'sms_order_uploads', 'sms_order_templates',
        'flags', 'teams'
      ];
      if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
      
      const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);
      if (targetIds.length === 0) return res.status(400).json({ error: 'No IDs provided' });

      for (const targetId of targetIds) {
        // Special handling for attachments and B2 storage cleanup
        if (type === 'sms_uploads') {
          const [rows]: any = await pool.execute('SELECT file_data, file_name FROM sms_uploads WHERE id = ? OR file_name = ?', [targetId, targetId]);
          for (const row of rows) {
            if (row.file_data) {
              await handleFileDelete(row.file_data);
            }
            if (await isB2Configured()) {
              try {
                await deleteFileFromB2(`sms_uploads/${row.file_name}`);
              } catch (e) {}
            }
          }
        } else if (type === 'sms_orders') {
          const [upRows]: any = await pool.execute('SELECT id, file_data, file_name, b2_folder_path FROM sms_order_uploads WHERE order_id = ?', [targetId]);
          for (const up of upRows) {
            if (up.file_data) await handleFileDelete(up.file_data);
            if (await isB2Configured() && up.b2_folder_path) {
              try {
                await deleteFileFromB2(`${up.b2_folder_path}/${up.file_name}`);
              } catch (e) {}
            }
          }
          await pool.execute('DELETE FROM sms_order_upload_reads WHERE upload_id IN (SELECT id FROM sms_order_uploads WHERE order_id = ?)', [targetId]);
          await pool.execute('DELETE FROM sms_order_uploads WHERE order_id = ?', [targetId]);
          await pool.execute('DELETE FROM sms_order_items WHERE order_id = ?', [targetId]);
          await pool.execute('DELETE FROM sms_order_vessels WHERE order_id = ?', [targetId]);
        } else if (type === 'sms_order_uploads') {
          const [upRows]: any = await pool.execute('SELECT file_data, file_name, b2_folder_path FROM sms_order_uploads WHERE id = ?', [targetId]);
          for (const up of upRows) {
            if (up.file_data) await handleFileDelete(up.file_data);
            if (await isB2Configured() && up.b2_folder_path) {
              try {
                await deleteFileFromB2(`${up.b2_folder_path}/${up.file_name}`);
              } catch (e) {}
            }
          }
          await pool.execute('DELETE FROM sms_order_upload_reads WHERE upload_id = ?', [targetId]);
        } else if (type === 'spare_parts_requisitions') {
          const [attRows]: any = await pool.execute('SELECT file_data, file_name, b2_folder_path FROM requisition_attachments WHERE requisition_id = ?', [targetId]);
          for (const att of attRows) {
            if (att.file_data) await handleFileDelete(att.file_data);
            if (await isB2Configured() && att.b2_folder_path) {
              try {
                await deleteFileFromB2(`${att.b2_folder_path}/${att.file_name}`);
              } catch (e) {}
            }
          }
          await pool.execute('DELETE FROM requisition_attachments WHERE requisition_id = ?', [targetId]);
        } else if (type === 'requisition_attachments') {
          const [attRows]: any = await pool.execute('SELECT file_data, file_name, b2_folder_path FROM requisition_attachments WHERE id = ?', [targetId]);
          for (const att of attRows) {
            if (att.file_data) await handleFileDelete(att.file_data);
            if (await isB2Configured() && att.b2_folder_path) {
              try {
                await deleteFileFromB2(`${att.b2_folder_path}/${att.file_name}`);
              } catch (e) {}
            }
          }
        } else if (type === 'files') {
          const [rows]: any = await pool.execute('SELECT file_data FROM files WHERE id = ?', [targetId]);
          for (const row of rows) {
            if (row.file_data) await handleFileDelete(row.file_data);
          }
        } else if (type === 'departure_reports') {
          const [rows]: any = await pool.execute('SELECT attachment_id FROM departure_reports WHERE id = ?', [targetId]);
          if (rows[0]?.attachment_id) {
            const [attRows]: any = await pool.execute('SELECT file_data FROM departure_attachments WHERE id = ?', [rows[0].attachment_id]);
            for (const att of attRows) {
              if (att.file_data) await handleFileDelete(att.file_data);
            }
            await pool.execute('DELETE FROM departure_attachments WHERE id = ?', [rows[0].attachment_id]);
          }
        } else if (type === 'arrival_reports') {
          const [rows]: any = await pool.execute('SELECT attachment_id FROM arrival_reports WHERE id = ?', [targetId]);
          if (rows[0]?.attachment_id) {
            const [attRows]: any = await pool.execute('SELECT file_data FROM arrival_attachments WHERE id = ?', [rows[0].attachment_id]);
            for (const att of attRows) {
              if (att.file_data) await handleFileDelete(att.file_data);
            }
            await pool.execute('DELETE FROM arrival_attachments WHERE id = ?', [rows[0].attachment_id]);
          }
        } else if (type === 'noon_reports') {
          const [rows]: any = await pool.execute('SELECT attachment_id FROM noon_reports WHERE id = ?', [targetId]);
          if (rows[0]?.attachment_id) {
            const [attRows]: any = await pool.execute('SELECT file_data FROM noon_attachments WHERE id = ?', [rows[0].attachment_id]);
            for (const att of attRows) {
              if (att.file_data) await handleFileDelete(att.file_data);
            }
            await pool.execute('DELETE FROM noon_attachments WHERE id = ?', [rows[0].attachment_id]);
          }
        } else if (type === 'certificates') {
          // When permanently deleting a certificate, clean up notes & files from DB and B2
          const [fRows]: any = await pool.execute('SELECT file_data FROM files WHERE certificate_id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
          await pool.execute('DELETE FROM notes WHERE certificate_id = ?', [targetId]);
          await pool.execute('DELETE FROM files WHERE certificate_id = ?', [targetId]);
        } else if (type === 'fuel_analysis_reports') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM fuel_analysis_files WHERE report_id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
          await pool.execute('DELETE FROM fuel_analysis_files WHERE report_id = ?', [targetId]);
        } else if (type === 'fuel_analysis_files') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM fuel_analysis_files WHERE id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
        } else if (type === 'lube_oil_ldr_reports') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM lube_oil_ldr_files WHERE report_id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
          await pool.execute('DELETE FROM lube_oil_ldr_files WHERE report_id = ?', [targetId]);
        } else if (type === 'lube_oil_ldr_files') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM lube_oil_ldr_files WHERE id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
        } else if (type === 'lube_oil_analysis_reports') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM lube_oil_analysis_files WHERE report_id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
          await pool.execute('DELETE FROM lube_oil_analysis_files WHERE report_id = ?', [targetId]);
        } else if (type === 'lube_oil_analysis_files') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM lube_oil_analysis_files WHERE id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
        } else if (type === 'bunker_bdn_reports') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM bunker_bdn_files WHERE report_id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
          await pool.execute('DELETE FROM bunker_bdn_files WHERE report_id = ?', [targetId]);
        } else if (type === 'bunker_bdn_files') {
          const [fRows]: any = await pool.execute('SELECT file_data FROM bunker_bdn_files WHERE id = ?', [targetId]);
          for (const f of fRows) {
            if (f.file_data) await handleFileDelete(f.file_data);
          }
        } else if (type === 'audit_records') {
          await pool.execute('DELETE FROM audit_comments WHERE audit_id = ?', [targetId]);
          await pool.execute('DELETE FROM non_conformities WHERE audit_id = ?', [targetId]);
        } else if (type === 'users') {
          await pool.execute('DELETE FROM user_teams WHERE user_id = ?', [targetId]);
        }

        if (type === 'sms_submission_periods') {
          await pool.execute('DELETE FROM sms_submission_periods WHERE vessel_id = ? OR vessel_id = ?', [targetId, String(targetId)]);
        } else {
          await pool.execute(`DELETE FROM ${type} WHERE id = ?`, [targetId]);
        }
        await logAudit(req.user.id, req.user.username, 'PERMANENT_DELETE', `Permanently deleted ${type} ID ${targetId}`);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // FUEL ANALYSIS REPORTS ROUTES
  // ==========================================
  app.get('/api/fuel-analysis-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT fa.*, v.name as vessel_name
        FROM fuel_analysis_reports fa
        JOIN vessels v ON fa.vessel_id = v.id
        WHERE fa.deleted_at IS NULL
      `;
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND fa.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }
      query += ' ORDER BY fa.date DESC, fa.id DESC';
      const [reports]: any = await pool.execute(query, params);

      const reportsWithFiles = [];
      for (const report of reports) {
        const [files]: any = await pool.execute(
          'SELECT id, filename, size FROM fuel_analysis_files WHERE report_id = ? AND deleted_at IS NULL',
          [report.id]
        );
        reportsWithFiles.push({
          id: String(report.id),
          vesselId: String(report.vessel_id),
          vesselName: report.vessel_name,
          date: report.date ? new Date(report.date).toISOString().split('T')[0] : '',
          bdnNumber: report.bdn_number,
          analysisRefNumber: report.analysis_ref_number,
          productName: report.product_name,
          viscosity: report.viscosity,
          density: report.density,
          waterContent: report.water_content,
          sulfurContent: report.sulfur_content,
          status: report.status,
          files: files.map((f: any) => ({
            id: String(f.id),
            name: f.filename,
            size: f.size,
            dataUrl: `/api/fuel-analysis-files/${f.id}`
          }))
        });
      }
      res.json(reportsWithFiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/fuel-analysis-files/:id', authenticate, async (req, res) => {
    try {
      const [files]: any = await pool.execute(
        'SELECT * FROM fuel_analysis_files WHERE id = ? AND deleted_at IS NULL',
        [req.params.id]
      );
      if (files.length > 0 && files[0].data) {
        const file = files[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/fuel-analysis-reports', authenticate, async (req: any, res) => {
    const {
      vesselId,
      date,
      bdnNumber,
      analysisRefNumber,
      productName,
      viscosity,
      density,
      waterContent,
      sulfurContent,
      status,
      files
    } = req.body;

    try {
      const [result]: any = await pool.execute(
        `INSERT INTO fuel_analysis_reports (
          vessel_id, date, bdn_number, analysis_ref_number, product_name,
          viscosity, density, water_content, sulfur_content, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vesselId ?? null,
          date ?? null,
          bdnNumber ?? null,
          analysisRefNumber ?? null,
          productName ?? null,
          viscosity ?? null,
          density ?? null,
          waterContent ?? null,
          sulfurContent ?? null,
          status ?? null
        ]
      );
      const reportId = result.insertId;

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            const parsed = parseBase64DataUrl(file.dataUrl);
            if (parsed) {
              const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'fuel-analysis');
              await pool.execute(
                'INSERT INTO fuel_analysis_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
                [reportId, file.name, file.size, parsed.mimetype, finalBuffer]
              );
            }
          }
        }
      }

      await logAudit(req.user.id, req.user.username, 'CREATE_FUEL_ANALYSIS_REPORT', `Created fuel analysis report ID ${reportId}`);
      res.status(201).json({ success: true, id: reportId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/fuel-analysis-reports/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      vesselId,
      date,
      bdnNumber,
      analysisRefNumber,
      productName,
      viscosity,
      density,
      waterContent,
      sulfurContent,
      status,
      files
    } = req.body;

    try {
      await pool.execute(
        `UPDATE fuel_analysis_reports SET 
          vessel_id = ?, date = ?, bdn_number = ?, analysis_ref_number = ?, product_name = ?, 
          viscosity = ?, density = ?, water_content = ?, sulfur_content = ?, status = ?
         WHERE id = ?`,
        [
          vesselId ?? null,
          date ?? null,
          bdnNumber ?? null,
          analysisRefNumber ?? null,
          productName ?? null,
          viscosity ?? null,
          density ?? null,
          waterContent ?? null,
          sulfurContent ?? null,
          status ?? null,
          id
        ]
      );

      const keptFileIds: string[] = [];
      const newFilesToUpload = [];

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.id) {
            keptFileIds.push(file.id);
          } else if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            newFilesToUpload.push(file);
          }
        }
      }

      if (keptFileIds.length > 0) {
        const placeholders = keptFileIds.map(() => '?').join(',');
        await pool.execute(
          `UPDATE fuel_analysis_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
          [id, ...keptFileIds]
        );
      } else {
        await pool.execute(
          'UPDATE fuel_analysis_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND deleted_at IS NULL',
          [id]
        );
      }

      for (const file of newFilesToUpload) {
        const parsed = parseBase64DataUrl(file.dataUrl);
        if (parsed) {
          const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'fuel-analysis');
          await pool.execute(
            'INSERT INTO fuel_analysis_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
            [id, file.name, file.size, parsed.mimetype, finalBuffer]
          );
        }
      }

      await logAudit(req.user.id, req.user.username, 'UPDATE_FUEL_ANALYSIS_REPORT', `Updated fuel analysis report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/fuel-analysis-reports/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE fuel_analysis_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_FUEL_ANALYSIS_REPORT', `Soft deleted fuel analysis report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // LUBE OIL LDR REPORTS ROUTES
  // ==========================================
  app.get('/api/lube-oil-ldr-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT ldr.*, v.name as vessel_name
        FROM lube_oil_ldr_reports ldr
        JOIN vessels v ON ldr.vessel_id = v.id
        WHERE ldr.deleted_at IS NULL
      `;
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND ldr.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }
      query += ' ORDER BY ldr.date DESC, ldr.id DESC';
      const [reports]: any = await pool.execute(query, params);

      const reportsWithFiles = [];
      for (const report of reports) {
        const [files]: any = await pool.execute(
          'SELECT id, filename, size FROM lube_oil_ldr_files WHERE report_id = ? AND deleted_at IS NULL',
          [report.id]
        );
        reportsWithFiles.push({
          id: String(report.id),
          vesselId: String(report.vessel_id),
          vesselName: report.vessel_name,
          date: report.date ? new Date(report.date).toISOString().split('T')[0] : '',
          ldrNumber: report.ldr_number,
          productType: report.product_type,
          quantity: report.quantity,
          supplier: report.supplier,
          viscosity: report.viscosity,
          density: report.density,
          sulfurContent: report.sulfur_content,
          files: files.map((f: any) => ({
            id: String(f.id),
            name: f.filename,
            size: f.size,
            dataUrl: `/api/lube-oil-ldr-files/${f.id}`
          }))
        });
      }
      res.json(reportsWithFiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/lube-oil-ldr-files/:id', authenticate, async (req, res) => {
    try {
      const [files]: any = await pool.execute(
        'SELECT * FROM lube_oil_ldr_files WHERE id = ? AND deleted_at IS NULL',
        [req.params.id]
      );
      if (files.length > 0 && files[0].data) {
        const file = files[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/lube-oil-ldr-reports', authenticate, async (req: any, res) => {
    const {
      vesselId,
      date,
      ldrNumber,
      productType,
      quantity,
      supplier,
      viscosity,
      density,
      sulfurContent,
      files
    } = req.body;

    try {
      const [result]: any = await pool.execute(
        `INSERT INTO lube_oil_ldr_reports (
          vessel_id, date, ldr_number, product_type, quantity, supplier, viscosity, density, sulfur_content
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vesselId ?? null,
          date ?? null,
          ldrNumber ?? null,
          productType ?? null,
          quantity ?? null,
          supplier ?? null,
          viscosity ?? null,
          density ?? null,
          sulfurContent ?? null
        ]
      );
      const reportId = result.insertId;

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            const parsed = parseBase64DataUrl(file.dataUrl);
            if (parsed) {
              const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'lube-oil-ldr');
              await pool.execute(
                'INSERT INTO lube_oil_ldr_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
                [reportId, file.name, file.size, parsed.mimetype, finalBuffer]
              );
            }
          }
        }
      }

      await logAudit(req.user.id, req.user.username, 'CREATE_LUBE_OIL_LDR_REPORT', `Created lube oil LDR report ID ${reportId}`);
      res.status(201).json({ success: true, id: reportId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/lube-oil-ldr-reports/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      vesselId,
      date,
      ldrNumber,
      productType,
      quantity,
      supplier,
      viscosity,
      density,
      sulfurContent,
      files
    } = req.body;

    try {
      await pool.execute(
        `UPDATE lube_oil_ldr_reports SET 
          vessel_id = ?, date = ?, ldr_number = ?, product_type = ?, quantity = ?, 
          supplier = ?, viscosity = ?, density = ?, sulfur_content = ?
         WHERE id = ?`,
        [
          vesselId ?? null,
          date ?? null,
          ldrNumber ?? null,
          productType ?? null,
          quantity ?? null,
          supplier ?? null,
          viscosity ?? null,
          density ?? null,
          sulfurContent ?? null,
          id
        ]
      );

      const keptFileIds: string[] = [];
      const newFilesToUpload = [];

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.id) {
            keptFileIds.push(file.id);
          } else if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            newFilesToUpload.push(file);
          }
        }
      }

      if (keptFileIds.length > 0) {
        const placeholders = keptFileIds.map(() => '?').join(',');
        await pool.execute(
          `UPDATE lube_oil_ldr_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
          [id, ...keptFileIds]
        );
      } else {
        await pool.execute(
          'UPDATE lube_oil_ldr_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND deleted_at IS NULL',
          [id]
        );
      }

      for (const file of newFilesToUpload) {
        const parsed = parseBase64DataUrl(file.dataUrl);
        if (parsed) {
          const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'lube-oil-ldr');
          await pool.execute(
            'INSERT INTO lube_oil_ldr_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
            [id, file.name, file.size, parsed.mimetype, finalBuffer]
          );
        }
      }

      await logAudit(req.user.id, req.user.username, 'UPDATE_LUBE_OIL_LDR_REPORT', `Updated lube oil LDR report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/lube-oil-ldr-reports/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE lube_oil_ldr_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_LUBE_OIL_LDR_REPORT', `Soft deleted lube oil LDR report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // LUBE OIL ANALYSIS REPORTS ROUTES
  // ==========================================
  app.get('/api/lube-oil-analysis-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT loa.*, v.name as vessel_name
        FROM lube_oil_analysis_reports loa
        JOIN vessels v ON loa.vessel_id = v.id
        WHERE loa.deleted_at IS NULL
      `;
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND loa.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }
      query += ' ORDER BY loa.date DESC, loa.id DESC';
      const [reports]: any = await pool.execute(query, params);

      const reportsWithFiles = [];
      for (const report of reports) {
        const [files]: any = await pool.execute(
          'SELECT id, filename, size FROM lube_oil_analysis_files WHERE report_id = ? AND deleted_at IS NULL',
          [report.id]
        );
        reportsWithFiles.push({
          id: String(report.id),
          vesselId: String(report.vessel_id),
          vesselName: report.vessel_name,
          date: report.date ? new Date(report.date).toISOString().split('T')[0] : '',
          machinerySampled: report.machinery_sampled,
          viscosity: report.viscosity,
          waterContent: report.water_content,
          tbn: report.tbn,
          insolubles: report.insolubles,
          status: report.status,
          remarks: report.remarks,
          files: files.map((f: any) => ({
            id: String(f.id),
            name: f.filename,
            size: f.size,
            dataUrl: `/api/lube-oil-analysis-files/${f.id}`
          }))
        });
      }
      res.json(reportsWithFiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/lube-oil-analysis-files/:id', authenticate, async (req, res) => {
    try {
      const [files]: any = await pool.execute(
        'SELECT * FROM lube_oil_analysis_files WHERE id = ? AND deleted_at IS NULL',
        [req.params.id]
      );
      if (files.length > 0 && files[0].data) {
        const file = files[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/lube-oil-analysis-reports', authenticate, async (req: any, res) => {
    const {
      vesselId,
      date,
      machinerySampled,
      viscosity,
      waterContent,
      tbn,
      insolubles,
      status,
      remarks,
      files
    } = req.body;

    try {
      const [result]: any = await pool.execute(
        `INSERT INTO lube_oil_analysis_reports (
          vessel_id, date, machinery_sampled,
          viscosity, water_content, tbn, insolubles, status, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vesselId ?? null,
          date ?? null,
          machinerySampled ?? null,
          viscosity ?? null,
          waterContent ?? null,
          tbn ?? null,
          insolubles ?? null,
          status ?? null,
          remarks ?? null
        ]
      );
      const reportId = result.insertId;

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            const parsed = parseBase64DataUrl(file.dataUrl);
            if (parsed) {
              const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'lube-oil-analysis');
              await pool.execute(
                'INSERT INTO lube_oil_analysis_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
                [reportId, file.name, file.size, parsed.mimetype, finalBuffer]
              );
            }
          }
        }
      }

      await logAudit(req.user.id, req.user.username, 'CREATE_LUBE_OIL_ANALYSIS_REPORT', `Created lube oil analysis report ID ${reportId}`);
      res.status(201).json({ success: true, id: reportId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/lube-oil-analysis-reports/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      vesselId,
      date,
      machinerySampled,
      viscosity,
      waterContent,
      tbn,
      insolubles,
      status,
      remarks,
      files
    } = req.body;

    try {
      await pool.execute(
        `UPDATE lube_oil_analysis_reports SET 
          vessel_id = ?, date = ?, machinery_sampled = ?, 
          viscosity = ?, water_content = ?, tbn = ?, insolubles = ?, status = ?, remarks = ?
         WHERE id = ?`,
        [
          vesselId ?? null,
          date ?? null,
          machinerySampled ?? null,
          viscosity ?? null,
          waterContent ?? null,
          tbn ?? null,
          insolubles ?? null,
          status ?? null,
          remarks ?? null,
          id
        ]
      );

      const keptFileIds: string[] = [];
      const newFilesToUpload = [];

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.id) {
            keptFileIds.push(file.id);
          } else if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            newFilesToUpload.push(file);
          }
        }
      }

      if (keptFileIds.length > 0) {
        const placeholders = keptFileIds.map(() => '?').join(',');
        await pool.execute(
          `UPDATE lube_oil_analysis_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
          [id, ...keptFileIds]
        );
      } else {
        await pool.execute(
          'UPDATE lube_oil_analysis_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND deleted_at IS NULL',
          [id]
        );
      }

      for (const file of newFilesToUpload) {
        const parsed = parseBase64DataUrl(file.dataUrl);
        if (parsed) {
          const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'lube-oil-analysis');
          await pool.execute(
            'INSERT INTO lube_oil_analysis_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
            [id, file.name, file.size, parsed.mimetype, finalBuffer]
          );
        }
      }

      await logAudit(req.user.id, req.user.username, 'UPDATE_LUBE_OIL_ANALYSIS_REPORT', `Updated lube oil analysis report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/lube-oil-analysis-reports/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE lube_oil_analysis_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_LUBE_OIL_ANALYSIS_REPORT', `Soft deleted lube oil analysis report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // BUNKER BDN REPORTS ROUTES
  // ==========================================
  app.get('/api/bunker-bdn-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT b.*, v.name as vessel_name
        FROM bunker_bdn_reports b
        JOIN vessels v ON b.vessel_id = v.id
        WHERE b.deleted_at IS NULL
      `;
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND b.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }
      query += ' ORDER BY b.date DESC, b.id DESC';
      const [reports]: any = await pool.execute(query, params);

      const reportsWithFiles = [];
      for (const report of reports) {
        const [files]: any = await pool.execute(
          'SELECT id, filename, size FROM bunker_bdn_files WHERE report_id = ? AND deleted_at IS NULL',
          [report.id]
        );
        reportsWithFiles.push({
          id: String(report.id),
          vesselId: String(report.vessel_id),
          vesselName: report.vessel_name,
          date: report.date ? new Date(report.date).toISOString().split('T')[0] : '',
          bdnNumber: report.bdn_number,
          fuelType: report.fuel_type,
          quantity: report.quantity,
          supplier: report.supplier,
          viscosity: report.viscosity,
          density: report.density,
          sulfurContent: report.sulfur_content,
          remarks: report.remarks,
          files: files.map((f: any) => ({
            id: String(f.id),
            name: f.filename,
            size: f.size,
            dataUrl: `/api/bunker-bdn-files/${f.id}`
          }))
        });
      }
      res.json(reportsWithFiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/bunker-bdn-files/:id', authenticate, async (req, res) => {
    try {
      const [files]: any = await pool.execute(
        'SELECT * FROM bunker_bdn_files WHERE id = ? AND deleted_at IS NULL',
        [req.params.id]
      );
      if (files.length > 0 && files[0].data) {
        const file = files[0];
        const retrievedData = await handleFileRetrieve(file.data);
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/bunker-bdn-reports', authenticate, async (req: any, res) => {
    const {
      vesselId,
      date,
      bdnNumber,
      fuelType,
      quantity,
      supplier,
      viscosity,
      density,
      sulfurContent,
      remarks,
      files
    } = req.body;
    try {
      const [result]: any = await pool.execute(
        `INSERT INTO bunker_bdn_reports (
          vessel_id, date, bdn_number, fuel_type, quantity,
          supplier, viscosity, density, sulfur_content, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vesselId ?? null,
          date ?? null,
          bdnNumber ?? null,
          fuelType ?? null,
          quantity ?? null,
          supplier ?? null,
          viscosity ?? null,
          density ?? null,
          sulfurContent ?? null,
          remarks ?? null
        ]
      );
      const reportId = result.insertId;

      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            const parsed = parseBase64DataUrl(file.dataUrl);
            if (parsed) {
              const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'bunker-bdn');
              await pool.execute(
                'INSERT INTO bunker_bdn_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
                [reportId, file.name, file.size, parsed.mimetype, finalBuffer]
              );
            }
          }
        }
      }
      await logAudit(req.user.id, req.user.username, 'CREATE_BUNKER_BDN_REPORT', `Created Bunker BDN report ID ${reportId}`);
      res.status(201).json({ success: true, id: reportId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/bunker-bdn-reports/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      vesselId,
      date,
      bdnNumber,
      fuelType,
      quantity,
      supplier,
      viscosity,
      density,
      sulfurContent,
      remarks,
      files
    } = req.body;
    try {
      await pool.execute(
        `UPDATE bunker_bdn_reports SET 
          vessel_id = ?, date = ?, bdn_number = ?, fuel_type = ?, quantity = ?, 
          supplier = ?, viscosity = ?, density = ?, sulfur_content = ?, remarks = ?
         WHERE id = ?`,
        [
          vesselId ?? null,
          date ?? null,
          bdnNumber ?? null,
          fuelType ?? null,
          quantity ?? null,
          supplier ?? null,
          viscosity ?? null,
          density ?? null,
          sulfurContent ?? null,
          remarks ?? null,
          id
        ]
      );

      const keptFileIds: string[] = [];
      const newFilesToUpload = [];
      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.id) {
            keptFileIds.push(file.id);
          } else if (file.dataUrl && file.dataUrl.startsWith('data:')) {
            newFilesToUpload.push(file);
          }
        }
      }

      if (keptFileIds.length > 0) {
        const placeholders = keptFileIds.map(() => '?').join(',');
        await pool.execute(
          `UPDATE bunker_bdn_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
          [id, ...keptFileIds]
        );
      } else {
        await pool.execute('UPDATE bunker_bdn_files SET deleted_at = CURRENT_TIMESTAMP WHERE report_id = ? AND deleted_at IS NULL', [id]);
      }

      for (const file of newFilesToUpload) {
        const parsed = parseBase64DataUrl(file.dataUrl);
        if (parsed) {
          const finalBuffer = await handleFileUpload(file.name, parsed.mimetype, parsed.buffer, 'bunker-bdn');
          await pool.execute(
            'INSERT INTO bunker_bdn_files (report_id, filename, size, mimetype, data) VALUES (?, ?, ?, ?, ?)',
            [id, file.name, file.size, parsed.mimetype, finalBuffer]
          );
        }
      }
      await logAudit(req.user.id, req.user.username, 'UPDATE_BUNKER_BDN_REPORT', `Updated Bunker BDN report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/bunker-bdn-reports/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE bunker_bdn_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_BUNKER_BDN_REPORT', `Soft deleted Bunker BDN report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // CREW MEMBERS ROUTES
  // ==========================================
  app.get('/api/crew-members', authenticate, async (req: any, res) => {
    try {
      let query = 'SELECT * FROM crew_members WHERE deleted_at IS NULL';
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND (vessel_id = ? OR vessel_id IS NULL OR vessel_id = "" OR vessel_id = "all" OR vessel_id = "any")';
        params.push(String(req.user.vessel_id));
      }
      query += ' ORDER BY created_at DESC';
      const [members]: any = await pool.execute(query, params);
      res.json(members.map((m: any) => {
        let photoUrl = m.photo || '';
        if (photoUrl && !photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
          const tokenStr = req.query.token || req.headers.authorization?.split(' ')[1] || '';
          photoUrl = `/api/crew-members/${m.id}/photo?token=${tokenStr}`;
        }
        return {
          id: m.id,
          name: m.name,
          rank: m.rank_name,
          nationality: m.nationality || 'Unknown',
          signOnDate: m.sign_on_date ? new Date(m.sign_on_date).toISOString().split('T')[0] : '',
          passportNo: m.passport_no || 'N/A',
          seamanBookNo: m.seaman_book_no || 'N/A',
          status: m.status || 'Compliant',
          contractDuration: m.contract_duration,
          nextMedicalExam: m.next_medical_exam ? new Date(m.next_medical_exam).toISOString().split('T')[0] : '',
          nextSafetyTraining: m.next_safety_training ? new Date(m.next_safety_training).toISOString().split('T')[0] : '',
          vesselId: m.vessel_id || '',
          birthdate: m.birthdate ? new Date(m.birthdate).toISOString().split('T')[0] : '',
          contactNumber: m.contact_number || '',
          photo: photoUrl,
          hiringStatus: m.hiring_status || 'for rehire',
          siComments: m.si_comments || '',
          extensionsCount: m.extensions_count || 0,
          contractEndDate: m.contract_end_date ? new Date(m.contract_end_date).toISOString().split('T')[0] : ''
        };
      }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/crew-members/:id/photo', authenticate, async (req: any, res) => {
    try {
      const [rows]: any = await pool.execute('SELECT photo FROM crew_members WHERE id = ?', [req.params.id]);
      if (rows.length === 0 || !rows[0].photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      const photoStr = rows[0].photo;
      if (photoStr.startsWith('B2_KEY:')) {
        const retrievedData = await handleFileRetrieve(Buffer.from(photoStr));
        const b2Key = photoStr.slice(7);
        const ext = b2Key.split('.').pop() || 'jpeg';
        res.setHeader('Content-Type', `image/${ext === 'jpg' ? 'jpeg' : ext}`);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        return res.send(retrievedData);
      } else if (photoStr.startsWith('data:')) {
        const parsed = parseBase64DataUrl(photoStr);
        if (parsed) {
          res.setHeader('Content-Type', parsed.mimetype);
          return res.send(parsed.buffer);
        }
      }
      
      if (photoStr.startsWith('http://') || photoStr.startsWith('https://')) {
        return res.redirect(photoStr);
      }
      
      return res.status(404).json({ error: 'Photo not found' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/crew-members', authenticate, async (req: any, res) => {
    const {
      id, name, rank, nationality, signOnDate, passportNo, seamanBookNo,
      status, contractDuration, nextMedicalExam, nextSafetyTraining, vesselId,
      birthdate, contactNumber, photo, hiringStatus, siComments, extensionsCount, contractEndDate
    } = req.body;
    try {
      let finalPhoto = photo || '';
      if (photo && photo.startsWith('data:')) {
        const parsed = parseBase64DataUrl(photo);
        if (parsed) {
          try {
            const extension = parsed.mimetype.split('/')[1] || 'png';
            const filename = `${id || 'crew'}_photo.${extension}`;
            const uploadResult = await handleFileUpload(filename, parsed.mimetype, parsed.buffer, 'crew_photos');
            if (uploadResult.toString().startsWith('B2_KEY:')) {
              finalPhoto = uploadResult.toString();
            }
          } catch (err) {
            console.error('Failed to upload crew photo to B2 during create:', err);
          }
        }
      }

      await pool.execute(
        `INSERT INTO crew_members (
          id, name, rank_name, nationality, sign_on_date, passport_no, seaman_book_no,
          status, contract_duration, next_medical_exam, next_safety_training, vessel_id,
          birthdate, contact_number, photo, hiring_status, si_comments, extensions_count, contract_end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, name, rank, nationality || 'Filipino', signOnDate || null, passportNo || 'N/A', seamanBookNo || 'N/A',
          status || 'Compliant', contractDuration || null, nextMedicalExam || null, nextSafetyTraining || null, vesselId || '',
          birthdate || null, contactNumber || '', finalPhoto, hiringStatus || 'for rehire', siComments || '',
          extensionsCount || 0, contractEndDate || null
        ]
      );
      await logAudit(req.user.id, req.user.username, 'CREATE_CREW_MEMBER', `Created crew member ID ${id}`);
      res.status(201).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/crew-members/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      name, rank, nationality, signOnDate, passportNo, seamanBookNo,
      status, contractDuration, nextMedicalExam, nextSafetyTraining, vesselId,
      birthdate, contactNumber, photo, hiringStatus, siComments, extensionsCount, contractEndDate
    } = req.body;
    try {
      let finalPhoto = photo || '';
      if (photo && (photo.startsWith('/api/crew-members/') || photo.includes('/photo?token='))) {
        // Keep existing photo from database
        const [existing]: any = await pool.execute('SELECT photo FROM crew_members WHERE id = ?', [id]);
        if (existing.length > 0) {
          finalPhoto = existing[0].photo || '';
        }
      } else if (photo && photo.startsWith('data:')) {
        const parsed = parseBase64DataUrl(photo);
        if (parsed) {
          try {
            const extension = parsed.mimetype.split('/')[1] || 'png';
            const filename = `${id}_photo.${extension}`;
            const uploadResult = await handleFileUpload(filename, parsed.mimetype, parsed.buffer, 'crew_photos');
            if (uploadResult.toString().startsWith('B2_KEY:')) {
              finalPhoto = uploadResult.toString();
            }
          } catch (err) {
            console.error('Failed to upload crew photo to B2 during update:', err);
          }
        }
      }

      await pool.execute(
        `UPDATE crew_members SET 
          name = ?, rank_name = ?, nationality = ?, sign_on_date = ?, passport_no = ?, seaman_book_no = ?,
          status = ?, contract_duration = ?, next_medical_exam = ?, next_safety_training = ?, vessel_id = ?,
          birthdate = ?, contact_number = ?, photo = ?, hiring_status = ?, si_comments = ?,
          extensions_count = ?, contract_end_date = ?
         WHERE id = ?`,
        [
          name, rank, nationality || 'Filipino', signOnDate || null, passportNo || 'N/A', seamanBookNo || 'N/A',
          status || 'Compliant', contractDuration || null, nextMedicalExam || null, nextSafetyTraining || null, vesselId || '',
          birthdate || null, contactNumber || '', finalPhoto, hiringStatus || 'for rehire', siComments || '',
          extensionsCount || 0, contractEndDate || null,
          id
        ]
      );
      await logAudit(req.user.id, req.user.username, 'UPDATE_CREW_MEMBER', `Updated crew member ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/crew-members/:id/profile', authenticate, async (req: any, res) => {
    try {
      await pool.execute(
        'UPDATE crew_members SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
        [req.params.id]
      );
      await logAudit(req.user.id, req.user.username, 'DELETE_CREW_MEMBER_PROFILE', `Soft deleted crew member profile ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/crew-members/:id', authenticate, async (req: any, res) => {
    try {
      if (req.query.mode === 'profile' || req.query.permanent === 'true') {
        await pool.execute(
          'UPDATE crew_members SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
          [req.params.id]
        );
        await logAudit(req.user.id, req.user.username, 'DELETE_CREW_MEMBER_PROFILE', `Soft deleted crew member profile ID ${req.params.id}`);
        return res.json({ success: true });
      }
      await pool.execute(
        `UPDATE crew_members SET 
          vessel_id = '', 
          sign_on_date = NULL, 
          contract_end_date = NULL, 
          contract_duration = 0, 
          extensions_count = 0 
         WHERE id = ?`, 
        [req.params.id]
      );
      await logAudit(req.user.id, req.user.username, 'REMOVE_CREW_MEMBER_TO_POOL', `Returned crew member ID ${req.params.id} to Global Pool and ended contract`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/crew-members/:id/history', authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      const [history]: any = await pool.execute(
        'SELECT * FROM crew_history WHERE crew_id = ? ORDER BY disembark_date DESC, created_at DESC',
        [id]
      );
      res.json(history.map((h: any) => ({
        id: h.id,
        crewId: h.crew_id,
        vesselId: h.vessel_id,
        vesselName: h.vessel_name || 'Unassigned',
        rank: h.rank_name || 'N/A',
        signOnDate: h.sign_on_date ? new Date(h.sign_on_date).toISOString().split('T')[0] : '',
        disembarkDate: h.disembark_date ? new Date(h.disembark_date).toISOString().split('T')[0] : '',
        remarks: h.remarks || '',
        ageAtContract: h.age_at_contract,
        contactAtContract: h.contact_at_contract || ''
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/crew-members/:id/disembark', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { finishedContract, remarks } = req.body;
    try {
      const [members]: any = await pool.execute('SELECT * FROM crew_members WHERE id = ?', [id]);
      if (members.length === 0) {
        return res.status(404).json({ error: 'Crew member not found' });
      }
      const m = members[0];

      const disembarkDate = new Date().toISOString().split('T')[0];
      const signOnDate = m.sign_on_date ? new Date(m.sign_on_date).toISOString().split('T')[0] : null;
      const contractRemarks = finishedContract ? 'Finished Contract' : remarks;

      let vesselName = 'Unassigned';
      if (m.vessel_id) {
        const [vessels]: any = await pool.execute('SELECT name FROM vessels WHERE id = ?', [m.vessel_id]);
        if (vessels.length > 0) {
          vesselName = vessels[0].name;
        }
      }

      let ageAtContract: number | null = null;
      if (m.birthdate && signOnDate) {
        const bdate = new Date(m.birthdate);
        const sdate = new Date(signOnDate);
        let age = sdate.getFullYear() - bdate.getFullYear();
        const monthDiff = sdate.getMonth() - bdate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && sdate.getDate() < bdate.getDate())) {
          age--;
        }
        ageAtContract = age;
      }
      const contactAtContract = m.contact_number || '';

      const historyId = 'ch_' + Math.random().toString(36).substring(2, 11);
      await pool.execute(
        `INSERT INTO crew_history (
          id, crew_id, vessel_id, vessel_name, rank_name, sign_on_date, disembark_date, remarks, age_at_contract, contact_at_contract
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyId, id, m.vessel_id || '', vesselName, m.rank_name, signOnDate, disembarkDate, contractRemarks, ageAtContract, contactAtContract
        ]
      );

      await pool.execute(
        `UPDATE crew_members SET 
          vessel_id = '', 
          sign_on_date = NULL, 
          contract_end_date = NULL, 
          extensions_count = 0 
         WHERE id = ?`,
        [id]
      );

      await logAudit(req.user.id, req.user.username, 'DISEMBARK_CREW_MEMBER', `Crew member ID ${id} disembarked from vessel ${vesselName}. Remarks: ${contractRemarks}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // AUDIT RECORDS ROUTES
  // ==========================================
  app.get('/api/audit-records', authenticate, async (req: any, res) => {
    try {
      let query = 'SELECT * FROM audit_records WHERE deleted_at IS NULL';
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND vessel_id = ?';
        params.push(String(req.user.vessel_id));
      }
      query += ' ORDER BY date DESC';
      const [records]: any = await pool.execute(query, params);
      res.json(records.map((r: any) => ({
        id: r.id,
        type: r.type,
        vesselId: r.vessel_id,
        date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
        inspectorName: r.inspector_name,
        inspectorOrganization: r.inspector_organization,
        status: r.status,
        findingsCount: r.findings_count,
        scope: r.scope,
        reportFileName: r.report_file_name
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Upload report file for an audit record
  app.post('/api/audit-records/:id/report', authenticate, upload.single('file'), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { id } = req.params;
    try {
      const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'audits');
      await pool.execute(
        `UPDATE audit_records SET report_file_name = ?, report_file_mimetype = ?, report_file_data = ? WHERE id = ?`,
        [req.file.originalname, req.file.mimetype, uploadData, id]
      );
      await logAudit(req.user.id, req.user.username, 'UPLOAD_AUDIT_REPORT', `Uploaded audit report file: ${req.file.originalname} for audit record ID ${id}`);
      res.json({
        success: true,
        reportFileName: req.file.originalname
      });
    } catch (err: any) {
      console.error('Audit report file upload failed:', err);
      res.status(500).json({ error: 'Failed to save audit report file to database' });
    }
  });

  // Download/View report file for an audit record
  app.get('/api/audit-records/:id/report', authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.execute(
        'SELECT report_file_name, report_file_mimetype, report_file_data FROM audit_records WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      if (rows.length === 0 || !rows[0].report_file_data) {
        return res.status(404).json({ error: 'Report file not found or not uploaded' });
      }
      const record = rows[0];
      const retrievedData = await handleFileRetrieve(record.report_file_data);
      res.setHeader('Content-Type', record.report_file_mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.report_file_name)}"`);
      res.send(retrievedData);
    } catch (err: any) {
      console.error('Audit file retrieval failed:', err);
      res.status(500).json({ error: 'Failed to retrieve audit report' });
    }
  });

  // Remove report file from an audit record
  app.delete('/api/audit-records/:id/report', authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      await pool.execute(
        `UPDATE audit_records SET report_file_name = NULL, report_file_mimetype = NULL, report_file_data = NULL WHERE id = ?`,
        [id]
      );
      await logAudit(req.user.id, req.user.username, 'DELETE_AUDIT_REPORT', `Deleted audit report for audit record ID ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete audit report failed:', err);
      res.status(500).json({ error: 'Failed to delete audit report' });
    }
  });

  app.post('/api/audit-records', authenticate, async (req: any, res) => {
    const {
      id, type, vesselId, date, inspectorName, inspectorOrganization, status, findingsCount, scope
    } = req.body;
    try {
      await pool.execute(
        `INSERT INTO audit_records (
          id, type, vessel_id, date, inspector_name, inspector_organization, status, findings_count, scope
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, type, vesselId, date, inspectorName, inspectorOrganization, status, findingsCount, scope]
      );
      await logAudit(req.user.id, req.user.username, 'CREATE_AUDIT_RECORD', `Created Audit Record ID ${id}`);
      res.status(201).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/audit-records/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      type, vesselId, date, inspectorName, inspectorOrganization, status, findingsCount, scope
    } = req.body;
    try {
      await pool.execute(
        `UPDATE audit_records SET 
          type = ?, vessel_id = ?, date = ?, inspector_name = ?, inspector_organization = ?, 
          status = ?, findings_count = ?, scope = ?
         WHERE id = ?`,
        [type, vesselId, date, inspectorName, inspectorOrganization, status, findingsCount, scope, id]
      );
      await logAudit(req.user.id, req.user.username, 'UPDATE_AUDIT_RECORD', `Updated Audit Record ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/audit-records/:id/comments', authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.execute(
        'SELECT * FROM audit_comments WHERE audit_id = ? ORDER BY created_at ASC',
        [id]
      );
      res.json(rows.map((r: any) => ({
        id: r.id,
        auditId: r.audit_id,
        author: r.author,
        authorEmail: r.author_email,
        commentText: r.comment_text,
        createdAt: r.created_at
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/audit-records/:id/comments', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { commentText } = req.body;
    if (!commentText || commentText.trim() === '') {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    const commentId = 'c_' + Date.now();
    const author = req.user.name || req.user.username || 'System User';
    const authorEmail = req.user.email || 'user@example.com';
    try {
      await pool.execute(
        `INSERT INTO audit_comments (id, audit_id, author, author_email, comment_text)
         VALUES (?, ?, ?, ?, ?)`,
        [commentId, id, author, authorEmail, commentText]
      );
      await logAudit(req.user.id, req.user.username, 'ADD_AUDIT_COMMENT', `Added comment to Audit Record ID ${id}`);
      res.status(201).json({
        id: commentId,
        auditId: id,
        author,
        authorEmail,
        commentText,
        createdAt: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/audit-records/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE audit_records SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'DELETE_AUDIT_RECORD', `Soft deleted Audit Record ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // NON-CONFORMITIES ROUTES
  // ==========================================
  app.get('/api/non-conformities', authenticate, async (req: any, res) => {
    try {
      let query = 'SELECT * FROM non_conformities WHERE deleted_at IS NULL';
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND vessel_id = ?';
        params.push(String(req.user.vessel_id));
      }
      query += ' ORDER BY raised_date DESC';
      const [records]: any = await pool.execute(query, params);
      res.json(records.map((nc: any) => ({
        id: nc.id,
        auditId: nc.audit_id,
        vesselId: nc.vessel_id,
        sourceType: nc.source_type,
        category: nc.category,
        description: nc.description,
        raisedDate: nc.raised_date ? new Date(nc.raised_date).toISOString().split('T')[0] : '',
        dueDate: nc.due_date ? new Date(nc.due_date).toISOString().split('T')[0] : '',
        closeoutDate: nc.closeout_date ? new Date(nc.closeout_date).toISOString().split('T')[0] : undefined,
        status: nc.status,
        actionPlan: nc.action_plan,
        inspectorName: nc.inspector_name
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/non-conformities', authenticate, async (req: any, res) => {
    const {
      id, auditId, vesselId, sourceType, category, description, raisedDate, dueDate, closeoutDate, status, actionPlan, inspectorName
    } = req.body;
    try {
      await pool.execute(
        `INSERT INTO non_conformities (
          id, audit_id, vessel_id, source_type, category, description, raised_date, due_date, closeout_date, status, action_plan, inspector_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, auditId, vesselId, sourceType, category, description, raisedDate, dueDate, closeoutDate || null, status, actionPlan, inspectorName]
      );
      await logAudit(req.user.id, req.user.username, 'CREATE_NC', `Created Non-Conformity ID ${id}`);
      res.status(201).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/non-conformities/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      auditId, vesselId, sourceType, category, description, raisedDate, dueDate, closeoutDate, status, actionPlan, inspectorName
    } = req.body;
    try {
      await pool.execute(
        `UPDATE non_conformities SET 
          audit_id = ?, vessel_id = ?, source_type = ?, category = ?, description = ?, 
          raised_date = ?, due_date = ?, closeout_date = ?, status = ?, action_plan = ?, inspector_name = ?
         WHERE id = ?`,
        [auditId, vesselId, sourceType, category, description, raisedDate, dueDate, closeoutDate || null, status, actionPlan, inspectorName, id]
      );
      await logAudit(req.user.id, req.user.username, 'UPDATE_NC', `Updated Non-Conformity ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/non-conformities/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE non_conformities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'DELETE_NC', `Soft deleted Non-Conformity ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // TROUBLE REPORTS (DEFECTS) ROUTES
  // ==========================================
  app.get('/api/trouble-reports', authenticate, async (req: any, res) => {
    try {
      let query = `
        SELECT tr.*, v.name as vessel_name
        FROM trouble_reports tr
        JOIN vessels v ON tr.vessel_id = v.id
        WHERE tr.deleted_at IS NULL
      `;
      let params: any[] = [];
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' AND tr.vessel_id = ?';
        params.push(String(req.user.vessel_id));
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        query += ' AND v.team_id IN (?)';
        params.push(req.user.team_ids);
      }
      query += ' ORDER BY tr.date_found DESC, tr.id DESC';
      const [reports]: any = await pool.execute(query, params);

      res.json(reports.map((r: any) => ({
        id: r.id,
        vesselId: String(r.vessel_id),
        vesselName: r.vessel_name,
        deficiencyNumber: r.deficiency_number,
        dateFound: r.date_found ? new Date(r.date_found).toISOString().split('T')[0] : '',
        deficiency: r.deficiency,
        classification: r.classification,
        subClassification: r.sub_classification || undefined,
        othersDetail: r.others_detail || undefined,
        status: r.status,
        actionTaken: r.action_taken || undefined,
        dateResolved: r.date_resolved ? new Date(r.date_resolved).toISOString().split('T')[0] : undefined,
        reporterName: r.reporter_name,
        pmsCode: r.pms_code || undefined,
        rectificationFile: r.rectification_file_name ? {
          name: r.rectification_file_name,
          size: r.rectification_file_size || '0 KB',
          dataUrl: `/api/trouble-reports-files/${r.id}/rectification`
        } : undefined,
        comiFile: r.comi_file_name ? {
          name: r.comi_file_name,
          size: r.comi_file_size || '0 KB',
          dataUrl: `/api/trouble-reports-files/${r.id}/comi`
        } : undefined
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/trouble-reports-files/:id/:fileType', authenticate, async (req, res) => {
    const { id, fileType } = req.params;
    try {
      const fieldData = fileType === 'comi' ? 'comi_file_data' : 'rectification_file_data';
      const fieldName = fileType === 'comi' ? 'comi_file_name' : 'rectification_file_name';

      const [rows]: any = await pool.execute(
        `SELECT ${fieldName} as filename, ${fieldData} as val FROM trouble_reports WHERE id = ?`,
        [id]
      );
      if (rows.length > 0 && rows[0].val) {
        const file = rows[0];
        const retrievedData = await handleFileRetrieve(file.val);
        const mimetype = file.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        res.setHeader('Content-Type', mimetype);
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
        res.send(retrievedData);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/trouble-reports', authenticate, async (req: any, res) => {
    const {
      id, vesselId, deficiencyNumber, dateFound, deficiency, classification,
      subClassification, othersDetail, status, actionTaken, dateResolved, reporterName, pmsCode,
      rectificationFile, comiFile
    } = req.body;

    try {
      let rectDataBuffer: any = null;
      let comiDataBuffer: any = null;

      if (rectificationFile && rectificationFile.dataUrl && rectificationFile.dataUrl.startsWith('data:')) {
        const parsed = parseBase64DataUrl(rectificationFile.dataUrl);
        if (parsed) {
          rectDataBuffer = await handleFileUpload(rectificationFile.name, parsed.mimetype, parsed.buffer, 'defects');
        }
      }
      if (comiFile && comiFile.dataUrl && comiFile.dataUrl.startsWith('data:')) {
        const parsed = parseBase64DataUrl(comiFile.dataUrl);
        if (parsed) {
          comiDataBuffer = await handleFileUpload(comiFile.name, parsed.mimetype, parsed.buffer, 'defects');
        }
      }

      await pool.execute(
        `INSERT INTO trouble_reports (
          id, vessel_id, deficiency_number, date_found, deficiency, classification,
          sub_classification, others_detail, status, action_taken, date_resolved, reporter_name, pms_code,
          rectification_file_name, rectification_file_size, rectification_file_data,
          comi_file_name, comi_file_size, comi_file_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, vesselId, deficiencyNumber, dateFound, deficiency, classification,
          subClassification || null, othersDetail || null, status, actionTaken || null, dateResolved || null, reporterName, pmsCode || null,
          rectificationFile ? rectificationFile.name : null, rectificationFile ? rectificationFile.size : null, rectDataBuffer,
          comiFile ? comiFile.name : null, comiFile ? comiFile.size : null, comiDataBuffer
        ]
      );

      await logAudit(req.user.id, req.user.username, 'CREATE_TROUBLE_REPORT', `Created Trouble Report ID ${id}`);
      res.status(201).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/trouble-reports/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    const {
      vesselId, deficiencyNumber, dateFound, deficiency, classification,
      subClassification, othersDetail, status, actionTaken, dateResolved, reporterName, pmsCode,
      rectificationFile, comiFile
    } = req.body;

    try {
      const [existing]: any = await pool.execute(
        'SELECT rectification_file_name, rectification_file_size, rectification_file_data, comi_file_name, comi_file_size, comi_file_data FROM trouble_reports WHERE id = ?',
        [id]
      );

      let rectName = existing[0]?.rectification_file_name || null;
      let rectSize = existing[0]?.rectification_file_size || null;
      let rectData = existing[0]?.rectification_file_data || null;

      let comiName = existing[0]?.comi_file_name || null;
      let comiSize = existing[0]?.comi_file_size || null;
      let comiData = existing[0]?.comi_file_data || null;

      if (rectificationFile) {
        if (rectificationFile.dataUrl) {
          if (rectificationFile.dataUrl.startsWith('data:')) {
            const parsed = parseBase64DataUrl(rectificationFile.dataUrl);
            if (parsed) {
              rectName = rectificationFile.name;
              rectSize = rectificationFile.size;
              rectData = await handleFileUpload(rectificationFile.name, parsed.mimetype, parsed.buffer, 'defects');
            }
          }
        } else {
          rectName = rectificationFile.name;
          rectSize = rectificationFile.size;
        }
      } else {
        rectName = null; rectSize = null; rectData = null;
      }

      if (comiFile) {
        if (comiFile.dataUrl) {
          if (comiFile.dataUrl.startsWith('data:')) {
            const parsed = parseBase64DataUrl(comiFile.dataUrl);
            if (parsed) {
              comiName = comiFile.name;
              comiSize = comiFile.size;
              comiData = await handleFileUpload(comiFile.name, parsed.mimetype, parsed.buffer, 'defects');
            }
          }
        } else {
          comiName = comiFile.name;
          comiSize = comiFile.size;
        }
      } else {
        comiName = null; comiSize = null; comiData = null;
      }

      await pool.execute(
        `UPDATE trouble_reports SET 
          vessel_id = ?, deficiency_number = ?, date_found = ?, deficiency = ?, classification = ?,
          sub_classification = ?, others_detail = ?, status = ?, action_taken = ?, date_resolved = ?, reporter_name = ?, pms_code = ?,
          rectification_file_name = ?, rectification_file_size = ?, rectification_file_data = ?,
          comi_file_name = ?, comi_file_size = ?, comi_file_data = ?
         WHERE id = ?`,
        [
          vesselId, deficiencyNumber, dateFound, deficiency, classification,
          subClassification || null, othersDetail || null, status, actionTaken || null, dateResolved || null, reporterName, pmsCode || null,
          rectName, rectSize, rectData,
          comiName, comiSize, comiData,
          id
        ]
      );

      await logAudit(req.user.id, req.user.username, 'UPDATE_TROUBLE_REPORT', `Updated trouble report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/trouble-reports/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE trouble_reports SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_TROUBLE_REPORT', `Soft deleted trouble report ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // SPARE PARTS REQUISITIONS ROUTES
  // ==========================================
  app.get('/api/spare-parts-requisitions', authenticate, async (req: any, res) => {
    const { storageKey } = req.query;
    try {
      let query = 'SELECT * FROM spare_parts_requisitions WHERE deleted_at IS NULL';
      let params: any[] = [];
      if (storageKey) {
        query += ' AND storage_key = ?';
        params.push(storageKey);
      }
      const [rows]: any = await pool.execute(query, params);
      
      const parsedList = rows.map((r: any) => {
        try {
          const parsed = JSON.parse(r.data_json);
          parsed.id = r.id; 
          return parsed;
        } catch (err) {
          return null;
        }
      }).filter(Boolean);

      let filtered = parsedList;
      if (req.user.role === 'vessel' && req.user.vessel_id) {
        filtered = parsedList.filter((x: any) => String(x.vesselId) === String(req.user.vessel_id));
      } else if (req.user.role === 'team_pic' || req.user.role === 'user') {
        const [vessels]: any = await pool.execute('SELECT id FROM vessels WHERE team_id IN (?)', [req.user.team_ids]);
        const vesselIds = vessels.map((v: any) => String(v.id));
        filtered = parsedList.filter((x: any) => vesselIds.includes(String(x.vesselId)));
      }

      res.json(filtered);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/spare-parts-requisitions', authenticate, async (req: any, res) => {
    try {
      // Direct body is data, query storageKey contains target sheet
      const payload = req.body;
      const id = payload.id;
      const storageKey = req.query.storageKey || payload.storageKey || 'comos_spare_requisitions';
      const dataStr = JSON.stringify(payload);
      
      await pool.execute(
        'INSERT INTO spare_parts_requisitions (id, storage_key, data_json) VALUES (?, ?, ?)',
        [id, storageKey, dataStr]
      );
      await logAudit(req.user.id, req.user.username, 'CREATE_REQUISITION', `Created Requisition ID ${id} under ${storageKey}`);
      res.status(201).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/spare-parts-requisitions/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      const payload = req.body;
      const storageKey = req.query.storageKey || payload.storageKey || 'comos_spare_requisitions';
      const dataStr = JSON.stringify(payload);

      await pool.execute(
        'UPDATE spare_parts_requisitions SET storage_key = ?, data_json = ? WHERE id = ?',
        [storageKey, dataStr, id]
      );
      await logAudit(req.user.id, req.user.username, 'UPDATE_REQUISITION', `Updated Requisition ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/spare-parts-requisitions/:id', authenticate, async (req: any, res) => {
    try {
      await pool.execute('UPDATE spare_parts_requisitions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'SOFT_DELETE_REQUISITION', `Deleted Requisition ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/requisition-attachments/upload', authenticate, upload.single('file'), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
      const uploadData = await handleFileUpload(req.file.originalname, req.file.mimetype, req.file.buffer, 'requisition_attachments');
      const sizeStr = req.file.size > 1024 * 1024 
        ? `${(req.file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(req.file.size / 1024).toFixed(0)} KB`;

      const [result]: any = await pool.execute(
        'INSERT INTO requisition_attachments (filename, size, mimetype, data) VALUES (?, ?, ?, ?)',
        [req.file.originalname, sizeStr, req.file.mimetype, uploadData]
      );
      
      const insertId = result.insertId;
      const dataUrl = `/api/requisition-attachments/${insertId}`;

      res.status(201).json({
        success: true,
        file: {
          name: req.file.originalname,
          size: sizeStr,
          dataUrl: dataUrl,
          uploadedAt: Date.now()
        }
      });
    } catch (e: any) {
      console.error('Requisition attachment upload failed:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/requisition-attachments/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.execute(
        'SELECT filename, mimetype, data FROM requisition_attachments WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Attachment not found' });
      }
      const file = rows[0];
      const retrievedData = await handleFileRetrieve(file.data);
      res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(retrievedData);
    } catch (e: any) {
      console.error('Failed to download requisition attachment:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/requisition-attachments/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      await pool.execute(
        'UPDATE requisition_attachments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to soft delete requisition attachment:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // LEGACY DOCUMENT (.doc / .xls / .ppt) PARSER ROUTE
  // ==========================================
  const wordExtractorInstance = new WordExtractor();

  app.post('/api/document/parse-doc', multer({ limits: { fileSize: 50 * 1024 * 1024 } }).single('file'), async (req: express.Request, res: express.Response) => {
    try {
      let fileBuffer: Buffer | null = null;
      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer;
      } else if (req.body && req.body.base64) {
        const rawBase64 = req.body.base64.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(rawBase64, 'base64');
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'No file buffer or base64 provided' });
      }

      try {
        const extracted = await wordExtractorInstance.extract(fileBuffer);
        const body = extracted.getBody() || '';
        const headers = extracted.getHeaders() || '';
        const footers = extracted.getFooters() || '';
        const annotations = extracted.getAnnotations() || '';

        // Extract clean paragraphs
        const rawParagraphs = body
          .split(/\r?\n/)
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0);

        return res.json({
          success: true,
          body,
          headers,
          footers,
          annotations,
          paragraphs: rawParagraphs,
          wordCount: body.trim() ? body.trim().split(/\s+/).length : 0,
          charCount: body.length
        });
      } catch (extractorErr: any) {
        console.warn('WordExtractor primary parsing error, attempting binary fallback:', extractorErr.message);

        // Binary fallback text extractor for Word 97-2004 CFBF / raw binary streams
        const strAscii = fileBuffer.toString('latin1');
        // Filter readable text runs
        const matches = strAscii.match(/[\x20-\x7E\t\r\n]{4,}/g) || [];
        const filteredText = matches
          .map(m => m.trim())
          .filter(m => m.length > 3 && !m.startsWith('Root Entry') && !m.startsWith('WordDocument') && !m.startsWith('CompObj'))
          .join('\n\n');

        const paragraphs = filteredText
          .split(/\r?\n+/)
          .map(p => p.trim())
          .filter(p => p.length > 0);

        return res.json({
          success: true,
          body: filteredText,
          headers: '',
          footers: '',
          annotations: '',
          paragraphs,
          wordCount: filteredText.trim() ? filteredText.trim().split(/\s+/).length : 0,
          charCount: filteredText.length,
          fallback: true
        });
      }
    } catch (err: any) {
      console.error('Error parsing legacy .doc file:', err);
      res.status(500).json({ error: err.message || 'Failed to parse legacy document' });
    }
  });

  // Server-side DOCX Parser using Mammoth
  app.post('/api/document/parse-docx', multer({ limits: { fileSize: 50 * 1024 * 1024 } }).single('file'), async (req: express.Request, res: express.Response) => {
    try {
      let fileBuffer: Buffer | null = null;
      if (req.file && req.file.buffer) {
        fileBuffer = req.file.buffer;
      } else if (req.body && req.body.base64) {
        const rawBase64 = req.body.base64.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(rawBase64, 'base64');
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'No DOCX file buffer or base64 provided' });
      }

      const result = await mammoth.convertToHtml(
        { buffer: fileBuffer },
        {
          convertImage: mammoth.images.dataUri,
          includeDefaultStyleMap: true
        }
      );

      const rawTextResult = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = rawTextResult.value || '';
      const paragraphs = text.split(/\r?\n+/).map(p => p.trim()).filter(p => p.length > 0);

      return res.json({
        success: true,
        html: result.value,
        text,
        paragraphs,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
        charCount: text.length,
        messages: result.messages
      });
    } catch (err: any) {
      console.error('Error parsing DOCX file with Mammoth:', err);
      res.status(500).json({ error: err.message || 'Failed to parse DOCX document' });
    }
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large (max 20MB)' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    console.error('Unhandled Error:', err);
    if (req.path.startsWith('/api')) {
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack 
      });
    }
    next(err);
  });

  app.get('/api/admin/system-time', authenticate, (req, res) => {
    res.json({ 
      time: new Date().toLocaleString(),
      timezone: process.env.TZ || 'Not set (Defaulting to UTC)'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    // Catch-all for /api routes that weren't handled - MUST be before vite.middlewares
    app.all('/api/*', (req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist', {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=UTF-8');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        } else if (filePath.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml; charset=UTF-8');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.ico')) {
          res.setHeader('Content-Type', 'image/x-icon');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json; charset=UTF-8');
        }
      }
    }));
    // Catch-all for /api routes in production
    app.all('/api/*', (req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error('FAILED TO START SERVER:', err);
  process.exit(1);
});
