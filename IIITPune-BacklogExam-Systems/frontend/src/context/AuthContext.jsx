/**
 * Authentication Context
 * 
 * Provides global auth state across the React app.
 * 
 * State:
 * - user: { id, name, email, role } or null
 * - token: JWT string or null
 * - loading: true while checking auth on mount
 * 
 * Methods:
 * - login(email, password, loginType): Authenticates user via API,
 *   stores token in localStorage, sets user state
 * - logout(): Clears token and user state, redirects to login
 * 
 * On mount, checks if a token exists in localStorage and validates
 * it by calling /api/auth/me. If valid, restores the session.
 * If invalid (expired/tampered), clears the stale token.
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // On mount: verify existing token is still valid
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          // Token is invalid or expired — clear it
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, []);

  /**
   * Login function
   * @param {string} email
   * @param {string} password  
   * @param {string} loginType - 'admin' or 'staff'
   * @returns {object} user data on success
   * @throws error with message on failure
   */
  const login = async (email, password, loginType) => {
    const res = await api.post(`/auth/login/${loginType}`, { email, password });
    const { token: newToken, user: userData } = res.data;
    
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login/staff');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
