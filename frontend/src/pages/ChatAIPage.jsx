import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChatMessages } from '../components/ChatMessages.jsx';
import { ChatInput } from '../components/ChatInput.jsx';
import { VariantCard } from '../components/VariantCard.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import apiClient from '../utils/apiClient.js';
import { toast } from '../components/Toast.jsx';

// Helper functions for localStorage persistence
const getChatStorageKey = (planId) => `chat_${planId}`;

const loadChatState = (planId) => {
  try {
    const stored = localStorage.getItem(getChatStorageKey(planId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load chat state:', error);
  }
  return { messages: [], variants: [], requestId: null };
};

const saveChatState = (planId, state) => {
  try {
    localStorage.setItem(getChatStorageKey(planId), JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save chat state:', error);
  }
};

export const ChatAIPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [requestId, setRequestId] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleWebSocketMessage = (data) => {
    console.log('WebSocket message received:', data);
    if (data.type === 'processing_status') {
      setMessages((prev) => [
        ...prev.filter(msg => msg.role !== 'assistant' || !msg.content.includes(data.data.message)),
        { role: 'assistant', content: data.data.message },
      ]);
    } else if (data.type === 'option_generated') {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Вариант ${data.data.index} из ${data.data.total} готов!` },
      ]);
      // Load variant details
      if (data.data.variant_id) {
        apiClient.get(`/variants/${data.data.variant_id}`).then((response) => {
          setVariants((prev) => {
            // Avoid duplicates
            if (prev.find(v => v.id === response.data.id)) {
              return prev;
            }
            return [...prev, response.data];
          });
        }).catch(console.error);
      }
    } else if (data.type === 'complete') {
      setProcessing(false);
      toast.success('Все варианты сгенерированы!');
    } else if (data.type === 'error') {
      setProcessing(false);
      toast.error(data.data?.message || 'Ошибка генерации');
    }
  };

  const { isConnected, error } = useWebSocket(
    requestId ? `/ai/stream/${requestId}` : null,
    handleWebSocketMessage
  );

  // Load persisted chat state on mount or from query param
  useEffect(() => {
    const requestIdFromQuery = searchParams.get('requestId');
    
    if (requestIdFromQuery) {
      // Load specific request from history
      loadChatFromRequest(requestIdFromQuery);
    } else {
      // Load persisted state
      const savedState = loadChatState(planId);
      setMessages(savedState.messages || []);
      setVariants(savedState.variants || []);
      setRequestId(savedState.requestId || null);
      
      // If we have a requestId but no variants, try to load them
      if (savedState.requestId && (!savedState.variants || savedState.variants.length === 0)) {
        loadVariantsForRequest(savedState.requestId);
      }
    }
  }, [planId, searchParams]);
  
  const loadChatFromRequest = async (reqId) => {
    try {
      const response = await apiClient.get(`/ai/requests/${reqId}`);
      const aiRequest = response.data;
      
      // Set request ID
      setRequestId(aiRequest.id);
      
      // Build messages from request
      const newMessages = [];
      if (aiRequest.inputText) {
        newMessages.push({ role: 'user', content: aiRequest.inputText });
      }
      if (aiRequest.variants && aiRequest.variants.length > 0) {
        newMessages.push({ 
          role: 'assistant', 
          content: `Сгенерировано ${aiRequest.variants.length} вариантов перепланировки` 
        });
      }
      setMessages(newMessages);
      
      // Set variants
      if (aiRequest.variants && aiRequest.variants.length > 0) {
        setVariants(aiRequest.variants);
      }
    } catch (error) {
      console.error('Failed to load chat from request:', error);
      toast.error('Failed to load chat history');
    }
  };

  const loadVariantsForRequest = async (reqId) => {
    try {
      // Try to get variants from the AI request
      const response = await apiClient.get(`/ai/requests/${reqId}`);
      if (response.data.variants && response.data.variants.length > 0) {
        setVariants(response.data.variants);
      }
    } catch (error) {
      // Endpoint might not exist, that's okay
      console.log('Could not load variants for request:', error);
    }
  };

  // Save chat state whenever it changes
  useEffect(() => {
    if (planId && (messages.length > 0 || variants.length > 0 || requestId)) {
      saveChatState(planId, {
        messages,
        variants,
        requestId,
      });
    }
  }, [planId, messages, variants, requestId]);

  useEffect(() => {
    if (error) {
      toast.error('WebSocket connection error');
    }
  }, [error]);

  const loadVariants = async () => {
    if (!requestId) return;
    try {
      // Fetch AI request to get variants
      const response = await apiClient.get(`/ai/requests/${requestId}`);
      if (response.data.variants) {
        setVariants(response.data.variants);
      }
    } catch (error) {
      // If endpoint doesn't exist, we'll rely on WebSocket messages
      console.error('Failed to load variants:', error);
    }
  };

  const handleSend = async (message) => {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setProcessing(true);

    try {
      const response = await apiClient.post('/ai/request', {
        plan_id: planId,
        text: message,
        previous_request_id: requestId, // Include previous request for context
      });
      setRequestId(response.data.request_id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Анализирую ваш запрос и генерирую варианты...' },
      ]);
    } catch (error) {
      setProcessing(false);
      toast.error(error.response?.data?.error || 'Failed to send request');
    }
  };

  const handleContinueConversation = (variant) => {
    // Add a message asking about the variant
    const message = `Расскажи подробнее о варианте: ${variant.description}`;
    handleSend(message);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">AI Chat</h1>
        
        <div className="bg-white rounded-lg shadow-md flex-1 flex flex-col">
          <ChatMessages messages={messages} />
          <ChatInput onSend={handleSend} disabled={processing} />
        </div>

        {variants.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Generated Variants</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {variants.map((variant) => (
                <VariantCard 
                  key={variant.id} 
                  variant={variant} 
                  onContinueConversation={handleContinueConversation}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

