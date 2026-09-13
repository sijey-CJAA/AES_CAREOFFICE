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
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Learner | AES Care Office</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

    <?php include 'includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <div class="top-header"></div>

        <main class="main-content">
            <div class="page-header">
                <h1>Add New Learner</h1>
                <p>Enter learner records into the central database.</p>
            </div>

            <div class="dashboard-card">
                
                <form id="learner-form">
                    <div class="form-section">
                        <h3>I. Learner Information</h3>
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label for="learner_name">Learner's Full Name</label>
                                <input type="text" id="learner_name" name="learner_name" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="lrn">Learner Reference Number (LRN)</label>
                                <input type="text" id="lrn" name="lrn" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="grade_section">Grade and Section</label>
                                <input type="text" id="grade_section" name="grade_section" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="dob">Date of Birth</label>
                                <input type="date" id="dob" name="dob" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="blood_type">Blood Type (if known)</label>
                                <input type="text" id="blood_type" name="blood_type" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="home_address">Home Address</label>
                                <textarea id="home_address" name="home_address" class="form-control" required></textarea>
                            </div>
                            <div class="form-group full-width">
                                <label for="allergies">Allergies / Medical Conditions</label>
                                <textarea id="allergies" name="allergies" class="form-control"></textarea>
                            </div>
                            <div class="form-group full-width">
                                <label for="medications">Maintenance Medications</label>
                                <textarea id="medications" name="medications" class="form-control"></textarea>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="learner-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="submit" class="submit-btn">
                            Save Learner Record
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
