# MealCart Backend API

A comprehensive backend API for the MealCart application - an AI-powered recipe generator and grocery list manager built with the MERN stack.

## Features

- **User Authentication**: JWT-based authentication with secure password hashing
- **Recipe Management**: Search, save, and organize recipes from external APIs
- **Grocery List Generation**: Intelligent grocery list creation from selected recipes
- **AI Integration**: Gemini AI for recipe suggestions and cooking assistance
- **External API Integration**: Spoonacular API for recipe search

## Tech Stack

- **Node.js** & **Express.js** - Server framework
- **MongoDB** & **Mongoose** - Database and ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Google Generative AI** - AI assistance
- **Spoonacular API** - Recipe data

## Project Structure

```
backend/
├── models/
│   ├── User.js          # User schema and methods
│   └── Recipe.js        # Recipe schema and methods
├── routes/
│   ├── auth.js          # Authentication routes
│   ├── recipes.js       # Recipe management routes
│   ├── grocerylist.js   # Grocery list generation routes
│   └── gemini.js        # AI assistance routes
├── middleware/
│   └── auth.js          # JWT authentication middleware
├── server.js            # Main server file
├── package.json         # Dependencies and scripts
└── .env                 # Environment variables
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MealCart/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Copy `.env.example` to `.env` and configure:
   ```env
   MONGODB_URI=mongodb://localhost:27017/mealcart
   JWT_SECRET=your_super_secure_jwt_secret_key_here
   PORT=5000
   SPOONACULAR_API_KEY=your_spoonacular_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   # Development mode with nodemon
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication (`/api/auth`)

- `POST /register` - Register new user
- `POST /login` - User login
- `GET /me` - Get current user info

### Recipes (`/api/recipes`)

- `GET /search` - Search recipes by ingredients
- `POST /save` - Save recipe to user's collection
- `GET /saved/:userId` - Get user's saved recipes
- `DELETE /delete/:userId/:recipeId` - Delete saved recipe
- `GET /saved/search/:userId` - Search saved recipes
- `PATCH /update/:recipeId` - Update recipe (rating, notes, favorite)
- `POST /cooked/:recipeId` - Mark recipe as cooked

### Grocery List (`/api/grocerylist`)

- `POST /generate` - Generate grocery list from recipes
- `GET /history` - Get grocery list history
- `POST /save` - Save grocery list

### AI Assistance (`/api/gemini`)

- `POST /suggest` - Get AI suggestions for cooking
- `POST /analyze-recipe` - Analyze recipe details
- `POST /meal-plan` - Generate meal plans

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `PORT` | Server port (default: 5000) | No |
| `SPOONACULAR_API_KEY` | Spoonacular API key | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `NODE_ENV` | Environment (development/production) | No |
| `FRONTEND_URL` | Frontend URL for CORS | No |

## API Keys Setup

1. **Spoonacular API**:
   - Sign up at [Spoonacular](https://spoonacular.com/food-api)
   - Get your API key from the dashboard
   - Add to `.env` as `SPOONACULAR_API_KEY`

2. **Google Gemini API**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add to `.env` as `GEMINI_API_KEY`

## Database Models

### User Model
- `username` - Unique username
- `email` - Unique email address
- `password` - Hashed password
- `preferences` - Dietary restrictions and preferences
- `createdAt` - Account creation timestamp

### Recipe Model
- `externalId` - External API recipe ID
- `name` - Recipe name
- `ingredients` - Array of ingredient objects
- `instructions` - Cooking instructions
- `userId` - Reference to user who saved it
- `nutrition` - Nutritional information
- `rating` - User rating (1-5)
- `notes` - User notes
- `timesCooked` - Usage tracking

## Security Features

- Password hashing with bcryptjs (cost factor 12)
- JWT token-based authentication
- Protected routes with authentication middleware
- Input validation and sanitization
- CORS configuration
- Error handling middleware

## Development

### Scripts

```bash
npm start       # Start production server
npm run dev     # Start development server with nodemon
npm test        # Run tests (to be implemented)
```

### Adding New Routes

1. Create route file in `routes/` directory
2. Implement route handlers with proper error handling
3. Add authentication middleware where needed
4. Import and use in `server.js`

### Database Operations

- Use Mongoose for all database operations
- Implement proper error handling
- Add validation at schema level
- Use indexes for performance optimization

## Error Handling

The API uses consistent error response format:

```json
{
  "message": "Human-readable error message",
  "error": "ERROR_CODE",
  "details": "Additional error details (development only)"
}
```

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Include input validation
4. Write clear commit messages
5. Test your changes thoroughly

## License

MIT License - see LICENSE file for details
