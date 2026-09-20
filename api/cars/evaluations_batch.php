<?php
require_once '../../config/db.php';
require_once 'scoring_engine.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid method']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$session_id = $input['session_id'] ?? null;
$evaluations = $input['evaluations'] ?? [];

if (!$session_id || empty($evaluations)) {
    echo json_encode(['status' => 'error', 'message' => 'Missing session_id or evaluations data']);
    exit;
}

// Fetch session to get grade_level
$stmt = $pdo->prepare("SELECT grade_level FROM cars_assessment_sessions WHERE id = ?");
$stmt->execute([$session_id]);
$session = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$session) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid session']);
    exit;
}

$gradeGroup = 'Grades 4-8'; // For simplicity. In a real system, map grade_level to gradeGroup.

$scoringEngine = new CarsScoringEngine($pdo);

try {
    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("INSERT INTO cars_student_evaluations 
        (session_id, student_id, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20, q21, q22, q23, q24, 
        externalizing_score, internalizing_score, social_score, academic_score, total_raw_score, t_score, percentile_rank, risk_status, tier_level) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        q1=VALUES(q1), q2=VALUES(q2), q3=VALUES(q3), q4=VALUES(q4), q5=VALUES(q5), q6=VALUES(q6), q7=VALUES(q7), q8=VALUES(q8), 
        q9=VALUES(q9), q10=VALUES(q10), q11=VALUES(q11), q12=VALUES(q12), q13=VALUES(q13), q14=VALUES(q14), q15=VALUES(q15), q16=VALUES(q16), 
        q17=VALUES(q17), q18=VALUES(q18), q19=VALUES(q19), q20=VALUES(q20), q21=VALUES(q21), q22=VALUES(q22), q23=VALUES(q23), q24=VALUES(q24),
        externalizing_score=VALUES(externalizing_score), internalizing_score=VALUES(internalizing_score), 
        social_score=VALUES(social_score), academic_score=VALUES(academic_score), total_raw_score=VALUES(total_raw_score), 
        t_score=VALUES(t_score), percentile_rank=VALUES(percentile_rank), risk_status=VALUES(risk_status), tier_level=VALUES(tier_level)
    ");

    foreach ($evaluations as $eval) {
        $student_id = $eval['student_id'];
        $responses = $eval['responses'] ?? []; // ['q1' => 2, 'q2' => null, ...]

        $result = $scoringEngine->evaluate($responses, $gradeGroup);

        $stmtInsert->execute([
            $session_id, $student_id,
            $result['q'][1], $result['q'][2], $result['q'][3], $result['q'][4], 
            $result['q'][5], $result['q'][6], $result['q'][7], $result['q'][8], 
            $result['q'][9], $result['q'][10], $result['q'][11], $result['q'][12], 
            $result['q'][13], $result['q'][14], $result['q'][15], $result['q'][16], 
            $result['q'][17], $result['q'][18], $result['q'][19], $result['q'][20], 
            $result['q'][21], $result['q'][22], $result['q'][23], $result['q'][24],
            $result['externalizing_score'], $result['internalizing_score'],
            $result['social_score'], $result['academic_score'],
            $result['total_raw_score'], $result['t_score'], $result['percentile_rank'],
            $result['risk_status'], $result['tier_level']
        ]);
    }

    $pdo->commit();
    echo json_encode(['status' => 'success', 'message' => 'Evaluations saved successfully']);

} catch (PDOException $e) {
    $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
