
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, CalorieTracking, WaterTracking, CoachNotification } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Eye, Calendar, Utensils, Droplets, User as UserIcon, Image as ImageIcon, Loader2, ChevronDown, MoreVertical, Trash2, MessageSquare, Send, Edit, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { groupBy } from 'lodash';
import { formatDateTime, getRelativeTime, formatDate, formatTime } from "@/components/utils/timeUtils";
import { Textarea } from '@/components/ui/textarea';
// SendEmail removed - using CoachNotification instead

// Helper function to add delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function with retry logic for rate limited requests
const withRetry = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.message?.includes('429') || (error.response && error.response.status === 429);
      if (isRateLimit && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i); // Exponential backoff
        console.warn(`Rate limit hit or API error (${error.message || error.response?.status}), retrying in ${delayTime}ms (attempt ${i + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

const processAndGroupData = (meals, water, users) => {
    const userMedia = {};

    const ensureUser = (email) => {
        if (!userMedia[email]) {
            const user = users.find(u => u.email === email);
            userMedia[email] = {
                user: user || { email, name: 'משתמש לא ידוע', profile_image_url: '', calorie_target: null },
                meals: [],
                waterPhotos: [],
                hasUnread: false
            };
        }
    };

    meals.forEach(meal => {
        // Only process meals with images for the main album grid display.
        // `sharedMeals` state might contain meals without images, but `groupedMedia` only shows images.
        if (!meal.meal_image) return; 
        const email = meal.user_email || meal.created_by;
        if (!email) return;
        ensureUser(email);
        userMedia[email].meals.push({ ...meal, user_email: email });
        if (!meal.viewed_by_coach) userMedia[email].hasUnread = true;
    });

    water.forEach(w => {
        if (!w.photo_url) return;
        const email = w.user_email || w.created_by;
        if (!email) return;
        ensureUser(email);
        userMedia[email].waterPhotos.push({ ...w, user_email: email });
        if (!w.viewed_by_coach) userMedia[email].hasUnread = true;
    });

    return Object.values(userMedia)
      .map(group => {
        group.meals.sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
        group.waterPhotos.sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
        group.hasUnread = group.meals.some(meal => !meal.viewed_by_coach) || group.waterPhotos.some(water => !water.viewed_by_coach);
        return group;
      }).sort((a,b) => (b.hasUnread - a.hasUnread));
};

export default function SharedMealsViewer() {
  const [groupedMedia, setGroupedMedia] = useState([]);
  const [sharedMeals, setSharedMeals] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [isAlbumOpen, setIsAlbumOpen] = useState(false);
  const [selectedUserAlbum, setSelectedUserAlbum] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [users, setUsers] = useState([]);
  const [allUserMeals, setAllUserMeals] = useState({});
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isLoadingAllMeals, setIsLoadingAllMeals] = useState(false); // New state for loading all meals for calculations
  const [error, setError] = useState(null); // New state for general errors
  const [deletingMealId, setDeletingMealId] = useState(null); // New state for tracking deletion

  // Load initial data (users, shared meals, water photos) with rate limiting
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      // Load users first
      console.log('Loading users...');
      const allUsers = await withRetry(async () => {
        return await User.list();
      });
      setUsers(allUsers);
      
      await delay(300); // Small delay between requests
      
      // Load all meals explicitly shared with coach (regardless of image presence)
      console.log('Loading shared meals (shared_with_coach: true)...');
      const fetchedSharedMeals = await withRetry(async () => {
        return await CalorieTracking.filter({ shared_with_coach: true }, '-meal_timestamp', 500); 
      });
      setSharedMeals(fetchedSharedMeals); // This state holds all relevant shared meals for calculations
      
      await delay(300); // Small delay
      
      // Load water photos
      console.log('Loading water photos...');
      const allWater = await withRetry(async () => {
        return await WaterTracking.filter({ photo_url: { '$ne': null } }, '-created_date', 500);
      });

      // Process data for the main album grid. 
      // `processAndGroupData` still filters for `meal_image` for meals.
      const processedData = processAndGroupData(fetchedSharedMeals, allWater, allUsers);
      setGroupedMedia(processedData);

    } catch (err) {
      console.error("Failed to load shared content:", err);
      if (err.message?.includes('429') || (err.response && err.response.status === 429)) {
        setError("הגיעו למגבלת הקצב. אנא המתן כמה רגעים ונסה שוב.");
      } else {
        setError("שגיאה בטעינת נתוני הארוחות המשותפות. אנא נסה שוב.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load all meals for users to calculate correct daily totals and display all entries
  // This function now uses the `sharedMeals` state (which contains all shared_with_coach meals)
  // to determine which users and dates need comprehensive meal data fetching.
  const loadAllUserMeals = useCallback(async () => {
    // Only proceed if there are shared meals to process and not already loading
    if (sharedMeals.length === 0 || isLoadingAllMeals) { 
        if (sharedMeals.length === 0) setAllUserMeals({}); // Clear previous if no shared meals
        return;
    }
    
    setIsLoadingAllMeals(true);
    try {
      const userMealsData = {};
      
      // Get unique dates from shared meals (format to 'yyyy-MM-dd' for consistent keys)
      const uniqueDates = [...new Set(sharedMeals.map(m => format(parseISO(m.date || m.created_date), 'yyyy-MM-dd')))];
      
      // Get unique users from shared meals (these are the users we care about for detailed meal fetching)
      const uniqueUsers = [...new Set(sharedMeals.map(m => m.user_email))];
      
      console.log(`Loading all meals for ${uniqueUsers.length} users across ${uniqueDates.length} dates for detailed view...`);
      
      // Fetch all meals for each unique user, with retry and delay
      for (let i = 0; i < uniqueUsers.length; i++) {
        const userEmail = uniqueUsers[i];
        
        try {
          // Add delay between user requests to avoid rate limiting
          if (i > 0) {
            await delay(500); // 500ms delay between users
          }
          
          console.log(`Fetching all meals for user ${i + 1}/${uniqueUsers.length}: ${userEmail}`);
          
          const userAllMeals = await withRetry(async () => {
            return await CalorieTracking.filter({ user_email: userEmail }); // Fetch ALL meals for this user
          });
          
          // Group by date locally after fetching all for the user
          for (const dateStr of uniqueDates) {
            const key = `${userEmail}_${dateStr}`;
            userMealsData[key] = userAllMeals.filter(meal => 
              format(parseISO(meal.date || meal.created_date), 'yyyy-MM-dd') === dateStr
            );
          }
          
        } catch (userError) {
          console.error(`Failed to load meals for user ${userEmail}:`, userError);
          // Continue with other users even if one fails. Set empty array as fallback.
          for (const dateStr of uniqueDates) {
            const key = `${userEmail}_${dateStr}`;
            userMealsData[key] = []; 
          }
        }
      }
      
      setAllUserMeals(userMealsData);
      console.log('Successfully loaded all user meals for detailed view.');
      
    } catch (error) {
      console.error('Error loading all user meals:', error);
    } finally {
      setIsLoadingAllMeals(false);
    }
  }, [sharedMeals, isLoadingAllMeals]);

  // Effect to load initial data (users, shared meals, water photos)
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Effect to load all user meals when sharedMeals is populated, with a debounce
  useEffect(() => {
    if (sharedMeals.length > 0 && !isLoadingAllMeals) {
      // Add a small delay before loading all meals to avoid immediate rate limiting
      const timer = setTimeout(() => {
        loadAllUserMeals();
      }, 1000); 
      
      return () => clearTimeout(timer);
    }
  }, [sharedMeals, loadAllUserMeals, isLoadingAllMeals]);

  // Calculate daily calorie summary for a specific date and user (including all meals, not just shared)
  const getDailySummary = useCallback((originalDateString, userEmail) => {
    const formattedDate = format(parseISO(originalDateString), 'yyyy-MM-dd'); // Ensure date is formatted consistently for key
    const key = `${userEmail}_${formattedDate}`;
    // Get ALL meals for this user on this date. If undefined, data might still be loading for this key.
    const allDayMeals = allUserMeals[key]; 
    
    // Filter shared meals (those with `shared_with_coach: true`) for the current date and user to count them
    const sharedDayMeals = sharedMeals.filter(meal => 
      format(parseISO(meal.date || meal.created_date), 'yyyy-MM-dd') === formattedDate && 
      meal.user_email === userEmail && meal.shared_with_coach
    );
    
    const totalCalories = (allDayMeals || []).reduce((sum, meal) => 
      sum + (parseFloat(meal.estimated_calories) || 0), 0
    );
    
    // Find user's calorie target from the 'users' state
    const user = users.find(u => u.email === userEmail);
    const calorieTarget = user?.calorie_target;

    // Determine if data for this specific user/date is still being loaded
    const isDataLoadingForDate = isLoadingAllMeals && allDayMeals === undefined;
    
    // Calculate newMealCount for shared meals that haven't been viewed
    const newMealCount = sharedDayMeals.filter(m => !m.viewed_by_coach).length;
    // Calculate mealsWithoutImageCount for shared meals without images
    const mealsWithoutImageCount = sharedDayMeals.filter(m => !m.meal_image || m.meal_image.trim() === '').length;

    return {
      totalCalories: Math.round(totalCalories),
      calorieTarget,
      percentage: calorieTarget && totalCalories > 0 ? Math.round((totalCalories / calorieTarget) * 100) : null,
      totalMealCount: (allDayMeals || []).length,
      sharedMealCount: sharedDayMeals.length,
      newMealCount: newMealCount,
      mealsWithoutImageCount: mealsWithoutImageCount, // New
      hasAlerts: newMealCount > 0 || mealsWithoutImageCount > 0, // New
      isDataLoading: isDataLoadingForDate 
    };
  }, [allUserMeals, users, sharedMeals, isLoadingAllMeals]);

  // Helper function to update all local states after a meal is deleted
  const updateLocalStatesAfterMealDeletion = useCallback((mealToDelete) => {
    const mealIdToDelete = mealToDelete.id;
    const userEmailToDelete = mealToDelete.user_email;
    const mealDateToDelete = mealToDelete.date || mealToDelete.created_date;

    // 1. Update sharedMeals (for general tracking and daily summary calculations)
    setSharedMeals(currentMeals => currentMeals.filter(m => m.id !== mealIdToDelete));

    // 2. Update allUserMeals (detailed daily view)
    setAllUserMeals(currentAllMeals => {
        const newAllUserMeals = { ...currentAllMeals };
        const formattedDate = format(parseISO(mealDateToDelete), 'yyyy-MM-dd');
        const key = `${userEmailToDelete}_${formattedDate}`;
        if (newAllUserMeals[key]) {
            newAllUserMeals[key] = newAllUserMeals[key].filter(meal => meal.id !== mealIdToDelete);
        }
        return newAllUserMeals;
    });

    // 3. Update groupedMedia (main album grid)
    setGroupedMedia(prevGroupedMedia => {
        const updatedGroups = prevGroupedMedia.map(group => {
            if (group.user.email === userEmailToDelete) {
                const updatedMeals = group.meals.filter(m => m.id !== mealIdToDelete);
                const hasUnreadMeals = updatedMeals.some(m => !m.viewed_by_coach);
                const hasUnreadWater = group.waterPhotos.some(w => !w.viewed_by_coach);
                return {
                    ...group,
                    meals: updatedMeals,
                    hasUnread: hasUnreadMeals || hasUnreadWater
                };
            }
            return group;
        }).filter(group => group.meals.length > 0 || group.waterPhotos.length > 0); // Remove group if no media left
        return updatedGroups;
    });

    // 4. Update selectedUserAlbum (currently open album view)
    setSelectedUserAlbum(prevAlbum => {
        if (prevAlbum && prevAlbum.user.email === userEmailToDelete) {
            const updatedMeals = prevAlbum.meals.filter(m => m.id !== mealIdToDelete);
            const hasUnreadMeals = updatedMeals.some(m => !m.viewed_by_coach);
            const hasUnreadWater = prevAlbum.waterPhotos.some(w => !w.viewed_by_coach);
            return {
                ...prevAlbum,
                meals: updatedMeals,
                hasUnread: hasUnreadMeals || hasUnreadWater
            };
        }
        return prevAlbum;
    });
  }, []);

  const handleDeleteMeal = async (meal) => {
    if (!meal || !meal.id) {
      console.warn('Cannot delete meal: invalid meal object');
      return;
    }

    if (deletingMealId === meal.id) {
      return; // Prevent double-clicking
    }

    const userName = users.find(u => u.email === meal.user_email)?.name || meal.user_email;
    const confirmDelete = window.confirm(
      `האם אתה בטוח שברצונך למחוק את הארוחה "${meal.meal_description || 'לא צוין'}" של ${userName}? לא ניתן לשחזר פעולה זו.`
    );

    if (!confirmDelete) return;

    setDeletingMealId(meal.id);
    try {
      await withRetry(() => CalorieTracking.delete(meal.id));
      
      // Update local state immediately to remove the meal from UI
      updateLocalStatesAfterMealDeletion(meal);
      
      console.log('Meal deleted successfully');
      
    } catch (error) {
      console.error('Failed to delete meal:', error);
      
      const isNotFound = error.message?.includes('Object not found') || (error.response && error.response.status === 404);
      if (isNotFound) {
        // Object was already deleted on the server, just remove from local state
        updateLocalStatesAfterMealDeletion(meal);
        console.log('Meal was already deleted on server, removed from local state.');
        alert('הארוחה כבר נמחקה מהשרת.');
      } else if (error.message?.includes('500') || (error.response && error.response.status >= 500)) {
        alert('שגיאת שרת במחיקת הארוחה. אנא נסה שוב מאוחר יותר.');
      } else {
        alert('שגיאה במחיקת הארוחה. אנא נסה שוב.');
      }
    } finally {
      setDeletingMealId(null);
    }
  };

  const handleOpenAlbum = async (userGroup) => {
    setSelectedUserAlbum(userGroup);
    setIsAlbumOpen(true);
    
    // Auto-expand the first date if there are meals for this user in allUserMeals
    // We need to find the first date that this user had a meal on.
    const userEmailsForAlbum = [userGroup.user.email]; // This album is for a single user
    const datesWithMealsForUser = Object.keys(allUserMeals).filter(key => 
        key.startsWith(userGroup.user.email) && (allUserMeals[key] || []).length > 0 // Ensure allUserMeals[key] is not null/undefined
    ).map(key => key && typeof key === 'string' ? key.split('_')[1] : null).filter(Boolean).sort((a,b) => new Date(b) - new Date(a)); // sort descending

    if (datesWithMealsForUser.length > 0) {
      const firstDateString = datesWithMealsForUser[0]; // e.g., "2023-10-26"
      setExpandedDate(firstDateString); // Use actual date string for expansion state
    } else {
      setExpandedDate(null); // No meals for this user
    }

    if (!userGroup.hasUnread) return;

    // Optimistically update hasUnread status in main grid
    setGroupedMedia(prevGroups =>
      prevGroups.map(g =>
        g.user.email === userGroup.user.email ? { ...g, hasUnread: false } : g
      )
    );
    // Optimistically update hasUnread status in selected album
    setSelectedUserAlbum(prevAlbum =>
      prevAlbum && prevAlbum.user.email === userGroup.user.email ? { ...prevAlbum, hasUnread: false } : prevAlbum
    );

    try {
      const unreadMeals = userGroup.meals.filter(meal => !meal.viewed_by_coach);
      const unreadWaterPhotos = userGroup.waterPhotos.filter(w => !w.viewed_by_coach);

      // Batch updates with retry for robustness
      const mealUpdatePromises = unreadMeals.map(meal => {
        const payload = { viewed_by_coach: true };
        return withRetry(() => CalorieTracking.update(meal.id, payload));
      });
      const waterUpdatePromises = unreadWaterPhotos.map(water => {
        const payload = { viewed_by_coach: true };
        return withRetry(() => WaterTracking.update(water.id, payload));
      });

      // Use Promise.allSettled to allow some updates to fail without stopping others
      const results = await Promise.allSettled([...mealUpdatePromises, ...waterUpdatePromises]);

      const successfullyUpdatedMealIds = [];
      const successfullyUpdatedWaterIds = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (index < unreadMeals.length) { // It's a meal update
            successfullyUpdatedMealIds.push(unreadMeals[index].id);
          } else { // It's a water update
            successfullyUpdatedWaterIds.push(unreadWaterPhotos[index - unreadMeals.length].id);
          }
        } else {
          console.warn("Failed to mark media as viewed:", result.reason);
        }
      });

      // Update states only for successfully viewed items
      if (successfullyUpdatedMealIds.length > 0) {
        setSharedMeals(currentMeals =>
          currentMeals.map(meal => {
            if (successfullyUpdatedMealIds.includes(meal.id)) {
              return { ...meal, viewed_by_coach: true };
            }
            return meal;
          })
        );
        // Also update allUserMeals
        setAllUserMeals(prevAllUserMeals => {
            const newAllUserMeals = { ...prevAllUserMeals };
            for (const key in newAllUserMeals) {
                newAllUserMeals[key] = newAllUserMeals[key].map(meal => {
                    if (successfullyUpdatedMealIds.includes(meal.id)) {
                        return { ...meal, viewed_by_coach: true };
                    }
                    return meal;
                });
            }
            return newAllUserMeals;
        });
      }
      // If any media failed to update, hasUnread might still be true.
      // Re-evaluate hasUnread status for the selected album after potential updates.
      // This is handled by a separate re-evaluation based on the updated `sharedMeals` and `water` states implicitly or explicitly.
      // For selectedUserAlbum, we explicitly update it below.

    } catch(err) {
      console.error("General error marking media as viewed:", err);
      // If marking fails, re-load to reflect actual state
      loadData(); 
    }
  };

  // New function to handle date header clicks within the album dialog
  const handleDateHeaderClick = async (dateString, userEmailForDate) => { // dateString is 'yyyy-MM-dd'
    const isExpanding = expandedDate !== dateString;

    if (isExpanding) {
        // When expanding a date, find all unread meals for that date and mark them as viewed
        const unreadMealsOnDate = sharedMeals.filter(
            meal => format(parseISO(meal.date || meal.created_date), 'yyyy-MM-dd') === dateString &&
                    meal.user_email === userEmailForDate &&
                    meal.shared_with_coach &&
                    !meal.viewed_by_coach
        );

        if (unreadMealsOnDate.length > 0) {
            try {
                // Batch updates with retry for robustness
                const updatePromises = unreadMealsOnDate.map(meal => 
                    withRetry(() => CalorieTracking.update(meal.id, { viewed_by_coach: true }))
                );
                // Use Promise.allSettled to allow some updates to fail without stopping others
                const results = await Promise.allSettled(updatePromises);
                
                // Check results and update local state only for successful updates
                const successfullyUpdatedIds = [];
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        successfullyUpdatedIds.push(unreadMealsOnDate[index].id);
                    } else {
                        console.warn(`Failed to mark meal ${unreadMealsOnDate[index].id} as viewed on date expand:`, result.reason);
                    }
                });
                
                // Update local state for successfully updated meals
                if (successfullyUpdatedIds.length > 0) {
                    setSharedMeals(currentMeals => 
                        currentMeals.map(meal => {
                            if (successfullyUpdatedIds.includes(meal.id)) {
                                return { ...meal, viewed_by_coach: true };
                            }
                            return meal;
                        })
                    );

                    setAllUserMeals(prevAllUserMeals => {
                      const newAllUserMeals = { ...prevAllUserMeals };
                      const key = `${userEmailForDate}_${dateString}`;
                      if (newAllUserMeals[key]) {
                        newAllUserMeals[key] = newAllUserMeals[key].map(meal => {
                          if (successfullyUpdatedIds.includes(meal.id)) {
                            return { ...meal, viewed_by_coach: true };
                          }
                          return meal;
                        });
                      }
                      return newAllUserMeals;
                    });

                    // Recalculate hasUnread for the selected album
                    // This will be implicitly handled if selectedUserAlbum is derived from sharedMeals
                    // or explicitly updated if selectedUserAlbum contains the actual meal objects
                    setSelectedUserAlbum(prevAlbum => {
                        if (!prevAlbum || prevAlbum.user.email !== userEmailForDate) return prevAlbum;
                        const updatedMeals = prevAlbum.meals.map(meal => {
                            if (successfullyUpdatedIds.includes(meal.id)) {
                                return { ...meal, viewed_by_coach: true };
                            }
                            return meal;
                        });
                        // Recalculate hasUnread for the album.
                        const anyUnreadMealInAlbum = updatedMeals.some(m => !m.viewed_by_coach);
                        const anyUnreadWaterInAlbum = prevAlbum.waterPhotos.some(w => !w.viewed_by_coach);
                        return {
                            ...prevAlbum,
                            meals: updatedMeals,
                            hasUnread: anyUnreadMealInAlbum || anyUnreadWaterInAlbum
                        };
                    });
                }

            } catch (error) {
                console.error("General error marking meals as viewed on date expand:", error);
                // Don't block UI from expanding even if API fails, but log the error.
            }
        }
    }
    
    // Finally, toggle the expansion state
    setExpandedDate(isExpanding ? dateString : null);
  };

  const handleImageClick = (imageUrl, mealDescription) => {
    setZoomedImage({ url: imageUrl, description: mealDescription });
  };

  // New handleSaveFeedback function incorporating new states
  const handleSaveFeedback = async (meal, textToSave) => {
    if (!textToSave?.trim()) {
      alert('אנא הזן משוב לפני השמירה');
      return;
    }

    setIsSubmittingFeedback(true);

    try {
      const payload = {
        coach_feedback: textToSave.trim(),
        coach_feedback_date: new Date().toISOString(),
        viewed_by_coach: true // Assume saving feedback means it's viewed
      };

      await withRetry(() => CalorieTracking.update(meal.id, payload));

      // Update groupedMedia (main album grid)
      setGroupedMedia(prevGroupedMedia => {
        return prevGroupedMedia.map(group => {
          if (group.user.email === meal.user_email) {
            const updatedMeals = group.meals.map(m =>
              m.id === meal.id
                ? { ...m, ...payload }
                : m
            );
            const hasUnreadMeals = updatedMeals.some(m => !m.viewed_by_coach);
            const hasUnreadWater = group.waterPhotos.some(w => !w.viewed_by_coach);
            return {
              ...group,
              meals: updatedMeals,
              hasUnread: hasUnreadMeals || hasUnreadWater
            };
          }
          return group;
        });
      });

      // Update sharedMeals state (important for getDailySummary, which relies on it)
      setSharedMeals(prevSharedMeals => prevSharedMeals.map(m => 
        m.id === meal.id ? { ...m, ...payload } : m
      ));

      // Update allUserMeals state (important for the detailed daily view)
      setAllUserMeals(prevAllUserMeals => {
        const newAllUserMeals = { ...prevAllUserMeals };
        for (const key in newAllUserMeals) {
          newAllUserMeals[key] = newAllUserMeals[key].map(m =>
            m.id === meal.id
              ? { ...m, ...payload }
              : m
          );
        }
        return newAllUserMeals;
      });

      // Update selectedUserAlbum (the currently open album)
      setSelectedUserAlbum(prevAlbum => {
        if (prevAlbum && prevAlbum.user.email === meal.user_email) {
          const updatedMeals = prevAlbum.meals.map(m =>
            m.id === meal.id
              ? { ...m, ...payload }
              : m
          );
           const hasUnreadMeals = updatedMeals.some(m => !m.viewed_by_coach);
           const hasUnreadWater = prevAlbum.waterPhotos.some(w => !w.viewed_by_coach); 
          return {
            ...prevAlbum,
            meals: updatedMeals,
            hasUnread: hasUnreadMeals || hasUnreadWater
          };
        }
        return prevAlbum;
      });

      // Clear the feedback text and exit editing mode
      setEditingFeedbackId(null);
      setFeedbackText('');

      // Send email notification to the user
      try {
        const trainee = users.find(u => u.email === meal.user_email);
        if (trainee) {
          const subject = `קיבלת משוב חדש מהמאמן שלך!`;
          const body = `
            <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
              <h3>שלום ${trainee.name || trainee.email},</h3>
              <p>המאמן/ת שלך צפה/תה בארוחה ששיתפת ושלח/ה לך משוב:</p>
              <div style="background-color: #f9f9f9; border: 1px solid #eee; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p><strong>ארוחה:</strong> ${meal.meal_type || 'לא צוין'}</p>
                <p><strong>תיאור:</strong> ${meal.meal_description || 'אין תיאור'}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;" />
                <p><strong>משוב מהמאמן/ת:</strong></p>
                <p style="font-style: italic;">"${textToSave.trim()}"</p>
              </div>
              <p>ניתן להיכנס לאפליקציה כדי לראות את המשוב המלא ולהמשיך לעקוב אחר ההתקדמות שלך.</p>
              <p>בברכה,</p>
              <p>צוות MUSCLE UP YAVNE</p>
            </div>
          `;
          // Create notification instead of sending email
          await CoachNotification.create({
            user_email: trainee.email,
            user_name: trainee.name || trainee.full_name || 'משתמש לא ידוע',
            coach_email: 'system', // System notification
            notification_type: 'meal_feedback',
            notification_title: subject,
            notification_message: `קיבלת משוב על הארוחה שלך: "${textToSave.trim()}"`,
            notification_details: {
              meal_type: meal.meal_type || 'לא צוין',
              meal_description: meal.meal_description || 'אין תיאור',
              feedback: textToSave.trim(),
              meal_date: meal.created_date
            },
            is_read: false,
            created_date: new Date().toISOString()
          });
          
          alert('המשוב נשמר והתראה נשלחה בהצלחה!');
        } else {
          alert('המשוב נשמר בהצלחה, אך לא ניתן לשלוח התראה למשתמש (משתמש לא נמצא).');
        }
      } catch (notificationError) {
        console.error("Failed to send feedback notification to user:", notificationError);
        alert('המשוב נשמר בהצלחה, אך אירעה שגיאה בשליחת התראה למשתמש.');
      }

    } catch (error) {
      console.error('Error saving feedback:', error);
      alert('שגיאה בשמירת המשוב');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Group all user meals (for the selected album) by date
  const groupedMealsForAlbum = useMemo(() => {
    if (!selectedUserAlbum || sharedMeals.length === 0 || Object.keys(allUserMeals).length === 0) {
      return [];
    }

    // Get all unique dates for the currently selected user from allUserMeals
    const userEmailInAlbum = selectedUserAlbum.user.email;
    
    const allDatesForUser = new Set();
    for (const key in allUserMeals) {
      if (key.startsWith(`${userEmailInAlbum}_`) && allUserMeals[key].length > 0) {
        if (key && typeof key === 'string') {
          const datePart = key.split('_')[1];
          if (datePart) {
            allDatesForUser.add(datePart); // Add date part (yyyy-MM-dd)
          }
        }
      }
    }

    const datesArray = Array.from(allDatesForUser).sort((a, b) => new Date(b) - new Date(a)); // Sort descending

    const grouped = datesArray.map(date => {
      const allMealsForDate = [];
      
      const key = `${userEmailInAlbum}_${date}`;
      const userAllMealsForDate = allUserMeals[key] || [];
      allMealsForDate.push(...userAllMealsForDate);
      
      // Sort meals by timestamp within the day
      allMealsForDate.sort((a, b) => new Date(a.meal_timestamp || a.created_date) - new Date(b.meal_timestamp || b.created_date));
      
      return {
        date: date, // yyyy-MM-dd
        displayDate: format(parseISO(date), 'EEEE, dd/MM/yyyy', { locale: he }),
        meals: allMealsForDate
      };
    });
    
    return grouped; // Already sorted by date in descending order
  }, [selectedUserAlbum, sharedMeals, allUserMeals]);


  if (isLoading) { // Show initial loading for all data
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        <p className="mr-4 text-slate-600">טוען נתונים...</p>
      </div>
    );
  }
  
  if (error) { // Display error message if initial load fails
    return (
      <Card className="muscle-glass">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="w-4 h-4 ml-2" />
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalPhotos = (group) => group.meals.length + group.waterPhotos.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main User Albums Grid - Mobile Optimized */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {groupedMedia.map((group) => (
          <Card key={group.user.email} className={`cursor-pointer hover:shadow-lg transition-all duration-300 bg-white ${group.hasUnread ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-500'}`}>
            <CardHeader className="p-4 sm:p-6 pb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {group.user.profile_image_url ? (
                    <img src={group.user.profile_image_url} alt={group.user.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
                    </div>
                  )}
                  {group.hasUnread && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <Bell className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg truncate">{group.user.name}</CardTitle>
                  <p className="text-xs sm:text-sm text-slate-500">{totalPhotos(group)} תמונות</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="flex justify-between items-center mb-3">
                <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                  🍽️ {group.meals.length} ארוחות
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                  💧 {group.waterPhotos.length} שתייה
                </Badge>
              </div>
              <Button 
                onClick={() => handleOpenAlbum(group)} 
                className="w-full text-sm"
                variant={group.hasUnread ? "default" : "outline"}
              >
                <Eye className="w-4 h-4 mr-2" />
                {group.hasUnread ? 'צפה בחדש' : 'צפה בתמונות'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {groupedMedia.length === 0 && !isLoading && !error && (
        <div className="text-center py-12 text-slate-500">
          <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-xl">אין תמונות משותפות</p>
        </div>
      )}

      {/* Enhanced Meal Details Dialog */}
      <Dialog open={isAlbumOpen} onOpenChange={setIsAlbumOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[95vh] overflow-hidden" dir="rtl">
          <DialogHeader className="p-4 sm:p-6 pb-4">
            <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
              <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700" />
              <span className="truncate">יומן ארוחות - {selectedUserAlbum?.user.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden px-4 sm:px-6">
            <Tabs defaultValue="meals" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-auto">
                <TabsTrigger value="meals" className="text-sm sm:text-base py-2">
                  🍽️ ארוחות ({groupedMealsForAlbum.reduce((acc, curr) => acc + curr.meals.length, 0)})
                </TabsTrigger>
                <TabsTrigger value="water" className="text-sm sm:text-base py-2">
                  💧 מים ({selectedUserAlbum?.waterPhotos.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="meals" className="flex-1 mt-0">
                <ScrollArea className="h-[60vh] sm:h-[70vh]">
                  <div className="space-y-4 pr-2">
                    {groupedMealsForAlbum && groupedMealsForAlbum.length > 0 ? (
                      groupedMealsForAlbum.map((dateGroup) => {
                        const displayDate = dateGroup.displayDate; // "יום ראשון, 01/01/2023"
                        const actualDate = dateGroup.date; // "2023-01-01"
                        const meals = dateGroup.meals; // All meals for this date for this user
                        const isExpanded = expandedDate === actualDate; // Compare with actualDate now
                        
                        // Get unique users for this date (will only be the selected user's email within a user's album)
                        // This logic is mostly for consistency with main grid structure, but here it will always be one user.
                        const dateUsers = [...new Set(meals.map(m => m.user_email))];

                        return (
                          <Card key={actualDate} className="overflow-hidden border shadow-sm">
                            <CardHeader 
                              className="flex flex-row items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                              // Use handleDateHeaderClick to mark meals as viewed and toggle expansion
                              onClick={() => handleDateHeaderClick(actualDate, selectedUserAlbum.user.email)}
                            >
                              <div className="flex flex-col gap-1 items-start">
                                <CardTitle className="text-sm sm:text-base text-slate-700">{displayDate}</CardTitle>
                                {/* Daily Summary Row */}
                                <div className="text-sm text-slate-600 mt-1">
                                  {dateUsers.map(userEmail => {
                                      if (!userEmail) return null;
                                      const user = users.find(u => u.email === userEmail);
                                      const userName = user?.name || (userEmail ? userEmail.split('@')[0] : 'משתמש לא ידוע');
                                      
                                      // Pass the actual date string from the dateGroup for summary calculation
                                      const summary = getDailySummary(actualDate, userEmail);
                                      
                                      return (
                                          <div key={userEmail} className="flex flex-wrap items-center gap-2 py-1">
                                              <span className="font-medium">{userName}:</span>
                                              {summary.hasAlerts && (
                                                <div className="flex items-center gap-1">
                                                  <Bell className="w-4 h-4 text-amber-500 animate-pulse" />
                                                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                                    {summary.newMealCount > 0 && summary.mealsWithoutImageCount > 0 
                                                      ? `${summary.newMealCount} חדשות, ${summary.mealsWithoutImageCount} ללא תמונה`
                                                      : summary.newMealCount > 0 
                                                        ? `${summary.newMealCount} ארוחות חדשות`
                                                        : `${summary.mealsWithoutImageCount} ללא תמונה`
                                                    }
                                                  </div>
                                                </div>
                                              )}
                                              <div className="flex flex-wrap items-center gap-3">
                                                  <span className="text-blue-600 font-semibold">
                                                  {/* Show loading state for calories if data is still being fetched */}
                                                  {summary.isDataLoading ? (
                                                    <div className="flex items-center gap-2">
                                                      <Loader2 className="w-3 h-3 animate-spin" />
                                                      <span className="text-xs">טוען...</span>
                                                    </div>
                                                  ) : (
                                                    `${summary.totalCalories.toLocaleString()} קק"ל`
                                                  )}
                                                </span>
                                                  {summary.calorieTarget ? (
                                                      <>
                                                          <span className="text-slate-400">מתוך</span>
                                                          <span className="text-green-600">
                                                              {summary.calorieTarget.toLocaleString()} קק"ל
                                                          </span>
                                                          {summary.percentage !== null && (
                                                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                summary.percentage >= 90 && summary.percentage <= 110 
                                                                    ? 'bg-green-100 text-green-700' 
                                                                    : summary.percentage < 90 
                                                                        ? 'bg-yellow-100 text-yellow-700'
                                                                        : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {summary.percentage}%
                                                            </div>
                                                          )}
                                                      </>
                                                  ) : (
                                                      <span className="text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded-full">
                                                          יעד טרם נקבע
                                                      </span>
                                                  )}
                                                  <span className="text-slate-400 text-xs">
                                                      ({summary.totalMealCount} ארוחות כולל, {summary.sharedMealCount} משותפות)
                                                  </span>
                                              </div>
                                          </div>
                                      );
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">{meals.length} ארוחות</Badge>
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                                </motion.div>
                              </div>
                            </CardHeader>
                            
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <CardContent className="p-3 sm:p-4 pt-0">
                                    <div className="space-y-6 border-t pt-4">
                                      {meals.map((meal, index) => {
                                        if (!meal || !meal.id) return null; // Skip invalid meals
                                        const hasNutritionData = meal.estimated_calories || meal.protein_grams || meal.carbs_grams || meal.fat_grams;
                                        const mealTypeIcons = {
                                          "ארוחת בוקר": "🍳",
                                          "ארוחת ביניים": "🥪", 
                                          "ארוחת צהריים": "🍽️",
                                          "ארוחת ערב": "🌃",
                                          "חטיף": "🍎",
                                          "אחר": "🍴"
                                        };
                                        const isShared = meal.shared_with_coach; // Determine if the meal was shared
                                        const isDeleting = deletingMealId === meal.id;

                                        return (
                                          <div key={meal.id} className={`bg-white rounded-lg border p-4 space-y-4 shadow-sm ${isShared ? 'border-blue-200' : 'border-gray-200'} ${isDeleting ? 'opacity-50' : ''}`}>
                                            {/* Enhanced Meal Header with Timestamp */}
                                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                                {/* Meal Image - Make clickable */}
                                                <div className="w-full sm:w-24 sm:h-24 flex-shrink-0">
                                                    {meal.meal_image ? (
                                                        <img 
                                                            src={meal.meal_image} 
                                                            alt={meal.meal_description || 'ארוחה'} 
                                                            className="w-full h-40 sm:w-full sm:h-full rounded-md object-cover shadow-sm border cursor-pointer hover:opacity-90 transition-opacity" 
                                                            onClick={() => handleImageClick(meal.meal_image, meal.meal_description || 'ארוחה')}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-40 sm:w-full sm:h-full flex items-center justify-center bg-slate-50 border rounded-md">
                                                            <ImageIcon className="w-8 h-8 text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Meal Details */}
                                                <div className="flex-1 space-y-3 w-full sm:w-auto">
                                                    {/* Meal Title & Type */}
                                                    <div>
                                                        <div className="flex justify-between items-start gap-2">
                                                          <div className="flex flex-wrap items-center gap-2 mb-2">
                                                              <span className="text-xl">{mealTypeIcons[meal.meal_type] || "🍴"}</span>
                                                              <h4 className="font-semibold text-lg text-slate-800">
                                                                  {meal.meal_type || 'ארוחה'}
                                                              </h4>
                                                              {meal.ai_assisted && (
                                                                  <Badge className="bg-purple-100 text-purple-700 text-xs">🤖 AI</Badge>
                                                              )}
                                                              <Badge variant={isShared ? "default" : "secondary"} className="text-xs">
                                                                {isShared ? "משותף" : "פרטי"}
                                                              </Badge>
                                                              {(!meal.meal_image || meal.meal_image.trim() === '') && (
                                                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                                                  ללא תמונה
                                                                </Badge>
                                                              )}
                                                          </div>
                                                          {isShared && ( 
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                                        <span className="sr-only">Open menu</span>
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleDeleteMeal(meal)}
                                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                                                        disabled={isDeleting}
                                                                    >
                                                                        <Trash2 className="ml-2 h-4 w-4" />
                                                                        <span>
                                                                          {isDeleting ? (
                                                                            <span className="flex items-center">
                                                                              <Loader2 className="w-4 h-4 animate-spin ml-2" />
                                                                              מוחק...
                                                                            </span>
                                                                          ) : (
                                                                            'מחק ארוחה'
                                                                          )}
                                                                        </span>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                          )}
                                                        </div>
                                                        
                                                        {/* Enhanced Date & Time Display */}
                                                        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-500 mb-3">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                                                {formatDate(meal.date || meal.created_date)}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                ⏰ רישום: {formatTime(meal.meal_timestamp || meal.created_date)}
                                                            </span>
                                                            <span className="text-slate-400">
                                                                ({getRelativeTime(meal.meal_timestamp || meal.created_date)})
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Meal Description */}
                                                        {meal.meal_description && (
                                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                                <h5 className="font-semibold text-amber-800 text-xs sm:text-sm mb-1">📋 תיאור הארוחה:</h5>
                                                                <p className="text-amber-700 text-xs sm:text-sm leading-relaxed">{meal.meal_description}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Enhanced Nutritional Information */}
                                                    {hasNutritionData && (
                                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                            <h5 className="font-semibold text-green-800 mb-3 text-sm flex items-center gap-2">
                                                                📊 פירוט תזונתי מפורט
                                                            </h5>
                                                            
                                                            {/* Main Nutrition Grid */}
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                                                {/* Calories */}
                                                                <div className="text-center bg-white rounded-lg p-3 border-l-4 border-red-400 shadow-sm">
                                                                    <div className="font-bold text-red-600 text-base sm:text-lg">
                                                                        {meal.estimated_calories || '0'}
                                                                    </div>
                                                                    <div className="text-xs text-red-500 font-medium">קלוריות</div>
                                                                    <div className="text-xs text-red-400">kcal</div>
                                                                </div>
                                                                
                                                                {/* Carbohydrates */}
                                                                <div className="text-center bg-white rounded-lg p-3 border-l-4 border-blue-400 shadow-sm">
                                                                    <div className="font-bold text-blue-600 text-base sm:text-lg">
                                                                        {meal.carbs_grams || '0'}
                                                                    </div>
                                                                    <div className="text-xs text-blue-500 font-medium">פחמימות</div>
                                                                    <div className="text-xs text-blue-400">גרם</div>
                                                                </div>
                                                                
                                                                {/* Protein */}
                                                                <div className="text-center bg-white rounded-lg p-3 border-l-4 border-orange-400 shadow-sm">
                                                                    <div className="font-bold text-orange-600 text-base sm:text-lg">
                                                                        {meal.protein_grams || '0'}
                                                                    </div>
                                                                    <div className="text-xs text-orange-500 font-medium">חלבון</div>
                                                                    <div className="text-xs text-orange-400">גרם</div>
                                                                </div>
                                                                
                                                                {/* Fat */}
                                                                <div className="text-center bg-white rounded-lg p-3 border-l-4 border-purple-400 shadow-sm">
                                                                    <div className="font-bold text-purple-600 text-base sm:text-lg">
                                                                        {meal.fat_grams || '0'}
                                                                    </div>
                                                                    <div className="text-xs text-purple-500 font-medium">שומן</div>
                                                                    <div className="text-xs text-purple-400">גרם</div>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Percentage Breakdown */}
                                                            {meal.estimated_calories && meal.estimated_calories > 0 && (meal.protein_grams || meal.carbs_grams || meal.fat_grams) && (
                                                                <div className="bg-white rounded-lg p-3 border border-green-200">
                                                                    <div className="text-xs text-green-700 mb-2 text-center font-medium">פירוט אחוזי מהקלוריות הכוללות</div>
                                                                    <div className="flex flex-wrap justify-center gap-3 text-xs">
                                                                        {meal.protein_grams && (
                                                                            <div className="flex items-center gap-1">
                                                                                <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                                                                                <span className="font-semibold text-orange-600">
                                                                                    חלבון: {Math.round((meal.protein_grams * 4 / meal.estimated_calories) * 100)}%
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {meal.carbs_grams && (
                                                                            <div className="flex items-center gap-1">
                                                                                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                                                                                <span className="font-semibold text-blue-600">
                                                                                    פחמימות: {Math.round((meal.carbs_grams * 4 / meal.estimated_calories) * 100)}%
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {meal.fat_grams && (
                                                                            <div className="flex items-center gap-1">
                                                                                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                                                                                <span className="font-semibold text-purple-600">
                                                                                    שומן: {Math.round((meal.fat_grams * 9 / meal.estimated_calories) * 100)}%
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Coach Notes */}
                                                    {meal.coach_note && (
                                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                            <h5 className="font-semibold text-amber-800 text-xs sm:text-sm mb-1">📝 הערה למאמן:</h5>
                                                            <p className="text-amber-700 text-xs sm:text-sm">{meal.coach_note}</p>
                                                        </div>
                                                    )}

                                                    {/* Coach Feedback Section */}
                                                    {isShared ? (
                                                      <div className="border-t pt-4">
                                                        <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                                          <MessageSquare className="w-4 h-4 text-blue-600" />
                                                          משוב מאמן
                                                        </h4>
                                                        
                                                        {meal.coach_feedback ? (
                                                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                                            <p className="text-blue-800 leading-relaxed">{meal.coach_feedback}</p>
                                                            <p className="text-xs text-blue-600 mt-2">
                                                              נשלח: {formatDateTime(meal.coach_feedback_date)}
                                                            </p>
                                                          </div>
                                                        ) : (
                                                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                                                            <p className="text-gray-600 text-sm">טרם ניתן משוב על הארוחה</p>
                                                          </div>
                                                        )}

                                                        <div className="space-y-2">
                                                          <Textarea
                                                            placeholder="כתוב כאן את המשוב שלך על הארוחה..."
                                                            value={editingFeedbackId === meal.id ? feedbackText : (meal.coach_feedback || '')}
                                                            onChange={(e) => {
                                                              setEditingFeedbackId(meal.id); // Ensure we're in editing mode
                                                              setFeedbackText(e.target.value);
                                                            }}
                                                            className="min-h-[80px]"
                                                            disabled={isSubmittingFeedback}
                                                          />
                                                          <div className="flex justify-end gap-2">
                                                            <Button
                                                              onClick={() => handleSaveFeedback(meal, feedbackText)}
                                                              disabled={isSubmittingFeedback || !feedbackText.trim()}
                                                              className="flex items-center gap-2"
                                                              size="sm"
                                                            >
                                                              {isSubmittingFeedback ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                              ) : (
                                                                <Send className="w-4 h-4" />
                                                              )}
                                                              {meal.coach_feedback ? 'עדכן משוב' : 'שלח משוב'}
                                                            </Button>
                                                            {editingFeedbackId === meal.id && (
                                                              <Button
                                                                variant="outline"
                                                                onClick={() => {
                                                                  setEditingFeedbackId(null);
                                                                  setFeedbackText('');
                                                                }}
                                                                size="sm"
                                                              >
                                                                בטל
                                                              </Button>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <div className="border-t pt-3 mt-3">
                                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                          <p className="text-amber-700 text-sm flex items-center gap-2">
                                                            <Eye className="w-4 h-4" />
                                                            ארוחה זו לא שותפה עם המאמן ולכן אין אפשרות למתן משוב
                                                          </p>
                                                        </div>
                                                      </div>
                                                    )}
                                                </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </CardContent>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Card>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <Utensils className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">
                          {isLoadingAllMeals ? "טוען נתוני ארוחות..." : "אין ארוחות זמינות למשתמש זה בתאריכים הרלוונטיים."}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="water" className="flex-1 mt-0">
                <ScrollArea className="h-[60vh] sm:h-[70vh]">
                  <div className="space-y-4 pr-2">
                    {selectedUserAlbum?.waterPhotos && selectedUserAlbum.waterPhotos.length > 0 ? (
                      selectedUserAlbum.waterPhotos.map(water => (
                        <Card key={water.id} className="p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                            <img 
                              src={water.photo_url} 
                              alt="שתיית מים" 
                              className="w-full sm:w-20 sm:h-20 h-32 rounded-lg object-cover cursor-pointer" 
                              onClick={() => handleImageClick(water.photo_url, "תמונת שתיית מים")}
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-sm sm:text-base">💧 {water.amount_ml}ml מים</p>
                              <p className="text-xs sm:text-sm text-slate-500">{formatDateTime(water.created_date)}</p>
                              {water.coach_note && (
                                <p className="text-xs sm:text-sm text-amber-700 bg-amber-50 p-2 rounded mt-2">{water.coach_note}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <Droplets className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">אין תמונות שתייה</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-4" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center mb-4">
              {zoomedImage?.description || 'תמונת ארוחה'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center">
            {zoomedImage && (
              <img
                src={zoomedImage.url}
                alt={zoomedImage.description}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                style={{ cursor: 'zoom-out' }}
                onClick={() => setZoomedImage(null)}
              />
            )}
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">
            לחץ על התמונה או מחוץ לדיאלוג לסגירה
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
