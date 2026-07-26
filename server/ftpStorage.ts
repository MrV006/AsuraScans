import * as ftp from "basic-ftp";
import path from "path";
import Readable from "stream";

export interface FtpConfig {
  host?: string;
  user?: string;
  password?: string;
  port?: number;
  secure?: boolean;
  baseUrl?: string;
}

export async function uploadFileToFtp(
  localBuffer: Buffer,
  remoteRelPath: string,
  config?: FtpConfig
): Promise<string | null> {
  const ftpHost = config?.host || process.env.FTP_HOST;
  const ftpUser = config?.user || process.env.FTP_USER;
  const ftpPass = config?.password || process.env.FTP_PASS;
  const ftpPort = config?.port || Number(process.env.FTP_PORT || 21);
  const ftpSecure = config?.secure ?? (process.env.FTP_SECURE === "true");
  const baseUrl = (config?.baseUrl || process.env.STORAGE_BASE_URL || "").replace(/\/$/, "");

  if (!ftpHost || !ftpUser || !ftpPass) {
    return null; // FTP not configured
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: ftpHost,
      port: ftpPort,
      user: ftpUser,
      password: ftpPass,
      secure: ftpSecure
    });

    // Remote path structure
    const remoteDir = path.dirname(remoteRelPath).replace(/\\/g, "/");
    const filename = path.basename(remoteRelPath);

    if (remoteDir && remoteDir !== ".") {
      await client.ensureDir(remoteDir);
    }

    const stream = Readable.Readable.from(localBuffer);
    await client.uploadFrom(stream, filename);

    if (baseUrl) {
      return `${baseUrl}/${remoteRelPath.replace(/\\/g, "/")}`;
    } else {
      return `ftp://${ftpHost}/${remoteRelPath.replace(/\\/g, "/")}`;
    }
  } catch (err) {
    console.error("FTP upload error:", err);
    return null;
  } finally {
    client.close();
  }
}

export async function uploadBatchFilesToFtp(
  files: { buffer: Buffer; remoteRelPath: string }[],
  config?: FtpConfig
): Promise<(string | null)[]> {
  const ftpHost = config?.host || process.env.FTP_HOST;
  const ftpUser = config?.user || process.env.FTP_USER;
  const ftpPass = config?.password || process.env.FTP_PASS;
  const ftpPort = config?.port || Number(process.env.FTP_PORT || 21);
  const ftpSecure = config?.secure ?? (process.env.FTP_SECURE === "true");
  const baseUrl = (config?.baseUrl || process.env.STORAGE_BASE_URL || "").replace(/\/$/, "");

  if (!ftpHost || !ftpUser || !ftpPass || files.length === 0) {
    return files.map(() => null);
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: ftpHost,
      port: ftpPort,
      user: ftpUser,
      password: ftpPass,
      secure: ftpSecure
    });

    const results: (string | null)[] = [];
    const dirCache = new Set<string>();

    for (const f of files) {
      try {
        const remoteDir = path.dirname(f.remoteRelPath).replace(/\\/g, "/");
        const filename = path.basename(f.remoteRelPath);

        if (remoteDir && remoteDir !== "." && !dirCache.has(remoteDir)) {
          await client.ensureDir(remoteDir);
          dirCache.add(remoteDir);
        }

        const stream = Readable.Readable.from(f.buffer);
        await client.uploadFrom(stream, filename);

        if (baseUrl) {
          results.push(`${baseUrl}/${f.remoteRelPath.replace(/\\/g, "/")}`);
        } else {
          results.push(`ftp://${ftpHost}/${f.remoteRelPath.replace(/\\/g, "/")}`);
        }
      } catch (err) {
        console.error("FTP batch item upload error:", err);
        results.push(null);
      }
    }
    return results;
  } catch (err) {
    console.error("FTP batch connection error:", err);
    return files.map(() => null);
  } finally {
    client.close();
  }
}

export async function testFtpConnection(config: FtpConfig): Promise<{ success: boolean; message: string }> {
  if (!config.host || !config.user || !config.password) {
    return { success: false, message: "لطفاً آدرس هاست، نام کاربری و کلمه عبور FTP را وارد نمایید." };
  }
  const client = new ftp.Client();
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
