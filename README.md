<<<<<<< HEAD
# SafeBox Complaint Management System

A secure, scalable complaint management system built with Node.js, Express, SQLite, and modern web technologies.

## Features

### Student Dashboard
- Secure registration and login with JWT authentication
- Submit complaints with multiple file uploads (max 5 files)
- View and track personal complaints
- Edit complaints (only when status is "Pending")
- Real-time status tracking

### Admin Dashboard
- Comprehensive analytics dashboard
- Filter complaints by status, category, priority
- Search functionality across complaint descriptions
- Pagination for large datasets
- Update complaint status and add remarks
- Soft delete functionality
- CSV export for data analysis

### Security Features
- JWT-based authentication with expiration
- Rate limiting on login and complaint endpoints
- Role-based access control
- Input validation and sanitization
- Safe token handling

### Database Schema
- **Users**: id, username, password (hashed), role
- **Complaints**: id, tracking_id, user_id, category, description, priority, status, remarks, file_paths (JSON), deleted, created_at, updated_at

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (optional):
```
JWT_SECRET=your-secret-key
PORT=3000
```

3. Start the server:
```bash
node server.js
```

4. Access the application:
- Student Login: http://localhost:3000/login
- Student Dashboard: http://localhost:3000/student-dashboard.html
- Admin Dashboard: http://localhost:3000/admin-dashboard.html
- Public Tracking: http://localhost:3000/track.html

## Default Admin Account

The system automatically creates an admin account:
- Username: `admin`
- Password: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /login` - User login

### Complaint Management
- `POST /complaint` - Submit new complaint (authenticated)
- `GET /my-complaints` - Get user's complaints (authenticated)
- `PUT /complaint/:id` - Update complaint (authenticated, owner only)
- `GET /complaints` - Get all complaints (admin only)
- `PUT /admin/complaint/:id` - Update complaint (admin only)
- `DELETE /admin/complaint/:id` - Soft delete complaint (admin only)
- `GET /track/:trackingId` - Track complaint status (public)

### Analytics & Export
- `GET /admin/analytics` - Get dashboard analytics (admin only)
- `GET /export` - Export complaints to CSV (admin only)

## File Upload

- Multiple file support (max 5 files per complaint)
- Supported formats: Images, PDF, DOC, DOCX
- Files stored in `/uploads` directory
- File paths stored as JSON array in database

## Rate Limiting

- Login endpoint: 5 attempts per 15 minutes
- Complaint submission: 10 complaints per hour

## Security

- Passwords hashed with bcrypt
- JWT tokens expire after 2 hours
- Role-based access control
- Input validation on all endpoints
- CORS protection enabled

## Frontend Technologies

- Vanilla JavaScript (no framework dependencies)
- Modern CSS with glassmorphism design
- Responsive design for mobile devices
- Real-time updates without page refresh

## Database

- SQLite for lightweight deployment
- Foreign key relationships enforced
- Soft delete for data integrity
- Automatic timestamp management

## Development

The system is designed to be:
- **Scalable**: Modular architecture with clear separation of concerns
- **Secure**: Multiple layers of authentication and validation
- **Maintainable**: Clean code structure with comprehensive error handling
- **User-friendly**: Modern UI with intuitive navigation

## Production Considerations

For production deployment:
1. Use environment variables for sensitive data
2. Implement proper HTTPS
3. Set up database backups
4. Configure proper logging
5. Use a process manager like PM2
6. Consider using a more robust database for high traffic
=======
# safeplace
>>>>>>> 77796b04405860883b33dc30cfd7290d16d7a747
