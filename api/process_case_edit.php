<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = isset($_POST['edit_case_id']) ? intval($_POST['edit_case_id']) : 0;
    $student_id = trim($_POST['edit_student_id'] ?? '');
    $case_number = trim($_POST['edit_case_number'] ?? '');
    $school_year = trim($_POST['edit_school_year'] ?? '');
    $date = trim($_POST['edit_date'] ?? '');
    $grade_section = trim($_POST['edit_grade_section'] ?? '');
    $case_type = trim($_POST['edit_case_type'] ?? '');
    $brief_description = trim($_POST['edit_brief_description'] ?? '');
    $actions_taken = trim($_POST['edit_actions_taken'] ?? '');
    $outcome_disposition = trim($_POST['edit_outcome_disposition'] ?? '');

    if (empty($id) || empty($student_id) || empty($case_number) || empty($date)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE case_register 
            SET student_id = ?, case_number = ?, school_year = ?, date = ?, 
                grade_section = ?, case_type = ?, brief_description = ?, actions_taken = ?, 
                outcome_disposition = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $student_id, $case_number, $school_year, $date, 
            $grade_section, $case_type, $brief_description, $actions_taken, 
            $outcome_disposition, 
            $id
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Case record successfully updated!']);
    } catch(PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['status' => 'error', 'message' => 'Case Number already exists.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Database error: Could not update case record.']);
        }
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
