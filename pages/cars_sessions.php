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


// Fetch sessions
$stmt = $pdo->query("SELECT s.*, 
    (SELECT COUNT(*) FROM cars_student_evaluations e WHERE e.session_id = s.id) as total_students,
    (SELECT COUNT(*) FROM cars_student_evaluations e WHERE e.session_id = s.id AND e.risk_status != 'INCOMPLETE') as completed_evaluations
    FROM cars_assessment_sessions s 
    ORDER BY s.created_at DESC");
$sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'CARS Assessment Sessions';
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

<div class="main-content">
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
            <h1 class="page-title">CARS Assessment Sessions</h1>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Manage and track Children and Adolescents Risk Screener assessments.</p>
        </div>
        <button class="btn-primary" onclick="openCreateSessionModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Create New Session
        </button>
    </div>

    <div class="card">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table" id="sessionsTable">
                    <thead>
                        <tr>
                            <th>Academic Year</th>
                            <th>Grade Level</th>
                            <th>Section Name</th>
                            <th>Date Assessed</th>
                            <th>Progress</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if(empty($sessions)): ?>
                            <tr>
                                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No assessment sessions found. Create one to get started.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach($sessions as $s): 
                                $percent = $s['total_students'] > 0 ? round(($s['completed_evaluations'] / $s['total_students']) * 100) : 0;
                            ?>
                            <tr>
                                <td><?= htmlspecialchars($s['academic_year']) ?></td>
                                <td><?= htmlspecialchars($s['grade_level']) ?></td>
                                <td><?= htmlspecialchars($s['section_name']) ?></td>
                                <td><?= htmlspecialchars($s['assessed_at'] ? date('M d, Y', strtotime($s['assessed_at'])) : 'N/A') ?></td>
                                <td>
                                    <div style="display:flex; align-items:center; gap:0.5rem;">
                                        <div style="width:100px; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                                            <div style="width:<?= $percent ?>%; height:100%; background:<?= $percent == 100 ? 'var(--success)' : 'var(--primary)' ?>;"></div>
                                        </div>
                                        <small><?= $s['completed_evaluations'] ?>/<?= $s['total_students'] ?></small>
                                    </div>
                                </td>
                                <td>
                                    <a href="cars_assessment.php?session_id=<?= $s['id'] ?>" class="btn-secondary" style="text-decoration:none; padding:0.25rem 0.75rem; font-size:0.875rem;">Evaluate</a>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- Create Session Modal -->
<div class="modal-overlay" id="createSessionModal">
    <div class="modal-content">
        <div class="modal-header">
                <h3 class="modal-title">Create CARS Session</h3>
                <button class="modal-close" onclick="closeCreateSessionModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="createSessionForm">
                    <div class="form-group">
                        <label for="academic_year">Academic Year</label>
                        <select id="academic_year" name="academic_year" class="form-control" required>
                            <option value="2023-2024">2023-2024</option>
                            <option value="2024-2025" selected>2024-2025</option>
                            <option value="2025-2026">2025-2026</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="grade_level">Grade Level</label>
                        <select id="grade_level" name="grade_level" class="form-control" required>
                            <option value="">-- Select Grade --</option>
                            <option value="Grade 4">Grade 4</option>
                            <option value="Grade 5">Grade 5</option>
                            <option value="Grade 6">Grade 6</option>
                            <option value="Grade 7">Grade 7</option>
                            <option value="Grade 8">Grade 8</option>
                            <!-- Add more if needed -->
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="section_name">Section Name</label>
                        <input type="text" id="section_name" name="section_name" class="form-control" required>
                    </div>
                    
                    <div id="createSessionResponse" style="margin-top:1rem; display:none;"></div>
                    
                    <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                        <button type="button" class="btn-secondary" onclick="closeCreateSessionModal()">Cancel</button>
                        <button type="submit" class="btn-primary" id="createSessionBtn">Create</button>
                    </div>
                </form>
            </div>
        </div>
</div>

<script>
function openCreateSessionModal() {
    document.getElementById('createSessionForm').reset();
    document.getElementById('createSessionResponse').style.display = 'none';
    document.getElementById('createSessionModal').classList.add('active');
}

function closeCreateSessionModal() {
    document.getElementById('createSessionModal').classList.remove('active');
}

document.getElementById('createSessionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('createSessionBtn');
    btn.disabled = true;
    btn.innerHTML = 'Creating...';
    
    const formData = new FormData(this);
    
    fetch('<?= BASE_URL ?>/api/cars/sessions.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            window.location.href = 'cars_assessment.php?session_id=' + data.session_id;
        } else {
            const resp = document.getElementById('createSessionResponse');
            resp.style.display = 'block';
            resp.innerHTML = '<div style="color:var(--danger)">' + data.message + '</div>';
            btn.disabled = false;
            btn.innerHTML = 'Create';
        }
    })
    .catch(err => {
        console.error(err);
        btn.disabled = false;
        btn.innerHTML = 'Create';
    });
});
</script>

    </div>
</body>
</html>
