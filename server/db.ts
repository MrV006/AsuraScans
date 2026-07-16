import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Define structures
export interface Contributor {
  userId: string;
  email: string;
  displayName: string;
  role: 'translator' | 'editor';
  status: 'pending' | 'approved';
  melliCode: string;
}

export interface Series {
  id: string;
  title: string;
  alternativeTitles: string[];
  cover: string;
  banner: string;
  author: string;
  artist: string;
  synopsis: string;
  genres: string[];
  tags: string[];
  status: string;
  rating: number;
  type: string;
  views: number;
  contributors?: Contributor[];
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  images: string[];
  views: number;
  isPending?: boolean;
  submissions?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  chapterId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  likes: string[]; // array of userIds
  dislikes: string[]; // array of userIds
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  banned: boolean;
  role: 'admin' | 'staff' | 'user';
  roles?: string[];
  permissions?: string[];
  melliCode: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  canCreateSeries?: boolean;
  walletBalance?: number;
  password?: string;
  hasCompletedSetup?: boolean;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  type: string; // 'charge', 'purchase', 'admin_adjustment'
  description: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
}

export interface PurchasedChapter {
  id: string;
  userId: string;
  seriesId: string;
  chapterId: string;
  createdAt: string;
}

export interface Bookmark {
  userId: string;
  seriesId: string;
  createdAt: string;
}

export interface HistoryItem {
  userId: string;
  seriesId: string;
  chapterId: string;
  chapterNumber: number;
  updatedAt: string;
}

export interface Rating {
  userId: string;
  seriesId: string;
  score: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

// Global configurations and fallback JSON path
const LOCAL_DB_PATH = path.join(process.cwd(), 'local-db.json');

// Interface for general DB client
class DatabaseManager {
  private pool: mysql.Pool | null = null;
  private isUsingMySQL = false;
  private localData: {
    series: Series[];
    chapters: Chapter[];
    comments: Comment[];
    users: User[];
    bookmarks: Bookmark[];
    history: HistoryItem[];
    ratings: Rating[];
    notifications: Notification[];
    settings: Record<string, any>;
    reports: any[];
    wallet_transactions: WalletTransaction[];
    purchased_chapters: PurchasedChapter[];
  } = {
    series: [],
    chapters: [],
    comments: [],
    users: [],
    bookmarks: [],
    history: [],
    ratings: [],
    notifications: [],
    reports: [],
    wallet_transactions: [],
    purchased_chapters: [],
    settings: {
      global: {
        siteName: 'AsuraClone',
        discordUrl: 'https://discord.gg',
        telegramUrl: 'https://t.me',
        featuredType: 'Manhwa',
        activeAnnouncement: 'به آسورا کلون خوش آمدید! اولین و بزرگترین مرجع مانهوا و مانگا.'
      },
      taxonomy: {
        genres: ['Action', 'Fantasy', 'Adventure', 'Comedy', 'Drama', 'Martial Arts', 'Rebirth', 'System', 'Magic', 'School Life'],
        types: ['Manhwa', 'Manhua', 'Manga'],
        statuses: ['Ongoing', 'Completed', 'Hiatus']
      }
    }
  };

  constructor() {
    this.init();
  }

  private async init() {
    const useMySQL = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;
    
    if (useMySQL) {
      try {
        console.log('MySQL configurations found. Handshaking with DB...');
        this.pool = mysql.createPool({
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '3306'),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });
        
        // Test connection
        const conn = await this.pool.getConnection();
        console.log('MySQL Database Connected Successfully!');
        conn.release();
        
        this.isUsingMySQL = true;
        await this.createMySQLTables();
      } catch (err) {
        console.error('MySQL Connection Error. Falling back to local JSON database.', err);
        this.isUsingMySQL = false;
        this.loadLocalData();
      }
    } else {
      console.log('No MySQL URL/config found. Using local JSON database storage.');
      this.isUsingMySQL = false;
      this.loadLocalData();
    }
  }

