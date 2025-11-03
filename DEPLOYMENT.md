# MealCart Backend - Deployment Guide

## 🚀 Quick Start Deployment

### Option 1: Docker (Recommended)

```bash
# 1. Build the production image
docker build -t mealcart-backend:latest --target production .

# 2. Run with environment variables
docker run -d \
  -p 5000:5000 \
  -e MONGODB_URI="your_mongodb_uri" \
  -e JWT_SECRET="your_jwt_secret" \
  -e GEMINI_API_KEY="your_gemini_key" \
  -e SPOONACULAR_API_KEY="your_spoonacular_key" \
  --name mealcart-api \
  mealcart-backend:latest
```

### Option 2: Docker Compose

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your values

# 2. Start all services
docker-compose up -d

# 3. Check logs
docker-compose logs -f app
```

### Option 3: Traditional Node.js

```bash
# 1. Install dependencies
npm ci --only=production

# 2. Set environment variables
export NODE_ENV=production
export MONGODB_URI="your_mongodb_uri"
export JWT_SECRET="your_jwt_secret"
# ... other variables

# 3. Start server
npm start
```

## ☁️ Cloud Platform Deployment

### Vercel (Serverless)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.example`

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Netlify (Serverless)

1. **Install Netlify CLI**:
   ```bash
   npm i -g netlify-cli
   ```

2. **Configure**:
   - Add environment variables in Netlify dashboard
   - Ensure `netlify.toml` is configured

3. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

### DigitalOcean App Platform

1. **Create New App**:
   - Connect GitHub repository
   - Select branch (main)

2. **Configure Environment**:
   - Add environment variables
   - Set build command: `npm install`
   - Set run command: `npm start`

3. **Deploy**:
   - Click "Create Resources"
   - Wait for deployment

### AWS ECS (Elastic Container Service)

1. **Build and Push Image**:
   ```bash
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

   # Build
   docker build -t mealcart-backend:latest .

   # Tag
   docker tag mealcart-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/mealcart-backend:latest

   # Push
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/mealcart-backend:latest
   ```

2. **Create ECS Task**:
   - Use AWS Console or CLI
   - Configure container with environment variables
   - Set port mapping (5000)

3. **Create Service**:
   - Configure load balancer
   - Set desired task count
   - Enable auto-scaling

### Google Cloud Run

1. **Build and Deploy**:
   ```bash
   # Build with Cloud Build
   gcloud builds submit --tag gcr.io/PROJECT_ID/mealcart-backend

   # Deploy
   gcloud run deploy mealcart-backend \
     --image gcr.io/PROJECT_ID/mealcart-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,MONGODB_URI=your_uri,JWT_SECRET=your_secret"
   ```

### Heroku

1. **Install Heroku CLI**:
   ```bash
   npm install -g heroku
   ```

2. **Create App and Deploy**:
   ```bash
   # Login
   heroku login

   # Create app
   heroku create mealcart-backend

   # Add MongoDB add-on (optional)
   heroku addons:create mongolab:sandbox

   # Set environment variables
   heroku config:set JWT_SECRET="your_secret"
   heroku config:set GEMINI_API_KEY="your_key"
   # ... other variables

   # Deploy
   git push heroku main
   ```

## 🔐 Environment Variables

### Required Variables

```env
# Server Configuration
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mealcart

# Authentication
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# APIs
GEMINI_API_KEY=AIza...
SPOONACULAR_API_KEY=your_spoonacular_key
UNSPLASH_ACCESS_KEY=your_unsplash_key

# External Services (optional)
CLERK_SECRET_KEY=sk_live_...
SENTRY_DSN=https://...

# Frontend
FRONTEND_URL=https://your-frontend-domain.com
```

### Optional Variables

