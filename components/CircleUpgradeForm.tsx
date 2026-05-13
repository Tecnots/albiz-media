import React, { useState, useEffect, useRef } from 'react';
import { X, Check, AlertCircle, User, Building, Briefcase, MapPin, Globe, Linkedin, FileText, ChevronDown, Plus, Trash2, Search } from 'lucide-react';
import { Country, State, City } from 'country-state-city';
import {
  CircleUpgradeFormData,
  AccountType,
  CompanyRegistrationType,
  FormErrors,
  CircleUpgradeFormProps,
  COMPANY_REGISTRATION_TYPES,
  RegistrationEntry
} from '@/types/circle-upgrade';
import FileUpload from './FileUpload';

const COUNTRY_OPTIONS = Country.getAllCountries().map(c => ({ value: c.isoCode, label: c.name }));

// Custom Dropdown Component
function CustomDropdown({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  error, 
  disabled = false,
  isSearchable = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  error?: string;
  disabled?: boolean;
  isSearchable?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredOptions = isSearchable 
    ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all flex items-center justify-between bg-white ${
          error ? 'border-[#F44444]' : 'border-[#e5e5e5] hover:border-[#a3a3a3]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selectedOption ? 'text-[#0a0a0a]' : 'text-[#a3a3a3]'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#a3a3a3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#e5e5e5] rounded-lg shadow-lg">
          {isSearchable && (
            <div className="p-2 border-b border-[#e5e5e5] sticky top-0 bg-white z-10">
              <div className="relative">
                <Search className="w-4 h-4 text-[#a3a3a3] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md bg-[#fafafa] border border-[#e5e5e5] outline-none focus:border-[#a3a3a3]"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[#fafafa] transition-colors ${
                    option.value === value ? 'bg-[#F44444]/10 text-[#F44444] font-medium' : 'text-[#0a0a0a]'
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-[#737373]">
                No results found
              </div>
            )}
          </div>
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
    city: '',
    district: '',
    country: '',
    pincode: '',
    website: '',
    linkedin: '',
    bio: '',
    reason: '',
    verification: {
      accountType: 'company' as AccountType,
      registrations: [
        {
          registrationType: undefined as any,
          registrationNumber: '',
          verificationDocuments: []
        }
      ]
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
    if (!formData.city?.trim()) {
      newErrors.city = 'City is required';
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

    if (!verification.registrations || verification.registrations.length === 0) {
      newErrors.documents = 'At least one registration entry is required';
    } else {
      verification.registrations.forEach((reg, idx) => {
        if (!reg.registrationType) {
          newErrors[`registrationType_${idx}`] = 'Please select a registration type';
        }
        if (!reg.registrationNumber?.trim()) {
          newErrors[`registrationNumber_${idx}`] = 'Registration number is required';
        }
        if (!reg.verificationDocuments || reg.verificationDocuments.length === 0) {
          newErrors[`documents_${idx}`] = 'At least one verification document is required';
        }
      });
    }

    setErrors(newErrors);
    setTouched({
      fullName: true,
      professionalTitle: true,
      company: true,
      city: true,
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
      submitData.append('city', formData.city!);
      if (formData.district) submitData.append('district', formData.district);
      if (formData.country) {
        // Find the country name based on the isoCode to save it as the full name instead of iso code
        const countryName = Country.getCountryByCode(formData.country)?.name || formData.country;
        submitData.append('country', countryName);
      }
      if (formData.pincode) submitData.append('pincode', formData.pincode);
      submitData.append('reason', formData.reason!);
      
      // Add optional fields
      if (formData.website) submitData.append('website', formData.website);
      if (formData.linkedin) submitData.append('linkedin', formData.linkedin);
      if (formData.bio) submitData.append('bio', formData.bio);
      
      // Add verification fields for each registration entry
      const verification = formData.verification!;
      verification.registrations.forEach((reg, regIndex) => {
        submitData.append(`registrationType[${regIndex}]`, reg.registrationType!);
        submitData.append(`registrationNumber[${regIndex}]`, reg.registrationNumber!);

        // Add multiple documents for this registration
        reg.verificationDocuments.forEach((file: File, docIndex: number) => {
          submitData.append(`verificationDocuments[${regIndex}][${docIndex}]`, file);
        });
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

  const handleVerificationChange = (regIndex: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      verification: {
        ...prev.verification!,
        registrations: prev.verification!.registrations.map((reg, idx) =>
          idx === regIndex ? { ...reg, [field]: value } : reg
        )
      }
    }));

    // Clear errors when user makes changes
    const errorField = field === 'verificationDocuments' ? `documents_${regIndex}` : `${field}_${regIndex}`;
    if (errors[errorField as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [errorField]: undefined }));
    }
    if (submissionError) {
      setSubmissionError(null);
    }
  };

  const addRegistrationEntry = () => {
    setFormData(prev => ({
      ...prev,
      verification: {
        ...prev.verification!,
        registrations: [
          ...prev.verification!.registrations,
          {
            registrationType: undefined as any,
            registrationNumber: '',
            verificationDocuments: []
          }
        ]
      }
    }));
  };

  const removeRegistrationEntry = (regIndex: number) => {
    setFormData(prev => ({
      ...prev,
      verification: {
        ...prev.verification!,
        registrations: prev.verification!.registrations.filter((_, idx) => idx !== regIndex)
      }
    }));
  };

  const hasFieldError = (field: string): boolean => {
    return !!(errors[field as keyof FormErrors]);
  };

  const isFormValid = () => {
    const verification = formData.verification!;

    // Check basic fields
    if (!formData.fullName?.trim() || !formData.professionalTitle?.trim() ||
        !formData.company?.trim() || !formData.city?.trim() || !formData.reason?.trim()) {
      return false;
    }

    // Check company verification fields - at least one valid registration entry
    if (!verification.registrations || verification.registrations.length === 0) {
      return false;
    }

    return verification.registrations.some(reg =>
      reg.registrationType &&
      reg.registrationNumber?.trim() &&
      reg.verificationDocuments &&
      reg.verificationDocuments.length > 0
    );
  };

  const verification = formData.verification!;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#e5e5e5] px-6 py-4 flex items-center justify-between">
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
                  Country *
                </label>
                <CustomDropdown
                  value={formData.country || ''}
                  onChange={(val) => {
                    handleInputChange('country', val);
                    handleInputChange('district', ''); // Reset district when country changes
                    handleInputChange('city', ''); // Reset city
                  }}
                  options={COUNTRY_OPTIONS}
                  placeholder="Select Country"
                  disabled={loading}
                  isSearchable
                />
              </div>

              {(() => {
                const selectedStateCode = formData.country && formData.district 
                  ? State.getStatesOfCountry(formData.country).find(s => s.name === formData.district)?.isoCode 
                  : '';
                  
                return (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[#525252] mb-1.5">
                        District/State *
                      </label>
                      <CustomDropdown
                        value={formData.district || ''}
                        onChange={(val) => {
                          handleInputChange('district', val);
                          handleInputChange('city', ''); // Reset city when district changes
                        }}
                        options={formData.country ? State.getStatesOfCountry(formData.country).map(s => ({ value: s.name, label: s.name })) : []}
                        placeholder={formData.country ? "Select District/State" : "Select Country first"}
                        disabled={loading || !formData.country || State.getStatesOfCountry(formData.country).length === 0}
                        isSearchable
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#525252] mb-1.5">
                        City *
                      </label>
                      <CustomDropdown
                        value={formData.city || ''}
                        onChange={(val) => handleInputChange('city', val)}
                        options={(formData.country && selectedStateCode) ? City.getCitiesOfState(formData.country, selectedStateCode).map(c => ({ value: c.name, label: c.name })) : []}
                        placeholder={selectedStateCode ? "Select City" : "Select District/State first"}
                        disabled={loading || !selectedStateCode || City.getCitiesOfState(formData.country, selectedStateCode).length === 0}
                        isSearchable
                        error={errors.city as string}
                      />
                    </div>
                  </>
                );
              })()}



              <div>
                <label className="block text-xs font-medium text-[#525252] mb-1.5">
                  Pincode (Optional)
                </label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange('pincode', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                  placeholder="123456"
                  disabled={loading}
                />
              </div>
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
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0a0a0a] flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Company Verification Documents
              </h3>
              <button
                type="button"
                onClick={addRegistrationEntry}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-medium text-[#525252] hover:bg-[#fafafa] transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                add Documents
              </button>
            </div>

            {verification.registrations.map((reg, regIndex) => (
              <div key={regIndex} className="space-y-4 p-4 rounded-xl border border-[#e5e5e5] bg-[#fafafa]">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-[#0a0a0a]">Document{regIndex + 1}</h4>
                  {verification.registrations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRegistrationEntry(regIndex)}
                      disabled={loading}
                      className="p-1.5 hover:bg-[#e5e5e5] rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-[#a3a3a3]" />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#525252] mb-1.5">
                    Registration Type *
                  </label>
                  <CustomDropdown
                    value={reg.registrationType || ''}
                    onChange={(value) => handleVerificationChange(regIndex, 'registrationType', value as CompanyRegistrationType)}
                    options={COMPANY_REGISTRATION_TYPES}
                    placeholder="Select registration type"
                    error={errors[`registrationType_${regIndex}` as keyof FormErrors] as string}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#525252] mb-1.5">
                    Registration Number *
                  </label>
                  <input
                    type="text"
                    value={reg.registrationNumber || ''}
                    onChange={(e) => handleVerificationChange(regIndex, 'registrationNumber', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                      errors[`registrationNumber_${regIndex}` as keyof FormErrors] ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                    }`}
                    placeholder="Enter your registration number"
                    disabled={loading}
                  />
                  {errors[`registrationNumber_${regIndex}` as keyof FormErrors] && (
                    <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors[`registrationNumber_${regIndex}` as keyof FormErrors]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#525252] mb-1.5">
                    Upload Verification Documents *
                  </label>
                  <p className="text-xs text-[#737373] mb-2">
                    Upload multiple documents for this registration
                  </p>
                  <FileUpload
                    files={reg.verificationDocuments || []}
                    onFilesChange={(files) => handleVerificationChange(regIndex, 'verificationDocuments', files)}
                    error={errors[`documents_${regIndex}` as keyof FormErrors] as string}
                    disabled={loading}
                  />
                </div>
              </div>
            ))}
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
