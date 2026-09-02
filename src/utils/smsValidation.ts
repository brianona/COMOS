import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker if in browser
const PDF_JS_VERSION = '5.6.205';
if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Could not set pdfjs workerSrc:', e);
  }
}

export interface FormValidationTarget {
  id?: string | number;
  form_id?: string;
  formCode?: string;
  form_code?: string;
  description?: string;
  formDate?: string;
  form_date?: string;
  category?: string;
  isHira?: boolean;
  is_hira?: boolean;
  removeFilenameRestriction?: boolean;
  remove_filename_restriction?: boolean;
  allowedFileTypes?: string[];
  allowed_file_types?: string[];
  templateFileName?: string;
  template_file_name?: string;
}

export interface ValidationResult {
  matched: boolean;
  reason?: string;
  content?: string;
  arrayBuffer?: ArrayBuffer;
  details?: {
    codeMatched: boolean;
    descMatched: boolean;
    dateMatched: boolean;
    fileTypeMatched: boolean;
    filenameCodeMatched: boolean;
  };
}

export const safeReadFileAsArrayBuffer = async (file: File, cachedBuffer?: ArrayBuffer): Promise<ArrayBuffer> => {
  if (cachedBuffer && cachedBuffer.byteLength > 0) {
    return cachedBuffer.slice(0);
  }
  // Attempt 1: Direct file.arrayBuffer()
  try {
    const buf = await file.arrayBuffer();
    if (buf && buf.byteLength > 0) return buf;
  } catch (e) {
    console.warn(`file.arrayBuffer() failed for ${file.name}, trying FileReader fallback...`, e);
  }

  // Attempt 2: FileReader API
  try {
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsArrayBuffer(file);
    });
    if (buf && buf.byteLength > 0) return buf;
  } catch (e) {
    console.warn(`FileReader failed for ${file.name}, trying Blob slice fallback...`, e);
  }

  // Attempt 3: Blob slice arrayBuffer
  try {
    const sliced = file.slice(0, file.size, file.type);
    const buf = await sliced.arrayBuffer();
    if (buf && buf.byteLength > 0) return buf;
  } catch (e) {
    console.warn(`Blob slice failed for ${file.name}:`, e);
  }

  throw new Error(`Local File Access Error: Could not read file "${file.name}". The browser reference to this file expired or was restricted by your operating system. Please re-select this form.`);
};

export const extractLegacyOfficeText = async (file: File, cachedBuffer?: ArrayBuffer): Promise<string> => {
  const buffer = await safeReadFileAsArrayBuffer(file, cachedBuffer);
  const bytes = new Uint8Array(buffer);
  
  let result = '';
  let tempWord = '';
  
  for (let i = 0; i < bytes.length; i++) {
    const charCode = bytes[i];
    if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
      tempWord += String.fromCharCode(charCode);
    } else {
      if (tempWord.length >= 2) {
        result += tempWord + ' ';
      }
      tempWord = '';
    }
  }
  if (tempWord.length >= 2) {
    result += tempWord;
  }
  
  let utf16Result = '';
  let utf16Temp = '';
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const charCode = bytes[i] + (bytes[i + 1] << 8);
    if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
      utf16Temp += String.fromCharCode(charCode);
    } else {
      if (utf16Temp.length >= 2) {
        utf16Result += utf16Temp + ' ';
      }
      utf16Temp = '';
    }
  }
  if (utf16Temp.length >= 2) {
    utf16Result += utf16Temp;
  }
  
  return result + ' ' + utf16Result;
};

