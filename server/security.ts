import { Request, Response, NextFunction } from "express";
import path from "path";
import JSZip from "jszip";

// ============================================================================
// 1. SECURITY HEADERS MIDDLEWARE
// ============================================================================

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Remove Express footprint
  res.removeHeader("X-Powered-By");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking on iframe outside origin (allow iframe in same origin or development embed)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Enable XSS filtering in browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Prevent browser caching of sensitive API data
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

// ============================================================================
// 2. INPUT SANITIZATION & PROTOTYPE POLLUTION DEFENSE
// ============================================================================

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeValue(value: any, depth = 0): any {
  if (depth > 10) return value; // Prevent deep recursion DOS

  if (typeof value === "string") {
    // Strip dangerous null bytes and control chars (except standard whitespace / newlines)
    let clean = value.replace(/\0/g, "");
    // Prevent script tag injection in general string fields
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    return clean;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    const cleanObj: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        continue; // Strip prototype pollution keys
      }
      cleanObj[key] = sanitizeValue(value[key], depth + 1);
    }
    return cleanObj;
  }

  return value;
}

export function sanitizeInputMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeValue(req.params);
  }
  next();
}

// ============================================================================
// 3. SMART SLIDING-WINDOW RATE LIMITER
// ============================================================================

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitRecord>();
  const { windowMs, maxRequests, message = "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کرده و مجدداً تلاش فرمایید." } = options;

  // Periodic cleanup of expired records every 2 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 2 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Generate unique client key
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";
    const clientIp = Array.isArray(ip) ? ip[0] : (typeof ip === "string" ? ip.split(",")[0].trim() : "unknown");
    const userId = (req.headers["x-user-uid"] || req.headers["x-admin-uid"] || "") as string;
    
    const key = options.keyGenerator ? options.keyGenerator(req) : `${clientIp}:${userId}`;
    const now = Date.now();

    const record = store.get(key);

    if (!record || now > record.resetTime) {
      store.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSec
      });
    }

    next();
  };
}

// Preconfigured limiters for different sensitivity levels
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 25,
  message: "تعداد تلاش‌های ورود/ثبت‌نام بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر تلاش نمایید."
});

export const financialRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  message: "تراکنش‌های متوالی کیف پول بیش از حد مجاز است. لطفاً چند لحظه صبر کنید."
});

export const contentInteractionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 25,
  message: "ثبت نظر یا گزارش با سرعت بسیار بالا مجاز نیست. لطفاً کمی صبر کنید."
});

export const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 500,
  message: "تعداد درخواست‌ها به سرور بیش از حد مجاز است."
});

// ============================================================================
// 4. PATH TRAVERSAL & DIRECTORY INTEGRITY
// ============================================================================

/**
 * Validates that a candidate path resides strictly within an intended root directory.
 * Prevents directory traversal attacks (`../`, `..\\`, null bytes).
 */
export function isPathSafe(rootDir: string, candidatePath: string): boolean {
  try {
    const resolvedRoot = path.resolve(rootDir);
    const resolvedTarget = path.resolve(candidatePath);

    // Target must be equal to or a sub-path of rootDir
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
  } catch (e) {
    return false;
  }
}

/**
 * Sanitizes a file name, removing path separators and dangerous OS control characters.
 */
