const { authRequired } = require('../middleware/auth');
const cache = require('../utils/cache');

// Mock cache utility
jest.mock('../utils/cache', () => ({
  getOrFetch: jest.fn()
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { email: 'test@example.com' } },
        error: null
      })
    }
  }))
}));

// Mock models defensively
jest.mock('../models/User', () => ({
  findOne: jest.fn()
}));

describe('Auth Middleware Unit Test', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      header: jest.fn().mockReturnValue('Bearer fake-jwt-token'),
      user: null,
      userId: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should attach user object with both id and _id to the request', async () => {
    // Define the mock user structure we expect from cache (plain object)
    const mockDbUser = {
      _id: 'userid123',
      id: 'userid123', // This was the missing property causing the bug
      username: 'testchef',
      email: 'test@example.com'
    };

    // Simulate cache returning the plain user object
    cache.getOrFetch.mockResolvedValue(mockDbUser);

    await authRequired(req, res, next);

    // Assertions
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('userid123');
    expect(req.user._id).toBe('userid123');
    expect(req.userId).toBe('userid123');
  });

  it('should fail if no token is provided', async () => {
    req.header.mockReturnValue(null);

    await authRequired(req, res, next);

    // next() as error handler should be called with an AppError
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(401);
  });
});
