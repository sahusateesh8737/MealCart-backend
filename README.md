# MealCart Backend API

[![CI/CD](https://github.com/sahusateesh8737/MealCart-backend/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/sahusateesh8737/MealCart-backend/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Production-grade backend API for MealCart** - An AI-powered recipe generator and grocery list manager built with the MERN stack.

## 🚀 Features

- **🔐 Authentication**: JWT-based authentication with secure password hashing
- **📝 Recipe Management**: Search, save, and organize recipes from multiple sources
- **🤖 AI Integration**: Gemini AI for intelligent recipe generation and suggestions
- **🛒 Grocery Lists**: Smart grocery list generation from selected recipes
- **🔒 Security**: Rate limiting, helmet, CORS, input sanitization
- **📊 Database**: MongoDB with connection pooling and retry logic
- **🐳 Docker Ready**: Multi-stage Docker builds for development and production
- **⚡ Performance**: Optimized for serverless and traditional deployments
- **📈 Monitoring**: Structured logging and health check endpoints

## 🏗️ Architecture

```
├── config/              # Configuration management
│   ├── index.js        # Central configuration
│   └── database.js     # Database connection manager
├── middleware/         # Express middleware
│   ├── auth.js         # JWT authentication
│   ├── errorHandler.js # Global error handling
│   ├── security.js     # Security middleware
│   ├── validator.js    # Request validation
│   ├── cors.js         # CORS configuration
│   └── logging.js      # Request logging
├── models/             # Mongoose schemas
│   ├── User.js        # User model with authentication
│   └── Recipe.js      # Recipe model with indexing
├── routes/             # API route handlers
│   ├── auth.js        # Authentication endpoints
│   ├── users.js       # User management
│   ├── recipes.js     # Recipe operations
│   ├── ai.js          # AI-powered features
│   ├── gemini.js      # Gemini AI integration
│   └── grocerylist.js # Grocery list generation
├── controllers/        # Business logic
├── services/          # External service integrations
├── utils/             # Utility functions
├── app.js             # Express app configuration
└── server.js          # Server entry point
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + bcryptjs
- **AI**: Google Gemini API
- **External APIs**: Spoonacular, Unsplash
- **Security**: Helmet, Rate Limit, Mongo Sanitize
- **DevOps**: Docker, Docker Compose, GitHub Actions

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- MongoDB 7+ (local or cloud)
- API Keys (Gemini, Spoonacular, Unsplash)

### Local Development

```bash
# Clone the repository
git clone https://github.com/sahusateesh8737/MealCart-backend.git
cd MealCart-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start development server
npm run dev
```

### Docker Development

```bash
# Start all services (app + MongoDB + Mongo Express)
docker-compose up

# Or build and run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/mealcart

# Authentication
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# APIs
GEMINI_API_KEY=your_gemini_key
SPOONACULAR_API_KEY=your_spoonacular_key
UNSPLASH_ACCESS_KEY=your_unsplash_key

# Frontend
FRONTEND_URL=http://localhost:5173
```

## 🚀 Deployment

### Docker Production Build

```bash
# Build production image
docker build -t mealcart-backend:latest --target production .

# Run production container
docker run -p 5000:5000 --env-file .env mealcart-backend:latest
```

### Cloud Platforms

#### Vercel/Netlify (Serverless)
- Configure environment variables in platform dashboard
- Deploy directly from GitHub
- Auto-scales based on traffic

#### AWS ECS / Google Cloud Run
```bash
# Build and push to registry
docker build -t your-registry/mealcart-backend:latest .
docker push your-registry/mealcart-backend:latest

# Deploy to your cloud platform
# Follow platform-specific deployment guides
```

#### DigitalOcean App Platform
- Connect GitHub repository
- Set environment variables
- Configure build and run commands
- Auto-deploy on push

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Authentication
```http
POST /api/auth/register      # Register new user
POST /api/auth/login         # Login user
```

### Users
```http
GET    /api/users/profile    # Get user profile (auth required)
PUT    /api/users/profile    # Update profile (auth required)
```

### Recipes
```http
GET    /api/recipes/search              # Search recipes
POST   /api/recipes/save                # Save recipe (auth required)
GET    /api/recipes/my-recipes          # Get user's recipes (auth required)
DELETE /api/recipes/:id                 # Delete recipe (auth required)
```

### AI Features
```http
POST /api/ai/generate-recipe            # Generate recipe with AI (auth required)
POST /api/gemini/suggest                # Get AI suggestions (auth required)
```

### Grocery Lists
```http
POST /api/grocerylist/generate          # Generate grocery list (auth required)
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📝 Scripts

```bash
npm start           # Start production server
npm run dev         # Start development server with nodemon
npm run dev:debug   # Start with debug logging
npm test            # Run tests
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
npm run format      # Format code with Prettier
npm run audit       # Run security audit
npm run docker:build # Build Docker image
npm run docker:run  # Run Docker container
```

## 🔒 Security

- **Authentication**: JWT tokens with secure secret
- **Password Hashing**: bcrypt with salt rounds
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: Sanitizes all user inputs
- **MongoDB Injection**: Protection against NoSQL injection
- **CORS**: Configured for specific origins
- **Helmet**: Sets secure HTTP headers
- **Environment Variables**: Sensitive data in .env files

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Satish Sahu**
- GitHub: [@sahusateesh8737](https://github.com/sahusateesh8737)

## 🙏 Acknowledgments

- Google Gemini AI for intelligent recipe generation
- Spoonacular API for recipe data
- Unsplash API for high-quality food images
- MongoDB team for excellent database tools

## 📞 Support

For support, email your-email@example.com or open an issue in the GitHub repository.

---

**Made with ❤️ by Satish Sahu**
