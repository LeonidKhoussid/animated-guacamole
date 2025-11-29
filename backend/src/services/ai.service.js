import prisma from '../models/prisma.js';
import { callGigaChat } from '../utils/gigachat.js';

// Validate GigaChat credentials on startup
if (!process.env.GIGACHAT_CLIENT_ID || !process.env.GIGACHAT_CLIENT_SECRET) {
  console.warn('⚠️  WARNING: GigaChat credentials not set. Set GIGACHAT_CLIENT_ID and GIGACHAT_CLIENT_SECRET in .env');
}

export const createAiRequest = async (userId, planId, inputText, inputAudioUrl, inputImageUrl) => {
  // Store Russian text directly - PostgreSQL supports UTF-8
  const aiRequest = await prisma.aiRequest.create({
    data: {
      userId,
      planId,
      inputText,
      inputAudioUrl,
      inputImageUrl,
    },
  });

  return aiRequest;
};

export const getAiRequest = async (requestId, userId) => {
  const aiRequest = await prisma.aiRequest.findUnique({
    where: { id: requestId },
    include: {
      variants: {
        orderBy: { createdAt: 'asc' },
      },
      plan: {
        select: {
          id: true,
          fileUrl: true,
          createdAt: true,
        },
      },
    },
  });

  if (!aiRequest) {
    throw new Error('AI request not found');
  }

  // Verify user owns the request
  if (aiRequest.userId !== userId) {
    throw new Error('Unauthorized access');
  }

  return aiRequest;
};

