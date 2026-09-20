<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

function get_post($key) {
    if (isset($_POST[$key])) {
        if (is_array($_POST[$key])) return $_POST[$key];
        $val = trim($_POST[$key]);
        return $val === '' ? null : $val;
    }
    return null;
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Check for array of student IDs
    $student_ids = get_post('student_ids');
    if (!$student_ids || !is_array($student_ids) || count($student_ids) === 0) {
        // Fallback for older single student flow if ever needed, but we expect array now
        $single_student = get_post('student_id');
        if ($single_student) {
            $student_ids = [$single_student];
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Missing student IDs.']);
            exit;
        }
    }

    $case_number = get_post('case_number');
    $school_year = get_post('school_year');
    $date = get_post('date');
    
    // We no longer track a single grade_section per case, but we can leave it empty or comma separate if needed.
    // For now, let's keep it null in DB or from form
    $grade_section = get_post('grade_section'); 
    
    $case_type = get_post('case_type');
    if ($case_type === 'Other') {
        $case_type = get_post('case_type_other');
    }
    $brief_description = get_post('brief_description');
    $actions_taken = get_post('actions_taken');
    $outcome_disposition = get_post('outcome_disposition');
    if ($outcome_disposition === 'Other') {
        $outcome_disposition = get_post('outcome_disposition_other');
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            INSERT INTO case_register (case_number, school_year, date, grade_section, case_type, brief_description, actions_taken, outcome_disposition) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $case_number, $school_year, $date, $grade_section, $case_type, $brief_description, $actions_taken, $outcome_disposition
        ]);
        
        $case_id = $pdo->lastInsertId();

        // Insert multiple students
        $stmt_students = $pdo->prepare("INSERT INTO case_students (case_id, student_id) VALUES (?, ?)");
        foreach ($student_ids as $sid) {
            if (!empty($sid)) {
                $stmt_students->execute([$case_id, $sid]);
            }
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Case record successfully saved!']);
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
