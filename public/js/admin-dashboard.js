let currentUser = null;
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};

// Helper function to convert UTC timestamp to IST
function toIST(dateString) {
  return new Date(dateString).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
  loadAnalytics();
  loadComplaints();
  setupEventListeners();
});

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = JSON.parse(user);
  if (currentUser.role !== 'admin') {
    window.location.href = 'student-dashboard.html';
    return;
  }
  
  document.getElementById('welcomeUser').textContent = `Welcome, ${currentUser.username}`;
}

function setupEventListeners() {
  const updateForm = document.getElementById('updateForm');
  updateForm.addEventListener('submit', updateComplaint);
  
  // Add enter key support for search
  document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });
}

async function loadAnalytics() {
  try {
    const response = await fetch('/admin/analytics', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      document.getElementById('totalComplaints').textContent = data.total;
      document.getElementById('pendingComplaints').textContent = data.pending;
      document.getElementById('inProgressComplaints').textContent = data.inProgress;
      document.getElementById('resolvedComplaints').textContent = data.resolved;
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
  }
}

async function loadComplaints(page = 1) {
  const tableError = document.getElementById('tableError');
  const tableLoading = document.getElementById('tableLoading');
  const tableBody = document.getElementById('complaintsTableBody');
  
  tableError.style.display = 'none';
  tableLoading.style.display = 'block';
  tableBody.innerHTML = '';
  
  try {
    const params = new URLSearchParams({
      page: page,
      limit: 10,
      ...currentFilters
    });
    
    const response = await fetch(`/complaints?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      tableLoading.style.display = 'none';
      displayComplaints(data.complaints);
      updatePagination(data.pagination);
    } else {
      tableError.textContent = data.error || 'Failed to load complaints';
      tableError.style.display = 'block';
      tableLoading.style.display = 'none';
    }
  } catch (error) {
    tableError.textContent = 'Network error. Please try again.';
    tableError.style.display = 'block';
    tableLoading.style.display = 'none';
  }
}

function displayComplaints(complaints) {
  const tableBody = document.getElementById('complaintsTableBody');
  
  if (complaints.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No complaints found.</td></tr>';
    return;
  }
  
  tableBody.innerHTML = complaints.map(complaint => `
    <tr>
      <td><strong>${complaint.tracking_id}</strong></td>
      <td>${complaint.username}</td>
      <td>${complaint.category}</td>
      <td>
        <div class="description-cell" title="${complaint.description}">
          ${complaint.description.length > 50 ? complaint.description.substring(0, 50) + '...' : complaint.description}
        </div>
      </td>
      <td><span class="priority priority-${complaint.priority.toLowerCase()}">${complaint.priority}</span></td>
      <td><span class="status status-${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span></td>
      <td>${toIST(complaint.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-outline" onclick="viewDetails(${complaint.id})">View</button>
          <button class="btn btn-sm btn-primary" onclick="openUpdateModal(${complaint.id}, '${complaint.status}', '${(complaint.remarks || '').replace(/'/g, "\\'")}')">Update</button>
          <button class="btn btn-sm btn-danger" onclick="deleteComplaint(${complaint.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updatePagination(pagination) {
  currentPage = pagination.page;
  totalPages = pagination.pages;
  const paginationDiv = document.getElementById('pagination');
  
  if (totalPages <= 1) {
    paginationDiv.innerHTML = '';
    return;
  }
  
  let paginationHTML = '';
  
  // Previous button
  if (currentPage > 1) {
    paginationHTML += `<button class="btn btn-outline" onclick="loadComplaints(${currentPage - 1})">Previous</button>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      paginationHTML += `<button class="btn btn-primary">${i}</button>`;
    } else {
      paginationHTML += `<button class="btn btn-outline" onclick="loadComplaints(${i})">${i}</button>`;
    }
  }
  
  // Next button
  if (currentPage < totalPages) {
    paginationHTML += `<button class="btn btn-outline" onclick="loadComplaints(${currentPage + 1})">Next</button>`;
  }
  
  paginationDiv.innerHTML = paginationHTML;
}

function applyFilters() {
  currentFilters = {
    status: document.getElementById('statusFilter').value,
    category: document.getElementById('categoryFilter').value,
    priority: document.getElementById('priorityFilter').value,
    search: document.getElementById('searchInput').value
  };
  
  // Remove empty filters
  Object.keys(currentFilters).forEach(key => {
    if (!currentFilters[key]) {
      delete currentFilters[key];
    }
  });
  
  currentPage = 1;
  loadComplaints(1);
}

function resetFilters() {
  document.getElementById('statusFilter').value = '';
  document.getElementById('categoryFilter').value = '';
  document.getElementById('priorityFilter').value = '';
  document.getElementById('searchInput').value = '';
  
  currentFilters = {};
  currentPage = 1;
  loadComplaints(1);
}

function openUpdateModal(id, status, remarks) {
  const modal = document.getElementById('updateModal');
  document.getElementById('updateId').value = id;
  document.getElementById('updateStatus').value = status;
  document.getElementById('updateRemarks').value = remarks;
  modal.style.display = 'block';
}

function closeUpdateModal() {
  document.getElementById('updateModal').style.display = 'none';
  document.getElementById('updateError').style.display = 'none';
}

async function updateComplaint(e) {
  e.preventDefault();
  
  const updateError = document.getElementById('updateError');
  const id = document.getElementById('updateId').value;
  const status = document.getElementById('updateStatus').value;
  const remarks = document.getElementById('updateRemarks').value;
  
  updateError.style.display = 'none';
  
  try {
    const response = await fetch(`/admin/complaint/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ status, remarks })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      closeUpdateModal();
      loadComplaints(currentPage);
      loadAnalytics();
    } else {
      updateError.textContent = data.error || 'Failed to update complaint';
      updateError.style.display = 'block';
    }
  } catch (error) {
    updateError.textContent = 'Network error. Please try again.';
    updateError.style.display = 'block';
  }
}

async function deleteComplaint(id) {
  if (!confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`/admin/complaint/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      loadComplaints(currentPage);
      loadAnalytics();
    } else {
      alert(data.error || 'Failed to delete complaint');
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

async function viewDetails(id) {
  try {
    const response = await fetch(`/complaints`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      const complaint = data.complaints.find(c => c.id === id);
      if (complaint) {
        displayComplaintDetails(complaint);
      }
    } else {
      alert(data.error || 'Failed to load complaint details');
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

function displayComplaintDetails(complaint) {
  const modal = document.getElementById('viewModal');
  const content = document.getElementById('viewContent');
  
  content.innerHTML = `
    <div class="complaint-details">
      <div class="detail-row">
        <strong>Tracking ID:</strong> ${complaint.tracking_id}
      </div>
      <div class="detail-row">
        <strong>Student:</strong> ${complaint.username}
      </div>
      <div class="detail-row">
        <strong>Category:</strong> ${complaint.category}
      </div>
      <div class="detail-row">
        <strong>Priority:</strong> <span class="priority priority-${complaint.priority.toLowerCase()}">${complaint.priority}</span>
      </div>
      <div class="detail-row">
        <strong>Status:</strong> <span class="status status-${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span>
      </div>
      <div class="detail-row">
        <strong>Description:</strong>
        <p>${complaint.description}</p>
      </div>
      ${complaint.remarks ? `
        <div class="detail-row">
          <strong>Remarks:</strong>
          <p>${complaint.remarks}</p>
        </div>
      ` : ''}
      ${complaint.file_paths && complaint.file_paths.length > 0 ? `
        <div class="detail-row">
          <strong>Evidence Files:</strong>
          <div class="file-links">
            ${complaint.file_paths.map((file, index) => `
              <a href="${file}" target="_blank" class="file-link">File ${index + 1}</a>
            `).join('')}
          </div>
        </div>
      ` : ''}
      <div class="detail-row">
        <strong>Created:</strong> ${toIST(complaint.created_at)}
      </div>
      ${complaint.updated_at !== complaint.created_at ? `
        <div class="detail-row">
          <strong>Updated:</strong> ${toIST(complaint.updated_at)}
        </div>
      ` : ''}
    </div>
  `;
  
  modal.style.display = 'block';
}

function closeViewModal() {
  document.getElementById('viewModal').style.display = 'none';
}

async function exportCSV() {
  try {
    const response = await fetch('/export', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'complaints.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to export data');
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}
