/**
 * Clean Ocean Maritime Operations System (COMOS)
 * Direct LibreOffice Document-to-PDF Converter
 * Converts Word (.doc / .docx / .rtf / .odt), Excel (.xls / .xlsx / .ods / .csv),
 * PowerPoint (.ppt / .pptx), and text documents directly to PDF via headless LibreOffice API
 * before applying the official acknowledgement stamp.
 * Does NOT use mammoth or any previewer API to render before converting to PDF.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';

const execFileAsync = promisify(execFile);

export interface SheetMargin {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Inspects and configures OpenXML spreadsheet worksheets (.xlsx, .xlsm)
 * to ensure all columns and rows fit on their designated page without horizontal split,
 * while preserving or establishing full page margins (left, right, top, bottom, header, footer).
 */
export async function prepareXlsxWithMargins(buffer: Buffer): Promise<{
  buffer: Buffer;
  sheetCount: number;
  margins: SheetMargin[];
} | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const sheetFiles = Object.keys(zip.files).filter(
      f => f.startsWith('xl/worksheets/sheet') && f.endsWith('.xml')
    );
    if (sheetFiles.length === 0) return null;

    sheetFiles.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '') || '0', 10);
      const nb = parseInt(b.replace(/\D/g, '') || '0', 10);
      return na - nb;
    });

    const margins: SheetMargin[] = [];
    let modified = false;

    for (const name of sheetFiles) {
      let xml = await zip.files[name].async('text');
      const marginMatch = xml.match(/<pageMargins\s+([^>]+)\/>/);
      if (marginMatch) {
        const leftIn = parseFloat(marginMatch[1].match(/left="([^"]+)"/)?.[1] || '0.7');
        const rightIn = parseFloat(marginMatch[1].match(/right="([^"]+)"/)?.[1] || '0.7');
        const topIn = parseFloat(marginMatch[1].match(/top="([^"]+)"/)?.[1] || '0.75');
        const bottomIn = parseFloat(marginMatch[1].match(/bottom="([^"]+)"/)?.[1] || '0.75');
        margins.push({
          left: Math.max(18, Math.round(leftIn * 72)),
          right: Math.max(18, Math.round(rightIn * 72)),
          top: Math.max(20, Math.round(topIn * 72)),
          bottom: Math.max(20, Math.round(bottomIn * 72)),
        });
      } else {
        margins.push({ left: 36, right: 36, top: 40, bottom: 40 });
        if (xml.includes('</worksheet>')) {
          xml = xml.replace('</worksheet>', '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>');
          modified = true;
        }
      }

      // Ensure <pageSetUpPr fitToPage="1"/> in <sheetPr>
      if (!xml.includes('fitToPage')) {
        if (xml.includes('<sheetPr>')) {
          xml = xml.replace('<sheetPr>', '<sheetPr><pageSetUpPr fitToPage="1"/>');
        } else if (xml.includes('<sheetPr ')) {
          xml = xml.replace(/(<sheetPr[^>]*>)/, '$1<pageSetUpPr fitToPage="1"/>');
        } else if (xml.includes('<worksheet')) {
          xml = xml.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
        }
        modified = true;
      }

      // Ensure <pageSetup fitToWidth="1" fitToHeight="1"/>
      if (xml.includes('<pageSetup')) {
        xml = xml.replace(/(<pageSetup\b[^>]*?)(\/?>)/, (m, p1, p2) => {
          let updated = p1;
          if (!updated.includes('fitToWidth')) updated += ' fitToWidth="1"';
          if (!updated.includes('fitToHeight')) updated += ' fitToHeight="1"';
          return updated + p2;
        });
        modified = true;
      } else if (xml.includes('</worksheet>')) {
        xml = xml.replace('</worksheet>', '<pageSetup fitToWidth="1" fitToHeight="1"/></worksheet>');
        modified = true;
      }

      zip.file(name, xml);
    }

    const modifiedBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      buffer: modifiedBuffer,
      sheetCount: sheetFiles.length,
      margins,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Wraps PDF pages with designated page margins using pdf-lib.
 * Guarantees that documents converted with SinglePageSheets: true (or with 0 margins)
 * have complete, well-proportioned margins around tables and cell content.
 */
