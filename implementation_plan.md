# Migrate AES Care Office to Bootstrap 5

This document outlines the plan to completely transition the existing vanilla CSS user interface to the Bootstrap 5 framework. This will standardize the UI components, make it fully responsive using Bootstrap's grid, and allow for easier future additions.

## User Review Required

> [!WARNING]
> Migrating to Bootstrap 5 means we will replace almost all of your custom CSS (`style.css`). The unique "premium" look you currently have (custom blue shades, rounded floating cards, specific modal animations) will be replaced by Bootstrap's default component styling unless we write custom overrides. Are you sure you want a full Bootstrap UI replacement, or would you prefer a hybrid where we only use Bootstrap for layout/grid and keep the custom styling for cards and colors?

## Proposed Changes

### Global Layout & Dependencies
- Add Bootstrap 5 CSS and JS via CDN to all pages (`index.php`, `login.php`, and all files in `pages/`).
- Create a unified `includes/header.php` and `includes/footer.php` to avoid duplicating the CDN links across all 6 page files.

### Navigation (Sidebar & Topbar)
#### [MODIFY] `includes/sidebar.php`
- Convert custom sidebar to a Bootstrap offcanvas or a fixed `.d-flex .flex-column` sidebar.
- Replace custom `.nav-item` classes with Bootstrap's `.nav-link` and `.active` states.

#### [MODIFY] `includes/topbar.php`
- Convert to a standard Bootstrap `.navbar .navbar-light .bg-white .shadow-sm`.

### Dashboard
#### [MODIFY] `index.php`
- Replace custom CSS grid (`.stats-grid`) with Bootstrap's `.row .g-4`.
- Convert the 4 stat cards into Bootstrap `.card .border-0 .shadow-sm`.

### Data Pages (Learners, Parents, Assessments, Cases, Archive)
#### [MODIFY] `pages/learners.php`
#### [MODIFY] `pages/parents.php`
#### [MODIFY] `pages/assessments.php`
#### [MODIFY] `pages/cases.php`
#### [MODIFY] `pages/archive.php`
- **Tables**: Replace custom `.table-responsive` and table styling with Bootstrap's `.table .table-hover .table-striped .align-middle`.
- **Modals**: Rip out the custom `.modal-overlay` logic and replace it with Bootstrap's native Modal component (`data-bs-toggle="modal"`).
- **Forms**: Convert all `.form-group` and `.form-control` wrappers to Bootstrap's `.mb-3`, `.form-label`, and `.form-select`.
- **Learners Grade Tabs**: Convert the custom grade cards into Bootstrap `.nav .nav-tabs` or `.nav-pills` as requested in your original brief.

### Stylesheet
#### [MODIFY] `assets/css/style.css`
- Remove all the custom layout, modal, table, and form CSS.
- Keep only necessary utility overrides (like custom background colors if you want to keep the specific `--bg-main` gray).

## Verification Plan

### Manual Verification
- Navigate through all pages (Dashboard, Learners, Parents, etc.) to ensure the layout doesn't break.
- Open every "Add" and "Edit" modal to confirm Bootstrap's JS handles the toggling correctly.
- Ensure the AJAX filtering on the Learners page still updates the table without refreshing.
- Check mobile responsiveness using Bootstrap's grid classes.
