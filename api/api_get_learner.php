<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    $learner = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($learner) {
        echo json_encode(['status' => 'success', 'data' => $learner]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Learner not found']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