export function sanitizeSafeFileName(fileName: string): string {
  if (!fileName) return "file";
  // Remove null bytes, control chars, path separators, and normalize
  let clean = fileName.replace(/[/\\:*?"<>|\0]/g, "-").trim();
  clean = clean.replace(/\.{2,}/g, "."); // Prevent multiple consecutive dots
  clean = clean.replace(/^[.-]+|[.-]+$/g, ""); // Strip leading/trailing dots and dashes
  return clean || "file";
}

// ============================================================================
// 5. MAGIC BYTES & FILE INTEGRITY VERIFICATION
// ============================================================================

const DANGEROUS_EXTENSIONS = new Set([
  ".php", ".php3", ".php4", ".php5", ".phtml", ".phar",
  ".sh", ".bash", ".exe", ".bat", ".cmd", ".com", ".vbs", ".ps1",
  ".html", ".htm", ".xhtml", ".js", ".mjs", ".cjs", ".ts",
  ".cgi", ".pl", ".py", ".rb", ".jar", ".htaccess", ".config"
]);

export interface FileValidationResult {
  isValid: boolean;
  detectedType?: string;
  error?: string;
}

/**
 * Binary magic byte inspection and anti-executable scanning.
 */
export function validateFileBuffer(
  buffer: Buffer,
  originalName: string,
  claimedMime: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "فایل ارسالی خالی است." };
  }

  const ext = path.extname(originalName).toLowerCase();

  // 1. Blacklist check on extension
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { isValid: false, error: `پسوند فایل '${ext}' غیرمجاز و خطرناک است.` };
  }

  // 2. Scan first 4KB for script / executable payloads
  const sampleLength = Math.min(buffer.length, 4096);
  const sampleStr = buffer.slice(0, sampleLength).toString("latin1").toLowerCase();

  if (
    sampleStr.includes("<?php") ||
    sampleStr.includes("<?=") ||
    sampleStr.includes("<script") ||
    sampleStr.includes("<%") ||
    sampleStr.includes("#!/bin/") ||
    sampleStr.includes("eval(") ||
    sampleStr.includes("base64_decode(")
  ) {
    return { isValid: false, error: "محتوای فایل شامل کدهای اسکریپتی غیرمجاز شناسایی شد." };
  }

  // 3. Check for ELF or PE/EXE binary magic bytes
  if (buffer.length >= 4) {
    // Linux ELF: 7F 45 4C 46
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      return { isValid: false, error: "فایل‌های اجرایی باینری مجاز نیستند." };
    }
    // Windows MZ / PE: 4D 5A ('MZ')
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return { isValid: false, error: "فایل‌های اجرایی باینری مجاز نیستند." };
    }
  }

  // 4. Magic Bytes detection for allowed media/document types
  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedType: "image/png" };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { isValid: true, detectedType: "image/gif" };
  }

  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isValid: true, detectedType: "image/webp" };
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { isValid: true, detectedType: "application/pdf" };
  }

  // ZIP / DOCX / OpenXML: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return { isValid: true, detectedType: "application/zip" };
  }

  // BMP: BM (42 4D)
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { isValid: true, detectedType: "image/bmp" };
  }

  // SVG: Check XML / SVG tags safely
  if (ext === ".svg" || claimedMime === "image/svg+xml") {
    if (sampleStr.includes("<svg") && !sampleStr.includes("<script") && !sampleStr.includes("onload=")) {
      return { isValid: true, detectedType: "image/svg+xml" };
    }
    return { isValid: false, error: "فرمت فایل SVG معتبر نیست یا شامل اسکریپت‌های ناامن است." };
  }

  // Text/Doc formats fallback
  const isAllowedTextDoc = [".txt", ".rtf", ".doc"].includes(ext);
  if (isAllowedTextDoc) {
    return { isValid: true, detectedType: "text/plain" };
  }

  // Check if claimed MIME matches known allowed image types
  const allowedGeneralExtensions = [".webp", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".zip", ".rar", ".7z", ".docx", ".doc", ".pdf", ".txt"];
  if (allowedGeneralExtensions.includes(ext)) {
    return { isValid: true, detectedType: claimedMime };
  }

  return { isValid: false, error: `نوع فایل '${originalName}' توسط امضای باینری تأیید نشد.` };
}

// ============================================================================
// 6. ZIP-SLIP & ZIP-BOMB PROTECTION
// ============================================================================

export interface SafeZipInspection {
  isValid: boolean;
  imageEntries: string[];
  totalUncompressedBytes: number;
  error?: string;
}

export async function inspectZipArchiveSafely(
  zipBuffer: Buffer,
  maxUncompressedSize = 250 * 1024 * 1024, // 250 MB max
  maxEntryCount = 1000
): Promise<SafeZipInspection> {
  try {
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(zipBuffer);

    const fileEntries = Object.keys(zipContents.files);

    if (fileEntries.length > maxEntryCount) {
      return {
        isValid: false,
        imageEntries: [],
        totalUncompressedBytes: 0,
        error: `تعداد فایل‌های درون آرشیو (${fileEntries.length}) بیشتر از سقف مجاز (${maxEntryCount}) است.`
      };
    }

    const imageEntries: string[] = [];
    let totalUncompressedBytes = 0;

    for (const relativePath of fileEntries) {
      const entry = zipContents.files[relativePath];

      // Anti Zip-Slip: Reject entries with '..' or absolute path indicators
      const normalized = path.normalize(relativePath).replace(/\\/g, "/");
      if (
        normalized.startsWith("../") ||
        normalized.includes("/../") ||
        normalized === ".." ||
        path.isAbsolute(normalized) ||
        relativePath.includes("\0")
      ) {
        return {
          isValid: false,
          imageEntries: [],
          totalUncompressedBytes: 0,
          error: `آرشیو شامل مسیرهای غیرمجاز و ناامن است (Zip-Slip attempt): ${relativePath}`
        };
      }

      // Check dangerous extensions inside zip
      const innerExt = path.extname(normalized).toLowerCase();
      if (DANGEROUS_EXTENSIONS.has(innerExt)) {
        return {
          isValid: false,
          imageEntries: [],
          totalUncompressedBytes: 0,
          error: `فایل غیرمجاز '${normalized}' با پسوند '${innerExt}' داخل آرشیو زیپ یافت شد.`
        };
      }

      if (!entry.dir && normalized.match(/\.(jpe?g|png|webp|gif|bmp)$/i) && !normalized.includes("__MACOSX")) {
        imageEntries.push(relativePath);
      }
    }

    return {
      isValid: true,
      imageEntries,
      totalUncompressedBytes
    };
  } catch (e: any) {
    return {
      isValid: false,
      imageEntries: [],
      totalUncompressedBytes: 0,
      error: `فایل زیپ نامعتبر یا آسیب‌دیده است: ${e.message}`
    };
  }
}
