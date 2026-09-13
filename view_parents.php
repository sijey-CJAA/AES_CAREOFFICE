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

// Fetch parents with their associated student
$stmt_parents = $pdo->query("
    SELECT p.*, s.full_name as student_name 
    FROM parents p 
    LEFT JOIN students s ON p.student_id = s.id 
    ORDER BY p.created_at DESC
");
$parents = $stmt_parents->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parents Information | AES Care Office</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

    <?php include 'includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <div class="top-header"></div>

        <main class="main-content">
            <div class="page-header">
                <h1>Parents & Guardians</h1>
                <p>Overview of all registered parents and their linked learners.</p>
            </div>

            <div class="dashboard-card" style="max-width: 100%;">
                
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Parent / Guardian</th>
                                <th>Linked Learner</th>
                                <th>Relationship</th>
                                <th>Type</th>
                                <th>Mobile Number</th>
                                <th>Emergency Contact</th>
                                <th>Registered</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($parents)): ?>
                            <tr>
                                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No parents found in the database.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach($parents as $parent): ?>
                                <tr>
                                    <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($parent['full_name']); ?></td>
                                    <td style="color: var(--primary); font-weight: 500;"><?php echo htmlspecialchars($parent['student_name'] ?? 'Unknown'); ?></td>
                                    <td><?php echo htmlspecialchars($parent['relationship']); ?></td>
                                    <td>
                                        <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; 
                                            <?php echo $parent['parent_type'] == 'Primary' ? 'background: #dcfce7; color: #166534;' : 'background: #f1f5f9; color: #475569;'; ?>">
                                            <?php echo htmlspecialchars($parent['parent_type']); ?>
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars($parent['mobile_number']); ?></td>
                                    <td style="color: #b91c1c; font-weight: 500;"><?php echo htmlspecialchars($parent['emergency_contact_number'] ?: 'N/A'); ?></td>
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y', strtotime($parent['created_at']))); ?></td>
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
