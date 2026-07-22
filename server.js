require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const JWT_SECRET = process.env.JWT_SECRET || 'safebox-super-secret-key-123';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later' }
});

const complaintLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many complaints, please try again later' }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token required' });
  
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `${role} access required` });
    }
    next();
  };
}

function generateComplaintId() {
  return 'SB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateAdminKey() {
  return 'ADM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function validateInput(data, required) {
  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    validateInput(req.body, ['username', 'password']);
    
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    stmt.run(username, hash, role || 'student');
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    if (err.message.includes('Missing required fields')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    validateInput(req.body, ['username', 'password']);
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(400).json({ error: 'User not found' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    if (err.message.includes('Missing required fields')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.post('/complaint', complaintLimiter, authenticateToken, upload.array('evidence', 5), (req, res) => {
  try {
    const { category, description, priority } = req.body;
    validateInput(req.body, ['category', 'description']);
    
    const trackingId = generateComplaintId();
    const filePaths = req.files ? req.files.map(file => '/uploads/' + file.filename) : [];
    
    const stmt = db.prepare(`
      INSERT INTO complaints (tracking_id, user_id, category, description, priority, file_paths) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(trackingId, req.user.id, category, description, priority || 'Medium', JSON.stringify(filePaths));
    
    res.status(201).json({ trackingId, message: 'Complaint submitted successfully' });
  } catch (err) {
    if (err.message.includes('Missing required fields')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Database error storing complaint' });
  }
});

app.get('/track/:trackingId', (req, res) => {
  try {
    const complaint = db.prepare(`
      SELECT tracking_id, category, status, created_at, updated_at 
      FROM complaints 
      WHERE tracking_id = ? AND deleted = 0
    `).get(req.params.trackingId);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: 'Database error retrieving tracking info' });
  }
});

app.get('/my-complaints', authenticateToken, (req, res) => {
  try {
    const complaints = db.prepare(`
      SELECT id, tracking_id, category, description, priority, status, remarks, file_paths, created_at, updated_at
      FROM complaints 
      WHERE user_id = ? AND deleted = 0
      ORDER BY created_at DESC
    `).all(req.user.id);
    
    const formatted = complaints.map(c => ({
      ...c,
      file_paths: c.file_paths ? JSON.parse(c.file_paths) : []
    }));
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Database error retrieving complaints' });
  }
});

app.put('/complaint/:id', authenticateToken, (req, res) => {
  try {
    const { category, description, priority } = req.body;
    const complaintId = req.params.id;
    
    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ? AND user_id = ?').get(complaintId, req.user.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (complaint.status !== 'Pending') return res.status(400).json({ error: 'Can only edit pending complaints' });
    
    const stmt = db.prepare(`
      UPDATE complaints 
      SET category = ?, description = ?, priority = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(category || complaint.category, description || complaint.description, priority || complaint.priority, complaintId, req.user.id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Complaint not found' });
    res.json({ message: 'Complaint updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error updating complaint' });
  }
});

app.get('/complaints', authenticateToken, requireRole('admin'), (req, res) => {
  console.log('📋 Complaints API hit by user:', req.user.username);
  try {
    const { status, category, priority, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT c.*, u.username 
      FROM complaints c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.deleted = 0
    `;
    const params = [];
    
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (category) {
      query += ' AND c.category = ?';
      params.push(category);
    }
    if (priority) {
      query += ' AND c.priority = ?';
      params.push(priority);
    }
    if (search) {
      query += ' AND c.description LIKE ?';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const complaints = db.prepare(query).all(...params);
    
    const formatted = complaints.map(c => ({
      ...c,
      file_paths: c.file_paths ? JSON.parse(c.file_paths) : []
    }));
    
    const countQuery = query.replace('SELECT c.*, u.username', 'SELECT COUNT(*)').replace('ORDER BY c.created_at DESC LIMIT ? OFFSET ?', '');
    const totalCount = db.prepare(countQuery).all(...params.slice(0, -2))[0]['COUNT(*)'];
    
    res.json({
      complaints: formatted,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error retrieving complaints' });
  }
});

app.put('/admin/complaint/:id', authenticateToken, requireRole('admin'), (req, res) => {
  console.log('🔄 Admin update complaint API hit by user:', req.user.username);
  console.log('📝 Update request body:', req.body);
  console.log('🆔 Complaint ID:', req.params.id);
  
  try {
    const { status, remarks } = req.body;
    const complaintId = req.params.id;
    
    // Validate status values
    const validStatuses = ['Pending', 'In Progress', 'Resolved'];
    if (!validStatuses.includes(status)) {
      console.error('❌ Invalid status value:', status);
      return res.status(400).json({ error: 'Invalid status. Must be: Pending, In Progress, or Resolved' });
    }
    
    console.log('✅ Status validation passed');
    
    // Check if complaint exists
    const complaintCheck = db.prepare('SELECT id, status FROM complaints WHERE id = ? AND deleted = 0').get(complaintId);
    if (!complaintCheck) {
      console.error('❌ Complaint not found or deleted:', complaintId);
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    console.log('📋 Current complaint status:', complaintCheck.status);
    console.log('🔄 Updating to:', status);
    
    const stmt = db.prepare(`
      UPDATE complaints 
      SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND deleted = 0
    `);
    const result = stmt.run(status, remarks || '', complaintId);
    
    console.log('📊 Update result:', { changes: result.changes });
    
    if (result.changes === 0) {
      console.error('❌ No rows updated - complaint not found');
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    console.log('✅ Complaint updated successfully');
    res.json({ message: 'Complaint updated successfully' });
  } catch (err) {
    console.error('❌ Update complaint database error:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ error: 'Database error updating complaint: ' + err.message });
  }
});

app.delete('/complaint/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const stmt = db.prepare('UPDATE complaints SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Complaint not found' });
    res.json({ message: 'Complaint deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error deleting complaint' });
  }
});

app.delete('/admin/complaint/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const stmt = db.prepare('UPDATE complaints SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Complaint not found' });
    res.json({ message: 'Complaint deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Database error deleting complaint' });
  }
});

app.get('/analytics', authenticateToken, requireRole('admin'), (req, res) => {
  console.log('📊 Analytics API hit by user:', req.user.username);
  try {
    console.log('🔍 Executing analytics queries...');
    
    const totalQuery = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE deleted = 0');
    const pendingQuery = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = ? AND deleted = 0');
    const resolvedQuery = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = ? AND deleted = 0');
    const inProgressQuery = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = ? AND deleted = 0');
    
    const total = totalQuery.get();
    const pending = pendingQuery.get('Pending');
    const resolved = resolvedQuery.get('Resolved');
    const inProgress = inProgressQuery.get('In Progress');
    
    console.log('📊 Query results:', { total, pending, resolved, inProgress });
    
    const analyticsData = {
      total: total ? total.count : 0,
      pending: pending ? pending.count : 0,
      resolved: resolved ? resolved.count : 0,
      inProgress: inProgress ? inProgress.count : 0
    };
    
    console.log('✅ Analytics data prepared:', analyticsData);
    res.json(analyticsData);
  } catch (err) {
    console.error('❌ Analytics database error:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ error: 'Database error retrieving analytics: ' + err.message });
  }
});

app.get('/admin/analytics', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE deleted = 0').get();
    const pending = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = "Pending" AND deleted = 0').get();
    const resolved = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = "Resolved" AND deleted = 0').get();
    const inProgress = db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = "In Progress" AND deleted = 0').get();
    
    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM complaints 
      WHERE deleted = 0 
      GROUP BY category
    `).all();
    
    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM complaints 
      WHERE deleted = 0 
      GROUP BY priority
    `).all();
    
    res.json({
      total: total.count,
      pending: pending.count,
      resolved: resolved.count,
      inProgress: inProgress.count,
      byCategory,
      byPriority
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error retrieving analytics' });
  }
});

app.get('/export', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const complaints = db.prepare(`
      SELECT c.tracking_id, u.username, c.category, c.description, c.priority, c.status, c.remarks, c.created_at, c.updated_at
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE c.deleted = 0
      ORDER BY c.created_at DESC
    `).all();
    
    const csv = [
      'Tracking ID,Username,Category,Description,Priority,Status,Remarks,Created At,Updated At'
    ];
    
    complaints.forEach(c => {
      csv.push([
        c.tracking_id,
        c.username,
        c.category,
        `"${c.description.replace(/"/g, '""')}"`,
        c.priority,
        c.status,
        c.remarks ? `"${c.remarks.replace(/"/g, '""')}"` : '',
        c.created_at,
        c.updated_at
      ].join(','));
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="complaints.csv"');
    res.send(csv.join('\n'));
  } catch (err) {
    res.status(500).json({ error: 'Error exporting data' });
  }
});

app.get('/admin', authenticateToken, requireRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/student-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/student-login.html'));
});

app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin-login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.put('/rating/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    
    // Validate rating (1-5)
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }
    
    // Get complaint to verify ownership and status
    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    // Security checks: only allow if student owns it and it's resolved
    if (complaint.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only rate your own complaints' });
    }
    
    if (complaint.status !== 'Resolved') {
      return res.status(400).json({ error: 'Rating can only be provided for resolved complaints' });
    }
    
    // Update rating
    const stmt = db.prepare('UPDATE complaints SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(rating, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    
    res.json({ message: 'Rating submitted successfully' });
  } catch (err) {
    console.error('Rating error:', err);
    res.status(500).json({ error: 'Database error submitting rating' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ SafeBox server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  - GET /complaints (Admin only)');
  console.log('  - GET /analytics (Admin only)');
  console.log('  - POST /login');
  console.log('  - POST /api/auth/register');
  console.log('  - PUT /rating/:id');
  console.log('🌐 CORS enabled for all origins');
  console.log('📁 Static files served from /public');
});
