<?php
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

function get_post($key) {
    if (isset($_POST[$key])) {
        $val = trim($_POST[$key]);
        return $val === '' ? null : $val;
    }
    return null;
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
    $diagnosis = get_post('diagnosis');
    $recommendations = get_post('recommendations');

    if (empty($student_id)) {
        echo json_encode(['status' => 'error', 'message' => 'Missing student ID.']);
        exit;
    }
    // if (empty($student_id) || empty($record_number) || empty($date)) {
    //     echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
    //     exit;
    // }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO assessment_records (student_id, record_number, school_year, date, grade_section, contact_number, status, assessment_provider, findings, diagnosis, recommendations) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $student_id, $record_number, $school_year, $date, $grade_section, $contact_number, $status, $assessment_provider, $findings, $diagnosis, $recommendations
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Assessment record successfully saved!']);
    } catch(PDOException $e) {
        aes_log_error("Failed to insert assessment record: " . $e->getMessage(), [
            'student_id'    => $student_id,
            'record_number' => $record_number,
            'date'          => $date
        ]);

        if ($e->getCode() == 23000 && strpos($e->getMessage(), 'Duplicate entry') !== false) {
            echo json_encode(['status' => 'error', 'message' => 'Record Number already exists. Please choose a different record number.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Unable to save assessment record. Please verify the entered information and try again.']);
        }
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
