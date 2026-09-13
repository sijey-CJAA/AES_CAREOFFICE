<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $table = isset($_POST['table']) ? $_POST['table'] : '';
    $id = isset($_POST['id']) ? intval($_POST['id']) : 0;

    $allowed_tables = ['students', 'parents', 'assessment_records', 'case_register'];

    if (!in_array($table, $allowed_tables)) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid table specified.']);
        exit;
    }

    if ($id <= 0) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid record ID.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE `$table` SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['status' => 'success', 'message' => 'Record moved to trash successfully.']);
    } catch(PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: Could not delete record.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
