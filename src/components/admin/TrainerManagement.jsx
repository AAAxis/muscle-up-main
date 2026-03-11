
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, UserGroup } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, Edit, Save, User as UserIcon, Users, Loader2, Shield, ShieldCheck,
  ChevronRight, Phone, Mail, Calendar, UserPlus, UserMinus, Activity,
  Snowflake, XCircle, Zap, Utensils, FolderOpen, ArrowRight, Scale, FileText, Camera, Building2, ImageIcon, Link2, Copy, Check, Plus, Trash2, Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';

// ── Status badge helper ──
const getStatusBadge = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'מוקפא' || s === 'frozen' || s === 'on_hold') {
    return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200 text-xs"><Snowflake className="w-2.5 h-2.5 ms-1" />מוקפא</Badge>;
  }
  if (s === 'בהמתנה' || s === 'ממתין' || s === 'pending') {
    return <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs">בהמתנה</Badge>;
  }
  if (s === 'לא פעיל' || s === 'inactive' || s === 'הסתיים' || s === 'ended') {
    return <Badge className="bg-red-100 text-red-800 border border-red-200 text-xs"><XCircle className="w-2.5 h-2.5 ms-1" />לא פעיל</Badge>;
  }
  return <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs"><Activity className="w-2.5 h-2.5 ms-1" />פעיל</Badge>;
};

// ══════════════════════════════════════════
// ── Avatar with Upload ──
// ══════════════════════════════════════════
function AvatarWithUpload({ user, size = 'lg', onImageUpdated, fallbackIcon: FallbackIcon = UserIcon, borderColor = 'border-blue-200', bgColor = 'bg-blue-100', iconColor = 'text-blue-600' }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-14 h-14',
  };
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
    xl: 'w-7 h-7',
  };
  const cameraIconSizes = {
    sm: 'w-5 h-5 p-0.5',
    md: 'w-6 h-6 p-0.5',
    lg: 'w-8 h-8 p-1.5',
    xl: 'w-7 h-7 p-1',
  };
  const borderClasses = (size === 'sm') ? 'border' : 'border-2';

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
          className={`${sizeClasses[size]} rounded-full object-cover ${borderClasses} ${borderColor}`}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full ${bgColor} flex items-center justify-center ${borderClasses} ${borderColor}`}>
          <FallbackIcon className={`${iconSizes[size]} ${iconColor}`} />
        </div>
      )}

      {/* Upload overlay — visible on hover */}
      {isUploading ? (
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          <Loader2 className={`${iconSizes[size === 'sm' ? 'sm' : 'md']} text-white animate-spin`} />
        </div>
      ) : (
        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className={`${cameraIconSizes[size]} rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
            <Camera className="w-3.5 h-3.5 text-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ── Trainee Detail Screen ──
