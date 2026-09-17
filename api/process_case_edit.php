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

    $id = get_post('edit_case_id') ?? get_post('edit_id');
    $student_id = get_post('edit_student_id');
    $case_number = get_post('edit_case_number');
    $school_year = get_post('edit_school_year');
    $date = get_post('edit_date');
    $grade_section = get_post('edit_grade_section');
    $case_type = get_post('edit_case_type');
    if ($case_type === 'Other') {
        $case_type = get_post('edit_case_type_other');
    }
    $brief_description = get_post('edit_brief_description');
    $actions_taken = get_post('edit_actions_taken');
    $outcome_disposition = get_post('edit_outcome_disposition');
    if ($outcome_disposition === 'Other') {
        $outcome_disposition = get_post('edit_outcome_disposition_other');
    }

    if (empty($id)) {
        echo json_encode(['status' => 'error', 'message' => 'Missing Case ID.']);
        exit;
    }
    // if (empty($id) || empty($student_id) || empty($case_number) || empty($date)) {
    //     echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
    //     exit;
    // }

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
        if ($e->getCode() == 23000 && strpos($e->getMessage(), 'Duplicate entry') !== false) {
            echo json_encode(['status' => 'error', 'message' => 'Case Number already exists.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
        }
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
