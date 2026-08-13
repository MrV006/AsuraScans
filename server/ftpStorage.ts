import * as ftp from "basic-ftp";
import path from "path";
import fs from "fs";
import Readable from "stream";

export interface FtpConfig {
  host?: string;
  user?: string;
  password?: string;
  port?: number;
  secure?: boolean;
  baseUrl?: string;
}

export interface FtpRetryQueueItem {
  id: string;
  localFilePath: string;
  remoteRelPath: string;
  retries: number;
  lastAttempt: number;
  error?: string;
}

// In-memory persistent queue for failed FTP uploads with local fallback
const ftpRetryQueue: Map<string, FtpRetryQueueItem> = new Map();
let isQueueProcessing = false;

/**
 * Creates a connected FTP client with timeout settings
 */
async function getConnectedClient(config?: FtpConfig, timeoutMs = 20000): Promise<{ client: ftp.Client; baseUrl: string; host: string }> {
  const ftpHost = config?.host || process.env.FTP_HOST;
  const ftpUser = config?.user || process.env.FTP_USER;
  const ftpPass = config?.password || process.env.FTP_PASS;
  const ftpPort = config?.port || Number(process.env.FTP_PORT || 21);
  const ftpSecure = config?.secure ?? (process.env.FTP_SECURE === "true");
  const baseUrl = (config?.baseUrl || process.env.STORAGE_BASE_URL || "").replace(/\/$/, "");

  if (!ftpHost || !ftpUser || !ftpPass) {
    throw new Error("FTP is not fully configured (missing host, user, or password)");
  }

  const client = new ftp.Client(timeoutMs);
  client.ftp.verbose = false;

  await client.access({
    host: ftpHost,
    port: ftpPort,
    user: ftpUser,
    password: ftpPass,
    secure: ftpSecure
  });

  return { client, baseUrl, host: ftpHost };
}

/**
 * Single file upload to FTP with automatic retry and error handling
 */
export async function uploadFileToFtp(
  localBuffer: Buffer,
  remoteRelPath: string,
  config?: FtpConfig,
  maxRetries = 2
): Promise<string | null> {
  const cleanRemoteRel = remoteRelPath.replace(/\\/g, "/").replace(/^\/+/, "");
  
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    let client: ftp.Client | null = null;
    try {
      const conn = await getConnectedClient(config, 25000);
      client = conn.client;

      await client.cd("/");
      const remoteDir = path.dirname(cleanRemoteRel);
      const filename = path.basename(cleanRemoteRel);

      if (remoteDir && remoteDir !== ".") {
        await client.ensureDir(remoteDir);
      }

      const stream = Readable.Readable.from(localBuffer);
      await client.uploadFrom(stream, filename);

      if (conn.baseUrl) {
        return `${conn.baseUrl}/${cleanRemoteRel}`;
      } else {
        return `ftp://${conn.host}/${cleanRemoteRel}`;
      }
    } catch (err: any) {
      console.warn(`[FTP] Upload attempt ${attempt}/${maxRetries} failed for '${cleanRemoteRel}': ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    } finally {
      if (client) client.close();
    }
  }

  return null;
}

/**
 * Upload local file from disk to FTP
 */
export async function uploadLocalFileToFtp(
  localFilePath: string,
  remoteRelPath: string,
  config?: FtpConfig
): Promise<string | null> {
  const cleanRemoteRel = remoteRelPath.replace(/\\/g, "/").replace(/^\/+/, "");
  let client: ftp.Client | null = null;

  try {
    const conn = await getConnectedClient(config, 30000);
    client = conn.client;

    await client.cd("/");
    const remoteDir = path.dirname(cleanRemoteRel);
    const filename = path.basename(cleanRemoteRel);

    if (remoteDir && remoteDir !== ".") {
      await client.ensureDir(remoteDir);
    }

    await client.uploadFrom(localFilePath, filename);

    if (conn.baseUrl) {
      return `${conn.baseUrl}/${cleanRemoteRel}`;
    } else {
      return `ftp://${conn.host}/${cleanRemoteRel}`;
    }
  } catch (err: any) {
    console.error(`[FTP] Local file upload error for '${cleanRemoteRel}':`, err.message);
    // Add to retry queue if local file still exists
    if (fs.existsSync(localFilePath)) {
      enqueueFtpRetry(localFilePath, cleanRemoteRel);
    }
    return null;
  } finally {
    if (client) client.close();
  }
}

/**
 * Batch upload files to FTP in a single connection session with auto-reconnect fallback
 */
