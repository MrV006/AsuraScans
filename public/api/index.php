<?php
// PHP Backend for AsuraClone - Shared Hosting Compatible
// Configured for mr-v.ir

// Error reporting (for debugging, set to 0 in production)
ini_set('display_errors', 1);
error_reporting(E_ALL);

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, x-admin-uid, x-user-uid, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Database Credentials from user
define('DB_HOST', 'localhost');
define('DB_USER', 'mrvir111_MrV');
define('DB_PASS', 'gB3(td@~iji9H2~d');
define('DB_NAME', 'mrvir111_mangata_db');
define('DB_PORT', '3306');

// Establish PDO connection
try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("SET CHARACTER SET utf8mb4");
} catch (PDOException $e) {
    echo json_encode(["error" => "Database connection failed: " . $e->getMessage()]);
    exit();
}

// Auto-create database schema tables if they don't exist
ensureSchema($pdo);

// -----------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------

function getJsonInput() {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}

function getUserFromHeaders($pdo) {
    $uid = null;
    
    // 1. Check $_SERVER for standard HTTP header mapping (extremely robust on shared hosts / FastCGI)
    if (isset($_SERVER['HTTP_X_USER_UID'])) {
        $uid = $_SERVER['HTTP_X_USER_UID'];
    } elseif (isset($_SERVER['HTTP_X_ADMIN_UID'])) {
        $uid = $_SERVER['HTTP_X_ADMIN_UID'];
    }
    
    // 2. Fallback to apache_request_headers if available
    if (!$uid && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if ($headers) {
            $uid = isset($headers['x-user-uid']) ? $headers['x-user-uid'] : (isset($headers['x-admin-uid']) ? $headers['x-admin-uid'] : null);
            if (!$uid) {
                foreach ($headers as $key => $val) {
                    if (strtolower($key) === 'x-user-uid' || strtolower($key) === 'x-admin-uid') {
                        $uid = $val;
                        break;
                    }
                }
            }
        }
    }
    
    // 3. Fallback to manually checking all $_SERVER keys
    if (!$uid) {
        foreach ($_SERVER as $key => $val) {
            if (strtolower($key) === 'http_x_user_uid' || strtolower($key) === 'http_x_admin_uid') {
                $uid = $val;
                break;
            }
        }
    }
    
    if (!$uid) return null;
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$uid]);
    $user = $stmt->fetch();
    if (!$user) return null;
    
    // Parse roles/permissions
    $roleVal = $user['role'] ?: 'user';
    $user['roles'] = $user['rolesText'] ? array_filter(array_map('trim', explode(',', $user['rolesText']))) : [$roleVal];
    $user['permissions'] = $user['permissionsText'] ? array_filter(array_map('trim', explode(',', $user['permissionsText']))) : [];
    $user['banned'] = (bool)$user['banned'];
    $user['canCreateSeries'] = (bool)$user['canCreateSeries'];
    $user['walletBalance'] = (int)($user['walletBalance'] ?: 0);
    $user['hasCompletedSetup'] = (bool)$user['hasCompletedSetup'];
    return $user;
}

function isSuperAdminUser($user) {
    if (!$user) return false;
    $roles = isset($user['roles']) ? $user['roles'] : (isset($user['rolesText']) && $user['rolesText'] ? array_filter(array_map('trim', explode(',', $user['rolesText']))) : [$user['role']]);
    if (in_array('super_admin', $roles)) return true;
    if (isset($user['email']) && ($user['email'] === 'amirrezaveisi45@gmail.com' || $user['email'] === 'Mr.V@admin.com')) return true;
    return false;
}

function requireAdmin($pdo) {
    $user = getUserFromHeaders($pdo);
    if (!$user || $user['banned'] || $user['role'] !== 'admin') {
        sendResponse(["error" => "دسترسی غیرمجاز. این عملیات نیاز به سطح مدیریت دارد."], 403);
    }
    return $user;
}

function requireStaffOrAdmin($pdo) {
    $user = getUserFromHeaders($pdo);
    if (!$user || $user['banned'] || !in_array($user['role'], ['admin', 'staff'])) {
        sendResponse(["error" => "دسترسی غیرمجاز. این عملیات نیاز به سطح کاربری ادمین یا نویسنده دارد."], 403);
    }
    return $user;
}

