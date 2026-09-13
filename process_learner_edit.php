<?php
require_once 'auth.php';
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = isset($_POST['edit_learner_id']) ? intval($_POST['edit_learner_id']) : 0;
    $learner_name = trim($_POST['edit_learner_name'] ?? '');
    $lrn = trim($_POST['edit_lrn'] ?? '');
    $grade_section = trim($_POST['edit_grade_section'] ?? '');
    $dob = trim($_POST['edit_dob'] ?? '');
    $blood_type = trim($_POST['edit_blood_type'] ?? '');
    $home_address = trim($_POST['edit_home_address'] ?? '');
    $allergies = trim($_POST['edit_allergies'] ?? '');
    $medications = trim($_POST['edit_medications'] ?? '');

    if (empty($id) || empty($learner_name) || empty($lrn) || empty($dob) || empty($home_address)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE students 
            SET full_name = ?, lrn = ?, grade_section = ?, date_of_birth = ?, 
                home_address = ?, blood_type = ?, allergies = ?, medications = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $learner_name, $lrn, $grade_section, $dob, 
            $home_address, $blood_type, $allergies, $medications, 
            $id
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Learner record successfully updated!']);

    } catch(PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: Could not update learner record.']);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