// ══════════════════════════════════════════
function TraineeDetailScreen({ trainee, onBack, onImageUpdated }) {
  if (!trainee) return null;

  const age = trainee.birth_date
    ? Math.floor((Date.now() - new Date(trainee.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const heightCm = trainee.height ? Math.round(trainee.height * 100) : null;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-2">
        <ChevronRight className="w-4 h-4" />
        חזרה למאמן
      </Button>

      {/* User Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AvatarWithUpload user={trainee} size="lg" onImageUpdated={onImageUpdated} borderColor="border-slate-200" bgColor="bg-slate-100" iconColor="text-slate-400" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800">{trainee.name || trainee.full_name || 'חסר שם'}</h2>
              <p className="text-sm text-slate-500 mt-1">{trainee.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {getStatusBadge(trainee.status)}
                {trainee.booster_enabled && (
                  <Badge className="bg-purple-100 text-purple-700 border border-purple-200 text-xs"><Zap className="w-2.5 h-2.5 ms-1" />בוסטר</Badge>
                )}
                {trainee.nutrition_access && (
                  <Badge className="bg-orange-100 text-orange-700 border border-orange-200 text-xs"><Utensils className="w-2.5 h-2.5 ms-1" />תזונה</Badge>
                )}
                {trainee.contract_signed && (
                  <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs"><FileText className="w-2.5 h-2.5 ms-1" />חוזה חתום</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Personal Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <UserIcon className="w-4 h-4 text-blue-600" />
              פרטים אישיים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {trainee.gender && (
              <div className="flex justify-between"><span className="text-slate-500">מין</span><span className="font-medium">{trainee.gender === 'male' ? 'זכר' : 'נקבה'}</span></div>
            )}
            {age && (
              <div className="flex justify-between"><span className="text-slate-500">גיל</span><span className="font-medium">{age}</span></div>
            )}
            {trainee.birth_date && (
              <div className="flex justify-between"><span className="text-slate-500">תאריך לידה</span><span className="font-medium">{format(new Date(trainee.birth_date), 'dd/MM/yyyy')}</span></div>
            )}
            {heightCm && (
              <div className="flex justify-between"><span className="text-slate-500">גובה</span><span className="font-medium">{heightCm} ס״מ</span></div>
            )}
            {(trainee.coach_phone || trainee.phone) && (
              <div className="flex justify-between"><span className="text-slate-500">טלפון</span><span className="font-medium">{trainee.coach_phone || trainee.phone}</span></div>
            )}
          </CardContent>
        </Card>

        {/* Weight & Body */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-green-600" />
              נתוני גוף
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {trainee.initial_weight && (
              <div className="flex justify-between"><span className="text-slate-500">משקל התחלתי</span><span className="font-medium">{trainee.initial_weight} ק״ג</span></div>
            )}
            {trainee.weight && (
              <div className="flex justify-between"><span className="text-slate-500">משקל נוכחי</span><span className="font-medium">{trainee.weight} ק״ג</span></div>
            )}
            {trainee.bmi && (
              <div className="flex justify-between"><span className="text-slate-500">BMI</span><span className="font-medium">{trainee.bmi}</span></div>
            )}
            {trainee.body_fat_percentage && (
              <div className="flex justify-between"><span className="text-slate-500">אחוז שומן</span><span className="font-medium">{trainee.body_fat_percentage}%</span></div>
            )}
            {trainee.metabolic_age && (
              <div className="flex justify-between"><span className="text-slate-500">גיל מטבולי</span><span className="font-medium">{trainee.metabolic_age}</span></div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              חשבון
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">מאמן</span><span className="font-medium">{trainee.coach_name || 'לא שויך'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">קבוצה</span><span className="font-medium">{trainee.group_names?.[0] || 'ללא קבוצה'}</span></div>
            {trainee.start_date && (
              <div className="flex justify-between"><span className="text-slate-500">תאריך הצטרפות</span><span className="font-medium">{format(new Date(trainee.start_date), 'dd/MM/yyyy')}</span></div>
            )}
            <div className="flex justify-between"><span className="text-slate-500">סטטוס</span>{getStatusBadge(trainee.status)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ── Group Edit Screen ──
// ══════════════════════════════════════════
function GroupEditScreen({ group, trainer, allUsers, isSystemAdmin, onBack, onRefresh, onEditUser, onMessage, onError }) {
  const isNew = !group;
  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    color_tag: group?.color_tag || '#3b82f6',
    status: group?.status || 'Active',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isAssigningToGroup, setIsAssigningToGroup] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);

  // Members in this group
  const membersInGroup = useMemo(() => {
    if (!group?.name) return [];
    return allUsers.filter(u => Array.isArray(u.group_names) && u.group_names.includes(group.name));
  }, [allUsers, group?.name]);

  // Users available to add to this group
  const availableTrainees = useMemo(() => {
    if (!group?.name) return [];
    const coachEmailLower = (trainer.email || '').toLowerCase();
    // System admin can add ANY user from the DB; trainer can only add their own trainees
    const eligible = isSystemAdmin
      ? allUsers.filter(u => {
          const role = (u.role || '').toLowerCase();
          return role !== 'admin' && role !== 'coach';
        })
      : allUsers.filter(u => {
          const role = (u.role || '').toLowerCase();
          return (u.coach_email || '').toLowerCase() === coachEmailLower && role !== 'admin' && role !== 'coach' && role !== 'trainer';
        });
    const notInGroup = eligible.filter(u => !(Array.isArray(u.group_names) && u.group_names.includes(group.name)));
    if (!memberSearchTerm.trim()) return notInGroup.slice(0, 100);
    const term = memberSearchTerm.toLowerCase().trim();
    return notInGroup.filter(u => {
      const name = (u.name || u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    }).slice(0, 100);
  }, [allUsers, trainer.email, group?.name, memberSearchTerm, isSystemAdmin]);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!formData.name?.trim()) return;
    setIsSaving(true);
    if (onError) onError('');
    try {
      const payload = {
        name: formData.name.trim(),
        description: (formData.description || '').trim(),
        color_tag: formData.color_tag || '#3b82f6',
        status: formData.status || 'Active',
        assigned_coach: trainer.email || '',
      };
      if (group) {
        await UserGroup.update(group.id, payload);
        if (onMessage) onMessage('הקבוצה עודכנה בהצלחה.');
      } else {
        await UserGroup.create(payload);
        if (onMessage) onMessage('הקבוצה נוצרה בהצלחה.');
      }
      if (onRefresh) onRefresh();
      onBack();
    } catch (err) {
      console.error('Error saving group:', err);
      if (onError) onError('שגיאה בשמירת הקבוצה.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    const usersInGroup = allUsers.filter(u => Array.isArray(u.group_names) && u.group_names.includes(group.name));
    if (usersInGroup.length > 0) {
      const ok = window.confirm(`לקבוצה זו יש ${usersInGroup.length} משתמשים. לחץ אישור כדי לנתק אותם מהקבוצה, או ביטול כדי לבטל.`);
      if (!ok) return;
    }
    const confirmDelete = window.confirm('האם אתה בטוח שברצונך למחוק את הקבוצה הזו? פעולה זו לא ניתנת לביטול.');
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      for (const user of usersInGroup) {
        const updatedGroups = user.group_names.filter(g => g !== group.name);
        await User.update(user.id, { group_names: updatedGroups });
      }
      await UserGroup.delete(group.id);
      if (onRefresh) onRefresh();
      if (onMessage) onMessage('הקבוצה נמחקה.');
      onBack();
    } catch (err) {
      console.error('Error deleting group:', err);
      if (onError) onError('שגיאה במחיקת הקבוצה.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddUserToGroup = async (user) => {
    const uid = user.id || user.uid;
    if (!uid || !group?.name) return;
    setIsAssigningToGroup(true);
    try {
      const current = Array.isArray(user.group_names) ? user.group_names : [];
      const next = current.includes(group.name) ? current : [...current, group.name];
      const payload = { group_names: next };
      // Set coach + organization logo and program name on trainee so mobile app shows org logo and program name (mobile reads trainee doc)
      const coachEmail = (trainer?.email || '').trim();
      if (coachEmail) {
        payload.coach_email = coachEmail;
        payload.coach_name = trainer?.name || trainer?.full_name || null;
        payload.organization_logo_url = trainer?.organization_logo_url ?? null;
        payload.organization_name = trainer?.organization_name ?? null;
        payload.program_name = trainer?.program_name ?? null;
      }
      await User.update(uid, payload);
      if (onRefresh) onRefresh();
      if (onMessage) onMessage(`${user.name || user.full_name || user.email} שויך לקבוצה.`);
    } catch (err) {
      console.error('Error adding user to group:', err);
      if (onError) onError('שגיאה בשיוך לקבוצה.');
    } finally {
      setIsAssigningToGroup(false);
    }
  };

  const handleRemoveUserFromGroup = async (user) => {
    const uid = user.id || user.uid;
    if (!uid || !group?.name) return;
    setRemovingUserId(uid);
    try {
      const current = Array.isArray(user.group_names) ? user.group_names : [];
      const next = current.filter(g => g !== group.name);
      await User.update(uid, { group_names: next });
      if (onRefresh) onRefresh();
      if (onMessage) onMessage(`${user.name || user.full_name || user.email} הוסר מהקבוצה.`);
    } catch (err) {
      console.error('Error removing user from group:', err);
      if (onError) onError('שגיאה בהסרת המתאמן מהקבוצה.');
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-2">
        <ChevronRight className="w-4 h-4" />
        חזרה למאמן
      </Button>

      {/* Group Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: formData.color_tag + '22', borderColor: formData.color_tag, borderWidth: 2 }}>
              <FolderOpen className="w-6 h-6" style={{ color: formData.color_tag }} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800">{isNew ? 'קבוצה חדשה' : group.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{isNew ? 'צור קבוצה חדשה עבור המאמן' : `${membersInGroup.length} מתאמנים בקבוצה`}</p>
            </div>
            {!isNew && (
              <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Trash2 className="w-4 h-4 ms-2" />}
                מחק קבוצה
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" />
            {isNew ? 'פרטי הקבוצה' : 'עריכת פרטי הקבוצה'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="group-name">שם הקבוצה *</Label>
              <Input
                id="group-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="הזן שם קבוצה..."
                disabled={!!group}
              />
              {group && <p className="text-xs text-slate-500 mt-1">שינוי שם קבוצה לא זמין (משפיע על שיוך מתאמנים).</p>}
            </div>
            <div>
              <Label htmlFor="group-description">תיאור</Label>
              <Textarea
                id="group-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור קצר של הקבוצה..."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Label htmlFor="group-color">צבע</Label>
                <Input
                  id="group-color"
                  type="color"
                  value={formData.color_tag}
                  onChange={(e) => setFormData({ ...formData, color_tag: e.target.value })}
                  className="p-1 h-10 w-20 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="group-status">סטטוס</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger id="group-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">פעיל</SelectItem>
                    <SelectItem value="Inactive">לא פעיל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Save className="w-4 h-4 ms-2" />}
              {isNew ? 'צור קבוצה' : 'שמור שינויים'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members in group (only for existing groups) */}
      {!isNew && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              חברי הקבוצה ({membersInGroup.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {membersInGroup.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">אין מתאמנים בקבוצה זו.</p>
            ) : (
              <div className="space-y-2">
                {membersInGroup.map(user => (
                  <div key={user.id || user.uid} className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {user.profile_image_url ? (
                        <img src={user.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{user.name || user.full_name || 'חסר שם'}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onEditUser && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-slate-700 border-slate-300 hover:bg-slate-50"
                          onClick={(e) => { e.stopPropagation(); onEditUser(user); }}
                        >
                          <Edit className="w-3.5 h-3.5 ms-1" />
                          ערוך
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleRemoveUserFromGroup(user)}
                        disabled={removingUserId === (user.id || user.uid)}
                      >
                        {removingUserId === (user.id || user.uid) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5 ms-1" />}
                        הסר
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add trainees to group (only for existing groups) */}
      {!isNew && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              הוסף מתאמנים לקבוצה
            </CardTitle>
            <CardDescription>{isSystemAdmin ? 'משתמשים מהמערכת שעדיין לא בקבוצה זו' : 'מתאמנים של המאמן שעדיין לא בקבוצה זו'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input placeholder="חפש לפי שם או אימייל..." value={memberSearchTerm} onChange={(e) => setMemberSearchTerm(e.target.value)} className="pe-10" />
            </div>
            {availableTrainees.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {memberSearchTerm.trim() ? 'לא נמצאו משתמשים לפי החיפוש.' : 'כל המשתמשים כבר בקבוצה זו.'}
              </p>
            ) : (
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {availableTrainees.map(user => (
                    <div key={user.id || user.uid} className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {user.profile_image_url ? (
                          <img src={user.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{user.name || user.full_name || 'חסר שם'}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                          {isSystemAdmin && user.coach_email && (user.coach_email || '').toLowerCase() !== (trainer.email || '').toLowerCase() && (
                            <p className="text-xs text-amber-600">משויך ל-{user.coach_name || user.coach_email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {onEditUser && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-slate-700 border-slate-300 hover:bg-slate-50"
                            onClick={(e) => { e.stopPropagation(); onEditUser(user); }}
                          >
                            <Edit className="w-3.5 h-3.5 ms-1" />
                            ערוך
                          </Button>
                        )}
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleAddUserToGroup(user)} disabled={isAssigningToGroup}>
                          {isAssigningToGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 ms-1" />}
                          שייך
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ── Trainer Detail Screen ──
// ══════════════════════════════════════════
function TrainerDetailScreen({ trainer, allUsers, isSystemAdmin, onBack, onEditTrainer, onEditUser, onRemoveTrainer, onRefresh, onMessage, onError, onImageUpdated }) {
  const [selectedGroup, setSelectedGroup] = useState(null);   // null = no group screen, 'new' = create, or group object = edit
  const [groups, setGroups] = useState([]);
  const [inviteLinkCopiedGroupName, setInviteLinkCopiedGroupName] = useState(null);

  useEffect(() => {
    if (!trainer?.email) return;
    let cancelled = false;
    UserGroup.list()
      .then((list) => { if (!cancelled) setGroups(list || []); })
      .catch(() => { if (!cancelled) setGroups([]); });
    return () => { cancelled = true; };
  }, [trainer?.email]);

  const trainerGroups = useMemo(() => {
    if (!trainer?.email) return [];
    return (groups || []).filter((g) => (g.assigned_coach || '').toLowerCase() === (trainer.email || '').toLowerCase());
  }, [groups, trainer?.email]);

  const countUsersInGroup = useCallback((groupName) => {
    return allUsers.filter((u) => Array.isArray(u.group_names) && u.group_names.includes(groupName)).length;
  }, [allUsers]);

  const trainees = useMemo(() => {
    return allUsers.filter(
      u => u.coach_email === trainer.email && u.role !== 'admin' && u.role !== 'coach' && u.role !== 'trainer'
    );
  }, [allUsers, trainer.email]);

  const reloadGroups = useCallback(() => {
    UserGroup.list().then((list) => setGroups(list || []));
  }, []);

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined' || !trainer?.email) return '';
    const base = (window.location?.origin || '').replace(/\/$/, '');
    const params = new URLSearchParams({
      coachEmail: trainer.email,
      coachName: trainer.name || trainer.full_name || '',
    });
    if (trainer.coach_phone || trainer.phone) params.set('coachPhone', trainer.coach_phone || trainer.phone || '');
    return `${base}/invite?${params.toString()}`;
  }, [trainer?.email, trainer?.name, trainer?.full_name, trainer?.coach_phone, trainer?.phone]);

  const inviteLinkForGroup = useCallback((groupName) => {
    if (!inviteLink || !groupName) return inviteLink || '';
    return `${inviteLink}&groupName=${encodeURIComponent(groupName)}`;
  }, [inviteLink]);

  const handleCopyInviteLinkForGroup = useCallback(async (groupName, e) => {
    if (e) e.stopPropagation();
    const link = inviteLinkForGroup(groupName);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setInviteLinkCopiedGroupName(groupName);
      setTimeout(() => setInviteLinkCopiedGroupName(null), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [inviteLinkForGroup]);

  const stats = useMemo(() => {
    const active = trainees.filter(u => {
      const s = (u.status || '').toLowerCase();
      return !s || s === 'פעיל' || s === 'active' || s === 'null' || s === 'undefined';
    }).length;
    const frozen = trainees.filter(u => {
      const s = (u.status || '').toLowerCase();
      return s === 'מוקפא' || s === 'frozen' || s === 'on_hold';
    }).length;
    const inactive = trainees.filter(u => {
      const s = (u.status || '').toLowerCase();
      return s === 'לא פעיל' || s === 'inactive' || s === 'הסתיים' || s === 'ended';
    }).length;
    const withBooster = trainees.filter(u => u.booster_enabled).length;
    const withNutrition = trainees.filter(u => u.nutrition_access).length;

    const groupSet = new Set();
    trainees.forEach(u => {
      if (u.group_names && Array.isArray(u.group_names)) {
        u.group_names.forEach(g => groupSet.add(g));
      }
    });
    return { active, frozen, inactive, withBooster, withNutrition, groups: Array.from(groupSet) };
  }, [trainees]);

  // If a group is selected for editing, show the group edit screen
  if (selectedGroup) {
    return (
      <GroupEditScreen
        group={selectedGroup === 'new' ? null : selectedGroup}
        trainer={trainer}
        allUsers={allUsers}
        isSystemAdmin={isSystemAdmin}
        onBack={() => { setSelectedGroup(null); reloadGroups(); }}
        onRefresh={() => { reloadGroups(); if (onRefresh) onRefresh(); }}
        onEditUser={onEditUser}
        onMessage={onMessage}
        onError={onError}
      />
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-2">
        <ChevronRight className="w-4 h-4" />
        חזרה לרשימת מאמנים
      </Button>

      {/* Trainer Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <AvatarWithUpload user={trainer} size="lg" onImageUpdated={onImageUpdated} fallbackIcon={Shield} borderColor="border-emerald-200" bgColor="bg-emerald-100" iconColor="text-emerald-600" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-slate-800">{trainer.name || trainer.full_name || 'חסר שם'}</h2>
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Shield className="w-3 h-3 ms-1" />מאמן
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mt-2">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{trainer.email}</span>
                {(trainer.coach_phone || trainer.phone) && (
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{trainer.coach_phone || trainer.phone}</span>
                )}
                {trainer.start_date && (
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />הצטרף ב-{format(new Date(trainer.start_date), 'dd/MM/yyyy')}</span>
                )}
              </div>
            </div>
            {isSystemAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEditTrainer(trainer); }}>
                  <Edit className="w-4 h-4 ms-2" />ערוך
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {trainer.organization_logo_url ? (
              <img src={trainer.organization_logo_url} alt={trainer.organization_name || 'לוגו'} className="w-14 h-14 object-contain rounded-xl border border-slate-200 bg-white p-1.5" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-slate-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">ארגון</p>
              <p className="font-semibold text-slate-800 text-lg">{trainer.organization_name || 'לא הוגדר ארגון'}</p>
              {(trainer.program_name || '').trim() ? (
                <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5 text-amber-500" />
                  שם התוכנית באפליקציה: <span className="font-medium text-slate-800">{trainer.program_name}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5 text-slate-300" />
                  שם תוכנית לא הוגדר — לחץ ערוך להגדרה
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div>
        <h3 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Activity className="w-5 h-5 text-emerald-600" />
          סטטיסטיקות
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="text-center"><CardContent className="p-4">
            <p className="text-3xl font-bold text-slate-800">{trainees.length}</p>
            <p className="text-xs text-slate-500 mt-1">סה״כ מתאמנים</p>
          </CardContent></Card>
          <Card className="text-center"><CardContent className="p-4">
            <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-slate-500 mt-1">פעילים</p>
          </CardContent></Card>
          <Card className="text-center"><CardContent className="p-4">
            <p className="text-3xl font-bold text-yellow-600">{stats.frozen}</p>
            <p className="text-xs text-slate-500 mt-1">מוקפאים</p>
          </CardContent></Card>
          <Card className="text-center"><CardContent className="p-4">
            <p className="text-3xl font-bold text-purple-600">{stats.withBooster}</p>
            <p className="text-xs text-slate-500 mt-1">בוסטר פעיל</p>
          </CardContent></Card>
          <Card className="text-center"><CardContent className="p-4">
            <p className="text-3xl font-bold text-orange-600">{stats.withNutrition}</p>
            <p className="text-xs text-slate-500 mt-1">גישה לתזונה</p>
          </CardContent></Card>
        </div>
      </div>

      {/* Trainer's groups (create, edit, delete) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-slate-700 flex items-center gap-1.5">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            קבוצות של המאמן ({trainerGroups.length})
          </h3>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedGroup('new')}>
            <Plus className="w-4 h-4" />
            צור קבוצה
          </Button>
        </div>
        {trainerGroups.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-slate-500 text-sm">
            אין קבוצות משויכות למאמן זה. צור קבוצה חדשה כדי להתחיל.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {trainerGroups.map((group) => {
              const userCount = countUsersInGroup(group.name);
              return (
                <Card key={group.id} className="border-e-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer" style={{ borderRightColor: group.color_tag || '#3b82f6' }} onClick={() => setSelectedGroup(group)}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-slate-800">{group.name}</h4>
                          <Badge variant={group.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                            {group.status === 'Active' ? 'פעיל' : 'לא פעיל'}
                          </Badge>
                        </div>
                        {group.description && <p className="text-sm text-slate-500 mt-1">{group.description}</p>}
                        <p className="text-xs text-slate-400 mt-1">{userCount} מתאמנים בקבוצה</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleCopyInviteLinkForGroup(group.name, e); }} disabled={!inviteLink} title="העתק קישור הזמנה לקבוצה זו">
                          {inviteLinkCopiedGroupName === group.name ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {inviteLinkCopiedGroupName === group.name ? 'הועתק!' : 'קישור הזמנה'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); }}>
                          <Edit className="w-3.5 h-3.5 ms-1" />ערוך
                        </Button>
                        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 rotate-180 self-center" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ══════════════════════════════════════════
// ── Main Component ──
// ══════════════════════════════════════════
export default function TrainerManagement({ onNavigateToTab }) {
  const { user: currentUser, isSystemAdmin } = useAdminDashboard();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState([]);
  const [promoteDialogUsers, setPromoteDialogUsers] = useState([]);
  const [isLoadingPromoteUsers, setIsLoadingPromoteUsers] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [trainerUserCounts, setTrainerUserCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [editingTrainee, setEditingTrainee] = useState(null);
  const [editTraineeName, setEditTraineeName] = useState('');
  const [isSavingTraineeEdit, setIsSavingTraineeEdit] = useState(false);
  const [isUploadingTraineePhoto, setIsUploadingTraineePhoto] = useState(false);
  const traineePhotoInputRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Screen navigation
  const [selectedTrainer, setSelectedTrainer] = useState(null);

  // Promote dialog
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [promoteSearchTerm, setPromoteSearchTerm] = useState('');

  // Remove trainer confirmation
  const [removingTrainer, setRemovingTrainer] = useState(null);

  const profilePhotoInputRef = useRef(null);
  const orgLogoInputRef = useRef(null);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [uploadingOrgLogo, setUploadingOrgLogo] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [usersData, groupsList] = await Promise.all([
        isSystemAdmin ? User.list() : User.listForStaff(currentUser, '-created_date'),
        UserGroup.list().catch(() => []),
      ]);
      const sorted = [...(usersData || [])].sort((a, b) => {
        const toTime = (v) => {
          if (v == null || v === '') return 0;
          if (typeof v === 'number') return v;
          if (v && typeof v.toMillis === 'function') return v.toMillis();
          if (v && (v.seconds != null)) return v.seconds * 1000;
          if (v instanceof Date) return v.getTime();
          const d = new Date(v);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return toTime(b.created_date || b.created_at) - toTime(a.created_date || a.created_at);
      });
      setAllUsers(sorted);

      const trainersData = sorted.filter(u => u.role === 'trainer');
      setTrainers(trainersData);

      const counts = {};
      trainersData.forEach(t => {
        const trainerEmailLower = (t.email || '').toLowerCase();
        const trainerGroupNames = new Set(
          (groupsList || [])
            .filter(g => (g.assigned_coach || '').toLowerCase() === trainerEmailLower)
            .map(g => g.name)
        );
        const seen = new Set();
        sorted.forEach(u => {
          if (u.role === 'admin' || u.role === 'coach' || u.role === 'trainer') return;
          const uid = u.id || u.uid || u.email;
          if (!uid) return;
          const isAssignedByCoach = (u.coach_email || '').toLowerCase() === trainerEmailLower;
          const isInTrainerGroup =
            Array.isArray(u.group_names) && u.group_names.some(gn => trainerGroupNames.has(gn));
          if (isAssignedByCoach || isInTrainerGroup) seen.add(uid);
        });
        counts[t.email] = seen.size;
      });
      setTrainerUserCounts(counts);
    } catch (err) {
      console.error('Failed to load trainers:', err);
      setError('שגיאה בטעינת המאמנים');
    } finally {
      setIsLoading(false);
    }
  }, [isSystemAdmin, currentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load all users for promote/downgrade dialog (all users so admin can promote or downgrade)
  useEffect(() => {
    if (!isPromoteDialogOpen || !isSystemAdmin) return;
    let cancelled = false;
    setIsLoadingPromoteUsers(true);
    User.list()
      .then(list => { if (!cancelled) setPromoteDialogUsers(list || []); })
      .catch(() => { if (!cancelled) setPromoteDialogUsers([]); })
      .finally(() => { if (!cancelled) setIsLoadingPromoteUsers(false); });
    return () => { cancelled = true; };
  }, [isPromoteDialogOpen, isSystemAdmin]);

  const filteredTrainers = useMemo(() => {
    if (!searchTerm.trim()) return trainers;
    const term = searchTerm.toLowerCase().trim();
    return trainers.filter(t => {
      const name = (t.name || t.full_name || '').toLowerCase();
      const email = (t.email || '').toLowerCase();
      const phone = (t.coach_phone || t.phone || '').toLowerCase();
      return name.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [trainers, searchTerm]);

  const eligibleUsers = useMemo(() => {
    const source = isPromoteDialogOpen && isSystemAdmin ? promoteDialogUsers : allUsers;
    const term = promoteSearchTerm.trim().toLowerCase();
    const base = source || [];
    if (!term) return base.slice(0, 50);
    return base.filter(u => {
      const name = (u.name || u.full_name || u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.coach_phone || u.phone || '').toLowerCase();
      return name.includes(term) || email.includes(term) || phone.includes(term);
    }).slice(0, 50);
  }, [allUsers, promoteDialogUsers, promoteSearchTerm, isPromoteDialogOpen, isSystemAdmin]);

  const handleSaveTrainer = async () => {
    if (!editingTrainer) return;
    setIsSaving(true); setError(''); setMessage('');
    try {
      const { id, created_date, updated_date, created_by, ...updateData } = editingTrainer;
      const uid = editingTrainer.uid || editingTrainer.id;
      if (!uid) { setError('לא נמצא מזהה משתמש לעדכון'); return; }
      await User.update(uid, updateData);
      // Push trainer's organization logo/name and program name to all trainees assigned to this coach (so app shows correct branding)
      const logoUrl = updateData.organization_logo_url ?? null;
      const orgName = updateData.organization_name ?? null;
      const programName = updateData.program_name ?? null;
      const coachEmail = (editingTrainer.email || '').trim().toLowerCase();
      if (coachEmail && (logoUrl || orgName || programName != null)) {
        const traineesOfCoach = (allUsers || []).filter(
          u => (u.coach_email || '').trim().toLowerCase() === coachEmail && u.role !== 'admin' && u.role !== 'coach' && u.role !== 'trainer'
        );
        await Promise.all(traineesOfCoach.map(u => {
          const payload = {};
          if (logoUrl != null) payload.organization_logo_url = logoUrl;
          if (orgName != null) payload.organization_name = orgName;
          if (programName != null) payload.program_name = programName;
          return Object.keys(payload).length ? User.update(u.uid || u.id, payload) : Promise.resolve();
        }));
      }
      setMessage('פרטי המאמן עודכנו בהצלחה');
      setEditingTrainer(null);
      loadData();
    } catch (err) {
      console.error('Error updating trainer:', err);
      setError('שגיאה בעדכון פרטי המאמן');
    } finally { setIsSaving(false); }
  };

  const handlePromoteToTrainer = async (user) => {
    try {
      await User.update(user.uid || user.id, { role: 'trainer', is_admin: false });
      setMessage(`${user.name || user.email} הוגדר כמאמן בהצלחה.`);
      setIsPromoteDialogOpen(false); setPromoteSearchTerm('');
      loadData();
    } catch (err) {
      console.error('Error promoting user:', err);
      setError('שגיאה בהגדרת המשתמש כמאמן');
    }
  };

  const handleRemoveTrainerRole = async () => {
    if (!removingTrainer) return;
    try {
      await User.update(removingTrainer.uid || removingTrainer.id, { role: 'trainee', is_admin: false });
      setMessage(`${removingTrainer.name || removingTrainer.email} הוסר מתפקיד מאמן.`);
      setRemovingTrainer(null);
      if (selectedTrainer && (selectedTrainer.email === removingTrainer.email)) setSelectedTrainer(null);
      loadData();
    } catch (err) {
      console.error('Error removing trainer role:', err);
      setError('שגיאה בהסרת תפקיד המאמן');
    }
  };

  const handleDowngradeFromDialog = async (user) => {
    try {
      await User.update(user.uid || user.id, { role: 'trainee', is_admin: false });
      setMessage(`${user.name || user.email} הוסר מתפקיד (מאמן/מנהל).`);
      if (selectedTrainer && (selectedTrainer.email === user.email)) setSelectedTrainer(null);
      loadData();
      setPromoteDialogUsers(prev => (prev || []).map(u => (u.uid || u.id) === (user.uid || user.id) ? { ...u, role: 'trainee', is_admin: false } : u));
    } catch (err) {
      console.error('Error downgrading user:', err);
      setError('שגיאה בהסרת תפקיד');
    }
  };

  const handleInviteInstead = () => {
    setIsPromoteDialogOpen(false); setPromoteSearchTerm('');
    const basePath = window.location.pathname.startsWith('/trainer') ? '/trainer' : '/admin';
    if (onNavigateToTab) onNavigateToTab('control-center');
    else navigate(`${basePath}/control-center`);
  };

  const handleUploadTrainerPhoto = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !editingTrainer) return;
    const uid = editingTrainer.uid || editingTrainer.id;
    if (!uid) return;
    setUploadingProfilePhoto(true); setError('');
    try {
      const { file_url } = await UploadFile({ file });
      await User.update(uid, { profile_image_url: file_url });
      setEditingTrainer(prev => prev ? { ...prev, profile_image_url: file_url } : null);
      if (selectedTrainer?.email === editingTrainer?.email) {
        setSelectedTrainer(prev => prev ? { ...prev, profile_image_url: file_url } : null);
      }
      setMessage('תמונת הפרופיל עודכנה');
    } catch (err) {
      console.error('Error uploading trainer photo:', err);
      setError('שגיאה בהעלאת תמונת הפרופיל');
    } finally {
      setUploadingProfilePhoto(false);
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
    }
  };

  const handleUploadOrgLogo = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !editingTrainer) return;
    const uid = editingTrainer.uid || editingTrainer.id;
    if (!uid) return;
    setUploadingOrgLogo(true); setError('');
    try {
      const { file_url } = await UploadFile({ file, path: 'organization-logos' });
      await User.update(uid, { organization_logo_url: file_url });
      setEditingTrainer(prev => prev ? { ...prev, organization_logo_url: file_url } : null);
      if (selectedTrainer?.email === editingTrainer?.email) {
        setSelectedTrainer(prev => prev ? { ...prev, organization_logo_url: file_url } : null);
      }
      setMessage('לוגו הארגון עודכן');
    } catch (err) {
      console.error('Error uploading organization logo:', err);
      setError('שגיאה בהעלאת לוגו הארגון');
    } finally {
      setUploadingOrgLogo(false);
      if (orgLogoInputRef.current) orgLogoInputRef.current.value = '';
    }
  };

  const handleImageUpdated = useCallback((uid, newUrl) => {
    setAllUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, profile_image_url: newUrl } : u));
    setTrainers(prev => prev.map(t => (t.uid || t.id) === uid ? { ...t, profile_image_url: newUrl } : t));
    if (selectedTrainer && (selectedTrainer.uid || selectedTrainer.id) === uid) {
      setSelectedTrainer(prev => prev ? { ...prev, profile_image_url: newUrl } : null);
    }
    if (editingTrainee && (editingTrainee.uid || editingTrainee.id) === uid) {
      setEditingTrainee(prev => prev ? { ...prev, profile_image_url: newUrl } : null);
    }
  }, [selectedTrainer, editingTrainee]);

  const openEditTrainee = useCallback((user) => {
    setEditingTrainee({ ...user });
    setEditTraineeName(user.name || user.full_name || '');
    setMessage('');
    setError('');
  }, []);

  const handleSaveTraineeEdit = useCallback(async () => {
    if (!editingTrainee) return;
    const uid = editingTrainee.uid || editingTrainee.id;
    if (!uid) return;
    setIsSavingTraineeEdit(true);
    setError('');
    try {
      await User.update(uid, { name: editTraineeName.trim() || undefined, full_name: editTraineeName.trim() || undefined });
      setAllUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, name: editTraineeName.trim(), full_name: editTraineeName.trim() } : u));
      setEditingTrainee(prev => prev ? { ...prev, name: editTraineeName.trim(), full_name: editTraineeName.trim() } : null);
      setMessage('פרטי המתאמן עודכנו');
      setTimeout(() => setEditingTrainee(null), 300);
    } catch (err) {
      console.error('Failed to update trainee:', err);
      setError('שגיאה בעדכון פרטי המתאמן');
    } finally {
      setIsSavingTraineeEdit(false);
    }
  }, [editingTrainee, editTraineeName]);

  const handleTraineePhotoUpload = useCallback(async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !editingTrainee) return;
    if (!file.type.startsWith('image/')) return;
    const uid = editingTrainee.uid || editingTrainee.id;
    if (!uid) return;
    setIsUploadingTraineePhoto(true);
    setError('');
    try {
      const { file_url } = await UploadFile({ file });
      await User.update(uid, { profile_image_url: file_url });
      setEditingTrainee(prev => prev ? { ...prev, profile_image_url: file_url } : null);
      setAllUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, profile_image_url: file_url } : u));
      setMessage('תמונת הפרופיל עודכנה');
    } catch (err) {
      console.error('Error uploading trainee photo:', err);
      setError('שגיאה בהעלאת התמונה');
    } finally {
      setIsUploadingTraineePhoto(false);
      if (traineePhotoInputRef.current) traineePhotoInputRef.current.value = '';
    }
  }, [editingTrainee]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  // ── TRAINER DETAIL SCREEN ──
  if (selectedTrainer) {
    return (
      <>
        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm mb-4">{message}</div>}
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">{error}</div>}
        <TrainerDetailScreen
          trainer={selectedTrainer}
          allUsers={allUsers}
          isSystemAdmin={isSystemAdmin}
          onBack={() => setSelectedTrainer(null)}
          onEditTrainer={(t) => { setEditingTrainer({ ...t }); setMessage(''); setError(''); }}
          onEditUser={openEditTrainee}
          onRemoveTrainer={(t) => setRemovingTrainer(t)}
          onRefresh={loadData}
          onMessage={setMessage}
          onError={setError}
          onImageUpdated={handleImageUpdated}
        />

        {/* Edit Trainer Dialog (shared) */}
        <Dialog open={!!editingTrainer} onOpenChange={(open) => !open && setEditingTrainer(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden" dir="rtl">
            <DialogHeader className="text-right ps-8"><DialogTitle>עריכת פרטי מאמן: {editingTrainer?.name || editingTrainer?.full_name}</DialogTitle></DialogHeader>
            {editingTrainer && (
              <ScrollArea className="max-h-[70vh] px-1">
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label>תמונת פרופיל מאמן</Label>
                    <div className="flex items-center gap-4">
                      {editingTrainer.profile_image_url ? (
                        <img src={editingTrainer.profile_image_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-200">
                          <UserIcon className="w-8 h-8 text-emerald-600" />
                        </div>
                      )}
                      <div>
                        <input ref={profilePhotoInputRef} type="file" className="hidden" accept="image/*" onChange={handleUploadTrainerPhoto} disabled={uploadingProfilePhoto} />
                        <Button type="button" variant="outline" size="sm" onClick={() => profilePhotoInputRef.current?.click()} disabled={uploadingProfilePhoto}>
                          {uploadingProfilePhoto ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Camera className="w-4 h-4 ms-2" />}
                          {uploadingProfilePhoto ? 'מעלה...' : 'העלה תמונת פרופיל'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div><Label>שם</Label><Input value={editingTrainer.name || ''} onChange={e => setEditingTrainer({ ...editingTrainer, name: e.target.value })} /></div>
                  <div><Label>אימייל</Label><Input value={editingTrainer.email || ''} disabled className="bg-slate-50" /></div>
                  <div><Label>טלפון</Label><Input value={editingTrainer.coach_phone || ''} onChange={e => setEditingTrainer({ ...editingTrainer, coach_phone: e.target.value })} placeholder="050-1234567" /></div>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-500" />ארגון</Label>
                    <Input value={editingTrainer.organization_name || ''} onChange={e => setEditingTrainer({ ...editingTrainer, organization_name: e.target.value })} placeholder="שם הארגון / הסטודיו" />
                  </div>
                  <div className="space-y-2">
                    <Label>לוגו ארגון</Label>
                    <div className="flex items-center gap-4">
                      {editingTrainer.organization_logo_url ? (
                        <img src={editingTrainer.organization_logo_url} alt="לוגו" className="w-16 h-16 object-contain rounded border border-slate-200 bg-slate-50 p-1" />
                      ) : (
                        <div className="w-16 h-16 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <input ref={orgLogoInputRef} type="file" className="hidden" accept="image/*" onChange={handleUploadOrgLogo} disabled={uploadingOrgLogo} />
                        <Button type="button" variant="outline" size="sm" onClick={() => orgLogoInputRef.current?.click()} disabled={uploadingOrgLogo}>
                          {uploadingOrgLogo ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Camera className="w-4 h-4 ms-2" />}
                          {uploadingOrgLogo ? 'מעלה...' : 'העלה לוגו לארגון'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Rocket className="w-4 h-4 text-slate-500" />שם התוכנית</Label>
                    <Input value={editingTrainer.program_name || ''} onChange={e => setEditingTrainer({ ...editingTrainer, program_name: e.target.value })} placeholder="למשל: בוסטר, תוכנית 12 שבועות" />
                    <p className="text-xs text-slate-500">שם זה יוצג באפליקציה במקום &quot;בוסטר&quot; (כפתור התקדמות)</p>
                  </div>
                </div>
              </ScrollArea>
            )}
            <DialogFooter className="gap-2 sm:flex-row-reverse">
              <Button onClick={handleSaveTrainer} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Save className="w-4 h-4 ms-2" />}שמור שינויים</Button>
              <Button variant="outline" onClick={() => setEditingTrainer(null)}>ביטול</Button>
              <Button
                variant="destructive"
                onClick={() => { if (editingTrainer) { setRemovingTrainer(editingTrainer); setEditingTrainer(null); } }}
                disabled={isSaving}
              >
                <UserMinus className="w-4 h-4 ms-2" />
                הסר מתפקיד מאמן
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Trainer Confirmation (shared) */}
        <Dialog open={!!removingTrainer} onOpenChange={(open) => !open && setRemovingTrainer(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader className="text-right ps-8">
              <DialogTitle className="flex items-center gap-2 text-red-600"><UserMinus className="w-5 h-5" />הסרת תפקיד מאמן</DialogTitle>
              <DialogDescription>האם אתה בטוח שברצונך להסיר את תפקיד המאמן מ-<strong>{removingTrainer?.name || removingTrainer?.email}</strong>?</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:flex-row-reverse">
              <Button variant="destructive" onClick={handleRemoveTrainerRole}>הסר תפקיד מאמן</Button>
              <Button variant="outline" onClick={() => setRemovingTrainer(null)}>ביטול</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Trainee (edit user) Dialog - must be here so it works from GroupEditScreen */}
        <Dialog open={!!editingTrainee} onOpenChange={(open) => !open && setEditingTrainee(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader className="text-right ps-8">
              <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-blue-600" />עריכת מתאמן</DialogTitle>
              <DialogDescription>עדכן שם ותמונת פרופיל</DialogDescription>
            </DialogHeader>
            {editingTrainee && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center gap-3">
                  <Label className="text-sm font-medium text-slate-700">תמונת פרופיל</Label>
                  <div className="relative">
                    {editingTrainee.profile_image_url ? (
                      <img src={editingTrainee.profile_image_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200">
                        <UserIcon className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                    <input ref={traineePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleTraineePhotoUpload} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute -bottom-1 -start-1 rounded-full w-8 h-8 border-slate-300 bg-white hover:bg-slate-50"
                      onClick={() => traineePhotoInputRef.current?.click()}
                      disabled={isUploadingTraineePhoto}
                    >
                      {isUploadingTraineePhoto ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <Camera className="w-4 h-4 text-slate-600" />}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">לחץ על המצלמה להחלפת תמונה</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-trainee-name-detail">שם</Label>
                  <Input
                    id="edit-trainee-name-detail"
                    value={editTraineeName}
                    onChange={(e) => setEditTraineeName(e.target.value)}
                    placeholder="שם המתאמן"
                    className="text-end"
                  />
                </div>
                <p className="text-xs text-slate-500">{editingTrainee.email}</p>
              </div>
            )}
            <DialogFooter className="gap-2 sm:flex-row-reverse">
              <Button variant="outline" onClick={() => setEditingTrainee(null)} disabled={isSavingTraineeEdit}>ביטול</Button>
              <Button onClick={handleSaveTraineeEdit} disabled={isSavingTraineeEdit}>
                {isSavingTraineeEdit ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Save className="w-4 h-4 ms-2" />}
                שמור שינויים
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── TRAINERS LIST SCREEN ──
  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl"><ShieldCheck className="w-6 h-6 text-emerald-600" />ניהול מאמנים</CardTitle>
              <CardDescription className="mt-1">צפייה וניהול מאמנים במערכת ({trainers.length} מאמנים)</CardDescription>
            </div>
            {isSystemAdmin && (
              <Button onClick={() => setIsPromoteDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="w-4 h-4 ms-2" />הוסף מאמן
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input placeholder="חפש מאמן לפי שם, אימייל או טלפון..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pe-10" />
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{error}</div>}

      {/* Trainers List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredTrainers.map((trainer, index) => (
            <motion.div
              key={trainer.id || trainer.uid || trainer.email}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="hover:shadow-md hover:border-emerald-200 transition-all"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    {/* Avatar + Info: clickable to open detail */}
                    <div
                      className="flex-1 flex items-center gap-4 min-w-0 cursor-pointer"
                      onClick={() => setSelectedTrainer(trainer)}
                    >
                    {/* Avatar */}
                    <AvatarWithUpload user={trainer} size="xl" onImageUpdated={handleImageUpdated} fallbackIcon={Shield} borderColor="border-emerald-200" bgColor="bg-emerald-100" iconColor="text-emerald-600" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-slate-800">{trainer.name || trainer.full_name || 'חסר שם'}</h3>
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200"><Shield className="w-3 h-3 ms-1" />מאמן</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /><span className="truncate">{trainer.email}</span></span>
                        {(trainer.coach_phone || trainer.phone) && (
                          <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{trainer.coach_phone || trainer.phone}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {trainer.organization_logo_url ? (
                          <img src={trainer.organization_logo_url} alt={trainer.organization_name || 'לוגו'} className="w-6 h-6 object-contain rounded border border-slate-200 bg-white p-0.5" />
                        ) : (
                          <Building2 className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-sm text-slate-600">{trainer.organization_name || 'לא הוגדר ארגון'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-sm"><Users className="w-3 h-3 ms-1" />{trainerUserCounts[trainer.email] || 0} מתאמנים</Badge>
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-300 rotate-180 flex-shrink-0" />
                    </div>

                    {/* Actions: not part of card click */}
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isSystemAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-slate-700 border-slate-300 hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTrainer({ ...trainer });
                            setMessage('');
                            setError('');
                          }}
                        >
                          <Edit className="w-3.5 h-3.5 ms-1" />
                          ערוך
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredTrainers.length === 0 && !isLoading && (
        <div className="text-center py-12 text-slate-500">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-semibold">לא נמצאו מאמנים</h3>
          <p>{searchTerm ? 'נסה לשנות את החיפוש' : 'אין מאמנים במערכת עדיין. הוסף מאמן חדש.'}</p>
        </div>
      )}

      {/* Promote to Trainer Dialog */}
      <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right ps-8">
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-600" />הוספת / הסרת מאמן</DialogTitle>
            <DialogDescription>חפש משתמש — הגדר כמאמן או הסר מתפקיד מאמן/מנהל</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input placeholder="חפש משתמש לפי שם, אימייל או טלפון..." value={promoteSearchTerm} onChange={e => setPromoteSearchTerm(e.target.value)} className="pe-10" />
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {isLoadingPromoteUsers && <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>}
                {!isLoadingPromoteUsers && eligibleUsers.length === 0 && (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-slate-500 text-sm">{promoteSearchTerm.trim() ? 'לא נמצאו משתמשים מתאימים.' : 'אין משתמשים זמינים.'}</p>
                    {promoteSearchTerm.trim() && <p className="text-slate-600 text-sm font-medium">המשתמש עדיין לא רשום? הזמן אותו.</p>}
                    <Button type="button" variant="outline" className="gap-2" onClick={handleInviteInstead}><Mail className="w-4 h-4" />הזמן משתמש חדש</Button>
                  </div>
                )}
                {!isLoadingPromoteUsers && eligibleUsers.map(user => {
                  const roleLower = (user.role || '').toLowerCase();
                  const isTrainerOrStaff = roleLower === 'trainer' || roleLower === 'admin' || roleLower === 'coach' || user.is_admin === true;
                  const roleLabel = roleLower === 'admin' ? 'מנהל' : roleLower === 'trainer' ? 'מאמן' : roleLower === 'coach' ? 'מאמן' : 'מתאמן';
                  return (
                    <div key={user.id || user.uid} className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {user.profile_image_url ? (
                          <img src={user.profile_image_url} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{user.name || user.full_name || user.displayName || 'חסר שם'}</p>
                            <Badge variant="outline" className="text-xs">{roleLabel}</Badge>
                          </div>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                      {isTrainerOrStaff ? (
                        <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => handleDowngradeFromDialog(user)}>
                          <UserMinus className="w-3.5 h-3.5 ms-1" />הסר תפקיד
                        </Button>
                      ) : (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handlePromoteToTrainer(user)}>
                          <Shield className="w-3.5 h-3.5 ms-1" />הגדר כמאמן
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Trainer Dialog */}
      <Dialog open={!!editingTrainer} onOpenChange={(open) => !open && setEditingTrainer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden" dir="rtl">
          <DialogHeader className="text-right ps-8"><DialogTitle>עריכת פרטי מאמן: {editingTrainer?.name || editingTrainer?.full_name}</DialogTitle></DialogHeader>
          {editingTrainer && (
            <ScrollArea className="max-h-[70vh] px-1">
              <div className="space-y-4 p-4">
                <div className="space-y-2">
                  <Label>תמונת פרופיל מאמן</Label>
                  <div className="flex items-center gap-4">
                    {editingTrainer.profile_image_url ? (
                      <img src={editingTrainer.profile_image_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-200">
                        <UserIcon className="w-8 h-8 text-emerald-600" />
                      </div>
                    )}
                    <div>
                      <input ref={profilePhotoInputRef} type="file" className="hidden" accept="image/*" onChange={handleUploadTrainerPhoto} disabled={uploadingProfilePhoto} />
                      <Button type="button" variant="outline" size="sm" onClick={() => profilePhotoInputRef.current?.click()} disabled={uploadingProfilePhoto}>
                        {uploadingProfilePhoto ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Camera className="w-4 h-4 ms-2" />}
                        {uploadingProfilePhoto ? 'מעלה...' : 'העלה תמונת פרופיל'}
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator />
                <div><Label>שם</Label><Input value={editingTrainer.name || ''} onChange={e => setEditingTrainer({ ...editingTrainer, name: e.target.value })} /></div>
                <div><Label>אימייל</Label><Input value={editingTrainer.email || ''} disabled className="bg-slate-50" /></div>
                <div><Label>טלפון</Label><Input value={editingTrainer.coach_phone || ''} onChange={e => setEditingTrainer({ ...editingTrainer, coach_phone: e.target.value })} placeholder="050-1234567" /></div>
                <Separator />
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-500" />ארגון</Label>
                  <Input value={editingTrainer.organization_name || ''} onChange={e => setEditingTrainer({ ...editingTrainer, organization_name: e.target.value })} placeholder="שם הארגון / הסטודיו" />
                </div>
                <div className="space-y-2">
                  <Label>לוגו ארגון</Label>
                  <div className="flex items-center gap-4">
                    {editingTrainer.organization_logo_url ? (
                      <img src={editingTrainer.organization_logo_url} alt="לוגו" className="w-16 h-16 object-contain rounded border border-slate-200 bg-slate-50 p-1" />
                    ) : (
                      <div className="w-16 h-16 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <input ref={orgLogoInputRef} type="file" className="hidden" accept="image/*" onChange={handleUploadOrgLogo} disabled={uploadingOrgLogo} />
                      <Button type="button" variant="outline" size="sm" onClick={() => orgLogoInputRef.current?.click()} disabled={uploadingOrgLogo}>
                        {uploadingOrgLogo ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Camera className="w-4 h-4 ms-2" />}
                        {uploadingOrgLogo ? 'מעלה...' : 'העלה לוגו לארגון'}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Rocket className="w-4 h-4 text-slate-500" />שם התוכנית</Label>
                  <Input value={editingTrainer.program_name || ''} onChange={e => setEditingTrainer({ ...editingTrainer, program_name: e.target.value })} placeholder="למשל: בוסטר, תוכנית 12 שבועות" />
                  <p className="text-xs text-slate-500">שם זה יוצג באפליקציה במקום &quot;בוסטר&quot;</p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2 sm:flex-row-reverse">
            <Button onClick={handleSaveTrainer} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Save className="w-4 h-4 ms-2" />}שמור שינויים</Button>
            <Button variant="outline" onClick={() => setEditingTrainer(null)}>ביטול</Button>
            <Button
              variant="destructive"
              onClick={() => { if (editingTrainer) { setRemovingTrainer(editingTrainer); setEditingTrainer(null); } }}
              disabled={isSaving}
            >
              <UserMinus className="w-4 h-4 ms-2" />
              הסר מתפקיד מאמן
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Trainer Confirmation */}
      <Dialog open={!!removingTrainer} onOpenChange={(open) => !open && setRemovingTrainer(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader className="text-right ps-8">
            <DialogTitle className="flex items-center gap-2 text-red-600"><UserMinus className="w-5 h-5" />הסרת תפקיד מאמן</DialogTitle>
            <DialogDescription>האם אתה בטוח שברצונך להסיר את תפקיד המאמן מ-<strong>{removingTrainer?.name || removingTrainer?.email}</strong>?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:flex-row-reverse">
            <Button variant="destructive" onClick={handleRemoveTrainerRole}>הסר תפקיד מאמן</Button>
            <Button variant="outline" onClick={() => setRemovingTrainer(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Trainee (group member) Dialog */}
      <Dialog open={!!editingTrainee} onOpenChange={(open) => !open && setEditingTrainee(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right ps-8">
            <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-blue-600" />עריכת מתאמן</DialogTitle>
            <DialogDescription>עדכן שם ותמונת פרופיל</DialogDescription>
          </DialogHeader>
          {editingTrainee && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-3">
                <Label className="text-sm font-medium text-slate-700">תמונת פרופיל</Label>
                <div className="relative">
                  {editingTrainee.profile_image_url ? (
                    <img src={editingTrainee.profile_image_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200">
                      <UserIcon className="w-10 h-10 text-slate-400" />
                    </div>
                  )}
                  <input ref={traineePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleTraineePhotoUpload} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute -bottom-1 -start-1 rounded-full w-8 h-8 border-slate-300 bg-white hover:bg-slate-50"
                    onClick={() => traineePhotoInputRef.current?.click()}
                    disabled={isUploadingTraineePhoto}
                  >
                    {isUploadingTraineePhoto ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <Camera className="w-4 h-4 text-slate-600" />}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">לחץ על המצלמה להחלפת תמונה</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-trainee-name">שם</Label>
                <Input
                  id="edit-trainee-name"
                  value={editTraineeName}
                  onChange={(e) => setEditTraineeName(e.target.value)}
                  placeholder="שם המתאמן"
                  className="text-end"
                />
              </div>
              <p className="text-xs text-slate-500">{editingTrainee.email}</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:flex-row-reverse">
            <Button variant="outline" onClick={() => setEditingTrainee(null)} disabled={isSavingTraineeEdit}>ביטול</Button>
            <Button onClick={handleSaveTraineeEdit} disabled={isSavingTraineeEdit}>
              {isSavingTraineeEdit ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Save className="w-4 h-4 ms-2" />}
              שמור שינויים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
