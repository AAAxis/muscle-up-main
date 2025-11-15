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

    // Get API key from Remote Config
    const apiKey = await getOpenRouterApiKey();

    // Prepare the request body for OpenRouter
    const requestBody = {
      model: options.model || 'openai/gpt-4o-mini', // Default model, can be overridden
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2000
    };

    // Add response format if JSON schema is provided
    if (responseJsonSchema) {
      requestBody.response_format = {
        type: 'json_object'
      };
      // Add schema instruction to prompt if JSON format is required
      if (!prompt.includes('JSON')) {
        requestBody.messages[0].content = `${prompt}\n\nחשוב: החזר תשובה בפורמט JSON בלבד, ללא טקסט נוסף.`;
      }
    }

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
    }

    const data = await response.json();
    
    // Extract the content from the response
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    // If JSON schema was requested, parse the JSON response
    if (responseJsonSchema) {
      try {
        // Try to extract JSON from the response (in case there's extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content;
        return JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        console.error('Response content:', content);
        throw new Error('Failed to parse JSON response from AI');
      }
    }

    return { content };
  } catch (error) {
    console.error('Error invoking LLM via OpenRouter:', error);
    throw error;
  }
};

// Generate Image (requires Cloud Function)
export const GenerateImage = async (prompt, options = {}) => {
  try {
    const generateImageFunction = httpsCallable(functions, 'generateImage');
    const result = await generateImageFunction({ prompt, ...options });
    return result.data;
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

