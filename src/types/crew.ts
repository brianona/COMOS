export interface BasicInformation {
  firstName: string;
  middleName?: string;
  lastName: string;
  gender?: 'Male' | 'Female' | 'Other';
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  birthdate?: string; // YYYY-MM-DD
  placeOfBirth?: string;
  nationality: string;
  passportNo: string;
  passportExpiry?: string;
  seamanBookNo: string;
  seamanBookExpiry?: string;
  rank: string;
  photo?: string;
  weightKg?: number | string;
  heightCm?: number | string;
  bmi?: number | string;
}

export interface ContactInformation {
  phone: string;
  secondaryPhone?: string;
  email: string;
  skypeOrMessaging?: string;
  address: {
    street?: string;
    city?: string;
    provinceState?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface VesselAssignment {
  currentVesselId?: string;
  vesselName?: string;
  status: 'Onboard' | 'Available' | 'On Leave' | 'Standby' | 'Debriefing';
  signOnDate?: string;
  contractDuration?: number; // months
  contractEndDate?: string;
  extensionsCount?: number;
  relieverName?: string;
  remarks?: string;
}

export interface SeaServiceRecord {
  id: string;
  vesselName: string;
  vesselType: string; // Bulk Carrier, Container, Oil Tanker, Chemical Tanker, General Cargo, etc.
  dwtGrt?: string;
  engineTypePower?: string;
  rank: string;
  signOnDate: string;
  signOffDate: string;
  durationMonths?: number;
  flag?: string;
  companyManning?: string;
  reasonForSignOff?: string;
}

export interface NationalLicenseRecord {
  id: string;
  documentName: string;
  rank: string;
  documentNumber: string;
  issuedDate: string;
  revalidationDate?: string;
  expirationDate: string;
  placeOfIssue: string;
  issuingAuthority: string;
  remarks?: string;
}

export interface TrainingRecord {
  id: string;
  courseName: string;
  trainingCenter: string;
  completionDate: string;
  expiryDate?: string;
  certificateNo?: string;
  status?: 'Valid' | 'Expiring' | 'Expired';
}

export interface VaccinationRecord {
  id?: string;
  name: string; // Yellow Fever, COVID-19, Cholera, Tetanus, Typhoid, Hepatitis
  dateGiven: string;
  expiryDate?: string;
  batchNo?: string;
}

export interface MedicalCertification {
  pemeStatus: 'Fit for Sea Duty' | 'Fit with Restrictions' | 'Unfit';
  examDate?: string;
  expiryDate?: string;
  clinicName?: string;
  doctorName?: string;
  restrictionsRemarks?: string;
  drugAlcoholDate?: string;
  drugAlcoholResult?: 'Negative' | 'Positive';
  vaccinations?: VaccinationRecord[];
}

export interface CrewDocument {
  id: string;
  documentType: string; // Passport, Seaman's Book, STCW Certificate, Medical Fitness, US Visa, Schengen Visa, Yellow Fever, Other
  documentName: string;
  fileName: string;
  fileSize?: string;
  fileUrl?: string;
  uploadedAt?: string;
}

export interface EmergencyContact {
  nextOfKinName: string;
  relationship: string;
  phonePrimary: string;
  phoneSecondary?: string;
  email?: string;
  address?: string;
}

export interface PerformanceComment {
  id: string;
  authorName: string;
  authorRole: string;
  date: string;
  comment: string;
}

export interface TravelDocumentRecord {
  id: string;
  documentName: string;
  documentNumber: string;
  issuedDate: string;
  revalidatedDate?: string;
  expirationDate: string;
  placeOfIssue: string;
  issuingAuthority: string;
  remarks?: string;
}

export interface FlagRegistryLicenseRecord {
  id: string;
  flagRegistry: string;
  flagDocs?: string;
  rank: string;
  documentNumber: string;
  appliedDate?: string;
  issueDate: string;
  expiryDate: string;
  remarks?: string;
}

export interface VisaDetailRecord {
  id: string;
  status: string;
  country: string;
  type: string;
  number: string;
  appointmentDate?: string;
  time?: string;
  issueDate?: string;
  expiryDate?: string;
  remarks?: string;
}

export interface TrainingCertificateRecord {
  id: string;
  courseMarina: string;
  certNumber: string;
  issueDate: string;
  revalidateDate?: string;
  trainingCenter: string;
  placeOfIssue: string;
  remarks?: string;
}

export interface CrewProfile {
  basicInfo: BasicInformation;
  contactInfo: ContactInformation;
  vesselAssignment: VesselAssignment;
  seaService: SeaServiceRecord[];
  travelDocuments?: TravelDocumentRecord[];
  nationalLicenses?: NationalLicenseRecord[];
  flagRegistryLicenses?: FlagRegistryLicenseRecord[];
  visaDetails?: VisaDetailRecord[];
  trainingCertificates?: TrainingCertificateRecord[];
  medicalCertification: MedicalCertification;
  documents: CrewDocument[];
  emergencyContact: EmergencyContact;
  remarksSection?: {
    comments: PerformanceComment[];
    notForRehire: boolean;
  };
}

export interface CrewMemberItem {
  id: string;
  name: string;
  rank: string;
  nationality: string;
  signOnDate?: string;
  passportNo?: string;
  seamanBookNo?: string;
  status: 'Compliant' | 'Warning' | 'Expired';
  contractDuration?: number;
  nextMedicalExam?: string;
  nextSafetyTraining?: string;
  vesselId?: string;
  vesselName?: string;
  vesselTeamId?: number | null;
  vesselOwner?: 'Nissen' | 'Goodwill' | string | null;
  birthdate?: string;
  contactNumber?: string;
  email?: string;
  photo?: string;
  hiringStatus?: 'for rehire' | 'for debriefing' | 'not for rehire' | string;
  availabilityStatus?: 'onboard' | 'available' | 'on_leave' | 'standby' | 'debriefing' | string;
  readyDate?: string;
  siComments?: string;
  extensionsCount?: number;
  contractEndDate?: string;
  canEdit: boolean;
  profileData: CrewProfile;
}

export interface CandidateItem {
  id: string;
  name: string;
  rank: string;
  nationality: string;
  birthdate?: string;
  passportNo?: string;
  seamanBookNo?: string;
  status: string;
  vesselId?: string;
  vesselName?: string;
  vesselOwner?: 'Nissen' | 'Goodwill' | string | null;
  availabilityStatus: string;
  readyDate?: string;
  photo?: string;
  totalSeaMonths: number;
  hiringStatus: string;
  contactNumber?: string;
  email?: string;
  profileData: CrewProfile;
}

export interface VesselOption {
  id: number | string;
  name: string;
  team_id?: number | null;
  owner?: 'Nissen' | 'Goodwill' | string | null;
  type?: string;
  flag?: string;
}
