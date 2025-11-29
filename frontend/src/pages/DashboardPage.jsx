import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../utils/apiClient.js';
import { VariantCard } from '../components/VariantCard.jsx';
import { toast } from '../components/Toast.jsx';

export const DashboardPage = () => {
  const [favorites, setFavorites] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'favorites'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [favoritesRes, historyRes] = await Promise.all([
        apiClient.get('/favorites').catch(() => ({ data: [] })),
        apiClient.get('/ai/history').catch(() => ({ data: [] })),
      ]);
      setFavorites(favoritesRes.data || []);
      setChatHistory(historyRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load dashboard data');
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
          <Link
            to="/upload"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Upload Floor Plan
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Chat History
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'favorites'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Favorites
            </button>
          </nav>
        </div>

        {/* Chat History Tab */}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Chat History</h2>
            {loading ? (
              <p className="text-gray-600">Loading...</p>
            ) : chatHistory.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600 mb-4">No chat history yet.</p>
                <Link
                  to="/upload"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Start Your First Chat
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((chat) => (
                  <Link
                    key={chat.id}
                    to={`/chat/${chat.planId}?requestId=${chat.id}`}
                    className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {chat.plan?.fileUrl && (
                            <img
                              src={chat.plan.fileUrl}
                              alt="Floor plan"
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">
                              {chat.inputText || 'Chat conversation'}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {formatDate(chat.createdAt)}
                            </p>
                          </div>
                        </div>
                        {chat.inputText && (
                          <p className="text-gray-700 mb-2 line-clamp-2">{chat.inputText}</p>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>
                            {chat._count?.variants || 0} variant{chat._count?.variants !== 1 ? 's' : ''}
                          </span>
                          {chat.variants && chat.variants.length > 0 && (
                            <span className="text-blue-600">
                              Preview: {chat.variants[0].description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <span className="text-blue-600 hover:text-blue-800 font-medium">
                          Continue →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Favorites</h2>
            {loading ? (
              <p className="text-gray-600">Loading...</p>
            ) : favorites.length === 0 ? (
              <p className="text-gray-600">No favorites yet. Start by uploading a plan!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map((fav) => (
                  <VariantCard key={fav.id} variant={fav.variant} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


