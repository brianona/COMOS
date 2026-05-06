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
import nodemailer from 'nodemailer';
import { addDays, isBefore, format } from 'date-fns';
import net from 'net';
import { google } from 'googleapis';

const __dirname = path.resolve();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'vessel-cert-secret-key';

async function startServer() {
  console.log('Starting server initialization...');
  const app = express();
  
  let pool: mysql.Pool | null = null;
  let dbError: string | null = null;

  try {
    console.log('Initializing MySQL connection pool...');
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'vessel_cert',
      port: Number(process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
    
    // Test connection and initialize tables
    console.log('Initializing database tables...');
    await pool.query('SELECT 1'); // Simple connection test
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      )
    `);

    await pool.query(`
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
    } catch (e: any) {
      console.error('Error during users table migration:', e.message);
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
        photo_data LONGBLOB,
        photo_mimetype VARCHAR(255),
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

    // Seed default settings if missing
    const [settingRows]: any = await pool.query('SELECT COUNT(*) as count FROM settings');
    if (settingRows[0].count === 0) {
      const defaultSettings = [
        ['SMTP_HOST', process.env.SMTP_HOST || ''],
        ['SMTP_PORT', process.env.SMTP_PORT || '587'],
        ['SMTP_USER', process.env.SMTP_USER || ''],
        ['SMTP_PASS', process.env.SMTP_PASS || ''],
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
    } else {
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (attachment_id) REFERENCES noon_attachments(id) ON DELETE SET NULL
      )
    `);

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

    // Migration for existing databases: ensure new keys exist
      const newKeys = [
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
      await pool.execute("UPDATE teams SET name = 'Team A' WHERE name = 'Team Alpha'");
      await pool.execute("UPDATE teams SET name = 'Team B' WHERE name = 'Team Beta'");
      await pool.execute("UPDATE teams SET name = 'Team C' WHERE name = 'Team Delta'");
      await pool.execute("UPDATE teams SET name = 'Team D' WHERE name = 'Team Gamma'");
    }
    console.log('Database initialized successfully.');
  } catch (err: any) {
    console.error('DATABASE INITIALIZATION FAILED:', err);
    dbError = err.message;
    if (pool) (pool as any)._dbErrorCode = err.code;
    // We don't exit anymore, allowing the server to start and show errors
  }

  // File Upload Setup (Database-backed)
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  });
  
  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
      
      // Quick TCP check for port 3306
      let tcpCheck = 'PENDING';
      try {
        tcpCheck = await new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(2000);
          socket.on('connect', () => { socket.destroy(); resolve('OPEN'); });
          socket.on('timeout', () => { socket.destroy(); resolve('TIMEOUT'); });
          socket.on('error', (err) => { socket.destroy(); resolve(`ERROR: ${err.message}`); });
          socket.connect(port, host);
        }) as string;
      } catch (e: any) {
        tcpCheck = `EXCEPTION: ${e.message}`;
      }

      res.json({ 
        connected: !!pool && !dbError,
        error: dbError,
        errorCode: (pool as any)?._dbErrorCode || null,
        tcpStatus: tcpCheck,
        webStatus: 'SKIPPED',
        outboundIp: 'DISABLED',
        config: {
          host,
          user: process.env.DB_USER || 'root',
          database: process.env.DB_NAME || 'vessel_cert',
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

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  const isTeamPicOrAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'team_pic') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  const canAddCertificate = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'team_pic' && req.user.role !== 'vessel') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };

  const logAudit = async (userId: number | null, username: string | null, action: string, details: string) => {
    try {
      await pool.execute('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)', [userId, username, action, details]);
    } catch (err) {
      console.error('Failed to log audit:', err);
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
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, team_ids: teamIds, vessel_id: user.vessel_id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, team_ids: teamIds, vessel_id: user.vessel_id } });
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

  app.post('/api/admin/test-smtp', authenticate, isAdmin, async (req, res) => {
    const { host, port, user, pass, from } = req.body;
    console.log(`Testing SMTP: ${host}:${port} as ${user}`);
    
    // Quick TCP check to see if the port is even reachable
    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); reject(new Error('Connection timed out while checking SMTP port availability (5000ms). This often happens if the hosting provider (like Render) blocks outbound ports like 25, 465, or 587.')); });
        socket.on('error', (err) => { socket.destroy(); reject(new Error(`Failed to reach SMTP host: ${err.message}`)); });
        socket.connect(Number(port), host);
      });
    } catch (tcpErr: any) {
      console.error('SMTP Port Check Failed:', tcpErr.message);
      return res.status(500).json({ error: tcpErr.message });
    }

    const testTransporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    try {
      console.log('Verifying SMTP transporter...');
      await testTransporter.verify();
      console.log('SMTP verification succeeded. Attempting to send test mail...');
      
      const currentUser = (req as any).user;
      // Use setting from as fallback, then user, then destination email
      const fromEmail = from || user;
      const toEmail = currentUser.email || (currentUser.username.includes('@') ? currentUser.username : user);
      
      if (!toEmail || !toEmail.includes('@')) {
        throw new Error(`Invalid recipient email address: "${toEmail}". Please ensure your user profile has a valid email address.`);
      }

      await testTransporter.sendMail({
        from: `"COMOS Test" <${fromEmail}>`,
        to: toEmail,
        subject: 'SMTP Connection Test',
        text: 'If you are reading this, your SMTP settings are working correctly!'
      });
      
      console.log('Test email sent successfully to:', toEmail);
      res.json({ success: true });
    } catch (e: any) {
      console.error('SMTP Test Failed Detailed Error:', e);
      res.status(500).json({ 
        error: e.message || 'Unknown SMTP error',
        code: e.code,
        command: e.command
      });
    }
  });

  // Team Routes
  app.get('/api/teams', authenticate, async (req, res) => {
    const [teams] = await pool.query('SELECT * FROM teams');
    res.json(teams);
  });

  // User Routes (Admin)
  app.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const [users]: any = await pool.query('SELECT id, username, role, vessel_id, email FROM users');
    const usersWithTeams = await Promise.all(users.map(async (u: any) => {
      const [teams]: any = await pool.execute('SELECT team_id FROM user_teams WHERE user_id = ?', [u.id]);
      return { ...u, team_ids: teams.map((t: any) => t.team_id) };
    }));
    res.json(usersWithTeams);
  });

  app.post('/api/users/change-password', authenticate, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
      const [rows]: any = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
      if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
      if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/users', authenticate, isAdmin, async (req, res) => {
    const { username, password, role, team_ids, vessel_id, email } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result]: any = await conn.execute('INSERT INTO users (username, password, role, vessel_id, email) VALUES (?, ?, ?, ?, ?)', [username, hashedPassword, role || 'user', vessel_id || null, email || null]);
      const userId = result.insertId;
      
      if (team_ids && Array.isArray(team_ids)) {
        for (const teamId of team_ids) {
          await conn.execute('INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)', [userId, teamId]);
        }
      }
      
      await conn.commit();
      await logAudit((req as any).user.id, (req as any).user.username, 'CREATE_USER', `Created user: ${username} with role ${role}`);
      res.json({ success: true });
    } catch (e: any) {
      await conn.rollback();
      res.status(400).json({ error: e.message });
    } finally {
      conn.release();
    }
  });

  app.put('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    const { username, team_ids, role, password, vessel_id, email } = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        await conn.execute('UPDATE users SET username = ?, role = ?, password = ?, vessel_id = ?, email = ? WHERE id = ?', [username, role, hashedPassword, vessel_id || null, email || null, req.params.id]);
      } else {
        await conn.execute('UPDATE users SET username = ?, role = ?, vessel_id = ?, email = ? WHERE id = ?', [username, role, vessel_id || null, email || null, req.params.id]);
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
      [vessels] = await pool.query('SELECT v.id, v.name, v.team_id, v.owner, v.next_port, v.route_status, v.eta_atb, v.etd_atd, v.cargo, t.name as team_name, (v.photo_data IS NOT NULL) as has_photo FROM vessels v LEFT JOIN teams t ON v.team_id = t.id');
    } else if (req.user.role === 'vessel') {
      const vesselId = req.user.vessel_id;
      if (!vesselId) {
        return res.json([]);
      }
      [vessels] = await pool.execute('SELECT v.id, v.name, v.team_id, v.owner, v.next_port, v.route_status, v.eta_atb, v.etd_atd, v.cargo, t.name as team_name, (v.photo_data IS NOT NULL) as has_photo FROM vessels v LEFT JOIN teams t ON v.team_id = t.id WHERE v.id = ?', [vesselId]);
    } else {
      const teamIds = req.user.team_ids || [];
      if (teamIds.length === 0) {
        return res.json([]);
      }
      const placeholders = teamIds.map(() => '?').join(',');
      [vessels] = await pool.execute(`SELECT v.id, v.name, v.team_id, v.owner, v.next_port, v.route_status, v.eta_atb, v.etd_atd, v.cargo, t.name as team_name, (v.photo_data IS NOT NULL) as has_photo FROM vessels v LEFT JOIN teams t ON v.team_id = t.id WHERE v.team_id IN (${placeholders})`, teamIds);
    }
    res.json(vessels);
  });

  app.get('/api/vessels/:id/photo', authenticate, async (req, res) => {
    try {
      const [rows]: any = await pool.execute('SELECT photo_data, photo_mimetype FROM vessels WHERE id = ?', [req.params.id]);
      if (rows.length === 0 || !rows[0].photo_data) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      res.setHeader('Content-Type', rows[0].photo_mimetype || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(rows[0].photo_data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/vessels', authenticate, isTeamPicOrAdmin, upload.single('photo'), async (req: any, res) => {
    const { name, team_id, owner } = req.body;
    try {
      // If team_pic, they can only add to their own teams
      if (req.user.role === 'team_pic' && team_id && !req.user.team_ids.includes(Number(team_id))) {
        return res.status(403).json({ error: 'You can only add vessels to your assigned teams' });
      }
      
      const photoData = req.file ? req.file.buffer : null;
      const photoMimetype = req.file ? req.file.mimetype : null;

      await pool.execute(
        'INSERT INTO vessels (name, team_id, owner, photo_data, photo_mimetype) VALUES (?, ?, ?, ?, ?)', 
        [name, team_id || null, owner || 'Nissen', photoData, photoMimetype]
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
    const { name, team_id, owner } = req.body;
    try {
      const [vessels]: any = await pool.execute('SELECT team_id FROM vessels WHERE id = ?', [req.params.id]);
      if (vessels.length === 0) return res.status(404).json({ error: 'Vessel not found' });
      
      if (req.user.role === 'team_pic') {
        const oldTeamId = vessels[0].team_id;
        if (!req.user.team_ids.includes(oldTeamId)) return res.status(403).json({ error: 'Forbidden' });
        if (team_id && !req.user.team_ids.includes(Number(team_id))) return res.status(403).json({ error: 'Forbidden' });
      }

      const photoData = req.file ? req.file.buffer : undefined;
      const photoMimetype = req.file ? req.file.mimetype : undefined;

      if (photoData !== undefined) {
        await pool.execute(
          'UPDATE vessels SET name = ?, team_id = ?, owner = ?, photo_data = ?, photo_mimetype = ? WHERE id = ?', 
          [name, team_id || null, owner, photoData, photoMimetype, req.params.id]
        );
      } else {
        await pool.execute(
          'UPDATE vessels SET name = ?, team_id = ?, owner = ? WHERE id = ?', 
          [name, team_id || null, owner, req.params.id]
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

  app.put('/api/vessels/:id/route', authenticate, async (req: any, res) => {
    const { next_port, route_status, eta_atb, etd_atd, cargo } = req.body;
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
        'UPDATE vessels SET next_port = ?, route_status = ?, eta_atb = ?, etd_atd = ?, cargo = ? WHERE id = ?',
        [next_port || null, route_status || null, eta_atb || null, etd_atd || null, cargo || null, req.params.id]
      );

      await logAudit(req.user.id, req.user.username, 'UPDATE_VESSEL_ROUTE', `Updated route for vessel ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/vessels/:id', authenticate, isAdmin, async (req: any, res) => {
    try {
      const [vesselRows]: any = await pool.execute('SELECT name FROM vessels WHERE id = ?', [req.params.id]);
      const vesselName = vesselRows.length > 0 ? vesselRows[0].name : 'Unknown';

      // Manual cascade for certificates, notes, and files
      const [certs]: any = await pool.execute('SELECT id FROM certificates WHERE vessel_id = ?', [req.params.id]);
      for (const cert of certs) {
        await pool.execute('DELETE FROM notes WHERE certificate_id = ?', [cert.id]);
        await pool.execute('DELETE FROM files WHERE certificate_id = ?', [cert.id]);
      }
      await pool.execute('DELETE FROM certificates WHERE vessel_id = ?', [req.params.id]);
      await pool.execute('DELETE FROM vessels WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'DELETE_VESSEL', `Deleted vessel: ${vesselName} (ID: ${req.params.id})`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Delete vessel error:', e);
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
      (SELECT COUNT(*) FROM files f WHERE f.certificate_id = c.id) > 0 as has_file
      FROM certificates c 
      LEFT JOIN vessels v ON c.vessel_id = v.id
      JOIN teams t ON c.team_id = t.id
    `;
    let params: any[] = [];
    if (req.user.role === 'vessel') {
      query += ` WHERE c.vessel_id = ? AND c.access_type IN ('vessel', 'any')`;
      params = [req.user.vessel_id];
    } else if (req.user.role === 'user') {
      const teamIds = req.user.team_ids || [];
      if (teamIds.length === 0) {
        return res.json([]);
      }
      const placeholders = teamIds.map(() => '?').join(',');
      query += ` WHERE c.team_id IN (${placeholders}) AND c.access_type IN ('office', 'vessel', 'any')`;
      params = teamIds;
    }
    const [certs] = await pool.execute(query, params);
    res.json(certs);
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

      if (req.user.role === 'team_pic') {
        if (team_id && !req.user.team_ids.includes(Number(team_id))) return res.status(403).json({ error: 'Forbidden' });
        if (vessel_id && vessel_id !== 'all') {
          const [vRows]: any = await pool.execute('SELECT team_id FROM vessels WHERE id = ?', [vessel_id]);
          if (vRows.length > 0 && !req.user.team_ids.includes(vRows[0].team_id)) return res.status(403).json({ error: 'Forbidden' });
        }
        if (vessel_id === 'all') return res.status(403).json({ error: 'Team PIC cannot add certificates to all vessels' });
      }
      const finalAccessType = access_type || 'office';
      const finalDateIssued = date_issued || null;
      const finalCertNumber = certificate_number || null;
      
      const saveFile = async (certId: number) => {
        if (req.file) {
          await pool.execute(
            'INSERT INTO files (certificate_id, filename, original_name, mimetype, data) VALUES (?, ?, ?, ?, ?)', 
            [certId, req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
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

      if (req.user.role === 'admin') {
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

  app.delete('/api/users/:id', authenticate, isAdmin, async (req: any, res) => {
    try {
      // Manual cascade for notes
      await pool.execute('DELETE FROM notes WHERE user_id = ?', [req.params.id]);
      await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
      await logAudit((req as any).user.id, (req as any).user.username, 'DELETE_USER', `Deleted user ID ${req.params.id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Delete user error:', e);
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/certificates/:id', authenticate, isTeamPicOrAdmin, async (req: any, res) => {
    try {
      const [certRows]: any = await pool.execute('SELECT name, team_id FROM certificates WHERE id = ?', [req.params.id]);
      if (certRows.length === 0) return res.status(404).json({ error: 'Certificate not found' });
      const cert = certRows[0];

      if (req.user.role === 'team_pic') {
        if (!req.user.team_ids.includes(cert.team_id)) return res.status(403).json({ error: 'Forbidden' });
      }
      // Manual cascade for notes and files
      await pool.execute('DELETE FROM notes WHERE certificate_id = ?', [req.params.id]);
      await pool.execute('DELETE FROM files WHERE certificate_id = ?', [req.params.id]);
      await pool.execute('DELETE FROM certificates WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'DELETE_CERTIFICATE', `Deleted certificate: ${cert.name} (ID: ${req.params.id})`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Delete certificate error:', e);
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/admin/audit-logs', authenticate, isAdmin, async (req, res) => {
    try {
      const [logs] = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000');
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
      WHERE n.certificate_id = ? 
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
    const [files] = await pool.execute('SELECT id, certificate_id, filename, original_name, mimetype, upload_date FROM files WHERE certificate_id = ?', [req.params.id]);
    res.json(files);
  });

  app.post('/api/certificates/:id/files', authenticate, upload.single('file'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const [insertResult]: any = await pool.execute(
        'INSERT INTO files (certificate_id, filename, original_name, mimetype, data) VALUES (?, ?, ?, ?, ?)', 
        [req.params.id, req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
      );
      await logAudit(req.user.id, req.user.username, 'UPLOAD_FILE', `Uploaded file: ${req.file.originalname} to certificate ID ${req.params.id}`);
      res.json({ 
        id: insertResult.insertId,
        certificate_id: Number(req.params.id),
        filename: req.file.originalname,
        original_name: req.file.originalname,
        mimetype: req.file.mimetype,
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
      const [files]: any = await pool.execute('SELECT * FROM files WHERE filename = ? ORDER BY id DESC LIMIT 1', [req.params.filename]);
      
      if (files.length > 0 && files[0].data) {
        const file = files[0];
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        // Add headers to help with PDF preview issues
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
        res.send(file.data);
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
      if (req.user.role === 'team_pic') {
        const [files]: any = await pool.execute('SELECT c.team_id FROM files f JOIN certificates c ON f.certificate_id = c.id WHERE f.id = ?', [req.params.id]);
        if (files.length > 0 && !req.user.team_ids.includes(files[0].team_id)) return res.status(403).json({ error: 'Forbidden' });
      }
      // Delete from database
      await pool.execute('DELETE FROM files WHERE id = ?', [req.params.id]);
      await logAudit(req.user.id, req.user.username, 'DELETE_FILE', `Deleted file ID ${req.params.id}`);
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
      `;
      let params: any[] = [];

      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' WHERE dr.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic') {
        query += ' WHERE v.team_id IN (?)';
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
        const [result]: any = await pool.execute(
          'INSERT INTO departure_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
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
      let attachmentId = req.body.attachment_id || null;

      if (req.file) {
        const [result]: any = await pool.execute(
          'INSERT INTO departure_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
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
      const [attachments]: any = await pool.execute('SELECT * FROM departure_attachments WHERE id = ?', [req.params.id]);
      if (attachments.length > 0 && attachments[0].data) {
        const file = attachments[0];
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        res.send(file.data);
      } else {
        res.status(404).json({ error: 'Attachment not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/arrival-attachments/:id', authenticate, async (req, res) => {
    try {
      const [attachments]: any = await pool.execute('SELECT * FROM arrival_attachments WHERE id = ?', [req.params.id]);
      if (attachments.length > 0 && attachments[0].data) {
        const file = attachments[0];
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        res.send(file.data);
      } else {
        res.status(404).json({ error: 'Attachment not found' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/noon-attachments/:id', authenticate, async (req, res) => {
    try {
      const [attachments]: any = await pool.execute('SELECT * FROM noon_attachments WHERE id = ?', [req.params.id]);
      if (attachments.length > 0 && attachments[0].data) {
        const file = attachments[0];
        res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
        res.send(file.data);
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
      `;
      let params: any[] = [];

      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' WHERE ar.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic') {
        query += ' WHERE v.team_id IN (?)';
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
        const [result]: any = await pool.execute(
          'INSERT INTO arrival_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
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
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to create arrival report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/arrival-reports/:id', authenticate, upload.single('report_file'), async (req: any, res) => {
    try {
      const { id } = req.params;
      let attachmentId = req.body.attachment_id || null;

      if (req.file) {
        const [result]: any = await pool.execute(
          'INSERT INTO arrival_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
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
      `;
      let params: any[] = [];

      if (req.user.role === 'vessel' && req.user.vessel_id) {
        query += ' WHERE nr.vessel_id = ?';
        params.push(req.user.vessel_id);
      } else if (req.user.role === 'team_pic') {
        query += ' WHERE v.team_id IN (?)';
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
        foc_mdo
      } = req.body;

      if (!vessel_id) {
        return res.status(400).json({ error: 'Vessel ID is required' });
      }

      let attachmentId = null;
      if (req.file) {
        console.log('Processing attachment for noon report:', req.file.originalname);
        const [result]: any = await pool.execute(
          'INSERT INTO noon_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
        );
        attachmentId = result.insertId;
      }

      await pool.execute(`
        INSERT INTO noon_reports (
          vessel_id, user_id, voyage_number, utc_date_time, position_long, position_lat,
          distance_to_go, cargo_status, rob_hsfo, rob_lsfo, rob_mgo, rob_mdo,
          foc_hsfo, foc_lsfo, foc_mgo, foc_mdo, attachment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        vessel_id, req.user.id, voyage_number, utc_date_time, position_long, position_lat,
        distance_to_go, cargo_status, 
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0,
        foc_hsfo || 0, foc_lsfo || 0, foc_mgo || 0, foc_mdo || 0,
        attachmentId
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
        foc_mdo
      } = req.body;

      let attachmentId = null;
      if (req.file) {
        const [result]: any = await pool.execute(
          'INSERT INTO noon_attachments (filename, original_name, mimetype, data) VALUES (?, ?, ?, ?)',
          [req.file.originalname, req.file.originalname, req.file.mimetype, req.file.buffer]
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
          foc_mgo = ?, foc_mdo = ?, attachment_id = ?
        WHERE id = ?
      `, [
        voyage_number, utc_date_time, position_long, position_lat,
        distance_to_go, cargo_status, 
        rob_hsfo || 0, rob_lsfo || 0, rob_mgo || 0, rob_mdo || 0,
        foc_hsfo || 0, foc_lsfo || 0, foc_mgo || 0, foc_mdo || 0,
        attachmentId, id
      ]);

      await logAudit(req.user.id, req.user.username, 'UPDATE_NOON_REPORT', `Updated noon report ID ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Failed to update noon report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Email Alert Logic
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

  async function getTransporter() {
    const settings = await getSmtpSettings();
    if (!settings || !settings.SMTP_HOST) {
      console.warn('SMTP_HOST is missing in settings. Email alerts will not be sent.');
      return null;
    }

    return nodemailer.createTransport({
      host: settings.SMTP_HOST,
      port: Number(settings.SMTP_PORT) || 587,
      secure: Number(settings.SMTP_PORT) === 465,
      auth: {
        user: settings.SMTP_USER,
        pass: settings.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });
  }

  // Verify SMTP connection on startup with enhanced diagnostics
  async function verifySmtpOnStartup() {
    const settings = await getSmtpSettings();
    if (settings && settings.SMTP_HOST) {
      const host = settings.SMTP_HOST;
      const port = Number(settings.SMTP_PORT) || 587;
      
      console.log(`[SMTP Diagnostic] Testing connectivity to ${host}:${port}...`);
      
      const socket = net.connect(port, host, () => {
        console.log(`[SMTP Diagnostic] TCP Connection to ${host}:${port} successful!`);
        socket.destroy();
        
        console.log(`[SMTP Diagnostic] Now verifying SMTP protocol...`);
        getTransporter().then(transporter => {
          if (!transporter) return;
          transporter.verify((error) => {
            if (error) {
              console.error('SMTP Protocol Error:', error);
            } else {
              console.log('SMTP Server is ready to take our messages');
            }
          });
        });
      });

      socket.on('error', (err) => {
        console.error(`[SMTP Diagnostic] TCP Connection to ${host}:${port} FAILED:`, err.message);
      });

      socket.setTimeout(10000, () => {
        socket.destroy();
        console.error(`[SMTP Diagnostic] TCP Connection to ${host}:${port} TIMED OUT after 10s.`);
      });
    }
  }
  verifySmtpOnStartup();

  // Certificate Expiration Check Logic
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

  async function checkExpirations(targetType?: 'office' | 'vessel') {
    console.log(`Checking certificate expirations${targetType ? ` for ${targetType}` : ''}...`);
    try {
      let query = `
        SELECT c.*, COALESCE(v.name, 'General') as vessel_name, t.name as team_name
        FROM certificates c
        LEFT JOIN vessels v ON c.vessel_id = v.id
        JOIN teams t ON c.team_id = t.id
      `;
      
      let params: any[] = [];
      if (targetType === 'office') {
        query += " WHERE c.access_type IN (?, ?, ?)";
        params = ['office', 'any', 'vessel'];
      } else if (targetType === 'vessel') {
        query += " WHERE c.access_type IN (?, ?)";
        params = ['vessel', 'any'];
      }

      const [certs]: any = await pool.query(query, params);

      const today = new Date();
      const thirtyDaysFromNow = addDays(today, 30);

      // Group alerts by team and by vessel (for Ship certificates)
      const teamAlerts: Record<string, { teamName: string, alerts: any[] }> = {};
      const vesselAlerts: Record<number, { vesselName: string, alerts: any[], email: string | null }> = {};

      for (const cert of certs) {
        const expDate = new Date(cert.expiration_date);
        if (isBefore(expDate, thirtyDaysFromNow)) {
          const status = isBefore(expDate, today) ? 'EXPIRED' : 'EXPIRING SOON';
          const alertData = { ...cert, status };
          
          // Office/Any/Vessel certs go to team alerts for office check
          if (!targetType || targetType === 'office') {
            if (!teamAlerts[cert.team_id]) {
              teamAlerts[cert.team_id] = { teamName: cert.team_name, alerts: [] };
            }
            teamAlerts[cert.team_id].alerts.push(alertData);
          }

          // Vessel/Any certs go to vessel alerts if it's a vessel cert
          if ((!targetType || targetType === 'vessel') && (cert.access_type === 'vessel' || cert.access_type === 'any')) {
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
      }

      const settings = await getSmtpSettings();
      if (settings?.ENABLE_EMAIL_ALERTS === 'false') {
        console.log('Email alerts are disabled in settings.');
        await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Last check: ${new Date().toLocaleString()}. Alerts are disabled.`, 'LAST_ALERT_LOG']);
        return;
      }
      const alertRecipient = settings?.DESTINATION_EMAIL || 'IT@cleanocean.com.ph';
      const senderEmail = settings?.SMTP_FROM || settings?.SMTP_USER || 'alerts@vesselcert.com';

      if (settings && settings.SMTP_HOST && settings.SMTP_USER) {
        const transporter = await getTransporter();
        if (!transporter) {
          console.error('Could not initialize transporter for expiration alerts.');
          return;
        }

        // Send Team Alerts
        for (const teamId in teamAlerts) {
          const { teamName, alerts } = teamAlerts[teamId];
          if (alerts.length === 0) continue;
          await sendConsolidatedEmail(transporter, teamName, alerts, alertRecipient, senderEmail);
        }

        // Send Vessel Alerts
        for (const vesselId in vesselAlerts) {
          const { vesselName, alerts, email } = vesselAlerts[vesselId];
          if (alerts.length === 0 || !email) continue;
          await sendConsolidatedEmail(transporter, `Vessel: ${vesselName}`, alerts, email, senderEmail);
        }
      } else {
        console.warn('SMTP settings incomplete. Skipping email alerts.');
        await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Last check: ${new Date().toLocaleString()}. SMTP settings incomplete.`, 'LAST_ALERT_LOG']);
      }
      console.log('Certificate expiration check completed.');
    } catch (err) {
      console.error('Error during certificate expiration check:', err);
    }
  }

  async function sendConsolidatedEmail(transporter: any, name: string, alerts: any[], recipient: string, senderEmail: string) {
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
          <h2 style="color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px;">Certificate Expiration Alerts: ${name}</h2>
          <p>The following certificates for <b>${name}</b> require attention:</p>
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Vessel</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Certificate Name</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Expiration Date</th>
                <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <p style="margin-top: 30px; font-size: 0.85em; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px;">
            This is an automated notification from the <b>COMOS Vessel Certificate System</b>.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `"COMOS" <${senderEmail}>`,
        to: recipient,
        subject: `[COMOS] Certificate Alerts: ${name}`,
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
      
      if (!settings || !settings.SMTP_HOST || !settings.SMTP_USER) {
        return res.status(400).json({ 
          error: 'SMTP settings are incomplete. Please configure SMTP Host, User, and Password.' 
        });
      }

      const transporter = await getTransporter();
      if (!transporter) {
        return res.status(500).json({ error: 'Failed to initialize email transporter.' });
      }

      const alertRecipient = settings.DESTINATION_EMAIL || 'IT@cleanocean.com.ph';
      const senderEmail = settings.SMTP_FROM || settings.SMTP_USER || 'alerts@vesselcert.com';

      // Send a simple test email first to verify connectivity
      await transporter.sendMail({
        from: `"COMOS System Test" <${senderEmail}>`,
        to: alertRecipient,
        subject: '[COMOS] SMTP Configuration Test',
        text: `This is a test email from the COMOS Vessel Certificate System. If you are reading this, your SMTP settings for ${alertRecipient} are working correctly.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="background-color: #fff3cd; color: #856404; padding: 10px; border: 1px solid #ffeeba; border-radius: 5px; margin-bottom: 20px; text-align: center; font-weight: bold;">
              NOTICE: This system is currently in its TESTING PERIOD.
            </div>
            <h2 style="color: #2c3e50;">SMTP Configuration Test</h2>
            <p>This is a test email from the <b>COMOS Vessel Certificate System</b>.</p>
            <p>If you are reading this, your SMTP settings for <b>${alertRecipient}</b> are working correctly.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 0.8em; color: #7f8c8d;">Timestamp: ${new Date().toLocaleString()}</p>
          </div>
        `
      });

      // Also trigger the actual expiration check logic
      await checkExpirations();

      await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Manual Test: ${new Date().toLocaleString()}. Success.`, 'LAST_ALERT_LOG']);

      res.json({ message: `Test email sent successfully to ${alertRecipient}. Expiration check also triggered.` });
    } catch (error: any) {
      console.error('Manual email test failed:', error);
      await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [`Manual Test: ${new Date().toLocaleString()}. FAILED: ${error.message}`, 'LAST_ALERT_LOG']);
      res.status(500).json({ 
        error: 'Failed to send test email.', 
        details: error.message 
      });
    }
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    app.use(express.static('dist'));
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
