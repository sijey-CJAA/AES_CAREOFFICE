<?php
require_once '../config/db.php';
require_once '../config/auth.php';

// Fetch the logged-in admin's details
$stmt = $pdo->prepare("SELECT email FROM admins WHERE id = :id");
$stmt->execute(['id' => $_SESSION['admin_id']]);
$admin = $stmt->fetch();

$user_email = $admin['email'] ?? 'admin@example.com';
$email_parts = explode('@', $user_email);
$name_parts = explode('.', $email_parts[0]);
$user_name = ucfirst($name_parts[0]);


$session_id = $_GET['session_id'] ?? null;
if (!$session_id) {
    header("Location: cars_sessions.php");
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM cars_assessment_sessions WHERE id = ?");
$stmt->execute([$session_id]);
$session = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$session) {
    echo "Session not found.";
    exit;
}

// Fetch students for this grade/section
$stmtStu = $pdo->prepare("SELECT * FROM students WHERE grade_level = ? AND section_name = ? ORDER BY gender DESC, full_name ASC");
$stmtStu->execute([$session['grade_level'], $session['section_name']]);
$students = $stmtStu->fetchAll(PDO::FETCH_ASSOC);

// Fetch existing evaluations
$stmtEval = $pdo->prepare("SELECT * FROM cars_student_evaluations WHERE session_id = ?");
$stmtEval->execute([$session_id]);
$evalRows = $stmtEval->fetchAll(PDO::FETCH_ASSOC);
$evalMap = [];
foreach ($evalRows as $e) {
    $evalMap[$e['student_id']] = $e;
}

