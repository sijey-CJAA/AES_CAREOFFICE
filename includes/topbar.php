<div class="top-bar">
    <div class="search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" placeholder="Search">
    </div>
    <div class="top-bar-right">
        <div class="top-bar-icons">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        </div>
        <div class="user-profile" style="position: relative; user-select: none;" onclick="document.getElementById('profileDropdown').style.display = document.getElementById('profileDropdown').style.display === 'none' ? 'block' : 'none';">
            <img src="https://ui-avatars.com/api/?name=<?php echo urlencode($user_name); ?>&background=e2e8f0&color=64748b" class="user-avatar" alt="User">
            <div class="user-info">
                <span class="user-name"><?php echo htmlspecialchars($user_name); ?></span>
                <span class="user-email"><?php echo htmlspecialchars((strlen($user_email) > 20) ? substr($user_email, 0, 17) . '...' : $user_email); ?></span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><polyline points="6 9 12 15 18 9"></polyline></svg>

            <!-- Dropdown Menu -->
            <div id="profileDropdown" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid var(--border-color); width: 220px; z-index: 100;">
                <div style="padding: 0.5rem;">
                    <a href="#" onclick="event.stopPropagation(); document.getElementById('changePasswordModal').classList.add('active'); document.getElementById('profileDropdown').style.display='none';" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; color: var(--text-dark); text-decoration: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500;" onmouseover="this.style.background='var(--bg-main)'" onmouseout="this.style.background='transparent'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        Change Password
                    </a>
                    <hr style="border: none; border-top: 1px solid var(--border-color); margin: 0.5rem 0;">
                    <a href="<?= BASE_URL ?>/logout.php" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; color: var(--danger-text); text-decoration: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Log Out
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Change Password Modal -->
<div id="changePasswordModal" class="modal-overlay">
    <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
            <h2>Change Password</h2>
            <button class="modal-close" onclick="document.getElementById('changePasswordModal').classList.remove('active')"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div class="modal-body">
            <form id="changePasswordForm">
                <div class="form-group" style="margin-bottom: 1.25rem;">
                    <label>Current Password</label>
                    <div style="position: relative;">
                        <input type="password" id="cp_current" name="current_password" class="form-control" required style="width: 100%; padding-right: 2.5rem;">
                        <svg onclick="toggleModalPass('cp_current', 'eye_current')" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; cursor: pointer;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                            <line id="eye_current" x1="1" y1="1" x2="23" y2="23" stroke="#e2e8f0"></line>
                        </svg>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 1.25rem;">
                    <label>New Password</label>
                    <div style="position: relative;">
                        <input type="password" id="cp_new" name="new_password" class="form-control" required minlength="8" style="width: 100%; padding-right: 2.5rem;">
                        <svg onclick="toggleModalPass('cp_new', 'eye_new')" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; cursor: pointer;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                            <line id="eye_new" x1="1" y1="1" x2="23" y2="23" stroke="#e2e8f0"></line>
                        </svg>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>Confirm New Password</label>
                    <div style="position: relative;">
                        <input type="password" id="cp_confirm" name="confirm_password" class="form-control" required minlength="8" style="width: 100%; padding-right: 2.5rem;">
                        <svg onclick="toggleModalPass('cp_confirm', 'eye_confirm')" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; cursor: pointer;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                            <line id="eye_confirm" x1="1" y1="1" x2="23" y2="23" stroke="#e2e8f0"></line>
                        </svg>
                    </div>
                </div>
                <div id="cpError" style="color: #991b1b; background: #fee2e2; border-radius: 8px; padding: 0.75rem; font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>
                <button type="submit" class="control-btn btn-primary" style="width: 100%; justify-content: center; padding: 0.75rem;">Update Password</button>
            </form>
        </div>
    </div>
</div>

<script>
// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const profile = document.querySelector('.user-profile');
    if (profile && !profile.contains(event.target)) {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

function toggleModalPass(inputId, lineId) {
    const input = document.getElementById(inputId);
    const line = document.getElementById(lineId);
    if (input.type === 'password') {
        input.type = 'text';
        line.style.display = 'none';
    } else {
        input.type = 'password';
        line.style.display = 'block';
    }
}

// Handle change password form submission
document.getElementById('changePasswordForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const errDiv = document.getElementById('cpError');
    errDiv.style.display = 'none';
    
    if (formData.get('new_password') !== formData.get('confirm_password')) {
        errDiv.textContent = "New passwords do not match!";
        errDiv.style.display = 'block';
        return;
    }

    fetch('<?= BASE_URL ?>/api/change_password.php', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Password successfully updated!');
            document.getElementById('changePasswordModal').classList.remove('active');
            this.reset();
        } else {
            errDiv.textContent = data.message;
            errDiv.style.display = 'block';
        }
    })
    .catch(err => {
        console.error(err);
        errDiv.textContent = 'An unexpected error occurred. Please try again.';
        errDiv.style.display = 'block';
    });
});
</script>
