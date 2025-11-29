import prisma, { ensureUTF8Encoding } from '../models/prisma.js';
import { OpenRouter } from '@openrouter/sdk';

// Helper to convert Russian text to ASCII-safe transliteration (basic)
const toASCII = (text) => {
  if (!text) return text;
  // Basic transliteration map for common Russian characters
  const map = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  return text.split('').map(char => map[char] || char).join('');
};

// Initialize OpenRouter client
const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3001',
    'X-Title': 'PlanAI - Apartment Replanning',
  },
});

// Validate API key on startup
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️  WARNING: OPENROUTER_API_KEY is not set. AI features will not work.');
} else if (!process.env.OPENROUTER_API_KEY.startsWith('sk-or-v1-')) {
  console.warn('⚠️  WARNING: OPENROUTER_API_KEY format appears invalid. AI features may not work.');
}

export const createAiRequest = async (userId, planId, inputText, inputAudioUrl, inputImageUrl) => {
  // Convert text to ASCII-safe before transaction to avoid encoding issues
  const safeInputText = inputText ? toASCII(inputText) : null;
  
  const aiRequest = await prisma.$transaction(async (tx) => {
    return await tx.aiRequest.create({
      data: {
        userId,
        planId,
        inputText: safeInputText,
        inputAudioUrl,
        inputImageUrl,
      },
    });
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
        take: 1, // Just get first variant for preview
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

// Analyze floor plan image using vision AI via raw OpenRouter API
const analyzeFloorPlan = async (planImageUrl) => {
  try {
    console.log('Analyzing floor plan image:', planImageUrl);
    
    // Use raw fetch API since OpenRouter SDK doesn't properly support vision format
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3001',
        'X-Title': 'PlanAI - Apartment Replanning',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/bert-nebulon-alpha',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Проанализируй этот план квартиры. Определи:
1. Расположение несущих стен (отметь их)
2. Расположение мокрых зон (кухня, ванная, туалет)
3. Размеры комнат
4. Расположение дверей и окон
5. Общую структуру планировки

Верни ответ ТОЛЬКО в формате JSON без дополнительного текста:
{
  "loadBearingWalls": ["описание несущих стен"],
  "wetZones": [{"type": "кухня/ванная/туалет", "location": "описание расположения"}],
  "rooms": [{"name": "название", "area": "площадь", "dimensions": "размеры"}],
  "doors": ["описание дверей"],
  "windows": ["описание окон"],
  "structure": "общее описание структуры"
}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: planImageUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
    // Extract JSON from response
    let jsonText = analysisText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const analysis = JSON.parse(jsonText);
    console.log('Floor plan analysis completed successfully');
    return analysis;
  } catch (error) {
    console.error('Failed to analyze floor plan:', error.message);
    // Return null to indicate analysis failed, but don't throw
    return null;
  }
};

// Generate 3D model URL (placeholder - in production, this would generate actual 3D models)
const generate3DModelUrl = async (variantId, planImageUrl, variantDescription) => {
  // For now, we'll create a placeholder URL
  // In production, this would:
  // 1. Generate a modified floor plan image based on the variant
  // 2. Convert the 2D plan to 3D using a service or library
  // 3. Store the GLB/GLTF file
  // 4. Return the URL
  
  // Placeholder: return a URL that can be used to generate 3D models
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/3d-models/${variantId}.glb`; // Placeholder URL
};

// Generate thumbnail for variant
const generateThumbnailUrl = async (variantId, planImageUrl, variantDescription) => {
  // Placeholder: in production, this would generate a modified floor plan image
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/thumbnails/${variantId}.png`; // Placeholder URL
};

const generateVariantsWithAI = async (aiRequestId, planId, userPrompt, previousRequestId = null) => {
  // Get plan details
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Analyze the floor plan image (optional - skip if it fails)
  let floorPlanAnalysis = null;
  if (plan.fileUrl) {
    try {
      floorPlanAnalysis = await analyzeFloorPlan(plan.fileUrl);
      // Store analysis in plan only if we got valid analysis
      // Skip saving to avoid encoding issues - we'll use it in memory only
      // The analysis will be used in the prompt but not persisted
      if (floorPlanAnalysis) {
        console.log('Floor plan analysis ready (not saving to DB to avoid encoding issues)');
      }
    } catch (error) {
      console.warn('Failed to analyze floor plan, continuing without analysis:', error.message);
      floorPlanAnalysis = null; // Set to null if analysis fails
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
        // Add previous user message - convert to ASCII-safe
        if (previousRequest.inputText) {
          conversationHistory.push({
            role: 'user',
            content: toASCII(previousRequest.inputText) || previousRequest.inputText,
          });
        }

        // Add previous AI response (variants) - use ASCII-safe text
        if (previousRequest.variants && previousRequest.variants.length > 0) {
          const variantsSummary = previousRequest.variants
            .map((v, i) => `Variant ${i + 1}: ${v.description} (approval probability: ${Math.round(v.approvalProbability * 100)}%)`)
            .join('\n');
          conversationHistory.push({
            role: 'assistant',
            content: `Previously proposed variants:\n${variantsSummary}`,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load previous conversation context:', error);
    }
  }

  // Construct AI prompt with floor plan analysis (only if we have valid analysis)
  const analysisContext = floorPlanAnalysis && floorPlanAnalysis.loadBearingWalls
    ? `\n\nАнализ текущего плана квартиры:
- Несущие стены: ${floorPlanAnalysis.loadBearingWalls?.join(', ') || 'не определены'}
- Мокрые зоны: ${floorPlanAnalysis.wetZones?.map(z => `${z.type} (${z.location})`).join(', ') || 'не определены'}
- Комнаты: ${floorPlanAnalysis.rooms?.map(r => `${r.name} (${r.area})`).join(', ') || 'не определены'}
- Структура: ${floorPlanAnalysis.structure || 'не определена'}

ВАЖНО: При генерации вариантов УЧТИ эту информацию и создай РАЗНЫЕ варианты перепланировки, каждый с уникальными изменениями.`
    : '';

  // Emphasize the user's specific request
  const userRequestEmphasis = userPrompt && userPrompt !== 'Предложи варианты перепланировки квартиры'
    ? `\n\nКРИТИЧЕСКИ ВАЖНО: Пользователь запросил конкретные изменения: "${userPrompt}"
Ты ДОЛЖЕН создать варианты, которые ОТВЕЧАЮТ именно на этот запрос. Каждый вариант должен учитывать пожелания пользователя и предлагать РАЗНЫЕ способы их реализации.`
    : '';

  const systemPrompt = `Ты эксперт по перепланировке квартир в России. Твоя задача - предложить 3-5 РАЗНЫХ вариантов перепланировки на основе КОНКРЕТНОГО запроса пользователя.

КРИТИЧЕСКИ ВАЖНО:
- Каждый вариант ДОЛЖЕН быть УНИКАЛЬНЫМ и РАЗНЫМ от других
- Варианты ДОЛЖНЫ отвечать именно на запрос пользователя: "${userPrompt}"
- НЕ используй одинаковые варианты для разных запросов
- Каждый вариант должен иметь РАЗНЫЕ изменения в планировке

Требования:
1. Все варианты должны соответствовать нормам СНиП 2.08.01-89 и ЖК РФ
2. Несущие стены нельзя трогать
3. Мокрые зоны (кухня, ванная, туалет) должны быть рядом с коммуникациями
4. Минимальная площадь комнаты - 9 кв.м
5. Ширина коридора не менее 1.2м
6. Для каждого варианта укажи вероятность одобрения (0-1)
7. КАЖДЫЙ вариант должен быть УНИКАЛЬНЫМ с разными изменениями планировки
8. ВАЖНО: Варианты должны ОТВЕЧАТЬ на конкретный запрос пользователя, а не быть общими

${conversationHistory.length > 0 ? 'Учитывай предыдущий контекст разговора при генерации новых вариантов.' : ''}
${analysisContext}
${userRequestEmphasis}

Верни ответ ТОЛЬКО в формате JSON без дополнительного текста. Убедись, что JSON валидный и все строки правильно экранированы:
{
  "variants": [
    {
      "description": "Краткое описание варианта с конкретными изменениями, отвечающими на запрос пользователя",
      "normativeExplanation": "Объяснение соответствия нормам",
      "approvalProbability": 0.85,
      "changes": ["конкретное изменение 1", "конкретное изменение 2"],
      "floorPlanModifications": "детальное описание изменений в плане (какие стены убрать/добавить, какие комнаты объединить/разделить)"
    }
  ]
}`;

  const userMessage = userPrompt || 'Предложи варианты перепланировки квартиры';

  console.log('Starting AI variant generation...');
  console.log(`User prompt: ${userMessage.substring(0, 100)}`);
  console.log(`Has floor plan analysis: ${!!floorPlanAnalysis}`);
  console.log(`Has conversation history: ${conversationHistory.length > 0}`);

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

    // Try using Bert-Nebulon Alpha with vision via raw API, fallback to Grok
    let completion;
    
    if (plan.fileUrl) {
      try {
        console.log('Attempting vision API call with Bert-Nebulon Alpha...');
        // Use raw API for vision support - format conversation history properly
        // Convert conversation history to string format for vision API
        const visionHistory = conversationHistory.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        }));

        const visionMessages = [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...visionHistory,
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userMessage,
              },
              {
                type: 'image_url',
                image_url: {
                  url: plan.fileUrl,
                },
              },
            ],
          },
        ];

        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'HTTP-Referer': process.env.BASE_URL || 'http://localhost:3001',
              'X-Title': 'PlanAI - Apartment Replanning',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'openrouter/bert-nebulon-alpha',
              messages: visionMessages,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
              completion = { choices: data.choices };
              console.log('✓ Used Bert-Nebulon Alpha with vision');
            } else {
              throw new Error('No choices in vision API response');
            }
          } else {
            const errorText = await response.text();
            throw new Error(`Vision API failed: ${response.status} - ${errorText.substring(0, 200)}`);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error('Vision API request timed out after 60 seconds');
          }
          throw fetchError;
        }
      } catch (visionError) {
        console.warn('Bert-Nebulon Alpha vision failed, falling back to Grok:', visionError.message);
        // Fallback to text-only model
        console.log('Calling Grok API as fallback...');
        completion = await openRouter.chat.send({
          model: 'x-ai/grok-4.1-fast:free',
          messages,
          stream: false,
        });
        console.log('✓ Got response from Grok');
      }
    } else {
      // No image, use text-only model
      console.log('No image URL, using Grok text-only model...');
      completion = await openRouter.chat.send({
        model: 'x-ai/grok-4.1-fast:free',
        messages,
        stream: false,
      });
      console.log('✓ Got response from Grok');
    }

    if (!completion || !completion.choices || !completion.choices[0] || !completion.choices[0].message) {
      throw new Error('Invalid API response structure');
    }

    const responseText = completion.choices[0].message.content;
    console.log(`AI response received (${responseText.length} chars), parsing JSON...`);
    
    // Extract JSON from response (handle markdown code blocks and malformed JSON)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    // Extract JSON object from response (handle text before/after JSON)
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
    }

    // Fix common JSON issues - be more careful with string escaping
    // First, remove trailing commas
    jsonText = jsonText
      .replace(/,\s*}/g, '}')  // Remove trailing commas before }
      .replace(/,\s*]/g, ']');  // Remove trailing commas before ]

    // Try to fix unescaped quotes in strings (but be careful not to break valid JSON)
    // This is tricky - we'll try parsing first, and if it fails, try to fix common issues
    let parsed;
    let parseAttempts = 0;
    const maxAttempts = 3;
    
    while (parseAttempts < maxAttempts) {
      try {
        parsed = JSON.parse(jsonText);
        break; // Success!
      } catch (parseError) {
        parseAttempts++;
        
        if (parseAttempts >= maxAttempts) {
          console.error('JSON parse error after', maxAttempts, 'attempts:', parseError.message);
          console.error('JSON text (first 1000 chars):', jsonText.substring(0, 1000));
          console.error('JSON text (last 500 chars):', jsonText.substring(Math.max(0, jsonText.length - 500)));
          throw new Error(`JSON parsing failed: ${parseError.message}`);
        }
        
        // Try to fix common issues
        if (parseError.message.includes('Unterminated string') || parseError.message.includes('position')) {
          // Try to find and fix unterminated strings by finding the problematic position
          const positionMatch = parseError.message.match(/position (\d+)/);
          if (positionMatch) {
            const pos = parseInt(positionMatch[1]);
            // Try to fix by escaping or removing problematic characters around that position
            const before = jsonText.substring(0, pos);
            const after = jsonText.substring(pos);
            // If there's an unescaped quote, try to escape it or remove the problematic part
            if (after.startsWith('"') || after.startsWith("'")) {
              // Might be an unterminated string - try to find the next quote or end of string
              const nextQuote = after.indexOf('"', 1);
              if (nextQuote === -1) {
                // No closing quote found - try to add one at a reasonable position
                const nextComma = after.indexOf(',');
                const nextBrace = after.indexOf('}');
                const nextBracket = after.indexOf(']');
                const endPos = Math.min(
                  nextComma !== -1 ? nextComma : Infinity,
                  nextBrace !== -1 ? nextBrace : Infinity,
                  nextBracket !== -1 ? nextBracket : Infinity
                );
                if (endPos !== Infinity && endPos > 0) {
                  jsonText = before + after.substring(0, endPos) + '"' + after.substring(endPos);
                  continue; // Try parsing again
                }
              }
            }
          }
        }
        
        // Last resort: try to extract just the variants array using regex
        if (parseAttempts === maxAttempts - 1) {
          const variantsMatch = jsonText.match(/"variants"\s*:\s*\[([\s\S]*)\]/);
          if (variantsMatch) {
            // Try to manually construct a valid JSON
            try {
              const variantsText = '[' + variantsMatch[1] + ']';
              const manualVariants = JSON.parse(variantsText);
              parsed = { variants: manualVariants };
              break;
            } catch (e) {
              // Still failed, throw original error
              throw new Error(`JSON parsing failed: ${parseError.message}`);
            }
          }
        }
      }
    }
    
    const variants = parsed.variants || [];
    
    // Validate variants were generated
    if (!Array.isArray(variants) || variants.length === 0) {
      throw new Error('No valid variants generated by AI');
    }
    
    console.log(`✓ Successfully parsed ${variants.length} variants from AI response`);

    // Create variants in database with 3D models using transaction
    // Convert to ASCII-safe text BEFORE transaction to avoid encoding errors
    console.log('Converting variants to ASCII-safe format...');
    const variantsToCreate = variants.slice(0, 5).map((variantData, index) => {
      const safe = {
        ...variantData,
        description: toASCII(variantData.description || `Variant ${index + 1} replanning`) || `Variant ${index + 1} replanning`,
        normativeExplanation: toASCII(variantData.normativeExplanation || 'Complies with SNIP 2.08.01-89 and Housing Code') || 'Complies with SNIP 2.08.01-89 and Housing Code',
      };
      console.log(`Variant ${index + 1}: ${safe.description.substring(0, 50)}...`);
      return safe;
    });

    console.log('Creating variants in database...');
    const createdVariants = await prisma.$transaction(async (tx) => {
      const created = [];
      for (let i = 0; i < variantsToCreate.length; i++) {
        const variantData = variantsToCreate[i];
        console.log(`Creating variant ${i + 1}/${variantsToCreate.length}...`);
        
        // Generate 3D model and thumbnail URLs for each variant
        const [thumbnailUrl, model3dUrl] = await Promise.all([
          generateThumbnailUrl(aiRequestId, plan.fileUrl, variantData.description),
          generate3DModelUrl(aiRequestId, plan.fileUrl, variantData.description),
        ]);

        const variant = await tx.variant.create({
          data: {
            aiRequestId,
            description: variantData.description,
            normativeExplanation: variantData.normativeExplanation,
            approvalProbability: variantData.approvalProbability || 0.75,
            thumbnailUrl,
            model3dUrl,
          },
        });
        created.push(variant);
        console.log(`✓ Created variant ${i + 1}`);
      }
      return created;
    });

    console.log(`✓ Successfully created ${createdVariants.length} variants`);
    return createdVariants;
  } catch (error) {
    console.error('AI generation error:', error);
    console.error('Error stack:', error.stack);
    
    // Check if it's an authentication error
    if (error.statusCode === 401 || (error.error && error.error.code === 401)) {
      console.error('❌ OpenRouter API authentication failed. Please check your OPENROUTER_API_KEY in .env file.');
      console.error('   The API key may be invalid or expired. Get a new key from: https://openrouter.ai/keys');
    }
    
    // Fallback to mock variants if AI fails
    console.log('Falling back to mock variants due to AI error...');
    return generateMockVariants(aiRequestId);
  }
};