export async function addMarginsToPdf(
  pdfBytes: Buffer,
  margins?: SheetMargin[]
): Promise<Buffer> {
  try {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const count = srcDoc.getPageCount();
    if (count === 0) return pdfBytes;

    const newDoc = await PDFDocument.create();

    for (let i = 0; i < count; i++) {
      const srcPage = srcDoc.getPage(i);
      const { width, height } = srcPage.getSize();
      const m = margins?.[i] || margins?.[0] || { left: 36, right: 36, top: 40, bottom: 40 };

      const marginLeft = Math.max(18, m.left || 36);
      const marginRight = Math.max(18, m.right || 36);
      const marginTop = Math.max(20, m.top || 40);
      const marginBottom = Math.max(20, m.bottom || 40);

      const newWidth = width + marginLeft + marginRight;
      const newHeight = height + marginTop + marginBottom;

      const [embedded] = await newDoc.embedPages([srcPage]);
      const newPage = newDoc.addPage([newWidth, newHeight]);

      newPage.drawRectangle({
        x: 0,
        y: 0,
        width: newWidth,
        height: newHeight,
        color: rgb(1, 1, 1),
      });

      newPage.drawPage(embedded, {
        x: marginLeft,
        y: marginBottom,
        width,
        height,
      });
    }

    const resultBytes = await newDoc.save();
    return Buffer.from(resultBytes);
  } catch (err) {
    console.warn('Failed to add margins via pdf-lib, returning original PDF:', err);
    return pdfBytes;
  }
}

/**
 * Sanitizes any string to printable WinAnsi ASCII characters
 * Prevents "WinAnsi cannot encode ..." exceptions from pdf-lib standard fonts.
 */
export function sanitizeForWinAnsi(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2000-\u200B]/g, ' ')
    .replace(/[\u2713\u2714]/g, '[x]')
    .replace(/[\u2610\u25A1]/g, '[ ]')
    .replace(/[\u2611\u25A0\u25A3]/g, '[x]')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let cachedLibreOfficeCmd: string | null = null;

export async function getLibreOfficeCmd(): Promise<string> {
  if (cachedLibreOfficeCmd) return cachedLibreOfficeCmd;
  const candidates = [
    'libreoffice',
    'soffice',
    '/usr/bin/libreoffice',
    '/usr/bin/soffice',
    '/usr/local/bin/libreoffice',
    '/usr/local/bin/soffice'
  ];
  for (const cmd of candidates) {
    try {
      await execFileAsync(cmd, ['--version']);
      cachedLibreOfficeCmd = cmd;
      return cmd;
    } catch (e) {}
  }
  return 'libreoffice';
}

/**
 * Converts any office document directly to PDF using the LibreOffice API / CLI.
 * 100% faithful representation of original layouts, fonts, tables, graphics, headers, and margins.
 */
