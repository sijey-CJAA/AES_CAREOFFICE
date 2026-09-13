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

// Fetch students for dropdowns
$stmt_students = $pdo->query("SELECT id, full_name, lrn FROM students ORDER BY full_name ASC");
$students = $stmt_students->fetchAll(PDO::FETCH_ASSOC);

// Fetch assessments with student names
$stmt_assessments = $pdo->query("
    SELECT a.*, s.full_name as student_name 
    FROM assessment_records a
    LEFT JOIN students s ON a.student_id = s.id
    WHERE a.deleted_at IS NULL
    ORDER BY a.created_at DESC
");
$assessments = $stmt_assessments->fetchAll();

// Generate next record number
$stmt_last = $pdo->query("SELECT MAX(id) FROM assessment_records");
$last_id = $stmt_last->fetchColumn() ?: 0;
$next_record_number = 'AES-' . str_pad($last_id + 1, 4, '0', STR_PAD_LEFT);

$today_date = date('Y-m-d');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assessment Records | AES Care Office</title>
    <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>

    <?php include '../includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <div class="top-header"></div>

        <main class="main-content">
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1>Assessment Records</h1>
                    <p>Manage guidance office assessment records.</p>
                </div>
                <button onclick="document.getElementById('add-assessment-section').style.display = document.getElementById('add-assessment-section').style.display === 'none' ? 'block' : 'none'" class="submit-btn" style="padding: 0.5rem 1rem; background: var(--primary);">
                    + Add Record
                </button>
            </div>

            <div id="add-assessment-section" class="dashboard-card" style="display: none; margin-bottom: 2rem; max-width: 100%;">
                <form id="assessment-form">
                    <div class="form-section">
                        <h3>Add New Assessment Record</h3>
                        <div class="form-group full-width" style="margin-bottom: 1.5rem;">
                            <label for="student_id">Student Name</label>
                            <select id="student_id" name="student_id" class="form-control" required>
                                <option value="">-- Select Student --</option>
                                <?php foreach($students as $student): ?>
                                    <option value="<?php echo $student['id']; ?>">
                                        <?php echo htmlspecialchars($student['full_name']); ?> (LRN: <?php echo htmlspecialchars($student['lrn']); ?>)
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="record_number">Record Number</label>
                                <input type="text" id="record_number" name="record_number" class="form-control" value="<?php echo $next_record_number; ?>" readonly required>
                            </div>
                            <div class="form-group">
                                <label for="school_year">School Year</label>
                                <select id="school_year" name="school_year" class="form-control" required>
                                    <option value="Unknown/Not Indicated">Unknown/Not Indicated</option>
                                    <option value="2021-2022">2021-2022</option>
                                    <option value="2022-2023">2022-2023</option>
                                    <option value="2023-2024">2023-2024</option>
                                    <option value="2024-2025">2024-2025</option>
                                    <option value="2025-2026">2025-2026</option>
                                    <option value="2026-2027">2026-2027</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="date">Date</label>
                                <input type="date" id="date" name="date" class="form-control" value="<?php echo $today_date; ?>" required>
                            </div>
                            <div class="form-group">
                                <label for="grade_section">Grade & Section</label>
                                <input type="text" id="grade_section" name="grade_section" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="contact_number">Contact Number</label>
                                <input type="text" id="contact_number" name="contact_number" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="status">Status</label>
                                <input type="text" id="status" name="status" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="assessment_provider">Assessment Provider</label>
                                <input type="text" id="assessment_provider" name="assessment_provider" class="form-control">
                            </div>
                            <div class="form-group full-width">
                                <label for="findings">Findings</label>
                                <textarea id="findings" name="findings" class="form-control"></textarea>
                            </div>
                            <div class="form-group full-width">
                                <label for="recommendations">Recommendations</label>
                                <textarea id="recommendations" name="recommendations" class="form-control"></textarea>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="assessment-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="submit" class="submit-btn" id="assessment-btn">
                            Save Record
                        </button>
                    </div>
                </form>
            </div>

            <div class="dashboard-card" style="max-width: 100%;">
                <div class="table-responsive" style="overflow-x: auto;">
                    <table class="data-table" style="min-width: max-content;">
                        <thead>
                            <tr>
                                <th>Record No.</th>
                                <th>Student Name</th>
                                <th>Date</th>
                                <th>School Year</th>
                                <th>Grade & Section</th>
                                <th>Contact Number</th>
                                <th>Status</th>
                                <th>Provider</th>
                                <th>Findings</th>
                                <th>Recommendations</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($assessments)): ?>
                            <tr>
                                <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">No assessment records found.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach($assessments as $record): ?>
                                <tr>
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars($record['record_number']); ?></td>
                                    <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($record['student_name'] ?? 'Unknown'); ?></td>
                                    <td><?php echo htmlspecialchars(date('M d, Y', strtotime($record['date']))); ?></td>
                                    <td><?php echo htmlspecialchars($record['school_year']); ?></td>
                                    <td><?php echo htmlspecialchars($record['grade_section']); ?></td>
                                    <td><?php echo htmlspecialchars($record['contact_number']); ?></td>
                                    <td><?php echo htmlspecialchars($record['status']); ?></td>
                                    <td><?php echo htmlspecialchars($record['assessment_provider']); ?></td>
                                    <td><?php echo htmlspecialchars(substr($record['findings'], 0, 30)) . (strlen($record['findings']) > 30 ? '...' : ''); ?></td>
                                    <td><?php echo htmlspecialchars(substr($record['recommendations'], 0, 30)) . (strlen($record['recommendations']) > 30 ? '...' : ''); ?></td>
                                    <td>
                                        <button onclick="openEditAssessmentModal(<?php echo $record['id']; ?>)" style="background: #f1f5f9; color: var(--primary); border: 1px solid #cbd5e1; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
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

    <!-- Edit Assessment Modal -->
    <div id="editAssessmentModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Assessment Record</h2>
                <button class="modal-close" onclick="closeEditAssessmentModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="edit-assessment-form">
                    <input type="hidden" id="edit_assessment_id" name="edit_assessment_id">
                    
                    <div class="form-group full-width" style="margin-bottom: 1.5rem;">
                        <label for="edit_student_id">Student Name</label>
                        <select id="edit_student_id" name="edit_student_id" class="form-control" required>
                            <?php foreach($students as $student): ?>
                                <option value="<?php echo $student['id']; ?>">
                                    <?php echo htmlspecialchars($student['full_name']); ?> (LRN: <?php echo htmlspecialchars($student['lrn']); ?>)
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="form-grid">
                        <div class="form-group">
                            <label for="edit_record_number">Record Number</label>
                            <input type="text" id="edit_record_number" name="edit_record_number" class="form-control" readonly required>
                        </div>
                        <div class="form-group">
                            <label for="edit_school_year">School Year</label>
                            <select id="edit_school_year" name="edit_school_year" class="form-control" required>
                                <option value="Unknown/Not Indicated">Unknown/Not Indicated</option>
                                <option value="2021-2022">2021-2022</option>
                                <option value="2022-2023">2022-2023</option>
                                <option value="2023-2024">2023-2024</option>
                                <option value="2024-2025">2024-2025</option>
                                <option value="2025-2026">2025-2026</option>
                                <option value="2026-2027">2026-2027</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit_date">Date</label>
                            <input type="date" id="edit_date" name="edit_date" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_grade_section">Grade & Section</label>
                            <input type="text" id="edit_grade_section" name="edit_grade_section" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="edit_contact_number">Contact Number</label>
                            <input type="text" id="edit_contact_number" name="edit_contact_number" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="edit_status">Status</label>
                            <input type="text" id="edit_status" name="edit_status" class="form-control">
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_assessment_provider">Assessment Provider</label>
                            <input type="text" id="edit_assessment_provider" name="edit_assessment_provider" class="form-control">
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_findings">Findings</label>
                            <textarea id="edit_findings" name="edit_findings" class="form-control"></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_recommendations">Recommendations</label>
                            <textarea id="edit_recommendations" name="edit_recommendations" class="form-control"></textarea>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="edit-assessment-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="button" onclick="deleteRecord('assessment_records', document.getElementById('edit_assessment_id').value)" style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Delete Record
                        </button>
                        <button type="submit" class="submit-btn" id="edit-assessment-btn">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="/assets/js/main.js"></script>
    <script>
        document.getElementById('assessment-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('assessment-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('assessment-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(this);

            fetch('/api/process_assessment.php', {
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

        function openEditAssessmentModal(id) {
            fetch('/api/api_get_assessment.php?id=' + id)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        const record = data.data;
                        document.getElementById('edit_assessment_id').value = record.id;
                        document.getElementById('edit_student_id').value = record.student_id;
                        document.getElementById('edit_record_number').value = record.record_number;
                        document.getElementById('edit_school_year').value = record.school_year;
                        document.getElementById('edit_date').value = record.date;
                        document.getElementById('edit_grade_section').value = record.grade_section;
                        document.getElementById('edit_contact_number').value = record.contact_number;
                        document.getElementById('edit_status').value = record.status;
                        document.getElementById('edit_assessment_provider').value = record.assessment_provider;
                        document.getElementById('edit_findings').value = record.findings;
                        document.getElementById('edit_recommendations').value = record.recommendations;
                        
                        document.getElementById('editAssessmentModal').classList.add('active');
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => {
                    console.error('Error fetching record:', err);
                    alert('Could not fetch assessment details.');
                });
        }

        function closeEditAssessmentModal() {
            document.getElementById('editAssessmentModal').classList.remove('active');
            document.getElementById('edit-assessment-response').style.display = 'none';
        }

        document.getElementById('edit-assessment-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('edit-assessment-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('edit-assessment-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(this);

            fetch('/api/process_assessment_edit.php', {
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

                fetch('/api/process_delete.php', {
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
