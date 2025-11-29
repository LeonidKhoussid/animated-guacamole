import { useNavigate } from 'react-router-dom';

export const BottomNav = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 rounded-t-3xl px-4 py-3">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {/* Home - Active */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex flex-col items-center space-y-1"
        >
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            {/* TODO: Replace with actual home icon URL */}
            <img
              src="https://via.placeholder.com/24" // IMAGE_URL: Home icon
              alt="Home"
              className="w-6 h-6"
            />
          </div>
        </button>

        {/* Hashtags */}
        <button className="flex flex-col items-center space-y-1">
          {/* TODO: Replace with actual hashtag icon URL */}
          <img
            src="https://via.placeholder.com/24" // IMAGE_URL: Hashtag icon
            alt="Hashtags"
            className="w-6 h-6 opacity-70"
          />
        </button>

        {/* Messages */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex flex-col items-center space-y-1"
        >
          {/* TODO: Replace with actual messages icon URL */}
          <img
            src="https://via.placeholder.com/24" // IMAGE_URL: Messages/Chat icon
            alt="Messages"
            className="w-6 h-6 opacity-70"
          />
        </button>

        {/* Favorites */}
        <button
          onClick={() => navigate('/favorites')}
          className="flex flex-col items-center space-y-1"
        >
          {/* TODO: Replace with actual favorites icon URL */}
          <img
            src="https://via.placeholder.com/24" // IMAGE_URL: Heart/Favorites icon
            alt="Favorites"
            className="w-6 h-6 opacity-70"
          />
        </button>

        {/* Profile */}
        <button className="flex flex-col items-center space-y-1">
          {/* TODO: Replace with actual profile icon URL */}
          <img
            src="https://via.placeholder.com/24" // IMAGE_URL: Profile/Person icon
            alt="Profile"
            className="w-6 h-6 opacity-70"
          />
        </button>
      </div>
    </div>
  );
};

