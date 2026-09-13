<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT * FROM case_register WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    $case = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($case) {
        echo json_encode(['status' => 'success', 'data' => $case]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Case record not found']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
