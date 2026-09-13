<?php
// process_learner.php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    // Helper function to safely get POST data
    function get_post($key) {
        return isset($_POST[$key]) ? trim($_POST[$key]) : null;
    }

    $learner_name = get_post('learner_name');
    $lrn = get_post('lrn');
    $grade_section = get_post('grade_section');
    $dob = get_post('dob');
    $blood_type = get_post('blood_type');
    $home_address = get_post('home_address');
    $allergies = get_post('allergies');
    $medications = get_post('medications');
    $status = get_post('status') ?: 'Unknown / Not Indicated';

    // Basic Validation
    if (empty($learner_name) || empty($lrn) || empty($dob) || empty($home_address)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required learner fields.']);
        exit;
    }

    try {
        $stmt_student = $pdo->prepare("
            INSERT INTO students (full_name, lrn, grade_section, date_of_birth, home_address, blood_type, allergies, medications, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt_student->execute([
            $learner_name, $lrn, $grade_section, $dob, $home_address, $blood_type, $allergies, $medications, $status
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Learner record successfully saved!']);

    } catch(PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: Could not save learner record.']);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
