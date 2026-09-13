<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = isset($_POST['edit_assessment_id']) ? intval($_POST['edit_assessment_id']) : 0;
    $student_id = trim($_POST['edit_student_id'] ?? '');
    $record_number = trim($_POST['edit_record_number'] ?? '');
    $school_year = trim($_POST['edit_school_year'] ?? '');
    $date = trim($_POST['edit_date'] ?? '');
    $grade_section = trim($_POST['edit_grade_section'] ?? '');
    $contact_number = trim($_POST['edit_contact_number'] ?? '');
    $status = trim($_POST['edit_status'] ?? '');
    $assessment_provider = trim($_POST['edit_assessment_provider'] ?? '');
    $findings = trim($_POST['edit_findings'] ?? '');
    $recommendations = trim($_POST['edit_recommendations'] ?? '');

    if (empty($id) || empty($student_id) || empty($record_number) || empty($date)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE assessment_records 
            SET student_id = ?, record_number = ?, school_year = ?, date = ?, 
                grade_section = ?, contact_number = ?, status = ?, assessment_provider = ?, 
                findings = ?, recommendations = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $student_id, $record_number, $school_year, $date, 
            $grade_section, $contact_number, $status, $assessment_provider, 
            $findings, $recommendations, 
            $id
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Assessment record successfully updated!']);
    } catch(PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['status' => 'error', 'message' => 'Record Number already exists.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Database error: Could not update assessment record.']);
        }
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
