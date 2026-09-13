<?php
require_once 'auth.php';
require_once 'db.php';

header('Content-Type: application/json');

function get_post($key) {
    return isset($_POST[$key]) ? trim($_POST[$key]) : '';
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $student_id = get_post('student_id');
    $record_number = get_post('record_number');
    $school_year = get_post('school_year');
    $date = get_post('date');
    $grade_section = get_post('grade_section');
    $contact_number = get_post('contact_number');
    $status = get_post('status');
    $assessment_provider = get_post('assessment_provider');
    $findings = get_post('findings');
    $recommendations = get_post('recommendations');

    if (empty($student_id) || empty($record_number) || empty($date)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO assessment_records (student_id, record_number, school_year, date, grade_section, contact_number, status, assessment_provider, findings, recommendations) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $student_id, $record_number, $school_year, $date, $grade_section, $contact_number, $status, $assessment_provider, $findings, $recommendations
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Assessment record successfully saved!']);
    } catch(PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['status' => 'error', 'message' => 'Record Number already exists.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Database error: Could not save assessment record.']);
        }
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
