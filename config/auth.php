<?php
// auth.php
// Include this file at the top of any page that requires admin authentication
session_start();

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
    header('Location: ' . BASE_URL . '/pages/login.php');
    exit;
}
?>
