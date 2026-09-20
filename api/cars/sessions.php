<?php
require_once '../../config/db.php';
require_once '../../config/auth.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Fetch all sessions
    try {
        $stmt = $pdo->query("SELECT s.*, 
            (SELECT COUNT(*) FROM cars_student_evaluations e WHERE e.session_id = s.id) as total_students,
            (SELECT COUNT(*) FROM cars_student_evaluations e WHERE e.session_id = s.id AND e.risk_status != 'INCOMPLETE') as completed_evaluations
            FROM cars_assessment_sessions s 
            ORDER BY s.created_at DESC");
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['status' => 'success', 'data' => $sessions]);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    // Create new session
    $academic_year = $_POST['academic_year'] ?? '';
    $grade_level = $_POST['grade_level'] ?? '';
    $section_name = $_POST['section_name'] ?? '';
    $evaluator_id = $_SESSION['user_id'] ?? null;
    $assessed_at = date('Y-m-d');

    if (empty($academic_year) || empty($grade_level) || empty($section_name)) {
        echo json_encode(['status' => 'error', 'message' => 'Missing required fields']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO cars_assessment_sessions (academic_year, grade_level, section_name, evaluator_id, assessed_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$academic_year, $grade_level, $section_name, $evaluator_id, $assessed_at]);
        $session_id = $pdo->lastInsertId();
        
        // Optionally, pre-populate students from that grade/section
        // For simplicity, we just return the session ID. The UI will handle adding students.
        
        echo json_encode(['status' => 'success', 'message' => 'Session created successfully', 'session_id' => $session_id]);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}
