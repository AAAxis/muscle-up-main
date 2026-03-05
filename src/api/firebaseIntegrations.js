import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { storage, remoteConfig } from './firebaseConfig';
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

// Send Email - DEPRECATED: Use CoachNotification instead
export const SendEmail = async (emailData) => {
  console.warn('SendEmail is deprecated. Use CoachNotification.create() instead.');
  throw new Error('SendEmail is no longer supported. Please use CoachNotification.create() for notifications.');
};

// Send FCM Push Notification — Firebase only. No Expo, no other methods.
export const SendFCMNotification = async ({ userId, userEmail, title, body, data, imageUrl }) => {
  try {
    if (!title || !body) {
      throw new Error('Title and body are required for FCM notification');
    }

    if (!userId && !userEmail) {
      throw new Error('Either userId or userEmail must be provided');
    }

    const { db } = await import('./firebaseConfig');
    const { collection, query, where, getDocs, limit, doc, getDoc } = await import('firebase/firestore');

    let fcmTokens = [];

    if (userId) {
      const tokensQuery = query(
        collection(db, 'fcm_tokens'),
        where('userId', '==', userId),
        where('active', '==', true),
        limit(10)
      );
      const tokensSnapshot = await getDocs(tokensQuery);
      if (!tokensSnapshot.empty) {
        tokensSnapshot.docs.forEach(d => {
          const t = d.data().token;
          if (typeof t === 'string' && !t.startsWith('ExponentPushToken')) fcmTokens.push(t);
        });
      }
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const u = userDoc.data();
        if (u.fcm_token && typeof u.fcm_token === 'string' && !u.fcm_token.startsWith('ExponentPushToken')) {
          fcmTokens.push(u.fcm_token);
        }
      }
    } else if (userEmail) {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', userEmail),
        limit(1)
      );
      const usersSnapshot = await getDocs(usersQuery);
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        if (userData.fcm_token && typeof userData.fcm_token === 'string' && !userData.fcm_token.startsWith('ExponentPushToken')) {
          fcmTokens.push(userData.fcm_token);
        }
        const tokensQuery = query(
          collection(db, 'fcm_tokens'),
          where('userId', '==', userDoc.id),
          where('active', '==', true),
          limit(10)
        );
        const tokensSnapshot = await getDocs(tokensQuery);
        if (!tokensSnapshot.empty) {
          tokensSnapshot.docs.forEach(docSnap => {
            const t = docSnap.data().token;
            if (typeof t === 'string' && !t.startsWith('ExponentPushToken')) fcmTokens.push(t);
          });
        }
      }
    }

    fcmTokens = [...new Set(fcmTokens)];

    if (fcmTokens.length === 0) {
      throw new Error(`No push token found for user: ${userId || userEmail}`);
    }

    const apiUrl = '/api/send-notification';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        tokens: fcmTokens,
        data: { ...(data || {}), sentFrom: 'dashboard' },
        imageUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Push notification sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    throw error;
  }
};

// Get ChatGPT API key from Remote Config (with fallback to env var for development)
const getChatGPTApiKey = async () => {
  // First, try environment variable (useful for development)
  const envApiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envApiKey) {
    return envApiKey;
  }

  try {
    // Fetch and activate remote config
    await fetchAndActivate(remoteConfig);
    const apiKeyValue = getValue(remoteConfig, 'openai_api_key');
    const apiKey = apiKeyValue.asString();
    
    if (!apiKey) {
      throw new Error('ChatGPT API key not configured in Remote Config');
    }
    
    return apiKey;
  } catch (error) {
    console.error('Error fetching API key from Remote Config:', error);
    throw new Error('Failed to get ChatGPT API key. Please configure it in Firebase Remote Config or set VITE_OPENAI_API_KEY environment variable.');
  }
};

