<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

function get_post($key) {
    return isset($_POST[$key]) ? trim($_POST[$key]) : '';
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $student_id = get_post('student_id');
    $case_number = get_post('case_number');
    $school_year = get_post('school_year');
    $date = get_post('date');
    $grade_section = get_post('grade_section');
    $case_type = get_post('case_type');
    $brief_description = get_post('brief_description');
    $actions_taken = get_post('actions_taken');
    $outcome_disposition = get_post('outcome_disposition');

    if (empty($student_id) || empty($case_number) || empty($date)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO case_register (student_id, case_number, school_year, date, grade_section, case_type, brief_description, actions_taken, outcome_disposition) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $student_id, $case_number, $school_year, $date, $grade_section, $case_type, $brief_description, $actions_taken, $outcome_disposition
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Case record successfully saved!']);
    } catch(PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['status' => 'error', 'message' => 'Case Number already exists.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Database error: Could not save case record.']);
        }
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
