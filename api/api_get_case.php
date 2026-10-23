<?php
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $id = intval($_GET['id']);
    try {
        $stmt = $pdo->prepare("SELECT * FROM case_register WHERE id = ?");
        $stmt->execute([$id]);
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
    } catch (PDOException $e) {
        aes_log_error("Error fetching case details for ID {$id}: " . $e->getMessage(), ['id' => $id]);
        echo json_encode(['status' => 'error', 'message' => 'Unable to load case record due to a database error.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
