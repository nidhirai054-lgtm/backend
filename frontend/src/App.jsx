import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import MyRides from './pages/MyRides';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import GreenRides from './pages/GreenRides';

import AlertBanner from './components/AlertBanner';
import ChatWidget from './components/ChatWidget';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ef4444' }}>Something went wrong</h2>
          <pre style={{ background: '#f9fafb', padding: 16, borderRadius: 8, fontSize: 12, overflowX: 'auto' }}>
            {this.state.error.toString()}
          </pre>
          <button onClick={() => window.location.href = '/'}
            style={{ marginTop: 16, padding: '8px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen text-primary font-bold">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen text-primary font-bold">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (user.role !== 'admin') {
    return <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          <AlertBanner />
          <ChatWidget />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            } />
            
            <Route path="/my-rides" element={
              <PrivateRoute>
                <MyRides />
              </PrivateRoute>
            } />

            <Route path="/community" element={
              <PrivateRoute>
                <Community />
              </PrivateRoute>
            } />

            <Route path="/dashboard" element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            } />

            <Route path="/green-rides" element={
              <PrivateRoute>
                <GreenRides />
              </PrivateRoute>
            } />

          </Routes>
        </div>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}

export default App;
