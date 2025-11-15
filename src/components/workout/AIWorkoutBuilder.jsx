
import React, { useState, useEffect } from 'react';
import { User, Workout, WorkoutLog, ExerciseDefinition, WorkoutTemplate } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Brain, Dumbbell, Clock, Target, RefreshCw, CheckCircle, Loader2, Play, Lightbulb, Save, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const workoutJsonSchema = {
  type: "object",
  properties: {
    workout_title: { type: "string", description: "כותרת מעניינת ומניעה לאימון" },
    workout_description: { type: "string", description: "תיאור קצר של מטרת האימון" },
    why_this_workout: { type: "string", description: "הסבר קצר מדוע האימון הזה מתאים למשתמש" },
    estimated_duration: { type: "number", description: "משך זמן משוער באימון בדקות" },
    difficulty_level: { type: "string", enum: ["קל", "בינוני", "מאתגר"], description: "רמת קושי" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "שם התרגיל בעברית" },
          category: { type: "string", description: "קטגוריית התרגיל" },
          sets: { type: "number", description: "מספר סטים מומלץ" },
          reps: { type: "number", description: "מספר חזרות מומלץ (0 אם תרגיל זמן)" },
          weight_suggestion: { type: "number", description: "משקל מוצע בקג (0 אם משקל גוף)" },
          duration_seconds: { type: "number", description: "משך זמן בשניות (0 אם תרגיל חזרות)" },
          rest_seconds: { type: "number", description: "זמן מנוחה בין סטים בשניות" },
          notes: { type: "string", description: "הוראות ביצוע או טיפים" }
        }
      }
    }
  }
};

