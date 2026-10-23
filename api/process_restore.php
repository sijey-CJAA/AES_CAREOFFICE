<?php
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/db.php';

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
        $stmt = $pdo->prepare("UPDATE `$table` SET deleted_at = NULL WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['status' => 'success', 'message' => 'Record restored successfully.']);
    } catch(PDOException $e) {
        aes_log_error("Failed to restore {$table} ID {$id}: " . $e->getMessage(), ['table' => $table, 'id' => $id]);
        echo json_encode(['status' => 'error', 'message' => 'Unable to restore record due to a database error. Please try again.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
