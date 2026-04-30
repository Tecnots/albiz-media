// Circle Upgrade Workflow TypeScript Interfaces

export type AccountType = 'company';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Company verification types
export type CompanyRegistrationType = 'GST' | 'CERTIFICATE_OF_INCORPORATION' | 'PAN' | 'MSME';

// Company verification data
export interface CompanyVerificationData {
  accountType: 'company';
  registrations: RegistrationEntry[];
}

export interface RegistrationEntry {
  registrationType: CompanyRegistrationType;
  registrationNumber: string;
  verificationDocuments: File[];
}

// Verification data type (only company now)
export type VerificationData = CompanyVerificationData;

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
  documents?: CircleUpgradeDocument[];
  registrations?: CircleUpgradeRegistration[];
}

// Database model for CircleUpgradeDocument
export interface CircleUpgradeDocument {
  id: number;
  requestId: number;
  registrationId?: number;
  documentUrl: string;
  documentType: CircleDocumentType;
  createdAt: Date;
}

// Database model for CircleUpgradeRegistration
export interface CircleUpgradeRegistration {
  id: number;
  requestId: number;
  registrationType: CircleDocumentType;
  registrationNumber: string;
  createdAt: Date;
  documents?: CircleUpgradeDocument[];
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
  company?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  reason?: string;
  registrationType?: string;
  registrationNumber?: string;
  documents?: string;
}

// Component props
export interface CircleUpgradeFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  loading?: boolean;
}

export interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
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
export const COMPANY_REGISTRATION_TYPES: { value: CompanyRegistrationType; label: string }[] = [
  { value: 'GST', label: 'GST Registration' },
  { value: 'CERTIFICATE_OF_INCORPORATION', label: 'Certificate of Incorporation' },
  { value: 'PAN', label: 'Company PAN' },
  { value: 'MSME', label: 'MSME Registration' },
];

export const DEFAULT_FILE_CONFIG: FileUploadConfig = {
  allowedTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
  maxSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5, // Support multiple documents
};
