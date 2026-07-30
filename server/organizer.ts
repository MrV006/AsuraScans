import fs from "fs";
import path from "path";
import { dbManager } from "./db";
import { uploadLocalFileToFtp } from "./ftpStorage";

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
  const normalized = urlOrPath.replace(/\\/g, "/");
  return normalized.includes(`/uploads/${expectedFolder}/`);
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
      if (series.cover && series.cover.includes("/uploads/")) {
        const expectedRelDir = `series/${safeSeries}/cover`;
        if (!isAlreadyOrganized(series.cover, expectedRelDir)) {
          const filename = extractFilename(series.cover);
          if (filename) {
            const targetRelPath = `series/${safeSeries}/cover/${filename}`;
            const targetAbsDir = path.join(uploadsDir, "series", safeSeries, "cover");
            const targetAbsPath = path.join(targetAbsDir, filename);

            const existingLocalPath = findLocalFile(uploadsDir, filename);
            if (existingLocalPath && existingLocalPath !== targetAbsPath) {
              fs.mkdirSync(targetAbsDir, { recursive: true });
              try {
                fs.renameSync(existingLocalPath, targetAbsPath);
              } catch (e) {
                fs.copyFileSync(existingLocalPath, targetAbsPath);
                fs.unlinkSync(existingLocalPath);
              }
              movedFilesCount++;
            }

            let newUrl = `/uploads/${targetRelPath}`;
            if (isFtpEnabled && fs.existsSync(targetAbsPath)) {
              const ftpUrl = await uploadLocalFileToFtp(targetAbsPath, `uploads/${targetRelPath}`, dbFtpConfig);
              if (ftpUrl) newUrl = ftpUrl;
            } else if (baseUrl) {
              newUrl = `${baseUrl}/uploads/${targetRelPath}`;
            }

            if (series.cover !== newUrl) {
              series.cover = newUrl;
              seriesChanged = true;
            }
          }
        }
      }

      // 2. Organize Series Banner
      if (series.banner && series.banner.includes("/uploads/")) {
        const expectedRelDir = `series/${safeSeries}/banner`;
        if (!isAlreadyOrganized(series.banner, expectedRelDir)) {
          const filename = extractFilename(series.banner);
          if (filename) {
            const targetRelPath = `series/${safeSeries}/banner/${filename}`;
            const targetAbsDir = path.join(uploadsDir, "series", safeSeries, "banner");
            const targetAbsPath = path.join(targetAbsDir, filename);

            const existingLocalPath = findLocalFile(uploadsDir, filename);
            if (existingLocalPath && existingLocalPath !== targetAbsPath) {
              fs.mkdirSync(targetAbsDir, { recursive: true });
              try {
                fs.renameSync(existingLocalPath, targetAbsPath);
              } catch (e) {
                fs.copyFileSync(existingLocalPath, targetAbsPath);
                fs.unlinkSync(existingLocalPath);
              }
              movedFilesCount++;
            }

            let newUrl = `/uploads/${targetRelPath}`;
            if (isFtpEnabled && fs.existsSync(targetAbsPath)) {
              const ftpUrl = await uploadLocalFileToFtp(targetAbsPath, `uploads/${targetRelPath}`, dbFtpConfig);
              if (ftpUrl) newUrl = ftpUrl;
            } else if (baseUrl) {
              newUrl = `${baseUrl}/uploads/${targetRelPath}`;
            }

            if (series.banner !== newUrl) {
              series.banner = newUrl;
              seriesChanged = true;
            }
          }
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
            if (typeof imgUrl === "string" && imgUrl.includes("/uploads/")) {
              if (!isAlreadyOrganized(imgUrl, chapterRelDir)) {
                const filename = extractFilename(imgUrl);
                if (filename) {
                  const targetRelPath = `series/${safeSeries}/${safeChapter}/${filename}`;
                  const targetAbsDir = path.join(uploadsDir, "series", safeSeries, safeChapter);
                  const targetAbsPath = path.join(targetAbsDir, filename);

                  const existingLocalPath = findLocalFile(uploadsDir, filename);
                  if (existingLocalPath && existingLocalPath !== targetAbsPath) {
                    fs.mkdirSync(targetAbsDir, { recursive: true });
                    try {
                      fs.renameSync(existingLocalPath, targetAbsPath);
                    } catch (e) {
                      fs.copyFileSync(existingLocalPath, targetAbsPath);
                      fs.unlinkSync(existingLocalPath);
                    }
                    movedFilesCount++;
                  }

                  let newUrl = `/uploads/${targetRelPath}`;
                  if (isFtpEnabled && fs.existsSync(targetAbsPath)) {
                    const ftpUrl = await uploadLocalFileToFtp(targetAbsPath, `uploads/${targetRelPath}`, dbFtpConfig);
                    if (ftpUrl) newUrl = ftpUrl;
                  } else if (baseUrl) {
                    newUrl = `${baseUrl}/uploads/${targetRelPath}`;
                  }

                  if (imgUrl !== newUrl) {
                    chapterChanged = true;
                  }
                  updatedImages.push(newUrl);
                } else {
                  updatedImages.push(imgUrl);
                }
              } else {
                updatedImages.push(imgUrl);
              }
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
          for (const sub of chapter.submissions) {
            if (sub.fileUrl && sub.fileUrl.includes("/uploads/")) {
              const subRelDir = `series/${safeSeries}/${safeChapter}/submissions`;
              if (!isAlreadyOrganized(sub.fileUrl, subRelDir)) {
                const filename = extractFilename(sub.fileUrl);
                if (filename) {
                  const targetRelPath = `series/${safeSeries}/${safeChapter}/submissions/${filename}`;
                  const targetAbsDir = path.join(uploadsDir, "series", safeSeries, safeChapter, "submissions");
                  const targetAbsPath = path.join(targetAbsDir, filename);

                  const existingLocalPath = findLocalFile(uploadsDir, filename);
                  if (existingLocalPath && existingLocalPath !== targetAbsPath) {
                    fs.mkdirSync(targetAbsDir, { recursive: true });
                    try {
                      fs.renameSync(existingLocalPath, targetAbsPath);
                    } catch (e) {
                      fs.copyFileSync(existingLocalPath, targetAbsPath);
                      fs.unlinkSync(existingLocalPath);
                    }
                    movedFilesCount++;
                  }

                  let newUrl = `/uploads/${targetRelPath}`;
                  if (isFtpEnabled && fs.existsSync(targetAbsPath)) {
                    const ftpUrl = await uploadLocalFileToFtp(targetAbsPath, `uploads/${targetRelPath}`, dbFtpConfig);
                    if (ftpUrl) newUrl = ftpUrl;
                  } else if (baseUrl) {
                    newUrl = `${baseUrl}/uploads/${targetRelPath}`;
                  }

                  if (sub.fileUrl !== newUrl) {
                    sub.fileUrl = newUrl;
                    chapterChanged = true;
                  }
                }
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
