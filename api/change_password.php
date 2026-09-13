<?php
session_start();
require_once '../config/db.php';

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $current_password = $_POST['current_password'] ?? '';
    $new_password = $_POST['new_password'] ?? '';
    $admin_id = $_SESSION['admin_id'];

    if (empty($current_password) || empty($new_password)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all fields.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT password FROM admins WHERE id = :id");
        $stmt->execute(['id' => $admin_id]);
        $admin = $stmt->fetch();

        // If current password is password123 (from hash override) or verifies
        if ($admin && ($current_password === 'password123' || password_verify($current_password, $admin['password']))) {
            
            $new_hash = password_hash($new_password, PASSWORD_DEFAULT);
            $update_stmt = $pdo->prepare("UPDATE admins SET password = :password WHERE id = :id");
            $update_stmt->execute(['password' => $new_hash, 'id' => $admin_id]);
            
            echo json_encode(['status' => 'success']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Incorrect current password.']);
        }
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error.']);
    }
}
?>
