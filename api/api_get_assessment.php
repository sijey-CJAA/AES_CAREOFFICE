<?php
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $id = intval($_GET['id']);
    try {
        $stmt = $pdo->prepare("SELECT * FROM assessment_records WHERE id = ?");
        $stmt->execute([$id]);
        $assessment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($assessment) {
            echo json_encode(['status' => 'success', 'data' => $assessment]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Assessment record not found']);
        }
    } catch (PDOException $e) {
        aes_log_error("Error fetching assessment details for ID {$id}: " . $e->getMessage(), ['id' => $id]);
        echo json_encode(['status' => 'error', 'message' => 'Unable to load assessment record due to a database error.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
