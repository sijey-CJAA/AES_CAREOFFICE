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

// Check for School Year Transition
$sy_config_path = __DIR__ . '/config/school_year.json';
$show_promotion_alert = false;
if (file_exists($sy_config_path)) {
    $sy_config = json_decode(file_get_contents($sy_config_path), true);
    if ($sy_config && isset($sy_config['graduation_date'])) {
        $grad_date = new DateTime($sy_config['graduation_date']);
        $now = new DateTime();
        if ($now > $grad_date) {
            $show_promotion_alert = true;
        }
    }
}

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

            <?php if ($show_promotion_alert): ?>
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 1rem 1.5rem; border-radius: 6px; margin-bottom: 2rem; display: flex; align-items: flex-start; gap: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="color: #f59e0b; flex-shrink: 0; margin-top: 2px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div style="flex: 1;">
                    <h3 style="color: #92400e; margin: 0 0 0.25rem 0; font-size: 1.05rem;">School Year Transition Pending</h3>
                    <p style="color: #b45309; margin: 0; font-size: 0.9rem; line-height: 1.5;">The system detected that the graduation date (<?php echo date('M d, Y', strtotime($sy_config['graduation_date'])); ?>) has passed. Please automatically promote students for the upcoming school year (<?php echo htmlspecialchars($sy_config['next_school_year']); ?>).</p>
                    <button onclick="autoPromoteAll()" style="display: inline-block; margin-top: 0.75rem; background: #f59e0b; color: white; padding: 0.4rem 1rem; border-radius: 4px; border: none; font-size: 0.85rem; font-weight: 600; cursor: pointer;">Auto-Promote All Students</button>
                    <div id="auto-promote-msg" style="display:none; margin-top:0.5rem; font-size:0.85rem; font-weight:600;"></div>
                </div>
            </div>
            
            <script>
            function autoPromoteAll() {
                if(!confirm("This will automatically promote all students to their next grade level, graduate Grade 6 students, and reset all their sections so you can assign new ones. Are you sure you want to proceed?")) {
                    return;
                }
                const btn = event.target;
                btn.disabled = true;
                btn.innerText = "Processing...";
                
                fetch('<?= BASE_URL ?>/api/auto_promote.php', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    const msg = document.getElementById('auto-promote-msg');
                    msg.style.display = 'block';
                    msg.innerText = data.message;
                    if(data.status === 'success') {
                        msg.style.color = '#166534';
                        setTimeout(() => window.location.reload(), 2500);
                    } else {
                        msg.style.color = '#991b1b';
                        btn.disabled = false;
                        btn.innerText = "Auto-Promote All Students";
                    }
                })
                .catch(err => {
                    alert("An error occurred.");
                    btn.disabled = false;
                    btn.innerText = "Auto-Promote All Students";
                });
            }
            </script>
            <?php endif; ?>

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
