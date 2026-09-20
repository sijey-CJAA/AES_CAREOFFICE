<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    function get_post($key) {
        if (isset($_POST[$key])) {
            if (is_array($_POST[$key])) return $_POST[$key];
            $val = trim($_POST[$key]);
            return $val === '' ? null : $val;
        }
        return null;
    }

    $id = get_post('edit_case_id') ?? get_post('edit_id');
    
    $student_ids = get_post('edit_student_ids');
    if (!$student_ids || !is_array($student_ids) || count($student_ids) === 0) {
        $single_student = get_post('edit_student_id');
        if ($single_student) {
            $student_ids = [$single_student];
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Missing student IDs.']);
            exit;
        }
    }

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

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE case_register 
            SET case_number = ?, school_year = ?, date = ?, 
                grade_section = ?, case_type = ?, brief_description = ?, actions_taken = ?, 
                outcome_disposition = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $case_number, $school_year, $date, 
            $grade_section, $case_type, $brief_description, $actions_taken, 
            $outcome_disposition, 
            $id
        ]);

        // Update case_students
        $pdo->prepare("DELETE FROM case_students WHERE case_id = ?")->execute([$id]);
        
        $stmt_students = $pdo->prepare("INSERT INTO case_students (case_id, student_id) VALUES (?, ?)");
        foreach ($student_ids as $sid) {
            if (!empty($sid)) {
                $stmt_students->execute([$id, $sid]);
            }
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Case record successfully updated!']);
    } catch(PDOException $e) {
        $pdo->rollBack();
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
