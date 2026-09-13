<?php
require_once '../config/auth.php';
require_once '../config/db.php';

// Fetch the logged-in admin's details
$stmt = $pdo->prepare("SELECT email FROM admins WHERE id = :id");
$stmt->execute(['id' => $_SESSION['admin_id']]);
$admin = $stmt->fetch();

$user_email = $admin['email'] ?? 'admin@example.com';
$email_parts = explode('@', $user_email);
$name_parts = explode('.', $email_parts[0]);
$user_name = ucfirst($name_parts[0]);

// Fetch all students to populate the dropdown in the parents form
$stmt_all_students = $pdo->query("SELECT id, full_name, lrn FROM students ORDER BY full_name ASC");
$students = $stmt_all_students->fetchAll();

// Fetch parents with student names
$stmt_parents = $pdo->query("
    SELECT p.*, s.full_name as student_name 
    FROM parents p
    LEFT JOIN students s ON p.student_id = s.id
    WHERE p.deleted_at IS NULL
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
    <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
</head>
<body>

    <?php include '../includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <?php include '../includes/topbar.php'; ?>

        <main class="main-content">
                <div class="page-header-container">
        <h1 class="page-title">Parents</h1>
        <div class="page-controls">
            <span style="color: var(--text-muted); font-size: 0.85rem; display:flex; align-items:center; gap:0.25rem;">Showing <strong style="color:var(--text-dark);">10</strong> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            <button class="control-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg> Filter</button>
            <button class="control-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Export</button>
            <button class="control-btn btn-primary" onclick="document.getElementById('add-parent-section').style.display = document.getElementById('add-parent-section').style.display === 'none' ? 'block' : 'none'">+ Add New Parent</button>
        </div>
    </div>

            <div id="add-parent-section" class="dashboard-card" style="display: none; margin-bottom: 2rem; max-width: 100%;">
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

            <div class="content-card">
                <div class="table-responsive" style="overflow-x: auto;">
                    <table class="data-table" style="min-width: max-content;">
                        <thead>
                            <tr>
                                <th>Parent / Guardian</th>
                                <th>Linked Learner</th>
                                <th>Relationship</th>
                                <th>Type</th>
                                <th>Mobile Number</th>
                                <th>Email Address</th>
                                <th>Home Address</th>
                                <th>Workplace Address</th>
                                <th>Emergency Contact</th>
                                <th>Registered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($parents)): ?>
                            <tr>
                                <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">No active parents found.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach($parents as $parent): ?>
                                <tr>
                                    <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($parent['full_name']); ?></td>
                                    <td>
                                        <a href="#" style="color: var(--primary); text-decoration: none;"><?php echo htmlspecialchars($parent['student_name'] ?? 'Unknown'); ?></a>
                                    </td>
                                    <td><?php echo htmlspecialchars($parent['relationship']); ?></td>
                                    <td>
                                        <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; 
                                            <?php echo $parent['parent_type'] == 'Primary' ? 'background: #dcfce7; color: #166534;' : 'background: #f1f5f9; color: #475569;'; ?>">
                                            <?php echo htmlspecialchars($parent['parent_type']); ?>
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars($parent['mobile_number']); ?></td>
                                    <td><?php echo htmlspecialchars($parent['email_address'] ?: 'N/A'); ?></td>
                                    <td><?php echo htmlspecialchars(substr($parent['home_address'] ?: 'N/A', 0, 30)) . (strlen($parent['home_address'] ?: 'N/A') > 30 ? '...' : ''); ?></td>
                                    <td><?php echo htmlspecialchars(substr($parent['workplace_address'] ?: 'N/A', 0, 30)) . (strlen($parent['workplace_address'] ?: 'N/A') > 30 ? '...' : ''); ?></td>
                                    <td style="color: #b91c1c; font-weight: 500;"><?php echo htmlspecialchars($parent['emergency_contact_number'] ?: 'N/A'); ?></td>
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars(date('M d, Y', strtotime($parent['created_at']))); ?></td>
                                    <td>
                                        <button onclick="openEditParentModal(<?php echo $parent['id']; ?>)" style="background: #f1f5f9; color: var(--primary); border: 1px solid #cbd5e1; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
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

    <!-- Edit Parent Modal -->
    <div id="editParentModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Parent Record</h2>
                <button class="modal-close" onclick="closeEditParentModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="edit-parent-form">
                    <input type="hidden" id="edit_parent_id" name="edit_parent_id">
                    
                    <div class="form-section">
                        <div class="form-group full-width">
                            <label for="edit_student_id">Linked Learner</label>
                            <select id="edit_student_id" name="edit_student_id" class="form-control" required>
                                <?php foreach($students as $student): ?>
                                    <option value="<?php echo $student['id']; ?>">
                                        <?php echo htmlspecialchars($student['full_name']); ?> (LRN: <?php echo htmlspecialchars($student['lrn']); ?>)
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label for="edit_parent_type">Parent Type</label>
                            <select id="edit_parent_type" name="edit_parent_type" class="form-control" required>
                                <option value="Primary">Primary</option>
                                <option value="Secondary">Secondary</option>
                            </select>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p_name">Full Name</label>
                            <input type="text" id="edit_p_name" name="edit_p_name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p_relationship">Relationship to Learner</label>
                            <input type="text" id="edit_p_relationship" name="edit_p_relationship" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p_mobile">Mobile Number</label>
                            <input type="text" id="edit_p_mobile" name="edit_p_mobile" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p_address">Home Address</label>
                            <textarea id="edit_p_address" name="edit_p_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit_p_telephone">Telephone Number</label>
                            <input type="text" id="edit_p_telephone" name="edit_p_telephone" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="edit_p_email">Email Address</label>
                            <input type="email" id="edit_p_email" name="edit_p_email" class="form-control">
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p_workplace">Workplace</label>
                            <input type="text" id="edit_p_workplace" name="edit_p_workplace" class="form-control">
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p_workplace_address">Workplace Address</label>
                            <textarea id="edit_p_workplace_address" name="edit_p_workplace_address" class="form-control"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit_p_emergency">Emergency Contact Number</label>
                            <input type="text" id="edit_p_emergency" name="edit_p_emergency" class="form-control" required>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="edit-parent-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="button" onclick="deleteRecord('parents', document.getElementById('edit_parent_id').value)" style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Delete Record
                        </button>
                        <button type="submit" class="submit-btn" id="edit-parent-btn">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="<?= BASE_URL ?>/assets/js/main.js"></script>
    <script>
        function openEditParentModal(id) {
            fetch('<?= BASE_URL ?>/api/api_get_parent.php?id=' + id)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        const parent = data.data;
                        document.getElementById('edit_parent_id').value = parent.id;
                        document.getElementById('edit_student_id').value = parent.student_id;
                        document.getElementById('edit_parent_type').value = parent.parent_type;
                        document.getElementById('edit_p_name').value = parent.full_name;
                        document.getElementById('edit_p_relationship').value = parent.relationship;
                        document.getElementById('edit_p_mobile').value = parent.mobile_number;
                        document.getElementById('edit_p_address').value = parent.home_address;
                        document.getElementById('edit_p_telephone').value = parent.telephone_number;
                        document.getElementById('edit_p_email').value = parent.email_address;
                        document.getElementById('edit_p_workplace').value = parent.workplace;
                        document.getElementById('edit_p_workplace_address').value = parent.workplace_address;
                        document.getElementById('edit_p_emergency').value = parent.emergency_contact_number;
                        
                        document.getElementById('editParentModal').classList.add('active');
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => {
                    console.error('Error fetching parent:', err);
                    alert('Could not fetch parent details.');
                });
        }

        function closeEditParentModal() {
            document.getElementById('editParentModal').classList.remove('active');
            document.getElementById('edit-parent-response').style.display = 'none';
        }

        document.getElementById('edit-parent-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('edit-parent-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('edit-parent-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(this);

            fetch('<?= BASE_URL ?>/api/process_parent_edit.php', {
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

                fetch('<?= BASE_URL ?>/api/process_delete.php', {
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

