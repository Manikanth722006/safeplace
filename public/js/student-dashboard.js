let currentUser = null;

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
  checkAuth();
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
  document.getElementById('welcomeUser').textContent = `Welcome, ${currentUser.username}`;
}

function setupEventListeners() {
  const complaintForm = document.getElementById('complaintForm');
  const editForm = document.getElementById('editForm');
  const ratingForm = document.getElementById('ratingForm');
  const fileInput = document.getElementById('evidence');
  
  complaintForm.addEventListener('submit', submitComplaint);
  editForm.addEventListener('submit', updateComplaint);
  ratingForm.addEventListener('submit', submitRating);
  
  // Setup star rating
  setupStarRating();
  
  fileInput.addEventListener('change', function() {
    const files = this.files;
    const fileDisplay = document.getElementById('fileDisplay');
    const fileList = document.getElementById('fileList');
    
    if (files.length > 0) {
      fileDisplay.textContent = `${files.length} file(s) selected`;
      fileList.innerHTML = '';
      
      for (let i = 0; i < files.length; i++) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.textContent = files[i].name;
        fileList.appendChild(fileItem);
      }
    } else {
      fileDisplay.textContent = 'Click or drag files here (Max 5)';
      fileList.innerHTML = '';
    }
  });
}

async function submitComplaint(e) {
  e.preventDefault();
  
  const submitError = document.getElementById('submitError');
  const submitSuccess = document.getElementById('submitSuccess');
  const formData = new FormData(e.target);
  
  submitError.style.display = 'none';
  submitSuccess.style.display = 'none';
  
  try {
    const response = await fetch('/complaint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
      submitSuccess.textContent = `Complaint submitted successfully! Tracking ID: ${data.trackingId}`;
      submitSuccess.style.display = 'block';
      e.target.reset();
      document.getElementById('fileDisplay').textContent = 'Click or drag files here (Max 5)';
      document.getElementById('fileList').innerHTML = '';
      loadComplaints();
      // Trigger real-time update for admin dashboard
      localStorage.setItem('newComplaintSubmitted', Date.now().toString());
      localStorage.removeItem('newComplaintSubmitted');
    } else {
      submitError.textContent = data.error || 'Failed to submit complaint';
      submitError.style.display = 'block';
    }
  } catch (error) {
    submitError.textContent = 'Network error. Please try again.';
    submitError.style.display = 'block';
  }
}

async function loadComplaints() {
  const complaintsError = document.getElementById('complaintsError');
  const complaintsLoading = document.getElementById('complaintsLoading');
  const complaintsList = document.getElementById('complaintsList');
  
  complaintsError.style.display = 'none';
  complaintsLoading.style.display = 'block';
  complaintsList.innerHTML = '';
  
  try {
    const response = await fetch('/my-complaints', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      complaintsLoading.style.display = 'none';
      displayComplaints(data);
    } else {
      complaintsError.textContent = data.error || 'Failed to load complaints';
      complaintsError.style.display = 'block';
      complaintsLoading.style.display = 'none';
    }
  } catch (error) {
    complaintsError.textContent = 'Network error. Please try again.';
    complaintsError.style.display = 'block';
    complaintsLoading.style.display = 'none';
  }
}

