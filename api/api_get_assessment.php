<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT * FROM assessment_records WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    $assessment = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($assessment) {
        echo json_encode(['status' => 'success', 'data' => $assessment]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Assessment record not found']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
