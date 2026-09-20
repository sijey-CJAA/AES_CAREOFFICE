<?php
require_once '../../config/db.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM cars_norm_tables ORDER BY grade_group ASC, raw_score ASC");
        $norms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['status' => 'success', 'data' => $norms]);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = $input['id'] ?? null;
    $grade_group = $input['grade_group'] ?? '';
    $raw_score = $input['raw_score'] ?? '';
    $t_score = $input['t_score'] ?? '';
    $percentile = $input['percentile'] ?? '';

    if ($grade_group === '' || $raw_score === '' || $t_score === '' || $percentile === '') {
        echo json_encode(['status' => 'error', 'message' => 'Missing fields']);
        exit;
    }

    try {
        if ($id) {
            $stmt = $pdo->prepare("UPDATE cars_norm_tables SET grade_group=?, raw_score=?, t_score=?, percentile=? WHERE id=?");
            $stmt->execute([$grade_group, $raw_score, $t_score, $percentile, $id]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO cars_norm_tables (grade_group, raw_score, t_score, percentile) VALUES (?, ?, ?, ?)");
            $stmt->execute([$grade_group, $raw_score, $t_score, $percentile]);
        }
        echo json_encode(['status' => 'success', 'message' => 'Norm updated']);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
} elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        echo json_encode(['status' => 'error', 'message' => 'Missing ID']);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM cars_norm_tables WHERE id=?");
        $stmt->execute([$id]);
        echo json_encode(['status' => 'success', 'message' => 'Deleted']);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
}
