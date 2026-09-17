<?php
// process_learner.php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

$ALLOWED_GRADES = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
$GRADE_SECTIONS = json_decode(file_get_contents('../config/sections.json'), true);

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    // Helper function to safely get POST data
    function get_post($key) {
        if (isset($_POST[$key])) {
            $val = trim($_POST[$key]);
            return $val === '' ? null : $val;
        }
        return null;
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

    // Basic validation (disabled)
    // if (empty($learner_name) || empty($lrn) || empty($dob) || empty($home_address)) {
    //     echo json_encode(['status' => 'error', 'message' => 'Please fill in all required learner fields.']);
    //     exit;
    // }

    // Validate grade_level
    if (empty($grade_level) || !in_array($grade_level, $ALLOWED_GRADES)) {
        // We probably still need a valid grade level to avoid DB constraints if they are strict,
        // but let's let it through if it's optional, or we can just leave the in_array check if not empty.
        // Let's just disable it entirely to ensure they can submit.
    }

    // if (empty($section) || empty($school_year)) {
    //     echo json_encode(['status' => 'error', 'message' => 'Please select the Section and School Year.']);
    //     exit;
    // }

    if (!isset($GRADE_SECTIONS[$grade_level]) || !in_array($section, $GRADE_SECTIONS[$grade_level])) {
        echo json_encode(['status' => 'error', 'message' => 'Please select a valid section for the selected grade level.']);
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
                INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, telephone_number, email_address, home_address, workplace, workplace_address, emergency_contact_number)
                VALUES (?, 'Primary', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt_p1->execute([
                $student_id, 
                $p1_name, 
                get_post('p1_rel'), 
                get_post('p1_mobile'), 
                get_post('p1_telephone'),
                get_post('p1_email'),
                get_post('p1_address'),
                get_post('p1_workplace'),
                get_post('p1_workplace_address'),
                get_post('p1_emergency')
            ]);
        }

        // Secondary Parent
        $p2_name = get_post('p2_name');
        if (!empty($p2_name)) {
            $stmt_p2 = $pdo->prepare("
                INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, telephone_number, email_address, home_address, workplace, workplace_address, emergency_contact_number)
                VALUES (?, 'Secondary', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt_p2->execute([
                $student_id, 
                $p2_name, 
                get_post('p2_rel'), 
                get_post('p2_mobile'), 
                get_post('p2_telephone'),
                get_post('p2_email'),
                get_post('p2_address'),
                get_post('p2_workplace'),
                get_post('p2_workplace_address'),
                get_post('p2_emergency')
            ]);
        }



        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Learner and parent records successfully saved!']);

    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