export default function AIWorkoutBuilder({ user }) {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState(null);
  const [userGoal, setUserGoal] = useState('');
  // Removed as duration is fixed to 60 minutes
  const [userNotes, setUserNotes] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [userTemplates, setUserTemplates] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('בינוני'); // New state for difficulty level

  useEffect(() => {
    if (user) {
      loadUserTemplates();
    }
  }, [user]);

  const loadUserTemplates = async () => {
    try {
      const templates = await WorkoutTemplate.filter({ created_by: user.email }, '-created_date');
      setUserTemplates(templates || []);
    } catch (error) {
      console.error("Error loading user templates:", error);
    }
  };

  const saveGeneratedWorkoutAsTemplate = async () => {
    if (!templateName || !generatedWorkout) {
      alert('יש לתת שם לתבנית');
      return;
    }

    setIsSavingTemplate(true);
    setSuccessMessage('');
    try {
      const templateData = {
        template_name: templateName,
        workout_title: generatedWorkout.workout_title,
        workout_description: generatedWorkout.workout_description,
        warmup_description: 'חימום אירובי קל 5-10 דקות, מתיחות דינמיות.',
        warmup_duration: 10,
        part_1_exercises: generatedWorkout.exercises.map(ex => ({
          name: ex.name,
          category: ex.category,
          suggested_sets: ex.sets || 3,
          suggested_reps: ex.reps || 12,
          suggested_weight: ex.weight_suggestion || 0,
          suggested_duration: ex.duration_seconds || 0,
          notes: ex.notes,
          video_url: ''
        })),
        part_2_exercises: [],
        part_3_exercises: [],
        coach_notes: `תבנית זו נוצרה מאימון AI. ${generatedWorkout.why_this_workout}`,
        difficulty_level: generatedWorkout.difficulty_level === 'מאתגר' ? 'מתקדמים' : 
                          generatedWorkout.difficulty_level === 'בינוני' ? 'בינוני' : 'מתחילים',
        estimated_duration: generatedWorkout.estimated_duration || 60,
        created_by: user.email
      };

      await WorkoutTemplate.create(templateData);
      setSuccessMessage(`התבנית "${templateName}" נשמרה בהצלחה!`);
      setIsTemplateDialogOpen(false);
      setTemplateName('');
      await loadUserTemplates();
    } catch (error) {
      console.error('Error saving AI workout as template:', error);
      alert('שגיאה בשמירת התבנית');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const loadTemplate = async (template) => {
    try {
      // Convert template to generated workout format
      const allExercises = [
        ...(template.part_1_exercises || []),
        ...(template.part_2_exercises || []),
        ...(template.part_3_exercises || [])
      ];

      const templateAsWorkout = {
        workout_title: template.workout_title,
        workout_description: template.workout_description,
        why_this_workout: `נטען מהתבנית "${template.template_name}"`,
        estimated_duration: template.estimated_duration || 60,
        difficulty_level: template.difficulty_level === 'מתקדמים' ? 'מאתגר' : 
                         template.difficulty_level === 'בינוני' ? 'בינוני' : 'קל',
        exercises: allExercises.map(ex => ({
          name: ex.name,
          category: ex.category,
          sets: ex.suggested_sets || 3,
          reps: ex.suggested_reps || 12,
          weight_suggestion: ex.suggested_weight || 0,
          duration_seconds: ex.suggested_duration || 0,
          rest_seconds: 60, // Default rest for loaded templates
          notes: ex.notes || ''
        }))
      };

      setGeneratedWorkout(templateAsWorkout);
      setSuccessMessage(''); // Clear any previous success message
    } catch (error) {
      console.error('Error loading template:', error);
      alert('שגיאה בטעינת התבנית');
    }
  };

  const generateAIWorkout = async () => {
    if (!user) {
      alert("שגיאה: נתוני משתמש לא נטענו.");
      return;
    }

    setIsGenerating(true);
    setSuccessMessage(''); // Clear previous messages
    setErrorMessage(''); // Clear previous errors
    setGeneratedWorkout(null); // Clear previous workout
    try {
      // Fetch fresh history data for the prompt
      const recentWorkouts = await Workout.filter({ created_by: user.email, status: 'הושלם' }, '-date', 10);
      const workoutLogs = await WorkoutLog.filter({ user_email: user.email }, '-date', 50);

      const recentWorkoutsText = recentWorkouts.length > 0 
        ? recentWorkouts.slice(0, 5).map(w => 
            `${w.date}: ${w.coach_workout_title || w.workout_type} - ${w.completed_exercises_count || 0} תרגילים הושלמו`
          ).join('\n')
        : 'אין אימונים קודמים';

      const exercisePreferences = workoutLogs.length > 0
        ? [...new Set(workoutLogs.map(log => log.exercise_name))].slice(0, 10).join(', ')
        : 'אין נתונים';

      const userContext = `
פרטי המשתמש:
- שם: ${user.name}
- גיל: ${user.age || 'לא ידוע'}
- משקל נוכחי: ${user.current_weight || 'לא ידוע'} ק"ג
- תאריך התחלת אימונים: ${user.start_date || 'לא ידוע'}

אימונים אחרונים שבוצעו:
${recentWorkoutsText}

תרגילים שהמשתמש ביצע לאחרונה:
${exercisePreferences}

הערות נוספות מהמשתמש: ${userNotes || 'אין'}
      `;

      const prompt = `
אתה מאמן כושר מקצועי. צור אימון מותאם לפי הפרטים הבאים:

${userContext}

דרישות לאימון:
1. משך האימון: בדיוק 60 דקות (כולל חימום וסיום)
2. מטרת האימון: ${userGoal}
3. העדפות נוספות: ${userNotes || 'אין'}
4. רמת קושי: ${difficultyLevel}

הערות חשובות:
- משך האימון חייב להיות בדיוק 60 דקות
- כלול 5-10 דקות חימום ו-5 דקות סיום/מתיחות
- הכן רשימת תרגילים שתתאים למשך זמן זה
- התאם את מספר הסטים והחזרות בהתאם

חשוב מאוד: החזר את התשובה בפורמט JSON עם המבנה הבא בדיוק. השתמש בשמות השדות באנגלית בלבד (workout_title, exercises וכו'), גם אם התוכן בעברית.

דוגמה למבנה הנדרש:
{
  "workout_title": "אימון חיטוב מתקדם",
  "workout_description": "אימון ממוקד לחיטוב ושריפת קלוריות",
  "why_this_workout": "האימון מתאים למטרת החיטוב שלך ומשלב תרגילי כוח וקרדיו",
  "estimated_duration": 60,
  "difficulty_level": "בינוני",
  "exercises": [
    {
      "name": "סקוואט",
      "category": "רגליים",
      "sets": 4,
      "reps": 15,
      "weight_suggestion": 0,
      "duration_seconds": 0,
      "rest_seconds": 45,
      "notes": "שמור על גב ישר, ירך עד מקביל לרצפה"
    },
    {
      "name": "פלאנק",
      "category": "ליבה",
      "sets": 3,
      "reps": 0,
      "weight_suggestion": 0,
      "duration_seconds": 60,
      "rest_seconds": 30,
      "notes": "שמור על גוף ישר, נשום עמוק"
    }
  ]
}

החזר רק את ה-JSON, ללא טקסט נוסף לפני או אחרי. כל המפתחות (keys) חייבים להיות באנגלית.
      `;

      let workoutData = await InvokeLLM({
        prompt,
        response_json_schema: workoutJsonSchema
      });

      console.log('Workout data received:', workoutData);

      // Validate that we got a valid workout structure
      if (!workoutData || typeof workoutData !== 'object') {
        throw new Error('Invalid response format from AI. Expected an object.');
      }

      // Handle case where AI returns Hebrew keys (fallback transformation)
      if (workoutData.אימון && !workoutData.workout_title) {
        console.warn('AI returned Hebrew keys, transforming...');
        const hebrewData = workoutData.אימון;
        
        // Extract exercises from various possible locations
        let exercises = [];
        if (hebrewData.תרגילים && Array.isArray(hebrewData.תרגילים)) {
          exercises = hebrewData.תרגילים;
        } else if (hebrewData.חימום?.תרגילים && Array.isArray(hebrewData.חימום.תרגילים)) {
          exercises = [...hebrewData.חימום.תרגילים];
        }
        if (hebrewData.חלק_ראשון?.תרגילים && Array.isArray(hebrewData.חלק_ראשון.תרגילים)) {
          exercises = [...exercises, ...hebrewData.חלק_ראשון.תרגילים];
        }
        if (hebrewData.חלק_עיקרי?.תרגילים && Array.isArray(hebrewData.חלק_עיקרי.תרגילים)) {
          exercises = [...exercises, ...hebrewData.חלק_עיקרי.תרגילים];
        }
        
        // Extract duration - handle "60 דקות" format
        let duration = 60;
        if (hebrewData.משך) {
          const durationMatch = String(hebrewData.משך).match(/(\d+)/);
          if (durationMatch) {
            duration = parseInt(durationMatch[1]);
          }
        }
        
        workoutData = {
          workout_title: hebrewData.כותרת || hebrewData.שם || `אימון ${userGoal || 'מותאם'}`,
          workout_description: hebrewData.תיאור || hebrewData.מטרה || `אימון ${userGoal || 'כללי'}`,
          why_this_workout: hebrewData.למה || hebrewData.הסבר || `אימון מותאם למטרה: ${userGoal}`,
          estimated_duration: duration,
          difficulty_level: hebrewData['רמת קושי'] || hebrewData.קושי || difficultyLevel,
          exercises: exercises.map(ex => ({
            name: ex.שם || ex.name || 'תרגיל',
            category: ex.קטגוריה || ex.category || 'כוח',
            sets: ex.סטים || ex.sets || 3,
            reps: ex.חזרות || ex.reps || (ex.משך ? 0 : 12),
            weight_suggestion: ex.משקל || ex.weight_suggestion || 0,
            duration_seconds: ex.משך ? (typeof ex.משך === 'number' ? ex.משך : parseInt(String(ex.משך).match(/(\d+)/)?.[1] || 0) * 60) : 0,
            rest_seconds: ex.מנוחה || ex.rest_seconds || 60,
            notes: ex.הערות || ex.notes || ex.הוראות || ''
          }))
        };
        
        // If no exercises found, create a basic structure
        if (workoutData.exercises.length === 0) {
          console.warn('No exercises found in Hebrew structure, creating default exercises');
          workoutData.exercises = [
            {
              name: 'סקוואט',
              category: 'רגליים',
              sets: 3,
              reps: 12,
              weight_suggestion: 0,
              duration_seconds: 0,
              rest_seconds: 60,
              notes: 'תרגיל בסיסי לחיזוק רגליים'
            }
          ];
        }
        
        console.log('Transformed workout data:', workoutData);
      }

      if (!workoutData.workout_title || !workoutData.exercises || !Array.isArray(workoutData.exercises)) {
        console.error('Invalid workout structure:', workoutData);
        throw new Error('AI response is missing required fields (workout_title or exercises array). Received: ' + JSON.stringify(Object.keys(workoutData)));
      }

      if (workoutData.exercises.length === 0) {
        throw new Error('AI generated a workout with no exercises. Please try again.');
      }

      setGeneratedWorkout(workoutData);
      setSuccessMessage('האימון נוצר בהצלחה!');
    } catch (error) {
      console.error("Error generating AI workout:", error);
      const errorMsg = error.message || "שגיאה ביצירת האימון. נסה שוב מאוחר יותר.";
      setErrorMessage(errorMsg);
      setGeneratedWorkout(null);
      // Also show alert for immediate feedback
      alert(`שגיאה: ${errorMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // מאגר משפטי מוטיבציה לתחילת אימון
  const workoutStartQuotes = [
    "הגיע הזמן להראות למה את.ה מסוגל.ת!",
    "אימון חדש = הזדמנות חדשה לגדול!",
    "את.ה עומד.ת על סף משהו גדול!",
    "כל אימון מתחיל במחשבה אחת: 'אני יכול.ה!'",
    "הדרך לחלום שלך מתחילה עכשיו!",
    "זה הזמן שלך לזרוח!",
    "כל תרגיל הוא צעד קדימה!",
    "את.ה כאן כי החלטת לא לוותר על עצמך!",
  ];

  const startGeneratedWorkout = async () => {
    if (!generatedWorkout || !user) return;
    
    setIsStarting(true);
    try {
      const allExercises = generatedWorkout.exercises.map(ex => ({
        name: ex.name,
        category: ex.category || 'Strength', // Default to Strength if category is missing
        sets: Array(ex.sets || 3).fill().map(() => ({
          repetitions: ex.reps || 0,
          weight: ex.weight_suggestion || 0,
          duration_seconds: ex.duration_seconds || 0,
          completed: false
        })),
        completed: false,
        notes: ex.notes || '',
        video_url: ''
      }));

      const workoutData = {
        date: new Date().toISOString().split('T')[0],
        workout_type: 'אימון AI',
        status: 'פעיל',
        start_time: new Date().toISOString(),
        warmup_description: 'חימום אירובי קל 5-10 דקות, מתיחות דינמיות.',
        warmup_duration: 10,
        warmup_completed: false,
        exercises: allExercises,
        notes: '',
        total_duration: generatedWorkout.estimated_duration || 60,
        created_by: user.email,
        coach_workout_title: generatedWorkout.workout_title,
        coach_workout_description: generatedWorkout.workout_description
      };
      
      await Workout.create(workoutData);
      
      // בחירת משפט מוטיבציה לתחילת אימון
      const randomStartQuote = workoutStartQuotes[Math.floor(Math.random() * workoutStartQuotes.length)];
      
      alert(`🚀 ${randomStartQuote}\n\nהאימון החל! בהצלחה!`);
      
      navigate(createPageUrl("Journal"));
      
    } catch (error) {
      console.error("Error starting AI workout:", error);
      alert("שגיאה בהתחלת האימון. נסה שוב.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm"
        >
          {successMessage}
        </motion.div>
      )}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm"
        >
          <strong>שגיאה:</strong> {errorMessage}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage('')}
            className="mr-2 h-auto p-1 text-red-700 hover:text-red-900"
          >
            ✕
          </Button>
        </motion.div>
      )}

      {/* User Templates Section */}
      {userTemplates.length > 0 && (
        <Card className="muscle-glass border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              התבניות שלי
            </CardTitle>
            <p className="text-slate-600 text-sm">
              טען אימון מתבנית שמורה או צור אימון חדש עם AI
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userTemplates.map(template => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => loadTemplate(template)}>
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-slate-800 mb-2">{template.template_name}</h4>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{template.workout_description}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {template.difficulty_level}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.estimated_duration} דק'
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Workout Display */}
      <AnimatePresence>
        {generatedWorkout && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="muscle-glass border-0 shadow-lg bg-gradient-to-br from-green-50 to-blue-50">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl text-green-800 mb-2">
                      🎯 {generatedWorkout.workout_title}
                    </CardTitle>
                    <p className="text-green-700 mb-3">{generatedWorkout.workout_description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge className="bg-blue-100 text-blue-800">
                        <Clock className="w-3 h-3 ml-1" />
                        {generatedWorkout.estimated_duration} דקות
                      </Badge>
                      <Badge className="bg-purple-100 text-purple-800">
                        <Target className="w-3 h-3 ml-1" />
                        {generatedWorkout.difficulty_level}
                      </Badge>
                      <Badge className="bg-green-100 text-green-800">
                        <Dumbbell className="w-3 h-3 ml-1" />
                        {generatedWorkout.exercises?.length || 0} תרגילים
                      </Badge>
                    </div>

                    {generatedWorkout.why_this_workout && (
                      <div className="bg-amber-50 border-r-4 border-amber-400 p-3 rounded-lg mb-4">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-amber-800 text-sm">למה האימון הזה?</h4>
                            <p className="text-amber-700 text-sm mt-1">{generatedWorkout.why_this_workout}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => setGeneratedWorkout(null)}
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                {/* Exercises Preview */}
                <div className="space-y-3 mb-6">
                  <h4 className="font-semibold text-slate-800 mb-3">📋 תרגילים באימון</h4>
                  {generatedWorkout.exercises?.map((exercise, index) => (
                    <div key={index} className="bg-white/60 rounded-lg p-3 border">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-semibold text-slate-800">{exercise.name}</h5>
                        <Badge variant="outline" className="text-xs">{exercise.category}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-slate-600 mb-2">
                        <span><strong>סטים:</strong> {exercise.sets}</span>
                        {exercise.reps > 0 && <span><strong>חזרות:</strong> {exercise.reps}</span>}
                        {exercise.weight_suggestion > 0 && <span><strong>משקל:</strong> {exercise.weight_suggestion}ק"ג</span>}
                        {exercise.duration_seconds > 0 && <span><strong>זמן:</strong> {exercise.duration_seconds}ש'</span>}
                      </div>
                      
                      {exercise.notes && (
                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                          💡 {exercise.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={startGeneratedWorkout}
                    disabled={isStarting}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-lg font-semibold"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="animate-spin mr-2 h-5 w-5" />
                        מתחיל אימון...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-5 w-5" />
                        התחל אימון!
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => setIsTemplateDialogOpen(true)}
                    variant="outline"
                    className="px-6 h-12"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    שמור כתבנית
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setGeneratedWorkout(null);
                      setErrorMessage('');
                      setSuccessMessage('');
                      generateAIWorkout();
                    }}
                    variant="outline"
                    className="px-6 h-12"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    נסה שוב
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* AI Input Section */}
      <Card className="muscle-glass border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Brain className="w-7 h-7 text-purple-600" />
            <Sparkles className="w-6 h-6 text-blue-500" />
            בניית אימון חכם
          </CardTitle>
          <p className="text-slate-600 mt-2">
            הבינה המלאכותית תיצור עבורך אימון מותאם על בסיס ההיסטוריה, המטרות והעדפות שלך
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Input Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">מה המטרה באימון היום?</label>
              <Select value={userGoal} onValueChange={setUserGoal}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר מטרה..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="כוח">בניית כוח ושרירים</SelectItem>
                  <SelectItem value="חיטוב">חיטוב וירידה במשקל</SelectItem>
                  <SelectItem value="סיבולת">שיפור כושר אירובי</SelectItem>
                  <SelectItem value="גמישות">עבודה על גמישות ותנועתיות</SelectItem>
                  <SelectItem value="מאוזן">אימון מאוזן וכללי</SelectItem>
                  <SelectItem value="החלמה">אימון קל להחלמה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* New Difficulty Level Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">רמת קושי רצויה</label>
              <Select value={difficultyLevel} onValueChange={setDifficultyLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="קל">קל</SelectItem>
                  <SelectItem value="בינוני">בינוני</SelectItem>
                  <SelectItem value="מאתגר">מאתגר</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">הערות נוספות (אופציונלי)</label>
            <Textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="למשל: רוצה להתמקד ברגליים, יש לי כאב בכתף, אין לי גישה למשקולות..."
              className="resize-none"
              rows={3}
            />
          </div>

          <Button
            onClick={generateAIWorkout}
            disabled={isGenerating || !userGoal}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white h-12 text-lg font-semibold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                הבינה המלאכותית יוצרת אימון מותאם...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                צור אימון מותאם עם AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Save as Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent dir="rtl" className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>שמירת אימון כתבנית אישית</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="template-name">שם התבנית</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="למשל: אימון כוח עליון מועדף"
                className="text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">
              התבנית תישמר באופן אישי עבורך ותוכל לטעון אותה בעתיד בלחיצה אחת.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={saveGeneratedWorkoutAsTemplate} disabled={isSavingTemplate || !templateName}>
              {isSavingTemplate ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  שומר...
                </>
              ) : (
                "שמור תבנית"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
