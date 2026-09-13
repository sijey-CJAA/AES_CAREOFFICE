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

// Fetch learners
$stmt_students = $pdo->query("SELECT * FROM students ORDER BY created_at DESC");
$students = $stmt_students->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learners Information | AES Care Office</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

    <?php include 'includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <div class="top-header"></div>

        <main class="main-content">
            <div class="page-header">
                <h1>Learners Information</h1>
                <p>Overview of all registered learners in the system.</p>
            </div>

            <div class="dashboard-card" style="max-width: 100%;">
                
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Full Name</th>
                                <th>LRN</th>
                                <th>Grade & Section</th>
                                <th>Date of Birth</th>
                                <th>Blood Type</th>
                                <th>Registered</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($students)): ?>
                            <tr>
                                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No learners found in the database.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach($students as $student): ?>
                                <tr>
                                    <td style="color: var(--text-muted);">#<?php echo $student['id']; ?></td>
                                    <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($student['full_name']); ?></td>
                                    <td><?php echo htmlspecialchars($student['lrn']); ?></td>
                                    <td><?php echo htmlspecialchars($student['grade_section']); ?></td>
                                    <td><?php echo htmlspecialchars(date('M d, Y', strtotime($student['date_of_birth']))); ?></td>
                                    <td><?php echo htmlspecialchars($student['blood_type'] ?: 'N/A'); ?></td>
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y', strtotime($student['created_at']))); ?></td>
                                </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>

            </div>
            
            <footer style="margin-top: 3rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                <p>&copy; <?php echo date("Y"); ?> AES Care Office. All rights reserved.</p>
            </footer>
        </main>
    </div>

    <script src="assets/js/main.js"></script>
</body>
</html>
