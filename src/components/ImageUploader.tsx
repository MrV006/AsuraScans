import React, { useState, useCallback } from 'react';
import { UploadCloud, X, File as FileIcon, Loader2, Archive } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import JSZip from 'jszip';

interface Props {
  onUpload: (urls: string[]) => void;
  multiple?: boolean;
}

export function ImageUploader({ onUpload, multiple = false }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
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
    let filesToProcess: File[] = [];
    
    // Check for zip file
    const zipFile = files.find(f => f.name.endsWith('.zip') || f.type === 'application/zip');
    
    if (zipFile && multiple) {
      setUploading(true);
      setError(null);
      setProgress({ [zipFile.name]: 0 });
      try {
        const zip = new JSZip();
        const content = await zip.loadAsync(zipFile);
        
        const extractedFiles: File[] = [];
        const sortedPaths = Object.keys(content.files).sort();
        
        for (const path of sortedPaths) {
          const zipEntry = content.files[path];
          if (!zipEntry.dir && path.match(/\.(jpe?g|png|webp|gif)$/i)) {
            const blob = await zipEntry.async('blob');
            const file = new File([blob], path.split('/').pop() || path, { type: blob.type });
            extractedFiles.push(file);
          }
        }
        
        if (extractedFiles.length === 0) {
          throw new Error("No images found in the zip file.");
        }
        filesToProcess = extractedFiles;
        setProgress({}); // Clear zip extraction progress
      } catch (err: any) {
        console.error('Zip extraction failed:', err);
        setError(err.message || 'Error extracting zip file');
        setUploading(false);
        return;
      }
    } else {
      filesToProcess = multiple ? files : [files[0]];
    }

    if (filesToProcess.length === 0) return;

    setUploading(true);
    setError(null);
    const urls: string[] = [];
    
    // Sort files to preserve order if they are named sequentially (e.g. 1.jpg, 2.jpg)
    filesToProcess.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    try {
      const uploadPromises = filesToProcess.map(async (file) => {
        const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setProgress((prev) => ({ ...prev, [file.name]: progress }));
            },
            (err) => reject(err),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      urls.push(...uploadedUrls);
      onUpload(urls);
      setProgress({});
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
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
          <UploadCloud className="w-8 h-8 mb-2" />
          <p className="text-xs font-bold uppercase tracking-wider">
            Drag & Drop or Click to Upload
          </p>
        </div>
      </div>

      {uploading && (
        <div className="mt-4 space-y-2">
          {Object.entries(progress).map(([filename, prog]) => (
            <div key={filename} className="flex items-center gap-3 text-xs text-zinc-300">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-asura-accent)] shrink-0" />
              <span className="truncate flex-1">{filename}</span>
              <span className="font-bold">{Math.round(prog as number)}%</span>
            </div>
          ))}
        </div>
      )}
      
      {error && (
        <div className="mt-4 text-xs font-bold text-red-500">
          Upload Error: {error}
        </div>
      )}
    </div>
  );
}
