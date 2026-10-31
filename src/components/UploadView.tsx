'use client';

import React, { useState, useRef, useEffect } from 'react';

interface UploadViewProps {
  onProcessComplete: (batchId: string) => void;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WEBP',
  pdf: 'PDF',
};

const FILE_TYPE_COLOURS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  png: 'bg-blue-100 text-blue-700',
  jpg: 'bg-emerald-100 text-emerald-700',
  jpeg: 'bg-emerald-100 text-emerald-700',
  webp: 'bg-violet-100 text-violet-700',
};

function FileTypeChip({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'file';
  const label = FILE_TYPE_LABELS[ext] ?? ext.toUpperCase();
  const colour = FILE_TYPE_COLOURS[ext] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`label-small px-2 py-0.5 rounded-md font-mono flex-shrink-0 ${colour}`}>
      {label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadView({ onProcessComplete }: UploadViewProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Choose at least one file.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Uploading...');
    setErrorMessage(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('files', file));

    try {
      const res = await fetch('/api/batches', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Upload failed.');
        setIsProcessing(false);
        setProcessingStatus(null);
        return;
      }

      const batchId = data.batchId;
      setProcessingStatus('Reading receipt...');

      // Poll background status every 1.5s until report is ready
      const checkStatus = async () => {
        try {
          const statusRes = await fetch(`/api/batches/${batchId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.reportReady) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              onProcessComplete(batchId);
              return true;
            }
          }
        } catch {
          // ignore transient poll errors
        }
        return false;
      };

      pollTimerRef.current = setInterval(async () => {
        await checkStatus();
      }, 1500);

    } catch {
      setErrorMessage('Network error while processing files. Try again.');
      setIsProcessing(false);
      setProcessingStatus(null);
    }
  };

  const isEmpty = selectedFiles.length === 0;

  return (
    <div className="space-y-5 max-w-2xl mx-auto w-full">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !isProcessing && fileInputRef.current?.click()}
        aria-label="Upload receipt files"
        className={`relative rounded-2xl border-2 border-dashed px-8 py-14 text-center cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-on-surface-variant/25 hover:border-primary/50 hover:bg-primary/[0.03]'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
        style={{
          borderColor: isDragging ? 'var(--color-primary)' : undefined,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={isProcessing}
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Upload icon */}
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-200"
          style={{
            background: isDragging
              ? 'var(--color-primary)'
              : 'var(--color-primary-container)',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke={isDragging ? 'var(--color-on-primary)' : 'var(--color-primary)'}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p className="title-large text-on-surface">
          {isDragging ? 'Release to add files' : 'Drop receipts here, or '}
          {!isDragging && (
            <span style={{ color: 'var(--color-primary)' }} className="underline underline-offset-2">
              browse
            </span>
          )}
        </p>
        <p className="body-small mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
          JPEG, PNG, WebP or PDF (max 5 pages) · Up to 20 files · 10 MB each
        </p>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <svg className="mt-0.5 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="body-small">{errorMessage}</p>
        </div>
      )}

      {/* File list */}
      {!isEmpty && (
        <div className="card overflow-hidden">
          {/* List header */}
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'color-mix(in srgb, var(--color-on-surface-variant) 12%, transparent)' }}>
            <span className="label-large" style={{ color: 'var(--color-on-surface-variant)' }}>
              {selectedFiles.length} of 20 files selected
            </span>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setSelectedFiles([])}
              className="label-small transition-colors disabled:opacity-40"
              style={{ color: 'var(--color-on-surface-variant)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-on-surface-variant)')}
            >
              Clear all
            </button>
          </div>

          <ul className="divide-y max-h-60 overflow-y-auto" style={{ borderColor: 'color-mix(in srgb, var(--color-on-surface-variant) 10%, transparent)' }}>
            {selectedFiles.map((file, idx) => (
              <li
                key={`${file.name}-${idx}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-50"
              >
                <FileTypeChip filename={file.name} />
                <span className="flex-1 truncate body-medium text-on-surface">{file.name}</span>
                <span className="label-medium flex-shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:opacity-30"
                  style={{ color: 'var(--color-on-surface-variant)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-on-surface-variant)'; e.currentTarget.style.background = ''; }}
                  aria-label={`Remove ${file.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {/* Action row */}
          <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'color-mix(in srgb, var(--color-on-surface-variant) 12%, transparent)' }}>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost text-sm disabled:opacity-40"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add more
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleUpload}
              className="btn-primary"
            >
              {isProcessing ? (
                <>
                  <span className="dot-pulse flex gap-1">
                    <span /><span /><span />
                  </span>
                  {processingStatus ?? 'Processing…'}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  Process {selectedFiles.length} Receipt{selectedFiles.length > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