export const extractTextFromFile = async (file: File, cachedBuffer?: ArrayBuffer): Promise<string> => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'pdf') {
    try {
      const arrayBuffer = await safeReadFileAsArrayBuffer(file, cachedBuffer);
      const data = new Uint8Array(arrayBuffer.slice(0));
      const loadingTask = pdfjsLib.getDocument({
        data,
        isEvalSupported: false,
        useSystemFonts: true,
        stopAtErrors: false
      });
      const pdfDoc = await Promise.race([
        loadingTask.promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF parsing timeout')), 4000))
      ]);
      let extractedText = '';
      const maxPages = Math.min(pdfDoc.numPages, 3);
      for (let p = 1; p <= maxPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        extractedText += pageText + ' ';
      }
      return extractedText;
    } catch (e: any) {
      console.warn('PDF parsing fallback for file:', file.name, e?.message || e);
      return new Promise((resolve) => {
        try {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsText(file.slice(0, 50 * 1024));
        } catch (err) {
          resolve('');
        }
      });
    }
  } else if (ext === 'docx' || ext === 'xlsx') {
    try {
      const arrayBuffer = await safeReadFileAsArrayBuffer(file, cachedBuffer);
      const zip = await JSZip.loadAsync(arrayBuffer.slice(0));
      let combinedText = '';
      const files = Object.keys(zip.files);
      for (const filename of files) {
        if (filename.endsWith('.xml')) {
          try {
            const text = await zip.files[filename].async('text');
            combinedText += text.replace(/<[^>]+>/g, ' ') + ' ';
          } catch (e) {
            // ignore
          }
        }
      }
      return combinedText;
    } catch (e) {
      console.error('Error parsing Office file:', e);
      return '';
    }
  } else if (ext === 'doc' || ext === 'xls') {
    try {
      return await extractLegacyOfficeText(file, cachedBuffer);
    } catch (e) {
      console.error('Error parsing legacy Office file:', e);
      return '';
    }
  } else {
    if (cachedBuffer && cachedBuffer.byteLength > 0) {
      try {
        return new TextDecoder('utf-8', { fatal: false }).decode(cachedBuffer.slice(0));
      } catch (e) {
        // fallback
      }
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve((ev.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  }
};

export const isDescriptionMatched = (fileText: string, formDescription?: string): boolean => {
  if (!formDescription || !formDescription.trim()) return true;
  const upperText = fileText.toUpperCase();
  const upperDesc = formDescription.toUpperCase();
  
  // 1. Direct clean substring match
  const cleanText = upperText.replace(/AND/g, '').replace(/[^A-Z0-9]/g, '');
  const cleanDesc = upperDesc.replace(/AND/g, '').replace(/[^A-Z0-9]/g, '');
  
  if (cleanText.includes(cleanDesc)) {
    return true;
  }

  const stopWords = new Set(['AND', 'THE', 'FOR', 'WITH', 'FROM', 'AND/OR', 'OF', 'IN', 'ON', 'AT', 'TO', 'BY', 'OR']);
  const descWords = upperDesc
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w));
    
  if (descWords.length === 0) return true;
  
  const fileWords = new Set(
    upperText
      .replace(/[^A-Z0-9\s]/g, ' ')
      .split(/\s+/)
  );

  // 2. Department conflicts (e.g., DECK vs ENGINE vs GALLEY vs CATERING)
  const deptKeywords = ['DECK', 'ENGINE', 'GALLEY', 'CATERING', 'RADIO'];
  const descDepts = deptKeywords.filter(k => descWords.includes(k));
  if (descDepts.length > 0) {
    const conflictingDept = deptKeywords.find(k => fileWords.has(k) && !descDepts.includes(k));
    if (conflictingDept) {
      return false;
    }
    const hasReqDept = descDepts.some(k => fileWords.has(k));
    if (!hasReqDept) {
      return false;
    }
  }

  // 3. Flag / Country conflicts (e.g., MALTA, SINGAPORE vs PANAMA vs LIBERIA etc.)
  const flagKeywords = ['MALTA', 'SINGAPORE', 'PANAMA', 'LIBERIA', 'MARSHALL', 'BAHAMAS', 'CYPRUS', 'TUVALU', 'VANUATU', 'ANTIGUA', 'BARBUDA'];
  const descFlags = flagKeywords.filter(k => descWords.includes(k));
  if (descFlags.length > 0) {
    const conflictingFlag = flagKeywords.find(k => fileWords.has(k) && !descFlags.includes(k));
    if (conflictingFlag) {
      return false;
    }
    const hasReqFlag = descFlags.some(k => fileWords.has(k));
    if (!hasReqFlag) {
      return false;
    }
  }

  // 4. Number/Specification conflicts (e.g. 1952 TEU vs 2822 TEU)
  const descNumbers = descWords.filter(w => /^\d{3,}$/.test(w));
  if (descNumbers.length > 0) {
    const missingNum = descNumbers.find(num => !fileWords.has(num));
    if (missingNum) {
      return false;
    }
  }

  // 5. Parenthetical / Qualifier word check
  const parenMatches = upperDesc.match(/\(([^)]+)\)/g);
  if (parenMatches) {
    for (const paren of parenMatches) {
      const qualifierWords = paren
        .replace(/[^A-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !stopWords.has(w));
      
      for (const qWord of qualifierWords) {
        if (!fileWords.has(qWord)) {
          return false;
        }
      }
    }
  }

  // 6. Overall word match ratio
  let matchedCount = 0;
  for (const word of descWords) {
    if (fileWords.has(word)) {
      matchedCount++;
    }
  }
  
  const matchPercentage = (matchedCount / descWords.length) * 100;
  return matchPercentage >= 80;
};

