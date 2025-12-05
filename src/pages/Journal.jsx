
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User, Workout, WorkoutLog, PreMadeWorkout, ExerciseDefault, ExerciseDefinition } from "@/api/entities"; // Added ExerciseDefault and ExerciseDefinition
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, Check, Plus, Clock, CheckCircle, Trash2, Flame, Dumbbell, Calendar, Pencil, History, Eye, Info, Loader2, FileText, MessageSquare, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { he } from 'date-fns/locale';
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDate, getCurrentDateString } from "@/components/utils/timeUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


import NetworkErrorDisplay from "../components/errors/NetworkErrorDisplay";
import WorkoutPartCard from '../components/workout/WorkoutPartCard';


// Helper function to add unique keys to exercises if they don't have one
const ensureExerciseKeys = (exercises) => {
    // Use a Map to track keys to ensure they are truly unique within this list
    const keyMap = new Map();
    return (exercises || []).map((ex, index) => {
        // If a key already exists and is unique, keep it.
        // If not, or if it's a duplicate, generate a new one.
        if (ex.key && !keyMap.has(ex.key)) {
            keyMap.set(ex.key, true);
            return ex;
        }
        // Generate a new, truly unique key for this session
        // Using Date.now() + index provides high probability of uniqueness even for quick re-renders
        const newKey = `${ex.name || 'ex'}_${Date.now()}_${index}`;
        keyMap.set(newKey, true); // Mark this new key as used
        return { ...ex, key: newKey };
    });
};

// Helper function to enrich exercises with ExerciseDefinition data (including images)
const enrichExercisesWithDefinitions = async (exercises, exerciseDefinitionsMap) => {
    if (!exercises || exercises.length === 0) return exercises;
    
    return exercises.map(exercise => {
        // If exercise already has image data, return as is
        if (exercise.exercisedb_image_url || exercise.video_url) {
            return exercise;
        }
        
        // Try to get definition data from map using definitionId
        if (exercise.definitionId && exerciseDefinitionsMap.has(exercise.definitionId)) {
            const definition = exerciseDefinitionsMap.get(exercise.definitionId);
            return {
                ...exercise,
                exercisedb_image_url: definition.exercisedb_image_url,
                video_url: exercise.video_url || definition.video_url,
                category: exercise.category || definition.category,
                muscle_group: exercise.muscle_group || definition.muscle_group,
                equipment: exercise.equipment || definition.equipment,
            };
        }
        
        return exercise;
    });
};

// Helper function to check if a workout is structured with parts
const isPartedWorkout = (workout) => {
    return (workout.part_1_exercises?.length > 0 ||
            workout.part_2_exercises?.length > 0 ||
            workout.part_3_exercises?.length > 0);
};

