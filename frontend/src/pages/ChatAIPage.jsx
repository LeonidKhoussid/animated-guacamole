import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChatMessages } from "../components/ChatMessages.jsx";
import { ChatInput } from "../components/ChatInput.jsx";
import { VariantCard } from "../components/VariantCard.jsx";
import { VariantCarousel } from "../components/VariantCarousel.jsx";
import { BottomNav } from "../components/BottomNav.jsx";
import { ThreeDViewer } from "../components/ThreeDViewer.jsx";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useAuth } from "../context/AuthContext.jsx";
import apiClient from "../utils/apiClient.js";
import { toast } from "../components/Toast.jsx";
import { uploadFile } from "../utils/fileUpload.js";

// Helper functions for localStorage persistence
const getChatStorageKey = (planId) => `chat_${planId}`;

const loadChatState = (planId) => {
  try {
    const stored = localStorage.getItem(getChatStorageKey(planId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load chat state:", error);
  }
  return { messages: [], variants: [], requestId: null };
};

const saveChatState = (planId, state) => {
  try {
    localStorage.setItem(getChatStorageKey(planId), JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save chat state:", error);
  }
};

export const ChatAIPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [requestId, setRequestId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentPlanGeometry, setCurrentPlanGeometry] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [userPlans, setUserPlans] = useState([]);
  const [selectedAction, setSelectedAction] = useState(null); // 'replanning' or 'design'
  const [uploading, setUploading] = useState(false);
  const processedVariantsRef = useRef(new Set());

  const loadChatFromRequest = async (reqId) => {
    try {
      const response = await apiClient.get(`/ai/requests/${reqId}`);
      const aiRequest = response.data;

      setRequestId(aiRequest.id);
      processedVariantsRef.current = new Set(
        (aiRequest.variants || []).map((v) => v.id)
      );

      const newMessages = [];
      if (aiRequest.inputText) {
        newMessages.push({ role: "user", content: aiRequest.inputText });
      }
      if (aiRequest.variants && aiRequest.variants.length > 0) {
        newMessages.push({
          role: "assistant",
          content: `Сгенерировано ${aiRequest.variants.length} вариантов перепланировки`,
        });
      }
      setMessages(newMessages);

      if (aiRequest.variants && aiRequest.variants.length > 0) {
        setVariants(aiRequest.variants);
      }
    } catch (error) {
      console.error("Failed to load chat from request:", error);
      toast.error("Failed to load chat history");
    }
  };

  const loadVariantsForRequest = async (reqId) => {
    try {
      const response = await apiClient.get(`/ai/requests/${reqId}`);
      if (response.data.variants && response.data.variants.length > 0) {
        setVariants(response.data.variants);
        response.data.variants.forEach((v) => {
          if (v?.id) processedVariantsRef.current.add(v.id);
        });
      }
    } catch (error) {
      console.log("Could not load variants for request:", error);
    }
  };

  const handleWebSocketMessage = (data) => {
    console.log("WebSocket message received:", data);
    setShowWelcome(false); // Hide welcome when conversation starts
    if (data.type === "processing_status") {
      setMessages((prev) => [
        ...prev.filter(
          (msg) =>
            msg.role !== "assistant" || !msg.content.includes(data.data.message)
        ),
        { role: "assistant", content: data.data.message },
      ]);
    } else if (data.type === "option_generated") {
      const key = data.data?.variant_id || `idx:${data.data.index}`;
      if (processedVariantsRef.current.has(key)) {
        return;
      }
      processedVariantsRef.current.add(key);
      // Format as "вариант 1: text" or use provided message
      const variantMessage = data.data.message || `Вариант ${data.data.index}: ${data.data.description || 'готов'}`;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: variantMessage,
        },
      ]);
      // Load variant details
      if (data.data.variant_id) {
        apiClient
          .get(`/variants/${data.data.variant_id}`)
          .then((response) => {
            setVariants((prev) => {
              if (prev.find((v) => v.id === response.data.id)) {
                return prev;
              }
              return [...prev, response.data];
            });
            processedVariantsRef.current.add(response.data.id);
          })
          .catch(console.error);
      }
    } else if (data.type === "complete") {
      setProcessing(false);
      toast.success("Все варианты сгенерированы!");
    } else if (data.type === "error") {
      setProcessing(false);
      toast.error(data.data?.message || "Ошибка генерации");
    }
  };

  // Only connect WebSocket if we're not loading from history and we have a requestId
  const { error } = useWebSocket(
    requestId && !isLoadingHistory ? `/ai/stream/${requestId}` : null,
    handleWebSocketMessage
  );

  // Load user plans if no planId (optional - don't show error if it fails)
  useEffect(() => {
    if (!planId) {
      const loadUserPlans = async () => {
        try {
          const response = await apiClient.get('/plans');
          setUserPlans(response.data || []);
        } catch (error) {
          // Silently fail - it's okay if user has no plans yet
          console.log('No plans found or endpoint unavailable');
          setUserPlans([]);
        }
      };
      loadUserPlans();
    } else {
      setUserPlans([]);
    }
  }, [planId]);

  // Load persisted chat state on mount or from query param
  useEffect(() => {
    const requestIdFromQuery = searchParams.get("requestId");

    const loadData = async () => {
      if (requestIdFromQuery) {
        processedVariantsRef.current = new Set();
        setIsLoadingHistory(true);
        await loadChatFromRequest(requestIdFromQuery);
        setIsLoadingHistory(false);
        setShowWelcome(false);
      } else if (planId) {
        setIsLoadingHistory(false);
        const savedState = loadChatState(planId);
        setMessages(savedState.messages || []);
        setVariants(savedState.variants || []);
        setRequestId(savedState.requestId || null);
        setShowWelcome(savedState.messages.length === 0);
        processedVariantsRef.current = new Set(
          (savedState.variants || []).map((v) => v.id)
        );

        if (
          savedState.requestId &&
          (!savedState.variants || savedState.variants.length === 0)
        ) {
          loadVariantsForRequest(savedState.requestId);
        }
      } else {
        // No planId - show welcome message
        setShowWelcome(true);
        setMessages([]);
        setVariants([]);
      }
    };

      loadData();
  }, [planId, searchParams]);

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

  const handlePlanSelect = (selectedPlanId) => {
    navigate(`/chat/${selectedPlanId}`);
  };

  useEffect(() => {
    if (error) {
      toast.error("WebSocket connection error");
    }
  }, [error]);

  const handleSend = async (message) => {
    if (!planId) {
      toast.error("Пожалуйста, сначала выберите или загрузите план квартиры");
      return;
    }

    setShowWelcome(false);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setProcessing(true);
    setIsLoadingHistory(false);

    try {
      const requestBody = {
        plan_id: planId,
        text: message,
      };

      if (requestId) {
        requestBody.previous_request_id = requestId;
      }

      const response = await apiClient.post("/ai/request", requestBody);
      setRequestId(response.data.request_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Анализирую ваш запрос и генерирую варианты...",
        },
      ]);
    } catch (error) {
      setProcessing(false);
      toast.error(error.response?.data?.error || "Failed to send request");
    }
  };

  const handleQuickAction = (action) => {
    setSelectedAction(action);
    setShowWelcome(false);
    
    const actionText = action === 'replanning' 
      ? 'Перепланировка'
      : 'Дизайн';
    
    // Add user message and assistant response
    setMessages([
      {
        role: "user",
        content: `Я хочу ${actionText}${action === 'replanning' ? ' 🔧' : ' 🎨'}`
      },
      {
        role: "assistant",
        content: `Хорошо, я вас понял! ✅\n\nЗагрузите сюда планировку своей квартиры или же выберите из уже загруженных и избранного.\n\nЗагрузить планировку можно нажав на скрепку 📎 в углу.`
      }
    ]);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const result = await uploadFile(file);
      toast.success('План успешно загружен!');
      
      // Navigate to chat with the new planId
      navigate(`/chat/${result.plan_id}`, { replace: true });
      
      // If there was a selected action, send it as a message
      if (selectedAction) {
        const actionText = selectedAction === 'replanning' 
          ? 'Перепланировка — снести/добавить стены, объединить комнаты, проверить законность.'
          : 'Дизайн — расстановка мебели, выбор стиля, варианты интерьера.';
        
        // Wait a bit for navigation, then send the message
      setTimeout(() => {
        handleSend(actionText);
      }, 500);
    }
  } catch (error) {
    // Avoid noisy toasts on canceled/aborted requests
    const maybeCanceled =
      error?.code === 'ERR_CANCELED' ||
      error?.message?.toLowerCase?.().includes('canceled');
    if (!maybeCanceled) {
      toast.error(error.response?.data?.error || 'Ошибка загрузки файла');
    }
  } finally {
    setUploading(false);
  }
};

  const handleVariantClick = (variant) => {
    setSelectedVariantId(variant.id);
    if (variant.planGeometry) {
      setCurrentPlanGeometry(variant.planGeometry);
    } else {
      setCurrentPlanGeometry(null);
    }
  };

  const userName = user?.fullName?.split(' ')[0] || 'Пользователь';

  return (
    <div className="min-h-screen bg-[#2593F4] flex flex-col pb-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 z-10">
        <button
          onClick={() => navigate('/home')}
          className="text-white p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button
          onClick={() => navigate('/home')}
          className="text-white p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Variants Carousel - Sticky at top */}
      {variants.length > 0 && (
        <VariantCarousel
          variants={variants}
          onVariantClick={handleVariantClick}
          selectedVariantId={selectedVariantId}
        />
      )}

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
        {/* Welcome Message */}
        {showWelcome && messages.length === 0 && (
          <div className="mb-6">
            <div className="bg-white rounded-3xl rounded-bl-none p-5 shadow-lg max-w-[90%]">
              <p className="text-gray-900 text-base font-medium mb-2">
                Здравствуйте, {userName}!
              </p>
              <p className="text-gray-900 text-sm mb-3 leading-relaxed">
                Я ваш помощник по перепланировке и дизайну квартиры.
              </p>
              {!planId ? (
                <>
                  <p className="text-gray-900 text-sm mb-3 font-medium">
                    Выберите, чем хотите заняться:
                  </p>
                  <ul className="space-y-2.5 mb-4">
                    <li className="flex items-start text-gray-900 text-sm leading-relaxed">
                      <span className="mr-2 text-base">🔧</span>
                      <span>Перепланировка — снести/добавить стены, объединить комнаты, проверить законность.</span>
                    </li>
                    <li className="flex items-start text-gray-900 text-sm leading-relaxed">
                      <span className="mr-2 text-base">🎨</span>
                      <span>Дизайн — расстановка мебели, выбор стиля, варианты интерьера.</span>
                    </li>
                  </ul>
                  <p className="text-gray-900 text-xs leading-relaxed mb-4">
                    Можете просто написать мне, что хотите изменить, например: «Объединить кухню и гостиную», «Сделай планировку без коридора» и т.д.
                  </p>
                  {userPlans.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-gray-900 text-xs font-medium mb-2">Или выберите план:</p>
                      {userPlans.slice(0, 3).map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => handlePlanSelect(plan.id)}
                          className="w-full bg-gray-50 hover:bg-gray-100 rounded-lg p-3 text-left flex items-center space-x-3 transition-colors"
                        >
                          {plan.fileUrl && (
                            <img
                              src={plan.fileUrl}
                              alt="Plan"
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 font-medium">
                              {plan.name || `План ${plan.id.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(plan.createdAt).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-900 text-xs leading-relaxed">
                  Можете просто написать мне, что хотите изменить, например: «Объединить кухню и гостиную», «Сделай планировку без коридора» и т.д.
                </p>
              )}
            </div>

            {/* Quick Action Buttons */}
            {!planId && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleQuickAction('replanning')}
                  className="flex-1 bg-blue-400 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-500 transition-colors text-sm"
                >
                  Перепланировка
                </button>
                <button
                  onClick={() => handleQuickAction('design')}
                  className="flex-1 bg-blue-400 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-500 transition-colors text-sm"
                >
                  Дизайн
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chat Messages */}
        {messages.length > 0 && (
          <div className="space-y-4 mb-4">
            <ChatMessages messages={messages} />
          </div>
        )}

        {/* 3D Viewer */}
        {currentPlanGeometry && selectedVariantId && (
          <div className="mb-4 bg-white rounded-xl p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">3D Вид</h3>
            <div className="h-64 bg-gray-100 rounded-lg">
              <ThreeDViewer
                variant={variants.find((v) => v.id === selectedVariantId) || null}
                planGeometry={currentPlanGeometry}
                viewMode="3d"
              />
            </div>
          </div>
        )}
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="px-4 pb-4 pt-2 bg-[#2593F4] sticky bottom-0 z-20">
        <ChatInput 
          onSend={handleSend} 
          disabled={processing || uploading}
          onFileUpload={handleFileUpload}
          showUploadHint={selectedAction && !planId}
        />
      </div>

      <BottomNav />
    </div>
  );
};