$page_title = 'CARS Assessment - ' . htmlspecialchars($session['grade_level'] . ' - ' . $session['section_name']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $page_title ?> | AES Care Office</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
</head>
<body>

    <?php include '../includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <?php include '../includes/topbar.php'; ?>

<style>
    .cars-matrix { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .cars-matrix th, .cars-matrix td { border: 1px solid var(--border-color); padding: 0.25rem; text-align: center; }
    .cars-matrix th { background: #f8fafc; font-weight: 600; white-space: nowrap; }
    .cars-matrix td.name-col { text-align: left; position: sticky; left: 0; background: #fff; z-index: 10; border-right: 2px solid var(--border-color); white-space: nowrap; }
    .cars-matrix input[type="number"] { width: 40px; text-align: center; border: 1px solid #cbd5e1; border-radius: 3px; padding: 0.2rem; }
    .cars-matrix input[type="number"]:focus { outline: 2px solid var(--primary); }
    .status-badge { padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .status-badge.tier-1 { background: #dcfce7; color: #166534; }
    .status-badge.tier-2 { background: #fef08a; color: #854d0e; }
    .status-badge.tier-3 { background: #fee2e2; color: #991b1b; }
    .status-badge.pending { background: #f1f5f9; color: #475569; }
</style>

<div class="main-content">
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <div>
            <h1 class="page-title">CARS Entry: <?= htmlspecialchars($session['grade_level'] . ' - ' . $session['section_name']) ?></h1>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Academic Year: <?= htmlspecialchars($session['academic_year']) ?></p>
        </div>
        <div style="display: flex; gap: 1rem;">
            <a href="cars_sessions.php" class="btn-secondary">Back</a>
            <button class="btn-primary" onclick="saveEvaluations()" id="saveBtn">Save Evaluations</button>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
        <div class="card" style="padding: 1rem; text-align: center;">
            <div style="font-size: 2rem; font-weight: 700; color: var(--text-dark);" id="stat-total">0</div>
            <div style="color: var(--text-muted); font-size: 0.875rem;">Total Students</div>
        </div>
        <div class="card" style="padding: 1rem; text-align: center; border-bottom: 4px solid #166534;">
            <div style="font-size: 2rem; font-weight: 700; color: #166534;" id="stat-t1">0%</div>
            <div style="color: var(--text-muted); font-size: 0.875rem;">Tier 1 (No Risk)</div>
        </div>
        <div class="card" style="padding: 1rem; text-align: center; border-bottom: 4px solid #854d0e;">
            <div style="font-size: 2rem; font-weight: 700; color: #854d0e;" id="stat-t2">0%</div>
            <div style="color: var(--text-muted); font-size: 0.875rem;">Tier 2 (At Risk)</div>
        </div>
        <div class="card" style="padding: 1rem; text-align: center; border-bottom: 4px solid #991b1b;">
            <div style="font-size: 2rem; font-weight: 700; color: #991b1b;" id="stat-t3">0%</div>
            <div style="color: var(--text-muted); font-size: 0.875rem;">Tier 3 (High Risk)</div>
        </div>
    </div>

    <div class="card">
        <div class="card-body" style="overflow-x: auto; max-height: 600px; overflow-y: auto; padding: 0;">
            <table class="cars-matrix" id="carsMatrix">
                <thead style="position: sticky; top: 0; z-index: 20;">
                    <tr>
                        <th class="name-col" style="min-width: 200px;">Student Name</th>
                        <?php for($i=1; $i<=24; $i++): ?>
                            <th title="Question <?= $i ?>">Q<?= $i ?></th>
                        <?php endfor; ?>
                        <th>Total</th>
                        <th>T-Score</th>
                        <th>Status / Tier</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if(empty($students)): ?>
                        <tr><td colspan="28" style="padding:2rem;">No students found for this grade and section.</td></tr>
                    <?php endif; ?>
                    <?php foreach($students as $s): 
                        $eval = $evalMap[$s['id']] ?? null;
                    ?>
                    <tr data-student-id="<?= $s['id'] ?>">
                        <td class="name-col"><?= htmlspecialchars($s['full_name']) ?> <small style="color:#64748b;display:block;">(<?= htmlspecialchars($s['gender']) ?>)</small></td>
                        <?php for($i=1; $i<=24; $i++): 
                            $qVal = $eval ? $eval["q{$i}"] : '';
                        ?>
                            <td><input type="number" min="0" max="4" class="q-input" data-q="<?= $i ?>" value="<?= $qVal !== null ? htmlspecialchars($qVal) : '' ?>" onchange="updatePreview(this)"></td>
                        <?php endfor; ?>
                        <td class="total-raw" style="font-weight:bold; background:#f8fafc;"><?= $eval ? $eval['total_raw_score'] : '-' ?></td>
                        <td class="t-score" style="font-weight:bold; background:#f8fafc;"><?= $eval ? $eval['t_score'] : '-' ?></td>
                        <td class="tier-badge" style="background:#f8fafc;">
                            <?php 
                                $tier = $eval ? $eval['tier_level'] : 'Pending';
                                $badgeClass = 'pending';
                                if($tier == 'Tier 1') $badgeClass = 'tier-1';
                                if($tier == 'Tier 2') $badgeClass = 'tier-2';
                                if($tier == 'Tier 3') $badgeClass = 'tier-3';
                            ?>
                            <span class="status-badge <?= $badgeClass ?>"><?= $tier ?></span>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
function updatePreview(input) {
    // Basic client-side total preview. Actual T-Score requires server lookup.
    let row = input.closest('tr');
    let inputs = row.querySelectorAll('.q-input');
    let sum = 0;
    let complete = true;
    inputs.forEach(inp => {
        let val = inp.value;
        if(val === '') complete = false;
        else sum += parseInt(val);
    });
    
    let totalTd = row.querySelector('.total-raw');
    if(complete) {
        totalTd.textContent = sum;
    } else {
        totalTd.textContent = sum + '*'; // * means partial
    }
}

function updateStats() {
    let rows = document.querySelectorAll('#carsMatrix tbody tr[data-student-id]');
    let total = rows.length;
    let t1 = 0, t2 = 0, t3 = 0, computed = 0;
    
    rows.forEach(row => {
        let tier = row.querySelector('.status-badge').textContent.trim();
        if(tier === 'Tier 1') { t1++; computed++; }
        if(tier === 'Tier 2') { t2++; computed++; }
        if(tier === 'Tier 3') { t3++; computed++; }
    });
    
    document.getElementById('stat-total').textContent = computed + '/' + total;
    if(computed > 0) {
        document.getElementById('stat-t1').textContent = Math.round((t1/computed)*100) + '%';
        document.getElementById('stat-t2').textContent = Math.round((t2/computed)*100) + '%';
        document.getElementById('stat-t3').textContent = Math.round((t3/computed)*100) + '%';
    }
}
updateStats();

function saveEvaluations() {
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    let rows = document.querySelectorAll('#carsMatrix tbody tr[data-student-id]');
    let evaluations = [];
    
    rows.forEach(row => {
        let student_id = row.getAttribute('data-student-id');
        let responses = {};
        let inputs = row.querySelectorAll('.q-input');
        inputs.forEach(inp => {
            let qNum = inp.getAttribute('data-q');
            responses['q'+qNum] = inp.value === '' ? null : parseInt(inp.value);
        });
        evaluations.push({ student_id: student_id, responses: responses });
    });
    
    fetch('<?= BASE_URL ?>/api/cars/evaluations_batch.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            session_id: <?= $session_id ?>,
            evaluations: evaluations
        })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            alert('Evaluations saved successfully!');
            window.location.reload(); // Reload to get actual T-Scores and Tiers from server
        } else {
            alert('Error: ' + data.message);
            btn.disabled = false;
            btn.textContent = 'Save Evaluations';
        }
    })
    .catch(err => {
        console.error(err);
        alert('A network error occurred.');
        btn.disabled = false;
        btn.textContent = 'Save Evaluations';
    });
}
</script>

    </div>
</body>
</html>
