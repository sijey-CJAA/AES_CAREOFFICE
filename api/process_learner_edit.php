<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

$ALLOWED_GRADES = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id           = isset($_POST['edit_learner_id']) ? intval($_POST['edit_learner_id']) : 0;
    $learner_name = trim($_POST['edit_learner_name'] ?? '');
    $lrn          = trim($_POST['edit_lrn']          ?? '');
    $grade_level  = trim($_POST['edit_grade_level']  ?? '');
    $section      = trim($_POST['edit_section']      ?? '');
    $dob          = trim($_POST['edit_dob']          ?? '');
    $blood_type   = trim($_POST['edit_blood_type']   ?? '');
    $home_address = trim($_POST['edit_home_address'] ?? '');
    $allergies    = trim($_POST['edit_allergies']    ?? '');
    $medications  = trim($_POST['edit_medications']  ?? '');
    $status       = trim($_POST['edit_status']       ?? 'Unknown / Not Indicated');

    if (empty($id) || empty($learner_name) || empty($lrn) || empty($dob) || empty($home_address)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }

    // Validate grade_level
    if (empty($grade_level) || !in_array($grade_level, $ALLOWED_GRADES)) {
        echo json_encode(['status' => 'error', 'message' => 'Please select a valid Grade Level (Grade 1 – Grade 6).']);
        exit;
    }

    if (empty($section)) {
        echo json_encode(['status' => 'error', 'message' => 'Please enter the Section name.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            UPDATE students
            SET full_name = ?, lrn = ?, grade_level = ?, section = ?, date_of_birth = ?,
                home_address = ?, blood_type = ?, allergies = ?, medications = ?, status = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $learner_name, $lrn, $grade_level, $section, $dob,
            $home_address, $blood_type, $allergies, $medications, $status,
            $id
        ]);

        // Helper to get POST data
        function get_post($key) { return isset($_POST[$key]) ? trim($_POST[$key]) : null; }

        // Update Primary Parent
        $p1_id = get_post('edit_p1_id');
        $p1_name = get_post('edit_p1_name');
        if (!empty($p1_id)) {
            if (empty($p1_name)) {
                // if name was cleared, maybe they want to remove it? Or just leave it for now.
                // We'll update normally.
            }
            $stmt_p1 = $pdo->prepare("UPDATE parents SET full_name=?, relationship=?, mobile_number=?, emergency_contact_number=?, home_address=? WHERE id=? AND student_id=?");
            $stmt_p1->execute([
                $p1_name, get_post('edit_p1_rel'), get_post('edit_p1_mobile'),
                get_post('edit_p1_emergency') === 'Yes' ? get_post('edit_p1_mobile') : '',
                get_post('edit_p1_address'), $p1_id, $id
            ]);
        } else if (!empty($p1_name)) {
            // Did not exist before, insert new
            $stmt_p1_in = $pdo->prepare("INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, emergency_contact_number, home_address) VALUES (?, 'Primary', ?, ?, ?, ?, ?)");
            $stmt_p1_in->execute([
                $id, $p1_name, get_post('edit_p1_rel'), get_post('edit_p1_mobile'),
                get_post('edit_p1_emergency') === 'Yes' ? get_post('edit_p1_mobile') : '', get_post('edit_p1_address')
            ]);
        }

        // Update Secondary Parent
        $p2_id = get_post('edit_p2_id');
        $p2_name = get_post('edit_p2_name');
        if (!empty($p2_id)) {
            $stmt_p2 = $pdo->prepare("UPDATE parents SET full_name=?, relationship=?, mobile_number=?, emergency_contact_number=?, home_address=? WHERE id=? AND student_id=?");
            $stmt_p2->execute([
                $p2_name, get_post('edit_p2_rel'), get_post('edit_p2_mobile'),
                get_post('edit_p2_emergency') === 'Yes' ? get_post('edit_p2_mobile') : '',
                get_post('edit_p2_address'), $p2_id, $id
            ]);
        } else if (!empty($p2_name)) {
            $stmt_p2_in = $pdo->prepare("INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, emergency_contact_number, home_address) VALUES (?, 'Secondary', ?, ?, ?, ?, ?)");
            $stmt_p2_in->execute([
                $id, $p2_name, get_post('edit_p2_rel'), get_post('edit_p2_mobile'),
                get_post('edit_p2_emergency') === 'Yes' ? get_post('edit_p2_mobile') : '', get_post('edit_p2_address')
            ]);
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Learner and parent records successfully updated!']);

    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => 'Database error: Could not update records.']);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
