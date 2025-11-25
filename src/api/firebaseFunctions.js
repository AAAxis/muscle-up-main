import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

// Analyze Food Image (requires Cloud Function)
export const analyzeFoodImage = async (imageUrl) => {
  try {
    const analyzeFoodImageFunction = httpsCallable(functions, 'analyzeFoodImage');
    const result = await analyzeFoodImageFunction({ imageUrl });
    return result.data;
  } catch (error) {
    console.error('Error analyzing food image:', error);
    throw error;
  }
};

// Impersonate (requires Cloud Function - admin only)
export const impersonate = async (userId) => {
  try {
    const impersonateFunction = httpsCallable(functions, 'impersonate');
    const result = await impersonateFunction({ userId });
    return result.data;
  } catch (error) {
    console.error('Error impersonating user:', error);
    throw error;
  }
};

// Update Recipe Image (requires Cloud Function)
export const updateRecipeImage = async (recipeId, imageUrl) => {
  try {
    const updateRecipeImageFunction = httpsCallable(functions, 'updateRecipeImage');
    const result = await updateRecipeImageFunction({ recipeId, imageUrl });
    return result.data;
  } catch (error) {
    console.error('Error updating recipe image:', error);
    throw error;
  }
};

// Import Task Templates (requires Cloud Function)
export const importTaskTemplates = async (data) => {
  try {
    const importTaskTemplatesFunction = httpsCallable(functions, 'importTaskTemplates');
    const result = await importTaskTemplatesFunction(data);
    return result.data;
  } catch (error) {
    console.error('Error importing task templates:', error);
    throw error;
  }
};

// Export Task Templates (requires Cloud Function)
// Note: This should return CSV data as a string
export const exportTaskTemplates = async () => {
  try {
    const exportTaskTemplatesFunction = httpsCallable(functions, 'exportTaskTemplates');
    const result = await exportTaskTemplatesFunction();
    // If the function returns an object with data property, extract it
    return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
  } catch (error) {
    console.error('Error exporting task templates:', error);
    throw error;
  }
};

// Import Booster Plus Task Templates (requires Cloud Function)
export const importBoosterPlusTaskTemplates = async (data) => {
  try {
    const importBoosterPlusTaskTemplatesFunction = httpsCallable(functions, 'importBoosterPlusTaskTemplates');
    const result = await importBoosterPlusTaskTemplatesFunction(data);
    return result.data;
  } catch (error) {
    console.error('Error importing booster plus task templates:', error);
    throw error;
  }
};

// Export Booster Plus Task Templates (requires Cloud Function)
// Note: This should return CSV data as a string
export const exportBoosterPlusTaskTemplates = async () => {
  try {
    const exportBoosterPlusTaskTemplatesFunction = httpsCallable(functions, 'exportBoosterPlusTaskTemplates');
    const result = await exportBoosterPlusTaskTemplatesFunction();
    // If the function returns an object with data property, extract it
    return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
  } catch (error) {
    console.error('Error exporting booster plus task templates:', error);
    throw error;
  }
};

// Send FCM Push Notification (requires Cloud Function)
export const sendFCMNotification = async ({ userId, userEmail, title, body, data, imageUrl }) => {
  try {
    if (!title || !body) {
      throw new Error('Title and body are required for FCM notification');
    }

    if (!userId && !userEmail) {
      throw new Error('Either userId or userEmail must be provided');
    }

    const sendNotificationFunction = httpsCallable(functions, 'sendFCMNotification');
    const result = await sendNotificationFunction({
      userId,
      userEmail,
      title,
      body,
      data: data || {},
      imageUrl,
    });

    return result.data;
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    throw error;
  }
};

