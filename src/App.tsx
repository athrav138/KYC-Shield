import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import KYCWorkflow from './pages/KYC/KYCWorkflow';
import HistoryPage from './pages/History';
import VideoAnalysis from './pages/VideoAnalysis';
import AdminDashboard from './pages/Admin/AdminDashboard';
import Navbar from './components/Navbar';
import { ThemeProvider } from './context/ThemeContext';
import { DeepAgent } from './components/DeepAgent';
import { Footer } from './components/Footer';
import { analytics } from './lib/firebase';
import { logEvent } from 'firebase/analytics';

function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    if (analytics) {
      logEvent(analytics, 'page_view', {
        page_path: location.pathname,
        page_location: window.location.href,
        page_title: document.title
      });
    }
  }, [location]);

  return null;
}

function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <ThemeProvider>
      <BrowserRouter>
        <PageTracker />
        <div className="min-h-screen font-sans selection:bg-emerald-500/30">
          {user && <Navbar user={user} onLogout={handleLogout} />}
          <Routes>
            <Route path="/login" element={!user ? <Login onLogin={setUser} /> : <Navigate to="/" />} />
            <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
            <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" />} />
            <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to="/" />} />
            
            <Route path="/" element={user ? (
              user.role === 'admin' ? <AdminDashboard /> : <Dashboard user={user} />
            ) : <Navigate to="/login" />} />
            
            <Route path="/kyc" element={user && user.role === 'user' ? <KYCWorkflow user={user} /> : <Navigate to="/login" />} />
            <Route path="/history" element={user && user.role === 'user' ? <HistoryPage user={user} /> : <Navigate to="/login" />} />
            <Route path="/video-lab" element={user && user.role === 'user' ? <VideoAnalysis /> : <Navigate to="/login" />} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <DeepAgent />
          <Footer />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
