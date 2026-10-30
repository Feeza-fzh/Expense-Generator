'use client';

import React, { useState, useRef } from 'react';

interface UploadViewProps {
  onUploadSuccess: (batchId: string) => void;
}

export function UploadView({ onUploadSuccess }: UploadViewProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    setErrorMessage(null);
    const combined = [...selectedFiles, ...files];
    if (combined.length > 20) {
      setErrorMessage('You can upload up to 20 files at a time.');
      setSelectedFiles(combined.slice(0, 20));
    } else {
      setSelectedFiles(combined);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Choose at least one file.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Upload failed.');
        setIsUploading(false);
        return;
      }

      onUploadSuccess(data.batchId);
    } catch {
      setErrorMessage('Network error while uploading files. Try again.');
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary bg-primary-container/20'
            : 'border-on-surface-variant/30 hover:border-primary/60 bg-surface-c-lowest'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <svg
            className="h-12 w-12 text-primary mb-3"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M7 16a4 44 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <h3 className="font-semibold text-lg text-on-surface">
            Drop receipts here, or <span className="text-primary underline">browse</span>
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Up to 20 files (JPEG, PNG, WebP, or PDF up to 5 pages). Max 10 MB each.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
          {errorMessage}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm font-medium">
            <span>
              Selected files ({selectedFiles.length} of 20)
            </span>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="text-on-surface-variant hover:text-red-600 text-xs"
            >
              Clear all
            </button>
          </div>

          <ul className="divide-y divide-on-surface-variant/10 border border-on-surface-variant/20 rounded-lg overflow-hidden bg-surface-c-lowest">
            {selectedFiles.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="px-4 py-3 flex items-center justify-between text-sm"
              >
                <div className="flex items-center space-x-3 truncate">
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-surface-c-high font-mono">
                    {file.name.split('.').pop() || 'file'}
                  </span>
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-xs text-on-surface-variant">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="text-on-surface-variant hover:text-red-600 ml-2 text-lg leading-none"
                  aria-label="Remove file"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={isUploading || selectedFiles.length === 0}
              onClick={handleUpload}
              className="px-6 py-2.5 rounded-lg font-medium text-on-primary bg-primary hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
            >
              {isUploading ? 'Uploading...' : `Process ${selectedFiles.length} Receipt${selectedFiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

