<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if (isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    $learner = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($learner) {
        $stmt_p = $pdo->prepare("SELECT * FROM parents WHERE student_id = ? AND deleted_at IS NULL");
        $stmt_p->execute([$learner['id']]);
        $parents = $stmt_p->fetchAll(PDO::FETCH_ASSOC);

        $learner['parents'] = $parents;

        $stmt_a = $pdo->prepare("SELECT * FROM assessment_records WHERE student_id = ? AND deleted_at IS NULL ORDER BY date DESC");
        $stmt_a->execute([$learner['id']]);
        $learner['assessments'] = $stmt_a->fetchAll(PDO::FETCH_ASSOC);

        $stmt_c = $pdo->prepare("SELECT c.* FROM case_register c JOIN case_students cs ON c.id = cs.case_id WHERE cs.student_id = ? AND c.deleted_at IS NULL ORDER BY c.date DESC");
        $stmt_c->execute([$learner['id']]);
        $learner['cases'] = $stmt_c->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['status' => 'success', 'data' => $learner]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Learner not found']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'No ID provided']);
}
?>
