import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { storage, functions, remoteConfig } from './firebaseConfig';
import { auth } from './firebaseConfig';

// File Upload
export const UploadFile = async ({ file, path = 'uploads' }) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to upload files');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const fileRef = ref(storage, `${path}/${currentUser.uid}/${filename}`);

    // Upload file
    const snapshot = await uploadBytes(fileRef, file);
    const file_url = await getDownloadURL(snapshot.ref);

    return {
      file_url,
      file_path: snapshot.ref.fullPath,
      filename: filename
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Upload Private File
export const UploadPrivateFile = async ({ file, path = 'private' }) => {
  // Same as UploadFile but in a private folder
  return UploadFile({ file, path });
};

// Create File Signed URL (for private files)
export const CreateFileSignedUrl = async (filePath, expiresIn = 3600) => {
  try {
    const fileRef = ref(storage, filePath);
    // Note: For signed URLs, you might need to use Firebase Admin SDK on the backend
    // For now, we'll return the download URL
    const url = await getDownloadURL(fileRef);
    return { signed_url: url };
  } catch (error) {
    console.error('Error creating signed URL:', error);
    throw error;
  }
};

// Send Email (requires Cloud Function)
export const SendEmail = async (emailData) => {
  try {
    const sendEmailFunction = httpsCallable(functions, 'sendEmail');
    const result = await sendEmailFunction(emailData);
    return result.data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Get OpenRouter API key from Remote Config (with fallback to env var for development)
const getOpenRouterApiKey = async () => {
  // First, try environment variable (useful for development)
  const envApiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (envApiKey) {
    return envApiKey;
  }

  try {
    // Fetch and activate remote config
    await fetchAndActivate(remoteConfig);
    const apiKeyValue = getValue(remoteConfig, 'openrouter_api_key');
    const apiKey = apiKeyValue.asString();
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured in Remote Config');
    }
    
    return apiKey;
  } catch (error) {
    console.error('Error fetching API key from Remote Config:', error);
    throw new Error('Failed to get OpenRouter API key. Please configure it in Firebase Remote Config or set VITE_OPENROUTER_API_KEY environment variable.');
  }
};

// Invoke LLM using OpenRouter API (no Cloud Function needed)
export const InvokeLLM = async (params) => {
  try {
    // Handle both old format (prompt, options) and new format (object with prompt)
    const prompt = typeof params === 'string' ? params : params.prompt;
    const options = typeof params === 'string' ? {} : params;
    const responseJsonSchema = options.response_json_schema;
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    console.log('InvokeLLM called with:', { hasPrompt: !!prompt, hasSchema: !!responseJsonSchema });

    // Get API key from Remote Config
    const apiKey = await getOpenRouterApiKey();
    
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing. Please configure it in Firebase Remote Config or set VITE_OPENROUTER_API_KEY environment variable.');
    }

    // Prepare the request body for OpenRouter
    let finalPrompt = prompt;
    
    // If JSON schema is provided, ensure the prompt explicitly requests JSON
    if (responseJsonSchema) {
      if (!prompt.includes('JSON') && !prompt.includes('json')) {
        finalPrompt = `${prompt}\n\nחשוב מאוד: החזר תשובה בפורמט JSON בלבד, ללא טקסט נוסף לפני או אחרי ה-JSON. התשובה חייבת להתחיל ב-{ ולהסתיים ב-}.`;
      }
    }

    const requestBody = {
      model: options.model || 'openai/gpt-4o-mini', // Default model, can be overridden
      messages: [
        {
          role: 'system',
          content: responseJsonSchema 
            ? 'You are a helpful assistant that returns responses in JSON format only. Always use English keys in the JSON object, even when the content is in Hebrew. Return ONLY valid JSON, no additional text before or after.'
            : 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: finalPrompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 4000 // Increased for longer responses
    };

    // Add response format if JSON schema is provided
    if (responseJsonSchema) {
      requestBody.response_format = {
        type: 'json_object'
      };
    }

    console.log('Sending request to OpenRouter:', { 
      model: requestBody.model, 
      hasJsonFormat: !!requestBody.response_format,
      promptLength: finalPrompt.length 
    });

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin, // Optional: for analytics
        'X-Title': 'Muscle Up App' // Optional: for analytics
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      console.error('OpenRouter API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}. ${errorData.error?.message || errorText}`);
    }

    const data = await response.json();
    console.log('OpenRouter response received:', { 
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasContent: !!data.choices?.[0]?.message?.content
    });
    
    // Extract the content from the response
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in response:', data);
      throw new Error('No content in OpenRouter response. Response structure: ' + JSON.stringify(data));
    }

    console.log('Response content length:', content.length);
    console.log('Response content preview:', content.substring(0, 200));

    // If JSON schema was requested, parse the JSON response
    if (responseJsonSchema) {
      try {
        // Try to extract JSON from the response (in case there's extra text)
        let jsonString = content.trim();
        
        // Remove markdown code blocks if present
        jsonString = jsonString.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        
        // Try to find JSON object
        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        }
        
        const parsed = JSON.parse(jsonString);
        console.log('Successfully parsed JSON response');
        return parsed;
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        console.error('Raw response content:', content);
        console.error('Content length:', content.length);
        throw new Error(`Failed to parse JSON response from AI: ${parseError.message}. Response preview: ${content.substring(0, 500)}`);
      }
    }

    return { content };
  } catch (error) {
    console.error('Error invoking LLM via OpenRouter:', error);
    throw error;
  }
};

// Generate Image using DALL-E service (no Cloud Function needed)
export const GenerateImage = async (params) => {
  try {
    // Handle both old format (prompt, options) and new format (object with prompt)
    const prompt = typeof params === 'string' ? params : params.prompt;
    const options = typeof params === 'string' ? {} : params;
    
    if (!prompt) {
      throw new Error('Prompt is required for image generation');
    }

    // Use the DALL-E service endpoint
    // Default to production URL, can be overridden with env variable
    const dalleServiceUrl = import.meta.env.VITE_DALLE_SERVICE_URL || 'https://dalle.roamjet.net';
    
    const response = await fetch(`${dalleServiceUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        size: options.size || '1024x1024'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DALL-E service error: ${response.status} ${response.statusText}. ${errorData.error || errorData.details || ''}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
};

// Extract Data From Uploaded File (requires Cloud Function)
export const ExtractDataFromUploadedFile = async (fileUrl, options = {}) => {
  try {
    const extractDataFunction = httpsCallable(functions, 'extractDataFromFile');
    const result = await extractDataFunction({ fileUrl, ...options });
    return result.data;
  } catch (error) {
    console.error('Error extracting data from file:', error);
    throw error;
  }
};

// Core integrations object (matching Base44 structure)
export const Core = {
  UploadFile,
  UploadPrivateFile,
  CreateFileSignedUrl,
  SendEmail,
  InvokeLLM,
  GenerateImage,
  ExtractDataFromUploadedFile
};

