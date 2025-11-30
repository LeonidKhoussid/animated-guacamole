import axios from "axios";
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Call OpenAI API for design generation
export const callOpenAI = async (messages, options = {}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Set OPENAI_API_KEY in .env"
    );
  }

  const { 
    model = "gpt-4o", 
    temperature = 0.7, 
    max_tokens = 2000,
    response_format = null 
  } = options;

  try {
    console.log('Calling OpenAI chat completions API...', { 
      model, 
      messageCount: messages.length,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    });
    
    const startTime = Date.now();
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model,
        messages,
        temperature,
        max_tokens,
        ...(response_format && { response_format }),
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000, // 60 second timeout
        validateStatus: function (status) {
          return status < 500; // Don't throw for 4xx errors, let us handle them
        }
      }
    );

    const responseTime = Date.now() - startTime;
    console.log(`OpenAI chat completions response received in ${responseTime}ms:`, {
      status: response.status,
      statusText: response.statusText,
      hasData: !!response.data
    });
    
    if (response.status >= 400) {
      console.error('OpenAI API returned error status:', {
        status: response.status,
        data: response.data
      });
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    
    return response.data;
  } catch (error) {
    console.error("OpenAI API error:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code
    });
    throw error;
  }
};

// Generate design image using OpenAI DALL-E
export const generateDesignImage = async (prompt, roomImageUrl = null) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Set OPENAI_API_KEY in .env"
    );
  }

  try {
    // If room image is provided, use vision model to analyze and generate design
    if (roomImageUrl) {
      console.log('Room image URL provided:', roomImageUrl);
      
      // Check if URL is publicly accessible (not localhost or local file)
      const isLocalUrl = roomImageUrl.includes('localhost') || 
                         roomImageUrl.includes('127.0.0.1') || 
                         roomImageUrl.startsWith('/') ||
                         !roomImageUrl.startsWith('http');
      
      let imageContent = null;
      
      if (isLocalUrl) {
        // For local URLs, try HTTP first, then fallback to filesystem
        console.log('Local URL detected, converting to base64...');
        
        let imageBuffer = null;
        let contentType = 'image/jpeg';
        
        // Determine content type from URL
        if (roomImageUrl.includes('.png')) {
          contentType = 'image/png';
        } else if (roomImageUrl.includes('.gif')) {
          contentType = 'image/gif';
        } else if (roomImageUrl.includes('.webp')) {
          contentType = 'image/webp';
        }
        
        // Try HTTP fetch first
        try {
          const fullUrl = roomImageUrl.startsWith('/') 
            ? `${process.env.BASE_URL || 'http://localhost:3001'}${roomImageUrl}`
            : roomImageUrl;
          
          const imageResponse = await axios.get(fullUrl, {
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          imageBuffer = Buffer.from(imageResponse.data);
          const responseContentType = imageResponse.headers['content-type'];
          if (responseContentType) {
            contentType = responseContentType;
          }
          console.log('Image fetched via HTTP successfully');
        } catch (httpError) {
          console.warn('HTTP fetch failed, trying filesystem:', httpError.message);
          
          // Fallback: try to read from filesystem
          try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const uploadDir = process.env.UPLOAD_DIR || join(__dirname, '../../uploads');
            
            // Extract filename from URL (e.g., /uploads/plans/room_123.jpg -> plans/room_123.jpg)
            let filePath = roomImageUrl.replace(/^.*\/uploads\//, '').replace(/^\//, '');
            if (!filePath) {
              filePath = roomImageUrl.split('/').pop();
            }
            
            const fullFilePath = join(uploadDir, filePath);
            
            if (existsSync(fullFilePath)) {
              imageBuffer = await readFile(fullFilePath);
              console.log('Image read from filesystem successfully');
            } else {
              throw new Error(`File not found: ${fullFilePath}`);
            }
          } catch (fsError) {
            console.error('Filesystem read also failed:', fsError.message);
            throw new Error(`Failed to process local image. HTTP error: ${httpError.message}, Filesystem error: ${fsError.message}`);
          }
        }
        
        // Convert buffer to base64
        if (imageBuffer) {
          const base64Image = imageBuffer.toString('base64');
          imageContent = `data:${contentType};base64,${base64Image}`;
          console.log('Image converted to base64 successfully');
        } else {
          throw new Error('Failed to obtain image data');
        }
      } else {
        // For public URLs, verify accessibility
        console.log('Checking if image URL is publicly accessible...');
        try {
          const imageCheck = await axios.head(roomImageUrl, { timeout: 5000 });
          console.log('Image URL is accessible:', { status: imageCheck.status, contentType: imageCheck.headers['content-type'] });
          imageContent = roomImageUrl;
        } catch (imageError) {
          console.warn('Image URL might not be accessible, trying to download and convert to base64:', {
            url: roomImageUrl,
            error: imageError.message
          });
          
          // Try downloading and converting to base64
          try {
            const imageResponse = await axios.get(roomImageUrl, {
              responseType: 'arraybuffer',
              timeout: 10000
            });
            
            let contentType = imageResponse.headers['content-type'] || 'image/jpeg';
            const base64Image = Buffer.from(imageResponse.data).toString('base64');
            imageContent = `data:${contentType};base64,${base64Image}`;
            console.log('Image downloaded and converted to base64');
          } catch (downloadError) {
            console.error('Failed to download image for base64 conversion:', downloadError.message);
            throw new Error(`Image URL is not accessible: ${imageError.message}`);
          }
        }
      }
      
      // Use GPT-4 Vision to analyze the room and generate design description
      const visionMessages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Проанализируй это изображение комнаты и создай описание дизайна на основе следующего запроса: ${prompt}\n\nОпиши конкретные изменения: какие предметы мебели добавить, какие убрать, какие цвета использовать, какую расстановку предложить.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageContent
              }
            }
          ]
        }
      ];

      console.log('Calling OpenAI Vision API to analyze room image...', { 
        roomImageUrl, 
        prompt: prompt.substring(0, 100),
        messageLength: JSON.stringify(visionMessages).length
      });
      
      const startTime = Date.now();
      const visionResponse = await callOpenAI(visionMessages, {
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 1000
      });
      const visionTime = Date.now() - startTime;
      console.log(`Vision API call completed in ${visionTime}ms`);

      console.log('Vision API response received');
      const designDescription = visionResponse.choices[0].message.content;
      console.log('Design description generated:', designDescription.substring(0, 100) + '...');
      
      // Now generate image using DALL-E with the enhanced prompt
      const imagePrompt = `Interior design rendering: ${designDescription}. Professional interior design, realistic lighting, high quality, modern style.`;
      
      console.log('Calling DALL-E 3 to generate design image...', { 
        imagePrompt: imagePrompt.substring(0, 100) + '...',
        promptLength: imagePrompt.length
      });
      
      const dalleStartTime = Date.now();
      const imageResponse = await axios.post(
        "https://api.openai.com/v1/images/generations",
        {
          model: "dall-e-3",
          prompt: imagePrompt,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 120000, // 120 second timeout for image generation
        }
      );
      
      const dalleTime = Date.now() - dalleStartTime;
      console.log(`DALL-E 3 response received in ${dalleTime}ms:`, { 
        imageUrl: imageResponse.data.data[0]?.url,
        revisedPrompt: imageResponse.data.data[0]?.revised_prompt
      });

      return {
        imageUrl: imageResponse.data.data[0].url,
        description: designDescription
      };
    } else {
      // No room image, just generate based on prompt
      const imagePrompt = `Interior design rendering: ${prompt}. Professional interior design, realistic lighting, high quality, modern style.`;
      
      console.log('Calling DALL-E 3 without room image...', { imagePrompt: imagePrompt.substring(0, 100) + '...' });
      const imageResponse = await axios.post(
        "https://api.openai.com/v1/images/generations",
        {
          model: "dall-e-3",
          prompt: imagePrompt,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 120000, // 120 second timeout for image generation
        }
      );
      
      console.log('DALL-E 3 response received:', { imageUrl: imageResponse.data.data[0]?.url });

      return {
        imageUrl: imageResponse.data.data[0].url,
        description: prompt
      };
    }
  } catch (error) {
    console.error("OpenAI image generation error:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code
    });
    throw error;
  }
};

