<?php
// includes/sidebar.php
$current_page = basename($_SERVER['PHP_SELF']);
?>
<aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
        <div class="sidebar-logo-icon">AE</div>
        <div class="sidebar-text-group">
            <div class="sidebar-title">AES Care Office</div>
            <div class="sidebar-subtitle">Counselor Portal</div>
        </div>
    </div>

    <!-- Collapse toggle button -->
    <button class="sidebar-toggle" id="sidebarToggle" title="Collapse sidebar" aria-label="Toggle sidebar">
        <svg id="toggleIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
    </button>

    <nav class="sidebar-nav">
        <div class="nav-label">Navigation</div>

        <a href="<?= BASE_URL ?>/index.php" class="nav-item <?php echo $current_page == 'index.php' ? 'active' : ''; ?>" data-tooltip="Dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span class="nav-text">Dashboard</span>
        </a>

        <div class="nav-label">INFORMATION</div>
        <a href="<?= BASE_URL ?>/pages/learners.php" class="nav-item <?php echo ($current_page == 'learners.php' || $current_page == 'view_learners.php') ? 'active' : ''; ?>" data-tooltip="Learners Information">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span class="nav-text">Learners Information</span>
        </a>

        <div class="nav-label">GUIDANCE RECORDS</div>
        <a href="<?= BASE_URL ?>/pages/assessments.php" class="nav-item <?php echo ($current_page == 'assessments.php' || $current_page == 'view_assessments.php') ? 'active' : ''; ?>" data-tooltip="Assessment Records">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span class="nav-text">Assessment Records</span>
        </a>
        <a href="<?= BASE_URL ?>/pages/cases.php" class="nav-item <?php echo ($current_page == 'cases.php' || $current_page == 'view_cases.php') ? 'active' : ''; ?>" data-tooltip="Case Register">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span class="nav-text">Case Register</span>
        </a>
        <a href="<?= BASE_URL ?>/pages/graduates.php" class="nav-item <?php echo ($current_page == 'graduates.php') ? 'active' : ''; ?>" data-tooltip="Graduates">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
            <span class="nav-text">Graduates</span>
        </a>

        <div class="nav-label">SYSTEM</div>
        <a href="<?= BASE_URL ?>/pages/archive.php" class="nav-item <?php echo ($current_page == 'archive.php' || $current_page == 'view_deleted.php') ? 'active' : ''; ?>" data-tooltip="Deleted Records">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            <span class="nav-text">Deleted Records</span>
        </a>
        
        <div style="margin-top: auto;"></div>
        
        <a href="<?= BASE_URL ?>/pages/logout.php" class="nav-item" data-tooltip="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span class="nav-text">Logout</span>
        </a>
    </nav>
</aside>

<script>
(function () {
    const sidebar   = document.getElementById('sidebar');
    const toggle    = document.getElementById('sidebarToggle');
    const icon      = document.getElementById('toggleIcon');
    const COLLAPSED = 'sidebar-collapsed';
    const LS_KEY    = 'aes_sidebar_collapsed';

    // Restore state from localStorage immediately (before paint)
    if (localStorage.getItem(LS_KEY) === '1') {
        sidebar.classList.add(COLLAPSED);
    }

    function updateIcon(collapsed) {
        // Pointing left (chevron-left) when expanded → click to collapse
        // Pointing right (chevron-right) when collapsed → click to expand
        icon.innerHTML = collapsed
            ? '<polyline points="9 18 15 12 9 6"></polyline>'   // chevron-right
            : '<polyline points="15 18 9 12 15 6"></polyline>';  // chevron-left
        toggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }

    // Initialise icon to match restored state
    updateIcon(sidebar.classList.contains(COLLAPSED));

    toggle.addEventListener('click', function () {
        const isNowCollapsed = sidebar.classList.toggle(COLLAPSED);
        localStorage.setItem(LS_KEY, isNowCollapsed ? '1' : '0');
        updateIcon(isNowCollapsed);
    });
})();
</script>
