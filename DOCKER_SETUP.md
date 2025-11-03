# 🐳 Docker Setup Guide for MealCart Backend

## Prerequisites

✅ You already have:
- Docker version 28.3.2 installed
- Docker Compose v2.39.1 installed

## 📋 Quick Start (3 Steps)

### Step 1: Stop Your Development Server
If your server is running on port 5001, stop it first:
```bash
# Find and kill the process
lsof -ti:5001 | xargs kill -9

# Or if running in a terminal, press Ctrl+C
```

### Step 2: Start Docker Containers
```bash
# Start all services in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f app
```

### Step 3: Verify It's Running
```bash
# Check container status
docker-compose ps

# Test health endpoint
curl http://localhost:5000/health

# View app logs
docker-compose logs -f app
```

## 🎯 Docker Commands Cheat Sheet

### Starting Services
```bash
# Start all services in background
docker-compose up -d

# Start and rebuild images
docker-compose up -d --build

# Start and view logs
docker-compose up
```

### Stopping Services
```bash
# Stop all services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (⚠️ deletes database data)
docker-compose down -v
```

### Viewing Logs
```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100

# View logs for specific service
docker-compose logs -f app
docker-compose logs -f mongo
```

### Managing Containers
```bash
# List running containers
docker-compose ps

# Restart services
docker-compose restart

# Restart specific service
docker-compose restart app

# Execute command in container
docker-compose exec app sh
docker-compose exec app npm run lint

# View container resource usage
docker stats
```

### Building Images
```bash
# Build without cache
docker-compose build --no-cache

# Build specific service
docker-compose build app
```

### Database Management
```bash
# Access MongoDB shell
docker-compose exec mongo mongosh

# Backup database
docker-compose exec mongo mongodump --out /data/backup

# Restore database
docker-compose exec mongo mongorestore /data/backup
```

## 🔧 Configuration Options

### Option 1: Using Your Cloud MongoDB (Recommended)
Your current setup uses MongoDB Atlas. This is already configured in your `.env`:

```yaml
# docker-compose.yml uses .env file
services:
  app:
    env_file:
      - .env  # Loads MONGODB_URI from .env (MongoDB Atlas)
```

**To use this:**
```bash
# Just start the app service
docker-compose up -d app

# The mongo service won't be used
```

### Option 2: Using Local MongoDB Container
If you want to use the containerized MongoDB instead:

```bash
# Start all services (app + local MongoDB)
docker-compose up -d

# Your app will connect to mongodb://mongo:27017/mealcart
```

**Note:** This requires modifying `.env` temporarily or the docker-compose.yml

## 📝 Your Current Setup

### Services Defined
1. **app** (Your Node.js backend)
   - Port: 5000
   - Uses: Your Atlas MongoDB by default
   - Auto-restarts unless stopped

2. **mongo** (Local MongoDB - Optional)
   - Port: 27017
   - Data persists in Docker volume
   - Only needed if not using Atlas

### Current Issue
You're using MongoDB Atlas (mongodb+srv://...) in your `.env`, but docker-compose.yml expects a local MongoDB. Let me fix this for you.

## 🔨 Fix Configuration

I'll create two configurations for you:

### Configuration A: Cloud MongoDB (Atlas) - Recommended
```bash
# Start only the app
docker-compose up -d app
```

### Configuration B: Local MongoDB
```bash
# Start both app and MongoDB
docker-compose up -d
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Error: Bind for 0.0.0.0:5000 failed: port is already allocated

# Solution 1: Stop existing process
lsof -ti:5000 | xargs kill -9

# Solution 2: Change port in docker-compose.yml
# Change "5000:5000" to "5001:5000"
```

### MongoDB Connection Failed
```bash
# Check MongoDB is running
docker-compose ps

# View MongoDB logs
docker-compose logs mongo

# Verify connection string
docker-compose exec app printenv MONGODB_URI
```

### Container Keeps Restarting
```bash
# View logs to see the error
docker-compose logs -f app

# Common causes:
# 1. Missing environment variables
# 2. MongoDB connection failed
# 3. Port conflict
# 4. Syntax error in code
```

### Cannot Connect from Host
```bash
# Make sure container is running
docker-compose ps

# Check port mapping
docker-compose port app 5000

# Test from inside container
docker-compose exec app curl localhost:5000/health
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up -d --build

# Or rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

## 🎯 Development Workflow

### Recommended Flow
```bash
# 1. Make code changes

# 2. Rebuild and restart
docker-compose up -d --build

# 3. View logs
docker-compose logs -f app

# 4. Test API
curl http://localhost:5000/health
```

### Hot Reload (Alternative)
For development with hot reload, mount your code as a volume:

```yaml
# Add to docker-compose.yml under app service
volumes:
  - ./:/app
  - /app/node_modules
command: npm run dev
```

## 📊 Monitoring

### Check Container Health
```bash
# View all containers
docker-compose ps

# Check health status
docker inspect --format='{{.State.Health.Status}}' mealcart-backend-app-1

# View resource usage
docker stats
```

### View Database
```bash
# Access MongoDB shell
docker-compose exec mongo mongosh mealcart

# List collections
show collections

# Count documents
db.users.countDocuments()
db.recipes.countDocuments()
```

## 🚀 Production Deployment

### Build Production Image
```bash
# Build production image
docker build -t mealcart-backend:latest --target production .

# Run production container
docker run -d \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGODB_URI="your_uri" \
  -e JWT_SECRET="your_secret" \
  -e GEMINI_API_KEY="your_key" \
  -e SPOONACULAR_API_KEY="your_key" \
  --name mealcart-api \
  mealcart-backend:latest
```

### Push to Docker Hub
```bash
# Login to Docker Hub
docker login

# Tag image
docker tag mealcart-backend:latest yourusername/mealcart-backend:latest

# Push image
docker push yourusername/mealcart-backend:latest
```

## 🎓 Next Steps

1. **Start Docker**: `docker-compose up -d`
2. **Check Status**: `docker-compose ps`
3. **View Logs**: `docker-compose logs -f`
4. **Test API**: `curl http://localhost:5000/health`
5. **Stop**: `docker-compose down`

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

**Need Help?** 
- View logs: `docker-compose logs -f`
- Check status: `docker-compose ps`
- Restart: `docker-compose restart`
