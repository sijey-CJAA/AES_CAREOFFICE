<?php
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

    $id           = get_post('edit_id') ?? get_post('edit_learner_id');
    $learner_name = get_post('edit_learner_name');
    $lrn          = get_post('edit_lrn');
    $grade_level  = get_post('edit_grade_level');
    $section      = get_post('edit_section');
    $school_year  = get_post('edit_school_year');
    $dob          = get_post('edit_dob');
    $blood_type   = get_post('edit_blood_type');
    $home_address = get_post('edit_home_address');
    $allergies    = get_post('edit_allergies');
    $medications  = get_post('edit_medications');
    $status       = get_post('edit_status') ?: 'Unknown / Not Indicated';

    if (empty($id)) {
        echo json_encode(['status' => 'error', 'message' => 'Missing ID for edit.']);
        exit;
    }
    // if (empty($learner_name) || empty($lrn) || empty($dob) || empty($home_address)) {
    //     echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
    //     exit;
    // }

    // Validate grade_level
    if (empty($grade_level) || !in_array($grade_level, $ALLOWED_GRADES)) {
        // Validation disabled
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
            UPDATE students SET 
                full_name = ?, lrn = ?, grade_level = ?, section = ?, school_year = ?, 
                date_of_birth = ?, home_address = ?, blood_type = ?, allergies = ?, medications = ?, status = ?
            WHERE id = ?
        ");
        $stmt_student->execute([
            $learner_name, $lrn, $grade_level, $section, $school_year, $dob,
            $home_address, $blood_type, $allergies, $medications, $status, $id
        ]);
        
        // Primary Parent
        $p1_id = get_post('edit_p1_id');
        $p1_name = get_post('edit_p1_name');
        
        if (!empty($p1_id)) {
            $stmt_p1 = $pdo->prepare("
                UPDATE parents SET 
                    full_name = ?, relationship = ?, mobile_number = ?, telephone_number = ?, email_address = ?, 
                    home_address = ?, workplace = ?, workplace_address = ?, emergency_contact_number = ?
                WHERE id = ?
            ");
            $stmt_p1->execute([
                $p1_name, get_post('edit_p1_rel'), get_post('edit_p1_mobile'), get_post('edit_p1_telephone'),
                get_post('edit_p1_email'), get_post('edit_p1_address'), get_post('edit_p1_workplace'),
                get_post('edit_p1_workplace_address'), get_post('edit_p1_emergency'), $p1_id
            ]);
        } else if (!empty($p1_name)) {
             $stmt_p1_new = $pdo->prepare("
                INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, telephone_number, email_address, home_address, workplace, workplace_address, emergency_contact_number)
                VALUES (?, 'Primary', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt_p1_new->execute([
                $id, $p1_name, get_post('edit_p1_rel'), get_post('edit_p1_mobile'), get_post('edit_p1_telephone'),
                get_post('edit_p1_email'), get_post('edit_p1_address'), get_post('edit_p1_workplace'),
                get_post('edit_p1_workplace_address'), get_post('edit_p1_emergency')
            ]);
        }

        // Secondary Parent
        $p2_id = get_post('edit_p2_id');
        $p2_name = get_post('edit_p2_name');
        
        if (!empty($p2_id)) {
            $stmt_p2 = $pdo->prepare("
                UPDATE parents SET 
                    full_name = ?, relationship = ?, mobile_number = ?, telephone_number = ?, email_address = ?, 
                    home_address = ?, workplace = ?, workplace_address = ?, emergency_contact_number = ?
                WHERE id = ?
            ");
            $stmt_p2->execute([
                $p2_name, get_post('edit_p2_rel'), get_post('edit_p2_mobile'), get_post('edit_p2_telephone'),
                get_post('edit_p2_email'), get_post('edit_p2_address'), get_post('edit_p2_workplace'),
                get_post('edit_p2_workplace_address'), get_post('edit_p2_emergency'), $p2_id
            ]);
        } else if (!empty($p2_name)) {
             $stmt_p2_new = $pdo->prepare("
                INSERT INTO parents (student_id, parent_type, full_name, relationship, mobile_number, telephone_number, email_address, home_address, workplace, workplace_address, emergency_contact_number)
                VALUES (?, 'Secondary', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt_p2_new->execute([
                $id, $p2_name, get_post('edit_p2_rel'), get_post('edit_p2_mobile'), get_post('edit_p2_telephone'),
                get_post('edit_p2_email'), get_post('edit_p2_address'), get_post('edit_p2_workplace'),
                get_post('edit_p2_workplace_address'), get_post('edit_p2_emergency')
            ]);
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Learner records successfully updated!']);

    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
