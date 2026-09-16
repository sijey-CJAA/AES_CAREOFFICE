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

$ALLOWED_GRADES = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];

// ── Detect whether the migration has been applied ──────────────────────────────
// This lets the page work before AND after running migration_grade_section.sql.
$check_col = $pdo->query("SHOW COLUMNS FROM `students` LIKE 'grade_level'")->fetch();
$migration_done = ($check_col !== false);

// ── Fetch per-grade counts for tab labels (initial page load) ──────────────────
$grade_counts = ['All' => 0];
foreach ($ALLOWED_GRADES as $g) { $grade_counts[$g] = 0; }

if ($migration_done) {
    $stmt_counts = $pdo->query("SELECT grade_level, COUNT(*) as cnt FROM students WHERE deleted_at IS NULL GROUP BY grade_level");
    while ($row = $stmt_counts->fetch(PDO::FETCH_ASSOC)) {
        if (array_key_exists($row['grade_level'], $grade_counts)) {
            $grade_counts[$row['grade_level']] = (int)$row['cnt'];
        }
        $grade_counts['All'] += (int)$row['cnt'];
    }
} else {
    // Migration not yet applied — just count all active learners
    $grade_counts['All'] = (int)$pdo->query("SELECT COUNT(*) FROM students WHERE deleted_at IS NULL")->fetchColumn();
}

// ── Fetch all active students for initial render ───────────────────────────────
if ($migration_done) {
    $stmt = $pdo->query("SELECT s.*, 
                                p1.full_name as primary_parent,
                                p2.full_name as secondary_parent
                         FROM students s
                         LEFT JOIN parents p1 ON s.id = p1.student_id AND p1.parent_type = 'Primary' AND p1.deleted_at IS NULL
                         LEFT JOIN parents p2 ON s.id = p2.student_id AND p2.parent_type = 'Secondary' AND p2.deleted_at IS NULL
                         WHERE s.deleted_at IS NULL 
                         ORDER BY s.grade_level, s.section, s.full_name ASC");
} else {
    $stmt = $pdo->query("SELECT s.*, 
                                p1.full_name as primary_parent,
                                p2.full_name as secondary_parent
                         FROM students s
                         LEFT JOIN parents p1 ON s.id = p1.student_id AND p1.parent_type = 'Primary' AND p1.deleted_at IS NULL
                         LEFT JOIN parents p2 ON s.id = p2.student_id AND p2.parent_type = 'Secondary' AND p2.deleted_at IS NULL
                         WHERE s.deleted_at IS NULL 
                         ORDER BY s.grade_section, s.full_name ASC");
}
$students = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learners Information | AES Care Office</title>
    <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
    <link href="https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/css/tom-select.css" rel="stylesheet">
    <style>
        /* ── Grade Cards ─────────────────────────────────────────────────────── */
        .grade-cards-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 0.875rem;
            margin-bottom: 1.5rem;
        }
        @media (max-width: 1100px) {
            .grade-cards-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 680px) {
            .grade-cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .grade-card {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: white;
            border: 1px solid var(--border-light);
            border-left: 3px solid transparent;
            border-radius: 10px;
            padding: 0.85rem 1rem;
            cursor: pointer;
            transition: transform 0.18s, box-shadow 0.18s, border-left-color 0.18s, background 0.18s;
            box-shadow: 0 2px 6px rgba(0,0,0,0.04);
            user-select: none;
            text-align: left;
        }
        .grade-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(39, 78, 19, 0.10);
            border-left-color: #274e13;
        }
        .grade-card.active {
            border-left-color: #274e13;
            background: rgba(39, 78, 19, 0.05);
            box-shadow: 0 4px 12px rgba(39, 78, 19, 0.12);
        }
        .grade-card-icon {
            flex-shrink: 0;
            width: 34px;
            height: 34px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.95rem;
        }
        .grade-card-body {
            min-width: 0;
        }
        .grade-card-label {
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .grade-card-count {
            font-size: 1.35rem;
            font-weight: 800;
            color: var(--text-dark);
            line-height: 1.1;
        }
        .grade-card.active .grade-card-count {
            color: #274e13;
        }

        /* ── Section Filter Bar ─────────────────────────────────────────────── */
        .section-filter-bar {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.25rem;
            flex-wrap: wrap;
        }
        .section-filter-bar label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted);
            white-space: nowrap;
        }
        .section-filter-bar select {
            padding: 0.45rem 2rem 0.45rem 0.75rem;
            border: 1px solid var(--border-light);
            border-radius: 8px;
            font-size: 0.875rem;
            color: var(--text-dark);
            background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 0.75rem center;
            appearance: none;
            -webkit-appearance: none;
            min-width: 180px;
            cursor: pointer;
        }
        .section-filter-bar select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
        }
        
        .section-pill {
            border: 1px solid #666;
            border-radius: 8px;
            padding: 0.35rem 1rem;
            font-size: 0.85rem;
            font-weight: 500;
            color: #111;
            cursor: pointer;
            text-transform: uppercase;
            background-color: transparent; /* overridden dynamically */
            transition: opacity 0.2s, border-width 0.1s;
        }
        .section-pill:hover {
            opacity: 0.8;
        }
        .section-pill.active {
            border-width: 2px;
            border-color: #000;
            font-weight: 700;
        }

        /* Table headers green styling */
        .data-table thead th {
            background-color: #274e13 !important;
            color: white !important;
            text-transform: uppercase;
        }

        /* ── Table loading state ─────────────────────────────────────────────── */
        #learner-table-body tr.loading-row td {
            text-align: center;
            padding: 2.5rem;
            color: var(--text-muted);
            font-style: italic;
        }
    </style>
