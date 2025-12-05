import React, { useState, useEffect } from 'react';
import { UserGroup, User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Mail,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function GroupNotifications() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [emailTitle, setEmailTitle] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [groupUsers, setGroupUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupUsers();
    } else {
      setGroupUsers([]);
    }
  }, [selectedGroup]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allGroups = await UserGroup.list();
      setGroups(allGroups || []);
    } catch (error) {
      console.error('Error loading groups:', error);
      setFeedback({ type: 'error', message: 'שגיאה בטעינת הקבוצות.' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupUsers = async () => {
    try {
      const users = await User.filter({ group_names: { $in: [selectedGroup] } });
      // Filter out admins and coaches
      const traineeUsers = users.filter(u => u.role !== 'admin' && u.role !== 'coach');
      setGroupUsers(traineeUsers);
    } catch (error) {
      console.error('Error loading group users:', error);
      setGroupUsers([]);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedGroup || !notificationTitle.trim() || !notificationBody.trim()) {
      setFeedback({ type: 'error', message: 'אנא מלא את כל השדות הנדרשים' });
      return;
    }

    setIsSendingNotification(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch('/api/send-group-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupName: selectedGroup,
          title: notificationTitle,
          body: notificationBody,
          imageUrl: imageUrl.trim() || undefined,
          data: {
            type: 'group_notification',
            groupName: selectedGroup
          }
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setFeedback({
          type: 'success',
          message: `ההודעה נשלחה בהצלחה! ${result.successCount} משתמשים קיבלו את ההודעה.`
        });
        // Reset form
        setNotificationTitle('');
        setNotificationBody('');
        setImageUrl('');
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'שגיאה בשליחת ההודעה. נסה שוב.'
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setFeedback({ type: 'error', message: 'שגיאה בשליחת ההודעה. נסה שוב.' });
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedGroup || !emailTitle.trim() || !emailMessage.trim()) {
      setFeedback({ type: 'error', message: 'אנא מלא את כל השדות הנדרשים' });
      return;
    }

    setIsSendingEmail(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch('/api/send-group-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupName: selectedGroup,
          title: emailTitle,
          message: emailMessage
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setFeedback({
          type: 'success',
          message: `האימייל נשלח בהצלחה! ${result.successCount} משתמשים קיבלו את האימייל.`
        });
        // Reset form
        setEmailTitle('');
        setEmailMessage('');
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'שגיאה בשליחת האימייל. נסה שוב.'
        });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setFeedback({ type: 'error', message: 'שגיאה בשליחת האימייל. נסה שוב.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="shadow-xl border-0 bg-gradient-to-br from-white via-purple-50 to-blue-50">
        <CardHeader className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">שליחת התראות ואימיילים לקבוצה</h2>
              <p className="text-purple-100 text-sm mt-1">שלח התראות push ואימיילים לכל חברי הקבוצה</p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          {feedback.message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`px-4 py-3 rounded mb-6 ${
                feedback.type === 'success' 
                  ? 'bg-green-100 border border-green-400 text-green-700' 
                  : 'bg-red-100 border border-red-400 text-red-700'
              }`}
            >
              {feedback.message}
            </motion.div>
          )}

          {/* Group Selection */}
          <div className="mb-6">
            <Label htmlFor="group-select" className="text-base font-semibold mb-2 block">
              בחר קבוצה *
            </Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="בחר קבוצה לשליחת התראות/אימיילים" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(group => {
                  const userCount = groupUsers.length || 0;
                  return (
                    <SelectItem key={group.id} value={group.name}>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{group.name}</span>
                        {selectedGroup === group.name && (
                          <Badge variant="secondary" className="mr-2">
                            {userCount} חברים
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedGroup && groupUsers.length > 0 && (
              <p className="text-sm text-slate-600 mt-2">
                הקבוצה כוללת {groupUsers.length} חברים
              </p>
            )}
          </div>

          <Tabs defaultValue="notification" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notification" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                התראות Push
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                אימיילים
              </TabsTrigger>
            </TabsList>

            {/* Push Notification Tab */}
            <TabsContent value="notification" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="notification-title">כותרת ההתראה *</Label>
                <Input
                  id="notification-title"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="הזן כותרת להתראה..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification-body">תוכן ההתראה *</Label>
                <Textarea
                  id="notification-body"
                  value={notificationBody}
                  onChange={(e) => setNotificationBody(e.target.value)}
                  placeholder="כתב את תוכן ההתראה כאן..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image-url">קישור לתמונה (אופציונלי)</Label>
                <Input
                  id="image-url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  type="url"
                />
              </div>

              <Button
                onClick={handleSendNotification}
                disabled={isSendingNotification || !selectedGroup || !notificationTitle.trim() || !notificationBody.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isSendingNotification ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    שולח התראות...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    שלח התראות Push לכל חברי הקבוצה
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Email Tab */}
            <TabsContent value="email" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="email-title">כותרת האימייל *</Label>
                <Input
                  id="email-title"
                  value={emailTitle}
                  onChange={(e) => setEmailTitle(e.target.value)}
                  placeholder="הזן כותרת לאימייל..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-message">תוכן האימייל *</Label>
                <Textarea
                  id="email-message"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="כתב את תוכן האימייל כאן..."
                  rows={6}
                />
                <p className="text-xs text-slate-500">
                  הערה: שם המשתמש יתווסף אוטומטית בתחילת האימייל
                </p>
              </div>

              <Button
                onClick={handleSendEmail}
                disabled={isSendingEmail || !selectedGroup || !emailTitle.trim() || !emailMessage.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    שולח אימיילים...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    שלח אימיילים לכל חברי הקבוצה
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