export const isTargetDateInText = (textUpper: string, year: number, monthNum: number, day: number, fullMonth: string, shortMonth: string): boolean => {
  const dayStr = day.toString();
  const dayPad = day < 10 ? '0' + day : dayStr;
  const monthStr = monthNum.toString();
  const monthPad = monthNum < 10 ? '0' + monthNum : monthStr;
  
  // 1. "28 November 2025" or "28 Nov 2025"
  const r1 = new RegExp(`\\b${day}(?:th|st|nd|rd)?\\s+(?:${fullMonth}|${shortMonth})\\s+${year}\\b`, 'i');
  const r1Pad = new RegExp(`\\b${dayPad}\\s+(?:${fullMonth}|${shortMonth})\\s+${year}\\b`, 'i');
  
  // 2. "November 28, 2025" or "Nov 28, 2025"
  const r2 = new RegExp(`\\b(?:${fullMonth}|${shortMonth})\\s+${day}(?:th|st|nd|rd)?,?\\s+${year}\\b`, 'i');
  const r2Pad = new RegExp(`\\b(?:${fullMonth}|${shortMonth})\\s+${dayPad},?\\s+${year}\\b`, 'i');
  
  // 3. "28-Nov-2025" or "28/Nov/2025" or "28.Nov.2025"
  const r3 = new RegExp(`\\b${day}[-/.]${shortMonth}[-/.]${year}\\b`, 'i');
  const r3Pad = new RegExp(`\\b${dayPad}[-/.]${shortMonth}[-/.]${year}\\b`, 'i');
  
  // 4. "2025-11-28" or "2025/11/28"
  const r4 = new RegExp(`\\b${year}[-/.]${monthPad}[-/.]${dayPad}\\b`);
  const r4Lenient = new RegExp(`\\b${year}[-/.]${monthStr}[-/.]${dayStr}\\b`);
  
  // 5. "11/28/2025" or "11-28-2025"
  const r5 = new RegExp(`\\b${monthPad}[-/.]${dayPad}[-/.]${year}\\b`);
  const r5Lenient = new RegExp(`\\b${monthStr}[-/.]${dayStr}[-/.]${year}\\b`);
  
  // 6. "28/11/2025" or "28-11-2025"
  const r6 = new RegExp(`\\b${dayPad}[-/.]${monthPad}[-/.]${year}\\b`);
  const r6Lenient = new RegExp(`\\b${dayStr}[-/.]${monthStr}[-/.]${year}\\b`);

  return (
    r1.test(textUpper) ||
    r1Pad.test(textUpper) ||
    r2.test(textUpper) ||
    r2Pad.test(textUpper) ||
    r3.test(textUpper) ||
    r3Pad.test(textUpper) ||
    r4.test(textUpper) ||
    r4Lenient.test(textUpper) ||
    r5.test(textUpper) ||
    r5Lenient.test(textUpper) ||
    r6.test(textUpper) ||
    r6Lenient.test(textUpper)
  );
};

export const hasAnyDateInText = (fileText: string): boolean => {
  const textUpper = fileText.toUpperCase();
  
  const monthRegexStr = '(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)';
  
  // Pattern 1: DD Month YYYY or Month DD, YYYY
  const datePattern1 = new RegExp(`\\b\\d{1,2}(?:th|st|nd|rd)?\\s+${monthRegexStr}\\s+\\d{4}\\b`, 'i');
  const datePattern2 = new RegExp(`\\b${monthRegexStr}\\s+\\d{1,2}(?:th|st|nd|rd)?,?\\s+\\d{4}\\b`, 'i');
  
  // Pattern 2: DD-Month-YYYY
  const datePattern3 = new RegExp(`\\b\\d{1,2}[-/. ]${monthRegexStr}[-/. ]\\d{4}\\b`, 'i');
  
  // Pattern 3: YYYY-MM-DD or MM/DD/YYYY or DD/MM/YYYY with 4-digit years
  const datePattern4 = /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/;
  const datePattern5 = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/;

  return (
    datePattern1.test(textUpper) ||
    datePattern2.test(textUpper) ||
    datePattern3.test(textUpper) ||
    datePattern4.test(textUpper) ||
    datePattern5.test(textUpper)
  );
};

