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


$page_title = 'CARS Norm Tables Editor';
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
            <h1 class="page-title">Norm Tables Editor</h1>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Manage standard T-Score and Percentile mappings for CARS raw scores.</p>
        </div>
        <button class="btn-primary" onclick="openAddModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add New Row
        </button>
    </div>

    <div class="card">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table" id="normsTable">
                    <thead>
                        <tr>
                            <th>Grade Group</th>
                            <th>Raw Score</th>
                            <th>T-Score</th>
                            <th>Percentile Rank</th>
                            <th>Risk Tier</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="normsTbody">
                        <!-- Populated via JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- Modal -->
<div class="modal-overlay" id="normModal">
    <div class="modal-content">
        <div class="modal-header">
                <h3 class="modal-title" id="modalTitle">Add Norm Row</h3>
                <button class="modal-close" onclick="closeModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="normForm">
                    <input type="hidden" id="norm_id" name="id">
                    <div class="form-group">
                        <label for="grade_group">Grade Group</label>
                        <select id="grade_group" name="grade_group" class="form-control" required>
                            <option value="Kindergarten to Grade 3">Kindergarten to Grade 3</option>
                            <option value="Grades 4-8" selected>Grades 4-8</option>
                            <option value="Grades 9-12">Grades 9-12</option>
                        </select>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="raw_score">Raw Score</label>
                            <input type="number" id="raw_score" name="raw_score" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="t_score">T-Score</label>
                            <input type="number" id="t_score" name="t_score" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="percentile">Percentile</label>
                            <input type="number" id="percentile" name="percentile" class="form-control" required>
                        </div>
                    </div>
                    
                    <div id="formResponse" style="margin-top:1rem; display:none;"></div>
                    
                    <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn-primary" id="saveBtn">Save</button>
                    </div>
                </form>
            </div>
        </div>
</div>

<script>
function fetchNorms() {
    fetch('<?= BASE_URL ?>/api/cars/norm_table.php')
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                const tbody = document.getElementById('normsTbody');
                tbody.innerHTML = '';
                if(data.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">No norm tables configured.</td></tr>';
                } else {
                    data.data.forEach(n => {
                        let tier = 'Tier 1';
                        if (n.t_score >= 61 && n.t_score <= 70) tier = 'Tier 2';
                        else if (n.t_score >= 71) tier = 'Tier 3';
                        
                        let badgeClass = tier == 'Tier 1' ? 'background:#dcfce7; color:#166534;' : (tier == 'Tier 2' ? 'background:#fef08a; color:#854d0e;' : 'background:#fee2e2; color:#991b1b;');

                        let tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${n.grade_group}</td>
                            <td><strong>${n.raw_score}</strong></td>
                            <td>${n.t_score}</td>
                            <td>${n.percentile}</td>
                            <td><span style="padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; ${badgeClass}">${tier}</span></td>
                            <td>
                                <button class="btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="editRow(${n.id}, '${n.grade_group}', ${n.raw_score}, ${n.t_score}, ${n.percentile})">Edit</button>
                                <button class="btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:var(--danger);" onclick="deleteRow(${n.id})">Delete</button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
        });
}

fetchNorms();

function openAddModal() {
    document.getElementById('normForm').reset();
    document.getElementById('norm_id').value = '';
    document.getElementById('modalTitle').textContent = 'Add Norm Row';
    document.getElementById('formResponse').style.display = 'none';
    document.getElementById('normModal').classList.add('active');
}

function editRow(id, group, raw, t, perc) {
    document.getElementById('norm_id').value = id;
    document.getElementById('grade_group').value = group;
    document.getElementById('raw_score').value = raw;
    document.getElementById('t_score').value = t;
    document.getElementById('percentile').value = perc;
    document.getElementById('modalTitle').textContent = 'Edit Norm Row';
    document.getElementById('formResponse').style.display = 'none';
    document.getElementById('normModal').classList.add('active');
}

function closeModal() {
    document.getElementById('normModal').classList.remove('active');
}

document.getElementById('normForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    
    let payload = {
        id: document.getElementById('norm_id').value,
        grade_group: document.getElementById('grade_group').value,
        raw_score: document.getElementById('raw_score').value,
        t_score: document.getElementById('t_score').value,
        percentile: document.getElementById('percentile').value
    };
    
    fetch('<?= BASE_URL ?>/api/cars/norm_table.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            closeModal();
            fetchNorms();
        } else {
            document.getElementById('formResponse').style.display = 'block';
            document.getElementById('formResponse').innerHTML = '<div style="color:var(--danger)">' + data.message + '</div>';
        }
    })
    .finally(() => {
        btn.disabled = false;
    });
});

function deleteRow(id) {
    if(confirm('Are you sure you want to delete this row?')) {
        fetch('<?= BASE_URL ?>/api/cars/norm_table.php?id=' + id, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                fetchNorms();
            } else {
                alert('Error: ' + data.message);
            }
        });
    }
}
</script>

    </div>
</body>
</html>
