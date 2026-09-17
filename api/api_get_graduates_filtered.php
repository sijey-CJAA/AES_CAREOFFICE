<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

$ALLOWED_GRADES = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
$GRADE_SECTIONS = json_decode(file_get_contents('../config/sections.json'), true);

// Guard: return a clear error if migration hasn't been applied yet
$check_col = $pdo->query("SHOW COLUMNS FROM `students` LIKE 'grade_level'")->fetch();
if ($check_col === false) {
    echo json_encode([
        'status'   => 'error',
        'message'  => 'Database migration not yet applied. Run migration_grade_section.sql first.',
        'data'     => [],
        'counts'   => ['All' => 0],
        'sections' => [],
    ]);
    exit;
}

// Fetch counts per grade (for tab labels)
$counts = ['All' => 0];
foreach ($ALLOWED_GRADES as $g) {
    $counts[$g] = 0;
}

$stmt_counts = $pdo->query("
    SELECT grade_level, COUNT(*) as cnt
    FROM students
    WHERE deleted_at IS NULL AND status = 'Graduated'
    GROUP BY grade_level
");
$total = 0;
while ($row = $stmt_counts->fetch(PDO::FETCH_ASSOC)) {
    $gl = $row['grade_level'];
    if (array_key_exists($gl, $counts)) {
        $counts[$gl] = (int)$row['cnt'];
    }
    $total += (int)$row['cnt'];
}
$counts['All'] = $total;

// Read filter params
$grade_level = isset($_GET['grade_level']) ? trim($_GET['grade_level']) : 'All';
$section     = isset($_GET['section'])     ? trim($_GET['section'])     : 'All';

// Build query
$where  = ["s.deleted_at IS NULL", "s.status = 'Graduated'"];
$params = [];

if ($grade_level !== 'All' && in_array($grade_level, $ALLOWED_GRADES)) {
    $where[]  = 's.grade_level = ?';
    $params[] = $grade_level;
}

if ($section !== 'All' && $section !== '') {
    $where[]  = 's.section = ?';
    $params[] = $section;
}

$sql = "SELECT s.*, 
               p1.full_name as primary_parent,
               p2.full_name as secondary_parent
        FROM students s
        LEFT JOIN parents p1 ON s.id = p1.student_id AND p1.parent_type = 'Primary' AND p1.deleted_at IS NULL
        LEFT JOIN parents p2 ON s.id = p2.student_id AND p2.parent_type = 'Secondary' AND p2.deleted_at IS NULL
        WHERE " . implode(' AND ', $where) . " 
        ORDER BY s.grade_level, s.section, s.full_name ASC";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch distinct sections for the chosen grade (used to populate the section dropdown)
    $sections = [];
    if ($grade_level !== 'All' && array_key_exists($grade_level, $GRADE_SECTIONS)) {
        $sections = $GRADE_SECTIONS[$grade_level];
    }

    echo json_encode([
        'status'   => 'success',
        'data'     => $students,
        'counts'   => $counts,
        'sections' => $sections,
    ]);
} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: Could not fetch learners.']);
}
?>