</head>
<body>

    <?php include '../includes/sidebar.php'; ?>

    <div class="main-wrapper">
        <?php include '../includes/topbar.php'; ?>

        <main class="main-content">
            <div class="page-header-container">
                <h1 class="page-title">Learners</h1>
                <div class="page-controls">
                    <span style="color: var(--text-muted); font-size: 0.85rem; display:flex; align-items:center; gap:0.25rem;">
                        Total: <strong id="display-count" style="color:var(--text-dark);"><?= $grade_counts['All'] ?></strong>
                    </span>
                    <button class="control-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg> Filter</button>
                    <button class="control-btn" onclick="exportTableToPDF('dataTable', 'learners.pdf')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Export</button>
                    <button class="control-btn btn-primary" onclick="openAddLearnerModal()">+ Add New Learner</button>
                </div>
            </div>

            <!-- ── Table Card ────────────────────────────────────────────────── -->
            <div class="content-card">

                <?php if (!$migration_done): ?>
                <!-- Migration pending notice -->
                <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:0.9rem 1.25rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:0.75rem;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span style="font-size:0.875rem;color:#92400e;font-weight:600;">Grade tabs are pending — run <code style="background:#fde68a;padding:0.15rem 0.4rem;border-radius:4px;">migration_grade_section.sql</code> in phpMyAdmin to enable grade-level filtering.</span>
                </div>
                <?php else: ?>
                <!-- Grade Cards (All + Grade 1–6) -->
                <?php
                // Icon colours per slot (All + 6 grades)
                $card_styles = [
                    'All'          => ['bg' => 'rgba(22, 163, 74, 0.10)', 'color' => '#15803D', 'emoji' => '👥'],
                    'Kindergarten' => ['bg' => '#f4cce8', 'color' => '#a64d79', 'emoji' => '🖍️'],
                    'Grade 1'      => ['bg' => '#cfe2f3', 'color' => '#0b5394', 'emoji' => '1️⃣'],
                    'Grade 2'      => ['bg' => '#ead1dc', 'color' => '#741b47', 'emoji' => '2️⃣'],
                    'Grade 3'      => ['bg' => '#fce5cd', 'color' => '#b45f06', 'emoji' => '3️⃣'],
                    'Grade 4'      => ['bg' => '#d9ead3', 'color' => '#274e13', 'emoji' => '4️⃣'],
                    'Grade 5'      => ['bg' => '#fff2cc', 'color' => '#bf9000', 'emoji' => '5️⃣'],
                    'Grade 6'      => ['bg' => '#f4cccc', 'color' => '#990000', 'emoji' => '6️⃣'],
                ];
                $all_cards = array_merge(['All'], $ALLOWED_GRADES);
                ?>
                <div class="grade-cards-grid" id="grade-cards-grid">
                    <?php foreach ($all_cards as $g):
                        $cs    = $card_styles[$g];
                        $count = $grade_counts[$g];
                        $label = $g === 'All' ? 'All Grades' : $g;
                        $uid   = urlencode($g);
                        $isAll = ($g === 'All');
                    ?>
                    <div class="grade-card <?= $isAll ? 'active' : '' ?>"
                         data-grade="<?= htmlspecialchars($g) ?>"
                         onclick="switchGradeTab(this)"
                         title="<?= htmlspecialchars($label) ?>">
                        <div class="grade-card-icon" style="background:<?= $cs['bg'] ?>;color:<?= $cs['color'] ?>">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <?php if (!$isAll): ?>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                <?php else: ?>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                <?php endif; ?>
                            </svg>
                        </div>
                        <div class="grade-card-body">
                            <div class="grade-card-label"><?= htmlspecialchars($label) ?></div>
                            <div class="grade-card-count" id="count-<?= $uid ?>"><?= $count ?></div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>

                <div class="section-filter-bar" id="section-filter-bar" style="display: none;">
                    <div style="display: none;">
                        <label for="section-select">Section:</label>
                        <select id="section-select" onchange="applyFilters()">
                            <option value="All">All Sections</option>
                        </select>
                    </div>
                    <div id="section-pills" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-left: 0.5rem;">
                        <!-- Dynamically filled with pills -->
                    </div>
                </div>
                <?php endif; ?>

                <!-- Learner Table -->
                <div class="table-responsive" style="overflow-x: auto;">
                    <table class="data-table" id="dataTable" style="min-width: max-content;">
                        <thead>
                            <tr>
                                <th>Full Name</th>
                                <th>LRN</th>
                                <th>School Year</th>
                                <th>Grade Level</th>
                                <th>Section</th>
                                <th>Date of Birth</th>
                                <th>Blood Type</th>
                                <th>Status</th>
                                <th>Home Address</th>
                                <th>Allergies</th>
                                <th>Medications</th>
                                <th>Registered</th>
                                <th>Primary Parent</th>
                                <th>Secondary Parent</th>
                            </tr>
                        </thead>
                        <tbody id="learner-table-body">
                            <?php if (empty($students)): ?>
                            <tr>
                                <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 2rem;">No active learners found.</td>
                            </tr>
                            <?php else: ?>
                                <?php foreach ($students as $student): ?>
                                    <?= buildLearnerRow($student) ?>
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

    <!-- ── Add Learner Modal ─────────────────────────────────────────────────── -->
    <div id="addLearnerModal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add New Learner</h2>
                <button class="modal-close" onclick="closeAddLearnerModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="learner-form">
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
                            <label for="dob">Date of Birth</label>
                            <input type="date" id="dob" name="dob" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="grade_level">Grade Level</label>
                            <select id="grade_level" name="grade_level" class="form-control" required onchange="updateSections('grade_level', 'section')">
                                <option value="" disabled selected>Select Grade</option>
                                <?php foreach ($ALLOWED_GRADES as $g): ?>
                                    <option value="<?= htmlspecialchars($g) ?>"><?= htmlspecialchars($g) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="section">Section</label>
                            <select id="section" name="section" class="form-control" required>
                                <option value="" disabled selected>Select Section</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="school_year">School Year</label>
                            <select id="school_year" name="school_year" class="form-control" required>
                                <?php
                                $start_year = 2024;
                                $end_year = date("Y") + 1;
                                for ($y = $start_year; $y <= $end_year; $y++) {
                                    $sy = $y . '-' . ($y + 1);
                                    echo "<option value=\"$sy\">$sy</option>";
                                }
                                ?>
                            </select>
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
                        
                        <!-- Primary Parent Section -->
                        <h3 style="margin:1.5rem 0 0.5rem; color:var(--text-dark); border-bottom:1px solid var(--border-light); padding-bottom:0.5rem; grid-column: 1 / -1;">Primary Parent Details</h3>
                        <div class="form-group full-width">
                            <label for="p1_name">Full Name</label>
                            <input type="text" id="p1_name" name="p1_name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="p1_rel">Relationship</label>
                            <input type="text" id="p1_rel" name="p1_rel" class="form-control" placeholder="e.g. Mother, Father" required>
                        </div>
                        <div class="form-group">
                            <label for="p1_mobile">Mobile Number</label>
                            <input type="text" id="p1_mobile" name="p1_mobile" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="p1_telephone">Telephone Number</label>
                            <input type="text" id="p1_telephone" name="p1_telephone" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="p1_email">Email Address</label>
                            <input type="email" id="p1_email" name="p1_email" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="p1_address">Home Address</label>
                            <textarea id="p1_address" name="p1_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="p1_workplace">Workplace</label>
                            <input type="text" id="p1_workplace" name="p1_workplace" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="p1_workplace_address">Workplace Address</label>
                            <textarea id="p1_workplace_address" name="p1_workplace_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="p1_emergency">Emergency Contact Number</label>
                            <input type="text" id="p1_emergency" name="p1_emergency" class="form-control" required>
                        </div>

                        <!-- Secondary Parent Section -->
                        <h3 style="margin:1.5rem 0 0.5rem; color:var(--text-dark); border-bottom:1px solid var(--border-light); padding-bottom:0.5rem; grid-column: 1 / -1;">Secondary Parent Details</h3>
                        <div class="form-group full-width">
                            <label for="p2_name">Full Name</label>
                            <input type="text" id="p2_name" name="p2_name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="p2_rel">Relationship</label>
                            <input type="text" id="p2_rel" name="p2_rel" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="p2_mobile">Mobile Number</label>
                            <input type="text" id="p2_mobile" name="p2_mobile" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="p2_telephone">Telephone Number</label>
                            <input type="text" id="p2_telephone" name="p2_telephone" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="p2_email">Email Address</label>
                            <input type="email" id="p2_email" name="p2_email" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="p2_address">Home Address</label>
                            <textarea id="p2_address" name="p2_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="p2_workplace">Workplace</label>
                            <input type="text" id="p2_workplace" name="p2_workplace" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="p2_workplace_address">Workplace Address</label>
                            <textarea id="p2_workplace_address" name="p2_workplace_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="p2_emergency">Emergency Contact Number</label>
                            <input type="text" id="p2_emergency" name="p2_emergency" class="form-control" required>
                        </div>


                    </div>
                    <div style="display:flex;justify-content:flex-end;align-items:center;gap:1rem;margin-top:2rem;">
                        <div id="learner-response" style="flex:1;display:none;padding:0.5rem 1rem;border-radius:6px;"></div>
                        <button type="button" onclick="closeAddLearnerModal()" style="background:white;border:1px solid var(--border-color);padding:0.75rem 1.5rem;border-radius:8px;font-weight:600;cursor:pointer;color:var(--text-muted);">Cancel</button>
                        <button type="submit" class="submit-btn">Save Learner Record</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ── Edit Learner Modal ────────────────────────────────────────────────── -->
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
                            <label for="edit_dob">Date of Birth</label>
                            <input type="date" id="edit_dob" name="edit_dob" class="form-control" required>
                        </div>
                        <!-- Grade Level -->
                        <div class="form-group">
                            <label for="edit_grade_level">Grade Level</label>
                            <select id="edit_grade_level" name="edit_grade_level" class="form-control" required onchange="updateSections('edit_grade_level', 'edit_section')">
                                <option value="" disabled>Select Grade</option>
                                <?php foreach ($ALLOWED_GRADES as $g): ?>
                                    <option value="<?= htmlspecialchars($g) ?>"><?= htmlspecialchars($g) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <!-- Section -->
                        <div class="form-group">
                            <label for="edit_section">Section</label>
                            <select id="edit_section" name="edit_section" class="form-control" required>
                                <option value="" disabled selected>Select Section</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit_school_year">School Year</label>
                            <select id="edit_school_year" name="edit_school_year" class="form-control" required>
                                <?php
                                $start_year = 2024;
                                $end_year = date("Y") + 1;
                                for ($y = $start_year; $y <= $end_year; $y++) {
                                    $sy = $y . '-' . ($y + 1);
                                    echo "<option value=\"$sy\">$sy</option>";
                                }
                                ?>
                            </select>
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

                        <!-- Primary Parent Section -->
                        <h3 style="margin:1.5rem 0 0.5rem; color:var(--text-dark); border-bottom:1px solid var(--border-light); padding-bottom:0.5rem; grid-column: 1 / -1;">Primary Parent Details</h3>
                        <input type="hidden" id="edit_p1_id" name="edit_p1_id">
                        <div class="form-group full-width">
                            <label for="edit_p1_name">Full Name</label>
                            <input type="text" id="edit_p1_name" name="edit_p1_name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p1_rel">Relationship</label>
                            <input type="text" id="edit_p1_rel" name="edit_p1_rel" class="form-control" placeholder="e.g. Mother, Father" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p1_mobile">Mobile Number</label>
                            <input type="text" id="edit_p1_mobile" name="edit_p1_mobile" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p1_telephone">Telephone Number</label>
                            <input type="text" id="edit_p1_telephone" name="edit_p1_telephone" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p1_email">Email Address</label>
                            <input type="email" id="edit_p1_email" name="edit_p1_email" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p1_address">Home Address</label>
                            <textarea id="edit_p1_address" name="edit_p1_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p1_workplace">Workplace</label>
                            <input type="text" id="edit_p1_workplace" name="edit_p1_workplace" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p1_workplace_address">Workplace Address</label>
                            <textarea id="edit_p1_workplace_address" name="edit_p1_workplace_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p1_emergency">Emergency Contact Number</label>
                            <input type="text" id="edit_p1_emergency" name="edit_p1_emergency" class="form-control" required>
                        </div>

                        <!-- Secondary Parent Section -->
                        <h3 style="margin:1.5rem 0 0.5rem; color:var(--text-dark); border-bottom:1px solid var(--border-light); padding-bottom:0.5rem; grid-column: 1 / -1;">Secondary Parent Details</h3>
                        <input type="hidden" id="edit_p2_id" name="edit_p2_id">
                        <div class="form-group full-width">
                            <label for="edit_p2_name">Full Name</label>
                            <input type="text" id="edit_p2_name" name="edit_p2_name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p2_rel">Relationship</label>
                            <input type="text" id="edit_p2_rel" name="edit_p2_rel" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p2_mobile">Mobile Number</label>
                            <input type="text" id="edit_p2_mobile" name="edit_p2_mobile" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_p2_telephone">Telephone Number</label>
                            <input type="text" id="edit_p2_telephone" name="edit_p2_telephone" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p2_email">Email Address</label>
                            <input type="email" id="edit_p2_email" name="edit_p2_email" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p2_address">Home Address</label>
                            <textarea id="edit_p2_address" name="edit_p2_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p2_workplace">Workplace</label>
                            <input type="text" id="edit_p2_workplace" name="edit_p2_workplace" class="form-control" required>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p2_workplace_address">Workplace Address</label>
                            <textarea id="edit_p2_workplace_address" name="edit_p2_workplace_address" class="form-control" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label for="edit_p2_emergency">Emergency Contact Number</label>
                            <input type="text" id="edit_p2_emergency" name="edit_p2_emergency" class="form-control" required>
                        </div>


                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="edit-learner-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px;"></div>
                        <button type="button" onclick="deleteRecord('students', document.getElementById('edit_learner_id').value)"
                            style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Delete Record
                        </button>
                        <button type="submit" class="submit-btn" id="edit-learner-btn">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- ── View Learner Modal ────────────────────────────────────────────────── -->
    <div id="viewLearnerModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2>Learner Full Information</h2>
                <button class="modal-close" onclick="closeViewLearnerModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body" style="padding-bottom: 2rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div><strong>Full Name:</strong> <span id="view_full_name"></span></div>
                    <div><strong>LRN:</strong> <span id="view_lrn"></span></div>
                    <div><strong>School Year:</strong> <span id="view_school_year"></span></div>
                    <div><strong>Grade & Section:</strong> <span id="view_grade_section"></span></div>
                    <div><strong>Date of Birth:</strong> <span id="view_dob"></span></div>
                    <div><strong>Blood Type:</strong> <span id="view_blood_type"></span></div>
                    <div><strong>Status:</strong> <span id="view_status"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Home Address:</strong> <span id="view_address"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Allergies:</strong> <span id="view_allergies"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Medications:</strong> <span id="view_medications"></span></div>
                </div>

                <h3 style="border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; margin-bottom: 1rem;">Primary Parent</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div><strong>Name:</strong> <span id="view_p1_name"></span></div>
                    <div><strong>Relationship:</strong> <span id="view_p1_rel"></span></div>
                    <div><strong>Mobile Number:</strong> <span id="view_p1_mobile"></span></div>
                    <div><strong>Emergency Contact:</strong> <span id="view_p1_emergency"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Home Address:</strong> <span id="view_p1_address"></span></div>
                </div>

                <h3 style="border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; margin-bottom: 1rem;">Secondary Parent</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div><strong>Name:</strong> <span id="view_p2_name"></span></div>
                    <div><strong>Relationship:</strong> <span id="view_p2_rel"></span></div>
                    <div><strong>Mobile Number:</strong> <span id="view_p2_mobile"></span></div>
                    <div><strong>Emergency Contact:</strong> <span id="view_p2_emergency"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Home Address:</strong> <span id="view_p2_address"></span></div>
                </div>

                <div style="display: flex; justify-content: flex-end;">
                    <button id="view_edit_btn" class="submit-btn" style="padding: 0.75rem 2rem;">Edit Details</button>
                </div>
            </div>
        </div>
    </div>

    <!-- ── Add Section Modal ────────────────────────────────────────────────── -->
    <div id="addSectionModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>Add New Section</h2>
                <button class="modal-close" onclick="closeAddSectionModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                <form id="add-section-form">
                    <input type="hidden" id="add_section_grade" name="grade_level">
                    <div class="form-group full-width">
                        <label for="new_section_name">Section Name</label>
                        <input type="text" id="new_section_name" name="section_name" class="form-control" required placeholder="e.g. Ruby">
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <div id="add-section-response" style="margin-top: 0; padding: 0.5rem 1rem; flex: 1; display:none; border-radius:6px; font-size:0.85rem;"></div>
                        <button type="submit" class="submit-btn" id="add-section-btn">Add</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/js/tom-select.complete.min.js"></script>
    <script src="<?= BASE_URL ?>/assets/js/main.js"></script>
    <script>
        // ── Grades and Sections Mapping ────────────────────────────────────────
        const gradeSections = <?= file_get_contents('../config/sections.json') ?>;

        function updateSections(gradeElementId, sectionElementId) {
            const gradeSelect = document.getElementById(gradeElementId);
            const sectionSelect = document.getElementById(sectionElementId);
            const selectedGrade = gradeSelect.value;
            const sections = gradeSections[selectedGrade] || [];

            if (sectionSelect.tomselect) {
                const ts = sectionSelect.tomselect;
                ts.clear();
                ts.clearOptions();
                ts.addOption({value: '', text: 'Select Section', disabled: true});
                sections.forEach(s => ts.addOption({value: s, text: s}));
                ts.refreshOptions(false);
            } else {
                sectionSelect.innerHTML = '<option value="" disabled selected>Select Section</option>';
                sections.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    sectionSelect.appendChild(opt);
                });
            }
        }

        // ── State ──────────────────────────────────────────────────────────────
        let currentGrade   = 'All';
        let currentSection = 'All';
        // Passed from PHP — controls whether AJAX filtering is active
        const MIGRATION_DONE = <?= $migration_done ? 'true' : 'false' ?>;

        // ── Add-form toggle ───────────────────────────────────────────────────
        function toggleAddForm() {
            const sec = document.getElementById('add-learner-section');
            sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
        }

        // ── Grade card switch ─────────────────────────────────────────────────
        function switchGradeTab(card) {
            document.querySelectorAll('.grade-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            currentGrade   = card.dataset.grade;
            currentSection = 'All';

            const filterBar     = document.getElementById('section-filter-bar');
            const sectionSelect = document.getElementById('section-select');

            if (currentGrade === 'All') {
                filterBar.style.display = 'none';
                sectionSelect.innerHTML = '<option value="All">All Sections</option>';
                loadLearners();
            } else {
                filterBar.style.display = 'flex';
                // loadLearners will also repopulate the section dropdown
                loadLearners();
            }
        }

        // ── Section dropdown changed ──────────────────────────────────────────
        function applyFilters() {
            currentSection = document.getElementById('section-select').value;
            loadLearners();
        }

        // ── AJAX: fetch filtered learners ─────────────────────────────────────
        function loadLearners() {
            if (!MIGRATION_DONE) return; // columns don't exist yet — nothing to do
            const tbody = document.getElementById('learner-table-body');
            tbody.innerHTML = '<tr class="loading-row"><td colspan="12">Loading…</td></tr>';

            const params = new URLSearchParams();
            params.set('grade_level', currentGrade);
            params.set('section', currentSection);

            fetch(BASE_URL + '/api/api_get_learners_filtered.php?' + params.toString())
                .then(res => res.json())
                .then(data => {
                    if (data.status !== 'success') {
                        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:2rem;">Error loading learners.</td></tr>';
                        return;
                    }

                    // Update tab counts
                    updateTabCounts(data.counts);

                    // Update section dropdown (only when a specific grade is selected)
                    if (currentGrade !== 'All' && data.sections) {
                        updateSectionDropdown(data.sections);
                    }

                    // Update display count
                    document.getElementById('display-count').textContent = data.data.length;

                    // Render rows
                    if (data.data.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:2rem;">No learners found for this filter.</td></tr>';
                        return;
                    }
                    tbody.innerHTML = data.data.map(buildRow).join('');
                })
                .catch(() => {
                    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:2rem;">Could not load learners.</td></tr>';
                });
        }

        // ── Update tab count badges ───────────────────────────────────────────
        function updateTabCounts(counts) {
            Object.entries(counts).forEach(([grade, cnt]) => {
                const el = document.getElementById('count-' + encodeURIComponent(grade));
                if (el) el.textContent = cnt;
            });
        }

        // ── Rebuild section dropdown and pills ────────────────────────────────
        function updateSectionDropdown(sections) {
            const sel = document.getElementById('section-select');
            const pillsContainer = document.getElementById('section-pills');
            
            const prevVal = sel.value;
            sel.innerHTML = '<option value="All">All Sections</option>';
            pillsContainer.innerHTML = '';
            
            const gradeColors = {
                'Kindergarten': '#f4cce8',
                'Grade 1': '#cfe2f3',
                'Grade 2': '#ead1dc',
                'Grade 3': '#fce5cd',
                'Grade 4': '#d9ead3',
                'Grade 5': '#fff2cc',
                'Grade 6': '#f4cccc'
            };
            const bgColor = gradeColors[currentGrade] || '#f1f5f9';

            // Always render an "All Sections" pill
            const allPill = document.createElement('button');
            allPill.className = 'section-pill' + ('All' === currentSection ? ' active' : '');
            allPill.textContent = 'ALL SECTIONS';
            allPill.style.backgroundColor = 'All' === currentSection ? bgColor : 'transparent';
            allPill.onclick = function() {
                sel.value = 'All';
                applyFilters();
            };
            pillsContainer.appendChild(allPill);

            sections.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                if (s === prevVal) opt.selected = true;
                sel.appendChild(opt);
                
                const pill = document.createElement('button');
                pill.className = 'section-pill' + (s === currentSection ? ' active' : '');
                pill.textContent = s;
                pill.style.backgroundColor = bgColor;
                pill.onclick = function() {
                    sel.value = s;
                    applyFilters();
                };
                pillsContainer.appendChild(pill);
            });

            // Add "+ ADD SECTION" button at the end
            const addPill = document.createElement('button');
            addPill.className = 'section-pill';
            addPill.textContent = '+ ADD SECTION';
            addPill.style.backgroundColor = '#fce4e4'; // Match the requested pinkish style
            addPill.onclick = function() {
                openAddSectionModal(currentGrade);
            };
            pillsContainer.appendChild(addPill);

            // Keep currentSection in sync
            currentSection = sel.value;
        }

        // ── Build a single table row from a student object ────────────────────
        function buildRow(s) {
            const statusColors = {
                'Currently Enrolled': { bg: '#dcfce7', color: '#166534' },
                'Graduated':          { bg: '#dbeafe', color: '#1e40af' },
                'Transferred':        { bg: '#fef3c7', color: '#92400e' },
                'Dropped Out':        { bg: '#fee2e2', color: '#991b1b' },
            };
            const sc = statusColors[s.status] || { bg: '#f1f5f9', color: '#475569' };

            const dob = s.date_of_birth
                ? new Date(s.date_of_birth).toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'})
                : '';
            const reg = new Date(s.created_at).toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});

            const truncate = (str, n) => {
                if (!str) return '';
                return str.length > n ? str.substring(0, n) + '…' : str;
            };

            return `<tr onclick="viewLearnerModal(${s.id})" style="cursor:pointer;" class="clickable-row">
                <td style="font-weight:500;color:var(--text-dark);">${esc(s.full_name)}</td>
                <td style="color:var(--text-muted);">${esc(s.lrn)}</td>
                <td>${esc(s.school_year || '')}</td>
                <td>${esc(s.grade_level || s.grade_section || '')}</td>
                <td>${esc(s.section || '')}</td>
                <td>${esc(dob)}</td>
                <td>${esc(s.blood_type || '')}</td>
                <td><span style="padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;background:${sc.bg};color:${sc.color};">${esc(s.status || 'Unknown / Not Indicated')}</span></td>
                <td>${esc(truncate(s.home_address, 30))}</td>
                <td>${esc(truncate(s.allergies, 30))}</td>
                <td>${esc(truncate(s.medications, 30))}</td>
                <td style="color:var(--text-muted);">${esc(reg)}</td>
                <td>${esc(s.primary_parent || '')}</td>
                <td>${esc(s.secondary_parent || '')}</td>
            </tr>`;
        }

        // ── HTML-escape helper ────────────────────────────────────────────────
        function esc(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // ── Add modal ────────────────────────────────────────────────────────
        function openAddLearnerModal() {
            document.getElementById('addLearnerModal').classList.add('active');
        }
        function closeAddLearnerModal() {
            document.getElementById('addLearnerModal').classList.remove('active');
            const responseDiv = document.getElementById('learner-response');
            if (responseDiv) responseDiv.style.display = 'none';
        }
        // Close on backdrop click
        document.getElementById('addLearnerModal').addEventListener('click', function(e) {
            if (e.target === this) closeAddLearnerModal();
        });

        // ── Edit modal ────────────────────────────────────────────────────────
        function openEditLearnerModal(id) {
            fetch(BASE_URL + '/api/api_get_learner.php?id=' + id)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        const learner = data.data;
                        document.getElementById('edit_learner_id').value    = learner.id;
                        document.getElementById('edit_learner_name').value  = learner.full_name;
                        document.getElementById('edit_lrn').value           = learner.lrn;
                        document.getElementById('edit_school_year').value   = learner.school_year || '';
                        document.getElementById('edit_dob').value           = learner.date_of_birth;
                        document.getElementById('edit_grade_level').value   = learner.grade_level || '';
                        
                        // Update grade level in TomSelect if available
                        const editGradeLevelTs = document.getElementById('edit_grade_level').tomselect;
                        if (editGradeLevelTs) {
                            editGradeLevelTs.setValue(learner.grade_level || '');
                        }

                        // Populate the sections dropdown based on the newly selected grade
                        updateSections('edit_grade_level', 'edit_section');

                        document.getElementById('edit_section').value       = learner.section || '';
                        
                        // Update section in TomSelect if available
                        const editSectionTs = document.getElementById('edit_section').tomselect;
                        if (editSectionTs) {
                            editSectionTs.setValue(learner.section || '');
                        }
                        
                        document.getElementById('edit_blood_type').value    = learner.blood_type || '';
                        document.getElementById('edit_status').value        = learner.status || 'Unknown / Not Indicated';
                        document.getElementById('edit_home_address').value  = learner.home_address;
                        document.getElementById('edit_allergies').value     = learner.allergies || '';
                        document.getElementById('edit_medications').value   = learner.medications || '';

                        // Clear parents first
                        document.getElementById('edit_p1_id').value = '';
                        document.getElementById('edit_p1_name').value = '';
                        document.getElementById('edit_p1_rel').value = '';
                        document.getElementById('edit_p1_mobile').value = '';
                        document.getElementById('edit_p1_telephone').value = '';
                        document.getElementById('edit_p1_email').value = '';
                        document.getElementById('edit_p1_address').value = '';
                        document.getElementById('edit_p1_workplace').value = '';
                        document.getElementById('edit_p1_workplace_address').value = '';
                        document.getElementById('edit_p1_emergency').value = '';

                        document.getElementById('edit_p2_id').value = '';
                        document.getElementById('edit_p2_name').value = '';
                        document.getElementById('edit_p2_rel').value = '';
                        document.getElementById('edit_p2_mobile').value = '';
                        document.getElementById('edit_p2_telephone').value = '';
                        document.getElementById('edit_p2_email').value = '';
                        document.getElementById('edit_p2_address').value = '';
                        document.getElementById('edit_p2_workplace').value = '';
                        document.getElementById('edit_p2_workplace_address').value = '';
                        document.getElementById('edit_p2_emergency').value = '';

                        if (learner.parents) {
                            learner.parents.forEach(p => {
                                if (p.parent_type === 'Primary') {
                                    document.getElementById('edit_p1_id').value = p.id;
                                    document.getElementById('edit_p1_name').value = p.full_name;
                                    document.getElementById('edit_p1_rel').value = p.relationship;
                                    document.getElementById('edit_p1_mobile').value = p.mobile_number;
                                    document.getElementById('edit_p1_telephone').value = p.telephone_number || '';
                                    document.getElementById('edit_p1_email').value = p.email_address || '';
                                    document.getElementById('edit_p1_address').value = p.home_address || '';
                                    document.getElementById('edit_p1_workplace').value = p.workplace || '';
                                    document.getElementById('edit_p1_workplace_address').value = p.workplace_address || '';
                                    document.getElementById('edit_p1_emergency').value = p.emergency_contact_number || '';
                                } else if (p.parent_type === 'Secondary') {
                                    document.getElementById('edit_p2_id').value = p.id;
                                    document.getElementById('edit_p2_name').value = p.full_name;
                                    document.getElementById('edit_p2_rel').value = p.relationship;
                                    document.getElementById('edit_p2_mobile').value = p.mobile_number;
                                    document.getElementById('edit_p2_telephone').value = p.telephone_number || '';
                                    document.getElementById('edit_p2_email').value = p.email_address || '';
                                    document.getElementById('edit_p2_address').value = p.home_address || '';
                                    document.getElementById('edit_p2_workplace').value = p.workplace || '';
                                    document.getElementById('edit_p2_workplace_address').value = p.workplace_address || '';
                                    document.getElementById('edit_p2_emergency').value = p.emergency_contact_number || '';
                                }
                            });
                        }



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
            // ... (keep edit learner form listener as is)
            e.preventDefault();
            const btn = document.getElementById('edit-learner-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving…';
            btn.disabled = true;

            const responseDiv = document.getElementById('edit-learner-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(this);

            fetch(BASE_URL + '/api/process_learner_edit.php', {
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
                        closeEditLearnerModal();
                        loadLearners(); // Refresh without full page reload
                    }, 900);
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

        // ── Add Section modal ──────────────────────────────────────────────────
        function openAddSectionModal(grade) {
            document.getElementById('add_section_grade').value = grade;
            document.getElementById('new_section_name').value = '';
            document.getElementById('add-section-response').style.display = 'none';
            document.getElementById('addSectionModal').classList.add('active');
        }

        function closeAddSectionModal() {
            document.getElementById('addSectionModal').classList.remove('active');
        }

        document.getElementById('add-section-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('add-section-btn');
            btn.disabled = true;
            btn.innerHTML = 'Adding...';

            const responseDiv = document.getElementById('add-section-response');
            responseDiv.style.display = 'none';

            const formData = new FormData(this);

            fetch(BASE_URL + '/api/process_add_section.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                responseDiv.style.display = 'block';
                responseDiv.innerHTML = data.message;
                
                if (data.status === 'success') {
                    responseDiv.className = 'msg-success';
                    // Update our local sections map
                    const grade = document.getElementById('add_section_grade').value;
                    gradeSections[grade] = data.sections;
                    
                    // Trigger section dropdown update to re-render pills
                    if (currentGrade === grade) {
                        updateSectionDropdown(gradeSections[grade]);
                    }
                    
                    setTimeout(() => {
                        closeAddSectionModal();
                    }, 800);
                } else {
                    responseDiv.className = 'msg-error';
                }
            })
            .catch(err => {
                responseDiv.style.display = 'block';
                responseDiv.className = 'msg-error';
                responseDiv.innerHTML = 'An unexpected error occurred.';
                console.error(err);
            })
            .finally(() => {
                btn.disabled = false;
                btn.innerHTML = 'Add';
            });
        });

        // ── View modal ────────────────────────────────────────────────────────
        function viewLearnerModal(id) {
            fetch(BASE_URL + '/api/api_get_learner.php?id=' + id)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        const learner = data.data;
                        
                        document.getElementById('view_full_name').textContent = learner.full_name;
                        document.getElementById('view_lrn').textContent = learner.lrn;
                        document.getElementById('view_school_year').textContent = learner.school_year || 'N/A';
                        document.getElementById('view_grade_section').textContent = `${learner.grade_level || learner.grade_section} - ${learner.section}`;
                        document.getElementById('view_dob').textContent = learner.date_of_birth ? new Date(learner.date_of_birth).toLocaleDateString('en-US', {month:'long', day:'2-digit', year:'numeric'}) : 'N/A';
                        document.getElementById('view_blood_type').textContent = learner.blood_type || 'N/A';
                        document.getElementById('view_status').textContent = learner.status || 'Unknown / Not Indicated';
                        document.getElementById('view_address').textContent = learner.home_address || 'N/A';
                        document.getElementById('view_allergies').textContent = learner.allergies || 'None';
                        document.getElementById('view_medications').textContent = learner.medications || 'None';

                        // Primary Parent
                        const p1Name = document.getElementById('view_p1_name');
                        const p1Rel = document.getElementById('view_p1_rel');
                        const p1Mobile = document.getElementById('view_p1_mobile');
                        const p1Emergency = document.getElementById('view_p1_emergency');
                        const p1Address = document.getElementById('view_p1_address');
                        p1Name.textContent = 'N/A'; p1Rel.textContent = 'N/A'; p1Mobile.textContent = 'N/A'; p1Emergency.textContent = 'N/A'; p1Address.textContent = 'N/A';

                        // Secondary Parent
                        const p2Name = document.getElementById('view_p2_name');
                        const p2Rel = document.getElementById('view_p2_rel');
                        const p2Mobile = document.getElementById('view_p2_mobile');
                        const p2Emergency = document.getElementById('view_p2_emergency');
                        const p2Address = document.getElementById('view_p2_address');
                        p2Name.textContent = 'N/A'; p2Rel.textContent = 'N/A'; p2Mobile.textContent = 'N/A'; p2Emergency.textContent = 'N/A'; p2Address.textContent = 'N/A';

                        if (learner.parents) {
                            learner.parents.forEach(p => {
                                if (p.parent_type === 'Primary') {
                                    p1Name.textContent = p.full_name || 'N/A';
                                    p1Rel.textContent = p.relationship || 'N/A';
                                    p1Mobile.textContent = p.mobile_number || 'N/A';
                                    p1Emergency.textContent = p.emergency_contact_number || 'N/A';
                                    p1Address.textContent = p.home_address || 'N/A';
                                } else if (p.parent_type === 'Secondary') {
                                    p2Name.textContent = p.full_name || 'N/A';
                                    p2Rel.textContent = p.relationship || 'N/A';
                                    p2Mobile.textContent = p.mobile_number || 'N/A';
                                    p2Emergency.textContent = p.emergency_contact_number || 'N/A';
                                    p2Address.textContent = p.home_address || 'N/A';
                                }
                            });
                        }

                        document.getElementById('view_edit_btn').onclick = function() {
                            closeViewLearnerModal();
                            openEditLearnerModal(learner.id);
                        };

                        document.getElementById('viewLearnerModal').classList.add('active');
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => {
                    console.error('Error fetching learner:', err);
                    alert('Could not fetch learner details.');
                });
        }

        function closeViewLearnerModal() {
            document.getElementById('viewLearnerModal').classList.remove('active');
        }

        document.getElementById('viewLearnerModal').addEventListener('click', function(e) {
            if (e.target === this) closeViewLearnerModal();
        });

        // Event Listeners for Edit modal
        document.getElementById('editLearnerModal').addEventListener('click', function(e) {
            if (e.target === this) closeEditLearnerModal();
        });

        // ── Soft delete ───────────────────────────────────────────────────────
        function deleteRecord(table, id) {
            if (confirm("Are you sure you want to move this record to the trash? It can be restored from the Deleted Records page.")) {
                const formData = new FormData();
                formData.append('table', table);
                formData.append('id', id);

                fetch(BASE_URL + '/api/process_delete.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        closeEditLearnerModal();
                        loadLearners();
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

        // ── Add-form: reload table after successful save ───────────────────────
        // Intercept the form's success so the table refreshes without a full reload
        document.addEventListener('DOMContentLoaded', function () {
            const origHandler = document.getElementById('learner-form');
            // We piggyback on main.js's existing submit handler by listening to a
            // custom event dispatched after save, or we just poll the responseDiv.
            // Simpler approach: override submit in this page's context.
            if (origHandler) {
                origHandler.addEventListener('submit', function () {
                    // After a brief delay (main.js handles the fetch), refresh the table
                    setTimeout(() => {
                        const resp = document.getElementById('learner-response');
                        if (resp && resp.classList.contains('msg-success')) {
                            loadLearners();
                            closeAddLearnerModal();
                        }
                    }, 1500);
                });
            }
        });
    </script>
</body>
</html>
<?php
// ── PHP helper: render a single <tr> for the initial server-side render ────────
function buildLearnerRow($student) {
    $status = $student['status'] ?? 'Unknown / Not Indicated';
    $status_bg = '#f1f5f9'; $status_color = '#475569';
    if ($status === 'Currently Enrolled') { $status_bg = '#dcfce7'; $status_color = '#166534'; }
    elseif ($status === 'Graduated')      { $status_bg = '#dbeafe'; $status_color = '#1e40af'; }
    elseif ($status === 'Transferred')    { $status_bg = '#fef3c7'; $status_color = '#92400e'; }
    elseif ($status === 'Dropped Out')    { $status_bg = '#fee2e2'; $status_color = '#991b1b'; }

    $grade_level = htmlspecialchars($student['grade_level'] ?? $student['grade_section'] ?? '');
    $section     = htmlspecialchars($student['section'] ?? '');
    $school_year = htmlspecialchars($student['school_year'] ?? '');
    $dob  = $student['date_of_birth'] ? date('M d, Y', strtotime($student['date_of_birth'])) : '';
    $reg  = date('M d, Y', strtotime($student['created_at']));
    $addr = htmlspecialchars(substr($student['home_address'], 0, 30)) . (strlen($student['home_address']) > 30 ? '…' : '');
    $alrg = htmlspecialchars(substr($student['allergies'] ?: '', 0, 30)) . (strlen($student['allergies'] ?: '') > 30 ? '…' : '');
    $meds = htmlspecialchars(substr($student['medications'] ?: '', 0, 30)) . (strlen($student['medications'] ?: '') > 30 ? '…' : '');

    $p1 = htmlspecialchars($student['primary_parent'] ?? '');
    $p2 = htmlspecialchars($student['secondary_parent'] ?? '');

    return "
        <tr onclick='viewLearnerModal({$student['id']})' style='cursor:pointer;' class='clickable-row'>
            <td style='font-weight:500;color:var(--text-dark);'>" . htmlspecialchars($student['full_name']) . "</td>
            <td style='color:var(--text-muted);'>" . htmlspecialchars($student['lrn']) . "</td>
            <td>{$school_year}</td>
            <td>{$grade_level}</td>
            <td>{$section}</td>
            <td>" . htmlspecialchars($dob) . "</td>
            <td>" . htmlspecialchars($student['blood_type'] ?: '') . "</td>
            <td><span style='padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;background:{$status_bg};color:{$status_color};'>" . htmlspecialchars($status) . "</span></td>
            <td>{$addr}</td>
            <td>{$alrg}</td>
            <td>{$meds}</td>
            <td style='color:var(--text-muted);'>" . htmlspecialchars($reg) . "</td>
            <td>{$p1}</td>
            <td>{$p2}</td>
        </tr>";
}
?>
