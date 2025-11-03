# 🚀 Docker Quick Reference - MealCart Backend

## ✅ Your Docker Setup is Ready!

### Current Status
- ✅ Docker version: 28.3.2
- ✅ Docker Compose: v2.39.1
- ✅ Container running on: http://localhost:5001
- ✅ MongoDB Atlas connected
- ✅ Gemini AI initialized

---

## 🎯 Essential Commands

### Start/Stop
```bash
# Start (in background)
docker-compose up -d

# Start (with logs)
docker-compose up

# Stop containers
docker-compose down

# Restart
docker-compose restart
```

### View Logs
```bash
# Follow logs in real-time
docker-compose logs -f

# View last 50 lines
docker-compose logs --tail=50 app

# View all logs
docker-compose logs app
```

### Check Status
```bash
# Container status
docker-compose ps

# Test API
curl http://localhost:5001/health

# Resource usage
docker stats
```

### Rebuild
```bash
# Rebuild and restart
docker-compose up -d --build

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

---

## 📋 Your Configuration

### Files
- **Dockerfile**: Multi-stage build (development + production)
- **docker-compose.yml**: Service orchestration
- **.env.docker**: Docker-specific environment (PORT=5000)
- **.env**: Local development environment (PORT=5001)

### Port Mapping
```
localhost:5001 → container:5000
```

**Why?** macOS Control Center uses port 5000, so we map to 5001 on your Mac.

### Services
- **app**: Your Node.js backend
  - Image: mealcart-backend-app
  - Container name: mealcart-api
  - Network: mealcart-backend_mealcart-network

---

## 🔧 Common Tasks

### Access Container Shell
```bash
docker-compose exec app sh
```

### View Environment Variables
```bash
docker-compose exec app printenv | grep -E "(MONGODB|JWT|PORT)"
```

### Run Commands in Container
```bash
# Run npm commands
docker-compose exec app npm run lint

# Check Node version
docker-compose exec app node --version
```

### Clean Up
```bash
# Remove containers and networks
docker-compose down

# Remove containers, networks, and volumes (⚠️ deletes data)
docker-compose down -v

# Remove unused images
docker image prune
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :5001

# Kill process
lsof -ti:5001 | xargs kill -9

# Or change port in docker-compose.yml
```

### Container Not Starting
```bash
# View logs
docker-compose logs -f app

# Check for errors
docker-compose ps
```

### MongoDB Connection Issues
```bash
# Verify MongoDB URI
docker-compose exec app printenv MONGODB_URI

# Check logs
docker-compose logs --tail=100 app
```

### Code Changes Not Reflecting
```bash
# Rebuild the image
docker-compose up -d --build
```

---

## 📊 Monitoring

### Health Check
```bash
# Quick check
curl http://localhost:5001/health

# With formatted output
curl -s http://localhost:5001/health | jq
```

### Container Health Status
```bash
# Check health in status
docker-compose ps

# Detailed health info
docker inspect mealcart-api | jq '.[0].State.Health'
```

---

## 🚀 Production Tips

### Build for Production
```bash
# Build production image
docker build -t mealcart-backend:latest --target production .

# Run in production mode
docker run -d \
  -p 5000:5000 \
  --env-file .env \
  -e NODE_ENV=production \
  mealcart-backend:latest
```

### Push to Registry
```bash
# Login to Docker Hub
docker login

# Tag
docker tag mealcart-backend-app:latest yourusername/mealcart-backend:latest

# Push
docker push yourusername/mealcart-backend:latest
```

---

## 💡 Pro Tips

1. **Always use `-d` flag** for background mode:
   ```bash
   docker-compose up -d
   ```

2. **View logs after starting**:
   ```bash
   docker-compose up -d && docker-compose logs -f
   ```

3. **Rebuild after dependency changes**:
   ```bash
   docker-compose build --no-cache
   ```

4. **Check before starting**:
   ```bash
   docker-compose ps
   docker ps -a
   ```

---

## 📚 Your Current Setup

```yaml
Services:
  ✅ app (mealcart-api)
     - Port: localhost:5001 → container:5000
     - Environment: .env.docker
     - Health check: Enabled
     - Auto-restart: yes

  ⚪ mongo (optional - commented out)
     - Using MongoDB Atlas instead
     - Local MongoDB available if needed

Networks:
  ✅ mealcart-network (bridge)

Volumes:
  ⚪ mongo-data (not used currently)
```

---

## 🎓 Next Steps

1. **Development**: Code changes? Rebuild with `docker-compose up -d --build`
2. **Debugging**: View logs with `docker-compose logs -f`
3. **Production**: See DEPLOYMENT.md for cloud deployment guides
4. **Testing**: Access API at http://localhost:5001

---

**Quick Start Every Time:**
```bash
docker-compose up -d           # Start
docker-compose logs -f         # Watch logs
curl localhost:5001/health     # Test
docker-compose down            # Stop
```

**🎉 You're all set! Your Docker environment is production-ready!**
