import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

function deleteUploadedFile(urlOrPath: string) {
  if (!urlOrPath) return;
  try {
    let filename = "";
    if (urlOrPath.includes('/uploads/')) {
      filename = urlOrPath.split('/uploads/').pop() || "";
    } else {
      filename = path.basename(urlOrPath);
    }
    filename = filename.split('?')[0];

    if (filename) {
      const filePath = path.join(process.cwd(), 'uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      }
    }
  } catch (err) {
    console.error(`Failed to delete file ${urlOrPath}:`, err);
  }
}

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
  isHero?: boolean;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
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
  status?: string;
  isPrivate?: boolean;
  revisionNote?: string;
  submissions?: any[];
  contributors?: any;
  publishAt?: any;
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
  workStatus?: string;
  statusMessage?: string;
  lastActiveAt?: string;
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
  chapterNumber?: number;
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
  public pool: mysql.Pool | null = null;
  public isUsingMySQL = false;
  public localData: {
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
    const dbHost = process.env.DB_HOST;
    const dbUser = process.env.DB_USER || 'mrvir111_MrV';
    const dbPassword = process.env.DB_PASSWORD || 'gB3(td@~iji9H2~d';
    const dbName = process.env.DB_NAME || 'mrvir111_mangata_db';
    const dbPort = parseInt(process.env.DB_PORT || '3306');

    const useMySQL = Boolean(dbHost && dbUser && dbName);
    
    if (useMySQL) {
      try {
        console.log(`Handshaking with MySQL DB at ${dbHost}:${dbPort}/${dbName}...`);
        this.pool = mysql.createPool({
          host: dbHost,
          port: dbPort,
          user: dbUser,
          password: dbPassword,
          database: dbName,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          charset: 'utf8mb4'
        });

        this.pool.on('connection', (connection: any) => {
          connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
          connection.query("SET CHARACTER SET utf8mb4");
        });
        
        // Test connection
        const conn = await this.pool.getConnection();
        await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        await conn.query("SET CHARACTER SET utf8mb4");
        console.log('MySQL Database Connected Successfully with full utf8mb4 support!');
        conn.release();
        
        this.isUsingMySQL = true;
        await this.createMySQLTables();
      } catch (err: any) {
        console.warn('MySQL Connection failed. Falling back to local JSON database persistence.', err?.message || err);
        this.isUsingMySQL = false;
        this.loadLocalData();
      }
    } else {
      console.log('No external MySQL DB_HOST configured. Operating with local JSON database.');
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
  public saveLocalData() {
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
      try {
        await this.pool.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        await this.pool.query("SET CHARACTER SET utf8mb4");
        await this.pool.execute("ALTER DATABASE CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci");
      } catch (e) {
        // Ignore if database alter is restricted
      }

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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
          isHero TINYINT(1) DEFAULT 0,
          seoTitle TEXT,
          seoDescription TEXT,
          seoKeywords TEXT,
          slug VARCHAR(255) DEFAULT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS bookmarks (
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, seriesId),
          FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS history (
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          chapterId VARCHAR(100) NOT NULL,
          chapterNumber DOUBLE NOT NULL,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, seriesId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS ratings (
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          score DOUBLE NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, seriesId),
          FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS settings (
          id VARCHAR(50) PRIMARY KEY,
          val TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS reports (
          id VARCHAR(100) PRIMARY KEY,
          userId VARCHAR(100) NOT NULL,
          userName VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(100) PRIMARY KEY,
          userId VARCHAR(100) NOT NULL,
          type VARCHAR(50) DEFAULT 'system',
          title VARCHAR(255) NOT NULL,
          body TEXT,
          link VARCHAR(255),
          isRead TINYINT(1) DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS purchased_chapters (
          id VARCHAR(100) PRIMARY KEY,
          userId VARCHAR(100) NOT NULL,
          seriesId VARCHAR(100) NOT NULL,
          chapterId VARCHAR(100) NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_chap (userId, seriesId, chapterId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
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
        `ALTER TABLE series ADD COLUMN IF NOT EXISTS isHero TINYINT(1) DEFAULT 0`,
        `ALTER TABLE series ADD COLUMN IF NOT EXISTS seoTitle TEXT`,
        `ALTER TABLE series ADD COLUMN IF NOT EXISTS seoDescription TEXT`,
        `ALTER TABLE series ADD COLUMN IF NOT EXISTS seoKeywords TEXT`,
        `ALTER TABLE series ADD COLUMN IF NOT EXISTS slug VARCHAR(255) DEFAULT NULL`,
        `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS isPending TINYINT(1) DEFAULT 0`,
        `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS submissions TEXT`,
        `ALTER TABLE chapters ADD COLUMN IF NOT EXISTS contributors TEXT`,
        `ALTER TABLE purchased_chapters ADD COLUMN IF NOT EXISTS chapterNumber DOUBLE`
      ];

      for (const aq of alterQueries) {
        try {
          await this.pool.execute(aq);
        } catch (err) {
          // ignore error if already exists
        }
      }

      // Convert tables and all their columns to utf8mb4 to support Persian properly
      const tablesToConvert = [
        'users', 'series', 'chapters', 'comments', 'bookmarks', 
        'history', 'ratings', 'settings', 'reports', 'notifications', 
        'wallet_transactions', 'purchased_chapters'
      ];
      for (const table of tablesToConvert) {
        try {
          await this.pool.execute(`ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        } catch (err) {
          console.warn(`Could not convert table ${table} to utf8mb4:`, err);
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
  ensureSuperAdminInLocalData() {
    if (!this.localData.users) {
      this.localData.users = [];
    }
    const adminUser = this.localData.users.find(u => u.id === 'admin' || u.email === 'amirrezaveisi45@gmail.com' || u.email === 'Mr.V@admin.com');
    if (!adminUser) {
      this.localData.users.unshift({
        id: 'admin',
        email: 'amirrezaveisi45@gmail.com',
        displayName: 'امیررضا ویسی (مدیریت کل)',
        avatarUrl: '',
        role: 'admin',
        roles: ['super_admin', 'admin'],
        permissions: ['all'],
        banned: false,
        canCreateSeries: true,
        walletBalance: 1000000,
        hasCompletedSetup: true,
        melliCode: '11111111',
        createdAt: new Date().toISOString()
      });
      this.saveLocalData();
    } else {
      adminUser.role = 'admin';
      adminUser.canCreateSeries = true;
      if (!adminUser.roles || !adminUser.roles.includes('super_admin')) {
        adminUser.roles = Array.from(new Set(['super_admin', 'admin', ...(adminUser.roles || [])]));
      }
    }
  }

  async ensureSuperAdminInMySQL() {
    if (!this.isUsingMySQL || !this.pool) return;
    try {
      const superEmails = ['amirrezaveisi45@gmail.com', 'Mr.V@admin.com'];
      const [rows] = await this.pool.execute('SELECT * FROM users WHERE email IN (?, ?) OR id = ?', [...superEmails, 'admin']);
      const list = rows as any[];
      if (list.length === 0) {
        const now = new Date().toISOString();
        await this.pool.execute(
          'INSERT INTO users (id, email, displayName, avatarUrl, banned, role, melliCode, firstName, lastName, phoneNumber, canCreateSeries, rolesText, permissionsText, password, hasCompletedSetup, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            'admin',
            'amirrezaveisi45@gmail.com',
            'مدیریت کل',
            '',
            0,
            'admin',
            '11111111',
            'امیررضا',
            'ویسی',
            '09120000000',
            1,
            'super_admin,admin',
            'all',
            null,
            1,
            now
          ]
        );
      } else {
        for (const u of list) {
          const roles = u.rolesText ? u.rolesText.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
          if (!roles.includes('super_admin')) roles.push('super_admin');
          if (!roles.includes('admin')) roles.push('admin');
          await this.pool.execute(
            'UPDATE users SET role = "admin", canCreateSeries = 1, rolesText = ? WHERE id = ?',
            [roles.join(','), u.id]
          );
        }
      }
    } catch (e) {
      console.error('Error ensuring super admin in MySQL:', e);
    }
  }

  async getUsers(): Promise<User[]> {
    if (this.isUsingMySQL && this.pool) {
      await this.ensureSuperAdminInMySQL();
      const [rows] = await this.pool.execute('SELECT * FROM users ORDER BY createdAt DESC');
      return (rows as any[]).map(r => {
        const isSuper = r.email === 'amirrezaveisi45@gmail.com' || r.email === 'Mr.V@admin.com' || r.id === 'admin';
        const roleVal = isSuper ? 'admin' : (r.role || 'user');
        let roles = r.rolesText ? r.rolesText.split(',').map((x: string) => x.trim()).filter(Boolean) : [roleVal];
        if (isSuper && !roles.includes('super_admin')) roles = Array.from(new Set(['super_admin', 'admin', ...roles]));
        const permissions = r.permissionsText ? r.permissionsText.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
        return {
          ...r,
          banned: !!r.banned,
          canCreateSeries: isSuper ? true : !!r.canCreateSeries,
          walletBalance: r.walletBalance || 0,
          role: roleVal,
          roles,
          permissions
        };
      });
    }
    this.ensureSuperAdminInLocalData();
    return this.localData.users.map(u => {
      const isSuper = u.email === 'amirrezaveisi45@gmail.com' || u.email === 'Mr.V@admin.com' || u.id === 'admin';
      return {
        ...u,
        walletBalance: u.walletBalance || 0,
        canCreateSeries: isSuper ? true : !!u.canCreateSeries,
        role: isSuper ? 'admin' : (u.role || 'user'),
        roles: isSuper ? Array.from(new Set(['super_admin', 'admin', ...(u.roles || [])])) : (u.roles || [u.role || 'user']),
        permissions: u.permissions || []
      };
    });
  }

  async getUser(id: string): Promise<User | null> {
    if (!id) return null;
    const isSuperAdminId = id === 'admin' || id === 'super_admin' || id === 'amirrezaveisi45@gmail.com' || id === 'Mr.V@admin.com';

    if (this.isUsingMySQL && this.pool) {
      await this.ensureSuperAdminInMySQL();
      const idLower = id.toLowerCase();
      const [rows] = await this.pool.execute(
        'SELECT * FROM users WHERE id = ? OR LOWER(email) = ? OR LOWER(displayName) = ?', 
        [id, idLower, idLower]
      );
      const res = (rows as any[])[0];
      if (res) {
        const isSuper = isSuperAdminId || res.email === 'amirrezaveisi45@gmail.com' || res.email === 'Mr.V@admin.com' || res.id === 'admin';
        const roleVal = isSuper ? 'admin' : (res.role || 'user');
        let roles = res.rolesText ? res.rolesText.split(',').map((x: string) => x.trim()).filter(Boolean) : [roleVal];
        if (isSuper && !roles.includes('super_admin')) roles = Array.from(new Set(['super_admin', 'admin', ...roles]));
        const permissions = res.permissionsText ? res.permissionsText.split(',').map((x: string) => x.trim()).filter(Boolean) : [];
        return {
          ...res,
          banned: !!res.banned,
          canCreateSeries: isSuper ? true : !!res.canCreateSeries,
          walletBalance: res.walletBalance || 0,
          role: roleVal,
          roles,
          permissions,
          password: res.password || undefined,
          hasCompletedSetup: res.hasCompletedSetup !== undefined ? !!res.hasCompletedSetup : false
        };
      }
    }

    let u = this.localData.users.find(u => u.id === id || u.email.toLowerCase() === id.toLowerCase() || u.displayName.toLowerCase() === id.toLowerCase());
    if (!u && isSuperAdminId) {
      u = {
        id: 'admin',
        email: 'amirrezaveisi45@gmail.com',
        displayName: 'مدیریت کل',
        avatarUrl: '',
        role: 'admin',
        roles: ['super_admin', 'admin'],
        permissions: ['all'],
        banned: false,
        canCreateSeries: true,
        walletBalance: 1000000,
        hasCompletedSetup: true,
        melliCode: '11111111',
        createdAt: new Date().toISOString()
      };
    }
    if (!u) return null;
    const isSuper = isSuperAdminId || u.email === 'amirrezaveisi45@gmail.com' || u.email === 'Mr.V@admin.com' || u.id === 'admin';
    return {
      ...u,
      walletBalance: u.walletBalance || 0,
      roles: isSuper ? Array.from(new Set(['super_admin', 'admin', ...(u.roles || [])])) : (u.roles || [u.role || 'user']),
      permissions: u.permissions || [],
      canCreateSeries: isSuper ? true : !!u.canCreateSeries,
      role: isSuper ? 'admin' : (u.role || 'user'),
      password: u.password || undefined,
      hasCompletedSetup: u.hasCompletedSetup !== undefined ? !!u.hasCompletedSetup : false
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    return this.getUser(email);
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
      const tablesAndFields = [
        ["bookmarks", "userId"],
        ["history", "userId"],
        ["ratings", "userId"],
        ["comments", "userId"],
        ["notifications", "userId"],
        ["purchased_chapters", "userId"],
        ["wallet_transactions", "userId"],
        ["reports", "userId"],
        ["users", "id"]
      ];
      for (const [table, field] of tablesAndFields) {
        try {
          await this.pool.execute(`DELETE FROM \`${table}\` WHERE \`${field}\` = ?`, [id]);
        } catch (e) {
          console.warn(`Could not delete from ${table}:`, e);
        }
      }
      return true;
    }
    this.localData.users = this.localData.users.filter(u => u.id !== id);
    this.localData.bookmarks = this.localData.bookmarks.filter(b => b.userId !== id);
    this.localData.history = this.localData.history.filter(h => h.userId !== id);
    this.localData.ratings = this.localData.ratings.filter(r => r.userId !== id);
    if (this.localData.comments) {
      this.localData.comments = this.localData.comments.filter(c => c.userId !== id);
    }
    if (this.localData.notifications) {
      this.localData.notifications = this.localData.notifications.filter(n => n.userId !== id);
    }
    if (this.localData.purchased_chapters) {
      this.localData.purchased_chapters = this.localData.purchased_chapters.filter(pc => pc.userId !== id);
    }
    if (this.localData.wallet_transactions) {
      this.localData.wallet_transactions = this.localData.wallet_transactions.filter(wt => wt.userId !== id);
    }
    this.saveLocalData();
    return true;
  }

  // -----------------------------------------------------------------
  // SERIES METHODS
  // -----------------------------------------------------------------
  private async attachLatestChapters(list: any[]): Promise<any[]> {
    if (this.isUsingMySQL && this.pool) {
      for (const s of list) {
        try {
          const [chapRows] = await this.pool.execute(
            'SELECT * FROM chapters WHERE (seriesId = ? OR seriesId = ?) AND (isPending = 0 OR isPending IS NULL) ORDER BY number DESC LIMIT 1',
            [s.id, s.slug || s.id]
          );
          const [countRows] = await this.pool.execute(
            'SELECT COUNT(*) as cnt FROM chapters WHERE (seriesId = ? OR seriesId = ?) AND (isPending = 0 OR isPending IS NULL)',
            [s.id, s.slug || s.id]
          );
          const [ratingRows] = await this.pool.execute(
            'SELECT AVG(score) as avgRating FROM ratings WHERE seriesId = ? OR seriesId = ?',
            [s.id, s.slug || s.id]
          );
          const chap = (chapRows as any[])[0];
          const cnt = (countRows as any[])[0]?.cnt || 0;
          const avgR = (ratingRows as any[])[0]?.avgRating;

          s.totalChapters = Number(cnt);
          s.chaptersCount = Number(cnt);
          if (avgR !== null && avgR !== undefined && !isNaN(Number(avgR)) && Number(avgR) > 0) {
            s.rating = Number(Number(avgR).toFixed(1));
          } else {
            s.rating = Number(s.rating || 0);
          }

          s.chapters = chap ? [{
            ...chap,
            images: chap.images ? (typeof chap.images === 'string' ? chap.images.split(',') : chap.images) : [],
            isPending: false,
            submissions: [],
            contributors: {}
          }] : [];
        } catch (e) {
          s.chapters = s.chapters || [];
          s.totalChapters = s.totalChapters || s.chapters.length || 0;
          s.chaptersCount = s.totalChapters;
          s.rating = Number(s.rating || 0);
        }
      }
      return list;
    }

    return list.map(s => {
      const seriesChapters = (this.localData.chapters || [])
        .filter(c => (c.seriesId === s.id || (s.slug && c.seriesId === s.slug)) && (!c.isPending || String(c.isPending) === '0' || String(c.isPending) === 'false'))
        .sort((a, b) => Number(b.number) - Number(a.number));
      
      const seriesRatings = (this.localData.ratings || []).filter(r => r.seriesId === s.id || (s.slug && r.seriesId === s.slug));
      const avgRating = seriesRatings.length > 0 
        ? Number((seriesRatings.reduce((acc, curr) => acc + curr.score, 0) / seriesRatings.length).toFixed(1))
        : Number(s.rating || 0);

      const latest = seriesChapters.slice(0, 1).map(c => ({
        ...c,
        isPending: !!c.isPending,
        submissions: c.submissions || [],
        contributors: c.contributors || {}
      }));

      return {
        ...s,
        rating: avgRating,
        totalChapters: seriesChapters.length,
        chaptersCount: seriesChapters.length,
        chapters: latest.length > 0 ? latest : (s.chapters || [])
      };
    });
  }

  async getSeries(): Promise<Series[]> {
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM series ORDER BY createdAt DESC');
      const res = (rows as any[]).map(r => {
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
      return this.attachLatestChapters(res);
    }
    const res = this.localData.series.map(s => ({
      ...s,
      contributors: s.contributors || []
    }));
    return this.attachLatestChapters(res);
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
          contributors: parsedContributors,
          isHero: !!r.isHero
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

      return this.attachLatestChapters(list);
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

    const res = list.map(s => ({
      ...s,
      contributors: s.contributors || []
    }));
    return this.attachLatestChapters(res);
  }

  async getSeriesById(id: string): Promise<Series | null> {
    if (!id) return null;
    let cleanId = id;
    try {
      cleanId = decodeURIComponent(id);
    } catch (e) {}

    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute('SELECT * FROM series WHERE id = ? OR slug = ? OR id = ? OR slug = ?', [cleanId, cleanId, id, id]);
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
        alternativeTitles: typeof r.alternativeTitles === 'string' ? r.alternativeTitles.split(',').filter(Boolean) : (Array.isArray(r.alternativeTitles) ? r.alternativeTitles : []),
        genres: typeof r.genres === 'string' ? r.genres.split(',').filter(Boolean) : (Array.isArray(r.genres) ? r.genres : []),
        tags: typeof r.tags === 'string' ? r.tags.split(',').filter(Boolean) : (Array.isArray(r.tags) ? r.tags : []),
        contributors: parsedContributors,
        isHero: !!r.isHero,
        slug: r.slug || ''
      };
    }
    const found = this.localData.series.find(s => s.id === cleanId || s.id === id || (s as any).slug === cleanId || (s as any).slug === id);
    if (!found) return null;
    return {
      ...found,
      contributors: found.contributors || [],
      slug: (found as any).slug || ''
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
          `UPDATE series SET title = ?, alternativeTitles = ?, cover = ?, banner = ?, author = ?, artist = ?, synopsis = ?, genres = ?, tags = ?, status = ?, type = ?, contributors = ?, isHero = ?, seoTitle = ?, seoDescription = ?, seoKeywords = ?, slug = ?, updatedAt = ? WHERE id = ?`,
          [s.title, altTitlesStr, s.cover, s.banner, s.author, s.artist, s.synopsis, genresStr, tagsStr, s.status, s.type, contributorsStr, s.isHero ? 1 : 0, s.seoTitle || null, s.seoDescription || null, s.seoKeywords || null, s.slug || null, now, s.id]
        );
      } else {
        await this.pool.execute(
          `INSERT INTO series (id, title, alternativeTitles, cover, banner, author, artist, synopsis, genres, tags, status, rating, type, views, contributors, isHero, seoTitle, seoDescription, seoKeywords, slug, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.title, altTitlesStr, s.cover, s.banner, s.author, s.artist, s.synopsis, genresStr, tagsStr, s.status || 'Ongoing', s.rating || 0, s.type || 'Manhwa', s.views || 0, contributorsStr, s.isHero ? 1 : 0, s.seoTitle || null, s.seoDescription || null, s.seoKeywords || null, s.slug || null, now, now]
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
      isHero: !!s.isHero,
      seoTitle: s.seoTitle || '',
      seoDescription: s.seoDescription || '',
      seoKeywords: s.seoKeywords || '',
      slug: s.slug || '',
      createdAt: s.createdAt || now,
      updatedAt: now
    };

    if (isEdit) {
      const idx = this.localData.series.findIndex(item => item.id === s.id);
      const existing = this.localData.series[idx];
      this.localData.series[idx] = { 
        ...existing, 
        ...seriesObj,
        views: s.views !== undefined ? s.views : (existing ? (existing.views || 0) : 0)
      };
    } else {
      this.localData.series.push(seriesObj);
    }
    this.saveLocalData();
    return seriesObj;
  }

  async deleteSeries(id: string): Promise<boolean> {
    try {
      const s = await this.getSeriesById(id);
      if (s) {
        deleteUploadedFile(s.cover);
        deleteUploadedFile(s.banner);
      }
      const chapters = await this.getChapters(id);
      for (const ch of chapters) {
        if (ch.images) {
          for (const img of ch.images) {
            deleteUploadedFile(img);
          }
        }
      }
    } catch (e) {
      console.error("Error cleaning up series files:", e);
    }

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

  async updateSeriesId(oldId: string, newId: string): Promise<boolean> {
    if (this.isUsingMySQL && this.pool) {
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();

        const [existing] = await connection.execute('SELECT id FROM series WHERE id = ?', [newId]);
        if ((existing as any[]).length > 0) {
          throw new Error('شناسه جدید از قبل وجود دارد.');
        }

        await connection.execute('UPDATE series SET id = ? WHERE id = ?', [newId, oldId]);
        await connection.execute('UPDATE chapters SET seriesId = ? WHERE seriesId = ?', [newId, oldId]);
        await connection.execute('UPDATE comments SET seriesId = ? WHERE seriesId = ?', [newId, oldId]);
        await connection.execute('UPDATE bookmarks SET seriesId = ? WHERE seriesId = ?', [newId, oldId]);
        await connection.execute('UPDATE history SET seriesId = ? WHERE seriesId = ?', [newId, oldId]);
        await connection.execute('UPDATE ratings SET seriesId = ? WHERE seriesId = ?', [newId, oldId]);
        await connection.execute('UPDATE purchased_chapters SET seriesId = ? WHERE seriesId = ?', [newId, oldId]);

        await connection.commit();
        return true;
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else {
      const sIdx = this.localData.series.findIndex(s => s.id === oldId);
      if (sIdx >= 0) {
        if (this.localData.series.some(s => s.id === newId)) {
          throw new Error('شناسه جدید از قبل وجود دارد.');
        }
        this.localData.series[sIdx].id = newId;
        this.localData.chapters.forEach(c => { if (c.seriesId === oldId) c.seriesId = newId; });
        this.localData.bookmarks.forEach(b => { if (b.seriesId === oldId) b.seriesId = newId; });
        this.localData.history.forEach(h => { if (h.seriesId === oldId) h.seriesId = newId; });
        this.localData.ratings.forEach(r => { if (r.seriesId === oldId) r.seriesId = newId; });
        this.localData.purchased_chapters.forEach(pc => { if (pc.seriesId === oldId) pc.seriesId = newId; });
        this.saveLocalData();
        return true;
      }
      return false;
    }
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
    if (!seriesId) return [];
    let cleanSeriesId = seriesId;
    try {
      cleanSeriesId = decodeURIComponent(seriesId);
    } catch (e) {}

    const series = await this.getSeriesById(cleanSeriesId);
    const actualId = series ? series.id : cleanSeriesId;

    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute(
        'SELECT * FROM chapters WHERE seriesId = ? OR seriesId = ? OR seriesId = ? ORDER BY number DESC',
        [actualId, cleanSeriesId, seriesId]
      );
      return (rows as any[]).map(r => {
        let parsedSubmissions: any[] = [];
        if (r.submissions) {
          try {
            parsedSubmissions = typeof r.submissions === 'string' ? JSON.parse(r.submissions) : r.submissions;
          } catch (e) {}
        }
        let parsedContributors: any = {};
        if (r.contributors) {
          try {
            parsedContributors = typeof r.contributors === 'string' ? JSON.parse(r.contributors) : r.contributors;
          } catch (e) {}
        }
        return {
          ...r,
          images: r.images ? (typeof r.images === 'string' ? r.images.split(',') : r.images) : [],
          isPending: r.isPending === 1 || r.isPending === true,
          submissions: parsedSubmissions,
          contributors: parsedContributors
        };
      });
    }
    return (this.localData.chapters || [])
      .filter(c => c.seriesId === actualId || c.seriesId === cleanSeriesId || c.seriesId === seriesId)
      .map(c => ({
        ...c,
        isPending: !!c.isPending,
        submissions: c.submissions || [],
        contributors: c.contributors || {}
      }))
      .sort((a, b) => b.number - a.number);
  }

  async getChapterById(seriesId: string, id: string): Promise<Chapter | null> {
    if (!seriesId || !id) return null;
    let cleanSeriesId = seriesId;
    let cleanChapterId = id;
    try { cleanSeriesId = decodeURIComponent(seriesId); } catch (e) {}
    try { cleanChapterId = decodeURIComponent(id); } catch (e) {}

    const series = await this.getSeriesById(cleanSeriesId);
    const actualSeriesId = series ? series.id : cleanSeriesId;

    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute(
        'SELECT * FROM chapters WHERE (seriesId = ? OR seriesId = ? OR seriesId = ?) AND (id = ? OR id = ?)',
        [actualSeriesId, cleanSeriesId, seriesId, cleanChapterId, id]
      );
      const r = (rows as any[])[0];
      if (!r) return null;
      let parsedSubmissions: any[] = [];
      if (r.submissions) {
        try {
          parsedSubmissions = typeof r.submissions === 'string' ? JSON.parse(r.submissions) : r.submissions;
        } catch (e) {}
      }
      let parsedContributors: any = {};
      if (r.contributors) {
        try {
          parsedContributors = typeof r.contributors === 'string' ? JSON.parse(r.contributors) : r.contributors;
        } catch (e) {}
      }
      return {
        ...r,
        images: r.images ? (typeof r.images === 'string' ? r.images.split(',') : r.images) : [],
        isPending: r.isPending === 1 || r.isPending === true,
        submissions: parsedSubmissions,
        contributors: parsedContributors
      };
    }
    const found = (this.localData.chapters || []).find(c => 
      (c.seriesId === actualSeriesId || c.seriesId === cleanSeriesId || c.seriesId === seriesId) && 
      (c.id === cleanChapterId || c.id === id)
    );
    if (!found) return null;
    return {
      ...found,
      isPending: !!found.isPending,
      submissions: found.submissions || [],
      contributors: found.contributors || {}
    };
  }

  async saveChapter(ch: any): Promise<Chapter> {
    const isEdit = !!(await this.getChapterById(ch.seriesId, ch.id));
    const now = new Date().toISOString();
    
    const imagesStr = Array.isArray(ch.images) ? ch.images.join(',') : '';
    const submissionsStr = ch.submissions ? JSON.stringify(ch.submissions) : '[]';
    const contributorsStr = ch.contributors ? JSON.stringify(ch.contributors) : '{}';
    const isPendingVal = (ch.isPending === true || ch.isPending === 1) ? 1 : 0;

    if (this.isUsingMySQL && this.pool) {
      if (isEdit) {
        await this.pool.execute(
          `UPDATE chapters SET number = ?, title = ?, images = ?, isPending = ?, submissions = ?, contributors = ?, updatedAt = ? WHERE seriesId = ? AND id = ?`,
          [ch.number, ch.title || '', imagesStr, isPendingVal, submissionsStr, contributorsStr, now, ch.seriesId, ch.id]
        );
      } else {
        await this.pool.execute(
          `INSERT INTO chapters (id, seriesId, number, title, images, views, isPending, submissions, contributors, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ch.id, ch.seriesId, ch.number, ch.title || '', imagesStr, ch.views || 0, isPendingVal, submissionsStr, contributorsStr, now, now]
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
      contributors: ch.contributors || {},
      createdAt: ch.createdAt || now,
      updatedAt: now
    };

    if (isEdit) {
      const idx = this.localData.chapters.findIndex(item => item.id === ch.id);
      const existing = this.localData.chapters[idx];
      this.localData.chapters[idx] = { 
        ...existing, 
        ...chapterObj,
        views: ch.views !== undefined ? ch.views : (existing ? (existing.views || 0) : 0)
      };
    } else {
      this.localData.chapters.push(chapterObj);
    }
    this.saveLocalData();
    return chapterObj;
  }

  async deleteChapter(seriesId: string, id: string): Promise<boolean> {
    try {
      const ch = await this.getChapterById(seriesId, id);
      if (ch && ch.images) {
        for (const img of ch.images) {
          deleteUploadedFile(img);
        }
      }
    } catch (e) {
      console.error("Error cleaning up chapter files:", e);
    }

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
  async getStats(): Promise<{ 
    totalSeries: number; 
    totalChapters: number; 
    totalUsers: number;
    dailyViews: { name: string; views: number }[]
  }> {
    let totalSeries = 0;
    let totalChapters = 0;
    let totalUsers = 0;
    let dailyViews: { name: string; views: number }[] = [];

    // Initialize the last 7 days
    const last7Days: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString("en-US", { weekday: "short" });
      last7Days[dateStr] = 0;
    }

    let totalViewsSum = 0;

    if (this.isUsingMySQL && this.pool) {
      try {
        const [[{ count: sCount }]] = await this.pool.execute('SELECT COUNT(*) as count FROM series') as any;
        const [[{ count: cCount }]] = await this.pool.execute('SELECT COUNT(*) as count FROM chapters') as any;
        const [[{ count: uCount }]] = await this.pool.execute('SELECT COUNT(*) as count FROM users') as any;
        totalSeries = sCount;
        totalChapters = cCount;
        totalUsers = uCount;

        const [[{ sum: tViews }]] = await this.pool.execute('SELECT SUM(views) as sum FROM series') as any;
        totalViewsSum = tViews || 0;

        // Try querying the real history table to calculate views
        const [historyRows] = await this.pool.execute(
          'SELECT updatedAt FROM history WHERE updatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
        ) as any;

        let hasHistory = false;
        if (Array.isArray(historyRows)) {
          historyRows.forEach((row: any) => {
            hasHistory = true;
            const dateStr = new Date(row.updatedAt).toLocaleDateString("en-US", { weekday: "short" });
            if (last7Days[dateStr] !== undefined) {
              last7Days[dateStr]++;
            }
          });
        }

        // If no history exists, distribute total views realistically
        if (!hasHistory && totalViewsSum > 0) {
          const dist = [0.12, 0.14, 0.13, 0.15, 0.14, 0.16, 0.16];
          let idx = 0;
          for (const key in last7Days) {
            last7Days[key] = Math.floor(totalViewsSum * dist[idx % 7]);
            idx++;
          }
        }
      } catch (e) {
        console.error("Error running stats SQL query", e);
      }
    } else {
      totalSeries = this.localData.series.length;
      totalChapters = this.localData.chapters.length;
      totalUsers = this.localData.users.length;
      totalViewsSum = (this.localData.series || []).reduce((acc, curr) => acc + (curr.views || 0), 0);

      // Filter and count local history from last 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentHistory = (this.localData.history || []).filter(h => {
        const t = new Date(h.updatedAt).getTime();
        return t >= sevenDaysAgo;
      });

      let hasHistory = recentHistory.length > 0;
      recentHistory.forEach(h => {
        const dateStr = new Date(h.updatedAt).toLocaleDateString("en-US", { weekday: "short" });
        if (last7Days[dateStr] !== undefined) {
          last7Days[dateStr]++;
        }
      });

      // If no history exists, distribute total views realistically
      if (!hasHistory && totalViewsSum > 0) {
        const dist = [0.12, 0.14, 0.13, 0.15, 0.14, 0.16, 0.16];
        let idx = 0;
        for (const key in last7Days) {
          last7Days[key] = Math.floor(totalViewsSum * dist[idx % 7]);
          idx++;
        }
      }
    }

    // Convert last7Days map to sorted array
    dailyViews = Object.keys(last7Days).map(key => ({
      name: key,
      views: last7Days[key]
    }));

    return { totalSeries, totalChapters, totalUsers, dailyViews };
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

  async getCommentsForSeries(seriesId: string): Promise<Comment[]> {
    if (this.isUsingMySQL && this.pool) {
      try {
        const [rows] = await this.pool.execute(
          'SELECT c.* FROM comments c JOIN chapters ch ON c.chapterId = ch.id WHERE ch.seriesId = ? ORDER BY c.createdAt DESC LIMIT 10',
          [seriesId]
        );
        return (rows as any[]).map(r => ({
          ...r,
          likes: r.likes ? JSON.parse(r.likes) : [],
          dislikes: r.dislikes ? JSON.parse(r.dislikes) : []
        }));
      } catch (e) {
        console.error("Error in getCommentsForSeries sql", e);
        return [];
      }
    }
    const chIds = this.localData.chapters.filter(ch => ch.seriesId === seriesId).map(ch => ch.id);
    return (this.localData.comments || [])
      .filter(c => chIds.includes(c.chapterId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
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
    let hasByChapterId = false;
    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute(
        'SELECT 1 FROM purchased_chapters WHERE userId = ? AND seriesId = ? AND chapterId = ? LIMIT 1',
        [userId, seriesId, chapterId]
      );
      hasByChapterId = (rows as any[]).length > 0;
    } else {
      if (!this.localData.purchased_chapters) this.localData.purchased_chapters = [];
      hasByChapterId = this.localData.purchased_chapters.some(pc => pc.userId === userId && pc.seriesId === seriesId && pc.chapterId === chapterId);
    }
    if (hasByChapterId) return true;

    // Fetch the current chapter to check by number
    const chapter = await this.getChapterById(seriesId, chapterId);
    if (!chapter) return false;

    if (this.isUsingMySQL && this.pool) {
      const [rows] = await this.pool.execute(
        'SELECT 1 FROM purchased_chapters WHERE userId = ? AND seriesId = ? AND chapterNumber = ? LIMIT 1',
        [userId, seriesId, chapter.number]
      );
      return (rows as any[]).length > 0;
    } else {
      if (!this.localData.purchased_chapters) this.localData.purchased_chapters = [];
      return this.localData.purchased_chapters.some(pc => pc.userId === userId && pc.seriesId === seriesId && pc.chapterNumber === chapter.number);
    }
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

    // Calculate dynamic revenue distribution
    const rolesSetting = await this.getSettings('revenue_roles') || [
      { id: 'editor', name: 'ادیتور', percentage: 30 },
      { id: 'translator', name: 'مترجم', percentage: 30 },
      { id: 'cleaner', name: 'کلینر', percentage: 20 },
      { id: 'website', name: 'وبسایت', percentage: 20 }
    ];

    const distribution: { userId: string; roleLabel: string; amount: number }[] = [];

    for (const r of rolesSetting) {
      if (r.id === 'website') continue;
      
      let assignedUserIds: string[] = [];
      
      // Check chapter-level contributors
      if (chapter.contributors && Array.isArray(chapter.contributors[r.id]) && chapter.contributors[r.id].length > 0) {
        assignedUserIds = chapter.contributors[r.id];
      } else {
        // Fall back to approved series-level contributors
        const approvedContributors = series?.contributors || [];
        assignedUserIds = approvedContributors
          .filter((c: any) => c.status === 'approved' && c.role === r.id)
          .map((c: any) => c.userId);
      }

      if (assignedUserIds.length > 0) {
        const roleShareTotal = Math.floor(price * (r.percentage / 100));
        const sharePerUser = Math.floor(roleShareTotal / assignedUserIds.length);
        
        assignedUserIds.forEach((uid: string) => {
          distribution.push({ userId: uid, roleLabel: r.name, amount: sharePerUser });
        });
      }
    }

    // Group by userId
    const userDistributionMap: Record<string, { amount: number; roles: string[] }> = {};
    distribution.forEach(d => {
      if (!userDistributionMap[d.userId]) {
        userDistributionMap[d.userId] = { amount: 0, roles: [] };
      }
      userDistributionMap[d.userId].amount += d.amount;
      if (!userDistributionMap[d.userId].roles.includes(d.roleLabel)) {
        userDistributionMap[d.userId].roles.push(d.roleLabel);
      }
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

        // Insert purchased chapter record with chapterNumber
        await conn.execute(
          'INSERT INTO purchased_chapters (id, userId, seriesId, chapterId, chapterNumber, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
          [purchaseId, userId, seriesId, chapterId, chapter.number, now]
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

        // Update website_revenue setting
        const [revRows] = await conn.execute('SELECT * FROM settings WHERE id = ?', ['website_revenue']);
        const revR = (revRows as any[])[0];
        let currentRev = revR ? JSON.parse(revR.val) : { totalEarned: 0 };
        currentRev.totalEarned = (currentRev.totalEarned || 0) + adminProfit;
        const revValStr = JSON.stringify(currentRev);
        if (revR) {
          await conn.execute('UPDATE settings SET val = ? WHERE id = ?', [revValStr, 'website_revenue']);
        } else {
          await conn.execute('INSERT INTO settings (id, val) VALUES (?, ?)', ['website_revenue', revValStr]);
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
        chapterNumber: chapter.number,
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

      // Update website_revenue setting local
      if (!this.localData.settings.website_revenue) {
        this.localData.settings.website_revenue = { totalEarned: 0 };
      }
      this.localData.settings.website_revenue.totalEarned = (this.localData.settings.website_revenue.totalEarned || 0) + adminProfit;

      this.saveLocalData();
    }

    return { success: true, newBalance };
  }

  async backupAllData(): Promise<any> {
    const backup: any = {};
    const now = new Date().toISOString();

    if (this.isUsingMySQL && this.pool) {
      try {
        // 1. Users
        const [userRows] = await this.pool.execute('SELECT * FROM users');
        backup.users = (userRows as any[]).map(r => ({
          ...r,
          banned: r.banned === 1,
          canCreateSeries: r.canCreateSeries === 1,
          hasCompletedSetup: r.hasCompletedSetup === 1,
          roles: r.rolesText ? r.rolesText.split(',') : (r.role ? [r.role] : ['user']),
          permissions: r.permissionsText ? r.permissionsText.split(',') : []
        }));

        // 2. Series
        const [seriesRows] = await this.pool.execute('SELECT * FROM series');
        backup.series = (seriesRows as any[]).map(r => ({
          ...r,
          alternativeTitles: r.alternativeTitles ? r.alternativeTitles.split(',') : [],
          genres: r.genres ? r.genres.split(',') : [],
          tags: r.tags ? r.tags.split(',') : [],
          isHero: r.isHero === 1,
          contributors: r.contributors ? JSON.parse(r.contributors) : []
        }));

        // 3. Chapters
        const [chapterRows] = await this.pool.execute('SELECT * FROM chapters');
        backup.chapters = (chapterRows as any[]).map(r => ({
          ...r,
          images: r.images ? r.images.split(',') : [],
          isPending: r.isPending === 1,
          submissions: r.submissions ? JSON.parse(r.submissions) : []
        }));

        // 4. Comments
        const [commentRows] = await this.pool.execute('SELECT * FROM comments');
        backup.comments = (commentRows as any[]).map(r => ({
          ...r,
          likes: r.likes ? JSON.parse(r.likes) : [],
          dislikes: r.dislikes ? JSON.parse(r.dislikes) : []
        }));

        // 5. Bookmarks
        const [bookmarkRows] = await this.pool.execute('SELECT * FROM bookmarks');
        backup.bookmarks = bookmarkRows;

        // 6. History
        const [historyRows] = await this.pool.execute('SELECT * FROM history');
        backup.history = historyRows;

        // 7. Ratings
        const [ratingRows] = await this.pool.execute('SELECT * FROM ratings');
        backup.ratings = ratingRows;

        // 8. Settings
        const [settingRows] = await this.pool.execute('SELECT * FROM settings');
        const settingsRecord: Record<string, any> = {};
        for (const s of (settingRows as any[])) {
          try {
            settingsRecord[s.id] = JSON.parse(s.val);
          } catch (e) {
            settingsRecord[s.id] = s.val;
          }
        }
        backup.settings = settingsRecord;

        // 9. Reports
        const [reportRows] = await this.pool.execute('SELECT * FROM reports');
        backup.reports = reportRows;

        // 10. Notifications
        const [notifRows] = await this.pool.execute('SELECT * FROM notifications');
        backup.notifications = (notifRows as any[]).map(r => ({
          ...r,
          isRead: r.isRead === 1
        }));

        // 11. Wallet Transactions
        const [transRows] = await this.pool.execute('SELECT * FROM wallet_transactions');
        backup.wallet_transactions = transRows;

        // 12. Purchased Chapters
        const [purchasedRows] = await this.pool.execute('SELECT * FROM purchased_chapters');
        backup.purchased_chapters = purchasedRows;

      } catch (err) {
        console.error("MySQL Backup error, falling back to localData", err);
        return this.localData;
      }
    } else {
      // Local Database
      backup.users = (this.localData.users || []).map(u => ({
        ...u,
        roles: u.roles || (u.role ? [u.role] : ['user']),
        permissions: u.permissions || []
      }));
      backup.series = this.localData.series || [];
      backup.chapters = this.localData.chapters || [];
      backup.comments = this.localData.comments || [];
      backup.bookmarks = this.localData.bookmarks || [];
      backup.history = this.localData.history || [];
      backup.ratings = this.localData.ratings || [];
      backup.settings = this.localData.settings || {};
      backup.reports = this.localData.reports || [];
      backup.notifications = this.localData.notifications || [];
      backup.wallet_transactions = this.localData.wallet_transactions || [];
      backup.purchased_chapters = this.localData.purchased_chapters || [];
    }

    return backup;
  }

  async restoreAllData(data: any): Promise<{ success: boolean; error?: string }> {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'اطلاعات ارسالی معتبر نیست' };
    }

    const cleanData = {
      users: Array.isArray(data.users) ? data.users : [],
      series: Array.isArray(data.series) ? data.series : [],
      chapters: Array.isArray(data.chapters) ? data.chapters : [],
      comments: Array.isArray(data.comments) ? data.comments : [],
      bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
      history: Array.isArray(data.history) ? data.history : [],
      ratings: Array.isArray(data.ratings) ? data.ratings : [],
      settings: (data.settings && typeof data.settings === 'object') ? data.settings : {},
      reports: Array.isArray(data.reports) ? data.reports : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      wallet_transactions: Array.isArray(data.wallet_transactions) ? data.wallet_transactions : [],
      purchased_chapters: Array.isArray(data.purchased_chapters) ? data.purchased_chapters : []
    };

    if (this.isUsingMySQL && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        // Delete all tables
        const tables = [
          'users',
          'series',
          'chapters',
          'comments',
          'bookmarks',
          'history',
          'ratings',
          'settings',
          'reports',
          'notifications',
          'wallet_transactions',
          'purchased_chapters'
        ];
        for (const table of tables) {
          await conn.execute(`DELETE FROM ${table}`);
        }

        // Insert Users
        for (const u of cleanData.users) {
          const rolesArr = u.roles || (u.role ? [u.role] : ['user']);
          const permsArr = u.permissions || [];
          await conn.execute(
            `INSERT INTO users (id, email, displayName, avatarUrl, banned, role, melliCode, firstName, lastName, phoneNumber, canCreateSeries, rolesText, permissionsText, password, hasCompletedSetup, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              u.id, u.email, u.displayName, u.avatarUrl || null,
              u.banned ? 1 : 0, u.role || 'user', u.melliCode || '',
              u.firstName || '', u.lastName || '', u.phoneNumber || '',
              u.canCreateSeries ? 1 : 0, rolesArr.join(','), permsArr.join(','),
              u.password || null, u.hasCompletedSetup ? 1 : 0, u.createdAt || new Date().toISOString()
            ]
          );
        }

        // Insert Series
        for (const s of cleanData.series) {
          const altTitlesStr = Array.isArray(s.alternativeTitles) ? s.alternativeTitles.join(',') : (s.alternativeTitles || '');
          const genresStr = Array.isArray(s.genres) ? s.genres.join(',') : (s.genres || '');
          const tagsStr = Array.isArray(s.tags) ? s.tags.join(',') : (s.tags || '');
          const contributorsStr = Array.isArray(s.contributors) ? JSON.stringify(s.contributors) : (typeof s.contributors === 'string' ? s.contributors : '[]');
          await conn.execute(
            `INSERT INTO series (id, title, alternativeTitles, cover, banner, author, artist, synopsis, genres, tags, status, rating, type, views, contributors, isHero, seoTitle, seoDescription, seoKeywords, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id, s.title, altTitlesStr, s.cover || null, s.banner || null,
              s.author || '', s.artist || '', s.synopsis || '', genresStr, tagsStr,
              s.status || 'Ongoing', s.rating || 0, s.type || 'Manhwa', s.views || 0,
              contributorsStr, s.isHero ? 1 : 0, s.seoTitle || null, s.seoDescription || null,
              s.seoKeywords || null, s.createdAt || new Date().toISOString(), s.updatedAt || new Date().toISOString()
            ]
          );
        }

        // Insert Chapters
        for (const c of cleanData.chapters) {
          const imagesStr = Array.isArray(c.images) ? c.images.join(',') : (c.images || '');
          const submissionsStr = Array.isArray(c.submissions) ? JSON.stringify(c.submissions) : (typeof c.submissions === 'string' ? c.submissions : '[]');
          await conn.execute(
            `INSERT INTO chapters (id, seriesId, number, title, images, views, isPending, submissions, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              c.id, c.seriesId, c.number, c.title || '', imagesStr, c.views || 0,
              c.isPending ? 1 : 0, submissionsStr, c.createdAt || new Date().toISOString(), c.updatedAt || new Date().toISOString()
            ]
          );
        }

        // Insert Comments
        for (const c of cleanData.comments) {
          const likesStr = Array.isArray(c.likes) ? JSON.stringify(c.likes) : (typeof c.likes === 'string' ? c.likes : '[]');
          const dislikesStr = Array.isArray(c.dislikes) ? JSON.stringify(c.dislikes) : (typeof c.dislikes === 'string' ? c.dislikes : '[]');
          await conn.execute(
            `INSERT INTO comments (id, chapterId, userId, userName, userAvatar, content, likes, dislikes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              c.id, c.chapterId, c.userId, c.userName, c.userAvatar || null,
              c.content, likesStr, dislikesStr, c.createdAt || new Date().toISOString()
            ]
          );
        }

        // Insert Bookmarks
        for (const b of cleanData.bookmarks) {
          await conn.execute(
            `INSERT INTO bookmarks (userId, seriesId, createdAt) VALUES (?, ?, ?)`,
            [b.userId, b.seriesId, b.createdAt || new Date().toISOString()]
          );
        }

        // Insert History
        for (const h of cleanData.history) {
          await conn.execute(
            `INSERT INTO history (userId, seriesId, chapterId, chapterNumber, updatedAt) VALUES (?, ?, ?, ?, ?)`,
            [h.userId, h.seriesId, h.chapterId, h.chapterNumber, h.updatedAt || new Date().toISOString()]
          );
        }

        // Insert Ratings
        for (const r of cleanData.ratings) {
          await conn.execute(
            `INSERT INTO ratings (userId, seriesId, score, createdAt) VALUES (?, ?, ?, ?)`,
            [r.userId, r.seriesId, r.score, r.createdAt || new Date().toISOString()]
          );
        }

        // Insert Settings
        for (const [key, val] of Object.entries(cleanData.settings)) {
          const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
          await conn.execute(
            `INSERT INTO settings (id, val) VALUES (?, ?)`,
            [key, valStr]
          );
        }

        // Insert Reports
        for (const r of cleanData.reports) {
          await conn.execute(
            `INSERT INTO reports (id, userId, userName, title, content, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [r.id, r.userId, r.userName, r.title, r.content, r.status || 'pending', r.createdAt || new Date().toISOString()]
          );
        }

        // Insert Notifications
        for (const n of cleanData.notifications) {
          await conn.execute(
            `INSERT INTO notifications (id, userId, type, title, body, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [n.id, n.userId, n.type || 'system', n.title, n.body || null, n.link || null, n.isRead ? 1 : 0, n.createdAt || new Date().toISOString()]
          );
        }

        // Insert Wallet Transactions
        for (const t of cleanData.wallet_transactions) {
          await conn.execute(
            `INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [t.id, t.userId, t.userName, t.amount, t.type, t.description || null, t.creatorId || 'system', t.creatorName || 'سیستم', t.createdAt || new Date().toISOString()]
          );
        }

        // Insert Purchased Chapters
        for (const p of cleanData.purchased_chapters) {
          await conn.execute(
            `INSERT INTO purchased_chapters (id, userId, seriesId, chapterId, createdAt) VALUES (?, ?, ?, ?, ?)`,
            [p.id, p.userId, p.seriesId, p.chapterId, p.createdAt || new Date().toISOString()]
          );
        }

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        await conn.commit();
        return { success: true };
      } catch (err: any) {
        await conn.rollback();
        console.error("MySQL Restore error", err);
        return { success: false, error: err.message };
      } finally {
        conn.release();
      }
    } else {
      // Local Database
      this.localData = cleanData;
      this.saveLocalData();
      return { success: true };
    }
  }

  async getDbStatus(): Promise<{
    connected: boolean;
    isUsingMySQL: boolean;
    host: string;
    database: string;
    charset: string;
    latencyMs: number;
    tableCounts: Record<string, number>;
    statusText: string;
    error?: string;
    lastChecked: string;
  }> {
    const host = process.env.DB_HOST || 'localhost';
    const database = process.env.DB_NAME || 'mrvir111_mangata_db';
    const startTime = Date.now();

    if (this.isUsingMySQL && this.pool) {
      try {
        const conn = await this.pool.getConnection();
        await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        await conn.query("SET CHARACTER SET utf8mb4");
        conn.release();

        const latencyMs = Date.now() - startTime;
        const tables = ['users', 'series', 'chapters', 'comments', 'reports', 'notifications', 'wallet_transactions', 'purchased_chapters'];
        const tableCounts: Record<string, number> = {};

        for (const t of tables) {
          try {
            const [[{ count }]] = await this.pool.execute(`SELECT COUNT(*) as count FROM \`${t}\``) as any;
            tableCounts[t] = count || 0;
          } catch (e) {
            tableCounts[t] = 0;
          }
        }

        return {
          connected: true,
          isUsingMySQL: true,
          host,
          database,
          charset: 'utf8mb4_unicode_ci',
          latencyMs,
          tableCounts,
          statusText: 'متصل به MySQL (پشتیبانی کامل از کاراکترهای فارسی utf8mb4)',
          lastChecked: new Date().toISOString()
        };
      } catch (err: any) {
        return {
          connected: false,
          isUsingMySQL: true,
          host,
          database,
          charset: 'utf8mb4',
          latencyMs: Date.now() - startTime,
          tableCounts: {},
          statusText: `خطا در اتصال به دیتابیس MySQL: ${err.message}`,
          error: err.message,
          lastChecked: new Date().toISOString()
        };
      }
    }

    return {
      connected: true,
      isUsingMySQL: false,
      host: 'محیط محلی (local-db.json)',
      database: 'local-db.json',
      charset: 'utf8',
      latencyMs: Date.now() - startTime,
      tableCounts: {
        users: (this.localData.users || []).length,
        series: (this.localData.series || []).length,
        chapters: (this.localData.chapters || []).length,
        comments: (this.localData.comments || []).length,
        reports: (this.localData.reports || []).length,
        notifications: (this.localData.notifications || []).length,
        wallet_transactions: (this.localData.wallet_transactions || []).length,
        purchased_chapters: (this.localData.purchased_chapters || []).length
      },
      statusText: 'حالت آفلاین / ذخیره‌سازی محلی (local-db.json)',
      lastChecked: new Date().toISOString()
    };
  }

  async fixCharset(): Promise<{ success: boolean; message: string }> {
    if (this.isUsingMySQL && this.pool) {
      try {
        await this.pool.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        await this.pool.query("SET CHARACTER SET utf8mb4");
        try {
          await this.pool.execute("ALTER DATABASE CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci");
        } catch (e) {}

        const tables = ['users', 'series', 'chapters', 'comments', 'bookmarks', 'history', 'ratings', 'settings', 'reports', 'notifications', 'wallet_transactions', 'purchased_chapters'];
        for (const t of tables) {
          try {
            await this.pool.execute(`ALTER TABLE \`${t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          } catch (e) {
            console.error(`Failed to convert table ${t} to utf8mb4:`, e);
          }
        }
        return { success: true, message: 'انکودینگ تمام تیبل‌های دیتابیس با موفقیت به utf8mb4_unicode_ci ارتقا یافت و مشکل علامت‌های سوال (???) برطرف گردید.' };
      } catch (err: any) {
        return { success: false, message: `خطا در بروزرسانی انکودینگ دیتابیس: ${err.message}` };
      }
    }
    return { success: true, message: 'دیتابیس در حالت ذخیره‌سازی محلی (JSON) قرار دارد و تمام فایل‌ها با انکودینگ UTF-8 ذخیره می‌شوند.' };
  }
}

export const dbManager = new DatabaseManager();
