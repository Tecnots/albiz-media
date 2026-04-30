import React, { useState, useEffect, useRef } from 'react';
import { X, Check, AlertCircle, User, Building, Briefcase, MapPin, Globe, Linkedin, FileText, ChevronDown } from 'lucide-react';
import { 
  CircleUpgradeFormData, 
  AccountType, 
  CompanyRegistrationType,
  FormErrors,
  CircleUpgradeFormProps,
  COMPANY_REGISTRATION_TYPES
} from '@/types/circle-upgrade';
import FileUpload from './FileUpload';

// Custom Dropdown Component
function CustomDropdown({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  error, 
  disabled = false 
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  error?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all flex items-center justify-between bg-white ${
          error ? 'border-[#F44444]' : 'border-[#e5e5e5] hover:border-[#a3a3a3]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selectedOption ? 'text-[#0a0a0a]' : 'text-[#a3a3a3]'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#a3a3a3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#e5e5e5] rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-[#fafafa] transition-colors ${
                option.value === value ? 'bg-[#F44444]/10 text-[#F44444] font-medium' : 'text-[#0a0a0a]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function CircleUpgradeForm({ onSubmit, loading = false, onClose }: CircleUpgradeFormProps & { onClose?: () => void }) {
  const [formData, setFormData] = useState<Partial<CircleUpgradeFormData>>({
    fullName: '',
    professionalTitle: '',
    company: '',
    location: '',
    website: '',
    linkedin: '',
    bio: '',
    reason: '',
    verification: {
      accountType: 'company' as AccountType,
      registrationType: undefined,
      registrationNumber: '',
      verificationDocuments: [],
    } as any
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Basic info validation
    if (!formData.fullName?.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!formData.professionalTitle?.trim()) {
      newErrors.professionalTitle = 'Professional title is required';
    }
    if (!formData.company?.trim()) {
      newErrors.company = 'Company is required';
    }
    if (!formData.location?.trim()) {
      newErrors.location = 'Location is required';
    }
    if (!formData.reason?.trim()) {
      newErrors.reason = 'Reason for joining Circle is required';
    }

    // Optional field validation
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (formData.website?.trim()) {
      if (!urlRegex.test(formData.website.trim())) {
        newErrors.website = 'Invalid website format. Please enter a valid URL (e.g., https://example.com)';
      }
    }
    if (formData.linkedin?.trim()) {
      if (!formData.linkedin.trim().includes('linkedin.com')) {
        newErrors.linkedin = 'Invalid LinkedIn URL. Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/your-profile)';
      }
    }

    // Verification validation (company only)
    const verification = formData.verification!;
    
    if (!verification.registrationType) {
      newErrors.registrationType = 'Please select a registration type';
    }
    if (!verification.registrationNumber?.trim()) {
      newErrors.registrationNumber = 'Registration number is required';
    }
    if (!verification.verificationDocuments || verification.verificationDocuments.length === 0) {
      newErrors.documents = 'At least one verification document is required';
    }

    setErrors(newErrors);
    setTouched({
      fullName: true,
      professionalTitle: true,
      company: true,
      location: true,
      website: true,
      linkedin: true,
      reason: true,
      registrationType: true,
      registrationNumber: true,
      documents: true
    });
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous submission error
    setSubmissionError(null);
    
    if (!validateForm()) {
      return;
    }

    try {
      // Create FormData for API submission
      const submitData = new FormData();
      
      // Add basic fields
      submitData.append('fullName', formData.fullName!);
      submitData.append('professionalTitle', formData.professionalTitle!);
      submitData.append('company', formData.company!);
      submitData.append('location', formData.location!);
      submitData.append('reason', formData.reason!);
      
      // Add optional fields
      if (formData.website) submitData.append('website', formData.website);
      if (formData.linkedin) submitData.append('linkedin', formData.linkedin);
      if (formData.bio) submitData.append('bio', formData.bio);
      
      // Add verification fields
      const verification = formData.verification!;
      submitData.append('registrationType', verification.registrationType!);
      submitData.append('registrationNumber', verification.registrationNumber!);
      
      // Add multiple documents
      verification.verificationDocuments.forEach((file, index) => {
        submitData.append(`verificationDocuments[${index}]`, file);
      });
      
      await onSubmit(submitData);
    } catch (error: any) {
      console.error('Form submission error:', error);
      
      // Handle different types of errors
      let errorMessage = 'Failed to submit Circle upgrade request. Please try again.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      }
      
      // Handle field-specific errors from API
      if (error?.fieldErrors || error?.data?.fieldErrors) {
        const fieldErrors = error.fieldErrors || error.data.fieldErrors;
        setErrors(fieldErrors);
        setSubmissionError(errorMessage);
        return;
      }
      
      setSubmissionError(errorMessage);
    }
  };

  const handleInputChange = (field: keyof CircleUpgradeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Clear errors when user makes changes
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (submissionError) {
      setSubmissionError(null);
    }
  };

  const handleVerificationChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      verification: {
        ...prev.verification!,
        [field]: value
      }
    }));
    
    // Clear errors when user makes changes
    const errorField = field === 'verificationDocuments' ? 'documents' : field;
    if (errors[errorField as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [errorField]: undefined }));
    }
    if (submissionError) {
      setSubmissionError(null);
    }
  };

  const hasFieldError = (field: string): boolean => {
    return !!(errors[field as keyof FormErrors]);
  };

  const isFormValid = () => {
    const verification = formData.verification!;
    
    // Check basic fields
    if (!formData.fullName?.trim() || !formData.professionalTitle?.trim() || 
        !formData.company?.trim() || !formData.location?.trim() || !formData.reason?.trim()) {
      return false;
    }

    // Check company verification fields
    return verification.registrationType && 
           verification.registrationNumber?.trim() && 
           verification.verificationDocuments && 
           verification.verificationDocuments.length > 0;
  };

  const verification = formData.verification!;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#e5e5e5] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0a0a0a]">Upgrade to Circle</h2>
            <p className="text-sm text-[#737373]">Join our exclusive community of professionals</p>
          </div>
          <button
            onClick={onClose || (() => window.history.back())}
            className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-[#737373]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0a0a0a] flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#525252] mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                    errors.fullName ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                  }`}
                  placeholder="John Doe"
                  disabled={loading}
                />
                {errors.fullName && (
                  <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525252] mb-1.5">
                  Professional Title *
                </label>
                <input
                  type="text"
                  value={formData.professionalTitle}
                  onChange={(e) => handleInputChange('professionalTitle', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                    errors.professionalTitle ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                  }`}
                  placeholder="Software Engineer"
                  disabled={loading}
                />
                {errors.professionalTitle && (
                  <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.professionalTitle}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                Company *
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                  errors.company ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                }`}
                placeholder="Acme Inc."
                disabled={loading}
                required
              />
              {errors.company && (
                <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.company}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#525252] mb-1.5">
                  Location *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className={`w-full pl-10 pr-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                      errors.location ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                    }`}
                    placeholder="San Francisco, CA"
                    disabled={loading}
                  />
                </div>
                {errors.location && (
                  <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.location}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#525252] mb-1.5">
                  Website (Optional)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    onBlur={() => {
                      const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
                      if (formData.website?.trim() && !urlRegex.test(formData.website.trim())) {
                        setErrors(prev => ({ ...prev, website: 'Invalid website format. Please enter a valid URL (e.g., https://example.com)' }));
                      }
                    }}
                    className={`w-full pl-10 pr-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                      errors.website ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                    }`}
                    placeholder="https://johndoe.com"
                    disabled={loading}
                  />
                </div>
                {errors.website && (
                  <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.website}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                LinkedIn (Optional)
              </label>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
                <input
                  type="url"
                  value={formData.linkedin}
                  onChange={(e) => handleInputChange('linkedin', e.target.value)}
                  onBlur={() => {
                    if (formData.linkedin?.trim() && !formData.linkedin.trim().includes('linkedin.com')) {
                      setErrors(prev => ({ ...prev, linkedin: 'Invalid LinkedIn URL. Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/your-profile)' }));
                    }
                  }}
                  className={`w-full pl-10 pr-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                    errors.linkedin ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                  }`}
                  placeholder="https://linkedin.com/in/johndoe"
                  disabled={loading}
                />
              </div>
              {errors.linkedin && (
                <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.linkedin}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all resize-none"
                placeholder="Tell us about yourself and your professional background..."
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                Why do you want to join Circle? *
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all resize-none ${
                  errors.reason ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                }`}
                placeholder="Share your motivation for joining our professional community..."
                disabled={loading}
              />
              {errors.reason && (
                <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.reason}
                </p>
              )}
            </div>
          </div>

          {/* Verification Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0a0a0a] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Company Verification Documents
            </h3>

            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                Registration Type *
              </label>
              <CustomDropdown
                value={verification.registrationType || ''}
                onChange={(value) => handleVerificationChange('registrationType', value as CompanyRegistrationType)}
                options={COMPANY_REGISTRATION_TYPES}
                placeholder="Select registration type"
                error={errors.registrationType}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                Registration Number *
              </label>
              <input
                type="text"
                value={verification.registrationNumber || ''}
                onChange={(e) => handleVerificationChange('registrationNumber', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                  errors.registrationNumber ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                }`}
                placeholder="Enter your registration number"
                disabled={loading}
              />
              {errors.registrationNumber && (
                <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.registrationNumber}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                Upload Verification Documents *
              </label>
              <p className="text-xs text-[#737373] mb-2">
                Upload multiple documents (GST, Certificate of Incorporation, Company PAN, MSME, etc.)
              </p>
              <FileUpload
                files={verification.verificationDocuments || []}
                onFilesChange={(files) => handleVerificationChange('verificationDocuments', files)}
                error={errors.documents}
                disabled={loading}
              />
            </div>
          </div>

          
          {/* Submission Error */}
          {submissionError && (
            <div className="bg-[#F44444]/10 border border-[#F44444]/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#F44444] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#F44444] mb-1">
                    Submission Error
                  </p>
                  <p className="text-sm text-[#F44444]">
                    {submissionError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose || (() => window.history.back())}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-[#0a0a0a] font-medium hover:bg-[#fafafa] transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F44444] text-white font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