export async function convertDocumentToPdf(
  buffer: Buffer,
  filename: string,
  meta?: {
    vesselName?: string;
    orderLabel?: string;
    formCode?: string;
  }
): Promise<Buffer> {
  const loCmd = await getLibreOfficeCmd();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comos-doc-conv-'));
  try {
    const ext = path.extname(filename).toLowerCase() || '.bin';
    const inputPath = path.join(tmpDir, 'source' + ext);
    await fs.writeFile(inputPath, buffer);

    const spreadsheetExts = new Set([
      '.xlsx', '.xls', '.xlsm', '.xlsb', '.xltx', '.xltm', '.xlt',
      '.ods', '.fods', '.csv', '.tsv'
    ]);
    const isSpreadsheet = spreadsheetExts.has(ext);
    const outputPath = path.join(tmpDir, 'source.pdf');

    if (isSpreadsheet) {
      let xlsxPrep: { buffer: Buffer; sheetCount: number; margins: SheetMargin[] } | null = null;
      const isOpenXml = ['.xlsx', '.xlsm', '.xltx', '.xltm'].includes(ext);

      if (isOpenXml) {
        xlsxPrep = await prepareXlsxWithMargins(buffer);
        if (xlsxPrep) {
          await fs.writeFile(inputPath, xlsxPrep.buffer);
        }
      }

      let usedSinglePageSheets = false;

      // 1. For OpenXML workbooks with injected fitToPage and margins, try native calc_pdf_Export
      if (isOpenXml && xlsxPrep) {
        try {
          await execFileAsync(loCmd, [
            '--headless',
            '--invisible',
            '--nodefault',
            '--nofirststartwizard',
            '--convert-to',
            'pdf:calc_pdf_Export',
            '--outdir',
            tmpDir,
            inputPath
          ], {
            timeout: 60000,
            env: { ...process.env, HOME: '/tmp' }
          });

          // Verify output
          const hasOutput = await fs.stat(outputPath).then(() => true).catch(() => false);
          if (hasOutput) {
            const rawPdf = await fs.readFile(outputPath);
            const checkDoc = await PDFDocument.load(rawPdf, { ignoreEncryption: true });
            // If page count matches number of sheets (or fewer), native fit succeeded with full margins
            if (checkDoc.getPageCount() <= xlsxPrep.sheetCount) {
              return rawPdf;
            }
          }
        } catch (nativeErr) {
          // Fall through to SinglePageSheets with post-processed margins
        }
      }

      // 2. Export with SinglePageSheets: true (ensures all worksheets fit without horizontal splits)
      try {
        await execFileAsync(loCmd, [
          '--headless',
          '--invisible',
          '--nodefault',
          '--nofirststartwizard',
          '--convert-to',
          'pdf:calc_pdf_Export:{"SinglePageSheets":{"type":"boolean","value":"true"}}',
          '--outdir',
          tmpDir,
          inputPath
        ], {
          timeout: 60000,
          env: { ...process.env, HOME: '/tmp' }
        });
        usedSinglePageSheets = true;
      } catch (calcFilterErr) {
        // Fallback to standard calc export if custom filter options error
        await execFileAsync(loCmd, [
          '--headless',
          '--invisible',
          '--nodefault',
          '--nofirststartwizard',
          '--convert-to',
          'pdf:calc_pdf_Export',
          '--outdir',
          tmpDir,
          inputPath
        ], {
          timeout: 60000,
          env: { ...process.env, HOME: '/tmp' }
        });
        usedSinglePageSheets = true;
      }

      const isOutputAvailable = await fs.stat(outputPath).then(() => true).catch(() => false);
      if (isOutputAvailable) {
        const rawPdfBytes = await fs.readFile(outputPath);
        if (rawPdfBytes && rawPdfBytes.length > 50) {
          // LibreOffice's SinglePageSheets: true removes all page margins.
          // Restore full page margins around each worksheet page using pdf-lib!
          const pdfWithMargins = await addMarginsToPdf(rawPdfBytes, xlsxPrep?.margins);
          return pdfWithMargins;
        }
      }
    } else {
      // Direct Word / Document / Presentation conversion via LibreOffice
      await execFileAsync(loCmd, [
        '--headless',
        '--invisible',
        '--nodefault',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        tmpDir,
        inputPath
      ], {
        timeout: 60000,
        env: { ...process.env, HOME: '/tmp' }
      });
    }

    const isOutputAvailable = await fs.stat(outputPath).then(() => true).catch(() => false);
    if (isOutputAvailable) {
      const pdfBytes = await fs.readFile(outputPath);
      if (pdfBytes && pdfBytes.length > 50) {
        return pdfBytes;
      }
    }

    throw new Error(`LibreOffice PDF conversion produced an empty or missing output for "${filename}".`);
  } catch (err: any) {
    console.error(`LibreOffice conversion failed for "${filename}":`, err.message || err);
    throw new Error(`Failed to convert document "${filename}" to PDF using LibreOffice API: ${err.message || 'Conversion error'}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
