import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdf.js text extraction
const PDF_JS_VERSION = '5.6.205';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDF_JS_VERSION}/build/pdf.worker.min.mjs`;

import { 
  Calendar,
  Compass,
  Layers,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Send,
  Building2,
  ShieldCheck,
  PenTool,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  HardDrive,
  Plus,
  Trash2,
  Edit3,
  Upload,
  Check,
  AlertCircle,
  FileText,
  Download,
  Search,
  X,
  Loader2,
  Info,
  XCircle,
  CheckCircle2,
  Folder,
  RefreshCw,
  FileCode,
  Archive,
  FileSpreadsheet,
  File as FileIcon
} from 'lucide-react';

// Icons mapping for categories
const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  '1. Monthly': Calendar,
  '2. Voyage': Compass,
  '3. Quarterly': Layers,
  '4. Semi Annual': CalendarCheck,
  '4A. Annually': CalendarDays,
  '5. Occasional': ClipboardList,
  '6. Letter Form': Send,
  '7. Company Records (Office)': Building2,
  '8. Safety and Security Forms': ShieldCheck,
  '9. Free Form': PenTool,
};

export interface SMSForm {
  id: string;
  category: string;
  formCode: string;
  description: string;
  formDate: string;
  scope: string; // "All Vessels" or specific vessel names
  type?: 'Form' | 'Checklist';
}

export interface VesselSubmissionPeriod {
  vesselId: string;
  vesselName: string;
  month: string;
  year: string;
}

export interface VesselUpload {
  id: string;
  vesselId: string;
  vesselName: string;
  month: string;
  year: string;
  fileName: string;
  uploadedAt: string; // ISO string or human-readable format
  fileSize: string;
  category?: string;
}

interface SMSViewProps {
  vessels: any[];
  currentUser: any;
  token?: string;
  mode?: 'management' | 'reporting';
  flags?: any[];
}

// Initial seed data for forms under categories
const INITIAL_FORMS: SMSForm[] = [
  // 1. Monthly
  { id: 'f_1', category: '1. Monthly', formCode: 'COMI-SM-1-1', description: 'ME & DG Jacket Cooling Fresh Water & BOILER Water condition Report', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_2', category: '1. Monthly', formCode: 'COMI-SM-1-2', description: 'Check List For Certificates & Documents', formDate: '22 May 2026', scope: 'All Vessels' },
  { id: 'f_3', category: '1. Monthly', formCode: 'COMI-SM-1-3', description: 'Deck Part Monthly Maintenance Report', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_4', category: '1. Monthly', formCode: 'COMI-SM-1-3A', description: 'Deck Part Monthly Maintenance Report for Container (for 1952 T.E.U)', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_5', category: '1. Monthly', formCode: 'COMI-SM-1-3B', description: 'Deck Part Monthly Maintenance Report for Container (for 2822 T.E.U)', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_6', category: '1. Monthly', formCode: 'COMI-SM-1-4', description: 'Engine Part Monthly Maintenance Report', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_7', category: '1. Monthly', formCode: 'COMI-SM-1-5', description: 'Lube Oil Consumption Report', formDate: '28 November 2025', scope: 'All Vessels' },
  
  // 2. Voyage
  { id: 'f_8', category: '2. Voyage', formCode: 'COMI-SM-2-1', description: 'Voyage Pre-Departure & Voyage Plan Checklist', formDate: '12 January 2026', scope: 'All Vessels' },
  { id: 'f_9', category: '2. Voyage', formCode: 'COMI-SM-2-2', description: 'Pre-Arrival & Port Operations Checklist', formDate: '20 February 2026', scope: 'All Vessels' },
  { id: 'f_10', category: '2. Voyage', formCode: 'COMI-SM-2-3', description: 'Pilot Boarding & Watch handover Guidelines', formDate: '15 March 2026', scope: 'All Vessels' },

  // 3. Quarterly
  { id: 'f_11', category: '3. Quarterly', formCode: 'COMI-SM-3-1', description: 'Enclosed Space Entry & Rescue Drill Report', formDate: '10 January 2026', scope: 'All Vessels' },
  { id: 'f_12', category: '3. Quarterly', formCode: 'COMI-SM-3-2', description: 'Lifeboat Launching & Emergency Steering Gear Review', formDate: '28 February 2026', scope: 'All Vessels' },

  // 4. Semi Annual
  { id: 'f_13', category: '4. Semi Annual', formCode: 'COMI-SM-4-1', description: 'Safety Committee Meeting & Officer Review Minutes', formDate: '05 March 2026', scope: 'All Vessels' },
  { id: 'f_14', category: '4. Semi Annual', formCode: 'COMI-SM-4-2', description: 'Onboard Safety Training & Drills Assessment Log', formDate: '18 April 2026', scope: 'All Vessels' },

  // 4A. Annually
  { id: 'f_15', category: '4A. Annually', formCode: 'COMI-SM-4A-1', description: 'Master\'s Review and Evaluation of Safety Management System (SMS)', formDate: '14 May 2026', scope: 'All Vessels' },
  { id: 'f_16', category: '4A. Annually', formCode: 'COMI-SM-4A-2', description: 'Annual Fire-Fighting & Safety Appliance Certificate Verification', formDate: '10 June 2026', scope: 'All Vessels' },

  // 5. Occasional
  { id: 'f_17', category: '5. Occasional', formCode: 'COMI-SM-5-1', description: 'Hot Work Authorization Permit', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_18', category: '5. Occasional', formCode: 'COMI-SM-5-2', description: 'Enclosed Space Entry Permit', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_19', category: '5. Occasional', formCode: 'COMI-SM-5-3', description: 'Working At Height / Overboard Permit', formDate: '12 January 2026', scope: 'All Vessels' },

  // 6. Letter Form
  { id: 'f_20', category: '6. Letter Form', formCode: 'COMI-SM-6-1', description: 'Safety Equipment Requisition Letter', formDate: '11 February 2026', scope: 'All Vessels' },
  { id: 'f_21', category: '6. Letter Form', formCode: 'COMI-SM-6-2', description: 'Non-Conformity Formal Letter of Protest', formDate: '05 April 2026', scope: 'All Vessels' },

  // 7. Company Records (Office)
  { id: 'f_22', category: '7. Company Records (Office)', formCode: 'COMI-SM-7-1', description: 'Internal Fleet Audit Inspection Findings & Actions', formDate: '22 March 2026', scope: 'All Vessels' },
  { id: 'f_23', category: '7. Company Records (Office)', formCode: 'COMI-SM-7-2', description: 'Management Review Committee Records', formDate: '10 May 2026', scope: 'All Vessels' },

  // 8. Safety and Security Forms
  { id: 'f_24', category: '8. Safety and Security Forms', formCode: 'COMI-SM-8-1', description: 'ISPS Code Onboard Security Assessment Worksheet', formDate: '18 June 2026', scope: 'All Vessels' },
  { id: 'f_25', category: '8. Safety and Security Forms', formCode: 'COMI-SM-8-2', description: 'Continuous Synopsis Record (CSR) Tracking Log', formDate: '01 July 2026', scope: 'All Vessels' },

  // 9. Free Form
  { id: 'f_26', category: '9. Free Form', formCode: 'COMI-SM-9-1', description: 'Safety Suggestion Card / Hazard Identification Form', formDate: '28 November 2025', scope: 'All Vessels' },
  { id: 'f_27', category: '9. Free Form', formCode: 'COMI-SM-9-2', description: 'Near-Miss Incident Narrative Report', formDate: '12 January 2026', scope: 'All Vessels' },
];

const INITIAL_SUBMISSIONS: VesselSubmissionPeriod[] = [
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
  { vesselId: 'v13', vesselName: 'LIGNUM NETWORK', month: 'June', year: '2026' },
  { vesselId: 'v14', vesselName: 'LOWLANDS LAMBIK', month: 'June', year: '2026' },
  { vesselId: 'v15', vesselName: 'LOWLANDS MUZE', month: 'June', year: '2026' },
  { vesselId: 'v16', vesselName: 'MEDI PERTH', month: 'June', year: '2026' },
  { vesselId: 'v17', vesselName: 'NORESE MOMENTUM', month: 'June', year: '2026' },
  { vesselId: 'v18', vesselName: 'NORSE CONTINUATION', month: 'June', year: '2026' },
  { vesselId: 'v19', vesselName: 'NORSE OSHIMA', month: 'June', year: '2026' },
];

const INITIAL_UPLOADS: VesselUpload[] = [
  { id: 'up_1', vesselId: 'v3', vesselName: 'CD HUELVA', month: 'June', year: '2026', fileName: 'CD_HUELVA_June_2026_SMS_Package.zip', uploadedAt: 'July 5, 2026 at 07:17 PM', fileSize: '14.2 MB', category: '1. Monthly' },
  { id: 'up_2', vesselId: 'v6', vesselName: 'CNC CHEETAH', month: 'June', year: '2026', fileName: 'CNC_CHEETAH_June_2026_Forms.pdf', uploadedAt: 'July 1, 2026 at 09:15 PM', fileSize: '8.4 MB', category: '1. Monthly' },
  { id: 'up_3', vesselId: 'v8', vesselName: 'CNC NEPTUNE', month: 'June', year: '2026', fileName: 'CNC_NEPTUNE_SMS_June26.zip', uploadedAt: 'July 3, 2026 at 03:12 PM', fileSize: '18.1 MB', category: '1. Monthly' },
  { id: 'up_4', vesselId: 'v9', vesselName: 'CNC PUMA', month: 'May', year: '2026', fileName: 'CNC_PUMA_May_Submission.pdf', uploadedAt: 'July 5, 2026 at 02:51 PM', fileSize: '12.5 MB', category: '1. Monthly' },
  { id: 'up_5', vesselId: 'v12', vesselName: 'HANDY MERCHANT', month: 'April', year: '2026', fileName: 'HandyMerchant_SMS_April_2026.zip', uploadedAt: 'May 4, 2026 at 02:11 PM', fileSize: '15.9 MB', category: '1. Monthly' },
  { id: 'up_6', vesselId: 'v13', vesselName: 'LIGNUM NETWORK', month: 'June', year: '2026', fileName: 'LignumNet_June2026_SafetyForms.zip', uploadedAt: 'July 4, 2026 at 10:28 AM', fileSize: '22.0 MB', category: '1. Monthly' },
];

export const SMSView: React.FC<SMSViewProps> = ({ vessels: externalVessels, currentUser, token, mode = 'management', flags = [] }) => {
  // Use either external vessels list or standard seed list
  const vesselsList = externalVessels && externalVessels.length > 0 
    ? externalVessels.map((v, idx) => ({ id: v.id || `v_${idx}`, name: v.name, flag: v.flag }))
    : INITIAL_SUBMISSIONS.map(s => ({ id: s.vesselId, name: s.vesselName, flag: null }));

  // Main Category/Tab Selection State
  const [selectedCategory, setSelectedCategory] = useState<string>('1. Monthly');

  // Interactive storage and files states
  const [forms, setForms] = useState<SMSForm[]>([]);
  const [submissionPeriods, setSubmissionPeriods] = useState<VesselSubmissionPeriod[]>([]);
  const [uploads, setUploads] = useState<VesselUpload[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown/Form selection states
  const [selectedPeriodVesselId, setSelectedPeriodVesselId] = useState('');
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState('June');
  const [selectedPeriodYear, setSelectedPeriodYear] = useState('2026');

  const [selectedFilterVesselId, setSelectedFilterVesselId] = useState('');
  const [selectedFilterMonth, setSelectedFilterMonth] = useState('All');
  const [selectedFilterYear, setSelectedFilterYear] = useState('2026');
  const [filteredUploads, setFilteredUploads] = useState<VesselUpload[]>([]);

  // Accordion Expand/Collapse States
  const [isAccordion1Open, setIsAccordion1Open] = useState(false);
  const [isAccordion2Open, setIsAccordion2Open] = useState(false);
  const [isAccordion3Open, setIsAccordion3Open] = useState(false);
  const [isAccordion4Open, setIsAccordion4Open] = useState(false);

  // Form Modals states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingForm, setEditingForm] = useState<SMSForm | null>(null);
  const [formCodeInput, setFormCodeInput] = useState('');
  const [formDescriptionInput, setFormDescriptionInput] = useState('');
  const [formDateInput, setFormDateInput] = useState('');
  const [formScopeInput, setFormScopeInput] = useState('All Vessels');
  const [formTypeInput, setFormTypeInput] = useState<'Form' | 'Checklist'>('Form');
  const [selectedFlagScope, setSelectedFlagScope] = useState<string>('All Flags');

  // File Upload states
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingVesselId, setUploadingVesselId] = useState('');
  const [uploadingMonth, setUploadingMonth] = useState('June');
  const [uploadingYear, setUploadingYear] = useState('2026');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);

  // SMS Reporting specific state variables
  const [reportingVesselId, setReportingVesselId] = useState<string>('');
  const [reportingMonth, setReportingMonth] = useState<string>('June');
  const [reportingYear, setReportingYear] = useState<string>('2026');
  
  // uploadedFilesMap holds files uploaded for each form
  // key: form.id, value: { file, matched, reason, content }
  const [uploadedFilesMap, setUploadedFilesMap] = useState<Record<string, { file: File; matched: boolean; reason?: string; content?: string }>>({});

  // B2 Backblaze Upload simulation states
  const [simulateB2Failure, setSimulateB2Failure] = useState<boolean>(false);
  const [b2UploadStatus, setB2UploadStatus] = useState<'idle' | 'zipping' | 'uploading' | 'success' | 'error'>('idle');
  const [b2UploadError, setB2UploadError] = useState<string>('');
  const [compiledZipBlob, setCompiledZipBlob] = useState<Blob | null>(null);
  const [compiledZipName, setCompiledZipName] = useState<string>('');
  const [b2UploadProgress, setB2UploadProgress] = useState<number>(0);

  // Status Alerts/Toasts State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // States for expanding ZIP files to display internal files individually
  const [expandedZipIds, setExpandedZipIds] = useState<Record<string, boolean>>({});
  const [zipContents, setZipContents] = useState<Record<string, Array<{ name: string; size: number; isSimulated: boolean; parentZipId: string }>>>({});
  const [loadingZips, setLoadingZips] = useState<Record<string, boolean>>({});

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch uploads list from server
  const fetchUploadsList = async () => {
    if (!token) {
      const savedUploads = localStorage.getItem('comos_sms_uploads_list');
      if (savedUploads) {
        setUploads(JSON.parse(savedUploads));
      } else {
        const initialUploads = INITIAL_UPLOADS.map(up => {
          const matchingVessel = vesselsList.find(v => v.name.toUpperCase() === up.vesselName.toUpperCase());
          return {
            ...up,
            vesselId: matchingVessel ? String(matchingVessel.id) : up.vesselId
          };
        });
        setUploads(initialUploads);
        localStorage.setItem('comos_sms_uploads_list', JSON.stringify(initialUploads));
      }
      return;
    }

    try {
      const response = await fetch('/api/sms/uploads', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.length === 0) {
          const initialUploads = INITIAL_UPLOADS.map(up => {
            const matchingVessel = vesselsList.find(v => v.name.toUpperCase() === up.vesselName.toUpperCase());
            return {
              ...up,
              vesselId: matchingVessel ? String(matchingVessel.id) : up.vesselId
            };
          });
          setUploads(initialUploads);
        } else {
          setUploads(data);
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch SMS uploads:', e);
    }
  };

  const handleDownloadFile = async (uploadId: string, fileName: string) => {
    if (!token || String(uploadId).startsWith('up_')) {
      triggerToast(`Downloading simulated file ${fileName}...`, 'success');
      return;
    }
    triggerToast(`Initiating download for ${fileName}...`, 'success');
    try {
      const response = await fetch(`/api/sms/download/${uploadId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      triggerToast(`Download failed: ${err.message}`, 'error');
    }
  };

  const toggleExpandZip = async (uploadId: string, fileName: string) => {
    // If already expanded, just collapse it
    if (expandedZipIds[uploadId]) {
      setExpandedZipIds(prev => ({ ...prev, [uploadId]: false }));
      return;
    }

    // Set expanded to true
    setExpandedZipIds(prev => ({ ...prev, [uploadId]: true }));

    // If we already have the contents of this zip loaded, do nothing
    if (zipContents[uploadId]) {
      return;
    }

    // Otherwise, load/simulate the zip contents
    setLoadingZips(prev => ({ ...prev, [uploadId]: true }));
    try {
      if (!token || String(uploadId).startsWith('up_')) {
        // Simulated ZIP file. Create realistic mock files based on the forms/category or just standard safety templates
        const mockFiles = [
          { name: 'SAF-01_Monthly_Safety_Meeting_Report.docx', size: 148480, isSimulated: true, parentZipId: uploadId },
          { name: 'SAF-02_Vessel_Inspection_Checklist.xlsx', size: 91136, isSimulated: true, parentZipId: uploadId },
          { name: 'SAF-03_Emergency_Drill_Record.pdf', size: 1258291, isSimulated: true, parentZipId: uploadId },
          { name: 'SAF-05_Enclosed_Space_Entry_Permit.docx', size: 215040, isSimulated: true, parentZipId: uploadId }
        ];
        setZipContents(prev => ({ ...prev, [uploadId]: mockFiles }));
      } else {
        // Real ZIP file. Fetch from backend!
        const response = await fetch(`/api/sms/download/${uploadId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to download ZIP file');
        }
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        
        const files: Array<{ name: string; size: number; isSimulated: boolean; parentZipId: string }> = [];
        
        for (const [relPath, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir) {
            let size = 150 * 1024; // fallback 150 KB
            const rawSize = (zipEntry as any)._data?.uncompressedSize || (zipEntry as any).uncompressedSize;
            if (rawSize !== undefined) {
              size = Number(rawSize);
            }
            files.push({
              name: relPath.split('/').pop() || relPath,
              size,
              isSimulated: false,
              parentZipId: uploadId
            });
          }
        }
        
        setZipContents(prev => ({ ...prev, [uploadId]: files }));
      }
    } catch (err: any) {
      console.error('Error unpacking ZIP contents:', err);
      triggerToast(`Could not unpack ZIP contents: ${err.message}`, 'error');
    } finally {
      setLoadingZips(prev => ({ ...prev, [uploadId]: false }));
    }
  };

  const handleDownloadIndividualZipFile = async (parentZipId: string, parentZipName: string, innerFileName: string, isSimulated: boolean) => {
    triggerToast(`Extracting ${innerFileName} from ZIP...`, 'success');
    try {
      if (isSimulated) {
        // Create a simulated file blob
        const ext = innerFileName.split('.').pop()?.toLowerCase() || 'docx';
        let blob: Blob;
        if (ext === 'pdf') {
          blob = new Blob([`%PDF-1.4\n% Simulated PDF content of ${innerFileName} from package ${parentZipName}`], { type: 'application/pdf' });
        } else if (ext === 'xlsx' || ext === 'xls') {
          blob = new Blob([`Simulated Excel spreadsheet data of ${innerFileName} from package ${parentZipName}`], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        } else {
          blob = new Blob([`Simulated Word document content of ${innerFileName} from package ${parentZipName}`], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = innerFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Real ZIP extraction
        const response = await fetch(`/api/sms/download/${parentZipId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to retrieve ZIP archive');
        }
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        
        const zipEntry = Object.values(zip.files).find(entry => {
          const entryName = entry.name.split('/').pop() || entry.name;
          return entryName.toLowerCase() === innerFileName.toLowerCase();
        });
        
        if (!zipEntry) {
          throw new Error(`File ${innerFileName} not found in the ZIP archive`);
        }
        
        const fileBlob = await zipEntry.async('blob');
        const url = window.URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = innerFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
      triggerToast(`Downloaded ${innerFileName} successfully!`, 'success');
    } catch (err: any) {
      triggerToast(`Failed to extract and download file: ${err.message}`, 'error');
    }
  };

  const handleDeleteUpload = async (uploadId: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete the file ${fileName}?`)) {
      return;
    }
    
    if (!token || String(uploadId).startsWith('up_')) {
      const updatedUploads = uploads.filter(up => String(up.id) !== String(uploadId));
      setUploads(updatedUploads);
      localStorage.setItem('comos_sms_uploads_list', JSON.stringify(updatedUploads));
      triggerToast(`File deleted successfully.`, 'success');
      return;
    }

    try {
      const response = await fetch(`/api/sms/upload/${uploadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setUploads(prev => prev.filter(up => String(up.id) !== String(uploadId)));
        triggerToast(`File deleted successfully.`, 'success');
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (err: any) {
      triggerToast(`Deletion failed: ${err.message}`, 'error');
    }
  };

  const formatUploadedAt = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + 
        ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // On mount, load data from localStorage or seed
  useEffect(() => {
    const savedForms = localStorage.getItem('comos_sms_manage_forms');
    if (savedForms) {
      setForms(JSON.parse(savedForms));
    } else {
      setForms(INITIAL_FORMS);
      localStorage.setItem('comos_sms_manage_forms', JSON.stringify(INITIAL_FORMS));
    }

    const savedPeriods = localStorage.getItem('comos_sms_submission_periods');
    if (savedPeriods) {
      setSubmissionPeriods(JSON.parse(savedPeriods));
    } else {
      // Create initial periods dynamically
      const initialPeriods = vesselsList.map(v => {
        const foundSeed = INITIAL_SUBMISSIONS.find(s => s.vesselName.toUpperCase() === v.name.toUpperCase());
        return {
          vesselId: String(v.id),
          vesselName: v.name,
          month: foundSeed ? foundSeed.month : 'June',
          year: foundSeed ? foundSeed.year : '2026'
        };
      });
      setSubmissionPeriods(initialPeriods);
      localStorage.setItem('comos_sms_submission_periods', JSON.stringify(initialPeriods));
    }

    fetchUploadsList();
  }, [token]);

  const [hasLoadedFilter, setHasLoadedFilter] = useState(false);

  // Helper to determine if a file matches a category
  const doesFileMatchCategory = (fileName: string, category: string, allForms: SMSForm[]): boolean => {
    const cleanFileName = fileName.trim().toUpperCase();
    const categoryForms = allForms.filter(f => f.category === category);
    
    // If the file starts with any form code in this category, it's a match!
    const hasMatchingCode = categoryForms.some(f => {
      const cleanCode = f.formCode.trim().toUpperCase();
      return cleanFileName.startsWith(cleanCode);
    });
    
    if (hasMatchingCode) return true;
    
    // Default general packages to "1. Monthly"
    if (cleanFileName.endsWith('.ZIP') || cleanFileName.includes('PACKAGE') || cleanFileName.includes('SUBMISSION')) {
      if (category === '1. Monthly') {
        return true;
      }
    }
    
    return false;
  };

  // Sync filteredUploads when uploads list or filters change
  useEffect(() => {
    if (!hasLoadedFilter) {
      setFilteredUploads([]);
      return;
    }
    const loaded = uploads.filter(up => {
      const matchVessel = !selectedFilterVesselId || String(up.vesselId) === String(selectedFilterVesselId);
      const matchMonth = selectedFilterMonth === 'All' || up.month === selectedFilterMonth;
      const matchYear = !selectedFilterYear || up.year === selectedFilterYear;
      const matchCategory = up.category 
        ? up.category === selectedCategory 
        : doesFileMatchCategory(up.fileName, selectedCategory, forms);
      return matchVessel && matchMonth && matchYear && matchCategory;
    });
    setFilteredUploads(loaded);
  }, [uploads, selectedFilterVesselId, selectedFilterMonth, selectedFilterYear, selectedCategory, hasLoadedFilter, forms]);

  // Update default states once vessels are loaded
  useEffect(() => {
    if (vesselsList.length > 0) {
      setSelectedPeriodVesselId(String(vesselsList[0].id));
      setUploadingVesselId(String(vesselsList[0].id));
      setSelectedFilterVesselId('');
      setReportingVesselId(String(vesselsList[0].id));
    }
  }, [externalVessels]);

  // Load and Filter submitted files manually
  const handleLoadFiles = () => {
    if (!selectedFilterVesselId) {
      triggerToast('Please select a vessel first.', 'error');
      return;
    }
    setHasLoadedFilter(true);
    const loaded = uploads.filter(up => {
      const matchVessel = String(up.vesselId) === String(selectedFilterVesselId);
      const matchMonth = selectedFilterMonth === 'All' || up.month === selectedFilterMonth;
      const matchYear = !selectedFilterYear || up.year === selectedFilterYear;
      const matchCategory = up.category 
        ? up.category === selectedCategory 
        : doesFileMatchCategory(up.fileName, selectedCategory, forms);
      return matchVessel && matchMonth && matchYear && matchCategory;
    });
    setFilteredUploads(loaded);
    triggerToast(`Loaded ${loaded.length} file submissions for the selected filter.`, 'success');
  };

  // Download all currently filtered files as a zip archive
  const handleDownloadAllFiltered = async () => {
    if (filteredUploads.length === 0) {
      triggerToast('No loaded files to download.', 'error');
      return;
    }
    
    // If only one file, download directly
    if (filteredUploads.length === 1) {
      handleDownloadFile(filteredUploads[0].id, filteredUploads[0].fileName);
      return;
    }
    
    triggerToast('Compiling ZIP of all loaded files...', 'success');
    try {
      const zip = new JSZip();
      
      for (const up of filteredUploads) {
        if (!token || String(up.id).startsWith('up_')) {
          // Simulated file content
          zip.file(up.fileName, `Simulated backup content of ${up.fileName} for ${up.vesselName} uploaded on ${up.uploadedAt}.`);
        } else {
          // Real backend file download
          try {
            const response = await fetch(`/api/sms/download/${up.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
              const blob = await response.blob();
              zip.file(up.fileName, blob);
            } else {
              zip.file(up.fileName, `Error: Failed to fetch real content for ${up.fileName}`);
            }
          } catch (e) {
            zip.file(up.fileName, `Error: Network failure fetching content for ${up.fileName}`);
          }
        }
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const vName = selectedFilterVesselId 
        ? (vesselsList.find(v => String(v.id) === String(selectedFilterVesselId))?.name || 'Vessel')
        : 'All_Vessels';
      a.download = `${vName.replace(/\s+/g, '_')}_${selectedFilterMonth}_${selectedFilterYear}_Submission_Files.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      triggerToast('Successfully compiled and downloaded all loaded files!', 'success');
    } catch (err: any) {
      triggerToast(`Failed to compile ZIP: ${err.message}`, 'error');
    }
  };

  // Apply new submission period for a vessel
  const handleApplySubmissionPeriod = () => {
    if (!selectedPeriodVesselId) return;
    const targetVessel = vesselsList.find(v => String(v.id) === String(selectedPeriodVesselId));
    if (!targetVessel) return;

    const updatedPeriods = submissionPeriods.map(p => {
      if (String(p.vesselId) === String(selectedPeriodVesselId)) {
        return { ...p, month: selectedPeriodMonth, year: selectedPeriodYear };
      }
      return p;
    });

    setSubmissionPeriods(updatedPeriods);
    localStorage.setItem('comos_sms_submission_periods', JSON.stringify(updatedPeriods));
    triggerToast(`Successfully set submission period for ${targetVessel.name} to ${selectedPeriodMonth} ${selectedPeriodYear}.`, 'success');
  };

  // --- START SMS REPORTING SPECIALIZED ACTIONS ---

  const generateDocxBlob = async (form: SMSForm, vesselName: string): Promise<Blob> => {
    const zip = new JSZip();
    
    // 1. [Content_Types].xml
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    // 2. _rels/.rels
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // 3. word/document.xml
    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Form Code: ${form.formCode}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Description: ${form.description}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Form Date: ${form.formDate}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Status: VERIFIED &amp; COMPLETED</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Vessel: ${vesselName}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Timestamp: ${new Date().toLocaleString()}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>--------------------------------------------------</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is a standard compliant Safety Management System report Word Document (.docx).</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`);

    return await zip.generateAsync({ type: "blob" });
  };

  const generateXlsxBlob = async (form: SMSForm, vesselName: string): Promise<Blob> => {
    const zip = new JSZip();
    
    // 1. [Content_Types].xml
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);

    // 2. _rels/.rels
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

    // 3. xl/workbook.xml
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </sheets>
</workbook>`);

    // 4. xl/sharedStrings.xml
    zip.file("xl/sharedStrings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="7" uniqueCount="7">
  <si><t>Form Code: ${form.formCode}</t></si>
  <si><t>Description: ${form.description}</t></si>
  <si><t>Form Date: ${form.formDate}</t></si>
  <si><t>Status: VERIFIED &amp; COMPLETED</t></si>
  <si><t>Vessel: ${vesselName}</t></si>
  <si><t>Timestamp: ${new Date().toLocaleString()}</t></si>
  <si><t>This is a standard compliant Safety Management System report spreadsheet (.xlsx).</t></si>
</sst>`);

    return await zip.generateAsync({ type: "blob" });
  };

  const generatePdfBlob = (form: SMSForm, vesselName: string): Blob => {
    const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
50 700 Td
(Form Code: ${form.formCode}) Tj
0 -20 Td
(Description: ${form.description}) Tj
0 -20 Td
(Form Date: ${form.formDate}) Tj
0 -20 Td
(Status: VERIFIED & COMPLETED) Tj
0 -20 Td
(Vessel: ${vesselName}) Tj
0 -20 Td
(Timestamp: ${new Date().toLocaleString()}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000222 00000 n 
0000000293 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
540
%%EOF`;
    return new Blob([content], { type: 'application/pdf' });
  };

  const extractLegacyOfficeText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
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

  const extractTextFromFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;
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
        console.error('Error parsing PDF:', e);
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsText(file.slice(0, 50 * 1024));
        });
      }
    } else if (ext === 'docx' || ext === 'xlsx') {
      try {
        const zip = await JSZip.loadAsync(file);
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
        return await extractLegacyOfficeText(file);
      } catch (e) {
        console.error('Error parsing legacy Office file:', e);
        return '';
      }
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      });
    }
  };

  const isDescriptionMatched = (fileText: string, formDescription: string): boolean => {
    const cleanText = fileText.toUpperCase().replace(/AND/g, '').replace(/[^A-Z0-9]/g, '');
    const cleanDesc = formDescription.toUpperCase().replace(/AND/g, '').replace(/[^A-Z0-9]/g, '');
    
    if (cleanText.includes(cleanDesc)) {
      return true;
    }
    
    // Fallback: word-by-word match. If at least 70% of the significant words (length >= 2)
    // in formDescription are present in the file text, we consider it a match.
    const descWords = formDescription.toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && w !== 'AND');
      
    if (descWords.length === 0) return true;
    
    const fileWords = new Set(
      fileText.toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .split(/\s+/)
    );
    
    let matchedCount = 0;
    for (const word of descWords) {
      if (fileWords.has(word)) {
        matchedCount++;
      }
    }
    
    const matchPercentage = (matchedCount / descWords.length) * 100;
    return matchPercentage >= 70;
  };

  const isDateMatched = (fileText: string, formDateStr: string): boolean => {
    const textUpper = fileText.toUpperCase();
    const dateObj = new Date(formDateStr);
    
    if (isNaN(dateObj.getTime())) {
      // If the database formDate is not a valid date string, fallback to simple substring match
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
    const monthNumStr = monthNum.toString();
    const monthNumPadStr = monthNum < 10 ? '0' + monthNum : monthNumStr;
    
    const dayStr = day.toString();
    const dayPadStr = day < 10 ? '0' + day : dayStr;
    
    // Define common representations
    const possibilities = [
      // 28 November 2025
      `${day} ${fullMonth} ${year}`,
      `${dayPadStr} ${fullMonth} ${year}`,
      `${fullMonth} ${day}, ${year}`,
      `${fullMonth} ${dayPadStr}, ${year}`,
      
      // 28 Nov 2025
      `${day} ${shortMonth} ${year}`,
      `${dayPadStr} ${shortMonth} ${year}`,
      `${shortMonth} ${day}, ${year}`,
      `${shortMonth} ${dayPadStr}, ${year}`,
      
      // 28-Nov-2025
      `${day}-${shortMonth}-${year}`,
      `${dayPadStr}-${shortMonth}-${year}`,
      
      // 28.11.2025
      `${day}.${monthNumStr}.${year}`,
      `${dayPadStr}.${monthNumPadStr}.${year}`,
      
      // 28/11/2025
      `${day}/${monthNumStr}/${year}`,
      `${dayPadStr}/${monthNumPadStr}/${year}`,
      
      // 11/28/2025
      `${monthNumStr}/${day}/${year}`,
      `${monthNumPadStr}/${dayPadStr}/${year}`,
      
      // 2025-11-28
      `${year}-${monthNumPadStr}-${dayPadStr}`,
      `${year}/${monthNumPadStr}/${dayPadStr}`,
    ];
    
    // Check any possibility
    for (const pos of possibilities) {
      if (textUpper.includes(pos.toUpperCase())) {
        return true;
      }
    }
    
    // Also, check if year and day are both present and either the month word (NOV/NOVEMBER) or month number is present.
    const hasYear = textUpper.includes(year.toString());
    const hasDay = textUpper.includes(day.toString());
    const hasMonthWord = textUpper.includes(fullMonth) || textUpper.includes(shortMonth);
    const hasMonthNum = textUpper.includes(monthNumStr) || textUpper.includes(monthNumPadStr);
    
    if (hasYear && hasDay && (hasMonthWord || hasMonthNum)) {
      return true;
    }
    
    return false;
  };

  const validateFileAgainstForm = async (file: File, form: SMSForm): Promise<{ matched: boolean; reason?: string; content?: string }> => {
    const cleanFileName = file.name.trim().toUpperCase();
    const cleanFormCode = form.formCode.trim().toUpperCase();
    
    // Filename must start with the form code
    if (!cleanFileName.startsWith(cleanFormCode)) {
      return {
        matched: false,
        reason: `Filename Mismatch: File name does not start with '${form.formCode}'`
      };
    }

    try {
      const text = await extractTextFromFile(file);
      const textUpper = text.toUpperCase();
      
      const hasCode = textUpper.includes(cleanFormCode);
      let hasDescription = isDescriptionMatched(text, form.description);
      if (!hasDescription) {
        // Fallback: try to match with the filename instead
        hasDescription = isDescriptionMatched(file.name, form.description);
      }
      const hasDate = isDateMatched(text, form.formDate);

      if (!hasCode) {
        return {
          matched: false,
          reason: `Content Mismatch: Form Code '${form.formCode}' was not found in the file's text structure.`,
          content: text.slice(0, 1000)
        };
      } else if (!hasDescription) {
        return {
          matched: false,
          reason: `Content Mismatch: Form Description does not match saved database description.`,
          content: text.slice(0, 1000)
        };
      } else if (!hasDate) {
        return {
          matched: false,
          reason: `Content Mismatch: Form Date '${form.formDate}' was not found in the file's text structure.`,
          content: text.slice(0, 1000)
        };
      } else {
        return {
          matched: true,
          content: text.slice(0, 1000)
        };
      }
    } catch (error: any) {
      return {
        matched: false,
        reason: `Read Error: Could not read file content. (${error.message || error})`
      };
    }
  };

  const handleGenerateTestFile = async (form: SMSForm, format: 'docx' | 'xlsx' | 'pdf' | 'doc' | 'xls' = 'docx') => {
    const vesselName = vesselsList.find(v => String(v.id) === String(reportingVesselId))?.name || 'Vessel';
    let blob: Blob;
    
    if (format === 'docx') {
      blob = await generateDocxBlob(form, vesselName);
    } else if (format === 'xlsx') {
      blob = await generateXlsxBlob(form, vesselName);
    } else if (format === 'pdf') {
      blob = generatePdfBlob(form, vesselName);
    } else if (format === 'doc') {
      const content = `Form Code: ${form.formCode}\nDescription: ${form.description}\nForm Date: ${form.formDate}\nStatus: VERIFIED & COMPLETED\nVessel: ${vesselName}\nTimestamp: ${new Date().toLocaleString()}\nThis is a legacy .doc report.`;
      blob = new Blob([content], { type: 'application/msword' });
    } else { // xls
      const content = `Form Code: ${form.formCode}\nDescription: ${form.description}\nForm Date: ${form.formDate}\nStatus: VERIFIED & COMPLETED\nVessel: ${vesselName}\nTimestamp: ${new Date().toLocaleString()}\nThis is a legacy .xls report.`;
      blob = new Blob([content], { type: 'application/vnd.ms-excel' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.formCode}_Report.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    triggerToast(`Generated valid template file (${format.toUpperCase()}) for ${form.formCode}`, 'success');
  };

  const handleGenerateAndMatchBlankFile = async (form: SMSForm, format: 'docx' | 'xlsx' | 'pdf' = 'docx') => {
    const vesselName = vesselsList.find(v => String(v.id) === String(reportingVesselId))?.name || 'Vessel';
    let blob: Blob;
    
    if (format === 'docx') {
      blob = await generateDocxBlob(form, vesselName);
    } else if (format === 'xlsx') {
      blob = await generateXlsxBlob(form, vesselName);
    } else {
      blob = generatePdfBlob(form, vesselName);
    }
    
    const file = new File([blob], `${form.formCode}_Blank_Report.${format}`, { type: blob.type });
    
    setUploadedFilesMap(prev => ({
      ...prev,
      [form.id]: {
        file,
        matched: true,
        content: `Blank Form of type ${format.toUpperCase()}`
      }
    }));
    triggerToast(`Successfully generated and matched blank ${format.toUpperCase()} form for ${form.formCode}!`, 'success');
  };

  const handleRemoveReportingFile = (formId: string) => {
    setUploadedFilesMap(prev => {
      const copy = { ...prev };
      delete copy[formId];
      return copy;
    });
    triggerToast('File removed from category queue.', 'success');
  };

  const handleProcessMultipleFiles = async (files: FileList | File[]) => {
    const activeCategoryForms = forms.filter(f => f.category === selectedCategory);
    // Sort descending by formCode length so longer patterns like COMI-SM-1-3A match before COMI-SM-1-3
    const sortedActiveForms = [...activeCategoryForms].sort((a, b) => b.formCode.length - a.formCode.length);
    let matchedCount = 0;
    let mismatchCount = 0;
    let zipDetected = false;

    // Check if there is any ZIP file dropped
    for (let i = 0; i < files.length; i++) {
      if (files[i].name.toLowerCase().endsWith('.zip')) {
        zipDetected = true;
        await handleZipUploadInternal(files[i]);
        return;
      }
    }

    const updatedMap = { ...uploadedFilesMap };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cleanFileName = file.name.trim().toUpperCase();

      // Find if this matches any form code in the current category (longest first)
      const formMatch = sortedActiveForms.find(f => {
        const cleanCode = f.formCode.trim().toUpperCase();
        return cleanFileName.startsWith(cleanCode);
      });

      if (formMatch) {
        const validation = await validateFileAgainstForm(file, formMatch);
        updatedMap[formMatch.id] = {
          file,
          matched: validation.matched,
          reason: validation.reason,
          content: validation.content
        };
        if (validation.matched) {
          matchedCount++;
        } else {
          mismatchCount++;
        }
      } else {
        // If it starts with another form code from ANOTHER category, indicate mismatch
        const sortedAllForms = [...forms].sort((a, b) => b.formCode.length - a.formCode.length);
        const generalFormMatch = sortedAllForms.find(f => cleanFileName.startsWith(f.formCode.trim().toUpperCase()));
        if (generalFormMatch) {
          mismatchCount++;
          triggerToast(`File ${file.name} belongs to category "${generalFormMatch.category}" instead of "${selectedCategory}"!`, 'error');
        } else {
          mismatchCount++;
          triggerToast(`File ${file.name} does not match any known form codes.`, 'error');
        }
      }
    }

    setUploadedFilesMap(updatedMap);
    if (matchedCount > 0 || mismatchCount > 0) {
      triggerToast(`Processed files: ${matchedCount} matched, ${mismatchCount} mismatch.`, mismatchCount > 0 ? 'error' : 'success');
    }
  };

  const handleZipUploadInternal = async (zipFile: File) => {
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const activeCategoryForms = forms.filter(f => f.category === selectedCategory);
      const sortedActiveForms = [...activeCategoryForms].sort((a, b) => b.formCode.length - a.formCode.length);
      const extractedList: { file: File; form: SMSForm }[] = [];
      const promises: Promise<void>[] = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;

        const p = zipEntry.async('blob').then((blob) => {
          const name = zipEntry.name.split('/').pop() || zipEntry.name;
          const file = new File([blob], name, { type: 'application/octet-stream' });
          const cleanFileName = name.trim().toUpperCase();

          const formMatch = sortedActiveForms.find(f => {
            const cleanCode = f.formCode.trim().toUpperCase();
            return cleanFileName.startsWith(cleanCode);
          });

          if (formMatch) {
            extractedList.push({ file, form: formMatch });
          }
        });
        promises.push(p);
      });

      await Promise.all(promises);

      if (extractedList.length === 0) {
        triggerToast('No files matching current category form codes found in the uploaded ZIP archive.', 'error');
        return;
      }

      const updatedMap = { ...uploadedFilesMap };
      let matched = 0;
      let mismatch = 0;

      for (const item of extractedList) {
        const val = await validateFileAgainstForm(item.file, item.form);
        updatedMap[item.form.id] = {
          file: item.file,
          matched: val.matched,
          reason: val.reason,
          content: val.content
        };
        if (val.matched) matched++;
        else mismatch++;
      }

      setUploadedFilesMap(updatedMap);
      triggerToast(`Extracted ${extractedList.length} files from ZIP: ${matched} matched, ${mismatch} mismatch.`, mismatch > 0 ? 'error' : 'success');
    } catch (e: any) {
      triggerToast(`Failed to extract ZIP archive: ${e.message}`, 'error');
    }
  };

  const handleDownloadPartialZip = async () => {
    const activeCategoryForms = forms.filter(f => f.category === selectedCategory);
    const matchedItems = activeCategoryForms
      .map(form => uploadedFilesMap[form.id])
      .filter(item => item && item.matched);

    if (matchedItems.length === 0) {
      triggerToast('There are no matched valid files to compile into a ZIP.', 'error');
      return;
    }

    try {
      const zip = new JSZip();
      matchedItems.forEach(item => {
        zip.file(item.file.name, item.file);
      });

      const targetVessel = vesselsList.find(v => String(v.id) === String(reportingVesselId));
      const vName = targetVessel ? targetVessel.name.replace(/\s+/g, '_') : 'Vessel';
      const cName = selectedCategory.replace(/[\s\.]+/g, '_');

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${vName}_${reportingMonth}_${reportingYear}_${cName}_Partial_Package.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      triggerToast('Downloaded compiled ZIP with mismatching files excluded successfully.', 'success');
    } catch (e: any) {
      triggerToast(`Failed to compile ZIP: ${e.message}`, 'error');
    }
  };

  const handleUploadToBackblazeCloud = async () => {
    const targetVessel = vesselsList.find(v => String(v.id) === String(reportingVesselId));
    if (!targetVessel) {
      triggerToast('Please select a valid vessel first.', 'error');
      return;
    }

    const activeCategoryForms = forms.filter(f => f.category === selectedCategory);
    const matchedItems = activeCategoryForms
      .map(form => uploadedFilesMap[form.id])
      .filter(item => item && item.matched);

    if (matchedItems.length === 0) {
      triggerToast('No valid files have been matched for submission.', 'error');
      return;
    }

    setB2UploadStatus('zipping');
    setB2UploadProgress(15);
    setB2UploadError('');

    try {
      // 1. Zip all files
      const zip = new JSZip();
      matchedItems.forEach(item => {
        zip.file(item.file.name, item.file);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const vNameClean = targetVessel.name.replace(/\s+/g, '_');
      const catClean = selectedCategory.replace(/[\s\.]+/g, '_');
      const filename = `${vNameClean}_${reportingMonth}_${reportingYear}_${catClean}_Package.zip`;

      setCompiledZipBlob(blob);
      setCompiledZipName(filename);
      setB2UploadProgress(40);

      // 2. Simulate Uploading
      setB2UploadStatus('uploading');
      
      const interval = setInterval(() => {
        setB2UploadProgress(p => {
          if (p >= 90) {
            clearInterval(interval);
            return 90;
          }
          return p + 5;
        });
      }, 150);

      // Wait a bit to simulate real upload latency
      await new Promise(r => setTimeout(r, 1200));
      clearInterval(interval);

      if (simulateB2Failure) {
        setB2UploadProgress(0);
        setB2UploadStatus('error');
        setB2UploadError('Error connecting to Backblaze B2 Storage S3 endpoint: Host unreachable. Please download the ZIP and re-upload later.');
        triggerToast('B2 Cloud Storage Upload Failed (Simulated). Download the ZIP file for later re-upload.', 'error');
        return;
      }

      // 3. Real server upload if token is present
      if (token) {
        const formData = new FormData();
        formData.append('file', new File([blob], filename, { type: 'application/zip' }));
        formData.append('vessel_id', reportingVesselId);
        formData.append('vessel_name', targetVessel.name);
        formData.append('month', reportingMonth);
        formData.append('year', reportingYear);
        formData.append('file_size', (blob.size / (1024 * 1024)).toFixed(2) + ' MB');

        const response = await fetch('/api/sms/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || 'Backblaze S3 write error');
        }

        const result = await response.json();
        if (result.upload) {
          setUploads(prev => [result.upload, ...prev]);
        }
      } else {
        // Mock server upload persistence in localStorage
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + 
          ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
        const newUploadItem: VesselUpload = {
          id: 'up_' + Date.now(),
          vesselId: reportingVesselId,
          vesselName: targetVessel.name,
          month: reportingMonth,
          year: reportingYear,
          fileName: filename,
          uploadedAt: formattedDate,
          fileSize: (blob.size / (1024 * 1024)).toFixed(2) + ' MB'
        };

        const updatedUploads = [newUploadItem, ...uploads];
        setUploads(updatedUploads);
        localStorage.setItem('comos_sms_uploads_list', JSON.stringify(updatedUploads));
      }

      // Set submission period to match
      const updatedPeriods = submissionPeriods.map(p => {
        if (String(p.vesselId) === String(reportingVesselId)) {
          return { ...p, month: reportingMonth, year: reportingYear };
        }
        return p;
      });
      setSubmissionPeriods(updatedPeriods);
      localStorage.setItem('comos_sms_submission_periods', JSON.stringify(updatedPeriods));

      setB2UploadProgress(100);
      setB2UploadStatus('success');
      triggerToast(`Successfully uploaded ${filename} to the server!`, 'success');
      
      // Clear reporting state on success
      setUploadedFilesMap({});
      setCompiledZipBlob(null);
    } catch (err: any) {
      setB2UploadProgress(0);
      setB2UploadStatus('error');
      setB2UploadError(err.message || 'Unknown network error while writing to cloud server.');
      triggerToast(`B2 Upload Failed: ${err.message}`, 'error');
    }
  };

  const handleDownloadCompiledZipAfterFailure = () => {
    if (!compiledZipBlob || !compiledZipName) {
      triggerToast('No compiled ZIP package available to download.', 'error');
      return;
    }
    const url = URL.createObjectURL(compiledZipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = compiledZipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    triggerToast('Successfully downloaded the compiled ZIP for local backup!', 'success');
  };

  // --- END SMS REPORTING SPECIALIZED ACTIONS ---

  // Simulated drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedUploadFile(e.target.files[0]);
    }
  };

  // Perform upload using actual API connected to B2 Backblaze
  const handlePerformUpload = async () => {
    if (!selectedUploadFile || !uploadingVesselId) {
      triggerToast('Please select a vessel and drop or select a file first.', 'error');
      return;
    }

    const targetVessel = vesselsList.find(v => String(v.id) === String(uploadingVesselId));
    if (!targetVessel) return;

    if (!token) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          
          const now = new Date();
          const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + 
            ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
          const newUploadItem: VesselUpload = {
            id: 'up_' + Date.now(),
            vesselId: uploadingVesselId,
            vesselName: targetVessel.name,
            month: uploadingMonth,
            year: uploadingYear,
            fileName: selectedUploadFile.name,
            uploadedAt: formattedDate,
            fileSize: (selectedUploadFile.size / (1024 * 1024)).toFixed(1) + ' MB'
          };

          const updatedUploads = [newUploadItem, ...uploads];
          setUploads(updatedUploads);
          localStorage.setItem('comos_sms_uploads_list', JSON.stringify(updatedUploads));

          // Update the period to match the uploaded month/year to simulate real workflow
          const updatedPeriods = submissionPeriods.map(p => {
            if (String(p.vesselId) === String(uploadingVesselId)) {
              return { ...p, month: uploadingMonth, year: uploadingYear };
            }
            return p;
          });
          setSubmissionPeriods(updatedPeriods);
          localStorage.setItem('comos_sms_submission_periods', JSON.stringify(updatedPeriods));

          setSelectedUploadFile(null);
          setUploadProgress(0);
          triggerToast(`Forms for ${targetVessel.name} (${uploadingMonth} ${uploadingYear}) uploaded successfully.`, 'success');
        }
      }, 150);
      return;
    }

    setUploadProgress(10);
    try {
      const formData = new FormData();
      formData.append('file', selectedUploadFile);
      formData.append('vessel_id', uploadingVesselId);
      formData.append('vessel_name', targetVessel.name);
      formData.append('month', uploadingMonth);
      formData.append('year', uploadingYear);
      formData.append('file_size', (selectedUploadFile.size / (1024 * 1024)).toFixed(1) + ' MB');

      setUploadProgress(45);
      const response = await fetch('/api/sms/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      setUploadProgress(85);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);

      setTimeout(() => {
        if (result.upload) {
          setUploads(prev => [result.upload, ...prev]);
        }
        
        // Update the period locally to match the uploaded month/year
        const updatedPeriods = submissionPeriods.map(p => {
          if (String(p.vesselId) === String(uploadingVesselId)) {
            return { ...p, month: uploadingMonth, year: uploadingYear };
          }
          return p;
        });
        setSubmissionPeriods(updatedPeriods);
        localStorage.setItem('comos_sms_submission_periods', JSON.stringify(updatedPeriods));

        setSelectedUploadFile(null);
        setUploadProgress(0);
        triggerToast(`Forms for ${targetVessel.name} (${uploadingMonth} ${uploadingYear}) uploaded to server successfully.`, 'success');
      }, 300);

    } catch (err: any) {
      setUploadProgress(0);
      triggerToast(`Upload failed: ${err.message}`, 'error');
    }
  };

  // Manage forms: Create or Update Form
  const handleOpenFormModal = (form?: SMSForm) => {
    if (form) {
      setEditingForm(form);
      setFormCodeInput(form.formCode);
      setFormDescriptionInput(form.description);
      setFormDateInput(form.formDate);
      setFormScopeInput(form.scope);
      setFormTypeInput(form.type || 'Form');

      // Determine flag from scope
      if (form.scope === 'All Vessels' || !form.scope) {
        setSelectedFlagScope('All Flags');
      } else if (form.scope.startsWith('All ') && form.scope.endsWith(' Vessels')) {
        const flagName = form.scope.substring(4, form.scope.length - 8);
        setSelectedFlagScope(flagName);
      } else {
        // Specific vessel scope
        const matchedVessel = vesselsList.find(v => v.name === form.scope);
        if (matchedVessel && matchedVessel.flag) {
          setSelectedFlagScope(matchedVessel.flag);
        } else {
          setSelectedFlagScope('All Flags');
        }
      }
    } else {
      setEditingForm(null);
      setFormCodeInput('');
      setFormDescriptionInput('');
      setFormDateInput(new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }));
      setFormScopeInput('All Vessels');
      setFormTypeInput('Form');
      setSelectedFlagScope('All Flags');
    }
    setShowFormModal(true);
  };

  const handleSaveFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCodeInput || !formDescriptionInput) {
      triggerToast('Form Code and Description are required.', 'error');
      return;
    }

    if (editingForm) {
      // Edit mode
      const updatedForms = forms.map(f => {
        if (f.id === editingForm.id) {
          return {
            ...f,
            formCode: formCodeInput,
            description: formDescriptionInput,
            formDate: formDateInput,
            scope: formScopeInput,
            type: formTypeInput
          };
        }
        return f;
      });
      setForms(updatedForms);
      localStorage.setItem('comos_sms_manage_forms', JSON.stringify(updatedForms));
      triggerToast(`${formTypeInput === 'Checklist' ? 'Checklist' : 'Form'} ${formCodeInput} updated successfully.`, 'success');
    } else {
      // Create mode
      const newFormItem: SMSForm = {
        id: 'f_' + Date.now(),
        category: selectedCategory,
        formCode: formCodeInput,
        description: formDescriptionInput,
        formDate: formDateInput || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        scope: formScopeInput,
        type: formTypeInput
      };
      const updatedForms = [...forms, newFormItem];
      setForms(updatedForms);
      localStorage.setItem('comos_sms_manage_forms', JSON.stringify(updatedForms));
      triggerToast(`${formTypeInput === 'Checklist' ? 'Checklist' : 'Form'} ${formCodeInput} added to section ${selectedCategory}.`, 'success');
    }
    setShowFormModal(false);
  };

  const handleDeleteForm = (id: string, code: string) => {
    if (window.confirm(`Are you sure you want to delete form ${code}?`)) {
      const updatedForms = forms.filter(f => f.id !== id);
      setForms(updatedForms);
      localStorage.setItem('comos_sms_manage_forms', JSON.stringify(updatedForms));
      triggerToast(`Form ${code} deleted successfully.`, 'success');
    }
  };

  // Helper: Find current submission period details of a vessel
  const getVesselPeriodString = (vId: string, vName: string) => {
    const found = submissionPeriods.find(p => String(p.vesselId) === String(vId));
    return found ? `${vName} (${found.month} ${found.year})` : `${vName} (June 2026)`;
  };

  const renderSubmittedFilesAccordion = () => {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden mt-6">
        <button 
          onClick={() => setIsAccordion3Open(!isAccordion3Open)}
          className="w-full p-4 flex items-center justify-between font-bold text-xs text-blue-900 bg-blue-50/20 hover:bg-blue-50/40 border-b border-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full border border-blue-500/80 bg-blue-50 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            </div>
            <span className="text-xs font-extrabold tracking-tight">Submitted Files (Vessel Uploads)</span>
          </div>
          {isAccordion3Open ? <ChevronUp className="w-4 h-4 text-blue-900" /> : <ChevronDown className="w-4 h-4 text-blue-900" />}
        </button>

        {isAccordion3Open && (
          <div className="p-6 bg-white space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              {/* Filters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
                {/* Vessel selection */}
                <div className="md:col-span-5 space-y-1">
                  <label className="block text-[11px] font-extrabold text-blue-900 uppercase tracking-wider">Vessel</label>
                  <select
                    value={selectedFilterVesselId}
                    onChange={(e) => {
                      setSelectedFilterVesselId(e.target.value);
                      setHasLoadedFilter(false); // Reset load state so user clicks Load Files to load
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 font-semibold"
                  >
                    <option value="">--Select Vessel--</option>
                    {vesselsList.map(v => (
                      <option key={v.id} value={String(v.id)}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Month Selection */}
                <div className="md:col-span-4 space-y-1">
                  <label className="block text-[11px] font-extrabold text-blue-900 uppercase tracking-wider">Report Month (optional)</label>
                  <select
                    value={selectedFilterMonth}
                    onChange={(e) => {
                      setSelectedFilterMonth(e.target.value);
                      setHasLoadedFilter(false);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 font-semibold"
                  >
                    <option value="All">--All Months--</option>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Year Selection */}
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[11px] font-extrabold text-blue-900 uppercase tracking-wider">Report Year</label>
                  <input
                    type="text"
                    value={selectedFilterYear}
                    onChange={(e) => {
                      setSelectedFilterYear(e.target.value);
                      setHasLoadedFilter(false);
                    }}
                    placeholder="2026"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 font-bold bg-white text-slate-700"
                  />
                </div>
              </div>

              {/* Load Button */}
              <div className="shrink-0 flex items-end">
                <button
                  type="button"
                  onClick={handleLoadFiles}
                  className="px-6 py-2 bg-[#1a8cbc] hover:bg-[#157299] text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-xs cursor-pointer h-9 flex items-center justify-center min-w-[100px]"
                >
                  Load Files
                </button>
              </div>
            </div>

            {/* Download All Row */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-400 font-bold">
                Active Category: <span className="text-blue-600 font-extrabold">{selectedCategory}</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadAllFiltered}
                disabled={filteredUploads.length === 0}
                className={`px-4 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filteredUploads.length > 0 
                    ? 'border-sky-200 bg-white hover:bg-sky-50 text-sky-600' 
                    : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Download All
              </button>
            </div>

            {/* Filtered Files Results Table/Area */}
            {hasLoadedFilter ? (
              filteredUploads.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 border-b border-slate-700 text-[10px] font-black text-white uppercase tracking-wider">
                        <th className="px-4 py-3 w-[45%]">File Name</th>
                        <th className="px-4 py-3 w-[15%]">Month / Year</th>
                        <th className="px-4 py-3 w-[15%]">Size</th>
                        <th className="px-4 py-3 w-[15%]">Uploaded At</th>
                        <th className="px-4 py-3 w-[10%] text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredUploads.map((up) => {
                        const isZip = up.fileName.toLowerCase().endsWith('.zip');
                        const isPdf = up.fileName.toLowerCase().endsWith('.pdf');
                        const isExcel = up.fileName.toLowerCase().endsWith('.xlsx') || up.fileName.toLowerCase().endsWith('.xls');
                        const isWord = up.fileName.toLowerCase().endsWith('.docx') || up.fileName.toLowerCase().endsWith('.doc');
                        const isExpanded = !!expandedZipIds[up.id];
                        const isLoading = !!loadingZips[up.id];
                        const contents = zipContents[up.id] || [];
                        
                        return (
                          <React.Fragment key={up.id}>
                            <tr className="hover:bg-slate-50/40 transition-colors text-xs font-semibold text-slate-600">
                              <td className="px-4 py-3 font-extrabold text-slate-800 flex items-center gap-2">
                                {isZip && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandZip(up.id, up.fileName);
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-all shrink-0 cursor-pointer"
                                    title={isExpanded ? "Collapse ZIP files" : "Expand ZIP files"}
                                  >
                                    {isLoading ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                    ) : isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                    )}
                                  </button>
                                )}
                                {!isZip && <div className="w-7 h-7" />} {/* alignment spacing matching zip expand button width */}
                                {isZip ? (
                                  <Archive className="w-4 h-4 text-amber-500 shrink-0" />
                                ) : isPdf ? (
                                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                                ) : isExcel ? (
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : isWord ? (
                                  <FileIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <span className="truncate max-w-[320px] block" title={up.fileName}>
                                  {up.fileName}
                                </span>
                                {isZip && (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-sm border border-amber-200/50 font-black tracking-tight uppercase ml-1">
                                    Package ZIP
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {up.month} {up.year}
                              </td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                {up.fileSize}
                              </td>
                              <td className="px-4 py-3 text-slate-400 text-[11px]">
                                {up.uploadedAt}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(up.id, up.fileName)}
                                    className="p-1 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-all cursor-pointer"
                                    title="Download File"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUpload(up.id, up.fileName)}
                                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                    title="Delete File"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded files section */}
                            {isZip && isExpanded && (
                              <>
                                {isLoading && (
                                  <tr className="bg-slate-50/50">
                                    <td colSpan={5} className="px-4 py-3 pl-16 text-xs text-slate-400 italic font-semibold">
                                      <div className="flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                        Extracting ZIP archive index...
                                      </div>
                                    </td>
                                  </tr>
                                )}

                                {!isLoading && contents.length === 0 && (
                                  <tr className="bg-slate-50/50">
                                    <td colSpan={5} className="px-4 py-3 pl-16 text-xs text-slate-400 italic">
                                      No files found in ZIP archive.
                                    </td>
                                  </tr>
                                )}

                                {!isLoading && contents.map((innerFile, innerIdx) => {
                                  const isInnerPdf = innerFile.name.toLowerCase().endsWith('.pdf');
                                  const isInnerExcel = innerFile.name.toLowerCase().endsWith('.xlsx') || innerFile.name.toLowerCase().endsWith('.xls');
                                  const isInnerWord = innerFile.name.toLowerCase().endsWith('.docx') || innerFile.name.toLowerCase().endsWith('.doc');
                                  
                                  return (
                                    <tr key={`${up.id}-inner-${innerIdx}`} className="bg-blue-50/5 hover:bg-blue-50/15 border-l-4 border-blue-500 transition-colors text-xs font-semibold text-slate-600">
                                      <td className="px-4 py-2.5 font-bold text-slate-700 flex items-center gap-2 pl-12">
                                        {isInnerPdf ? (
                                          <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                        ) : isInnerExcel ? (
                                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        ) : isInnerWord ? (
                                          <FileIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        ) : (
                                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        )}
                                        <span className="truncate max-w-[280px] block text-[11px]" title={innerFile.name}>
                                          {innerFile.name}
                                        </span>
                                        <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded-sm border border-blue-200/50 font-extrabold tracking-tight scale-90 origin-left uppercase">
                                          ZIP Entry
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                                        --
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                                        {innerFile.size > 1024 * 1024 
                                          ? `${(innerFile.size / (1024 * 1024)).toFixed(1)} MB` 
                                          : `${(innerFile.size / 1024).toFixed(1)} KB`}
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                                        --
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        <button
                                          type="button"
                                          onClick={() => handleDownloadIndividualZipFile(up.id, up.fileName, innerFile.name, innerFile.isSimulated)}
                                          className="p-1 text-sky-600 hover:text-sky-800 hover:bg-sky-100/70 rounded transition-all cursor-pointer inline-flex items-center"
                                          title="Download individual file from ZIP"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No submissions found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">There are no files uploaded by this vessel matching the active category ({selectedCategory}) for the selected period.</p>
                </div>
              )
            ) : (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
                <Info className="w-8 h-8 text-blue-400/70 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">Filters Loaded Pending</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Please select a Vessel and click <strong className="text-blue-600">"Load Files"</strong> to search and retrieve matching SMM submissions.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Helper: Find last upload status of a vessel
  const getVesselLastUploadString = (vId: string) => {
    const foundUploads = uploads.filter(up => String(up.vesselId) === String(vId));
    if (foundUploads.length === 0) return 'No uploads found';
    
    // Get latest uploaded file by sorting or taking index 0 (as we prepend new items)
    const latest = foundUploads[0];
    return `${latest.month} ${latest.year} Forms were uploaded on ${latest.uploadedAt}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-slate-700 animate-in fade-in duration-300">
      
      {/* Toast notifications */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-top duration-300 bg-slate-900 border-slate-800 text-white">
          {toastMessage.type === 'success' ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          )}
          <p className="text-xs font-bold">{toastMessage.text}</p>
        </div>
      )}

      {/* Main Container Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-wider mb-1 border border-blue-100/50">
            {mode === 'reporting' ? 'SMS Reporting' : 'SMS Management'}
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            {mode === 'reporting' ? 'Safety Management System (SMS) - Reporting' : 'Safety Management System (SMS) - Management'}
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            {mode === 'reporting' 
              ? 'Submit finished safety checklists and forms, upload vessel report packages, download submitted vessel archives, and monitor previous submissions.' 
              : 'Manage official vessel-level forms and checklist structures, monitor active submission deadlines, download submitted vessel archives, and administer structural compliance records.'}
          </p>
        </div>
      </div>

      {/* Grid of 10 Safety Manual Category cards - Only visible in Management Mode */}
      {/* Grid of 10 Safety Manual Category cards - Visible in both modes */}
      <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100/80 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="px-3 py-1 bg-blue-100/70 text-blue-700 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
            Safety Management Manual
          </span>
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
            Select Category to {mode === 'reporting' ? 'Report Files' : 'Manage Forms'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-2.5">
          {Object.keys(CATEGORY_ICONS).map((catName) => {
            const IconComponent = CATEGORY_ICONS[catName];
            const isActive = selectedCategory === catName;
            
            return (
              <button
                key={catName}
                onClick={() => setSelectedCategory(catName)}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all duration-200 cursor-pointer min-h-[90px] ${
                  isActive 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500/10' 
                    : 'border-slate-200/60 bg-white hover:border-slate-300 text-slate-500 hover:text-slate-800 hover:shadow-xs'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-blue-100/85 text-blue-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {IconComponent && <IconComponent className="w-4 h-4 stroke-[2.2]" />}
                </div>
                <span className="text-[10px] font-black tracking-tight leading-tight">
                  {catName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordions sections list */}
      <div className="space-y-4">
        
        {/* Accordion 1: Set Monthly Submission Period */}
        {mode === 'management' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <button 
              onClick={() => setIsAccordion1Open(!isAccordion1Open)}
              className="w-full p-4 flex items-center justify-between font-bold text-xs text-blue-900 bg-blue-50/20 hover:bg-blue-50/40 border-b border-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                <span className="text-xs font-extrabold tracking-tight">Set Monthly Submission Period (per vessel)</span>
              </div>
              {isAccordion1Open ? <ChevronUp className="w-4 h-4 text-blue-900" /> : <ChevronDown className="w-4 h-4 text-blue-900" />}
            </button>

            {isAccordion1Open && (
              <div className="p-6 space-y-4 bg-white animate-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-slate-500 font-semibold italic">
                  Sets the submission month and year for the selected vessel only.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  {/* Vessel selection */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Vessel</label>
                    <select
                      value={selectedPeriodVesselId}
                      onChange={(e) => setSelectedPeriodVesselId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 font-semibold"
                    >
                      <option value="">--Select Vessel--</option>
                      {vesselsList.map(v => (
                        <option key={v.id} value={String(v.id)}>
                          {getVesselPeriodString(v.id, v.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Month Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Submission Month</label>
                    <select
                      value={selectedPeriodMonth}
                      onChange={(e) => setSelectedPeriodMonth(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 font-semibold"
                    >
                      <option value="">--Month--</option>
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Year Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Submission Year</label>
                    <input
                      type="number"
                      value={selectedPeriodYear}
                      onChange={(e) => setSelectedPeriodYear(e.target.value)}
                      placeholder="2026"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 font-bold bg-white text-slate-700"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={handleApplySubmissionPeriod}
                    className="px-5 py-2.5 bg-[#1da1f2] hover:bg-[#1991db] text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-50 cursor-pointer"
                  >
                    Apply Submission Period
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accordion 2: Last Uploads by Vessel */}
        {mode === 'management' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <button 
              onClick={() => setIsAccordion2Open(!isAccordion2Open)}
              className="w-full p-4 flex items-center justify-between font-bold text-xs text-blue-900 bg-blue-50/20 hover:bg-blue-50/40 border-b border-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                <span className="text-xs font-extrabold tracking-tight">Last Uploads by Vessel</span>
              </div>
              {isAccordion2Open ? <ChevronUp className="w-4 h-4 text-blue-900" /> : <ChevronDown className="w-4 h-4 text-blue-900" />}
            </button>

            {isAccordion2Open && (
              <div className="p-0 bg-white animate-in slide-in-from-top-2 duration-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 border-b border-slate-700 text-[10px] font-black text-white uppercase tracking-wider">
                        <th className="px-6 py-4 w-1/3">Vessel</th>
                        <th className="px-6 py-4 w-2/3">Last Uploaded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vesselsList.map((v) => {
                        const uploadString = getVesselLastUploadString(v.id);
                        const isNoUpload = uploadString === 'No uploads found';
                        
                        return (
                          <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-3.5 text-xs font-extrabold text-slate-400 uppercase tracking-wide">
                              {v.name}
                            </td>
                            <td className={`px-6 py-3.5 text-xs font-bold ${isNoUpload ? 'text-slate-300 italic font-semibold' : 'text-slate-500'}`}>
                              {uploadString}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accordion 3: Submitted Files (Vessel Uploads) */}
        {mode === 'management' && renderSubmittedFilesAccordion()}

        {/* NEW REVOLUTIONARY SMS REPORTING WORKSPACE */}
        {mode === 'reporting' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Control Bar & Simulator */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">SMS Reporting Terminal</h3>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Vessel users portal to validate safety checklists, auto-match system files, compile secure packages, and upload directly to cloud servers.
                </p>
              </div>

              {/* Vessel & Period Selection */}
              <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                <div className="flex flex-col gap-1 shrink-0">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Vessel</label>
                  <select
                    value={reportingVesselId}
                    onChange={(e) => {
                      setReportingVesselId(e.target.value);
                      setUploadedFilesMap({}); // Reset map on vessel change
                    }}
                    className="bg-slate-800 text-xs font-bold text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {vesselsList.map(v => (
                      <option key={v.id} value={String(v.id)}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Report Period</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={reportingMonth}
                      onChange={(e) => {
                        setReportingMonth(e.target.value);
                        setUploadedFilesMap({});
                      }}
                      className="bg-slate-800 text-xs font-bold text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={reportingYear}
                      onChange={(e) => {
                        setReportingYear(e.target.value);
                        setUploadedFilesMap({});
                      }}
                      className="bg-slate-800 text-xs font-bold text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {['2025', '2026', '2027', '2028'].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Simulation Toggle */}
                {currentUser?.role === 'admin' && (
                  <div className="flex flex-col gap-1 shrink-0 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">B2 Upload Simulator</span>
                    <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={simulateB2Failure}
                        onChange={(e) => setSimulateB2Failure(e.target.checked)}
                        className="w-4 h-4 text-red-500 rounded focus:ring-red-500/50 focus:ring-2 bg-slate-700 border-slate-600"
                      />
                      <span className="text-[11px] font-bold text-red-400">Simulate Upload Failure</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left Side: Category Forms Checklist & Header Matching (8 cols) */}
              <div className="xl:col-span-8 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-blue-600" />
                        Compliance Queue: {selectedCategory}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        All files uploaded here must begin with their respective Form Code. The text headers must match the registered database structure.
                      </p>
                    </div>

                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-extrabold uppercase tracking-widest rounded-full">
                      {forms.filter(f => f.category === selectedCategory).length} Forms Required
                    </span>
                  </div>

                  {/* Form Rows */}
                  <div className="divide-y divide-slate-100 space-y-4 pt-1">
                    {forms.filter(f => f.category === selectedCategory).length === 0 ? (
                      <div className="text-center py-12 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-400 font-semibold italic">
                          No forms defined in SMS Management for "{selectedCategory}". Please define them in Management mode first.
                        </p>
                      </div>
                    ) : (
                      forms.filter(f => f.category === selectedCategory).map((form) => {
                        const fileState = uploadedFilesMap[form.id];
                        
                        return (
                          <div key={form.id} className="pt-4 first:pt-0 space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              {/* Form Reference Details */}
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 bg-slate-800 text-white font-mono text-[10px] font-black rounded-md tracking-tight uppercase">
                                    {form.formCode}
                                  </span>
                                  <h5 className="text-xs font-black text-slate-700">{form.description}</h5>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  <span>Target Date: {form.formDate}</span>
                                  <span>•</span>
                                  <span>Scope: {form.scope}</span>
                                </div>
                              </div>

                              {/* Row Status Badge */}
                              <div>
                                {!fileState ? (
                                  <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-extrabold rounded-full uppercase tracking-widest">
                                    Pending Upload
                                  </span>
                                ) : fileState.matched ? (
                                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-extrabold rounded-full uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Matched &amp; Verified
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-extrabold rounded-full uppercase tracking-widest flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5" /> Validation Mismatch
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status Body Details / Interaction */}
                            <div className="p-3.5 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-3">
                              {!fileState ? (
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                  <div className="flex items-center gap-3 text-slate-400 text-xs">
                                    <Info className="w-4 h-4 shrink-0" />
                                    <p className="font-medium text-slate-500">
                                      Upload a file (.docx, .doc, .xlsx, .xls, .pdf) starting with <strong className="font-bold text-slate-700">{form.formCode}</strong> to validate.
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                                    {currentUser?.role === 'admin' && (
                                      <>
                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                                          <select
                                            id={`format-select-${form.id}`}
                                            className="px-2 py-1 bg-slate-50 text-[10px] font-extrabold text-slate-500 border-r border-slate-200 focus:outline-none cursor-pointer h-full"
                                            defaultValue="docx"
                                          >
                                            <option value="docx">.DOCX</option>
                                            <option value="doc">.DOC</option>
                                            <option value="xlsx">.XLSX</option>
                                            <option value="xls">.XLS</option>
                                            <option value="pdf">.PDF</option>
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const sel = document.getElementById(`format-select-${form.id}`) as HTMLSelectElement;
                                              handleGenerateTestFile(form, (sel?.value || 'docx') as any);
                                            }}
                                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                            title="Download valid template file with matching headers"
                                          >
                                            <FileCode className="w-3.5 h-3.5 text-blue-500" />
                                            Valid Demo
                                          </button>
                                        </div>

                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                                          <select
                                            id={`blank-format-select-${form.id}`}
                                            className="px-2 py-1 bg-slate-50 text-[10px] font-extrabold text-slate-500 border-r border-slate-200 focus:outline-none cursor-pointer h-full"
                                            defaultValue="docx"
                                          >
                                            <option value="docx">.DOCX</option>
                                            <option value="xlsx">.XLSX</option>
                                            <option value="pdf">.PDF</option>
                                          </select>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const sel = document.getElementById(`blank-format-select-${form.id}`) as HTMLSelectElement;
                                              handleGenerateAndMatchBlankFile(form, (sel?.value || 'docx') as any);
                                            }}
                                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                            title="Submit an authorized blank file to the compliance queue"
                                          >
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                            Blank Form
                                          </button>
                                        </div>
                                      </>
                                    )}

                                    <div className="relative shrink-0">
                                      <span className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all shadow-xs shadow-blue-100 inline-block cursor-pointer">
                                        Upload File
                                      </span>
                                      <input
                                        type="file"
                                        accept=".docx,.doc,.xlsx,.xls,.pdf"
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handleProcessMultipleFiles([e.target.files[0]]);
                                          }
                                        }}
                                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : fileState.matched ? (
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs">
                                      <FileText className="w-4 h-4 text-emerald-600" />
                                      <span className="font-extrabold text-slate-700">{fileState.file.name}</span>
                                      <span className="text-[10px] text-slate-400 font-bold">({(fileState.file.size / 1024).toFixed(1)} KB)</span>
                                    </div>
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                      ✓ Form Code, description, and form date matched database successfully.
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => handleRemoveReportingFile(form.id)}
                                      className="p-1.5 hover:bg-white text-slate-400 hover:text-red-500 rounded-lg transition-all border border-transparent hover:border-slate-100 cursor-pointer"
                                      title="Remove Uploaded File"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 text-xs text-rose-700">
                                        <XCircle className="w-4 h-4 shrink-0" />
                                        <span className="font-black">{fileState.file.name}</span>
                                        <span className="text-[10px] text-rose-500 font-bold">({(fileState.file.size / 1024).toFixed(1)} KB)</span>
                                      </div>
                                      <p className="text-xs font-bold text-red-500 italic bg-red-50 px-2.5 py-1 rounded-lg border border-red-100/50 mt-1">
                                        {fileState.reason || 'Verification failure.'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => handleRemoveReportingFile(form.id)}
                                        className="p-1.5 hover:bg-white text-slate-400 hover:text-red-500 rounded-lg transition-all border border-transparent hover:border-slate-100 cursor-pointer"
                                        title="Clear Invalid File"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Error Help & Quick Generation Panel */}
                                  {currentUser?.role === 'admin' && (
                                    <div className="p-3 bg-red-50/20 rounded-xl border border-red-100/50 flex flex-col md:flex-row justify-between gap-3 items-start md:items-center">
                                      <p className="text-[11px] text-slate-500 leading-relaxed max-w-lg">
                                        Your file does not meet compliance checks. To bypass or fix, you can either generate a valid demo file that contains the proper headers, or submit an authorized blank form template.
                                      </p>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const fileExt = fileState.file.name.split('.').pop()?.toLowerCase();
                                            const validExts: any[] = ['docx', 'xlsx', 'pdf', 'doc', 'xls'];
                                            const ext = validExts.includes(fileExt) ? fileExt : 'docx';
                                            handleGenerateTestFile(form, ext as any);
                                          }}
                                          className="px-2.5 py-1.5 border border-red-200 bg-white hover:bg-red-50 text-rose-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5" />
                                          Generate Fix
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const fileExt = fileState.file.name.split('.').pop()?.toLowerCase();
                                            const validExts: any[] = ['docx', 'xlsx', 'pdf'];
                                            const ext = validExts.includes(fileExt) ? fileExt : 'docx';
                                            handleGenerateAndMatchBlankFile(form, ext as any);
                                          }}
                                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                        >
                                          <ShieldCheck className="w-3.5 h-3.5" />
                                          Force Match
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Big Drag & Drop Zone for Multiple Files & ZIPs */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-blue-600" /> Bulk Drop &amp; Match Center
                  </h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Save time by uploading multiple documents/spreadsheets/PDFs or a compiled ZIP archive. The system will extract them, read their filenames, match them to the correct checklist codes, and perform automated header scans simultaneously.
                  </p>

                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleProcessMultipleFiles(e.dataTransfer.files);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl h-36 flex flex-col items-center justify-center p-6 text-center transition-all relative ${
                      dragActive ? 'border-blue-500 bg-blue-50/50 shadow-inner' : 'border-slate-200 hover:border-blue-400 bg-slate-50/30'
                    }`}
                  >
                    <Upload className="w-7 h-7 text-blue-500 mb-2 shrink-0" />
                    <p className="text-xs font-extrabold text-slate-700">
                      Drag &amp; drop multiple report files or a ZIP archive here
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      Supports .docx, .doc, .xlsx, .xls, .pdf and .zip files • Files are matching by prefix automatically
                    </p>
                    <div className="mt-3 relative">
                      <span className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-slate-50 transition-all inline-block shadow-2xs cursor-pointer">
                        Select Files
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".docx,.doc,.xlsx,.xls,.pdf,.zip"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleProcessMultipleFiles(e.target.files);
                          }
                        }}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Backblaze Submission Control Panel (4 cols) */}
              <div className="xl:col-span-4 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 sticky top-6">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-blue-600" /> Submission Summary
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {vesselsList.find(v => String(v.id) === String(reportingVesselId))?.name || 'Vessel'} • {reportingMonth} {reportingYear}
                    </p>
                  </div>

                  {/* Compliance Progress Metrics */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500">Category Progress:</span>
                      <span className="font-extrabold text-slate-800">
                        {(() => {
                          const catForms = forms.filter(f => f.category === selectedCategory);
                          const matchedCount = catForms.filter(f => uploadedFilesMap[f.id]?.matched).length;
                          return `${matchedCount} / ${catForms.length} Matched`;
                        })()}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {(() => {
                      const catForms = forms.filter(f => f.category === selectedCategory);
                      const matchedCount = catForms.filter(f => uploadedFilesMap[f.id]?.matched).length;
                      const percentage = catForms.length > 0 ? (matchedCount / catForms.length) * 100 : 0;
                      return (
                        <div className="space-y-1">
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${percentage}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>{percentage.toFixed(0)}% Complete</span>
                            <span>{catForms.length - matchedCount} Remaining</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Dynamic Alert depending on completeness */}
                  {(() => {
                    const catForms = forms.filter(f => f.category === selectedCategory);
                    const matchedCount = catForms.filter(f => uploadedFilesMap[f.id]?.matched).length;
                    const isIncomplete = matchedCount < catForms.length;

                    if (catForms.length === 0) {
                      return null;
                    }

                    if (isIncomplete) {
                      return (
                        <div className="p-3.5 bg-amber-50/75 rounded-2xl border border-amber-100/70 text-slate-600 text-xs leading-relaxed space-y-2">
                          <p className="font-semibold text-amber-800">⚠️ Incomplete Category Package</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                            Your form checklist for <strong>{selectedCategory}</strong> is not fully uploaded. Under SMM regulations, you can download a partial ZIP with mismatching files removed to back up progress and complete the list later.
                          </p>
                          <button
                            type="button"
                            onClick={handleDownloadPartialZip}
                            disabled={matchedCount === 0}
                            className="w-full py-2 border border-amber-200 bg-white hover:bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Download className="w-4 h-4" /> Download Clean ZIP ({matchedCount})
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-3.5 bg-emerald-50 text-slate-600 text-xs leading-relaxed space-y-1.5 border border-emerald-100">
                          <p className="font-extrabold text-emerald-800">✓ Compliance Package Complete</p>
                          <p className="text-[11px] text-emerald-600 font-semibold">
                            All required checklists have been uploaded, matched, and validated against the compliance database structure. You are authorized to submit to B2 cloud servers!
                          </p>
                        </div>
                      );
                    }
                  })()}

                  {/* Backblaze B2 Upload status indicator and trigger */}
                  <div className="space-y-3 pt-2">
                    {b2UploadStatus === 'idle' ? (
                      <button
                        type="button"
                        onClick={handleUploadToBackblazeCloud}
                        disabled={forms.filter(f => f.category === selectedCategory).filter(f => uploadedFilesMap[f.id]?.matched).length === 0}
                        className="w-full py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Upload className="w-4 h-4" /> Upload to server
                      </button>
                    ) : b2UploadStatus === 'zipping' || b2UploadStatus === 'uploading' ? (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 animate-pulse">
                        <div className="flex justify-between items-center text-[11px] font-extrabold">
                          <span className="text-blue-600 flex items-center gap-1.5">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {b2UploadStatus === 'zipping' ? 'Compiling ZIP package...' : 'Transmitting to Backblaze B2...'}
                          </span>
                          <span className="text-slate-500">{b2UploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full rounded-full transition-all duration-200" 
                            style={{ width: `${b2UploadProgress}%` }} 
                          />
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center">
                          Securing S3 Endpoint connection...
                        </p>
                      </div>
                    ) : b2UploadStatus === 'success' ? (
                      <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 space-y-2.5">
                        <p className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Upload Successful!
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          The compiled category package has been written to bucket <code className="bg-emerald-100/60 text-emerald-800 px-1 rounded">comos-sms-vault-b2</code> and validated.
                        </p>
                        <button
                          type="button"
                          onClick={() => setB2UploadStatus('idle')}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-xs"
                        >
                          Upload New Package
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-50 text-rose-800 rounded-2xl border border-rose-100 space-y-3">
                        <p className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" /> B2 Connection Error
                        </p>
                        <p className="text-[11px] text-rose-700 font-semibold leading-relaxed bg-white/50 p-2.5 rounded-xl border border-rose-100/50">
                          {b2UploadError}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Your upload package is preserved in browser cache. Please download the ZIP immediately to preserve your matched reports and re-upload it later.
                        </p>
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={handleDownloadCompiledZipAfterFailure}
                            className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> Download Preserved ZIP
                          </button>
                          <button
                            type="button"
                            onClick={() => setB2UploadStatus('idle')}
                            className="w-full py-1.5 bg-white border border-rose-200 text-slate-600 hover:bg-rose-50 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                          >
                            Try Upload Again
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {renderSubmittedFilesAccordion()}
          </div>
        )}

        {/* Accordion 4: Manage Forms and Checklists Details */}
        {mode === 'management' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <button 
              onClick={() => setIsAccordion4Open(!isAccordion4Open)}
              className="w-full p-4 flex items-center justify-between font-bold text-xs text-blue-900 bg-blue-50/20 hover:bg-blue-50/40 border-b border-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                <span className="text-xs font-extrabold tracking-tight">Manage Forms and Checklists Details</span>
              </div>
              {isAccordion4Open ? <ChevronUp className="w-4 h-4 text-blue-900" /> : <ChevronDown className="w-4 h-4 text-blue-900" />}
            </button>

            {isAccordion4Open && (
              <div className="p-6 space-y-4 bg-white animate-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Current Section Selected</span>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Section: {selectedCategory}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Search bar for forms */}
                    <div className="relative w-48 sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search section forms..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:border-blue-500 font-semibold"
                      />
                    </div>

                    <button
                      onClick={() => handleOpenFormModal()}
                      className="px-3.5 py-1.5 bg-[#7cfc00] text-slate-800 hover:bg-[#6edc00] text-[11px] font-extrabold rounded-lg flex items-center gap-1 transition-all cursor-pointer border border-[#6edc00]/40"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Add file
                    </button>
                  </div>
                </div>

                {/* Forms Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 border-b border-slate-700 text-[10px] font-black text-white uppercase tracking-wider">
                        <th className="px-4 py-3.5 w-[5%] text-center">#</th>
                        <th className="px-4 py-3.5 w-[15%]">Form Code</th>
                        <th className="px-4 py-3.5 w-[45%]">Description</th>
                        <th className="px-4 py-3.5 w-[15%]">Form Date</th>
                        <th className="px-4 py-3.5 w-[10%]">Scope</th>
                        <th className="px-4 py-3.5 w-[10%] text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                      {forms
                        .filter(f => f.category === selectedCategory && (
                          f.formCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.description.toLowerCase().includes(searchQuery.toLowerCase())
                        ))
                        .map((f, idx) => (
                          <tr key={f.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-300 font-bold">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-black text-slate-400">
                              {f.formCode}
                            </td>
                            <td className="px-4 py-3 text-slate-400 font-bold leading-normal">
                              {f.description}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {f.formDate}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-1 bg-slate-800 text-white font-extrabold text-[9px] rounded-md tracking-wider inline-flex items-center gap-1">
                                🌐 {f.scope}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  onClick={() => handleOpenFormModal(f)}
                                  className="text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteForm(f.id, f.formCode)}
                                  className="text-red-500 hover:text-red-700 hover:underline flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                      {forms.filter(f => f.category === selectedCategory).length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center p-12 text-slate-400 italic">
                            No forms defined under section {selectedCategory} yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Add / Edit Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black tracking-tight uppercase">
                  {editingForm ? 'Edit Form Definition' : 'Add New Form Definition'}
                </h3>
                <p className="text-[10px] text-blue-100/80 font-bold mt-0.5">
                  Category: {selectedCategory}
                </p>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveFormSubmit} className="p-5 space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Form Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COMI-SM-1-6"
                  value={formCodeInput}
                  onChange={(e) => setFormCodeInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800 font-bold"
                />
              </div>

              {/* Form or Checklist Radio Buttons */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Type</label>
                <div className="flex items-center gap-6 py-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      name="formType"
                      value="Form"
                      checked={formTypeInput === 'Form'}
                      onChange={() => setFormTypeInput('Form')}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    Form
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      name="formType"
                      value="Checklist"
                      checked={formTypeInput === 'Checklist'}
                      onChange={() => setFormTypeInput('Checklist')}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    Checklist
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the purpose, checklist, or report target..."
                  value={formDescriptionInput}
                  onChange={(e) => setFormDescriptionInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800 leading-relaxed font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Form Date</label>
                <input
                  type="text"
                  placeholder="e.g. 28 November 2025"
                  value={formDateInput}
                  onChange={(e) => setFormDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white text-slate-800 font-semibold"
                />
              </div>

              {/* Flag Selection Dropdown */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Flag</label>
                <select
                  value={selectedFlagScope}
                  onChange={(e) => {
                    const newFlag = e.target.value;
                    setSelectedFlagScope(newFlag);
                    // Automatically update vessel scope option and value to reflect selected flag
                    if (newFlag === 'All Flags') {
                      setFormScopeInput('All Vessels');
                    } else {
                      setFormScopeInput(`All ${newFlag} Vessels`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-800"
                >
                  <option value="All Flags">All Flags</option>
                  {flags.map((f: any) => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Vessel Scope Dropdown */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Vessel Scope</label>
                <select
                  value={formScopeInput}
                  onChange={(e) => setFormScopeInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-800"
                >
                  {selectedFlagScope === 'All Flags' ? (
                    <option value="All Vessels">All Vessels</option>
                  ) : (
                    <option value={`All ${selectedFlagScope} Vessels`}>All {selectedFlagScope} Vessels</option>
                  )}
                  {vesselsList
                    .filter(v => selectedFlagScope === 'All Flags' || v.flag === selectedFlagScope)
                    .map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                </select>
              </div>

              {/* Footer */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold shadow-md shadow-blue-50 cursor-pointer"
                >
                  Save Definition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
