const API_URL = '';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const errorMsg = document.getElementById('errorMsg');

  function showError(msg) {
    if(!errorMsg) return;
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  function hideError() {
    if(!errorMsg) return;
    errorMsg.style.display = 'none';
  }

  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', () => {
      loginForm.style.display = 'none';
      showRegisterBtn.parentElement.style.display = 'none';
      registerForm.style.display = 'block';
      hideError();
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      try {
        const res = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
          // Store authentication data
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify({
            username: data.username,
            role: data.role
          }));
          
          // Role-based redirection
          if (data.role === 'admin') {
            window.location.href = 'admin.html';
          } else {
            window.location.href = 'student-dashboard.html';
          }
        } else {
          showError(data.error);
        }
      } catch (err) {
        showError('Network error connecting to backend.');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value;
      const password = document.getElementById('regPassword').value;

      try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role: 'student' })
        });
        const data = await res.json();
        
        if (res.ok) {
          alert('Registration successful! Please log in.');
          window.location.reload();
        } else {
          showError(data.error);
        }
      } catch (err) {
        showError('Network error connecting to backend.');
      }
    });
  }
});
