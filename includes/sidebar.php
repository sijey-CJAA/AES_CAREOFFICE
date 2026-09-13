<?php
// includes/sidebar.php
$current_page = basename($_SERVER['PHP_SELF']);
?>
<aside class="sidebar">
    <div class="sidebar-header">
        <div class="sidebar-logo-icon">AE</div>
        <div>
            <div class="sidebar-title">AES Care Office</div>
            <div class="sidebar-subtitle">Counselor Portal</div>
        </div>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-label">Navigation</div>
        
        <a href="/index.php" class="nav-item <?php echo $current_page == 'index.php' ? 'active' : ''; ?>">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Dashboard
        </a>
        
        <div class="nav-label">INFORMATION</div>
        <a href="/pages/learners.php" class="nav-item <?php echo ($current_page == 'learners.php' || $current_page == 'view_learners.php') ? 'active' : ''; ?>">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Learners Information
        </a>
        <a href="/pages/parents.php" class="nav-item <?php echo ($current_page == 'parents.php' || $current_page == 'view_parents.php') ? 'active' : ''; ?>">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Parents Information
        </a>

        <div class="nav-label">GUIDANCE RECORDS</div>
        <a href="/pages/assessments.php" class="nav-item <?php echo ($current_page == 'assessments.php' || $current_page == 'view_assessments.php') ? 'active' : ''; ?>">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Assessment Records
        </a>
        <a href="/pages/cases.php" class="nav-item <?php echo ($current_page == 'cases.php' || $current_page == 'view_cases.php') ? 'active' : ''; ?>">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Case Register
        </a>

        <div class="nav-label">SYSTEM</div>
        <a href="/pages/archive.php" class="nav-item <?php echo ($current_page == 'archive.php' || $current_page == 'view_deleted.php') ? 'active' : ''; ?>">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            Deleted Records
        </a>
        <a href="/logout.php" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
        </a>
    </nav>

    <div class="sidebar-footer">
        <div class="user-avatar"><?php echo strtoupper(substr($user_name, 0, 1)); ?></div>
        <div class="user-info">
            <div class="user-name"><?php echo htmlspecialchars($user_name); ?></div>
            <div class="user-email" title="<?php echo htmlspecialchars($user_email); ?>">
                <?php echo htmlspecialchars((strlen($user_email) > 20) ? substr($user_email, 0, 17) . '...' : $user_email); ?>
            </div>
        </div>
    </div>
</aside>
