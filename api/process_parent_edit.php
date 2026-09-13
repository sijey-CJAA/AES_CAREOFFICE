<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = isset($_POST['edit_parent_id']) ? intval($_POST['edit_parent_id']) : 0;
    $student_id = isset($_POST['edit_student_id']) ? intval($_POST['edit_student_id']) : 0;
    $parent_type = trim($_POST['edit_parent_type'] ?? 'Primary');
    $name = trim($_POST['edit_p_name'] ?? '');
    $relationship = trim($_POST['edit_p_relationship'] ?? '');
    $mobile = trim($_POST['edit_p_mobile'] ?? '');
    $address = trim($_POST['edit_p_address'] ?? '');
    $telephone = trim($_POST['edit_p_telephone'] ?? '');
    $email = trim($_POST['edit_p_email'] ?? '');
    $workplace = trim($_POST['edit_p_workplace'] ?? '');
    $workplace_address = trim($_POST['edit_p_workplace_address'] ?? '');
    $emergency = trim($_POST['edit_p_emergency'] ?? '');

    if (empty($id) || empty($student_id) || empty($name)) {
        echo json_encode(['status' => 'error', 'message' => 'Please provide the learner, parent name, and required fields.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE parents 
            SET student_id = ?, parent_type = ?, full_name = ?, relationship = ?, 
                mobile_number = ?, home_address = ?, telephone_number = ?, 
                email_address = ?, workplace = ?, workplace_address = ?, emergency_contact_number = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $student_id, $parent_type, $name, $relationship, 
            $mobile, $address, $telephone, 
            $email, $workplace, $workplace_address, $emergency,
            $id
        ]);

        echo json_encode(['status' => 'success', 'message' => 'Parent/Guardian record successfully updated!']);

    } catch(PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: Could not update parent record.']);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
