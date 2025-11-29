import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChatMessages } from "../components/ChatMessages.jsx";
import { ChatInput } from "../components/ChatInput.jsx";
import { VariantCard } from "../components/VariantCard.jsx";
import { BottomNav } from "../components/BottomNav.jsx";
import { ThreeDViewer } from "../components/ThreeDViewer.jsx";
import { useWebSocket } from "../hooks/useWebSocket.js";
import apiClient from "../utils/apiClient.js";
import { toast } from "../components/Toast.jsx";

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
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [requestId, setRequestId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentPlanGeometry, setCurrentPlanGeometry] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  const handleWebSocketMessage = (data) => {
    console.log("WebSocket message received:", data);
    if (data.type === "processing_status") {
      setMessages((prev) => [
        ...prev.filter(
          (msg) =>
            msg.role !== "assistant" || !msg.content.includes(data.data.message)
        ),
        { role: "assistant", content: data.data.message },
      ]);
    } else if (data.type === "option_generated") {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Вариант ${data.data.index} из ${data.data.total} готов!`,
        },
      ]);
      // Load variant details
      if (data.data.variant_id) {
        apiClient
          .get(`/variants/${data.data.variant_id}`)
          .then((response) => {
            const variant = response.data;

            // Debug: Log full variant structure
            console.log(
              `\n📦 Variant ${data.data.index}/${data.data.total} loaded from API:`
            );
            console.log(`   ID: ${variant.id}`);
            console.log(`   Has planGeometry: ${!!variant.planGeometry}`);
            console.log(`   planGeometry type: ${typeof variant.planGeometry}`);
            console.log(`   planGeometry value:`, variant.planGeometry);

            // Log bearing wall information when variant is loaded
            if (variant.planGeometry?.geometry?.walls) {
              const walls = variant.planGeometry.geometry.walls;
              const bearingWalls = walls.filter((w) => w.isBearing);
              console.log(
                `   🚫 Bearing walls: ${bearingWalls.length} (cannot modify)`
              );
              console.log(
                `   ✅ Non-bearing walls: ${
                  walls.length - bearingWalls.length
                } (can modify)`
              );
            } else {
              console.warn(
                `   ⚠️  No planGeometry.geometry.walls found in variant`
              );
              console.log(`   Variant keys:`, Object.keys(variant));
              if (variant.planGeometry) {
                console.log(
                  `   planGeometry structure:`,
                  JSON.stringify(variant.planGeometry, null, 2)
                );
              }
            }

            setVariants((prev) => {
              // Avoid duplicates
              if (prev.find((v) => v.id === response.data.id)) {
                return prev;
              }
              return [...prev, response.data];
            });
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
  const { isConnected, error } = useWebSocket(
    requestId && !isLoadingHistory ? `/ai/stream/${requestId}` : null,
    handleWebSocketMessage
  );

  // Load persisted chat state on mount or from query param
  useEffect(() => {
    const requestIdFromQuery = searchParams.get("requestId");

    if (requestIdFromQuery) {
      // Load specific request from history - don't connect WebSocket
      setIsLoadingHistory(true);
      loadChatFromRequest(requestIdFromQuery).finally(() => {
        setIsLoadingHistory(false);
      });
    } else {
      // Load persisted state
      setIsLoadingHistory(false);
      const savedState = loadChatState(planId);
      setMessages(savedState.messages || []);
      setVariants(savedState.variants || []);
      setRequestId(savedState.requestId || null);

      // If we have a requestId but no variants, try to load them
      if (
        savedState.requestId &&
        (!savedState.variants || savedState.variants.length === 0)
      ) {
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
        newMessages.push({ role: "user", content: aiRequest.inputText });
      }
      if (aiRequest.variants && aiRequest.variants.length > 0) {
        newMessages.push({
          role: "assistant",
          content: `Сгенерировано ${aiRequest.variants.length} вариантов перепланировки`,
        });
      }
      setMessages(newMessages);

      // Set variants
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
      // Try to get variants from the AI request
      const response = await apiClient.get(`/ai/requests/${reqId}`);
      if (response.data.variants && response.data.variants.length > 0) {
        setVariants(response.data.variants);
      }
    } catch (error) {
      // Endpoint might not exist, that's okay
      console.log("Could not load variants for request:", error);
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
      toast.error("WebSocket connection error");
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
      console.error("Failed to load variants:", error);
    }
  };

  const handleSend = async (message) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setProcessing(true);
    setIsLoadingHistory(false); // New message means we're not loading history anymore

    try {
      const requestBody = {
        plan_id: planId,
        text: message,
      };

      // Only include previous_request_id if it exists
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

  const handleContinueConversation = (variant) => {
    // Add a message asking about the variant
    const message = `Расскажи подробнее о варианте: ${variant.description}`;
    handleSend(message);
  };

  const handleVariantClick = (variant) => {
    console.log("\n========== VARIANT SELECTED ==========");
    console.log("📋 Variant ID:", variant.id);
    console.log("📝 Description:", variant.description);
    console.log(
      "📊 Approval probability:",
      `${Math.round(variant.approvalProbability * 100)}%`
    );
    console.log("\n🔍 Debugging variant object:");
    console.log("   - Has planGeometry property:", "planGeometry" in variant);
    console.log("   - planGeometry value:", variant.planGeometry);
    console.log("   - planGeometry type:", typeof variant.planGeometry);
    console.log("   - All variant keys:", Object.keys(variant));

    setSelectedVariantId(variant.id);
    if (variant.planGeometry) {
      const walls = variant.planGeometry?.geometry?.walls || [];
      const bearingWalls = walls.filter((w) => w.isBearing).length;
      const nonBearingWalls = walls.filter((w) => !w.isBearing).length;

      console.log("\n🏗️  Plan Geometry:");
      console.log(`   - Total walls: ${walls.length}`);
      console.log(`   - 🚫 Bearing walls (CANNOT CHANGE): ${bearingWalls}`);
      console.log(`   - ✅ Non-bearing walls (CAN CHANGE): ${nonBearingWalls}`);

      if (bearingWalls > 0) {
        console.log(
          "\n⚠️  WARNING: This variant includes bearing walls that cannot be modified!"
        );
        walls
          .filter((w) => w.isBearing)
          .forEach((wall, idx) => {
            console.log(
              `   Bearing wall ${idx + 1}: from (${wall.start.x}, ${
                wall.start.y
              }) to (${wall.end.x}, ${wall.end.y})`
            );
          });
      }

      console.log("\n🎨 Updating 3D view with variant geometry...");
      setCurrentPlanGeometry(variant.planGeometry);
    } else {
      // Fallback: keep previous geometry or show message
      console.warn("⚠️  No geometry available for variant:", variant.id);
      console.log(
        "   Variant object structure:",
        JSON.stringify(variant, null, 2)
      );
      console.log("   Falling back to image-based rendering");
      setCurrentPlanGeometry(null);
    }
    console.log("=======================================\n");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">AI Chat</h1>

        <div className="bg-white rounded-lg shadow-md flex-1 flex flex-col">
          <ChatMessages messages={messages} />
          <ChatInput onSend={handleSend} disabled={processing} />
        </div>

        {/* 3D Viewer Section */}
        {currentPlanGeometry && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-4">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3D View
            </h2>
            <div className="h-96 bg-gray-100 rounded">
              <ThreeDViewer
                variant={
                  variants.find((v) => v.id === selectedVariantId) || null
                }
                planGeometry={currentPlanGeometry}
                viewMode="3d"
              />
            </div>
          </div>
        )}

        {variants.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Generated Variants
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {variants.map((variant) => (
                <VariantCard
                  key={variant.id}
                  variant={variant}
                  onContinueConversation={handleContinueConversation}
                  onClick={() => handleVariantClick(variant)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};
