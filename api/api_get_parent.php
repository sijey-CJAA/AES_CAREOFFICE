<?php
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $id = intval($_GET['id']);
    try {
        $stmt = $pdo->prepare("SELECT * FROM parents WHERE id = ?");
        $stmt->execute([$id]);
        $parent = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($parent) {
            echo json_encode(['status' => 'success', 'data' => $parent]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Parent not found']);
        }
    } catch (PDOException $e) {
        aes_log_error("Error fetching parent details for ID {$id}: " . $e->getMessage(), ['id' => $id]);
        echo json_encode(['status' => 'error', 'message' => 'Unable to load parent details due to a database error.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
