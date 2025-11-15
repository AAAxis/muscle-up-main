
import React, { useState, useEffect } from 'react';
import { GroupMessage, User, UserGroup } from '@/api/entities';
// SendEmail removed - using CoachNotification instead
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Added Tabs imports
import {
  MessageSquare,
  Send,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  User as UserIcon,
  Circle // Added Circle icon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export default function GroupMessaging({ groups }) {
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [messageTitle, setMessageTitle] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [messageType, setMessageType] = useState('announcement');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [sendImmediately, setSendImmediately] = useState(true); // Default to true as per existing behavior
    const [scheduledTime, setScheduledTime] = useState(''); // Not implemented in UI yet
    const [isSending, setIsSending] = useState(false); // Used for the send button
    const [isLoading, setIsLoading] = useState(true); // Used for initial data loading
    const [feedback, setFeedback] = useState({ type: '', message: '' }); // Replaces successMessage
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isReadReceiptsOpen, setIsReadReceiptsOpen] = useState(false);

    // Enhanced message templates with gender-aware content
    const messageTemplates = {
        motivation_start: {
            title: 'בואו נתחיל את השבוע בכוח!',
            male_content: `היי חברים! 💪
השבוע החדש מתחיל - זה הזמן להציב יעדים חדשים ולהתחיל עם המון אנרגיה!
זכרו - כל יום הוא הזדמנות חדשה להיות הגרסה הטובה ביותר של עצמכם.
בואו נעשה את השבוע הזה נהדר יחד! 🔥`,
            female_content: `היי בנות! 💪
השבוע החדש מתחיל - זה הזמן להציב יעדים חדשים ולהתחיל עם המון אנרגיה!
זכרו - כל יום הוא הזדמנות חדשה להיות הגרסה הטובה ביותר של עצמן.
בואו נעשה את השבוע הזה נהדר יחד! 🔥`,
            mixed_content: `היי חברים וחברות! 💪
השבוע החדש מתחיל - זה הזמן להציב יעדים חדשים ולהתחיל עם המון אנרגיה!
זכרו - כל יום הוא הזדמנות חדשה להיות הגרסה הטובה ביותר של עצמכם.
בואו נעשה את השבועות הזה נהדר יחד! 🔥`
        },
        weight_reminder: {
            title: 'תזכורת חשובה - עדכון משקל',
            male_content: `היי! ⚖️
רק תזכורת קטנה לעדכן את המשקל שלך באפליקציה.
המעקב הקבוע עוזר לנו לראות את ההתקדמות שלך ולהתאים את התוכנית בהתאם.
תודה שאתה שומר על הקשר! 📊`,
            female_content: `היי! ⚖️
רק תזכורת קטנה לעדכן את המשקל שלך באפליקציה.
המעקב הקבוע עוזר לנו לראות את ההתקדמות שלך ולהתאים את התוכנית בהתאם.
תודה שאת שומרת על הקשר! 📊`,
            mixed_content: `היי! ⚖️
רק תזכורת קטנה לעדכן את המשקל באפליקציה.
המעקב הקבוע עוזר לנו לראות את ההתקדמות ולהתאים את התוכנית בהתאם.
תודה שאתם שומרים על הקשר! 📊`
        },
        hydration_reminder: {
            title: 'תזכורת שתייה - המים שלכם חשובים!',
            male_content: `💧 תזכורת חשובה!
אל תשכח לשתות מים לאורך כל היום.
הגוף שלך צריך הידרציה קבועה כדי לפעול במיטבו.
היעד: לפחות 2.5-3 ליטר ביום. בואו נעקוב יחד! 🚰`,
            female_content: `💧 תזכורת חשובה!
אל תשכחי לשתות מים לאורך כל היום.
הגוף שלך צריך הידרציה קבועה כדי לפעול במיטבו.
היעד: לפחות 2-2.5 ליטר ביום. בואו נעקוב יחד! 🚰`,
            mixed_content: `💧 תזכורת חשובה!
אל תשכחו לשתות מים לאורך כל היום.
הגוף צריך הידרציה קבועה כדי לפעול במיטב.
היעד: לפחות 2-3 ליטר ביום. בואו נעקוב יחד! 🚰`
        },
        workout_encouragement: {
            title: 'זמן לאימון! 🏋️',
            male_content: `היום זה יום אימון! 🔥
זכור - כל אימון מקרב אותך ליעד שלך.
גם אם אתה לא מרגיש במצב רוח, התחל רק עם 10 דקות.
לרוב זה מספיק כדי להיכנס לקצב. אתה יכול! 💪`,
            female_content: `היום זה יום אימון! 🔥
זכרי - כל אימון מקרב אותך ליעד שלך.
גם אם את לא מרגישה במצב רוח, התחילי רק עם 10 דקות.
לרוב זה מספיק כדי להיכנס לקצב. את יכולה! 💪`,
            mixed_content: `היום זה יום אימון! 🔥
זכרו - כל אימון מקרב אתכם ליעד שלכם.
גם אם אתם לא מרגישים במצב רוח, התחילו רק עם 10 דקות.
לרוב זה מספיק כדי להיכנס לקצב. אתם יכולים! 💪`
        },
        progress_celebration: {
            title: 'חגיגת הצלחות השבוע! 🎉',
            male_content: `השבוע היה מדהים! 🌟
ראיתי את המאמצים שלך ואני גאה בך.
כל צעד קטן מוביל לתוצאות גדולות.
תמשיך כך - אתה בדרך הנכונה! 🚀`,
            female_content: `השבוע היה מדהים! 🌟
ראיתי את המאמצים שלך ואני גאה בך.
כל צעד קטן מוביל לתוצאות גדולות.
תמשיכי כך - את בדרך הנכונה! 🚀`,
            mixed_content: `השבוע היה מדהים! 🌟
ראיתי את המאמצים שלכם ואני גאה בכם.
כל צעד קטן מוביל לתוצאות גדולות.
תמשיכו כך - אתם בדרך הנכונה! 🚀`
        }
    };

    useEffect(() => {
        loadData(); // Initial load of both messages and users
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [allMessages, allUsers] = await Promise.all([
                GroupMessage.list('-sent_date'),
                User.filter({})
            ]);
            setMessages(allMessages);
            setUsers(allUsers);
        } catch (error) {
            console.error("שגיאה בטעינת נתוני הודעות:", error);
            setFeedback({ type: 'error', message: 'שגיאה בטעינת הנתונים.' });
        } finally {
            setIsLoading(false);
        }
    };

    const loadMessages = async () => {
        try {
            const allMessages = await GroupMessage.list('-sent_date', 50); // Limit to 50 as per outline
            setMessages(allMessages);
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    };

    const getUsersInGroup = (groupName) => {
        return users.filter(user => user.group_names?.includes(groupName));
    };

    // Function to determine group gender composition
    const getGroupGenderComposition = (groupName) => {
        const groupUsers = users.filter(u =>
            Array.isArray(u.group_names) && u.group_names.includes(groupName)
        );

        const maleCount = groupUsers.filter(u => u.gender === 'male').length;
        const femaleCount = groupUsers.filter(u => u.gender === 'female').length;

        if (groupUsers.length === 0) return 'mixed'; // Handle empty groups gracefully
        if (maleCount > 0 && femaleCount === 0) return 'male';
        if (femaleCount > 0 && maleCount === 0) return 'female';
        return 'mixed'; // Default for any combination including both or unknown
    };

    // Function to get gender-appropriate message content
    const getGenderAppropriateContent = (template, groupName) => {
        const genderComposition = getGroupGenderComposition(groupName);
        const templateData = messageTemplates[template];
        
        if (!templateData) return '';
        
        switch (genderComposition) {
            case 'male':
                return templateData.male_content;
            case 'female':
                return templateData.female_content;
            default: // Covers 'mixed' and any other cases, including when group is empty
                return templateData.mixed_content;
        }
    };

    const handleTemplateSelect = (templateKey) => {
        setSelectedTemplate(templateKey);
        const template = messageTemplates[templateKey];
        if (template && selectedGroup) {
            setMessageTitle(template.title);
            setMessageContent(getGenderAppropriateContent(templateKey, selectedGroup));
        }
        // No else blocks, meaning title/content are only set if a group is selected.
        // If no group is selected, selecting template only updates selectedTemplate state.
    };

    // Update content when group changes
    const handleGroupChange = (groupName) => {
        setSelectedGroup(groupName);
        if (selectedTemplate) {
            // Re-apply the selected template to get gender-appropriate content for the new group
            setMessageContent(getGenderAppropriateContent(selectedTemplate, groupName));
        }
    };

    const handleSendMessage = async () => {
        if (!selectedGroup || !messageTitle.trim() || !messageContent.trim()) {
            setFeedback({ type: 'error', message: 'אנא מלא את כל השדות הנדרשים' });
            return;
        }

        setIsSending(true); // Using isSending for button state, consistent with existing usage
        setFeedback({ type: '', message: '' }); // Clear previous feedback

        try {
            const currentUser = await User.me();
            
            const messageData = {
                group_name: selectedGroup,
                message_title: messageTitle,
                message_content: messageContent,
                message_type: messageType,
                template_used: selectedTemplate || null, // Added as per outline
                send_immediately: sendImmediately,
                scheduled_send_time: sendImmediately ? null : scheduledTime, // Added as per outline
                delivery_status: { // Changed delivery_status init as per outline
                    sent_count: 0,
                    delivered_count: 0,
                    failed_count: 0
                },
                sent_by: currentUser.email,
                sent_date: new Date().toISOString(),
                read_receipts: [] // Changed read_receipts init as per outline
            };

            // Create message record (actual sending logic is now assumed to be handled server-side or by GroupMessage.create)
            await GroupMessage.create(messageData);
            
            setFeedback({ type: 'success', message: 'ההודעה נשלחה בהצלחה!' });
            
            // Reset form fields as per outline
            setMessageTitle('');
            setMessageContent('');
            setSelectedTemplate(''); // Clear selected template after sending

            // Note: selectedGroup and messageType are not reset as per outline's implied changes.
            // Original code reset them, but outline removes those lines.

            // Load updated messages to reflect the new entry
            await loadMessages(); // Changed from loadData() to loadMessages() for efficiency
            
        } catch (error) {
            console.error('שגיאה בשליחת ההודעה:', error);
            setFeedback({ type: 'error', message: 'שגיאה בשליחת ההודעה. נסה שוב.' });
        } finally {
            setIsSending(false);
        }
    };

    const handleViewReadReceipts = (message) => {
        setSelectedMessage(message);
        setIsReadReceiptsOpen(true);
    };

    const getMessageTypeLabel = (type) => {
        const types = {
            'announcement': 'הכרזה',
            'reminder': 'תזכורת',
            'motivation': 'מוטיבציה',
            'custom': 'מותאם אישית'
        };
        return types[type] || type;
    };

    const getReadStats = (message) => {
        if (!message.read_receipts) return { read: 0, unread: 0 };
        const read = message.read_receipts.filter(r => r.is_read).length;
        const totalRecipients = getUsersInGroup(message.group_name).length;
        const unread = totalRecipients - read;
        return { read, unread: Math.max(0, unread) }; // Ensure unread isn't negative
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="shadow-xl border-0 bg-gradient-to-br from-white via-purple-50 to-blue-50">
                <CardHeader className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white rounded-t-lg">
                    <CardTitle className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">מערכת הודעות קבוצתיות</h2>
                            <p className="text-purple-100 text-sm mt-1">שלח הודעות מותאמות אישית לפי הרכב הקבוצה</p>
                        </div>
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-6">
                    {feedback.message && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`px-4 py-3 rounded mb-6 ${
                                feedback.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'
                            }`}
                        >
                            {feedback.message}
                        </motion.div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Send Message Form */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">שליחת הודעה חדשה</h3>

                            <div className="space-y-2">
                                <Label htmlFor="group-select">בחר קבוצה *</Label>
                                <Select value={selectedGroup} onValueChange={handleGroupChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="בחר קבוצה לשליחת ההודעה" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map(group => {
                                            const genderComp = getGroupGenderComposition(group.name);
                                            const genderIcon = genderComp === 'male' ? '👨' : genderComp === 'female' ? '👩' : '👥';
                                            return (
                                                <SelectItem key={group.id} value={group.name}>
                                                    {genderIcon} {group.name} ({getUsersInGroup(group.name).length} חברים)
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message-template">תבניות הודעות (מותאמות לקבוצה)</Label>
                                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="בחר תבנית הודעה..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(messageTemplates).map(([key, template]) => (
                                            <SelectItem key={key} value={key}>
                                                {template.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message-type">סוג הודעה</Label>
                                <Select value={messageType} onValueChange={setMessageType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="announcement">הכרזה</SelectItem>
                                        <SelectItem value="reminder">תזכורת</SelectItem>
                                        <SelectItem value="motivation">מוטיבציה</SelectItem>
                                        <SelectItem value="custom">מותאם אישית</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message-title">כותרת ההודעה *</Label>
                                <Input
                                    id="message-title"
                                    value={messageTitle}
                                    onChange={(e) => setMessageTitle(e.target.value)}
                                    placeholder="הזן כותרת מעניינת להודעה..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message-content">תוכן ההודעה *</Label>
                                <Textarea
                                    id="message-content"
                                    value={messageContent}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    placeholder="כתב את תוכן ההודעה כאן..."
                                    rows={6}
                                />
                            </div>

                            <Button
                                onClick={handleSendMessage}
                                disabled={isSending || !selectedGroup || !messageTitle.trim() || !messageContent.trim()}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {isSending ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        שולח הודעה...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        שלח הודעה
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Recent Messages - Now with Tabs */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">הודעות שנשלחו</h3>
                            <Tabs defaultValue="sent" className="w-full">
                                <TabsList className="grid w-full grid-cols-1">
                                    <TabsTrigger value="sent">נשלחו</TabsTrigger>
                                    {/* Add more tabs here if needed in the future */}
                                </TabsList>
                                <TabsContent value="sent" className="space-y-4 pt-4">
                                    {messages.length > 0 ? (
                                        <ScrollArea className="h-[calc(100vh-250px)] pr-4"> {/* Adjust height as needed */}
                                            <div className="space-y-4">
                                                <AnimatePresence>
                                                    {messages.map((message, index) => { // Removed slice(0,10) to show all
                                                        const readCount = message.read_receipts?.filter(r => r.is_read).length || 0;
                                                        const totalRecipients = getUsersInGroup(message.group_name).length;
                                                        const unreadCount = totalRecipients - readCount;

                                                        return (
                                                            <motion.div
                                                                key={message.id}
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: index * 0.05 }}
                                                                className="bg-white rounded-lg p-4 border shadow-sm hover:shadow-md transition-shadow"
                                                            >
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="flex-1">
                                                                        <h4 className="font-semibold text-slate-800">{message.message_title}</h4>
                                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                                                                            <span className="flex items-center gap-1">
                                                                                <Users className="w-3 h-3" />
                                                                                {message.group_name}
                                                                            </span>
                                                                            <span className="flex items-center gap-1">
                                                                                <Clock className="w-3 h-3" />
                                                                                {format(new Date(message.sent_date), 'dd/MM/yy HH:mm', { locale: he })}
                                                                            </span>
                                                                            <Badge className={`px-2 py-0.5 text-xs ${
                                                                                readCount === totalRecipients && totalRecipients > 0
                                                                                    ? 'bg-green-100 text-green-800' 
                                                                                    : readCount > 0 
                                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                                        : 'bg-gray-100 text-gray-800'
                                                                            }`}>
                                                                                {readCount}/{totalRecipients} קראו
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                    <Badge className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5">
                                                                        {getMessageTypeLabel(message.message_type)}
                                                                    </Badge>
                                                                </div>

                                                                <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3">
                                                                    {message.message_content}
                                                                </p>

                                                                {/* Read Receipts Details */}
                                                                {message.read_receipts && message.read_receipts.length > 0 && (
                                                                    <div className="border-t pt-3">
                                                                        <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                                                            📋 סטטוס קריאה (פירוט):
                                                                        </h4>
                                                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                                                            {message.read_receipts
                                                                                .sort((a, b) => new Date(b.read_timestamp || 0) - new Date(a.read_timestamp || 0))
                                                                                .map((receipt, idx) => (
                                                                                <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                                                                                    <span className="font-medium">{receipt.user_name}</span>
                                                                                    <div className="flex items-center gap-2">
                                                                                        {receipt.is_read ? (
                                                                                            <>
                                                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                                                                <span className="text-green-600">
                                                                                                    נקרא {receipt.read_timestamp ? 
                                                                                                        format(new Date(receipt.read_timestamp), 'dd/MM HH:mm', { locale: he }) : 
                                                                                                        'לא ידוע מתי'}
                                                                                                </span>
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <Circle className="w-4 h-4 text-gray-400" />
                                                                                                <span className="text-gray-500">לא נקרא</span>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </motion.div>
                                                        );
                                                    })}
                                                </AnimatePresence>
                                            </div>
                                        </ScrollArea>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
                                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>לא נשלחו הודעות עדיין</p>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Read Receipts Dialog (Kept for detailed view) */}
            <Dialog open={isReadReceiptsOpen} onOpenChange={setIsReadReceiptsOpen}>
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>סטטוס קריאה - {selectedMessage?.message_title}</DialogTitle>
                    </DialogHeader>

                    {selectedMessage && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span className="font-semibold">נקרא</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-800">
                                        {getReadStats(selectedMessage).read}
                                    </p>
                                </div>

                                <div className="bg-orange-50 p-3 rounded-lg">
                                    <div className="flex items-center justify-center gap-2 text-orange-600 mb-1">
                                        <AlertCircle className="w-5 h-5" />
                                        <span className="font-semibold">לא נקרא</span>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-800">
                                        {getReadStats(selectedMessage).unread}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <ScrollArea className="h-64">
                                <div className="space-y-2">
                                    {selectedMessage.read_receipts?.map((receipt, index) => (
                                        <div key={index} className={`flex items-center justify-between p-2 rounded-lg ${
                                            receipt.is_read ? 'bg-green-50' : 'bg-orange-50'
                                        }`}>
                                            <div className="flex items-center gap-2">
                                                <UserIcon className="w-4 h-4 text-slate-500" />
                                                <span className="font-medium text-sm">{receipt.user_name}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {receipt.is_read ? (
                                                    <>
                                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                        {receipt.read_timestamp && (
                                                            <span className="text-xs text-slate-500">
                                                                {format(new Date(receipt.read_timestamp), 'dd/MM HH:mm', { locale: he })}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <AlertCircle className="w-4 h-4 text-orange-600" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