```env
# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/mealcart

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# Security
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

## 📊 Pre-Deployment Checklist

### Security
- [ ] Change default JWT_SECRET to strong random value
- [ ] Configure CORS for production domains only
- [ ] Enable rate limiting (configured in middleware/security.js)
- [ ] Set secure cookie options in production
- [ ] Review and configure helmet security headers
- [ ] Enable HTTPS/TLS certificates
- [ ] Restrict database access by IP whitelist

### Performance
- [ ] Enable MongoDB indexes (already configured in models)
- [ ] Configure connection pooling (default: 10)
- [ ] Enable response compression
- [ ] Set up CDN for static assets
- [ ] Configure caching headers
- [ ] Enable MongoDB Atlas auto-scaling

### Monitoring
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Configure application monitoring (New Relic, DataDog)
- [ ] Set up log aggregation (CloudWatch, Papertrail)
- [ ] Create health check endpoints (already at /health)
- [ ] Configure uptime monitoring (Pingdom, UptimeRobot)

### Database
- [ ] Create production MongoDB database
- [ ] Configure automated backups
- [ ] Set up replica set (recommended)
- [ ] Enable MongoDB authentication
- [ ] Create database indexes (run migrations)

### Documentation
- [ ] Update API documentation
- [ ] Document environment variables
- [ ] Create runbooks for common issues
- [ ] Document deployment process

## 🔍 Health Checks

### Basic Health Check
```bash
curl https://your-api-domain.com/health
```

Expected Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### Database Health Check
```bash
curl https://your-api-domain.com/api/health/db
```

### Detailed Status
```bash
curl https://your-api-domain.com/api/health/detailed
```

## 🔄 CI/CD Setup (GitHub Actions)

The repository includes `.github/workflows/ci-cd.yml` for automated deployment.

### Required Secrets

Configure these in GitHub Repository Settings → Secrets:

- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password or access token
- Additional secrets for your deployment target

### Workflow Triggers

- **Push to main**: Runs tests, builds Docker image, pushes to registry
- **Pull requests**: Runs tests and linting only
- **Manual dispatch**: Can be triggered manually from Actions tab

## 📈 Monitoring & Logging

### Application Logs

Logs are written to:
- **Console**: For container/cloud platforms
- **File**: `/logs/app.log` (rotated daily)
- **Error logs**: `/logs/error.log`

### Log Levels

- `error`: Application errors
- `warn`: Warnings
- `info`: General information (default in production)
- `debug`: Detailed debugging (development only)

### Accessing Logs

```bash
# Docker
docker logs -f mealcart-api

# Docker Compose
docker-compose logs -f app

# Kubernetes
kubectl logs -f deployment/mealcart-backend

# Traditional
tail -f logs/app.log
```

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Failed
```
Error: connect ECONNREFUSED
```
**Solution**: 
- Check MONGODB_URI format
- Verify IP whitelist in MongoDB Atlas
- Test connection: `mongosh "your_connection_string"`

#### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Solution**:
```bash
# Find process
lsof -ti:5000

# Kill process
kill -9 <PID>

# Or use different port
export PORT=5001
```

#### JWT Verification Failed
```
Error: invalid signature
```
**Solution**:
- Ensure JWT_SECRET matches between environments
- Clear browser localStorage/cookies
- Generate new token

#### Rate Limit Exceeded
```
429 Too Many Requests
```
**Solution**:
- Wait for rate limit window to expire
- Adjust rate limits in config/index.js
- Implement token bucket for authenticated users

### Debug Mode

Run with enhanced logging:
```bash
NODE_ENV=development DEBUG=* npm run dev
```

## 🔄 Rollback Strategy

### Docker
```bash
# List images
docker images

# Run previous version
docker run -d -p 5000:5000 mealcart-backend:<previous-tag>
```

### Kubernetes
```bash
# Rollback deployment
kubectl rollout undo deployment/mealcart-backend

# View history
kubectl rollout history deployment/mealcart-backend
```

### Cloud Platforms
- Use platform's built-in rollback features
- Keep previous deployment artifacts
- Maintain deployment history

## 📞 Support

For deployment issues:
1. Check application logs
2. Review health check endpoints
3. Verify environment variables
4. Consult platform-specific documentation
5. Open GitHub issue with details

---

**Last Updated**: 2024
**Maintained by**: Satish Sahu
