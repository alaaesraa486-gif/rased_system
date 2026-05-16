# 🚀 Quick Start Guide - Rased Attendance System

## 5-Minute Setup

### Prerequisites Check
```bash
node --version  # Should be 18+
psql --version  # Should be 15+
redis-cli --version  # Should be 7+
```

### Step 1: Database Setup (2 minutes)
```bash
# Create database
createdb rased_db

# Navigate to backend
cd backend

# Copy environment file
cp .env.example .env

# IMPORTANT: Edit .env and set:
# - DB_PASSWORD (your PostgreSQL password)
# - JWT_SECRET (random 32+ character string)
# - JWT_REFRESH_SECRET (random 32+ character string)
# - TOKEN_ENCRYPTION_KEY (exactly 32 characters)

# Initialize database
npm install
npm run init-db
```

### Step 2: Start Services (1 minute)
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Backend
cd backend
npm run dev

# Terminal 3: Start Frontend
cd frontend
npm install
npm run dev
```

### Step 3: Access & Test (2 minutes)
1. Open http://localhost:3000
2. Login with: admin@rased.edu / admin123
3. Create a professor account
4. Create a course
5. Add some student accounts
6. Start an attendance session!

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rased.edu | admin123 |

**⚠️ Change the admin password immediately!**

## Typical Workflow

### As Professor:
1. Login → Dashboard
2. Create Course (e.g., "Computer Science 101")
3. Add Students (via Register or Bulk Upload)
4. Click "Start Session" on a course
5. Display QR on projector
6. Watch real-time attendance feed
7. End session when done
8. View analytics & export reports

### As Student:
1. Login → Dashboard
2. See enrolled courses
3. When professor starts session, click "Scan QR"
4. Point camera at projected QR
5. Instant confirmation!
6. View attendance history

## Troubleshooting Quick Fixes

### "Database connection failed"
```bash
# Check PostgreSQL is running
brew services list | grep postgresql  # macOS
systemctl status postgresql  # Linux

# Start if needed
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux
```

### "Redis connection failed"
```bash
# Start Redis
redis-server

# Or with Homebrew (macOS)
brew services start redis
```

### "Port already in use"
```bash
# Kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### "Camera not working"
- Grant camera permissions in browser
- Try different browser (Chrome recommended)
- Ensure using HTTPS in production

### "QR expired immediately"
- Verify Redis is running
- Check system clock (must be synchronized)
- Ensure QR_TOKEN_EXPIRY is set correctly in .env

## Production Deployment Checklist

- [ ] Change all default passwords
- [ ] Generate secure JWT secrets (32+ chars)
- [ ] Set NODE_ENV=production
- [ ] Use managed PostgreSQL (AWS RDS, DigitalOcean)
- [ ] Use managed Redis (AWS ElastiCache)
- [ ] Configure SSL certificate (required for camera)
- [ ] Set up CORS whitelist
- [ ] Enable rate limiting
- [ ] Configure backup strategy
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure CDN for frontend
- [ ] Test with 100+ concurrent users
- [ ] Document incident response plan

## Environment Variables Reference

### Required (Must Change!)
```env
JWT_SECRET=<random-32-character-string>
JWT_REFRESH_SECRET=<random-32-character-string>
TOKEN_ENCRYPTION_KEY=<exactly-32-characters>
DB_PASSWORD=<your-postgres-password>
```

### Optional (Can Use Defaults)
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rased_db
REDIS_HOST=localhost
REDIS_PORT=6379
QR_ROTATION_INTERVAL=8000
QR_TOKEN_EXPIRY=10000
FRONTEND_URL=http://localhost:3000
```

## Performance Tuning

### For Large Deployments (1000+ students)

**PostgreSQL:**
```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
```

**Backend (server.js):**
```javascript
// Increase connection pool
const pool = new Pool({
  max: 50,  // Up from 20
  idleTimeoutMillis: 30000
});
```

**Redis:**
```bash
# Increase maxmemory
redis-cli CONFIG SET maxmemory 1gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Support & Resources

- 📖 Full Documentation: README.md
- 🐛 Report Issues: GitHub Issues
- 💬 Community: Discord/Slack
- 📧 Email: support@rased.edu

## Next Steps

1. Customize branding (logo, colors)
2. Configure email notifications
3. Set up automated backups
4. Integrate with university LMS
5. Add custom reports
6. Configure multi-language support

---

**Pro Tip:** Run through the complete workflow once before going live. Create test accounts, simulate a real class, and verify all features work as expected!
