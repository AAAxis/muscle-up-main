
import React, { useState, useEffect, useMemo } from 'react';
import { WeightEntry, CalorieTracking, WaterTracking, ProgressPicture, Workout, CoachMenu, CoachMessage } from '@/api/entities';
import { SendFCMNotification } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

import {
  Calendar,
  Scale,
  Activity,
  AlertTriangle,
  Zap,
  Droplets,
  Target,
  HeartPulse,
  Dumbbell,
  Loader2,
  User,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Recycle,
  Ruler,
  Edit2,
  Save,
  X,
  Utensils,
  Camera,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/components/utils/timeUtils';
import { useToast } from '@/components/ui/use-toast';

export default function UserTrackingTab({ user, showUserHeader = true }) {
  const { toast } = useToast();
  const [weightEntries, setWeightEntries] = useState([]);
  const [calorieEntries, setCalorieEntries] = useState([]);
  const [waterEntries, setWaterEntries] = useState([]);
  const [progressPictures, setProgressPictures] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [coachMenu, setCoachMenu] = useState(null);
  const [sharedMeals, setSharedMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeasurement, setSelectedMeasurement] = useState(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(false);

  useEffect(() => {
    if (user?.email) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const [weights, calories, water, pictures, completedWorkouts, menus, meals] = await Promise.all([
        WeightEntry.filter({ user_email: user.email }, '-date'),
        CalorieTracking.filter({ user_email: user.email }, '-date'),
        WaterTracking.filter({ user_email: user.email }, '-date'),
        ProgressPicture.filter({ user_email: user.email }, '-photo_date'),
        Workout.filter({ created_by: user.email, status: 'הושלם' }, '-date'),
        CoachMenu.filter({ user_email: user.email }, '-upload_date', 1),
        CalorieTracking.filter({ user_email: user.email, shared_with_coach: true }, '-date'),
      ]);

      const measurementsWithType = (weights || []).map(measurement => ({
        ...measurement,
        measurementType: identifyMeasurementType(measurement)
      }));

      setWeightEntries(measurementsWithType);
      setCalorieEntries(calories || []);
      setWaterEntries(water || []);
      setProgressPictures(pictures || []);
      setWorkouts(completedWorkouts || []);
      setCoachMenu(menus.length > 0 ? menus[0] : null);
      setSharedMeals(meals || []);
    } catch (error) {
      console.error('Error loading user data:', error);
      setWeightEntries([]);
      setCalorieEntries([]);
      setWaterEntries([]);
      setProgressPictures([]);
      setWorkouts([]);
      setCoachMenu(null);
      setSharedMeals([]);
    } finally {
      setIsLoading(false);
    }
  };

  const identifyMeasurementType = (measurement) => {
    const hasBodyComposition = measurement.fat_percentage ||
      measurement.muscle_mass ||
      measurement.body_water_percentage ||
      measurement.metabolic_age ||
      measurement.visceral_fat ||
      measurement.physique_rating ||
      measurement.bmr;

    const hasCircumferences = measurement.chest_circumference ||
      measurement.waist_circumference ||
      measurement.glutes_circumference ||
      measurement.neck_circumference ||
      measurement.bicep_circumference_right ||
      measurement.bicep_circumference_left ||
      measurement.thigh_circumference_right ||
      measurement.thigh_circumference_left ||
      measurement.calf_circumference_right ||
      measurement.calf_circumference_left;

    if (hasBodyComposition || hasCircumferences) {
      return 'coach';
    }

    return 'user';
  };

  const handleViewDetails = (measurement) => {
    setSelectedMeasurement(measurement);
    setIsDetailViewOpen(true);
  };

  const coachMeasurements = useMemo(() => {
    return weightEntries.filter(m => m.measurementType === 'coach');
  }, [weightEntries]);

  const progressData = useMemo(() => {
    if (coachMeasurements.length < 2) return null;

    const latest = coachMeasurements[0];
    const previous = coachMeasurements[1];

    const calculateChange = (current, prev, unit = '') => {
      const currentVal = parseFloat(current);
      const prevVal = parseFloat(prev);

      if (isNaN(currentVal) || isNaN(prevVal)) return null;

      const change = currentVal - prevVal;
      const isPositive = change > 0;
      const isSignificant = Math.abs(change) >= 0.1; // Define what makes a change "significant"

      return {
        current: currentVal,
        previous: prevVal,
        change: change.toFixed(1),
        isPositive,
        isSignificant,
        unit,
        displayChange: `${isPositive ? '+' : ''}${change.toFixed(1)}${unit}`
      };
    };

    return {
      weight: calculateChange(latest.weight, previous.weight, ' ק"ג'),
      bmi: calculateChange(latest.bmi, previous.bmi),
      fatPercentage: calculateChange(latest.fat_percentage, previous.fat_percentage, '%'),
      muscleMass: calculateChange(latest.muscle_mass, previous.muscle_mass, ' ק"ג'),
      metabolicAge: calculateChange(latest.metabolic_age, previous.metabolic_age, ' שנים'),
      visceralFat: calculateChange(latest.visceral_fat, previous.visceral_fat),
      bodyWater: calculateChange(latest.body_water_percentage, previous.body_water_percentage, '%'),
      physiqueRating: calculateChange(latest.physique_rating, previous.physique_rating),
      bmr: calculateChange(latest.bmr, previous.bmr, ' קק"ל'),
      chestCircumference: calculateChange(latest.chest_circumference, previous.chest_circumference, ' ס"מ'),
      waistCircumference: calculateChange(latest.waist_circumference, previous.waist_circumference, ' ס"מ'),
      glutesCircumference: calculateChange(latest.glutes_circumference, previous.glutes_circumference, ' ס"מ'),
      latestDate: formatDate(latest.date),
      previousDate: formatDate(previous.date)
    };
  }, [coachMeasurements]);

  const weightChartData = useMemo(() => {
    return weightEntries
      .filter(m => m.weight)
      .slice(0, 15)
      .reverse()
      .map(measurement => ({
        date: formatDate(measurement.date),
        weight: parseFloat(measurement.weight),
        isCoach: measurement.measurementType === 'coach'
      }));
  }, [weightEntries]);

  const ProgressIndicator = ({ data, label, icon: Icon, isGoodWhenUp = false }) => {
    if (!data || !data.isSignificant) return null;

    const isGoodChange = isGoodWhenUp ? data.isPositive : !data.isPositive;
    const colorClass = isGoodChange ? 'text-green-600' : 'text-red-600';
    const bgClass = isGoodChange ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';

    const TrendIcon = data.isPositive ? TrendingUp : TrendingDown;

    return (
      <div className={`p-3 rounded-lg border ${bgClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-600">{label}</span>
          </div>
          <div className={`flex items-center gap-1 ${colorClass}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm font-bold">{data.displayChange}</span>
          </div>
        </div>
      </div>
    );
  };

  const MeasurementTypeIndicator = ({ type }) => {
    if (type === 'coach') {
      return (
        <div className="flex items-center gap-1 text-xs text-purple-600">
          <UserCheck className="w-3 h-3" />
          <span>מדידת מאמן</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-xs text-blue-600">
          <User className="w-3 h-3" />
          <span>מדידת משתמש</span>
        </div>
      );
    }
  };

  const getLatestMeasurement = () => {
    return weightEntries.length > 0 ? weightEntries[0] : null;
  };

  const getWeightProgress = () => {
    if (weightEntries.length < 2 || !weightEntries[0].weight || !weightEntries[1].weight) return null;
    const latest = weightEntries[0];
    const previous = weightEntries[1];
    const change = parseFloat(latest.weight) - parseFloat(previous.weight);
    if (isNaN(change)) return null;
    return {
      current: latest.weight,
      change: change.toFixed(1),
      isPositive: change > 0
    };
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setEditForm({
      date: entry.date ? entry.date.split('T')[0] : '', // Format to YYYY-MM-DD for date input type
      weight: entry.weight || '',
      fat_percentage: entry.fat_percentage || '',
      muscle_mass: entry.muscle_mass || '',
      bmr: entry.bmr || '',
      metabolic_age: entry.metabolic_age || '',
      visceral_fat: entry.visceral_fat || '',
      body_water_percentage: entry.body_water_percentage || '',
      physique_rating: entry.physique_rating || '',
      neck_circumference: entry.neck_circumference || '',
      chest_circumference: entry.chest_circumference || '',
      waist_circumference: entry.waist_circumference || '',
      glutes_circumference: entry.glutes_circumference || '',
      thigh_circumference_right: entry.thigh_circumference_right || '',
      thigh_circumference_left: entry.thigh_circumference_left || '',
      calf_circumference_right: entry.calf_circumference_right || '',
      calf_circumference_left: entry.calf_circumference_left || '',
      bicep_circumference_right: entry.bicep_circumference_right || '',
      bicep_circumference_left: entry.bicep_circumference_left || '',
      notes: entry.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleEditFormChange = (e) => {
    const { id, value } = e.target;
    setEditForm(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    setIsSaving(true);
    try {
      const updateData = {
        date: editForm.date,
        weight: editForm.weight ? parseFloat(editForm.weight) : null,
        height: user.height, // Use user's height for BMI calculation
        fat_percentage: editForm.fat_percentage ? parseFloat(editForm.fat_percentage) : null,
        muscle_mass: editForm.muscle_mass ? parseFloat(editForm.muscle_mass) : null,
        bmr: editForm.bmr ? parseFloat(editForm.bmr) : null,
        metabolic_age: editForm.metabolic_age ? parseInt(editForm.metabolic_age) : null,
        visceral_fat: editForm.visceral_fat ? parseFloat(editForm.visceral_fat) : null,
        body_water_percentage: editForm.body_water_percentage ? parseFloat(editForm.body_water_percentage) : null,
        physique_rating: editForm.physique_rating ? parseInt(editForm.physique_rating) : null,
        neck_circumference: editForm.neck_circumference ? parseFloat(editForm.neck_circumference) : null,
        chest_circumference: editForm.chest_circumference ? parseFloat(editForm.chest_circumference) : null,
        waist_circumference: editForm.waist_circumference ? parseFloat(editForm.waist_circumference) : null,
        glutes_circumference: editForm.glutes_circumference ? parseFloat(editForm.glutes_circumference) : null,
        thigh_circumference_right: editForm.thigh_circumference_right ? parseFloat(editForm.thigh_circumference_right) : null,
        thigh_circumference_left: editForm.thigh_circumference_left ? parseFloat(editForm.thigh_circumference_left) : null,
        calf_circumference_right: editForm.calf_circumference_right ? parseFloat(editForm.calf_circumference_right) : null,
        calf_circumference_left: editForm.calf_circumference_left ? parseFloat(editForm.calf_circumference_left) : null,
        bicep_circumference_right: editForm.bicep_circumference_right ? parseFloat(editForm.bicep_circumference_right) : null,
        bicep_circumference_left: editForm.bicep_circumference_left ? parseFloat(editForm.bicep_circumference_left) : null,
        notes: editForm.notes,
      };

      // Calculate BMI if weight and height are available
      if (updateData.weight !== null && user.height) {
        const heightInMeters = user.height > 3 ? user.height / 100 : user.height; // Assume height in cm if > 3, else meters
        const bmi = Math.round((updateData.weight / (heightInMeters * heightInMeters)) * 10) / 10;
        updateData.bmi = bmi;

        // Set BMI category
        if (bmi < 18.5) updateData.bmi_category = "תת-משקל";
        else if (bmi < 25) updateData.bmi_category = "משקל תקין";
        else if (bmi < 30) updateData.bmi_category = "עודף משקל";
        else updateData.bmi_category = "השמנה";

        updateData.bmi_alert = bmi < 18.5 || bmi >= 30;
      } else {
        updateData.bmi = null;
        updateData.bmi_category = null;
        updateData.bmi_alert = false;
      }

      await WeightEntry.update(editingEntry.id, updateData);

      // Reload data
      await loadUserData();

      setIsEditDialogOpen(false);
      setEditingEntry(null);
      setEditForm({});
    } catch (error) {
      console.error("Error updating weight entry:", error);
      alert("שגיאה בעדכון המדידה");
    } finally {
      setIsSaving(false);
    }
  };

  const getMealTypeEmoji = (mealType) => {
    const emojiMap = {
      'ארוחת בוקר': '🌅',
      'ארוחת ביניים': '🍎',
      'ארוחת צהריים': '☀️',
      'ארוחת ערב': '🌙',
      'חטיף': '🍪',
      'אחר': '🍽️'
    };
    return emojiMap[mealType] || '🍽️';
  };

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim()) {
      toast({
        title: "שגיאה",
        description: "נא להזין הודעת משוב",
        variant: "destructive",
      });
      return;
    }

    setIsSendingFeedback(true);
    try {
      await CoachMessage.create({
        user_email: user.email,
        message_text: feedbackMessage.trim(),
        is_read: false,
      });

      const notificationTitle = 'משוב מהמאמן';
      const notificationBody = feedbackMessage.trim().slice(0, 80) + (feedbackMessage.trim().length > 80 ? '...' : '');
      try {
        await SendFCMNotification({
          userEmail: user.email,
          title: notificationTitle,
          body: notificationBody,
          data: { type: 'coach_message', user_email: user.email },
        });
      } catch (fcmErr) {
        console.warn('FCM push failed for', user.email, fcmErr);
      }
      try {
        const emailRes = await fetch('/api/send-group-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: user.email,
            title: notificationTitle,
            message: feedbackMessage.trim(),
          }),
        });
        const emailData = await emailRes.json().catch(() => ({}));
        if (emailData.success !== true || (emailData.successCount === 0 && emailData.failureCount > 0)) {
          console.warn('Email failed for', user.email, emailData.error || emailData);
        }
      } catch (emailErr) {
        console.warn('Email send failed for', user.email, emailErr);
      }

      toast({
        title: "הצלחה",
        description: "המשוב נשלח בהצלחה למתאמן",
      });

      setFeedbackMessage('');
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast({
        title: "שגיאה",
        description: "שליחת המשוב נכשלה",
        variant: "destructive",
      });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        <span className="me-3 text-slate-600">טוען נתוני מעקב...</span>
      </div>
    );
  }

  const latestMeasurement = getLatestMeasurement();
  const weightProgress = getWeightProgress();

  return (
    <>
      <div className="space-y-6">
        {showUserHeader && (
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
              <p className="text-slate-600">{user.email}</p>
            </div>
          </div>
        )}

        {/* Coach Feedback Card - Collapsible */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader
            className="cursor-pointer hover:bg-blue-100/50 transition-colors"
            onClick={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-blue-800">שלח משוב למתאמן</CardTitle>
              </div>
              {isFeedbackExpanded ? (
                <ChevronUp className="w-5 h-5 text-blue-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-blue-600" />
              )}
            </div>
            {!isFeedbackExpanded && (
              <CardDescription className="mt-2">
                לחץ להרחבה ושליחת משוב למתאמן
              </CardDescription>
            )}
          </CardHeader>

          {isFeedbackExpanded && (
            <CardContent className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              <CardDescription>
                המתאמן יקבל את ההודעה במרכז העדכונים שלו ויצטרך לאשר קריאה
              </CardDescription>
              <div className="space-y-2">
                <Label htmlFor="feedback-message">הודעת משוב</Label>
                <Textarea
                  id="feedback-message"
                  placeholder="כתוב כאן משוב אישי למתאמן..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  className="min-h-[120px] text-base"
                  disabled={isSendingFeedback}
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">
                  שולח ל: <strong>{user.name}</strong> ({user.email})
                </p>
                <Button
                  onClick={handleSendFeedback}
                  disabled={isSendingFeedback || !feedbackMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSendingFeedback ? (
                    <>
                      <Loader2 className="w-4 h-4 ms-2 animate-spin" />
                      שולח...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 ms-2" />
                      שלח משוב
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">משקל נוכחי</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {latestMeasurement?.weight || user.current_weight || 'N/A'} ק"ג
                  </p>
                  {weightProgress && (
                    <p className={`text-sm ${weightProgress.isPositive ? 'text-red-600' : 'text-green-600'}`}>
                      {weightProgress.isPositive ? '+' : ''}{weightProgress.change} ק"ג מהקודם
                    </p>
                  )}
                </div>
                <Scale className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">BMI</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {latestMeasurement?.bmi ? latestMeasurement.bmi.toFixed(1) : 'N/A'}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">מדידות מאמן</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {coachMeasurements.length}
                  </p>
                </div>
                <UserCheck className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">מדידות משתמש</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {weightEntries.filter(m => m.measurementType === 'user').length}
                  </p>
                </div>
                <User className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Data Card */}
        {progressData && coachMeasurements.length >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                השוואת התקדמות במדידות מאמן
              </CardTitle>
              <p className="text-sm text-slate-500">
                השוואה בין המדידה האחרונה ({progressData.latestDate}) למדידה הקודמת ({progressData.previousDate})
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ProgressIndicator data={progressData.weight} label="משקל" icon={Scale} isGoodWhenUp={false} />
                <ProgressIndicator data={progressData.fatPercentage} label="אחוז שומן" icon={Activity} isGoodWhenUp={false} />
                <ProgressIndicator data={progressData.muscleMass} label="מסת שריר" icon={Dumbbell} isGoodWhenUp={true} />
                <ProgressIndicator data={progressData.metabolicAge} label="גיל מטבולי" icon={Recycle} isGoodWhenUp={false} />
                <ProgressIndicator data={progressData.visceralFat} label="שומן ויסצרלי" icon={AlertTriangle} isGoodWhenUp={false} />
                <ProgressIndicator data={progressData.bodyWater} label="אחוז מים" icon={Droplets} isGoodWhenUp={true} />
                <ProgressIndicator data={progressData.waistCircumference} label="היקף מותן" icon={Ruler} isGoodWhenUp={false} />
                <ProgressIndicator data={progressData.chestCircumference} label="היקף חזה" icon={Ruler} isGoodWhenUp={false} />
                <ProgressIndicator data={progressData.glutesCircumference} label="היקף ישבן" icon={Ruler} isGoodWhenUp={false} />
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="weight" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="weight">משקל ומדידות</TabsTrigger>
            <TabsTrigger value="journal">יומן מדידות</TabsTrigger>
            <TabsTrigger value="workouts">אימונים</TabsTrigger>
            <TabsTrigger value="nutrition">תזונה</TabsTrigger>
          </TabsList>

          <TabsContent value="weight" className="space-y-4 mt-6">
            {weightChartData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    גרף מגמת משקל (15 המדידות האחרונות)
                  </CardTitle>
                  <CardDescription>
                    <span className="inline-flex items-center gap-1 text-purple-600">
                      <div className="w-2 h-2 rounded-full bg-purple-600"></div> מדידת מאמן
                    </span>{' '}
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div> מדידת משתמש
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-white rounded-lg">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={{ stroke: '#cbd5e1' }}
                          axisLine={{ stroke: '#cbd5e1' }}
                          angle={-45}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis
                          domain={['dataMin - 0.5', 'dataMax + 0.5']}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          tickLine={{ stroke: '#cbd5e1' }}
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '14px',
                            direction: 'rtl'
                          }}
                          formatter={(value, name, props) => [
                            `${value} ק"ג`,
                            props.payload.isCoach ? 'מדידת מאמן' : 'מדידת משתמש'
                          ]}
                          labelFormatter={(label) => `תאריך: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={(props) => {
                            const { cx, cy, payload } = props;
                            return (
                              <circle
                                key={payload.date}
                                cx={cx}
                                cy={cy}
                                r={4}
                                fill={payload.isCoach ? "#8b5cf6" : "#3b82f6"}
                                stroke="white"
                                strokeWidth={2}
                              />
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="journal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  יומן מדידות מלא
                </CardTitle>
                <CardDescription>היסטוריה מלאה של כל המדידות</CardDescription>
              </CardHeader>
              <CardContent>
                {weightEntries.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">אין מדידות להצגה</p>
                ) : (
                  <ScrollArea className="h-[600px] w-full pe-4">
                    <div className="space-y-3">
                      {weightEntries.map((entry) => (
                        <Card key={entry.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <span className="font-semibold text-slate-800">{formatDate(entry.date)}</span>
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Scale className="w-3 h-3" />
                                  {entry.weight} ק״ג
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mt-3">
                                {entry.bmi && (
                                  <div className="flex items-center gap-2">
                                    <HeartPulse className="w-3 h-3 text-blue-500" />
                                    <span className="text-slate-600">BMI: <strong>{entry.bmi}</strong> ({entry.bmi_category})</span>
                                  </div>
                                )}
                                {entry.fat_percentage && (
                                  <div className="flex items-center gap-2">
                                    <Target className="w-3 h-3 text-orange-500" />
                                    <span className="text-slate-600">שומן: <strong>{entry.fat_percentage}%</strong></span>
                                  </div>
                                )}
                                {entry.muscle_mass && (
                                  <div className="flex items-center gap-2">
                                    <Dumbbell className="w-3 h-3 text-green-500" />
                                    <span className="text-slate-600">שריר: <strong>{entry.muscle_mass} ק״ג</strong></span>
                                  </div>
                                )}
                                {entry.bmr && (
                                  <div className="flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-yellow-500" />
                                    <span className="text-slate-600">BMR: <strong>{entry.bmr}</strong></span>
                                  </div>
                                )}
                                {entry.visceral_fat && (
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3 text-red-500" />
                                    <span className="text-slate-600">שומן ויסצרלי: <strong>{entry.visceral_fat}</strong></span>
                                  </div>
                                )}
                                {entry.body_water_percentage && (
                                  <div className="flex items-center gap-2">
                                    <Droplets className="w-3 h-3 text-cyan-500" />
                                    <span className="text-slate-600">מים: <strong>{entry.body_water_percentage}%</strong></span>
                                  </div>
                                )}
                              </div>

                              {(entry.waist_circumference || entry.chest_circumference || entry.glutes_circumference) && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mt-3 pt-3 border-t">
                                  {entry.chest_circumference && (
                                    <div className="flex items-center gap-2">
                                      <Ruler className="w-3 h-3 text-purple-500" />
                                      <span className="text-slate-600">חזה: <strong>{entry.chest_circumference} ס״מ</strong></span>
                                    </div>
                                  )}
                                  {entry.waist_circumference && (
                                    <div className="flex items-center gap-2">
                                      <Ruler className="w-3 h-3 text-purple-500" />
                                      <span className="text-slate-600">מותן: <strong>{entry.waist_circumference} ס״מ</strong></span>
                                    </div>
                                  )}
                                  {entry.glutes_circumference && (
                                    <div className="flex items-center gap-2">
                                      <Ruler className="w-3 h-3 text-purple-500" />
                                      <span className="text-slate-600">ישבן: <strong>{entry.glutes_circumference} ס״מ</strong></span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {entry.notes && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm text-slate-600 italic">{entry.notes}</p>
                                </div>
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditEntry(entry)}
                              className="shrink-0"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workouts" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5" />
                  אימונים שהושלמו
                </CardTitle>
                <CardDescription>היסטוריית האימונים של המשתמש</CardDescription>
              </CardHeader>
              <CardContent>
                {workouts.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">אין אימונים להצגה</p>
                ) : (
                  <ScrollArea className="h-96 w-full pe-4">
                    <div className="space-y-3">
                      {workouts.slice(0, 10).map((workout) => (
                        <Card key={workout.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Dumbbell className="w-5 h-5 text-green-600" />
                              <div>
                                <p className="font-semibold text-slate-800">{workout.workout_type || 'אימון'}</p>
                                <p className="text-sm text-slate-500">{formatDate(workout.date)}</p>
                              </div>
                            </div>
                            <div className="text-left">
                              <Badge variant="outline" className="mb-1">
                                {workout.total_duration || 60} דקות
                              </Badge>
                              <p className="text-xs text-slate-500">{workout.completion_rate || 100}% הושלם</p>
                            </div>
                          </div>
                          {workout.notes && (
                            <p className="text-sm text-slate-600 mt-2 italic">{workout.notes}</p>
                          )}
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nutrition" className="space-y-4">
            {/* Calorie Target */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-600" />
                  יעד קלורי
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Utensils className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">יעד יומי</p>
                      <p className="text-2xl font-bold text-slate-800">
                        {user?.calorie_target || 2000} <span className="text-lg font-normal">קק״ל</span>
                      </p>
                    </div>
                  </div>
                  {!user?.calorie_target && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      לא נקבע יעד
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Coach Menu */}
            {coachMenu && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-green-600" />
                    תפריט תזונתי מהמאמן
                  </CardTitle>
                  <CardDescription>התפריט האחרון שהועלה</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>עודכן: {formatDate(coachMenu.upload_date)}</span>
                  </div>

                  {coachMenu.instructions && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-2">הנחיות מהמאמן:</h4>
                      <p className="text-green-700 text-sm leading-relaxed whitespace-pre-line">
                        {coachMenu.instructions}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.open(coachMenu.menu_file_url, '_blank')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Camera className="w-4 h-4 ms-2" />
                      צפה בתפריט
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = coachMenu.menu_file_url;
                        link.download = `תפריט_${formatDate(coachMenu.upload_date)}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      הורד תפריט
                    </Button>
                  </div>

                  {coachMenu.viewed_by_trainee && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <UserCheck className="w-4 h-4" />
                      <span>נצפה על ידי המתאמן</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Shared Meals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-blue-600" />
                  ארוחות משותפות
                </CardTitle>
                <CardDescription>
                  {sharedMeals.length} ארוחות שהמשתמש שיתף
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sharedMeals.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">אין ארוחות משותפות להצגה</p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {sharedMeals.map((meal) => (
                        <Card key={meal.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex gap-4">
                            {meal.meal_image && (
                              <div
                                className="w-24 h-24 rounded-lg overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setSelectedImage(meal.meal_image)}
                              >
                                <img
                                  src={meal.meal_image}
                                  alt="ארוחה"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{getMealTypeEmoji(meal.meal_type)}</span>
                                <div>
                                  <p className="font-semibold text-slate-800">{meal.meal_type}</p>
                                  <p className="text-sm text-slate-500">
                                    {formatDate(meal.date)}
                                  </p>
                                </div>
                              </div>

                              <p className="text-slate-700 mb-3">{meal.meal_description}</p>

                              <div className="flex flex-wrap gap-2 mb-3">
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  {meal.estimated_calories || 0} קק״ל
                                </Badge>
                                {meal.protein_grams && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    חלבון: {meal.protein_grams}g
                                  </Badge>
                                )}
                                {meal.carbs_grams && (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    פחמימה: {meal.carbs_grams}g
                                  </Badge>
                                )}
                                {meal.fat_grams && (
                                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                    שומן: {meal.fat_grams}g
                                  </Badge>
                                )}
                              </div>

                              {meal.coach_note && (
                                <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                                  <p className="text-xs text-amber-700">
                                    <strong>הערה למאמן:</strong> {meal.coach_note}
                                  </p>
                                </div>
                              )}

                              {meal.coach_feedback && (
                                <div className="bg-green-50 border border-green-200 rounded p-3">
                                  <div className="flex items-start gap-2">
                                    <UserCheck className="w-4 h-4 text-green-600 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-sm text-green-800 font-medium mb-1">משוב מהמאמן:</p>
                                      <p className="text-sm text-green-700">{meal.coach_feedback}</p>
                                      {meal.coach_feedback_date && (
                                        <p className="text-xs text-green-600 mt-1">
                                          {formatDateTime(meal.coach_feedback_date)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {meal.viewed_by_coach && !meal.coach_feedback && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                                  <UserCheck className="w-4 h-4" />
                                  <span>נצפה על ידי המאמן</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detailed Measurement Modal */}
      <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-hidden" dir="rtl">
          {selectedMeasurement && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedMeasurement.measurementType === 'coach' ?
                    <UserCheck className="w-5 h-5 text-purple-600" /> :
                    <User className="w-5 h-5 text-blue-600" />
                  }
                  פרטי מדידה - {formatDate(selectedMeasurement.date)}
                </DialogTitle>
                <DialogDescription>
                  פירוט מלא של המדידה שנבחרה.
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[70vh] pe-4">
                <div className="space-y-6">

                  {/* Basic Info */}
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-slate-600" />
                      הרכב גוף
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedMeasurement.weight && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">משקל:</span>
                          <span className="font-medium">{selectedMeasurement.weight} ק"ג</span>
                        </div>
                      )}
                      {selectedMeasurement.bmi && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">BMI:</span>
                          <span className="font-medium">{selectedMeasurement.bmi.toFixed(1)}</span>
                        </div>
                      )}
                      {selectedMeasurement.fat_percentage && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">אחוז שומן:</span>
                          <span className="font-medium">{selectedMeasurement.fat_percentage}%</span>
                        </div>
                      )}
                      {selectedMeasurement.muscle_mass && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">מסת שריר:</span>
                          <span className="font-medium">{selectedMeasurement.muscle_mass} ק"ג</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metabolic Data */}
                  {(selectedMeasurement.metabolic_age || selectedMeasurement.visceral_fat || selectedMeasurement.body_water_percentage || selectedMeasurement.bmr || selectedMeasurement.physique_rating) && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-green-600" />
                        מדדים מטבוליים
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {selectedMeasurement.metabolic_age && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">גיל מטבולי:</span>
                            <span className="font-medium">{selectedMeasurement.metabolic_age}</span>
                          </div>
                        )}
                        {selectedMeasurement.visceral_fat && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">שומן ויסצרלי:</span>
                            <span className="font-medium">{selectedMeasurement.visceral_fat}</span>
                          </div>
                        )}
                        {selectedMeasurement.body_water_percentage && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">אחוז מים:</span>
                            <span className="font-medium">{selectedMeasurement.body_water_percentage}%</span>
                          </div>
                        )}
                        {selectedMeasurement.bmr && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">BMR:</span>
                            <span className="font-medium">{selectedMeasurement.bmr}</span>
                          </div>
                        )}
                        {selectedMeasurement.physique_rating && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">דירוג מבנה גוף:</span>
                            <span className="font-medium">{selectedMeasurement.physique_rating}/9</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Circumferences */}
                  {(selectedMeasurement.neck_circumference || selectedMeasurement.chest_circumference || selectedMeasurement.waist_circumference ||
                    selectedMeasurement.glutes_circumference || selectedMeasurement.thigh_circumference_right || selectedMeasurement.thigh_circumference_left ||
                    selectedMeasurement.calf_circumference_right || selectedMeasurement.calf_circumference_left || selectedMeasurement.bicep_circumference_right ||
                    selectedMeasurement.bicep_circumference_left) && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-blue-600" />
                          היקפים
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {selectedMeasurement.neck_circumference && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">צוואר:</span>
                              <span className="font-medium">{selectedMeasurement.neck_circumference} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.chest_circumference && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">חזה:</span>
                              <span className="font-medium">{selectedMeasurement.chest_circumference} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.waist_circumference && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">מותן:</span>
                              <span className="font-medium">{selectedMeasurement.waist_circumference} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.glutes_circumference && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">ישבן:</span>
                              <span className="font-medium">{selectedMeasurement.glutes_circumference} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.bicep_circumference_right && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">יד ימין:</span>
                              <span className="font-medium">{selectedMeasurement.bicep_circumference_right} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.bicep_circumference_left && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">יד שמאל:</span>
                              <span className="font-medium">{selectedMeasurement.bicep_circumference_left} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.thigh_circumference_right && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">ירך ימין:</span>
                              <span className="font-medium">{selectedMeasurement.thigh_circumference_right} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.thigh_circumference_left && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">ירך שמאל:</span>
                              <span className="font-medium">{selectedMeasurement.thigh_circumference_left} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.calf_circumference_right && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">שוק ימין:</span>
                              <span className="font-medium">{selectedMeasurement.calf_circumference_right} ס"מ</span>
                            </div>
                          )}
                          {selectedMeasurement.calf_circumference_left && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">שוק שמאל:</span>
                              <span className="font-medium">{selectedMeasurement.calf_circumference_left} ס"מ</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Measurement Source */}
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2">
                      {selectedMeasurement.measurementType === 'coach' ? (
                        <>
                          <UserCheck className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">מדידה ע"י מאמן</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">עדכון ע"י מתאמן</span>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>תמונת ארוחה</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img src={selectedImage} alt="ארוחה" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Weight Entry Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת מדידה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">תאריך</Label>
                <Input
                  id="date"
                  type="date"
                  value={editForm.date || ''}
                  onChange={handleEditFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">משקל (ק״ג)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={editForm.weight || ''}
                  onChange={handleEditFormChange}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">מדדי גוף</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fat_percentage">אחוז שומן (%)</Label>
                  <Input
                    id="fat_percentage"
                    type="number"
                    step="0.1"
                    value={editForm.fat_percentage || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="muscle_mass">מסת שריר (ק״ג)</Label>
                  <Input
                    id="muscle_mass"
                    type="number"
                    step="0.1"
                    value={editForm.muscle_mass || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bmr">BMR</Label>
                  <Input
                    id="bmr"
                    type="number"
                    step="0.1"
                    value={editForm.bmr || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metabolic_age">גיל מטבולי</Label>
                  <Input
                    id="metabolic_age"
                    type="number"
                    value={editForm.metabolic_age || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visceral_fat">שומן ויסצרלי</Label>
                  <Input
                    id="visceral_fat"
                    type="number"
                    step="0.1"
                    value={editForm.visceral_fat || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body_water_percentage">אחוז מים (%)</Label>
                  <Input
                    id="body_water_percentage"
                    type="number"
                    step="0.1"
                    value={editForm.body_water_percentage || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physique_rating">דירוג מבנה גוף (1-9)</Label>
                  <Input
                    id="physique_rating"
                    type="number"
                    min="1"
                    max="9"
                    value={editForm.physique_rating || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">היקפים (ס״מ)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="neck_circumference">צוואר</Label>
                  <Input
                    id="neck_circumference"
                    type="number"
                    step="0.1"
                    value={editForm.neck_circumference || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chest_circumference">חזה</Label>
                  <Input
                    id="chest_circumference"
                    type="number"
                    step="0.1"
                    value={editForm.chest_circumference || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waist_circumference">מותן</Label>
                  <Input
                    id="waist_circumference"
                    type="number"
                    step="0.1"
                    value={editForm.waist_circumference || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="glutes_circumference">ישבן</Label>
                  <Input
                    id="glutes_circumference"
                    type="number"
                    step="0.1"
                    value={editForm.glutes_circumference || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thigh_circumference_right">ירך ימין</Label>
                  <Input
                    id="thigh_circumference_right"
                    type="number"
                    step="0.1"
                    value={editForm.thigh_circumference_right || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thigh_circumference_left">ירך שמאל</Label>
                  <Input
                    id="thigh_circumference_left"
                    type="number"
                    step="0.1"
                    value={editForm.thigh_circumference_left || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calf_circumference_right">שוק ימין</Label>
                  <Input
                    id="calf_circumference_right"
                    type="number"
                    step="0.1"
                    value={editForm.calf_circumference_right || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calf_circumference_left">שוק שמאל</Label>
                  <Input
                    id="calf_circumference_left"
                    type="number"
                    step="0.1"
                    value={editForm.calf_circumference_left || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bicep_circumference_right">יד ימין</Label>
                  <Input
                    id="bicep_circumference_right"
                    type="number"
                    step="0.1"
                    value={editForm.bicep_circumference_right || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bicep_circumference_left">יד שמאל</Label>
                  <Input
                    id="bicep_circumference_left"
                    type="number"
                    step="0.1"
                    value={editForm.bicep_circumference_left || ''}
                    onChange={handleEditFormChange}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">הערות</Label>
              <Input
                id="notes"
                value={editForm.notes || ''}
                onChange={handleEditFormChange}
                placeholder="הערות נוספות..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              <X className="w-4 h-4 ms-2" />
              ביטול
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 ms-2 animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 ms-2" />
                  שמור
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
