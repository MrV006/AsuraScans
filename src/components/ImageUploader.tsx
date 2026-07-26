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
        setProgressText("در حال باز کردن و استخراج فایل زیپ در مرورگر شما...");
        const zip = new JSZip();
        const zipContents = await zip.loadAsync(zipFile);
        
        const filenames = Object.keys(zipContents.files).filter(p => {
          const entry = zipContents.files[p];
          return !entry.dir && p.match(/\.(jpe?g|png|webp|gif|bmp)$/i) && !p.includes("__MACOSX");
        });

        if (filenames.length === 0) {
          throw new Error("هیچ تصویری داخل فایل فشرده یافت نشد.");
        }

        // Natural sort numerically/alphabetically (e.g. 1, 2, 10 instead of 1, 10, 2)
        filenames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

        setProgressText(`در حال استخراج ${filenames.length} تصویر...`);
        
        // Extract all images from ZIP as Files
        for (let i = 0; i < filenames.length; i++) {
          const filename = filenames[i];
          const entry = zipContents.files[filename];
          const blob = await entry.async("blob");
          
          let mimeType = "image/jpeg";
          if (filename.toLowerCase().endsWith(".png")) mimeType = "image/png";
          else if (filename.toLowerCase().endsWith(".webp")) mimeType = "image/webp";
          else if (filename.toLowerCase().endsWith(".gif")) mimeType = "image/gif";
          
          const ext = filename.split('.').pop() || 'jpg';
          const cleanName = `page-${i + 1}.${ext}`;
          const fileObj = new File([blob], cleanName, { type: mimeType });
          uploadPayload.push(fileObj);
        }
        
        setProgressText(`در حال آپلود و بهینه‌سازی ${uploadPayload.length} تصویر روی هاست... (لطفاً شکیبا باشید)`);
      } else {
        uploadPayload = multiple ? files : [files[0]];
        setProgressText(`در حال آپلود ${uploadPayload.length} تصویر به هاست...`);
      }

      const res = await apiClient.uploadImages(uploadPayload, user.uid, {
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
          accept="image/*,.zip"
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
