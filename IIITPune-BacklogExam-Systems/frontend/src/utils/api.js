/**
 * Axios API Instance
 * 
 * Creates a pre-configured Axios instance that:
 * 1. Sets the base URL for all API requests
 * 2. Automatically attaches the JWT token from localStorage to every request
 * 3. Handles 401 responses by clearing the token and redirecting to login
 *
 * Usage: import api from './utils/api'; api.get('/students');
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor: attach JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on a login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login/staff';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
