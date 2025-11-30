import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import apiClient from '../utils/apiClient.js';
import { toast } from '../components/Toast.jsx';

export const ProfilePage = () => {
  const { user } = useAuth();
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/ai/history').catch(() => ({ data: [] }));
      setChatHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Профиль</h1>
        
        {/* User Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Полное имя</label>
              <p className="text-gray-900">{user?.fullName || 'Не указано'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
              <p className="text-gray-900">{user?.phone || 'Не указано'}</p>
            </div>
          </div>
        </div>

        {/* Chat History */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">История чатов</h2>
          {loading ? (
            <p className="text-gray-600">Загрузка...</p>
          ) : chatHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">История чатов пуста.</p>
              <Link
                to="/upload"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Начать первый чат
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {chatHistory.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/chat/${chat.planId}?requestId=${chat.id}`}
                  className="block bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors p-4"
                >
                  <div className="flex items-start space-x-3">
                    {chat.plan?.fileUrl && (
                      <img
                        src={chat.plan.fileUrl}
                        alt="Floor plan"
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {chat.inputText || 'Разговор'}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">
                        {formatDate(chat.createdAt)}
                      </p>
                      {chat.inputText && (
                        <p className="text-gray-700 text-sm line-clamp-2">{chat.inputText}</p>
                      )}
                      <div className="flex items-center space-x-4 text-xs text-gray-600 mt-2">
                        <span>
                          {chat._count?.variants || 0} вариант{chat._count?.variants !== 1 ? 'ов' : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-blue-600 font-medium">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

