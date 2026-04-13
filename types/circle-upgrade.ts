// Circle Upgrade Workflow TypeScript Interfaces

export type AccountType = 'individual' | 'company';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Individual verification types
export type IndividualIdType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE';

// Company verification types
export type CompanyRegistrationType = 'GST' | 'CERTIFICATE_OF_INCORPORATION' | 'PAN' | 'MSME';

// Base verification data
export interface BaseVerificationData {
  accountType: AccountType;
}

// Individual verification data
export interface IndividualVerificationData extends BaseVerificationData {
  accountType: 'individual';
  idType: IndividualIdType;
  idNumber: string;
  idDocument: File;
}

// Company verification data
export interface CompanyVerificationData extends BaseVerificationData {
  accountType: 'company';
  registrationType: CompanyRegistrationType;
  registrationNumber: string;
  verificationDocument: File;
}

// Union type for verification data
export type VerificationData = IndividualVerificationData | CompanyVerificationData;

// Prisma enum types (matching database schema)
export type CircleAccountType = 'INDIVIDUAL' | 'COMPANY';
export type CircleDocumentType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE' | 'GST' | 'CERTIFICATE_OF_INCORPORATION' | 'COMPANY_PAN' | 'MSME';
export type CircleUpgradeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Circle upgrade request form data
export interface CircleUpgradeFormData {
  fullName: string;
  professionalTitle: string;
  company?: string;
  location: string;
  website?: string;
  linkedin?: string;
  bio?: string;
  reason: string;
  verification: VerificationData;
}

// Database model for CircleUpgradeRequest
export interface CircleUpgradeRequest {
  id: number;
  userId: number;
  accountType: CircleAccountType;
  documentType: CircleDocumentType;
  documentNumber: string;
  documentUrl: string;
  status: CircleUpgradeStatus;
  fullName: string;
  professionalTitle: string;
  company?: string;
  location: string;
  website?: string;
  linkedin?: string;
  bio?: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

// Admin view data
export interface CircleUpgradeRequestWithUser extends CircleUpgradeRequest {
  user: {
    id: number;
    name: string;
    email: string;
    handle: string;
    avatar?: string;
  };
}

// API Response types
export interface CircleUpgradeResponse {
  success: boolean;
  message: string;
  request?: CircleUpgradeRequest;
}

export interface AdminActionResponse {
  success: boolean;
  message: string;
  request?: CircleUpgradeRequest;
}

// Email notification types
export interface EmailNotificationData {
  to: string;
  subject: string;
  html: string;
}

// File upload validation
export interface FileUploadConfig {
  allowedTypes: string[];
  maxSize: number; // in bytes
  maxFiles?: number;
}

// Form validation errors
export interface FormErrors {
  fullName?: string;
  professionalTitle?: string;
  location?: string;
  reason?: string;
  accountType?: string;
  idType?: string;
  idNumber?: string;
  registrationType?: string;
  registrationNumber?: string;
  document?: string;
}

// Component props
export interface CircleUpgradeFormProps {
  onSubmit: (data: CircleUpgradeFormData) => Promise<void>;
  loading?: boolean;
}

export interface FileUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
  config?: FileUploadConfig;
  disabled?: boolean;
}

export interface AdminRequestCardProps {
  request: CircleUpgradeRequestWithUser;
  onApprove: (requestId: number) => Promise<void>;
  onReject: (requestId: number) => Promise<void>;
  loading?: boolean;
}

// Constants
export const INDIVIDUAL_ID_TYPES: { value: IndividualIdType; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
];

export const COMPANY_REGISTRATION_TYPES: { value: CompanyRegistrationType; label: string }[] = [
  { value: 'GST', label: 'GST Registration' },
  { value: 'CERTIFICATE_OF_INCORPORATION', label: 'Certificate of Incorporation' },
  { value: 'PAN', label: 'Company PAN' },
  { value: 'MSME', label: 'MSME Registration' },
];

export const DEFAULT_FILE_CONFIG: FileUploadConfig = {
  allowedTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
  maxSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 1,
};
