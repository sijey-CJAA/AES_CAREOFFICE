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

// Fetch all students to populate the dropdown in the parents form
$stmt_students = $pdo->query("SELECT id, full_name, lrn FROM students ORDER BY full_name ASC");
$students = $stmt_students->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Parent | AES Care Office</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

    <?php include 'includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <div class="top-header"></div>

        <main class="main-content">
            <div class="page-header">
                <h1>Add Parent / Guardian</h1>
                <p>Link parent or guardian records to an existing learner.</p>
            </div>

            <div class="dashboard-card">
                
                <form id="parent-form">
                    
                    <!-- Link Parent to Student -->
                    <div class="form-section" style="background: var(--bg-light); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-light);">
                        <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--primary);">Link to Learner</h3>
                        <div class="form-group full-width">
                            <label for="student_id">Select Learner</label>
                            <select id="student_id" name="student_id" class="form-control" required>
                                <option value="" disabled selected>-- Select a learner from the database --</option>
                                <?php foreach($students as $student): ?>
                                    <option value="<?php echo $student['id']; ?>">
                                        <?php echo htmlspecialchars($student['full_name']); ?> (LRN: <?php echo htmlspecialchars($student['lrn']); ?>)
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>II. Parent / Guardian Information (Primary)</h3>
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label for="p1_name">Full Name</label>
                                <input type="text" id="p1_name" name="p1_name" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="p1_relationship">Relationship to Learner</label>
                                <input type="text" id="p1_relationship" name="p1_relationship" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="p1_mobile">Mobile Number</label>
                                <input type="text" id="p1_mobile" name="p1_mobile" class="form-control" required>
                            </div>
                            <div class="form-group full-width">
                                <label for="p1_address">Home Address</label>
                                <textarea id="p1_address" name="p1_address" class="form-control" required></textarea>
                            </div>
                            <div class="form-group">
                                <label for="p1_telephone">Telephone Number</label>
                                <input type="text" id="p1_telephone" name="p1_telephone" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="p1_email">Email Address</label>
                                <input type="email" id="p1_email" name="p1_email" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="p1_workplace">Workplace</label>
                                <input type="text" id="p1_workplace" name="p1_workplace" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="p1_workplace_address">Workplace Address</label>
                                <textarea id="p1_workplace_address" name="p1_workplace_address" class="form-control"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="p1_emergency">Emergency Contact Number</label>
                                <input type="text" id="p1_emergency" name="p1_emergency" class="form-control" required>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Secondary Parent / Guardian (Optional)</h3>
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label for="p2_name">Full Name</label>
                                <input type="text" id="p2_name" name="p2_name" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="p2_relationship">Relationship to Learner</label>
                                <input type="text" id="p2_relationship" name="p2_relationship" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="p2_mobile">Mobile Number</label>
                                <input type="text" id="p2_mobile" name="p2_mobile" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="p2_address">Home Address</label>
                                <textarea id="p2_address" name="p2_address" class="form-control"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="p2_telephone">Telephone Number</label>
                                <input type="text" id="p2_telephone" name="p2_telephone" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="p2_email">Email Address</label>
                                <input type="email" id="p2_email" name="p2_email" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="p2_workplace">Workplace</label>
                                <input type="text" id="p2_workplace" name="p2_workplace" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="p2_workplace_address">Workplace Address</label>
                                <textarea id="p2_workplace_address" name="p2_workplace_address" class="form-control"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="p2_emergency">Emergency Contact Number</label>
                                <input type="text" id="p2_emergency" name="p2_emergency" class="form-control">
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="parent-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="submit" class="submit-btn">
                            Save Parent Record
                        </button>
                    </div>
                </form>
            </div>
            
            <footer style="margin-top: 3rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                <p>&copy; <?php echo date("Y"); ?> AES Care Office. All rights reserved.</p>
            </footer>
        </main>
    </div>

    <script src="assets/js/main.js"></script>
</body>
</html>
