<?php
// process_learner.php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

$ALLOWED_GRADES = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    // Helper function to safely get POST data
    function get_post($key) {
        return isset($_POST[$key]) ? trim($_POST[$key]) : null;
    }

    $learner_name = get_post('learner_name');
    $lrn          = get_post('lrn');
    $grade_level  = get_post('grade_level');
    $section      = get_post('section');
    $school_year  = get_post('school_year');
    $dob          = get_post('dob');
    $blood_type   = get_post('blood_type');
    $home_address = get_post('home_address');
    $allergies    = get_post('allergies');
    $medications  = get_post('medications');
    $status       = get_post('status') ?: 'Unknown / Not Indicated';

    // Basic validation
    if (empty($learner_name) || empty($lrn) || empty($dob) || empty($home_address)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required learner fields.']);
        exit;
    }

    // Validate grade_level
    if (empty($grade_level) || !in_array($grade_level, $ALLOWED_GRADES)) {
        echo json_encode(['status' => 'error', 'message' => 'Please select a valid Grade Level (Grade 1 – Grade 6).']);
        exit;
    }

    if (empty($section) || empty($school_year)) {
        echo json_encode(['status' => 'error', 'message' => 'Please enter the Section name and School Year.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $stmt_student = $pdo->prepare("
            INSERT INTO students (full_name, lrn, grade_level, section, school_year, date_of_birth, home_address, blood_type, allergies, medications, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt_student->execute([
            $learner_name, $lrn, $grade_level, $section, $school_year, $dob,
            $home_address, $blood_type, $allergies, $medications, $status
        ]);
        
        $student_id = $pdo->lastInsertId();

        // Primary Parent
        $p1_name = get_post('p1_name');
        if (!empty($p1_name)) {
            $stmt_p1 = $pdo->prepare("
                INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, emergency_contact_number, home_address)
                VALUES (?, 'Primary', ?, ?, ?, ?, ?)
            ");
            $stmt_p1->execute([
                $student_id, 
                $p1_name, 
                get_post('p1_rel'), 
                get_post('p1_mobile'), 
                get_post('p1_emergency') === 'Yes' ? get_post('p1_mobile') : '', 
                get_post('p1_address')
            ]);
        }

        // Secondary Parent
        $p2_name = get_post('p2_name');
        if (!empty($p2_name)) {
            $stmt_p2 = $pdo->prepare("
                INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, emergency_contact_number, home_address)
                VALUES (?, 'Secondary', ?, ?, ?, ?, ?)
            ");
            $stmt_p2->execute([
                $student_id, 
                $p2_name, 
                get_post('p2_rel'), 
                get_post('p2_mobile'), 
                get_post('p2_emergency') === 'Yes' ? get_post('p2_mobile') : '', 
                get_post('p2_address')
            ]);
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Learner and parent records successfully saved!']);

    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => 'Database error: Could not save records.']);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
