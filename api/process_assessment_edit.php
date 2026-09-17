<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    function get_post($key) {
        if (isset($_POST[$key])) {
            $val = trim($_POST[$key]);
            return $val === '' ? null : $val;
        }
        return null;
    }

    $id = get_post('edit_assessment_id') ?? get_post('edit_id');
    $student_id = get_post('edit_student_id');
    $record_number = get_post('edit_record_number');
    $school_year = get_post('edit_school_year');
    $date = get_post('edit_date');
    $grade_section = get_post('edit_grade_section');
    $contact_number = get_post('edit_contact_number');
    $status = get_post('edit_status');
    $assessment_provider = get_post('edit_assessment_provider');
    $findings = get_post('edit_findings');
    $diagnosis = get_post('edit_diagnosis');
    $recommendations = get_post('edit_recommendations');

    if (empty($id)) {
        echo json_encode(['status' => 'error', 'message' => 'Missing Assessment ID.']);
        exit;
    }
    // if (empty($id) || empty($student_id) || empty($record_number) || empty($date)) {
    //     echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
    //     exit;
    // }

    try {
        $stmt = $pdo->prepare("
            UPDATE assessment_records 
            SET student_id = ?, record_number = ?, school_year = ?, date = ?, 
                grade_section = ?, contact_number = ?, status = ?, assessment_provider = ?, 
                findings = ?, diagnosis = ?, recommendations = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $student_id, $record_number, $school_year, $date, 
            $grade_section, $contact_number, $status, $assessment_provider, 
            $findings, $diagnosis, $recommendations, 
            $id
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Assessment record successfully updated!']);
    } catch(PDOException $e) {
        if ($e->getCode() == 23000 && strpos($e->getMessage(), 'Duplicate entry') !== false) {
            echo json_encode(['status' => 'error', 'message' => 'Record Number already exists.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
        }
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
