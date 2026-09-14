<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (!isset($_GET['grade_level'])) {
    echo json_encode(['status' => 'error', 'message' => 'grade_level is required']);
    exit;
}

$grade = $_GET['grade_level'];

try {
    $stmt = $pdo->prepare("SELECT DISTINCT section FROM students WHERE grade_level = ? AND deleted_at IS NULL ORDER BY section ASC");
    $stmt->execute([$grade]);
    $sections = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo json_encode(['status' => 'success', 'data' => $sections]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
}
?>
