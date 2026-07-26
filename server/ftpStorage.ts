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
