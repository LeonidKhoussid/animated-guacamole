import axios from "axios";
import { randomUUID } from "crypto";
import https from "https";

// GigaChat OAuth token cache
let accessToken = null;
let tokenExpiresAt = null;

// Get GigaChat access token
const getAccessToken = async () => {
  // Return cached token if still valid
  if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const clientId = process.env.GIGACHAT_CLIENT_ID;
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET;
  const scope = process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GigaChat credentials not configured. Set GIGACHAT_CLIENT_ID and GIGACHAT_CLIENT_SECRET in .env"
    );
  }

  try {
    // Get OAuth token
    // Note: GigaChat uses self-signed certificates, so we need to disable SSL verification
    const authResponse = await axios.post(
      "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      `scope=${scope}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          RqUID: randomUUID(),
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString("base64")}`,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // Accept self-signed certificates
        }),
      }
    );

    accessToken = authResponse.data.access_token;
    const expiresIn = authResponse.data.expires_at || 1800; // Default 30 minutes
    tokenExpiresAt = Date.now() + expiresIn * 1000 - 60000; // Refresh 1 minute before expiry

    return accessToken;
  } catch (error) {
    console.error(
      "GigaChat authentication error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to authenticate with GigaChat API");
  }
};

// Retry helper with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (!isRateLimit || isLastAttempt) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      const retryAfter = error.response?.headers?.['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
      
      console.log(`Rate limited (429). Retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Call GigaChat API
export const callGigaChat = async (
  messages,
  model = "GigaChat",
  options = {}
) => {
  const token = await getAccessToken();
  const { temperature = 0.7, max_tokens = 4000, stream = false } = options;

  return retryWithBackoff(async () => {
    const response = await axios.post(
      "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      {
        model,
        messages,
        temperature,
        max_tokens,
        stream,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // Accept self-signed certificates
        }),
      }
    );

    return response.data;
  }).catch((error) => {
    console.error("GigaChat API error:", error.response?.data || error.message);
    throw error;
  });
};

