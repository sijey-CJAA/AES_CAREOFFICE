<?php
require_once '../config/auth.php';
require_once '../config/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
    exit;
}

$sy_config_path = '../config/school_year.json';
if (!file_exists($sy_config_path)) {
    echo json_encode(['status' => 'error', 'message' => 'School year configuration missing.']);
    exit;
}

$sy_config = json_decode(file_get_contents($sy_config_path), true);
$current_sy = $sy_config['current_school_year'] ?? '';
$next_sy = $sy_config['next_school_year'] ?? '';

if (empty($next_sy)) {
    echo json_encode(['status' => 'error', 'message' => 'Next school year is not configured.']);
    exit;
}

function getNextGrade($grade) {
    switch ($grade) {
        case 'Kindergarten': return 'Grade 1';
        case 'Grade 1': return 'Grade 2';
        case 'Grade 2': return 'Grade 3';
        case 'Grade 3': return 'Grade 4';
        case 'Grade 4': return 'Grade 5';
        case 'Grade 5': return 'Grade 6';
        case 'Grade 6': return 'Graduated';
        default: return $grade; // Unknown or other formats remain unchanged
    }
}

try {
    $pdo->beginTransaction();

    // Fetch all currently enrolled students
    $stmt = $pdo->prepare("SELECT id, grade_level FROM students WHERE deleted_at IS NULL AND status = 'Currently Enrolled'");
    $stmt->execute();
    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt_promote = $pdo->prepare("
        UPDATE students 
        SET grade_level = :grade_level,
            section = '',
            school_year = :school_year,
            grade_section = :grade_section
        WHERE id = :id
    ");
    
    $stmt_graduate = $pdo->prepare("
        UPDATE students 
        SET status = 'Graduated'
        WHERE id = :id
    ");

    foreach ($students as $s) {
        $next = getNextGrade($s['grade_level']);
        if ($next === 'Graduated') {
            $stmt_graduate->execute(['id' => $s['id']]);
        } else {
            // Promoted
            $stmt_promote->execute([
                'grade_level' => $next,
                'school_year' => $next_sy,
                'grade_section' => $next, // Section is cleared
                'id' => $s['id']
            ]);
        }
    }

    // Update the config to the new school year
    $parts = explode('-', $next_sy);
    $new_next_sy = ($parts[0]+1) . '-' . ($parts[1]+1);
    
    $sy_config['current_school_year'] = $next_sy;
    $sy_config['next_school_year'] = $new_next_sy;
    
    // Automatically shift the graduation date and new sy start date forward by 1 year
    if (isset($sy_config['graduation_date'])) {
        $grad_time = strtotime($sy_config['graduation_date']);
        $sy_config['graduation_date'] = date('Y-m-d', strtotime('+1 year', $grad_time));
    }
    if (isset($sy_config['new_school_year_start'])) {
        $start_time = strtotime($sy_config['new_school_year_start']);
        $sy_config['new_school_year_start'] = date('Y-m-d', strtotime('+1 year', $start_time));
    }

    file_put_contents($sy_config_path, json_encode($sy_config, JSON_PRETTY_PRINT));

    $pdo->commit();
    echo json_encode(['status' => 'success', 'message' => count($students) . ' students have been automatically promoted/graduated to SY ' . $next_sy . '! Sections have been reset for the new school year.']);
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => 'Error processing auto-promotion: ' . $e->getMessage()]);
}
