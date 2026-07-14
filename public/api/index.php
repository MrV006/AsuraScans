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
        )",
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
            contributors TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )",
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
        )",
        "CREATE TABLE IF NOT EXISTS comments (
            id VARCHAR(100) PRIMARY KEY,
            chapterId VARCHAR(100) NOT NULL,
            userId VARCHAR(100) NOT NULL,
            userName VARCHAR(100) NOT NULL,
            userAvatar TEXT,
            content TEXT NOT NULL,
            likes TEXT,
            dislikes TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE TABLE IF NOT EXISTS bookmarks (
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (userId, seriesId)
        )",
        "CREATE TABLE IF NOT EXISTS history (
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            chapterId VARCHAR(100) NOT NULL,
            chapterNumber DOUBLE NOT NULL,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (userId, seriesId)
        )",
        "CREATE TABLE IF NOT EXISTS ratings (
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            score DOUBLE NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (userId, seriesId)
        )",
        "CREATE TABLE IF NOT EXISTS settings (
            id VARCHAR(50) PRIMARY KEY,
            val TEXT NOT NULL
        )",
        "CREATE TABLE IF NOT EXISTS reports (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            userName VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            type VARCHAR(50) DEFAULT 'system',
            title VARCHAR(255) NOT NULL,
            body TEXT,
            link VARCHAR(255),
            isRead TINYINT(1) DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
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
        )",
        "CREATE TABLE IF NOT EXISTS purchased_chapters (
            id VARCHAR(100) PRIMARY KEY,
            userId VARCHAR(100) NOT NULL,
            seriesId VARCHAR(100) NOT NULL,
            chapterId VARCHAR(100) NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_chap (userId, seriesId, chapterId)
        )"
    ];

    foreach ($queries as $q) {
        $pdo->exec($q);
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
    requireAdmin($pdo);
    $input = getJsonInput();
    $banned = isset($input['banned']) ? ($input['banned'] ? 1 : 0) : 0;
    
    $stmt = $pdo->prepare("UPDATE users SET banned = ? WHERE id = ?");
    $stmt->execute([$banned, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 10. UPDATE USER ROLE & PERMISSIONS (ADMIN)
if ($method === 'PUT' && matchRoute('/users/:id/roles-permissions', $sub_path, $params)) {
    requireAdmin($pdo);
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
    requireAdmin($pdo);
    $input = getJsonInput();
    $role = isset($input['role']) ? $input['role'] : 'user';
    
    $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
    $stmt->execute([$role, $params['id']]);
    
    sendResponse(["success" => true]);
}

// 12. UPDATE CAN CREATE SERIES (ADMIN)
if ($method === 'PUT' && matchRoute('/users/:id/can-create-series', $sub_path, $params)) {
    requireAdmin($pdo);
    $input = getJsonInput();
    $canCreateSeries = isset($input['canCreateSeries']) ? ($input['canCreateSeries'] ? 1 : 0) : 0;
    
    $stmt = $pdo->prepare("UPDATE users SET canCreateSeries = ? WHERE id = ?");
    $stmt->execute([$canCreateSeries, $params['id']]);
    
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
    $alternativeTitles = isset($input['alternativeTitles']) ? implode(',', $input['alternativeTitles']) : '';
    $cover = isset($input['cover']) ? $input['cover'] : '';
    $banner = isset($input['banner']) ? $input['banner'] : '';
    $author = isset($input['author']) ? $input['author'] : '';
    $artist = isset($input['artist']) ? $input['artist'] : '';
    $synopsis = isset($input['synopsis']) ? $input['synopsis'] : '';
    $genres = isset($input['genres']) ? implode(',', $input['genres']) : '';
    $tags = isset($input['tags']) ? implode(',', $input['tags']) : '';
    $status = isset($input['status']) ? $input['status'] : 'Ongoing';
    $rating = isset($input['rating']) ? (double)$input['rating'] : 0.0;
    $type = isset($input['type']) ? $input['type'] : 'Manhwa';
    $contributors = isset($input['contributors']) ? json_encode($input['contributors']) : '[]';
    
    // Check if exists
    $stmtCheck = $pdo->prepare("SELECT id FROM series WHERE id = ?");
    $stmtCheck->execute([$id]);
    $exists = $stmtCheck->fetch();
    
    if ($exists) {
        $stmt = $pdo->prepare("UPDATE series SET title = ?, alternativeTitles = ?, cover = ?, banner = ?, author = ?, artist = ?, synopsis = ?, genres = ?, tags = ?, status = ?, type = ? WHERE id = ?");
        $stmt->execute([$title, $alternativeTitles, $cover, $banner, $author, $artist, $synopsis, $genres, $tags, $status, $type, $id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO series (id, title, alternativeTitles, cover, banner, author, artist, synopsis, genres, tags, status, rating, type, views, contributors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)");
        $stmt->execute([$id, $title, $alternativeTitles, $cover, $banner, $author, $artist, $synopsis, $genres, $tags, $status, $rating, $type, $contributors]);
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
    $s['rating'] = (double)$s['rating'];
    $s['views'] = (int)$s['views'];
    
    sendResponse($s);
}

// 16. DELETE SERIES (ADMIN)
if ($method === 'DELETE' && matchRoute('/series/:id', $sub_path, $params)) {
    requireAdmin($pdo);
    $stmt = $pdo->prepare("DELETE FROM series WHERE id = ?");
    $stmt->execute([$params['id']]);
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
    
    $stmtCheck = $pdo->prepare("SELECT id FROM chapters WHERE id = ?");
    $stmtCheck->execute([$id]);
    $exists = $stmtCheck->fetch();
    
    if ($exists) {
        $stmt = $pdo->prepare("UPDATE chapters SET number = ?, title = ?, images = ?, isPending = ?, submissions = ? WHERE id = ?");
        $stmt->execute([$number, $title, $images, $isPending, $submissions, $id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO chapters (id, seriesId, number, title, images, views, isPending, submissions) VALUES (?, ?, ?, ?, ?, 0, ?, ?)");
        $stmt->execute([$id, $params['seriesId'], $number, $title, $images, $isPending, $submissions]);
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
    
    sendResponse($ch);
}

// 24. DELETE CHAPTER (ADMIN)
if ($method === 'DELETE' && matchRoute('/series/:seriesId/chapters/:id', $sub_path, $params)) {
    requireAdmin($pdo);
    $stmt = $pdo->prepare("DELETE FROM chapters WHERE seriesId = ? AND id = ?");
    $stmt->execute([$params['seriesId'], $params['id']]);
    sendResponse(["success" => true]);
}

// 25. APPROVE SUBMITTED CHAPTER (ADMIN)
if ($method === 'PUT' && matchRoute('/series/:seriesId/chapters/:id/approve', $sub_path, $params)) {
    requireAdmin($pdo);
    $stmt = $pdo->prepare("UPDATE chapters SET isPending = 0 WHERE seriesId = ? AND id = ?");
    $stmt->execute([$params['seriesId'], $params['id']]);
    sendResponse(["success" => true]);
}

// 26. INCREMENT CHAPTER VIEWS
if ($method === 'POST' && matchRoute('/series/:seriesId/chapters/:id/view', $sub_path, $params)) {
    $stmt = $pdo->prepare("UPDATE chapters SET views = views + 1 WHERE seriesId = ? AND id = ?");
    $stmt->execute([$params['seriesId'], $params['id']]);
    
    $stmtSelect = $pdo->prepare("SELECT views FROM chapters WHERE id = ?");
    $stmtSelect->execute([$params['id']]);
    $res = $stmtSelect->fetch();
    sendResponse(["views" => (int)$res['views']]);
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
    $stmt = $pdo->prepare("SELECT * FROM comments WHERE chapterId = ? ORDER BY createdAt DESC");
    $stmt->execute([$params['chapterId']]);
    $comments = $stmt->fetchAll();
    
    foreach ($comments as &$c) {
        $c['likes'] = $c['likes'] ? json_decode($c['likes'], true) : [];
        if (!is_array($c['likes'])) $c['likes'] = [];
        $c['dislikes'] = $c['dislikes'] ? json_decode($c['dislikes'], true) : [];
        if (!is_array($c['dislikes'])) $c['dislikes'] = [];
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
    
    $id = 'comment-' . round(microtime(true) * 1000);
    $stmt = $pdo->prepare("INSERT INTO comments (id, chapterId, userId, userName, userAvatar, content, likes, dislikes) VALUES (?, ?, ?, ?, ?, ?, '[]', '[]')");
    $stmt->execute([
        $id,
        $params['chapterId'],
        $user['id'],
        $user['displayName'],
        $user['avatarUrl'],
        $content
    ]);
    
    // Fetch and return
    $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ?");
    $stmt->execute([$id]);
    $c = $stmt->fetch();
    $c['likes'] = [];
    $c['dislikes'] = [];
    
    sendResponse($c);
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
if ($method === 'DELETE' && matchRoute('/comments/:id', $sub_path, $params)) {
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

// 41. GET ADMIN STATS (ADMIN)
if ($method === 'GET' && $sub_path === '/admin/stats') {
    requireAdmin($pdo);
    
    $q1 = $pdo->query("SELECT COUNT(*) as cnt FROM series")->fetch();
    $q2 = $pdo->query("SELECT COUNT(*) as cnt FROM chapters")->fetch();
    $q3 = $pdo->query("SELECT COUNT(*) as cnt FROM users")->fetch();
    
    sendResponse([
        "totalSeries" => (int)$q1['cnt'],
        "totalChapters" => (int)$q2['cnt'],
        "totalUsers" => (int)$q3['cnt']
    ]);
}

// 42. GET ALL COMMENTS (ADMIN)
if ($method === 'GET' && $sub_path === '/admin/comments') {
    requireAdmin($pdo);
    $stmt = $pdo->query("SELECT * FROM comments ORDER BY createdAt DESC");
    $comments = $stmt->fetchAll();
    foreach ($comments as &$c) {
        $c['likes'] = $c['likes'] ? json_decode($c['likes'], true) : [];
        $c['dislikes'] = $c['dislikes'] ? json_decode($c['dislikes'], true) : [];
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
    if (!$user) sendResponse(["error" => "کاربر یافت نشد."], 401);
    
    $input = getJsonInput();
    $title = isset($input['title']) ? trim($input['title']) : '';
    $content = isset($input['content']) ? trim($input['content']) : '';
    
    if (empty($title) || empty($content)) {
        sendResponse(["error" => "پر کردن عنوان و متن گزارش الزامی است."], 400);
    }
    
    $id = 'report-' . round(microtime(true) * 1000);
    $stmt = $pdo->prepare("INSERT INTO reports (id, userId, userName, title, content, status) VALUES (?, ?, ?, ?, ?, 'pending')");
    $stmt->execute([$id, $user['id'], $user['displayName'], $title, $content]);
    
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
if ($method === 'DELETE' && matchRoute('/reports/:id', $sub_path, $params)) {
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
    $amount = (int)(isset($input['amount']) ? $input['amount'] : 0);
    $description = isset($input['description']) ? $input['description'] : 'شارژ حساب کاربری';
    
    if ($amount <= 0) {
        sendResponse(["error" => "مبلغ شارژ باید بیشتر از صفر باشد."], 400);
    }
    
    // Begin Transaction
    $pdo->beginTransaction();
    try {
        $stmtUser = $pdo->prepare("SELECT walletBalance FROM users WHERE id = ? FOR UPDATE");
        $stmtUser->execute([$user['id']]);
        $uData = $stmtUser->fetch();
        $newBalance = ($uData['walletBalance'] ?: 0) + $amount;
        
        $stmtUpdate = $pdo->prepare("UPDATE users SET walletBalance = ? WHERE id = ?");
        $stmtUpdate->execute([$newBalance, $user['id']]);
        
        $tid = 'tx-' . round(microtime(true) * 1000);
        $stmtTx = $pdo->prepare("INSERT INTO wallet_transactions (id, userId, userName, amount, type, description, creatorId, creatorName) VALUES (?, ?, ?, ?, 'charge', ?, ?, ?)");
        $stmtTx->execute([
            $tid,
            $user['id'],
            $user['displayName'],
            $amount,
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
    
    foreach ($normalized_files as $file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            continue;
        }
        
        $orig_name = strtolower($file['name']);
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

// Fallback Route if not matched
sendResponse(["error" => "مسیر انتخابی یافت نشد."], 404);
