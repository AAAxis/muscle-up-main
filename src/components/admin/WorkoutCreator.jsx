
import React, { useState, useEffect, useRef } from 'react';
import { PreMadeWorkout, WorkoutTemplate, User, UserGroup, ExerciseDefinition, CoachNotification } from '@/api/entities';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';
import { groupsForStaff } from '@/lib/groupUtils';
import { InvokeLLM, sendGroupEmail } from '@/api/integrations'; // Added InvokeLLM
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Copy, Save, Send, Calendar, Users, User as UserIcon, Dumbbell, Clock, CheckCircle, Edit, AlertTriangle, RefreshCw, Repeat, Weight, ChevronsUpDown, Check, FileText, Loader2, AlertCircle, Wand2 } from 'lucide-react'; // Added AlertCircle, Wand2
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert'; // Added Alert, AlertDescription

const statusColors = {
  'Draft': 'bg-gray-100 text-gray-800',
  'Scheduled': 'bg-blue-100 text-blue-800',
  'Sent': 'bg-green-100 text-green-800'
};

const statusLabels = {
  'Draft': 'טיוטה',
  'Scheduled': 'מתוזמן',
  'Sent': 'נשלח'
};

const getStatusLabel = (status) => statusLabels[status] || status;

const partLabels = {
  part_1_exercises: 'חלק 1 - תרגילים ראשיים',
  part_2_exercises: 'חלק 2 - תרגילים מתקדמים',
  part_3_exercises: 'חלק 3 - סיום/עצימות'
};