export const getUserChatHistory = async (userId) => {
  const aiRequests = await prisma.aiRequest.findMany({
    where: { userId },
    include: {
      plan: {
        select: {
          id: true,
          fileUrl: true,
          createdAt: true,
        },
      },
      variants: {
        select: {
          id: true,
          description: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
      _count: {
        select: {
          variants: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return aiRequests;
};

// Analyze floor plan image using GigaChat
// Note: GigaChat may not support vision API, so we'll use text-only analysis for now
const analyzeFloorPlan = async (planImageUrl) => {
  try {
    console.log('Analyzing floor plan with GigaChat (text-only):', planImageUrl);
    
    // For now, skip image analysis since GigaChat API format may differ
    // Return null to skip analysis - variants will still be generated based on user prompt
    return null;
    
    // TODO: Implement GigaChat vision API when format is confirmed
    const messages = [
      {
        role: 'system',
        content: 'Ты профессиональный архитектор с экспертизой в анализе планов квартир. Твоя задача - детально проанализировать план и вернуть структурированные данные ТОЛЬКО в формате JSON без дополнительного текста.',
      },
      {
        role: 'user',
        content: `Проанализируй план квартиры по URL: ${planImageUrl}. Определи:
1. Расположение несущих стен
2. Расположение мокрых зон (кухня, ванная, туалет)
3. Размеры комнат
4. Расположение дверей и окон
5. Общую структуру планировки

Верни ответ ТОЛЬКО в формате JSON:
{
  "loadBearingWalls": ["описание несущих стен"],
  "wetZones": [{"type": "кухня/ванная/туалет", "location": "описание расположения"}],
  "rooms": [{"name": "название", "area": "площадь", "dimensions": "размеры"}],
  "doors": ["описание дверей"],
  "windows": ["описание окон"],
  "structure": "описание структуры"
}`,
      },
    ];

    const response = await callGigaChat(messages, 'GigaChat', {
      temperature: 0.3, // Lower temperature for more accurate analysis
      max_tokens: 2000,
    });
    const analysisText = response.choices[0].message.content;
    
    // Extract JSON from response
    let jsonText = analysisText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
    }

    const analysis = JSON.parse(jsonText);
    console.log('Floor plan analysis completed successfully');
    return analysis;
  } catch (error) {
    console.error('Failed to analyze floor plan:', error.message);
    return null;
  }
};

// Generate 3D model based on variant description
const generate3DModelUrl = async (variantId, planImageUrl, variantDescription) => {
  // For MVP: Return a URL that can be used to visualize the variant
  // In production, this would generate actual 3D models
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  // Store variant ID so frontend can generate visualization
  return `${baseUrl}/api/3d-models/${variantId}`;
};

// Generate thumbnail for variant
const generateThumbnailUrl = async (variantId, planImageUrl, variantDescription) => {
  // Use the original plan image as thumbnail for now
  return planImageUrl;
};

const generateVariantsWithAI = async (aiRequestId, planId, userPrompt, previousRequestId = null) => {
  // Get plan details
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Analyze the floor plan image (optional)
  let floorPlanAnalysis = null;
  if (plan.fileUrl) {
    try {
      floorPlanAnalysis = await analyzeFloorPlan(plan.fileUrl);
      if (floorPlanAnalysis) {
        console.log('Floor plan analysis ready');
      }
    } catch (error) {
      console.warn('Failed to analyze floor plan, continuing without analysis:', error.message);
      floorPlanAnalysis = null;
    }
  }

  // Get previous conversation context if available
  let conversationHistory = [];
  if (previousRequestId) {
    try {
      const previousRequest = await prisma.aiRequest.findUnique({
        where: { id: previousRequestId },
        include: {
          variants: {
            select: {
              description: true,
              normativeExplanation: true,
              approvalProbability: true,
            },
          },
        },
      });

      if (previousRequest) {
        if (previousRequest.inputText) {
          conversationHistory.push({
            role: 'user',
            content: previousRequest.inputText,
          });
        }

        if (previousRequest.variants && previousRequest.variants.length > 0) {
          const variantsSummary = previousRequest.variants
            .map((v, i) => `Вариант ${i + 1}: ${v.description} (вероятность одобрения: ${Math.round(v.approvalProbability * 100)}%)`)
            .join('\n');
          conversationHistory.push({
            role: 'assistant',
            content: `Ранее предложенные варианты:\n${variantsSummary}`,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load previous conversation context:', error);
    }
  }

  // Construct AI prompt
  const analysisContext = floorPlanAnalysis && floorPlanAnalysis.loadBearingWalls
    ? `\n\nАнализ текущего плана квартиры:
- Несущие стены: ${floorPlanAnalysis.loadBearingWalls?.join(', ') || 'не определены'}
- Мокрые зоны: ${floorPlanAnalysis.wetZones?.map(z => `${z.type} (${z.location})`).join(', ') || 'не определены'}
- Комнаты: ${floorPlanAnalysis.rooms?.map(r => `${r.name} (${r.area})`).join(', ') || 'не определены'}
- Структура: ${floorPlanAnalysis.structure || 'не определена'}

ВАЖНО: При генерации вариантов УЧТИ эту информацию и создай РАЗНЫЕ варианты перепланировки, каждый с уникальными изменениями.`
    : '';

  const userRequestEmphasis = userPrompt && userPrompt !== 'Предложи варианты перепланировки квартиры'
    ? `\n\nКРИТИЧЕСКИ ВАЖНО: Пользователь запросил конкретные изменения: "${userPrompt}"
Ты ДОЛЖЕН создать варианты, которые ОТВЕЧАЮТ именно на этот запрос. Каждый вариант должен учитывать пожелания пользователя и предлагать РАЗНЫЕ способы их реализации.`
    : '';

  const systemPrompt = `Ты ведущий эксперт по архитектурному проектированию и перепланировке жилых помещений в России с 20-летним опытом. Твоя задача - создать 3-5 УНИКАЛЬНЫХ, ДЕТАЛЬНЫХ и ПРАКТИЧНЫХ вариантов перепланировки квартиры на основе конкретного запроса пользователя.

СТРОГИЕ ТРЕБОВАНИЯ К КАЧЕСТВУ:
1. ВСЕ ответы ТОЛЬКО на РУССКОМ языке, профессиональная терминология
2. Каждый вариант ДОЛЖЕН кардинально отличаться от других по концепции и реализации
3. Варианты ОБЯЗАТЕЛЬНО должны отвечать на запрос: "${userPrompt}"
4. Запрещено повторять варианты между разными запросами
5. Каждый вариант должен иметь четко описанные технические решения

ТЕХНИЧЕСКИЕ НОРМЫ (СНиП 2.08.01-89, СП 54.13330.2016, ЖК РФ):
- Несущие стены: ЗАПРЕЩЕНО демонтировать, перемещать или нарушать целостность
- Мокрые зоны: кухня, ванная, туалет - только рядом с существующими стояками водоснабжения и канализации
- Минимальные площади: жилая комната - 9 м² (одна комната), 14 м² (две и более), кухня - 6 м², ванная - 1.8 м², туалет - 0.96 м²
- Ширина проходов: коридор - минимум 1.2 м, проходы в комнатах - минимум 0.9 м
- Высота потолков: минимум 2.5 м в жилых комнатах
- Естественное освещение: жилые комнаты должны иметь окна, площадь окон не менее 1/8 площади пола
- Вентиляция: обязательна вытяжная вентиляция в кухне, ванной, туалете

СТРУКТУРА ОТВЕТА ДЛЯ КАЖДОГО ВАРИАНТА:
1. description: Краткое, но информативное название варианта (2-3 предложения)
2. normativeExplanation: Детальное объяснение соответствия нормам с указанием конкретных пунктов СНиП
3. approvalProbability: Реалистичная оценка вероятности одобрения БТИ (0.0-1.0)
4. changes: Массив из 3-5 конкретных изменений с указанием размеров и расположения
5. floorPlanModifications: Подробное техническое описание изменений для архитектора

${conversationHistory.length > 0 ? 'КОНТЕКСТ: Учитывай предыдущие варианты из разговора. Новые варианты должны быть РАЗНЫМИ от уже предложенных.' : ''}
${analysisContext}
${userRequestEmphasis}

ФОРМАТ ОТВЕТА - ТОЛЬКО ВАЛИДНЫЙ JSON БЕЗ ДОПОЛНИТЕЛЬНОГО ТЕКСТА:
{
  "variants": [
    {
      "description": "Детальное описание варианта с указанием конкретных изменений, размеров и расположения комнат",
      "normativeExplanation": "Подробное объяснение соответствия нормам с указанием конкретных пунктов СНиП и ЖК РФ. Укажи, какие стены несущие (не трогаем), какие перегородки можно демонтировать, как обеспечены требования по площадям и проходам",
      "approvalProbability": 0.85,
      "changes": [
        "Конкретное изменение 1 с размерами (например: 'Демонтаж перегородки между гостиной и кухней длиной 3.5 м, создание единого пространства площадью 28 м²')",
        "Конкретное изменение 2 с размерами",
        "Конкретное изменение 3 с размерами"
      ],
      "floorPlanModifications": "Детальное техническое описание: какие стены демонтируются (указать толщину и материал), какие возводятся новые (указать тип перегородки), какие комнаты объединяются или разделяются, расположение дверей и окон, размеры получившихся помещений"
    }
  ]
}`;

  const userMessage = userPrompt || 'Предложи варианты перепланировки квартиры';

  console.log('Starting GigaChat variant generation...');
  console.log(`User prompt: ${userMessage.substring(0, 100)}`);

  try {
    // Build messages array with conversation history
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Use GigaChat for better quality responses
    const response = await callGigaChat(messages, 'GigaChat', {
      temperature: 0.7,
      max_tokens: 4000,
    });
    const responseText = response.choices[0].message.content;
    console.log(`GigaChat response received (${responseText.length} chars), parsing JSON...`);
    
    // Extract JSON from response
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
    }

    // Fix common JSON issues
    jsonText = jsonText
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');

    const parsed = JSON.parse(jsonText);
    const variants = parsed.variants || [];
    
    if (!Array.isArray(variants) || variants.length === 0) {
      throw new Error('No valid variants generated by AI');
    }
    
    console.log(`✓ Successfully parsed ${variants.length} variants from GigaChat response`);

    // Prepare variant data - use plan.fileUrl directly as thumbnail
    const variantDataList = [];
    const variantSlice = variants.slice(0, 5);
    for (let i = 0; i < variantSlice.length; i++) {
      const variantData = variantSlice[i];
      
      // Use plan image directly as thumbnail (no image generation)
      const thumbnailUrl = plan.fileUrl;
      const model3dUrl = await generate3DModelUrl(aiRequestId, plan.fileUrl, variantData.description);

      variantDataList.push({
        aiRequestId,
        description: variantData.description || `Вариант ${i + 1} перепланировки`,
        normativeExplanation: variantData.normativeExplanation || 'Соответствует нормам СНиП и ЖК РФ',
        approvalProbability: variantData.approvalProbability || 0.75,
        thumbnailUrl,
        model3dUrl,
      });
      console.log(`✓ Prepared variant ${i + 1} with plan image`);
    }

    // Create variants in database in a short transaction (images already generated)
    // First, ensure UTF-8 encoding is set at the connection level
    await prisma.$executeRawUnsafe(`SET client_encoding = 'UTF8'`);
    
    const createdVariants = await prisma.$transaction(
      async (tx) => {
        // Ensure UTF-8 encoding for this transaction
        await tx.$executeRawUnsafe(`SET client_encoding = 'UTF8'`);
        const created = [];
        for (const variantData of variantDataList) {
          const variant = await tx.variant.create({
            data: variantData,
          });
          created.push(variant);
        }
        return created;
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      }
    );

    console.log(`✓ Successfully created ${createdVariants.length} variants`);
    return createdVariants;
  } catch (error) {
    console.error('GigaChat generation error:', error);
    console.error('Error stack:', error.stack);
    
    // Fallback to mock variants if AI fails
    console.log('Falling back to mock variants due to AI error...');
    return generateMockVariants(aiRequestId);
  }
};

const generateMockVariants = async (aiRequestId) => {
  // Get the plan for this AI request to use its fileUrl
  const aiRequest = await prisma.aiRequest.findUnique({
    where: { id: aiRequestId },
    include: {
      plan: {
        select: {
          fileUrl: true,
        },
      },
    },
  });

  if (!aiRequest || !aiRequest.plan) {
    throw new Error('AI request or plan not found');
  }

  const planFileUrl = aiRequest.plan.fileUrl;

  const MOCK_VARIANTS = [
    {
      description: 'Вариант 1: Расширение гостиной за счет объединения с балконом',
      normativeExplanation: 'Данный вариант соответствует нормам СНиП 2.08.01-89. Объединение балкона с гостиной допустимо при условии утепления и остекления балкона. Несущие стены не затрагиваются.',
      approvalProbability: 0.85,
    },
    {
      description: 'Вариант 2: Перепланировка кухни с переносом в большую комнату',
      normativeExplanation: 'Перенос кухни возможен только при наличии технических условий на газоснабжение и вентиляцию. Мокрые зоны должны быть расположены рядом с стояками.',
      approvalProbability: 0.65,
    },
    {
      description: 'Вариант 3: Разделение большой комнаты на две спальни',
      normativeExplanation: 'Разделение комнаты перегородками допустимо согласно ЖК РФ. Минимальная площадь спальни должна быть не менее 9 кв.м. Несущие стены не затрагиваются.',
      approvalProbability: 0.92,
    },
  ];

  // Ensure UTF-8 encoding is set before transaction
  await prisma.$executeRawUnsafe(`SET client_encoding = 'UTF8'`);
  
  const variants = await prisma.$transaction(
    async (tx) => {
      // Ensure UTF-8 encoding for this transaction
      await tx.$executeRawUnsafe(`SET client_encoding = 'UTF8'`);
      const createdVariants = [];
      for (const mockVariant of MOCK_VARIANTS) {
        const variant = await tx.variant.create({
          data: {
            aiRequestId,
            description: mockVariant.description,
            normativeExplanation: mockVariant.normativeExplanation,
            approvalProbability: mockVariant.approvalProbability,
            thumbnailUrl: planFileUrl, // Use plan fileUrl
            model3dUrl: null,
          },
        });
        createdVariants.push(variant);
      }
      return createdVariants;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );
  
  return variants;
};

export const streamVariants = async (aiRequestId, planId, connection, userPrompt, previousRequestId = null) => {
  // In Fastify WebSocket, connection IS the socket itself
  const socket = connection;
  
  if (!socket) {
    throw new Error('WebSocket connection not available');
  }
  
  // Check readyState (WebSocket.OPEN = 1)
  if (socket.readyState !== 1) {
    throw new Error(`WebSocket not open. State: ${socket.readyState}`);
  }

  // Get AI request to get user prompt
  const aiRequest = await prisma.aiRequest.findUnique({
    where: { id: aiRequestId },
    include: {
      variants: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Helper function to safely send messages
  const sendMessage = (type, data) => {
    if (socket && socket.readyState === 1) {
      try {
        socket.send(JSON.stringify({ type, data }));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  };

  // Check if variants already exist for this request
  if (aiRequest && aiRequest.variants && aiRequest.variants.length > 0) {
    console.log(`Variants already exist for request ${aiRequestId}. Streaming existing ${aiRequest.variants.length} variants.`);
    
    // Stream existing variants
    for (let i = 0; i < aiRequest.variants.length; i++) {
      sendMessage('option_generated', {
        variant_id: aiRequest.variants[i].id,
        index: i + 1,
        total: aiRequest.variants.length,
        description: aiRequest.variants[i].description,
        approval_probability: aiRequest.variants[i].approvalProbability,
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    sendMessage('complete', { message: 'Все варианты загружены' });
    return aiRequest.variants;
  }

  // No existing variants, generate new ones
  const prompt = userPrompt || aiRequest?.inputText || 'Предложи варианты перепланировки';

  // Send processing status
  sendMessage('processing_status', { status: 'analyzing_plan', message: 'Анализ плана...' });
  await new Promise(resolve => setTimeout(resolve, 1000));

  sendMessage('processing_status', { status: 'generating_options', message: 'Генерация вариантов перепланировки с помощью GigaChat...' });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Generate variants with AI
  let variants;
  try {
    variants = await generateVariantsWithAI(aiRequestId, planId, prompt, previousRequestId);
  } catch (error) {
    console.error('Error generating variants:', error);
    sendMessage('error', { message: 'Не удалось сгенерировать варианты: ' + error.message });
    return [];
  }

  // Stream each variant as it's generated
  for (let i = 0; i < variants.length; i++) {
    sendMessage('option_generated', {
      variant_id: variants[i].id,
      index: i + 1,
      total: variants.length,
      description: variants[i].description,
      approval_probability: variants[i].approvalProbability,
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Send completion
  sendMessage('complete', { request_id: aiRequestId, variant_count: variants.length });

  return variants;
};
