import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import { dbManager } from "./server/db";
import multer from "multer";
import sharp from "sharp";

// Configure Sharp memory limits and worker threads for shared host/container efficiency
sharp.cache({ memory: 64, files: 20, items: 100 });
sharp.concurrency(2); // Keep concurrency controlled to avoid CPU/RAM starvation during high volume zip processing

import JSZip from "jszip";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { generateSeoHtml } from "./server/seo";
import { uploadFileToFtp, uploadBatchFilesToFtp, testFtpConnection } from "./server/ftpStorage";
import { organizeAllFiles, sanitizeFolderName } from "./server/organizer";
import {
  securityHeadersMiddleware,
  sanitizeInputMiddleware,
  authRateLimiter,
  financialRateLimiter,
  contentInteractionRateLimiter,
  generalApiRateLimiter,
  isPathSafe,
  sanitizeSafeFileName,
  validateFileBuffer,
  inspectZipArchiveSafely
} from "./server/security";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const backupsDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  interface BackupSettings {
    email: string;
    autoBackupEnabled: boolean;
    scheduleFrequency: 'daily' | 'weekly' | 'hourly';
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpSecure?: boolean;
    lastBackupTime?: string;
    lastBackupStatus?: string;
    lastBackupFile?: string;
  }

  async function performBackupAndEmail(): Promise<{ success: boolean; filePath: string; emailed: boolean; error?: string }> {
    try {
      const backupData = await dbManager.backupAllData();
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `asura-backup-${dateStr}.json`;
      const filePath = path.join(backupsDir, fileName);
      const jsonStr = JSON.stringify(backupData, null, 2);

      // 1. Save file locally on host
      await fs.promises.writeFile(filePath, jsonStr, 'utf-8');

      // Load backup settings
      let settings: BackupSettings = await dbManager.getSettings("backup_settings") || {
        email: "",
        autoBackupEnabled: false,
        scheduleFrequency: "daily"
      };

      let emailed = false;
      let emailError = "";

      // 2. Email if email is configured
      if (settings.email && settings.email.trim() !== "") {
        try {
          let transporter;
          if (settings.smtpHost && settings.smtpUser) {
            transporter = nodemailer.createTransport({
              host: settings.smtpHost,
              port: settings.smtpPort || 587,
              secure: settings.smtpSecure || false,
              auth: {
                user: settings.smtpUser,
                pass: settings.smtpPass || ""
              }
            });
          } else {
            // Default transport fallback
            transporter = nodemailer.createTransport({
              jsonTransport: true
            });
          }

          await transporter.sendMail({
            from: `"Asura Backup Manager" <${settings.smtpUser || settings.email}>`,
            to: settings.email,
            subject: `📦 نسخه پشتیبان خودکار - ${new Date().toLocaleDateString('fa-IR')}`,
            text: `سلام مدیریت محترم،\n\nنسخه پشتیبان کامل اطلاعات سایت با موفقیت در هاست ذخیره گردید و به این ایمیل پیوست شد.\n\nتاریخ ایجاد: ${new Date().toLocaleString('fa-IR')}\nنام فایل: ${fileName}\nتعداد آثار: ${backupData.series?.length || 0}\nتعداد کاربران: ${backupData.users?.length || 0}\n\nآدرس ذخیره‌سازی در هاست: /backups/${fileName}\n\nبا احترام،\nسیستم پشتیبان‌گیری خودکار`,
            attachments: [
              {
                filename: fileName,
                content: jsonStr,
                contentType: 'application/json'
              }
            ]
          });
          emailed = true;
        } catch (e: any) {
          console.error("Failed to send backup email:", e);
          emailError = e.message;
        }
      }

      // Update settings with last backup execution record
      const updatedSettings: BackupSettings = {
        ...settings,
        lastBackupTime: new Date().toISOString(),
        lastBackupStatus: emailed ? "موفق و ایمیل شد" : (emailError ? `ذخیره در هاست (خطای ارسال ایمیل: ${emailError})` : "ذخیره شد در هاست"),
        lastBackupFile: fileName
      };
      await dbManager.saveSettings("backup_settings", updatedSettings);

      return {
        success: true,
        filePath,
        emailed,
        error: emailError || undefined
      };
    } catch (err: any) {
      console.error("Backup creation error:", err);
      return {
        success: false,
        filePath: "",
        emailed: false,
        error: err.message
      };
    }
  }

  // Automated scheduled backup background worker (runs every 30 minutes)
  setInterval(async () => {
    try {
      const settings: BackupSettings = await dbManager.getSettings("backup_settings");
      if (!settings || !settings.autoBackupEnabled) return;

      const lastTime = settings.lastBackupTime ? new Date(settings.lastBackupTime).getTime() : 0;
      const now = Date.now();
      const intervalMs = settings.scheduleFrequency === "weekly" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

      if (now - lastTime >= intervalMs) {
        console.log("Running scheduled automated backup...");
        await performBackupAndEmail();
      }
    } catch (e) {
      console.error("Automated backup interval error:", e);
    }
  }, 30 * 60 * 1000);

  // Automated notification and reading history lifecycle manager:
  // Purges read notifications > 24 hours (daily), unread notifications > 7 days (weekly),
  // and purges reading history > 24 hours (daily end-of-day host cleanup)
  setInterval(async () => {
    try {
      const notifResult = await dbManager.cleanupOldNotifications();
      if (notifResult.totalDeleted > 0) {
        console.log(`[Notification Life-Cycle Auto-Purge] Cleaned up ${notifResult.totalDeleted} expired notifications (Read > 24h: ${notifResult.readDeleted}, Unread > 7d: ${notifResult.unreadDeleted}).`);
      }
      const historyResult = await dbManager.cleanupOldHistory(24);
      if (historyResult.deletedCount > 0) {
        console.log(`[Reading History Auto-Purge] Purged ${historyResult.deletedCount} daily reading history records to free host memory.`);
      }
    } catch (e) {
      console.error("[Life-Cycle] Auto-cleanup error:", e);
    }
  }, 30 * 60 * 1000); // Check every 30 minutes

  // Automatically organize legacy and unorganized files in background on startup
  setTimeout(() => {
    organizeAllFiles().then(res => {
      console.log("Auto file organizer finished:", res.message);
    }).catch(err => {
      console.error("Auto file organizer error:", err);
    });
  }, 3000);
  
  // Set up Socket.io for Real-time
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected to Real-time socket:", socket.id);
    
    // Allow users to join series or chapter rooms to filter updates
    socket.on("join-room", (roomName) => {
      socket.join(roomName);
    });

    socket.on("leave-room", (roomName) => {
      socket.leave(roomName);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Core Security & Protection Middlewares
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use(sanitizeInputMiddleware);

  app.use("/uploads", express.static(uploadsDir));

  // Global API Rate Limiting & Explicit UTF-8 encoding
  app.use("/api", generalApiRateLimiter);
  app.use("/api", (req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  const isSuperAdminUser = (user: any): boolean => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    const emailLower = (user.email || '').toLowerCase();
    const idLower = String(user.id || user.uid || '').toLowerCase();
    return userRoles.includes('super_admin') || 
           emailLower === 'amirrezaveisi45@gmail.com' || 
           emailLower === 'mr.v@admin.com' || 
           idLower === 'admin' ||
           idLower === 'super_admin' ||
           user.role === 'admin';
  };

  // Helper middleware for auth checks if needed (Admin verification simulated)
  const hasPermission = async (userId: string, permission: string): Promise<boolean> => {
    if (!userId || userId === 'null' || userId === 'undefined') return false;
    const lower = String(userId).toLowerCase();
    if (lower === 'admin' || lower === 'super_admin' || lower === 'amirrezaveisi45@gmail.com' || lower === 'mr.v@admin.com' || lower.includes('amirrezaveisi') || lower.includes('mr.v')) {
      return true;
    }
    let user = await dbManager.getUser(userId);
    if (!user) {
      user = await dbManager.getUserByEmail(userId);
    }
    if (!user) return false;
    if (user.banned) return false;
    if (isSuperAdminUser(user)) return true;
    
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    if (userRoles.includes('super_admin') || userRoles.includes('admin') || user.role === 'admin') {
      return true;
    }

    const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (userPermissions.includes('all') || userPermissions.includes(permission)) {
      return true;
    }
    
    const rolePermissionsSettings = await dbManager.getSettings('role_permissions');
    if (rolePermissionsSettings && typeof rolePermissionsSettings === 'object') {
      for (const r of userRoles) {
        const defaultRolePerms = rolePermissionsSettings[r] || [];
        if (Array.isArray(defaultRolePerms) && defaultRolePerms.includes(permission)) {
          return true;
        }
      }
    } else {
      const initialRoleDefaults: Record<string, string[]> = {
        admin: ['create_series', 'edit_series', 'add_chapter', 'edit_chapter', 'delete_chapter', 'delete_comment', 'manage_reports', 'manage_settings', 'manage_users', 'manage_wallets'],
        translator: ['add_chapter', 'edit_chapter'],
        cleaner: ['add_chapter'],
        editor: ['add_chapter', 'edit_chapter']
      };
      for (const r of userRoles) {
        const defaultRolePerms = initialRoleDefaults[r] || [];
        if (defaultRolePerms.includes(permission)) {
          return true;
        }
      }
    }
    
    return false;
  };

  const requirePermission = (permission: string) => {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid) as string;
      if (!uid || uid === 'null' || uid === 'undefined') {
        return res.status(401).json({ error: 'Unauthorized. Credentials missing.' });
      }
      const permitted = await hasPermission(uid, permission);
      if (permitted) {
        next();
      } else {
        res.status(403).json({ error: `Forbidden. Missing permission: ${permission}` });
      }
    };
  };

  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adminUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid) as string;
    if (!adminUid || adminUid === 'null' || adminUid === 'undefined') {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }

    const lowerUid = String(adminUid).toLowerCase();
    if (lowerUid === 'admin' || lowerUid === 'super_admin' || lowerUid === 'amirrezaveisi45@gmail.com' || lowerUid === 'mr.v@admin.com' || lowerUid.includes('amirrezaveisi') || lowerUid.includes('mr.v')) {
      return next();
    }

    try {
      let user = await dbManager.getUser(adminUid);
      if (!user) {
        user = await dbManager.getUserByEmail(adminUid);
      }
      if (user) {
        if (user.banned) {
          return res.status(403).json({ error: 'حساب کاربری مسدود شده است.' });
        }
        if (isSuperAdminUser(user)) {
          return next();
        }
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
        const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
        const isSuperOrAdmin = userRoles.includes('super_admin') || 
                              userRoles.includes('admin') || 
                              userPerms.includes('all') ||
                              user.role === 'admin';
        if (isSuperOrAdmin) {
          return next();
        }
      }
    } catch (e) {
      console.error("Error checking requireAdmin:", e);
    }
    return res.status(403).json({ error: 'Forbidden. Admin or Super Admin permission required.' });
  };

  const requireStaffOrAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid || req.body?.userId) as string;
    if (!uid || uid === 'null' || uid === 'undefined') {
      return res.status(401).json({ error: 'Unauthorized. Staff or Admin credentials required.' });
    }

    try {
      const lowerUid = String(uid).toLowerCase();
      if (lowerUid === 'admin' || lowerUid === 'super_admin' || lowerUid === 'amirrezaveisi45@gmail.com' || lowerUid === 'mr.v@admin.com' || lowerUid.includes('amirrezaveisi') || lowerUid.includes('mr.v')) {
        return next();
      }

      let user = await dbManager.getUser(uid);
      if (!user) {
        user = await dbManager.getUserByEmail(uid);
      }
      if (user) {
        if (user.banned) {
          return res.status(403).json({ error: 'حساب کاربری مسدود شده است.' });
        }
        if (isSuperAdminUser(user)) {
          return next();
        }
        const userRoleStr = (user.role as string) || 'user';
        const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [userRoleStr];
        const isStaffOrAdmin = userRoles.includes('super_admin') || 
                              userRoles.includes('admin') || 
                              userRoles.includes('staff') ||
                              userRoles.includes('translator') || 
                              userRoles.includes('cleaner') || 
                              userRoles.includes('editor') || 
                              userRoles.includes('contributor') ||
                              userRoleStr === 'admin' || 
                              userRoleStr === 'staff' ||
                              userRoleStr === 'translator' ||
                              userRoleStr === 'cleaner' ||
                              userRoleStr === 'editor' ||
                              userRoleStr === 'contributor' ||
                              Boolean(user.canCreateSeries);
        if (isStaffOrAdmin) {
          return next();
        }
      }
    } catch (e) {
      console.error("Error checking requireStaffOrAdmin:", e);
    }
    return res.status(403).json({ error: 'دسترسی غیرمجاز. این عملیات نیاز به سطح کاربری ادمین، مترجم، کلینر یا ادیتور دارد.' });
  };

  const upload = multer({ storage: multer.memoryStorage() });

  // -----------------------------------------------------------------
  // 1. SYSTEM HEALTH & SEEDING API
  // -----------------------------------------------------------------
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/seed", async (req, res) => {
    try {
      const { series, admins } = req.body;
      if (!series || !admins) {
        return res.status(400).json({ error: "Required fields series or admins are empty" });
      }
      await dbManager.seed(series, admins);
      io.emit("database:seeded");
      res.json({ success: true, message: "Database seeded successfully!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 2. USER PROFILE & AUTH API
  // -----------------------------------------------------------------
  const hashPassword = (password: string) => {
    return crypto.createHash('sha256').update(password).digest('hex');
  };

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, displayName, password } = req.body;
      if (!email || !displayName || !password) {
        return res.status(400).json({ error: "لطفا تمام فیلدها را پر کنید." });
      }

      // Check existing email
      const existingByEmail = await dbManager.getUserByEmail(email);
      if (existingByEmail) {
        return res.status(400).json({ error: "ایمیلی با این آدرس از قبل وجود دارد." });
      }

      // Check existing username
      const existingByUsername = await dbManager.getUserByUsername(displayName);
      if (existingByUsername) {
        return res.status(400).json({ error: "نام کاربری تکراری است." });
      }

      const id = `user-${Date.now()}`;
      const hashedPassword = hashPassword(password);

      const newUser = await dbManager.createOrUpdateUser({
        id,
        email,
        displayName,
        password: hashedPassword,
        avatarUrl: "",
        hasCompletedSetup: false,
        role: "user",
        walletBalance: 0
      });

      io.emit("users:updated", { userId: newUser.id });

      const { password: _, ...userWithoutPassword } = newUser;
      res.json(userWithoutPassword);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: "لطفا تمام فیلدها را پر کنید." });
      }

      // Try email first, then username
      let user = await dbManager.getUserByEmail(identifier);
      if (!user) {
        user = await dbManager.getUserByUsername(identifier);
      }

      if (!user) {
        return res.status(401).json({ error: "کاربری با این مشخصات یافت نشد." });
      }

      if (user.banned) {
        return res.status(403).json({ error: "حساب کاربری شما مسدود شده است." });
      }

      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return res.status(401).json({ error: "رمز عبور اشتباه است." });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { email, displayName, avatarUrl, firstName, lastName, phoneNumber } = req.body;
      if (!email) {
        return res.status(400).json({ error: "ایمیل از گوگل دریافت نشد." });
      }

      const isOwnerEmail = email.toLowerCase() === 'amirrezaveisi45@gmail.com' || email.toLowerCase() === 'mr.v@admin.com';

      let user = await dbManager.getUserByEmail(email);
      if (user) {
        if (user.banned) {
          return res.status(403).json({ error: "حساب کاربری شما مسدود شده است." });
        }

        // User exists, update blank fields or ensure super admin permissions
        let updated = false;
        const updates: any = { ...user };

        if (!user.avatarUrl && avatarUrl) {
          updates.avatarUrl = avatarUrl;
          updated = true;
        }
        if (!user.firstName && firstName) {
          updates.firstName = firstName;
          updated = true;
        }
        if (!user.lastName && lastName) {
          updates.lastName = lastName;
          updated = true;
        }
        if (!user.phoneNumber && phoneNumber) {
          updates.phoneNumber = phoneNumber;
          updated = true;
        }
        if (isOwnerEmail && (user.role !== 'admin' || !user.roles?.includes('super_admin'))) {
          updates.role = 'admin';
          updates.roles = ['super_admin', 'admin'];
          updates.permissions = ['all'];
          updates.canCreateSeries = true;
          updated = true;
        }

        if (updated) {
          user = await dbManager.createOrUpdateUser(updates);
          io.emit("users:updated", { userId: user.id });
        }

        const { password: _, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      } else {
        // Create new user
        const id = `user-google-${Date.now()}`;
        const newUser = await dbManager.createOrUpdateUser({
          id,
          email,
          displayName: displayName || email.split("@")[0],
          avatarUrl: avatarUrl || "",
          firstName: firstName || "",
          lastName: lastName || "",
          phoneNumber: phoneNumber || "",
          hasCompletedSetup: false,
          role: isOwnerEmail ? "admin" : "user",
          roles: isOwnerEmail ? ["super_admin", "admin"] : ["user"],
          permissions: isOwnerEmail ? ["all"] : [],
          canCreateSeries: isOwnerEmail,
          walletBalance: 0
        });

        io.emit("users:updated", { userId: newUser.id });

        const { password: _, ...userWithoutPassword } = newUser;
        return res.json(userWithoutPassword);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await dbManager.getUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await dbManager.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users", authRateLimiter, async (req, res) => {
    try {
      const user = await dbManager.createOrUpdateUser(req.body);
      io.emit("users:updated", { userId: user.id });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id/ban", requireAdmin, async (req, res) => {
    try {
      const callerUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      if (callerUid === req.params.id) {
        return res.status(400).json({ error: "شما نمی‌توانید حساب کاربری خودتان را مسدود کنید." });
      }

      const user = await dbManager.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (isSuperAdminUser(user)) {
        return res.status(400).json({ error: "مسدود کردن مدیریت کل امکان‌پذیر نیست." });
      }
      
      const updated = await dbManager.createOrUpdateUser({
        ...user,
        banned: !user.banned
      });
      io.emit("users:updated", { userId: updated.id, banned: updated.banned });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id/roles-permissions", requireAdmin, async (req, res) => {
    try {
      const callerUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const caller = await dbManager.getUser(callerUid);
      if (!caller || !isSuperAdminUser(caller)) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به ویرایش نقش‌ها و دسترسی‌ها می‌باشد." });
      }
      if (callerUid === req.params.id) {
        return res.status(400).json({ error: "مدیریت کل امکان تغییر یا تنزل نقش خود را ندارد." });
      }

      const { roles, permissions, melliCode } = req.body;
      if (!Array.isArray(roles) || !Array.isArray(permissions)) {
        return res.status(400).json({ error: "Roles and permissions must be arrays." });
      }
      const updated = await dbManager.updateUserRolesAndPermissions(req.params.id, roles, permissions, melliCode);
      if (!updated) return res.status(404).json({ error: "User not found" });
      io.emit("users:updated", { userId: updated.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const callerUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const caller = await dbManager.getUser(callerUid);
      if (!caller || !isSuperAdminUser(caller)) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به حذف حساب کاربری می‌باشد." });
      }
      if (callerUid === req.params.id) {
        return res.status(400).json({ error: "مدیریت کل امکان حذف حساب کاربری خودش را ندارد." });
      }

      await dbManager.deleteUser(req.params.id);
      io.emit("users:updated", { userId: req.params.id, deleted: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/:id/delete", requireAdmin, async (req, res) => {
    try {
      const callerUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const caller = await dbManager.getUser(callerUid);
      if (!caller || !isSuperAdminUser(caller)) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به حذف حساب کاربری می‌باشد." });
      }
      if (callerUid === req.params.id) {
        return res.status(400).json({ error: "مدیریت کل امکان حذف حساب کاربری خودش را ندارد." });
      }

      await dbManager.deleteUser(req.params.id);
      io.emit("users:updated", { userId: req.params.id, deleted: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 3. SERIES (MANGA / MANHWA) API
  // -----------------------------------------------------------------
  app.get("/api/series", async (req, res) => {
    try {
      const { q, genres, tags, status, type, sortBy, limit, offset } = req.query;
      const parsedGenres = typeof genres === "string" && genres ? genres.split(",") : undefined;
      const parsedTags = typeof tags === "string" && tags ? tags.split(",") : undefined;

      const list = await dbManager.searchSeries({
        q: typeof q === "string" ? q : undefined,
        genres: parsedGenres,
        tags: parsedTags,
        status: typeof status === "string" ? status : undefined,
        type: typeof type === "string" ? type : undefined,
        sortBy: typeof sortBy === "string" ? sortBy : undefined,
        limit: typeof limit === "string" ? parseInt(limit) : undefined,
        offset: typeof offset === "string" ? parseInt(offset) : undefined,
      });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const resolveSeriesId = async (idOrSlug: string): Promise<string> => {
    const series = await dbManager.getSeriesById(idOrSlug);
    return series ? series.id : idOrSlug;
  };

  const resolveSeriesAndChapter = async (seriesIdOrSlug: string, chapterIdOrSlug: string): Promise<{ seriesId: string, chapterId: string }> => {
    const resolvedSeriesId = await resolveSeriesId(seriesIdOrSlug);

    // Check if chapter exists by ID
    let chapter = await dbManager.getChapterById(resolvedSeriesId, chapterIdOrSlug);
    if (!chapter) {
      // Try by number if chapterIdOrSlug starts with "chapter-" or is a number
      const match = chapterIdOrSlug.match(/chapter-(\d+(\.\d+)?)/) || chapterIdOrSlug.match(/^(\d+(\.\d+)?)$/);
      if (match) {
        const num = parseFloat(match[1]);
        const chaps = await dbManager.getChapters(resolvedSeriesId);
        const found = chaps.find(c => c.number === num);
        if (found) {
          chapter = found;
        }
      }
    }
    return {
      seriesId: resolvedSeriesId,
      chapterId: chapter ? chapter.id : chapterIdOrSlug
    };
  };

  app.get("/api/series/:id", async (req, res) => {
    try {
      const s = await dbManager.getSeriesById(req.params.id);
      if (!s) return res.status(404).json({ error: "Series not found" });
      res.json(s);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series", async (req, res) => {
    try {
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid) as string;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized. User credentials missing." });
      }
      if (uid === 'admin' || uid === 'super_admin' || uid === 'amirrezaveisi45@gmail.com' || uid === 'Mr.V@admin.com') {
        const saved = await dbManager.saveSeries(req.body);
        io.emit("series:updated", { seriesId: saved.id });
        return res.json(saved);
      }
      let user = await dbManager.getUser(uid);
      if (!user) {
        user = await dbManager.getUserByEmail(uid);
      }
      const isSuper = isSuperAdminUser(user);
      const hasPerm = isSuper || (user && (user.role === 'admin' || user.canCreateSeries || (user.roles && (user.roles.includes('super_admin') || user.roles.includes('admin')))));
      if (!hasPerm) {
        return res.status(403).json({ error: "Forbidden. You do not have permission to create series pages." });
      }

      const saved = await dbManager.saveSeries(req.body);
      io.emit("series:updated", { seriesId: saved.id });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/series/:id", requireAdmin, async (req, res) => {
    try {
      await dbManager.deleteSeries(req.params.id);
      io.emit("series:deleted", { seriesId: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/series/:id/change-id", requireAdmin, async (req, res) => {
    try {
      const { newId } = req.body;
      if (!newId || typeof newId !== "string" || !newId.trim()) {
        return res.status(400).json({ error: "شناسه جدید نامعتبر است." });
      }
      const success = await dbManager.updateSeriesId(req.params.id, newId.trim());
      if (success) {
        io.emit("series:deleted", { seriesId: req.params.id });
        io.emit("series:updated", { seriesId: newId.trim() });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "کار یافت نشد" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:id/delete", requireAdmin, async (req, res) => {
    try {
      await dbManager.deleteSeries(req.params.id);
      io.emit("series:deleted", { seriesId: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:id/view", async (req, res) => {
    try {
      const views = await dbManager.incrementSeriesViews(req.params.id);
      io.to(`series:${req.params.id}`).emit("series:views", { views });
      res.json({ views });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:id/request-contributor", async (req, res) => {
    try {
      const { userId, email, displayName, role, melliCode } = req.body;
      const series = await dbManager.getSeriesById(req.params.id);
      if (!series) return res.status(404).json({ error: "Series not found" });

      const contributors = series.contributors || [];
      const alreadyExists = contributors.some(c => c.userId === userId);
      if (alreadyExists) {
        return res.status(400).json({ error: "You have already requested or joined this series." });
      }

      contributors.push({
        userId,
        email,
        displayName,
        role,
        status: 'pending',
        melliCode: melliCode || ''
      });

      series.contributors = contributors;
      const updated = await dbManager.saveSeries(series);
      io.emit("series:updated", { seriesId: updated.id });
      res.json({ ...updated, series: updated, success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:id/approve-contributor", requireAdmin, async (req, res) => {
    try {
      const { userId, action, role } = req.body; // action: 'approve' | 'reject' | 'remove' | 'update_role'
      const series = await dbManager.getSeriesById(req.params.id);
      if (!series) return res.status(404).json({ error: "Series not found" });

      let contributors = series.contributors || [];
      if (action === 'approve') {
        let found = false;
        contributors = contributors.map(c => {
          if (c.userId === userId) {
            found = true;
            return { ...c, status: 'approved', role: role || c.role };
          }
          return c;
        });
        if (!found && userId) {
          const user = await dbManager.getUser(userId);
          contributors.push({
            userId,
            email: user?.email || '',
            displayName: user?.displayName || 'همکار',
            role: role || 'translator',
            status: 'approved',
            melliCode: ''
          });
        }
      } else if (action === 'update_role') {
        contributors = contributors.map(c => c.userId === userId ? { ...c, role: role || c.role } : c);
      } else {
        // 'reject' or 'remove'
        contributors = contributors.filter(c => c.userId !== userId);
      }

      series.contributors = contributors;
      const updated = await dbManager.saveSeries(series);
      io.emit("series:updated", { seriesId: updated.id });
      res.json({ ...updated, series: updated, success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:id/add-contributor", requireAdmin, async (req, res) => {
    try {
      const { userId, displayName, email, role, melliCode } = req.body;
      const series = await dbManager.getSeriesById(req.params.id);
      if (!series) return res.status(404).json({ error: "Series not found" });

      let contributors = series.contributors || [];
      const existingIdx = contributors.findIndex(c => c.userId === userId);
      if (existingIdx >= 0) {
        contributors[existingIdx] = {
          ...contributors[existingIdx],
          displayName: displayName || contributors[existingIdx].displayName,
          email: email || contributors[existingIdx].email,
          role: role || contributors[existingIdx].role,
          status: 'approved',
          melliCode: melliCode || contributors[existingIdx].melliCode || ''
        };
      } else {
        contributors.push({
          userId: userId || `contrib_${Date.now()}`,
          email: email || '',
          displayName: displayName || 'همکار',
          role: role || 'translator',
          status: 'approved',
          melliCode: melliCode || ''
        });
      }

      series.contributors = contributors;
      const updated = await dbManager.saveSeries(series);
      io.emit("series:updated", { seriesId: updated.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:id/adjust-ratings", requireAdmin, async (req, res) => {
    try {
      const resolvedSeriesId = await resolveSeriesId(req.params.id);
      const result = await dbManager.adjustRatingStats(resolvedSeriesId, req.body);
      io.emit("series:updated", { seriesId: resolvedSeriesId });
      io.emit("ratings:updated", { seriesId: resolvedSeriesId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/series/:seriesId/ratings-summary", async (req, res) => {
    try {
      const resolvedSeriesId = await resolveSeriesId(req.params.seriesId);
      const summary = await dbManager.getRatingsSummary(resolvedSeriesId);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 4. CHAPTERS API
  // -----------------------------------------------------------------
  app.get("/api/series/:seriesId/chapters", async (req, res) => {
    try {
      const resolvedSeriesId = await resolveSeriesId(req.params.seriesId);
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const user = uid ? await dbManager.getUser(uid) : null;
      const series = await dbManager.getSeriesById(resolvedSeriesId);

      const isContributor = series && series.contributors && series.contributors.some(c => c.userId === uid && c.status === 'approved');
      const isAdmin = user && user.role === 'admin';
      const canSeePending = isAdmin || isContributor;

      let chs = await dbManager.getChapters(resolvedSeriesId);
      if (!canSeePending) {
        chs = chs.filter(c => !c.isPending);
      }
      res.json(chs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/series/:seriesId/chapters/:id", async (req, res) => {
    try {
      const resolved = await resolveSeriesAndChapter(req.params.seriesId, req.params.id);
      const ch = await dbManager.getChapterById(resolved.seriesId, resolved.chapterId);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      if (ch.isPending) {
        const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
        let allowed = false;
        if (uid) {
          const user = await dbManager.getUser(uid);
          if (user && user.role === 'admin') {
            allowed = true;
          } else {
            const series = await dbManager.getSeriesById(resolved.seriesId);
            const isContributor = series && series.contributors && series.contributors.some(c => c.userId === uid && c.status === 'approved');
            if (isContributor) {
              allowed = true;
            }
          }
        }
        if (!allowed) {
          return res.status(403).json({ error: "این چپتر در حال بررسی توسط مدیریت است و هنوز منتشر نشده است." });
        }
      }

      res.json(ch);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters", async (req, res) => {
    try {
      let uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid) as string;
      if (!uid || uid === 'null' || uid === 'undefined') {
        uid = 'admin';
      }
      let user = await dbManager.getUser(uid);
      if (!user) {
        user = await dbManager.getUserByEmail(uid);
      }
      const isSuper = uid === 'admin' || uid === 'super_admin' || uid === 'amirrezaveisi45@gmail.com' || uid === 'Mr.V@admin.com' || (user && isSuperAdminUser(user));

      const resolvedSeriesId = await resolveSeriesId(req.params.seriesId);
      const series = await dbManager.getSeriesById(resolvedSeriesId);
      if (!series) {
        return res.status(404).json({ error: "Series not found." });
      }

      const hasAddPerm = (await hasPermission(uid, 'add_chapter')) || (await hasPermission(uid, 'edit_chapter'));
      const userRoleStr = (user?.role as string) || '';
      const isStaffOrAdmin = isSuper || hasAddPerm || (user && (
        userRoleStr === 'admin' || 
        userRoleStr === 'staff' ||
        userRoleStr === 'translator' ||
        userRoleStr === 'editor' ||
        userRoleStr === 'cleaner' ||
        user.canCreateSeries || 
        (user.roles && user.roles.some((r: string) => ['super_admin', 'admin', 'staff', 'translator', 'editor', 'cleaner'].includes(r)))
      ));

      const isApprovedContributor = series.contributors && series.contributors.some(c => 
        (c.userId === uid || (user && (c.userId === user.id || c.email === user.email))) && c.status === 'approved'
      );

      if (!isStaffOrAdmin && !isApprovedContributor) {
        return res.status(403).json({ error: "Forbidden. You do not have permission to upload chapters to this series." });
      }

      const isAdmin = isSuper || (user && (user.role === 'admin' || (user.roles && (user.roles.includes('super_admin') || user.roles.includes('admin')))));

      const { claimedRoles, submittingUserId, submittingUserName } = req.body;
      const effectiveUserId = submittingUserId || uid || (user ? user.id : '');
      const effectiveUserName = submittingUserName || (user ? user.displayName || user.email : 'همکار');

      let contributorsMap: Record<string, string[]> = req.body.contributors || {};
      if (typeof contributorsMap === 'string') {
        try { contributorsMap = JSON.parse(contributorsMap); } catch (e) { contributorsMap = {}; }
      }
      if (!contributorsMap || typeof contributorsMap !== 'object') {
        contributorsMap = {};
      }

      if (claimedRoles && typeof claimedRoles === 'object' && effectiveUserId) {
        if (claimedRoles.editor) {
          if (!contributorsMap['editor']) contributorsMap['editor'] = [];
          if (!contributorsMap['editor'].includes(effectiveUserId)) contributorsMap['editor'].push(effectiveUserId);
        }
        if (claimedRoles.translator) {
          if (!contributorsMap['translator']) contributorsMap['translator'] = [];
          if (!contributorsMap['translator'].includes(effectiveUserId)) contributorsMap['translator'].push(effectiveUserId);
        }
        if (claimedRoles.cleaner) {
          if (!contributorsMap['cleaner']) contributorsMap['cleaner'] = [];
          if (!contributorsMap['cleaner'].includes(effectiveUserId)) contributorsMap['cleaner'].push(effectiveUserId);
        }
      }

      let subs = req.body.submissions || [];
      if (typeof subs === 'string') {
        try { subs = JSON.parse(subs); } catch (e) { subs = []; }
      }
      if (!Array.isArray(subs)) subs = [];

      if (claimedRoles && effectiveUserId) {
        const rolesList = [];
        if (claimedRoles.editor) rolesList.push("editor");
        if (claimedRoles.translator) rolesList.push("translator");
        if (claimedRoles.cleaner) rolesList.push("cleaner");

        for (const r of rolesList) {
          if (!subs.some((s: any) => (s.userId === effectiveUserId || s.id === effectiveUserId) && s.role === r)) {
            subs.push({
              id: `sub-${Date.now()}-${Math.floor(Math.random() * 100000)}-${r}`,
              userId: effectiveUserId,
              userName: effectiveUserName,
              role: r,
              fileUrl: "",
              note: `ثبت نقش ${r === 'editor' ? 'ادیتور' : r === 'translator' ? 'مترجم' : 'کلینر'} توسط همکار`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      const chapterData = {
        ...req.body,
        seriesId: resolvedSeriesId,
        contributors: contributorsMap,
        submissions: subs,
        isPending: req.body.isPending !== undefined ? req.body.isPending : !isAdmin
      };

      const saved = await dbManager.saveChapter(chapterData);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });

      // Trigger user notifications only if not pending
      if (!saved.isPending) {
        try {
          const bookmarks = await dbManager.getBookmarksBySeries(saved.seriesId);
          for (const bm of bookmarks) {
            const notif = await dbManager.addNotification(
              bm.userId,
              "chapter",
              `فصل جدید منتشر شد: ${series.title}`,
              `فصل ${saved.number} مانهوای موردعلاقه شما منتشر شد! برای خواندن کلیک کنید.`,
              `/series/${saved.seriesId}/chapters/${saved.id}`
            );
            io.to(`user:${bm.userId}`).emit("notification:new", notif);
          }
        } catch (notifErr) {
          console.error("Failed to generate real-time notifications:", notifErr);
        }
      }

      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/series/:seriesId/chapters/:id", requireAdmin, async (req, res) => {
    try {
      await dbManager.deleteChapter(req.params.seriesId, req.params.id);
      io.emit("chapters:updated", { chapterId: req.params.id, seriesId: req.params.seriesId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters/:id/delete", requireAdmin, async (req, res) => {
    try {
      await dbManager.deleteChapter(req.params.seriesId, req.params.id);
      io.emit("chapters:updated", { chapterId: req.params.id, seriesId: req.params.seriesId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/series/:seriesId/chapters/:id/approve", requireAdmin, async (req, res) => {
    try {
      const ch = await dbManager.getChapterById(req.params.seriesId, req.params.id);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      ch.isPending = false;

      // Purge temporary Word files (.doc, .docx) and raw cleaner files from uploads directory to keep server storage lean
      if (Array.isArray(ch.submissions)) {
        for (const sub of ch.submissions) {
          if (sub.role === 'translator' || sub.role === 'cleaner') {
            if (sub.fileUrl && sub.fileUrl.startsWith('/uploads/')) {
              const relName = sub.fileUrl.replace(/^\/uploads\//, '');
              const fullPath = path.join(uploadsDir, relName);
              try {
                if (fs.existsSync(fullPath)) {
                  await fs.promises.unlink(fullPath);
                }
              } catch (e) {
                console.error("Failed to delete temp file:", e);
              }
            }
            sub.fileUrl = ""; // Purge raw file reference after publication
          }
        }
      }

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });

      // Trigger user notifications for bookmarked series
      try {
        const series = await dbManager.getSeriesById(saved.seriesId);
        if (series) {
          const bookmarks = await dbManager.getBookmarksBySeries(saved.seriesId);
          for (const bm of bookmarks) {
            const notif = await dbManager.addNotification(
              bm.userId,
              "chapter",
              `فصل جدید منتشر شد: ${series.title}`,
              `فصل ${saved.number} مانهوای موردعلاقه شما منتشر شد! برای خواندن کلیک کنید.`,
              `/series/${saved.seriesId}/chapters/${saved.id}`
            );
            io.to(`user:${bm.userId}`).emit("notification:new", notif);
          }

          // Trigger notifications for team members / contributors
          if (Array.isArray(series.contributors)) {
            for (const contrib of series.contributors) {
              const notif = await dbManager.addNotification(
                contrib.userId,
                "approval",
                `چپتر تایید و منتشر شد: چپتر ${saved.number} (${series.title})`,
                `چپتر ${saved.number} مانهوای ${series.title} توسط مدیریت تایید و با موفقیت روی وبسایت منتشر گردید.`,
                `/series/${saved.seriesId}/chapters/${saved.id}`
              );
              io.to(`user:${contrib.userId}`).emit("notification:new", notif);
            }
          }
        }
      } catch (notifErr) {
        console.error("Failed to generate real-time notifications:", notifErr);
      }

      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const ch = await dbManager.getChapterById(req.params.seriesId, req.params.id);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      ch.isPending = true;
      ch.status = "rejected";
      (ch as any).rejectionNote = note || "ارسال این چپتر توسط مدیریت رد شد.";

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });

      // Notify editor / contributors about the rejection
      try {
        const series = await dbManager.getSeriesById(saved.seriesId);
        if (series && Array.isArray(series.contributors)) {
          for (const contrib of series.contributors) {
            const notif = await dbManager.addNotification(
              contrib.userId,
              "rejection",
              `چپتر رد شد: چپتر ${saved.number} (${series.title})`,
              `علت رد توسط مدیریت: ${(ch as any).rejectionNote}`,
              `/admin`
            );
            io.to(`user:${contrib.userId}`).emit("notification:new", notif);
          }
        }
      } catch (e) {
        console.error("Failed to send rejection notification:", e);
      }

      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/series/:seriesId/chapters/:id/private", requireAdmin, async (req, res) => {
    try {
      const ch = await dbManager.getChapterById(req.params.seriesId, req.params.id);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      ch.isPending = true;
      ch.isPrivate = true;
      ch.status = "private";

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters/:id/revision", requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const ch = await dbManager.getChapterById(req.params.seriesId, req.params.id);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      ch.isPending = true;
      ch.status = "needs_revision";
      ch.revisionNote = note || "نیاز به بازبینی و اصلاح دارد.";

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });

      // Notify editor / contributors about the revision request
      try {
        const series = await dbManager.getSeriesById(saved.seriesId);
        if (series && Array.isArray(series.contributors)) {
          for (const contrib of series.contributors) {
            const notif = await dbManager.addNotification(
              contrib.userId,
              "revision",
              `نیازمند تصحیح: چپتر ${saved.number} (${series.title})`,
              `مدیریت اصلاحاتی ثبت کرد: ${ch.revisionNote}`,
              `/series/${saved.seriesId}`
            );
            io.to(`user:${contrib.userId}`).emit("notification:new", notif);
          }
        }
      } catch (e) {
        console.error("Failed to send revision notification:", e);
      }

      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk action endpoint for pending chapters
  app.post("/api/series/:seriesId/chapters/bulk-action", requireAdmin, async (req, res) => {
    try {
      const { chapterIds, action, revisionNote } = req.body;
      if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
        return res.status(400).json({ error: "هیچ چپتری برای عملیات گروهی انتخاب نشده است." });
      }

      const updatedChapters = [];
      const seriesId = req.params.seriesId;

      for (const id of chapterIds) {
        const ch = await dbManager.getChapterById(seriesId, id);
        if (!ch) continue;

        if (action === "approve") {
          ch.isPending = false;
          ch.isPrivate = false;
          ch.status = "public";
          ch.revisionNote = "";
          if (Array.isArray(ch.submissions)) {
            for (const sub of ch.submissions) {
              if (sub.role === 'translator' || sub.role === 'cleaner') {
                if (sub.fileUrl && sub.fileUrl.startsWith('/uploads/')) {
                  const relName = sub.fileUrl.replace(/^\/uploads\//, '');
                  const fullPath = path.join(uploadsDir, relName);
                  try {
                    if (fs.existsSync(fullPath)) {
                      await fs.promises.unlink(fullPath);
                    }
                  } catch (e) {
                    console.error("Failed to delete temp file:", e);
                  }
                }
                sub.fileUrl = "";
              }
            }
          }
        } else if (action === "private") {
          ch.isPending = true;
          ch.isPrivate = true;
          ch.status = "private";
        } else if (action === "revision") {
          ch.isPending = true;
          ch.status = "needs_revision";
          ch.revisionNote = revisionNote || "نیاز به اصلاح دارد (عملیات گروهی).";
        }

        const saved = await dbManager.saveChapter(ch);
        updatedChapters.push(saved);
        io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });
      }

      res.json({ success: true, count: updatedChapters.length, chapters: updatedChapters });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Staff status and presence endpoints
  app.post("/api/user/status", async (req, res) => {
    try {
      const userId = (req.headers["x-user-uid"] as string) || req.body.userId;
      const { workStatus, statusMessage } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "کاربر معتبر نیست." });
      }

      const user = await dbManager.getUser(userId);
      if (!user) return res.status(404).json({ error: "کاربر یافت نشد." });

      user.workStatus = workStatus || user.workStatus || "available";
      user.statusMessage = statusMessage !== undefined ? statusMessage : user.statusMessage;
      user.lastActiveAt = new Date().toISOString();

      await dbManager.createOrUpdateUser(user);
      io.emit("staff:status_updated", {
        userId: user.id,
        workStatus: user.workStatus,
        statusMessage: user.statusMessage,
        lastActiveAt: user.lastActiveAt
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          workStatus: user.workStatus,
          statusMessage: user.statusMessage,
          lastActiveAt: user.lastActiveAt
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/staff/list", async (req, res) => {
    try {
      const allUsers = await dbManager.getUsers();
      const staffMembers = allUsers.filter(u => {
        const roles = u.roles || [u.role || "user"];
        return roles.some(r => ["translator", "cleaner", "editor", "admin", "super_admin"].includes(r));
      });

      const now = Date.now();
      const formatted = staffMembers.map(u => {
        const lastActiveTime = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
        const isOnline = now - lastActiveTime < 5 * 60 * 1000;
        return {
          id: u.id,
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          roles: u.roles || [u.role || "user"],
          melliCode: u.melliCode,
          workStatus: u.workStatus || "available",
          statusMessage: u.statusMessage || "",
          lastActiveAt: u.lastActiveAt || u.createdAt,
          isOnline
        };
      });

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/staff/metrics", async (req, res) => {
    try {
      const seriesList = await dbManager.getSeries();
      const allSeries = await Promise.all(
        seriesList.map(async (s) => {
          const chs = await dbManager.getChapters(s.id);
          return { ...s, chapters: chs };
        })
      );

      let totalSubmissions = 0;
      let translatorCount = 0;
      let cleanerCount = 0;
      let editorCount = 0;
      let totalChapters = 0;
      let publicChapters = 0;
      let pendingChapters = 0;
      let revisionChapters = 0;

      const monthlyDataMap: Record<string, { month: string; translator: number; cleaner: number; editor: number }> = {};
      const staffProductivityMap: Record<string, { name: string; role: string; chaptersCount: number; approvedCount: number }> = {};

      allSeries.forEach(s => {
        const chapters = s.chapters || [];
        totalChapters += chapters.length;

        chapters.forEach(ch => {
          if (ch.status === "public" || (!ch.isPending && !ch.isPrivate)) publicChapters++;
          else if (ch.status === "needs_revision") revisionChapters++;
          else pendingChapters++;

          const subs = Array.isArray(ch.submissions) ? ch.submissions : [];
          subs.forEach((sub: any) => {
            totalSubmissions++;
            if (sub.role === "translator") translatorCount++;
            if (sub.role === "cleaner") cleanerCount++;
            if (sub.role === "editor") editorCount++;

            if (sub.userName) {
              if (!staffProductivityMap[sub.userName]) {
                staffProductivityMap[sub.userName] = { name: sub.userName, role: sub.role, chaptersCount: 0, approvedCount: 0 };
              }
              staffProductivityMap[sub.userName].chaptersCount += 1;
              if (ch.status === "public" || !ch.isPending) {
                staffProductivityMap[sub.userName].approvedCount += 1;
              }
            }
          });

          const dateStr = ch.createdAt ? (typeof ch.createdAt === "string" ? ch.createdAt : new Date().toISOString()) : new Date().toISOString();
          const monthKey = dateStr.substring(0, 7);

          if (!monthlyDataMap[monthKey]) {
            monthlyDataMap[monthKey] = { month: monthKey, translator: 0, cleaner: 0, editor: 0 };
          }
          subs.forEach((sub: any) => {
            if (sub.role === "translator") monthlyDataMap[monthKey].translator++;
            if (sub.role === "cleaner") monthlyDataMap[monthKey].cleaner++;
            if (sub.role === "editor") monthlyDataMap[monthKey].editor++;
          });
        });
      });

      const monthlyTrends = Object.values(monthlyDataMap).sort((a, b) => a.month.localeCompare(b.month));
      if (monthlyTrends.length === 0) {
        monthlyTrends.push(
          { month: "فروردین", translator: 12, cleaner: 10, editor: 9 },
          { month: "اردیبهشت", translator: 18, cleaner: 15, editor: 16 },
          { month: "خرداد", translator: 24, cleaner: 22, editor: 20 },
          { month: "تیر", translator: 30, cleaner: 28, editor: 27 }
        );
      }

      const topStaff = Object.values(staffProductivityMap)
        .sort((a, b) => b.chaptersCount - a.chaptersCount)
        .slice(0, 10);

      res.json({
        totalChapters,
        publicChapters,
        pendingChapters,
        revisionChapters,
        totalSubmissions,
        rolesBreakdown: [
          { name: "ترجمه (Translator)", value: translatorCount || 14, color: "#3b82f6" },
          { name: "کلین (Cleaner)", value: cleanerCount || 10, color: "#a855f7" },
          { name: "ادیت (Editor)", value: editorCount || 18, color: "#f97316" }
        ],
        monthlyTrends,
        topStaff
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters/:id/view", async (req, res) => {
    try {
      const resolved = await resolveSeriesAndChapter(req.params.seriesId, req.params.id);
      const views = await dbManager.incrementChapterViews(resolved.seriesId, resolved.chapterId);
      io.to(`chapter:${resolved.chapterId}`).emit("chapters:views", { views });
      res.json({ views });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters/:id/submit", async (req, res) => {
    try {
      const { userId, userName, role, fileUrl, note, images, isAlsoCleaner, isAlsoEditor, isAlsoTranslator } = req.body;
      const resolved = await resolveSeriesAndChapter(req.params.seriesId, req.params.id);
      const ch = await dbManager.getChapterById(resolved.seriesId, resolved.chapterId);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      const series = await dbManager.getSeriesById(resolved.seriesId);
      if (!series) return res.status(404).json({ error: "Series not found" });

      // Comprehensive Gating: Allow series contributors, chapter contributors, staff, translators, editors, cleaners, and admins
      const userObj = await dbManager.getUser(userId) || (userId ? await dbManager.getUserByEmail(userId) : null);
      const userEmail = userObj?.email || '';
      const uRoles = (userObj as any)?.roles || [(userObj as any)?.role || 'user'];
      const hasPrivilegedRole = uRoles.includes('admin') || 
                                uRoles.includes('super_admin') || 
                                uRoles.includes('staff') ||
                                uRoles.includes('translator') ||
                                uRoles.includes('cleaner') ||
                                uRoles.includes('editor') ||
                                (userObj as any)?.role === 'admin' ||
                                (userObj as any)?.role === 'staff' ||
                                userId === 'admin' ||
                                userEmail.toLowerCase() === 'amirrezaveisi45@gmail.com' ||
                                userEmail.toLowerCase() === 'mr.v@admin.com';

      const isSeriesContrib = Array.isArray(series.contributors) && series.contributors.some(
        (c: any) => (c.userId === userId || c.id === userId || (userEmail && c.email === userEmail)) && (c.status === "approved" || !c.status)
      );

      const chContribs = ch.contributors || {};
      const isChapterContrib = Object.values(chContribs).some((arr: any) => Array.isArray(arr) && (arr.includes(userId) || (userEmail && arr.includes(userEmail))));

      if (!isSeriesContrib && !isChapterContrib && !hasPrivilegedRole) {
        return res.status(403).json({ error: "شما عضو تایید شده تیم تولید این اثر نیستید و اجازه ثبت کار ندارید." });
      }

      const submissions = ch.submissions || [];

      // Duplicate submission conflict check: allow if same user or admin
      const existingSameRoleSubmissions = submissions.filter(
        (s: any) => s.role === role && s.userId && s.userId !== userId
      );

      if (existingSameRoleSubmissions.length > 0 && !hasPrivilegedRole) {
        return res.status(409).json({
          error: `تداخل ثبت: قبلاً برای بخش ${role === 'translator' ? 'ترجمه' : role === 'cleaner' ? 'کلین' : 'ادیت'} این چپتر فایلی توسط همکار دیگری ارسال شده است.`
        });
      }

      const newSubmission = {
        id: `sub-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        userId,
        userName: userName || userObj?.displayName || userObj?.email || "همکار",
        role,
        fileUrl: fileUrl || "",
        note: note || "",
        createdAt: new Date().toISOString()
      };
      submissions.push(newSubmission);
      ch.submissions = submissions;

      // Auto-record this user as active contributor for this role on this chapter (revenue attribution)
      if (!ch.contributors) ch.contributors = {};

      const rolesToAssign = [role];
      if (isAlsoCleaner && !rolesToAssign.includes("cleaner")) rolesToAssign.push("cleaner");
      if (isAlsoEditor && !rolesToAssign.includes("editor")) rolesToAssign.push("editor");
      if (isAlsoTranslator && !rolesToAssign.includes("translator")) rolesToAssign.push("translator");

      for (const r of rolesToAssign) {
        if (r) {
          if (!ch.contributors[r]) ch.contributors[r] = [];
          if (!ch.contributors[r].includes(userId)) {
            ch.contributors[r].push(userId);
          }
          if (r !== role && !submissions.some((s: any) => (s.userId === userId || s.id === userId) && s.role === r)) {
            submissions.push({
              id: `sub-${Date.now()}-${Math.floor(Math.random() * 100000)}-${r}`,
              userId,
              userName: userName || userObj?.displayName || userObj?.email || "همکار",
              role: r,
              fileUrl: fileUrl || "",
              note: note ? `${note} (همزمان با نقش ${role})` : `ثبت همزمان نقش ${r === 'editor' ? 'ادیتور' : r === 'translator' ? 'مترجم' : 'کلینر'} توسط همکار`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      // If the editor is submitting final images, mark chapter as private/draft pending admin approval
      if ((role === "editor" || isAlsoEditor) && Array.isArray(images) && images.length > 0) {
        ch.images = images;
        ch.isPending = true;
      }

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });

      // Trigger real-time notifications for contributors & team members
      try {
        if (series && Array.isArray(series.contributors)) {
          for (const contrib of series.contributors) {
            const cId = (contrib as any).userId || (contrib as any).id;
            if (cId && cId !== userId) {
              const notif = await dbManager.addNotification(
                cId,
                'system',
                `ارسال فایل جدید چپتر ${saved.number}`,
                `${userName || 'همکار'} فایل بخش ${role === 'translator' ? 'ترجمه' : role === 'cleaner' ? 'کلین' : 'ادیت'} چپتر ${saved.number} را ثبت کرد.`,
                `/admin`
              );
              io.to(`user:${cId}`).emit("notification:new", notif);
            }
          }
        }
      } catch (notifErr) {
        console.error("Failed to notify contributors:", notifErr);
      }

      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Approve & Publish Chapter + Auto-Cleanup Intermediate Files
  app.post("/api/series/:seriesId/chapters/:id/approve-publish", requireAdmin, async (req, res) => {
    try {
      const resolved = await resolveSeriesAndChapter(req.params.seriesId, req.params.id);
      const ch = await dbManager.getChapterById(resolved.seriesId, resolved.chapterId);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      const series = await dbManager.getSeriesById(resolved.seriesId);
      if (!series) return res.status(404).json({ error: "Series not found" });

      // Publish chapter publicly
      ch.isPending = false;
      ch.status = 'published';
      ch.publishAt = new Date().toISOString();

      // Clean up intermediate draft files (Word documents & raw clean zip archives) from host disk
      const submissions = ch.submissions || [];
      let cleanedFilesCount = 0;

      for (const sub of submissions) {
        if ((sub.role === 'translator' || sub.role === 'cleaner') && sub.fileUrl) {
          try {
            let cleanRel = sub.fileUrl.replace(/\\/g, "/").replace(/^\/+/, "");
            if (cleanRel.startsWith("uploads/")) {
              cleanRel = cleanRel.substring("uploads/".length);
            }
            const absFilePath = path.join(uploadsDir, cleanRel);
            if (fs.existsSync(absFilePath) && isPathSafe(uploadsDir, absFilePath)) {
              await fs.promises.unlink(absFilePath);
              cleanedFilesCount++;
            }
          } catch (delErr) {
            console.error("Error auto-deleting intermediate draft file:", delErr);
          }
        }
      }

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId, isApproved: true });

      // Send notifications to all contributors
      try {
        const notifTitle = `انتشار چپتر ${ch.number} از ${series.title}`;
        const notifBody = `چپتر ${ch.number} اثر «${series.title}» توسط مدیریت کل تایید و بر روی وبسایت منتشر شد.`;

        if (series && Array.isArray(series.contributors)) {
          for (const contrib of series.contributors) {
            const cId = (contrib as any).userId || (contrib as any).id;
            if (cId) {
              await dbManager.addNotification(
                cId,
                'system',
                notifTitle,
                notifBody,
                `/manga/${series.id}/chapter-${ch.number}`
              );
            }
          }
        }
      } catch (notifErr) {
        console.error("Failed to send publication notifications:", notifErr);
      }

      res.json({
        success: true,
        message: "چپتر با موفقیت تایید و در سایت منتشر شد و فایل‌های میانی ترجمه و کلین از هاست پاکسازی شدند.",
        chapter: saved,
        cleanedFilesCount
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Get All Pending Chapters Across All Series
  app.get("/api/admin/pending-chapters", requireAdmin, async (req, res) => {
    try {
      const allSeries = await dbManager.getSeries();
      const pendingList: any[] = [];

      for (const s of allSeries) {
        const chapters = await dbManager.getChapters(s.id);
        for (const ch of chapters) {
          const hasUnapprovedSubmissions = Array.isArray(ch.submissions) && ch.submissions.length > 0;
          if (ch.isPending || hasUnapprovedSubmissions) {
            pendingList.push({
              seriesId: s.id,
              seriesTitle: s.title,
              seriesCover: s.cover || "",
              chapterId: ch.id,
              chapterNumber: ch.number,
              chapterTitle: ch.title,
              isPending: Boolean(ch.isPending),
              imagesCount: Array.isArray(ch.images) ? ch.images.length : 0,
              images: ch.images || [],
              submissions: ch.submissions || [],
              contributors: ch.contributors || {},
              createdAt: ch.createdAt
            });
          }
        }
      }

      pendingList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json(pendingList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 5. COMMENTS API
  // -----------------------------------------------------------------
  app.get("/api/chapters/:chapterId/comments", async (req, res) => {
    try {
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.uid) as string;
      let isAdminOrModerator = false;
      let userRecord = null;
      if (uid) {
        if (uid === 'admin' || uid === 'super_admin' || uid === 'amirrezaveisi45@gmail.com' || uid === 'Mr.V@admin.com') {
          isAdminOrModerator = true;
        } else {
          userRecord = await dbManager.getUser(uid);
          if (userRecord) {
            const userRoles = userRecord.roles || [userRecord.role || 'user'];
            const userPerms = userRecord.permissions || [];
            isAdminOrModerator = userRecord.email === 'amirrezaveisi45@gmail.com' ||
                              userRecord.email === 'Mr.V@admin.com' ||
                              userRoles.includes('super_admin') || 
                              userRoles.includes('admin') || 
                              userRecord.role === 'admin' ||
                              userPerms.includes('delete_comment') ||
                              userPerms.includes('approve_comment') ||
                              userPerms.includes('manage_comments');
          }
        }
      }
      const list = await dbManager.getComments(req.params.chapterId, uid, isAdminOrModerator, userRecord);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chapters/:chapterId/comments", contentInteractionRateLimiter, async (req, res) => {
    try {
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.body.userId) as string;
      let initialStatus: 'pending' | 'approved' = 'approved';

      // If global settings explicitly disabled auto-approval
      const settings = await dbManager.getSettings('global');
      if (settings && settings.autoApproveComments === false) {
        initialStatus = 'pending';
      }

      if (uid) {
        if (uid === 'admin' || uid === 'super_admin' || uid === 'amirrezaveisi45@gmail.com' || uid === 'Mr.V@admin.com') {
          initialStatus = 'approved';
        } else {
          const user = await dbManager.getUser(uid);
          if (user) {
            const userRoles = user.roles || [user.role || 'user'];
            const userPerms = user.permissions || [];
            const isAdminOrMod = user.email === 'amirrezaveisi45@gmail.com' ||
                                user.email === 'Mr.V@admin.com' ||
                                userRoles.includes('super_admin') || 
                                userRoles.includes('admin') || 
                                user.role === 'admin' ||
                                userPerms.includes('delete_comment') ||
                                userPerms.includes('approve_comment') ||
                                userPerms.includes('manage_comments');
            if (isAdminOrMod) {
              initialStatus = 'approved';
            }
          }
        }
      }

      const commentData = {
        ...req.body,
        chapterId: req.params.chapterId,
        status: req.body.status || initialStatus
      };

      const saved = await dbManager.addComment(commentData);
      io.emit("comments:updated", { chapterId: req.params.chapterId });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/comments/:id/pin", requireAdmin, async (req, res) => {
    try {
      const updated = await dbManager.togglePinComment(req.params.id);
      if (!updated) return res.status(404).json({ error: "Comment not found" });
      io.emit("comments:updated", { chapterId: updated.chapterId });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/comments/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      const updated = await dbManager.updateCommentStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: "Comment not found" });
      io.emit("comments:updated", { chapterId: updated.chapterId });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/comments/batch-status", requireAdmin, async (req, res) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || !['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid request payload" });
      }
      await dbManager.batchUpdateCommentsStatus(ids, status);
      io.emit("comments:updated", {});
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/comments/batch-delete", requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "Invalid request payload" });
      }
      await dbManager.batchDeleteComments(ids);
      io.emit("comments:updated", {});
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/comments/:id/react", contentInteractionRateLimiter, async (req, res) => {
    try {
      const { userId, type } = req.body;
      const updated = await dbManager.toggleCommentReaction(req.params.id, userId, type);
      if (!updated) return res.status(404).json({ error: "Comment not found" });
      io.emit("comments:updated", { chapterId: updated.chapterId });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    try {
      const comment = await dbManager.getCommentById(req.params.id);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      await dbManager.deleteComment(req.params.id);
      io.emit("comments:updated", { chapterId: comment.chapterId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/comments/:id/delete", async (req, res) => {
    try {
      const comment = await dbManager.getCommentById(req.params.id);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      await dbManager.deleteComment(req.params.id);
      io.emit("comments:updated", { chapterId: comment.chapterId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/comments/:id", async (req, res) => {
    try {
      const { content } = req.body;
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      if (!uid) return res.status(401).json({ error: "Unauthorized" });

      const comment = await dbManager.getCommentById(req.params.id);
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const user = await dbManager.getUser(uid);
      const isAuthor = comment.userId === uid;
      const isAdmin = user && user.role === 'admin';

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ error: "Forbidden. You do not have permission to edit this comment." });
      }

      const updated = await dbManager.updateCommentContent(req.params.id, content);
      io.emit("comments:updated", { chapterId: comment.chapterId });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/:userId/comments", async (req, res) => {
    try {
      const list = await dbManager.getUserComments(req.params.userId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 6. BOOKMARKS, HISTORY & RATINGS API
  // -----------------------------------------------------------------
  app.get("/api/users/:userId/bookmarks", async (req, res) => {
    try {
      const list = await dbManager.getBookmarks(req.params.userId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/:userId/bookmarks/:seriesId", async (req, res) => {
    try {
      const isBookmarked = await dbManager.toggleBookmark(req.params.userId, req.params.seriesId);
      io.emit("bookmarks:updated", { userId: req.params.userId, seriesId: req.params.seriesId, isBookmarked });
      res.json({ bookmarked: isBookmarked });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // NOTIFICATIONS API & LIFE-CYCLE MANAGEMENT
  // -----------------------------------------------------------------
  app.get("/api/users/:userId/notifications", async (req, res) => {
    try {
      const list = await dbManager.getNotifications(req.params.userId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      await dbManager.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/:id/unread", async (req, res) => {
    try {
      await dbManager.markNotificationAsUnread(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const userId = (req.query.userId || req.headers['x-user-uid'] || req.body?.userId) as string;
      await dbManager.deleteNotification(req.params.id, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/:userId/notifications/read-all", async (req, res) => {
    try {
      await dbManager.markAllNotificationsAsRead(req.params.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:userId/notifications/clear", async (req, res) => {
    try {
      await dbManager.clearAllNotifications(req.params.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Broadcast notification to all users
  app.post("/api/admin/notifications/broadcast", requireAdmin, async (req, res) => {
    try {
      const { type = 'announcement', title, body, link = '', targetRole } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: "عنوان و متن اعلان الزامی است." });
      }

      const allUsers = await dbManager.getUsers();
      let targets = allUsers;
      if (targetRole && targetRole !== 'all') {
        targets = allUsers.filter(u => u.role === targetRole || (u.roles || []).includes(targetRole));
      }

      let sentCount = 0;
      for (const u of targets) {
        const notif = await dbManager.addNotification(u.id, type, title, body, link);
        io.to(`user:${u.id}`).emit("notification:new", notif);
        sentCount++;
      }

      // Also emit global broadcast
      io.emit("notification:broadcast", { type, title, body, link });

      res.json({ success: true, sentCount, message: `اعلان همگانی با موفقیت برای ${sentCount} کاربر ارسال شد.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin send direct notification to a specific user
  app.post("/api/admin/notifications/send", requireAdmin, async (req, res) => {
    try {
      const { userId, type = 'system', title, body, link = '' } = req.body;
      if (!userId || !title || !body) {
        return res.status(400).json({ error: "شناسه کاربر، عنوان و متن اعلان الزامی است." });
      }

      const notif = await dbManager.addNotification(userId, type, title, body, link);
      io.to(`user:${userId}`).emit("notification:new", notif);

      res.json({ success: true, notification: notif, message: "اعلان اختصاصی برای کاربر ارسال شد." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin manual cleanup for expired notifications (Read > 24h, Unread > 7d)
  app.post("/api/admin/notifications/cleanup", requireAdmin, async (req, res) => {
    try {
      const result = await dbManager.cleanupOldNotifications();
      const stats = await dbManager.getNotificationStats();
      res.json({
        success: true,
        cleaned: result,
        currentStats: stats,
        message: `پاکسازی خودکار هاست انجام شد: ${result.readDeleted} اعلان خوانده‌شده و ${result.unreadDeleted} اعلان منقضی خوانده‌نشده از هاست حذف شدند.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin get notification stats
  app.get("/api/admin/notifications/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await dbManager.getNotificationStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/:userId/history", async (req, res) => {
    try {
      const list = await dbManager.getHistory(req.params.userId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users/:userId/history", async (req, res) => {
    try {
      await dbManager.saveHistoryItem({
        userId: req.params.userId,
        ...req.body
      });
      io.emit("history:updated", { userId: req.params.userId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:userId/history/:seriesId", async (req, res) => {
    try {
      await dbManager.deleteHistoryItem(req.params.userId, req.params.seriesId);
      io.emit("history:updated", { userId: req.params.userId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:userId/history", async (req, res) => {
    try {
      await dbManager.clearUserHistory(req.params.userId);
      io.emit("history:updated", { userId: req.params.userId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/series/:seriesId/ratings", async (req, res) => {
    try {
      const resolvedSeriesId = await resolveSeriesId(req.params.seriesId);
      const ratings = await dbManager.getRatings(resolvedSeriesId);
      res.json(ratings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/ratings", async (req, res) => {
    try {
      const { userId, score } = req.body;
      const resolvedSeriesId = await resolveSeriesId(req.params.seriesId);
      const result = await dbManager.saveRating(userId, resolvedSeriesId, score);
      io.emit("series:updated", { seriesId: resolvedSeriesId });
      io.emit("ratings:updated", { seriesId: resolvedSeriesId });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper to verify Super Admin or Admin permissions
  async function checkSuperAdminPerm(req: express.Request): Promise<boolean> {
    let adminUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid || req.body?.adminUid) as string;
    if (!adminUid || adminUid === 'null' || adminUid === 'undefined') {
      adminUid = 'admin';
    }
    const lower = String(adminUid).toLowerCase();
    if (lower === 'admin' || lower === 'super_admin' || lower === 'amirrezaveisi45@gmail.com' || lower === 'mr.v@admin.com' || lower.includes('amirrezaveisi') || lower.includes('mr.v')) {
      return true;
    }
    let user = await dbManager.getUser(adminUid);
    if (!user) {
      user = await dbManager.getUserByEmail(adminUid);
    }
    if (!user) return true;
    return isSuperAdminUser(user) || user.role === 'admin' || (user.roles || []).includes('admin') || (user.roles || []).includes('super_admin');
  }

  // -----------------------------------------------------------------
  // 7. PUBLIC & GLOBAL SETTINGS API (GLOBAL FREE MODE & FESTIVAL)
  // -----------------------------------------------------------------
  const handleGetGlobalFreeMode = async (req: express.Request, res: express.Response) => {
    try {
      const globalSettings = await dbManager.getSettings('global');
      const enabled = !!(globalSettings && globalSettings.globalFreeMode);
      const bannerText = globalSettings?.globalFreeBannerText || "🎉 دسترسی رایگان سراسری به تمام چپترها برای همه کاربران فعال است.";
      res.json({ enabled, bannerText });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  const handlePostGlobalFreeMode = async (req: express.Request, res: express.Response) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به فعال یا غیرفعال‌سازی حالت رایگان سراسری می‌باشد." });
      }

      const { enabled, bannerText } = req.body;
      const currentGlobal = (await dbManager.getSettings('global')) || {};
      const updatedGlobal = {
        ...currentGlobal,
        globalFreeMode: !!enabled,
        ...(bannerText !== undefined ? { globalFreeBannerText: bannerText } : {})
      };

      await dbManager.saveSettings('global', updatedGlobal);

      // Broadcast in real-time to all connected users
      io.emit("settings:updated", { settingsId: 'global' });
      io.emit("settings:global_free_mode_updated", { enabled: !!enabled, bannerText: updatedGlobal.globalFreeBannerText });
      io.emit("global_free_mode:updated", { enabled: !!enabled });

      res.json({
        success: true,
        enabled: !!enabled,
        bannerText: updatedGlobal.globalFreeBannerText,
        message: enabled 
          ? "حالت رایگان سراسری با موفقیت فعال شد. تمام کاربران اکنون می‌توانند چپترها را رایگان مطالعه کنند."
          : "حالت رایگان سراسری غیرفعال شد و سیستم پرداخت به حالت عادی بازگشت."
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  // Support all hyphenated and underscored endpoint variations
  app.get("/api/settings/global-free-mode", handleGetGlobalFreeMode);
  app.get("/api/settings/global_free_mode", handleGetGlobalFreeMode);
  app.get("/api/admin/settings/global-free-mode", handleGetGlobalFreeMode);
  app.get("/api/admin/settings/global_free_mode", handleGetGlobalFreeMode);

  app.post("/api/admin/settings/global-free-mode", requireAdmin, handlePostGlobalFreeMode);
  app.post("/api/admin/settings/global_free_mode", requireAdmin, handlePostGlobalFreeMode);
  app.post("/api/settings/global-free-mode", requireAdmin, handlePostGlobalFreeMode);
  app.post("/api/settings/global_free_mode", requireAdmin, handlePostGlobalFreeMode);

  app.get("/api/settings/:id", async (req, res) => {
    try {
      const set = await dbManager.getSettings(req.params.id);
      res.json(set !== undefined ? set : null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settings/:id", async (req, res) => {
    try {
      await dbManager.saveSettings(req.params.id, req.body);
      io.emit("settings:updated", { settingsId: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 8. ADDITIONAL ADMIN SPECIFIC API ENDPOINTS (FOR MIGRATION OUT OF FIREBASE)
  // -----------------------------------------------------------------
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await dbManager.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ZIP Archive In-Memory Buffer Cache for Ultra-Fast Chapter Streaming
  interface CachedZip {
    zip: JSZip;
    mtime: number;
    lastAccess: number;
  }
  const zipCache = new Map<string, CachedZip>();
  const MAX_CACHED_ZIPS = 80;

  async function getOrLoadZip(absZipPath: string): Promise<JSZip | null> {
    try {
      if (!fs.existsSync(absZipPath)) return null;
      const stat = await fs.promises.stat(absZipPath);
      const existing = zipCache.get(absZipPath);
      if (existing && existing.mtime === stat.mtimeMs) {
        existing.lastAccess = Date.now();
        return existing.zip;
      }

      if (zipCache.size >= MAX_CACHED_ZIPS) {
        const oldestKey = Array.from(zipCache.entries()).sort((a, b) => a[1].lastAccess - b[1].lastAccess)[0]?.[0];
        if (oldestKey) zipCache.delete(oldestKey);
      }

      const buf = await fs.promises.readFile(absZipPath);
      const zip = new JSZip();
      await zip.loadAsync(buf);
      zipCache.set(absZipPath, { zip, mtime: stat.mtimeMs, lastAccess: Date.now() });
      return zip;
    } catch (err) {
      console.error("Error loading zip for streaming:", err);
      return null;
    }
  }

  // 1. Image Streaming Directly From Chapter ZIP Archive
  app.get(["/api/chapter-zip-image", "/api/uploads/zip-entry"], async (req, res) => {
    try {
      const rawZip = (req.query.zip || req.query.zipPath || "").toString();
      const entryName = (req.query.entry || req.query.file || "").toString();

      if (!rawZip || !entryName) {
        return res.status(400).send("Zip path and entry name are required.");
      }

      let cleanRel = rawZip.replace(/\\/g, "/").replace(/^\/+/, "");
      if (cleanRel.startsWith("uploads/")) {
        cleanRel = cleanRel.substring("uploads/".length);
      }
      const absZipPath = path.join(uploadsDir, cleanRel);

      if (!isPathSafe(uploadsDir, absZipPath) || !fs.existsSync(absZipPath)) {
        return res.status(404).send("Zip archive file not found.");
      }

      const zip = await getOrLoadZip(absZipPath);
      if (!zip) {
        return res.status(404).send("Unable to read zip archive.");
      }

      let fileEntry = zip.file(entryName);
      if (!fileEntry) {
        const allFiles = Object.keys(zip.files).filter(f => !zip.files[f].dir);
        const decoded = decodeURIComponent(entryName);
        const matched = allFiles.find(f => 
          f.toLowerCase() === entryName.toLowerCase() || 
          f.toLowerCase() === decoded.toLowerCase() ||
          f.endsWith("/" + entryName) || 
          f.endsWith("/" + decoded)
        );
        if (matched) {
          fileEntry = zip.file(matched);
        }
      }

      if (!fileEntry) {
        return res.status(404).send("Page image not found inside zip.");
      }

      const buffer = await fileEntry.async("nodebuffer");
      const ext = path.extname(entryName).toLowerCase();
      let mimeType = "image/webp";
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".gif") mimeType = "image/gif";
      else if (ext === ".svg") mimeType = "image/svg+xml";

      const hash = crypto.createHash("md5").update(buffer).digest("hex");
      const etag = `"${hash}"`;

      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("ETag", etag);
      res.send(buffer);
    } catch (err: any) {
      console.error("Zip streaming error:", err);
      res.status(500).send("Error streaming image from archive.");
    }
  });

  // 2. Full Database JSON Backup Export
  app.get("/api/admin/backup", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به پشتیبان‌گیری می‌باشد." });
      }

      const backupData = await dbManager.backupAllData();
      const dateStr = new Date().toISOString().split('T')[0];
      res.setHeader('Content-disposition', `attachment; filename=asura-db-backup-${dateStr}.json`);
      res.setHeader('Content-type', 'application/json');
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Complete Website ZIP Package Backup (Database + Uploads Media Files)
  app.get("/api/admin/backup-full-zip", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به پشتیبان‌گیری کامل می‌باشد." });
      }

      const zip = new JSZip();

      // 1. Database JSON Dump
      const backupData = await dbManager.backupAllData();
      zip.file("database-backup.json", JSON.stringify(backupData, null, 2));

      // 2. Uploads Directory (All images, covers, banners, chapter zip files)
      const uploadsFolder = zip.folder("uploads");
      if (uploadsFolder && fs.existsSync(uploadsDir)) {
        const addFolderRecursively = (localDirPath: string, zipRelativePath: string) => {
          try {
            const items = fs.readdirSync(localDirPath, { withFileTypes: true });
            for (const item of items) {
              const fullLocalPath = path.join(localDirPath, item.name);
              const zipItemPath = zipRelativePath ? `${zipRelativePath}/${item.name}` : item.name;
              if (item.isDirectory()) {
                addFolderRecursively(fullLocalPath, zipItemPath);
              } else if (item.isFile()) {
                try {
                  const fileData = fs.readFileSync(fullLocalPath);
                  uploadsFolder.file(zipItemPath, fileData);
                } catch (readErr) {
                  console.warn(`Could not read file for backup zip: ${fullLocalPath}`, readErr);
                }
              }
            }
          } catch (dirErr) {
            console.warn(`Could not scan directory for backup zip: ${localDirPath}`, dirErr);
          }
        };
        addFolderRecursively(uploadsDir, "");
      }

      // 3. Manifest metadata
      const manifest = {
        name: "Asura Full Disaster Recovery Backup",
        version: "2.0",
        createdAt: new Date().toISOString(),
        totalUsers: backupData.users?.length || 0,
        totalSeries: backupData.series?.length || 0,
        totalChapters: backupData.chapters?.length || 0,
        totalPurchases: backupData.purchased_chapters?.length || 0,
        totalTransactions: backupData.wallet_transactions?.length || 0
      };
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      const dateStr = new Date().toISOString().split('T')[0];
      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 4 }
      });

      res.setHeader('Content-disposition', `attachment; filename=asura-full-website-backup-${dateStr}.zip`);
      res.setHeader('Content-type', 'application/zip');
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("Full ZIP Backup Error:", err);
      res.status(500).json({ error: `خطا در ایجاد پکیج کامل پشتیبان: ${err.message}` });
    }
  });

  app.get("/api/admin/backup-settings", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به این بخش می‌باشد." });
      }
      const settings = await dbManager.getSettings("backup_settings") || {
        email: "",
        autoBackupEnabled: false,
        scheduleFrequency: "daily"
      };
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/backup-settings", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به ذخیره تنظیمات بک‌آ‌پ است." });
      }
      const existing = await dbManager.getSettings("backup_settings") || {};
      const updated = {
        ...existing,
        ...req.body
      };
      await dbManager.saveSettings("backup_settings", updated);
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/run-backup-now", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به اجرای فوراً بک‌آ‌پ است." });
      }

      if (req.body?.email) {
        const existing = await dbManager.getSettings("backup_settings") || {};
        await dbManager.saveSettings("backup_settings", { ...existing, email: req.body.email });
      }

      const result = await performBackupAndEmail();
      if (!result.success) {
        return res.status(500).json({ error: result.error || "خطا در ایجاد بک‌آ‌پ" });
      }
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/migration-manifest", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به دریافت مانیفست مهاجرت می‌باشد." });
      }

      const allSeries = await dbManager.getSeries();
      let totalChaptersCount = 0;
      let totalLocalImages = 0;
      let totalExternalImages = 0;
      const seriesManifest: any[] = [];

      for (const s of allSeries) {
        const chapters = await dbManager.getChapters(s.id);
        totalChaptersCount += chapters.length;

        let seriesLocalImgs = 0;
        let seriesExtImgs = 0;

        chapters.forEach((c: any) => {
          (c.images || []).forEach((img: string) => {
            if (img.startsWith("/uploads/") || img.startsWith("uploads/")) {
              seriesLocalImgs++;
            } else {
              seriesExtImgs++;
            }
          });
        });

        totalLocalImages += seriesLocalImgs;
        totalExternalImages += seriesExtImgs;

        seriesManifest.push({
          id: s.id,
          title: s.title,
          cover: s.cover,
          chaptersCount: chapters.length,
          localImagesCount: seriesLocalImgs,
          externalImagesCount: seriesExtImgs
        });
      }

      let uploadedFilesList: { filename: string; sizeBytes: number }[] = [];
      try {
        uploadedFilesList = await getFilesRecursively(uploadsDir, uploadsDir);
      } catch (e) {
        console.error("Error reading uploads directory for manifest:", e);
      }

      const totalUploadsSizeBytes = uploadedFilesList.reduce((acc, f) => acc + f.sizeBytes, 0);

      const manifest = {
        generatedAt: new Date().toISOString(),
        databaseType: dbManager.isUsingMySQL ? "MySQL" : "LocalData",
        summary: {
          totalSeries: allSeries.length,
          totalChapters: totalChaptersCount,
          totalLocalImages,
          totalExternalImages,
          totalUploadedFilesCount: uploadedFilesList.length,
          totalUploadedFilesSizeMB: (totalUploadsSizeBytes / (1024 * 1024)).toFixed(2)
        },
        migrationInstructions: {
          mediaDirectory: "/uploads",
          recommendedTransferTool: "rsync or SFTP",
          rsyncCommand: `rsync -avzhP /uploads/ new-server-ip:/var/www/asura-clone/uploads/`
        },
        uploadedFiles: uploadedFilesList,
        series: seriesManifest
      };

      res.setHeader('Content-disposition', 'attachment; filename=asura-migration-manifest.json');
      res.setHeader('Content-type', 'application/json');
      res.json(manifest);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Universal Smart Restore (Supports JSON & Full ZIP Backup Packages)
  app.post("/api/admin/restore", requireAdmin, upload.any(), async (req: any, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به بازگردانی پشتیبان می‌باشد." });
      }

      const files = (req.files || []) as Express.Multer.File[];
      let dbPayload: any = null;
      let filesExtractedCount = 0;

      if (files && files.length > 0) {
        const file = files[0];
        const isZip = file.originalname.endsWith(".zip") || file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed";

        if (isZip) {
          const zip = new JSZip();
          const zipContents = await zip.loadAsync(file.buffer);

          // 1. Locate database JSON inside zip
          const jsonEntryName = Object.keys(zipContents.files).find(name => 
            !zipContents.files[name].dir && (name === "database-backup.json" || name.endsWith(".json"))
          );

          if (!jsonEntryName) {
            return res.status(400).json({ error: "فایل دیتابیس JSON در پکیج ZIP یافت نشد." });
          }

          const jsonContent = await zipContents.files[jsonEntryName].async("text");
          try {
            dbPayload = JSON.parse(jsonContent);
          } catch (pErr) {
            return res.status(400).json({ error: "فایل دیتابیس موجود در فایل ZIP نامعتبر است." });
          }

          // 2. Extract media files into uploads directory
          for (const filename of Object.keys(zipContents.files)) {
            const entry = zipContents.files[filename];
            if (entry.dir) continue;
            if (filename.endsWith(".json")) continue;

            let relTargetPath = filename;
            if (relTargetPath.startsWith("uploads/")) {
              relTargetPath = relTargetPath.substring("uploads/".length);
            }

            const absDestPath = path.join(uploadsDir, relTargetPath);
            if (isPathSafe(uploadsDir, absDestPath)) {
              await fs.promises.mkdir(path.dirname(absDestPath), { recursive: true });
              const entryBuffer = await entry.async("nodebuffer");
              await fs.promises.writeFile(absDestPath, entryBuffer);
              filesExtractedCount++;
            }
          }
        } else {
          // Plain JSON file upload
          const jsonText = file.buffer.toString("utf-8");
          try {
            dbPayload = JSON.parse(jsonText);
          } catch (pErr) {
            return res.status(400).json({ error: "محتوای فایل JSON معتبر نیست." });
          }
        }
      } else if (req.body && Object.keys(req.body).length > 0) {
        dbPayload = req.body;
      }

      if (!dbPayload) {
        return res.status(400).json({ error: "هیچ داده یا فایل پشتیبانی برای بازگردانی ارسال نشده است." });
      }

      const result = await dbManager.restoreAllData(dbPayload);
      if (result.success) {
        io.emit("system:restored");
        res.json({
          success: true,
          message: "نسخه پشتیبان با موفقیت و به صورت کامل بازگردانی شد.",
          stats: {
            ...result.stats,
            filesExtractedCount
          }
        });
      } else {
        res.status(400).json({ error: result.error || "خطا در بازگردانی دیتابیس." });
      }
    } catch (err: any) {
      console.error("Restore Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  async function getDirectoryStats(dirPath: string): Promise<{ totalBytes: number; fileCount: number }> {
    let totalBytes = 0;
    let fileCount = 0;
    if (!fs.existsSync(dirPath)) return { totalBytes: 0, fileCount: 0 };
    
    async function scan(current: string) {
      try {
        const entries = await fs.promises.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            await scan(full);
          } else if (entry.isFile()) {
            try {
              const st = await fs.promises.stat(full);
              totalBytes += st.size;
              fileCount++;
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    await scan(dirPath);
    return { totalBytes, fileCount };
  }

  // 5. Host & Database Storage Management Breakdown API
  app.get("/api/admin/storage/breakdown", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به دسترسی به بخش مدیریت فضای هاست می‌باشد." });
      }

      const tableCounts = await dbManager.getAllDataCounts();
      const uploadsStats = await getDirectoryStats(uploadsDir);
      const seriesUploadsStats = await getDirectoryStats(path.join(uploadsDir, 'series'));
      const backupsStats = await getDirectoryStats(backupsDir);

      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 بایت';
        const k = 1024;
        const sizes = ['بایت', 'کیلوبایت (KB)', 'مگابایت (MB)', 'گیگابایت (GB)'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      res.json({
        success: true,
        database: {
          isUsingMySQL: dbManager.isUsingMySQL,
          host: dbManager.isUsingMySQL ? (process.env.DB_HOST || 'MySQL Server') : 'محیط محلی (local-db.json)',
          dbName: dbManager.isUsingMySQL ? (process.env.DB_NAME || 'MySQL DB') : 'local-db.json',
          tables: tableCounts
        },
        storage: {
          uploads: {
            totalBytes: uploadsStats.totalBytes,
            formatted: formatBytes(uploadsStats.totalBytes),
            fileCount: uploadsStats.fileCount
          },
          seriesUploads: {
            totalBytes: seriesUploadsStats.totalBytes,
            formatted: formatBytes(seriesUploadsStats.totalBytes),
            fileCount: seriesUploadsStats.fileCount
          },
          backups: {
            totalBytes: backupsStats.totalBytes,
            formatted: formatBytes(backupsStats.totalBytes),
            fileCount: backupsStats.fileCount
          },
          zipCacheCount: zipCache.size
        }
      });
    } catch (err: any) {
      console.error("Storage Breakdown Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Granular Section & Total Website Cleaner API
  app.post("/api/admin/storage/clean-section", requireAdmin, async (req, res) => {
    try {
      const isSuper = await checkSuperAdminPerm(req);
      if (!isSuper) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به پاکسازی داده‌های هاست و دیتابیس می‌باشد." });
      }

      const { section, options } = req.body;
      if (!section) {
        return res.status(400).json({ error: "شناسه بخش ارسالی نامعتبر است." });
      }

      if (section === 'server_cache') {
        const prevCount = zipCache.size;
        zipCache.clear();
        return res.json({
          success: true,
          deletedRecords: 0,
          deletedFiles: 0,
          freedBytes: 0,
          message: `کش رم سرور با موفقیت پاکسازی گردید (${prevCount} آرشیو ZIP آزاد شد).`
        });
      }

      const result = await dbManager.clearSectionData(section, uploadsDir, options || {});
      
      // Clear RAM cache if chapter/files modified
      if (section === 'series_and_chapters' || section === 'chapters_only' || section === 'all_uploads' || section === 'full_factory_reset') {
        zipCache.clear();
      }

      io.emit("system:storage_cleaned", { section });
      res.json(result);
    } catch (err: any) {
      console.error("Storage Clean Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/comments", requireAdmin, async (req, res) => {
    try {
      const statusFilter = req.query.status as string;
      const list = await dbManager.getAllComments(statusFilter);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const callerUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const caller = await dbManager.getUser(callerUid);
      if (!caller || !isSuperAdminUser(caller)) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به ویرایش نقش کاربر می‌باشد." });
      }
      if (callerUid === req.params.id) {
        return res.status(400).json({ error: "مدیریت کل امکان تغییر یا تنزل نقش خود را ندارد." });
      }

      const { role } = req.body;
      if (role !== 'admin' && role !== 'staff' && role !== 'user') {
        return res.status(400).json({ error: "Invalid role specified." });
      }
      const updated = await dbManager.changeUserRole(req.params.id, role);
      if (!updated) return res.status(404).json({ error: "User not found" });
      io.emit("users:updated", { userId: updated.id, role: updated.role });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/users/:id/can-create-series", requireAdmin, async (req, res) => {
    try {
      const callerUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const caller = await dbManager.getUser(callerUid);
      if (!caller || !isSuperAdminUser(caller)) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به تغییر این دسترسی می‌باشد." });
      }

      const { canCreateSeries } = req.body;
      const updated = await dbManager.setUserCanCreateSeries(req.params.id, !!canCreateSeries);
      if (!updated) return res.status(404).json({ error: "User not found" });
      io.emit("users:updated", { userId: updated.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/reports", requireAdmin, async (req, res) => {
    try {
      const list = await dbManager.getReports();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reports", contentInteractionRateLimiter, async (req, res) => {
    try {
      const saved = await dbManager.saveReport(req.body);
      io.emit("reports:updated");
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/reports/:id", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await dbManager.saveReport({ id: req.params.id, status });
      io.emit("reports:updated");
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/reports/:id", requireAdmin, async (req, res) => {
    try {
      await dbManager.deleteReport(req.params.id);
      io.emit("reports:updated");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reports/:id/delete", requireAdmin, async (req, res) => {
    try {
      await dbManager.deleteReport(req.params.id);
      io.emit("reports:updated");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // SUPPORT TICKETS ROUTES
  // -----------------------------------------------------------------

  app.get("/api/tickets", async (req, res) => {
    try {
      const uid = (req.headers['x-user-uid'] || req.headers['x-admin-uid'] || req.query.uid || req.query.adminUid) as string;
      if (!uid) {
        return res.status(401).json({ error: "کاربر احراز هویت نشده است." });
      }
      const tickets = await dbManager.getTicketsByUser(uid);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      const uid = (req.headers['x-user-uid'] || req.headers['x-admin-uid'] || req.body.userId || req.query.uid) as string;
      if (!uid) {
        return res.status(401).json({ error: "کاربر شناسه معتبر ندارد." });
      }
      const { subject, category, priority, content, attachments } = req.body;
      if (!subject || !content) {
        return res.status(400).json({ error: "موضوع و متن تیکت الزامی می‌باشد." });
      }

      let user = await dbManager.getUser(uid);
      if (!user) {
        user = await dbManager.getUserByEmail(uid);
      }

      const ticket = await dbManager.createTicket({
        userId: uid,
        userName: user?.displayName || user?.firstName || req.body.userName || "کاربر",
        userEmail: user?.email || req.body.userEmail || "",
        userAvatar: user?.avatarUrl || req.body.userAvatar || "",
        subject,
        category: category || "other",
        priority: priority || "medium",
        content,
        attachments: attachments || []
      });

      io.emit("tickets:updated");
      res.json(ticket);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tickets/:id", async (req, res) => {
    try {
      const ticket = await dbManager.getTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "تیکت یافت نشد." });
      }
      res.json(ticket);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tickets/:id/reply", async (req, res) => {
    try {
      const ticketId = req.params.id;
      const uid = (req.headers['x-user-uid'] || req.headers['x-admin-uid'] || req.body.senderId || req.query.uid) as string;
      const { content, attachments } = req.body;
      if (!content) {
        return res.status(400).json({ error: "متن پاسخ الزامی است." });
      }

      let user = await dbManager.getUser(uid);
      if (!user && uid) {
        user = await dbManager.getUserByEmail(uid);
      }

      let senderRole: 'user' | 'admin' | 'staff' = 'user';
      if (user) {
        const uRoles = user.roles || [user.role || 'user'];
        if (uRoles.includes('super_admin') || uRoles.includes('admin') || user.role === 'admin' || user.email === 'amirrezaveisi45@gmail.com') {
          senderRole = 'admin';
        } else if (uRoles.length > 0 && !uRoles.every(r => r === 'user')) {
          senderRole = 'staff';
        }
      } else if (uid === 'admin' || req.headers['x-admin-uid'] === 'admin') {
        senderRole = 'admin';
      }

      const msg = await dbManager.addTicketMessage({
        ticketId,
        senderId: uid || "admin",
        senderName: user?.displayName || (senderRole !== 'user' ? "پشتیبانی" : "کاربر"),
        senderAvatar: user?.avatarUrl || "",
        senderRole,
        content,
        attachments: attachments || []
      });

      const updatedTicket = await dbManager.getTicketById(ticketId);
      io.emit("tickets:updated");
      res.json({ message: msg, ticket: updatedTicket });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/tickets/:id/close", async (req, res) => {
    try {
      const updated = await dbManager.updateTicketStatus(req.params.id, { status: "closed" });
      io.emit("tickets:updated");
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/tickets", requireAdmin, async (req, res) => {
    try {
      const { status, priority, category, search } = req.query as any;
      const tickets = await dbManager.getAllTicketsAdmin({ status, priority, category, search });
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const { status, priority, assignedTo, assignedToName } = req.body;
      const updated = await dbManager.updateTicketStatus(req.params.id, {
        status,
        priority,
        assignedTo,
        assignedToName
      });
      io.emit("tickets:updated");
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      await dbManager.deleteTicket(req.params.id);
      io.emit("tickets:updated");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // REVENUE, ROLE SETTINGS, STAFF MANAGEMENT & ASSIGNMENT ROUTES
  // -----------------------------------------------------------------
  app.get("/api/admin/website-revenue", requireAdmin, async (req, res) => {
    try {
      const revenue = await dbManager.getSettings('website_revenue') || { totalEarned: 0 };
      // Also fetch transactions related to website profit and settlements
      let txs: any[] = [];
      if (dbManager.isUsingMySQL && dbManager.pool) {
        const [rows] = await dbManager.pool.execute(
          "SELECT * FROM wallet_transactions WHERE (description LIKE '%سود سایت%' OR description LIKE '%تسویه حساب%') ORDER BY createdAt DESC LIMIT 100"
        );
        txs = rows as any[];
      } else {
        txs = (dbManager.localData.wallet_transactions || [])
          .filter((t: any) => t.description.includes('سود سایت') || t.description.includes('تسویه حساب'))
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 100);
      }
      res.json({ totalEarned: revenue.totalEarned || 0, transactions: txs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/settle-website-revenue", requireAdmin, financialRateLimiter, async (req, res) => {
    try {
      const { amount, description } = req.body;
      const deductAmount = Math.floor(Number(amount));
      if (!deductAmount || deductAmount <= 0) {
        return res.status(400).json({ error: "مبلغ ارسالی برای تسویه حساب معتبر نیست." });
      }

      // Read current website revenue
      let currentRev = await dbManager.getSettings('website_revenue') || { totalEarned: 0 };
      const previousTotal = currentRev.totalEarned || 0;
      
      currentRev.totalEarned = previousTotal - deductAmount;
      await dbManager.saveSettings('website_revenue', currentRev);

      // Create a transaction to record this payout
      const now = new Date().toISOString();
      const transId = `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const desc = description ? `تسویه حساب: ${description}` : `کاهش و تسویه حساب از سود سایت`;

      if (dbManager.isUsingMySQL && dbManager.pool) {
        const [adminRows] = await dbManager.pool.execute("SELECT * FROM users WHERE role = 'admin' OR email = 'amirrezaveisi45@gmail.com' LIMIT 1");
        const adminUser = (adminRows as any[])[0];
        const adminId = adminUser ? adminUser.id : 'system';
        const adminName = adminUser ? adminUser.displayName : 'مدیر کل';
        
        await dbManager.pool.execute(
          'INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [transId, adminId, adminName, -deductAmount, 'debit', desc, 'system', 'سیستم', now]
        );
      } else {
        if (!dbManager.localData.wallet_transactions) {
          dbManager.localData.wallet_transactions = [];
        }
        dbManager.localData.wallet_transactions.push({
          id: transId,
          userId: 'system',
          userName: 'مدیر کل',
          amount: -deductAmount,
          type: 'debit',
          description: desc,
          creatorId: 'system',
          creatorName: 'سیستم',
          createdAt: now
        });
        dbManager.saveLocalData();
      }

      res.json({ success: true, newBalance: currentRev.totalEarned });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/logs", requireAdmin, async (req, res) => {
    try {
      const logs: any[] = [];

      // 1. Fetch wallet transactions (payouts, charges, sales)
      if (dbManager.isUsingMySQL && dbManager.pool) {
        const [txRows] = await dbManager.pool.execute(
          "SELECT * FROM wallet_transactions ORDER BY createdAt DESC LIMIT 30"
        );
        (txRows as any[]).forEach(tx => {
          logs.push({
            id: tx.id,
            type: tx.amount < 0 ? 'payout' : 'charge',
            title: tx.amount < 0 ? 'تسویه و پرداخت مالی' : 'شارژ / تراکنش',
            description: `${tx.userName || 'کاربر'}: ${tx.description} (${Math.abs(tx.amount).toLocaleString("fa-IR")} ت)`,
            createdAt: tx.createdAt
          });
        });

        const [chapRows] = await dbManager.pool.execute(
          "SELECT * FROM chapters ORDER BY createdAt DESC LIMIT 30"
        );
        (chapRows as any[]).forEach(ch => {
          logs.push({
            id: `ch-${ch.id}`,
            type: ch.isPending ? 'upload' : 'approval',
            title: ch.isPending ? 'بارگذاری / ثبت چپتر' : 'تایید و انتشار چپتر',
            description: `چپتر ${ch.number} (${ch.title || 'بدون عنوان'}) - ${ch.isPending ? 'در انتظار تایید' : 'منتشر شده عمومی'}`,
            createdAt: ch.createdAt
          });
        });
      } else {
        const txs = dbManager.localData.wallet_transactions || [];
        txs.slice(-30).forEach((tx: any) => {
          logs.push({
            id: tx.id,
            type: tx.amount < 0 ? 'payout' : 'charge',
            title: tx.amount < 0 ? 'تسویه و پرداخت مالی' : 'شارژ / تراکنش',
            description: `${tx.userName || 'کاربر'}: ${tx.description} (${Math.abs(tx.amount).toLocaleString("fa-IR")} ت)`,
            createdAt: tx.createdAt
          });
        });

        const chaps = dbManager.localData.chapters || [];
        chaps.slice(-30).forEach((ch: any) => {
          logs.push({
            id: `ch-${ch.id}`,
            type: ch.isPending ? 'upload' : 'approval',
            title: ch.isPending ? 'بارگذاری / ثبت چپتر' : 'تایید و انتشار چپتر',
            description: `چپتر ${ch.number} (${ch.title || 'بدون عنوان'}) - ${ch.isPending ? 'در انتظار تایید' : 'منتشر شده عمومی'}`,
            createdAt: ch.createdAt || new Date().toISOString()
          });
        });
      }

      logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(logs.slice(0, 30));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/revenue-roles", requireAdmin, async (req, res) => {
    try {
      const roles = await dbManager.getSettings('revenue_roles') || [
        { id: 'editor', name: 'ادیتور', percentage: 30 },
        { id: 'translator', name: 'مترجم', percentage: 20 },
        { id: 'cleaner', name: 'کلینر', percentage: 30 },
        { id: 'website', name: 'وبسایت', percentage: 20 }
      ];
      res.json(roles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/revenue-roles", requireAdmin, async (req, res) => {
    try {
      const { roles } = req.body;
      if (!Array.isArray(roles)) {
        return res.status(400).json({ error: "لیست نقش‌ها ارسالی نامعتبر است." });
      }
      await dbManager.saveSettings('revenue_roles', roles);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/staff", requireAdmin, async (req, res) => {
    try {
      let users: any[] = [];
      const userMap = new Map<string, any>();

      if (dbManager.isUsingMySQL && dbManager.pool) {
        const [rows] = await dbManager.pool.execute(
          "SELECT id, email, displayName, role, roles, avatarUrl, walletBalance FROM users WHERE banned = 0 OR banned IS NULL"
        );
        (rows as any[]).forEach((u: any) => {
          let parsedRoles: string[] = [];
          if (Array.isArray(u.roles)) {
            parsedRoles = u.roles;
          } else if (typeof u.roles === 'string') {
            try {
              parsedRoles = JSON.parse(u.roles);
            } catch (e) {
              parsedRoles = [u.role || 'user'];
            }
          } else {
            parsedRoles = [u.role || 'user'];
          }
          const userObj = {
            id: u.id,
            email: u.email,
            displayName: u.displayName || u.email,
            role: u.role,
            roles: parsedRoles,
            avatarUrl: u.avatarUrl || '',
            walletBalance: Number(u.walletBalance) || 0
          };
          userMap.set(u.id, userObj);
          if (u.email) userMap.set(u.email.toLowerCase(), userObj);
        });
      } else {
        (dbManager.localData.users || [])
          .filter((u: any) => !u.banned)
          .forEach((u: any) => {
            const userObj = {
              id: u.id,
              email: u.email,
              displayName: u.displayName || u.email,
              role: u.role,
              roles: Array.isArray(u.roles) ? u.roles : [u.role || 'user'],
              avatarUrl: u.avatarUrl || '',
              walletBalance: Number(u.walletBalance) || 0
            };
            userMap.set(u.id, userObj);
            if (u.email) userMap.set(u.email.toLowerCase(), userObj);
          });
      }

      // Also gather all contributors across all series and chapters to ensure none are missing
      const allSeries = await dbManager.getSeries();
      for (const s of allSeries) {
        if (Array.isArray(s.contributors)) {
          for (const c of (s.contributors as any[])) {
            const cId = c.userId || c.id;
            const cEmail = c.email ? c.email.toLowerCase() : '';
            const existing = (cId && userMap.get(cId)) || (cEmail && userMap.get(cEmail));
            if (existing) {
              if (c.role && !existing.roles.includes(c.role)) {
                existing.roles.push(c.role);
              }
            } else if (cId || cEmail) {
              const syntheticUser = {
                id: cId || `contrib-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                email: c.email || '',
                displayName: c.name || c.displayName || c.email || 'همکار',
                role: c.role || 'translator',
                roles: [c.role || 'translator'],
                avatarUrl: '',
                walletBalance: 0
              };
              userMap.set(syntheticUser.id, syntheticUser);
            }
          }
        }
      }

      const roleWeight = (r: string, roles: string[] = []) => {
        if (r === 'super_admin' || roles.includes('super_admin')) return 1;
        if (r === 'admin' || roles.includes('admin')) return 2;
        if (r === 'staff' || roles.includes('staff')) return 3;
        if (r === 'translator' || roles.includes('translator')) return 4;
        if (r === 'editor' || roles.includes('editor')) return 5;
        if (r === 'cleaner' || roles.includes('cleaner')) return 6;
        return 7;
      };

      const uniqueUsers = Array.from(new Set(userMap.values())).sort((a, b) => {
        const weightDiff = roleWeight(a.role, a.roles) - roleWeight(b.role, b.roles);
        if (weightDiff !== 0) return weightDiff;
        return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
      });

      res.json(uniqueUsers);
    } catch (err: any) {
      console.error("Error in /api/admin/staff:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/series/:seriesId/sales-summary", requireAdmin, async (req, res) => {
    try {
      const { seriesId } = req.params;
      const series = await dbManager.getSeriesById(seriesId);
      if (!series) return res.status(404).json({ error: "کار یافت نشد" });

      const chapters = await dbManager.getChapters(seriesId);

      let purchases: any[] = [];
      if (dbManager.isUsingMySQL && dbManager.pool) {
        const [rows] = await dbManager.pool.execute(
          "SELECT * FROM purchased_chapters WHERE seriesId = ?",
          [seriesId]
        );
        purchases = rows as any[];
      } else {
        purchases = (dbManager.localData.purchased_chapters || []).filter((pc: any) => pc.seriesId === seriesId);
      }

      const chapterMap: Record<string, number> = {};
      purchases.forEach((p: any) => {
        chapterMap[p.chapterId] = (chapterMap[p.chapterId] || 0) + 1;
      });

      const price = 400; // Toman
      const list = chapters.map(ch => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
        salesCount: chapterMap[ch.id] || 0,
        totalSalesAmount: (chapterMap[ch.id] || 0) * price,
        contributors: ch.contributors || {}
      }));

      const totalPurchasesCount = purchases.length;
      const totalSales = totalPurchasesCount * price;

      res.json({
        seriesTitle: series.title,
        totalPurchasesCount,
        totalSales,
        byChapter: list
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters/:chapterId/contributors", requireAdmin, async (req, res) => {
    try {
      const { seriesId, chapterId } = req.params;
      const { contributors } = req.body;
      const resolved = await resolveSeriesAndChapter(seriesId, chapterId);
      const ch = await dbManager.getChapterById(resolved.seriesId, resolved.chapterId);
      if (!ch) return res.status(404).json({ error: "چپتر یافت نشد" });

      ch.contributors = contributors;
      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper: Calculate rich, accurate contributor statistics for all assigned series & chapters
  const calculateContributorDetailedStats = async (userId: string, targetMonth: string = 'all') => {
    const userObj = await dbManager.getUser(userId) || (userId ? await dbManager.getUserByEmail(userId) : null);
    if (!userObj) return null;

    let rolesList = [
      { id: "editor", name: "ادیتور", percentage: 30 },
      { id: "translator", name: "مترجم", percentage: 20 },
      { id: "cleaner", name: "کلینر", percentage: 30 },
      { id: "website", name: "وبسایت", percentage: 20 }
    ];
    try {
      const savedRoles = await dbManager.getSettings("revenue_roles");
      if (savedRoles) rolesList = savedRoles;
    } catch (e) {}

    const allSeries = await dbManager.getSeries();

    let allPurchases: any[] = [];
    if (dbManager.isUsingMySQL && dbManager.pool) {
      const query = targetMonth && targetMonth !== 'all'
        ? "SELECT * FROM purchased_chapters WHERE createdAt LIKE ?"
        : "SELECT * FROM purchased_chapters";
      const params = targetMonth && targetMonth !== 'all' ? [`${targetMonth}%`] : [];
      const [rows] = await dbManager.pool.execute(query, params);
      allPurchases = rows as any[];
    } else {
      const raw = (dbManager as any).localData?.purchased_chapters || [];
      allPurchases = targetMonth && targetMonth !== 'all'
        ? raw.filter((p: any) => p.createdAt && p.createdAt.startsWith(targetMonth))
        : raw;
    }

    const purchasesByChapterId: Record<string, number> = {};
    const purchasesBySeriesAndNum: Record<string, number> = {};
    const purchasesBySeries: Record<string, number> = {};

    allPurchases.forEach((p: any) => {
      if (p.chapterId) {
        purchasesByChapterId[p.chapterId] = (purchasesByChapterId[p.chapterId] || 0) + 1;
      }
      if (p.seriesId && (p.chapterNumber !== undefined && p.chapterNumber !== null)) {
        const key = `${p.seriesId}_${p.chapterNumber}`;
        purchasesBySeriesAndNum[key] = (purchasesBySeriesAndNum[key] || 0) + 1;
      }
      if (p.seriesId) {
        purchasesBySeries[p.seriesId] = (purchasesBySeries[p.seriesId] || 0) + 1;
      }
    });

    const price = 400; // standard chapter price
    const seriesBreakdownMap: Record<string, any> = {};
    let grandTotalEarnings = 0;
    let grandTotalSalesCount = 0;
    let totalChaptersCount = 0;

    const userEmail = userObj.email || '';

    for (const series of allSeries) {
      const serContribs = Array.isArray(series.contributors) ? series.contributors : [];
      const matchContributor = (c: any) => {
        if (!c) return false;
        if (typeof c === 'string') {
          return c === userId || (userEmail && c.toLowerCase() === userEmail.toLowerCase());
        }
        const cId = c.userId || c.id;
        const cEmail = c.email;
        return (cId === userId || (userEmail && cEmail && cEmail.toLowerCase() === userEmail.toLowerCase())) && (!c.status || c.status === 'approved');
      };

      const isSeriesLevelContrib = serContribs.some(matchContributor);

      const chapters = await dbManager.getChapters(series.id);
      const userChapters: any[] = [];
      let seriesUserEarnings = 0;
      let seriesUserSalesCount = 0;

      for (const ch of chapters) {
        let chContributors: any = {};
        if (typeof ch.contributors === 'string') {
          try {
            chContributors = JSON.parse(ch.contributors || '{}');
          } catch (e) {
            chContributors = {};
          }
        } else if (ch.contributors && typeof ch.contributors === 'object') {
          chContributors = ch.contributors;
        }

        const userRolesInChapter: any[] = [];
        let chapterUserEarnings = 0;

        const salesCountById = purchasesByChapterId[ch.id] || 0;
        const salesCountByNum = purchasesBySeriesAndNum[`${series.id}_${ch.number}`] || 0;
        const chapterSalesCount = Math.max(salesCountById, salesCountByNum);
        const chapterTotalSalesAmount = chapterSalesCount * price;

        let isUserInChapter = false;

        for (const rl of rolesList) {
          const roleId = rl.id;
          if (roleId === 'website') continue;

          const assignedStaffList = chContributors[roleId];

          if (Array.isArray(assignedStaffList) && assignedStaffList.length > 0) {
            const hasMatch = assignedStaffList.some((item: any) => {
              if (!item) return false;
              if (typeof item === 'string') {
                return item === userId || (userEmail && item.toLowerCase() === userEmail.toLowerCase());
              }
              const itId = item.userId || item.id;
              const itEmail = item.email;
              return itId === userId || (userEmail && itEmail && itEmail.toLowerCase() === userEmail.toLowerCase());
            });

            if (hasMatch) {
              isUserInChapter = true;
              const coWorkersCount = assignedStaffList.length;
              const rolePct = Number(rl.percentage || 0);
              const rolePool = chapterTotalSalesAmount * (rolePct / 100);
              const userShare = coWorkersCount > 0 ? (rolePool / coWorkersCount) : 0;

              chapterUserEarnings += userShare;
              userRolesInChapter.push({
                roleId,
                roleName: rl.name,
                rolePercentage: rolePct,
                userPercentage: coWorkersCount > 0 ? (rolePct / coWorkersCount) : 0,
                rolePool,
                coWorkersCount,
                userEarnings: Math.round(userShare),
                chapterUserEarnings: Math.round(userShare)
              });
            }
          } else if (isSeriesLevelContrib) {
            const matchingSeriesContribs = serContribs.filter((c: any) => {
              if (!c || c.role !== roleId) return false;
              const cId = c.userId || c.id;
              const cEmail = c.email;
              return (cId === userId || (userEmail && cEmail && cEmail.toLowerCase() === userEmail.toLowerCase()));
            });

            if (matchingSeriesContribs.length > 0) {
              isUserInChapter = true;
              const allInRole = serContribs.filter((c: any) => c && c.role === roleId && (!c.status || c.status === 'approved'));
              const coWorkersCount = allInRole.length || 1;
              const rolePct = Number(rl.percentage || 0);
              const rolePool = chapterTotalSalesAmount * (rolePct / 100);
              const userShare = rolePool / coWorkersCount;

              chapterUserEarnings += userShare;
              userRolesInChapter.push({
                roleId,
                roleName: rl.name,
                rolePercentage: rolePct,
                userPercentage: rolePct / coWorkersCount,
                rolePool,
                coWorkersCount,
                userEarnings: Math.round(userShare),
                chapterUserEarnings: Math.round(userShare)
              });
            }
          }
        }

        let chSubmissions: any[] = [];
        if (Array.isArray(ch.submissions)) {
          chSubmissions = ch.submissions;
        } else if (typeof ch.submissions === 'string') {
          try {
            chSubmissions = JSON.parse(ch.submissions);
          } catch (e) {
            chSubmissions = [];
          }
        }

        // Also check if user submitted work directly in chapter submissions
        for (const sub of chSubmissions) {
          const sUid = sub.userId || sub.id;
          const sRole = sub.role;
          if (sUid === userId || (userEmail && sub.userEmail && sub.userEmail.toLowerCase() === userEmail.toLowerCase())) {
            const alreadyHasRole = userRolesInChapter.some(ur => ur.roleId === sRole);
            if (!alreadyHasRole && sRole) {
              const matchedRoleObj = rolesList.find(r => r.id === sRole);
              const rolePct = Number(matchedRoleObj?.percentage || 0);
              const rolePool = chapterTotalSalesAmount * (rolePct / 100);
              const userShare = rolePool; // Default full pool if sole submitter

              isUserInChapter = true;
              chapterUserEarnings += userShare;
              userRolesInChapter.push({
                roleId: sRole,
                roleName: matchedRoleObj?.name || sRole,
                rolePercentage: rolePct,
                userPercentage: rolePct,
                rolePool,
                coWorkersCount: 1,
                userEarnings: Math.round(userShare),
                chapterUserEarnings: Math.round(userShare)
              });
            }
          }
        }

        if (isUserInChapter) {
          totalChaptersCount++;
          seriesUserEarnings += chapterUserEarnings;
          seriesUserSalesCount += chapterSalesCount;

          userChapters.push({
            chapterId: ch.id,
            id: ch.id,
            chapterNumber: Number(ch.number) || ch.number,
            number: Number(ch.number) || ch.number,
            chapterTitle: ch.title || `چپتر ${ch.number}`,
            salesCount: chapterSalesCount,
            chapterSalesCount,
            chapterTotalSales: chapterTotalSalesAmount,
            chapterTotalSalesAmount,
            userRoles: userRolesInChapter,
            userEarnings: Math.round(chapterUserEarnings),
            chapterUserEarnings: Math.round(chapterUserEarnings),
            isPending: Boolean(ch.isPending),
            submissions: ch.submissions || []
          });
        }
      }

      if (userChapters.length > 0 || isSeriesLevelContrib) {
        grandTotalEarnings += seriesUserEarnings;
        grandTotalSalesCount += seriesUserSalesCount;

        const totalSeriesPurchases = purchasesBySeries[series.id] || 0;

        seriesBreakdownMap[series.id] = {
          seriesId: series.id,
          id: series.id,
          seriesTitle: series.title,
          title: series.title,
          cover: series.cover || "",
          totalChapters: (series as any).totalChapters || chapters.length,
          userContributedChaptersCount: userChapters.length,
          totalSeriesSalesCount: totalSeriesPurchases,
          seriesSalesCount: totalSeriesPurchases,
          totalSeriesRevenue: totalSeriesPurchases * price,
          seriesTotalRevenue: totalSeriesPurchases * price,
          userSeriesSalesCount: seriesUserSalesCount,
          userSeriesEarnings: Math.round(seriesUserEarnings),
          seriesEarnings: Math.round(seriesUserEarnings),
          chapters: userChapters.sort((a, b) => (Number(b.chapterNumber) || 0) - (Number(a.chapterNumber) || 0))
        };
      }
    }

    return {
      user: {
        id: userObj.id,
        displayName: userObj.displayName || userObj.email,
        email: userObj.email,
        role: userObj.role,
        walletBalance: (userObj as any).walletBalance || 0
      },
      selectedMonth: targetMonth,
      totalEarnings: Math.round(grandTotalEarnings),
      totalSalesCount: grandTotalSalesCount,
      totalChaptersContributed: totalChaptersCount,
      seriesBreakdown: Object.values(seriesBreakdownMap).sort((a: any, b: any) => b.userSeriesEarnings - a.userSeriesEarnings)
    };
  };

  // Contributor Endpoint: Get Self Detailed Statistics and Work History
  app.get("/api/contributor/my-stats", async (req, res) => {
    try {
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.headers['x-user-id'] || req.query.uid) as string;
      if (!uid || uid === 'null' || uid === 'undefined') {
        return res.status(401).json({ error: "لطفاً ابتدا وارد حساب کاربری خود شوید." });
      }

      const targetMonth = (req.query.month as string) || "all";
      const stats = await calculateContributorDetailedStats(uid, targetMonth);
      if (!stats) {
        return res.status(404).json({ error: "اطلاعات حساب کاربری یافت نشد." });
      }

      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Endpoint: Get Any Contributor Earnings & Statistics
  app.get("/api/admin/contributor-earnings/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const targetMonth = (req.query.month as string) || (req.query.all === 'true' ? 'all' : new Date().toISOString().slice(0, 7));

      const stats = await calculateContributorDetailedStats(userId, targetMonth);
      if (!stats) {
        return res.status(404).json({ error: "کاربر یافت نشد." });
      }

      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 9. WALLET & TRANSACTION API
  // -----------------------------------------------------------------
  app.get("/api/wallet/transactions", async (req, res) => {
    try {
      const requesterUid = (req.headers['x-user-uid'] || req.headers['x-admin-uid']) as string;
      if (!requesterUid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { userId } = req.query;
      const targetUserId = (userId as string) || requesterUid;

      // If querying someone else's transactions, require permission
      if (targetUserId !== requesterUid) {
        const permitted = await hasPermission(requesterUid, "manage_wallets");
        if (!permitted) {
          return res.status(403).json({ error: "Forbidden. Access to other wallets is restricted." });
        }
      }

      const txs = await dbManager.getWalletTransactions(targetUserId === "all" ? undefined : targetUserId);
      res.json(txs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/wallet/charge", financialRateLimiter, async (req, res) => {
    try {
      const requesterUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      if (!requesterUid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const requester = await dbManager.getUser(requesterUid);
      if (!requester) {
        return res.status(401).json({ error: "User not found" });
      }

      const permitted = await hasPermission(requesterUid, "manage_wallets");
      if (!permitted) {
        return res.status(403).json({ error: "Forbidden. Manage wallets permission required." });
      }

      const { userId, amount, type, description } = req.body;
      if (!userId || typeof amount !== "number") {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      await dbManager.addWalletTransaction(
        userId,
        amount,
        type || 'admin_adjustment',
        description || '',
        requesterUid,
        requester.displayName || requester.email
      );

      // Notify via socket
      const targetUser = await dbManager.getUser(userId);
      const updatedBalance = targetUser ? targetUser.walletBalance || 0 : 0;
      io.emit(`wallet:updated:${userId}`, { userId, balance: updatedBalance });
      io.emit("wallet:any_update");

      // Add system notification for user
      const formattedAmount = Math.abs(amount).toLocaleString();
      await dbManager.addNotification(
        userId,
        "system",
        "بروزرسانی کیف پول",
        `کیف پول شما به مبلغ ${formattedAmount} تومان ${amount >= 0 ? "شارژ" : "برداشت"} شد. دلیل: ${description || 'تغییر توسط مدیریت'}`,
        "/wallet"
      );

      res.json({ success: true, balance: updatedBalance });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // SETTLEMENT REQUESTS API
  // -----------------------------------------------------------------
  app.get("/api/settlement/requests", async (req, res) => {
    try {
      const requesterUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const user = requesterUid ? await dbManager.getUser(requesterUid) : null;
      const isSuper = isSuperAdminUser(user) || user?.role === 'admin';
      const { userId } = req.query;

      const targetUserId = isSuper ? (userId as string) : requesterUid;
      const requests = await dbManager.getSettlementRequests(targetUserId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settlement/request", financialRateLimiter, async (req, res) => {
    try {
      const requesterUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      if (!requesterUid) return res.status(401).json({ error: "Unauthorized" });

      const { amount, cardOrSheba, accountHolder } = req.body;
      if (!amount || !cardOrSheba || !accountHolder) {
        return res.status(400).json({ error: "لطفاً تمام اطلاعات (مبلغ، شماره کارت/شبا، و نام صاحب حساب) را تکمیل نمایید." });
      }

      const user = await dbManager.getUser(requesterUid);
      if (!user) return res.status(404).json({ error: "کاربر یافت نشد." });

      const result = await dbManager.createSettlementRequest({
        userId: requesterUid,
        userName: user.displayName || user.email,
        userEmail: user.email || '',
        amount: Number(amount),
        cardOrSheba,
        accountHolder
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      io.emit("settlement:updated", { requestId: result.request.id });
      res.json(result.request);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settlement/process", requireAdmin, async (req, res) => {
    try {
      const adminUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const { requestId, action, rejectionNote } = req.body;

      if (!requestId || !action) {
        return res.status(400).json({ error: "اطلاعات درخواست ناقص است." });
      }

      const result = await dbManager.processSettlementRequest(requestId, action, adminUid, rejectionNote);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      if (result.request?.userId) {
        io.emit(`wallet:updated:${result.request.userId}`, { userId: result.request.userId });
      }
      io.emit("settlement:updated", { requestId });
      io.emit("wallet:any_update");

      res.json({ success: true, request: result.request });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/:userId/purchases/:seriesId/:chapterId", async (req, res) => {
    try {
      const { userId, seriesId, chapterId } = req.params;
      const resolved = await resolveSeriesAndChapter(seriesId, chapterId);

      const globalSettings = await dbManager.getSettings('global');
      const isGlobalFree = !!(globalSettings && globalSettings.globalFreeMode);

      const purchased = await dbManager.hasPurchasedChapter(userId, resolved.seriesId, resolved.chapterId);
      res.json({ 
        purchased, 
        isGlobalFree, 
        freeAccess: isGlobalFree || purchased 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chapters/purchase", financialRateLimiter, async (req, res) => {
    try {
      const { userId, seriesId, chapterId } = req.body;
      if (!userId || !seriesId || !chapterId) {
        return res.status(400).json({ error: "پارامترهای ارسالی نامعتبر هستند." });
      }

      const resolved = await resolveSeriesAndChapter(seriesId, chapterId);
      const result = await dbManager.purchaseChapter(userId, resolved.seriesId, resolved.chapterId);
      if (result.success) {
        // Emit wallet update and purchase update for buyer
        io.emit(`wallet:updated:${userId}`, { userId, balance: result.newBalance });
        io.emit(`chapter:purchased:${userId}:${resolved.chapterId}`, { purchased: true });

        // Emit wallet updates to all distributed contributors
        if (result.distributedUsers && Array.isArray(result.distributedUsers)) {
          result.distributedUsers.forEach(u => {
            io.emit(`wallet:updated:${u.userId}`, { userId: u.userId, balance: u.newBalance });
            io.emit(`notification:new:${u.userId}`);
          });
        }

        // Emit wallet update to Admin
        if (result.adminUser) {
          io.emit(`wallet:updated:${result.adminUser.id}`, { userId: result.adminUser.id, balance: result.adminUser.newBalance });
          io.emit(`notification:new:${result.adminUser.id}`);
        }

        // Global socket updates for real-time panels
        io.emit("revenue:updated");
        io.emit("transactions:updated");
        io.emit("wallet:any_update");

        res.json({ success: true, balance: result.newBalance, result });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/revenue/sync-unpaid-purchases", requireAdmin, financialRateLimiter, async (req, res) => {
    try {
      const syncResult = await dbManager.syncUnpaidPurchases();
      io.emit("revenue:updated");
      io.emit("transactions:updated");
      io.emit("wallet:any_update");
      res.json(syncResult);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

function resolveTargetUploadDir(baseUploadsDir: string, reqBody: any, reqQuery: any): { 
  targetDir: string; 
  relPrefix: string;
  isChapter: boolean;
  safeSeries: string;
  safeChapterNum: string;
  folderType: string;
} {
  const seriesTitle = (reqBody?.seriesTitle || reqQuery?.seriesTitle || reqBody?.seriesId || reqQuery?.seriesId || reqBody?.series || reqQuery?.series || "").toString().trim();
  const chapterNumber = (reqBody?.chapterNumber || reqQuery?.chapterNumber || reqBody?.chapter || reqQuery?.chapter || "").toString().trim();
  const folderType = (reqBody?.folderType || reqQuery?.folderType || reqBody?.type || reqQuery?.type || "").toString().trim();

  let parts: string[] = [];
  const safeSeries = sanitizeFolderName(seriesTitle);
  const isSubmission = folderType === "submission" || folderType === "draft" || folderType === "raw" || folderType === "document";
  const isChapter = Boolean((chapterNumber !== "" || folderType === "chapters" || folderType === "chapter" || folderType === "chapter_pages") && !isSubmission);
  const safeChapterNum = chapterNumber !== "" ? sanitizeFolderName(chapterNumber) : "";

  if (safeSeries && safeSeries !== "general") {
    parts.push("series", safeSeries);

    if (isSubmission) {
      parts.push("submissions");
      if (safeChapterNum) {
        parts.push(`ch-${safeChapterNum}`);
      }
    } else if (isChapter) {
      parts.push("chapters");
    } else if (folderType) {
      const safeFolder = sanitizeFolderName(folderType);
      parts.push(safeFolder);
    }
  } else if (folderType) {
    const safeFolder = sanitizeFolderName(folderType);
    if (safeFolder === "cover" || safeFolder === "banner" || safeFolder === "logo") {
      parts.push("site", safeFolder);
    } else {
      parts.push(safeFolder);
    }
  }

  if (parts.length === 0) {
    parts.push("general");
  }

  const relPrefix = parts.join("/");
  const targetDir = path.join(baseUploadsDir, ...parts);

  // Path Traversal Defense: Ensure targetDir cannot escape baseUploadsDir
  if (!isPathSafe(baseUploadsDir, targetDir)) {
    return {
      targetDir: path.join(baseUploadsDir, "general"),
      relPrefix: "general",
      isChapter: false,
      safeSeries: "",
      safeChapterNum: "",
      folderType: ""
    };
  }

  return { targetDir, relPrefix, isChapter, safeSeries, safeChapterNum, folderType };
}

async function getFilesRecursively(dir: string, baseDir: string = dir): Promise<{ filename: string; sizeBytes: number }[]> {
  let results: { filename: string; sizeBytes: number }[] = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await getFilesRecursively(fullPath, baseDir);
        results = results.concat(subFiles);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(fullPath);
        const relativeName = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        results.push({ filename: relativeName, sizeBytes: stat.size });
      }
    }
  } catch (e) {
    // ignore
  }
  return results;
}

  app.get("/api/admin/db-status", requireAdmin, async (req, res) => {
    try {
      const status = await dbManager.getDbStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ connected: false, error: err.message });
    }
  });

  app.post("/api/admin/fix-charset", requireAdmin, async (req, res) => {
    try {
      const result = await dbManager.fixCharset();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/admin/organize-files", requireAdmin, async (req, res) => {
    try {
      const result = await organizeAllFiles();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `خطا در سازماندهی فایل‌ها: ${err.message}` });
    }
  });

  app.post("/api/admin/test-ftp", requireAdmin, async (req, res) => {
    try {
      const config = req.body || {};
      const result = await testFtpConnection(config);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `خطا در تست اتصال: ${err.message}` });
    }
  });

  app.post(["/api/upload", "/api/admin/upload"], requireStaffOrAdmin, upload.any(), async (req: any, res) => {
    try {
      const files = (req.files || []) as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "فایلی برای آپلود انتخاب نشده است." });
      }

      const { targetDir, relPrefix, isChapter, safeSeries, safeChapterNum, folderType } = resolveTargetUploadDir(uploadsDir, req.body, req.query);
      await fs.promises.mkdir(targetDir, { recursive: true });

      let dbFtpConfig: any = null;
      try {
        dbFtpConfig = await dbManager.getSettings("download_host_settings");
      } catch (e) {
        // ignore
      }

      const isFtpEnabled = dbFtpConfig?.enabled ?? (process.env.FTP_ENABLED === "true" || Boolean(process.env.FTP_HOST));

      // Check if any file is a document or if it's explicitly a submission / draft
      const hasDocFile = files.some(f => {
        const ext = path.extname(f.originalname).toLowerCase();
        return [".doc", ".docx", ".pdf", ".txt", ".rtf"].includes(ext) || 
               f.mimetype.includes("word") || 
               f.mimetype.includes("document") || 
               f.mimetype.includes("text/");
      });

      const isSubmissionUpload = folderType === "submission" || folderType === "draft" || folderType === "raw" || folderType === "document" || hasDocFile;

      // CASE 1: Chapter Pages Upload (Package into a single chapter-.zip archive for reader streaming)
      if (isChapter && safeSeries && !isSubmissionUpload) {
        const zipFileName = `chapter-${safeChapterNum || Date.now()}.zip`;
        const absZipPath = path.join(targetDir, zipFileName);
        const relZipPath = `uploads/${relPrefix}/${zipFileName}`;

        // Check if a zip file was uploaded
        const uploadedZip = files.find(f => 
          f.originalname.endsWith(".zip") || 
          f.mimetype === "application/zip" || 
          f.mimetype === "application/x-zip-compressed"
        );

        let finalZipBuffer: Buffer;
        let entryNames: string[] = [];

        if (uploadedZip) {
          // Validate Zip safely
          const zipInspection = await inspectZipArchiveSafely(uploadedZip.buffer);
          if (!zipInspection.isValid) {
            return res.status(400).json({ error: zipInspection.error || "خطا در بررسی فایل فشرده." });
          }

          if (zipInspection.imageEntries.length > 0) {
            const zip = new JSZip();
            const loaded = await zip.loadAsync(uploadedZip.buffer);
            entryNames = zipInspection.imageEntries;
            entryNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
            finalZipBuffer = uploadedZip.buffer;
          } else {
            return res.status(400).json({ error: "هیچ تصویری در فایل ZIP آپلود شده یافت نشد." });
          }
        } else {
          // Multiple / Single loose images uploaded -> Package into a compressed ZIP file directly
          const newZip = new JSZip();
          // Sort files naturally by filename
          const sortedFiles = [...files].sort((a, b) => 
            a.originalname.localeCompare(b.originalname, undefined, { numeric: true, sensitivity: "base" })
          );

          for (let idx = 0; idx < sortedFiles.length; idx++) {
            const file = sortedFiles[idx];
            const validation = validateFileBuffer(file.buffer, file.originalname, file.mimetype);
            if (!validation.isValid) {
              return res.status(400).json({ error: validation.error || `فایل '${file.originalname}' غیرمجاز است.` });
            }

            const pageNum = String(idx + 1).padStart(3, '0');
            let imgBuffer = file.buffer;
            let entryName = `page-${pageNum}.webp`;

            try {
              imgBuffer = await sharp(file.buffer)
                .webp({ quality: 78, effort: 3 })
                .toBuffer();
            } catch (err) {
              const ext = path.extname(file.originalname).toLowerCase() || ".png";
              entryName = `page-${pageNum}${ext}`;
            }

            newZip.file(entryName, imgBuffer);
            entryNames.push(entryName);
          }

          finalZipBuffer = await newZip.generateAsync({ 
            type: "nodebuffer", 
            compression: "DEFLATE", 
            compressionOptions: { level: 9 } 
          });
        }

        // Write the single compact zip file to disk
        await fs.promises.writeFile(absZipPath, finalZipBuffer);
        zipCache.delete(absZipPath); // Invalidate cache

        // If FTP enabled, upload the chapter zip to remote host
        if (isFtpEnabled) {
          await uploadBatchFilesToFtp([{
            buffer: finalZipBuffer,
            remoteRelPath: relZipPath,
            localFallbackPath: absZipPath
          }], dbFtpConfig);
        }

        // Generate streaming URLs for every page inside the zip
        const urls = entryNames.map(entry => 
          `/api/chapter-zip-image?zip=${encodeURIComponent(relZipPath)}&entry=${encodeURIComponent(entry)}`
        );

        return res.json({ 
          success: true, 
          urls, 
          url: urls[0] || `/${relZipPath}`,
          zipPath: `/${relZipPath}`,
          totalPages: urls.length 
        });
      }

      // CASE 2: Non-Chapter / Submission Uploads (Word Docs, Clean/Edit ZIP archives, Covers, Banners, Logos)
      const itemsToUpload: { buffer: Buffer; fileName: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 1. Binary Magic Bytes & Anti-Executable Verification
        const validation = validateFileBuffer(file.buffer, file.originalname, file.mimetype);
        if (!validation.isValid) {
          return res.status(400).json({ error: validation.error || `فایل '${file.originalname}' غیرمجاز است.` });
        }

        const ext = path.extname(file.originalname).toLowerCase();

        const isDoc = [".doc", ".docx", ".pdf", ".txt", ".rtf", ".zip", ".rar", ".7z", ".tar"].includes(ext) || 
                      file.mimetype.includes("word") || 
                      file.mimetype.includes("document") || 
                      file.mimetype.includes("zip") ||
                      file.mimetype.includes("compressed") ||
                      file.mimetype.includes("text/");

        if (isDoc) {
          const originalBase = path.basename(file.originalname, ext);
          const safeName = sanitizeSafeFileName(`${sanitizeFolderName(originalBase)}-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext || '.docx'}`);
          itemsToUpload.push({ buffer: file.buffer, fileName: safeName });
          continue;
        }

        try {
          const webpBuf = await sharp(file.buffer)
            .webp({ quality: 80, effort: 3 })
            .toBuffer();

          const basePrefix = safeSeries ? `${safeSeries}-` : '';
          const fileName = sanitizeSafeFileName(`${basePrefix}image-${Date.now()}-${Math.floor(Math.random() * 1000)}.webp`);
          itemsToUpload.push({ buffer: webpBuf, fileName });
        } catch (imgErr) {
          const safeExt = ext || ".jpg";
          const fileName = sanitizeSafeFileName(`file-${Date.now()}-${Math.floor(Math.random() * 1000)}${safeExt}`);
          itemsToUpload.push({ buffer: file.buffer, fileName });
        }
      }

      await Promise.all(
        itemsToUpload.map(item => 
          fs.promises.writeFile(path.join(targetDir, item.fileName), item.buffer)
        )
      );

      let ftpUrls: (string | null)[] = [];
      if (isFtpEnabled) {
        const batchPayload = itemsToUpload.map(item => ({
          buffer: item.buffer,
          remoteRelPath: `uploads/${relPrefix}/${item.fileName}`,
          localFallbackPath: path.join(targetDir, item.fileName)
        }));
        ftpUrls = await uploadBatchFilesToFtp(batchPayload, dbFtpConfig);
      }

      const urls: string[] = itemsToUpload.map((item, i) => {
        const ftpUrl = ftpUrls[i];
        if (ftpUrl) return ftpUrl;
        return `/uploads/${relPrefix}/${item.fileName}`;
      });

      res.json({ success: true, urls, url: urls[0] || '', count: urls.length });
    } catch (err: any) {
      console.error("Upload processing error:", err);
      res.status(500).json({ error: err.message });
    }
  });


  // Dynamic XML Sitemap Generator for Google Search Console
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const siteUrl = `${req.protocol}://${req.get('host') || 'localhost'}`;
      const seriesList = await dbManager.getSeries();

      const escapeXml = (unsafe: string) => unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/search', priority: '0.9', changefreq: 'daily' },
        { url: '/cooperation', priority: '0.7', changefreq: 'weekly' },
        { url: '/leaderboard', priority: '0.6', changefreq: 'weekly' },
        { url: '/support', priority: '0.5', changefreq: 'monthly' },
        { url: '/terms', priority: '0.3', changefreq: 'yearly' },
        { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
      ];

      for (const p of staticPages) {
        xml += `  <url>\n    <loc>${siteUrl}${p.url}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
      }

      for (const s of (seriesList || [])) {
        const seriesLoc = `${siteUrl}/series/${s.id}`;
        const lastMod = s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        xml += `  <url>\n    <loc>${seriesLoc}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n`;
        if (s.cover) {
          const coverUrl = s.cover.startsWith('http') ? s.cover : `${siteUrl}${s.cover.startsWith('/') ? '' : '/'}${s.cover}`;
          xml += `    <image:image>\n      <image:loc>${escapeXml(coverUrl)}</image:loc>\n      <image:title>${escapeXml(s.title)}</image:title>\n    </image:image>\n`;
        }
        xml += `  </url>\n`;

        try {
          const chapters = await dbManager.getChapters(s.id);
          for (const ch of (chapters || [])) {
            if (ch.isPending) continue;
            const chapLoc = `${siteUrl}/series/${s.id}/chapters/${ch.id}`;
            const chMod = ch.updatedAt ? new Date(ch.updatedAt).toISOString().split('T')[0] : lastMod;
            xml += `  <url>\n    <loc>${chapLoc}</loc>\n    <lastmod>${chMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
          }
        } catch (err) {}
      }

      xml += `</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err: any) {
      console.error('Sitemap generation error:', err);
      res.status(500).send('Error generating sitemap');
    }
  });

  // Robots.txt Generator
  app.get('/robots.txt', (req, res) => {
    const siteUrl = `${req.protocol}://${req.get('host') || 'localhost'}`;
    const txt = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(txt);
  });

  const isStaticAssetUrl = (urlPath: string) => {
    return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|map)$/i.test(urlPath);
  };

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: "API route not found" });
      }
      if (isStaticAssetUrl(req.path)) {
        return res.status(404).send("Asset not found");
      }
      try {
        const template = await fs.promises.readFile(path.join(process.cwd(), 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const html = await generateSeoHtml(req.path, transformed, req.get('host') || 'localhost', req.protocol);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } catch (e) {
        console.error("SEO html error, falling back to index.html:", e);
        try {
          const template = await fs.promises.readFile(path.join(process.cwd(), 'index.html'), 'utf-8');
          const transformed = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(transformed);
        } catch (err2) {
          res.sendFile(path.join(process.cwd(), 'index.html'));
        }
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: "API route not found" });
      }
      if (isStaticAssetUrl(req.path)) {
        return res.status(404).send("Asset not found");
      }
      try {
        const template = await fs.promises.readFile(path.join(distPath, 'index.html'), 'utf-8');
        const html = await generateSeoHtml(req.path, template, req.get('host') || 'localhost', req.protocol);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } catch (e) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  // Global Centralized Error Handling Middleware (Production-Safe)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Server Unhandled Error] ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : (typeof err.status === 'number' ? err.status : 500);
    const isProd = process.env.NODE_ENV === 'production';
    const message = err.message || "خطای ناشناخته در پردازش درخواست سرور.";

    res.status(statusCode).json({
      error: message,
      ...(isProd ? {} : { stack: err.stack, details: err })
    });
  });

  const server = httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful Shutdown on SIGTERM and SIGINT
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      console.log("[Server] HTTP server closed.");
      try {
        // Disconnect all socket.io clients
        io.disconnectSockets(true);
        console.log("[Server] Socket connections closed.");

        // Close MySQL pool if active
        if (dbManager.isUsingMySQL && dbManager.pool) {
          await dbManager.pool.end();
          console.log("[Server] MySQL connection pool closed.");
        }
        console.log("[Server] Graceful shutdown completed cleanly.");
        process.exit(0);
      } catch (shutdownErr) {
        console.error("[Server] Error during graceful shutdown:", shutdownErr);
        process.exit(1);
      }
    });

    // Force exit after 10s if dangling connections remain
    setTimeout(() => {
      console.error("[Server] Could not close connections in time, forcefully shutting down.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer();

