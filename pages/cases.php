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

// Fetch cases with student names
$stmt_cases = $pdo->query("
    SELECT c.*, s.full_name as student_name 
    FROM case_register c
    LEFT JOIN students s ON c.student_id = s.id
    WHERE c.deleted_at IS NULL
    ORDER BY c.created_at DESC
");
$cases = $stmt_cases->fetchAll();

// Generate next case number
$stmt_last = $pdo->query("SELECT MAX(id) FROM case_register");
$last_id = $stmt_last->fetchColumn() ?: 0;
$next_case_number = 'AES-' . str_pad($last_id + 1, 4, '0', STR_PAD_LEFT);

$today_date = date('Y-m-d');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Case Register | AES Care Office</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
    <link href="https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/css/tom-select.css" rel="stylesheet">
</head>
<body>

    <?php include '../includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <?php include '../includes/topbar.php'; ?>

        <main class="main-content">
                <div class="page-header-container">
        <h1 class="page-title">Case Register</h1>
        <div class="page-controls">
            <span style="color: var(--text-muted); font-size: 0.85rem; display:flex; align-items:center; gap:0.25rem;">Showing <strong id="showing-counter" style="color:var(--text-dark);"><?= count($cases) ?></strong> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
            <button class="control-btn" onclick="document.getElementById('filterPanel').style.display = document.getElementById('filterPanel').style.display === 'none' ? 'flex' : 'none';"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg> Filter</button>
            <button class="control-btn" onclick="exportTableToPDF('dataTable', 'cases.pdf')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Export</button>
            <button class="control-btn btn-primary" onclick="openAddCaseModal()">+ Add New Case</button>
        </div>
    </div>
    
    <div id="filterPanel" style="display: none; background: #fff; border: 1px solid var(--border-light); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">School Year</label>
            <select id="filterSchoolYear" class="form-control" onchange="applyPageFilters()" style="min-width: 150px;">
                <option value="">All</option>
                <option value="2021-2022">2021-2022</option>
                <option value="2022-2023">2022-2023</option>
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
            </select>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Outcome</label>
            <input type="text" id="filterStatus" class="form-control" placeholder="Type outcome..." onkeyup="applyPageFilters()" style="min-width: 150px;">
        </div>
    </div>
    
    <script>
    function applyPageFilters() {
        const sy = document.getElementById('filterSchoolYear').value.toLowerCase();
        const st = document.getElementById('filterStatus').value.toLowerCase();
        const trs = document.querySelectorAll('#dataTable tbody tr');
        let count = 0;
        
        trs.forEach(tr => {
            if (tr.children.length < 4) return; // Skip "no records" row
            const rowSy = tr.children[2].textContent.toLowerCase();
            const rowSt = tr.children[8].textContent.toLowerCase();
            
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

    <!-- ── Add Case Modal ────────────────────────────────────────────────── -->
    <div id="addCaseModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2>Add New Case Record</h2>
                <button class="modal-close" onclick="closeAddCaseModal()">
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
                        <label>Select Student</label>
                        <div id="drill_student_list" style="display: grid; gap: 0.5rem; max-height: 250px; overflow-y: auto; padding: 0.5rem; border: 1px solid var(--border-light); border-radius: 6px; background: #f8fafc;">
                            <!-- Student rows populated via JS -->
                        </div>
                    </div>
                </div>

                <!-- STEP 2: The Case Form -->
                <div id="add-step-2" style="display: none;">
                    <form id="case-form">
                        <input type="hidden" id="student_id" name="student_id">
                        
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label>Student Name</label>
                                <input type="text" id="display_student_name" class="form-control" readonly style="background: #f1f5f9; font-weight: 600;">
                            </div>
                            <div class="form-group">
                                <label for="case_number">Case Number</label>
                                <input type="text" id="case_number" name="case_number" class="form-control" value="<?php echo $next_case_number; ?>" readonly required>
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
                                <label for="case_type">Case Type</label>
                                <select id="case_type" name="case_type" class="form-control" required onchange="if(this.value==='Other'){document.getElementById('case_type_other').style.display='block';document.getElementById('case_type_other').required=true;}else{document.getElementById('case_type_other').style.display='none';document.getElementById('case_type_other').required=false;}">
                                    <option value="Bullying">Bullying</option>
                                    <option value="Physical Violence/Altercation">Physical Violence/Altercation</option>
                                    <option value="Sexual Violence/Abuse">Sexual Violence/Abuse</option>
                                    <option value="Verbal/Relational Conflict">Verbal/Relational Conflict</option>
                                    <option value="Behavioral Concern">Behavioral Concern</option>
                                    <option value="Emotional/Psychosocial Concern">Emotional/Psychosocial Concern</option>
                                    <option value="Academic Concern">Academic Concern</option>
                                    <option value="Family/Home Concern">Family/Home Concern</option>
                                    <option value="Other">Other</option>
                                </select>
                                <input type="text" id="case_type_other" name="case_type_other" class="form-control" style="display:none; margin-top:0.5rem;" placeholder="Specify case type...">
                            </div>
                            <div class="form-group">
                                <label for="outcome_disposition">Outcome/Disposition</label>
                                <select id="outcome_disposition" name="outcome_disposition" class="form-control" required>
                                    <option value="Ongoing">Ongoing</option>
                                    <option value="To Follow-Up">To Follow-Up</option>
                                    <option value="Referred">Referred</option>
                                    <option value="Closed/Resolved">Closed/Resolved</option>
                                </select>
                            </div>
                            <div class="form-group full-width">
                                <label for="brief_description">Brief Description</label>
                                <textarea id="brief_description" name="brief_description" class="form-control"></textarea>
                            </div>
                            <div class="form-group full-width">
                                <label for="actions_taken">Actions Taken</label>
                                <textarea id="actions_taken" name="actions_taken" class="form-control"></textarea>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                            <button type="button" class="submit-btn" style="background: #94a3b8; color: white;" onclick="backToStep1()">Back to Selection</button>
                            <div style="display: flex; gap: 1rem; align-items: center; flex: 1; justify-content: flex-end;">
                                <div id="case-response" style="margin-top: 0; padding: 0.5rem 1rem; display:none; border-radius:6px;"></div>
                                <button type="submit" class="submit-btn" id="case-btn">Save Record</button>
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
                                <th>Case No.</th>
                                <th>Student Name</th>
                                <th>School Year</th>
                                <th>Date</th>
                                <th>Grade & Section</th>
                                <th>Case Type</th>
                                <th>Brief Description</th>
                                <th>Actions Taken</th>
                                <th>Outcome</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($cases)): ?>
                            <tr>
                                <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No case records found.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach($cases as $case): ?>
                                <tr>
                                    <td style="color: var(--text-muted);"><?php echo htmlspecialchars($case['case_number']); ?></td>
                                    <td style="font-weight: 500; color: var(--text-dark);"><?php echo htmlspecialchars($case['student_name'] ?? 'Unknown'); ?></td>
                                    <td><?php echo htmlspecialchars($case['school_year']); ?></td>
                                    <td><?php echo htmlspecialchars(date('M d, Y', strtotime($case['date']))); ?></td>
                                    <td><?php echo htmlspecialchars($case['grade_section']); ?></td>
                                    <td><?php echo htmlspecialchars($case['case_type']); ?></td>
                                    <td><?php echo htmlspecialchars(substr($case['brief_description'], 0, 30)) . (strlen($case['brief_description']) > 30 ? '...' : ''); ?></td>
                                    <td><?php echo htmlspecialchars(substr($case['actions_taken'], 0, 30)) . (strlen($case['actions_taken']) > 30 ? '...' : ''); ?></td>
                                    <td>
                                        <?php 
                                            $outcome = $case['outcome_disposition'];
                                            $bg = '#f1f5f9'; $color = '#475569';
                                            if ($outcome == 'Closed/Resolved') { $bg = '#dcfce7'; $color = '#166534'; }
                                            elseif ($outcome == 'Ongoing') { $bg = '#fef3c7'; $color = '#92400e'; }
                                            elseif ($outcome == 'Referred') { $bg = '#dbeafe'; $color = '#1e40af'; }
                                        ?>
                                        <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; background: <?php echo $bg; ?>; color: <?php echo $color; ?>;">
                                            <?php echo htmlspecialchars($outcome); ?>
                                        </span>
                                    </td>
                                    <td>
                                        <button onclick="openEditCaseModal(<?php echo $case['id']; ?>)" style="background: #f1f5f9; color: var(--primary); border: 1px solid #cbd5e1; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
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

    <!-- Edit Case Modal -->
    <div id="editCaseModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Case Record</h2>
                <button class="modal-close" onclick="closeEditCaseModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="edit-case-form">
                    <input type="hidden" id="edit_case_id" name="edit_case_id">
                    
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
                            <label for="edit_case_number">Case Number</label>
                            <input type="text" id="edit_case_number" name="edit_case_number" class="form-control" readonly required>
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
                                <label for="edit_case_type">Case Type</label>
                                <select id="edit_case_type" name="edit_case_type" class="form-control" required onchange="if(this.value==='Other'){document.getElementById('edit_case_type_other').style.display='block';document.getElementById('edit_case_type_other').required=true;}else{document.getElementById('edit_case_type_other').style.display='none';document.getElementById('edit_case_type_other').required=false;}">
                                    <option value="Bullying">Bullying</option>
                                    <option value="Physical Violence/Altercation">Physical Violence/Altercation</option>
                                    <option value="Sexual Violence/Abuse">Sexual Violence/Abuse</option>
                                    <option value="Verbal/Relational Conflict">Verbal/Relational Conflict</option>
                                    <option value="Behavioral Concern">Behavioral Concern</option>
                                    <option value="Emotional/Psychosocial Concern">Emotional/Psychosocial Concern</option>
                                    <option value="Academic Concern">Academic Concern</option>
                                    <option value="Family/Home Concern">Family/Home Concern</option>
                                    <option value="Other">Other</option>
                                </select>
                                <input type="text" id="edit_case_type_other" name="edit_case_type_other" class="form-control" style="display:none; margin-top:0.5rem;" placeholder="Specify case type...">
                            </div>
                        <div class="form-group">
                            <label for="edit_outcome_disposition">Outcome/Disposition</label>
                            <select id="edit_outcome_disposition" name="edit_outcome_disposition" class="form-control" required>
                                <option value="Ongoing">Ongoing</option>
                                <option value="To Follow-Up">To Follow-Up</option>
                                <option value="Referred">Referred</option>
                                <option value="Closed/Resolved">Closed/Resolved</option>
                            </select>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_brief_description">Brief Description</label>
                            <textarea id="edit_brief_description" name="edit_brief_description" class="form-control"></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_actions_taken">Actions Taken</label>
                            <textarea id="edit_actions_taken" name="edit_actions_taken" class="form-control"></textarea>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="edit-case-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="button" onclick="deleteRecord('case_register', document.getElementById('edit_case_id').value)" style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Delete Record
                        </button>
                        <button type="submit" class="submit-btn" id="edit-case-btn">
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
        // --- Add Case Modal Logic ---
        function openAddCaseModal() {
            // Reset forms
            document.getElementById('case-form').reset();
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

            document.getElementById('addCaseModal').classList.add('active');
        }

        function closeAddCaseModal() {
            document.getElementById('addCaseModal').classList.remove('active');
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
                            
                            div.onclick = () => selectStudentForCase(s.id, s.full_name, grade, section, s.school_year);
                            
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

        function selectStudentForCase(id, name, grade, section, schoolYear) {
            document.getElementById('student_id').value = id;
            document.getElementById('display_student_name').value = name;
            document.getElementById('grade_section').value = `${grade} - ${section}`;
            
            const syEl = document.getElementById('school_year');
            if (schoolYear) {
                if (syEl.tomselect) syEl.tomselect.setValue(schoolYear);
                else syEl.value = schoolYear;
            }
            
            document.getElementById('add-step-1').style.display = 'none';
            document.getElementById('add-step-2').style.display = 'block';
        }
        document.getElementById('case-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('case-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('case-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(this);

            fetch('<?= BASE_URL ?>/api/process_case.php', {
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

        function openEditCaseModal(id) {
            fetch('<?= BASE_URL ?>/api/api_get_case.php?id=' + id)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        const record = data.data;
                        document.getElementById('edit_case_id').value = record.id;
                        document.getElementById('edit_student_id').value = record.student_id;
                        document.getElementById('edit_case_number').value = record.case_number;
                        document.getElementById('edit_school_year').value = record.school_year;
                        document.getElementById('edit_date').value = record.date;
                        document.getElementById('edit_grade_section').value = record.grade_section;
                        const caseTypeSelect = document.getElementById('edit_case_type');
                        const caseTypeOther = document.getElementById('edit_case_type_other');
                        
                        // Check if the record.case_type exists in our dropdown options
                        let isStandard = false;
                        for (let i = 0; i < caseTypeSelect.options.length; i++) {
                            if (caseTypeSelect.options[i].value === record.case_type && record.case_type !== 'Other') {
                                isStandard = true;
                                break;
                            }
                        }

                        if (isStandard) {
                            caseTypeSelect.value = record.case_type;
                            caseTypeOther.style.display = 'none';
                            caseTypeOther.required = false;
                            caseTypeOther.value = '';
                        } else {
                            caseTypeSelect.value = 'Other';
                            caseTypeOther.style.display = 'block';
                            caseTypeOther.required = true;
                            caseTypeOther.value = record.case_type;
                        }
                        
                        document.getElementById('edit_brief_description').value = record.brief_description;
                        document.getElementById('edit_actions_taken').value = record.actions_taken;
                        document.getElementById('edit_outcome_disposition').value = record.outcome_disposition;
                        
                        document.getElementById('editCaseModal').classList.add('active');
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => {
                    console.error('Error fetching record:', err);
                    alert('Could not fetch case details.');
                });
        }

        function closeEditCaseModal() {
            document.getElementById('editCaseModal').classList.remove('active');
            document.getElementById('edit-case-response').style.display = 'none';
        }

        document.getElementById('edit-case-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('edit-case-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('edit-case-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(this);

            fetch('<?= BASE_URL ?>/api/process_case_edit.php', {
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

