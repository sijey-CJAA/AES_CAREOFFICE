<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT * FROM case_register WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    $case = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($case) {
        $stmt_students = $pdo->prepare("SELECT student_id FROM case_students WHERE case_id = ?");
        $stmt_students->execute([$case['id']]);
        $student_ids = $stmt_students->fetchAll(PDO::FETCH_COLUMN);
        
        $case['student_ids'] = $student_ids;
        // Fallback for UI if it still expects student_id for single-student edit
        $case['student_id'] = !empty($student_ids) ? $student_ids[0] : null;

        echo json_encode(['status' => 'success', 'data' => $case]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Case record not found']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