function displayComplaints(complaints) {
  const complaintsList = document.getElementById('complaintsList');
  
  if (complaints.length === 0) {
    complaintsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No complaints submitted yet.</p>';
    return;
  }
  
  complaintsList.innerHTML = complaints.map(complaint => `
    <div class="complaint-card">
      <div class="complaint-header">
        <div>
          <strong>${complaint.tracking_id}</strong>
          <span class="status status-${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span>
        </div>
        <div>
          <span class="priority priority-${complaint.priority.toLowerCase()}">${complaint.priority}</span>
        </div>
      </div>
      <div class="complaint-body">
        <p><strong>Category:</strong> ${complaint.category}</p>
        <p><strong>Description:</strong> ${complaint.description}</p>
        ${complaint.remarks ? `<p><strong>Remarks:</strong> ${complaint.remarks}</p>` : ''}
        ${complaint.rating ? `<p><strong>Your Rating:</strong> ${'⭐'.repeat(complaint.rating)} (${complaint.rating}/5)</p>` : ''}
        ${complaint.file_paths && complaint.file_paths.length > 0 ? `
          <p><strong>Evidence:</strong></p>
          <div class="file-links">
            ${complaint.file_paths.map((file, index) => `
              <a href="${file}" target="_blank" class="file-link">File ${index + 1}</a>
            `).join('')}
          </div>
        ` : ''}
        <p><strong>Created:</strong> ${toIST(complaint.created_at)}</p>
        ${complaint.updated_at !== complaint.created_at ? 
          `<p><strong>Updated:</strong> ${toIST(complaint.updated_at)}</p>` : ''}
      </div>
      <div class="complaint-actions">
        ${complaint.status === 'Pending' ? `
          <button class="btn btn-outline" onclick="openEditModal(${complaint.id}, '${complaint.category}', '${complaint.priority}', '${complaint.description.replace(/'/g, "\\'")}')">Edit</button>
        ` : ''}
        ${complaint.status === 'Resolved' && !complaint.rating ? `
          <button class="btn btn-primary" onclick="openRatingModal(${complaint.id})">Rate Resolution</button>
        ` : ''}
        ${complaint.status === 'Resolved' && complaint.rating ? `
          <span style="color: var(--success); font-weight: bold;">Rated: ${'⭐'.repeat(complaint.rating)} (${complaint.rating}/5)</span>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function openEditModal(id, category, priority, description) {
  const modal = document.getElementById('editModal');
  document.getElementById('editId').value = id;
  document.getElementById('editCategory').value = category;
  document.getElementById('editPriority').value = priority;
  document.getElementById('editDescription').value = description;
  modal.style.display = 'block';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  document.getElementById('editError').style.display = 'none';
}

function setupStarRating() {
  const stars = document.querySelectorAll('.star');
  const ratingValue = document.getElementById('ratingValue');
  
  stars.forEach(star => {
    star.addEventListener('click', function() {
      const rating = parseInt(this.dataset.rating);
      ratingValue.value = rating;
      updateStarDisplay(rating);
    });
    
    star.addEventListener('mouseenter', function() {
      const rating = parseInt(this.dataset.rating);
      updateStarDisplay(rating);
    });
  });
  
  document.getElementById('starRating').addEventListener('mouseleave', function() {
    const currentRating = parseInt(ratingValue.value);
    updateStarDisplay(currentRating);
  });
}

function updateStarDisplay(rating) {
  const stars = document.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

function openRatingModal(id) {
  const modal = document.getElementById('ratingModal');
  document.getElementById('ratingId').value = id;
  document.getElementById('ratingValue').value = 0;
  document.getElementById('ratingError').style.display = 'none';
  updateStarDisplay(0);
  modal.style.display = 'block';
}

function closeRatingModal() {
  document.getElementById('ratingModal').style.display = 'none';
  document.getElementById('ratingError').style.display = 'none';
}

async function submitRating(e) {
  e.preventDefault();
  
  const ratingError = document.getElementById('ratingError');
  const id = document.getElementById('ratingId').value;
  const rating = parseInt(document.getElementById('ratingValue').value);
  
  if (rating < 1 || rating > 5) {
    ratingError.textContent = 'Please select a rating';
    ratingError.style.display = 'block';
    return;
  }
  
  try {
    const response = await fetch(`/rating/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ rating })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      closeRatingModal();
      alert('Rating submitted successfully!');
      loadComplaints(); // Refresh complaints list
    } else {
      ratingError.textContent = data.error || 'Failed to submit rating';
      ratingError.style.display = 'block';
    }
  } catch (error) {
    ratingError.textContent = 'Network error. Please try again.';
    ratingError.style.display = 'block';
  }
}

async function updateComplaint(e) {
  e.preventDefault();
  
  const editError = document.getElementById('editError');
  const id = document.getElementById('editId').value;
  const category = document.getElementById('editCategory').value;
  const priority = document.getElementById('editPriority').value;
  const description = document.getElementById('editDescription').value;
  
  editError.style.display = 'none';
  
  try {
    const response = await fetch(`/complaint/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ category, priority, description })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      closeEditModal();
      loadComplaints();
    } else {
      editError.textContent = data.error || 'Failed to update complaint';
      editError.style.display = 'block';
    }
  } catch (error) {
    editError.textContent = 'Network error. Please try again.';
    editError.style.display = 'block';
  }
}

async function updateGlobalAnalytics() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const response = await fetch('/analytics', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Analytics updated after new complaint:', data);
      // This will update any admin dashboard that's open
      // The admin dashboard will automatically refresh its analytics on next load
    }
  } catch (error) {
    console.log('Analytics update failed (non-critical):', error);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}
