# راهنمای گام به گام اتصال دیتابیس هاست سی‌پنل (cPanel)

سلام! این یک راهنمای بسیار ساده، به زبان فارسی و گام به گام برای شماست تا بدون نیاز به دانش قبلی، دیتابیس MySQL هاست سی پنل خود را بسازید و به سایت متصل کنید. 

با اتصال مناسب، اطلاعات سایت مستقیماً بر روی هاست شخصی شما ذخیره می‌شود و همزمان می‌توانید نتایج تغییرات را در همین‌جا (AI Studio) با سرعت بالا مشاهده نمایید.

---

## 🛠️ گام اول: ساخت دیتابیس در cPanel

1. وارد کنترل پنل هاست خود (**cPanel**) شوید.
2. از بخش **Databases**، بر روی گزینه **MySQL® Database Wizard** کلیک کنید.
3. **مرحله ۱ (Step 1):** یک نام برای دیتابیس خود انتخاب کنید (مثلاً `asuradb`) و دکمه **Next Step** را بزنید.
4. **مرحله ۲ (Step 2):** یک نام کاربری (Username) برای دیتابیس بسازید و یک رمز عبور (Password) قوی انتخاب کنید. حتماً نام کاربری و رمز عبور را در یک فایل متنی یادداشت کنید. سپس دکمه **Create User** را کلیک کنید.
5. **مرحله ۳ (Step 3):** تیک گزینه **ALL PRIVILEGES** را فعال کنید تا تمام دسترسی‌ها به این نام کاربری داده شود. سپس به پایین صفحه اسکرول کرده و دکمه **Make Changes** یا **Next Step** را بزنید.
6. اکنون دیتابیس شما با موفقیت ساخته شده است!

---

## 🌐 گام دوم: فعال‌سازی دسترسی از راه دور (Remote MySQL)

**بسیار مهم:** برای اینکه سایت شما از محیط AI Studio (و سرورهای ابری) بتواند به دیتابیس هاست شما متصل شود و اطلاعات را ذخیره کند، باید این دسترسی را در سی‌پنل آزاد کنید:

1. در صفحه اصلی cPanel، از بخش **Databases** گزینه **Remote MySQL®** را پیدا کرده و بر روی آن کلیک کنید.
2. در کادر متنی **Add Access Host**، کاراکتر درصد یعنی `%` را وارد کنید. (این کاراکتر به سرور ما اجازه می‌دهد که از راه دور به دیتابیس متصل شود).
3. بر روی دکمه **Add Host** کلیک کنید.
4. پیامی مبنی بر موفقیت‌آمیز بودن اضافه شدن هاست نمایش داده خواهد شد.

---

## 📝 گام سوم: تنظیم اطلاعات در پروژه (ثبت مشخصات)

اکنون کافیست این اطلاعات را در فایل تنظیمات محیطی پروژه به نام `.env` وارد کنید. 
فایل `.env` را در ریشه وب‌سایت ایجاد یا ویرایش کنید و مقادیر زیر را جایگزین نمایید:

```env
DB_HOST=آدرس سرور یا آی‌پی هاست شما (مثلاً mail.yourdomain.com یا آی‌پی مستقیم هاست)
DB_USER=نام کاربری دیتابیس ساخته شده در گام اول
DB_PASSWORD=رمز عبور دیتابیس ساخته شده در گام اول
DB_NAME=نام دیتابیس ساخته شده در گام اول
DB_PORT=3306
```

> **نکته هوشمندانه:** سرور ما به صورت کاملاً هوشمند طراحی شده است؛ تا زمانی که مقادیر بالا را در فایل `.env` وارد نکرده‌اید، سایت شما از یک **شبیه‌ساز دیتابیس محلی (فایل پر سرعت JSON)** استفاده می‌کند تا سایت بدون هیچ خطا و وقفه ای کار کند و بتوانید به راحتی آن را تست کنید! به محض پر کردن فایل `.env`، دیتابیس به صورت خودکار به هاست شما منتقل خواهد شد.

---

## 📋 گام چهارم: ساخت و ایمپورت جداول به صورت دستی (اختیاری)

اگر هاست شما اجازه ساخت خودکار جداول را از خارج به دیتابیس ندهد، کافیست کدهای SQL زیر را در بخش **phpMyAdmin** دیتابیس خود کپی و اجرا (Run query) کنید:

```sql
-- 1. دستور تغییر انکودینگ کل دیتابیس به utf8mb4 (جهت پشتیبانی کامل از زبان فارسی و تمام زبان‌ها)
ALTER DATABASE CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 2. جدول کاربران
CREATE TABLE IF NOT EXISTS users (
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
  walletBalance INT DEFAULT 0,
  hasCompletedSetup TINYINT(1) DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. جدول کمیک‌ها و مانهواها
CREATE TABLE IF NOT EXISTS series (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  alternativeTitles TEXT,
  cover TEXT,
  banner TEXT,
  author VARCHAR(100),
  artist VARCHAR(100),
  synopsis TEXT,
  genres TEXT,
  tags TEXT,
  status VARCHAR(50) DEFAULT 'Ongoing',
  rating DOUBLE DEFAULT 0.0,
  type VARCHAR(50) DEFAULT 'Manhwa',
  views INT DEFAULT 0,
  isHero TINYINT(1) DEFAULT 0,
  contributors TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. جدول چپترها
CREATE TABLE IF NOT EXISTS chapters (
  id VARCHAR(100) PRIMARY KEY,
  seriesId VARCHAR(100) NOT NULL,
  number DOUBLE NOT NULL,
  title VARCHAR(255) DEFAULT '',
  images TEXT,
  views INT DEFAULT 0,
  isPending TINYINT(1) DEFAULT 0,
  submissions TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. جدول کامنت‌ها
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(100) PRIMARY KEY,
  chapterId VARCHAR(100) NOT NULL,
  userId VARCHAR(100) NOT NULL,
  userName VARCHAR(100) NOT NULL,
  userAvatar TEXT,
  content TEXT NOT NULL,
  likes TEXT,
  dislikes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. جدول نشان‌شده‌ها (بوک‌مارک)
CREATE TABLE IF NOT EXISTS bookmarks (
  userId VARCHAR(100) NOT NULL,
  seriesId VARCHAR(100) NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, seriesId),
  FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. جدول تاریخچه خواندن
CREATE TABLE IF NOT EXISTS history (
  userId VARCHAR(100) NOT NULL,
  seriesId VARCHAR(100) NOT NULL,
  chapterId VARCHAR(100) NOT NULL,
  chapterNumber DOUBLE NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, seriesId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. جدول امتیازات
CREATE TABLE IF NOT EXISTS ratings (
  userId VARCHAR(100) NOT NULL,
  seriesId VARCHAR(100) NOT NULL,
  score DOUBLE NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, seriesId),
  FOREIGN KEY (seriesId) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. جدول تنظیمات سایت
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(50) PRIMARY KEY,
  val TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. ارتقای تمام جداول موجود به انکودینگ utf8mb4 (حل مشکل علائم سوال ??? در کاراکترهای فارسی)
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE series CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE chapters CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE comments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE bookmarks CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE history CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE ratings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE settings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE reports CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE notifications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE wallet_transactions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE purchased_chapters CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE settlement_requests CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