// ManualWorkoutBuilder component encapsulating the original WorkoutCreator's functionality
const ManualWorkoutBuilder = ({ templateToLoad, onTemplateLoaded, user, users, groups, exercises, templates, existingWorkouts, isLoadingData, loadError, retryCount, handleRetry, onWorkoutSaved, initialWorkoutState, onOpenAICreate }) => {
  const [workoutData, setWorkoutData] = useState(() => initialWorkoutState || {
    workout_title: 'אימון חדש',
    workout_description: '',
    target_user_email: '',
    warmup_description: 'חימום אירובי קל 5-10 דקות, מתיחות דינמיות.',
    warmup_duration: 10,
    estimated_duration: 60,
    workout_equipment: '',
    part_1_exercises: [],
    part_2_exercises: [],
    part_3_exercises: [],
    is_sent: false,
    sent_date: null,
    scheduled_date: '',
    status: 'Draft'
  });

  // Effect to load initial workout state passed from parent (e.g., AI parsed workout)
  useEffect(() => {
    if (initialWorkoutState) {
      setWorkoutData(initialWorkoutState);
      // Reset target type and send type when a new workout is loaded from AI/text
      setTargetType('user');
      setSendType('immediate');
    }
  }, [initialWorkoutState]);

  const [targetType, setTargetType] = useState('user'); // 'user', 'group', 'all'
  const [sendType, setSendType] = useState('immediate'); // 'immediate', 'scheduled'
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [viewedWorkout, setViewedWorkout] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadTemplate = (template) => {
    setWorkoutData({
      workout_title: template.workout_title,
      workout_description: template.workout_description,
      target_user_email: '', // Always reset target when loading a template
      warmup_description: template.warmup_description || 'חימום אירובי קל 5-10 דקות, מתיחות דינמיות.',
      warmup_duration: template.warmup_duration || 10,
      estimated_duration: template.estimated_duration || 60,
      workout_equipment: template.workout_equipment || '',
      part_1_exercises: template.part_1_exercises || [],
      part_2_exercises: template.part_2_exercises || [],
      part_3_exercises: template.part_3_exercises || [],
      is_sent: false,
      sent_date: null,
      scheduled_date: '',
      status: 'Draft'
    });
    setTargetType('user'); // Reset target type
    setSendType('immediate'); // Reset send type
  };

  // This useEffect handles loading a template from parent prop.
  useEffect(() => {
    if (templateToLoad) {
      loadTemplate(templateToLoad);
      if (typeof onTemplateLoaded === 'function') {
        onTemplateLoaded();
      }
    }
  }, [templateToLoad]); // Removed onTemplateLoaded from dependency array to prevent infinite loop

  const addExercise = (part, exercise) => {
    const newExercise = {
      id: exercise.id || `exercise-${Date.now()}-${Math.random()}`,
      name: exercise.name_he || exercise.name || '',
      category: exercise.category || '',
      suggested_sets: 1,
      suggested_reps: 1,
      suggested_weight: 1,
      suggested_duration: 1,
      notes: exercise.notes || '',
      video_url: exercise.video_url || ''
    };

    setWorkoutData(prev => {
      const newData = {
        ...prev,
        [part]: [...(prev[part] || []), newExercise]
      };
      console.log('Adding exercise:', newExercise);
      console.log('Updated part data:', newData[part]);
      return newData;
    });
  };

  const updateExercise = (part, index, field, value) => {
    setWorkoutData(prev => ({
      ...prev,
      [part]: prev[part].map((ex, i) =>
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  const removeExercise = (part, index) => {
    setWorkoutData(prev => ({
      ...prev,
      [part]: prev[part].filter((_, i) => i !== index)
    }));
  };

  const handleSaveAsDraft = async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        ...workoutData,
        status: 'Draft',
        is_sent: false,
        sent_date: null
      };

      await PreMadeWorkout.create(dataToSave);
      setSuccessMessage('האימון נשמר כטיוטה בהצלחה!');
      setTimeout(() => setSuccessMessage(''), 3000);
      resetForm();
      if (onWorkoutSaved) onWorkoutSaved();
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleWorkout = async () => {
    if (!workoutData.scheduled_date) {
      alert('יש לבחור תאריך לשליחה מתוכננת');
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        ...workoutData,
        status: 'Scheduled',
        is_sent: false,
        sent_date: workoutData.scheduled_date
      };

      await PreMadeWorkout.create(dataToSave);
      setSuccessMessage('האימון נשמר לשליחה מתוכננת!');
      setTimeout(() => setSuccessMessage(''), 3000);
      resetForm();
      if (onWorkoutSaved) onWorkoutSaved();
    } catch (error) {
      console.error('Error scheduling workout:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendWorkout = async () => {
    if (!workoutData.workout_title || (!workoutData.target_user_email && targetType !== 'all')) {
      alert('יש למלא שם אימון ולבחור יעד (מתאמן/קבוצה/כל המתאמנים)');
      return;
    }

    setIsSending(true);
    let emailCount = 0;
    let notificationCount = 0;
    let emailError = null;
    let notificationError = null;

    try {
      const dataToSave = {
        ...workoutData,
        status: 'Sent',
        is_sent: true,
        sent_date: new Date().toISOString()
      };

      await PreMadeWorkout.create(dataToSave);

      const targetEmails = getTargetEmails();
      const subject = `🏋️ אימון חדש: ${workoutData.workout_title}`;
      const messageBody = `נוצר אימון חדש: ${workoutData.workout_title}${workoutData.workout_description ? '\n\n' + workoutData.workout_description : ''}`;

      // Determine if we're sending to a group or individual users
      const isGroup = targetType === 'group';
      const groupName = isGroup ? workoutData.target_user_email : null;

      // PRIORITY 1: Send emails FIRST (emails are prioritized)
      console.log('📧 [WORKOUT] PRIORITY: Sending emails FIRST for workout:', workoutData.workout_title);
      try {
        if (isGroup) {
          // Send to group
          const emailResult = await sendGroupEmail({
            groupName: groupName,
            title: subject,
            message: messageBody
          });
          if (emailResult && emailResult.success) {
            emailCount = emailResult.successCount || 0;
            console.log(`✅ [WORKOUT] Sent ${emailCount} emails to group ${groupName}`);
          } else {
            emailError = (emailResult && emailResult.error) || 'שגיאה בשליחת אימיילים';
            console.error('❌ [WORKOUT] Email API error:', emailResult);
          }
        } else {
          // Send to individual users - PRIORITIZE EMAILS
          console.log(`📧 [WORKOUT] Sending emails to ${targetEmails.length} individual users`);
            for (let i = 0; i < targetEmails.length; i++) {
            const email = targetEmails[i];
            try {
              console.log(`📧 [WORKOUT] Sending email ${i + 1}/${targetEmails.length} to: ${email}`);
              const emailResult = await sendGroupEmail({
                userEmail: email,
                title: subject,
                message: messageBody
              });
              if (emailResult && emailResult.success && emailResult.successCount > 0) {
                emailCount++;
                console.log(`✅ [WORKOUT] Email sent successfully to: ${email}`);
              } else if (emailResult && !emailResult.success) {
                console.warn(`⚠️ [WORKOUT] Email API returned success=false for: ${email}`, emailResult);
              }
            } catch (err) {
              console.error(`❌ [WORKOUT] Failed to send email to ${email}:`, err);
            }
          }
          console.log(`✅ ✅ ✅ [WORKOUT] EMAILS SENT: ${emailCount} out of ${targetEmails.length} users`);
        }
      } catch (error) {
        console.error('❌ [WORKOUT] Error sending emails:', error);
        emailError = error.message;
      }

      // PRIORITY 2: Send push notifications AFTER emails (only if emails succeeded or as secondary)
      // Emails are the priority, so we continue even if notifications fail
      try {
        console.log('📱 [WORKOUT] Sending push notifications for workout:', workoutData.workout_title);
        if (isGroup) {
          // Send to group
          const notificationResponse = await fetch('/api/send-group-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              groupName: groupName,
              title: subject,
              body: messageBody,
              data: {
                type: 'new_workout',
                workout_title: workoutData.workout_title,
                track_open: 'true'
              }
            }),
          });

          if (notificationResponse.ok) {
            const notificationResult = await notificationResponse.json();
            notificationCount = notificationResult.successCount || 0;
            console.log(`✅ [WORKOUT] Sent ${notificationCount} push notifications to group ${groupName}`);
          } else {
            const errorData = await notificationResponse.json();
            notificationError = errorData.error || 'שגיאה בשליחת התראות push';
            console.error('❌ [WORKOUT] Notification API error:', errorData);
          }
        } else {
          // For individual users, try to find their group and send to that group
          // Or send to each user individually if they have a group
          for (const email of targetEmails) {
            const currentUser = users.find(u => u.email === email);
            if (currentUser && currentUser.group_names && currentUser.group_names.length > 0) {
              // User belongs to a group, send to that group
              try {
                const userGroup = currentUser.group_names[0]; // Use first group
                const notificationResponse = await fetch('/api/send-group-notification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    groupName: userGroup,
                    title: subject,
                    body: messageBody,
                    data: {
                      type: 'new_workout',
                      workout_title: workoutData.workout_title,
                      track_open: 'true',
                      target_user_email: email // Filter to this specific user
                    }
                  }),
                });

                if (notificationResponse.ok) {
                  const notificationResult = await notificationResponse.json();
                  // Only count if this specific user received the notification
                  // Since we're sending to a group, we can't be 100% sure, but we'll count it
                  if (notificationResult.successCount > 0) {
                    notificationCount++;
                  }
                }
              } catch (err) {
                console.error(`❌ [WORKOUT] Failed to send push notification to ${email}:`, err);
              }
            }
          }
          console.log(`✅ [WORKOUT] Sent push notifications to ${notificationCount} users`);
        }
      } catch (error) {
        console.error('❌ [WORKOUT] Error sending push notifications:', error);
        notificationError = error.message;
      }

      // Create CoachNotification records for all users
      for (const email of targetEmails) {
        const currentUser = users.find(u => u.email === email);
        
        await CoachNotification.create({
          user_email: email,
          user_name: currentUser?.name || currentUser?.full_name || 'משתמש לא ידוע',
          coach_email: 'system', // System notification
          notification_type: 'new_workout',
          notification_title: subject,
          notification_message: messageBody,
          notification_details: {
            workout_title: workoutData.workout_title,
            workout_description: workoutData.workout_description,
            created_date: new Date().toISOString()
          },
          is_read: false,
          created_date: new Date().toISOString()
        });
      }

      // Build success message with counts - PRIORITIZE EMAIL COUNT
      let successMessage = 'האימון נשלח בהצלחה למתאמנים!';
      const details = [];
      
      // Show email count FIRST (priority)
      if (emailCount > 0) {
        details.push(`📧 ${emailCount} אימיילים נשלחו`);
      } else if (targetEmails.length > 0) {
        details.push(`⚠️ אימיילים: לא נשלחו (${targetEmails.length} משתמשים)`);
      }
      
      // Show notification count second
      if (notificationCount > 0) {
        details.push(`📱 ${notificationCount} התראות push נשלחו`);
      }
      
      if (details.length > 0) {
        successMessage += `\n${details.join('\n')}`;
      }
      
      if (emailError || notificationError) {
        const errors = [];
        if (emailError) errors.push(`אימיילים: ${emailError}`);
        if (notificationError) errors.push(`התראות: ${notificationError}`);
        successMessage += `\n⚠️ אזהרות: ${errors.join(', ')}`;
      }
      
      // Log final summary
      console.log('📊 [WORKOUT] FINAL SUMMARY:', {
        workoutTitle: workoutData.workout_title,
        targetType,
        totalUsers: targetEmails.length,
        emailsSent: emailCount,
        notificationsSent: notificationCount,
        emailError,
        notificationError
      });

      setSuccessMessage(successMessage);
      setTimeout(() => setSuccessMessage(''), 5000);
      resetForm();
      if (onWorkoutSaved) onWorkoutSaved();
    } catch (error) {
      console.error('Error sending workout:', error);
      setSuccessMessage(`שגיאה בשליחת האימון: ${error.message}`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName) {
      alert('יש לתת שם לתבנית');
      return;
    }

    try {
      const templateData = {
        template_name: templateName,
        workout_title: workoutData.workout_title,
        workout_description: workoutData.workout_description,
        warmup_description: workoutData.warmup_description,
        warmup_duration: workoutData.warmup_duration,
        part_1_exercises: workoutData.part_1_exercises,
        part_2_exercises: workoutData.part_2_exercises,
        part_3_exercises: workoutData.part_3_exercises,
        workout_equipment: workoutData.workout_equipment || '',
        tags: [],
        difficulty_level: 'בינוני',
        estimated_duration: workoutData.estimated_duration || 60
      };

      await WorkoutTemplate.create(templateData);
      setSuccessMessage('התבנית נשמרה בהצלחה!');
      setIsTemplateDialogOpen(false);
      setTemplateName('');
      if (onWorkoutSaved) onWorkoutSaved();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const duplicateWorkout = (workout) => {
    setWorkoutData({
      workout_title: `העתק - ${workout.workout_title}`,
      workout_description: workout.workout_description,
      target_user_email: '',
      warmup_description: workout.warmup_description || 'חימום אירובי קל 5-10 דקות, מתיחות דינמיות.',
      warmup_duration: workout.warmup_duration || 10,
      estimated_duration: workout.estimated_duration || 60,
      workout_equipment: workout.workout_equipment || '',
      part_1_exercises: workout.part_1_exercises || [],
      part_2_exercises: workout.part_2_exercises || [],
      part_3_exercises: workout.part_3_exercises || [],
      is_sent: false,
      sent_date: null,
      scheduled_date: '',
      status: 'Draft'
    });
    setTargetType('user');
    setSendType('immediate');
    setIsDuplicateDialogOpen(false);
  };

  const handleEditWorkout = (workout) => {
    setWorkoutData({
      workout_title: workout.workout_title,
      workout_description: workout.workout_description,
      target_user_email: workout.target_user_email,
      warmup_description: workout.warmup_description || 'חימום אירובי קל 5-10 דקות, מתיחות דינמיות.',
      warmup_duration: workout.warmup_duration || 10,
      estimated_duration: workout.estimated_duration || 60,
      workout_equipment: workout.workout_equipment || '',
      part_1_exercises: workout.part_1_exercises || [],
      part_2_exercises: workout.part_2_exercises || [],
      part_3_exercises: workout.part_3_exercises || [],
      is_sent: false,
      sent_date: null,
      scheduled_date: workout.scheduled_date || '',
      status: 'Draft'
    });

    if (workout.target_user_email === 'all') {
      setTargetType('all');
    } else if (groups.some(g => g.name === workout.target_user_email)) {
      setTargetType('group');
    } else {
      setTargetType('user');
    }

    setSendType('immediate');
    setViewedWorkout(null);
  };

  const handleDeleteWorkout = async (workoutId) => {
    const confirmed = window.confirm('האם אתה בטוח שברצונך למחוק אימון זה לצמיתות? פעולה זו אינה הפיכה.');
    if (!confirmed) return;

    try {
      await PreMadeWorkout.delete(workoutId);
      setSuccessMessage('האימון נמחק בהצלחה!');
      setTimeout(() => setSuccessMessage(''), 3000);
      if (onWorkoutSaved) onWorkoutSaved();
      if (viewedWorkout && viewedWorkout.id === workoutId) {
        setViewedWorkout(null);
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('שגיאה במחיקת האימון. נסה שוב.');
    }
  };

  const getTargetEmails = () => {
    if (targetType === 'all') return users.map(u => u.email);
    if (targetType === 'group') {
      const selectedGroup = groups.find(g => g.name === workoutData.target_user_email);
      return users.filter(u => u.group_name === selectedGroup?.name).map(u => u.email);
    }
    return [workoutData.target_user_email];
  };

  const createWorkoutEmailBody = (currentUser, workout) => {
    const exercisesHtml = ['part_1_exercises', 'part_2_exercises', 'part_3_exercises']
      .map(part => {
        if (!workout[part] || workout[part].length === 0) return '';
        return `
          <h4>${partLabels[part]}</h4>
          <ul>
            ${workout[part].map(ex => `
              <li>
                <strong>${ex.name}</strong>
                ${ex.suggested_sets ? ` - ${ex.suggested_sets} סטים` : ''}
                ${ex.suggested_reps ? ` × ${ex.suggested_reps} חזרות` : ''}
                ${ex.suggested_weight ? ` (${ex.suggested_weight} ק"ג)` : ''}
                ${ex.notes ? `<br><em>${ex.notes}</em>` : ''}
                ${ex.video_url ? `<br><a href="${ex.video_url}" target="_blank">צפה בסרטון</a>` : ''}
              </li>
            `).join('')}
          </ul>
        `;
      }).filter(Boolean).join('');

    return `
      <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>🏋️ אימון חדש עבורך: ${workout.workout_title}</h2>
        <p>שלום ${currentUser?.name || 'מתאמן יקר'},</p>
        <p>${workout.workout_description}</p>

        ${workout.warmup_description ? `
          <h3>חימום (${workout.warmup_duration} דקות)</h3>
          <p>${workout.warmup_description}</p>
        ` : ''}

        <h3>תרגילי האימון</h3>
        ${exercisesHtml}

        <p>בהצלחה באימון!</p>
      </div>
    `;
  };

  const resetForm = () => {
    setWorkoutData({
      workout_title: 'אימון חדש',
      workout_description: '',
      target_user_email: '',
      warmup_description: 'חימום אירובי קל 5-10 דקות, מתיחות דינמיות.',
      warmup_duration: 10,
      estimated_duration: 60,
      workout_equipment: '',
      part_1_exercises: [],
      part_2_exercises: [],
      part_3_exercises: [],
      is_sent: false,
      sent_date: null,
      scheduled_date: '',
      status: 'Draft'
    });
    setTargetType('user');
    setSendType('immediate');
  };

  const filteredExercises = exercises.filter(ex => {
    const term = searchTerm.toLowerCase();
    return ex.name_he?.toLowerCase().includes(term) ||
           ex.name_en?.toLowerCase().includes(term) ||
           ex.muscle_group?.toLowerCase().includes(term) ||
           ex.equipment?.toLowerCase().includes(term) ||
           ex.category?.toLowerCase().includes(term);
    });

  const renderWorkoutPart = (partKey) => (
    <div>
      <h3 className="text-base font-semibold mb-3 !text-center">{partLabels[partKey]}</h3>
      <div>
        <AnimatePresence>
          {workoutData[partKey].map((exercise, index) => (
            <div key={`${partKey}-${exercise.id || exercise.name}-${index}`} className="border rounded-lg p-4 mb-4 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-semibold text-slate-800">{exercise.name}</p>
                  <p className="text-xs text-slate-500">{exercise.category}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeExercise(partKey, index)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">סטים</Label>
                  <Input 
                    type="number" 
                    className="h-8 mt-1" 
                    value={exercise.suggested_sets ?? 1} 
                    onChange={e => updateExercise(partKey, index, 'suggested_sets', parseInt(e.target.value) || 1)} 
                  />
                </div>

                <div>
                  <Label className="text-xs">חזרות</Label>
                  <Input 
                    type="number" 
                    className="h-8 mt-1" 
                    value={exercise.suggested_reps ?? 1} 
                    onChange={e => updateExercise(partKey, index, 'suggested_reps', parseInt(e.target.value) || 1)} 
                  />
                </div>

                <div>
                  <Label className="text-xs">משקל (ק"ג)</Label>
                  <Input
                    type="number"
                    className="h-8 mt-1"
                    value={exercise.suggested_weight ?? 1}
                    onChange={e => updateExercise(partKey, index, 'suggested_weight', parseFloat(e.target.value) || 1)}
                  />
                </div>

                <div>
                  <Label className="text-xs">משך (שניות)</Label>
                  <Input
                    type="number"
                    className="h-8 mt-1"
                    value={exercise.suggested_duration ?? 1}
                    onChange={e => updateExercise(partKey, index, 'suggested_duration', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="mt-3">
                <Label className="text-xs">הערות לתרגיל</Label>
                <Textarea
                  placeholder="..."
                  rows={2}
                  className="text-sm mt-1"
                  value={exercise.notes ?? ''}
                  onChange={e => updateExercise(partKey, index, 'notes', e.target.value)}
                />
              </div>
            </div>
          ))}
        </AnimatePresence>
        {workoutData[partKey].length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>עדיין לא נוספו תרגילים בחלק זה</p>
            <p className="text-sm">הוסף תרגילים מספריית התרגילים בצד ימין</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-0 space-y-4 sm:space-y-6 bg-slate-50 min-h-screen" dir="rtl">
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
        <div className="me-auto text-end">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">🏗️ בונה אימונים</h1>
            <p className="text-sm sm:text-base text-slate-500">בנה, שלח ונהל תוכניות אימון למתאמנים שלך.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={resetForm} size="sm" className="text-xs sm:text-sm">
                <Plus className="w-4 h-4 ms-2" />אימון חדש
            </Button>
             <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                        <Copy className="w-4 h-4 ms-2" />שכפל
                    </Button>
                </DialogTrigger>
                <DialogContent dir="rtl" className="w-[95vw] max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader className="text-end ps-12 pt-2">
                        <div className="me-auto w-fit">
                            <DialogTitle>שכפל אימון קיים</DialogTitle>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] w-full">
                        <div className="space-y-4 pe-4">
                            {existingWorkouts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(workout => (
                                <Card key={workout.id} className="cursor-pointer hover:bg-slate-50 transition-colors text-end" onClick={() => duplicateWorkout(workout)}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1 min-w-0 text-end">
                                                <h4 className="font-semibold text-sm sm:text-base truncate">{workout.workout_title}</h4>
                                                <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">{workout.workout_description}</p>
                                            </div>
                                            <Badge className={`shrink-0 text-xs ${statusColors[workout.status || 'Draft']}`}>
                                                {getStatusLabel(workout.status || 'Draft')}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm sm:text-base"
        >
          {successMessage}
        </motion.div>
      )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 mt-4">
            {/* Left Pane: Library - Mobile Optimized */}
            <div className="xl:col-span-4 space-y-4 order-2 xl:order-1">
              <Card>
                <CardHeader className="p-4 sm:p-6" dir="rtl">
                  <div className="me-auto w-fit max-w-full flex flex-col items-start gap-1.5 text-end">
                    <CardTitle className="text-lg sm:text-xl">התבניות שלי</CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-end">טען תבנית קיימת</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  {isLoadingData ? (
                    <div className="text-center py-4 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                      <p className="text-xs">טוען תבניות...</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 text-xs text-slate-500">
                        {templates?.length || 0} תבניות זמינות
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between text-sm">
                            <span className="truncate">
                              {templates && templates.length > 0 ? 'בחר תבנית לטעינה...' : 'אין תבניות זמינות'}
                            </span>
                            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="חפש תבנית..." className="text-sm" />
                            <CommandEmpty>לא נמצאו תבניות.</CommandEmpty>
                            <CommandList className="max-h-[400px] overflow-y-auto">
                              <CommandGroup>
                                {templates && templates.length > 0 ? (
                                  templates.map((template) => (
                                    <CommandItem
                                      key={template.id}
                                      value={`${template.template_name || template.workout_title || 'תבנית ללא שם'} ${template.workout_description || ''}`}
                                      onSelect={() => {
                                        loadTemplate(template);
                                      }}
                                      className="text-sm cursor-pointer"
                                    >
                                      <Check className={cn("me-2 h-4 w-4 opacity-0")} />
                                      <div className="flex-1">
                                        <div className="font-medium">{template.template_name || template.workout_title || 'תבנית ללא שם'}</div>
                                        {template.workout_description && (
                                          <div className="text-xs text-slate-500 truncate">{template.workout_description}</div>
                                        )}
                                        <div className="flex gap-2 mt-1">
                                          {template.workout_equipment && (
                                            <Badge variant="outline" className="text-xs">{template.workout_equipment}</Badge>
                                          )}
                                          {template.estimated_duration && (
                                            <Badge variant="outline" className="text-xs">{template.estimated_duration} דק'</Badge>
                                          )}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))
                                ) : (
                                  <CommandItem disabled>
                                    אין תבניות זמינות
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4 sm:p-6" dir="rtl">
                  <div className="me-auto w-fit max-w-full flex flex-col items-start gap-1.5 text-end">
                    <CardTitle className="text-lg sm:text-xl">ספריית תרגילים</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <Input
                    placeholder="🔍 חפש תרגיל, שריר, ציוד..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="text-sm"
                  />
                  <ScrollArea className="h-[300px] sm:h-[400px] xl:h-[70vh] mt-4">
                    <div className="space-y-2 pe-2">
                      {filteredExercises.map(ex => (
                        <div key={ex.id} className="p-3 rounded-md hover:bg-slate-100 flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{ex.name_he}</p>
                            <p className="text-xs text-slate-500">{ex.muscle_group} / {ex.equipment}</p>
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-1">
                              <div className="space-y-1">
                                <Button variant="ghost" className="w-full justify-start text-xs" onClick={() => addExercise('part_1_exercises', ex)}>חלק 1</Button>
                                <Button variant="ghost" className="w-full justify-start text-xs" onClick={() => addExercise('part_2_exercises', ex)}>חלק 2</Button>
                                <Button variant="ghost" className="w-full justify-start text-xs" onClick={() => addExercise('part_3_exercises', ex)}>חלק 3</Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ))}
                      {filteredExercises.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                          <p className="text-sm">לא נמצאו תרגילים תואמים</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Middle Pane: Builder - Mobile Optimized */}
            <div className="xl:col-span-5 space-y-4 order-1 xl:order-2">
              <Card>
                <CardHeader className="p-4 sm:p-6" dir="rtl">
                  <div className="me-auto w-fit max-w-full flex flex-col items-start gap-1.5 text-end">
                    <CardTitle className="text-lg sm:text-xl">חימום</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm">תיאור חימום</Label>
                            <Textarea
                                placeholder="תיאור פעילות החימום..."
                                value={workoutData.warmup_description}
                                onChange={e => setWorkoutData({...workoutData, warmup_description: e.target.value})}
                                rows={3}
                                className="text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-sm">משך החימום (דקות)</Label>
                            <Input
                                type="number"
                                placeholder="משך (דק')"
                                value={workoutData.warmup_duration}
                                onChange={e => setWorkoutData({...workoutData, warmup_duration: parseInt(e.target.value) || 0})}
                                min="0"
                                className="text-sm"
                            />
                        </div>
                    </div>
                </CardContent>
              </Card>
              {renderWorkoutPart('part_1_exercises')}
              {renderWorkoutPart('part_2_exercises')}
              {renderWorkoutPart('part_3_exercises')}
            </div>

            {/* Right Pane: Settings & Preview - Mobile Optimized */}
            <div className="xl:col-span-3 space-y-4 order-3">
              <div className="xl:sticky xl:top-4 space-y-4">
                <Card>
                  <CardHeader className="p-4 sm:p-6" dir="rtl">
                    <div className="me-auto w-fit max-w-full flex flex-col items-start gap-1.5 text-end">
                      <CardTitle className="text-lg sm:text-xl">פרטי אימון</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">שם האימון *</Label>
                        <Input
                          placeholder="למשל: יום רגליים למתחילים"
                          value={workoutData.workout_title}
                          onChange={e => setWorkoutData({...workoutData, workout_title: e.target.value})}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">תיאור האימון</Label>
                        <Textarea
                          placeholder="תיאור קצר של האימון"
                          value={workoutData.workout_description}
                          onChange={e => setWorkoutData({...workoutData, workout_description: e.target.value})}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">משך האימון</Label>
                        <Select 
                          value={String(workoutData.estimated_duration || 60)} 
                          onValueChange={(value) => setWorkoutData({...workoutData, estimated_duration: parseInt(value)})}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="בחר משך אימון" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 דקה</SelectItem>
                            <SelectItem value="5">5 דקות</SelectItem>
                            <SelectItem value="10">10 דקות</SelectItem>
                            <SelectItem value="15">15 דקות</SelectItem>
                            <SelectItem value="30">30 דקות</SelectItem>
                            <SelectItem value="60">1 שעה</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">ציוד נדרש</Label>
                        <Select 
                          value={workoutData.workout_equipment || 'none'} 
                          onValueChange={(value) => setWorkoutData({...workoutData, workout_equipment: value === 'none' ? '' : value})}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="בחר ציוד" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">ללא ציוד</SelectItem>
                            <SelectItem value="Bodyweight">משקל גוף</SelectItem>
                            <SelectItem value="Barbell">מוט</SelectItem>
                            <SelectItem value="Dumbbell">משקולות יד</SelectItem>
                            <SelectItem value="Kettlebell">כדור משקולת</SelectItem>
                            <SelectItem value="Machine">מכונה</SelectItem>
                            <SelectItem value="Cable">כבל</SelectItem>
                            <SelectItem value="Resistance Band">רצועת התנגדות</SelectItem>
                            <SelectItem value="Medicine Ball">כדור רפואי</SelectItem>
                            <SelectItem value="TRX">TRX</SelectItem>
                            <SelectItem value="Box">קופסה</SelectItem>
                            <SelectItem value="Pull-up Bar">מוט משיכה</SelectItem>
                            <SelectItem value="Rower">חתירה</SelectItem>
                            <SelectItem value="Bike">אופניים</SelectItem>
                            <SelectItem value="Treadmill">הליכון</SelectItem>
                            <SelectItem value="Sled">מזחלת</SelectItem>
                            <SelectItem value="Rings">טבעות</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 sm:p-6" dir="rtl">
                      <div className="me-auto w-fit max-w-full flex flex-col items-start gap-1.5 text-end">
                        <CardTitle className="text-lg sm:text-xl">קהל יעד</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm">יעד שליחה</Label>
                                <Select value={targetType} onValueChange={setTargetType}>
                                    <SelectTrigger className="text-sm">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">מתאמן יחיד</SelectItem>
                                        <SelectItem value="group">קבוצה</SelectItem>
                                        <SelectItem value="all">כל המתאמנים</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {targetType === 'user' && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between text-sm">
                                            <span className="truncate">
                                                {workoutData.target_user_email ?
                                                    users.find(u => u.email === workoutData.target_user_email)?.name || workoutData.target_user_email :
                                                    "בחר מתאמן..."}
                                            </span>
                                            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder="חפש מתאמן..." className="text-sm" />
                                            <CommandEmpty>לא נמצא מתאמן.</CommandEmpty>
                                            <CommandList className="max-h-[200px] overflow-y-auto">
                                                <CommandGroup>
                                                    {users.map((u) => (
                                                        <CommandItem
                                                            key={u.email}
                                                            value={u.email}
                                                            onSelect={(currentValue) => {
                                                                setWorkoutData({...workoutData, target_user_email: currentValue === workoutData.target_user_email ? "" : currentValue});
                                                            }}
                                                            className="text-sm"
                                                        >
                                                            <Check className={cn("me-2 h-4 w-4", workoutData.target_user_email === u.email ? "opacity-100" : "opacity-0")} />
                                                            <span className="truncate">{u.name} ({u.email})</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                            {targetType === 'group' && (
                                <Select value={workoutData.target_user_email} onValueChange={(value) => setWorkoutData({...workoutData, target_user_email: value})}>
                                    <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="בחר קבוצה"/>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px] overflow-y-auto">
                                        {groups.map(g => (
                                            <SelectItem key={g.id} value={g.name} className="text-sm">{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardHeader className="p-4 sm:p-6" dir="rtl">
                    <div className="me-auto w-fit max-w-full flex flex-col items-start gap-1.5 text-end">
                      <CardTitle className="text-lg sm:text-xl">תצוגה מקדימה</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="space-y-2 text-sm">
                      <p><strong>שם אימון:</strong> <span className="break-words">{workoutData.workout_title || 'ריק'}</span></p>
                      <p><strong>סה"כ תרגילים:</strong> {workoutData.part_1_exercises.length + workoutData.part_2_exercises.length + workoutData.part_3_exercises.length}</p>
                      <p><strong>יעד:</strong> <span className="break-words">{targetType === 'all' ? 'כל המתאמנים' : workoutData.target_user_email || 'טרם נבחר'}</span></p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
          {true && ( 
            <Card className="sticky bottom-0 z-10 mt-6 shadow-2xl bg-white/95 backdrop-blur-sm border-t">
              <CardContent className="p-4">
                <div className="flex flex-col space-y-4">
                  <div>
                    <Label className="text-sm font-medium">אפשרויות שליחה</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        variant={sendType === 'immediate' ? 'default' : 'outline'}
                        onClick={() => setSendType('immediate')}
                        size="sm"
                        className="text-xs"
                      >
                        <Send className="w-4 h-4 ms-2" />שלח מיד
                      </Button>
                      <Button
                        variant={sendType === 'scheduled' ? 'default' : 'outline'}
                        onClick={() => setSendType('scheduled')}
                        size="sm"
                        className="text-xs"
                      >
                        <Calendar className="w-4 h-4 ms-2" />תזמן
                      </Button>
                    </div>
                    {sendType === 'scheduled' && (
                      <Input
                        type="datetime-local"
                        value={workoutData.scheduled_date}
                        onChange={(e) => setWorkoutData({...workoutData, scheduled_date: e.target.value})}
                        className="mt-2 text-sm"
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {typeof onOpenAICreate === 'function' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1 sm:flex-none border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={onOpenAICreate}
                      >
                        <Wand2 className="w-4 h-4 ms-2" />
                        יצירה עם AI
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleSaveAsDraft}
                      disabled={isSaving}
                      size="sm"
                      className="text-xs flex-1 sm:flex-none"
                    >
                      <Save className="w-4 h-4 ms-2" />
                      {isSaving ? 'שומר...' : 'שמור טיוטה'}
                    </Button>

                    <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs flex-1 sm:flex-none">
                                <Save className="w-4 h-4 ms-2" />שמור כתבנית
                            </Button>
                        </DialogTrigger>
                        <DialogContent dir="rtl" className="w-[95vw] max-w-md">
                            <DialogHeader>
                                <DialogTitle>שמירה כתבנית</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm">שם התבנית</Label>
                                    <Input
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="למשל: אימון רגליים בסיסי"
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)} size="sm">
                                    ביטול
                                </Button>
                                <Button onClick={handleSaveAsTemplate} size="sm">
                                    שמור תבנית
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {sendType === 'scheduled' ? (
                      <Button
                        onClick={handleScheduleWorkout}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-xs flex-1 sm:flex-none"
                        size="sm"
                      >
                        <Calendar className="w-4 h-4 ms-2" />
                        {isSaving ? 'שומר...' : 'תזמן שליחה'}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSendWorkout}
                        disabled={isSending}
                        className="bg-green-600 hover:bg-green-700 text-xs flex-1 sm:flex-none"
                        size="sm"
                      >
                        <Send className="w-4 h-4 ms-2" />
                        {isSending ? 'שולח...' : 'שלח אימון'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workout Details Dialog - Mobile Optimized */}
          <Dialog open={!!viewedWorkout} onOpenChange={(isOpen) => !isOpen && setViewedWorkout(null)}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden" dir="rtl">
              {viewedWorkout && (
                <>
                  <DialogHeader className="p-4 sm:p-6 text-end">
                    <DialogTitle className="text-xl sm:text-2xl">{viewedWorkout.workout_title}</DialogTitle>
                    <div className="text-sm text-slate-500 pt-2 text-end">
                      <p className="line-clamp-3">{viewedWorkout.workout_description}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 justify-end">
                        <Badge className={statusColors[viewedWorkout.status || 'Draft']}>{getStatusLabel(viewedWorkout.status || 'Draft')}</Badge>
                        {viewedWorkout.created_date && <span><strong>נוצר:</strong> {format(new Date(viewedWorkout.created_date), 'dd/MM/yyyy HH:mm')}</span>}
                      </div>
                      <div className="mt-2 space-y-1 text-end">
                        <p><strong>יעד:</strong> <span className="break-words">{viewedWorkout.target_user_email === 'all' ? 'כל המתאמנים' : viewedWorkout.target_user_email}</span></p>
                        {viewedWorkout.sent_date && <p><strong>נשלח/תוזמן:</strong> {format(new Date(viewedWorkout.sent_date), 'dd/MM/yyyy HH:mm')}</p>}
                      </div>
                    </div>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh] p-4 sm:p-6">
                    <div className="space-y-4 text-end">
                      {viewedWorkout.warmup_description && (
                          <div>
                              <h4 className="font-semibold text-lg mb-2">חימום ({viewedWorkout.warmup_duration} דקות)</h4>
                              <p className="p-3 bg-slate-50 rounded-md border text-sm">{viewedWorkout.warmup_description}</p>
                          </div>
                      )}
                      {['part_1_exercises', 'part_2_exercises', 'part_3_exercises'].map(part => (
                        viewedWorkout[part] && viewedWorkout[part].length > 0 && (
                          <div key={part}>
                            <h4 className="font-semibold text-lg mb-2">{partLabels[part]}</h4>
                            <div className="space-y-2">
                              {viewedWorkout[part].map((ex, index) => (
                                <div key={index} className="p-3 bg-slate-50 rounded-md border text-end">
                                  <p className="font-bold text-slate-800">{ex.name} ({ex.category})</p>
                                  <p className="text-sm text-slate-600">
                                    {ex.suggested_sets} סטים &times; {ex.suggested_reps} חזרות
                                    {ex.suggested_weight > 0 ? ` @ ${ex.suggested_weight} ק"ג` : ''}
                                    {ex.suggested_duration > 0 ? ` / ${ex.suggested_duration} שניות` : ''}
                                  </p>
                                  {ex.notes && <p className="text-xs text-slate-500 mt-1"><strong>הערות:</strong> {ex.notes}</p>}
                                  {ex.video_url && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                        צפה בסרטון
                                      </a>
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </ScrollArea>
                  <DialogFooter className="gap-2 p-4 sm:p-6 justify-start">
                    <Button variant="outline" onClick={() => setViewedWorkout(null)} size="sm">סגור</Button>
                    <Button onClick={() => handleEditWorkout(viewedWorkout)} size="sm">
                      <Edit className="w-4 h-4 ms-2" />
                      ערוך / שלח מחדש
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
    </div>
  );
};

// (AIWorkoutBuilder tab removed - was "בניית אימון חכם")


export default function WorkoutCreator({ templateToLoad, onTemplateLoaded, user: userProp }) {
    const { user: currentUser, isSystemAdmin } = useAdminDashboard();
    const user = userProp ?? currentUser;
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [exercises, setExercises] = useState([]); 
  const [templates, setTemplates] = useState([]);
  const [existingWorkouts, setExistingWorkouts] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const [activeTab, setActiveTab] = useState('manual');
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [textWorkout, setTextWorkout] = useState('');
  const [textTemplateName, setTextTemplateName] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);
  const [parseError, setParseError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // New states for AI text parsing
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedWorkout, setParsedWorkout] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [templateToLoadForManualBuilder, setTemplateToLoadForManualBuilder] = useState(null);


  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async (isRetry = false) => {
    if (!isRetry) {
      setIsLoadingData(true);
    }
    setLoadError('');

    try {
      const timeoutPromise = (ms) => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), ms)
      );

      const loadWithRetry = async (entityLoader, entityName, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await Promise.race([entityLoader(), timeoutPromise(10000)]);
          } catch (error) {
            console.warn(`Attempt ${i + 1} failed for ${entityName}:`, error.message);
            if (i === maxRetries - 1) {
              console.error(`Failed to load ${entityName} after ${maxRetries} attempts`);
              return [];
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
        return [];
      };

      const [usersData, groupsData, exercisesData, templatesData, workoutsData] = await Promise.all([
        loadWithRetry(() => User.listForStaff(currentUser).then(us => us.filter(u => u.role !== 'admin' && u.role !== 'trainer')), 'Users'),
        loadWithRetry(() => UserGroup.list(), 'UserGroups'),
        loadWithRetry(() => ExerciseDefinition.list(), 'ExerciseDefinitions'),
        loadWithRetry(() => WorkoutTemplate.list('-created_date'), 'WorkoutTemplates'),
        loadWithRetry(() => PreMadeWorkout.list(), 'PreMadeWorkouts')
      ]);

      setUsers(usersData || []);
      setGroups(groupsForStaff(groupsData || [], currentUser, isSystemAdmin));
      setExercises(exercisesData || []); 
      setTemplates(templatesData || []);
      setExistingWorkouts(workoutsData || []);
      setRetryCount(0);
      
      // Debug: Log templates count
      console.log('📋 Loaded templates:', templatesData?.length || 0);
      console.log('📋 Templates data:', templatesData);
      if (templatesData && templatesData.length > 0) {
        console.log('📋 First template:', templatesData[0]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setLoadError(`שגיאה בטעינת הנתונים: ${error.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    loadData(true);
  };

  const analyzeWorkoutText = async () => {
    if (!textWorkout.trim()) {
      setParseError('אנא הכנס טקסט אימון לפני הניתוח');
      return;
    }

    setIsAnalyzing(true);
    setParseError('');
    setParsedWorkout(null);
    setAnalysisResults(null);
    
    try {
      // Create exercises list for AI context
      const exercisesList = exercises.map(ex => ({
        name_he: ex.name_he,
        name_en: ex.name_en || '',
        category: ex.category,
        muscle_group: ex.muscle_group,
        equipment: ex.equipment
      }));

      const prompt = `
אנתח את הטקסט הבא של אימון והתאם תרגילים מהמאגר הנתון.

חשוב מאוד: כל התוכן חייב להיות בעברית בלבד! כל השדות (workout_title, workout_description, warmup_description, notes) חייבים להיות בעברית.

טקסט האימון:
${textWorkout}

מאגר תרגילים זמין:
${exercisesList.map(ex => `- ${ex.name_he} (${ex.category}, ${ex.muscle_group}, ${ex.equipment})`).join('\n')}

בצע התאמה חכמה של תרגילים מהטקסט לתרגילים במאגר. התאם גם אם השמות לא זהים בדיוק (למשל "דחיפות" = "Push Up", "סקוואט" = "Squat").

החזר JSON עם המבנה הבא (כל השדות בעברית!):
{
  "workout_title": "כותרת מוצעת לאימון בעברית",
  "workout_description": "תיאור קצר של האימון בעברית",
  "warmup_description": "תיאור חימום מוצע בעברית",
  "warmup_duration": 10,
  "parts": [
    {
      "part_number": 1,
      "exercises": [
        {
          "matched_exercise": "שם התרגיל שנמצא במאגר (name_he)",
          "original_text": "הטקסט המקורי מהאימון",
          "suggested_sets": 3,
          "suggested_reps": 12,
          "suggested_weight": 0,
          "notes": "הערות אם יש בעברית",
          "confidence": 95
        }
      ]
    }
  ],
  "unmatched_exercises": ["תרגילים שלא נמצא להם התאמה", "לדוגמה: תרגיל לא קיים"]
}

זכור: כל הטקסט חייב להיות בעברית! אין להשתמש באנגלית בשום שדה.
`;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            workout_title: { type: "string" },
            workout_description: { type: "string" },
            warmup_description: { type: "string" },
            warmup_duration: { type: "number" },
            parts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  part_number: { type: "number" },
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        matched_exercise: { type: "string" },
                        original_text: { type: "string" },
                        suggested_sets: { type: "number" },
                        suggested_reps: { type: "number" },
                        suggested_weight: { type: "number" },
                        notes: { type: "string" },
                        confidence: { type: "number" }
                      }
                    }
                  }
                }
              }
            },
            unmatched_exercises: { type: "array", items: { type: "string" } },
            workout_equipment: { type: "string" }
          },
          required: ["workout_title", "parts"] // Added required fields to improve AI response
        }
      });

      // Process the AI response and create workout structure
      const exerciseMap = new Map(exercises.map(ex => [ex.name_he, ex]));
      
      // Helper function to detect if text is mostly English (simple heuristic)
      const isMostlyEnglish = (text) => {
        if (!text || typeof text !== 'string') return false;
        // Count Hebrew characters (Unicode range for Hebrew)
        const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
        // Count English letters
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        return englishChars > hebrewChars * 2; // If English chars are more than 2x Hebrew, consider it English
      };
      
      // Helper to add warning for English content
      const processText = (text, fieldName) => {
        if (!text) return '';
        if (isMostlyEnglish(text)) {
          console.warn(`Warning: ${fieldName} appears to be in English:`, text);
          // Could add automatic translation here in the future
        }
        return text;
      };
      
      const processedWorkout = {
        workout_title: processText(response.workout_title, 'workout_title') || textTemplateName || 'אימון חדש',
        workout_description: processText(response.workout_description, 'workout_description') || '',
        warmup_description: processText(response.warmup_description, 'warmup_description') || 'חימום כללי קל',
        warmup_duration: response.warmup_duration || 10,
        workout_equipment: response.workout_equipment || '',
        part_1_exercises: [],
        part_2_exercises: [],
        part_3_exercises: []
      };

      // Process each part
      response.parts?.forEach(part => {
        // Ensure part number is valid and cap it at 3 for 'part_X_exercises' keys
        const partKey = `part_${Math.min(Math.max(1, part.part_number), 3)}_exercises`;
        
        part.exercises?.forEach(exercise => {
          // Process notes if they exist
          if (exercise.notes) {
            exercise.notes = processText(exercise.notes, 'exercise.notes');
          }
          
          const matchedExercise = exerciseMap.get(exercise.matched_exercise);
          if (matchedExercise) {
            // Ensure suggested_weight is a number or 0 if null/undefined/NaN
            const suggestedWeight = parseFloat(exercise.suggested_weight);
            processedWorkout[partKey].push({
              id: matchedExercise.id,
              name: matchedExercise.name_he,
              category: matchedExercise.category,
              video_url: matchedExercise.video_url,
              suggested_sets: exercise.suggested_sets || 3,
              suggested_reps: exercise.suggested_reps || 12,
              suggested_weight: isNaN(suggestedWeight) ? 0 : suggestedWeight,
              suggested_duration: 0, // AI doesn't currently provide this, default to 0
              notes: exercise.notes || '',
              confidence: exercise.confidence || 0,
              original_text: exercise.original_text
            });
          }
        });
      });

      setParsedWorkout(processedWorkout);
      setAnalysisResults({
        unmatched_exercises: response.unmatched_exercises || [],
        total_exercises: response.parts?.reduce((sum, part) => sum + (part.exercises?.length || 0), 0) || 0
      });

      // Auto-fill template name if not set
      if (!textTemplateName && response.workout_title) {
        setTextTemplateName(response.workout_title);
      }

    } catch (error) {
      console.error('Error analyzing workout:', error);
      setParseError('שגיאה בניתוח הטקסט. אנא בדוק את החיבור לאינטרנט ונסה שוב. ייתכן שפורמט התשובה שונה מהצפוי.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnalyzedTemplate = async () => {
    if (!parsedWorkout) {
      alert('אנא נתח תחילה את טקסט האימון');
      return;
    }

    setIsSavingText(true);
    try {
      await WorkoutTemplate.create({
        template_name: textTemplateName || parsedWorkout.workout_title || 'תבנית אימון (מטקסט)',
        ...parsedWorkout
      });
      
      setSuccessMessage('תבנית האימון נשמרה בהצלחה!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Reset form
      setTextWorkout('');
      setTextTemplateName('');
      setParsedWorkout(null);
      setAnalysisResults(null);
      loadData(); // Reload templates for the template list
      
    } catch (error) {
      console.error('Error saving template:', error);
      setParseError('שגיאה בשמירת התבנית');
    } finally {
      setIsSavingText(false);
    }
  };

  const handleSendAnalyzedWorkout = async () => {
    if (!parsedWorkout) {
      alert('אנא נתח תחילה את טקסט האימון');
      return;
    }

    // Set the AI-parsed workout data to be loaded by the ManualWorkoutBuilder
    setTemplateToLoadForManualBuilder(parsedWorkout);
    setActiveTab('manual');

    // Clear the text-based builder states
    setTextWorkout('');
    setTextTemplateName('');
    setParsedWorkout(null);
    setAnalysisResults(null);
  };


  if (isLoadingData && retryCount === 0) { 
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">טוען נתוני בונה האימונים...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">שגיאה בטעינת הנתונים</h3>
            <p className="text-red-600 mb-4">{loadError}</p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleRetry}
                disabled={isLoadingData}
                className="bg-red-600 hover:bg-red-700"
              >
                {isLoadingData ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white me-2"></div>
                    מנסה שוב...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 ms-2" />
                    נסה שוב ({retryCount > 0 ? `ניסיון ${retryCount + 1}` : 'ניסיון ראשון'})
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                רענן דף
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm sm:text-base"
        >
          {successMessage}
        </motion.div>
      )}
      <ManualWorkoutBuilder
        templateToLoad={templateToLoadForManualBuilder || templateToLoad}
        onTemplateLoaded={() => {
          if (onTemplateLoaded) onTemplateLoaded();
          setTemplateToLoadForManualBuilder(null);
        }}
        user={user}
        users={users}
        groups={groups}
        exercises={exercises}
        templates={templates}
        existingWorkouts={existingWorkouts}
        isLoadingData={isLoadingData}
        loadError={loadError}
        retryCount={retryCount}
        handleRetry={handleRetry}
        onWorkoutSaved={loadData}
        onOpenAICreate={() => setIsAIDialogOpen(true)}
      />

      {/* Create with AI – dialog (content from former "יצירה מטקסט חכמה" tab) */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent dir="rtl" className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-0 text-end">
            <DialogTitle className="flex items-center gap-2 justify-start">
              <span>יצירת אימון חכמה מטקסט</span>
              <Wand2 className="w-5 h-5 text-purple-600 shrink-0" />
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pr-4">
              <Card className="text-end">
                <CardHeader className="text-end">
                  <CardTitle className="text-base">טקסט האימון</CardTitle>
                  <CardDescription className="text-end">הדבק או כתוב את האימון בפורמט חופשי</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-end">
                  <div>
                    <Label htmlFor="text-template-name" className="text-end">שם האימון</Label>
                    <Input
                      id="text-template-name"
                      placeholder="לדוגמה: אימון רגליים מתחילים"
                      value={textTemplateName}
                      onChange={(e) => setTextTemplateName(e.target.value)}
                      className="mt-1 text-end"
                    />
                  </div>
                  <div>
                    <Label htmlFor="text-workout" className="text-end">טקסט האימון</Label>
                    <Textarea
                      id="text-workout"
                      rows={10}
                      placeholder={`חימום: ריצה קלה 5 דקות\n\nחלק 1:\n- סקוואט 4 סטים של 12 חזרות\n- לחיצת חזה 3x10\n\nחלק 2:\n- פלאנק 3x30 שניות`}
                      value={textWorkout}
                      onChange={(e) => setTextWorkout(e.target.value)}
                      className="mt-1 text-end"
                    />
                  </div>
                  <Button
                    onClick={analyzeWorkoutText}
                    disabled={isAnalyzing || !textWorkout.trim()}
                    className="w-full justify-center"
                  >
                    {isAnalyzing ? (
                      <><Loader2 className="w-4 h-4 ms-2 animate-spin" /> מנתח...</>
                    ) : (
                      <><Wand2 className="w-4 h-4 ms-2" /> נתח עם AI</>
                    )}
                  </Button>
                  {parseError && (
                    <Alert variant="destructive" className="text-end">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{parseError}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="text-end">
                <CardHeader className="text-end">
                  <CardTitle className="text-base">תצוגה מקדימה</CardTitle>
                </CardHeader>
                <CardContent>
                  {!parsedWorkout && !isAnalyzing && (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>הכנס טקסט אימון ולחץ "נתח עם AI"</p>
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="text-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-purple-600" />
                      <p className="text-sm">AI מנתח את האימון...</p>
                    </div>
                  )}
                  {parsedWorkout && (
                    <div className="space-y-4 text-end">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-end">
                        <div className="flex items-center gap-2 mb-1 justify-end">
                          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                          <span className="font-semibold text-green-800 text-sm">ניתוח הושלם בהצלחה!</span>
                        </div>
                        {analysisResults?.unmatched_exercises?.length > 0 && (
                          <p className="text-xs text-orange-600 mt-1 text-end">
                            לא זוהו: {analysisResults.unmatched_exercises.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2 text-end">
                        <h4 className="font-semibold text-sm">{parsedWorkout.workout_title}</h4>
                        {parsedWorkout.warmup_description && (
                          <div className="p-2 bg-blue-50 rounded text-xs text-end">
                            חימום: {parsedWorkout.warmup_description}
                          </div>
                        )}
                        {['part_1_exercises', 'part_2_exercises', 'part_3_exercises'].map((partKey, idx) => (
                          parsedWorkout[partKey]?.length > 0 && (
                            <div key={partKey} className="text-end">
                              <h5 className="font-medium text-xs mt-2">חלק {idx + 1}</h5>
                              {parsedWorkout[partKey].map((ex, i) => (
                                <div key={i} className="p-2 bg-slate-50 rounded text-xs text-end">
                                  {ex.name} — {ex.suggested_sets}×{ex.suggested_reps}
                                  {ex.suggested_weight > 0 && ` @ ${ex.suggested_weight}ק"ג`}
                                </div>
                              ))}
                            </div>
                          )
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-3 justify-end">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setTemplateToLoadForManualBuilder({
                              ...parsedWorkout,
                              estimated_duration: parsedWorkout.estimated_duration || 60,
                              target_user_email: '',
                              scheduled_date: '',
                              status: 'Draft',
                              is_sent: false,
                              sent_date: null
                            });
                            setIsAIDialogOpen(false);
                            setTextWorkout('');
                            setTextTemplateName('');
                            setParsedWorkout(null);
                            setAnalysisResults(null);
                          }}
                        >
                          <Dumbbell className="w-4 h-4 ms-2" />
                          טען לבנאי הידני
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleSaveAnalyzedTemplate} disabled={isSavingText}>
                          {isSavingText ? <Loader2 className="w-4 h-4 ms-2 animate-spin" /> : <Save className="w-4 h-4 ms-2" />}
                          שמור כתבנית
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleSendAnalyzedWorkout}>
                          <Send className="w-4 h-4 ms-2" />שלח למתאמנים
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
