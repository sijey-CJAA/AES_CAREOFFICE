<?php
require_once 'config/auth.php';
require_once 'config/db.php';

// Fetch the logged-in admin's details
$stmt = $pdo->prepare("SELECT email FROM admins WHERE id = :id");
$stmt->execute(['id' => $_SESSION['admin_id']]);
$admin = $stmt->fetch();

$user_email = $admin['email'] ?? 'admin@example.com';

// Derive a friendly name from the email
$email_parts = explode('@', $user_email);
$name_parts = explode('.', $email_parts[0]);
$user_name = ucfirst($name_parts[0]);

// Fetch Database Stats
$stmt_students = $pdo->query("SELECT COUNT(*) FROM students WHERE deleted_at IS NULL");
$total_students = $stmt_students->fetchColumn();

$stmt_parents = $pdo->query("SELECT COUNT(*) FROM parents WHERE deleted_at IS NULL");
$total_parents = $stmt_parents->fetchColumn();

$stmt_assessments = $pdo->query("SELECT COUNT(*) FROM assessment_records WHERE deleted_at IS NULL");
$total_assessments = $stmt_assessments->fetchColumn();

$stmt_cases = $pdo->query("SELECT COUNT(*) FROM case_register WHERE deleted_at IS NULL");
$total_cases = $stmt_cases->fetchColumn();


?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard | AES Care Office</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
</head>
<body>

    <?php include 'includes/sidebar.php'; ?>

    <!-- Main Wrapper -->
    <div class="main-wrapper">
        <?php include 'includes/topbar.php'; ?>

        <!-- Main Content -->
        <main class="main-content">
            <div class="page-header-container">
                <div>
                    <h1 class="page-title">Welcome, <?php echo $user_name; ?>!</h1>
                    <p style="color: var(--text-muted); margin-top: 0.25rem;">Here's the latest update.</p>
                </div>
            </div>


            <!-- Dashboard Stats Grid -->
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
                <!-- Total Students -->
                <a href="<?= BASE_URL ?>/pages/learners.php" style="text-decoration: none; color: inherit;">
                    <div style="background: white; border: 1px solid var(--border-light); border-radius: 12px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                        <div style="width: 50px; height: 50px; background: rgba(37, 99, 235, 0.1); color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Total Learners</div>
                            <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-dark);"><?php echo $total_students; ?></div>
                        </div>
                    </div>
                </a>



                <!-- Assessment Records -->
                <a href="<?= BASE_URL ?>/pages/assessments.php" style="text-decoration: none; color: inherit;">
                    <div style="background: white; border: 1px solid var(--border-light); border-radius: 12px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                        <div style="width: 50px; height: 50px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Assessments</div>
                            <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-dark);"><?php echo $total_assessments; ?></div>
                        </div>
                    </div>
                </a>

                <!-- Case Register -->
                <a href="<?= BASE_URL ?>/pages/cases.php" style="text-decoration: none; color: inherit;">
                    <div style="background: white; border: 1px solid var(--border-light); border-radius: 12px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                        <div style="width: 50px; height: 50px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Case Register</div>
                            <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-dark);"><?php echo $total_cases; ?></div>
                        </div>
                    </div>
                </a>
            </div>
            
            <footer style="margin-top: 3rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                <p>&copy; <?php echo date("Y"); ?> AES Care Office. All rights reserved.</p>
            </footer>
        </main>
    </div>
</body>
</html>
