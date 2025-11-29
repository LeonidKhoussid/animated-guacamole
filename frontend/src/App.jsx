import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Footer } from './components/Footer.jsx';
import { ToastContainer } from './components/Toast.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { UploadPlanPage } from './pages/UploadPlanPage.jsx';
import { ChatAIPage } from './pages/ChatAIPage.jsx';
import { VariantViewerPage } from './pages/VariantViewerPage.jsx';
import { FavoritesPage } from './pages/FavoritesPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { SharePage } from './pages/SharePage.jsx';
import { SubmitApplicationPage } from './pages/SubmitApplicationPage.jsx';
import { AdminLoginPage } from './pages/admin/AdminLoginPage.jsx';
import { AdminApplicationsList } from './pages/admin/AdminApplicationsList.jsx';
import { AdminApplicationDetail } from './pages/admin/AdminApplicationDetail.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const adminToken = localStorage.getItem('admin_token');
  
  if (!adminToken) {
    return <Navigate to="/admin/login" />;
  }
  
  return children;
};

function AppContent() {
  return (
    <div className="flex flex-col min-h-screen">
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/share/:variantId" element={<><Navbar /><main className="flex-1"><SharePage /></main><Footer /></>} />
        
        {/* Pages with BottomNav - mobile design, no Navbar/Footer */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/chat/:planId" element={<ProtectedRoute><ChatAIPage /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        
        {/* Other pages with Navbar and Footer */}
        <Route path="/dashboard" element={<ProtectedRoute><><Navbar /><main className="flex-1"><DashboardPage /></main><Footer /></></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><><Navbar /><main className="flex-1"><UploadPlanPage /></main><Footer /></></ProtectedRoute>} />
        <Route path="/variant/:id" element={<ProtectedRoute><><Navbar /><main className="flex-1"><VariantViewerPage /></main><Footer /></></ProtectedRoute>} />
        <Route path="/submit/:variantId" element={<ProtectedRoute><><Navbar /><main className="flex-1"><SubmitApplicationPage /></main><Footer /></></ProtectedRoute>} />
        
        <Route path="/admin/login" element={<><Navbar /><main className="flex-1"><AdminLoginPage /></main><Footer /></>} />
        <Route path="/admin/applications" element={<AdminRoute><><Navbar /><main className="flex-1"><AdminApplicationsList /></main><Footer /></></AdminRoute>} />
        <Route path="/admin/applications/:id" element={<AdminRoute><><Navbar /><main className="flex-1"><AdminApplicationDetail /></main><Footer /></></AdminRoute>} />
        
        <Route path="/" element={<Navigate to="/home" />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
