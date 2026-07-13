import React, { useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onUpload: (urls: string[]) => void;
  multiple?: boolean;
}

export function ImageUploader({ onUpload, multiple = false }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (!user) {
      setError("You must be logged in as an administrator to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setProgressText("Uploading and optimizing images on the host... (this may take a few moments)");

    try {
      // Check if it's a zip file
      const zipFile = files.find(f => f.name.endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed');
      
      let uploadPayload: File[] = [];
      if (zipFile && multiple) {
        uploadPayload = [zipFile];
        setProgressText("Uploading manhwa ZIP archive to host...");
      } else {
        uploadPayload = multiple ? files : [files[0]];
        setProgressText(`Uploading ${uploadPayload.length} image(s) to host...`);
      }

      const res = await apiClient.uploadImages(uploadPayload, user.uid);
      
      if (res.error) {
        throw new Error(res.error);
      }

      if (res.success && res.urls) {
        onUpload(res.urls);
        setProgressText(null);
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'Error uploading files');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="w-full h-32 border-2 border-dashed border-white/20 hover:border-[var(--color-asura-accent)] bg-black/20 hover:bg-[var(--color-asura-accent)]/5 transition-colors rounded-xl flex items-center justify-center relative cursor-pointer group"
      >
        <input 
          type="file" 
          multiple={multiple} 
          accept="image/*,.zip"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
          <UploadCloud className="w-8 h-8 mb-2" />
          <p className="text-xs font-bold uppercase tracking-wider text-center px-4">
            {multiple ? "Drag & Drop ZIP file or multiple images here" : "Drag & Drop image here"}
          </p>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider text-center">
            {multiple ? "Supports ZIP, WebP, JPEG, PNG - Automatically Compressed to WebP" : "Supports WebP, JPEG, PNG"}
          </p>
        </div>
      </div>

      {uploading && (
        <div className="mt-4 flex items-center gap-3 text-xs text-zinc-300 bg-white/5 p-3 rounded-lg border border-white/5">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-asura-accent)] shrink-0" />
          <span>{progressText}</span>
        </div>
      )}
      
      {error && (
        <div className="mt-4 text-xs font-bold text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
          Upload Error: {error}
        </div>
      )}
    </div>
  );
}
