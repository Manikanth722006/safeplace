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

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication and role
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    window.location.href = 'admin-login.html';
    return;
  }
  
  const userData = JSON.parse(user);
  if (userData.role !== 'admin') {
    window.location.href = 'student-login.html';
    return;
  }

  // Update welcome message
  document.getElementById('welcomeUser').textContent = `Welcome, ${userData.username}`;

  // Load initial data
  await loadAnalytics();
  await loadComplaints();
  setupEventListeners();
  
  // Set up periodic refresh for real-time updates
  setupAutoRefresh();
  
  // Listen for complaint submission events
  setupComplaintListener();
});

function setupAutoRefresh() {
  // Refresh analytics every 30 seconds
  setInterval(async () => {
    await loadAnalytics();
  }, 30000);
}

function setupComplaintListener() {
  // Listen for localStorage events indicating new complaints
  window.addEventListener('storage', (e) => {
    if (e.key === 'newComplaintSubmitted') {
      loadAnalytics();
      loadComplaints();
    }
  });
}

function setupEventListeners() {
  const updateForm = document.getElementById('updateForm');
  if (updateForm) {
    updateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await updateComplaintStatus();
    });
  }
}

async function loadAnalytics() {
  try {
    const token = localStorage.getItem('token');
    console.log('🔍 Loading analytics with token:', token ? 'present' : 'missing');
    
    if (!token) {
      console.error('❌ No token found in localStorage');
      window.location.href = 'admin-login.html';
      return;
    }
    
    console.log('📡 Making request to: /analytics');
    const res = await fetch('/analytics', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Analytics response status:', res.status);
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('❌ Analytics API error:', errorData);
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    console.log('✅ Analytics data received:', data);
    
    document.getElementById('totalComplaints').textContent = data.total || 0;
    document.getElementById('pendingComplaints').textContent = data.pending || 0;
    document.getElementById('inProgressComplaints').textContent = data.inProgress || 0;
    document.getElementById('resolvedComplaints').textContent = data.resolved || 0;
    console.log('✅ Analytics updated successfully');
  } catch (err) {
    console.error('❌ Failed to load analytics:', err);
    document.getElementById('errorMsg').textContent = 'Failed to load analytics: ' + err.message;
    document.getElementById('errorMsg').style.display = 'block';
  }
}

async function loadComplaints() {
  const tableBody = document.getElementById('tableBody');
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  const loadingMsg = document.getElementById('loadingMsg');
  const token = localStorage.getItem('token');

  // Reset messages
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';
  loadingMsg.style.display = 'block';
  tableBody.innerHTML = '';

  if (!token) {
    console.error('❌ No token found in localStorage');
    window.location.href = 'admin-login.html';
    return;
  }

  try {
    console.log('📡 Making request to: /complaints');
    const res = await fetch('/complaints', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Complaints response status:', res.status);
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('❌ Complaints API error:', errorData);
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    console.log('✅ Complaints data received:', data);
    
    const complaints = data.complaints || data;
    
    loadingMsg.style.display = 'none';
    
    if (complaints.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">No complaints found.</td></tr>';
      return;
    }

    complaints.forEach(item => {
      const tr = document.createElement('tr');
      
      // Evidence links
      let evidenceStr = '<span style="color: var(--text-muted)">None</span>';
      if (item.file_paths && item.file_paths.length > 0) {
        evidenceStr = item.file_paths.map((file, index) => 
          `<a href="${file}" target="_blank" style="color: #60a5fa; margin-right: 5px; text-decoration: none;">File ${index + 1}</a>`
        ).join('');
      }

      // Priority badge
      const priorityBadge = `<span class="priority priority-${item.priority.toLowerCase()}">${item.priority}</span>`;

      // Status badge
      const statusBadge = `<span class="status status-${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span>`;

      // Rating display
      let ratingStr = '<span style="color: var(--text-muted);">Not Rated</span>';
      if (item.rating && item.rating >= 1 && item.rating <= 5) {
        ratingStr = `<span style="color: #fbbf24;">${'⭐'.repeat(item.rating)} (${item.rating}/5)</span>`;
      }

      tr.innerHTML = `
        <td style="font-family: monospace; color: #cbd5e1;">${item.tracking_id}</td>
        <td>${item.username || 'Unknown'}</td>
        <td><span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${item.category}</span></td>
        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.description.replace(/"/g, '&quot;')}">${item.description}</td>
        <td>${priorityBadge}</td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.85rem;">${toIST(item.created_at)}</td>
        <td>${evidenceStr}</td>
        <td>${ratingStr}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button onclick="openUpdateModal(${item.id}, '${item.status}', '${(item.remarks || '').replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline">Update</button>
            <button onclick="deleteComplaint(${item.id})" class="btn btn-sm btn-danger">Delete</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
    
    console.log('✅ Complaints loaded successfully');
  } catch (err) {
    console.error('❌ Failed to load complaints:', err);
    loadingMsg.style.display = 'none';
    errorMsg.innerText = 'Failed to load complaints: ' + err.message;
    errorMsg.style.display = 'block';
  }
}

async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`/complaint/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (res.ok) {
      const badge = document.querySelector(`#badge-${id} span`);
      badge.innerText = newStatus;
      badge.className = 'status-badge';
      if (newStatus === 'Pending') badge.classList.add('status-pending');
      if (newStatus === 'In Progress') badge.classList.add('status-progress');
      if (newStatus === 'Resolved') badge.classList.add('status-resolved');
    } else {
      alert('Failed to update status');
    }
  } catch(err) {
    alert('Error updating status');
  }
}

function openUpdateModal(id, currentStatus, currentRemarks) {
  document.getElementById('complaintId').value = id;
  document.getElementById('statusSelect').value = currentStatus;
  document.getElementById('remarksText').value = currentRemarks || '';
  document.getElementById('updateModal').style.display = 'block';
  document.getElementById('modalError').style.display = 'none';
}

function closeModal() {
  document.getElementById('updateModal').style.display = 'none';
  document.getElementById('modalError').style.display = 'none';
}

async function updateComplaintStatus() {
  const id = document.getElementById('complaintId').value;
  const status = document.getElementById('statusSelect').value;
  const remarks = document.getElementById('remarksText').value;
  const modalError = document.getElementById('modalError');
  
  console.log('🔄 Updating complaint:', { id, status, remarks });
  
  try {
    const res = await fetch(`/admin/complaint/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ status, remarks })
    });
    
    console.log('📡 Update response status:', res.status);
    
    const data = await res.json();
    console.log('📝 Update response data:', data);
    
    if (res.ok) {
      closeModal();
      showSuccess('Complaint updated successfully!');
      console.log('✅ Refreshing data after update...');
      await loadComplaints();
      await loadAnalytics();
    } else {
      console.error('❌ Update failed:', data.error);
      modalError.textContent = data.error || 'Failed to update complaint';
      modalError.style.display = 'block';
    }
  } catch(err) {
    console.error('❌ Update error:', err);
    modalError.textContent = 'Error updating complaint: ' + err.message;
    modalError.style.display = 'block';
  }
}

async function deleteComplaint(id) {
  if (!confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) return;
  
  console.log('🗑️ Deleting complaint:', id);
  
  try {
    const res = await fetch(`/complaint/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Delete response status:', res.status);
    
    const data = await res.json();
    console.log('📝 Delete response data:', data);
    
    if (res.ok) {
      showSuccess('Complaint deleted successfully!');
      console.log('✅ Refreshing data after delete...');
      await loadComplaints();
      await loadAnalytics();
    } else {
      console.error('❌ Delete failed:', data.error);
      showError(data.error || 'Failed to delete complaint');
    }
  } catch(err) {
    console.error('❌ Delete error:', err);
    showError('Error deleting complaint: ' + err.message);
  }
}

async function exportData() {
  try {
    const res = await fetch('/export', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'complaints.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess('Data exported successfully!');
    } else {
      const data = await res.json();
      showError(data.error || 'Failed to export data');
    }
  } catch(err) {
    showError('Error exporting data');
  }
}

function showError(message) {
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  successMsg.style.display = 'none';
}

function showSuccess(message) {
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  successMsg.textContent = message;
  successMsg.style.display = 'block';
  errorMsg.style.display = 'none';
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'admin-login.html';
}
