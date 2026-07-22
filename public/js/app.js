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

document.addEventListener('DOMContentLoaded', () => {
  const complaintForm = document.getElementById('complaintForm');
  const trackForm = document.getElementById('trackForm');

  if (complaintForm) {
    complaintForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const category = document.getElementById('category').value;
      const description = document.getElementById('description').value;
      const evidence = document.getElementById('evidence').files[0];
      
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      if (evidence) {
        formData.append('evidence', evidence);
      }

      try {
        const res = await fetch('http://localhost:3000/complaint', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`
          },
          body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
          complaintForm.style.display = 'none';
          document.getElementById('resultCard').style.display = 'block';
          document.getElementById('tokenDisplay').innerText = data.complaintId;
        } else {
          const err = document.getElementById('errorMsg');
          err.innerText = data.error || 'Submission failed';
          err.style.display = 'block';
        }
      } catch (err) {
        const errEl = document.getElementById('errorMsg');
        errEl.innerText = 'Network Error. Make sure backend is running.';
        errEl.style.display = 'block';
      }
    });
  }

  if (trackForm) {
    trackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('trackId').value;
      
      try {
        const res = await fetch(`http://localhost:3000/track/${id}`);
        const data = await res.json();
        
        if (res.ok) {
          document.getElementById('statusResult').style.display = 'block';
          document.getElementById('resCategory').innerText = data.category;
          document.getElementById('resDate').innerText = toIST(data.created_at);
          
          const statusBadge = document.getElementById('resStatus');
          statusBadge.innerText = data.status;
          statusBadge.className = 'status-badge';
          if (data.status === 'Pending') statusBadge.classList.add('status-pending');
          if (data.status === 'In Progress') statusBadge.classList.add('status-progress');
          if (data.status === 'Resolved') statusBadge.classList.add('status-resolved');
          
          document.getElementById('errorMsg').style.display = 'none';
        } else {
          document.getElementById('statusResult').style.display = 'none';
          const errEl = document.getElementById('errorMsg');
          errEl.innerText = data.error || 'Not found';
          errEl.style.display = 'block';
        }
      } catch (err) {
        const errEl = document.getElementById('errorMsg');
        errEl.innerText = 'Network Error. Make sure backend is running.';
        errEl.style.display = 'block';
      }
    });
  }
});
