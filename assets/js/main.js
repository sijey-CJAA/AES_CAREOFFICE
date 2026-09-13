document.addEventListener('DOMContentLoaded', function() {
    
    const learnerForm = document.getElementById('learner-form');
    if (learnerForm) {
        learnerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = learnerForm.querySelector('.submit-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('learner-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(learnerForm);

            fetch('process_learner.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                responseDiv.style.display = 'block';
                responseDiv.innerHTML = data.message;
                
                if (data.status === 'success') {
                    responseDiv.className = 'msg-success';
                    learnerForm.reset();
                    // Optionally, could refresh the page to update the parent dropdown, but user can do that manually.
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
    }

    const parentForm = document.getElementById('parent-form');
    if (parentForm) {
        parentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = parentForm.querySelector('.submit-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            const responseDiv = document.getElementById('parent-response');
            responseDiv.style.display = 'none';
            responseDiv.className = '';

            const formData = new FormData(parentForm);

            fetch('process_parent.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                responseDiv.style.display = 'block';
                responseDiv.innerHTML = data.message;
                
                if (data.status === 'success') {
                    responseDiv.className = 'msg-success';
                    parentForm.reset();
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
    }
});