// Invoke LLM with fallback system (frontend-first, then backend service)
export const InvokeLLM = async (params) => {
  // Handle both old format (prompt, options) and new format (object with prompt)
  const prompt = typeof params === 'string' ? params : params.prompt;
  const options = typeof params === 'string' ? {} : params;
  const responseJsonSchema = options.response_json_schema;
  
  if (!prompt) {
    throw new Error('Prompt is required');
  }

  console.log('InvokeLLM called with:', { hasPrompt: !!prompt, hasSchema: !!responseJsonSchema });

  // Check if fallback is disabled (for testing or specific use cases)
  const disableFallback = options.disableFallback || import.meta.env.VITE_DISABLE_CHAT_FALLBACK === 'true';
  // Force backend by default (unless explicitly disabled)
  const forceBackend = options.forceBackend !== false && (options.forceBackend === true || import.meta.env.VITE_FORCE_CHAT_BACKEND === 'true' || true);

  // If forced to use backend, skip frontend attempt
  if (forceBackend) {
    console.log('🔧 Forcing backend chat service (configured)...');
    return await invokeLLMBackend(prompt, options, responseJsonSchema);
  }

  // Try frontend-first approach (ChatGPT API directly)
  try {
    console.log('🤖 Attempting frontend ChatGPT generation...');
    const result = await invokeLLMFrontend(prompt, options, responseJsonSchema);
    console.log('✅ Frontend ChatGPT generation successful');
    return result;
  } catch (frontendError) {
    console.warn('⚠️ Frontend ChatGPT generation failed:', frontendError.message);
    
    // If fallback is disabled, throw the frontend error
    if (disableFallback) {
      console.error('❌ Fallback disabled, throwing frontend error');
      throw frontendError;
    }
    
    // Fall back to backend service
    try {
      console.log('🔄 Falling back to backend chat service...');
      const result = await invokeLLMBackend(prompt, options, responseJsonSchema);
      console.log('✅ Backend chat generation successful (fallback)');
      return result;
    } catch (backendError) {
      console.error('❌ Both frontend and backend chat generation failed');
      console.error('Frontend error:', frontendError.message);
      console.error('Backend error:', backendError.message);
      
      // Throw a comprehensive error
      throw new Error(
        `Chat completion failed on both frontend and backend. ` +
        `Frontend: ${frontendError.message}. ` +
        `Backend: ${backendError.message}`
      );
    }
  }
};

