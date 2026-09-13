<?php
// process_parent.php
require_once 'auth.php';
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    function get_post($key) {
        return isset($_POST[$key]) ? trim($_POST[$key]) : null;
    }

    $student_id = get_post('student_id');
    $p1_name = get_post('p1_name');

    if (empty($student_id) || empty($p1_name)) {
        echo json_encode(['status' => 'error', 'message' => 'Please select a learner and provide at least the primary parent name.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // Insert Primary Parent
        $stmt_parent = $pdo->prepare("
            INSERT INTO parents (student_id, parent_type, full_name, relationship, home_address, mobile_number, telephone_number, email_address, workplace, workplace_address, emergency_contact_number) 
            VALUES (?, 'Primary', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt_parent->execute([
            $student_id,
            $p1_name,
            get_post('p1_relationship'),
            get_post('p1_address'),
            get_post('p1_mobile'),
            get_post('p1_telephone'),
            get_post('p1_email'),
            get_post('p1_workplace'),
            get_post('p1_workplace_address'),
            get_post('p1_emergency')
        ]);

        // Insert Secondary Parent (Optional)
        $p2_name = get_post('p2_name');
        if (!empty($p2_name)) {
            $stmt_parent2 = $pdo->prepare("
                INSERT INTO parents (student_id, parent_type, full_name, relationship, home_address, mobile_number, telephone_number, email_address, workplace, workplace_address, emergency_contact_number) 
                VALUES (?, 'Secondary', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt_parent2->execute([
                $student_id,
                $p2_name,
                get_post('p2_relationship'),
                get_post('p2_address'),
                get_post('p2_mobile'),
                get_post('p2_telephone'),
                get_post('p2_email'),
                get_post('p2_workplace'),
                get_post('p2_workplace_address'),
                get_post('p2_emergency')
            ]);
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => 'Parent/Guardian record successfully saved!']);

    } catch(PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo json_encode(['status' => 'error', 'message' => 'Database error: Could not save parent record.']);
    }

} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>
