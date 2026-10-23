<?php
// db.php
// Centralized Database connection & error handling configuration

// ── 1. Helper: Safe Server-Side Error Logging ─────────────────────────────────
if (!function_exists('aes_log_error')) {
    function aes_log_error($message, array $context = []) {
        $log_dir = __DIR__ . '/../logs';
        if (!is_dir($log_dir)) {
            @mkdir($log_dir, 0755, true);
        }

        // Ensure .htaccess exists to block direct web access to logs
        $htaccess = $log_dir . '/.htaccess';
        if (!file_exists($htaccess)) {
            @file_put_contents($htaccess, "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n");
        }

        // Sanitize context to ensure passwords or sensitive keys are never logged
        $sanitized_context = [];
        $sensitive_keys = ['password', 'current_password', 'new_password', 'confirm_password', 'db_pass', 'pass'];
        foreach ($context as $key => $val) {
            if (in_array(strtolower($key), $sensitive_keys, true)) {
                $sanitized_context[$key] = '***REDACTED***';
            } elseif (is_array($val)) {
                $sanitized_context[$key] = '[array]';
            } else {
                $sanitized_context[$key] = $val;
            }
        }

        $timestamp = date('Y-m-d H:i:s');
        $endpoint = $_SERVER['REQUEST_URI'] ?? 'CLI';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $ctx_str = !empty($sanitized_context) ? ' | Context: ' . json_encode($sanitized_context, JSON_UNESCAPED_SLASHES) : '';

        $entry = sprintf("[%s] [%s %s] [IP: %s] %s%s\n", $timestamp, $method, $endpoint, $ip, $message, $ctx_str);
        @file_put_contents($log_dir . '/db_errors.log', $entry, FILE_APPEND | LOCK_EX);

        // Also record to standard PHP error log
        @error_log("[AES_CAREOFFICE] " . $message);
    }
}

// ── 2. Helper: Detect API or AJAX Requests ────────────────────────────────────
if (!function_exists('aes_is_api_request')) {
    function aes_is_api_request() {
        if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/api/') !== false) {
            return true;
        }
        if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
            return true;
        }
        if (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
            return true;
        }
        if (isset($_SERVER['HTTP_X_FETCH']) && $_SERVER['HTTP_X_FETCH'] === '1') {
            return true;
        }
        return false;
    }
}

// ── 3. Load Database Credentials ──────────────────────────────────────────────
$config_file = __DIR__ . '/../config.php';

if (file_exists($config_file)) {
    require_once $config_file;
} else {
    // Fallback defaults for local development (XAMPP)
    if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
    if (!defined('DB_NAME')) define('DB_NAME', 'aes');
    if (!defined('DB_USER')) define('DB_USER', 'root');
    if (!defined('DB_PASS')) define('DB_PASS', '');
    if (!defined('DB_PORT')) define('DB_PORT', 3306);
}

// ── 4. Set Base URL for local vs production ───────────────────────────────────
if (!defined('BASE_URL')) {
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
        define('BASE_URL', '/AES_CAREOFFICE');
    } else {
        define('BASE_URL', '');
    }
}

// ── 5. Establish PDO Connection with Transient Retry & Robust Settings ────────
$port_str = (defined('DB_PORT') && DB_PORT) ? ";port=" . DB_PORT : "";
$dsn = "mysql:host=" . DB_HOST . $port_str . ";dbname=" . DB_NAME . ";charset=utf8mb4";

$pdo_options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::ATTR_TIMEOUT            => 5, // 5-second timeout prevents indefinite worker hang on InfinityFree
    PDO::ATTR_PERSISTENT         => false, // NEVER enable persistent connections on InfinityFree (exhausts max_user_connections)
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
];

$pdo = null;
$connect_attempts = 2; // Initial attempt + 1 transient retry
$last_exception = null;

for ($attempt = 1; $attempt <= $connect_attempts; $attempt++) {
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $pdo_options);
        break; // Connected successfully
    } catch (PDOException $e) {
        $last_exception = $e;
        if ($attempt < $connect_attempts) {
            // Short backoff (250ms) to transparently recover from momentary cluster network hiccups
            usleep(250000);
        }
    }
}

// ── 6. Handle Complete Connection Failure Safely ──────────────────────────────
if (!$pdo && $last_exception) {
    $request_id = 'req_' . substr(md5(uniqid((string)mt_rand(), true)), 0, 10);
    aes_log_error(
        sprintf("Database connection failed [Ref: %s]: %s (Code: %s)", $request_id, $last_exception->getMessage(), $last_exception->getCode()),
        ['host' => DB_HOST, 'dbname' => DB_NAME, 'user' => DB_USER]
    );

    if (aes_is_api_request()) {
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status'     => 'error',
            'message'    => 'Database connection is temporarily unavailable. Please try again in a few moments.',
            'request_id' => $request_id
        ]);
        exit;
    }

    // Friendly HTML fallback for regular page loads (no raw SQL or credentials exposed)
    http_response_code(503);
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Database Unavailable | AES Care Office</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
            .error-card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 2.5rem; max-width: 480px; width: 100%; text-align: center; border: 1px solid #e2e8f0; }
            .icon-wrapper { width: 56px; height: 56px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: #dc2626; }
            h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 0.75rem; color: #0f172a; }
            p { font-size: 0.95rem; line-height: 1.5; color: #64748b; margin: 0 0 1.5rem; }
            .ref-code { font-size: 0.8rem; background: #f1f5f9; padding: 0.4rem 0.75rem; border-radius: 6px; color: #475569; display: inline-block; font-family: monospace; margin-bottom: 1.5rem; }
            .retry-btn { display: inline-block; background: #2563eb; color: #ffffff; padding: 0.7rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: background 0.15s; }
            .retry-btn:hover { background: #1d4ed8; }
        </style>
    </head>
    <body>
        <div class="error-card">
            <div class="icon-wrapper">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h1>Database Temporarily Unavailable</h1>
            <p>We are experiencing a temporary connection delay to the database cluster. Please refresh the page or try again in a few moments.</p>
            <div class="ref-code">Reference Code: <?= htmlspecialchars($request_id) ?></div>
            <div>
                <a href="javascript:location.reload()" class="retry-btn">Try Again</a>
            </div>
        </div>
    </body>
    </html>
    <?php
    exit;
}
?>
