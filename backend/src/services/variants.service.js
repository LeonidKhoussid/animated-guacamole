import prisma from '../models/prisma.js';
import { callGigaChat } from '../utils/gigachat.js';

export const getVariant = async (variantId) => {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: {
      aiRequest: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!variant) {
    throw new Error('Variant not found');
  }

  return variant;
};

export const getPublicVariant = async (variantId) => {
  const variant = await getVariant(variantId);
  // Return variant without sensitive user data
  return variant;
};

// Get 3D model modifications from GigaChat based on variant
export const get3DModelModifications = async (variantId) => {
  const variant = await getVariant(variantId);
  
  if (!variant) {
    throw new Error('Variant not found');
  }

  const planImageUrl = variant.aiRequest?.plan?.fileUrl;
  const variantDescription = variant.description;
  const normativeExplanation = variant.normativeExplanation;

  // Call GigaChat to get 3D model modification instructions
  const messages = [
    {
      role: 'system',
      content: 'Ты эксперт по 3D моделированию архитектурных планов. Твоя задача - проанализировать описание варианта перепланировки и вернуть инструкции для модификации 3D модели ТОЛЬКО в формате JSON без дополнительного текста.',
    },
    {
      role: 'user',
      content: `Вариант перепланировки: ${variantDescription}

Нормативное объяснение: ${normativeExplanation}

Исходный план доступен по URL: ${planImageUrl}

Верни инструкции для модификации 3D модели в формате JSON:
{
  "modifications": [
    {
      "type": "remove_wall" | "add_wall" | "change_color" | "modify_room",
      "description": "описание изменения",
      "position": {"x": число, "z": число} (для стен),
      "color": "hex цвет" (для change_color),
      "room": "название комнаты" (для modify_room),
      "wallType": "external" | "internal" (для remove_wall/add_wall)
    }
  ],
  "instructions": "общие инструкции по модификации модели"
}

Важно:
- Если вариант предполагает удаление стен, используй type: "remove_wall" для внутренних стен (зеленые)
- Если вариант предполагает объединение комнат, удали соответствующие внутренние стены
- Если вариант предполагает разделение комнат, добавь новые стены
- Не удаляй внешние стены (красные) - они несущие
- Укажи конкретные координаты или опиши расположение изменений`,
    },
  ];

  try {
    const response = await callGigaChat(messages, 'GigaChat', {
      temperature: 0.5,
      max_tokens: 2000,
    });

    const responseText = response.choices[0].message.content;
    
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

    const modifications = JSON.parse(jsonText);
    console.log('✓ Got 3D model modifications from GigaChat');
    return modifications;
  } catch (error) {
    console.error('Failed to get 3D model modifications:', error);
    // Return default modifications based on variant description
    return {
      modifications: [],
      instructions: variantDescription,
    };
  }
};