// Generate image using GigaChat image generation API
export const generateImageWithGigaChat = async (
  prompt,
  planImageUrl = null
) => {
  const token = await getAccessToken();

  try {
    // GigaChat generates images when using multimodal messages with "Нарисуй" prompt
    // Create a detailed prompt for floor plan visualization
    const imagePrompt = `Нарисуй архитектурный план квартиры сверху (вид сверху) с учетом следующих изменений: ${prompt}. 

Требования к изображению:
- План должен быть выполнен в техническом стиле (архитектурный чертеж)
- Покажи все комнаты с четкими границами и названиями
- Отметь стены: толстые линии для несущих стен, тонкие для перегородок
- Покажи расположение дверей (полукруглые дуги) и окон (прямые линии с крестиками)
- Укажи названия комнат внутри каждой комнаты
- Используй черно-белую или минималистичную цветовую схему (серый, белый, черный)
- План должен быть читаемым, профессиональным и в масштабе
- Добавь размеры помещений если возможно`;

    // Build message - GigaChat image generation uses text prompts
    // Note: If planImageUrl is provided, mention it in the prompt
    const finalPrompt = planImageUrl
      ? imagePrompt +
        `\n\nИспользуй исходный план квартиры как основу (URL: ${planImageUrl}) и внеси указанные изменения.`
      : imagePrompt;

    const messages = [
      {
        role: "user",
        content: finalPrompt,
      },
    ];

    // Use GigaChat with multimodal support for image generation
    let response;
    try {
      response = await retryWithBackoff(async () => {
        return await axios.post(
          "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
          {
            model: "GigaChat",
            messages,
            temperature: 0.7,
            max_tokens: 2000,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            httpsAgent: new https.Agent({
              rejectUnauthorized: false,
            }),
            responseType: "arraybuffer", // Important: handle binary/image responses
          }
        );
      });
    } catch (error) {
      console.error(
        "Chat completions error:",
        error.response?.data || error.message
      );
      throw error;
    }

    // Check response for image data
    const contentType = response.headers["content-type"] || "";
    const responseBuffer = Buffer.from(response.data);

    // If response is directly an image (PNG, JPEG, etc.)
    if (contentType.startsWith("image/")) {
      const { saveFile } = await import("./fileStorage.js");
      const ext = contentType.split("/")[1] || "png";
      const filename = `variant_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.${ext}`;
      const imageUrl = await saveFile(
        responseBuffer,
        filename,
        contentType,
        "variants"
      );
      console.log(`✓ Generated floor plan image: ${imageUrl}`);
      return imageUrl;
    }

    // Check if response is binary image data (even if content-type is not set correctly)
    if (responseBuffer.length > 1000) {
      // Try to detect image format by magic bytes
      const isPNG = responseBuffer[0] === 0x89 && responseBuffer[1] === 0x50;
      const isJPEG = responseBuffer[0] === 0xff && responseBuffer[1] === 0xd8;

      if (isPNG || isJPEG) {
        const { saveFile } = await import("./fileStorage.js");
        const ext = isPNG ? "png" : "jpg";
        const mimeType = isPNG ? "image/png" : "image/jpeg";
        const filename = `variant_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}.${ext}`;
        const imageUrl = await saveFile(
          responseBuffer,
          filename,
          mimeType,
          "variants"
        );
        console.log(`✓ Saved image from binary response (${ext}): ${imageUrl}`);
        return imageUrl;
      }
    }

    // Try to parse JSON response
    let responseData;
    try {
      const responseText = responseBuffer.toString("utf-8");
      responseData = JSON.parse(responseText);
    } catch (e) {
      // If not JSON and not image, log and return null
      console.warn(
        "Response is not JSON or image. Length:",
        responseBuffer.length
      );
      return null;
    }

    // Check if response contains image data in various formats
    if (responseData.choices && responseData.choices[0]?.message) {
      const message = responseData.choices[0].message;

      // Check for image_url or image field directly in message
      if (message.image_url || message.image) {
        const imageUrl = message.image_url || message.image;
        console.log(`✓ Found image URL in message: ${imageUrl}`);
        return imageUrl;
      }

      // Check content for image data
      if (message.content) {
        const content =
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content);

        // Look for image URL in response text
        const urlMatch = content.match(
          /https?:\/\/[^\s\)"']+\.(png|jpg|jpeg|gif|webp)/i
        );
        if (urlMatch) {
          console.log(`✓ Found image URL in content: ${urlMatch[0]}`);
          return urlMatch[0];
        }

        // Look for base64 encoded image
        const base64Match = content.match(
          /data:image\/(png|jpg|jpeg);base64,([A-Za-z0-9+/=]+)/
        );
        if (base64Match) {
          const imageBuffer = Buffer.from(base64Match[2], "base64");
          const { saveFile } = await import("./fileStorage.js");
          const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
          const filename = `variant_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}.${ext}`;
          const imageUrl = await saveFile(
            imageBuffer,
            filename,
            `image/${base64Match[1]}`,
            "variants"
          );
          console.log(`✓ Saved base64 image: ${imageUrl}`);
          return imageUrl;
        }

        // Check if content is an array with image_url items (multimodal response)
        if (Array.isArray(message.content)) {
          for (const item of message.content) {
            if (item.type === "image_url" && item.image_url?.url) {
              console.log(
                `✓ Found image URL in multimodal content: ${item.image_url.url}`
              );
              return item.image_url.url;
            }
          }
        }
      }

      // Check for file_id if GigaChat returns file references
      if (message.file_id) {
        // Download file using GigaChat files API
        try {
          const fileResponse = await axios.get(
            `https://gigachat.devices.sberbank.ru/api/v1/files/${message.file_id}/content`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              httpsAgent: new https.Agent({
                rejectUnauthorized: false,
              }),
              responseType: "arraybuffer",
            }
          );

          const fileBuffer = Buffer.from(fileResponse.data);
          const { saveFile } = await import("./fileStorage.js");
          const filename = `variant_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}.png`;
          const imageUrl = await saveFile(
            fileBuffer,
            filename,
            "image/png",
            "variants"
          );
          console.log(`✓ Downloaded and saved image from file_id: ${imageUrl}`);
          return imageUrl;
        } catch (fileError) {
          console.warn(
            `Failed to download file ${message.file_id}:`,
            fileError.message
          );
        }
      }
    }

    // Check for image in response data directly
    if (responseData.image_url || responseData.image) {
      const imageUrl = responseData.image_url || responseData.image;
      console.log(`✓ Found image in response data: ${imageUrl}`);
      return imageUrl;
    }

    console.warn(
      "GigaChat response did not contain image data. Response structure:",
      JSON.stringify({
        hasChoices: !!responseData.choices,
        choicesLength: responseData.choices?.length,
        messageKeys: responseData.choices?.[0]?.message
          ? Object.keys(responseData.choices[0].message)
          : [],
        sampleContent:
          typeof responseData.choices?.[0]?.message?.content === "string"
            ? responseData.choices[0].message.content.substring(0, 200)
            : "not a string",
      })
    );
    return null;
  } catch (error) {
    console.error(
      "GigaChat image generation error:",
      error.response?.data || error.message
    );
    return null; // Return null on error, fallback to plan image
  }
};