export default function JournalPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const [isLoading, setIsLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(false);

  const [completedWorkouts, setCompletedWorkouts] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  const loadWorkouts = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setNetworkError(false);
    setRateLimitError(false);

    try {
      const currentUser = await User.me();
      setUser(currentUser);
      console.log("Journal: User loaded", currentUser);

      // Load exercise definitions to enrich exercises with image data
      const exerciseDefinitions = await ExerciseDefinition.list().catch(err => {
        console.warn("Failed to load exercise definitions:", err);
        return [];
      });
      
      // Create a map for quick lookup
      const exerciseDefinitionsMap = new Map(
        exerciseDefinitions.map(def => [def.id, def])
      );

      // Fetch all workouts for the user, both active and completed
      const allUserWorkouts = await Workout.filter(
        { created_by: currentUser.email },
        "-created_date",
      );

      // Separate active from completed
      let active = allUserWorkouts.find(w => w.status === "פעיל");
      
      // Data migration for active workouts without keys, and ensure they exist for React's reconciliation
      // Also enrich exercises with definition data (including images)
      if (active) {
        // Enrich exercises with definition data
        const enrichedPart1 = await enrichExercisesWithDefinitions(active.part_1_exercises, exerciseDefinitionsMap);
        const enrichedPart2 = await enrichExercisesWithDefinitions(active.part_2_exercises, exerciseDefinitionsMap);
        const enrichedPart3 = await enrichExercisesWithDefinitions(active.part_3_exercises, exerciseDefinitionsMap);
        const enrichedExercises = await enrichExercisesWithDefinitions(active.exercises, exerciseDefinitionsMap);
        
        // Create a new object to ensure immutability before modifying properties
        active = {
          ...active,
          part_1_exercises: ensureExerciseKeys(enrichedPart1),
          part_2_exercises: ensureExerciseKeys(enrichedPart2),
          part_3_exercises: ensureExerciseKeys(enrichedPart3),
          exercises: ensureExerciseKeys(enrichedExercises),
        };
      }

      const completed = allUserWorkouts.filter(w => w.status === "הושלם")
                                       .sort((a, b) => new Date(b.date) - new Date(a.date));

      setActiveWorkout(active || null);
      setWorkouts(allUserWorkouts); // allUserWorkouts here might contain the original active workout (without keys), but activeWorkout state will have keys
      setCompletedWorkouts(completed);

      // If there's an active workout, we don't need to try and start a new one from state
      if (active) {
          // Clear location state if there was a workoutToStart, as we're already active.
          if (location.state?.workoutToStart) {
              window.history.replaceState({}, document.title);
          }
      }
    } catch (error) {
      console.error("Error loading journal data:", error);
      if (error.response?.status === 429) {
        setRateLimitError(true);
      } else {
        setNetworkError(true);
      }
      setActiveWorkout(null);
      setWorkouts([]);
      setCompletedWorkouts([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [location.state]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);
  
  useEffect(() => {
        let timerInterval;

        if (activeWorkout && activeWorkout.start_time) {
            const startTime = new Date(activeWorkout.start_time).getTime();

            const updateTimer = () => {
                const now = Date.now();
                const diff = Math.max(0, Math.floor((now - startTime) / 1000)); // difference in seconds

                const hours = Math.floor(diff / 3600);
                const minutes = Math.floor((diff % 3600) / 60);
                const seconds = diff % 60;

                const formattedMinutes = String(minutes).padStart(2, '0');
                const formattedSeconds = String(seconds).padStart(2, '0');
                
                if (hours > 0) {
                    const formattedHours = String(hours).padStart(2, '0');
                    setElapsedTime(`${formattedHours}:${formattedMinutes}:${formattedSeconds}`);
                } else {
                    setElapsedTime(`${formattedMinutes}:${formattedSeconds}`);
                }
            };

            updateTimer(); // Initial call
            timerInterval = setInterval(updateTimer, 1000);
        }

        return () => {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, [activeWorkout]);

  // Handle starting a workout from location.state
  useEffect(() => {
    const handleStartWorkoutFromState = async () => {
        if (location.state?.workoutToStart && user && !activeWorkout) {
            const workoutToStart = location.state.workoutToStart;
            console.log("Attempting to start workout from state:", workoutToStart);
            setIsLoading(true);

            // Check if any exercises are assigned at all
            const hasExercises = (workoutToStart.part_1_exercises?.length > 0 ||
                                  workoutToStart.part_2_exercises?.length > 0 ||
                                  workoutToStart.part_3_exercises?.length > 0 ||
                                  workoutToStart.exercises?.length > 0);

            if (!hasExercises) {
              alert("לא הוקצו תרגילים לאימון זה. אנא פנה למאמן שלך.");
              setIsLoading(false);
              window.history.replaceState({}, document.title);
              return;
            }

            try {
              // Helper to map exercises from pre-made to workout format
              // Preserves existing properties (like `key` and `definitionId`) and adds sets
              const mapExercises = (exList) => (exList || []).map(ex => ({
                ...ex, // Preserve original properties like `key` and `definitionId`
                sets: Array(ex.suggested_sets || 3).fill().map(() => ({
                  repetitions: ex.suggested_reps || 0,
                  weight: ex.suggested_weight || 0,
                  duration_seconds: ex.suggested_duration || 0,
                  completed: false
                })),
                completed: false,
              }));

              const workoutData = {
                date: getCurrentDateString(),
                workout_type: workoutToStart.workout_type || 'אימון כוח',
                status: 'פעיל',
                start_time: new Date().toISOString(),
                warmup_description: workoutToStart.warmup_description || 'חימום כללי - 10 דקות',
                warmup_duration: workoutToStart.warmup_duration || 10,
                warmup_completed: false,
                exercises: mapExercises(workoutToStart.exercises),
                part_1_exercises: mapExercises(workoutToStart.part_1_exercises),
                part_2_exercises: mapExercises(workoutToStart.part_2_exercises),
                part_3_exercises: mapExercises(workoutToStart.part_3_exercises),
                notes: workoutToStart.coach_notes || '', // This field receives coach notes when starting from a pre-made workout
                total_duration: workoutToStart.total_duration || 60,
                created_by: user.email,
                coach_workout_title: workoutToStart.workout_title,
                coach_workout_description: workoutToStart.workout_description
              };

              const createdWorkout = await Workout.create(workoutData);

              // Ensure exercises in the newly created workout have unique keys for UI stability
              const workoutWithKeys = {
                ...createdWorkout,
                part_1_exercises: ensureExerciseKeys(createdWorkout.part_1_exercises),
                part_2_exercises: ensureExerciseKeys(createdWorkout.part_2_exercises),
                part_3_exercises: ensureExerciseKeys(createdWorkout.part_3_exercises),
                exercises: ensureExerciseKeys(createdWorkout.exercises),
              };

              // Mark the pre-made workout as accepted
              if (workoutToStart.target_user_email === "all") {
                const { id, ...workoutCopy } = workoutToStart;
                await PreMadeWorkout.create({
                  ...workoutCopy,
                  target_user_email: user.email,
                  is_accepted: true,
                  accepted_date: new Date().toISOString(),
                });
              } else {
                await PreMadeWorkout.update(workoutToStart.id, {
                  is_accepted: true,
                  accepted_date: new Date().toISOString()
                });
              }

              setActiveWorkout(workoutWithKeys); // Set the workout with ensured keys
              setWorkouts(prev => [workoutWithKeys, ...prev]);
            } catch (error) {
                console.error("Error starting coach workout from state:", error);
                alert("שגיאה בהפעלת האימון. נסה שוב.");
            } finally {
                setIsLoading(false);
                window.history.replaceState({}, document.title);
            }
        }
    };
    handleStartWorkoutFromState();
  }, [location.state, user, activeWorkout]);


  const handleWorkoutUpdate = useCallback(async (updatedWorkout) => {
    if (!updatedWorkout || !updatedWorkout.id) {
      console.error("Invalid workout data for update:", updatedWorkout);
      return;
    }
    try {
      // Optimistically update the UI
      setActiveWorkout(updatedWorkout);

      // Create a deep copy for the backend update to avoid any potential mutation issues
      // This is crucial because updatedWorkout might contain temporary UI keys/states
      // that we don't necessarily want to persist or might cause issues if not deep copied.
      const workoutDataForBackend = JSON.parse(JSON.stringify(updatedWorkout));

      // Persist to backend
      const savedWorkout = await Workout.update(workoutDataForBackend.id, workoutDataForBackend);
      
      // Update the active workout state with the definitive data from the server, ensuring keys are present
      // Re-run ensureExerciseKeys on the savedWorkout to maintain UI stability
      const workoutWithKeys = {
        ...savedWorkout,
        part_1_exercises: ensureExerciseKeys(savedWorkout.part_1_exercises),
        part_2_exercises: ensureExerciseKeys(savedWorkout.part_2_exercises),
        part_3_exercises: ensureExerciseKeys(savedWorkout.part_3_exercises),
        exercises: ensureExerciseKeys(savedWorkout.exercises),
      };

      setActiveWorkout(workoutWithKeys);

      // Also update the overall list of workouts, making sure to use the version with ensured keys
      setWorkouts(prev => prev.map(w => w.id === savedWorkout.id ? workoutWithKeys : w));

    } catch (error) {
      console.error("Error persisting workout changes:", error);
      if (error.response?.status === 429) {
        setRateLimitError(true);
      }
      alert("שגיאה בשמירת שינויים. ייתכן שהשינויים לא נשמרו.");
      // Potentially reload data to revert to server state if update failed
      loadWorkouts(false);
    }
  }, [loadWorkouts]);


  const handleFinishWorkout = useCallback(async () => {
    if (!activeWorkout || !user) return;

    setIsLoading(true);

    try {
      const endTime = new Date();
      const startTime = new Date(activeWorkout.start_time);
      // Calculate duration in minutes, handling potential NaN or negative duration
      const totalDuration = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)));

      // Consolidate all exercises from parts and legacy field for calculations
      const allPlannedExercises = [
          ...(activeWorkout.part_1_exercises || []),
          ...(activeWorkout.part_2_exercises || []),
          ...(activeWorkout.part_3_exercises || []),
          ...(activeWorkout.exercises || [])
      ];

      // Now we can trust that all exercises are marked completed by WorkoutPartCard
      const completedExercisesCount = allPlannedExercises.filter(ex => ex.completed).length;
      const totalExercisesCount = allPlannedExercises.length;

      const totalSets = allPlannedExercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
      const completedSets = allPlannedExercises.reduce((sum, ex) => {
        return sum + (ex.sets?.filter(set => set.completed)?.length || 0);
      }, 0);

      const completionRate = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 100;

      const totalWeightLifted = allPlannedExercises.reduce((totalWeight, exercise) => {
          return totalWeight + (exercise.sets || []).reduce((setWeight, set) => {
              // Ensure we only count completed sets for weight lifted
              return setWeight + (set.completed ? ((set.weight || 0) * (set.repetitions || 1)) : 0);
          }, 0);
      }, 0);

      // Data to update the workout record
      const workoutUpdateData = {
          status: 'הושלם',
          end_time: endTime.toISOString(),
          total_duration: totalDuration,
          completed_exercises_count: completedExercisesCount,
          total_exercises_count: totalExercisesCount,
          total_sets_completed: completedSets,
          total_sets_planned: totalSets,
          completion_rate: completionRate,
          total_weight_lifted: Math.round(totalWeightLifted),
          // Explicitly pass the current state of exercises from activeWorkout to ensure all completions are saved
          exercises: activeWorkout.exercises,
          part_1_exercises: activeWorkout.part_1_exercises,
          part_2_exercises: activeWorkout.part_2_exercises,
          part_3_exercises: activeWorkout.part_3_exercises,
      };

      // Update the main workout record
      await Workout.update(activeWorkout.id, workoutUpdateData);

      // --- NEW LOGIC TO SAVE EXERCISE DEFAULTS ---
      try {
          const userDefaults = await ExerciseDefault.filter({ user_email: user.email });
          const defaultsMap = new Map(userDefaults.map(d => [d.exercise_id, d]));
          const updatesToPerform = [];

          allPlannedExercises.forEach(exercise => {
              // Ensure exercise is completed and has a definitionId to save a default for it
              if (exercise.completed && exercise.definitionId) {
                  // Find the last completed set with actual performance data
                  const lastSet = [...(exercise.sets || [])].reverse().find(s => s.completed && (s.weight > 0 || s.repetitions > 0 || s.duration_seconds > 0));
                  if (lastSet) {
                      const existingDefault = defaultsMap.get(exercise.definitionId);
                      const newDefaultData = {
                          user_email: user.email,
                          exercise_id: exercise.definitionId,
                          default_weight: lastSet.weight || 0,
                          default_reps: lastSet.repetitions || 0,
                          default_duration: lastSet.duration_seconds || 0,
                          last_updated: new Date().toISOString(),
                      };

                      if (existingDefault) {
                          updatesToPerform.push(ExerciseDefault.update(existingDefault.id, newDefaultData));
                      } else {
                          updatesToPerform.push(ExerciseDefault.create(newDefaultData));
                      }
                  }
              }
          });
          if (updatesToPerform.length > 0) {
              await Promise.all(updatesToPerform);
              console.log("Successfully updated/created exercise defaults.");
          }
      } catch (defaultsError) {
          console.error("Error saving exercise defaults:", defaultsError);
          // Non-critical error, so we don't block the main flow.
      }
      // --- END OF NEW LOGIC ---

      await User.updateMyUserData({ last_workout_date: activeWorkout.date });

      const workoutSummary = {
        duration: totalDuration,
        completionRate: completionRate,
        exercisesCompleted: completedExercisesCount,
        totalExercises: totalExercisesCount,
        weightLifted: Math.round(totalWeightLifted),
      };

      // Navigate to home with success state including user's gender
      navigate(createPageUrl('Home'), {
        state: {
          workoutCompleted: true,
          workoutSummary: workoutSummary,
          userGender: user.gender
        }
      });

    } catch (error) {
      console.error("❌ Error completing workout:", error);
      alert(`שגיאה בשמירת האימון: ${error.message}. אנא נסה שוב.`);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkout, user, navigate]);


  // Helper function to calculate completion rate in real time
  const getWorkoutCompletionStats = useMemo(() => {
    if (!activeWorkout) return { completedSets: 0, totalSets: 0, completionRate: 0, completedExercisesCount: 0, totalExercisesCount: 0, areAllExercisesCompleted: false };

    const allExercises = [
      ...(activeWorkout.part_1_exercises || []),
      ...(activeWorkout.part_2_exercises || []),
      ...(activeWorkout.part_3_exercises || []),
      ...(activeWorkout.exercises || [])
    ];

    const totalExercisesCount = allExercises.length;

    if (totalExercisesCount === 0) return { completedSets: 0, totalSets: 0, completionRate: 0, completedExercisesCount: 0, totalExercisesCount: 0, areAllExercisesCompleted: true };

    const totalSets = allExercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
    const completedSets = allExercises.reduce((sum, ex) => {
      return sum + (ex.sets?.filter(set => set.completed)?.length || 0);
    }, 0);

    const completedExercisesCount = allExercises.filter(ex => ex.completed).length;

    const completionRate = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    // Check if all exercises are marked completed
    const areAllExercisesCompleted = allExercises.every(exercise => exercise.completed);

    return { completedSets, totalSets, completionRate, completedExercisesCount, totalExercisesCount, areAllExercisesCompleted };
  }, [activeWorkout]);

  const handleRetryAfterRateLimit = async () => {
    setRateLimitError(false);
    setNetworkError(false);

    await new Promise(resolve => setTimeout(resolve, 3000));

    setIsLoading(true);
    await loadWorkouts();
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="relative">
          <img src="/logo.jpeg" alt="טוען..." className="w-12 h-12 rounded-2xl object-contain animate-pulse" />
          <div className="absolute -inset-1 w-14 h-14 rounded-full border-4 border-blue-300 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (rateLimitError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-600 mb-2">⏳ יותר מדי בקשות</h2>
          <p className="text-slate-600 mb-4">המערכת עמוסה כרגע. אנא המתן מספר שניות ונסה שוב.</p>
          <Button onClick={handleRetryAfterRateLimit} className="bg-amber-500 hover:bg-amber-600 text-white">
            נסה שוב עכשיו
          </Button>
        </div>
      </div>
    );
  }

  if (networkError) {
    return <NetworkErrorDisplay onRetry={loadWorkouts} />;
  }

  const renderActiveWorkout = () => {
    if (!activeWorkout) return null;

    const { completedExercisesCount, totalExercisesCount, areAllExercisesCompleted } = getWorkoutCompletionStats;

    const hasParts = isPartedWorkout(activeWorkout);
    const hasLegacyExercises = activeWorkout.exercises && activeWorkout.exercises.length > 0;

    const WarmupCard = ({ workout, onUpdate }) => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="border-orange-500 border-t-4 shadow-lg min-w-0">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-orange-600 break-words text-base leading-tight">
                        <Flame className="w-5 h-5 shrink-0" />
                        <span className="break-words text-sm sm:text-base">חימום - {workout?.warmup_duration} דקות</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 min-w-0">
                    <p className="text-slate-600 break-words text-sm leading-relaxed">{workout?.warmup_description}</p>
                    <div className="bg-orange-50 p-3 rounded-lg min-w-0">
                        <h4 className="font-semibold mb-2 text-sm">תרגילים באימון היום:</h4>
                        <div className="flex flex-wrap gap-1">
                            {[
                                ...(workout.part_1_exercises || []),
                                ...(workout.part_2_exercises || []),
                                ...(workout.part_3_exercises || []),
                                ...(workout.exercises || [])
                            ].map((exercise) => ( 
                                <Badge key={exercise.key || exercise.name} variant="outline" className="break-words text-xs">{exercise.name}</Badge>
                            ))}
                        </div>
                    </div>
                    <Button
                        onClick={() => onUpdate({ ...workout, warmup_completed: true })}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm h-10"
                    >
                        סיימתי חימום - התחל אימון
                    </Button>
                </CardContent>
            </Card>
        </motion.div>
    );

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-green-50 to-lime-50">
            {/* Fixed Header */}
            <div className="flex-shrink-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-4xl mx-auto px-3 py-3">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 break-words leading-tight">🏋️‍♂️ אימון פעיל</h1>

                        <div className="flex items-center justify-center gap-4 text-slate-600 mb-1 flex-wrap">
                             <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 shrink-0" />
                                <Input
                                    type="date"
                                    value={activeWorkout.date || ''}
                                    onChange={(e) => handleWorkoutUpdate({ ...activeWorkout, date: e.target.value })}
                                    className="text-xs sm:text-sm h-8 w-36 p-1 bg-slate-100 border-slate-200 rounded-md focus:ring-green-500"
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 font-mono text-base font-bold text-slate-800">
                               <Clock className="w-4 h-4 shrink-0 text-blue-600"/>
                               <span>{elapsedTime}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />
                                <span className="text-xs">{completedExercisesCount}/{totalExercisesCount} הושלמו</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-grow overflow-y-auto pb-28">
                <div className="max-w-4xl mx-auto px-3 py-4 space-y-4 min-w-0">
                    <Card className="muscle-glass shadow-lg">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl font-bold text-green-700">{activeWorkout.coach_workout_title || 'אימון פעיל'}</CardTitle>
                                    {activeWorkout.coach_workout_description && <CardDescription className="mt-2 text-base text-slate-600">{activeWorkout.coach_workout_description}</CardDescription>}
                                    {activeWorkout.notes && <CardDescription className="mt-1 text-sm text-blue-600"><strong>הערות מאמן:</strong> {activeWorkout.notes}</CardDescription>}
                                </div>
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    {format(new Date(activeWorkout.start_time), 'HH:mm', { locale: he })}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!activeWorkout?.warmup_completed ? (
                                <WarmupCard
                                    workout={activeWorkout}
                                    onUpdate={handleWorkoutUpdate}
                                />
                            ) : (
                                <div className="my-6 space-y-6">
                                    {activeWorkout.part_1_exercises?.length > 0 && <WorkoutPartCard title="חלק 1" exercises={activeWorkout.part_1_exercises} partKey="part_1_exercises" workout={activeWorkout} onUpdate={handleWorkoutUpdate} />}
                                    {activeWorkout.part_2_exercises?.length > 0 && <WorkoutPartCard title="חלק 2" exercises={activeWorkout.part_2_exercises} partKey="part_2_exercises" workout={activeWorkout} onUpdate={handleWorkoutUpdate} />}
                                    {activeWorkout.part_3_exercises?.length > 0 && <WorkoutPartCard title="חלק 3" exercises={activeWorkout.part_3_exercises} partKey="part_3_exercises" workout={activeWorkout} onUpdate={handleWorkoutUpdate} />}
                                    {!hasParts && hasLegacyExercises && (
                                      <WorkoutPartCard title="תרגילים" exercises={activeWorkout.exercises} partKey="exercises" workout={activeWorkout} onUpdate={handleWorkoutUpdate} />
                                    )}
                                    {!(hasParts || hasLegacyExercises) && (
                                        <Card><CardContent><p className="p-4 text-center text-slate-500">לא נמצאו תרגילים לאימון זה.</p></CardContent></Card>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Fixed Floating Complete Button */}
            {activeWorkout?.warmup_completed && (
                <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
                    <div className="max-w-4xl mx-auto p-3 pb-20 md:pb-3 min-w-0">
                        <Button
                            onClick={handleFinishWorkout}
                            disabled={isLoading || !areAllExercisesCompleted}
                            className={`w-full py-3 text-base font-bold rounded-xl shadow-lg transition-all duration-300 ${
                                areAllExercisesCompleted && !isLoading
                                ? 'muscle-red-gradient text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                                    מסכם אימון...
                                </>
                            ) : (
                                <>🏁 סיום אימון</>
                            )}
                        </Button>

                        {!areAllExercisesCompleted && (
                            <p className="text-center text-xs text-slate-500 mt-1.5 break-words leading-tight">
                                יש לסמן את כל התרגילים כהושלמו לפני סיום האימון
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6" dir="rtl">
        <AnimatePresence mode="wait">
            {activeWorkout ? (
                <motion.div key="session" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                    {renderActiveWorkout()}
                </motion.div>
            ) : (
                <motion.div key="journal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                    <div className="text-center mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 flex items-center justify-center gap-3">
                          <History className="w-8 h-8"/>
                          יומן אימונים
                        </h1>
                        <p className="text-slate-600 mt-2">היסטוריית האימונים שהושלמו</p>
                    </div>

                    {completedWorkouts.length > 0 ? (
                      <div className="space-y-4">
                        {completedWorkouts.map((workout) => (
                          <motion.div
                            key={workout.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Card className="muscle-card-variant-green hover:shadow-lg transition-shadow duration-300">
                                <CardHeader className="flex flex-row justify-between items-center">
                                    <div>
                                        <CardTitle className="text-lg text-slate-800">
                                            {workout.coach_workout_title || workout.workout_type || 'אימון'}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 text-sm mt-1">
                                            <Calendar className="w-4 h-4"/>
                                            {formatDate(workout.date)}
                                        </CardDescription>
                                    </div>
                                    <Button onClick={() => setSelectedWorkout(workout)}>
                                        <Eye className="w-4 h-4 ml-2"/>
                                        צפה בפרטים
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                                    <div className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> <strong>משך:</strong> {workout.total_duration || 0} דקות</div>
                                    <div className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-600"/> <strong>השלמה:</strong> {workout.completion_rate || 0}%</div>
                                    <div className="flex items-center gap-1.5"><Dumbbell className="w-4 h-4"/> <strong>תרגילים:</strong> {workout.completed_exercises_count || 0}/{workout.total_exercises_count || 0}</div>
                                    {workout.total_weight_lifted > 0 && <div className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-orange-500"/> <strong>משקל כולל:</strong> {workout.total_weight_lifted} ק"ג</div>}
                                  </div>
                                </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <Card className="text-center p-12">
                        <Info className="w-12 h-12 mx-auto text-slate-400 mb-4"/>
                        <h3 className="text-xl font-semibold text-slate-700">אין אימונים שהושלמו</h3>
                        <p className="text-slate-500 mt-2">
                          כדי לראות כאן היסטוריה, יש להשלים אימון. <br/>
                          ניתן ליצור אימון חדש בלשונית "סייקל".
                        </p>
                        <Button className="mt-4" onClick={() => navigate(createPageUrl('ExercisesSetup'))}>
                          <Plus className="w-4 h-4 ml-2"/>
                          צור אימון חדש
                        </Button>
                      </Card>
                    )}

                    {/* Workout Details Modal - ENHANCED */}
                    {selectedWorkout && (
                       <Dialog open={!!selectedWorkout} onOpenChange={() => setSelectedWorkout(null)}>
                        <DialogContent className="max-w-2xl" dir="rtl">
                          <DialogHeader>
                            <DialogTitle className="text-2xl">{selectedWorkout.coach_workout_title || 'סיכום אימון'}</DialogTitle>
                            <DialogDescription>{formatDate(selectedWorkout.date)}</DialogDescription>
                            {selectedWorkout.notes && ( // Display general/coach notes prominently
                                <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg"><strong>הערות מאמן:</strong> {selectedWorkout.notes}</div>
                            )}
                          </DialogHeader>
                          <ScrollArea className="max-h-[70vh] pr-4">
                            <div className="space-y-6 py-4">
                                {['part_1_exercises', 'part_2_exercises', 'part_3_exercises', 'exercises'].map(partKey => {
                                    const exercisesInPart = selectedWorkout[partKey] || [];
                                    if (exercisesInPart.length === 0) return null; // Skip if part is empty

                                    const partTitle = {
                                        'part_1_exercises': 'חלק 1',
                                        'part_2_exercises': 'חלק 2',
                                        'part_3_exercises': 'חלק 3',
                                        'exercises': 'תרגילים' // For legacy workouts or general exercises
                                    }[partKey];

                                    return (
                                        <div key={partKey}>
                                            <h3 className="text-lg font-semibold mb-2 text-slate-700">{partTitle}</h3>
                                            <div className="space-y-4">
                                                {exercisesInPart.map((ex, index) => (
                                                <Card key={ex.key || index} className="p-4 bg-slate-50"> {/* Use ex.key for stable identification */}
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="font-semibold text-slate-800">{ex.name}</h4>
                                                        {ex.completed ? <Badge variant="default" className="bg-green-600">הושלם</Badge> : <Badge variant="destructive">לא הושלם</Badge>}
                                                    </div>
                                                    {ex.notes && <p className="text-xs text-slate-500 mb-2 mt-1">{ex.notes}</p>}
                                                    <div className="grid grid-cols-5 gap-2 text-xs mt-2 text-slate-600 font-medium text-center">
                                                        <div>סט</div>
                                                        <div>חזרות</div>
                                                        <div>משקל (ק"ג)</div>
                                                        <div>זמן (שנ')</div>
                                                        <div>סטטוס</div>
                                                    </div>
                                                    {ex.sets.map((set, setIndex) => (
                                                        <div key={setIndex} className={`grid grid-cols-5 gap-2 text-sm items-center text-center p-1.5 rounded mt-1 ${set.completed ? 'bg-green-100/70' : 'bg-red-100/70'}`}>
                                                            <div className="font-bold">{setIndex + 1}</div>
                                                            <div>{set.repetitions || '0'}</div>
                                                            <div>{set.weight || '0'}</div>
                                                            <div>{set.duration_seconds || '0'}</div>
                                                            <div className="flex justify-center">{set.completed ? <CheckCircle className="w-4 h-4 text-green-600"/> : <div className="w-4 h-4" />}</div>
                                                        </div>
                                                    ))}
                                                </Card>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                       </Dialog>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}