// Ensure database tables exist
function ensureSchema($pdo) {
    try {
        $pdo->exec("ALTER DATABASE CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci");
    } catch (Exception $e) {}

    $queries = [
        "CREATE TABLE IF NOT EXISTS users (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS series (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS chapters (
            id VARCHAR(100) PRIMARY KEY,
            seriesId VARCHAR(100) NOT NULL,
            number DOUBLE NOT NULL,
            title VARCHAR(255) DEFAULT '',
            images TEXT,
            views INT DEFAULT 0,
            isPending TINYINT(1) DEFAULT 0,
            submissions TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS comments (
            id VARCHAR(100) PRIMARY KEY,
            chapterId VARCHAR(100) NOT NULL,
            userId VARCHAR(100) NOT NULL,
            userName VARCHAR(100) NOT NULL,
            userAvatar TEXT,
            content TEXT NOT NULL,
            parentId VARCHAR(100),
            status VARCHAR(20) DEFAULT 'pending',
            likes TEXT,
            dislikes TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS bookmarks (
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (userId, seriesId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS history (
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            chapterId VARCHAR(100) NOT NULL,
            chapterNumber DOUBLE NOT NULL,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (userId, seriesId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS ratings (
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            score DOUBLE NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (userId, seriesId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS settings (
            id VARCHAR(50) PRIMARY KEY,
            val TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS reports (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            userName VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS chapter_views_log (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            chapterId VARCHAR(100) NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_chap_view (userId, chapterId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            type VARCHAR(50) DEFAULT 'system',
            title VARCHAR(255) NOT NULL,
            body TEXT,
            link VARCHAR(255),
            isRead TINYINT(1) DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS wallet_transactions (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            userName VARCHAR(100) NOT NULL,
            amount INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            description TEXT,
            creatorId VARCHAR(100) NOT NULL,
            creatorName VARCHAR(100) NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS purchased_chapters (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            chapterId VARCHAR(100) NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_chap (userId, seriesId, chapterId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS settlement_requests (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            userName VARCHAR(100),
            userEmail VARCHAR(255),
            amount INT NOT NULL,
            cardOrSheba VARCHAR(100) NOT NULL,
            accountHolder VARCHAR(100) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            rejectionNote TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            processedAt DATETIME NULL,
            processedBy VARCHAR(100) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS tickets (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            userName VARCHAR(100) NOT NULL,
            userEmail VARCHAR(255),
            userAvatar TEXT,
            subject VARCHAR(255) NOT NULL,
            category VARCHAR(50) DEFAULT 'other',
            priority VARCHAR(20) DEFAULT 'medium',
            status VARCHAR(20) DEFAULT 'open',
            assignedTo VARCHAR(100),
            assignedToName VARCHAR(100),
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        "CREATE TABLE IF NOT EXISTS ticket_messages (
            id VARCHAR(100) PRIMARY KEY,
            ticketId VARCHAR(100) NOT NULL,
            senderId VARCHAR(100) NOT NULL,
            senderName VARCHAR(100) NOT NULL,
            senderAvatar TEXT,
            senderRole VARCHAR(20) DEFAULT 'user',
            content TEXT NOT NULL,
            attachments TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    ];

    foreach ($queries as $q) {
        $pdo->exec($q);
    }

    // Auto convert all tables to utf8mb4_unicode_ci
    $tablesToConvert = [
        'users', 'series', 'chapters', 'comments', 'bookmarks', 
        'history', 'ratings', 'settings', 'reports', 'notifications', 
        'wallet_transactions', 'purchased_chapters', 'settlement_requests'
    ];
    foreach ($tablesToConvert as $t) {
        try {
            $pdo->exec("ALTER TABLE `$t` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        } catch (Exception $e) {}
    }

    try {
        $pdo->exec("ALTER TABLE comments ADD COLUMN parentId VARCHAR(100) DEFAULT NULL");
    } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE comments ADD COLUMN status VARCHAR(20) DEFAULT 'pending'");
    } catch (Exception $e) {}
    try {
        $pdo->exec("UPDATE comments SET status = 'approved' WHERE status IS NULL OR status = ''");
    } catch (Exception $e) {}

    // Migrate existing users' melliCode to 8-digit random unique codes if empty or not 8 digits
    $stmt = $pdo->query("SELECT id, melliCode FROM users");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($users as $u) {
        $code = $u['melliCode'] ?? '';
        if (strlen($code) !== 8 || !preg_match('/^\d{8}$/', $code)) {
            $newCode = (string)rand(10000000, 99999999);
            $stmtUpdate = $pdo->prepare("UPDATE users SET melliCode = ? WHERE id = ?");
            $stmtUpdate->execute([$newCode, $u['id']]);
        }
    }

    // Migrate series table to add isHero column if not exists
    try {
        $pdo->exec("ALTER TABLE series ADD COLUMN isHero TINYINT(1) DEFAULT 0");
    } catch (PDOException $e) {
        // Ignored if column already exists
    }

    // Migrate chapters table to add sortMode column if not exists
    try {
        $pdo->exec("ALTER TABLE chapters ADD COLUMN sortMode VARCHAR(50) DEFAULT 'natural'");
    } catch (PDOException $e) {
        // Ignored if column already exists
    }
}

// Mini Route Matcher
function matchRoute($pattern, $path, &$params = []) {
    $regex = '^' . preg_replace('/:[a-zA-Z0-9_]+/', '([^/]+)', $pattern) . '$';
    if (preg_match('#' . $regex . '#', $path, $matches)) {
        array_shift($matches);
        preg_match_all('/:([a-zA-Z0-9_]+)/', $pattern, $param_names);
        $names = $param_names[1];
        foreach ($names as $index => $name) {
            $params[$name] = urldecode($matches[$index]);
        }
        return true;
    }
    return false;
}

// Get requested path relative to /api/
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$api_pos = strpos($path, '/api/');
if ($api_pos !== false) {
    $sub_path = substr($path, $api_pos + 4);
} else {
    // direct file fallback
    $sub_path = $path;
}

$method = $_SERVER['REQUEST_METHOD'];
$params = [];

// -----------------------------------------------------------------
// Route Handlers
// -----------------------------------------------------------------

// 1. HEALTHCHECK
if ($method === 'GET' && $sub_path === '/health') {
    sendResponse(["status" => "ok"]);
}

// 2. SEED DATABASE
if ($method === 'POST' && $sub_path === '/seed') {
    $input = getJsonInput();
    $series = isset($input['series']) ? $input['series'] : [];
    $admins = isset($input['admins']) ? $input['admins'] : [];
    
    // Seed series
    foreach ($series as $s) {
        // Save series
        $stmt = $pdo->prepare("INSERT INTO series (id, title, alternativeTitles, cover, banner, author, artist, synopsis, genres, tags, status, rating, type, views, contributors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), alternativeTitles=VALUES(alternativeTitles), cover=VALUES(cover), banner=VALUES(banner), author=VALUES(author), artist=VALUES(artist), synopsis=VALUES(synopsis), genres=VALUES(genres), tags=VALUES(tags), status=VALUES(status), rating=VALUES(rating), type=VALUES(type), views=VALUES(views), contributors=VALUES(contributors)");
        $stmt->execute([
            $s['id'],
            $s['title'],
            implode(',', isset($s['alternativeTitles']) ? $s['alternativeTitles'] : []),
            isset($s['cover']) ? $s['cover'] : '',
            isset($s['banner']) ? $s['banner'] : '',
            isset($s['author']) ? $s['author'] : '',
            isset($s['artist']) ? $s['artist'] : '',
            isset($s['synopsis']) ? $s['synopsis'] : '',
            implode(',', isset($s['genres']) ? $s['genres'] : []),
            implode(',', isset($s['tags']) ? $s['tags'] : []),
            isset($s['status']) ? $s['status'] : 'Ongoing',
            isset($s['rating']) ? (double)$s['rating'] : 0.0,
            isset($s['type']) ? $s['type'] : 'Manhwa',
            isset($s['views']) ? (int)$s['views'] : 0,
            json_encode(isset($s['contributors']) ? $s['contributors'] : [])
        ]);
        
        // Seed chapters
        if (isset($s['chapters'])) {
            foreach ($s['chapters'] as $ch) {
                $stmtCh = $pdo->prepare("INSERT INTO chapters (id, seriesId, number, title, images, views, isPending, submissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE seriesId=VALUES(seriesId), number=VALUES(number), title=VALUES(title), images=VALUES(images), views=VALUES(views), isPending=VALUES(isPending), submissions=VALUES(submissions)");
                $stmtCh->execute([
                    $ch['id'],
                    $s['id'],
                    (double)$ch['number'],
                    isset($ch['title']) ? $ch['title'] : '',
                    implode(',', isset($ch['images']) ? $ch['images'] : []),
                    isset($ch['views']) ? (int)$ch['views'] : 0,
                    0,
                    '[]'
                ]);
            }
        }
    }
    
    // Seed admins
    foreach ($admins as $uid) {
        $stmt = $pdo->prepare("INSERT INTO users (id, email, displayName, avatarUrl, banned, role, walletBalance, hasCompletedSetup) VALUES (?, ?, ?, ?, 0, 'admin', 0, 1) ON DUPLICATE KEY UPDATE role='admin'");
        $stmt->execute([
            $uid,
            'admin@example.com',
            'Site Admin',
            ''
        ]);
    }
    
    sendResponse(["success" => true, "message" => "Database seeded successfully!"]);
}

// 3. REGISTER
if ($method === 'POST' && $sub_path === '/auth/register') {
    $input = getJsonInput();
    $email = isset($input['email']) ? trim($input['email']) : null;
    $displayName = isset($input['displayName']) ? trim($input['displayName']) : null;
    $password = isset($input['password']) ? $input['password'] : null;
    
    if (!$email || !$displayName || !$password) {
        sendResponse(["error" => "لطفا تمام فیلدها را پر کنید."], 400);
    }
    
    // Check existing email
    $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = ?");
    $stmt->execute([strtolower($email)]);
    if ($stmt->fetch()) {
        sendResponse(["error" => "ایمیلی با این آدرس از قبل وجود دارد."], 400);
    }
    
    // Check username
    $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(displayName) = ?");
    $stmt->execute([strtolower($displayName)]);
    if ($stmt->fetch()) {
        sendResponse(["error" => "نام کاربری تکراری است."], 400);
    }
    
    $id = 'user-' . round(microtime(true) * 1000);
    $hashedPassword = hash('sha256', $password);
    
    $stmt = $pdo->prepare("INSERT INTO users (id, email, displayName, password, avatarUrl, role, hasCompletedSetup, walletBalance) VALUES (?, ?, ?, ?, '', 'user', 0, 0)");
    $stmt->execute([$id, $email, $displayName, $hashedPassword]);
    
    sendResponse([
        "id" => $id,
        "email" => $email,
        "displayName" => $displayName,
        "avatarUrl" => "",
        "role" => "user",
        "roles" => ["user"],
        "permissions" => [],
        "walletBalance" => 0,
        "hasCompletedSetup" => false
    ]);
}

// 4. LOGIN
if ($method === 'POST' && $sub_path === '/auth/login') {
    $input = getJsonInput();
    $identifier = isset($input['identifier']) ? trim($input['identifier']) : null;
    $password = isset($input['password']) ? $input['password'] : null;
    
    if (!$identifier || !$password) {
        sendResponse(["error" => "لطفا تمام فیلدها را پر کنید."], 400);
    }
    
    // Try email or username
    $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(displayName) = ?");
    $stmt->execute([strtolower($identifier), strtolower($identifier)]);
    $user = $stmt->fetch();
    
    if (!$user) {
        sendResponse(["error" => "کاربری با این مشخصات یافت نشد."], 401);
    }
    
    if ((bool)$user['banned']) {
        sendResponse(["error" => "حساب کاربری شما مسدود شده است."], 403);
    }
    
    $hashedPassword = hash('sha256', $password);
    if ($user['password'] !== $hashedPassword) {
        sendResponse(["error" => "رمز عبور اشتباه است."], 401);
    }
    
    // Clean and return
    unset($user['password']);
    $roleVal = $user['role'] ?: 'user';
    $user['roles'] = $user['rolesText'] ? array_filter(array_map('trim', explode(',', $user['rolesText']))) : [$roleVal];
    $user['permissions'] = $user['permissionsText'] ? array_filter(array_map('trim', explode(',', $user['permissionsText']))) : [];
    $user['banned'] = (bool)$user['banned'];
    $user['canCreateSeries'] = (bool)$user['canCreateSeries'];
    $user['walletBalance'] = (int)($user['walletBalance'] ?: 0);
    $user['hasCompletedSetup'] = (bool)$user['hasCompletedSetup'];
    
    sendResponse($user);
}

// 5. GOOGLE AUTH
if ($method === 'POST' && $sub_path === '/auth/google') {
    $input = getJsonInput();
    $email = isset($input['email']) ? trim($input['email']) : null;
    if (!$email) {
        sendResponse(["error" => "ایمیل از گوگل دریافت نشد."], 400);
    }
    
    $displayName = isset($input['displayName']) ? trim($input['displayName']) : explode('@', $email)[0];
    $avatarUrl = isset($input['avatarUrl']) ? $input['avatarUrl'] : '';
    $firstName = isset($input['firstName']) ? $input['firstName'] : '';
    $lastName = isset($input['lastName']) ? $input['lastName'] : '';
    $phoneNumber = isset($input['phoneNumber']) ? $input['phoneNumber'] : '';
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(email) = ?");
    $stmt->execute([strtolower($email)]);
    $user = $stmt->fetch();
    
    if ($user) {
        // Update blank fields
        $updates = [];
        $params = [];
        if (!$user['avatarUrl'] && $avatarUrl) { $updates[] = "avatarUrl = ?"; $params[] = $avatarUrl; }
        if (!$user['firstName'] && $firstName) { $updates[] = "firstName = ?"; $params[] = $firstName; }
        if (!$user['lastName'] && $lastName) { $updates[] = "lastName = ?"; $params[] = $lastName; }
        if (!$user['phoneNumber'] && $phoneNumber) { $updates[] = "phoneNumber = ?"; $params[] = $phoneNumber; }
        
        if (!empty($updates)) {
            $params[] = $user['id'];
            $stmtUpdate = $pdo->prepare("UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?");
            $stmtUpdate->execute($params);
            
            // Re-fetch
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $user = $stmt->fetch();
        }
    } else {
        // Create new
        $id = 'user-google-' . round(microtime(true) * 1000);
        $stmtInsert = $pdo->prepare("INSERT INTO users (id, email, displayName, avatarUrl, banned, role, melliCode, firstName, lastName, phoneNumber, canCreateSeries, walletBalance, hasCompletedSetup) VALUES (?, ?, ?, ?, 0, 'user', '', ?, ?, ?, 0, 0, 0)");
        $stmtInsert->execute([$id, $email, $displayName, $avatarUrl, $firstName, $lastName, $phoneNumber]);
        
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch();
    }
    
    unset($user['password']);
    $roleVal = $user['role'] ?: 'user';
    $user['roles'] = $user['rolesText'] ? array_filter(array_map('trim', explode(',', $user['rolesText']))) : [$roleVal];
    $user['permissions'] = $user['permissionsText'] ? array_filter(array_map('trim', explode(',', $user['permissionsText']))) : [];
    $user['banned'] = (bool)$user['banned'];
    $user['canCreateSeries'] = (bool)$user['canCreateSeries'];
    $user['walletBalance'] = (int)($user['walletBalance'] ?: 0);
    $user['hasCompletedSetup'] = (bool)$user['hasCompletedSetup'];
    
    sendResponse($user);
}

// 6. GET USERS LIST (ADMIN)
if ($method === 'GET' && $sub_path === '/users') {
    requireAdmin($pdo);
    $stmt = $pdo->query("SELECT * FROM users ORDER BY createdAt DESC");
    $users = $stmt->fetchAll();
    foreach ($users as &$u) {
        unset($u['password']);
        $roleVal = $u['role'] ?: 'user';
        $u['roles'] = $u['rolesText'] ? array_filter(array_map('trim', explode(',', $u['rolesText']))) : [$roleVal];
        $u['permissions'] = $u['permissionsText'] ? array_filter(array_map('trim', explode(',', $u['permissionsText']))) : [];
        $u['banned'] = (bool)$u['banned'];
        $u['canCreateSeries'] = (bool)$u['canCreateSeries'];
        $u['walletBalance'] = (int)($u['walletBalance'] ?: 0);
        $u['hasCompletedSetup'] = (bool)$u['hasCompletedSetup'];
    }
    sendResponse($users);
}

// 7. GET SINGLE USER
if ($method === 'GET' && matchRoute('/users/:id', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$params['id']]);
    $u = $stmt->fetch();
    if (!$u) {
        sendResponse(["error" => "کاربر یافت نشد."], 404);
    }
    unset($u['password']);
    $roleVal = $u['role'] ?: 'user';
    $u['roles'] = $u['rolesText'] ? array_filter(array_map('trim', explode(',', $u['rolesText']))) : [$roleVal];
    $u['permissions'] = $u['permissionsText'] ? array_filter(array_map('trim', explode(',', $u['permissionsText']))) : [];
    $u['banned'] = (bool)$u['banned'];
    $u['canCreateSeries'] = (bool)$u['canCreateSeries'];
    $u['walletBalance'] = (int)($u['walletBalance'] ?: 0);
    $u['hasCompletedSetup'] = (bool)$u['hasCompletedSetup'];
    sendResponse($u);
}

// 8. UPDATE USER PROFILE (POST)
if ($method === 'POST' && $sub_path === '/users') {
    $input = getJsonInput();
    $id = isset($input['id']) ? $input['id'] : null;
    if (!$id) {
        sendResponse(["error" => "شناسه کاربر الزامی است."], 400);
    }
    
    // Check existing
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        sendResponse(["error" => "کاربر یافت نشد."], 404);
    }
    
    // Fields to update
    $displayName = isset($input['displayName']) ? $input['displayName'] : $existing['displayName'];
    $avatarUrl = isset($input['avatarUrl']) ? $input['avatarUrl'] : $existing['avatarUrl'];
    $melliCode = isset($input['melliCode']) ? $input['melliCode'] : $existing['melliCode'];
    $firstName = isset($input['firstName']) ? $input['firstName'] : $existing['firstName'];
    $lastName = isset($input['lastName']) ? $input['lastName'] : $existing['lastName'];
    $phoneNumber = isset($input['phoneNumber']) ? $input['phoneNumber'] : $existing['phoneNumber'];
    $hasCompletedSetup = isset($input['hasCompletedSetup']) ? ($input['hasCompletedSetup'] ? 1 : 0) : $existing['hasCompletedSetup'];
    
    $stmtUpdate = $pdo->prepare("UPDATE users SET displayName = ?, avatarUrl = ?, melliCode = ?, firstName = ?, lastName = ?, phoneNumber = ?, hasCompletedSetup = ? WHERE id = ?");
    $stmtUpdate->execute([$displayName, $avatarUrl, $melliCode, $firstName, $lastName, $phoneNumber, $hasCompletedSetup, $id]);
    
    // Fetch updated user
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $u = $stmt->fetch();
    unset($u['password']);
    
    $roleVal = $u['role'] ?: 'user';
    $u['roles'] = $u['rolesText'] ? array_filter(array_map('trim', explode(',', $u['rolesText']))) : [$roleVal];
    $u['permissions'] = $u['permissionsText'] ? array_filter(array_map('trim', explode(',', $u['permissionsText']))) : [];
    $u['banned'] = (bool)$u['banned'];
    $u['canCreateSeries'] = (bool)$u['canCreateSeries'];
    $u['walletBalance'] = (int)($u['walletBalance'] ?: 0);
    $u['hasCompletedSetup'] = (bool)$u['hasCompletedSetup'];
    sendResponse($u);
}

// 9. BAN USER (ADMIN)
if ($method === 'PUT' && matchRoute('/users/:id/ban', $sub_path, $params)) {
    $caller = requireAdmin($pdo);
    if ($caller['id'] === $params['id']) {
        sendResponse(["error" => "شما نمی‌توانید حساب کاربری خودتان را مسدود کنید."], 400);
    }
    
    // Fetch target user to check if they are super admin
    $stmtT = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmtT->execute([$params['id']]);
    $targetUser = $stmtT->fetch();
    if ($targetUser && isSuperAdminUser($targetUser)) {
        sendResponse(["error" => "مسدود کردن مدیریت کل امکان‌پذیر نیست."], 400);
    }

    $input = getJsonInput();
    $banned = isset($input['banned']) ? ($input['banned'] ? 1 : 0) : 0;
    
    $stmt = $pdo->prepare("UPDATE users SET banned = ? WHERE id = ?");
    $stmt->execute([$banned, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 10. UPDATE USER ROLE & PERMISSIONS (ADMIN)
if ($method === 'PUT' && matchRoute('/users/:id/roles-permissions', $sub_path, $params)) {
    $caller = getUserFromHeaders($pdo);
    if (!$caller || !isSuperAdminUser($caller)) {
        sendResponse(["error" => "تنها مدیریت کل مجاز به ویرایش نقش‌ها و دسترسی‌ها می‌باشد."], 403);
    }
    if ($caller['id'] === $params['id']) {
        sendResponse(["error" => "مدیریت کل امکان تغییر یا تنزل نقش خود را ندارد."], 400);
    }

    $input = getJsonInput();
    $roles = isset($input['roles']) ? $input['roles'] : [];
    $permissions = isset($input['permissions']) ? $input['permissions'] : [];
    
    $rolesText = implode(',', $roles);
    $permissionsText = implode(',', $permissions);
    
    // Primary role is first of roles, or user
    $primaryRole = !empty($roles) ? $roles[0] : 'user';
    
    $stmt = $pdo->prepare("UPDATE users SET rolesText = ?, permissionsText = ?, role = ? WHERE id = ?");
    $stmt->execute([$rolesText, $permissionsText, $primaryRole, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 11. UPDATE ROLE (ADMIN)
if ($method === 'PUT' && matchRoute('/users/:id/role', $sub_path, $params)) {
    $caller = getUserFromHeaders($pdo);
    if (!$caller || !isSuperAdminUser($caller)) {
        sendResponse(["error" => "تنها مدیریت کل مجاز به ویرایش نقش کاربر می‌باشد."], 403);
    }
    if ($caller['id'] === $params['id']) {
        sendResponse(["error" => "مدیریت کل امکان تغییر یا تنزل نقش خود را ندارد."], 400);
    }

    $input = getJsonInput();
    $role = isset($input['role']) ? $input['role'] : 'user';
    
    $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
    $stmt->execute([$role, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 12. UPDATE CAN CREATE SERIES (ADMIN)
if ($method === 'PUT' && matchRoute('/users/:id/can-create-series', $sub_path, $params)) {
    $caller = getUserFromHeaders($pdo);
    if (!$caller || !isSuperAdminUser($caller)) {
        sendResponse(["error" => "تنها مدیریت کل مجاز به تغییر این دسترسی می‌باشد."], 403);
    }
    
    $input = getJsonInput();
    $canCreateSeries = isset($input['canCreateSeries']) ? ($input['canCreateSeries'] ? 1 : 0) : 0;
    
    $stmt = $pdo->prepare("UPDATE users SET canCreateSeries = ? WHERE id = ?");
    $stmt->execute([$canCreateSeries, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 12-B. DELETE USER (SUPER ADMIN ONLY)
if (($method === 'DELETE' && matchRoute('/users/:id', $sub_path, $params)) || ($method === 'POST' && matchRoute('/users/:id/delete', $sub_path, $params))) {
    $caller = getUserFromHeaders($pdo);
    if (!$caller || !isSuperAdminUser($caller)) {
        sendResponse(["error" => "تنها مدیریت کل مجاز به حذف حساب کاربری می‌باشد."], 403);
    }
    if ($caller['id'] === $params['id']) {
        sendResponse(["error" => "مدیریت کل امکان حذف حساب کاربری خودش را ندارد."], 400);
    }

    $targetId = $params['id'];

    // Delete user from all tables to prevent residue database crashes or partial deletion issues
    $tablesAndFields = [
        "bookmarks" => "userId",
        "history" => "userId",
        "ratings" => "userId",
        "comments" => "userId",
        "notifications" => "userId",
        "wallet_transactions" => "userId",
        "purchased_chapters" => "userId",
        "reports" => "userId",
        "users" => "id"
    ];

    foreach ($tablesAndFields as $table => $field) {
        try {
            $stmt = $pdo->prepare("DELETE FROM `{$table}` WHERE `{$field}` = ?");
            $stmt->execute([$targetId]);
        } catch (Exception $e) {
            // Ignore minor issues
        }
    }

    sendResponse(["success" => true]);
}

// 13. GET SERIES LIST (WITH FILTERS)
if ($method === 'GET' && $sub_path === '/series') {
    $q = isset($_GET['q']) ? $_GET['q'] : null;
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    $type = isset($_GET['type']) ? $_GET['type'] : null;
    $genresQuery = isset($_GET['genres']) ? $_GET['genres'] : '';
    $tagsQuery = isset($_GET['tags']) ? $_GET['tags'] : '';
    $sortBy = isset($_GET['sortBy']) ? $_GET['sortBy'] : 'newest';
    
    $queryStr = "SELECT * FROM series WHERE 1=1";
    $queryParams = [];
    
    if ($q) {
        $queryStr .= " AND (title LIKE ? OR author LIKE ? OR artist LIKE ? OR synopsis LIKE ?)";
        $lq = "%" . $q . "%";
        $queryParams[] = $lq;
        $queryParams[] = $lq;
        $queryParams[] = $lq;
        $queryParams[] = $lq;
    }
    
    if ($status) {
        $queryStr .= " AND status = ?";
        $queryParams[] = $status;
    }
    
    if ($type) {
        $queryStr .= " AND type = ?";
        $queryParams[] = $type;
    }
    
    $stmt = $pdo->prepare($queryStr);
    $stmt->execute($queryParams);
    $seriesList = $stmt->fetchAll();
    
    // Parsing lists and custom filters
    $result = [];
    $genresFilter = $genresQuery ? array_filter(explode(',', $genresQuery)) : [];
    $tagsFilter = $tagsQuery ? array_filter(explode(',', $tagsQuery)) : [];
    
    foreach ($seriesList as $s) {
        $alternativeTitles = $s['alternativeTitles'] ? array_filter(explode(',', $s['alternativeTitles'])) : [];
        $genres = $s['genres'] ? array_filter(explode(',', $s['genres'])) : [];
        $tags = $s['tags'] ? array_filter(explode(',', $s['tags'])) : [];
        $contributors = $s['contributors'] ? json_decode($s['contributors'], true) : [];
        if (!is_array($contributors)) $contributors = [];
        
        // Filter by genres
        if (!empty($genresFilter)) {
            $hasAllGenres = true;
            foreach ($genresFilter as $gf) {
                if (!in_array($gf, $genres)) {
                    $hasAllGenres = false;
                    break;
                }
            }
            if (!$hasAllGenres) continue;
        }
        
        // Filter by tags
        if (!empty($tagsFilter)) {
            $hasAllTags = true;
            foreach ($tagsFilter as $tf) {
                if (!in_array($tf, $tags)) {
                    $hasAllTags = false;
                    break;
                }
            }
            if (!$hasAllTags) continue;
        }
        
        $s['alternativeTitles'] = $alternativeTitles;
        $s['genres'] = $genres;
        $s['tags'] = $tags;
        $s['contributors'] = $contributors;
        $s['isHero'] = isset($s['isHero']) ? (bool)$s['isHero'] : false;
        $s['rating'] = (double)$s['rating'];
        $s['views'] = (int)$s['views'];
        $result[] = $s;
    }
    
    // Sort
    if ($sortBy === 'newest') {
        usort($result, function($a, $b) { return strtotime($b['createdAt']) - strtotime($a['createdAt']); });
    } else if ($sortBy === 'oldest') {
        usort($result, function($a, $b) { return strtotime($a['createdAt']) - strtotime($b['createdAt']); });
    } else if ($sortBy === 'views') {
        usort($result, function($a, $b) { return $b['views'] - $a['views']; });
    } else if ($sortBy === 'rating') {
        usort($result, function($a, $b) { return ($b['rating'] > $a['rating']) ? 1 : -1; });
    }
    
    sendResponse($result);
}

// 14. GET SINGLE SERIES BY ID
if ($method === 'GET' && matchRoute('/series/:id', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM series WHERE id = ?");
    $stmt->execute([$params['id']]);
    $s = $stmt->fetch();
    if (!$s) {
        sendResponse(["error" => "مجموعه یافت نشد."], 404);
    }
    
    $s['alternativeTitles'] = $s['alternativeTitles'] ? array_filter(explode(',', $s['alternativeTitles'])) : [];
    $s['genres'] = $s['genres'] ? array_filter(explode(',', $s['genres'])) : [];
    $s['tags'] = $s['tags'] ? array_filter(explode(',', $s['tags'])) : [];
    $s['contributors'] = $s['contributors'] ? json_decode($s['contributors'], true) : [];
    if (!is_array($s['contributors'])) $s['contributors'] = [];
    $s['isHero'] = isset($s['isHero']) ? (bool)$s['isHero'] : false;
    $s['rating'] = (double)$s['rating'];
    $s['views'] = (int)$s['views'];
    
    sendResponse($s);
}

// 15. SAVE / UPDATE SERIES
if ($method === 'POST' && $sub_path === '/series') {
    // Permission: Only authors/admins
    $user = requireStaffOrAdmin($pdo);
    
    $input = getJsonInput();
    $id = isset($input['id']) ? $input['id'] : null;
    if (!$id) {
        sendResponse(["error" => "شناسه مجموعه الزامی است."], 400);
    }
    
    $title = isset($input['title']) ? $input['title'] : '';
    $alternativeTitles = (isset($input['alternativeTitles']) && is_array($input['alternativeTitles'])) ? implode(',', $input['alternativeTitles']) : (isset($input['alternativeTitles']) ? $input['alternativeTitles'] : '');
    $cover = isset($input['cover']) ? $input['cover'] : '';
    $banner = isset($input['banner']) ? $input['banner'] : '';
    $author = isset($input['author']) ? $input['author'] : '';
    $artist = isset($input['artist']) ? $input['artist'] : '';
    $synopsis = isset($input['synopsis']) ? $input['synopsis'] : '';
    $genres = (isset($input['genres']) && is_array($input['genres'])) ? implode(',', $input['genres']) : (isset($input['genres']) ? $input['genres'] : '');
    $tags = (isset($input['tags']) && is_array($input['tags'])) ? implode(',', $input['tags']) : (isset($input['tags']) ? $input['tags'] : '');
    $status = isset($input['status']) ? $input['status'] : 'Ongoing';
    $rating = isset($input['rating']) ? (double)$input['rating'] : 0.0;
    $type = isset($input['type']) ? $input['type'] : 'Manhwa';
    $contributors = isset($input['contributors']) ? json_encode($input['contributors']) : '[]';
    $isHero = isset($input['isHero']) ? ($input['isHero'] ? 1 : 0) : 0;
    
    // Check if exists
    $stmtCheck = $pdo->prepare("SELECT id FROM series WHERE id = ?");
    $stmtCheck->execute([$id]);
    $exists = $stmtCheck->fetch();
    
    if ($exists) {
        $stmt = $pdo->prepare("UPDATE series SET title = ?, alternativeTitles = ?, cover = ?, banner = ?, author = ?, artist = ?, synopsis = ?, genres = ?, tags = ?, status = ?, type = ?, isHero = ? WHERE id = ?");
        $stmt->execute([$title, $alternativeTitles, $cover, $banner, $author, $artist, $synopsis, $genres, $tags, $status, $type, $isHero, $id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO series (id, title, alternativeTitles, cover, banner, author, artist, synopsis, genres, tags, status, rating, type, views, isHero, contributors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
        $stmt->execute([$id, $title, $alternativeTitles, $cover, $banner, $author, $artist, $synopsis, $genres, $tags, $status, $rating, $type, $isHero, $contributors]);
    }
    
    // Fetch and return
    $stmt = $pdo->prepare("SELECT * FROM series WHERE id = ?");
    $stmt->execute([$id]);
    $s = $stmt->fetch();
    
    $s['alternativeTitles'] = $s['alternativeTitles'] ? array_filter(explode(',', $s['alternativeTitles'])) : [];
    $s['genres'] = $s['genres'] ? array_filter(explode(',', $s['genres'])) : [];
    $s['tags'] = $s['tags'] ? array_filter(explode(',', $s['tags'])) : [];
    $s['contributors'] = $s['contributors'] ? json_decode($s['contributors'], true) : [];
    if (!is_array($s['contributors'])) $s['contributors'] = [];
    $s['isHero'] = isset($s['isHero']) ? (bool)$s['isHero'] : false;
    $s['rating'] = (double)$s['rating'];
    $s['views'] = (int)$s['views'];
    
    sendResponse($s);
}

// 16. DELETE SERIES (ADMIN)
if (($method === 'DELETE' && matchRoute('/series/:id', $sub_path, $params)) || ($method === 'POST' && matchRoute('/series/:id/delete', $sub_path, $params))) {
    requireAdmin($pdo);
    $seriesId = $params['id'];
    
    // Begin transaction
    $pdo->beginTransaction();
    try {
        // Delete chapters
        $stmtCh = $pdo->prepare("DELETE FROM chapters WHERE seriesId = ?");
        $stmtCh->execute([$seriesId]);
        
        // Delete bookmarks
        $stmtBk = $pdo->prepare("DELETE FROM bookmarks WHERE seriesId = ?");
        $stmtBk->execute([$seriesId]);
        
        // Delete history
        $stmtHi = $pdo->prepare("DELETE FROM history WHERE seriesId = ?");
        $stmtHi->execute([$seriesId]);
        
        // Delete ratings
        $stmtRt = $pdo->prepare("DELETE FROM ratings WHERE seriesId = ?");
        $stmtRt->execute([$seriesId]);
        
        // Delete purchased chapters
        $stmtPur = $pdo->prepare("DELETE FROM purchased_chapters WHERE seriesId = ?");
        $stmtPur->execute([$seriesId]);
        
        // Delete comments for those chapters
        $stmtComm = $pdo->prepare("DELETE FROM comments WHERE chapterId IN (SELECT id FROM chapters WHERE seriesId = ?)");
        $stmtComm->execute([$seriesId]);
        
        // Finally, delete series
        $stmt = $pdo->prepare("DELETE FROM series WHERE id = ?");
        $stmt->execute([$seriesId]);
        
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        sendResponse(["error" => "خطا در حذف مانهوا و داده‌های مرتبط: " . $e->getMessage()], 500);
    }
    
    sendResponse(["success" => true]);
}

// 17. INCREMENT SERIES VIEWS
if ($method === 'POST' && matchRoute('/series/:id/view', $sub_path, $params)) {
    $stmt = $pdo->prepare("UPDATE series SET views = views + 1 WHERE id = ?");
    $stmt->execute([$params['id']]);
    
    $stmtSelect = $pdo->prepare("SELECT views FROM series WHERE id = ?");
    $stmtSelect->execute([$params['id']]);
    $res = $stmtSelect->fetch();
    sendResponse(["views" => (int)$res['views']]);
}

// 18. REQUEST CONTRIBUTOR
if ($method === 'POST' && matchRoute('/series/:id/request-contributor', $sub_path, $params)) {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $role = isset($input['role']) ? $input['role'] : 'translator';
    $melliCode = isset($input['melliCode']) ? $input['melliCode'] : '';
    
    // Fetch series
    $stmt = $pdo->prepare("SELECT contributors FROM series WHERE id = ?");
    $stmt->execute([$params['id']]);
    $s = $stmt->fetch();
    if (!$s) sendResponse(["error" => "مجموعه یافت نشد."], 404);
    
    $contributors = $s['contributors'] ? json_decode($s['contributors'], true) : [];
    if (!is_array($contributors)) $contributors = [];
    
    // Check if already requested/approved
    $alreadyExists = false;
    foreach ($contributors as &$c) {
        if ($c['userId'] === $user['id']) {
            $c['role'] = $role;
            $c['melliCode'] = $melliCode;
            $c['status'] = 'pending';
            $alreadyExists = true;
            break;
        }
    }
    
    if (!$alreadyExists) {
        $contributors[] = [
            "userId" => $user['id'],
            "email" => $user['email'],
            "displayName" => $user['displayName'],
            "role" => $role,
            "melliCode" => $melliCode,
            "status" => "pending"
        ];
    }
    
    $stmtUpdate = $pdo->prepare("UPDATE series SET contributors = ? WHERE id = ?");
    $stmtUpdate->execute([json_encode($contributors), $params['id']]);
    
    sendResponse(["success" => true]);
}

// 19. APPROVE CONTRIBUTOR (ADMIN)
if ($method === 'POST' && matchRoute('/series/:id/approve-contributor', $sub_path, $params)) {
    requireAdmin($pdo);
    $input = getJsonInput();
    $userId = isset($input['userId']) ? $input['userId'] : null;
    $status = isset($input['status']) ? $input['status'] : 'approved'; // 'approved' or 'pending' (deleted)
    
    $stmt = $pdo->prepare("SELECT contributors FROM series WHERE id = ?");
    $stmt->execute([$params['id']]);
    $s = $stmt->fetch();
    if (!$s) sendResponse(["error" => "مجموعه یافت نشد."], 404);
    
    $contributors = $s['contributors'] ? json_decode($s['contributors'], true) : [];
    if (!is_array($contributors)) $contributors = [];
    
    if ($status === 'approved') {
        foreach ($contributors as &$c) {
            if ($c['userId'] === $userId) {
                $c['status'] = 'approved';
                break;
            }
        }
    } else {
        // Remove
        $contributors = array_values(array_filter($contributors, function($c) use ($userId) {
            return $c['userId'] !== $userId;
        }));
    }
    
    $stmtUpdate = $pdo->prepare("UPDATE series SET contributors = ? WHERE id = ?");
    $stmtUpdate->execute([json_encode($contributors), $params['id']]);
    
    sendResponse(["success" => true]);
}

// 20. ADJUST MANUAL RATINGS (ADMIN)
if ($method === 'POST' && matchRoute('/series/:id/adjust-ratings', $sub_path, $params)) {
    requireAdmin($pdo);
    $input = getJsonInput();
    $action = isset($input['action']) ? $input['action'] : 'increment';
    $step = isset($input['step']) ? (double)$input['step'] : 0.1;
    
    if ($action === 'increment') {
        $stmt = $pdo->prepare("UPDATE series SET rating = LEAST(5.0, rating + ?) WHERE id = ?");
    } else {
        $stmt = $pdo->prepare("UPDATE series SET rating = GREATEST(0.0, rating - ?) WHERE id = ?");
    }
    $stmt->execute([$step, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 21. GET CHAPTERS FOR SERIES
if ($method === 'GET' && matchRoute('/series/:seriesId/chapters', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM chapters WHERE seriesId = ? ORDER BY number DESC");
    $stmt->execute([$params['seriesId']]);
    $chaps = $stmt->fetchAll();
    
    foreach ($chaps as &$ch) {
        $ch['images'] = $ch['images'] ? array_filter(explode(',', $ch['images'])) : [];
        $ch['submissions'] = $ch['submissions'] ? json_decode($ch['submissions'], true) : [];
        if (!is_array($ch['submissions'])) $ch['submissions'] = [];
        $ch['isPending'] = (bool)$ch['isPending'];
        $ch['number'] = (double)$ch['number'];
        $ch['views'] = (int)$ch['views'];
        $ch['sortMode'] = isset($ch['sortMode']) ? $ch['sortMode'] : 'natural';
    }
    
    sendResponse($chaps);
}

// 22. GET SINGLE CHAPTER BY ID
if ($method === 'GET' && matchRoute('/series/:seriesId/chapters/:id', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM chapters WHERE seriesId = ? AND id = ?");
    $stmt->execute([$params['seriesId'], $params['id']]);
    $ch = $stmt->fetch();
    if (!$ch) {
        sendResponse(["error" => "چپتر یافت نشد."], 404);
    }
    
    $ch['images'] = $ch['images'] ? array_filter(explode(',', $ch['images'])) : [];
    $ch['submissions'] = $ch['submissions'] ? json_decode($ch['submissions'], true) : [];
    if (!is_array($ch['submissions'])) $ch['submissions'] = [];
    $ch['isPending'] = (bool)$ch['isPending'];
    $ch['number'] = (double)$ch['number'];
    $ch['views'] = (int)$ch['views'];
    $ch['sortMode'] = isset($ch['sortMode']) ? $ch['sortMode'] : 'natural';
    
    sendResponse($ch);
}

// 23. SAVE / UPDATE CHAPTER
if ($method === 'POST' && matchRoute('/series/:seriesId/chapters', $sub_path, $params)) {
    requireStaffOrAdmin($pdo);
    $input = getJsonInput();
    
    $id = isset($input['id']) ? $input['id'] : null;
    if (!$id) {
        sendResponse(["error" => "شناسه چپتر الزامی است."], 400);
    }
    
    $number = (double)(isset($input['number']) ? $input['number'] : 1.0);
    $title = isset($input['title']) ? $input['title'] : '';
    $images = isset($input['images']) ? implode(',', $input['images']) : '';
    $isPending = isset($input['isPending']) ? ($input['isPending'] ? 1 : 0) : 0;
    $submissions = isset($input['submissions']) ? json_encode($input['submissions']) : '[]';
    $sortMode = isset($input['sortMode']) ? $input['sortMode'] : 'natural';
    
    $stmtCheck = $pdo->prepare("SELECT id FROM chapters WHERE id = ?");
    $stmtCheck->execute([$id]);
    $exists = $stmtCheck->fetch();
    
    if ($exists) {
        $stmt = $pdo->prepare("UPDATE chapters SET number = ?, title = ?, images = ?, isPending = ?, submissions = ?, sortMode = ? WHERE id = ?");
        $stmt->execute([$number, $title, $images, $isPending, $submissions, $sortMode, $id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO chapters (id, seriesId, number, title, images, views, isPending, submissions, sortMode) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)");
        $stmt->execute([$id, $params['seriesId'], $number, $title, $images, $isPending, $submissions, $sortMode]);
    }
    
    // Fetch and return
    $stmt = $pdo->prepare("SELECT * FROM chapters WHERE id = ?");
    $stmt->execute([$id]);
    $ch = $stmt->fetch();
    
    $ch['images'] = $ch['images'] ? array_filter(explode(',', $ch['images'])) : [];
    $ch['submissions'] = $ch['submissions'] ? json_decode($ch['submissions'], true) : [];
    if (!is_array($ch['submissions'])) $ch['submissions'] = [];
    $ch['isPending'] = (bool)$ch['isPending'];
    $ch['number'] = (double)$ch['number'];
    $ch['views'] = (int)$ch['views'];
    $ch['sortMode'] = isset($ch['sortMode']) ? $ch['sortMode'] : 'natural';
    
    sendResponse($ch);
}

// 24. DELETE CHAPTER (ADMIN)
if (($method === 'DELETE' && matchRoute('/series/:seriesId/chapters/:id', $sub_path, $params)) || ($method === 'POST' && matchRoute('/series/:seriesId/chapters/:id/delete', $sub_path, $params))) {
    requireAdmin($pdo);
    
    // Begin transaction
    $pdo->beginTransaction();
    try {
        // Delete comments for this chapter
        $stmtComm = $pdo->prepare("DELETE FROM comments WHERE chapterId = ?");
        $stmtComm->execute([$params['id']]);
        
        // Delete purchased chapter records
        $stmtPur = $pdo->prepare("DELETE FROM purchased_chapters WHERE chapterId = ?");
        $stmtPur->execute([$params['id']]);
        
        // Finally, delete chapter
        $stmt = $pdo->prepare("DELETE FROM chapters WHERE seriesId = ? AND id = ?");
        $stmt->execute([$params['seriesId'], $params['id']]);
        
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        sendResponse(["error" => "خطا در حذف چپتر و کامنت‌ها: " . $e->getMessage()], 500);
    }
    
    sendResponse(["success" => true]);
}

// 25. APPROVE SUBMITTED CHAPTER (ADMIN)
if ($method === 'PUT' && matchRoute('/series/:seriesId/chapters/:id/approve', $sub_path, $params)) {
    requireAdmin($pdo);
    $stmt = $pdo->prepare("UPDATE chapters SET isPending = 0 WHERE seriesId = ? AND id = ?");
    $stmt->execute([$params['seriesId'], $params['id']]);
    sendResponse(["success" => true]);
}

// 26. INCREMENT CHAPTER VIEWS (DEDUPLICATED PER USER)
if ($method === 'POST' && matchRoute('/series/:seriesId/chapters/:id/view', $sub_path, $params)) {
    $input = getJsonInput();
    $user = getUserFromHeaders($pdo);
    $userId = isset($input['userId']) && !empty($input['userId']) ? $input['userId'] : ($user ? $user['id'] : null);
    
    if (!$userId) {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'anon';
        $userId = 'visitor_' . md5($ip);
    }
    
    $seriesId = $params['seriesId'];
    $chapterId = $params['id'];
    
    // Check if already viewed
    $stmtCheck = $pdo->prepare("SELECT id FROM chapter_views_log WHERE userId = ? AND chapterId = ?");
    $stmtCheck->execute([$userId, $chapterId]);
    $alreadyViewed = $stmtCheck->fetch();
    
    if (!$alreadyViewed) {
        // Log view
        $logId = 'cv_' . round(microtime(true) * 1000) . '_' . rand(1000, 9999);
        $stmtInsert = $pdo->prepare("INSERT IGNORE INTO chapter_views_log (id, userId, seriesId, chapterId) VALUES (?, ?, ?, ?)");
        $stmtInsert->execute([$logId, $userId, $seriesId, $chapterId]);
        
        // Increment chapter views
        $stmt = $pdo->prepare("UPDATE chapters SET views = views + 1 WHERE seriesId = ? AND id = ?");
        $stmt->execute([$seriesId, $chapterId]);
        
        // Increment series views
        $stmtS = $pdo->prepare("UPDATE series SET views = views + 1 WHERE id = ?");
        $stmtS->execute([$seriesId]);
    }
    
    $stmtSelect = $pdo->prepare("SELECT views FROM chapters WHERE id = ?");
    $stmtSelect->execute([$chapterId]);
    $res = $stmtSelect->fetch();
    sendResponse(["views" => (int)($res['views'] ?? 0)]);
}

// 27. SUBMIT CHAPTER WORK (TRANSLATION/EDIT)
if ($method === 'POST' && matchRoute('/series/:seriesId/chapters/:id/submit', $sub_path, $params)) {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $images = isset($input['images']) ? $input['images'] : [];
    
    $stmt = $pdo->prepare("SELECT submissions FROM chapters WHERE seriesId = ? AND id = ?");
    $stmt->execute([$params['seriesId'], $params['id']]);
    $ch = $stmt->fetch();
    if (!$ch) sendResponse(["error" => "چپتر یافت نشد."], 404);
    
    $submissions = $ch['submissions'] ? json_decode($ch['submissions'], true) : [];
    if (!is_array($submissions)) $submissions = [];
    
    $submissions[] = [
        "userId" => $user['id'],
        "userName" => $user['displayName'],
        "images" => $images,
        "createdAt" => date('Y-m-d H:i:s')
    ];
    
    $stmtUpdate = $pdo->prepare("UPDATE chapters SET submissions = ? WHERE id = ?");
    $stmtUpdate->execute([json_encode($submissions), $params['id']]);
    
    sendResponse(["success" => true]);
}

// 28. GET CHAPTER COMMENTS
if ($method === 'GET' && matchRoute('/chapters/:chapterId/comments', $sub_path, $params)) {
    $user = getUserFromHeaders($pdo);
    $isAdmin = $user && ($user['role'] === 'admin' || (isset($user['roles']) && in_array('super_admin', json_decode($user['roles'] ?? '[]', true))));
    
    if ($isAdmin) {
        $stmt = $pdo->prepare("SELECT * FROM comments WHERE chapterId = ? ORDER BY createdAt DESC");
        $stmt->execute([$params['chapterId']]);
    } else if ($user) {
        $stmt = $pdo->prepare("SELECT * FROM comments WHERE chapterId = ? AND (status = 'approved' OR status IS NULL OR status = '' OR userId = ?) ORDER BY createdAt DESC");
        $stmt->execute([$params['chapterId'], $user['id']]);
    } else {
        $stmt = $pdo->prepare("SELECT * FROM comments WHERE chapterId = ? AND (status = 'approved' OR status IS NULL OR status = '') ORDER BY createdAt DESC");
        $stmt->execute([$params['chapterId']]);
    }
    $comments = $stmt->fetchAll();
    
    foreach ($comments as &$c) {
        $c['likes'] = $c['likes'] ? json_decode($c['likes'], true) : [];
        if (!is_array($c['likes'])) $c['likes'] = [];
        $c['dislikes'] = $c['dislikes'] ? json_decode($c['dislikes'], true) : [];
        if (!is_array($c['dislikes'])) $c['dislikes'] = [];
        if (empty($c['status'])) $c['status'] = 'approved';
    }
    
    sendResponse($comments);
}

// 29. ADD COMMENT
if ($method === 'POST' && matchRoute('/chapters/:chapterId/comments', $sub_path, $params)) {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $content = isset($input['content']) ? trim($input['content']) : '';
    if (empty($content)) sendResponse(["error" => "محتوای کامنت نمی‌تواند خالی باشد."], 400);
    
    $parentId = isset($input['parentId']) ? $input['parentId'] : null;
    $isAdmin = ($user['role'] === 'admin' || (isset($user['roles']) && in_array('super_admin', json_decode($user['roles'] ?? '[]', true))));
    
    // Check auto approve setting
    $autoApprove = false;
    $stmtSet = $pdo->prepare("SELECT val FROM settings WHERE id = 'global'");
    $stmtSet->execute();
    $globalSet = $stmtSet->fetch();
    if ($globalSet && !empty($globalSet['val'])) {
        $gVal = json_decode($globalSet['val'], true);
        if (isset($gVal['autoApproveComments']) && $gVal['autoApproveComments']) {
            $autoApprove = true;
        }
    }
    
    $status = ($isAdmin || $autoApprove) ? 'approved' : 'pending';
    if (isset($input['status']) && in_array($input['status'], ['pending', 'approved', 'rejected'])) {
        $status = $input['status'];
    }
    
    $id = 'comment-' . round(microtime(true) * 1000);
    $stmt = $pdo->prepare("INSERT INTO comments (id, chapterId, userId, userName, userAvatar, content, parentId, status, likes, dislikes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]')");
    $stmt->execute([
        $id,
        $params['chapterId'],
        $user['id'],
        $user['displayName'],
        $user['avatarUrl'],
        $content,
        $parentId,
        $status
    ]);
    
    // Fetch and return
    $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ?");
    $stmt->execute([$id]);
    $c = $stmt->fetch();
    $c['likes'] = [];
    $c['dislikes'] = [];
    $c['status'] = $status;
    
    sendResponse($c);
}

// UPDATE COMMENT STATUS
if ($method === 'PUT' && matchRoute('/comments/:id/status', $sub_path, $params)) {
    requireAdmin($pdo);
    $input = getJsonInput();
    $status = isset($input['status']) ? $input['status'] : 'approved';
    if (!in_array($status, ['pending', 'approved', 'rejected'])) {
        sendResponse(["error" => "وضعیت نامعتبر."], 400);
    }
    
    $stmt = $pdo->prepare("UPDATE comments SET status = ? WHERE id = ?");
    $stmt->execute([$status, $params['id']]);
    
    sendResponse(["success" => true, "status" => $status]);
}

// BATCH UPDATE COMMENT STATUS (ADMIN)
if ($method === 'POST' && $sub_path === '/admin/comments/batch-status') {
    requireAdmin($pdo);
    $input = getJsonInput();
    $ids = isset($input['ids']) && is_array($input['ids']) ? $input['ids'] : [];
    $status = isset($input['status']) ? $input['status'] : 'approved';
    
    if (!empty($ids)) {
        $in  = str_repeat('?,', count($ids) - 1) . '?';
        $stmt = $pdo->prepare("UPDATE comments SET status = ? WHERE id IN ($in)");
        $stmt->execute(array_merge([$status], $ids));
    }
    
    sendResponse(["success" => true]);
}

// BATCH DELETE COMMENTS (ADMIN)
if ($method === 'POST' && $sub_path === '/admin/comments/batch-delete') {
    requireAdmin($pdo);
    $input = getJsonInput();
    $ids = isset($input['ids']) && is_array($input['ids']) ? $input['ids'] : [];
    
    if (!empty($ids)) {
        $in  = str_repeat('?,', count($ids) - 1) . '?';
        $stmt = $pdo->prepare("DELETE FROM comments WHERE id IN ($in)");
        $stmt->execute($ids);
    }
    
    sendResponse(["success" => true]);
}

// 30. REACT TO COMMENT (LIKE/DISLIKE)
if ($method === 'POST' && matchRoute('/comments/:id/react', $sub_path, $params)) {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $type = isset($input['type']) ? $input['type'] : 'like'; // 'like' or 'dislike'
    
    $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ?");
    $stmt->execute([$params['id']]);
    $c = $stmt->fetch();
    if (!$c) sendResponse(["error" => "کامنت یافت نشد."], 404);
    
    $likes = $c['likes'] ? json_decode($c['likes'], true) : [];
    if (!is_array($likes)) $likes = [];
    $dislikes = $c['dislikes'] ? json_decode($c['dislikes'], true) : [];
    if (!is_array($dislikes)) $dislikes = [];
    
    $userId = $user['id'];
    
    if ($type === 'like') {
        if (in_array($userId, $likes)) {
            $likes = array_values(array_diff($likes, [$userId]));
        } else {
            $likes[] = $userId;
            $dislikes = array_values(array_diff($dislikes, [$userId]));
        }
    } else {
        if (in_array($userId, $dislikes)) {
            $dislikes = array_values(array_diff($dislikes, [$userId]));
        } else {
            $dislikes[] = $userId;
            $likes = array_values(array_diff($likes, [$userId]));
        }
    }
    
    $stmtUpdate = $pdo->prepare("UPDATE comments SET likes = ?, dislikes = ? WHERE id = ?");
    $stmtUpdate->execute([json_encode($likes), json_encode($dislikes), $params['id']]);
    
    $c['likes'] = $likes;
    $c['dislikes'] = $dislikes;
    sendResponse($c);
}

// 31. DELETE COMMENT
if (($method === 'DELETE' && matchRoute('/comments/:id', $sub_path, $params)) || ($method === 'POST' && matchRoute('/comments/:id/delete', $sub_path, $params))) {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    // Fetch comment
    $stmt = $pdo->prepare("SELECT userId FROM comments WHERE id = ?");
    $stmt->execute([$params['id']]);
    $c = $stmt->fetch();
    if (!$c) sendResponse(["error" => "کامنت یافت نشد."], 404);
    
    // Check ownership or admin
    if ($c['userId'] !== $user['id'] && $user['role'] !== 'admin') {
        sendResponse(["error" => "دسترسی غیرمجاز برای حذف کامنت."], 403);
    }
    
    $stmtDel = $pdo->prepare("DELETE FROM comments WHERE id = ?");
    $stmtDel->execute([$params['id']]);
    sendResponse(["success" => true]);
}

// 32. UPDATE COMMENT
if ($method === 'PUT' && matchRoute('/comments/:id', $sub_path, $params)) {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $content = isset($input['content']) ? trim($input['content']) : '';
    if (empty($content)) sendResponse(["error" => "محتوای کامنت نمی‌تواند خالی باشد."], 400);
    
    $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ?");
    $stmt->execute([$params['id']]);
    $c = $stmt->fetch();
    if (!$c) sendResponse(["error" => "کامنت یافت نشد."], 404);
    
    if ($c['userId'] !== $user['id']) {
        sendResponse(["error" => "شما مجاز به ویرایش این کامنت نیستید."], 403);
    }
    
    $stmtUp = $pdo->prepare("UPDATE comments SET content = ? WHERE id = ?");
    $stmtUp->execute([$content, $params['id']]);
    
    $c['content'] = $content;
    $c['likes'] = $c['likes'] ? json_decode($c['likes'], true) : [];
    $c['dislikes'] = $c['dislikes'] ? json_decode($c['dislikes'], true) : [];
    sendResponse($c);
}

// 33. GET BOOKMARKS
if ($method === 'GET' && matchRoute('/users/:userId/bookmarks', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM bookmarks WHERE userId = ? ORDER BY createdAt DESC");
    $stmt->execute([$params['userId']]);
    sendResponse($stmt->fetchAll());
}

// 34. TOGGLE BOOKMARK
if ($method === 'POST' && matchRoute('/users/:userId/bookmarks/:seriesId', $sub_path, $params)) {
    $userId = $params['userId'];
    $seriesId = $params['seriesId'];
    
    // Check if bookmarked
    $stmt = $pdo->prepare("SELECT userId FROM bookmarks WHERE userId = ? AND seriesId = ?");
    $stmt->execute([$userId, $seriesId]);
    $exists = $stmt->fetch();
    
    if ($exists) {
        $stmtDel = $pdo->prepare("DELETE FROM bookmarks WHERE userId = ? AND seriesId = ?");
        $stmtDel->execute([$userId, $seriesId]);
        sendResponse(["bookmarked" => false]);
    } else {
        $stmtIns = $pdo->prepare("INSERT INTO bookmarks (userId, seriesId) VALUES (?, ?)");
        $stmtIns->execute([$userId, $seriesId]);
        sendResponse(["bookmarked" => true]);
    }
}

// 35. GET READING HISTORY
if ($method === 'GET' && matchRoute('/users/:userId/history', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM history WHERE userId = ? ORDER BY updatedAt DESC");
    $stmt->execute([$params['userId']]);
    $history = $stmt->fetchAll();
    foreach ($history as &$h) {
        $h['chapterNumber'] = (double)$h['chapterNumber'];
    }
    sendResponse($history);
}

// 36. SAVE HISTORY ITEM
if ($method === 'POST' && matchRoute('/users/:userId/history', $sub_path, $params)) {
    $input = getJsonInput();
    $seriesId = isset($input['seriesId']) ? $input['seriesId'] : null;
    $chapterId = isset($input['chapterId']) ? $input['chapterId'] : null;
    $chapterNumber = (double)(isset($input['chapterNumber']) ? $input['chapterNumber'] : 1.0);
    
    if (!$seriesId || !$chapterId) {
        sendResponse(["error" => "فیلدهای تاریخچه نامعتبر است."], 400);
    }
    
    $userId = $params['userId'];
    
    $stmt = $pdo->prepare("INSERT INTO history (userId, seriesId, chapterId, chapterNumber, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE chapterId=VALUES(chapterId), chapterNumber=VALUES(chapterNumber), updatedAt=CURRENT_TIMESTAMP");
    $stmt->execute([$userId, $seriesId, $chapterId, $chapterNumber]);
    
    sendResponse(["success" => true]);
}

// 37. GET RATINGS FOR SERIES
if ($method === 'GET' && matchRoute('/series/:seriesId/ratings', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM ratings WHERE seriesId = ?");
    $stmt->execute([$params['seriesId']]);
    sendResponse($stmt->fetchAll());
}

// 38. SAVE RATING
if ($method === 'POST' && matchRoute('/series/:seriesId/ratings', $sub_path, $params)) {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $score = (double)(isset($input['score']) ? $input['score'] : 5.0);
    $seriesId = $params['seriesId'];
    $userId = $user['id'];
    
    $stmt = $pdo->prepare("INSERT INTO ratings (userId, seriesId, score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score = VALUES(score)");
    $stmt->execute([$userId, $seriesId, $score]);
    
    // Recalculate average rating for series
    $stmtAvg = $pdo->prepare("SELECT AVG(score) as avgRating FROM ratings WHERE seriesId = ?");
    $stmtAvg->execute([$seriesId]);
    $avg = $stmtAvg->fetch();
    $newAvg = $avg['avgRating'] ?: 0.0;
    
    $stmtUpdate = $pdo->prepare("UPDATE series SET rating = ? WHERE id = ?");
    $stmtUpdate->execute([$newAvg, $seriesId]);
    
    sendResponse(["success" => true]);
}

// 39. GET SETTINGS
if ($method === 'GET' && matchRoute('/settings/:id', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT val FROM settings WHERE id = ?");
    $stmt->execute([$params['id']]);
    $res = $stmt->fetch();
    if ($res) {
        sendResponse(json_decode($res['val'], true));
    } else {
        // Fallback defaults
        if ($params['id'] === 'global') {
            sendResponse([
                "siteName" => "AsuraClone",
                "discordUrl" => "https://discord.gg",
                "telegramUrl" => "https://t.me",
                "featuredType" => "Manhwa",
                "activeAnnouncement" => "به آسورا کلون خوش آمدید! اولین و بزرگترین مرجع مانهوا و مانگا."
            ]);
        } else if ($params['id'] === 'taxonomy') {
            sendResponse([
                "genres" => ["Action", "Fantasy", "Adventure", "Comedy", "Drama", "Martial Arts", "Rebirth", "System", "Magic", "School Life"],
                "types" => ["Manhwa", "Manhua", "Manga"],
                "statuses" => ["Ongoing", "Completed", "Hiatus"]
            ]);
        } else {
            sendResponse([]);
        }
    }
}

// 40. SAVE SETTINGS
if ($method === 'POST' && matchRoute('/settings/:id', $sub_path, $params)) {
    requireAdmin($pdo);
    $input = getJsonInput();
    
    $stmt = $pdo->prepare("INSERT INTO settings (id, val) VALUES (?, ?) ON DUPLICATE KEY UPDATE val=VALUES(val)");
    $stmt->execute([$params['id'], json_encode($input)]);
    
    sendResponse(["success" => true]);
}

// 40b. GET BACKUP SETTINGS
if ($method === 'GET' && $sub_path === '/admin/backup-settings') {
    requireAdmin($pdo);
    $stmt = $pdo->prepare("SELECT val FROM settings WHERE id = 'backup_settings'");
    $stmt->execute();
    $row = $stmt->fetch();
    $data = $row && isset($row['val']) ? json_decode($row['val'], true) : [
        "email" => "",
        "autoBackupEnabled" => false,
        "scheduleFrequency" => "daily"
    ];
    sendResponse($data);
}

// 40c. SAVE BACKUP SETTINGS
if ($method === 'POST' && $sub_path === '/admin/backup-settings') {
    requireAdmin($pdo);
    $input = getJsonInput();
    
    $stmt = $pdo->prepare("SELECT val FROM settings WHERE id = 'backup_settings'");
    $stmt->execute();
    $row = $stmt->fetch();
    $existing = $row && isset($row['val']) ? json_decode($row['val'], true) : [];
    
    $updated = array_merge($existing, $input);
    $stmtUp = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('backup_settings', ?) ON DUPLICATE KEY UPDATE val=VALUES(val)");
    $stmtUp->execute([json_encode($updated)]);
    
    sendResponse(["success" => true, "settings" => $updated]);
}

// Helper function for safe backup data extraction
if (!function_exists('getSafeTableBackupData')) {
    function getSafeTableBackupData($pdo) {
        $safeFetchTable = function($tableName) use ($pdo) {
            try {
                $stmt = $pdo->query("SELECT * FROM `{$tableName}`");
                return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            } catch (Exception $e) {
                return [];
            }
        };

        $purchasedChapters = $safeFetchTable("purchased_chapters");
        if (empty($purchasedChapters)) {
            $purchasedChapters = $safeFetchTable("purchases");
        }

        return [
            "series" => $safeFetchTable("series"),
            "chapters" => $safeFetchTable("chapters"),
            "users" => $safeFetchTable("users"),
            "comments" => $safeFetchTable("comments"),
            "bookmarks" => $safeFetchTable("bookmarks"),
            "history" => $safeFetchTable("history"),
            "ratings" => $safeFetchTable("ratings"),
            "purchased_chapters" => $purchasedChapters,
            "purchases" => $purchasedChapters,
            "wallet_transactions" => $safeFetchTable("wallet_transactions"),
            "settlement_requests" => $safeFetchTable("settlement_requests"),
            "reports" => $safeFetchTable("reports"),
            "settings" => $safeFetchTable("settings"),
            "notifications" => $safeFetchTable("notifications"),
            "tickets" => $safeFetchTable("tickets"),
            "ticket_messages" => $safeFetchTable("ticket_messages")
        ];
    }
}

// 40d. RUN BACKUP NOW (PHP)
if ($method === 'POST' && $sub_path === '/admin/run-backup-now') {
    requireAdmin($pdo);
    $input = getJsonInput();
    
    // Save email if sent
    if (!empty($input['email'])) {
        $stmt = $pdo->prepare("SELECT val FROM settings WHERE id = 'backup_settings'");
        $stmt->execute();
        $row = $stmt->fetch();
        $existing = $row && isset($row['val']) ? json_decode($row['val'], true) : [];
        $existing['email'] = $input['email'];
        $stmtUp = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('backup_settings', ?) ON DUPLICATE KEY UPDATE val=VALUES(val)");
        $stmtUp->execute([json_encode($existing)]);
    }

    // Build backup json data safely
    $backupData = getSafeTableBackupData($pdo);
    
    $jsonStr = json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $dateStr = date('Y-m-d-H-i-s');
    $fileName = "asura-backup-{$dateStr}.json";
    
    $backupsDir = __DIR__ . '/../../backups';
    if (!file_exists($backupsDir)) {
        @mkdir($backupsDir, 0755, true);
    }
    
    $filePath = $backupsDir . '/' . $fileName;
    @file_put_contents($filePath, $jsonStr);
    
    // Check if email send requested
    $stmtB = $pdo->prepare("SELECT val FROM settings WHERE id = 'backup_settings'");
    $stmtB->execute();
    $rowB = $stmtB->fetch();
    $bSettings = $rowB && isset($rowB['val']) ? json_decode($rowB['val'], true) : [];
    
    $email = isset($bSettings['email']) ? trim($bSettings['email']) : '';
    $emailed = false;
    
    if (!empty($email)) {
        $subject = "📦 نسخه پشتیبان خودکار دیتابیس - " . date('Y-m-d');
        $headers = "From: no-reply@" . $_SERVER['HTTP_HOST'] . "\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        
        $boundary = md5(time());
        $headers .= "Content-Type: multipart/mixed; boundary=\"" . $boundary . "\"\r\n";
        
        $body = "--" . $boundary . "\r\n";
        $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= chunk_split(base64_encode("سلام مدیریت محترم،\n\nفایل نسخه پشتیبان با موفقیت در هاست ذخیره گردید و پیوست شد.\nنام فایل: {$fileName}\nمسیر: /backups/{$fileName}")) . "\r\n";
        
        $body .= "--" . $boundary . "\r\n";
        $body .= "Content-Type: application/json; name=\"" . $fileName . "\"\r\n";
        $body .= "Content-Disposition: attachment; filename=\"" . $fileName . "\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
        $body .= chunk_split(base64_encode($jsonStr)) . "\r\n";
        $body .= "--" . $boundary . "--";
        
        $emailed = @mail($email, $subject, $body, $headers);
    }
    
    // Update last execution time
    $bSettings['lastBackupTime'] = date('c');
    $bSettings['lastBackupStatus'] = $emailed ? "موفق و ایمیل شد" : "ذخیره شد در هاست";
    $bSettings['lastBackupFile'] = $fileName;
    
    $stmtUp2 = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('backup_settings', ?) ON DUPLICATE KEY UPDATE val=VALUES(val)");
    $stmtUp2->execute([json_encode($bSettings)]);
    
    sendResponse([
        "success" => true,
        "fileName" => $fileName,
        "emailed" => $emailed
    ]);
}

// 40e. DOWNLOAD BACKUP (PHP)
if ($method === 'GET' && $sub_path === '/admin/backup') {
    requireAdmin($pdo);
    $backupData = getSafeTableBackupData($pdo);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename=asura-clone-backup.json');
    echo json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 40f. RESTORE BACKUP (PHP)
if ($method === 'POST' && $sub_path === '/admin/restore') {
    requireAdmin($pdo);
    $input = getJsonInput();
    if (!$input || !is_array($input)) {
        sendResponse(["error" => "فرمت فایل نسخه پشتیبان نامعتبر است."], 400);
    }
    try {
        if (!empty($input['series']) && is_array($input['series'])) {
            $pdo->exec("TRUNCATE TABLE series");
            $stmt = $pdo->prepare("INSERT INTO series (id, title, english_title, slug, cover, banner, summary, status, type, release_year, author, artist, translation_team, is_vip, is_recommended, is_editor_pick, rating, rating_count, views, bookmarks_count, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($input['series'] as $s) {
                $stmt->execute([
                    $s['id'], $s['title'], $s['english_title'] ?? null, $s['slug'] ?? null, $s['cover'] ?? null, $s['banner'] ?? null, $s['summary'] ?? null, $s['status'] ?? 'ongoing', $s['type'] ?? 'manhwa', $s['release_year'] ?? null, $s['author'] ?? null, $s['artist'] ?? null, $s['translation_team'] ?? null, $s['is_vip'] ?? 0, $s['is_recommended'] ?? 0, $s['is_editor_pick'] ?? 0, $s['rating'] ?? 0, $s['rating_count'] ?? 0, $s['views'] ?? 0, $s['bookmarks_count'] ?? 0, $s['updated_at'] ?? date('Y-m-d H:i:s'), $s['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        }
        if (!empty($input['chapters']) && is_array($input['chapters'])) {
            $pdo->exec("TRUNCATE TABLE chapters");
            $stmt = $pdo->prepare("INSERT INTO chapters (id, series_id, number, title, images, release_date, is_vip, coin_price, is_free, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($input['chapters'] as $c) {
                $imgs = is_array($c['images']) ? json_encode($c['images']) : ($c['images'] ?? '[]');
                $stmt->execute([
                    $c['id'], $c['series_id'], $c['number'], $c['title'] ?? null, $imgs, $c['release_date'] ?? date('Y-m-d H:i:s'), $c['is_vip'] ?? 0, $c['coin_price'] ?? 0, $c['is_free'] ?? 1, $c['created_at'] ?? date('Y-m-d H:i:s')
                ]);
            }
        }
        sendResponse(["success" => true, "message" => "اطلاعات با موفقیت بازگردانی شد."]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// 40g. MIGRATION MANIFEST (PHP)
if ($method === 'GET' && $sub_path === '/admin/migration-manifest') {
    requireAdmin($pdo);
    $seriesList = $pdo->query("SELECT * FROM series")->fetchAll(PDO::FETCH_ASSOC);
    $manifest = [
        "generatedAt" => date('c'),
        "databaseType" => "MySQL (PHP)",
        "summary" => [
            "totalSeries" => count($seriesList),
            "totalChapters" => (int)$pdo->query("SELECT COUNT(*) FROM chapters")->fetchColumn()
        ],
        "series" => $seriesList
    ];
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename=asura-migration-manifest.json');
    echo json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// 40h. GET USER TICKETS
if ($method === 'GET' && $sub_path === '/tickets') {
    $uid = $_SERVER['HTTP_X_USER_UID'] ?? $_SERVER['HTTP_X_ADMIN_UID'] ?? $_GET['uid'] ?? $_GET['adminUid'] ?? null;
    if (!$uid) sendResponse(["error" => "شناسه کاربر مشخص نیست."], 401);
    $stmt = $pdo->prepare("SELECT * FROM tickets WHERE userId = ? ORDER BY lastUpdated DESC");
    $stmt->execute([$uid]);
    $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($tickets as &$t) {
        $mStmt = $pdo->prepare("SELECT * FROM ticket_messages WHERE ticketId = ? ORDER BY createdAt ASC");
        $mStmt->execute([$t['id']]);
        $msgs = $mStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($msgs as &$m) {
            $m['attachments'] = !empty($m['attachments']) ? json_decode($m['attachments'], true) : [];
        }
        $t['messages'] = $msgs;
    }
    sendResponse($tickets);
}

// 40i. CREATE TICKET
if ($method === 'POST' && $sub_path === '/tickets') {
    $uid = $_SERVER['HTTP_X_USER_UID'] ?? $_SERVER['HTTP_X_ADMIN_UID'] ?? $_GET['uid'] ?? null;
    $input = getJsonInput();
    if (!$uid && !empty($input['userId'])) $uid = $input['userId'];
    if (!$uid) sendResponse(["error" => "کاربر شناسه معتبر ندارد."], 401);
    if (empty($input['subject']) || empty($input['content'])) {
        sendResponse(["error" => "موضوع و متن تیکت الزامی است."], 400);
    }
    $uStmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $uStmt->execute([$uid]);
    $user = $uStmt->fetch(PDO::FETCH_ASSOC);

    $ticketId = 'TCK-' . strtoupper(dechex(time())) . rand(100, 999);
    $msgId = 'MSG-' . strtoupper(dechex(time())) . rand(100, 999);
    $now = date('Y-m-d H:i:s');
    $category = $input['category'] ?? 'other';
    $priority = $input['priority'] ?? 'medium';

    $stmt = $pdo->prepare("INSERT INTO tickets (id, userId, userName, userEmail, userAvatar, subject, category, priority, status, createdAt, lastUpdated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)");
    $stmt->execute([
        $ticketId,
        $uid,
        $user['displayName'] ?? $input['userName'] ?? 'کاربر',
        $user['email'] ?? $input['userEmail'] ?? '',
        $user['avatarUrl'] ?? $input['userAvatar'] ?? '',
        $input['subject'],
        $category,
        $priority,
        $now,
        $now
    ]);

    $mStmt = $pdo->prepare("INSERT INTO ticket_messages (id, ticketId, senderId, senderName, senderAvatar, senderRole, content, attachments, createdAt) VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?)");
    $mStmt->execute([
        $msgId,
        $ticketId,
        $uid,
        $user['displayName'] ?? $input['userName'] ?? 'کاربر',
        $user['avatarUrl'] ?? $input['userAvatar'] ?? '',
        $input['content'],
        json_encode($input['attachments'] ?? []),
        $now
    ]);

    sendResponse([
        "id" => $ticketId,
        "userId" => $uid,
        "subject" => $input['subject'],
        "status" => "open"
    ]);
}

// 40j. GET SINGLE TICKET
if ($method === 'GET' && preg_match('/^\/tickets\/([^\/]+)$/', $sub_path, $matches)) {
    $tId = $matches[1];
    $stmt = $pdo->prepare("SELECT * FROM tickets WHERE id = ?");
    $stmt->execute([$tId]);
    $ticket = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$ticket) sendResponse(["error" => "تیکت یافت نشد."], 404);

    $mStmt = $pdo->prepare("SELECT * FROM ticket_messages WHERE ticketId = ? ORDER BY createdAt ASC");
    $mStmt->execute([$tId]);
    $msgs = $mStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($msgs as &$m) {
        $m['attachments'] = !empty($m['attachments']) ? json_decode($m['attachments'], true) : [];
    }
    $ticket['messages'] = $msgs;
    sendResponse($ticket);
}

// 40k. REPLY TO TICKET
if ($method === 'POST' && preg_match('/^\/tickets\/([^\/]+)\/reply$/', $sub_path, $matches)) {
    $tId = $matches[1];
    $input = getJsonInput();
    $uid = $_SERVER['HTTP_X_USER_UID'] ?? $_SERVER['HTTP_X_ADMIN_UID'] ?? $input['senderId'] ?? 'admin';
    if (empty($input['content'])) sendResponse(["error" => "متن پاسخ الزامی است."], 400);

    $uStmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $uStmt->execute([$uid]);
    $user = $uStmt->fetch(PDO::FETCH_ASSOC);

    $senderRole = 'user';
    if ($user) {
        $role = $user['role'] ?? 'user';
        if ($role === 'admin' || $user['email'] === 'amirrezaveisi45@gmail.com') $senderRole = 'admin';
    } else if ($uid === 'admin') {
        $senderRole = 'admin';
    }

    $msgId = 'MSG-' . strtoupper(dechex(time())) . rand(100, 999);
    $now = date('Y-m-d H:i:s');
    $newStatus = $senderRole === 'user' ? 'open' : 'answered';

    $mStmt = $pdo->prepare("INSERT INTO ticket_messages (id, ticketId, senderId, senderName, senderAvatar, senderRole, content, attachments, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $mStmt->execute([
        $msgId,
        $tId,
        $uid,
        $user['displayName'] ?? ($senderRole !== 'user' ? "پشتیبانی" : "کاربر"),
        $user['avatarUrl'] ?? '',
        $senderRole,
        $input['content'],
        json_encode($input['attachments'] ?? []),
        $now
    ]);

    $upStmt = $pdo->prepare("UPDATE tickets SET status = ?, lastUpdated = ? WHERE id = ?");
    $upStmt->execute([$newStatus, $now, $tId]);

    sendResponse(["success" => true, "msgId" => $msgId]);
}

// 40l. CLOSE TICKET
if ($method === 'PUT' && preg_match('/^\/tickets\/([^\/]+)\/close$/', $sub_path, $matches)) {
    $tId = $matches[1];
    $now = date('Y-m-d H:i:s');
    $upStmt = $pdo->prepare("UPDATE tickets SET status = 'closed', lastUpdated = ? WHERE id = ?");
    $upStmt->execute([$now, $tId]);
    sendResponse(["success" => true]);
}

// 40m. ADMIN GET ALL TICKETS
if ($method === 'GET' && $sub_path === '/admin/tickets') {
    requireAdmin($pdo);
    $status = $_GET['status'] ?? 'all';
    $priority = $_GET['priority'] ?? 'all';
    $category = $_GET['category'] ?? 'all';
    $search = $_GET['search'] ?? '';

    $where = ["1=1"];
    $params = [];

    if ($status !== 'all') { $where[] = "status = ?"; $params[] = $status; }
    if ($priority !== 'all') { $where[] = "priority = ?"; $params[] = $priority; }
    if ($category !== 'all') { $where[] = "category = ?"; $params[] = $category; }
    if (!empty($search)) {
        $where[] = "(subject LIKE ? OR userName LIKE ? OR id LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s; $params[] = $s; $params[] = $s;
    }

    $sql = "SELECT * FROM tickets WHERE " . implode(' AND ', $where) . " ORDER BY lastUpdated DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($tickets as &$t) {
        $mStmt = $pdo->prepare("SELECT * FROM ticket_messages WHERE ticketId = ? ORDER BY createdAt ASC");
        $mStmt->execute([$t['id']]);
        $msgs = $mStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($msgs as &$m) {
            $m['attachments'] = !empty($m['attachments']) ? json_decode($m['attachments'], true) : [];
        }
        $t['messages'] = $msgs;
    }
    sendResponse($tickets);
}

// 40n. ADMIN UPDATE TICKET
if ($method === 'PUT' && preg_match('/^\/admin\/tickets\/([^\/]+)$/', $sub_path, $matches)) {
    requireAdmin($pdo);
    $tId = $matches[1];
    $input = getJsonInput();
    $now = date('Y-m-d H:i:s');

    $sets = ["lastUpdated = ?"];
    $params = [$now];

    if (!empty($input['status'])) { $sets[] = "status = ?"; $params[] = $input['status']; }
    if (!empty($input['priority'])) { $sets[] = "priority = ?"; $params[] = $input['priority']; }
    if (isset($input['assignedTo'])) { $sets[] = "assignedTo = ?"; $params[] = $input['assignedTo']; }
    if (isset($input['assignedToName'])) { $sets[] = "assignedToName = ?"; $params[] = $input['assignedToName']; }

    $params[] = $tId;
    $stmt = $pdo->prepare("UPDATE tickets SET " . implode(', ', $sets) . " WHERE id = ?");
    $stmt->execute($params);

    sendResponse(["success" => true]);
}

// 40o. ADMIN DELETE TICKET
if ($method === 'DELETE' && preg_match('/^\/admin\/tickets\/([^\/]+)$/', $sub_path, $matches)) {
    requireAdmin($pdo);
    $tId = $matches[1];
    $pdo->prepare("DELETE FROM ticket_messages WHERE ticketId = ?")->execute([$tId]);
    $pdo->prepare("DELETE FROM tickets WHERE id = ?")->execute([$tId]);
    sendResponse(["success" => true]);
}

// 41. GET ADMIN STATS (ADMIN)
if ($method === 'GET' && $sub_path === '/admin/stats') {
    requireAdmin($pdo);
    
    $q1 = $pdo->query("SELECT COUNT(*) as cnt FROM series")->fetch();
    $q2 = $pdo->query("SELECT COUNT(*) as cnt FROM chapters")->fetch();
    $q3 = $pdo->query("SELECT COUNT(*) as cnt FROM users")->fetch();
    
    // Get total views of all series
    $qViews = $pdo->query("SELECT SUM(views) as total_views FROM series")->fetch();
    $totalViews = isset($qViews['total_views']) ? (int)$qViews['total_views'] : 0;
    
    // Fetch last 7 days of views from history
    $last7Days = [];
    for ($i = 6; $i >= 0; $i--) {
        $dateStr = date('D', time() - $i * 24 * 60 * 60);
        $last7Days[$dateStr] = 0;
    }
    
    // Real history query
    $stmtHist = $pdo->query("SELECT updatedAt FROM history WHERE updatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
    $hasHistory = false;
    if ($stmtHist) {
        while ($row = $stmtHist->fetch()) {
            $hasHistory = true;
            $dateStr = date('D', strtotime($row['updatedAt']));
            if (isset($last7Days[$dateStr])) {
                $last7Days[$dateStr]++;
            }
        }
    }
    
    // If no history exists, distribute total views realistically
    if (!$hasHistory && $totalViews > 0) {
        $dist = [0.12, 0.14, 0.13, 0.15, 0.14, 0.16, 0.16];
        $idx = 0;
        foreach ($last7Days as $key => $val) {
            $last7Days[$key] = (int)floor($totalViews * $dist[$idx % 7]);
            $idx++;
        }
    }
    
    $dailyViewsArray = [];
    foreach ($last7Days as $key => $val) {
        $dailyViewsArray[] = [
            "name" => $key,
            "views" => $val
        ];
    }
    
    sendResponse([
        "totalSeries" => (int)$q1['cnt'],
        "totalChapters" => (int)$q2['cnt'],
        "totalUsers" => (int)$q3['cnt'],
        "dailyViews" => $dailyViewsArray
    ]);
}

// 42. GET ALL COMMENTS (ADMIN)
if ($method === 'GET' && $sub_path === '/admin/comments') {
    requireAdmin($pdo);
    $status = isset($_GET['status']) ? $_GET['status'] : 'all';
    
    if ($status && $status !== 'all') {
        $stmt = $pdo->prepare("SELECT * FROM comments WHERE status = ? ORDER BY createdAt DESC");
        $stmt->execute([$status]);
    } else {
        $stmt = $pdo->query("SELECT * FROM comments ORDER BY createdAt DESC");
    }
    $comments = $stmt->fetchAll();

    // Map series and chapters
    $seriesStmt = $pdo->query("SELECT id, title FROM series");
    $seriesMap = [];
    if ($seriesStmt) {
        while ($row = $seriesStmt->fetch()) {
            $seriesMap[$row['id']] = $row['title'];
        }
    }

    $chapStmt = $pdo->query("SELECT id, number, seriesId FROM chapters");
    $chapMap = [];
    if ($chapStmt) {
        while ($row = $chapStmt->fetch()) {
            $chapMap[$row['id']] = ['number' => (float)$row['number'], 'seriesId' => $row['seriesId']];
        }
    }

    foreach ($comments as &$c) {
        $c['likes'] = $c['likes'] ? json_decode($c['likes'], true) : [];
        if (!is_array($c['likes'])) $c['likes'] = [];
        $c['dislikes'] = $c['dislikes'] ? json_decode($c['dislikes'], true) : [];
        if (!is_array($c['dislikes'])) $c['dislikes'] = [];
        if (empty($c['status'])) $c['status'] = 'approved';

        $c['seriesId'] = '';
        $c['seriesTitle'] = '';
        $c['chapterNumber'] = null;

        if (!empty($c['chapterId'])) {
            if (strpos($c['chapterId'], 'series-') === 0) {
                $sId = str_replace('series-', '', $c['chapterId']);
                $c['seriesId'] = $sId;
                $c['seriesTitle'] = isset($seriesMap[$sId]) ? $seriesMap[$sId] : $sId;
            } else if (isset($chapMap[$c['chapterId']])) {
                $chInfo = $chapMap[$c['chapterId']];
                $c['chapterNumber'] = $chInfo['number'];
                $c['seriesId'] = $chInfo['seriesId'];
                $c['seriesTitle'] = isset($seriesMap[$chInfo['seriesId']]) ? $seriesMap[$chInfo['seriesId']] : $chInfo['seriesId'];
            }
        }
    }
    sendResponse($comments);
}

// 43. GET REPORTS (ADMIN)
if ($method === 'GET' && $sub_path === '/admin/reports') {
    requireAdmin($pdo);
    $stmt = $pdo->query("SELECT * FROM reports ORDER BY createdAt DESC");
    sendResponse($stmt->fetchAll());
}

// 44. SUBMIT REPORT
if ($method === 'POST' && $sub_path === '/reports') {
    $user = getUserFromHeaders($pdo);
    $input = getJsonInput();
    
    $userId = $user ? $user['id'] : (isset($input['userId']) && !empty($input['userId']) ? $input['userId'] : 'guest');
    $userName = $user ? $user['displayName'] : (isset($input['userName']) && !empty($input['userName']) ? $input['userName'] : 'کاربر میهمان');
    
    $title = isset($input['title']) ? trim($input['title']) : '';
    $content = isset($input['content']) ? trim($input['content']) : '';
    
    if (empty($title) || empty($content)) {
        sendResponse(["error" => "پر کردن عنوان و متن گزارش الزامی است."], 400);
    }
    
    $id = isset($input['id']) && !empty($input['id']) ? $input['id'] : ('report-' . round(microtime(true) * 1000));
    $stmt = $pdo->prepare("INSERT INTO reports (id, userId, userName, title, content, status) VALUES (?, ?, ?, ?, ?, 'pending')");
    $stmt->execute([$id, $userId, $userName, $title, $content]);
    
    sendResponse(["success" => true]);
}

// 45. UPDATE REPORT STATUS (ADMIN)
if ($method === 'PUT' && matchRoute('/reports/:id', $sub_path, $params)) {
    requireAdmin($pdo);
    $input = getJsonInput();
    $status = isset($input['status']) ? $input['status'] : 'resolved';
    
    $stmt = $pdo->prepare("UPDATE reports SET status = ? WHERE id = ?");
    $stmt->execute([$status, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 46. DELETE REPORT (ADMIN)
if (($method === 'DELETE' && matchRoute('/reports/:id', $sub_path, $params)) || ($method === 'POST' && matchRoute('/reports/:id/delete', $sub_path, $params))) {
    requireAdmin($pdo);
    $stmt = $pdo->prepare("DELETE FROM reports WHERE id = ?");
    $stmt->execute([$params['id']]);
    sendResponse(["success" => true]);
}

// 47. GET NOTIFICATIONS
if ($method === 'GET' && matchRoute('/users/:userId/notifications', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC");
    $stmt->execute([$params['userId']]);
    $notifs = $stmt->fetchAll();
    foreach ($notifs as &$n) {
        $n['read'] = (bool)$n['isRead'];
        unset($n['isRead']);
    }
    sendResponse($notifs);
}

// 48. MARK NOTIFICATION AS READ
if ($method === 'POST' && matchRoute('/notifications/:id/read', $sub_path, $params)) {
    $stmt = $pdo->prepare("UPDATE notifications SET isRead = 1 WHERE id = ?");
    $stmt->execute([$params['id']]);
    sendResponse(["success" => true]);
}

// 49. MARK ALL NOTIFICATIONS AS READ
if ($method === 'POST' && matchRoute('/users/:userId/notifications/read-all', $sub_path, $params)) {
    $stmt = $pdo->prepare("UPDATE notifications SET isRead = 1 WHERE userId = ?");
    $stmt->execute([$params['userId']]);
    sendResponse(["success" => true]);
}

// 50. GET WALLET TRANSACTIONS
if ($method === 'GET' && $sub_path === '/wallet/transactions') {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    if ($user['role'] === 'admin') {
        $stmt = $pdo->query("SELECT * FROM wallet_transactions ORDER BY createdAt DESC");
        sendResponse($stmt->fetchAll());
    } else {
        $stmt = $pdo->prepare("SELECT * FROM wallet_transactions WHERE userId = ? ORDER BY createdAt DESC");
        $stmt->execute([$user['id']]);
        sendResponse($stmt->fetchAll());
    }
}

// 51. CHARGE WALLET / DEPOSIT
if ($method === 'POST' && $sub_path === '/wallet/charge') {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $targetUserId = isset($input['userId']) ? $input['userId'] : $user['id'];
    $amount = (int)(isset($input['amount']) ? $input['amount'] : 0);
    $type = isset($input['type']) ? $input['type'] : 'admin_adjustment';
    $description = isset($input['description']) ? $input['description'] : 'شارژ حساب کاربری';
    
    if ($targetUserId !== $user['id']) {
        if ($user['role'] !== 'admin' && !isSuperAdminUser($user)) {
            sendResponse(["error" => "شما مجاز به تغییر موجودی دیگران نیستید."], 403);
        }
    }
    
    if ($amount === 0) {
        sendResponse(["error" => "مبلغ تراکنش نمی‌تواند صفر باشد."], 400);
    }
    
    // Begin Transaction
    $pdo->beginTransaction();
    try {
        $stmtTarget = $pdo->prepare("SELECT displayName, walletBalance FROM users WHERE id = ? FOR UPDATE");
        $stmtTarget->execute([$targetUserId]);
        $targetData = $stmtTarget->fetch();
        if (!$targetData) {
            $pdo->rollBack();
            sendResponse(["error" => "کاربر مقصد یافت نشد."], 404);
        }
        
        $newBalance = ($targetData['walletBalance'] ?: 0) + $amount;
        
        $stmtUpdate = $pdo->prepare("UPDATE users SET walletBalance = ? WHERE id = ?");
        $stmtUpdate->execute([$newBalance, $targetUserId]);
        
        $tid = 'tx-' . round(microtime(true) * 1000);
        $stmtTx = $pdo->prepare("INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmtTx->execute([
            $tid,
            $targetUserId,
            $targetData['displayName'],
            $amount,
            $type,
            $description,
            $user['id'],
            $user['displayName']
        ]);
        
        $pdo->commit();
        sendResponse(["success" => true, "balance" => $newBalance]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendResponse(["error" => "عملیات ناموفق بود: " . $e->getMessage()], 500);
    }
}

// 52. CHECK IF CHAPTER PURCHASED
if ($method === 'GET' && matchRoute('/users/:userId/purchases/:seriesId/:chapterId', $sub_path, $params)) {
    $stmt = $pdo->prepare("SELECT id FROM purchased_chapters WHERE userId = ? AND seriesId = ? AND chapterId = ?");
    $stmt->execute([$params['userId'], $params['seriesId'], $params['chapterId']]);
    $res = $stmt->fetch();
    sendResponse(["purchased" => (bool)$res]);
}

// 53. PURCHASE CHAPTER
if ($method === 'POST' && $sub_path === '/chapters/purchase') {
    $user = getUserFromHeaders($pdo);
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $seriesId = isset($input['seriesId']) ? $input['seriesId'] : null;
    $chapterId = isset($input['chapterId']) ? $input['chapterId'] : null;
    $price = (int)(isset($input['price']) ? $input['price'] : 400);
    
    if (!$seriesId || !$chapterId) {
        sendResponse(["error" => "چپتر نامعتبر است."], 400);
    }
    
    // Check if already purchased
    $stmtCheck = $pdo->prepare("SELECT id FROM purchased_chapters WHERE userId = ? AND seriesId = ? AND chapterId = ?");
    $stmtCheck->execute([$user['id'], $seriesId, $chapterId]);
    if ($stmtCheck->fetch()) {
        sendResponse(["success" => true, "balance" => $user['walletBalance']]);
    }
    
    // Begin transaction
    $pdo->beginTransaction();
    try {
        $stmtUser = $pdo->prepare("SELECT displayName, walletBalance FROM users WHERE id = ? FOR UPDATE");
        $stmtUser->execute([$user['id']]);
        $uData = $stmtUser->fetch();
        
        $balance = $uData['walletBalance'] ?: 0;
        if ($balance < $price) {
            $pdo->rollBack();
            sendResponse(["error" => "اعتبار کافی در کیف پول وجود ندارد. لطفا ابتدا حساب خود را شارژ کنید."], 400);
        }
        
        $newBalance = $balance - $price;
        $stmtUpdate = $pdo->prepare("UPDATE users SET walletBalance = ? WHERE id = ?");
        $stmtUpdate->execute([$newBalance, $user['id']]);
        
        // Record transaction
        $tid = 'tx-' . round(microtime(true) * 1000);
        $stmtTx = $pdo->prepare("INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName) VALUES (?, ?, ?, ?, 'purchase', 'خرید چپتر', ?, ?)");
        $stmtTx->execute([
            $tid,
            $user['id'],
            $uData['displayName'],
            -$price,
            $user['id'],
            $uData['displayName']
        ]);
        
        // Record purchase
        $pid = 'purchase-' . round(microtime(true) * 1000);
        $stmtPur = $pdo->prepare("INSERT INTO purchased_chapters (id, userId, seriesId, chapterId) VALUES (?, ?, ?, ?)");
        $stmtPur->execute([$pid, $user['id'], $seriesId, $chapterId]);
        
        $pdo->commit();
        sendResponse(["success" => true, "balance" => $newBalance]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendResponse(["error" => "خطا در انجام تراکنش: " . $e->getMessage()], 500);
    }
}

// 54. ADMIN FILE UPLOAD (SUPPORT DIRECT IMAGES & ZIP ARCHIVES)
if ($method === 'POST' && $sub_path === '/admin/upload') {
    requireStaffOrAdmin($pdo);
    
    if (empty($_FILES['files'])) {
        sendResponse(["error" => "هیچ فایلی برای آپلود یافت نشد."], 400);
    }
    
    // Target directory
    $uploadsDir = __DIR__ . '/../uploads/';
    if (!file_exists($uploadsDir)) {
        mkdir($uploadsDir, 0755, true);
    }
    
    $urls = [];
    $files = $_FILES['files'];
    
    // Normalize single vs multiple files
    $normalized_files = [];
    if (is_array($files['name'])) {
        for ($i = 0; $i < count($files['name']); $i++) {
            $normalized_files[] = [
                'name'     => $files['name'][$i],
                'type'     => $files['type'][$i],
                'tmp_name' => $files['tmp_name'][$i],
                'error'    => $files['error'][$i],
                'size'     => $files['size'][$i],
            ];
        }
    } else {
        $normalized_files[] = $files;
    }
    
    $allowedExts = ['webp', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'zip', 'rar', '7z', 'docx', 'doc', 'pdf', 'txt', 'rtf'];

    foreach ($normalized_files as $file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            continue;
        }
        
        $orig_name = strtolower($file['name']);
        $ext = strtolower(pathinfo($orig_name, PATHINFO_EXTENSION));

        if (!in_array($ext, $allowedExts)) {
            sendResponse(["error" => "پسوند فایل '" . htmlspecialchars($file['name']) . "' مجاز نیست."], 400);
        }

        $isZip = (str_ends_with($orig_name, '.zip') || $file['type'] === 'application/zip' || $file['type'] === 'application/x-zip-compressed');
        
        if ($isZip && class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($file['tmp_name']) === true) {
                // Find all entries in zip
                $filenames = [];
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $entryName = $zip->getNameIndex($i);
                    // Match images only and ignore __MACOSX and directories
                    if (!str_contains($entryName, '__MACOSX') && preg_match('/\.(jpe?g|png|webp|gif|bmp)$/i', $entryName)) {
                        $filenames[] = $entryName;
                    }
                }
                
                // Natural sort alphabetically/numerically
                natsort($filenames);
                
                foreach ($filenames as $entryName) {
                    $content = $zip->getFromName($entryName);
                    if ($content !== false) {
                        $uniqueName = 'page-' . round(microtime(true) * 1000) . '-' . rand(100000, 999999);
                        
                        // Try converting to WebP using standard GD functions
                        $img = @imagecreatefromstring($content);
                        if ($img !== false && function_exists('imagewebp')) {
                            $targetPath = $uploadsDir . $uniqueName . '.webp';
                            imagewebp($img, $targetPath, 75);
                            imagedestroy($img);
                            $urls[] = '/uploads/' . $uniqueName . '.webp';
                        } else {
                            // save as original extension
                            $ext = pathinfo($entryName, PATHINFO_EXTENSION);
                            $targetPath = $uploadsDir . $uniqueName . '.' . $ext;
                            file_put_contents($targetPath, $content);
                            if ($img !== false) imagedestroy($img);
                            $urls[] = '/uploads/' . $uniqueName . '.' . $ext;
                        }
                    }
                }
                $zip->close();
            }
        } else {
            // Direct image upload
            $uniqueName = 'page-' . round(microtime(true) * 1000) . '-' . rand(100000, 999999);
            $content = file_get_contents($file['tmp_name']);
            $img = @imagecreatefromstring($content);
            
            if ($img !== false && function_exists('imagewebp')) {
                $targetPath = $uploadsDir . $uniqueName . '.webp';
                imagewebp($img, $targetPath, 75);
                imagedestroy($img);
                $urls[] = '/uploads/' . $uniqueName . '.webp';
            } else {
                $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
                $targetPath = $uploadsDir . $uniqueName . '.' . $ext;
                move_uploaded_file($file['tmp_name'], $targetPath);
                if ($img !== false) imagedestroy($img);
                $urls[] = '/uploads/' . $uniqueName . '.' . $ext;
            }
        }
    }
    
    sendResponse(["success" => true, "urls" => $urls]);
}

// ADMIN DB STATUS
if ($method === 'GET' && $sub_path === '/admin/db-status') {
    requireAdmin($pdo);
    try {
        $startTime = microtime(true);
        $stmt = $pdo->query("SELECT 1");
        $stmt->fetch();
        $latencyMs = round((microtime(true) - $startTime) * 1000, 2);

        $stmtName = $pdo->query("SELECT DATABASE() as dbname, @@character_set_database as charset, @@collation_database as collation");
        $dbInfo = $stmtName->fetch();

        $tables = ['users', 'series', 'chapters', 'comments', 'bookmarks', 'history', 'ratings', 'reports', 'settings', 'wallet_transactions', 'purchased_chapters', 'chapter_views_log'];
        $tableCounts = [];
        foreach ($tables as $tbl) {
            try {
                $cStmt = $pdo->query("SELECT COUNT(*) as count FROM `$tbl`");
                $cRow = $cStmt->fetch();
                $tableCounts[$tbl] = (int)($cRow['count'] ?? 0);
            } catch (Exception $e) {
                $tableCounts[$tbl] = 0;
            }
        }

        sendResponse([
            "connected" => true,
            "isUsingMySQL" => true,
            "database" => $dbInfo['dbname'] ?? DB_NAME,
            "charset" => $dbInfo['charset'] ?? 'utf8mb4',
            "collation" => $dbInfo['collation'] ?? 'utf8mb4_unicode_ci',
            "latencyMs" => $latencyMs,
            "tableCounts" => $tableCounts,
            "statusText" => "دیتابیس MySQL فعال و متصل است (" . ($dbInfo['charset'] ?? 'utf8mb4') . ")"
        ]);
    } catch (Exception $e) {
        sendResponse([
            "connected" => false,
            "isUsingMySQL" => true,
            "error" => $e->getMessage(),
            "statusText" => "خطا در ارتباط با دیتابیس: " . $e->getMessage()
        ], 500);
    }
}

// ADMIN FIX CHARSET
if ($method === 'POST' && $sub_path === '/admin/fix-charset') {
    requireAdmin($pdo);
    try {
        $dbname = DB_NAME;
        $pdo->exec("ALTER DATABASE `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $tables = ['users', 'series', 'chapters', 'comments', 'bookmarks', 'history', 'ratings', 'reports', 'settings', 'wallet_transactions', 'purchased_chapters', 'chapter_views_log'];
        foreach ($tables as $tbl) {
            try {
                $pdo->exec("ALTER TABLE `$tbl` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            } catch (Exception $e) {}
        }
        sendResponse(["success" => true, "message" => "انکودینگ دیتابیس به utf8mb4_unicode_ci تغییر یافت."]);
    } catch (Exception $e) {
        sendResponse(["error" => "خطا در اصلاح انکودینگ: " . $e->getMessage()], 500);
    }
}

// ADMIN GET REVENUE ROLES
if ($method === 'GET' && $sub_path === '/admin/revenue-roles') {
    requireAdmin($pdo);
    try {
        $stmt = $pdo->prepare("SELECT val FROM settings WHERE id = 'revenue_roles'");
        $stmt->execute();
        $row = $stmt->fetch();
        $defaultRoles = [
            ["id" => "editor", "name" => "ادیتور", "percentage" => 30],
            ["id" => "translator", "name" => "مترجم", "percentage" => 20],
            ["id" => "cleaner", "name" => "کلینر", "percentage" => 30],
            ["id" => "website", "name" => "وبسایت", "percentage" => 20]
        ];
        $roles = ($row && !empty($row['val'])) ? json_decode($row['val'], true) : $defaultRoles;
        sendResponse($roles);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ADMIN SAVE REVENUE ROLES
if ($method === 'POST' && $sub_path === '/admin/revenue-roles') {
    requireAdmin($pdo);
    try {
        $input = getJsonInput();
        $roles = $input['roles'] ?? null;
        if (!is_array($roles)) {
            sendResponse(["error" => "لیست نقش‌ها ارسالی نامعتبر است."], 400);
        }
        $stmt = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('revenue_roles', ?) ON DUPLICATE KEY UPDATE val=VALUES(val)");
        $stmt->execute([json_encode($roles, JSON_UNESCAPED_UNICODE)]);
        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ADMIN GET WEBSITE REVENUE
if ($method === 'GET' && $sub_path === '/admin/website-revenue') {
    requireAdmin($pdo);
    try {
        $stmt = $pdo->prepare("SELECT val FROM settings WHERE id = 'website_revenue'");
        $stmt->execute();
        $row = $stmt->fetch();
        $revenue = ($row && !empty($row['val'])) ? json_decode($row['val'], true) : ["totalEarned" => 0];

        $txs = [];
        try {
            $txStmt = $pdo->prepare("SELECT * FROM wallet_transactions WHERE (description LIKE '%سود سایت%' OR description LIKE '%تسویه حساب%') ORDER BY createdAt DESC LIMIT 100");
            $txStmt->execute();
            $txs = $txStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        sendResponse([
            "totalEarned" => (int)($revenue['totalEarned'] ?? 0),
            "transactions" => $txs
        ]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ADMIN SETTLE WEBSITE REVENUE
if ($method === 'POST' && $sub_path === '/admin/settle-website-revenue') {
    requireAdmin($pdo);
    try {
        $input = getJsonInput();
        $amount = (int)($input['amount'] ?? 0);
        $description = trim($input['description'] ?? '');

        if ($amount <= 0) {
            sendResponse(["error" => "مبلغ ارسالی برای تسویه حساب معتبر نیست."], 400);
        }

        $stmt = $pdo->prepare("SELECT val FROM settings WHERE id = 'website_revenue'");
        $stmt->execute();
        $row = $stmt->fetch();
        $currentRev = ($row && !empty($row['val'])) ? json_decode($row['val'], true) : ["totalEarned" => 0];

        $previousTotal = (int)($currentRev['totalEarned'] ?? 0);
        $currentRev['totalEarned'] = $previousTotal - $amount;

        $stmtUp = $pdo->prepare("INSERT INTO settings (id, val) VALUES ('website_revenue', ?) ON DUPLICATE KEY UPDATE val=VALUES(val)");
        $stmtUp->execute([json_encode($currentRev, JSON_UNESCAPED_UNICODE)]);

        // Create transaction
        $now = date('Y-m-d H:i:s');
        $transId = "tx-" . time() . "-" . rand(10000, 99999);
        $desc = $description ? ("تسویه حساب: " . $description) : "کاهش و تسویه حساب از سود سایت";

        try {
            $adminStmt = $pdo->prepare("SELECT id, displayName FROM users WHERE role = 'admin' LIMIT 1");
            $adminStmt->execute();
            $adminUser = $adminStmt->fetch(PDO::FETCH_ASSOC);
            $adminId = $adminUser ? $adminUser['id'] : 'system';
            $adminName = $adminUser ? $adminUser['displayName'] : 'مدیر کل';

            $txIns = $pdo->prepare("INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName, createdAt) VALUES (?, ?, ?, ?, 'debit', ?, 'system', 'سیستم', ?)");
            $txIns->execute([$transId, $adminId, $adminName, -$amount, $desc, $now]);
        } catch (Exception $e) {}

        sendResponse(["success" => true, "newBalance" => $currentRev['totalEarned']]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ADMIN GET STAFF
if ($method === 'GET' && $sub_path === '/admin/staff') {
    requireAdmin($pdo);
    try {
        $stmt = $pdo->prepare("SELECT id, email, displayName, role FROM users WHERE role = 'staff' OR role = 'admin'");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        sendResponse($rows ?: []);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ADMIN GET LOGS
if ($method === 'GET' && $sub_path === '/admin/logs') {
    requireAdmin($pdo);
    try {
        $logs = [];
        try {
            $txStmt = $pdo->prepare("SELECT * FROM wallet_transactions ORDER BY createdAt DESC LIMIT 30");
            $txStmt->execute();
            foreach ($txStmt->fetchAll(PDO::FETCH_ASSOC) as $tx) {
                $amt = (int)($tx['amount'] ?? 0);
                $logs[] = [
                    'id' => $tx['id'],
                    'type' => $amt < 0 ? 'payout' : 'charge',
                    'title' => $amt < 0 ? 'تسویه و پرداخت مالی' : 'شارژ / تراکنش',
                    'description' => ($tx['userName'] ?? 'کاربر') . ": " . ($tx['description'] ?? '') . " (" . number_format(abs($amt)) . " ت)",
                    'createdAt' => $tx['createdAt']
                ];
            }
        } catch (Exception $e) {}

        try {
            $chStmt = $pdo->prepare("SELECT * FROM chapters ORDER BY createdAt DESC LIMIT 30");
            $chStmt->execute();
            foreach ($chStmt->fetchAll(PDO::FETCH_ASSOC) as $ch) {
                $isPending = !empty($ch['isPending']);
                $logs[] = [
                    'id' => 'ch-' . $ch['id'],
                    'type' => $isPending ? 'upload' : 'approval',
                    'title' => $isPending ? 'بارگذاری / ثبت چپتر' : 'تایید و انتشار چپتر',
                    'description' => "چپتر " . $ch['number'] . " (" . ($ch['title'] ?: 'بدون عنوان') . ") - " . ($isPending ? 'در انتظار تایید' : 'منتشر شده عمومی'),
                    'createdAt' => $ch['createdAt']
                ];
            }
        } catch (Exception $e) {}

        usort($logs, function($a, $b) {
            return strtotime($b['createdAt']) - strtotime($a['createdAt']);
        });

        sendResponse(array_slice($logs, 0, 30));
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ADMIN GET SERIES SALES SUMMARY
if ($method === 'GET' && preg_match('/^\/admin\/series\/([^\/]+)\/sales-summary$/', $sub_path, $matches)) {
    requireAdmin($pdo);
    try {
        $seriesId = $matches[1];
        $sStmt = $pdo->prepare("SELECT * FROM series WHERE id = ?");
        $sStmt->execute([$seriesId]);
        $series = $sStmt->fetch(PDO::FETCH_ASSOC);
        if (!$series) {
            sendResponse(["error" => "کار یافت نشد"], 404);
        }

        $cStmt = $pdo->prepare("SELECT * FROM chapters WHERE seriesId = ?");
        $cStmt->execute([$seriesId]);
        $chapters = $cStmt->fetchAll(PDO::FETCH_ASSOC);

        $purchases = [];
        try {
            $pStmt = $pdo->prepare("SELECT * FROM purchased_chapters WHERE seriesId = ?");
            $pStmt->execute([$seriesId]);
            $purchases = $pStmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}

        $chapterMap = [];
        foreach ($purchases as $p) {
            $chId = $p['chapterId'];
            $chapterMap[$chId] = ($chapterMap[$chId] ?? 0) + 1;
        }

        $price = 400;
        $list = [];
        foreach ($chapters as $ch) {
            $cnt = $chapterMap[$ch['id']] ?? 0;
            $contributors = [];
            if (!empty($ch['contributors'])) {
                $contributors = is_array($ch['contributors']) ? $ch['contributors'] : json_decode($ch['contributors'], true);
            }
            $list[] = [
                'id' => $ch['id'],
                'number' => $ch['number'],
                'title' => $ch['title'],
                'salesCount' => $cnt,
                'totalSalesAmount' => $cnt * $price,
                'contributors' => $contributors
            ];
        }

        $totalPurchasesCount = count($purchases);
        $totalSales = $totalPurchasesCount * $price;

        sendResponse([
            "seriesTitle" => $series['title'],
            "totalPurchasesCount" => $totalPurchasesCount,
            "totalSales" => $totalSales,
            "byChapter" => $list
        ]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// ADMIN SAVE CHAPTER CONTRIBUTORS
if ($method === 'POST' && preg_match('/^\/series\/([^\/]+)\/chapters\/([^\/]+)\/contributors$/', $sub_path, $matches)) {
    requireAdmin($pdo);
    try {
        $seriesId = $matches[1];
        $chapterId = $matches[2];
        $input = getJsonInput();
        $contributors = $input['contributors'] ?? [];

        $chStmt = $pdo->prepare("SELECT * FROM chapters WHERE id = ?");
        $chStmt->execute([$chapterId]);
        $ch = $chStmt->fetch(PDO::FETCH_ASSOC);
        if (!$ch) {
            sendResponse(["error" => "چپتر یافت نشد"], 404);
        }

        $upStmt = $pdo->prepare("UPDATE chapters SET contributors = ? WHERE id = ?");
        $upStmt->execute([json_encode($contributors, JSON_UNESCAPED_UNICODE), $chapterId]);

        sendResponse(["success" => true]);
    } catch (Exception $e) {
        sendResponse(["error" => $e->getMessage()], 500);
    }
}

// Fallback Route if not matched
sendResponse(["error" => "مسیر انتخابی یافت نشد."], 404);
