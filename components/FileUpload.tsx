import React, { useRef, useState } from 'react';
import { Upload, X, File, AlertCircle, Plus } from 'lucide-react';
import { FileUploadProps, DEFAULT_FILE_CONFIG } from '@/types/circle-upgrade';

export default function FileUpload({ 
  files, 
  onFilesChange, 
  error, 
  config = DEFAULT_FILE_CONFIG, 
  disabled = false 
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const validateFile = (selectedFile: File): string | null => {
    // Check file type
    if (!config.allowedTypes.includes(selectedFile.type)) {
      return `Invalid file type. Allowed types: ${config.allowedTypes.map(type => type.split('/')[1]).join(', ')}`;
    }

    // Check file size
    if (selectedFile.size > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      return `File size must be less than ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    Array.from(selectedFiles).forEach(file => {
      // Check if we've reached max files
      if (config.maxFiles && files.length + validFiles.length >= config.maxFiles) {
        errors.push(`Maximum ${config.maxFiles} files allowed`);
        return;
      }
      
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    });
    
    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
    }
    
    return errors.length > 0 ? errors.join(', ') : null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    if (disabled) return;

    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('image')) return 'IMG';
    return 'FILE';
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleInputChange}
        accept={config.allowedTypes.join(',')}
        disabled={disabled}
        className="hidden"
        multiple={!!(config.maxFiles && config.maxFiles > 1)}
      />

      {files.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
            ${dragOver 
              ? 'border-[#F44444] bg-[#F44444]/5' 
              : 'border-[#e5e5e5] hover:border-[#a3a3a3] hover:bg-[#fafafa]'
            }
            ${disabled ? 'cursor-not-allowed opacity-50' : ''}
            ${error ? 'border-[#F44444] bg-[#F44444]/5' : ''}
          `}
        >
          <div className="flex flex-col items-center gap-3">
            <Upload className={`w-8 h-8 ${error ? 'text-[#F44444]' : dragOver ? 'text-[#F44444]' : 'text-[#a3a3a3]'}`} />
            <div>
              <p className={`text-sm font-medium ${error ? 'text-[#F44444]' : 'text-[#0a0a0a]'}`}>
                {dragOver ? 'Drop files here' : `Click to upload or drag and drop (${config.maxFiles || 1} files max)`}
              </p>
              <p className="text-xs text-[#737373] mt-1">
                {config.allowedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ')} 
                {' '} (Max {config.maxSize / (1024 * 1024)}MB per file)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="relative border border-[#e5e5e5] rounded-xl p-4 bg-[#fafafa]">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-[#F44444]/10 rounded-lg flex items-center justify-center">
                  <File className="w-5 h-5 text-[#F44444]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0a0a0a] truncate">{file.name}</p>
                  <p className="text-xs text-[#737373]">
                    {getFileIcon(file.type)} {' '} {formatFileSize(file.size)}
                  </p>
                </div>
                {!disabled && (
                  <button
                    onClick={() => removeFile(index)}
                    className="flex-shrink-0 p-1.5 hover:bg-[#e5e5e5] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-[#737373]" />
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {/* Add more files button */}
          {files.length < (config.maxFiles || 1) && (
            <button
              type="button"
              onClick={() => !disabled && fileInputRef.current?.click()}
              disabled={disabled}
              className="w-full border-2 border-dashed border-[#e5e5e5] rounded-xl p-3 text-center hover:border-[#a3a3a3] hover:bg-[#fafafa] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#a3a3a3]" />
              <span className="text-sm text-[#737373]">Add more files</span>
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-2 text-xs text-[#F44444]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
