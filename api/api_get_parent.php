<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT * FROM parents WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    $parent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($parent) {
        echo json_encode(['status' => 'success', 'data' => $parent]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Parent not found']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
