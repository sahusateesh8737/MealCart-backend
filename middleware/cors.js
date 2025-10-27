// Advanced CORS Handling for Vercel Deployment
const corsMiddleware = (req, res, next) => {
  // Get the origin from the request
  const origin = req.headers.origin;
  
  // List of allowed origins including both production and development environments
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app',
    'http://localhost:5173', // Vite development server
    'http://localhost:5174', // Alternative Vite port
    'http://localhost:3000', // React default development server
    'http://192.168.29.216:5173', // Mobile access - frontend
    'http://192.168.29.216:5174', // Mobile access - alternative frontend
    'http://192.168.29.216:3000'  // Mobile access - React default
  ];
  
  // Check if the request origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // If no origin or origin not in list, use the default
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handling preflight OPTIONS requests - immediately respond to preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

module.exports = corsMiddleware;
