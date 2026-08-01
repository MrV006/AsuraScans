import fs from "fs";
import path from "path";
import { dbManager } from "./db";
import { uploadLocalFileToFtp, moveFtpFile } from "./ftpStorage";

export function sanitizeFolderName(name: string): string {
  if (!name) return "";
  let safe = name.replace(/[/\\:*?"<>|]/g, "-").trim();
  safe = safe.replace(/[\x00-\x1F\x7F]/g, "");
  safe = safe.replace(/\s+/g, " ");
  return safe || "general";
}

export function extractFilename(urlOrPath: string): string {
  if (!urlOrPath) return "";
  try {
    const clean = urlOrPath.split("?")[0].split("#")[0];
    return path.basename(clean);
  } catch (e) {
    return "";
  }
}

export function isAlreadyOrganized(urlOrPath: string, expectedFolder: string): boolean {
  if (!urlOrPath) return true;
  try {
    const decoded = decodeURIComponent(urlOrPath).replace(/\\/g, "/");
    const raw = urlOrPath.replace(/\\/g, "/");
    const cleanExpected = expectedFolder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    
    return decoded.includes(cleanExpected) || raw.includes(cleanExpected) || raw.includes(encodeURIComponent(cleanExpected));
  } catch (e) {
    return urlOrPath.includes(expectedFolder);
  }
}

export function isUploadedFileUrl(urlOrPath: string, baseUrl: string): boolean {
  if (!urlOrPath) return false;
  
  // Exclude external image hostings/CDNs that aren't user's own upload host
  if (/^(https?:)?\/\/(imgur\.com|postimg\.cc|i\.ibb\.co|cdn\.discordapp\.com|res\.cloudinary\.com)/i.test(urlOrPath)) {
    return false;
  }

  if (urlOrPath.includes("/uploads/") || urlOrPath.startsWith("uploads/")) return true;
  if (baseUrl && urlOrPath.startsWith(baseUrl)) return true;
  
  // Check if it's a media/document file
  return /\.(webp|png|jpe?g|gif|bmp|svg|zip|pdf|docx?|txt)$/i.test(urlOrPath);
}

export function findLocalFile(baseUploadsDir: string, filename: string): string | null {
  if (!filename) return null;
  
  // 1. Direct root uploads
  const rootPath = path.join(baseUploadsDir, filename);
  if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
    return rootPath;
  }

  // 2. Recursive search in uploads/
  function searchDir(dir: string): string | null {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          const found = searchDir(fullPath);
          if (found) return found;
        } else if (item.isFile() && item.name === filename) {
          return fullPath;
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  return searchDir(baseUploadsDir);
}

export async function organizeSingleFileUrl(
  rawUrl: string,
  expectedRelDir: string,
  uploadsDir: string,
  isFtpEnabled: boolean,
  dbFtpConfig: any,
  baseUrl: string
): Promise<{ newUrl: string; moved: boolean }> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { newUrl: rawUrl, moved: false };
  }

  if (!isUploadedFileUrl(rawUrl, baseUrl)) {
    return { newUrl: rawUrl, moved: false };
  }

  if (isAlreadyOrganized(rawUrl, expectedRelDir)) {
    return { newUrl: rawUrl, moved: false };
  }

  const filename = extractFilename(rawUrl);
  if (!filename) {
    return { newUrl: rawUrl, moved: false };
  }

  const cleanExpected = expectedRelDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const targetRelPath = `${cleanExpected}/${filename}`;
  const targetAbsDir = path.join(uploadsDir, ...cleanExpected.split("/"));
  const targetAbsPath = path.join(targetAbsDir, filename);

  let moved = false;
  let finalUrl = rawUrl;

  // 1. Check local file system
  const existingLocalPath = findLocalFile(uploadsDir, filename);
  if (existingLocalPath) {
    if (existingLocalPath !== targetAbsPath) {
      fs.mkdirSync(targetAbsDir, { recursive: true });
      try {
        fs.renameSync(existingLocalPath, targetAbsPath);
      } catch (e) {
        fs.copyFileSync(existingLocalPath, targetAbsPath);
        fs.unlinkSync(existingLocalPath);
      }
      moved = true;
    }

    if (isFtpEnabled && fs.existsSync(targetAbsPath)) {
      const ftpUrl = await uploadLocalFileToFtp(targetAbsPath, `uploads/${targetRelPath}`, dbFtpConfig);
      if (ftpUrl) {
        finalUrl = ftpUrl;
      } else if (baseUrl) {
        finalUrl = `${baseUrl}/uploads/${targetRelPath}`;
      } else {
        finalUrl = `/uploads/${targetRelPath}`;
      }
    } else if (baseUrl) {
      finalUrl = `${baseUrl}/uploads/${targetRelPath}`;
    } else {
      finalUrl = `/uploads/${targetRelPath}`;
    }

    return { newUrl: finalUrl, moved };
  }

  // 2. Local file not found, but FTP enabled -> organize remote FTP file
  if (isFtpEnabled) {
    let oldRemotePath = rawUrl.replace(/^https?:\/\/[^\/]+/, "").replace(/^\/+/, "");
    if (!oldRemotePath) oldRemotePath = filename;

    const ftpUrl = await moveFtpFile(oldRemotePath, `uploads/${targetRelPath}`, dbFtpConfig);
    if (ftpUrl) {
      return { newUrl: ftpUrl, moved: true };
    }
  }

  // 3. Fallback: update URL format if local/FTP move wasn't necessary or possible
  if (baseUrl) {
    finalUrl = `${baseUrl}/uploads/${targetRelPath}`;
  } else {
    finalUrl = `/uploads/${targetRelPath}`;
  }

  return { newUrl: finalUrl, moved: finalUrl !== rawUrl };
}

