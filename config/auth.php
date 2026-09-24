<?php
// auth.php
// Include this file at the top of any page that requires admin authentication
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!defined('BASE_URL')) {
    // Ensure BASE_URL is available even if db.php has not been included yet.
    // Localhost (XAMPP) → prefix with subfolder; any other host (InfinityFree, etc.) → root.
    if (isset($_SERVER['HTTP_HOST']) && $_SERVER['HTTP_HOST'] === 'localhost') {
        define('BASE_URL', '/AES_CAREOFFICE');
    } else {
        define('BASE_URL', '');
    }
}

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    // Detect AJAX / fetch() requests so we return JSON instead of an HTML redirect.
    // Fetch API does NOT send X-Requested-With, but we can check Accept header or
    // set a custom header from JS. We also check Content-Type to catch FormData POSTs.
    $is_ajax = (
        (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') ||
        (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) ||
        (isset($_SERVER['HTTP_X_FETCH']) && $_SERVER['HTTP_X_FETCH'] === '1')
    );

    if ($is_ajax) {
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Session expired. Please log in again.']);
        exit;
    }

    header('Location: ' . BASE_URL . '/pages/login.php');
    exit;
}
?>
