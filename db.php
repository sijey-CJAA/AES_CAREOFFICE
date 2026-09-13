<?php
// db.php
// Database configuration

// Load database configuration from external file
// This keeps credentials out of the Git repository
$config_file = __DIR__ . '/config.php';

if (file_exists($config_file)) {
    require_once $config_file;
} else {
    // Fallback defaults (useful if someone forgets to create config.php)
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'aes');
    define('DB_USER', 'root');
    define('DB_PASS', '');
}

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    // Set the PDO error mode to exception
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // Set default fetch mode to associative array
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    die("ERROR: Could not connect. " . $e->getMessage());
}
?>
