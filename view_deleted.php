<?php
require_once 'auth.php';
require_once 'db.php';

// Fetch the logged-in admin's details
$stmt = $pdo->prepare("SELECT email FROM admins WHERE id = :id");
$stmt->execute(['id' => $_SESSION['admin_id']]);
$admin = $stmt->fetch();

$user_email = $admin['email'] ?? 'admin@example.com';
$email_parts = explode('@', $user_email);
$name_parts = explode('.', $email_parts[0]);
$user_name = ucfirst($name_parts[0]);

// Fetch deleted records
$stmt_del_students = $pdo->query("SELECT * FROM students WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC");
$del_students = $stmt_del_students->fetchAll(PDO::FETCH_ASSOC);

$stmt_del_parents = $pdo->query("SELECT p.*, s.full_name as student_name FROM parents p LEFT JOIN students s ON p.student_id = s.id WHERE p.deleted_at IS NOT NULL ORDER BY p.deleted_at DESC");
$del_parents = $stmt_del_parents->fetchAll(PDO::FETCH_ASSOC);

$stmt_del_assess = $pdo->query("SELECT a.*, s.full_name as student_name FROM assessment_records a LEFT JOIN students s ON a.student_id = s.id WHERE a.deleted_at IS NOT NULL ORDER BY a.deleted_at DESC");
$del_assess = $stmt_del_assess->fetchAll(PDO::FETCH_ASSOC);

$stmt_del_cases = $pdo->query("SELECT c.*, s.full_name as student_name FROM case_register c LEFT JOIN students s ON c.student_id = s.id WHERE c.deleted_at IS NOT NULL ORDER BY c.deleted_at DESC");
$del_cases = $stmt_del_cases->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deleted Records | AES Care Office</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--border-light);
            margin-bottom: 1.5rem;
        }
        .tab-btn {
            padding: 1rem 1.5rem;
            background: none;
            border: none;
            border-bottom: 2px solid transparent;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-muted);
            cursor: pointer;
        }
        .tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>

    <?php include 'includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <div class="top-header"></div>

        <main class="main-content">
            <div class="page-header">
                <h1>Deleted Records Archive</h1>
                <p>View and restore records that were moved to the trash.</p>
            </div>

            <div class="dashboard-card" style="max-width: 100%;">
                
                <div class="tabs">
                    <button class="tab-btn active" onclick="switchTab('learners')">Learners (<?php echo count($del_students); ?>)</button>
                    <button class="tab-btn" onclick="switchTab('parents')">Parents (<?php echo count($del_parents); ?>)</button>
                    <button class="tab-btn" onclick="switchTab('assessments')">Assessments (<?php echo count($del_assess); ?>)</button>
                    <button class="tab-btn" onclick="switchTab('cases')">Cases (<?php echo count($del_cases); ?>)</button>
                </div>

                <!-- Learners Tab -->
                <div id="tab-learners" class="tab-content active">
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table class="data-table" style="min-width: max-content;">
                            <thead>
                                <tr>
                                    <th>Full Name</th>
                                    <th>LRN</th>
                                    <th>Deleted At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if(empty($del_students)): ?>
                                <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No deleted learners found.</td></tr>
                                <?php else: ?>
                                    <?php foreach($del_students as $row): ?>
                                    <tr>
                                        <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($row['full_name']); ?></td>
                                        <td><?php echo htmlspecialchars($row['lrn']); ?></td>
                                        <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($row['deleted_at']))); ?></td>
                                        <td>
                                            <button onclick="restoreRecord('students', <?php echo $row['id']; ?>)" style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Restore</button>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Parents Tab -->
                <div id="tab-parents" class="tab-content">
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table class="data-table" style="min-width: max-content;">
                            <thead>
                                <tr>
                                    <th>Parent Name</th>
                                    <th>Student Name</th>
                                    <th>Deleted At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if(empty($del_parents)): ?>
                                <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No deleted parents found.</td></tr>
                                <?php else: ?>
                                    <?php foreach($del_parents as $row): ?>
                                    <tr>
                                        <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($row['full_name']); ?></td>
                                        <td><?php echo htmlspecialchars($row['student_name'] ?? 'Unknown'); ?></td>
                                        <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($row['deleted_at']))); ?></td>
                                        <td>
                                            <button onclick="restoreRecord('parents', <?php echo $row['id']; ?>)" style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Restore</button>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Assessments Tab -->
                <div id="tab-assessments" class="tab-content">
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table class="data-table" style="min-width: max-content;">
                            <thead>
                                <tr>
                                    <th>Record No.</th>
                                    <th>Student Name</th>
                                    <th>Deleted At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if(empty($del_assess)): ?>
                                <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No deleted assessments found.</td></tr>
                                <?php else: ?>
                                    <?php foreach($del_assess as $row): ?>
                                    <tr>
                                        <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($row['record_number']); ?></td>
                                        <td><?php echo htmlspecialchars($row['student_name'] ?? 'Unknown'); ?></td>
                                        <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($row['deleted_at']))); ?></td>
                                        <td>
                                            <button onclick="restoreRecord('assessment_records', <?php echo $row['id']; ?>)" style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Restore</button>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Cases Tab -->
                <div id="tab-cases" class="tab-content">
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table class="data-table" style="min-width: max-content;">
                            <thead>
                                <tr>
                                    <th>Case No.</th>
                                    <th>Student Name</th>
                                    <th>Deleted At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if(empty($del_cases)): ?>
                                <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No deleted cases found.</td></tr>
                                <?php else: ?>
                                    <?php foreach($del_cases as $row): ?>
                                    <tr>
                                        <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($row['case_number']); ?></td>
                                        <td><?php echo htmlspecialchars($row['student_name'] ?? 'Unknown'); ?></td>
                                        <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y h:i A', strtotime($row['deleted_at']))); ?></td>
                                        <td>
                                            <button onclick="restoreRecord('case_register', <?php echo $row['id']; ?>)" style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Restore</button>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            
            <footer style="margin-top: 3rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                <p>&copy; <?php echo date("Y"); ?> AES Care Office. All rights reserved.</p>
            </footer>
        </main>
    </div>

    <script src="assets/js/main.js"></script>
    <script>
        function switchTab(tabName) {
            // Remove active from all tabs and contents
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Add active to selected
            event.currentTarget.classList.add('active');
            document.getElementById('tab-' + tabName).classList.add('active');
        }

        function restoreRecord(table, id) {
            if (confirm("Are you sure you want to restore this record?")) {
                const formData = new FormData();
                formData.append('table', table);
                formData.append('id', id);

                fetch('process_restore.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        window.location.reload();
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => {
                    console.error('Error:', err);
                    alert('An unexpected error occurred.');
                });
            }
        }
    </script>
</body>
</html>
