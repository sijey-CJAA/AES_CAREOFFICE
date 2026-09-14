<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (!isset($_GET['grade_level']) || !isset($_GET['section'])) {
    echo json_encode(['status' => 'error', 'message' => 'grade_level and section are required']);
    exit;
}

$grade = $_GET['grade_level'];
$section = $_GET['section'];

try {
    $stmt = $pdo->prepare("
        SELECT 
            s.id, 
            s.full_name, 
            s.lrn, 
            s.status,
            (SELECT mobile_number FROM parents p WHERE p.student_id = s.id AND p.parent_type = 'Primary' AND p.deleted_at IS NULL LIMIT 1) as contact_number
        FROM students s 
        WHERE s.grade_level = ? AND s.section = ? AND s.deleted_at IS NULL 
        ORDER BY s.full_name ASC
    ");
    $stmt->execute([$grade, $section]);
    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['status' => 'success', 'data' => $students]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error']);
}
?>
