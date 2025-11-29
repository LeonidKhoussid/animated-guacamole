import { useAuth } from '../context/AuthContext.jsx';
import { BottomNav } from '../components/BottomNav.jsx';

export const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center space-x-4 mb-6">
            {/* TODO: Replace with actual user profile image URL */}
            <img
              src="https://via.placeholder.com/100" // IMAGE_URL: User profile picture
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover"
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user?.fullName || 'User'}</h2>
              <p className="text-gray-600">{user?.phone || ''}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <p className="text-gray-900">{user?.fullName || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <p className="text-gray-900">{user?.phone || 'Not set'}</p>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