export async function uploadBatchFilesToFtp(
  files: { buffer: Buffer; remoteRelPath: string; localFallbackPath?: string }[],
  config?: FtpConfig
): Promise<(string | null)[]> {
  if (!files || files.length === 0) return [];

  const results: (string | null)[] = files.map(() => null);

  let client: ftp.Client | null = null;
  let conn: { client: ftp.Client; baseUrl: string; host: string } | null = null;

  try {
    conn = await getConnectedClient(config, 45000);
    client = conn.client;
  } catch (connectErr: any) {
    console.warn(`[FTP] Batch connection failed: ${connectErr.message}. All files will use local storage fallback.`);
    // Enqueue fallback files
    for (const f of files) {
      if (f.localFallbackPath && fs.existsSync(f.localFallbackPath)) {
        enqueueFtpRetry(f.localFallbackPath, f.remoteRelPath);
      }
    }
    return results;
  }

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const cleanRemoteRel = f.remoteRelPath.replace(/\\/g, "/").replace(/^\/+/, "");

    try {
      await client.cd("/");
      const remoteDir = path.dirname(cleanRemoteRel);
      const filename = path.basename(cleanRemoteRel);

      if (remoteDir && remoteDir !== ".") {
        await client.ensureDir(remoteDir);
      }

      const stream = Readable.Readable.from(f.buffer);
      await client.uploadFrom(stream, filename);

      if (conn.baseUrl) {
        results[i] = `${conn.baseUrl}/${cleanRemoteRel}`;
      } else {
        results[i] = `ftp://${conn.host}/${cleanRemoteRel}`;
      }
    } catch (itemErr: any) {
      console.warn(`[FTP] Batch item upload failed for '${cleanRemoteRel}': ${itemErr.message}`);
      if (f.localFallbackPath && fs.existsSync(f.localFallbackPath)) {
        enqueueFtpRetry(f.localFallbackPath, cleanRemoteRel);
      }
      results[i] = null;
    }
  }

  if (client) {
    client.close();
  }

  return results;
}

/**
 * Enqueues a failed upload for automatic background retry
 */
export function enqueueFtpRetry(localFilePath: string, remoteRelPath: string) {
  const id = `${remoteRelPath}:${Date.now()}`;
  ftpRetryQueue.set(id, {
    id,
    localFilePath,
    remoteRelPath,
    retries: 0,
    lastAttempt: Date.now()
  });
  triggerQueueProcessing();
}

/**
 * Background processor for queued FTP uploads
 */
export async function triggerQueueProcessing(config?: FtpConfig) {
  if (isQueueProcessing || ftpRetryQueue.size === 0) return;
  isQueueProcessing = true;

  try {
    for (const [id, item] of ftpRetryQueue.entries()) {
      if (item.retries >= 5) {
        // Drop after 5 failed retries
        ftpRetryQueue.delete(id);
        continue;
      }

      // Check if minimum backoff passed
      const backoffMs = Math.pow(2, item.retries) * 5000;
      if (Date.now() - item.lastAttempt < backoffMs) {
        continue;
      }

      if (!fs.existsSync(item.localFilePath)) {
        ftpRetryQueue.delete(id);
        continue;
      }

      item.retries++;
      item.lastAttempt = Date.now();

      const uploadedUrl = await uploadLocalFileToFtp(item.localFilePath, item.remoteRelPath, config);
      if (uploadedUrl) {
        console.log(`[FTP-Queue] Successfully synced fallback file to FTP: ${item.remoteRelPath}`);
        ftpRetryQueue.delete(id);
      }
    }
  } catch (qErr) {
    console.error("[FTP-Queue] Error processing retry queue:", qErr);
  } finally {
    isQueueProcessing = false;
  }
}

// Background cron interval to check retry queue every 3 minutes
setInterval(() => {
  triggerQueueProcessing().catch(() => {});
}, 3 * 60 * 1000).unref();

/**
 * Test connection to download host
 */
export async function testFtpConnection(config: FtpConfig): Promise<{ success: boolean; message: string }> {
  if (!config.host || !config.user || !config.password) {
    return { success: false, message: "لطفاً آدرس هاست، نام کاربری و کلمه عبور FTP را وارد نمایید." };
  }
  const client = new ftp.Client(15000);
  client.ftp.verbose = false;
  try {
    await client.access({
      host: config.host,
      port: Number(config.port) || 21,
      user: config.user,
      password: config.password,
      secure: Boolean(config.secure)
    });
    await client.list("/");
    return { success: true, message: "اتصال با موفقیت به هاست دانلود برقرار شد!" };
  } catch (err: any) {
    return { success: false, message: `خطا در اتصال: ${err.message || err}` };
  } finally {
    client.close();
  }
}

/**
 * Move or rename file on FTP
 */
export async function moveFtpFile(
  oldRemotePath: string,
  newRemotePath: string,
  config?: FtpConfig
): Promise<string | null> {
  const cleanOld = oldRemotePath.replace(/^\/+/, "").replace(/\\/g, "/");
  const cleanNew = newRemotePath.replace(/^\/+/, "").replace(/\\/g, "/");

  let client: ftp.Client | null = null;
  try {
    const conn = await getConnectedClient(config, 25000);
    client = conn.client;

    if (cleanOld === cleanNew) {
      const baseUrl = conn.baseUrl || `ftp://${conn.host}`;
      return `${baseUrl}/${cleanNew}`;
    }

    const targetDir = path.dirname(cleanNew);
    if (targetDir && targetDir !== ".") {
      await client.cd("/");
      await client.ensureDir(targetDir);
    }

    await client.cd("/");

    let moveSuccess = false;
    try {
      await client.rename(cleanOld, cleanNew);
      moveSuccess = true;
    } catch (e) {
      try {
        await client.rename("/" + cleanOld, "/" + cleanNew);
        moveSuccess = true;
      } catch (e2) {
        moveSuccess = false;
      }
    }

    if (moveSuccess) {
      const baseUrl = conn.baseUrl || `ftp://${conn.host}`;
      return `${baseUrl}/${cleanNew}`;
    }

    return null;
  } catch (err) {
    console.error("[FTP] Move file error:", err);
    return null;
  } finally {
    if (client) client.close();
  }
}
