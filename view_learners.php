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

// Fetch all active students from the database
$stmt = $pdo->query("SELECT * FROM students WHERE deleted_at IS NULL ORDER BY created_at DESC");
$students = $stmt->fetchAll(PDO::FETCH_ASSOC);
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
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1>Learners Information</h1>
                    <p>Overview of all registered learners in the system.</p>
                </div>
                <button onclick="document.getElementById('add-learner-section').style.display = document.getElementById('add-learner-section').style.display === 'none' ? 'block' : 'none'" class="submit-btn" style="padding: 0.5rem 1rem; background: var(--primary);">
                    + Add Learner
                </button>
            </div>

            <div id="add-learner-section" class="dashboard-card" style="display: none; margin-bottom: 2rem; max-width: 100%;">
                <form id="learner-form">
                    <div class="form-section">
                        <h3>Add New Learner</h3>
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
                            <div class="form-group">
                                <label for="status">Status</label>
                                <select id="status" name="status" class="form-control">
                                    <option value="Currently Enrolled">Currently Enrolled</option>
                                    <option value="Graduated">Graduated</option>
                                    <option value="Transferred">Transferred</option>
                                    <option value="Dropped Out">Dropped Out</option>
                                    <option value="Unknown / Not Indicated" selected>Unknown / Not Indicated</option>
                                </select>
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

            <div class="dashboard-card" style="max-width: 100%;">
                <div class="table-responsive" style="overflow-x: auto;">
                    <table class="data-table" style="min-width: max-content;">
                        <thead>
                            <tr>
                                <th>Full Name</th>
                                <th>LRN</th>
                                <th>Grade & Section</th>
                                <th>Date of Birth</th>
                                <th>Blood Type</th>
                                <th>Status</th>
                                <th>Home Address</th>
                                <th>Allergies</th>
                                <th>Medications</th>
                                <th>Registered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($students)): ?>
                            <tr>
                                <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">No active learners found.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach($students as $student): ?>
                                <tr>
                                    <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($student['full_name']); ?></td>
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars($student['lrn']); ?></td>
                                    <td><?php echo htmlspecialchars($student['grade_section']); ?></td>
                                    <td><?php echo htmlspecialchars($student['date_of_birth'] ? date('M d, Y', strtotime($student['date_of_birth'])) : 'N/A'); ?></td>
                                    <td><?php echo htmlspecialchars($student['blood_type'] ?: 'N/A'); ?></td>
                                    <td>
                                        <?php 
                                            $status = $student['status'] ?? 'Unknown / Not Indicated';
                                            $status_bg = '#f1f5f9';
                                            $status_color = '#475569';
                                            if ($status === 'Currently Enrolled') {
                                                $status_bg = '#dcfce7'; $status_color = '#166534';
                                            } elseif ($status === 'Graduated') {
                                                $status_bg = '#dbeafe'; $status_color = '#1e40af';
                                            } elseif ($status === 'Transferred') {
                                                $status_bg = '#fef3c7'; $status_color = '#92400e';
                                            } elseif ($status === 'Dropped Out') {
                                                $status_bg = '#fee2e2'; $status_color = '#991b1b';
                                            }
                                        ?>
                                        <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: <?php echo $status_bg; ?>; color: <?php echo $status_color; ?>;">
                                            <?php echo htmlspecialchars($status); ?>
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars(substr($student['home_address'], 0, 30)) . (strlen($student['home_address']) > 30 ? '...' : ''); ?></td>
                                    <td><?php echo htmlspecialchars(substr($student['allergies'] ?: 'None', 0, 30)) . (strlen($student['allergies'] ?: 'None') > 30 ? '...' : ''); ?></td>
                                    <td><?php echo htmlspecialchars(substr($student['medications'] ?: 'None', 0, 30)) . (strlen($student['medications'] ?: 'None') > 30 ? '...' : ''); ?></td>
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y', strtotime($student['created_at']))); ?></td>
                                    <td>
                                        <button onclick="openEditLearnerModal(<?php echo $student['id']; ?>)" style="background: #f1f5f9; color: var(--primary); border: 1px solid #cbd5e1; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                                            Edit
                                        </button>
                                    </td>
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

    <!-- Edit Learner Modal -->
    <div id="editLearnerModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Learner Record</h2>
                <button class="modal-close" onclick="closeEditLearnerModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="edit-learner-form">
                    <input type="hidden" id="edit_learner_id" name="edit_learner_id">
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label for="edit_learner_name">Learner's Full Name</label>
                            <input type="text" id="edit_learner_name" name="edit_learner_name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_lrn">Learner Reference Number (LRN)</label>
                            <input type="text" id="edit_lrn" name="edit_lrn" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_grade_section">Grade and Section</label>
                            <input type="text" id="edit_grade_section" name="edit_grade_section" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_dob">Date of Birth</label>
                            <input type="date" id="edit_dob" name="edit_dob" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_blood_type">Blood Type (if known)</label>
                            <input type="text" id="edit_blood_type" name="edit_blood_type" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="edit_status">Status</label>
                            <select id="edit_status" name="edit_status" class="form-control">
                                <option value="Currently Enrolled">Currently Enrolled</option>
                                <option value="Graduated">Graduated</option>
                                <option value="Transferred">Transferred</option>
                                <option value="Dropped Out">Dropped Out</option>
                                <option value="Unknown / Not Indicated">Unknown / Not Indicated</option>
                            </select>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_home_address">Home Address</label>
                            <textarea id="edit_home_address" name="edit_home_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_allergies">Allergies / Medical Conditions</label>
                            <textarea id="edit_allergies" name="edit_allergies" class="form-control"></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_medications">Maintenance Medications</label>
                            <textarea id="edit_medications" name="edit_medications" class="form-control"></textarea>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="edit-learner-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="button" onclick="deleteRecord('students', document.getElementById('edit_learner_id').value)" style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Delete Record
                        </button>
                        <button type="submit" class="submit-btn" id="edit-learner-btn">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="assets/js/main.js"></script>
    <script>
        function openEditLearnerModal(id) {
            fetch('api_get_learner.php?id=' + id)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        const learner = data.data;
                        document.getElementById('edit_learner_id').value = learner.id;
                        document.getElementById('edit_learner_name').value = learner.full_name;
                        document.getElementById('edit_lrn').value = learner.lrn;
                        document.getElementById('edit_grade_section').value = learner.grade_section;
                        document.getElementById('edit_dob').value = learner.date_of_birth;
                        document.getElementById('edit_blood_type').value = learner.blood_type;
                        document.getElementById('edit_status').value = learner.status || 'Unknown / Not Indicated';
                        document.getElementById('edit_home_address').value = learner.home_address;
                        document.getElementById('edit_allergies').value = learner.allergies;
                        document.getElementById('edit_medications').value = learner.medications;
                        
                        document.getElementById('editLearnerModal').classList.add('active');
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => {
                    console.error('Error fetching learner:', err);
                    alert('Could not fetch learner details.');
                });
        }

        function closeEditLearnerModal() {
            document.getElementById('editLearnerModal').classList.remove('active');
            document.getElementById('edit-learner-response').style.display = 'none';
        }

        document.getElementById('edit-learner-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('edit-learner-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('edit-learner-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(this);

            fetch('process_learner_edit.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                responseDiv.style.display = 'block';
                responseDiv.innerHTML = data.message;
                
                if (data.status === 'success') {
                    responseDiv.className = 'msg-success';
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    responseDiv.className = 'msg-error';
                }
            })
            .catch(error => {
                responseDiv.style.display = 'block';
                responseDiv.className = 'msg-error';
                responseDiv.innerHTML = 'An unexpected error occurred.';
                console.error('Error:', error);
            })
            .finally(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        });

        function deleteRecord(table, id) {
            if (confirm("Are you sure you want to move this record to the trash? It can be restored from the Deleted Records page.")) {
                const formData = new FormData();
                formData.append('table', table);
                formData.append('id', id);

                fetch('process_delete.php', {
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
