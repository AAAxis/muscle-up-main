
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, WeightEntry, WeeklyTask, Workout, WaterTracking, CalorieTracking, ProgressPicture, WeightReminder, UserGroup, CoachNotification } from '@/api/entities';
// SendEmail removed - using CoachNotification instead
import { SendFCMNotification, UploadFile } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, User as UserIcon, Scale, Activity, ClipboardList, MessageSquare, Calendar, ChevronLeft, ChevronRight, Share2, Cake, Percent, HeartPulse, Weight, Recycle, Ruler, Droplets, Zap, Target, PieChart, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Dumbbell, Clock, WifiOff, RefreshCw, Copy, X, Bell, CheckCircle, AlertCircle, ChevronsUpDown, Check, ArrowRight, Camera, Edit, Save
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
import InviteLinkCard from '@/components/admin/InviteLinkCard';

// Translate status to Hebrew for display (handles both English and Hebrew stored values)
const getStatusLabel = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'פעיל' || !status) return 'פעיל';
  if (s === 'inactive' || s === 'לא פעיל') return 'לא פעיל';
  if (s === 'ended' || s === 'הסתיים') return 'הסתיים';
  if (s === 'on_hold' || s === 'pending' || s === 'בהמתנה' || s === 'ממתין') return 'בהמתנה';
  if (s === 'frozen' || s === 'מוקפא') return 'מוקפא';
  return status;
};

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
    if (bmiValue < 18.5) return { category: 'תת משקל', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (bmiValue >= 18.5 && bmiValue < 25) return { category: 'משקל תקין', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (bmiValue >= 25 && bmiValue < 30) return { category: 'עודף משקל', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { category: 'השמנה', color: 'text-red-600', bgColor: 'bg-red-100' };
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
  if (!metabolicAge || !userAge) return 'bg-slate-50 text-slate-800';
  const diff = metabolicAge - userAge;
  if (diff <= 0) return 'bg-green-100 text-green-800';
  if (diff <= 5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

const getBmiColor = (bmi) => {
  if (!bmi) return 'bg-slate-50 text-slate-800';
  if (bmi < 18.5) return 'bg-blue-100 text-blue-800';
  if (bmi < 25) return 'bg-green-100 text-green-800';
  if (bmi < 30) return 'bg-yellow-100 text-yellow-800';
  if (bmi < 35) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
};

const getFatPercentageColor = (fatPercentage) => {
  if (!fatPercentage) return 'bg-slate-50 text-slate-800';
  if (fatPercentage < 20) return 'bg-green-100 text-green-800';
  if (fatPercentage < 30) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

const getVisceralFatColor = (visceralFat) => {
  if (!visceralFat) return 'bg-slate-50 text-slate-800';
  if (visceralFat < 10) return 'bg-green-100 text-green-800';
  if (visceralFat < 15) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

// ══════════════════════════════════════════
// ── Avatar with Upload ──
// ══════════════════════════════════════════
function AvatarWithUpload({ user, size = 'lg', onImageUpdated }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  };
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };
  const cameraIconSizes = {
    sm: 'w-5 h-5 p-0.5',
    md: 'w-6 h-6 p-0.5',
    lg: 'w-8 h-8 p-1.5',
  };
  const borderClasses = size === 'sm' ? 'border' : 'border-2';

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) return;

    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      const uid = user.uid || user.id;
      if (uid) {
        await User.update(uid, { profile_image_url: file_url });
        if (onImageUpdated) onImageUpdated(uid, file_url);
      }
    } catch (err) {
      console.error('Failed to upload profile image:', err);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={`relative group cursor-pointer flex-shrink-0 ${sizeClasses[size]}`}
      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {user.profile_image_url ? (
        <img
          src={user.profile_image_url}
          alt={user.name || 'user'}
          className={`${sizeClasses[size]} rounded-full object-cover ${borderClasses} border-blue-200`}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-blue-100 flex items-center justify-center ${borderClasses} border-blue-200`}>
          <UserIcon className={`${iconSizes[size]} text-blue-600`} />
        </div>
      )}

      {/* Upload overlay — visible on hover */}
      {isUploading ? (
        <div className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center`}>
          <Loader2 className={`${iconSizes[size === 'sm' ? 'sm' : 'md']} text-white animate-spin`} />
        </div>
      ) : (
        <div className={`absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center`}>
          <div className={`${cameraIconSizes[size]} rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
            <Camera className="w-3.5 h-3.5 text-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ── User Detail Screen ──
// ══════════════════════════════════════════
function UserDetailScreen({ user, onBack, shareableUserLink, displayValue, syncUserWithLatestMeasurements, onImageUpdated, onUserUpdated }) {
  const [userDetails, setUserDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('tracking');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const handleCopyShareLink = useCallback(() => {
    if (!shareableUserLink) return;
    navigator.clipboard.writeText(shareableUserLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  }, [shareableUserLink]);

  const buildFormFromUser = useCallback((d) => {
    if (!d) return {};
    const heightCm = d.height != null && d.height !== '' ? (typeof d.height === 'number' ? d.height * 100 : parseFloat(d.height) * 100) : '';
    return {
      name: d.name || d.full_name || '',
      full_name: d.full_name || d.name || '',
      displayName: d.displayName || '',
      email: d.email || '',
      status: d.status || 'active',
      coach_name: d.coach_name || '',
      coach_email: d.coach_email || '',
      coach_phone: d.coach_phone || '',
      role: d.role || 'trainee',
      group_names: Array.isArray(d.group_names) ? d.group_names.join(', ') : (d.group_names || ''),
      booster_enabled: !!d.booster_enabled,
      nutrition_access: !!d.nutrition_access,
      contract_signed: !!d.contract_signed,
      gender: d.gender || '',
      phone: d.phone || '',
      birth_date: d.birth_date ? (d.birth_date.split && d.birth_date.split('T')[0]) : '',
      start_date: d.start_date ? (d.start_date.split && d.start_date.split('T')[0]) : '',
      age: d.age != null && d.age !== '' ? String(d.age) : '',
      height: heightCm !== '' ? String(heightCm) : '',
      initial_weight: d.initial_weight != null && d.initial_weight !== '' ? String(d.initial_weight) : '',
      weight: d.weight != null && d.weight !== '' ? String(d.weight) : (d.current_weight != null && d.current_weight !== '' ? String(d.current_weight) : ''),
      bmi: d.bmi != null && d.bmi !== '' ? String(d.bmi) : '',
      metabolic_age: d.metabolic_age != null && d.metabolic_age !== '' ? String(d.metabolic_age) : '',
      visceral_fat: d.visceral_fat != null && d.visceral_fat !== '' ? String(d.visceral_fat) : '',
      muscle_mass: d.muscle_mass != null && d.muscle_mass !== '' ? String(d.muscle_mass) : '',
      fat_percentage: d.fat_percentage != null && d.fat_percentage !== '' ? String(d.fat_percentage) : '',
      body_water_percentage: d.body_water_percentage != null && d.body_water_percentage !== '' ? String(d.body_water_percentage) : '',
      physique_rating: d.physique_rating != null && d.physique_rating !== '' ? String(d.physique_rating) : '',
      bmr: d.bmr != null && d.bmr !== '' ? String(d.bmr) : '',
      neck_circumference: d.neck_circumference != null && d.neck_circumference !== '' ? String(d.neck_circumference) : '',
      chest_circumference: d.chest_circumference != null && d.chest_circumference !== '' ? String(d.chest_circumference) : '',
      waist_circumference: d.waist_circumference != null && d.waist_circumference !== '' ? String(d.waist_circumference) : '',
      hip_circumference: d.hip_circumference != null && d.hip_circumference !== '' ? String(d.hip_circumference) : '',
      glutes_circumference: d.glutes_circumference != null && d.glutes_circumference !== '' ? String(d.glutes_circumference) : '',
      bicep_circumference_right: d.bicep_circumference_right != null && d.bicep_circumference_right !== '' ? String(d.bicep_circumference_right) : '',
      bicep_circumference_left: d.bicep_circumference_left != null && d.bicep_circumference_left !== '' ? String(d.bicep_circumference_left) : '',
      thigh_circumference_right: d.thigh_circumference_right != null && d.thigh_circumference_right !== '' ? String(d.thigh_circumference_right) : '',
      thigh_circumference_left: d.thigh_circumference_left != null && d.thigh_circumference_left !== '' ? String(d.thigh_circumference_left) : '',
      calf_circumference_right: d.calf_circumference_right != null && d.calf_circumference_right !== '' ? String(d.calf_circumference_right) : '',
      calf_circumference_left: d.calf_circumference_left != null && d.calf_circumference_left !== '' ? String(d.calf_circumference_left) : '',
    };
  }, []);

  useEffect(() => {
    if (isEditDialogOpen) return;
    const d = userDetails || user;
    if (d && (user?.uid || user?.id)) setEditForm(buildFormFromUser(d));
  }, [userDetails, user, user?.uid, user?.id, buildFormFromUser, isEditDialogOpen]);

  const openEditDialog = useCallback((u) => {
    const d = u || userDetails || user;
    if (!d) return;
    setEditForm(buildFormFromUser(d));
    setEditError('');
    setIsEditDialogOpen(true);
  }, [userDetails, user, buildFormFromUser]);

  const handleSaveEdit = useCallback(async () => {
    const uid = user?.uid || user?.id;
    if (!uid) return;
    setIsSavingEdit(true);
    setEditError('');
    try {
      const groupNamesStr = (editForm.group_names || '').trim();
      const group_names = groupNamesStr ? groupNamesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const heightVal = editForm.height !== '' && !isNaN(parseFloat(editForm.height)) ? parseFloat(editForm.height) / 100 : undefined;
      const num = (v) => (v !== '' && v != null && !isNaN(parseFloat(v)) ? parseFloat(v) : undefined);
      const payload = {
        name: (editForm.name || '').trim() || undefined,
        full_name: (editForm.full_name || '').trim() || undefined,
        displayName: (editForm.displayName || '').trim() || undefined,
        email: (editForm.email || '').trim() || undefined,
        status: editForm.status || undefined,
        coach_name: (editForm.coach_name || '').trim() || undefined,
        coach_email: (editForm.coach_email || '').trim() || undefined,
        coach_phone: (editForm.coach_phone || '').trim() || undefined,
        role: (editForm.role || 'trainee').trim() || undefined,
        group_names: group_names.length ? group_names : undefined,
        booster_enabled: editForm.booster_enabled,
        nutrition_access: editForm.nutrition_access,
        contract_signed: editForm.contract_signed,
        gender: (editForm.gender || '').trim() || undefined,
        phone: (editForm.phone || '').trim() || undefined,
        birth_date: (editForm.birth_date || '').trim() || undefined,
        start_date: (editForm.start_date || '').trim() || undefined,
        age: num(editForm.age),
        height: heightVal,
        initial_weight: num(editForm.initial_weight),
        weight: num(editForm.weight),
        current_weight: num(editForm.weight),
        bmi: num(editForm.bmi),
        metabolic_age: num(editForm.metabolic_age),
        visceral_fat: num(editForm.visceral_fat),
        muscle_mass: num(editForm.muscle_mass),
        fat_percentage: num(editForm.fat_percentage),
        body_water_percentage: num(editForm.body_water_percentage),
        physique_rating: num(editForm.physique_rating),
        bmr: num(editForm.bmr),
        neck_circumference: num(editForm.neck_circumference),
        chest_circumference: num(editForm.chest_circumference),
        waist_circumference: num(editForm.waist_circumference),
        hip_circumference: num(editForm.hip_circumference),
        glutes_circumference: num(editForm.glutes_circumference),
        bicep_circumference_right: num(editForm.bicep_circumference_right),
        bicep_circumference_left: num(editForm.bicep_circumference_left),
        thigh_circumference_right: num(editForm.thigh_circumference_right),
        thigh_circumference_left: num(editForm.thigh_circumference_left),
        calf_circumference_right: num(editForm.calf_circumference_right),
        calf_circumference_left: num(editForm.calf_circumference_left),
      };
      const clean = {};
      Object.keys(payload).forEach(k => { if (payload[k] !== undefined && payload[k] !== '') clean[k] = payload[k]; });
      await User.update(uid, clean);
      const updatedUser = { ...(userDetails || user), ...clean };
      setUserDetails(updatedUser);
      if (onUserUpdated) onUserUpdated(updatedUser);
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error('Failed to update user:', err);
      setEditError('שגיאה בעדכון המשתמש');
    } finally {
      setIsSavingEdit(false);
    }
  }, [user, editForm, userDetails, onUserUpdated]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setIsLoadingDetails(true);

    (async () => {
      try {
        const [userWeights, userWorkouts, userTasks, waterLogs, calorieEntries, progressPictures] = await Promise.all([
          WeightEntry.filter({ user_email: user.email }, '-created_date').catch(() => []),
          Workout.filter({ created_by: user.email }, '-date').catch(() => []),
          WeeklyTask.filter({ user_email: user.email }, 'week').catch(() => []),
          WaterTracking.filter({ user_email: user.email }, '-date').catch(() => []),
          CalorieTracking.filter({ user_email: user.email }, '-date').catch(() => []),
          ProgressPicture.filter({ user_email: user.email }, '-photo_date').catch(() => [])
        ]);

        if (cancelled) return;

        const syncedUser = syncUserWithLatestMeasurements(user, userWeights);

        setUserDetails({
          ...syncedUser,
          allWeights: userWeights,
          allWorkouts: userWorkouts,
          allTasks: userTasks,
          waterLogs,
          calorieEntries,
          progressPictures
        });
      } catch (err) {
        console.error('Failed to load user details:', err);
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, syncUserWithLatestMeasurements]);

  const handleShare = useCallback(() => {
    if (!userDetails) return;
    const getBMICategory = (bmi) => {
      if (!bmi) return 'לא זמין';
      if (bmi < 18.5) return 'תת משקל';
      if (bmi >= 18.5 && bmi < 25) return 'משקל תקין ✅';
      if (bmi >= 25 && bmi < 30) return 'עודף משקל ⚠️';
      return 'השמנה 🔴';
    };
    const glutesCircumference = userDetails.glutes_circumference || userDetails.hip_circumference;
    const overviewText = `📊 סקירת התקדמות עבור ${userDetails.name} 📊\n\n🎂 גיל: ${displayValue(userDetails.age)}\n⚡ גיל מטבולי: ${displayValue(userDetails.metabolic_age)}\n📏 גובה: ${userDetails.height ? `${(userDetails.height * 100).toFixed(0)} ס"מ` : 'לא צוין'}\n📈 משקל התחלתי: ${displayValue(userDetails.initial_weight, 'ק"ג')}\n⚖️ משקל נוכחי: ${displayValue(userDetails.weight, 'ק"ג')}\n🔥 אחוז שומן: ${displayValue(userDetails.fat_percentage, '%')}\n💪 מסת שריר: ${displayValue(userDetails.muscle_mass, 'ק"ג')}\n💖 BMI: ${displayValue(userDetails.bmi)} (${getBMICategory(userDetails.bmi)})\n🌊 אחוז מים: ${displayValue(userDetails.body_water_percentage, '%')}\n⚠️ שומן ויסצרלי: ${displayValue(userDetails.visceral_fat)}\n⭐ דירוג מבנה גוף: ${userDetails.physique_rating ? `${userDetails.physique_rating}/9` : 'לא צוין'}\n⚡ BMR: ${userDetails.bmr ? `${userDetails.bmr} קל'` : 'לא צוין'}\n\n📐 מדידות גוף:\n• חזה: ${displayValue(userDetails.chest_circumference, 'ס"מ')}\n• מותן: ${displayValue(userDetails.waist_circumference, 'ס"מ')}\n• ישבן: ${displayValue(glutesCircumference, 'ס"מ')}\n\n#Vitrix #Progress #FitnessJourney #HealthyLifestyle`;
    navigator.clipboard.writeText(overviewText.trim());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [userDetails, displayValue]);

  const detailUser = userDetails || user;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Back button + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <ChevronRight className="w-4 h-4" />
          חזרה לרשימת מתאמנים
        </Button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={handleSaveEdit}
            disabled={isSavingEdit}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            title="שמור שינויים"
          >
            {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            שמור
          </Button>
          <Button variant="outline" onClick={() => openEditDialog()} className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50" title="ערוך כל השדות (מדידות והיקפים)">
            <Edit className="w-4 h-4" />
            ערוך מלא
          </Button>
          {shareableUserLink && (
          <Button
            variant="outline"
            onClick={handleCopyShareLink}
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4" />
                הועתק!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                שתף קישור
              </>
            )}
          </Button>
        )}
        </div>
      </div>

      {/* User Header Card — always editable */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-end gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={() => openEditDialog()} className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
                <Edit className="w-4 h-4" />
                ערוך (כל השדות)
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                שמור
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <AvatarWithUpload user={detailUser} size="lg" onImageUpdated={onImageUpdated} />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                <div className="space-y-1"><Label className="text-xs">שם</Label><Input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="שם" /></div>
                <div className="space-y-1"><Label className="text-xs">שם מלא</Label><Input value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} placeholder="שם מלא" /></div>
                <div className="space-y-1 sm:col-span-2"><Label className="text-xs">אימייל</Label><Input type="email" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" /></div>
                <div className="space-y-1"><Label className="text-xs">סטטוס</Label>
                  <Select value={editForm.status || 'active'} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">פעיל</SelectItem>
                      <SelectItem value="inactive">לא פעיל</SelectItem>
                      <SelectItem value="on_hold">בהמתנה</SelectItem>
                      <SelectItem value="frozen">מוקפא</SelectItem>
                      <SelectItem value="ended">הסתיים</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">תפקיד</Label>
                  <Select value={editForm.role || 'trainee'} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trainee">מתאמן/ת</SelectItem>
                      <SelectItem value="trainer">מאמן/ת</SelectItem>
                      <SelectItem value="admin">מנהל מערכת</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">מאמן</Label><Input value={editForm.coach_name || ''} onChange={e => setEditForm(f => ({ ...f, coach_name: e.target.value }))} placeholder="שם מאמן" /></div>
                <div className="space-y-1"><Label className="text-xs">אימייל מאמן</Label><Input type="email" value={editForm.coach_email || ''} onChange={e => setEditForm(f => ({ ...f, coach_email: e.target.value }))} placeholder="coach@example.com" /></div>
                <div className="space-y-1"><Label className="text-xs">טלפון מאמן</Label><Input type="tel" value={editForm.coach_phone || ''} onChange={e => setEditForm(f => ({ ...f, coach_phone: e.target.value }))} placeholder="טלפון מאמן" /></div>
                <div className="space-y-1"><Label className="text-xs">טלפון משתמש</Label><Input type="tel" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="טלפון" /></div>
                <div className="space-y-1 sm:col-span-2"><Label className="text-xs">קבוצות (מופרדות בפסיק)</Label><Input value={editForm.group_names || ''} onChange={e => setEditForm(f => ({ ...f, group_names: e.target.value }))} placeholder="קבוצה 1, קבוצה 2" /></div>
                <div className="space-y-1"><Label className="text-xs">מין</Label>
                  <Select value={editForm.gender || ''} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">זכר</SelectItem>
                      <SelectItem value="female">נקבה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">תאריך לידה</Label><Input type="date" value={editForm.birth_date || ''} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">תאריך הצטרפות</Label><Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">גיל</Label><Input type="number" min="1" max="120" value={editForm.age || ''} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} placeholder="גיל" /></div>
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <div className="flex items-center gap-2"><Checkbox id="booster-inline" checked={editForm.booster_enabled} onCheckedChange={c => setEditForm(f => ({ ...f, booster_enabled: !!c }))} /><Label htmlFor="booster-inline" className="text-xs cursor-pointer">בוסטר</Label></div>
                  <div className="flex items-center gap-2"><Checkbox id="nutrition-inline" checked={editForm.nutrition_access} onCheckedChange={c => setEditForm(f => ({ ...f, nutrition_access: !!c }))} /><Label htmlFor="nutrition-inline" className="text-xs cursor-pointer">תזונה</Label></div>
                  <div className="flex items-center gap-2"><Checkbox id="contract-inline" checked={editForm.contract_signed} onCheckedChange={c => setEditForm(f => ({ ...f, contract_signed: !!c }))} /><Label htmlFor="contract-inline" className="text-xs cursor-pointer">חוזה חתום</Label></div>
                </div>
              </div>
            </div>
            {editError && <div className="text-sm text-red-600">{editError}</div>}
          </div>
        </CardContent>
      </Card>

      {/* Loading state for details */}
      {isLoadingDetails && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="me-2 text-slate-600">טוען נתונים...</span>
        </div>
      )}

      {/* Content Tabs */}
      {!isLoadingDetails && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tracking" className="text-sm">מעקב התקדמות</TabsTrigger>
            <TabsTrigger value="physical" className="text-sm">נתונים פיזיים</TabsTrigger>
            <TabsTrigger value="activity" className="text-sm">פעילות אחרונה</TabsTrigger>
          </TabsList>

          {/* ── Tracking Tab ── */}
          <TabsContent value="tracking" className="mt-4">
            <UserTrackingTab user={detailUser} showUserHeader={false} />
          </TabsContent>

          {/* ── Physical Data Tab ── */}
          <TabsContent value="physical" className="mt-4 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Scale className="w-5 h-5 text-blue-600" />נתונים פיזיים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
                  <div className="text-center p-2 rounded-lg bg-slate-50"><span className="text-slate-500 block text-xs">גיל</span><div className="font-semibold text-lg">{displayValue(detailUser.age)}</div></div>
                  <div className={`text-center p-2 rounded-lg ${getMetabolicAgeColor(detailUser.metabolic_age, detailUser.age)}`}><span className="opacity-80 block text-xs">גיל מטבולי</span><div className="font-semibold text-lg">{displayValue(detailUser.metabolic_age)}</div></div>
                  <div className="text-center p-2 rounded-lg bg-slate-50"><span className="text-slate-500 block text-xs">משקל נוכחי</span><div className="font-semibold text-lg">{displayValue(detailUser.current_weight, 'ק"ג')}</div></div>
                  <div className={`text-center p-2 rounded-lg ${getBmiColor(detailUser.bmi)}`}><span className="opacity-80 block text-xs">BMI</span><div className="font-semibold text-lg">{displayValue(detailUser.bmi)}</div></div>
                  <div className={`text-center p-2 rounded-lg ${getVisceralFatColor(detailUser.visceral_fat)}`}><span className="opacity-80 block text-xs">שומן ויסצרלי</span><div className="font-semibold text-lg">{displayValue(detailUser.visceral_fat)}</div></div>
                  <div className="text-center p-2 rounded-lg bg-slate-50"><span className="text-slate-500 block text-xs">מסת שריר</span><div className="font-semibold text-lg">{displayValue(detailUser.muscle_mass, 'ק"ג')}</div></div>
                  <div className={`text-center p-2 rounded-lg ${getFatPercentageColor(detailUser.fat_percentage)}`}><span className="opacity-80 block text-xs">אחוז שומן</span><div className="font-semibold text-lg">{displayValue(detailUser.fat_percentage, '%')}</div></div>
                  <div className="text-center p-2 rounded-lg bg-slate-50"><span className="text-slate-500 block text-xs">אחוז מים</span><div className="font-semibold text-lg">{displayValue(detailUser.body_water_percentage, '%')}</div></div>
                </div>
              </CardContent>
            </Card>

            {userDetails && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">סקירת נתונים מפורטת</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-slate-700">מידע בסיסי</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard icon={Cake} label="גיל" value={displayValue(userDetails.age)} />
                      <StatCard icon={Recycle} label="גיל מטבולי" value={displayValue(userDetails.metabolic_age)} color="text-teal-500" />
                      <StatCard icon={Ruler} label="גובה" value={userDetails.height ? displayValue((userDetails.height * 100).toFixed(0), 'ס"מ') : null} color="text-indigo-500" />
                      <StatCard icon={Target} label="דירוג מבנה גוף" value={userDetails.physique_rating ? `${userDetails.physique_rating}/9` : null} color="text-purple-500" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-slate-700">משקל והרכב גוף</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard icon={Weight} label="משקל התחלתי" value={displayValue(userDetails.initial_weight, 'ק"ג')} color="text-blue-500" />
                      <StatCard icon={Weight} label="משקל נוכחי" value={displayValue(userDetails.weight, 'ק"ג')} color="text-green-500" />
                      <StatCard icon={PieChart} label="אחוז שומן" value={displayValue(userDetails.fat_percentage, '%')} color="text-orange-500" />
                      <StatCard icon={Dumbbell} label="מסת שריר" value={displayValue(userDetails.muscle_mass, 'ק"ג')} color="text-purple-500" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-slate-700">מדדים בריאותיים</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <BMICard bmi={userDetails.bmi} />
                      <StatCard icon={Droplets} label="אחוז מים" value={displayValue(userDetails.body_water_percentage, '%')} color="text-cyan-500" />
                      <StatCard icon={AlertTriangle} label="שומן ויסצרלי" value={displayValue(userDetails.visceral_fat)} color="text-red-500" />
                      <StatCard icon={Zap} label="BMR" value={displayValue(userDetails.bmr, 'קל\'')} color="text-yellow-500" />
                    </div>
                  </div>

                  {/* Circumferences */}
                  {(userDetails.chest_circumference || userDetails.waist_circumference || userDetails.glutes_circumference || userDetails.hip_circumference || userDetails.neck_circumference || userDetails.bicep_circumference_right || userDetails.thigh_circumference_right || userDetails.thigh_circumference_left || userDetails.calf_circumference_right) && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-slate-700">מדידות היקפים</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
                        {userDetails.neck_circumference && <div className="text-center p-2 rounded-lg bg-blue-50"><span className="text-blue-600 block text-xs">צוואר</span><div className="font-semibold text-lg text-blue-800">{displayValue(userDetails.neck_circumference, 'ס"מ')}</div></div>}
                        {userDetails.chest_circumference && <div className="text-center p-2 rounded-lg bg-green-50"><span className="text-green-600 block text-xs">חזה</span><div className="font-semibold text-lg text-green-800">{displayValue(userDetails.chest_circumference, 'ס"מ')}</div></div>}
                        {userDetails.waist_circumference && <div className="text-center p-2 rounded-lg bg-orange-50"><span className="text-orange-600 block text-xs">מותן</span><div className="font-semibold text-lg text-orange-800">{displayValue(userDetails.waist_circumference, 'ס"מ')}</div></div>}
                        {(userDetails.glutes_circumference || userDetails.hip_circumference) && <div className="text-center p-2 rounded-lg bg-purple-50"><span className="text-purple-600 block text-xs">ישבן</span><div className="font-semibold text-lg text-purple-800">{displayValue(userDetails.glutes_circumference || userDetails.hip_circumference, 'ס"מ')}</div></div>}
                        {userDetails.bicep_circumference_right && <div className="text-center p-2 rounded-lg bg-red-50"><span className="text-red-600 block text-xs">יד ימין</span><div className="font-semibold text-lg text-red-800">{displayValue(userDetails.bicep_circumference_right, 'ס"מ')}</div></div>}
                        {userDetails.bicep_circumference_left && <div className="text-center p-2 rounded-lg bg-pink-50"><span className="text-pink-600 block text-xs">יד שמאל</span><div className="font-semibold text-lg text-pink-800">{displayValue(userDetails.bicep_circumference_left, 'ס"מ')}</div></div>}
                        {userDetails.thigh_circumference_right && <div className="text-center p-2 rounded-lg bg-indigo-50"><span className="text-indigo-600 block text-xs">ירך ימין</span><div className="font-semibold text-lg text-indigo-800">{displayValue(userDetails.thigh_circumference_right, 'ס"מ')}</div></div>}
                        {userDetails.thigh_circumference_left && <div className="text-center p-2 rounded-lg bg-teal-50"><span className="text-teal-600 block text-xs">ירך שמאל</span><div className="font-semibold text-lg text-teal-800">{displayValue(userDetails.thigh_circumference_left, 'ס"מ')}</div></div>}
                        {userDetails.calf_circumference_right && <div className="text-center p-2 rounded-lg bg-cyan-50"><span className="text-cyan-600 block text-xs">שוק ימין</span><div className="font-semibold text-lg text-cyan-800">{displayValue(userDetails.calf_circumference_right, 'ס"מ')}</div></div>}
                        {userDetails.calf_circumference_left && <div className="text-center p-2 rounded-lg bg-emerald-50"><span className="text-emerald-600 block text-xs">שוק שמאל</span><div className="font-semibold text-lg text-emerald-800">{displayValue(userDetails.calf_circumference_left, 'ס"מ')}</div></div>}
                      </div>
                    </div>
                  )}

                  {userDetails.measurementSync && Object.keys(userDetails.measurementSync).length > 0 && (
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">נתונים מעודכנים מיומן המדידות</div>
                  )}

                  <Button onClick={handleShare} className="w-full muscle-primary-gradient text-white text-sm flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    {isCopied ? 'הועתק!' : 'העתק נתונים מפורטים לשיתוף'}
                  </Button>
                  <p className="text-xs text-center text-slate-500">לחיצה על הכפתור תעתיק את כל הנתונים המפורטים. תוכלו להדביק אותם בפוסט באינסטגרם.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Activity Tab ── */}
          <TabsContent value="activity" className="mt-4 space-y-4">
            {userDetails ? (
              <>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Scale className="text-green-600 w-4 h-4" /> מעקב משקל</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-center">
                    {(() => {
                      const currentWeightEntry = userDetails.allWeights?.[0];
                      const sevenDaysAgo = subDays(new Date(), 7);
                      const lastWeekEntry = userDetails.allWeights?.find(entry => isBefore(parseISO(entry.date || entry.created_date), sevenDaysAgo));
                      return (
                        <>
                          <div><p className="text-xs text-slate-500">משקל שבוע שעבר</p><p className="text-lg font-bold text-slate-800">{displayValue(lastWeekEntry?.weight)}</p>{lastWeekEntry && <p className="text-xs text-slate-400">{formatDate(lastWeekEntry.date || lastWeekEntry.created_date)}</p>}</div>
                          <div><p className="text-xs text-slate-500">משקל נוכחי</p><p className="text-lg font-bold text-green-600">{displayValue(currentWeightEntry?.weight)}</p>{currentWeightEntry && <p className="text-xs text-slate-400">{formatDate(currentWeightEntry.date || currentWeightEntry.created_date)}</p>}</div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="text-purple-600 w-4 h-4" /> סטטוס משימה שבועית</CardTitle></CardHeader>
                  <CardContent>
                    {(() => {
                      const today = startOfToday();
                      const currentTask = userDetails.allTasks?.find(task => {
                        try { return isWithinInterval(today, { start: parseISO(task.week_start_date), end: parseISO(task.week_end_date) }); } catch { return false; }
                      });
                      return currentTask ? (
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">{currentTask.title}</p>
                          <Badge variant={currentTask.status === 'הושלם' ? 'default' : currentTask.status === 'בעבודה' ? 'secondary' : 'outline'} className={`text-xs ${currentTask.status === 'הושלם' ? 'bg-green-100 text-green-800' : currentTask.status === 'בעבודה' ? 'bg-yellow-100 text-yellow-800' : ''}`}>{currentTask.status}</Badge>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center text-sm">אין משימה פעילה לשבוע זה.</p>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="text-amber-600 w-4 h-4" /> הערות מתוכנית הבוסטר</CardTitle></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32 p-2 bg-slate-50 rounded-md border">
                      {(() => {
                        const allNotes = userDetails.allTasks?.flatMap(task => (task.notes_thread || []).map(note => ({ ...note, week: task.week, title: task.title }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) || [];
                        return allNotes.length > 0 ? (
                          <div className="space-y-3">{allNotes.map((note, index) => (<div key={index}><p className="text-slate-800 text-sm">"{note.text}"</p><p className="text-xs text-slate-500 mt-1">מתוך שבוע {note.week}: {note.title} &bull; {getRelativeTime(note.timestamp)}</p></div>))}</div>
                        ) : (
                          <p className="text-slate-500 text-center pt-8 text-sm">לא נמצאו הערות.</p>
                        );
                      })()}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden" dir="rtl">
          <DialogHeader className="text-right ps-8">
            <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-blue-600" />עריכת משתמש</DialogTitle>
            <DialogDescription>עדכן את כל השדות הרצויים. שדות ריקים לא יעודכנו במערכת.</DialogDescription>
          </DialogHeader>
          {editError && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-red-800 text-sm">{editError}</div>}
          <ScrollArea className="max-h-[60vh] px-1">
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">מידע בסיסי</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>שם</Label><Input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="שם" /></div>
                  <div className="space-y-1"><Label>שם מלא</Label><Input value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} placeholder="שם מלא" /></div>
                  <div className="space-y-1 sm:col-span-2"><Label>שם לתצוגה (Display name)</Label><Input value={editForm.displayName || ''} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} placeholder="שם לתצוגה" /></div>
                  <div className="space-y-1 sm:col-span-2"><Label>אימייל</Label><Input type="email" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" /></div>
                  <div className="space-y-1"><Label>סטטוס</Label>
                    <Select value={editForm.status || 'active'} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">פעיל</SelectItem>
                        <SelectItem value="inactive">לא פעיל</SelectItem>
                        <SelectItem value="on_hold">בהמתנה</SelectItem>
                        <SelectItem value="frozen">מוקפא</SelectItem>
                        <SelectItem value="ended">הסתיים</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>תפקיד</Label>
                    <Select value={editForm.role || 'trainee'} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trainee">מתאמן/ת</SelectItem>
                        <SelectItem value="trainer">מאמן/ת</SelectItem>
                        <SelectItem value="admin">מנהל מערכת</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>שם מאמן</Label><Input value={editForm.coach_name || ''} onChange={e => setEditForm(f => ({ ...f, coach_name: e.target.value }))} placeholder="מאמן" /></div>
                  <div className="space-y-1"><Label>אימייל מאמן</Label><Input type="email" value={editForm.coach_email || ''} onChange={e => setEditForm(f => ({ ...f, coach_email: e.target.value }))} placeholder="coach@example.com" /></div>
                  <div className="space-y-1"><Label>טלפון מאמן</Label><Input type="tel" value={editForm.coach_phone || ''} onChange={e => setEditForm(f => ({ ...f, coach_phone: e.target.value }))} placeholder="טלפון מאמן" /></div>
                  <div className="space-y-1"><Label>טלפון משתמש</Label><Input type="tel" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="טלפון" /></div>
                  <div className="space-y-1"><Label>מין</Label>
                    <Select value={editForm.gender || ''} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                      <SelectTrigger><SelectValue placeholder="בחר מין" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">זכר</SelectItem>
                        <SelectItem value="female">נקבה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-2"><Label>קבוצות (מופרדות בפסיק)</Label><Input value={editForm.group_names || ''} onChange={e => setEditForm(f => ({ ...f, group_names: e.target.value }))} placeholder="קבוצה 1, קבוצה 2" /></div>
                  <div className="flex items-center gap-2"><Checkbox id="booster" checked={editForm.booster_enabled} onCheckedChange={c => setEditForm(f => ({ ...f, booster_enabled: !!c }))} /><Label htmlFor="booster">בוסטר מופעל</Label></div>
                  <div className="flex items-center gap-2"><Checkbox id="nutrition" checked={editForm.nutrition_access} onCheckedChange={c => setEditForm(f => ({ ...f, nutrition_access: !!c }))} /><Label htmlFor="nutrition">גישה לתזונה</Label></div>
                  <div className="flex items-center gap-2"><Checkbox id="contract_signed" checked={editForm.contract_signed} onCheckedChange={c => setEditForm(f => ({ ...f, contract_signed: !!c }))} /><Label htmlFor="contract_signed">חוזה חתום</Label></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">גיל ותאריכים</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>תאריך לידה</Label><Input type="date" value={editForm.birth_date || ''} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>תאריך הצטרפות</Label><Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>גיל</Label><Input type="number" min="1" max="120" value={editForm.age || ''} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} placeholder="גיל" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">משקל וגובה</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1"><Label>גובה (ס״מ)</Label><Input type="number" min="0" value={editForm.height || ''} onChange={e => setEditForm(f => ({ ...f, height: e.target.value }))} placeholder="170" /></div>
                  <div className="space-y-1"><Label>משקל התחלתי</Label><Input type="number" step="0.1" value={editForm.initial_weight || ''} onChange={e => setEditForm(f => ({ ...f, initial_weight: e.target.value }))} placeholder="ק״ג" /></div>
                  <div className="space-y-1"><Label>משקל נוכחי</Label><Input type="number" step="0.1" value={editForm.weight || ''} onChange={e => setEditForm(f => ({ ...f, weight: e.target.value }))} placeholder="ק״ג" /></div>
                  <div className="space-y-1"><Label>BMI</Label><Input type="number" step="0.1" value={editForm.bmi || ''} onChange={e => setEditForm(f => ({ ...f, bmi: e.target.value }))} placeholder="BMI" /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">הרכב גוף ומדדים</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1"><Label>גיל מטבולי</Label><Input type="number" value={editForm.metabolic_age || ''} onChange={e => setEditForm(f => ({ ...f, metabolic_age: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>שומן ויסצרלי</Label><Input type="number" step="0.1" value={editForm.visceral_fat || ''} onChange={e => setEditForm(f => ({ ...f, visceral_fat: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>מסת שריר (ק״ג)</Label><Input type="number" step="0.1" value={editForm.muscle_mass || ''} onChange={e => setEditForm(f => ({ ...f, muscle_mass: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>אחוז שומן</Label><Input type="number" step="0.1" value={editForm.fat_percentage || ''} onChange={e => setEditForm(f => ({ ...f, fat_percentage: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>אחוז מים</Label><Input type="number" step="0.1" value={editForm.body_water_percentage || ''} onChange={e => setEditForm(f => ({ ...f, body_water_percentage: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>דירוג מבנה גוף (1-9)</Label><Input type="number" min="1" max="9" value={editForm.physique_rating || ''} onChange={e => setEditForm(f => ({ ...f, physique_rating: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>BMR</Label><Input type="number" value={editForm.bmr || ''} onChange={e => setEditForm(f => ({ ...f, bmr: e.target.value }))} /></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">מדידות היקפים (ס״מ)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1"><Label>צוואר</Label><Input type="number" step="0.1" value={editForm.neck_circumference || ''} onChange={e => setEditForm(f => ({ ...f, neck_circumference: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>חזה</Label><Input type="number" step="0.1" value={editForm.chest_circumference || ''} onChange={e => setEditForm(f => ({ ...f, chest_circumference: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>מותן</Label><Input type="number" step="0.1" value={editForm.waist_circumference || ''} onChange={e => setEditForm(f => ({ ...f, waist_circumference: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>ירכיים</Label><Input type="number" step="0.1" value={editForm.hip_circumference || ''} onChange={e => setEditForm(f => ({ ...f, hip_circumference: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>ישבן</Label><Input type="number" step="0.1" value={editForm.glutes_circumference || ''} onChange={e => setEditForm(f => ({ ...f, glutes_circumference: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>יד ימין</Label><Input type="number" step="0.1" value={editForm.bicep_circumference_right || ''} onChange={e => setEditForm(f => ({ ...f, bicep_circumference_right: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>יד שמאל</Label><Input type="number" step="0.1" value={editForm.bicep_circumference_left || ''} onChange={e => setEditForm(f => ({ ...f, bicep_circumference_left: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>ירך ימין</Label><Input type="number" step="0.1" value={editForm.thigh_circumference_right || ''} onChange={e => setEditForm(f => ({ ...f, thigh_circumference_right: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>ירך שמאל</Label><Input type="number" step="0.1" value={editForm.thigh_circumference_left || ''} onChange={e => setEditForm(f => ({ ...f, thigh_circumference_left: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>שוק ימין</Label><Input type="number" step="0.1" value={editForm.calf_circumference_right || ''} onChange={e => setEditForm(f => ({ ...f, calf_circumference_right: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>שוק שמאל</Label><Input type="number" step="0.1" value={editForm.calf_circumference_left || ''} onChange={e => setEditForm(f => ({ ...f, calf_circumference_left: e.target.value }))} /></div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2 sm:flex-row-reverse">
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Save className="w-4 h-4 ms-2" />}
              שמור שינויים
            </Button>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════
// ── Main Component ──
// ══════════════════════════════════════════
export default function UserManagement({ initialUserEmail, startInEditMode, adminUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/trainer') ? '/trainer' : '/admin';

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [boosterFilter, setBoosterFilter] = useState('all');
  const [weightChangeFilter, setWeightChangeFilter] = useState('all');
  const [error, setError] = useState(null);
  const [networkError, setNetworkError] = useState(false);
  const [remindersSent, setRemindersSent] = useState({});
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Screen navigation — clicking user goes to detail screen
  const [selectedDetailUser, setSelectedDetailUser] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedGroup, statusFilter, boosterFilter, weightChangeFilter]);

  const displayValue = useCallback((value, unit = '') => {
    if (value === null || value === undefined || value === '' || isNaN(value)) return 'N/A';
    return unit ? `${value} ${unit}` : value;
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
        return { value, date: measurement.date || measurement.created_date, measurementId: measurement.id };
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

    const sortedMeasurements = [...userWeights].sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date));
    const syncedUser = { ...user };
    syncedUser.measurementSync = {};

    const measurementFields = ['weight', 'height', 'bmi', 'metabolic_age', 'visceral_fat', 'muscle_mass', 'fat_percentage', 'body_water_percentage', 'physique_rating', 'bmr', 'chest_circumference', 'waist_circumference', 'hip_circumference', 'glutes_circumference', 'neck_circumference', 'bicep_circumference_right', 'bicep_circumference_left', 'thigh_circumference_right', 'thigh_circumference_left', 'calf_circumference_right', 'calf_circumference_left'];

    measurementFields.forEach(fieldName => {
      const latestValue = findLatestAvailableValue(sortedMeasurements, fieldName);
      if (latestValue) {
        if (fieldName === 'weight') { syncedUser.current_weight = latestValue.value; syncedUser.weight = latestValue.value; }
        else if (fieldName === 'hip_circumference' && !latestValue.value && findLatestAvailableValue(sortedMeasurements, 'glutes_circumference')?.value) {
          const glutesValue = findLatestAvailableValue(sortedMeasurements, 'glutes_circumference');
          syncedUser.hip_circumference = glutesValue.value;
          syncedUser.measurementSync.hip_circumference = { value: glutesValue.value, syncedFromDate: glutesValue.date, syncedFromMeasurementId: glutesValue.measurementId, syncedAt: new Date().toISOString() };
        } else if (fieldName === 'glutes_circumference' && !latestValue.value && findLatestAvailableValue(sortedMeasurements, 'hip_circumference')?.value) {
          const hipValue = findLatestAvailableValue(sortedMeasurements, 'hip_circumference');
          syncedUser.glutes_circumference = hipValue.value;
          syncedUser.measurementSync.glutes_circumference = { value: hipValue.value, syncedFromDate: hipValue.date, syncedFromMeasurementId: hipValue.measurementId, syncedAt: new Date().toISOString() };
        } else { syncedUser[fieldName] = latestValue.value; }
        if (!syncedUser.measurementSync[fieldName]) {
          syncedUser.measurementSync[fieldName] = { value: latestValue.value, syncedFromDate: latestValue.date, syncedFromMeasurementId: latestValue.measurementId, syncedAt: new Date().toISOString() };
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
          syncedUser.measurementSync.bmi = { value: syncedUser.bmi, syncedFromDate: syncedUser.measurementSync.weight?.syncedFromDate || new Date().toISOString(), syncedFromMeasurementId: 'calculated_fallback', syncedAt: new Date().toISOString() };
        }
      }
    }

    if (!syncedUser.age && syncedUser.birth_date) {
      const birthDate = new Date(syncedUser.birth_date);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();
      if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) calculatedAge--;
      syncedUser.age = calculatedAge;
    }
    syncedUser.latestMeasurement = sortedMeasurements[0] || null;
    return syncedUser;
  }, [findLatestAvailableValue]);

  const getWeightChangeStatus = useCallback((user) => {
    if (!user.allWeights || user.allWeights.length < 2) return { status: '—', changeType: 'stable', text: 'ללא שינוי', color: 'text-gray-500' };
    const latestWeight = parseFloat(user.allWeights[0].weight);
    const previousWeight = parseFloat(user.allWeights[1].weight);
    if (isNaN(latestWeight) || isNaN(previousWeight)) return { status: '—', changeType: 'stable', text: 'מידע חסר', color: 'text-gray-500' };
    const change = latestWeight - previousWeight;
    if (Math.abs(change) < 0.1) return { status: '—', changeType: 'stable', text: 'ללא שינוי', color: 'text-gray-500' };
    const displayChange = Math.abs(change).toFixed(1);
    return change > 0 ? { status: '⬆', changeType: 'gain', text: `עלייה של ${displayChange} ק"ג`, color: 'text-red-600' } : { status: '⬇', changeType: 'loss', text: `ירידה של ${displayChange} ק"ג`, color: 'text-green-600' };
  }, []);

  const getLastWeighInDate = useCallback((user) => {
    const lastWeightDate = user.measurementSync?.weight?.syncedFromDate || user.latestMeasurement?.date || user.latestMeasurement?.created_date;
    if (!lastWeightDate) return 'לא עודכן';
    return `שקילה אחרונה: ${formatDate(lastWeightDate)}`;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true); setNetworkError(false); setError(null);
    try {
      const listUsers = adminUser ? () => User.listForStaff(adminUser) : () => User.list();
      let [allUsersRaw, allGroupsData] = await Promise.all([
        listUsers().catch(e => { console.warn("Failed to load users:", e); return []; }),
        UserGroup.list().catch(e => { console.warn("Failed to load user groups:", e); return []; })
      ]);
      allGroupsData = allGroupsData || [];
      // Trainers see only users in their groups and only their groups in the dropdown
      const isTrainer = adminUser && adminUser.role === 'trainer' && adminUser.email;
      if (isTrainer) {
        const trainerGroupNames = new Set(
          allGroupsData
            .filter(g => (g.assigned_coach || '').toLowerCase() === (adminUser.email || '').toLowerCase())
            .map(g => g.name)
        );
        allGroupsData = allGroupsData.filter(g => trainerGroupNames.has(g.name));
        allUsersRaw = (allUsersRaw || []).filter(u =>
          Array.isArray(u.group_names) && u.group_names.some(gn => trainerGroupNames.has(gn))
        );
      }
      const allUsers = allUsersRaw || [];
      setGroups(allGroupsData);
      if (allUsers.length === 0) { setUsers([]); setIsLoading(false); return; }

      const userEmails = allUsers.map(u => u.email).filter(Boolean);
      let allWeightEntries = [];
      let allWorkoutEntries = [];
      try { allWeightEntries = await WeightEntry.filter({ user_email: { $in: userEmails } }, '-created_date'); } catch (weightError) { console.warn("Failed to load weight entries:", weightError); if (weightError.message?.includes('Network Error') || !navigator.onLine) { handleNetworkError(weightError); setIsLoading(false); return; } }
      try { allWorkoutEntries = await Workout.filter({ created_by: { $in: userEmails } }, '-date'); } catch (workoutError) { console.warn("Failed to load workout entries:", workoutError); if (workoutError.message?.includes('Network Error') || !navigator.onLine) { handleNetworkError(workoutError); setIsLoading(false); return; } }

      const usersWithData = allUsers.map(user => {
        const userWeights = allWeightEntries.filter(w => w.user_email === user.email);
        const userWorkouts = allWorkoutEntries.filter(wo => wo.created_by === user.email);
        const syncedUser = syncUserWithLatestMeasurements(user, userWeights);
        return { ...syncedUser, allWeights: userWeights, recentWeights: userWeights.slice(0, 2), recentWorkouts: userWorkouts.filter(w => isWithinInterval(parseISO(w.date), { start: subDays(new Date(), 60), end: new Date() })) };
      }).sort((a, b) => {
        const lastWeightDateA = a.measurementSync?.weight?.syncedFromDate || a.latestMeasurement?.date || a.latestMeasurement?.created_date;
        const lastWeightDateB = b.measurementSync?.weight?.syncedFromDate || b.latestMeasurement?.date || b.latestMeasurement?.created_date;
        if (!lastWeightDateA && !lastWeightDateB) return (a.name || a.email || '').localeCompare(b.name || b.email || '');
        if (!lastWeightDateA) return -1;
        if (!lastWeightDateB) return 1;
        return new Date(lastWeightDateA) - new Date(lastWeightDateB);
      });
      setUsers(usersWithData);
    } catch (err) {
      console.error("Error loading users:", err);
      if (err.message?.includes('Network Error') || !navigator.onLine) handleNetworkError(err);
      else setError("שגיאה בטעינת נתוני משתמשים");
    } finally { setIsLoading(false); }
  }, [handleNetworkError, syncUserWithLatestMeasurements, adminUser]);

  useEffect(() => { loadData(); }, [loadData, lastRefresh]);

  useEffect(() => {
    if (initialUserEmail && users.length > 0) {
      const identifier = (initialUserEmail || '').trim();
      const userToSelect = users.find(
        (u) =>
          (u.email && u.email.toLowerCase() === identifier.toLowerCase()) ||
          u.id === identifier ||
          u.uid === identifier
      );
      if (userToSelect) {
        setSelectedDetailUser(userToSelect);
        setSearchTerm(userToSelect.id || userToSelect.uid || userToSelect.email || identifier);
        const segment = encodeURIComponent(userToSelect.email || userToSelect.id || userToSelect.uid || identifier);
        navigate(`${basePath}/user-management/user-list/${segment}`, { replace: true });
      } else {
        setSearchTerm(identifier);
      }
    }
  }, [initialUserEmail, users, basePath, navigate]);

  const retryLoad = useCallback(() => { setNetworkError(false); setError(null); loadData(); }, [loadData]);
  const forceRefresh = useCallback(() => { setLastRefresh(Date.now()); loadData(); }, [loadData]);

  useEffect(() => { window.refreshUserManagement = forceRefresh; return () => { delete window.refreshUserManagement; }; }, [forceRefresh]);

  const getStatusColor = useCallback((status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'פעיל') return 'bg-green-500 text-white';
    if (s === 'inactive' || s === 'לא פעיל' || s === 'ended' || s === 'הסתיים') return 'bg-red-500 text-white';
    if (s === 'on_hold' || s === 'pending' || s === 'בהמתנה' || s === 'ממתין' || s === 'frozen' || s === 'מוקפא') return 'bg-yellow-500 text-white';
    return 'bg-gray-500 text-white';
  }, []);

  const handleSendReminder = useCallback(async (user) => {
    try {
      const lastWeightDate = user.measurementSync?.weight?.syncedFromDate;
      const daysSinceLastUpdate = lastWeightDate ? differenceInDays(new Date(), new Date(lastWeightDate)) : 0;
      const notificationTitle = 'תזכורת: עדכון משקל';
      const notificationMessage = 'המאמן/ת שלך מבקש/ת ממך לעדכן את המשקל שלך באפליקציה.';
      await WeightReminder.create({ user_email: user.email, message: 'המאמן/ת מבקש/ת לעדכן את המשקל שלך.', reminder_date: new Date().toISOString(), days_since_last_update: daysSinceLastUpdate });
      await CoachNotification.create({ user_email: user.email, user_name: user.name || user.full_name || 'משתמש לא ידוע', coach_email: 'system', notification_type: 'weight_reminder', notification_title: notificationTitle, notification_message: notificationMessage, notification_details: { days_since_last_update: daysSinceLastUpdate, reminder_date: new Date().toISOString() }, is_read: false, created_date: new Date().toISOString() });
      try { await SendFCMNotification({ userEmail: user.email, title: notificationTitle, body: notificationMessage, data: { type: 'weight_reminder', user_email: user.email, days_since_last_update: daysSinceLastUpdate.toString() } }); console.log('✅ FCM notification sent successfully'); } catch (fcmError) { console.error('⚠️ Failed to send FCM notification:', fcmError); }
      setRemindersSent(prev => ({...prev, [user.id]: true}));
    } catch(err) { console.error("Failed to send weight reminder:", err); alert("שגיאה בשליחת התזכורת."); }
  }, []);

  const handleImageUpdated = useCallback((uid, newUrl) => {
    setUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, profile_image_url: newUrl } : u));
    if (selectedDetailUser && (selectedDetailUser.uid || selectedDetailUser.id) === uid) {
      setSelectedDetailUser(prev => ({ ...prev, profile_image_url: newUrl }));
    }
  }, [selectedDetailUser]);

  const generateUserReport = useCallback((user) => {
    const weightChange = getWeightChangeStatus(user);
    const lastWeightDate = user.measurementSync?.weight?.syncedFromDate;
    const daysSinceLastWeightUpdate = lastWeightDate ? differenceInDays(new Date(), new Date(lastWeightDate)) : null;
    const isReminderSent = remindersSent[user.id];
    const getWarningLevel = () => {
      if (daysSinceLastWeightUpdate === null) return 'normal';
      if (daysSinceLastWeightUpdate > 14) return 'normal';
      if (daysSinceLastWeightUpdate >= 6) return 'warning';
      return 'normal';
    };
    const warningLevel = getWarningLevel();
    const showReminderButton = daysSinceLastWeightUpdate === null || daysSinceLastWeightUpdate > 14;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className={`rounded-xl shadow-md border overflow-hidden cursor-pointer ${
          warningLevel === 'critical' ? 'bg-red-50 border-red-300 shadow-red-200' :
          warningLevel === 'warning' ? 'bg-orange-50 border-orange-300 shadow-orange-200' :
          'bg-white border-slate-200'
        }`}
        style={{ direction: 'rtl' }}
        onClick={() => {
          setSelectedDetailUser(user);
          setSearchTerm(user.id || user.uid || user.email || '');
          const segment = encodeURIComponent(user.email || user.id || user.uid || '');
          navigate(`${basePath}/user-management/user-list/${segment}`);
        }}
      >
        <div className={`p-3 sm:p-4 transition-colors ${warningLevel === 'critical' ? 'hover:bg-red-100' : warningLevel === 'warning' ? 'hover:bg-orange-100' : 'hover:bg-slate-50'}`}>

          {/* ── Mobile layout ── */}
          <div className="block sm:hidden space-y-3" style={{ direction: 'rtl', textAlign: 'right' }}>
            <div className="flex items-center gap-2">
              <AvatarWithUpload user={user} size="sm" onImageUpdated={handleImageUpdated} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800 text-base truncate">{user.name}</h3>
                  {user.role === 'admin' && <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs font-medium">מנהל</Badge>}
                  {warningLevel === 'critical' && <div className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /><span className="text-xs font-medium">דחוף!</span></div>}
                  {warningLevel === 'warning' && <div className="flex items-center gap-1 text-orange-600"><AlertCircle className="w-3 h-3" /><span className="text-xs font-medium">נדרש</span></div>}
                </div>
                {user.email && <p className="text-xs text-slate-500 truncate mt-0.5" title={user.email}>{user.email}</p>}
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 rotate-180 flex-shrink-0" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className={`flex items-center gap-1 font-medium ${weightChange.color}`}>
                <span className="text-base">{weightChange.status}</span>
                <span>{weightChange.status !== '—' ? `${Math.abs(parseFloat(weightChange.text.match(/[\d.]+/)?.[0] || '0')).toFixed(1)} ק"ג` : '—'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Badge className={`${getStatusColor(user.status)} text-xs px-2 py-1`}>{getStatusLabel(user.status)}</Badge>
            </div>
          </div>

          {/* ── Desktop layout ── */}
            <div className="hidden sm:flex items-center gap-4" style={{ direction: 'rtl', textAlign: 'right' }}>
            <AvatarWithUpload user={user} size="md" onImageUpdated={handleImageUpdated} />
            <div className="flex-1 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800 text-lg">{user.name}</h3>
                  {user.role === 'admin' && <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs font-medium">מנהל מערכת</Badge>}
                  {warningLevel === 'critical' && <div className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-medium">דחוף!</span></div>}
                  {warningLevel === 'warning' && <div className="flex items-center gap-1 text-orange-600"><AlertCircle className="w-4 h-4" /><span className="text-xs font-medium">נדרש עדכון</span></div>}
                </div>
                {user.email && <p className="text-sm text-slate-500" title={user.email}>{user.email}</p>}
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${weightChange.color}`}>
                <span className="text-lg">{weightChange.status}</span><span>{weightChange.text}</span>
              </div>
              <div className="flex items-center gap-4">
                <Badge className={getStatusColor(user.status)}>{getStatusLabel(user.status)}</Badge>
                <ArrowRight className="w-5 h-5 text-slate-300 rotate-180" />
              </div>
            </div>
          </div>

          {warningLevel === 'warning' && (
            <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-orange-600" /><span className="text-orange-800 text-sm font-medium">לא עודכן {daysSinceLastWeightUpdate} ימים - מומלץ לעדכן</span></div>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSendReminder(user); }} disabled={isReminderSent} className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50 w-full sm:w-auto">
                {isReminderSent ? <><CheckCircle className="w-3 h-3 ms-1" />נשלח</> : <><Bell className="w-3 h-3 ms-1" /><span className="hidden sm:inline">שלח תזכורת</span><span className="sm:hidden">תזכורת</span></>}
              </Button>
            </div>
          )}
          {showReminderButton && (
            <div className="mt-3 p-2 bg-slate-100 border border-slate-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-slate-600" /><span className="text-slate-800 text-sm font-medium">{daysSinceLastWeightUpdate != null ? `${daysSinceLastWeightUpdate} ימים ללא עדכון` : 'אין נתוני משקל'}</span></div>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSendReminder(user); }} disabled={isReminderSent} className="text-xs border-slate-400 text-slate-700 hover:bg-slate-200 w-full sm:w-auto">
                {isReminderSent ? <><CheckCircle className="w-3 h-3 ms-1" />נשלח</> : <><Bell className="w-3 h-3 ms-1" /><span className="hidden sm:inline">שלח תזכורת</span><span className="sm:hidden">תזכורת</span></>}
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    );
  }, [getWeightChangeStatus, remindersSent, handleSendReminder, getStatusColor, displayValue, handleImageUpdated]);

  const validUsers = useMemo(() => users.filter(u => u && typeof u === 'object' && u.email), [users]);

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(validUsers)) return [];
    const currentUserEmail = adminUser?.email?.toLowerCase?.() || '';
    const currentUserId = adminUser?.id;
    return validUsers.filter(user => {
      if (user.role === 'admin' || user.role === 'trainer') return false;
      if (currentUserEmail && (user.email || '').toLowerCase() === currentUserEmail) return false;
      if (currentUserId && user.id === currentUserId) return false;
      const userName = user.name || user.full_name || '';
      const userEmail = user.email || '';
      const userId = user.id || user.uid || '';
      const matchesSearch = searchTerm === '' || (typeof userName === 'string' && userName.toLowerCase().includes(searchTerm.toLowerCase())) || (typeof userEmail === 'string' && userEmail.toLowerCase().includes(searchTerm.toLowerCase())) || (typeof userId === 'string' && userId.toLowerCase().includes(searchTerm.toLowerCase()));
      const groupMatch = selectedGroup === 'all' || (Array.isArray(user.group_names) && user.group_names.includes(selectedGroup));
      const matchesStatus = statusFilter === 'all' || (() => {
        const s = (user.status || '').toLowerCase();
        if (statusFilter === 'active') return s === 'active' || s === 'פעיל';
        if (statusFilter === 'inactive') return s === 'inactive' || s === 'לא פעיל' || s === 'ended' || s === 'הסתיים';
        if (statusFilter === 'on_hold') return s === 'on_hold' || s === 'pending' || s === 'בהמתנה' || s === 'ממתין' || s === 'frozen' || s === 'מוקפא';
        return user.status === statusFilter;
      })();
      const matchesBooster = boosterFilter === 'all' || (boosterFilter === 'enabled' && user.booster_enabled) || (boosterFilter === 'disabled' && !user.booster_enabled);
      const weightChange = getWeightChangeStatus(user);
      const matchesWeightChange = weightChangeFilter === 'all' || weightChange.changeType === weightChangeFilter;
      return matchesSearch && groupMatch && matchesStatus && matchesBooster && matchesWeightChange;
    });
  }, [validUsers, searchTerm, selectedGroup, statusFilter, boosterFilter, weightChangeFilter, getWeightChangeStatus, adminUser]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedUsers = useMemo(() => filteredUsers.slice(startIndex, endIndex), [filteredUsers, startIndex, endIndex]);

  if (networkError) {
    return (<Card className="max-w-md mx-auto mt-8"><CardContent className="text-center py-8"><WifiOff className="w-16 h-16 mx-auto mb-4 text-red-500" /><h3 className="text-lg font-semibold text-red-600 mb-2">שגיאת חיבור</h3><p className="text-gray-600 mb-4">לא ניתן להתחבר לשרת. בדוק את החיבור לאינטרנט.</p><Button onClick={retryLoad} className="gap-2"><RefreshCw className="w-4 h-4" />נסה שוב</Button></CardContent></Card>);
  }
  if (isLoading) {
    return (<div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /><span className="me-2 text-slate-600">טוען נתוני משתמשים...</span></div>);
  }
  if (error) {
    return (<Card className="max-w-md mx-auto mt-8"><CardContent className="text-center py-8"><AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" /><h3 className="text-lg font-semibold text-amber-600 mb-2">שגיאה</h3><p className="text-gray-600 mb-4">{error}</p><Button onClick={retryLoad} className="gap-2"><RefreshCw className="w-4 h-4" />נסה שוב</Button></CardContent></Card>);
  }

  // ── USER DETAIL SCREEN ──
  if (selectedDetailUser) {
    const shareableUserLink = `${typeof window !== 'undefined' ? window.location.origin : ''}${basePath}/user-management/user-list/${encodeURIComponent(selectedDetailUser.email || selectedDetailUser.id || selectedDetailUser.uid || '')}`;
    return (
      <UserDetailScreen
        user={selectedDetailUser}
        shareableUserLink={shareableUserLink}
        onBack={() => {
          navigate(`${basePath}/user-management/user-list`);
          setSelectedDetailUser(null);
        }}
        displayValue={displayValue}
        syncUserWithLatestMeasurements={syncUserWithLatestMeasurements}
        onImageUpdated={handleImageUpdated}
        onUserUpdated={(updatedUser) => {
          setSelectedDetailUser(updatedUser);
          setUsers(prev => prev.map(u => (u.id === updatedUser.id || u.uid === updatedUser.uid || (u.email && updatedUser.email && u.email.toLowerCase() === updatedUser.email.toLowerCase())) ? { ...u, ...updatedUser } : u));
        }}
      />
    );
  }

  // ── USER LIST SCREEN ──
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">ניהול מתאמנים ({filteredUsers.length})</CardTitle>
        <CardDescription className="text-sm">לחץ על מתאמן לצפייה בפרטים מלאים, מעקב ופעילות.</CardDescription>
        <div className="flex flex-col gap-2 mt-2 md:flex-row md:flex-wrap">
          <input type="text" placeholder="חיפוש לפי שם, אימייל או מזהה משתמש..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-grow p-2 border rounded-md text-sm min-w-[200px]" style={{ direction: 'rtl', textAlign: 'right' }} />
          <Select value={selectedGroup} onValueChange={setSelectedGroup}><SelectTrigger className="w-full md:w-[220px] min-w-[150px]"><SelectValue placeholder="סינון לפי קבוצה" /></SelectTrigger><SelectContent><SelectItem value="all">כל הקבוצות</SelectItem>{groups.map(group => <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>)}</SelectContent></Select>
          <Select value={boosterFilter} onValueChange={setBoosterFilter}><SelectTrigger className="w-full md:w-[220px] min-w-[150px]"><SelectValue placeholder="סינון לפי בוסטר" /></SelectTrigger><SelectContent><SelectItem value="all">כל המשתמשים</SelectItem><SelectItem value="enabled">בוסטר מופעל</SelectItem><SelectItem value="disabled">בוסטר לא מופעל</SelectItem></SelectContent></Select>
          <Select value={weightChangeFilter} onValueChange={setWeightChangeFilter}><SelectTrigger className="w-full md:w-[220px] min-w-[150px]"><SelectValue placeholder="סינון לפי שינוי משקל" /></SelectTrigger><SelectContent><SelectItem value="all">הצג הכל</SelectItem><SelectItem value="gain">עלייה במשקל</SelectItem><SelectItem value="loss">ירידה במשקל</SelectItem><SelectItem value="stable">משקל יציב</SelectItem></SelectContent></Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[60vh] bg-slate-50">
          <div className="space-y-4 p-4">
            {displayedUsers.length === 0 ? (
              <div className="space-y-2">
                <div className="rounded border border-blue-200 bg-blue-50/80 px-2 py-1.5 text-center text-xs text-blue-900" dir="rtl">
                  עדיין אין מתאמנים — הזמן מתאמנים עם הקישור למטה.
                </div>
                <InviteLinkCard compact />
              </div>
            ) : (
              displayedUsers.map((user) => <div key={user.id}>{generateUserReport(user)}</div>)
            )}
          </div>
        </ScrollArea>

        {filteredUsers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 px-4 pb-4 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <Label htmlFor="itemsPerPage" className="text-sm text-slate-600">מתאמנים לעמוד:</Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="5">5</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><p className="text-sm text-slate-600">עמוד {currentPage} מתוך {totalPages} ({filteredUsers.length} מתאמנים)</p></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronRight className="w-4 h-4" />קודם</Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return <Button key={pageNum} variant={currentPage === pageNum ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(pageNum)} className="w-10">{pageNum}</Button>;
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>הבא<ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
