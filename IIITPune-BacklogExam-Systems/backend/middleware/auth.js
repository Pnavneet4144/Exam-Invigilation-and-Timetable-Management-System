/**
 * Authentication Middleware
 * 
 * Two middleware functions:
 * 1. authenticate - Verifies JWT from Authorization header
 *    Flow: Extract token from 'Bearer <token>' → verify with JWT_SECRET → attach decoded user to req.user
 *    Returns 401 if no token or invalid token
 * 
 * 2. requireRole(role) - Returns middleware that checks req.user.role
 *    Returns 403 if role doesn't match
 */

const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access denied. ${role} role required.` });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };
