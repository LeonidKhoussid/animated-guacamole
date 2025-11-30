import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if route is active
  const isHomeActive = location.pathname === '/home' || location.pathname === '/dashboard';
  const isHashtagsActive = location.pathname === '/hashtags';
  const isMessagesActive = location.pathname === '/chat' || location.pathname.startsWith('/chat/');
  const isFavoritesActive = location.pathname === '/favorites';
  const isProfileActive = location.pathname === '/profile';

  return (
    <div className="fixed bottom-4 left-0 right-0 bg-blue-600 rounded-full px-4 py-2 z-50 mx-4">
      <div className="flex justify-around items-center max-w-full mx-auto">
        {/* Home */}
        <button
          onClick={() => navigate('/home')}
          className="flex flex-col items-center space-y-1"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isHomeActive ? 'bg-white' : ''}`}>
            <img
              src={isHomeActive ? 'https://storage.yandexcloud.net/optika/plan_ai/homeIconSelected.png' : 'https://storage.yandexcloud.net/optika/plan_ai/homeIconpng.png'}
              alt="Home"
              className="w-6 h-6"
            />
          </div>
        </button>

        {/* Hashtags */}
        <button 
          onClick={() => navigate('/hashtags')}
          className="flex flex-col items-center space-y-1"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isHashtagsActive ? 'bg-white' : ''}`}>
            <img
              src={isHashtagsActive ? 'https://storage.yandexcloud.net/optika/plan_ai/readyIconSelected.png' : 'https://storage.yandexcloud.net/optika/plan_ai/readyIcon.png'}
              alt="Hashtags"
              className="w-6 h-6"
            />
          </div>
        </button>

        {/* Messages */}
        <button
          onClick={() => navigate('/chat')}
          className="flex flex-col items-center space-y-1"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMessagesActive ? 'bg-white' : ''}`}>
            <img
              src={isMessagesActive ? 'https://storage.yandexcloud.net/optika/plan_ai/chatIconSelected.png' : 'https://storage.yandexcloud.net/optika/plan_ai/chatIcon.png'}
              alt="Messages"
              className="w-6 h-6"
            />
          </div>
        </button>

        {/* Favorites */}
        <button
          onClick={() => navigate('/favorites')}
          className="flex flex-col items-center space-y-1"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isFavoritesActive ? 'bg-white' : ''}`}>
            <img
              src={isFavoritesActive ? 'https://storage.yandexcloud.net/optika/plan_ai/likeIconSelected.png' : 'https://storage.yandexcloud.net/optika/plan_ai/likeIcon.png'}
              alt="Favorites"
              className="w-6 h-6"
            />
          </div>
        </button>

        {/* Profile */}
        <button 
          onClick={() => navigate('/profile')}
          className="flex flex-col items-center space-y-1"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isProfileActive ? 'bg-white' : ''}`}>
            <img
              src={isProfileActive ? 'https://storage.yandexcloud.net/optika/plan_ai/profileIconSelected.png' : 'https://storage.yandexcloud.net/optika/plan_ai/profileIcon.png'}
              alt="Profile"
              className="w-6 h-6"
            />
          </div>
        </button>
      </div>
    </div>
  );
};

