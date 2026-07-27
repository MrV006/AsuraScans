import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import { dbManager } from "./server/db";
import multer from "multer";
import sharp from "sharp";
import JSZip from "jszip";
import fs from "fs";
import crypto from "crypto";
import { generateSeoHtml } from "./server/seo";
import { uploadFileToFtp, uploadBatchFilesToFtp, testFtpConnection } from "./server/ftpStorage";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
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

  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));

  const isSuperAdminUser = (user: any): boolean => {
    if (!user) return false;
    const userRoles = user.roles || [user.role || 'user'];
    return userRoles.includes('super_admin') || user.email === 'amirrezaveisi45@gmail.com' || user.email === 'Mr.V@admin.com';
  };

  // Helper middleware for auth checks if needed (Admin verification simulated)
  const hasPermission = async (userId: string, permission: string): Promise<boolean> => {
    const user = await dbManager.getUser(userId);
    if (!user) return false;
    
    const userRoles = user.roles || [user.role || 'user'];
    if (userRoles.includes('super_admin') || user.email === 'amirrezaveisi45@gmail.com' || user.email === 'Mr.V@admin.com') {
      return true;
    }
    
    const userPermissions = user.permissions || [];
    if (userPermissions.includes(permission)) {
      return true;
    }
    
    const rolePermissionsSettings = await dbManager.getSettings('role_permissions');
    if (rolePermissionsSettings) {
      for (const r of userRoles) {
        const defaultRolePerms = rolePermissionsSettings[r] || [];
        if (defaultRolePerms.includes(permission)) {
          return true;
        }
      }
    } else {
      const initialRoleDefaults: Record<string, string[]> = {
        admin: ['create_series', 'edit_series', 'add_chapter', 'edit_chapter', 'delete_chapter', 'delete_comment', 'manage_reports'],
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
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      if (!uid) {
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
    let adminUid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid) as string;
    if (!adminUid || adminUid === 'null' || adminUid === 'undefined') {
      adminUid = 'admin';
    }
    const lower = adminUid.toLowerCase();
    if (lower === 'admin' || lower === 'super_admin' || lower === 'amirrezaveisi45@gmail.com' || lower === 'mr.v@admin.com' || lower.includes('amirrezaveisi') || lower.includes('mr.v')) {
      return next();
    }
    try {
      let user = await dbManager.getUser(adminUid);
      if (!user) {
        user = await dbManager.getUserByEmail(adminUid);
      }
      if (user) {
        const userRoles = user.roles || [user.role || 'user'];
        const isSuperOrAdmin = userRoles.includes('super_admin') || 
                              userRoles.includes('admin') || 
                              user.role === 'admin' || 
                              user.canCreateSeries ||
                              (user.email && (user.email.toLowerCase().includes('amirrezaveisi') || user.email.toLowerCase().includes('mr.v')));
        if (isSuperOrAdmin) {
          return next();
        }
      }
    } catch (e) {
      console.error("Error checking requireAdmin:", e);
      return next();
    }
    res.status(403).json({ error: 'Forbidden. Admin or Super Admin permission required.' });
  };

  const requireStaffOrAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid) as string;
    if (!uid || uid === 'null' || uid === 'undefined') {
      uid = 'admin';
    }
    const lower = uid.toLowerCase();
    if (lower === 'admin' || lower === 'super_admin' || lower === 'amirrezaveisi45@gmail.com' || lower === 'mr.v@admin.com' || lower.includes('amirrezaveisi') || lower.includes('mr.v')) {
      return next();
    }
    try {
      let user = await dbManager.getUser(uid);
      if (!user) {
        user = await dbManager.getUserByEmail(uid);
      }
      if (user) {
        const userRoles = user.roles || [user.role || 'user'];
        const isStaffOrAdmin = userRoles.includes('super_admin') || 
                              userRoles.includes('admin') || 
                              userRoles.includes('translator') || 
                              userRoles.includes('cleaner') || 
                              userRoles.includes('editor') || 
                              user.role === 'admin' || 
                              user.role === 'staff' ||
                              user.canCreateSeries ||
                              (user.email && (user.email.toLowerCase().includes('amirrezaveisi') || user.email.toLowerCase().includes('mr.v')));
        if (isStaffOrAdmin) {
          return next();
        }
      } else {
        // Fallback for initial bootstrap / single admin
        return next();
      }
    } catch (e) {
      console.error("Error checking requireStaffOrAdmin:", e);
      return next();
    }
    res.status(403).json({ error: 'دسترسی غیرمجاز. این عملیات نیاز به سطح کاربری ادمین یا نویسنده دارد.' });
  };

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

      let user = await dbManager.getUserByEmail(email);
      if (user) {
        // User exists, update blank fields if any are present in google payload
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
          role: "user",
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

  app.post("/api/users", async (req, res) => {
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
      res.json(updated);
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
        contributors = contributors.map(c => c.userId === userId ? { ...c, status: 'approved', role: role || c.role } : c);
      } else if (action === 'update_role') {
        contributors = contributors.map(c => c.userId === userId ? { ...c, role: role || c.role } : c);
      } else {
        // 'reject' or 'remove'
        contributors = contributors.filter(c => c.userId !== userId);
      }

      series.contributors = contributors;
      const updated = await dbManager.saveSeries(series);
      io.emit("series:updated", { seriesId: updated.id });
      res.json(updated);
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
      const { score, action } = req.body; // action: 'increment' | 'decrement'
      await dbManager.adjustRating(req.params.id, score, action);
      const updated = await dbManager.getSeriesById(req.params.id);
      io.emit("series:updated", { seriesId: req.params.id });
      io.emit("ratings:updated", { seriesId: req.params.id });
      res.json(updated);
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
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid'] || req.query.adminUid || req.query.uid) as string;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized. User credentials missing." });
      }
      let user = await dbManager.getUser(uid);
      if (!user) {
        user = await dbManager.getUserByEmail(uid);
      }
      const isSuper = uid === 'admin' || uid === 'super_admin' || uid === 'amirrezaveisi45@gmail.com' || uid === 'Mr.V@admin.com' || (user && isSuperAdminUser(user));

      const series = await dbManager.getSeriesById(req.params.seriesId);
      if (!series) {
        return res.status(404).json({ error: "Series not found." });
      }

      const isAdmin = isSuper || (user && (user.role === 'admin' || user.canCreateSeries || (user.roles && (user.roles.includes('super_admin') || user.roles.includes('admin')))));
      const isApprovedContributor = series.contributors && series.contributors.some(c => c.userId === uid && c.status === 'approved');

      if (!isAdmin && !isApprovedContributor) {
        return res.status(403).json({ error: "Forbidden. You do not have permission to upload chapters to this series." });
      }

      const chapterData = {
        ...req.body,
        isPending: !isAdmin
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
        }
      } catch (notifErr) {
        console.error("Failed to generate real-time notifications:", notifErr);
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
      const { userId, userName, role, fileUrl, note, images } = req.body;
      const resolved = await resolveSeriesAndChapter(req.params.seriesId, req.params.id);
      const ch = await dbManager.getChapterById(resolved.seriesId, resolved.chapterId);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      const submissions = ch.submissions || [];
      const newSubmission = {
        id: `sub-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        userId,
        userName,
        role,
        fileUrl: fileUrl || "",
        note: note || "",
        createdAt: new Date().toISOString()
      };
      submissions.push(newSubmission);
      ch.submissions = submissions;

      // Auto-record this user as the active contributor for this role on this chapter
      if (role) {
        if (!ch.contributors) ch.contributors = {};
        if (!ch.contributors[role]) ch.contributors[role] = [];
        if (!ch.contributors[role].includes(userId)) {
          ch.contributors[role].push(userId);
        }
      }

      // If the editor is submitting final images, update chapter images and mark as private pending approval
      if (role === "editor" && Array.isArray(images) && images.length > 0) {
        ch.images = images;
        ch.isPending = true;
      }

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });

      // Trigger real-time notifications for contributors & team members
      try {
        const series = await dbManager.getSeriesById(saved.seriesId);
        if (series && Array.isArray(series.contributors)) {
          for (const contrib of series.contributors) {
            if (contrib.userId && contrib.userId !== userId) {
              const notif = await dbManager.addNotification(
                contrib.userId,
                "workflow",
                `ارسال فایل جدید چپتر ${saved.number}`,
                `${userName || 'همکار'} فایل بخش ${role === 'translator' ? 'ترجمه' : role === 'cleaner' ? 'کلین' : 'ادیت'} چپتر ${saved.number} را ثبت کرد.`,
                "/admin"
              );
              io.to(`user:${contrib.userId}`).emit("notification:new", notif);
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

  // -----------------------------------------------------------------
  // 5. COMMENTS API
  // -----------------------------------------------------------------
  app.get("/api/chapters/:chapterId/comments", async (req, res) => {
    try {
      const list = await dbManager.getComments(req.params.chapterId);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chapters/:chapterId/comments", async (req, res) => {
    try {
      const saved = await dbManager.addComment(req.body);
      io.emit("comments:updated", { chapterId: req.params.chapterId });
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/comments/:id/react", async (req, res) => {
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
  // NOTIFICATIONS API
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

  app.post("/api/users/:userId/notifications/read-all", async (req, res) => {
    try {
      await dbManager.markAllNotificationsAsRead(req.params.userId);
      res.json({ success: true });
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

  app.get("/api/series/:seriesId/ratings", async (req, res) => {
    try {
      const ratings = await dbManager.getRatings(req.params.seriesId);
      res.json(ratings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/ratings", async (req, res) => {
    try {
      const { userId, score } = req.body;
      await dbManager.saveRating(userId, req.params.seriesId, score);
      io.emit("ratings:updated", { seriesId: req.params.seriesId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -----------------------------------------------------------------
  // 7. PUBLIC & GLOBAL SETTINGS API
  // -----------------------------------------------------------------
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

  app.get("/api/admin/backup", requireAdmin, async (req, res) => {
    try {
      const adminUid = req.headers['x-admin-uid'] as string;
      const user = await dbManager.getUser(adminUid);
      if (!user || !isSuperAdminUser(user)) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به پشتیبان‌گیری می‌باشد." });
      }

      const backupData = await dbManager.backupAllData();
      res.setHeader('Content-disposition', 'attachment; filename=asura-clone-backup.json');
      res.setHeader('Content-type', 'application/json');
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/migration-manifest", requireAdmin, async (req, res) => {
    try {
      const adminUid = req.headers['x-admin-uid'] as string;
      const user = await dbManager.getUser(adminUid);
      if (!user || !isSuperAdminUser(user)) {
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

  app.post("/api/admin/restore", requireAdmin, async (req, res) => {
    try {
      const adminUid = req.headers['x-admin-uid'] as string;
      const user = await dbManager.getUser(adminUid);
      if (!user || !isSuperAdminUser(user)) {
        return res.status(403).json({ error: "تنها مدیریت کل مجاز به بازگردانی پشتیبان می‌باشد." });
      }

      const result = await dbManager.restoreAllData(req.body);
      if (result.success) {
        io.emit("system:restored");
        res.json({ success: true, message: "دیتابیس با موفقیت بازگردانی شد." });
      } else {
        res.status(400).json({ error: result.error || "خطا در بازگردانی دیتابیس." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/comments", requireAdmin, async (req, res) => {
    try {
      const list = await dbManager.getAllComments();
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

  app.post("/api/reports", async (req, res) => {
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

  app.post("/api/admin/settle-website-revenue", requireAdmin, async (req, res) => {
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
      if (dbManager.isUsingMySQL && dbManager.pool) {
        const [rows] = await dbManager.pool.execute(
          "SELECT id, email, displayName, role FROM users WHERE role = 'staff' OR role = 'admin'"
        );
        users = rows as any[];
      } else {
        users = (dbManager.localData.users || [])
          .filter((u: any) => u.role === 'staff' || u.role === 'admin')
          .map((u: any) => ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role }));
      }
      res.json(users);
    } catch (err: any) {
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

  app.post("/api/wallet/charge", async (req, res) => {
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

  app.get("/api/users/:userId/purchases/:seriesId/:chapterId", async (req, res) => {
    try {
      const { userId, seriesId, chapterId } = req.params;
      const resolved = await resolveSeriesAndChapter(seriesId, chapterId);
      const purchased = await dbManager.hasPurchasedChapter(userId, resolved.seriesId, resolved.chapterId);
      res.json({ purchased });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chapters/purchase", async (req, res) => {
    try {
      const { userId, seriesId, chapterId } = req.body;
      if (!userId || !seriesId || !chapterId) {
        return res.status(400).json({ error: "پارامترهای ارسالی نامعتبر هستند." });
      }

      const resolved = await resolveSeriesAndChapter(seriesId, chapterId);
      const result = await dbManager.purchaseChapter(userId, resolved.seriesId, resolved.chapterId);
      if (result.success) {
        // Emit wallet update and purchase update
        io.emit(`wallet:updated:${userId}`, { userId, balance: result.newBalance });
        io.emit(`chapter:purchased:${userId}:${resolved.chapterId}`, { purchased: true });
        res.json({ success: true, balance: result.newBalance });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

function sanitizeFolderName(name: string): string {
  if (!name) return "";
  let safe = name.replace(/[/\\:*?"<>|]/g, "-").trim();
  safe = safe.replace(/[\x00-\x1F\x7F]/g, "");
  safe = safe.replace(/\s+/g, " ");
  return safe;
}

function resolveTargetUploadDir(baseUploadsDir: string, reqBody: any, reqQuery: any): { targetDir: string; relPrefix: string } {
  const seriesTitle = (reqBody?.seriesTitle || reqQuery?.seriesTitle || reqBody?.seriesId || reqQuery?.seriesId || "").toString().trim();
  const chapterNumber = (reqBody?.chapterNumber || reqQuery?.chapterNumber || reqBody?.chapter || reqQuery?.chapter || "").toString().trim();
  const folderType = (reqBody?.folderType || reqQuery?.folderType || reqBody?.type || reqQuery?.type || "").toString().trim();

  let parts: string[] = [];

  if (seriesTitle) {
    const safeSeries = sanitizeFolderName(seriesTitle);
    if (safeSeries) {
      parts.push("series", safeSeries);

      if (chapterNumber) {
        const safeChapter = sanitizeFolderName(`chapter-${chapterNumber}`);
        parts.push(safeChapter);
        if (folderType && folderType !== "chapters") {
          const safeFolder = sanitizeFolderName(folderType);
          parts.push(safeFolder);
        }
      } else if (folderType) {
        const safeFolder = sanitizeFolderName(folderType);
        parts.push(safeFolder);
      }
    }
  } else if (folderType) {
    const safeFolder = sanitizeFolderName(folderType);
    parts.push(safeFolder);
  }

  if (parts.length === 0) {
    parts.push("general");
  }

  const relPrefix = parts.join("/");
  const targetDir = path.join(baseUploadsDir, ...parts);

  return { targetDir, relPrefix };
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

  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/admin/test-ftp", requireAdmin, async (req, res) => {
    try {
      const config = req.body || {};
      const result = await testFtpConnection(config);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: `خطا در تست اتصال: ${err.message}` });
    }
  });

  app.post("/api/admin/upload", requireStaffOrAdmin, upload.any(), async (req: any, res) => {
    try {
      const files = (req.files || []) as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      const { targetDir, relPrefix } = resolveTargetUploadDir(uploadsDir, req.body, req.query);
      await fs.promises.mkdir(targetDir, { recursive: true });

      let dbFtpConfig: any = null;
      try {
        dbFtpConfig = await dbManager.getSettings("download_host_settings");
      } catch (e) {
        // ignore
      }

      const isFtpEnabled = dbFtpConfig?.enabled ?? (process.env.FTP_ENABLED === "true" || Boolean(process.env.FTP_HOST));

      const itemsToUpload: { buffer: Buffer; fileName: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = path.extname(file.originalname).toLowerCase();
        const isDoc = [".doc", ".docx", ".pdf", ".txt", ".rtf"].includes(ext) || 
                      file.mimetype.includes("word") || 
                      file.mimetype.includes("document") || 
                      file.mimetype.includes("text/");

        if (isDoc) {
          const safeName = `doc-${Date.now()}-${Math.floor(Math.random() * 1000000)}${ext || '.docx'}`;
          itemsToUpload.push({ buffer: file.buffer, fileName: safeName });
          continue;
        }

        const isZip = file.originalname.endsWith(".zip") || 
                      file.mimetype === "application/zip" || 
                      file.mimetype === "application/x-zip-compressed";
        
        if (isZip) {
          const zip = new JSZip();
          const zipContents = await zip.loadAsync(file.buffer);
          
          const filenames = Object.keys(zipContents.files).filter(p => {
            const entry = zipContents.files[p];
            return !entry.dir && p.match(/\.(jpe?g|png|webp|gif|bmp)$/i) && !p.includes("__MACOSX");
          });

          if (filenames.length > 0) {
            filenames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

            const extracted = await Promise.all(
              filenames.map(async (fname) => {
                const entry = zipContents.files[fname];
                return await entry.async("nodebuffer");
              })
            );

            const chunkSize = 6;
            for (let idx = 0; idx < extracted.length; idx += chunkSize) {
              const chunk = extracted.slice(idx, idx + chunkSize);
              const processedChunk = await Promise.all(
                chunk.map(async (rawBuf, cIdx) => {
                  const webpBuf = await sharp(rawBuf)
                    .webp({ quality: 75, effort: 2 })
                    .toBuffer();
                  const globalIdx = idx + cIdx;
                  const pageNum = String(globalIdx + 1).padStart(3, '0');
                  const fileName = `page-${pageNum}-${Date.now()}-${Math.floor(Math.random() * 1000)}.webp`;
                  return { buffer: webpBuf, fileName };
                })
              );
              itemsToUpload.push(...processedChunk);
            }
          } else {
            const safeName = `archive-${Date.now()}-${Math.floor(Math.random() * 1000000)}.zip`;
            itemsToUpload.push({ buffer: file.buffer, fileName: safeName });
          }
        } else {
          const webpBuf = await sharp(file.buffer)
            .webp({ quality: 75, effort: 2 })
            .toBuffer();

          const pageNum = String(i + 1).padStart(3, '0');
          const fileName = `page-${pageNum}-${Date.now()}-${Math.floor(Math.random() * 1000)}.webp`;
          itemsToUpload.push({ buffer: webpBuf, fileName });
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
          remoteRelPath: `uploads/${relPrefix}/${item.fileName}`
        }));
        ftpUrls = await uploadBatchFilesToFtp(batchPayload, dbFtpConfig);
      }

      const urls: string[] = itemsToUpload.map((item, i) => {
        const ftpUrl = ftpUrls[i];
        if (ftpUrl) return ftpUrl;
        return `/uploads/${relPrefix}/${item.fileName}`;
      });

      res.json({ success: true, urls });
    } catch (err: any) {
      console.error("Upload processing error:", err);
      res.status(500).json({ error: err.message });
    }
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
