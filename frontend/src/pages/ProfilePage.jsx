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
  const [expandedChats, setExpandedChats] = useState(new Set());
  const [variantsByChat, setVariantsByChat] = useState({});

  useEffect(() => {
    loadChatHistory();
  }, []);

  // Load variants for all chats on mount
  useEffect(() => {
    if (chatHistory.length > 0) {
      chatHistory.forEach(async (chat) => {
        if (chat._count?.variants > 0 && !variantsByChat[chat.id]) {
          try {
            const response = await apiClient.get(`/ai/requests/${chat.id}`);
            setVariantsByChat(prev => ({
              ...prev,
              [chat.id]: response.data.variants || []
            }));
          } catch (error) {
            console.error('Failed to load variants:', error);
          }
        }
      });
    }
  }, [chatHistory]);

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

  const toggleChatExpansion = async (chatId) => {
    const newExpanded = new Set(expandedChats);
    if (newExpanded.has(chatId)) {
      newExpanded.delete(chatId);
    } else {
      newExpanded.add(chatId);
      // Load variants if not already loaded
      if (!variantsByChat[chatId]) {
        try {
          const response = await apiClient.get(`/ai/requests/${chatId}`);
          setVariantsByChat(prev => ({
            ...prev,
            [chatId]: response.data.variants || []
          }));
        } catch (error) {
          console.error('Failed to load variants:', error);
          toast.error('Не удалось загрузить варианты');
        }
      }
    }
    setExpandedChats(newExpanded);
  };

  const handleShare = async (variantId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/share/${variantId}`;
    
    try {
      // Try to use the Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('✅ Ссылка скопирована! Теперь вы можете отправить её другим.');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('✅ Ссылка скопирована! Теперь вы можете отправить её другим.');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      // Show the URL in a prompt as fallback
      prompt('Скопируйте эту ссылку:', shareUrl);
      toast.info('Ссылка показана в диалоговом окне');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Профиль</h1>
        
        {/* User Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            {/* TODO: Replace with actual user profile image URL */}
            <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
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
              {chatHistory.map((chat) => {
                const isExpanded = expandedChats.has(chat.id);
                const variants = variantsByChat[chat.id] || [];
                const variantCount = chat._count?.variants || 0;

                return (
                  <div
                    key={chat.id}
                    className="bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors overflow-hidden"
                  >
                    <Link
                      to={`/chat/${chat.planId}?requestId=${chat.id}`}
                      className="block p-4"
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
                              {variantCount} вариант{variantCount !== 1 ? 'ов' : ''}
                            </span>
                          </div>
                        </div>
                        <span className="text-blue-600 font-medium">
                          →
                        </span>
                      </div>
                    </Link>
                    
                    {variantCount > 0 && (
                      <div className="border-t border-gray-200 px-4 pb-4 pt-3">
                        <div className="space-y-3">
                          {variants.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-2">Загрузка вариантов...</p>
                          ) : (
                            variants.map((variant) => (
                              <div
                                key={variant.id}
                                className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                                      {variant.description}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Вероятность одобрения: {Math.round(variant.approvalProbability * 100)}%
                                    </p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleShare(variant.id, e);
                                    }}
                                    className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                                    title="Нажмите, чтобы скопировать ссылку для sharing. Затем отправьте ссылку другим людям через сообщения, email или социальные сети."
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                    Поделиться
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

