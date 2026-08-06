import React, { useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import JSZip from 'jszip';

interface Props {
  onUpload: (urls: string[]) => void;
  multiple?: boolean;
  seriesTitle?: string;
  chapterNumber?: string | number;
  folderType?: string;
}

export function ImageUploader({ onUpload, multiple = false, seriesTitle, chapterNumber, folderType }: Props) {
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
      setError("شما باید به عنوان مدیر برای آپلود وارد شده باشید.");
      return;
    }

    setUploading(true);
    setError(null);
    setProgressText("در حال پردازش فایل‌ها...");

    try {
      // Check if it's a zip file
      const zipFile = files.find(f => f.name.endsWith('.zip') || f.type === 'application/zip' || f.type === 'application/x-zip-compressed');
      
      let uploadPayload: File[] = [];
      if (zipFile && multiple) {
        uploadPayload = [zipFile];
        setProgressText(`در حال ارسال فایل ZIP به سرور و تبدیل و بهینه‌سازی بسیار سریع تصاویر...`);
      } else {
        uploadPayload = multiple ? files : [files[0]];
        setProgressText(`در حال آپلود ${uploadPayload.length} تصویر به سرور...`);
      }

      const uid = (user as any)?.uid || user?.id || user?.email || 'admin';
      const res = await apiClient.uploadImages(uploadPayload, uid, {
        seriesTitle,
        chapterNumber,
        folderType
      });
      
      if (res.error) {
        throw new Error(res.error);
      }

      if (res.success && res.urls) {
        onUpload(res.urls);
        setProgressText(null);
      } else {
        throw new Error("پاسخ نامعتبر از سرور.");
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'خطا در آپلود فایل‌ها');
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
          accept="image/*,.zip,.rar,.7z,.docx,.doc,.pdf,.txt,.rtf"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
          <UploadCloud className="w-8 h-8 mb-2" />
          <p className="text-xs font-bold uppercase tracking-wider text-center px-4">
            {multiple ? "فایل ZIP چپتر یا تصاویر را به اینجا بکشید یا کلیک کنید" : "تصویر کاور را به اینجا بکشید یا کلیک کنید"}
          </p>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider text-center">
            {multiple ? "پشتیبانی از ZIP، WebP، JPEG، PNG - تبدیل خودکار به WebP بسیار فشرده" : "پشتیبانی از WebP، JPEG، PNG"}
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