// Frontend ChatGPT generation (OpenAI API directly)
const invokeLLMFrontend = async (prompt, options = {}, responseJsonSchema = null) => {
  try {
    // Get API key from Remote Config
    const apiKey = await getChatGPTApiKey();
    
    if (!apiKey) {
      throw new Error('ChatGPT API key is missing. Please configure it in Firebase Remote Config or set VITE_OPENAI_API_KEY environment variable.');
    }

    // Prepare the request body for ChatGPT
    let finalPrompt = prompt;
    
    // If JSON schema is provided, ensure the prompt explicitly requests JSON
    if (responseJsonSchema) {
      if (!prompt.includes('JSON') && !prompt.includes('json')) {
        finalPrompt = `${prompt}\n\nחשוב מאוד: החזר תשובה בפורמט JSON בלבד, ללא טקסט נוסף לפני או אחרי ה-JSON. התשובה חייבת להתחיל ב-{ ולהסתיים ב-}.`;
      }
    }

    const requestBody = {
      model: options.model || 'gpt-4o-mini', // Default model, can be overridden
      messages: [
        {
          role: 'system',
          content: responseJsonSchema 
            ? 'You are a helpful assistant that returns responses in JSON format only. Always use English keys in the JSON object (like "workout_title", "workout_description"). However, ALL content values must be in Hebrew if the user requests Hebrew content. Return ONLY valid JSON, no additional text before or after.'
            : 'You are a helpful assistant. If the user writes in Hebrew, respond in Hebrew. If the user writes in English, respond in English.'
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

    console.log('Sending request to ChatGPT:', { 
      model: requestBody.model, 
      hasJsonFormat: !!requestBody.response_format,
      promptLength: finalPrompt.length 
    });

    // Call ChatGPT API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
      console.error('ChatGPT API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`ChatGPT API error: ${response.status} ${response.statusText}. ${errorData.error?.message || errorText}`);
    }

    const data = await response.json();
    console.log('ChatGPT response received:', { 
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasContent: !!data.choices?.[0]?.message?.content
    });
    
    // Extract the content from the response
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in response:', data);
      throw new Error('No content in ChatGPT response. Response structure: ' + JSON.stringify(data));
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
    console.error('Error invoking LLM via ChatGPT:', error);
    throw error;
  }
};

// Generate Image with fallback system (frontend-first, then backend service)
export const GenerateImage = async (params) => {
  // Handle both old format (prompt, options) and new format (object with prompt)
  const prompt = typeof params === 'string' ? params : params.prompt;
  const options = typeof params === 'string' ? {} : params;
  
  if (!prompt) {
    throw new Error('Prompt is required for image generation');
  }

  // Check if fallback is disabled (for testing or specific use cases)
  const disableFallback = options.disableFallback || import.meta.env.VITE_DISABLE_DALLE_FALLBACK === 'true';
  // Force backend by default (unless explicitly disabled)
  const forceBackend = options.forceBackend !== false && (options.forceBackend === true || import.meta.env.VITE_FORCE_DALLE_BACKEND === 'true' || true);

  // If forced to use backend, skip frontend attempt
  if (forceBackend) {
    console.log('🔧 Forcing backend DALL-E service (configured)...');
    return await generateImageBackend(prompt, options);
  }

  // Try frontend-first approach (OpenAI DALL-E API directly)
  try {
    console.log('🎨 Attempting frontend DALL-E generation...');
    const result = await generateImageFrontend(prompt, options);
    console.log('✅ Frontend DALL-E generation successful');
    return result;
  } catch (frontendError) {
    console.warn('⚠️ Frontend DALL-E generation failed:', frontendError.message);
    
    // If fallback is disabled, throw the frontend error
    if (disableFallback) {
      console.error('❌ Fallback disabled, throwing frontend error');
      throw frontendError;
    }
    
    // Fall back to backend service
    try {
      console.log('🔄 Falling back to backend DALL-E service...');
      const result = await generateImageBackend(prompt, options);
      console.log('✅ Backend DALL-E generation successful (fallback)');
      return result;
    } catch (backendError) {
      console.error('❌ Both frontend and backend DALL-E generation failed');
      console.error('Frontend error:', frontendError.message);
      console.error('Backend error:', backendError.message);
      
      // Throw a comprehensive error
      throw new Error(
        `Image generation failed on both frontend and backend. ` +
        `Frontend: ${frontendError.message}. ` +
        `Backend: ${backendError.message}`
      );
    }
  }
};

// Frontend DALL-E generation (OpenAI API directly)
const generateImageFrontend = async (prompt, options = {}) => {
  try {
    // Get API key from Remote Config or environment
    const apiKey = await getChatGPTApiKey(); // Reuse the same function for OpenAI API key
  
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Please configure it in Firebase Remote Config or set VITE_OPENAI_API_KEY environment variable.');
  }

  // Prepare the request for OpenAI DALL-E API
  const model = options.model || 'dall-e-3'; // dall-e-2 or dall-e-3
  const size = options.size || '1024x1024';
  
  // DALL-E 3 size validation
  const validSizes = model === 'dall-e-3' 
    ? ['1024x1024', '1792x1024', '1024x1792']
    : ['256x256', '512x512', '1024x1024'];
  
  const finalSize = validSizes.includes(size) ? size : '1024x1024';

  const requestBody = {
    model: model,
    prompt: prompt,
    size: finalSize,
    quality: options.quality || 'standard', // 'standard' or 'hd' (DALL-E 3 only)
    response_format: 'url'
  };

  // DALL-E 3 only supports n=1, DALL-E 2 can have multiple images
  if (model === 'dall-e-2') {
    requestBody.n = options.n || 1;
  }

  console.log('Generating image with OpenAI DALL-E (frontend):', { 
    model, 
    size: finalSize, 
    promptLength: prompt.length 
  });

  // Call OpenAI DALL-E API directly
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('OpenAI DALL-E API error (frontend):', {
      status: response.status,
      statusText: response.statusText,
      error: errorData
    });
    throw new Error(`OpenAI DALL-E API error: ${response.status} ${response.statusText}. ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('OpenAI DALL-E response received (frontend):', { 
    hasData: !!data.data,
    imageCount: data.data?.length || 0
  });
  
  // Extract the image URL from the response and return in expected format
  if (data.data && data.data.length > 0) {
    const imageData = data.data[0];
    return {
      url: imageData.url,
      revised_prompt: imageData.revised_prompt || prompt
    };
  } else {
    throw new Error('No image data in OpenAI response');
  }
  } catch (error) {
    console.error('Error generating image with OpenAI DALL-E (frontend):', error);
    throw error;
  }
};

// Backend DALL-E generation (Firebase Cloud Function)
const generateImageBackend = async (prompt, options = {}) => {
  // Use Firebase Cloud Function instead of external DALL-E server
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('./firebaseConfig');
  
  console.log('Generating image with Firebase Cloud Function:', { 
    promptLength: prompt.length,
    size: options.size || '1024x1024',
    model: options.model || 'dall-e-3'
  });
  
  try {
    const generateImageFunction = httpsCallable(functions, 'generateImage');
    
    const result = await generateImageFunction({
      prompt: prompt,
      size: options.size || '1024x1024',
      model: options.model || 'dall-e-3',
    });
    
    console.log('Firebase Function DALL-E response received:', { 
      hasUrl: !!result.data?.url,
      hasRevisedPrompt: !!result.data?.revised_prompt
    });
    
    return {
      url: result.data.url,
      revised_prompt: result.data.revised_prompt || prompt
    };
  } catch (error) {
    console.error('Firebase Function error:', error);
    if (error.code === 'functions/not-found') {
      throw new Error('generateImage function not found. Please deploy the Firebase Cloud Function first.');
    }
    if (error.code === 'functions/unauthenticated') {
      throw new Error('You must be logged in to generate images.');
    }
    throw error;
  }
};

// Backend chat completion (Firebase Cloud Function)
const invokeLLMBackend = async (prompt, options = {}, responseJsonSchema = null) => {
  // Use Firebase Cloud Function instead of external AI service
  const { httpsCallable } = await import('firebase/functions');
  const { functions } = await import('./firebaseConfig');
  
  console.log('Generating chat completion with Firebase Cloud Function:', { 
    promptLength: prompt.length,
    model: options.model || 'gpt-4o-mini'
  });

  // Prepare messages in OpenAI format
  let messages = [
    {
      role: 'system',
      content: responseJsonSchema 
        ? 'You are a helpful assistant that returns responses in JSON format only. Always use English keys in the JSON object (like "workout_title", "workout_description"). However, ALL content values must be in Hebrew if the user requests Hebrew content. Return ONLY valid JSON, no additional text before or after.'
        : 'You are a helpful assistant. If the user writes in Hebrew, respond in Hebrew. If the user writes in English, respond in English.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  const requestBody = {
    messages: messages,
    model: options.model || 'gpt-4o-mini',
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 4000
  };

  // Add response format if JSON schema is provided
  if (responseJsonSchema) {
    requestBody.response_format = {
      type: 'json_object'
    };
  }
  
  try {
    const chatCompletionFunction = httpsCallable(functions, 'chatCompletion');
    
    const result = await chatCompletionFunction(requestBody);
    
    const data = result.data;
    console.log('Firebase Function chat response received:', { 
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasContent: !!data.choices?.[0]?.message?.content
    });
  
    // Extract the content from the response
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in Firebase Function response:', data);
      throw new Error('No content in Firebase Function chat response. Response structure: ' + JSON.stringify(data));
    }

    // If JSON schema was requested, parse the JSON response and return it directly
    if (responseJsonSchema) {
      try {
        const parsedContent = JSON.parse(content);
        console.log('Successfully parsed JSON response from Firebase Function');
        // Return the parsed content directly (not wrapped) when JSON schema is requested
        return parsedContent;
      } catch (parseError) {
        console.error('Failed to parse JSON response from Firebase Function:', parseError);
        console.error('Raw content:', content);
        
        // Try to extract JSON from the response if it's wrapped in other text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsedContent = JSON.parse(jsonMatch[0]);
            console.log('Successfully extracted and parsed JSON from Firebase Function response');
            // Return the parsed content directly (not wrapped) when JSON schema is requested
            return parsedContent;
          } catch (extractError) {
            console.error('Failed to parse extracted JSON from Firebase Function:', extractError);
          }
        }
        
        throw new Error(`Failed to parse JSON response from Firebase Function AI: ${parseError.message}. Response preview: ${content.substring(0, 500)}`);
      }
    }

    return { content };
  } catch (error) {
    console.error('Firebase Function error:', error);
    if (error.code === 'functions/not-found') {
      throw new Error('chatCompletion function not found. Please deploy the Firebase Cloud Function first.');
    }
    if (error.code === 'functions/unauthenticated') {
      throw new Error('You must be logged in to use chat completion.');
    }
    throw error;
  }
};

// Extract Data From Uploaded File - DEPRECATED: Cloud Function removed due to CORS issues
export const ExtractDataFromUploadedFile = async (fileUrl, options = {}) => {
  console.warn('ExtractDataFromUploadedFile is deprecated due to Cloud Function CORS issues.');
  throw new Error('ExtractDataFromUploadedFile is no longer supported due to Cloud Function CORS issues.');
};

// Core integrations object (matching Base44 structure)
export const Core = {
  UploadFile,
  UploadPrivateFile,
  CreateFileSignedUrl,
  SendEmail, // DEPRECATED - Use CoachNotification instead
  SendFCMNotification,
  InvokeLLM,
  GenerateImage,
  ExtractDataFromUploadedFile // DEPRECATED - Cloud Function removed
};