export const isDateMatched = (fileText: string, formDateStr?: string): boolean => {
  if (!formDateStr || !formDateStr.trim()) return true;
  const textUpper = fileText.toUpperCase();
  const dateObj = new Date(formDateStr);
  
  if (isNaN(dateObj.getTime())) {
    // Fallback to simple substring match
    return textUpper.includes(formDateStr.toUpperCase());
  }
  
  const year = dateObj.getFullYear();
  const day = dateObj.getDate();
  const monthNamesFull = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const monthNamesShort = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monthIndex = dateObj.getMonth();
  
  const fullMonth = monthNamesFull[monthIndex];
  const shortMonth = monthNamesShort[monthIndex];
  const monthNum = monthIndex + 1;
  
  if (isTargetDateInText(textUpper, year, monthNum, day, fullMonth, shortMonth)) {
    return true;
  }
  
  return false;
};

export const validateFileAgainstForm = async (
  file: File, 
  form: FormValidationTarget, 
  cachedBuffer?: ArrayBuffer
): Promise<ValidationResult> => {
  const formCode = (form.formCode || form.form_code || '').trim();
  const description = form.description || '';
  const formDate = form.formDate || form.form_date || '';
  const isHira = Boolean(form.isHira || form.is_hira);
  const removeFilenameRestriction = Boolean(form.removeFilenameRestriction || form.remove_filename_restriction);
  const allowedFileTypes = form.allowedFileTypes || form.allowed_file_types || [];

  // Check file type restrictions if any checkboxes are configured
  if (allowedFileTypes && allowedFileTypes.length > 0) {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const validExts: string[] = [];
    if (allowedFileTypes.includes('Word')) {
      validExts.push('.doc', '.docx');
    }
    if (allowedFileTypes.includes('Excel')) {
      validExts.push('.xls', '.xlsx');
    }
    if (allowedFileTypes.includes('PDF')) {
      validExts.push('.pdf');
    }
    // Also support direct extensions (e.g. '.pdf', '.xlsx', 'pdf', 'docx')
    for (const aft of allowedFileTypes) {
      const cleanExt = aft.startsWith('.') ? aft.toLowerCase() : `.${aft.toLowerCase()}`;
      if (!validExts.includes(cleanExt) && !['word', 'excel', 'pdf'].includes(aft.toLowerCase())) {
        validExts.push(cleanExt);
      }
    }

    if (validExts.length > 0 && !validExts.includes(ext) && !validExts.includes('.*')) {
      return {
        matched: false,
        reason: `File Type Mismatch: File type extension '${ext}' is not allowed for '${formCode || 'this form'}'. Allowed file types: ${allowedFileTypes.join(', ')}`,
        details: {
          codeMatched: false,
          descMatched: false,
          dateMatched: false,
          fileTypeMatched: false,
          filenameCodeMatched: false
        }
      };
    }
  }

  // If the form allows Multiple Files (isHira) or has filename restriction removed,
  // skip strict filename code prefix and header content/date verification.
  if (isHira || removeFilenameRestriction) {
    let arrayBuffer: ArrayBuffer | undefined = cachedBuffer;
    try {
      arrayBuffer = await safeReadFileAsArrayBuffer(file, cachedBuffer);
    } catch (e) {
      console.warn(`Buffer read warning for ${file.name}:`, e);
    }
    return {
      matched: true,
      content: `File uploaded for form ${formCode}`,
      arrayBuffer,
      details: {
        codeMatched: true,
        descMatched: true,
        dateMatched: true,
        fileTypeMatched: true,
        filenameCodeMatched: true
      }
    };
  }

  const cleanFileName = file.name.trim().toUpperCase();
  const cleanFormCode = formCode.toUpperCase();
  
  // Filename must start with the form code and have a non-alphanumeric boundary character
  let startsWithCode = cleanFileName.startsWith(cleanFormCode);
  if (startsWithCode && cleanFileName.length > cleanFormCode.length) {
    const nextChar = cleanFileName[cleanFormCode.length];
    if (/^[A-Z0-9]$/.test(nextChar)) {
      startsWithCode = false;
    }
  }

  if (!startsWithCode && !removeFilenameRestriction) {
    return {
      matched: false,
      reason: `Filename Mismatch: File name does not start with expected form code '${formCode}'. (Got "${file.name}")`,
      details: {
        codeMatched: false,
        descMatched: false,
        dateMatched: false,
        fileTypeMatched: true,
        filenameCodeMatched: false
      }
    };
  }

  try {
    let arrayBuffer: ArrayBuffer | undefined = cachedBuffer;
    try {
      arrayBuffer = await safeReadFileAsArrayBuffer(file, cachedBuffer);
    } catch (e) {
      console.warn(`Buffer read warning for ${file.name}:`, e);
    }

    const text = await extractTextFromFile(file, arrayBuffer);
    const textUpper = text.toUpperCase();
    
    let hasCode = textUpper.includes(cleanFormCode) || 
      textUpper.replace(/[^A-Z0-9]/g, '').includes(cleanFormCode.replace(/[^A-Z0-9]/g, ''));
    if (!hasCode) {
      // Fallback: If the filename starts with or contains the form code, or if filename restriction is removed
      if (cleanFileName.startsWith(cleanFormCode) || cleanFileName.includes(cleanFormCode) || removeFilenameRestriction) {
        hasCode = true;
      }
    }

    let hasDescription = isDescriptionMatched(text, description);
    if (!hasDescription) {
      // Fallback: try to match with the filename instead
      hasDescription = isDescriptionMatched(file.name, description);
    }
    if (removeFilenameRestriction) {
      hasDescription = true;
    }
    
    let hasDateInContent = isDateMatched(text, formDate);
    let hasDateInFilename = isDateMatched(file.name, formDate);
    let hasDate = hasDateInContent || hasDateInFilename;
    let isMismatchingContentDate = false;
    if (!hasDate && formDate) {
      if (hasAnyDateInText(text)) {
        isMismatchingContentDate = true;
      }
    }
    if (removeFilenameRestriction || !formDate) {
      hasDate = true;
      isMismatchingContentDate = false;
    }

    if (!hasCode && !removeFilenameRestriction) {
      return {
        matched: false,
        reason: `Content Mismatch: Form Code '${formCode}' was not found in the file's text structure.`,
        content: text.slice(0, 1000),
        arrayBuffer,
        details: {
          codeMatched: false,
          descMatched: hasDescription,
          dateMatched: hasDate,
          fileTypeMatched: true,
          filenameCodeMatched: startsWithCode
        }
      };
    } else if (!hasDescription && !removeFilenameRestriction) {
      return {
        matched: false,
        reason: `Content Mismatch: Form Description does not match saved database description for '${formCode}'.`,
        content: text.slice(0, 1000),
        arrayBuffer,
        details: {
          codeMatched: true,
          descMatched: false,
          dateMatched: hasDate,
          fileTypeMatched: true,
          filenameCodeMatched: startsWithCode
        }
      };
    } else if (isMismatchingContentDate && !removeFilenameRestriction) {
      return {
        matched: false,
        reason: `Content Mismatch: File header/content contains a different date than expected '${formDate}'.`,
        content: text.slice(0, 1000),
        arrayBuffer,
        details: {
          codeMatched: true,
          descMatched: true,
          dateMatched: false,
          fileTypeMatched: true,
          filenameCodeMatched: startsWithCode
        }
      };
    } else if (!hasDate && !removeFilenameRestriction) {
      return {
        matched: false,
        reason: `Content Mismatch: Form Date '${formDate}' was not found in the file's text structure.`,
        content: text.slice(0, 1000),
        arrayBuffer,
        details: {
          codeMatched: true,
          descMatched: true,
          dateMatched: false,
          fileTypeMatched: true,
          filenameCodeMatched: startsWithCode
        }
      };
    } else {
      return {
        matched: true,
        content: text.slice(0, 1000),
        arrayBuffer,
        details: {
          codeMatched: true,
          descMatched: true,
          dateMatched: true,
          fileTypeMatched: true,
          filenameCodeMatched: true
        }
      };
    }
  } catch (error: any) {
    return {
      matched: false,
      reason: `Read Error: Could not read file content. (${error.message || error})`,
      details: {
        codeMatched: false,
        descMatched: false,
        dateMatched: false,
        fileTypeMatched: true,
        filenameCodeMatched: startsWithCode
      }
    };
  }
};
