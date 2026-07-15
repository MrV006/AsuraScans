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
    const adminUid = req.headers['x-admin-uid'] as string;
    if (!adminUid) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials header missing.' });
    }
    const user = await dbManager.getUser(adminUid);
    if (user) {
      const userRoles = user.roles || [user.role || 'user'];
      const isSuperOrAdmin = userRoles.includes('super_admin') || userRoles.includes('admin') || user.email === 'amirrezaveisi45@gmail.com' || user.email === 'Mr.V@admin.com';
      if (isSuperOrAdmin) {
        return next();
      }
    }
    res.status(403).json({ error: 'Forbidden. Admin or Super Admin permission required.' });
  };

  const requireStaffOrAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized. Credentials header missing.' });
    }
    const user = await dbManager.getUser(uid);
    if (user) {
      const userRoles = user.roles || [user.role || 'user'];
      const isStaffOrAdmin = userRoles.includes('super_admin') || 
                            userRoles.includes('admin') || 
                            userRoles.includes('translator') || 
                            userRoles.includes('cleaner') || 
                            userRoles.includes('editor') || 
                            user.role === 'admin' || 
                            user.role === 'staff';
      if (isStaffOrAdmin) {
        return next();
      }
    }
    res.status(403).json({ error: 'Forbidden. Staff or Admin permission required.' });
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

  // -----------------------------------------------------------------
  // 3. SERIES (MANGA / MANHWA) API
  // -----------------------------------------------------------------
  app.get("/api/series", async (req, res) => {
    try {
      const { q, genres, tags, status, type, sortBy } = req.query;
      const parsedGenres = typeof genres === "string" && genres ? genres.split(",") : undefined;
      const parsedTags = typeof tags === "string" && tags ? tags.split(",") : undefined;

      const list = await dbManager.searchSeries({
        q: typeof q === "string" ? q : undefined,
        genres: parsedGenres,
        tags: parsedTags,
        status: typeof status === "string" ? status : undefined,
        type: typeof type === "string" ? type : undefined,
        sortBy: typeof sortBy === "string" ? sortBy : undefined,
      });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized. User credentials missing." });
      }
      const user = await dbManager.getUser(uid);
      if (!user || (user.role !== 'admin' && !user.canCreateSeries)) {
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
      const { userId, action } = req.body; // action: 'approve' | 'reject'
      const series = await dbManager.getSeriesById(req.params.id);
      if (!series) return res.status(404).json({ error: "Series not found" });

      let contributors = series.contributors || [];
      if (action === 'approve') {
        contributors = contributors.map(c => c.userId === userId ? { ...c, status: 'approved' } : c);
      } else {
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
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      const user = uid ? await dbManager.getUser(uid) : null;
      const series = await dbManager.getSeriesById(req.params.seriesId);

      const isContributor = series && series.contributors && series.contributors.some(c => c.userId === uid && c.status === 'approved');
      const isAdmin = user && user.role === 'admin';
      const canSeePending = isAdmin || isContributor;

      let chs = await dbManager.getChapters(req.params.seriesId);
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
      const ch = await dbManager.getChapterById(req.params.seriesId, req.params.id);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });
      res.json(ch);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters", async (req, res) => {
    try {
      const uid = (req.headers['x-admin-uid'] || req.headers['x-user-uid']) as string;
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized. User credentials missing." });
      }
      const user = await dbManager.getUser(uid);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized. User not found." });
      }

      const series = await dbManager.getSeriesById(req.params.seriesId);
      if (!series) {
        return res.status(404).json({ error: "Series not found." });
      }

      const isAdmin = user.role === 'admin';
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

  app.put("/api/series/:seriesId/chapters/:id/approve", requireAdmin, async (req, res) => {
    try {
      const ch = await dbManager.getChapterById(req.params.seriesId, req.params.id);
      if (!ch) return res.status(404).json({ error: "Chapter not found" });

      ch.isPending = false;
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

  app.post("/api/series/:seriesId/chapters/:id/view", async (req, res) => {
    try {
      const views = await dbManager.incrementChapterViews(req.params.seriesId, req.params.id);
      io.to(`chapter:${req.params.id}`).emit("chapters:views", { views });
      res.json({ views });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:seriesId/chapters/:id/submit", async (req, res) => {
    try {
      const { userId, userName, role, fileUrl, note, images } = req.body;
      const ch = await dbManager.getChapterById(req.params.seriesId, req.params.id);
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

      // If the editor is submitting final images, update chapter images as well
      if (role === "editor" && Array.isArray(images) && images.length > 0) {
        ch.images = images;
      }

      const saved = await dbManager.saveChapter(ch);
      io.emit("chapters:updated", { chapterId: saved.id, seriesId: saved.seriesId });
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
      const purchased = await dbManager.hasPurchasedChapter(userId, seriesId, chapterId);
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

      const result = await dbManager.purchaseChapter(userId, seriesId, chapterId);
      if (result.success) {
        // Emit wallet update and purchase update
        io.emit(`wallet:updated:${userId}`, { userId, balance: result.newBalance });
        io.emit(`chapter:purchased:${userId}:${chapterId}`, { purchased: true });
        res.json({ success: true, balance: result.newBalance });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/admin/upload", requireStaffOrAdmin, upload.array("files"), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      const urls: string[] = [];

      for (const file of files) {
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

          // Sort numerically/alphabetically (natural sort)
          filenames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

          for (const filename of filenames) {
            const entry = zipContents.files[filename];
            const buffer = await entry.async("nodebuffer");

            // Convert to highly compressed WebP
            const webpBuffer = await sharp(buffer)
              .webp({ quality: 75 })
              .toBuffer();

            const uniqueName = `page-${Date.now()}-${Math.floor(Math.random() * 1000000)}.webp`;
            const filePath = path.join(uploadsDir, uniqueName);
            await fs.promises.writeFile(filePath, webpBuffer);

            urls.push(`/uploads/${uniqueName}`);
          }
        } else {
          // Direct image upload
          const webpBuffer = await sharp(file.buffer)
            .webp({ quality: 75 })
            .toBuffer();

          const uniqueName = `page-${Date.now()}-${Math.floor(Math.random() * 1000000)}.webp`;
          const filePath = path.join(uploadsDir, uniqueName);
          await fs.promises.writeFile(filePath, webpBuffer);

          urls.push(`/uploads/${uniqueName}`);
        }
      }

      res.json({ success: true, urls });
    } catch (err: any) {
      console.error("Upload processing error:", err);
      res.status(500).json({ error: err.message });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
