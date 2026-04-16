import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, User, Building, Briefcase, MapPin, Globe, Linkedin, FileText } from 'lucide-react';
import { 
  CircleUpgradeFormData, 
  AccountType, 
  IndividualIdType, 
  CompanyRegistrationType,
  FormErrors,
  CircleUpgradeFormProps,
  INDIVIDUAL_ID_TYPES,
  COMPANY_REGISTRATION_TYPES
} from '@/types/circle-upgrade';
import FileUpload from './FileUpload';

export default function CircleUpgradeForm({ onSubmit, loading = false }: CircleUpgradeFormProps) {
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
      accountType: 'individual' as AccountType,
      idType: undefined,
      idNumber: '',
      idDocument: undefined,
    } as any
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Update verification data when account type changes
  useEffect(() => {
    const currentAccountType = formData.verification?.accountType || 'individual';
    setFormData(prev => ({
      ...prev,
      verification: {
        ...prev.verification!,
        accountType: currentAccountType,
        // Reset verification fields when switching account type
        ...(currentAccountType === 'individual' 
          ? { idType: undefined, idNumber: '', idDocument: undefined as any, registrationType: undefined, registrationNumber: '', verificationDocument: undefined as any }
          : { registrationType: undefined, registrationNumber: '', verificationDocument: undefined as any, idType: undefined, idNumber: '', idDocument: undefined as any }
        )
      } as any
    }));
  }, [formData.verification?.accountType]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Basic info validation
    if (!formData.fullName?.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.professionalTitle?.trim()) {
      newErrors.professionalTitle = 'Professional title is required';
    }

    if (!formData.location?.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!formData.reason?.trim()) {
      newErrors.reason = 'Reason for joining Circle is required';
    }

    // Verification validation
    const verification = formData.verification!;
    
    if (!verification.accountType) {
      newErrors.accountType = 'Please select an account type';
    }

    if (verification.accountType === 'individual') {
      if (!verification.idType) {
        newErrors.idType = 'Please select an ID type';
      }
      if (!verification.idNumber?.trim()) {
        newErrors.idNumber = 'ID number is required';
      }
      if (!verification.idDocument) {
        newErrors.document = 'ID document is required';
      }
    } else if (verification.accountType === 'company') {
      if (!verification.registrationType) {
        newErrors.registrationType = 'Please select a registration type';
      }
      if (!verification.registrationNumber?.trim()) {
        newErrors.registrationNumber = 'Registration number is required';
      }
      if (!verification.verificationDocument) {
        newErrors.document = 'Verification document is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData as CircleUpgradeFormData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleInputChange = (field: keyof CircleUpgradeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
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
    
    // Clear error for this field
    const errorField = field === 'idDocument' || field === 'verificationDocument' ? 'document' : field;
    if (errors[errorField as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [errorField]: undefined }));
    }
  };

  const isFormValid = () => {
    const verification = formData.verification!;
    
    // Check basic fields
    if (!formData.fullName?.trim() || !formData.professionalTitle?.trim() || 
        !formData.location?.trim() || !formData.reason?.trim()) {
      return false;
    }

    // Check verification fields
    if (verification.accountType === 'individual') {
      return verification.idType && verification.idNumber?.trim() && verification.idDocument;
    } else {
      return verification.registrationType && verification.registrationNumber?.trim() && verification.verificationDocument;
    }
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
            onClick={() => window.history.back()}
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
                Company (Optional)
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                placeholder="Acme Inc."
                disabled={loading}
              />
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
                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                    placeholder="https://johndoe.com"
                    disabled={loading}
                  />
                </div>
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
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all"
                  placeholder="https://linkedin.com/in/johndoe"
                  disabled={loading}
                />
              </div>
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

          {/* Account Type Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0a0a0a] flex items-center gap-2">
              <Building className="w-5 h-5" />
              Account Type
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleVerificationChange('accountType', 'individual')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  verification.accountType === 'individual'
                    ? 'border-[#F44444] bg-[#F44444]/5'
                    : 'border-[#e5e5e5] hover:border-[#a3a3a3]'
                }`}
                disabled={loading}
              >
                <User className="w-6 h-6 mb-2 mx-auto text-[#F44444]" />
                <p className="font-medium text-[#0a0a0a]">Individual</p>
                <p className="text-xs text-[#737373] mt-1">For individual professionals</p>
              </button>

              <button
                type="button"
                onClick={() => handleVerificationChange('accountType', 'company')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  verification.accountType === 'company'
                    ? 'border-[#F44444] bg-[#F44444]/5'
                    : 'border-[#e5e5e5] hover:border-[#a3a3a3]'
                }`}
                disabled={loading}
              >
                <Building className="w-6 h-6 mb-2 mx-auto text-[#F44444]" />
                <p className="font-medium text-[#0a0a0a]">Company</p>
                <p className="text-xs text-[#737373] mt-1">For business entities</p>
              </button>
            </div>
          </div>

          {/* Verification Section */}
          {verification.accountType && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#0a0a0a] flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Verification Documents
              </h3>

              {verification.accountType === 'individual' ? (
                // Individual verification fields
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#525252] mb-1.5">
                      ID Type *
                    </label>
                    <select
                      value={verification.idType || ''}
                      onChange={(e) => handleVerificationChange('idType', e.target.value as IndividualIdType)}
                      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                        errors.idType ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                      }`}
                      disabled={loading}
                    >
                      <option value="">Select ID type</option>
                      {INDIVIDUAL_ID_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {errors.idType && (
                      <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.idType}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#525252] mb-1.5">
                      ID Number *
                    </label>
                    <input
                      type="text"
                      value={verification.idNumber || ''}
                      onChange={(e) => handleVerificationChange('idNumber', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                        errors.idNumber ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                      }`}
                      placeholder="Enter your ID number"
                      disabled={loading}
                    />
                    {errors.idNumber && (
                      <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.idNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#525252] mb-1.5">
                      Upload ID Document *
                    </label>
                    <FileUpload
                      file={verification.idDocument || null}
                      onFileChange={(file) => handleVerificationChange('idDocument', file)}
                      error={errors.document}
                      disabled={loading}
                    />
                  </div>
                </>
              ) : (
                // Company verification fields
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#525252] mb-1.5">
                      Registration Type *
                    </label>
                    <select
                      value={verification.registrationType || ''}
                      onChange={(e) => handleVerificationChange('registrationType', e.target.value as CompanyRegistrationType)}
                      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all ${
                        errors.registrationType ? 'border-[#F44444]' : 'border-[#e5e5e5]'
                      }`}
                      disabled={loading}
                    >
                      <option value="">Select registration type</option>
                      {COMPANY_REGISTRATION_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {errors.registrationType && (
                      <p className="text-xs text-[#F44444] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.registrationType}
                      </p>
                    )}
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
                      Upload Verification Document *
                    </label>
                    <FileUpload
                      file={verification.verificationDocument || null}
                      onFileChange={(file) => handleVerificationChange('verificationDocument', file)}
                      error={errors.document}
                      disabled={loading}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => window.history.back()}
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