export async function organizeAllFiles(): Promise<{
  success: boolean;
  processedSeries: number;
  processedChapters: number;
  movedFilesCount: number;
  message: string;
}> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  let dbFtpConfig: any = null;
  try {
    dbFtpConfig = await dbManager.getSettings("download_host_settings");
  } catch (e) {
    // ignore
  }

  const isFtpEnabled = dbFtpConfig?.enabled ?? (process.env.FTP_ENABLED === "true" || Boolean(process.env.FTP_HOST));
  const baseUrl = (dbFtpConfig?.baseUrl || process.env.STORAGE_BASE_URL || "").replace(/\/$/, "");

  let processedSeries = 0;
  let processedChapters = 0;
  let movedFilesCount = 0;

  try {
    const allSeries = await dbManager.getSeries();

    for (const series of allSeries) {
      processedSeries++;
      const safeSeries = sanitizeFolderName(series.title || series.slug || series.id);
      let seriesChanged = false;

      // 1. Organize Series Cover
      if (series.cover) {
        const expectedRelDir = `series/${safeSeries}/cover`;
        const res = await organizeSingleFileUrl(series.cover, expectedRelDir, uploadsDir, isFtpEnabled, dbFtpConfig, baseUrl);
        if (res.moved || res.newUrl !== series.cover) {
          series.cover = res.newUrl;
          seriesChanged = true;
          if (res.moved) movedFilesCount++;
        }
      }

      // 2. Organize Series Banner
      if (series.banner) {
        const expectedRelDir = `series/${safeSeries}/banner`;
        const res = await organizeSingleFileUrl(series.banner, expectedRelDir, uploadsDir, isFtpEnabled, dbFtpConfig, baseUrl);
        if (res.moved || res.newUrl !== series.banner) {
          series.banner = res.newUrl;
          seriesChanged = true;
          if (res.moved) movedFilesCount++;
        }
      }

      if (seriesChanged) {
        await dbManager.saveSeries(series);
      }

      // 3. Organize Chapters for this Series
      const chapters = await dbManager.getChapters(series.id);
      for (const chapter of chapters) {
        processedChapters++;
        let chapterChanged = false;
        const safeChapter = sanitizeFolderName(`chapter-${chapter.number}`);
        const chapterRelDir = `series/${safeSeries}/${safeChapter}`;

        // Organize Images
        if (Array.isArray(chapter.images) && chapter.images.length > 0) {
          const updatedImages: string[] = [];

          for (const imgUrl of chapter.images) {
            if (typeof imgUrl === "string") {
              const res = await organizeSingleFileUrl(imgUrl, chapterRelDir, uploadsDir, isFtpEnabled, dbFtpConfig, baseUrl);
              if (res.moved || res.newUrl !== imgUrl) {
                chapterChanged = true;
                if (res.moved) movedFilesCount++;
              }
              updatedImages.push(res.newUrl);
            } else {
              updatedImages.push(imgUrl);
            }
          }

          if (chapterChanged) {
            chapter.images = updatedImages;
          }
        }

        // Organize Submissions if present
        if (Array.isArray(chapter.submissions) && chapter.submissions.length > 0) {
          const subRelDir = `series/${safeSeries}/${safeChapter}/submissions`;
          for (const sub of chapter.submissions) {
            if (sub.fileUrl && typeof sub.fileUrl === "string") {
              const res = await organizeSingleFileUrl(sub.fileUrl, subRelDir, uploadsDir, isFtpEnabled, dbFtpConfig, baseUrl);
              if (res.moved || res.newUrl !== sub.fileUrl) {
                sub.fileUrl = res.newUrl;
                chapterChanged = true;
                if (res.moved) movedFilesCount++;
              }
            }
          }
        }

        if (chapterChanged) {
          await dbManager.saveChapter(chapter);
        }
      }
    }

    // Move any stray unorganized files in uploads/ root to uploads/general/
    try {
      const rootEntries = fs.readdirSync(uploadsDir, { withFileTypes: true });
      const generalDir = path.join(uploadsDir, "general");

      for (const entry of rootEntries) {
        if (entry.isFile()) {
          const oldPath = path.join(uploadsDir, entry.name);
          const newPath = path.join(generalDir, entry.name);
          fs.mkdirSync(generalDir, { recursive: true });
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            fs.copyFileSync(oldPath, newPath);
            fs.unlinkSync(oldPath);
          }
          movedFilesCount++;

          if (isFtpEnabled) {
            await uploadLocalFileToFtp(newPath, `uploads/general/${entry.name}`, dbFtpConfig);
          }
        }
      }
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      processedSeries,
      processedChapters,
      movedFilesCount,
      message: `سازماندهی کامل شد. ${processedSeries} مجموعه، ${processedChapters} چپتر بررسی شدند و ${movedFilesCount} فایل در هاست مرتب شدند.`
    };
  } catch (err: any) {
    console.error("Error organizing files:", err);
    return {
      success: false,
      processedSeries,
      processedChapters,
      movedFilesCount,
      message: `خطا در سازماندهی فایل‌ها: ${err.message}`
    };
  }
}
