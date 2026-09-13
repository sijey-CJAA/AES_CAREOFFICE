<?php
// logout.php
session_start();
session_unset();
session_destroy();
require_once 'config/db.php';
header('Location: ' . BASE_URL . '/login.php');
exit;
?>

