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
6. plan: Структурированная геометрия плана в формате JSON с координатами стен, комнат и проемов

ВАЖНО ДЛЯ ПОЛЯ plan:
- plan.geometry.walls: массив стен с координатами начала (start: {x, y}) и конца (end: {x, y}) в метрах
- Каждая стена должна иметь: id (уникальный), start, end, height (высота в метрах, обычно 2.7), thickness (толщина в метрах, обычно 0.15 для перегородок, 0.3-0.4 для несущих), isBearing (true для несущих стен)
- Координаты должны быть в метрах, начало координат (0,0) в левом нижнем углу плана
- plan.geometry.rooms: массив комнат (можно оставить пустым [] для MVP)
- plan.geometry.openings: массив проемов/дверей (можно оставить пустым [] для MVP)
- Все координаты должны отражать изменения, описанные в description и changes

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
      "floorPlanModifications": "Детальное техническое описание: какие стены демонтируются (указать толщину и материал), какие возводятся новые (указать тип перегородки), какие комнаты объединяются или разделяются, расположение дверей и окон, размеры получившихся помещений",
      "plan": {
        "meta": {
          "version": 1,
          "sourceImage": "plan reference",
          "scale": {
            "unit": "meter",
            "pixelsPerMeter": 50
          }
        },
        "geometry": {
          "walls": [
            {
              "id": "wall_1",
              "start": { "x": 0.0, "y": 0.0 },
              "end": { "x": 4.0, "y": 0.0 },
              "height": 2.7,
              "thickness": 0.15,
              "isBearing": false
            }
          ],
          "rooms": [],
          "openings": []
        }
      }
    }
  ]
}`;

  const userMessage = userPrompt || 'Предложи варианты перепланировки квартиры';

  console.log('\n========== GIGACHAT VARIANT GENERATION START ==========');
  console.log('📝 User prompt:', userMessage);
  console.log('📋 Plan ID:', planId);
  console.log('🔄 Previous request ID:', previousRequestId || 'none');
  console.log('💬 Conversation history length:', conversationHistory.length);
  
  if (conversationHistory.length > 0) {
    console.log('📚 Conversation context:');
    conversationHistory.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. [${msg.role}]: ${msg.content.substring(0, 100)}...`);
    });
  }

  if (floorPlanAnalysis) {
    console.log('🏗️  Floor plan analysis available:');
    console.log('  - Load-bearing walls:', floorPlanAnalysis.loadBearingWalls?.join(', ') || 'not detected');
    console.log('  - Wet zones:', floorPlanAnalysis.wetZones?.map(z => `${z.type} (${z.location})`).join(', ') || 'not detected');
  } else {
    console.log('⚠️  No floor plan analysis available (will rely on GigaChat knowledge)');
  }

  console.log('\n🤖 Sending request to GigaChat...');
  console.log('📊 System prompt length:', systemPrompt.length, 'chars');
  console.log('⚙️  Parameters: temperature=0.7, max_tokens=4000');

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

    // Log the full message structure being sent
    console.log('\n📤 Messages being sent to GigaChat:');
    messages.forEach((msg, idx) => {
      if (msg.role === 'system') {
        console.log(`  ${idx + 1}. [SYSTEM] (${msg.content.length} chars) - Architecture expert prompt`);
      } else {
        console.log(`  ${idx + 1}. [${msg.role.toUpperCase()}]: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`);
      }
    });

    // Use GigaChat for better quality responses
    const response = await callGigaChat(messages, 'GigaChat', {
      temperature: 0.7,
      max_tokens: 4000,
    });
    
    const responseText = response.choices[0].message.content;
    console.log('\n✅ GigaChat response received!');
    console.log(`📏 Response length: ${responseText.length} characters`);
    console.log('\n🧠 GigaChat thinking process (raw response):');
    console.log('─'.repeat(80));
    console.log(responseText);
    console.log('─'.repeat(80));
    console.log('\n🔍 Parsing JSON from response...');
    
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
    // Step 1: Fix double quotes around keys FIRST (GigaChat sometimes returns ""key"" instead of "key")
    // This is critical - must happen before any other key processing
    jsonText = jsonText.replace(/""([a-zA-Z_$][a-zA-Z0-9_$]*)""\s*:/g, '"$1":');
    
    // Step 2: Fix trailing commas
    jsonText = jsonText
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    
    // Step 3: Remove comments
    jsonText = jsonText
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Step 4: Fix unquoted keys (character-by-character to avoid double-quoting)
    let fixedJson = '';
    let inString = false;
    let escapeNext = false;
    let i = 0;
    
    while (i < jsonText.length) {
      const char = jsonText[i];
      
      if (escapeNext) {
        fixedJson += char;
        escapeNext = false;
        i++;
        continue;
      }
      
      if (char === '\\') {
        fixedJson += char;
        escapeNext = true;
        i++;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        fixedJson += char;
        i++;
        continue;
      }
      
      if (inString) {
        fixedJson += char;
        i++;
        continue;
      }
      
      // Outside strings: check for unquoted keys
      // Pattern: { or , followed by whitespace, then identifier, then : or whitespace:
      if ((char === '{' || char === ',') && jsonText.substring(i).match(/^[{\,]\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*:/)) {
        fixedJson += char;
        i++;
        // Skip whitespace
        while (i < jsonText.length && /\s/.test(jsonText[i])) {
          fixedJson += jsonText[i];
          i++;
        }
        // Check if next is already a quote
        if (jsonText[i] === '"') {
          // Already quoted, just copy it
          while (i < jsonText.length && jsonText[i] !== ':') {
            fixedJson += jsonText[i];
            i++;
          }
          if (i < jsonText.length) {
            fixedJson += jsonText[i]; // colon
            i++;
          }
        } else {
          // Not quoted, add quotes around the key
          fixedJson += '"';
          while (i < jsonText.length && /[a-zA-Z0-9_$]/.test(jsonText[i])) {
            fixedJson += jsonText[i];
            i++;
          }
          fixedJson += '"';
          // Skip whitespace before colon
          while (i < jsonText.length && /\s/.test(jsonText[i])) {
            fixedJson += jsonText[i];
            i++;
          }
          if (i < jsonText.length && jsonText[i] === ':') {
            fixedJson += jsonText[i];
            i++;
          }
        }
        continue;
      }
      
      fixedJson += char;
      i++;
    }
    
    jsonText = fixedJson;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('\n❌ JSON parsing failed. Attempting to recover...');
      const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
      console.error(`Error at position ${errorPos}: ${parseError.message}`);
      
      // Show context around error
      const start = Math.max(0, errorPos - 300);
      const end = Math.min(jsonText.length, errorPos + 300);
      console.error('JSON context around error:');
      console.error(jsonText.substring(start, end));
      
      // Try multiple recovery strategies
      let recovered = false;
      
      // Strategy 1: Try to extract variants array more flexibly
      try {
        // Look for variants array with more flexible matching
        const variantsPattern = /"variants"\s*:\s*\[/;
        const variantsStart = jsonText.search(variantsPattern);
        if (variantsStart !== -1) {
          // Find the matching closing bracket
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          let variantsEnd = variantsStart;
          
          for (let i = variantsStart + jsonText.substring(variantsStart).indexOf('['); i < jsonText.length; i++) {
            const char = jsonText[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              inString = !inString;
              continue;
            }
            
            if (inString) continue;
            
            if (char === '[') depth++;
            if (char === ']') {
              depth--;
              if (depth === 0) {
                variantsEnd = i + 1;
                break;
              }
            }
          }
          
          if (variantsEnd > variantsStart) {
            const variantsArrayText = jsonText.substring(variantsStart + jsonText.substring(variantsStart).indexOf('['), variantsEnd);
            // Try to parse as individual variant objects
            const variantObjects = [];
            let currentVariant = '';
            let variantDepth = 0;
            inString = false;
            escapeNext = false;
            
            for (let i = 1; i < variantsArrayText.length - 1; i++) {
              const char = variantsArrayText[i];
              
              if (escapeNext) {
                escapeNext = false;
                currentVariant += char;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                currentVariant += char;
                continue;
              }
              
              if (char === '"') {
                inString = !inString;
                currentVariant += char;
                continue;
              }
              
              if (inString) {
                currentVariant += char;
                continue;
              }
              
              if (char === '{') {
                if (variantDepth === 0 && currentVariant.trim()) {
                  // Save previous variant if exists
                  try {
                    variantObjects.push(JSON.parse(`{${currentVariant.trim()}}`));
                  } catch (e) {
                    // Skip malformed variant
                  }
                  currentVariant = '';
                }
                variantDepth++;
                currentVariant += char;
              } else if (char === '}') {
                currentVariant += char;
                variantDepth--;
                if (variantDepth === 0) {
                  // Complete variant
                  try {
                    variantObjects.push(JSON.parse(currentVariant.trim()));
                  } catch (e) {
                    // Skip malformed variant
                  }
                  currentVariant = '';
                }
              } else if (variantDepth > 0) {
                currentVariant += char;
              }
            }
            
            if (variantObjects.length > 0) {
              parsed = { variants: variantObjects };
              console.log(`✅ Recovered ${variantObjects.length} variants from malformed JSON`);
              recovered = true;
            }
          }
        }
      } catch (recoveryError) {
        // Strategy failed, try next
      }
      
      if (!recovered) {
        console.error('❌ Could not recover JSON. Will fall back to mock variants.');
        throw parseError;
      }
    }
    const variants = parsed.variants || [];
    
    if (!Array.isArray(variants) || variants.length === 0) {
      throw new Error('No valid variants generated by AI');
    }
    
    console.log(`\n✅ Successfully parsed ${variants.length} variants from GigaChat response`);
    console.log('\n📦 Parsed variants structure:');
    variants.forEach((variant, idx) => {
      console.log(`\n  Variant ${idx + 1}:`);
      console.log(`    - Description: ${variant.description?.substring(0, 80)}...`);
      console.log(`    - Approval probability: ${variant.approvalProbability || 'N/A'}`);
      console.log(`    - Changes count: ${variant.changes?.length || 0}`);
      console.log(`    - Has 'plan' field: ${!!variant.plan}`);
      console.log(`    - Plan type: ${typeof variant.plan}`);
      
      if (variant.plan) {
        console.log(`    - Plan keys:`, Object.keys(variant.plan || {}));
        console.log(`    - Has plan.geometry: ${!!variant.plan?.geometry}`);
        console.log(`    - Has plan.geometry.walls: ${!!variant.plan?.geometry?.walls}`);
        
        if (variant.plan?.geometry?.walls) {
          const walls = variant.plan.geometry.walls;
          const bearingWalls = walls.filter(w => w.isBearing).length;
          const nonBearingWalls = walls.filter(w => !w.isBearing).length;
          console.log(`    - Geometry: ${walls.length} walls total`);
          console.log(`      • Bearing walls (CANNOT CHANGE): ${bearingWalls}`);
          console.log(`      • Non-bearing walls (CAN CHANGE): ${nonBearingWalls}`);
          
          // Log bearing wall details
          if (bearingWalls > 0) {
            console.log(`    - 🚫 Bearing walls that CANNOT be modified:`);
            walls.filter(w => w.isBearing).forEach((wall, wIdx) => {
              console.log(`      ${wIdx + 1}. Wall ${wall.id || 'unnamed'}: from (${wall.start.x}, ${wall.start.y}) to (${wall.end.x}, ${wall.end.y}), thickness: ${wall.thickness}m`);
            });
          }
        } else {
          console.log(`    - ⚠️  Plan object exists but missing geometry.walls`);
          console.log(`    - Plan structure:`, JSON.stringify(variant.plan, null, 2).substring(0, 500));
        }
      } else {
        console.log(`    - ⚠️  No 'plan' field in variant - GigaChat did not return geometry`);
        console.log(`    - Variant keys:`, Object.keys(variant));
        console.log(`    - Note: Geometry is optional. Variant will work without it (fallback to image analysis)`);
      }
    });
    
    // Check if any variants have geometry
    const variantsWithGeometry = variants.filter(v => v.plan && v.plan.geometry && v.plan.geometry.walls);
    console.log(`\n📊 Geometry Summary:`);
    console.log(`   - Variants with geometry: ${variantsWithGeometry.length}/${variants.length}`);
    if (variantsWithGeometry.length === 0) {
      console.log(`   ⚠️  WARNING: No variants have geometry. 3D view will use image analysis fallback.`);
      console.log(`   - This is OK - geometry is optional, but 3D models won't update per variant`);
    }

    // Prepare variant data - use plan.fileUrl directly as thumbnail
    const variantDataList = [];
    const variantSlice = variants.slice(0, 5);
    for (let i = 0; i < variantSlice.length; i++) {
      const variantData = variantSlice[i];
      
      // Use plan image directly as thumbnail (no image generation)
      const thumbnailUrl = plan.fileUrl;
      const model3dUrl = await generate3DModelUrl(aiRequestId, plan.fileUrl, variantData.description);

      // Extract and validate plan geometry
      let planGeometry = null;
      if (variantData.plan) {
        try {
          // Validate plan structure
          if (variantData.plan.geometry && variantData.plan.geometry.walls && Array.isArray(variantData.plan.geometry.walls)) {
            planGeometry = variantData.plan;
            const walls = variantData.plan.geometry.walls;
            const bearingWalls = walls.filter(w => w.isBearing).length;
            const nonBearingWalls = walls.filter(w => !w.isBearing).length;
            
            console.log(`\n  📐 Variant ${i + 1} geometry analysis:`);
            console.log(`    ✓ Valid geometry with ${walls.length} walls`);
            console.log(`    🚫 Bearing walls (NON-MODIFIABLE): ${bearingWalls}`);
            console.log(`    ✅ Non-bearing walls (MODIFIABLE): ${nonBearingWalls}`);
            
            if (bearingWalls > 0) {
              console.log(`    ⚠️  IMPORTANT: ${bearingWalls} bearing wall(s) identified - these CANNOT be changed!`);
              walls.filter(w => w.isBearing).forEach((wall, wIdx) => {
                console.log(`      Bearing wall ${wIdx + 1}: ID=${wall.id || 'unnamed'}, from (${wall.start.x}, ${wall.start.y}) to (${wall.end.x}, ${wall.end.y}), thickness=${wall.thickness}m`);
              });
            }
          } else {
            console.warn(`⚠ Variant ${i + 1} has plan but invalid structure, skipping geometry`);
          }
        } catch (error) {
          console.warn(`⚠ Failed to validate plan geometry for variant ${i + 1}:`, error.message);
        }
      } else {
        console.warn(`⚠ Variant ${i + 1} missing plan geometry`);
      }

      variantDataList.push({
        aiRequestId,
        description: variantData.description || `Вариант ${i + 1} перепланировки`,
        normativeExplanation: variantData.normativeExplanation || 'Соответствует нормам СНиП и ЖК РФ',
        approvalProbability: variantData.approvalProbability || 0.75,
        thumbnailUrl,
        model3dUrl,
        planGeometry,
      });
      console.log(`✓ Prepared variant ${i + 1} with plan image${planGeometry ? ' and geometry' : ''}`);
    }

    console.log('\n💾 Storing variants in database...');

    // Create variants in database in a short transaction (images already generated)
    // First, ensure UTF-8 encoding is set at the connection level
    await prisma.$executeRawUnsafe(`SET client_encoding = 'UTF8'`);
    
    const createdVariants = await prisma.$transaction(
      async (tx) => {
        // Ensure UTF-8 encoding for this transaction
        await tx.$executeRawUnsafe(`SET client_encoding = 'UTF8'`);
        const created = [];
        for (const variantData of variantDataList) {
          console.log(`\n💾 Saving variant to database:`);
          console.log(`   - ID will be generated`);
          console.log(`   - Has planGeometry: ${!!variantData.planGeometry}`);
          console.log(`   - planGeometry type: ${typeof variantData.planGeometry}`);
          if (variantData.planGeometry) {
            console.log(`   - planGeometry.geometry.walls count: ${variantData.planGeometry?.geometry?.walls?.length || 0}`);
          }
          
          const variant = await tx.variant.create({
            data: variantData,
          });
          
          // Verify what was actually saved
          console.log(`   ✅ Variant saved with ID: ${variant.id}`);
          console.log(`   - Saved planGeometry: ${!!variant.planGeometry}`);
          if (variant.planGeometry) {
            console.log(`   - Saved planGeometry type: ${typeof variant.planGeometry}`);
          }
          
          created.push(variant);
        }
        return created;
      },
      {
        maxWait: 10000, // Maximum time to wait for a transaction slot
        timeout: 30000, // Maximum time the transaction can run (30 seconds)
      }
    );

    console.log(`\n✅ Successfully created ${createdVariants.length} variants in database`);
    
    // Final verification
    console.log('\n🔍 Final verification of saved variants:');
    createdVariants.forEach((v, idx) => {
      console.log(`   Variant ${idx + 1} (ID: ${v.id}):`);
      console.log(`     - Has planGeometry in DB: ${!!v.planGeometry}`);
      if (v.planGeometry) {
        const walls = v.planGeometry?.geometry?.walls || [];
        console.log(`     - Walls count: ${walls.length}`);
      }
    });
    
    console.log('========== GIGACHAT VARIANT GENERATION COMPLETE ==========\n');
    return createdVariants;
  } catch (error) {
    console.error('\n❌ GigaChat generation error:', error);
    console.error('Error stack:', error.stack);
    console.error('========== GIGACHAT VARIANT GENERATION FAILED ==========\n');
    
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
