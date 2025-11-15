
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, WeightEntry, WeeklyTask, Workout, WaterTracking, CalorieTracking, ProgressPicture, WeightReminder, UserGroup } from '@/api/entities';
import { SendEmail } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, User as UserIcon, Scale, Activity, ClipboardList, MessageSquare, Calendar, ChevronLeft, ChevronRight, Share2, Cake, Percent, HeartPulse, Weight, Recycle, Ruler, Droplets, Zap, Target, PieChart, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Dumbbell, Clock, WifiOff, RefreshCw, Copy, X, Bell, CheckCircle, AlertCircle, ChevronsUpDown, Check
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, subDays, isBefore, isWithinInterval, startOfToday, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { formatDate, formatDateTime, getRelativeTime, formatDetailedDateTime } from '@/components/utils/timeUtils';
import UserTrackingTab from '@/components/admin/UserTrackingTab';


const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 border text-center">
    <Icon className={`w-6 h-6 mb-1 ${color || 'text-slate-600'}`} />
    <span className="text-lg font-bold text-slate-800">{value || 'N/A'}</span>
    <span className="text-xs text-slate-500">{label}</span>
  </div>
);

const BMICard = ({ bmi }) => {
  const getBMIInfo = (bmiValue) => {
    if (!bmiValue) return { category: 'לא זמין', color: 'text-gray-500', bgColor: 'bg-gray-100' };

    if (bmiValue < 18.5) {
      return { category: 'תת משקל', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    } else if (bmiValue >= 18.5 && bmiValue < 25) {
      return { category: 'משקל תקין', color: 'text-green-600', bgColor: 'bg-green-100' };
    } else if (bmiValue >= 25 && bmiValue < 30) {
      return { category: 'עודף משקל', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    } else {
      return { category: 'השמנה', color: 'text-red-600', bgColor: 'bg-red-100' };
    }
  };

  const bmiInfo = getBMIInfo(bmi);

  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center ${bmiInfo.bgColor}`}>
      <HeartPulse className={`w-6 h-6 mb-1 ${bmiInfo.color}`} />
      <span className={`text-lg font-bold ${bmi || 'N/A'}`}>
        {bmiInfo.category === 'משקל תקין' ? `${bmi} ✅` : bmi}
      </span>
      <span className="text-xs text-slate-500">BMI</span>
      <span className={`text-xs font-medium mt-1 ${bmiInfo.color}`}>{bmiInfo.category}</span>
    </div>
  );
};

// Helper functions for color coding
const getMetabolicAgeColor = (metabolicAge, userAge) => {
  if (!metabolicAge || !userAge) return 'bg-slate-50 text-slate-800'; // Default, no color code
  const diff = metabolicAge - userAge;
  if (diff <= 0) return 'bg-green-100 text-green-800'; // Younger or same
  if (diff <= 5) return 'bg-yellow-100 text-yellow-800'; // Slightly older
  return 'bg-red-100 text-red-800'; // Much older
};

const getBmiColor = (bmi) => {
  if (!bmi) return 'bg-slate-50 text-slate-800'; // Default, no color code
  if (bmi < 18.5) return 'bg-blue-100 text-blue-800'; // Underweight
  if (bmi < 25) return 'bg-green-100 text-green-800'; // Normal
  if (bmi < 30) return 'bg-yellow-100 text-yellow-800'; // Overweight
  if (bmi < 35) return 'bg-orange-100 text-orange-800'; // Obese I
  return 'bg-red-100 text-red-800'; // Obese II+
};

const getFatPercentageColor = (fatPercentage) => {
  // Note: This is a very generic scale as gender is not available.
  // Assuming healthy range is lower for general guidance.
  if (!fatPercentage) return 'bg-slate-50 text-slate-800'; // Default, no color code
  if (fatPercentage < 20) return 'bg-green-100 text-green-800'; // Good
  if (fatPercentage < 30) return 'bg-yellow-100 text-yellow-800'; // Moderate
  return 'bg-red-100 text-red-800'; // High
};

const getVisceralFatColor = (visceralFat) => {
  if (!visceralFat) return 'bg-slate-50 text-slate-800'; // Default, no color code
  if (visceralFat < 10) return 'bg-green-100 text-green-800'; // Healthy
  if (visceralFat < 15) return 'bg-yellow-100 text-yellow-800'; // Warning
  return 'bg-red-100 text-red-800'; // High
};

const PAGE_SIZE = 10; // This is now the batch size for infinite scroll

export default function UserManagement({ initialUserEmail, startInEditMode, adminUser }) {
  const [users, setUsers] = useState([]); // This will hold all processed users (including admins, before filtering for display)
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [boosterFilter, setBoosterFilter] = useState('all');
  const [weightChangeFilter, setWeightChangeFilter] = useState('all');
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState(null); // Renamed from loadError as per existing code
  const [networkError, setNetworkError] = useState(false);
  const [remindersSent, setRemindersSent] = useState({});

  const [showTrackingTab, setShowTrackingTab] = useState(false);
  const [trackingUser, setTrackingUser] = useState(null);

  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const [expandedUsers, setExpandedUsers] = useState(new Set());

  // Infinite scroll states
  const [visibleUsersCount, setVisibleUsersCount] = useState(PAGE_SIZE); // How many filtered users are currently rendered

  // Reset visibleUsersCount when filters or search term changes
  useEffect(() => {
    setVisibleUsersCount(PAGE_SIZE);
  }, [searchTerm, selectedGroup, statusFilter, boosterFilter, weightChangeFilter]);


  const displayValue = useCallback((value, unit = '') => {
    if (value === null || value === undefined || value === '' || isNaN(value)) {
      return 'N/A';
    }
    if (unit) {
      return `${value} ${unit}`;
    }
    return value;
  }, []);

  const handleNetworkError = useCallback((err) => {
    console.error("Network error:", err);
    setNetworkError(true);
    setError("שגיאת רשת - בדוק חיבור לאינטרנט");
  }, []);

  const findLatestAvailableValue = useCallback((measurements, fieldName) => {
    if (!measurements || measurements.length === 0) return null;

    for (const measurement of measurements) {
      const value = measurement[fieldName];
      if (value !== null && value !== undefined && value !== '') {
        return {
          value: value,
          date: measurement.date || measurement.created_date,
          measurementId: measurement.id
        };
      }
    }
    return null;
  }, []);

  const syncUserWithLatestMeasurements = useCallback((user, userWeights) => {
    if (!userWeights || userWeights.length === 0) {
      const syncedUser = { ...user };
      syncedUser.measurementSync = {};

      if (user.initial_weight && user.height && !user.bmi) {
        const heightInMeters = typeof user.height === 'string' ? parseFloat(user.height) : user.height;
        const weightInKg = typeof user.initial_weight === 'string' ? parseFloat(user.initial_weight) : user.initial_weight;

        if (!isNaN(heightInMeters) && !isNaN(weightInKg) && heightInMeters > 0 && weightInKg > 0) {
          syncedUser.bmi = Math.round((weightInKg / (heightInMeters * heightInMeters)) * 10) / 10;
          syncedUser.weight = weightInKg;
          syncedUser.current_weight = weightInKg;
        }
      }
      return syncedUser;
    }

    const sortedMeasurements = [...userWeights].sort((a, b) =>
      new Date(b.date || b.created_date) - new Date(a.date || a.created_date)
    );

    const syncedUser = { ...user };
    syncedUser.measurementSync = {};

    const measurementFields = [
      'weight',
      'height',
      'bmi',
      'metabolic_age',
      'visceral_fat',
      'muscle_mass',
      'fat_percentage',
      'body_water_percentage',
      'physique_rating',
      'bmr',
      'chest_circumference',
      'waist_circumference',
      'hip_circumference',
      'glutes_circumference',
      'neck_circumference',
      'bicep_circumference_right',
      'bicep_circumference_left',
      'thigh_circumference_right',
      'thigh_circumference_left',
      'calf_circumference_right',
      'calf_circumference_left'
    ];

    measurementFields.forEach(fieldName => {
      const latestValue = findLatestAvailableValue(sortedMeasurements, fieldName);

      if (latestValue) {
        if (fieldName === 'weight') {
          syncedUser.current_weight = latestValue.value;
          syncedUser.weight = latestValue.value;
        } else if (fieldName === 'hip_circumference' && !latestValue.value && findLatestAvailableValue(sortedMeasurements, 'glutes_circumference')?.value) {
            const glutesValue = findLatestAvailableValue(sortedMeasurements, 'glutes_circumference');
            syncedUser.hip_circumference = glutesValue.value;
            syncedUser.measurementSync.hip_circumference = {
                value: glutesValue.value,
                syncedFromDate: glutesValue.date,
                syncedFromMeasurementId: glutesValue.measurementId,
                syncedAt: new Date().toISOString()
            };
        } else if (fieldName === 'glutes_circumference' && !latestValue.value && findLatestAvailableValue(sortedMeasurements, 'hip_circumference')?.value) {
            const hipValue = findLatestAvailableValue(sortedMeasurements, 'hip_circumference');
            syncedUser.glutes_circumference = hipValue.value;
            syncedUser.measurementSync.glutes_circumference = {
                value: hipValue.value,
                syncedFromDate: hipValue.date,
                syncedFromMeasurementId: hipValue.measurementId,
                syncedAt: new Date().toISOString()
            };
        }
        else {
          syncedUser[fieldName] = latestValue.value;
        }

        if (!syncedUser.measurementSync[fieldName]) {
            syncedUser.measurementSync[fieldName] = {
                value: latestValue.value,
                syncedFromDate: latestValue.date,
                syncedFromMeasurementId: latestValue.measurementId,
                syncedAt: new Date().toISOString()
            };
        }
      }
    });

    if (!syncedUser.bmi) {
      let weightForBMI = syncedUser.weight || syncedUser.current_weight || syncedUser.initial_weight;
      let heightForBMI = syncedUser.height;

      if (typeof weightForBMI === 'string') weightForBMI = parseFloat(weightForBMI);
      if (typeof heightForBMI === 'string') heightForBMI = parseFloat(heightForBMI);

      if (!isNaN(weightForBMI) && !isNaN(heightForBMI) && weightForBMI > 0 && heightForBMI > 0) {
        syncedUser.bmi = Math.round((weightForBMI / (heightForBMI * heightForBMI)) * 10) / 10;

        if (!syncedUser.measurementSync.bmi) {
            syncedUser.measurementSync.bmi = {
                value: syncedUser.bmi,
                syncedFromDate: syncedUser.measurementSync.weight?.syncedFromDate || new Date().toISOString(),
                syncedFromMeasurementId: 'calculated_fallback',
                syncedAt: new Date().toISOString()
            };
        }
      }
    }

    if (!syncedUser.age && syncedUser.birth_date) {
      const birthDate = new Date(syncedUser.birth_date);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();
      if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      syncedUser.age = calculatedAge;
    }

    syncedUser.latestMeasurement = sortedMeasurements[0] || null;

    return syncedUser;
  }, [findLatestAvailableValue]);

  const getWeightChangeStatus = useCallback((user) => {
    if (!user.allWeights || user.allWeights.length < 2) {
      return { status: '—', changeType: 'stable', text: 'ללא שינוי', color: 'text-gray-500' };
    }

    const latestWeight = parseFloat(user.allWeights[0].weight);
    const previousWeight = parseFloat(user.allWeights[1].weight);

    if (isNaN(latestWeight) || isNaN(previousWeight)) {
        return { status: '—', changeType: 'stable', text: 'מידע חסר', color: 'text-gray-500' };
    }

    const change = latestWeight - previousWeight;
    
    if (Math.abs(change) < 0.1) {
      return { status: '—', changeType: 'stable', text: 'ללא שינוי', color: 'text-gray-500' };
    } else {
      const displayChange = Math.abs(change).toFixed(1);
      if (change > 0) {
        return { status: '⬆', changeType: 'gain', text: `עלייה של ${displayChange} ק"ג`, color: 'text-red-600' };
      } else {
        return { status: '⬇', changeType: 'loss', text: `ירידה של ${displayChange} ק"ג`, color: 'text-green-600' };
      }
    }
  }, []);

  const getLastWeighInDate = useCallback((user) => {
    const lastWeightDate = user.measurementSync?.weight?.syncedFromDate || user.latestMeasurement?.date || user.latestMeasurement?.created_date;
    if (!lastWeightDate) return 'לא עודכן';
    return `שקילה אחרונה: ${formatDate(lastWeightDate)}`;
  }, []);

  const toggleUserExpansion = useCallback((userId) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setNetworkError(false);
    setError(null);

    try {
      const [allUsers, allGroupsData] = await Promise.all([
        User.list().catch(e => { console.warn("Failed to load users:", e); return []; }), // Fetches all users, including admins
        UserGroup.list().catch(e => { console.warn("Failed to load user groups:", e); return []; })
      ]);
      
      setGroups(allGroupsData || []);

      if (!allUsers || allUsers.length === 0) {
        setUsers([]);
        setIsLoading(false);
        return;
      }

      const userEmails = allUsers.map(u => u.email);

      let allWeightEntries = [];
      let allWorkoutEntries = [];

      try {
        allWeightEntries = await WeightEntry.filter({ user_email: { $in: userEmails } }, '-created_date');
      } catch (weightError) {
        console.warn("Failed to load weight entries:", weightError);
        if (weightError.message?.includes('Network Error') || !navigator.onLine) {
          handleNetworkError(weightError);
          setIsLoading(false);
          return;
        }
      }

      try {
        allWorkoutEntries = await Workout.filter({ created_by: { $in: userEmails } }, '-date');
      } catch (workoutError) {
        console.warn("Failed to load workout entries:", workoutError);
        if (workoutError.message?.includes('Network Error') || !navigator.onLine) {
          handleNetworkError(workoutError);
          setIsLoading(false);
          return;
        }
      }

      const usersWithData = allUsers.map(user => {
        const userWeights = allWeightEntries.filter(w => w.user_email === user.email);
        const userWorkouts = allWorkoutEntries.filter(wo => wo.created_by === user.email);

        const syncedUser = syncUserWithLatestMeasurements(user, userWeights);

        return {
          ...syncedUser,
          allWeights: userWeights,
          recentWeights: userWeights.slice(0, 2),
          recentWorkouts: userWorkouts.filter(w =>
            isWithinInterval(parseISO(w.date), { start: subDays(new Date(), 60), end: new Date() })
          ),
        };
      }).sort((a, b) => {
        const lastWeightDateA = a.measurementSync?.weight?.syncedFromDate || a.latestMeasurement?.date || a.latestMeasurement?.created_date;
        const lastWeightDateB = b.measurementSync?.weight?.syncedFromDate || b.latestMeasurement?.date || b.latestMeasurement?.created_date;
        
        if (!lastWeightDateA && !lastWeightDateB) {
          const nameA = a.name || a.email || '';
          const nameB = b.name || b.email || '';
          return nameA.localeCompare(nameB);
        }
        if (!lastWeightDateA) return -1;
        if (!lastWeightDateB) return 1;
        
        return new Date(lastWeightDateA) - new Date(lastWeightDateB);
      });

      setUsers(usersWithData); // This state now holds all processed users, including admins
    } catch (err) {
      console.error("Error loading users:", err);
      if (err.message?.includes('Network Error') || !navigator.onLine) {
        handleNetworkError(err);
      } else {
        setError("שגיאה בטעינת נתוני משתמשים");
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleNetworkError, syncUserWithLatestMeasurements]);

  useEffect(() => {
    loadData();
  }, [loadData, lastRefresh]);

  useEffect(() => {
    if (initialUserEmail && users.length > 0) {
        const userToSelect = users.find(u => u.email === initialUserEmail);
        if (userToSelect) {
            handleSelectUser(userToSelect);
        }
    }
  }, [initialUserEmail, users]);

  const retryLoad = useCallback(() => {
    setNetworkError(false);
    setError(null);
    loadData();
  }, [loadData]);

  const forceRefresh = useCallback(() => {
    setLastRefresh(Date.now());
    loadData();
  }, [loadData]);

  useEffect(() => {
    window.refreshUserManagement = forceRefresh;
    return () => {
      delete window.refreshUserManagement;
    };
  }, [forceRefresh]);

  const loadUserDetails = useCallback(async (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    setIsLoadingDetails(true);
    setError(null);

    try {
      const [userWeights, userWorkouts, userTasks, waterLogs, calorieEntries, progressPictures] = await Promise.all([
        WeightEntry.filter({ user_email: user.email }, '-created_date').catch(e => { console.warn("Failed to load user weights:", e); return []; }),
        Workout.filter({ created_by: user.email }, '-date').catch(e => { console.warn("Failed to load user workouts:", e); return []; }),
        WeeklyTask.filter({ user_email: user.email }, 'week').catch(e => { console.warn("Failed to load weekly tasks:", e); return []; }),
        WaterTracking.filter({ user_email: user.email }, '-date').catch(e => { console.warn("Failed to load water logs:", e); return []; }),
        CalorieTracking.filter({ user_email: user.email }, '-date').catch(e => { console.warn("Failed to load calorie entries:", e); return []; }),
        ProgressPicture.filter({ user_email: user.email }, '-photo_date').catch(e => { console.warn("Failed to load progress pictures:", e); return []; })
      ]);

      const syncedUserDetails = syncUserWithLatestMeasurements(user, userWeights);

      setSelectedUserDetails({
        ...syncedUserDetails,
        allWeights: userWeights,
        allWorkouts: userWorkouts,
        allTasks: userTasks,
        waterLogs: waterLogs,
        calorieEntries: calorieEntries,
        progressPictures: progressPictures
      });
    } catch (error) {
      console.error("שגיאה בטעינת פרטי משתמש:", error);
      setError("שגיאה בטעינת פרטי המשתמש.");
      setSelectedUserDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [syncUserWithLatestMeasurements]);


  const handleShare = useCallback(() => {
    if (!selectedUserDetails) return;

    const getBMICategory = (bmi) => {
      if (!bmi) return 'לא זמין';
      if (bmi < 18.5) return 'תת משקל';
      if (bmi >= 18.5 && bmi < 25) return 'משקל תקין ✅';
      if (bmi >= 25 && bmi < 30) return 'עודף משקל ⚠️';
      return 'השמנה 🔴';
    };

    const glutesCircumference = selectedUserDetails.glutes_circumference || selectedUserDetails.hip_circumference;

    const overviewText = `
📊 סקירת התקדמות עבור ${selectedUserDetails.name} 📊

🎂 גיל: ${displayValue(selectedUserDetails.age)}
⚡ גיל מטבולי: ${displayValue(selectedUserDetails.metabolic_age)}
📏 גובה: ${selectedUserDetails.height ? `${(selectedUserDetails.height * 100).toFixed(0)} ס"מ` : 'לא צוין'}
📈 משקל התחלתי: ${displayValue(selectedUserDetails.initial_weight, 'ק"ג')}
⚖️ משקל נוכחי: ${displayValue(selectedUserDetails.weight, 'ק"ג')}
🔥 אחוז שומן: ${displayValue(selectedUserDetails.fat_percentage, '%')}
💪 מסת שריר: ${displayValue(selectedUserDetails.muscle_mass, 'ק"ג')}
💖 BMI: ${displayValue(selectedUserDetails.bmi)} (${getBMICategory(selectedUserDetails.bmi)})
🌊 אחוז מים: ${displayValue(selectedUserDetails.body_water_percentage, '%')}
⚠️ שומן ויסצרלי: ${displayValue(selectedUserDetails.visceral_fat)}
⭐ דירוג מבנה גוף: ${selectedUserDetails.physique_rating ? `${selectedUserDetails.physique_rating}/9` : 'לא צוין'}
⚡ BMR: ${selectedUserDetails.bmr ? `${selectedUserDetails.bmr} קל'` : 'לא צוין'}

📐 מדידות גוף:
• חזה: ${displayValue(selectedUserDetails.chest_circumference, 'ס"מ')}
• מותן: ${displayValue(selectedUserDetails.waist_circumference, 'ס"מ')}
• ישבן: ${displayValue(glutesCircumference, 'ס"מ')}

#MuscleUpYavne #Progress #FitnessJourney #HealthyLifestyle
    `;

    navigator.clipboard.writeText(overviewText.trim());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [selectedUserDetails, displayValue]);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white';
      case 'inactive': return 'bg-red-500 text-white';
      case 'on_hold': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }, []);

  const calculateProgressIndicators = useCallback((user, userWeights, userWorkouts) => {
    const indicators = {
      weight: { value: null, trend: 'stable', change: 0, color: 'text-gray-500' },
      workouts: { value: null, trend: 'stable', change: 0, count: 0, color: 'text-gray-500' },
      activity: { value: null, trend: 'stable', change: 0, status: 'לא נראה', color: 'text-gray-500' }
    };

    if (userWeights && userWeights.length >= 2) {
      const latestWeight = parseFloat(userWeights[0].weight);
      const previousWeight = parseFloat(userWeights[1].weight);
      const change = latestWeight - previousWeight;

      indicators.weight = {
        value: latestWeight,
        trend: change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable',
        change: Math.abs(change).toFixed(1),
        color: change > 0.1 ? 'text-red-500' : change < -0.1 ? 'text-green-500' : 'text-blue-500'
      };
    } else if (userWeights && userWeights.length === 1) {
      indicators.weight = {
        value: userWeights[0].weight,
        trend: 'stable',
        change: 0,
        color: 'text-blue-500'
      };
    }

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixtyDaysAgo = subDays(now, 60);

    const filteredUserWorkouts = Array.isArray(userWorkouts) ? userWorkouts : [];

    const recentWorkoutsCount = filteredUserWorkouts.filter(w => parseISO(w.date) >= thirtyDaysAgo).length;
    const previousWorkoutsCount = filteredUserWorkouts.filter(w => {
      const workoutDate = parseISO(w.date);
      return workoutDate >= sixtyDaysAgo && workoutDate < thirtyDaysAgo;
    }).length;

    const workoutChange = recentWorkoutsCount - previousWorkoutsCount;
    indicators.workouts = {
      value: recentWorkoutsCount,
      count: recentWorkoutsCount,
      trend: workoutChange > 0 ? 'up' : workoutChange < 0 ? 'down' : 'stable',
      change: Math.abs(workoutChange),
      color: workoutChange > 0 ? 'text-green-500' : workoutChange < 0 ? 'text-red-500' : 'text-blue-500'
    };

    if (user.last_seen_date) {
      const daysSinceLastSeen = differenceInDays(now, parseISO(user.last_seen_date));
      let statusText = '';
      let activityColor = 'text-gray-500';

      if (daysSinceLastSeen <= 3) {
        statusText = 'פעיל מאוד';
        activityColor = 'text-green-500';
      } else if (daysSinceLastSeen <= 7) {
        statusText = 'פעיל';
        activityColor = 'text-orange-500';
      } else if (daysSinceLastSeen <= 30) {
        statusText = `לפני ${daysSinceLastSeen} ימים`;
        activityColor = 'text-red-500';
      } else {
        statusText = `לפני ${daysSinceLastSeen} ימים (לא פעיל)`;
        activityColor = 'text-red-700';
      }

      indicators.activity = {
        value: daysSinceLastSeen,
        trend: daysSinceLastSeen <= 3 ? 'up' : daysSinceLastSeen <= 7 ? 'stable' : 'down',
        change: daysSinceLastSeen,
        status: statusText,
        color: activityColor
      };
    } else {
      indicators.activity = {
        value: null,
        trend: 'down',
        change: null,
        status: 'לא נראה',
        color: 'text-gray-500'
      };
    }

    return indicators;
  }, []);

  const getTrendIcon = useCallback((trend, size = 'w-4 h-4') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className={`${size} text-green-500`} />;
      case 'down':
        return <TrendingDown className={`${size} text-red-500`} />;
      default:
        return <Minus className={`${size} text-gray-400`} />;
    }
  }, []);

  const getTrendColor = useCallback((trend) => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  }, []);

  const handleSelectUser = useCallback((user) => {
    setTrackingUser(user);
    setShowTrackingTab(true);
  }, []);

  const handleSendReminder = useCallback(async (user) => {
    try {
      const lastWeightDate = user.measurementSync?.weight?.syncedFromDate;
      const daysSinceLastUpdate = lastWeightDate ? differenceInDays(new Date(), new Date(lastWeightDate)) : 0;

      await WeightReminder.create({
        user_email: user.email,
        message: 'המאמן/ת מבקש/ת לעדכן את המשקל שלך.',
        reminder_date: new Date().toISOString(),
        days_since_last_update: daysSinceLastUpdate
      });
      await SendEmail({
          to: user.email,
          subject: "תזכורת: עדכון משקל",
          body: `
            <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
              <h2>היי ${user.name},</h2>
              <p>המאמן/ת שלך מבקש/ת ממך לעדכן את המשקל שלך באפליקציה.</p>
              <p>עדכון קבוע עוזר לנו לעקוב אחר ההתקדמות שלך בצורה הטובה ביותר.</p>
              <p>תודה!</p>
              <p>צוות MuscleUp</p>
            </div>
          `
      });

      setRemindersSent(prev => ({...prev, [user.id]: true}));
    } catch(err) {
      console.error("Failed to send weight reminder:", err);
      alert("שגיאה בשליחת התזכורת.");
    }
  }, []);

  const generateUserReport = useCallback((user) => {
    const isExpanded = expandedUsers.has(user.id);
    const weightChange = getWeightChangeStatus(user);
    const lastWeighIn = getLastWeighInDate(user);
    
    const lastWeightDate = user.measurementSync?.weight?.syncedFromDate;
    const daysSinceLastWeightUpdate = lastWeightDate ? differenceInDays(new Date(), new Date(lastWeightDate)) : null;
    const isReminderSent = remindersSent[user.id];

    const getWarningLevel = () => {
      if (daysSinceLastWeightUpdate === null) return 'critical';
      if (daysSinceLastWeightUpdate > 14) return 'critical';
      if (daysSinceLastWeightUpdate >= 6) return 'warning';
      return 'normal';
    };

    const warningLevel = getWarningLevel();

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`rounded-xl shadow-md border overflow-hidden ${
          warningLevel === 'critical' ? 'bg-red-50 border-red-300 shadow-red-200' :
          warningLevel === 'warning' ? 'bg-orange-50 border-orange-300 shadow-orange-200' :
          'bg-white border-slate-200'
        }`}
        style={{ direction: 'rtl' }}
      >
        <div 
          className={`p-3 sm:p-4 cursor-pointer transition-colors ${
            warningLevel === 'critical' ? 'hover:bg-red-100' :
            warningLevel === 'warning' ? 'hover:bg-orange-100' :
            'hover:bg-slate-50'
          }`}
          onClick={() => toggleUserExpansion(user.id)}
        >
          <div className="block sm:hidden space-y-3" style={{ direction: 'rtl', textAlign: 'right' }}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-base">{user.name}</h3>
                {user.role === 'admin' && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs font-medium">
                    מנהל
                  </Badge>
                )}
                {warningLevel === 'critical' && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-xs font-medium">דחוף!</span>
                  </div>
                )}
                {warningLevel === 'warning' && (
                  <div className="flex items-center gap-1 text-orange-600">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-xs font-medium">נדרש</span>
                  </div>
                )}
              </div>
              <ChevronLeft 
                className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              />
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className={`flex items-center gap-1 font-medium ${weightChange.color}`}>
                <span className="text-base">{weightChange.status}</span>
                <span className="hidden sm:inline">{weightChange.text}</span>
                <span className="sm:hidden">
                  {weightChange.status !== '—' ? `${Math.abs(parseFloat(weightChange.text.match(/[\d.]+/)?.[0] || '0')).toFixed(1)} ק"ג` : '—'}
                </span>
              </div>
              <div className={`text-xs flex items-center gap-1 ${
                warningLevel === 'critical' ? 'text-red-600 font-semibold' :
                warningLevel === 'warning' ? 'text-orange-600 font-semibold' :
                'text-slate-500'
              }`}>
                <Scale className="w-3 h-3" />
                <span>{lastWeighIn}</span>
                {daysSinceLastWeightUpdate && daysSinceLastWeightUpdate >= 6 && (
                  <span className="font-bold">
                    ({daysSinceLastWeightUpdate}ד')
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Badge className={`${getStatusColor(user.status)} text-xs px-2 py-1`}>
                {user.status || 'פעיל'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectUser(user);
                }}
                className="text-xs px-2 py-1 h-7"
              >
                <Activity className="w-3 h-3 ml-1" />
                מעקב
              </Button>
            </div>
          </div>

          <div className="hidden sm:flex items-center justify-between" style={{ direction: 'rtl', textAlign: 'right' }}>
            <div className="flex items-center gap-2">
              <ChevronLeft 
                className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              />
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-lg">{user.name}</h3>
                {user.role === 'admin' && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs font-medium">
                    מנהל מערכת
                  </Badge>
                )}
                {warningLevel === 'critical' && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">דחוף!</span>
                  </div>
                )}
                {warningLevel === 'warning' && (
                  <div className="flex items-center gap-1 text-orange-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">נדרש עדכון</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`flex items-center gap-1 text-sm font-medium ${weightChange.color}`}>
              <span className="text-lg">{weightChange.status}</span>
              <span>{weightChange.text}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`text-xs flex items-center gap-1 ${
                warningLevel === 'critical' ? 'text-red-600 font-semibold' :
                warningLevel === 'warning' ? 'text-orange-600 font-semibold' :
                'text-slate-500'
              }`}>
                <Scale className="w-3 h-3" />
                <span>{lastWeighIn}</span>
                {daysSinceLastWeightUpdate && daysSinceLastWeightUpdate >= 6 && (
                  <span className="font-bold">
                    ({daysSinceLastWeightUpdate} ימים)
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(user.status)}>
                  {user.status || 'פעיל'}
                </Badge>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectUser(user);
                  }}
                  className="text-xs"
                >
                  <Activity className="w-3 h-3 ml-1" />
                  מעקב
                </Button>
              </div>
            </div>
          </div>

          {warningLevel === 'critical' && (
            <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-red-800 text-sm font-medium">
                  {daysSinceLastWeightUpdate ? `${daysSinceLastWeightUpdate} ימים ללא עדכון!` : 'אין נתוני משקל!'}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendReminder(user);
                }}
                disabled={isReminderSent}
                className="text-xs border-red-300 text-red-700 hover:bg-red-50 w-full sm:w-auto"
              >
                {isReminderSent ? (
                  <>
                    <CheckCircle className="w-3 h-3 ml-1" />
                    נשלח
                  </>
                ) : (
                  <>
                    <Bell className="w-3 h-3 ml-1" />
                    <span className="hidden sm:inline">שלח תזכורת דחופה</span>
                    <span className="sm:hidden">תזכורת</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {warningLevel === 'warning' && (
            <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-orange-800 text-sm font-medium">
                  לא עודכן {daysSinceLastWeightUpdate} ימים - מומלץ לעדכן
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendReminder(user);
                }}
                disabled={isReminderSent}
                className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50 w-full sm:w-auto"
              >
                {isReminderSent ? (
                  <>
                    <CheckCircle className="w-3 h-3 ml-1" />
                    נשלח
                  </>
                ) : (
                  <>
                    <Bell className="w-3 h-3 ml-1" />
                    <span className="hidden sm:inline">שלח תזכורת</span>
                    <span className="sm:hidden">תזכורת</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-slate-200"
              style={{ direction: 'rtl' }}
            >
              <div className="p-3 sm:p-6 space-y-4 sm:space-y-6" style={{ textAlign: 'right' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">אימייל</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">מאמן</p>
                    <p className="font-medium">{user.coach_name || 'לא מוגדר'}</p>
                  </div>
                  {Array.isArray(user.group_names) && user.group_names.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-500">קבוצות</p>
                      <p className="font-medium">{user.group_names.join(', ')}</p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-slate-700 mb-3">נתונים פיזיים</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
                    <div className="text-center p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-500 block text-xs">גיל</span>
                      <div className="font-semibold text-lg">{displayValue(user.age)}</div>
                    </div>
                    
                    <div className={`text-center p-2 rounded-lg transition-colors duration-300 ${getMetabolicAgeColor(user.metabolic_age, user.age)}`}>
                      <span className="opacity-80 block text-xs">גיל מטבולי</span>
                      <div className="font-semibold text-lg">{displayValue(user.metabolic_age)}</div>
                    </div>
                    
                    <div className="text-center p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-500 block text-xs">משקל נוכחי</span>
                      <div className="font-semibold text-lg">{displayValue(user.current_weight, 'ק"ג')}</div>
                    </div>

                    <div className={`text-center p-2 rounded-lg transition-colors duration-300 ${getBmiColor(user.bmi)}`}>
                      <span className="opacity-80 block text-xs">BMI</span>
                      <div className="font-semibold text-lg">{displayValue(user.bmi)}</div>
                    </div>

                    <div className={`text-center p-2 rounded-lg transition-colors duration-300 ${getVisceralFatColor(user.visceral_fat)}`}>
                      <span className="opacity-80 block text-xs">שומן ויסצרלי</span>
                      <div className="font-semibold text-lg">{displayValue(user.visceral_fat)}</div>
                    </div>

                    <div className="text-center p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-500 block text-xs">מסת שריר</span>
                      <div className="font-semibold text-lg">{displayValue(user.muscle_mass, 'ק"ג')}</div>
                    </div>
                  </div>
                </div>

                {(user.chest_circumference || user.waist_circumference || user.glutes_circumference || user.hip_circumference || user.neck_circumference || user.bicep_circumference_right || user.bicep_circumference_left || user.thigh_circumference_right || user.thigh_circumference_left || user.calf_circumference_right || user.calf_circumference_left) && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-slate-700 mb-3">מדידות היקפים</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
                      {user.neck_circumference && (
                        <div className="text-center p-2 rounded-lg bg-blue-50">
                          <span className="text-blue-600 block text-xs">צוואר</span>
                          <div className="font-semibold text-lg text-blue-800">{displayValue(user.neck_circumference, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.chest_circumference && (
                        <div className="text-center p-2 rounded-lg bg-green-50">
                          <span className="text-green-600 block text-xs">חזה</span>
                          <div className="font-semibold text-lg text-green-800">{displayValue(user.chest_circumference, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.waist_circumference && (
                        <div className="text-center p-2 rounded-lg bg-orange-50">
                          <span className="text-orange-600 block text-xs">מותן</span>
                          <div className="font-semibold text-lg text-orange-800">{displayValue(user.waist_circumference, 'ס"מ')}</div>
                        </div>
                      )}
                      {(user.glutes_circumference || user.hip_circumference) && (
                        <div className="text-center p-2 rounded-lg bg-purple-50">
                          <span className="text-purple-600 block text-xs">ישבן</span>
                          <div className="font-semibold text-lg text-purple-800">{displayValue(user.glutes_circumference || user.hip_circumference, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.bicep_circumference_right && (
                        <div className="text-center p-2 rounded-lg bg-red-50">
                          <span className="text-red-600 block text-xs">יד ימין</span>
                          <div className="font-semibold text-lg text-red-800">{displayValue(user.bicep_circumference_right, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.bicep_circumference_left && (
                        <div className="text-center p-2 rounded-lg bg-pink-50">
                          <span className="text-pink-600 block text-xs">יד שמאל</span>
                          <div className="font-semibold text-lg text-pink-800">{displayValue(user.bicep_circumference_left, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.thigh_circumference_right && (
                        <div className="text-center p-2 rounded-lg bg-indigo-50">
                          <span className="text-indigo-600 block text-xs">ירך ימין</span>
                          <div className="font-semibold text-lg text-indigo-800">{displayValue(user.thigh_circumference_right, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.thigh_circumference_left && (
                        <div className="text-center p-2 rounded-lg bg-teal-50">
                          <span className="text-teal-600 block text-xs">ירך שמאל</span>
                          <div className="font-semibold text-lg text-teal-800">{displayValue(user.thigh_circumference_left, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.calf_circumference_right && (
                        <div className="text-center p-2 rounded-lg bg-cyan-50">
                          <span className="text-cyan-600 block text-xs">שוק ימין</span>
                          <div className="font-semibold text-lg text-cyan-800">{displayValue(user.calf_circumference_right, 'ס"מ')}</div>
                        </div>
                      )}
                      {user.calf_circumference_left && (
                        <div className="text-center p-2 rounded-lg bg-emerald-50">
                          <span className="text-emerald-600 block text-xs">שוק שמאל</span>
                          <div className="font-semibold text-lg text-emerald-800">{displayValue(user.calf_circumference_left, 'ס"מ')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {user.measurementSync && Object.keys(user.measurementSync).length > 0 && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    נתונים מעודכנים מיומן המדידות
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectUser(user);
                    }}
                    className="flex-1 text-xs min-w-[120px]"
                  >
                    <Activity className="w-3 h-3 ml-1" />
                    מעקב מתקדם
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadUserDetails(user);
                    }}
                    className="flex-1 text-xs min-w-[120px]"
                  >
                    <Calendar className="w-3 h-3 ml-1" />
                    היסטוריית פעילות
                  </Button>
                </div>

                {user.recentWorkouts && user.recentWorkouts.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">פעילות אחרונה</h4>
                    <div className="flex flex-wrap gap-2">
                      {user.recentWorkouts.slice(0, 3).map((workout, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {formatDate(workout.date)} - {workout.workout_type || 'אימון'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }, [
    expandedUsers, 
    getWeightChangeStatus, 
    getLastWeighInDate, 
    remindersSent, 
    handleSendReminder, 
    getStatusColor, 
    handleSelectUser, 
    loadUserDetails, 
    displayValue, 
    toggleUserExpansion
  ]);

  const validUsers = useMemo(() => users.filter(u => u && typeof u === 'object' && u.email), [users]);

  // Filter and sort users for display
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(validUsers)) return [];

    return validUsers.filter(user => {
      // Exclude admins/coaches and the current admin user from the displayed list
      if ((user.role === 'admin' || user.role === 'coach') || user.email === adminUser?.email) {
        return false;
      }

      const userName = user.name || user.full_name || '';
      const userEmail = user.email || '';

      const matchesSearch = searchTerm === '' ||
        (typeof userName === 'string' && userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (typeof userEmail === 'string' && userEmail.toLowerCase().includes(searchTerm.toLowerCase()));

      const groupMatch = selectedGroup === 'all' || (Array.isArray(user.group_names) && user.group_names.includes(selectedGroup));

      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      const matchesBooster = boosterFilter === 'all' ||
        (boosterFilter === 'enabled' && user.booster_enabled) ||
        (boosterFilter === 'disabled' && !user.booster_enabled);

      const weightChange = getWeightChangeStatus(user);
      const matchesWeightChange =
        weightChangeFilter === 'all' || weightChange.changeType === weightChangeFilter;
        
      return matchesSearch && groupMatch && matchesStatus && matchesBooster && matchesWeightChange;
    });
  }, [validUsers, searchTerm, selectedGroup, statusFilter, boosterFilter, weightChangeFilter, getWeightChangeStatus, adminUser]);

  // Infinite scroll: display only a portion of filtered users
  const displayedUsers = useMemo(() => {
    return filteredUsers.slice(0, visibleUsersCount);
  }, [filteredUsers, visibleUsersCount]);

  // Intersection Observer for infinite scroll
  const observer = useRef();
  const lastUserElementRef = useCallback(node => {
    if (isLoading) return; 
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayedUsers.length < filteredUsers.length) {
        // Load more users
        setVisibleUsersCount(prevCount => prevCount + PAGE_SIZE);
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoading, displayedUsers.length, filteredUsers.length]);


  if (networkError) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="text-center py-8">
          <WifiOff className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold text-red-600 mb-2">שגיאת חיבור</h3>
          <p className="text-gray-600 mb-4">לא ניתן להתחבר לשרת. בדוק את החיבור לאינטרנט.</p>
          <Button onClick={retryLoad} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="mr-2 text-slate-600">טוען נתוני משתמשים...</span>
      </div>
    );
  }

  if (error && !isModalOpen) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="text-center py-8">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          <h3 className="text-lg font-semibold text-amber-600 mb-2">שגיאה</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={retryLoad} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">ניהול מתאמנים ({filteredUsers.length})</CardTitle>
          <CardDescription className="text-sm">לחץ על שם המתאמן לצפייה בפרטים ופעילות אחרונה.</CardDescription>
          <div className="flex flex-col gap-2 mt-2 md:flex-row md:flex-wrap">
            <input
              type="text"
              placeholder="חיפוש לפי שם או אימייל..."
              value={searchTerm}
              onChange={(e) => {setSearchTerm(e.target.value);}} // visibleUsersCount reset handled by useEffect
              className="flex-grow p-2 border rounded-md text-sm min-w-[200px]" 
              style={{ direction: 'rtl', textAlign: 'right' }}
            />
            <Select value={selectedGroup} onValueChange={(value) => {setSelectedGroup(value);}}> {/* visibleUsersCount reset handled by useEffect */}
              <SelectTrigger className="w-full md:w-[220px] min-w-[150px]">
                <SelectValue placeholder="סינון לפי קבוצה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקבוצות</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.name}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => {setStatusFilter(value);}}> {/* visibleUsersCount reset handled by useEffect */}
              <SelectTrigger className="w-full md:w-[220px] min-w-[150px]">
                <SelectValue placeholder="סינון לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
                <SelectItem value="on_hold">בהמתנה</SelectItem>
              </SelectContent>
            </Select>
            <Select value={boosterFilter} onValueChange={(value) => {setBoosterFilter(value);}}> {/* visibleUsersCount reset handled by useEffect */}
              <SelectTrigger className="w-full md:w-[220px] min-w-[150px]">
                <SelectValue placeholder="סינון לפי בוסטר" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המשתמשים</SelectItem>
                <SelectItem value="enabled">בוסטר מופעל</SelectItem>
                <SelectItem value="disabled">בוסטר לא מופעל</SelectItem>
              </SelectContent>
            </Select>
            <Select value={weightChangeFilter} onValueChange={(value) => {setWeightChangeFilter(value);}}> {/* visibleUsersCount reset handled by useEffect */}
              <SelectTrigger className="w-full md:w-[220px] min-w-[150px]">
                <SelectValue placeholder="סינון לפי שינוי משקל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הצג הכל</SelectItem>
                <SelectItem value="gain">עלייה במשקל</SelectItem>
                <SelectItem value="loss">ירידה במשקל</SelectItem>
                <SelectItem value="stable">משקל יציב</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh] bg-slate-50">
            <div className="space-y-4 p-4">
              {displayedUsers.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <p>לא נמצאו מתאמנים התואמים את המסננים.</p>
                </div>
              ) : (
                displayedUsers.map((user, index) => {
                  const isLastElement = displayedUsers.length === index + 1;
                  return (
                    <div ref={isLastElement ? lastUserElementRef : null} key={user.id}>
                      {generateUserReport(user)}
                    </div>
                  );
                })
              )}
              {displayedUsers.length < filteredUsers.length && (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="mr-2 text-slate-600">טוען עוד...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showTrackingTab} onOpenChange={setShowTrackingTab}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">מעקב התקדמות</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowTrackingTab(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh]">
            {trackingUser && (
              <UserTrackingTab user={trackingUser} />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={(isOpen) => { setIsModalOpen(isOpen); if (!isOpen) { setIsCopied(false); setSelectedUserDetails(null); setSelectedUser(null); setError(null); } }}>
        <DialogContent className="max-w-3xl" dir="rtl">
          {selectedUser && (
            <DialogHeader className="pb-3">
              <DialogTitle className="text-xl text-slate-800">פרטי מתאמן: {selectedUser.name}</DialogTitle>
            </DialogHeader>
          )}
          <ScrollArea className="max-h-[calc(90vh-100px)] pr-4">
            <div className="py-2">
              {isLoadingDetails ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : error ? (
                <p className="text-red-500 text-center">{error}</p>
              ) : !selectedUserDetails ? (
                <p className="text-slate-500 text-center">לא נבחרו פרטי מתאמן או שגיאה בטעינה.</p>
              ) : (
                <Tabs defaultValue="activity" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="activity" className="text-sm">פעילות אחרונה</TabsTrigger>
                    <TabsTrigger value="overview" className="text-sm">סקירה כללית</TabsTrigger>
                  </TabsList>
                  <TabsContent value="activity" className="mt-4">
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Scale className="text-green-600 w-4 h-4" /> מעקב משקל
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3 text-center">
                          {(() => {
                            const currentWeightEntry = selectedUserDetails.allWeights[0];
                            const sevenDaysAgo = subDays(new Date(), 7);
                            const lastWeekEntry = selectedUserDetails.allWeights.find(entry => isBefore(parseISO(entry.date || entry.created_date), sevenDaysAgo));
                            return (
                              <>
                                <div>
                                  <p className="text-xs text-slate-500">משקל שבוע שעבר</p>
                                  <p className="text-lg font-bold text-slate-800">{displayValue(lastWeekEntry?.weight)}</p>
                                  {lastWeekEntry && <p className="text-xs text-slate-400">{formatDate(lastWeekEntry.date || lastWeekEntry.created_date)}</p>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">משקל נוכחי</p>
                                  <p className="text-lg font-bold text-green-600">{displayValue(currentWeightEntry?.weight)}</p>
                                  {currentWeightEntry && <p className="text-xs text-slate-400">{formatDate(currentWeightEntry.date || currentWeightEntry.created_date)}</p>}
                                </div>
                              </>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <ClipboardList className="text-purple-600 w-4 h-4" /> סטטוס משימה שבועית
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const today = startOfToday();
                            const currentTask = selectedUserDetails.allTasks.find(task => {
                              try {
                                return isWithinInterval(today, { start: parseISO(task.week_start_date), end: parseISO(task.week_end_date) });
                              } catch { return false; }
                            });
                            return currentTask ? (
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-sm">{currentTask.title}</p>
                                <Badge variant={
                                  currentTask.status === 'הושלם' ? 'default' :
                                    currentTask.status === 'בעבודה' ? 'secondary' : 'outline'
                                } className={`text-xs ${
                                  currentTask.status === 'הושלם' ? 'bg-green-100 text-green-800' :
                                    currentTask.status === 'בעבודה' ? 'bg-yellow-100 text-yellow-800' : ''
                                }`}>
                                  {currentTask.status}
                                </Badge>
                              </div>
                            ) : (
                               <p className="text-slate-500 text-center text-sm">אין משימה פעילה לשבוע זה.</p>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <MessageSquare className="text-amber-600 w-4 h-4" /> הערות מתוכנית הבוסטר
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-32 p-2 bg-slate-50 rounded-md border">
                            {(() => {
                              const allNotes = selectedUserDetails.allTasks
                                ?.flatMap(task => (task.notes_thread || []).map(note => ({ ...note, week: task.week, title: task.title })))
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) || [];
                              return allNotes.length > 0 ? (
                                <div className="space-y-3">
                                  {allNotes.map((note, index) => (
                                    <div key={index}>
                                      <p className="text-slate-800 text-sm">"{note.text}"</p>
                                      <p className="text-xs text-slate-500 mt-1">מתוך שבוע {note.week}: {note.title} &bull; {getRelativeTime(note.timestamp)}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 text-center pt-8 text-sm">לא נמצאו הערות.</p>
                              );
                            })()}
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  <TabsContent value="overview" className="mt-4">
                      <Card>
                          <CardHeader className="pb-3">
                              <CardTitle className="text-base">סקירת נתונים פיזיים מפורטת</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <div>
                                  <h3 className="text-sm font-semibold mb-2 text-slate-700">מידע בסיסי</h3>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <StatCard icon={Cake} label="גיל" value={displayValue(selectedUserDetails?.age)} />
                                      <StatCard icon={Recycle} label="גיל מטבולי" value={displayValue(selectedUserDetails?.metabolic_age)} color="text-teal-500" />
                                      <StatCard icon={Ruler} label="גובה" value={selectedUserDetails?.height ? displayValue((selectedUserDetails.height * 100).toFixed(0), 'ס"מ') : null} color="text-indigo-500" />
                                      <StatCard icon={Target} label="דירוג מבנה גוף" value={selectedUserDetails?.physique_rating ? `${selectedUserDetails.physique_rating}/9` : null} color="text-purple-500" />
                                  </div>
                              </div>

                              <div>
                                  <h3 className="text-sm font-semibold mb-2 text-slate-700">משקל והרכב גוף</h3>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <StatCard icon={Weight} label="משקל התחלתי" value={displayValue(selectedUserDetails?.initial_weight, 'ק"ג')} color="text-blue-500" />
                                      <StatCard icon={Weight} label="משקל נוכחי" value={displayValue(selectedUserDetails?.weight, 'ק"ג')} color="text-green-500" />
                                      <StatCard icon={PieChart} label="אחוז שומן" value={displayValue(selectedUserDetails?.fat_percentage, '%')} color="text-orange-500" />
                                      <StatCard icon={Dumbbell} label="מסת שריר" value={displayValue(selectedUserDetails?.muscle_mass, 'ק"ג')} color="text-purple-500" />
                                  </div>
                              </div>

                              <div>
                                  <h3 className="text-sm font-semibold mb-2 text-slate-700">מדדים בריאותיים</h3>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <BMICard bmi={selectedUserDetails?.bmi} />
                                      <StatCard icon={Droplets} label="אחוז מים" value={displayValue(selectedUserDetails?.body_water_percentage, '%')} color="text-cyan-500" />
                                      <StatCard icon={AlertTriangle} label="שומן ויסצרלי" value={displayValue(selectedUserDetails?.visceral_fat)} color="text-red-500" />
                                      <StatCard icon={Zap} label="BMR" value={displayValue(selectedUserDetails?.bmr, 'קל\'')} color="text-yellow-500" />
                                  </div>
                              </div>

                              {(selectedUserDetails?.chest_circumference || selectedUserDetails?.waist_circumference || selectedUserDetails?.glutes_circumference || selectedUserDetails?.hip_circumference || selectedUserDetails?.neck_circumference || selectedUserDetails?.bicep_circumference_right || selectedUserDetails?.thigh_circumference_right || selectedUserDetails?.thigh_circumference_left || selectedUserDetails?.calf_circumference_right) && (
                                  <div>
                                      <h3 className="text-sm font-semibold mb-2 text-slate-700">מדידות גוף</h3>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                          {selectedUserDetails.chest_circumference && (
                                              <StatCard icon={Activity} label="חזה" value={displayValue(selectedUserDetails.chest_circumference, 'ס"מ')} color="text-blue-500" />
                                          )}
                                          {selectedUserDetails.waist_circumference && (
                                              <StatCard icon={Target} label="מותן" value={displayValue(selectedUserDetails.waist_circumference, 'ס"מ')} color="text-orange-500" />
                                          )}
                                          {(selectedUserDetails.glutes_circumference || selectedUserDetails.hip_circumference) && (
                                              <StatCard icon={Activity} label="ישבן" value={displayValue(selectedUserDetails.glutes_circumference || selectedUserDetails.hip_circumference, 'ס"מ')} color="text-purple-500" />
                                          )}
                                          {selectedUserDetails.neck_circumference && (
                                              <StatCard icon={Ruler} label="צוואר" value={displayValue(selectedUserDetails.neck_circumference, 'ס"מ')} color="text-gray-500" />
                                          )}
                                          {selectedUserDetails.bicep_circumference_right && (
                                              <StatCard icon={Dumbbell} label="יד ימין" value={displayValue(selectedUserDetails.bicep_circumference_right, 'ס"מ')} color="text-green-500" />
                                          )}
                                          {selectedUserDetails.bicep_circumference_left && (
                                              <StatCard icon={Dumbbell} label="יד שמאל" value={displayValue(selectedUserDetails.bicep_circumference_left, 'ס"מ')} color="text-red-500" />
                                          )}
                                          {selectedUserDetails.thigh_circumference_right && (
                                              <StatCard icon={Dumbbell} label="ירך ימין" value={displayValue(selectedUserDetails.thigh_circumference_right, 'ס"מ')} color="text-green-500" />
                                          )}
                                          {selectedUserDetails.thigh_circumference_left && (
                                              <StatCard icon={Dumbbell} label="ירך שמאל" value={displayValue(selectedUserDetails.thigh_circumference_left, 'ס"מ')} color="text-red-500" />
                                          )}
                                          {selectedUserDetails.calf_circumference_right && (
                                              <StatCard icon={Dumbbell} label="שוק ימין" value={displayValue(selectedUserDetails.calf_circumference_right, 'ס"מ')} color="text-green-500" />
                                          )}
                                          {selectedUserDetails.calf_circumference_left && (
                                              <StatCard icon={Dumbbell} label="שוק שמאל" value={displayValue(selectedUserDetails.calf_circumference_left, 'ס"מ')} color="text-red-500" />
                                          )}
                                      </div>
                                  </div>
                              )}

                              <Button onClick={handleShare} className="w-full muscle-primary-gradient text-white text-sm flex items-center gap-2">
                                  <Share2 className="w-4 h-4" />
                                  {isCopied ? 'הועתק לחח!' : 'העתק נתונים מפורטים לשיתוף'}
                              </Button>
                               <p className="text-xs text-center text-slate-500">
                                  לחיצה על הכפתור תעתיק את כל הנתונים המפורטים. תוכלו להדביק אותם בפוסט באינסטגרם.
                              </p>
                          </CardContent>
                      </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