  // Load from local JSON file
  private loadLocalData() {
    try {
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const data = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
        this.localData = JSON.parse(data);
        if (!this.localData.notifications) {
          this.localData.notifications = [];
        }
        if (!this.localData.wallet_transactions) {
          this.localData.wallet_transactions = [];
        }
        if (!this.localData.purchased_chapters) {
          this.localData.purchased_chapters = [];
        }
        if (this.localData.users) {
          let migrated = false;
          this.localData.users = this.localData.users.map(u => {
            const has8DigitCode = u.melliCode && /^\d{8}$/.test(u.melliCode);
            if (!has8DigitCode) {
              const newCode = Math.floor(10000000 + Math.random() * 90000000).toString();
              migrated = true;
              return {
                ...u,
                melliCode: newCode,
                walletBalance: u.walletBalance !== undefined ? u.walletBalance : 0
              };
            }
            return {
              ...u,
              walletBalance: u.walletBalance !== undefined ? u.walletBalance : 0
            };
          });
          if (migrated) {
            this.saveLocalData();
          }
        }
        console.log('Loaded data from local-db.json');
      } else {
        this.saveLocalData();
        console.log('Created new local-db.json fallback file');
      }
    } catch (err) {
      console.error('Error loading local DB file, setting up empty structures', err);
    }
  }

  // Save to local JSON file
  private saveLocalData() {
    try {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(this.localData, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving local DB file', err);
    }
  }

  // Setup MySQL schemas automatically
  private async createMySQLTables() {
    if (!this.pool) return;
    try {
      const queries = [
        `CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(100) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          displayName VARCHAR(100) NOT NULL,
          avatarUrl TEXT,
          banned TINYINT(1) DEFAULT 0,
          role VARCHAR(20) DEFAULT 'user',
          melliCode VARCHAR(20),
          firstName VARCHAR(100),
          lastName VARCHAR(100),
          phoneNumber VARCHAR(100),
          canCreateSeries TINYINT(1) DEFAULT 0,
          rolesText TEXT,
          permissionsText TEXT,
          password VARCHAR(255),
          hasCompletedSetup TINYINT(1) DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS series (
          id VARCHAR(100) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          alternativeTitles TEXT, -- Separated by comma
          cover TEXT,
          banner TEXT,
          author VARCHAR(100),
          artist VARCHAR(100),
          synopsis TEXT,
          genres TEXT, -- Comma value
          tags TEXT, -- Comma value
          status VARCHAR(50) DEFAULT 'Ongoing',
          rating DOUBLE DEFAULT 0.0,
          type VARCHAR(50) DEFAULT 'Manhwa',
          views INT DEFAULT 0,
          contributors TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS chapters (
          id VARCHAR(100) PRIMARY KEY,
          seriesId VARCHAR(100) NOT NULL,
          number DOUBLE NOT NULL,
          title VARCHAR(255) DEFAULT '',
          images TEXT, -- Rich comma/newline list
          views INT DEFAULT 0,
          isPending TINYINT(1) DEFAULT 0,
          submissions TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS comments (
          id VARCHAR(100) PRIMARY KEY,
          chapterId VARCHAR(100) NOT NULL,
          userId VARCHAR(100) NOT NULL,
          userName VARCHAR(100) NOT NULL,
          userAvatar TEXT,
          content TEXT NOT NULL,
          likes TEXT, -- JSON arrays of user IDs
          dislikes TEXT, -- JSON arrays of user IDs
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS bookmarks (
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, seriesId),
          FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS history (
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          chapterId VARCHAR(100) NOT NULL,
          chapterNumber DOUBLE NOT NULL,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, seriesId)
        )`,
        `CREATE TABLE IF NOT EXISTS ratings (
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          score DOUBLE NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, seriesId),
          FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
          id VARCHAR(50) PRIMARY KEY,
          val TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS reports (
          id VARCHAR(100) PRIMARY KEY,
          userId VARCHAR(100) NOT NULL,
          userName VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(100) PRIMARY KEY,
          userId VARCHAR(100) NOT NULL,
          type VARCHAR(50) DEFAULT 'system',
          title VARCHAR(255) NOT NULL,
          body TEXT,
          link VARCHAR(255),
          isRead TINYINT(1) DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS wallet_transactions (
          id VARCHAR(100) PRIMARY KEY,
          userId VARCHAR(100) NOT NULL,
          userName VARCHAR(100) NOT NULL,
          amount INT NOT NULL,
          type VARCHAR(50) NOT NULL,
          description TEXT,
          creatorId VARCHAR(100) NOT NULL,
          creatorName VARCHAR(100) NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS purchased_chapters (
          id VARCHAR(100) PRIMARY KEY,
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          chapterId VARCHAR(100) NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_chap (userId, seriesId, chapterId)
        )`
      ];

      for (const q of queries) {
        await this.pool.execute(q);
      }

      // Safe ALTERS for old tables
      const alterQueries = [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS melliCode VARCHAR(20)`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS firstName VARCHAR(100)`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS lastName VARCHAR(100)`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS phoneNumber VARCHAR(100)`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS canCreateSeries TINYINT(1) DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS rolesText TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissionsText TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS walletBalance INT DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS hasCompletedSetup TINYINT(1) DEFAULT 0`,
        `ALTER TABLE series ADD COLUMN IF NOT EXISTS contributors TEXT`,
        `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS isPending TINYINT(1) DEFAULT 0`,
        `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS submissions TEXT`
      ];

      for (const aq of alterQueries) {
        try {
          await this.pool.execute(aq);
        } catch (err) {
          // ignore error if already exists
        }
      }

      console.log('Verified MySQL schema tables exist.');

      // Migrate existing MySQL users to have 8-digit unique codes if they are empty or not 8 digits
      const [users] = await this.pool.execute('SELECT id, melliCode FROM users');
      if (Array.isArray(users)) {
        for (const u of users as any[]) {
          const has8DigitCode = u.melliCode && /^\d{8}$/.test(u.melliCode);
          if (!has8DigitCode) {
            const newCode = Math.floor(10000000 + Math.random() * 90000000).toString();
            await this.pool.execute('UPDATE users SET melliCode = ? WHERE id = ?', [newCode, u.id]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to auto-create MySQL tables:', e);
    }
  }

  // -----------------------------------------------------------------
  // USER METHODS
  // -----------------------------------------------------------------
  async getUsers(): Promise<User[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM users ORDER BY createdAt DESC');
      return (rows as any[]).map(r => {
        const roleVal = r.role || 'user';
        const roles = r.rolesText ? r.rolesText.split(',').map((x: string) => x.trim()).filter(Boolean) : [roleVal];
        const permissions = r.permissionsText ? r.permissionsText.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
        return {
          ...r,
          banned: !!r.banned,
          canCreateSeries: !!r.canCreateSeries,
          walletBalance: r.walletBalance || 0,
          role: roleVal,
          roles,
          permissions
        };
      });
    }
    return this.localData.users.map(u => ({
      ...u,
      walletBalance: u.walletBalance || 0,
      roles: u.roles || [u.role || 'user'],
      permissions: u.permissions || []
    }));
  }

  async getUser(id: string): Promise<User | null> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      const res = (rows as any[])[0];
      if (!res) return null;
      const roleVal = res.role || 'user';
      const roles = res.rolesText ? res.rolesText.split(',').map((x: string) => x.trim()).filter(Boolean) : [roleVal];
      const permissions = res.permissionsText ? res.permissionsText.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
      return {
        ...res,
        banned: !!res.banned,
        canCreateSeries: !!res.canCreateSeries,
        walletBalance: res.walletBalance || 0,
        role: roleVal,
        roles,
        permissions,
        password: res.password || undefined,
        hasCompletedSetup: res.hasCompletedSetup !== undefined ? !!res.hasCompletedSetup : false
      };
    }
    const u = this.localData.users.find(u => u.id === id);
    if (!u) return null;
    return {
      ...u,
      walletBalance: u.walletBalance || 0,
      roles: u.roles || [u.role || 'user'],
      permissions: u.permissions || [],
      password: u.password || undefined,
      hasCompletedSetup: u.hasCompletedSetup !== undefined ? !!u.hasCompletedSetup : false
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const emailLower = email.toLowerCase();
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM users WHERE LOWER(email) = ?', [emailLower]);
      const res = (rows as any[])[0];
      if (!res) return null;
      const roleVal = res.role || 'user';
      const roles = res.rolesText ? res.rolesText.split(',').map((x: string) => x.trim()).filter(Boolean) : [roleVal];
      const permissions = res.permissionsText ? res.permissionsText.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
      return {
        ...res,
        banned: !!res.banned,
        canCreateSeries: !!res.canCreateSeries,
        walletBalance: res.walletBalance || 0,
        role: roleVal,
        roles,
        permissions,
        password: res.password || undefined,
        hasCompletedSetup: res.hasCompletedSetup !== undefined ? !!res.hasCompletedSetup : false
      };
    }
    const u = this.localData.users.find(u => u.email.toLowerCase() === emailLower);
    if (!u) return null;
    return {
      ...u,
      walletBalance: u.walletBalance || 0,
      roles: u.roles || [u.role || 'user'],
      permissions: u.permissions || [],
      password: u.password || undefined,
      hasCompletedSetup: u.hasCompletedSetup !== undefined ? !!u.hasCompletedSetup : false
    };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userLower = username.toLowerCase();
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM users WHERE LOWER(displayName) = ?', [userLower]);
      const res = (rows as any[])[0];
      if (!res) return null;
      const roleVal = res.role || 'user';
      const roles = res.rolesText ? res.rolesText.split(',').map((x: string) => x.trim()).filter(Boolean) : [roleVal];
      const permissions = res.permissionsText ? res.permissionsText.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
      return {
        ...res,
        banned: !!res.banned,
        canCreateSeries: !!res.canCreateSeries,
        walletBalance: res.walletBalance || 0,
        role: roleVal,
        roles,
        permissions,
        password: res.password || undefined,
        hasCompletedSetup: res.hasCompletedSetup !== undefined ? !!res.hasCompletedSetup : false
      };
    }
    const u = this.localData.users.find(u => u.displayName.toLowerCase() === userLower);
    if (!u) return null;
    return {
      ...u,
      walletBalance: u.walletBalance || 0,
      roles: u.roles || [u.role || 'user'],
      permissions: u.permissions || [],
      password: u.password || undefined,
      hasCompletedSetup: u.hasCompletedSetup !== undefined ? !!u.hasCompletedSetup : false
    };
  }

  async createOrUpdateUser(user: Omit<User, 'createdAt' | 'banned' | 'role' | 'melliCode'> & { banned?: boolean; role?: 'admin' | 'staff' | 'user'; roles?: string[]; permissions?: string[]; melliCode?: string; firstName?: string; lastName?: string; phoneNumber?: string; canCreateSeries?: boolean; password?: string; hasCompletedSetup?: boolean }): Promise<User> {
    const now = new Date().toISOString();
    const rolesArr = user.roles || (user.role ? [user.role] : ['user']);
    const permsArr = user.permissions || [];
    const rolesText = rolesArr.join(',');
    const permissionsText = permsArr.join(',');

    if (this.isUsingMySQL && this.pool) {
      const existing = await this.getUser(user.id);
      if (existing) {
        await this.pool.execute(
          'UPDATE users SET displayName = ?, avatarUrl = ?, banned = ?, role = ?, melliCode = ?, firstName = ?, lastName = ?, phoneNumber = ?, canCreateSeries = ?, rolesText = ?, permissionsText = ?, password = ?, hasCompletedSetup = ? WHERE id = ?',
          [
            user.displayName,
            user.avatarUrl,
            user.banned !== undefined ? (user.banned ? 1 : 0) : (existing.banned ? 1 : 0),
            user.role || existing.role,
            user.melliCode || existing.melliCode || '',
            user.firstName !== undefined ? user.firstName : (existing.firstName || ''),
            user.lastName !== undefined ? user.lastName : (existing.lastName || ''),
            user.phoneNumber !== undefined ? user.phoneNumber : (existing.phoneNumber || ''),
            user.canCreateSeries !== undefined ? (user.canCreateSeries ? 1 : 0) : (existing.canCreateSeries ? 1 : 0),
            rolesText,
            permissionsText,
            user.password !== undefined ? user.password : (existing.password || null),
            user.hasCompletedSetup !== undefined ? (user.hasCompletedSetup ? 1 : 0) : (existing.hasCompletedSetup ? 1 : 0),
            user.id
          ]
        );
        return {
          ...existing,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          banned: user.banned !== undefined ? !!user.banned : existing.banned,
          role: (user.role || existing.role) as any,
          roles: rolesArr,
          permissions: permsArr,
          melliCode: user.melliCode || existing.melliCode || '',
          firstName: user.firstName !== undefined ? user.firstName : existing.firstName,
          lastName: user.lastName !== undefined ? user.lastName : existing.lastName,
          phoneNumber: user.phoneNumber !== undefined ? user.phoneNumber : existing.phoneNumber,
          canCreateSeries: user.canCreateSeries !== undefined ? !!user.canCreateSeries : existing.canCreateSeries,
          password: user.password !== undefined ? user.password : existing.password,
          hasCompletedSetup: user.hasCompletedSetup !== undefined ? !!user.hasCompletedSetup : existing.hasCompletedSetup
        };
      } else {
        const melliCode = user.melliCode || Math.floor(10000000 + Math.random() * 90000000).toString();
        const hasSetup = user.hasCompletedSetup !== undefined ? (user.hasCompletedSetup ? 1 : 0) : 0;
        await this.pool.execute(
          'INSERT INTO users (id, email, displayName, avatarUrl, banned, role, melliCode, firstName, lastName, phoneNumber, canCreateSeries, rolesText, permissionsText, password, hasCompletedSetup, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            user.id,
            user.email,
            user.displayName,
            user.avatarUrl,
            0,
            user.role || 'user',
            melliCode,
            user.firstName || '',
            user.lastName || '',
            user.phoneNumber || '',
            user.canCreateSeries ? 1 : 0,
            rolesText,
            permissionsText,
            user.password || null,
            hasSetup,
            now
          ]
        );
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          banned: false,
          role: (user.role || 'user') as any,
          roles: rolesArr,
          permissions: permsArr,
          melliCode,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          phoneNumber: user.phoneNumber || '',
          canCreateSeries: !!user.canCreateSeries,
          password: user.password,
          hasCompletedSetup: !!user.hasCompletedSetup,
          createdAt: now
        };
      }
    }

    const idx = this.localData.users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      const existing = this.localData.users[idx];
      const updated: User = {
        ...existing,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        banned: user.banned !== undefined ? !!user.banned : existing.banned,
        role: (user.role || existing.role) as any,
        roles: rolesArr,
        permissions: permsArr,
        melliCode: user.melliCode || existing.melliCode || '',
        firstName: user.firstName !== undefined ? user.firstName : existing.firstName,
        lastName: user.lastName !== undefined ? user.lastName : existing.lastName,
        phoneNumber: user.phoneNumber !== undefined ? user.phoneNumber : existing.phoneNumber,
        canCreateSeries: user.canCreateSeries !== undefined ? !!user.canCreateSeries : existing.canCreateSeries,
        password: user.password !== undefined ? user.password : existing.password,
        hasCompletedSetup: user.hasCompletedSetup !== undefined ? !!user.hasCompletedSetup : existing.hasCompletedSetup
      };
      this.localData.users[idx] = updated;
      this.saveLocalData();
      return updated;
    } else {
      const melliCode = user.melliCode || Math.floor(10000000 + Math.random() * 90000000).toString();
      const newUser: User = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        banned: false,
        role: (user.role || 'user') as any,
        roles: rolesArr,
        permissions: permsArr,
        melliCode,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
        canCreateSeries: !!user.canCreateSeries,
        password: user.password,
        hasCompletedSetup: !!user.hasCompletedSetup,
        createdAt: now
      };
      this.localData.users.push(newUser);
      this.saveLocalData();
      return newUser;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('DELETE FROM users WHERE id = ?', [id]);
      return true;
    }
    this.localData.users = this.localData.users.filter(u => u.id !== id);
    this.localData.bookmarks = this.localData.bookmarks.filter(b => b.userId !== id);
    this.localData.history = this.localData.history.filter(h => h.userId !== id);
    this.localData.ratings = this.localData.ratings.filter(r => r.userId !== id);
    this.saveLocalData();
    return true;
  }

  // -----------------------------------------------------------------
  // SERIES METHODS
  // -----------------------------------------------------------------
  async getSeries(): Promise<Series[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM series ORDER BY createdAt DESC');
      return (rows as any[]).map(r => {
        let parsedContributors: any[] = [];
        if (r.contributors) {
          try {
            parsedContributors = typeof r.contributors === 'string' ? JSON.parse(r.contributors) : r.contributors;
          } catch (e) {
            // fallback
          }
        }
        return {
          ...r,
          alternativeTitles: r.alternativeTitles ? r.alternativeTitles.split(',') : [],
          genres: r.genres ? r.genres.split(',') : [],
          tags: r.tags ? r.tags.split(',') : [],
          contributors: parsedContributors
        };
      });
    }
    return this.localData.series.map(s => ({
      ...s,
      contributors: s.contributors || []
    }));
  }

  async searchSeries(filters: {
    q?: string;
    genres?: string[];
    tags?: string[];
    status?: string;
    type?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<Series[]> {
    if (this.isUsingMySQL && this.pool) {
      let queryStr = 'SELECT * FROM series WHERE 1=1';
      const params: any[] = [];

      if (filters.q) {
        queryStr += ' AND (title LIKE ? OR author LIKE ? OR artist LIKE ? OR synopsis LIKE ?)';
        const lq = `%${filters.q}%`;
        params.push(lq, lq, lq, lq);
      }

      if (filters.status) {
        queryStr += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.type) {
        queryStr += ' AND type = ?';
        params.push(filters.type);
      }

      const [rows] = await this.pool.execute(queryStr, params);
      let list = (rows as any[]).map(r => {
        let parsedContributors: any[] = [];
        if (r.contributors) {
          try {
            parsedContributors = typeof r.contributors === 'string' ? JSON.parse(r.contributors) : r.contributors;
          } catch (e) {}
        }
        return {
          ...r,
          alternativeTitles: r.alternativeTitles ? r.alternativeTitles.split(',') : [],
          genres: r.genres ? r.genres.split(',') : [],
          tags: r.tags ? r.tags.split(',') : [],
          contributors: parsedContributors
        };
      });

      if (filters.genres && filters.genres.length > 0) {
        list = list.filter(s => filters.genres!.every(g => s.genres.includes(g)));
      }

      if (filters.tags && filters.tags.length > 0) {
        list = list.filter(s => filters.tags!.every(t => s.tags.includes(t)));
      }

      const sortBy = filters.sortBy || 'newest';
      if (sortBy === 'newest') {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (sortBy === 'oldest') {
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else if (sortBy === 'views') {
        list.sort((a, b) => (b.views || 0) - (a.views || 0));
      } else if (sortBy === 'rating') {
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sortBy === 'popular') {
        try {
          const [purchaseRows] = await this.pool.execute('SELECT seriesId, COUNT(*) as count FROM purchased_chapters GROUP BY seriesId');
          const counts = new Map<string, number>();
          (purchaseRows as any[]).forEach(r => counts.set(r.seriesId, parseInt(r.count || 0)));
          list.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
        } catch (e) {
          console.error("Error sorting by popular", e);
        }
      }

      if (filters.offset !== undefined || filters.limit !== undefined) {
        const start = filters.offset || 0;
        const end = filters.limit !== undefined ? start + filters.limit : list.length;
        list = list.slice(start, end);
      }

      return list;
    }

    let list = [...this.localData.series];

    if (filters.q) {
      const qLower = filters.q.toLowerCase();
      list = list.filter(s => 
        s.title.toLowerCase().includes(qLower) ||
        (s.author && s.author.toLowerCase().includes(qLower)) ||
        (s.artist && s.artist.toLowerCase().includes(qLower)) ||
        (s.synopsis && s.synopsis.toLowerCase().includes(qLower))
      );
    }

    if (filters.status) {
      list = list.filter(s => s.status === filters.status);
    }

    if (filters.type) {
      list = list.filter(s => s.type === filters.type);
    }

    if (filters.genres && filters.genres.length > 0) {
      list = list.filter(s => filters.genres!.every(g => (s.genres || []).includes(g)));
    }

    if (filters.tags && filters.tags.length > 0) {
      list = list.filter(s => filters.tags!.every(t => (s.tags || []).includes(t)));
    }

    const sortBy = filters.sortBy || 'newest';
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === 'views') {
      list.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'popular') {
      const counts = new Map<string, number>();
      (this.localData.purchased_chapters || []).forEach(pc => {
        counts.set(pc.seriesId, (counts.get(pc.seriesId) || 0) + 1);
      });
      list.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
    }

    if (filters.offset !== undefined || filters.limit !== undefined) {
      const start = filters.offset || 0;
      const end = filters.limit !== undefined ? start + filters.limit : list.length;
      list = list.slice(start, end);
    }

    return list.map(s => ({
      ...s,
      contributors: s.contributors || []
    }));
  }

  async getSeriesById(id: string): Promise<Series | null> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM series WHERE id = ?', [id]);
      const r = (rows as any[])[0];
      if (!r) return null;
      let parsedContributors: any[] = [];
      if (r.contributors) {
        try {
          parsedContributors = typeof r.contributors === 'string' ? JSON.parse(r.contributors) : r.contributors;
        } catch (e) {}
      }
      return {
        ...r,
        alternativeTitles: r.alternativeTitles ? r.alternativeTitles.split(',') : [],
        genres: r.genres ? r.genres.split(',') : [],
        tags: r.tags ? r.tags.split(',') : [],
        contributors: parsedContributors
      };
    }
    const found = this.localData.series.find(s => s.id === id);
    if (!found) return null;
    return {
      ...found,
      contributors: found.contributors || []
    };
  }

  async saveSeries(s: any): Promise<Series> {
    const isEdit = !!(await this.getSeriesById(s.id));
    const now = new Date().toISOString();
    
    const altTitlesStr = Array.isArray(s.alternativeTitles) ? s.alternativeTitles.join(',') : '';
    const genresStr = Array.isArray(s.genres) ? s.genres.join(',') : '';
    const tagsStr = Array.isArray(s.tags) ? s.tags.join(',') : '';
    const contributorsStr = s.contributors ? JSON.stringify(s.contributors) : '[]';

    if (this.isUsingMySQL && this.pool) {
      if (isEdit) {
        await this.pool.execute(
          `UPDATE series SET title = ?, alternativeTitles = ?, cover = ?, banner = ?, author = ?, artist = ?, synopsis = ?, genres = ?, tags = ?, status = ?, type = ?, contributors = ?, updatedAt = ? WHERE id = ?`,
          [s.title, altTitlesStr, s.cover, s.banner, s.author, s.artist, s.synopsis, genresStr, tagsStr, s.status, s.type, contributorsStr, now, s.id]
        );
      } else {
        await this.pool.execute(
          `INSERT INTO series (id, title, alternativeTitles, cover, banner, author, artist, synopsis, genres, tags, status, rating, type, views, contributors, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.title, altTitlesStr, s.cover, s.banner, s.author, s.artist, s.synopsis, genresStr, tagsStr, s.status || 'Ongoing', s.rating || 0, s.type || 'Manhwa', s.views || 0, contributorsStr, now, now]
        );
      }
      return (await this.getSeriesById(s.id))!;
    }

    const seriesObj: Series = {
      id: s.id,
      title: s.title,
      alternativeTitles: s.alternativeTitles || [],
      cover: s.cover,
      banner: s.banner,
      author: s.author,
      artist: s.artist,
      synopsis: s.synopsis,
      genres: s.genres || [],
      tags: s.tags || [],
      status: s.status || 'Ongoing',
      rating: s.rating || 0,
      type: s.type || 'Manhwa',
      views: s.views || 0,
      contributors: s.contributors || [],
      createdAt: s.createdAt || now,
      updatedAt: now
    };

    if (isEdit) {
      const idx = this.localData.series.findIndex(item => item.id === s.id);
      this.localData.series[idx] = { ...this.localData.series[idx], ...seriesObj };
    } else {
      this.localData.series.push(seriesObj);
    }
    this.saveLocalData();
    return seriesObj;
  }

  async deleteSeries(id: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('DELETE FROM series WHERE id = ?', [id]);
      return true;
    }
    this.localData.series = this.localData.series.filter(s => s.id !== id);
    this.localData.chapters = this.localData.chapters.filter(c => c.seriesId !== id);
    this.localData.bookmarks = this.localData.bookmarks.filter(b => b.seriesId !== id);
    this.localData.history = this.localData.history.filter(h => h.seriesId !== id);
    this.localData.ratings = this.localData.ratings.filter(r => r.seriesId !== id);
    this.saveLocalData();
    return true;
  }

  async incrementSeriesViews(id: string): Promise<number> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('UPDATE series SET views = views + 1 WHERE id = ?', [id]);
      const s = await this.getSeriesById(id);
      return s ? s.views : 0;
    }
    const idx = this.localData.series.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.localData.series[idx].views = (this.localData.series[idx].views || 0) + 1;
      this.saveLocalData();
      return this.localData.series[idx].views;
    }
    return 0;
  }

  // -----------------------------------------------------------------
  // CHAPTER METHODS
  // -----------------------------------------------------------------
  async getChapters(seriesId: string): Promise<Chapter[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM chapters WHERE seriesId = ? ORDER BY number DESC', [seriesId]);
      return (rows as any[]).map(r => {
        let parsedSubmissions: any[] = [];
        if (r.submissions) {
          try {
            parsedSubmissions = typeof r.submissions === 'string' ? JSON.parse(r.submissions) : r.submissions;
          } catch (e) {}
        }
        return {
          ...r,
          images: r.images ? r.images.split(',') : [],
          isPending: r.isPending === 1 || r.isPending === true,
          submissions: parsedSubmissions
        };
      });
    }
    return this.localData.chapters
      .filter(c => c.seriesId === seriesId)
      .map(c => ({
        ...c,
        isPending: !!c.isPending,
        submissions: c.submissions || []
      }))
      .sort((a, b) => b.number - a.number);
  }

  async getChapterById(seriesId: string, id: string): Promise<Chapter | null> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM chapters WHERE seriesId = ? AND id = ?', [seriesId, id]);
      const r = (rows as any[])[0];
      if (!r) return null;
      let parsedSubmissions: any[] = [];
      if (r.submissions) {
        try {
          parsedSubmissions = typeof r.submissions === 'string' ? JSON.parse(r.submissions) : r.submissions;
        } catch (e) {}
      }
      return {
        ...r,
        images: r.images ? r.images.split(',') : [],
        isPending: r.isPending === 1 || r.isPending === true,
        submissions: parsedSubmissions
      };
    }
    const found = this.localData.chapters.find(c => c.seriesId === seriesId && c.id === id);
    if (!found) return null;
    return {
      ...found,
      isPending: !!found.isPending,
      submissions: found.submissions || []
    };
  }

  async saveChapter(ch: any): Promise<Chapter> {
    const isEdit = !!(await this.getChapterById(ch.seriesId, ch.id));
    const now = new Date().toISOString();
    
    const imagesStr = Array.isArray(ch.images) ? ch.images.join(',') : '';
    const submissionsStr = ch.submissions ? JSON.stringify(ch.submissions) : '[]';
    const isPendingVal = (ch.isPending === true || ch.isPending === 1) ? 1 : 0;

    if (this.isUsingMySQL && this.pool) {
      if (isEdit) {
        await this.pool.execute(
          `UPDATE chapters SET number = ?, title = ?, images = ?, isPending = ?, submissions = ?, updatedAt = ? WHERE seriesId = ? AND id = ?`,
          [ch.number, ch.title || '', imagesStr, isPendingVal, submissionsStr, now, ch.seriesId, ch.id]
        );
      } else {
        await this.pool.execute(
          `INSERT INTO chapters (id, seriesId, number, title, images, views, isPending, submissions, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ch.id, ch.seriesId, ch.number, ch.title || '', imagesStr, ch.views || 0, isPendingVal, submissionsStr, now, now]
        );
      }
      return (await this.getChapterById(ch.seriesId, ch.id))!;
    }

    const chapterObj: Chapter = {
      id: ch.id,
      seriesId: ch.seriesId,
      number: parseFloat(ch.number),
      title: ch.title || '',
      images: ch.images || [],
      views: ch.views || 0,
      isPending: ch.isPending === true || ch.isPending === 1,
      submissions: ch.submissions || [],
      createdAt: ch.createdAt || now,
      updatedAt: now
    };

    if (isEdit) {
      const idx = this.localData.chapters.findIndex(item => item.id === ch.id);
      this.localData.chapters[idx] = { ...this.localData.chapters[idx], ...chapterObj };
    } else {
      this.localData.chapters.push(chapterObj);
    }
    this.saveLocalData();
    return chapterObj;
  }

  async deleteChapter(seriesId: string, id: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('DELETE FROM chapters WHERE seriesId = ? AND id = ?', [seriesId, id]);
      return true;
    }
    this.localData.chapters = this.localData.chapters.filter(c => !(c.seriesId === seriesId && c.id === id));
    this.saveLocalData();
    return true;
  }

  async incrementChapterViews(seriesId: string, id: string): Promise<number> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('UPDATE chapters SET views = views + 1 WHERE seriesId = ? AND id = ?', [seriesId, id]);
      const ch = await this.getChapterById(seriesId, id);
      return ch ? ch.views : 0;
    }
    const idx = this.localData.chapters.findIndex(c => c.seriesId === seriesId && c.id === id);
    if (idx >= 0) {
      this.localData.chapters[idx].views = (this.localData.chapters[idx].views || 0) + 1;
      this.saveLocalData();
      return this.localData.chapters[idx].views;
    }
    return 0;
  }

  // -----------------------------------------------------------------
  // COMMENTS METHODS
  // -----------------------------------------------------------------
  async getComments(chapterId: string): Promise<Comment[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM comments WHERE chapterId = ? ORDER BY createdAt DESC', [chapterId]);
      return (rows as any[]).map(r => ({
        ...r,
        likes: r.likes ? JSON.parse(r.likes) : [],
        dislikes: r.dislikes ? JSON.parse(r.dislikes) : []
      }));
    }
    return this.localData.comments.filter(c => c.chapterId === chapterId);
  }

  async getCommentById(id: string): Promise<Comment | null> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM comments WHERE id = ?', [id]);
      const r = (rows as any[])[0];
      if (!r) return null;
      return {
        ...r,
        likes: r.likes ? JSON.parse(r.likes) : [],
        dislikes: r.dislikes ? JSON.parse(r.dislikes) : []
      };
    }
    return this.localData.comments.find(c => c.id === id) || null;
  }

  async addComment(c: any): Promise<Comment> {
    const now = new Date().toISOString();
    const likesStr = JSON.stringify([]);
    const dislikesStr = JSON.stringify([]);

    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute(
        `INSERT INTO comments (id, chapterId, userId, userName, userAvatar, content, likes, dislikes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.chapterId, c.userId, c.userName, c.userAvatar || '', c.content, likesStr, dislikesStr, now]
      );
      return (await this.getCommentById(c.id))!;
    }

    const commentObj: Comment = {
      id: c.id,
      chapterId: c.chapterId,
      userId: c.userId,
      userName: c.userName,
      userAvatar: c.userAvatar || '',
      content: c.content,
      likes: [],
      dislikes: [],
      createdAt: now
    };

    this.localData.comments.push(commentObj);
    this.saveLocalData();
    return commentObj;
  }

  async toggleCommentReaction(id: string, userId: string, type: 'like' | 'dislike'): Promise<Comment | null> {
    const comment = await this.getCommentById(id);
    if (!comment) return null;

    let likes = [...comment.likes];
    let dislikes = [...comment.dislikes];

    if (type === 'like') {
      if (likes.includes(userId)) {
        likes = likes.filter(uid => uid !== userId);
      } else {
        likes.push(userId);
        dislikes = dislikes.filter(uid => uid !== userId);
      }
    } else {
      if (dislikes.includes(userId)) {
        dislikes = dislikes.filter(uid => uid !== userId);
      } else {
        dislikes.push(userId);
        likes = likes.filter(uid => uid !== userId);
      }
    }

    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute(
        'UPDATE comments SET likes = ?, dislikes = ? WHERE id = ?',
        [JSON.stringify(likes), JSON.stringify(dislikes), id]
      );
      return await this.getCommentById(id);
    }

    const idx = this.localData.comments.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.localData.comments[idx].likes = likes;
      this.localData.comments[idx].dislikes = dislikes;
      this.saveLocalData();
    }
    return this.localData.comments[idx];
  }

  async deleteComment(id: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('DELETE FROM comments WHERE id = ?', [id]);
      return true;
    }
    this.localData.comments = this.localData.comments.filter(c => c.id !== id);
    this.saveLocalData();
    return true;
  }

  async updateCommentContent(id: string, content: string): Promise<Comment | null> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('UPDATE comments SET content = ? WHERE id = ?', [content, id]);
      return await this.getCommentById(id);
    }
    const idx = this.localData.comments.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.localData.comments[idx].content = content;
      this.saveLocalData();
      return this.localData.comments[idx];
    }
    return null;
  }

  // -----------------------------------------------------------------
  // BOOKMARK METHODS
  // -----------------------------------------------------------------
  async getBookmarks(userId: string): Promise<Bookmark[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM bookmarks WHERE userId = ?', [userId]);
      return rows as Bookmark[];
    }
    return this.localData.bookmarks.filter(b => b.userId === userId);
  }

  async getBookmarksBySeries(seriesId: string): Promise<Bookmark[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM bookmarks WHERE seriesId = ?', [seriesId]);
      return rows as Bookmark[];
    }
    return this.localData.bookmarks.filter(b => b.seriesId === seriesId);
  }

  async toggleBookmark(userId: string, seriesId: string): Promise<boolean> {
    const bookmarks = await this.getBookmarks(userId);
    const existing = bookmarks.some(b => b.seriesId === seriesId);
    const now = new Date().toISOString();

    if (this.isUsingMySQL && this.pool) {
      if (existing) {
        await this.pool.execute('DELETE FROM bookmarks WHERE userId = ? AND seriesId = ?', [userId, seriesId]);
        return false;
      } else {
        await this.pool.execute('INSERT INTO bookmarks (userId, seriesId, createdAt) VALUES (?, ?, ?)', [userId, seriesId, now]);
        return true;
      }
    }

    if (existing) {
      this.localData.bookmarks = this.localData.bookmarks.filter(b => !(b.userId === userId && b.seriesId === seriesId));
    } else {
      this.localData.bookmarks.push({ userId, seriesId, createdAt: now });
    }
    this.saveLocalData();
    return !existing;
  }

  // -----------------------------------------------------------------
  // HISTORY METHODS
  // -----------------------------------------------------------------
  async getHistory(userId: string): Promise<HistoryItem[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM history WHERE userId = ? ORDER BY updatedAt DESC', [userId]);
      return rows as HistoryItem[];
    }
    return this.localData.history.filter(h => h.userId === userId).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async saveHistoryItem(h: any): Promise<void> {
    const now = new Date().toISOString();
    const history = await this.getHistory(h.userId);
    const existing = history.find(item => item.seriesId === h.seriesId);

    if (this.isUsingMySQL && this.pool) {
      if (existing) {
        await this.pool.execute(
          'UPDATE history SET chapterId = ?, chapterNumber = ?, updatedAt = ? WHERE userId = ? AND seriesId = ?',
          [h.chapterId, h.chapterNumber, now, h.userId, h.seriesId]
        );
      } else {
        await this.pool.execute(
          'INSERT INTO history (userId, seriesId, chapterId, chapterNumber, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [h.userId, h.seriesId, h.chapterId, h.chapterNumber, now]
        );
      }
      return;
    }

    const item: HistoryItem = {
      userId: h.userId,
      seriesId: h.seriesId,
      chapterId: h.chapterId,
      chapterNumber: parseFloat(h.chapterNumber),
      updatedAt: now
    };

    if (existing) {
      const idx = this.localData.history.findIndex(item => item.userId === h.userId && item.seriesId === h.seriesId);
      this.localData.history[idx] = item;
    } else {
      this.localData.history.push(item);
    }
    this.saveLocalData();
  }

  // -----------------------------------------------------------------
  // RATING METHODS
  // -----------------------------------------------------------------
  async getRatings(seriesId: string): Promise<Rating[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM ratings WHERE seriesId = ?', [seriesId]);
      return rows as Rating[];
    }
    return this.localData.ratings.filter(r => r.seriesId === seriesId);
  }

  async saveRating(userId: string, seriesId: string, score: number): Promise<void> {
    const ratings = await this.getRatings(seriesId);
    const existing = ratings.find(r => r.userId === userId);
    const now = new Date().toISOString();

    if (this.isUsingMySQL && this.pool) {
      if (existing) {
        await this.pool.execute(
          'UPDATE ratings SET score = ? WHERE userId = ? AND seriesId = ?',
          [score, userId, seriesId]
        );
      } else {
        await this.pool.execute(
          'INSERT INTO ratings (userId, seriesId, score, createdAt) VALUES (?, ?, ?, ?)',
          [userId, seriesId, score, now]
        );
      }
    } else {
      const item: Rating = { userId, seriesId, score, createdAt: now };
      if (existing) {
        const idx = this.localData.ratings.findIndex(r => r.userId === userId && r.seriesId === seriesId);
        this.localData.ratings[idx] = item;
      } else {
        this.localData.ratings.push(item);
      }
      this.saveLocalData();
    }

    // Refresh average rating inside Series
    const allRatings = await this.getRatings(seriesId);
    const sum = allRatings.reduce((acc, current) => acc + current.score, 0);
    const average = allRatings.length > 0 ? sum / allRatings.length : 0;

    await this.updateSeriesRating(seriesId, average);
  }

  private async updateSeriesRating(seriesId: string, score: number) {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('UPDATE series SET rating = ? WHERE id = ?', [score, seriesId]);
      return;
    }
    const idx = this.localData.series.findIndex(s => s.id === seriesId);
    if (idx >= 0) {
      this.localData.series[idx].rating = score;
      this.saveLocalData();
    }
  }

  async adjustRating(seriesId: string, score: number, action: 'increment' | 'decrement'): Promise<void> {
    const now = new Date().toISOString();
    if (action === 'increment') {
      const dummyUserId = `sys_adj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      if (this.isUsingMySQL && this.pool) {
        await this.pool.execute(
          'INSERT INTO ratings (userId, seriesId, score, createdAt) VALUES (?, ?, ?, ?)',
          [dummyUserId, seriesId, score, now]
        );
      } else {
        this.localData.ratings.push({ userId: dummyUserId, seriesId, score, createdAt: now });
        this.saveLocalData();
      }
    } else {
      // Find one rating with that score to delete
      const ratings = await this.getRatings(seriesId);
      const toDelete = ratings.find(r => r.score === score);
      if (toDelete) {
        if (this.isUsingMySQL && this.pool) {
          await this.pool.execute(
            'DELETE FROM ratings WHERE userId = ? AND seriesId = ?',
            [toDelete.userId, seriesId]
          );
        } else {
          this.localData.ratings = this.localData.ratings.filter(r => !(r.userId === toDelete.userId && r.seriesId === seriesId));
          this.saveLocalData();
        }
      }
    }

    // Refresh average rating inside Series
    const allRatings = await this.getRatings(seriesId);
    const sum = allRatings.reduce((acc, current) => acc + current.score, 0);
    const average = allRatings.length > 0 ? sum / allRatings.length : 0;
    await this.updateSeriesRating(seriesId, average);
  }

  // -----------------------------------------------------------------
  // SETTINGS METHODS
  // -----------------------------------------------------------------
  async getSettings(id: string): Promise<any> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM settings WHERE id = ?', [id]);
      const r = (rows as any[])[0];
      return r ? JSON.parse(r.val) : this.localData.settings[id];
    }
    return this.localData.settings[id];
  }

  async saveSettings(id: string, val: any): Promise<void> {
    if (this.isUsingMySQL && this.pool) {
      const existing = await this.getSettings(id);
      const valStr = JSON.stringify(val);
      if (existing) {
        await this.pool.execute('UPDATE settings SET val = ? WHERE id = ?', [valStr, id]);
      } else {
        await this.pool.execute('INSERT INTO settings (id, val) VALUES (?, ?)', [id, valStr]);
      }
      return;
    }
    this.localData.settings[id] = val;
    this.saveLocalData();
  }

  // -----------------------------------------------------------------
  // SEED METHOD
  // -----------------------------------------------------------------
  async seed(mockSeries: any[], mockAdmins: string[]) {
    console.log('Seeding Database with sample records...');
    for (const s of mockSeries) {
      await this.saveSeries({
        id: s.id,
        title: s.title,
        alternativeTitles: s.alternativeTitles || [],
        cover: s.cover,
        banner: s.banner,
        author: s.author,
        artist: s.artist,
        synopsis: s.synopsis,
        genres: s.genres || [],
        tags: s.tags || [],
        status: s.status || 'Ongoing',
        rating: s.rating || 0,
        type: s.type || 'Manhwa',
        views: s.views || 0,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });

      if (s.chapters) {
        for (const ch of s.chapters) {
          await this.saveChapter({
            id: ch.id,
            seriesId: s.id,
            number: ch.number,
            title: ch.title || '',
            images: ch.images || [],
            views: ch.views || 0,
            createdAt: ch.createdAt,
            updatedAt: ch.updatedAt
          });
        }
      }
    }

    // Seed default admin users
    for (const uid of mockAdmins) {
      await this.createOrUpdateUser({
        id: uid,
        displayName: 'Site Admin',
        email: 'admin@example.com',
        avatarUrl: '',
        role: 'admin',
        banned: false
      });
    }

    console.log('Database seeded successfully.');
  }

  // -----------------------------------------------------------------
  // ADMIN DASHBOARD HELPER METHODS
  // -----------------------------------------------------------------
  async getStats(): Promise<{ totalSeries: number; totalChapters: number; totalUsers: number }> {
    let totalSeries = 0;
    let totalChapters = 0;
    let totalUsers = 0;
    if (this.isUsingMySQL && this.pool) {
      try {
        const [[{ count: sCount }]] = await this.pool.execute('SELECT COUNT(*) as count FROM series') as any;
        const [[{ count: cCount }]] = await this.pool.execute('SELECT COUNT(*) as count FROM chapters') as any;
        const [[{ count: uCount }]] = await this.pool.execute('SELECT COUNT(*) as count FROM users') as any;
        totalSeries = sCount;
        totalChapters = cCount;
        totalUsers = uCount;
      } catch (e) {
        console.error("Error running stats SQL query", e);
      }
    } else {
      totalSeries = this.localData.series.length;
      totalChapters = this.localData.chapters.length;
      totalUsers = this.localData.users.length;
    }
    return { totalSeries, totalChapters, totalUsers };
  }

  async getAllComments(): Promise<Comment[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM comments ORDER BY createdAt DESC');
      return (rows as any[]).map(r => ({
        ...r,
        likes: r.likes ? JSON.parse(r.likes) : [],
        dislikes: r.dislikes ? JSON.parse(r.dislikes) : []
      }));
    }
    return this.localData.comments;
  }

  async changeUserRole(id: string, role: 'admin' | 'staff' | 'user'): Promise<User | null> {
    const user = await this.getUser(id);
    if (!user) return null;
    return await this.createOrUpdateUser({ ...user, role });
  }

  async updateUserRolesAndPermissions(id: string, roles: string[], permissions: string[], melliCode?: string): Promise<User | null> {
    const user = await this.getUser(id);
    if (!user) return null;
    
    let standardRole: 'admin' | 'staff' | 'user' = 'user';
    if (roles.includes('super_admin') || roles.includes('admin')) {
      standardRole = 'admin';
    } else if (roles.includes('translator') || roles.includes('cleaner') || roles.includes('editor')) {
      standardRole = 'staff';
    }
    
    user.role = standardRole;
    user.roles = roles;
    user.permissions = permissions;
    if (melliCode !== undefined) {
      user.melliCode = melliCode;
    }
    
    return await this.createOrUpdateUser(user);
  }

  async setUserCanCreateSeries(id: string, canCreateSeries: boolean): Promise<User | null> {
    const user = await this.getUser(id);
    if (!user) return null;
    return await this.createOrUpdateUser({ ...user, canCreateSeries });
  }

  async getReports(): Promise<any[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM reports ORDER BY createdAt DESC');
      return rows as any[];
    }
    return this.localData.reports || [];
  }

  async saveReport(r: any): Promise<any> {
    const now = new Date().toISOString();
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM reports WHERE id = ?', [r.id]);
      const existing = (rows as any[])[0];
      if (existing) {
        await this.pool.execute(
          'UPDATE reports SET status = ? WHERE id = ?',
          [r.status, r.id]
        );
      } else {
        await this.pool.execute(
          'INSERT INTO reports (id, userId, userName, title, content, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [r.id, r.userId, r.userName, r.title, r.content, r.status || 'pending', now]
        );
      }
      const [updatedRows] = await this.pool.execute('SELECT * FROM reports WHERE id = ?', [r.id]);
      return (updatedRows as any[])[0];
    }
    
    if (!this.localData.reports) this.localData.reports = [];
    const idx = this.localData.reports.findIndex(item => item.id === r.id);
    const reportObj = {
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      title: r.title,
      content: r.content,
      status: r.status || 'pending',
      createdAt: r.createdAt || now
    };
    if (idx >= 0) {
      this.localData.reports[idx] = reportObj;
    } else {
      this.localData.reports.push(reportObj);
    }
    this.saveLocalData();
    return reportObj;
  }

  async deleteReport(id: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('DELETE FROM reports WHERE id = ?', [id]);
      return true;
    }
    if (this.localData.reports) {
      this.localData.reports = this.localData.reports.filter(r => r.id !== id);
      this.saveLocalData();
    }
    return true;
  }

  // -----------------------------------------------------------------
  // NOTIFICATION METHODS
  // -----------------------------------------------------------------
  async getNotifications(userId: string): Promise<Notification[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC', [userId]);
      return (rows as any[]).map(r => ({
        id: r.id,
        userId: r.userId,
        type: r.type,
        title: r.title,
        body: r.body || '',
        link: r.link || '',
        read: r.isRead === 1,
        createdAt: r.createdAt
      }));
    }
    if (!this.localData.notifications) this.localData.notifications = [];
    return this.localData.notifications.filter(n => n.userId === userId).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addNotification(userId: string, type: string, title: string, body: string, link: string): Promise<Notification> {
    const id = `notif-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const now = new Date().toISOString();
    const notif: Notification = {
      id,
      userId,
      type,
      title,
      body,
      link,
      read: false,
      createdAt: now
    };

    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute(
        'INSERT INTO notifications (id, userId, type, title, body, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, userId, type, title, body, link, 0, now]
      );
    } else {
      if (!this.localData.notifications) this.localData.notifications = [];
      this.localData.notifications.push(notif);
      this.saveLocalData();
    }

    return notif;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('UPDATE notifications SET isRead = 1 WHERE id = ?', [id]);
      return true;
    }
    if (!this.localData.notifications) this.localData.notifications = [];
    const idx = this.localData.notifications.findIndex(n => n.id === id);
    if (idx >= 0) {
      this.localData.notifications[idx].read = true;
      this.saveLocalData();
      return true;
    }
    return false;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      await this.pool.execute('UPDATE notifications SET isRead = 1 WHERE userId = ?', [userId]);
      return true;
    }
    if (!this.localData.notifications) this.localData.notifications = [];
    this.localData.notifications = this.localData.notifications.map(n => n.userId === userId ? { ...n, read: true } : n);
    this.saveLocalData();
    return true;
  }

  // -----------------------------------------------------------------
  // WALLET METHODS
  // -----------------------------------------------------------------
  async getWalletTransactions(userId?: string): Promise<WalletTransaction[]> {
    if (this.isUsingMySQL && this.pool) {
      let query = 'SELECT * FROM wallet_transactions';
      const params: any[] = [];
      if (userId) {
        query += ' WHERE userId = ?';
        params.push(userId);
      }
      query += ' ORDER BY createdAt DESC';
      const [rows] = await this.pool.execute(query, params);
      return rows as WalletTransaction[];
    }
    if (!this.localData.wallet_transactions) this.localData.wallet_transactions = [];
    let list = [...this.localData.wallet_transactions];
    if (userId) {
      list = list.filter(t => t.userId === userId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addWalletTransaction(
    userId: string,
    amount: number,
    type: string,
    description: string,
    creatorId: string,
    creatorName: string
  ): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const newBalance = (user.walletBalance || 0) + amount;
    const transId = `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const now = new Date().toISOString();

    if (this.isUsingMySQL && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();
        
        // Update user balance
        await conn.execute('UPDATE users SET walletBalance = ? WHERE id = ?', [newBalance, userId]);

        // Insert transaction log
        await conn.execute(
          'INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [transId, userId, user.displayName, amount, type, description, creatorId, creatorName, now]
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } else {
      // Local database update
      const uIdx = this.localData.users.findIndex(u => u.id === userId);
      if (uIdx >= 0) {
        this.localData.users[uIdx].walletBalance = newBalance;
      } else {
        user.walletBalance = newBalance;
        this.localData.users.push(user);
      }

      if (!this.localData.wallet_transactions) {
        this.localData.wallet_transactions = [];
      }

      this.localData.wallet_transactions.push({
        id: transId,
        userId,
        userName: user.displayName,
        amount,
        type,
        description,
        creatorId,
        creatorName,
        createdAt: now
      });

      this.saveLocalData();
    }

    return true;
  }

  // -----------------------------------------------------------------
  // PURCHASED CHAPTERS METHODS
  // -----------------------------------------------------------------
  async getPurchasedChapters(userId: string): Promise<PurchasedChapter[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM purchased_chapters WHERE userId = ?', [userId]);
      return rows as PurchasedChapter[];
    }
    if (!this.localData.purchased_chapters) this.localData.purchased_chapters = [];
    return this.localData.purchased_chapters.filter(pc => pc.userId === userId);
  }

  async hasPurchasedChapter(userId: string, seriesId: string, chapterId: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute(
        'SELECT 1 FROM purchased_chapters WHERE userId = ? AND seriesId = ? AND chapterId = ? LIMIT 1',
        [userId, seriesId, chapterId]
      );
      return (rows as any[]).length > 0;
    }
    if (!this.localData.purchased_chapters) this.localData.purchased_chapters = [];
    return this.localData.purchased_chapters.some(pc => pc.userId === userId && pc.seriesId === seriesId && pc.chapterId === chapterId);
  }

  async purchaseChapter(
    userId: string,
    seriesId: string,
    chapterId: string
  ): Promise<{ success: boolean; error?: string; newBalance?: number }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, error: 'کاربر یافت نشد' };
    }

    const chapter = await this.getChapterById(seriesId, chapterId);
    if (!chapter) {
      return { success: false, error: 'چپتر یافت نشد' };
    }

    const series = await this.getSeriesById(seriesId);
    const seriesTitle = series?.title || 'مانهوا';

    const alreadyPurchased = await this.hasPurchasedChapter(userId, seriesId, chapterId);
    if (alreadyPurchased) {
      return { success: true, newBalance: user.walletBalance || 0 };
    }

    const price = 400; // 400 Tomans
    const currentBalance = user.walletBalance || 0;
    if (currentBalance < price) {
      return { success: false, error: 'موجودی کیف پول شما کافی نیست. لطفا برای ادامه مطالعه ابتدا حساب خود را شارژ کنید.' };
    }

    const newBalance = currentBalance - price;
    const purchaseId = `pc-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const transId = `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const now = new Date().toISOString();

    // Calculate revenue distribution
    const approvedContributors = series?.contributors || [];
    const translators = approvedContributors.filter((c: any) => c.status === 'approved' && c.role === 'translator');
    const editors = approvedContributors.filter((c: any) => c.status === 'approved' && c.role === 'editor');
    const cleaners = approvedContributors.filter((c: any) => c.status === 'approved' && (c.role === 'cleaner' || c.role === 'typesetter'));

    const distribution: { userId: string; roleLabel: string; amount: number }[] = [];

    if (translators.length > 0) {
      const share = Math.floor((price * 0.2) / translators.length);
      translators.forEach((t: any) => {
        distribution.push({ userId: t.userId, roleLabel: 'مترجم', amount: share });
      });
    }

    if (editors.length > 0) {
      const share = Math.floor((price * 0.3) / editors.length);
      editors.forEach((e: any) => {
        distribution.push({ userId: e.userId, roleLabel: 'ادیتور', amount: share });
      });
    }

    if (cleaners.length > 0) {
      const share = Math.floor((price * 0.3) / cleaners.length);
      cleaners.forEach((c: any) => {
        distribution.push({ userId: c.userId, roleLabel: 'کلینر', amount: share });
      });
    }

    // Group by userId to handle the case where same person is both editor and cleaner (receives 60%)
    const userDistributionMap: Record<string, { amount: number; roles: string[] }> = {};
    distribution.forEach(d => {
      if (!userDistributionMap[d.userId]) {
        userDistributionMap[d.userId] = { amount: 0, roles: [] };
      }
      userDistributionMap[d.userId].amount += d.amount;
      userDistributionMap[d.userId].roles.push(d.roleLabel);
    });

    let totalDistributed = 0;
    Object.values(userDistributionMap).forEach(d => {
      totalDistributed += d.amount;
    });

    const adminProfit = price - totalDistributed;

    if (this.isUsingMySQL && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();

        // Deduct balance from user
        await conn.execute('UPDATE users SET walletBalance = ? WHERE id = ?', [newBalance, userId]);

        // Insert transaction log for purchaser
        const description = `خرید چپتر ${chapter.number} از مانهوا/مانگای ${seriesTitle}`;
        await conn.execute(
          'INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [transId, userId, user.displayName, -price, 'purchase', description, 'system', 'سیستم', now]
        );

        // Insert purchased chapter record
        await conn.execute(
          'INSERT INTO purchased_chapters (id, userId, seriesId, chapterId, createdAt) VALUES (?, ?, ?, ?, ?)',
          [purchaseId, userId, seriesId, chapterId, now]
        );

        // Credit contributors
        for (const [contribUserId, info] of Object.entries(userDistributionMap)) {
          const [contribRows] = await conn.execute('SELECT * FROM users WHERE id = ?', [contribUserId]);
          const contribUser = (contribRows as any[])[0];
          if (contribUser) {
            const newContribBalance = (contribUser.walletBalance || 0) + info.amount;
            await conn.execute('UPDATE users SET walletBalance = ? WHERE id = ?', [newContribBalance, contribUserId]);
            
            const contribTransId = `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const rolesStr = info.roles.join(' و ');
            const desc = `سهم مشارکت به عنوان ${rolesStr} در فروش چپتر ${chapter.number} از مانهوا/مانگای ${seriesTitle}`;
            await conn.execute(
              'INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [contribTransId, contribUserId, contribUser.displayName, info.amount, 'credit', desc, 'system', 'سیستم', now]
            );
          }
        }

        // Credit site profit to Global Admin
        const [adminRows] = await conn.execute("SELECT * FROM users WHERE role = 'admin' OR email = 'amirrezaveisi45@gmail.com' LIMIT 1");
        const adminUser = (adminRows as any[])[0];
        if (adminUser) {
          const newAdminBalance = (adminUser.walletBalance || 0) + adminProfit;
          await conn.execute('UPDATE users SET walletBalance = ? WHERE id = ?', [newAdminBalance, adminUser.id]);
          
          const adminTransId = `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
          const desc = `سود سایت از فروش چپتر ${chapter.number} از مانهوا/مانگای ${seriesTitle}`;
          await conn.execute(
            'INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [adminTransId, adminUser.id, adminUser.displayName, adminProfit, 'credit', desc, 'system', 'سیستم', now]
          );
        }

        await conn.commit();
      } catch (err: any) {
        await conn.rollback();
        console.error('MySQL Transaction purchase error:', err);
        return { success: false, error: err.message };
      } finally {
        conn.release();
      }
    } else {
      // Local database
      const uIdx = this.localData.users.findIndex(u => u.id === userId);
      if (uIdx >= 0) {
        this.localData.users[uIdx].walletBalance = newBalance;
      } else {
        user.walletBalance = newBalance;
        this.localData.users.push(user);
      }

      if (!this.localData.wallet_transactions) {
        this.localData.wallet_transactions = [];
      }
      const description = `خرید چپتر ${chapter.number} از مانهوا/مانگای ${seriesTitle}`;
      this.localData.wallet_transactions.push({
        id: transId,
        userId,
        userName: user.displayName,
        amount: -price,
        type: 'purchase',
        description,
        creatorId: 'system',
        creatorName: 'سیستم',
        createdAt: now
      });

      if (!this.localData.purchased_chapters) {
        this.localData.purchased_chapters = [];
      }
      this.localData.purchased_chapters.push({
        id: purchaseId,
        userId,
        seriesId,
        chapterId,
        createdAt: now
      });

      // Credit contributors
      for (const [contribUserId, info] of Object.entries(userDistributionMap)) {
        const contribUserIdx = this.localData.users.findIndex(u => u.id === contribUserId);
        if (contribUserIdx >= 0) {
          const contribUser = this.localData.users[contribUserIdx];
          const newContribBalance = (contribUser.walletBalance || 0) + info.amount;
          this.localData.users[contribUserIdx].walletBalance = newContribBalance;
          
          const contribTransId = `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
          const rolesStr = info.roles.join(' و ');
          const desc = `سهم مشارکت به عنوان ${rolesStr} در فروش چپتر ${chapter.number} از مانهوا/مانگای ${seriesTitle}`;
          this.localData.wallet_transactions.push({
            id: contribTransId,
            userId: contribUserId,
            userName: contribUser.displayName,
            amount: info.amount,
            type: 'credit',
            description: desc,
            creatorId: 'system',
            creatorName: 'سیستم',
            createdAt: now
          });
        }
      }

      // Credit site profit to Global Admin
      const adminUserIdx = this.localData.users.findIndex(u => u.role === 'admin' || u.email === 'amirrezaveisi45@gmail.com');
      if (adminUserIdx >= 0) {
        const adminUser = this.localData.users[adminUserIdx];
        const newAdminBalance = (adminUser.walletBalance || 0) + adminProfit;
        this.localData.users[adminUserIdx].walletBalance = newAdminBalance;
        
        const adminTransId = `tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const desc = `سود سایت از فروش چپتر ${chapter.number} از مانهوا/مانگای ${seriesTitle}`;
        this.localData.wallet_transactions.push({
          id: adminTransId,
          userId: adminUser.id,
          userName: adminUser.displayName,
          amount: adminProfit,
          type: 'credit',
          description: desc,
          creatorId: 'system',
          creatorName: 'سیستم',
          createdAt: now
        });
      }

      this.saveLocalData();
    }

    return { success: true, newBalance };
  }
}

export const dbManager = new DatabaseManager();
