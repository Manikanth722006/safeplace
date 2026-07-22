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

  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', () => {
      loginForm.style.display = 'none';
      showRegisterBtn.parentElement.style.display = 'none';
      registerForm.style.display = 'block';
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
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify({
            username: data.username,
            role: data.role
          }));
          
          if (data.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
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

function getToken() { return localStorage.getItem('token'); }

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// Inject Admin Link if appropriate
const user = getUser();
const navLinks = document.getElementById('navLinks');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

if (getToken()) {
  if (loginBtn) loginBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'inline-block';
}

if (user && user.role === 'admin' && navLinks) {
  const adminLink = document.createElement('a');
  adminLink.href = 'admin-dashboard.html';
  adminLink.innerText = 'Admin Dashboard';
  adminLink.style.color = '#ef4444';
  adminLink.style.fontWeight = 'bold';
  navLinks.insertBefore(adminLink, logoutBtn);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Redirect if not logged in and trying to access protected UI
const path = window.location.pathname;
const isPublicPage = path.endsWith('login.html') || path.endsWith('track.html') || path.endsWith('index.html');

if (!isPublicPage && !getToken()) {
  // If we're not on a public page and not logged in, redirect to login
  if (path.endsWith('student-dashboard.html') || path.endsWith('admin-dashboard.html')) {
    window.location.href = 'login.html';
  }
}