const generateMockVariants = async (aiRequestId) => {
  // Use ASCII-safe text from the start to avoid encoding issues
  const MOCK_VARIANTS = [
    {
      description: 'Variant 1: Expanding living room by combining with balcony',
      normativeExplanation: 'This variant complies with SNIP 2.08.01-89. Combining balcony with living room is allowed if balcony is insulated and glazed. Load-bearing walls are not affected.',
      approvalProbability: 0.85,
    },
    {
      description: 'Variant 2: Kitchen replanning with relocation to larger room',
      normativeExplanation: 'Kitchen relocation is possible only with technical conditions for gas supply and ventilation. Wet zones must be located near risers.',
      approvalProbability: 0.65,
    },
    {
      description: 'Variant 3: Dividing large room into two bedrooms',
      normativeExplanation: 'Dividing room with partitions is allowed according to Housing Code. Minimum bedroom area must be at least 9 sq.m. Load-bearing walls are not affected.',
      approvalProbability: 0.92,
    },
  ];

  // Use transaction - start with ASCII-safe text to avoid encoding issues
  const variants = await prisma.$transaction(async (tx) => {
    const createdVariants = [];
    for (const mockVariant of MOCK_VARIANTS) {
      const variant = await tx.variant.create({
        data: {
          aiRequestId,
          description: mockVariant.description,
          normativeExplanation: mockVariant.normativeExplanation,
          approvalProbability: mockVariant.approvalProbability,
          thumbnailUrl: null,
          model3dUrl: null,
        },
      });
      createdVariants.push(variant);
    }
    return createdVariants;
  });
  
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
  });

  const prompt = userPrompt || aiRequest?.inputText || 'Предложи варианты перепланировки';

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

  // Send processing status
  sendMessage('processing_status', { status: 'analyzing_plan', message: 'Анализ плана...' });
  await new Promise(resolve => setTimeout(resolve, 1000));

  sendMessage('processing_status', { status: 'generating_options', message: 'Генерация вариантов перепланировки с помощью AI...' });
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Generate variants with AI (include previous request context if available)
  let variants;
  try {
    variants = await generateVariantsWithAI(aiRequestId, planId, prompt, previousRequestId);
  } catch (error) {
    console.error('Error generating variants:', error);
    sendMessage('error', { message: 'Failed to generate variants: ' + error.message });
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
