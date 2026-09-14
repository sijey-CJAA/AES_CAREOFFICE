document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize Tom Select on all form-control select elements
    document.querySelectorAll('select.form-control').forEach((el) => {
        new TomSelect(el, {
            create: false,
            dropdownParent: 'body',
            sortField: {
                field: "text",
                direction: "asc"
            }
        });
    });

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

            fetch(BASE_URL + '/api/process_learner.php', {
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

            fetch(BASE_URL + '/api/process_parent.php', {
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

/**
 * Global Search Function
 * Hooks into the topbar search input and filters rows in the table with id="dataTable".
 * It searches the text content of all table rows (tbody tr).
 */
function handleGlobalSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    if (!searchInput) return;

    const filter = searchInput.value.toLowerCase();
    const table = document.getElementById('dataTable');
    if (!table) return;

    const trs = table.getElementsByTagName('tbody')[0]?.getElementsByTagName('tr');
    if (!trs) return;

    let visibleCount = 0;
    for (let i = 0; i < trs.length; i++) {
        // Skip "No records found" rows or loading rows
        if (trs[i].classList.contains('loading-row') || trs[i].textContent.includes('No records found')) {
            continue;
        }
        
        const rowText = trs[i].textContent.toLowerCase();
        if (rowText.includes(filter)) {
            trs[i].style.display = '';
            visibleCount++;
        } else {
            trs[i].style.display = 'none';
        }
    }

    // Optionally update a "Showing X" counter if present
    const showingCounter = document.getElementById('showing-counter');
    if (showingCounter) {
        showingCounter.innerText = visibleCount;
    }
}

/**
 * Export Table to PDF
 * Dynamically loads html2pdf.js and converts the table to a PDF.
 */
function exportTableToPDF(tableId, filename = 'export.pdf') {
    const table = document.getElementById(tableId);
    if (!table) return;

    // We can just clone the table to strip out buttons and "display: none" rows
    const clone = table.cloneNode(true);
    
    // Remove hidden rows and action columns
    const rows = clone.querySelectorAll('tr');
    rows.forEach(row => {
        if (row.style.display === 'none' || row.textContent.includes('No records found') || row.textContent.includes('No assessment records found')) {
            row.remove();
        } else {
            const cols = row.querySelectorAll('th, td');
            cols.forEach(col => {
                if (col.innerText.trim() === 'Actions' || col.querySelector('button') || (col.querySelector('a') && col.innerText.trim() === 'Edit')) {
                    col.remove();
                }
            });
        }
    });

    // We need html2pdf. If it's not loaded, load it dynamically.
    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
            generatePDF(clone, filename);
        };
        document.head.appendChild(script);
    } else {
        generatePDF(clone, filename);
    }

    function generatePDF(element, filename) {
        // Wrap in a div to give it some padding and styling for the PDF
        const container = document.createElement('div');
        container.style.padding = '20px';
        container.style.fontFamily = 'sans-serif';
        
        const title = document.createElement('h2');
        title.innerText = filename.replace('.pdf', '').toUpperCase() + ' REPORT';
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        container.appendChild(title);
        
        // Ensure the table looks good in PDF
        element.style.width = '100%';
        element.style.borderCollapse = 'collapse';
        element.querySelectorAll('th, td').forEach(cell => {
            cell.style.border = '1px solid #ddd';
            cell.style.padding = '8px';
            cell.style.textAlign = 'left';
            cell.style.fontSize = '10px';
        });
        element.querySelectorAll('th').forEach(th => {
            th.style.backgroundColor = '#f1f5f9';
        });

        container.appendChild(element);

        const opt = {
            margin:       10,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        html2pdf().set(opt).from(container).save();
    }
}

