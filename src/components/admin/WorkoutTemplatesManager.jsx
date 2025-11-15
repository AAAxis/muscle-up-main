import React, { useState, useEffect } from 'react';
import { WorkoutTemplate, PreMadeWorkout, User, UserGroup } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dumbbell, Send, Eye, Loader2, Trash2, Users, ChevronDown, ChevronUp, UserCheck, Video } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import VideoPlayer from '../workout/VideoPlayer';

export default function WorkoutTemplatesManager() {
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState(null);
  
  // Video player state
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  
  const [sendForm, setSendForm] = useState({
    sendType: 'user',
    targetUserEmail: '',
    targetGroupName: '',
    coachNotes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [templatesData, usersData, groupsData] = await Promise.all([
        WorkoutTemplate.list('-created_date'),
        User.list(),
        UserGroup.list()
      ]);
      setTemplates(templatesData);
      setUsers(usersData.filter(u => u.role !== 'admin' && u.role !== 'coach'));
      setGroups(groupsData.filter(g => g.status === 'Active'));
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('שגיאה בטעינת התבניות');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayVideo = (videoUrl, exerciseName) => {
    setCurrentVideoUrl(videoUrl);
    setCurrentVideoTitle(exerciseName);
    setVideoPlayerOpen(true);
  };

  const handlePreviewTemplate = (template) => {
    setSelectedTemplate(template);
    setIsPreviewDialogOpen(true);
  };

  const handleOpenSendDialog = (template) => {
    setSelectedTemplate(template);
    setSendForm({ sendType: 'user', targetUserEmail: '', targetGroupName: '', coachNotes: '' });
    setIsSendDialogOpen(true);
  };

  const getTargetUsers = () => {
    if (sendForm.sendType === 'user') {
      return sendForm.targetUserEmail ? [sendForm.targetUserEmail] : [];
    } else if (sendForm.sendType === 'group' && sendForm.targetGroupName) {
      return users
        .filter(u => u.group_names?.includes(sendForm.targetGroupName))
        .map(u => u.email);
    }
    return [];
  };

  const handleSendTemplate = async () => {
    const targetUserEmails = getTargetUsers();
    
    if (targetUserEmails.length === 0) {
      alert('נא לבחור משתמש או קבוצה');
      return;
    }

    const confirmMessage = sendForm.sendType === 'group' 
      ? `האם לשלוח את האימון ל-${targetUserEmails.length} משתמשים בקבוצה "${sendForm.targetGroupName}"?`
      : 'האם לשלוח את האימון למשתמש הנבחר?';
    
    if (!confirm(confirmMessage)) return;

    setIsSending(true);
    try {
      const mapExercises = (exercises) => {
        if (!exercises || !Array.isArray(exercises)) return [];
        
        return exercises.map(ex => ({
          name: ex.name || '',
          category: ex.category || '',
          suggested_sets: ex.suggested_sets || 3,
          suggested_reps: ex.suggested_reps || 12,
          suggested_weight: ex.suggested_weight || 0,
          suggested_duration: ex.suggested_duration || 0,
          notes: ex.notes || '',
          video_url: ex.video_url || ''
        }));
      };

      const workoutDataTemplate = {
        workout_title: selectedTemplate.workout_title,
        workout_description: selectedTemplate.workout_description || '',
        warmup_description: selectedTemplate.warmup_description || 'חימום כללי - 10 דקות',
        warmup_duration: selectedTemplate.warmup_duration || 10,
        part_1_exercises: mapExercises(selectedTemplate.part_1_exercises),
        part_2_exercises: mapExercises(selectedTemplate.part_2_exercises),
        part_3_exercises: mapExercises(selectedTemplate.part_3_exercises),
        coach_notes: sendForm.coachNotes,
        is_sent: true,
        sent_date: new Date().toISOString(),
        is_accepted: false
      };

      const promises = targetUserEmails.map(email => 
        PreMadeWorkout.create({
          ...workoutDataTemplate,
          target_user_email: email
        })
      );

      await Promise.all(promises);
      
      const successMessage = sendForm.sendType === 'group'
        ? `האימון נשלח בהצלחה ל-${targetUserEmails.length} משתמשים בקבוצה!`
        : 'האימון נשלח בהצלחה למשתמש!';
      
      alert(successMessage);
      setIsSendDialogOpen(false);
      setSendForm({ sendType: 'user', targetUserEmail: '', targetGroupName: '', coachNotes: '' });
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error sending workout:', error);
      alert('שגיאה בשליחת האימון: ' + (error.message || 'שגיאה לא ידועה'));
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תבנית זו?')) return;

    try {
      await WorkoutTemplate.delete(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      alert('התבנית נמחקה בהצלחה');
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('שגיאה במחיקת התבנית');
    }
  };

  const toggleTemplateExpansion = (templateId) => {
    setExpandedTemplateId(prev => prev === templateId ? null : templateId);
  };

  const getTotalExercises = (template) => {
    const part1 = template.part_1_exercises?.length || 0;
    const part2 = template.part_2_exercises?.length || 0;
    const part3 = template.part_3_exercises?.length || 0;
    return part1 + part2 + part3;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 ml-2" />
        <span className="text-slate-600">טוען תבניות...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            ניהול תבניות אימון
          </CardTitle>
          <CardDescription>
            צפה בתבניות האימון השמורות ושלח אותן למשתמשים או לקבוצות
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Dumbbell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">אין תבניות אימון</p>
              <p className="text-sm mt-2">צור תבניות חדשות בממשק יוצר האימונים</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {templates.map((template) => {
                  const isExpanded = expandedTemplateId === template.id;
                  const totalExercises = getTotalExercises(template);

                  return (
                    <Card key={template.id} className="border-2 hover:border-blue-200 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-bold text-slate-800">{template.template_name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {totalExercises} תרגילים
                              </Badge>
                            </div>
                            <p className="text-sm font-semibold text-blue-600 mb-1">
                              {template.workout_title}
                            </p>
                            {template.workout_description && (
                              <p className="text-sm text-slate-600">
                                {template.workout_description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTemplateExpansion(template.id)}
                            className="ml-2"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {/* Exercise Parts Summary */}
                            <div className="grid grid-cols-3 gap-3">
                              {template.part_1_exercises?.length > 0 && (
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-blue-600 font-medium">חלק 1</p>
                                  <p className="text-lg font-bold text-blue-800">
                                    {template.part_1_exercises.length}
                                  </p>
                                </div>
                              )}
                              {template.part_2_exercises?.length > 0 && (
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-green-600 font-medium">חלק 2</p>
                                  <p className="text-lg font-bold text-green-800">
                                    {template.part_2_exercises.length}
                                  </p>
                                </div>
                              )}
                              {template.part_3_exercises?.length > 0 && (
                                <div className="bg-purple-50 rounded-lg p-3 text-center">
                                  <p className="text-xs text-purple-600 font-medium">חלק 3</p>
                                  <p className="text-lg font-bold text-purple-800">
                                    {template.part_3_exercises.length}
                                  </p>
                                </div>
                              )}
                            </div>

                            <Separator />

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handlePreviewTemplate(template)}
                                variant="outline"
                                className="flex-1"
                              >
                                <Eye className="w-4 h-4 ml-2" />
                                תצוגה מקדימה
                              </Button>
                              <Button
                                onClick={() => handleOpenSendDialog(template)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                              >
                                <Send className="w-4 h-4 ml-2" />
                                שלח למשתמש/קבוצה
                              </Button>
                              <Button
                                onClick={() => handleDeleteTemplate(template.id)}
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.workout_title}</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold text-slate-600">תיאור האימון</Label>
                <p className="text-slate-800 mt-1">
                  {selectedTemplate.workout_description || 'אין תיאור'}
                </p>
              </div>

              {/* Part 1 */}
              {selectedTemplate.part_1_exercises?.length > 0 && (
                <div>
                  <h4 className="font-bold text-blue-800 mb-3">חלק 1 - תרגילים ראשיים</h4>
                  <div className="space-y-2">
                    {selectedTemplate.part_1_exercises.map((ex, idx) => (
                      <div key={idx} className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-slate-800">{ex.name}</p>
                          {ex.video_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePlayVideo(ex.video_url, ex.name)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Video className="w-4 h-4 ml-1" />
                              הדגמה
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-slate-600">
                          <span>סטים: {ex.suggested_sets}</span>
                          <span>חזרות: {ex.suggested_reps}</span>
                          {ex.suggested_weight > 0 && <span>משקל: {ex.suggested_weight} ק"ג</span>}
                          {ex.suggested_duration > 0 && <span>זמן: {ex.suggested_duration} שניות</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part 2 */}
              {selectedTemplate.part_2_exercises?.length > 0 && (
                <div>
                  <h4 className="font-bold text-green-800 mb-3">חלק 2 - תרגילים מתקדמים</h4>
                  <div className="space-y-2">
                    {selectedTemplate.part_2_exercises.map((ex, idx) => (
                      <div key={idx} className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-slate-800">{ex.name}</p>
                          {ex.video_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePlayVideo(ex.video_url, ex.name)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Video className="w-4 h-4 ml-1" />
                              הדגמה
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-slate-600">
                          <span>סטים: {ex.suggested_sets}</span>
                          <span>חזרות: {ex.suggested_reps}</span>
                          {ex.suggested_weight > 0 && <span>משקל: {ex.suggested_weight} ק"ג</span>}
                          {ex.suggested_duration > 0 && <span>זמן: {ex.suggested_duration} שניות</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part 3 */}
              {selectedTemplate.part_3_exercises?.length > 0 && (
                <div>
                  <h4 className="font-bold text-purple-800 mb-3">חלק 3 - סיום/עצימות</h4>
                  <div className="space-y-2">
                    {selectedTemplate.part_3_exercises.map((ex, idx) => (
                      <div key={idx} className="bg-purple-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-slate-800">{ex.name}</p>
                          {ex.video_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePlayVideo(ex.video_url, ex.name)}
                              className="text-purple-600 hover:text-purple-700"
                            >
                              <Video className="w-4 h-4 ml-1" />
                              הדגמה
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-slate-600">
                          <span>סטים: {ex.suggested_sets}</span>
                          <span>חזרות: {ex.suggested_reps}</span>
                          {ex.suggested_weight > 0 && <span>משקל: {ex.suggested_weight} ק"ג</span>}
                          {ex.suggested_duration > 0 && <span>זמן: {ex.suggested_duration} שניות</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPreviewDialogOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>שליחת אימון למשתמשים</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">אימון נבחר</Label>
                <p className="text-blue-600 font-medium mt-1">{selectedTemplate.workout_title}</p>
              </div>

              <div className="space-y-3">
                <Label>שלח ל:</Label>
                <RadioGroup 
                  value={sendForm.sendType} 
                  onValueChange={(value) => setSendForm(prev => ({
                    ...prev, 
                    sendType: value,
                    targetUserEmail: '',
                    targetGroupName: ''
                  }))}
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="user" id="send-user" />
                    <Label htmlFor="send-user" className="cursor-pointer flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      משתמש בודד
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="group" id="send-group" />
                    <Label htmlFor="send-group" className="cursor-pointer flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      קבוצה שלמה
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {sendForm.sendType === 'user' && (
                <div className="space-y-2">
                  <Label htmlFor="targetUser">בחר משתמש <span className="text-red-500">*</span></Label>
                  <Select 
                    value={sendForm.targetUserEmail} 
                    onValueChange={(value) => setSendForm(prev => ({...prev, targetUserEmail: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר משתמש..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.email} value={user.email}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {sendForm.sendType === 'group' && (
                <div className="space-y-2">
                  <Label htmlFor="targetGroup">בחר קבוצה <span className="text-red-500">*</span></Label>
                  <Select 
                    value={sendForm.targetGroupName} 
                    onValueChange={(value) => setSendForm(prev => ({...prev, targetGroupName: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר קבוצה..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(group => {
                        const groupUserCount = users.filter(u => u.group_names?.includes(group.name)).length;
                        return (
                          <SelectItem key={group.id} value={group.name}>
                            {group.name} ({groupUserCount} משתמשים)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {sendForm.targetGroupName && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <p className="text-sm text-blue-800">
                        <Users className="w-4 h-4 inline ml-1" />
                        האימון יישלח ל-<strong>{getTargetUsers().length}</strong> משתמשים בקבוצה זו
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="coachNotes">הערות למתאמן (אופציונלי)</Label>
                <Textarea
                  id="coachNotes"
                  placeholder="הוסף הערות או הנחיות למתאמן..."
                  value={sendForm.coachNotes}
                  onChange={(e) => setSendForm(prev => ({...prev, coachNotes: e.target.value}))}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsSendDialogOpen(false)}
              disabled={isSending}
            >
              ביטול
            </Button>
            <Button 
              onClick={handleSendTemplate}
              disabled={isSending || getTargetUsers().length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 ml-2" />
                  {sendForm.sendType === 'group' 
                    ? `שלח ל-${getTargetUsers().length} משתמשים`
                    : 'שלח אימון'
                  }
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
      <VideoPlayer
        isOpen={videoPlayerOpen}
        onClose={() => setVideoPlayerOpen(false)}
        videoUrl={currentVideoUrl}
        exerciseName={currentVideoTitle}
      />
    </div>
  );
}