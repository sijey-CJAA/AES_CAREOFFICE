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
$next_record_number = 'AES-AR-' . str_pad($last_id + 1, 3, '0', STR_PAD_LEFT);

$today_date = date('Y-m-d');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assessments | AES Care Office</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
    <link href="https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/css/tom-select.css" rel="stylesheet">
</head>
<body>

    <?php include '../includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <?php include '../includes/topbar.php'; ?>

        <main class="main-content">
                <div class="page-header-container">
        <h1 class="page-title">Assessments</h1>
        <div class="page-controls">
            <span style="color: var(--text-muted); font-size: 0.85rem; display:flex; align-items:center; gap:0.25rem;">Showing <strong id="showing-counter" style="color:var(--text-dark);"><?= count($assessments) ?></strong> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            <button class="control-btn" onclick="document.getElementById('filterPanel').style.display = document.getElementById('filterPanel').style.display === 'none' ? 'flex' : 'none';"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg> Filter</button>
            <button class="control-btn" onclick="exportTableToPDF('dataTable', 'assessments.pdf')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Export</button>
            <button class="control-btn btn-primary" onclick="openAddAssessmentModal()">+ Add New Assessment</button>
        </div>
    </div>
    
    <div id="filterPanel" style="display: none; background: #fff; border: 1px solid var(--border-light); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">School Year</label>
            <select id="filterSchoolYear" class="form-control" onchange="applyPageFilters()" style="min-width: 150px;">
                <option value="all">All School Years</option>
                <option value="2021-2022">2021-2022</option>
                <option value="2022-2023">2022-2023</option>
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
            </select>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Status</label>
            <input type="text" id="filterStatus" class="form-control" placeholder="Type status..." onkeyup="applyPageFilters()" style="min-width: 150px;">
        </div>
    </div>
    
    <script>
    function applyPageFilters() {
        let sy = document.getElementById('filterSchoolYear').value.toLowerCase();
        if (sy === 'all') sy = '';
        
        const st = document.getElementById('filterStatus').value.toLowerCase();
        const trs = document.querySelectorAll('#dataTable tbody tr');
        let count = 0;
        
        trs.forEach(tr => {
            if (tr.children.length < 4) return; // Skip "no records" row
            const rowSy = tr.children[3].textContent.toLowerCase();
            const rowSt = tr.children[6].textContent.toLowerCase();
            
            if (rowSy.includes(sy) && rowSt.includes(st)) {
                tr.style.display = '';
                count++;
            } else {
                tr.style.display = 'none';
            }
        });
        document.getElementById('showing-counter').innerText = count;
    }
    </script>

    <!-- ── Add Assessment Modal ────────────────────────────────────────────────── -->
    <div id="addAssessmentModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 1000px;">
            <div class="modal-header">
                <h2>Add New Assessment Record</h2>
                <button class="modal-close" onclick="closeAddAssessmentModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                
                <!-- STEP 1: Drill-down UI -->
                <div id="add-step-1">
                    <div style="margin-bottom: 1.5rem;">
                        <label>Select Grade Level</label>
                        <select id="drill_grade" class="form-control" onchange="loadSectionsForDrill(this.value)">
                            <option value="">-- Select Grade --</option>
                            <option value="Kindergarten">Kindergarten</option>
                            <option value="Grade 1">Grade 1</option>
                            <option value="Grade 2">Grade 2</option>
                            <option value="Grade 3">Grade 3</option>
                            <option value="Grade 4">Grade 4</option>
                            <option value="Grade 5">Grade 5</option>
                            <option value="Grade 6">Grade 6</option>
                        </select>
                    </div>

                    <div id="drill_section_container" style="display:none; margin-bottom: 1.5rem;">
                        <label>Select Section</label>
                        <select id="drill_section" class="form-control" onchange="loadStudentsForDrill(this.value)">
                            <option value="">-- Select Section --</option>
                        </select>
                    </div>

                    <div id="drill_student_container" style="display:none; margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <label style="margin: 0;">Select Student</label>
                            <input type="text" id="drill_student_search" class="form-control" placeholder="Search name or LRN..." onkeyup="filterDrillStudents()" style="width: 200px; padding: 0.3rem 0.5rem; font-size: 0.85rem;">
                        </div>
                        <div id="drill_student_list" style="display: grid; gap: 0.5rem; max-height: 250px; overflow-y: auto; padding: 0.5rem; border: 1px solid var(--border-light); border-radius: 6px; background: #f8fafc;">
                            <!-- Student rows populated via JS -->
                        </div>
                    </div>
                </div>

                <!-- STEP 2: The Assessment Form -->
                <div id="add-step-2" style="display: none;">
                    <form id="assessment-form">
                        <input type="hidden" id="student_id" name="student_id">
                        
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label>Student Name</label>
                                <input type="text" id="display_student_name" class="form-control" readonly style="background: #f1f5f9; font-weight: 600;">
                            </div>
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
                                <input type="text" id="grade_section" name="grade_section" class="form-control" readonly style="background: #f1f5f9;">
                            </div>
                            <div class="form-group">
                                <label for="contact_number">Parent Contact Number</label>
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
                                <label for="diagnosis_select">Diagnosis</label>
                                <select id="diagnosis_select" class="form-control" onchange="handleDiagnosisChange(this.value, 'add')">
                                    <option value="">-- Select Diagnosis --</option>
                                    <option value="GDD">GDD</option>
                                    <option value="IDD">IDD</option>
                                    <option value="ADHD">ADHD</option>
                                    <option value="Autism">Autism</option>
                                    <option value="Other">Other</option>
                                </select>
                                <input type="text" id="diagnosis_other" class="form-control" placeholder="Please specify diagnosis" style="display: none; margin-top: 0.5rem;" oninput="document.getElementById('diagnosis').value = this.value">
                                <input type="hidden" id="diagnosis" name="diagnosis">
                            </div>
                            <div class="form-group full-width">
                                <label for="recommendations">Recommendations</label>
                                <textarea id="recommendations" name="recommendations" class="form-control"></textarea>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                            <button type="button" class="submit-btn" style="background: #94a3b8; color: white;" onclick="backToStep1()">Back to Selection</button>
                            <div style="display: flex; gap: 1rem; align-items: center; flex: 1; justify-content: flex-end;">
                                <div id="assessment-response" style="margin-top: 0; padding: 0.5rem 1rem; display:none; border-radius:6px;"></div>
                                <button type="submit" class="submit-btn" id="assessment-btn">Save Record</button>
                            </div>
                        </div>
                    </form>
                </div>
                
            </div>
        </div>
    </div>

            <div class="content-card">
                <div class="table-responsive" style="overflow-x: auto;">
                    <table class="data-table" id="dataTable" style="min-width: max-content;">
                        <thead>
                            <tr>
                                <th>Record No.</th>
                                <th>Student Name</th>
                                <th>Date</th>
                                <th>School Year</th>
                                <th>Grade &amp; Section</th>
                                <th>Parent Contact Number</th>
                                <th>Status</th>
                                <th>Provider</th>
                                <th>Findings</th>
                                <th>Diagnosis</th>
                                <th>Recommendations</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($assessments)): ?>
                            <tr>
                                <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">No assessment records found.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach($assessments as $record): ?>
                                <tr onclick="openEditAssessmentModal(<?php echo $record['id']; ?>)" style="cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='var(--bg-main)'" onmouseout="this.style.backgroundColor='transparent'">
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars($record['record_number']); ?></td>
                                    <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($record['student_name'] ?? 'Unknown'); ?></td>
                                    <td><?php echo htmlspecialchars(date('M d, Y', strtotime($record['date']))); ?></td>
                                    <td><?php echo htmlspecialchars($record['school_year']); ?></td>
                                    <td><?php echo htmlspecialchars($record['grade_section']); ?></td>
                                    <td><?php echo htmlspecialchars($record['contact_number']); ?></td>
                                    <td><?php echo htmlspecialchars($record['status']); ?></td>
                                    <td><?php echo htmlspecialchars($record['assessment_provider']); ?></td>
                                    <td><?php echo htmlspecialchars(substr($record['findings'], 0, 30)) . (strlen($record['findings']) > 30 ? '...' : ''); ?></td>
                                    <td><?php echo htmlspecialchars(substr($record['diagnosis'] ?? '', 0, 30)) . (strlen($record['diagnosis'] ?? '') > 30 ? '...' : ''); ?></td>
                                    <td><?php echo htmlspecialchars(substr($record['recommendations'], 0, 30)) . (strlen($record['recommendations']) > 30 ? '...' : ''); ?></td>
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
        <div class="modal-content" style="max-width: 1500px;">
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
                            <label for="edit_contact_number">Parent Contact Number</label>
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
                            <label for="edit_diagnosis_select">Diagnosis</label>
                            <select id="edit_diagnosis_select" class="form-control" onchange="handleDiagnosisChange(this.value, 'edit')">
                                <option value="">-- Select Diagnosis --</option>
                                <option value="GDD">GDD</option>
                                <option value="IDD">IDD</option>
                                <option value="ADHD">ADHD</option>
                                <option value="Autism">Autism</option>
                                <option value="Other">Other</option>
                            </select>
                            <input type="text" id="edit_diagnosis_other" class="form-control" placeholder="Please specify diagnosis" style="display: none; margin-top: 0.5rem;" oninput="document.getElementById('edit_diagnosis').value = this.value">
                            <input type="hidden" id="edit_diagnosis" name="edit_diagnosis">
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

    <script src="https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/js/tom-select.complete.min.js"></script>
    <script src="<?= BASE_URL ?>/assets/js/main.js"></script>
    <script>
        // --- Add Assessment Modal Logic ---
        function openAddAssessmentModal() {
            // Reset forms
            document.getElementById('assessment-form').reset();
            document.getElementById('add-step-1').style.display = 'block';
            document.getElementById('add-step-2').style.display = 'none';
            document.getElementById('drill_grade').value = '';
            document.getElementById('drill_section_container').style.display = 'none';
            document.getElementById('drill_student_container').style.display = 'none';
            
            // Auto-compute school year
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-11 (Aug is 7)
            let sy = '';
            if (month >= 7) {
                sy = year + '-' + (year + 1);
            } else {
                sy = (year - 1) + '-' + year;
            }
            const sySelect = document.getElementById('school_year');
            for(let i=0; i<sySelect.options.length; i++){
                if(sySelect.options[i].value === sy){
                    sySelect.selectedIndex = i;
                    break;
                }
            }

            document.getElementById('diagnosis_select').value = '';
            document.getElementById('diagnosis_other').value = '';
            document.getElementById('diagnosis_other').style.display = 'none';
            document.getElementById('diagnosis').value = '';

            document.getElementById('addAssessmentModal').classList.add('active');
        }

        function handleDiagnosisChange(val, mode) {
            const otherInput = document.getElementById(mode === 'add' ? 'diagnosis_other' : 'edit_diagnosis_other');
            const hiddenInput = document.getElementById(mode === 'add' ? 'diagnosis' : 'edit_diagnosis');
            
            if (val === 'Other') {
                otherInput.style.display = 'block';
                hiddenInput.value = otherInput.value;
            } else {
                otherInput.style.display = 'none';
                hiddenInput.value = val;
            }
        }

        function closeAddAssessmentModal() {
            document.getElementById('addAssessmentModal').classList.remove('active');
        }

        function backToStep1() {
            document.getElementById('add-step-2').style.display = 'none';
            document.getElementById('add-step-1').style.display = 'block';
        }

        function loadSectionsForDrill(grade) {
            const sectionContainer = document.getElementById('drill_section_container');
            const studentContainer = document.getElementById('drill_student_container');
            const sectionSelect = document.getElementById('drill_section');
            
            sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
            if (sectionSelect.tomselect) sectionSelect.tomselect.sync();
            studentContainer.style.display = 'none';

            if (!grade) {
                sectionContainer.style.display = 'none';
                return;
            }

            fetch('<?= BASE_URL ?>/api/api_get_sections_by_grade.php?grade_level=' + encodeURIComponent(grade))
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success' && data.data.length > 0) {
                        data.data.forEach(sec => {
                            const opt = document.createElement('option');
                            opt.value = sec;
                            opt.textContent = sec;
                            sectionSelect.appendChild(opt);
                        });
                        if (sectionSelect.tomselect) sectionSelect.tomselect.sync();
                        sectionContainer.style.display = 'block';
                    } else {
                        sectionContainer.style.display = 'none';
                        alert('No sections found for this grade.');
                    }
                })
                .catch(err => console.error(err));
        }

        function loadStudentsForDrill(section) {
            const grade = document.getElementById('drill_grade').value;
            const studentContainer = document.getElementById('drill_student_container');
            const studentList = document.getElementById('drill_student_list');
            
            studentList.innerHTML = '';
            
            if (!section) {
                studentContainer.style.display = 'none';
                return;
            }

            fetch(`<?= BASE_URL ?>/api/api_get_students_by_section.php?grade_level=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success' && data.data.length > 0) {
                        data.data.forEach(s => {
                            const div = document.createElement('div');
                            div.style.padding = '0.5rem';
                            div.style.background = '#fff';
                            div.style.border = '1px solid var(--border-light)';
                            div.style.borderRadius = '4px';
                            div.style.cursor = 'pointer';
                            div.style.display = 'flex';
                            div.style.justifyContent = 'space-between';
                            
                            // Make it clickable like a button
                            div.onmouseover = () => div.style.borderColor = 'var(--primary)';
                            div.onmouseout = () => div.style.borderColor = 'var(--border-light)';
                            
                            div.innerHTML = `<span><strong>${s.full_name}</strong> <small style="color:var(--text-muted);">(LRN: ${s.lrn})</small></span>
                                             <button type="button" style="background:var(--primary);color:white;border:none;border-radius:4px;padding:0.25rem 0.5rem;font-size:0.75rem;cursor:pointer;">Select</button>`;
                            
                            div.onclick = () => selectStudentForAssessment(s.id, s.full_name, grade, section, s.status, s.contact_number, s.school_year);
                            
                            studentList.appendChild(div);
                        });
                        studentContainer.style.display = 'block';
                    } else {
                        studentList.innerHTML = '<div style="padding: 0.5rem; color: var(--text-muted);">No students found in this section.</div>';
                        studentContainer.style.display = 'block';
                    }
                })
                .catch(err => console.error(err));
        }

        function filterDrillStudents() {
            const input = document.getElementById('drill_student_search').value.toLowerCase();
            const list = document.getElementById('drill_student_list');
            const items = list.getElementsByTagName('div');
            
            for (let i = 0; i < items.length; i++) {
                const text = items[i].textContent.toLowerCase();
                if (text.includes(input)) {
                    items[i].style.display = 'flex';
                } else {
                    items[i].style.display = 'none';
                }
            }
        }

        function selectStudentForAssessment(id, name, grade, section, status, contactNumber, schoolYear) {
            document.getElementById('student_id').value = id;
            document.getElementById('display_student_name').value = name;
            document.getElementById('grade_section').value = `${grade} - ${section}`;
            document.getElementById('status').value = status || '';
            document.getElementById('contact_number').value = contactNumber || '';
            
            const syEl = document.getElementById('school_year');
            if (schoolYear) {
                if (syEl.tomselect) syEl.tomselect.setValue(schoolYear);
                else syEl.value = schoolYear;
            }
            
            document.getElementById('add-step-1').style.display = 'none';
            document.getElementById('add-step-2').style.display = 'block';
        }

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

            fetch('<?= BASE_URL ?>/api/process_assessment.php', {
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
            fetch('<?= BASE_URL ?>/api/api_get_assessment.php?id=' + id)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        const record = data.data;
                        document.getElementById('edit_assessment_id').value = record.id;
                        
                        const editStudentId = document.getElementById('edit_student_id');
                        if (editStudentId.tomselect) editStudentId.tomselect.setValue(record.student_id);
                        else editStudentId.value = record.student_id;
                        
                        document.getElementById('edit_record_number').value = record.record_number;
                        
                        const editSchoolYear = document.getElementById('edit_school_year');
                        if (editSchoolYear.tomselect) editSchoolYear.tomselect.setValue(record.school_year);
                        else editSchoolYear.value = record.school_year;
                        
                        document.getElementById('edit_date').value = record.date;
                        document.getElementById('edit_grade_section').value = record.grade_section;
                        document.getElementById('edit_contact_number').value = record.contact_number;
                        
                        const editStatus = document.getElementById('edit_status');
                        if (editStatus.tomselect) editStatus.tomselect.setValue(record.status);
                        else editStatus.value = record.status;
                        
                        document.getElementById('edit_assessment_provider').value = record.assessment_provider;
                        document.getElementById('edit_findings').value = record.findings;
                        
                        const diag = record.diagnosis || '';
                        const knownDiags = ['GDD', 'IDD', 'ADHD', 'Autism'];
                        const editDiagSelect = document.getElementById('edit_diagnosis_select');
                        
                        if (knownDiags.includes(diag)) {
                            if (editDiagSelect.tomselect) editDiagSelect.tomselect.setValue(diag);
                            else editDiagSelect.value = diag;
                            document.getElementById('edit_diagnosis_other').style.display = 'none';
                            document.getElementById('edit_diagnosis_other').value = '';
                            document.getElementById('edit_diagnosis').value = diag;
                        } else if (diag === '') {
                            if (editDiagSelect.tomselect) editDiagSelect.tomselect.setValue('');
                            else editDiagSelect.value = '';
                            document.getElementById('edit_diagnosis_other').style.display = 'none';
                            document.getElementById('edit_diagnosis_other').value = '';
                            document.getElementById('edit_diagnosis').value = '';
                        } else {
                            if (editDiagSelect.tomselect) editDiagSelect.tomselect.setValue('Other');
                            else editDiagSelect.value = 'Other';
                            document.getElementById('edit_diagnosis_other').style.display = 'block';
                            document.getElementById('edit_diagnosis_other').value = diag;
                            document.getElementById('edit_diagnosis').value = diag;
                        }
                        
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

            fetch('<?= BASE_URL ?>/api/process_assessment_edit.php', {
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

