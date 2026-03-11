

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WeeklyTask, User, UserGroup, CoachNotification, WeeklyTaskTemplate } from '@/api/entities';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';
import { groupsForStaff } from '@/lib/groupUtils';
import { SendFCMNotification, sendGroupEmail } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

import {
    Calendar as Calendar1, // Renamed to avoid conflict with shadcn/ui Calendar
    Users,
    User as UserIcon,
    RotateCcw,
    Play,
    Pause,
    Shield,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Target,
    Settings,
    RefreshCcw,
    Power,
    MessageSquare,
    XCircle,
    CheckCircle,
    BarChart,
    Check,
    ChevronsUpDown,
    CheckSquare,
    Square,
} from 'lucide-react';
import { format, addDays, parseISO, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export default function WeeklyTaskManager() {
    const { user: currentUser, isSystemAdmin } = useAdminDashboard();
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [taskTemplates, setTaskTemplates] = useState([]);
    const [targetType, setTargetType] = useState('user'); 
    const [selectedUser, setSelectedUser] = useState(''); // Stores email string for assign tab
    const [selectedGroup, setSelectedGroup] = useState('');
    const [newStartDate, setNewStartDate] = useState(new Date()); // Date object for setting new booster start date
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [selectedUsers, setSelectedUsers] = useState([]); // For group selection in assign tab
    const [selectedUserEmailForAssignment, setSelectedUserEmailForAssignment] = useState('');
    const [weeksToAssign, setWeeksToAssign] = useState([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [bulkAssignStatus, setBulkAssignStatus] = useState('');
    const [activeTab, setActiveTab] = useState('assign');
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [selectedUserForDetail, setSelectedUserForDetail] = useState(null);
    const [selectedUserTasks, setSelectedUserTasks] = useState([]);

    // New states for Freeze/Unfreeze functionality based on outline
    const { toast } = useToast();
    const [openUnfreezeUserSelector, setOpenUnfreezeUserSelector] = useState(false);
    const [openFreezeUserSelector, setOpenFreezeUserSelector] = useState(false);
    const [selectedUserObjectForUnfreeze, setSelectedUserObjectForUnfreeze] = useState(null); // User object
    const [selectedUserObjectForFreeze, setSelectedUserObjectForFreeze] = useState(null);     // User object
    const [unfreezeStartDateInput, setUnfreezeStartDateInput] = useState(format(new Date(), 'yyyy-MM-dd')); // String for date input
    const [isUnfreezingOperation, setIsUnfreezingOperation] = useState(false); // Loading state for unfreeze
    const [isFreezingOperation, setIsFreezingOperation] = useState(false);     // Loading state for freeze


    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const listUsers = isSystemAdmin ? () => User.filter({}) : () => User.listForStaff(currentUser);
            const [allUsers, allGroups, allTasks, templatesList] = await Promise.all([
                listUsers(),
                UserGroup.list(),
                WeeklyTask.list(),
                WeeklyTaskTemplate.list('week').catch(() => [])
            ]);
            const traineesOnly = (allUsers || []).filter(u => (u.role || '').toLowerCase() !== 'admin' && (u.role || '').toLowerCase() !== 'trainer');
            setUsers(traineesOnly);
            setGroups(groupsForStaff(allGroups || [], currentUser, isSystemAdmin));
            setTasks(allTasks || []);
            const sorted = (Array.isArray(templatesList) ? templatesList : []).sort((a, b) => (a.week || 0) - (b.week || 0));
            setTaskTemplates(sorted);
        } catch (error) {
            console.error('Error loading data:', error);
            setFeedback({ type: 'error', message: 'שגיאה בטעינת הנתונים' });
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, setUsers, setGroups, setTasks, setFeedback, currentUser, isSystemAdmin]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    };

    const getTargetUsers = () => {
        if (targetType === 'user' && selectedUser) {
            return users.filter(u => u.email === selectedUser);
        }
        if (targetType === 'group' && selectedGroup) {
            const groupUsers = users.filter(u => u.group_names?.includes(selectedGroup));
            const selectedInUI = groupUsers.filter(u => selectedUsers.includes(u.id));
            return selectedInUI.length > 0 ? selectedInUI : groupUsers;
        }
        return [];
    };

    const handleSetStartDate = async () => {
        const targetUsers = getTargetUsers();
        if (targetUsers.length === 0) {
            showFeedback('error', 'יש לבחור מתאמן או קבוצה.');
            return;
        }
        if (taskTemplates.length === 0) {
            showFeedback('error', 'לא נמצאו תבניות משימות שבועיות. יש להוסיף תבניות בקטע "ניהול תפריטים" > ניהול תבניות משימות בוסטר (או בתוכניות > ניהול בוסטר).');
            return;
        }

        setIsProcessing(true);
        try {
            for (const user of targetUsers) {
                // Delete existing tasks for user before re-creating
                const existingTasks = await WeeklyTask.filter({ user_email: user.email });
                for (const task of existingTasks) {
                    await WeeklyTask.delete(task.id);
                }

                const newTasks = taskTemplates.map(taskTemplate => {
                    const weekStartDate = addDays(newStartDate, (taskTemplate.week - 1) * 7);
                    const weekEndDate = addDays(weekStartDate, 6);

                    return {
                        user_email: user.email,
                        week: taskTemplate.week,
                        title: taskTemplate.title,
                        mission_text: taskTemplate.mission_text,
                        tip_text: taskTemplate.tip_text,
                        booster_text: taskTemplate.booster_text,
                        week_start_date: format(weekStartDate, 'yyyy-MM-dd'),
                        week_end_date: format(weekEndDate, 'yyyy-MM-dd'),
                        status: 'לא בוצע',
                        completion_date: null,
                        notes_thread: [],
                        is_displayed_in_report: false,
                        is_frozen: false // New field, default to false
                    };
                });
                
                for (const taskData of newTasks) {
                    await WeeklyTask.create(taskData);
                }

                await User.update(user.id, {
                    booster_start_date: format(newStartDate, 'yyyy-MM-dd'),
                    booster_status: 'in_progress'
                });
            }

            showFeedback('success', `תאריך התחלה חדש נקבע בהצלחה עבור ${targetUsers.length} מתאמנים.`);
            await loadData();
        } catch (error) {
            console.error('Error setting start date:', error);
            showFeedback('error', 'שגיאה בקביעת תאריך התחלה.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetTasks = async () => {
        const targetUsers = getTargetUsers();
        if (targetUsers.length === 0) {
            showFeedback('error', 'יש לבחור מתאמן או קבוצה.');
            return;
        }

        if (!window.confirm(`האם אתה בטוח שברצונך לאפס את כל משימות הבוסטר עבור ${targetUsers.length} מתאמנים?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            for (const user of targetUsers) {
                const userTasks = await WeeklyTask.filter({ user_email: user.email });
                for (const task of userTasks) {
                    await WeeklyTask.update(task.id, {
                        status: 'לא בוצע',
                        completion_date: null,
                        notes_thread: [],
                        is_displayed_in_report: false,
                        is_frozen: false // Also unfreeze on reset
                    });
                }
            }

            showFeedback('success', 'משימות הבוסטר אופסו בהצלחה.');
            await loadData();
        } catch (error) {
            console.error('Error resetting tasks:', error);
            showFeedback('error', 'שגיאה באיפוס משימות הבוסטר.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTaskActivation = async (enable) => {
        const targetUsers = getTargetUsers();
        if (targetUsers.length === 0) {
            showFeedback('error', 'יש לבחור מתאמן או קבוצה.');
            return;
        }

        setIsProcessing(true);
        try {
            const currentUser = await User.me();
            let notificationCount = 0;
            let emailCount = 0;

            for (const user of targetUsers) {
                const updatePayload = { booster_enabled: enable };
                if (enable) {
                    updatePayload.booster_unlocked = true;
                    updatePayload.booster_status = 'in_progress';
                    if (!user.booster_start_date) {
                        updatePayload.booster_start_date = new Date().toISOString();
                    }
                    
                    const existingTasks = await WeeklyTask.filter({ user_email: user.email });
                    if (!existingTasks || existingTasks.length === 0) {
                        // If no tasks exist, create them from templates (not hardcoded)
                        if (taskTemplates.length === 0) {
                            showFeedback('error', 'לא נמצאו תבניות משימות שבועיות. יש להוסיף תבניות בקטע ניהול בוסטר > ניהול תבניות משימות בוסטר.');
                            continue;
                        }
                        const startDate = new Date();

                        const newTasks = taskTemplates.map(taskTemplate => {
                            const weekStartDate = addDays(startDate, (taskTemplate.week - 1) * 7);
                            const weekEndDate = addDays(weekStartDate, 6);

                            return {
                                user_email: user.email,
                                week: taskTemplate.week,
                                title: taskTemplate.title,
                                mission_text: taskTemplate.mission_text,
                                tip_text: taskTemplate.tip_text,
                                booster_text: taskTemplate.booster_text,
                                week_start_date: format(weekStartDate, 'yyyy-MM-dd'),
                                week_end_date: format(weekEndDate, 'yyyy-MM-dd'),
                                status: 'לא בוצע',
                                completion_date: null,
                                notes_thread: [],
                                is_displayed_in_report: false,
                                is_frozen: false // New field, default to false
                            };
                        });
                        await WeeklyTask.bulkCreate(newTasks);
                        showFeedback('info', `נוצרה תוכנית משימות חדשה עבור ${user.name}.`);
                    }

                    // Send notifications and email when enabling
                    if (user.email) {
                        try {
                            // Send push notification
                            try {
                                await SendFCMNotification({
                                    userId: user.id,
                                    userEmail: user.email,
                                    title: '🎉 גישה לתוכנית הבוסטר!',
                                    body: `שלום ${user.name || 'מתאמן/ת'}! קיבלת גישה לתוכנית הבוסטר. התחל עכשיו את המסע שלך!`,
                                    data: {
                                        type: 'booster_access_granted',
                                        userId: user.id
                                    }
                                });
                                notificationCount++;
                            } catch (fcmError) {
                                console.warn(`Failed to send FCM notification to ${user.email}:`, fcmError);
                            }

                            // Send email notification
                            try {
                                const emailTitle = '🎉 גישה לתוכנית הבוסטר!';
                                const emailMessage = `שלום ${user.name || 'מתאמן/ת'}!

ברכות! קיבלת גישה לתוכנית הבוסטר שלנו.

עכשיו תוכל ליהנות מכל התכונות המיוחדות של התוכנית:
• משימות שבועיות מותאמות אישית
• מעקב התקדמות מפורט
• תמיכה והדרכה צמודה
• גישה לתוכן בלעדי

התחל את המסע שלך עכשיו באפליקציה!

בהצלחה,
צוות Vitrix`;

                                const emailResult = await sendGroupEmail({
                                    userEmail: user.email,
                                    title: emailTitle,
                                    message: emailMessage
                                });
                                if (emailResult && emailResult.success && emailResult.successCount > 0) {
                                    emailCount++;
                                }
                            } catch (emailError) {
                                console.warn(`Failed to send email to ${user.email}:`, emailError);
                            }

                            // Create CoachNotification record
                            try {
                                await CoachNotification.create({
                                    user_email: user.email,
                                    user_name: user.name || 'מתאמן/ת',
                                    notification_type: 'booster_access_granted',
                                    title: 'גישה לתוכנית הבוסטר',
                                    message: 'קיבלת גישה לתוכנית הבוסטר. התחל עכשיו את המסע שלך!',
                                    sent_by: currentUser.email || 'system',
                                    sent_date: new Date().toISOString(),
                                    read: false
                                });
                            } catch (notificationError) {
                                console.warn(`Failed to create CoachNotification for ${user.email}:`, notificationError);
                            }
                        } catch (notificationError) {
                            console.warn(`Failed to send notifications to ${user.email}:`, notificationError);
                        }
                    }
                } else {
                    // If disabling, reset status
                    updatePayload.booster_status = 'not_started';
                    updatePayload.booster_start_date = null;
                }
                await User.update(user.id, updatePayload);
            }
            
            const message = `תוכנית המשימות ${enable ? 'הופעלה' : 'כובתה'} בהצלחה.`;
            const notificationMessage = enable 
                ? ` ${notificationCount} התראות push ו-${emailCount} אימיילים נשלחו.`
                : '';
            
            showFeedback('success', message + notificationMessage);
            await loadData();
        } catch (error) {
            showFeedback('error', 'שגיאה בעדכון סטטוס המשימות.');
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAssignTasks = async () => {
        if (!selectedUserEmailForAssignment || weeksToAssign.length === 0) {
            showFeedback('error', 'יש לבחור מתאמן ושבועות להקצאה.');
            return;
        }

        setIsProcessing(true);
        try {
            const selectedUserData = users.find(u => u.email === selectedUserEmailForAssignment);
            if (!selectedUserData) {
                throw new Error('User not found');
            }
            if (taskTemplates.length === 0) {
                showFeedback('error', 'לא נמצאו תבניות משימות. יש להוסיף תבניות בקטע ניהול בוסטר > ניהול תבניות משימות בוסטר.');
                setIsProcessing(false);
                return;
            }

            const tasksToCreate = [];
            const userStartDate = selectedUserData.booster_start_date ? parseISO(selectedUserData.booster_start_date) : new Date();

            for (const weekNum of weeksToAssign) {
                const taskTemplate = taskTemplates.find(t => t.week === weekNum);
                
                if (!taskTemplate) {
                    console.warn(`No template found for week ${weekNum}`);
                    continue;
                }

                const weekStartDate = addDays(userStartDate, ((weekNum - 1 + weekOffset) * 7));
                const weekEndDate = addDays(weekStartDate, 6);

                tasksToCreate.push({
                    user_email: selectedUserEmailForAssignment,
                    week: weekNum,
                    title: taskTemplate.title,
                    mission_text: taskTemplate.mission_text,
                    tip_text: taskTemplate.tip_text,
                    booster_text: taskTemplate.booster_text,
                    week_start_date: format(weekStartDate, 'yyyy-MM-dd'),
                    week_end_date: format(weekEndDate, 'yyyy-MM-dd'),
                    status: 'לא בוצע',
                    completion_date: null,
                    notes_thread: [],
                    is_displayed_in_report: false,
                    is_frozen: false // New field, default to false
                });
            }

            if (tasksToCreate.length > 0) {
                await WeeklyTask.bulkCreate(tasksToCreate);
                showFeedback('success', `משימות לשבועות ${weeksToAssign.join(',')} הוקצו בהצלחה למתאמן ${selectedUserData.name}.`);
            } else {
                showFeedback('info', 'לא נוצרו משימות, ייתכן שאין תבניות עבור השבועות שנבחרו.');
            }
            await loadData();
        } catch (error) {
            console.error('Error assigning tasks:', error);
            showFeedback('error', `שגיאה בהקצאת משימות: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApplyTemplateToAll = async () => {
        if (weeksToAssign.length === 0) {
            showFeedback('error', 'יש לבחור שבועות להקצאה.');
            return;
        }
        if (taskTemplates.length === 0) {
            showFeedback('error', 'לא נמצאו תבניות משימות. יש להוסיף תבניות בקטע ניהול בוסטר > ניהול תבניות משימות בוסטר.');
            return;
        }

        if (!window.confirm(`האם אתה בטוח שברצונך להקצות את שבועות ${weeksToAssign.join(',')} לכל המתאמנים הפעילים?`)) {
            return;
        }

        setIsProcessing(true);
        setBulkAssignStatus('מכין נתונים...');
        try {
            const allUsers = users.filter(u => u.booster_unlocked && u.booster_enabled);
            
            let tasksToCreate = [];

            for (const user of allUsers) {
                if (user.role === 'admin') continue;

                const userStartDate = user.booster_start_date ? parseISO(user.booster_start_date) : new Date();

                for (const weekNum of weeksToAssign) {
                    const taskTemplate = taskTemplates.find(t => t.week === weekNum);
                    if (!taskTemplate) {
                        console.warn(`No template found for week ${weekNum} for user ${user.email}`);
                        continue;
                    }

                    const weekStartDate = addDays(userStartDate, ((weekNum - 1 + weekOffset) * 7));
                    const weekEndDate = addDays(weekStartDate, 6);
                    
                    tasksToCreate.push({
                        user_email: user.email,
                        week: weekNum,
                        title: taskTemplate.title,
                        mission_text: taskTemplate.mission_text,
                        tip_text: taskTemplate.tip_text,
                        booster_text: taskTemplate.booster_text,
                        week_start_date: format(weekStartDate, 'yyyy-MM-dd'),
                        week_end_date: format(weekEndDate, 'yyyy-MM-dd'),
                        status: 'לא בוצע',
                        completion_date: null,
                        notes_thread: [],
                        is_displayed_in_report: false,
                        is_frozen: false // New field, default to false
                    });
                }
            }

            if (tasksToCreate.length > 0) {
                setBulkAssignStatus(`מקצה ${tasksToCreate.length} משימות ל-${allUsers.length} מתאמנים...`);
                await WeeklyTask.bulkCreate(tasksToCreate);
                showFeedback('success', `משימות לשבועות ${weeksToAssign.join(',')} הוקצו בהצלחה לכל המתאמנים הפעילים.`);
            } else {
                showFeedback('info', 'לא נוצרו משימות, ייתכן שאין תבניות עבור השבועות שנבחרו או שאין מתאמנים פעילים.');
            }
            setBulkAssignStatus('');
            await loadData();
        } catch (error) {
            console.error('Error applying template to all:', error);
            showFeedback('error', `שגיאה בהקצאה המונית: ${error.message}`);
            setBulkAssignStatus('שגיאה');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFreezeTasks = async (userObject) => {
        if (!userObject) {
            toast({
                title: "שגיאה",
                description: "יש לבחור משתמש להקפאה.",
                variant: "destructive",
            });
            return;
        }
        setIsFreezingOperation(true);
        try {
            const tasksToFreeze = tasks.filter(t => 
                t.user_email === userObject.email && 
                t.status !== 'הושלם' && 
                !t.is_frozen
            );
            
            const updatePromises = tasksToFreeze.map(task => 
                WeeklyTask.update(task.id, { is_frozen: true })
            );
            await Promise.all(updatePromises);

            toast({
                title: "הצלחה",
                description: `כל המשימות הפעילות והעתידיות של ${userObject.name} הוקפאו בהצלחה.`,
            });
            setSelectedUserObjectForFreeze(null); // Clear selected user
            await loadData();
        } catch (error) {
            console.error("Error freezing tasks:", error);
            toast({
                title: "שגיאה",
                description: "שגיאה בהקפאת משימות.",
                variant: "destructive",
            });
        } finally {
            setIsFreezingOperation(false);
        }
    };

    const handleUnfreezeTasks = async (userObject, startDateString) => {
        if (!userObject || !startDateString) {
            toast({
                title: "שגיאה",
                description: "יש לבחור משתמש ותאריך התחלה.",
                variant: "destructive",
            });
            return;
        }
        setIsUnfreezingOperation(true);
        try {
            const parsedStartDate = parseISO(startDateString);
            const frozenTasks = tasks.filter(t => 
                t.user_email === userObject.email && 
                t.is_frozen
            );
            
            const updatePromises = frozenTasks.map(task => {
                const week1AlignedStart = startOfWeek(parsedStartDate, { weekStartsOn: 0 }); // Assuming Sunday is start of week
                const taskWeekStartDate = addWeeks(week1AlignedStart, task.week - 1);
                const taskWeekEndDate = endOfWeek(taskWeekStartDate, { weekStartsOn: 0 });

                return WeeklyTask.update(task.id, {
                    is_frozen: false,
                    week_start_date: format(taskWeekStartDate, 'yyyy-MM-dd'),
                    week_end_date: format(taskWeekEndDate, 'yyyy-MM-dd'),
                });
            });
            await Promise.all(updatePromises);

            toast({
                title: "הצלחה",
                description: `המשימות של ${userObject.name} הופשרו בהצלחה ותאריכיהן עודכנו החל מ-${format(parsedStartDate, 'dd/MM/yyyy')}.`,
            });
            setUnfreezeStartDateInput(format(new Date(), 'yyyy-MM-dd')); // Reset date picker
            setSelectedUserObjectForUnfreeze(null); // Clear selected user
            await loadData();
        } catch (error) {
            console.error("Error unfreezing tasks:", error);
            toast({
                title: "שגיאה",
                description: "שגיאה בהפשרת משימות.",
                variant: "destructive",
            });
        } finally {
            setIsUnfreezingOperation(false);
        }
    };

    const getUserTasksStatus = (userEmail) => {
        const userTasks = tasks.filter(t => t.user_email === userEmail);
        if (userTasks.length === 0) return { total: 0, completed: 0, percentage: 0, frozen: 0 };

        const completed = userTasks.filter(t => t.status === 'הושלם').length;
        const frozen = userTasks.filter(t => t.is_frozen).length; 
        return {
            total: userTasks.length,
            completed,
            frozen, 
            percentage: Math.round((completed / userTasks.length) * 100)
        };
    };

    const weekOptions = taskTemplates.map(task => ({
        value: task.week,
        label: `שבוע ${task.week} - ${task.title}`
    }));

    const usersWithBoosterEnabled = useMemo(() => {
        return users.filter(u => u.booster_enabled);
    }, [users]);

    const getUsersWithTaskStats = useMemo(() => {
        if (!users.length || !tasks.length) return [];
        
        const now = new Date();
        
        return users.map(user => {
            const userTasks = tasks.filter(task => task.user_email === user.email);
            
            // Active tasks exclude frozen tasks for current status calculation
            const activeTasks = userTasks.filter(task => {
                const startDate = parseISO(task.week_start_date);
                const endDate = parseISO(task.week_end_date);
                return startDate <= now && endDate >= now && !task.is_frozen;
            });
            
            const completedTasks = activeTasks.filter(task => task.status === 'הושלם');
            const inProgressTasks = activeTasks.filter(task => task.status === 'בעבודה');
            const notStartedTasks = activeTasks.filter(task => task.status === 'לא בוצע');
            const frozenTasks = userTasks.filter(task => task.is_frozen); // All frozen tasks for user

            return {
                ...user,
                taskStats: {
                    total: activeTasks.length,
                    completed: completedTasks.length,
                    inProgress: inProgressTasks.length,
                    notStarted: notStartedTasks.length,
                    frozen: frozenTasks.length,
                    activeTasks,
                    completionPercentage: activeTasks.length > 0 ? Math.round((completedTasks.length / activeTasks.length) * 100) : 0
                }
            };
        }).filter(user => user.booster_unlocked && user.booster_enabled);
    }, [users, tasks]);

    const handleUserTasksView = (user) => {
        const userTasks = tasks.filter(task => task.user_email === user.email);
        
        // When viewing details, show all tasks (including frozen)
        const tasksForDisplay = userTasks.sort((a, b) => a.week - b.week);
        
        setSelectedUserForDetail(user);
        setSelectedUserTasks(tasksForDisplay); // Display all tasks, not just active
        setIsDetailDialogOpen(true);
    };

    const updateTaskStatus = async (taskId, newStatus) => {
        setIsProcessing(true);
        try {
            const task = selectedUserTasks.find(t => t.id === taskId);
            if (!task) return;

            const updatedData = {
                status: newStatus,
                completion_date: newStatus === 'הושלם' ? new Date().toISOString().split('T')[0] : null
            };
            
            await WeeklyTask.update(taskId, updatedData);
            
            const updatedTask = { ...task, ...updatedData };
            
            // Optimistically update selectedUserTasks
            setSelectedUserTasks(prevTasks => 
                prevTasks.map(t => 
                    t.id === taskId ? updatedTask : t
                )
            );
            
            // Re-load data to ensure global state is consistent
            await loadData(); 
            
            // Re-fetch specific user tasks for dialog from the updated global state
            if (selectedUserForDetail) {
                const refreshedUserTasks = tasks.filter(t => t.user_email === selectedUserForDetail.email);
                setSelectedUserTasks(refreshedUserTasks.sort((a, b) => a.week - b.week));
            }
            
            toast({
                title: "הצלחה",
                description: `משימה עודכנה ל"${newStatus}" בהצלחה.`,
            });
            
        } catch (error) {
            console.error('Error updating task status:', error);
            toast({
                title: "שגיאה",
                description: 'שגיאה בעדכון סטטוס המשימה. נסה שוב.',
                variant: "destructive",
            });
            
            // Re-load data in case of error to revert UI to actual state
            await loadData();
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-500" />
                    <p>טוען נתוני משימות...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            {feedback.message && (
                <Alert className={`text-end ${feedback.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <AlertTriangle className={`h-4 w-4 shrink-0 ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`} />
                    <AlertDescription className={feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                        {feedback.message}
                    </AlertDescription>
                </Alert>
            )}

            <Card className="muscle-glass border-0 shadow-lg text-end">
                <CardHeader className="text-end">
                    <CardTitle className="flex items-center gap-2 justify-start">
                        <Target className="w-5 h-5 text-purple-600 shrink-0" />
                        ניהול משימות שבועיות - תוכנית בוסטר
                    </CardTitle>
                    <CardDescription className="text-start w-full block">
                        ניהול מתקדם של משימות שבועיות עבור מתאמנים בתוכנית הבוסטר
                    </CardDescription>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 text-end">
                    <TabsTrigger value="assign" className="text-end">הקצאת משימות</TabsTrigger>
                    <TabsTrigger value="freeze-unfreeze-control" className="text-end">הקפאה והפשרה</TabsTrigger>
                    <TabsTrigger value="overview" className="text-end">סקירה נוכחית</TabsTrigger>
                </TabsList>

                <TabsContent value="assign" className="mt-6 space-y-6 text-end">
                    <Card className="muscle-glass border-0 shadow-lg text-end">
                        <CardContent className="space-y-6">
                            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                                <h4 className="font-semibold text-slate-700">בחירת יעד</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-end block">סוג יעד</Label>
                                        <Select value={targetType} onValueChange={setTargetType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="user">מתאמן ספציפי</SelectItem>
                                                <SelectItem value="group">קבוצה שלמה</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-end block title-rtl">בחר {targetType === 'user' ? 'מתאמן' : 'קבוצה'}</Label>
                                        {targetType === 'user' ? (
                                            <Select value={selectedUser} onValueChange={setSelectedUser}>
                                                <SelectTrigger className="text-end" dir="rtl">
                                                    <SelectValue placeholder="בחר מתאמן..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {users.filter(u => u.booster_unlocked).map(u => (
                                                        <SelectItem key={u.id} value={u.email}>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span>{u.name} ({u.email})</span>
                                                                <Badge variant="outline" className="ms-2">
                                                                    {getUserTasksStatus(u.email).percentage}%
                                                                </Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                                <SelectTrigger className="text-end" dir="rtl">
                                                    <SelectValue placeholder="בחר קבוצה..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {groups.map(g => (
                                                        <SelectItem key={g.id} value={g.name}>
                                                            {g.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>

                                {getTargetUsers().length > 0 && (
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-end">
                                        <h5 className="font-medium text-blue-800 mb-2">מתאמנים נבחרים ({getTargetUsers().length}):</h5>
                                        <div className="flex flex-wrap gap-2">
                                            {getTargetUsers().map(user => {
                                                const taskStatus = getUserTasksStatus(user.email);
                                                return (
                                                    <Badge key={user.id} variant="outline" className="bg-white">
                                                        {user.name} - {taskStatus.completed}/{taskStatus.total} משימות
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 p-4 border rounded-lg text-end" dir="rtl">
                                <h4 className="font-semibold flex items-center gap-2 justify-center title-rtl">
                                    <Calendar1 className="w-5 h-5 text-green-600 shrink-0" />
                                    קביעת תאריך התחלה חדש
                                (מגדיר תאריכי משימות לכל 12 השבועות)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label className="text-end block title-rtl">תאריך התחלה חדש</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-end text-end" dir="rtl">
                                                    <Calendar1 className="me-2 h-4 w-4 shrink-0" />
                                                    {format(newStartDate, 'dd/MM/yyyy')}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" dir="rtl" align="end">
                                                <Calendar
                                                    mode="single"
                                                    selected={newStartDate}
                                                    onSelect={setNewStartDate}
                                                    locale={he}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div>
                                        <Button
                                            onClick={handleSetStartDate}
                                            disabled={isProcessing || getTargetUsers().length === 0}
                                            className="w-full bg-green-600 hover:bg-green-700 justify-end"
                                            dir="rtl"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                                    מעדכן...
                                                </>
                                            ) : (
                                                <>
                                                    <Clock className="w-4 h-4 me-2" />
                                                    קבע תאריך התחלה
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Separator />

                    <div className="space-y-4 p-4 border rounded-lg text-end">
                        <h4 className="font-semibold flex items-center gap-2 justify-end">
                            <Power className="w-5 h-5 text-blue-600 shrink-0" />
                            הפעלה/ביטול משימות שבועיות
                        </h4>
                        <p className="text-sm text-slate-600">
                            מפעיל/מבטל את תוכנית הבוסטר עבור היעד הנבחר. הפעלה תיצור משימות חדשות מתבניות המשימות (לא מקוד מקובע) – וודא שיש תבניות בקטע ניהול בוסטר.
                        </p>
                        {taskTemplates.length === 0 && (
                            <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
                                אין תבניות משימות. הוסף תבניות בתוכניות → ניהול בוסטר → ניהול תבניות משימות בוסטר כדי להפעיל משימות.
                            </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                                onClick={() => handleTaskActivation(true)}
                                disabled={isProcessing || getTargetUsers().length === 0 || taskTemplates.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Play className="w-4 h-4" />
                                הפעל משימות שבועיות
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleTaskActivation(false)}
                                disabled={isProcessing || getTargetUsers().length === 0}
                                className="border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-2"
                            >
                                <Pause className="w-4 h-4" />
                                בטל משימות שבועיות
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4 p-4 border rounded-lg text-end">
                        <h4 className="font-semibold flex items-center gap-2 justify-end">
                            <Settings className="w-5 h-5 text-indigo-600 shrink-0" />
                            הקצאת שבועות ספציפיים
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-end block title-rtl">מתאמן</Label>
                                <Select value={selectedUserEmailForAssignment} onValueChange={setSelectedUserEmailForAssignment}>
                                    <SelectTrigger className="text-end" dir="rtl">
                                        <SelectValue placeholder="בחר מתאמן..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.filter(u => u.booster_unlocked).map(u => (
                                            <SelectItem key={u.id} value={u.email}>
                                                {u.name} ({u.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-end block">שבועות להקצאה</Label>
                                <div className="border rounded-lg p-4 bg-white max-h-64 overflow-y-auto">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (weeksToAssign.length === weekOptions.length) {
                                                    setWeeksToAssign([]);
                                                } else {
                                                    setWeeksToAssign(weekOptions.map(opt => opt.value));
                                                }
                                            }}
                                            className="h-8 text-xs"
                                        >
                                            {weeksToAssign.length === weekOptions.length ? (
                                                <>
                                                    <Square className="w-4 h-4 ms-1" />
                                                    בטל בחירת הכל
                                                </>
                                            ) : (
                                                <>
                                                    <CheckSquare className="w-4 h-4 ms-1" />
                                                    בחר הכל
                                                </>
                                            )}
                                        </Button>
                                        <span className="text-sm text-slate-600">
                                            נבחרו {weeksToAssign.length} מתוך {weekOptions.length}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {weekOptions.map(option => {
                                            const isChecked = weeksToAssign.includes(option.value);
                                            return (
                                                <label
                                                    key={option.value}
                                                    htmlFor={`week-${option.value}`}
                                                    className={`flex items-start gap-2 p-3 border-2 cursor-pointer transition-all`}
                                                    style={{
                                                        borderRadius: '8px',
                                                        ...(isChecked 
                                                            ? { backgroundColor: '#eff6ff', borderColor: '#3b82f6', color: '#1e40af' }
                                                            : { backgroundColor: '#ffffff', borderColor: '#e2e8f0' }
                                                        )
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!isChecked) {
                                                            e.currentTarget.style.borderColor = '#cbd5e1';
                                                            e.currentTarget.style.backgroundColor = '#f8fafc';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isChecked) {
                                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                                            e.currentTarget.style.backgroundColor = '#ffffff';
                                                        }
                                                    }}
                                                >
                                                    <Checkbox
                                                        id={`week-${option.value}`}
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => {
                                                            if (checked === true) {
                                                                setWeeksToAssign(prev => {
                                                                    if (!prev.includes(option.value)) {
                                                                        return [...prev, option.value].sort((a, b) => a - b);
                                                                    }
                                                                    return prev;
                                                                });
                                                            } else {
                                                                setWeeksToAssign(prev => prev.filter(w => w !== option.value));
                                                            }
                                                        }}
                                                        className="cursor-pointer mt-0.5 flex-shrink-0"
                                                    />
                                                    <span className="text-sm font-medium select-none leading-tight">
                                                        {option.label}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-end block">היסט (שבועות)</Label>
                                <Input
                                    type="number"
                                    placeholder="אופסט בשבועות"
                                    value={weekOffset}
                                    onChange={(e) => setWeekOffset(Number(e.target.value))}
                                    className="text-end"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <Button
                                onClick={handleAssignTasks}
                                disabled={isProcessing || !selectedUserEmailForAssignment || weeksToAssign.length === 0}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                        מקצה...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 me-2" />
                                        הקצה שבועות למתאמן
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleApplyTemplateToAll}
                                disabled={isProcessing || weeksToAssign.length === 0}
                                className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                        {bulkAssignStatus || 'מקצה לכולם...'}
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-4 h-4" />
                                        הקצה שבועות לכל המתאמנים הפעילים
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4 p-4 border border-orange-300 bg-orange-50 rounded-lg text-end">
                        <h4 className="font-semibold flex items-center gap-2 text-orange-700 justify-end">
                            <RotateCcw className="w-5 h-5 shrink-0" />
                            איפוס מלא של משימות שבועיות
                        </h4>
                        <p className="text-orange-600 text-sm">
                            זהירות: פעולה זו תאפס את כל משימות הבוסטר למצב ההתחלתי עבור היעד הנבחר.
                        </p>
                        <div>
                            <Button
                                variant="destructive"
                                onClick={handleResetTasks}
                                disabled={isProcessing || getTargetUsers().length === 0}
                                className="w-full flex items-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        מאפס...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCcw className="w-4 h-4" />
                                        אפס את כל המשימות
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {getTargetUsers().length > 0 && (
                        <>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 justify-end">
                                    <CheckCircle2 className="w-5 h-5 text-purple-600" />
                                    סקירת משימות נוכחית (יעד נבחר)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {getTargetUsers().map(user => {
                                        const taskStatus = getUserTasksStatus(user.email);
                                        const userInfo = users.find(u => u.email === user.email);
                                        return (
                                            <Card key={user.id} className="border">
                                                <CardContent className="p-4">
                                                    <div className="space-y-2">
                                                        <h5 className="font-semibold text-slate-800">{user.name}</h5>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-slate-600">משימות הושלמו:</span>
                                                            <Badge variant="outline">
                                                                {taskStatus.completed}/{taskStatus.total} משימות
                                                            </Badge>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                                                style={{ width: `${taskStatus.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-500">התקדמות</span>
                                                            <span className="font-semibold">{taskStatus.percentage}%</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${
                                                                userInfo?.booster_enabled ? 'bg-green-500' : 'bg-red-500'
                                                            }`}></div>
                                                            <span className="text-xs text-slate-600">
                                                                {userInfo?.booster_enabled ? 'משימות פעילות' : 'משימות מבוטלות'}
                                                            </span>
                                                        </div>
                                                        {taskStatus.frozen > 0 && (
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                                                <Shield className="w-3 h-3 ms-1" />
                                                                {taskStatus.frozen} משימות מוקפאות
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </TabsContent>

                {/* New Freeze/Unfreeze Control Tab Content */}
                <TabsContent value="freeze-unfreeze-control" className="mt-6 space-y-6" dir="rtl">
                    <Card className="muscle-glass border-0 shadow-lg text-end">
                        <CardHeader className="text-end" dir="rtl">
                            <CardTitle className="flex items-center gap-2 justify-center title-rtl">
                                <Shield className="w-5 h-5 text-teal-600 shrink-0" />
                                ניהול הקפאה והפשרת משימות
                            </CardTitle>
                            <CardDescription className="text-end desc-rtl">
                                הקפאת משימות תסמן אותן כמוקפאות ותמנע מהן להופיע כפעילות למתאמן. הפשרה תעדכן את תאריכי המשימות בהתאם לתאריך ההתחלה החדש.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Unfreeze Section */}
                            <div className="space-y-4 p-4 border border-green-300 bg-green-50 rounded-lg text-end" dir="rtl">
                                <h4 className="font-semibold flex items-center gap-2 text-green-700 justify-center title-rtl">
                                    <Play className="w-5 h-5 shrink-0" />
                                    הפשרת משימות (הפעלה מחדש)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-end block title-rtl">בחר מתאמן</Label>
                                        <Popover open={openUnfreezeUserSelector} onOpenChange={setOpenUnfreezeUserSelector}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openUnfreezeUserSelector}
                                                    className="w-full justify-between text-end"
                                                    disabled={isUnfreezingOperation || isFreezingOperation}
                                                    dir="rtl"
                                                >
                                                    {selectedUserObjectForUnfreeze
                                                        ? selectedUserObjectForUnfreeze.name
                                                        : "בחר משתמש..."}
                                                    <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 text-end" align="end" dir="rtl">
                                                <Command>
                                                    <CommandInput placeholder="חיפוש משתמש..." className="text-end" />
                                                    <CommandList>
                                                        <CommandEmpty className="text-end">לא נמצא משתמש.</CommandEmpty>
                                                        <CommandGroup className="text-end">
                                                            {usersWithBoosterEnabled.map((user) => (
                                                                <CommandItem
                                                                    key={user.email}
                                                                    value={`${user.name} ${user.email}`}
                                                                    onSelect={() => {
                                                                        setSelectedUserObjectForUnfreeze(user);
                                                                        setOpenUnfreezeUserSelector(false);
                                                                    }}
                                                                    className="text-end justify-end"
                                                                >
                                                                    <Check
                                                                        className={`me-2 h-4 w-4 shrink-0 ${selectedUserObjectForUnfreeze?.email === user.email ? "opacity-100" : "opacity-0"}`}
                                                                    />
                                                                    {user.name} ({user.email})
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div>
                                        <Label className="text-end block title-rtl">תאריך התחלה להפשרה (תאריכים יחושבו מחדש)</Label>
                                        <Input
                                            type="date"
                                            value={unfreezeStartDateInput}
                                            onChange={(e) => setUnfreezeStartDateInput(e.target.value)}
                                            disabled={isUnfreezingOperation || isFreezingOperation}
                                            className="text-end"
                                            dir="rtl"
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleUnfreezeTasks(selectedUserObjectForUnfreeze, unfreezeStartDateInput)}
                                    disabled={isUnfreezingOperation || isFreezingOperation || !selectedUserObjectForUnfreeze || !unfreezeStartDateInput}
                                    className="w-full bg-green-600 hover:bg-green-700 flex items-center gap-2 justify-center"
                                    dir="rtl"
                                >
                                    {isUnfreezingOperation ? (
                                        <>
                                            <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                            מפשיר...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 me-2" />
                                            הפשר משימות
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Freeze Section */}
                            <div className="space-y-4 p-4 border border-orange-300 bg-orange-50 rounded-lg text-end" dir="rtl">
                                <h4 className="font-semibold flex items-center gap-2 text-orange-700 justify-center title-rtl">
                                    <Pause className="w-5 h-5 shrink-0" />
                                    הקפאת משימות
                                </h4>
                                <div>
                                    <Label className="text-end block title-rtl">בחר מתאמן</Label>
                                    <Popover open={openFreezeUserSelector} onOpenChange={setOpenFreezeUserSelector}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openFreezeUserSelector}
                                                className="w-full justify-between text-end"
                                                disabled={isFreezingOperation || isUnfreezingOperation}
                                                dir="rtl"
                                            >
                                                {selectedUserObjectForFreeze
                                                    ? selectedUserObjectForFreeze.name
                                                    : "בחר משתמש..."}
                                                <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 text-end" align="end" dir="rtl">
                                            <Command>
                                                <CommandInput placeholder="חיפוש משתמש..." className="text-end" />
                                                <CommandList>
                                                    <CommandEmpty className="text-end">לא נמצא משתמש.</CommandEmpty>
                                                    <CommandGroup className="text-end">
                                                        {usersWithBoosterEnabled.map((user) => (
                                                            <CommandItem
                                                                key={user.email}
                                                                value={`${user.name} ${user.email}`}
                                                                onSelect={() => {
                                                                    setSelectedUserObjectForFreeze(user);
                                                                    setOpenFreezeUserSelector(false);
                                                                }}
                                                                className="text-end justify-end"
                                                            >
                                                                <Check
                                                                    className={`me-2 h-4 w-4 shrink-0 ${selectedUserObjectForFreeze?.email === user.email ? "opacity-100" : "opacity-0"}`}
                                                                />
                                                                {user.name} ({user.email})
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            variant="destructive" 
                                            className="w-full flex items-center gap-2 justify-center"
                                            disabled={isFreezingOperation || isUnfreezingOperation || !selectedUserObjectForFreeze}
                                            dir="rtl"
                                        >
                                            {isFreezingOperation ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                                    מקפיא...
                                                </>
                                            ) : (
                                                <>
                                                    <Pause className="w-4 h-4 me-2" />
                                                    הקפא משימות
                                                </>
                                            )}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent dir="rtl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>אישור הקפאת משימות</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                פעולה זו תקפיא את כל המשימות העתידיות של {selectedUserObjectForFreeze?.name}. המשימות יוסתרו מהמשתמש עד להפעלה מחדש. האם להמשיך?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isFreezingOperation}>ביטול</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleFreezeTasks(selectedUserObjectForFreeze)} disabled={isFreezingOperation}>
                                                {isFreezingOperation ? "מקפיא..." : "הקפא"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>


                <TabsContent value="overview" className="mt-6">
                    <div className="space-y-4" dir="rtl">
                        <Card className="muscle-glass border-0 shadow-lg text-end">
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 justify-center title-rtl">
                                    <BarChart className="w-5 h-5 text-blue-600 shrink-0" />
                                    סיכום כללי - מתאמנים בבוסטר
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="text-center bg-blue-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {getUsersWithTaskStats.length}
                                        </div>
                                        <div className="text-sm text-blue-700">מתאמנים פעילים</div>
                                    </div>
                                    <div className="text-center bg-green-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-green-600">
                                            {getUsersWithTaskStats.reduce((sum, user) => sum + user.taskStats.completed, 0)}
                                        </div>
                                        <div className="text-sm text-green-700">משימות הושלמו</div>
                                    </div>
                                    <div className="text-center bg-orange-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-orange-600">
                                            {getUsersWithTaskStats.reduce((sum, user) => sum + user.taskStats.inProgress, 0)}
                                        </div>
                                        <div className="text-sm text-orange-700">משימות בעבודה</div>
                                    </div>
                                    <div className="text-center bg-slate-50 rounded-lg p-4">
                                        <div className="text-2xl font-bold text-slate-600">
                                            {getUsersWithTaskStats.reduce((sum, user) => sum + user.taskStats.total, 0)}
                                        </div>
                                        <div className="text-sm text-slate-700">סה"כ משימות פעילות</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getUsersWithTaskStats.length > 0 ? (
                                getUsersWithTaskStats.map(user => (
                                    <Card 
                                        key={user.email} 
                                        className="cursor-pointer hover:shadow-lg transition-all duration-200 muscle-glass border-s-4"
                                        style={{
                                            borderInlineStartWidth: '4px',
                                            borderInlineStartColor: user.taskStats.completionPercentage >= 75 ? '#22c55e' :
                                                           user.taskStats.completionPercentage >= 50 ? '#f59e0b' :
                                                           user.taskStats.completionPercentage >= 25 ? '#ef4444' : '#64748b'
                                        }}
                                        onClick={() => handleUserTasksView(user)}
                                    >
                                        <CardHeader className="pb-4 text-end">
                                            <div className="flex items-center gap-3 flex-row-reverse">
                                                <div className="flex-1 text-end min-w-0">
                                                    <CardTitle className="text-lg">{user.name}</CardTitle>
                                                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                                                </div>
                                                {user.profile_image_url ? (
                                                    <img 
                                                        src={user.profile_image_url} 
                                                        alt={user.name} 
                                                        className="w-10 h-10 rounded-full object-cover shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                                        <UserIcon className="w-5 h-5 text-slate-500" />
                                                    </div>
                                                )}
                                                <Badge 
                                                    className={
                                                        user.taskStats.completionPercentage >= 75 ? 'bg-green-100 text-green-800' :
                                                        user.taskStats.completionPercentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                                        user.taskStats.completionPercentage >= 25 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                                                    }
                                                >
                                                    {user.taskStats.completionPercentage}%
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span>משימות פעילות:</span>
                                                    <Badge variant="outline">{user.taskStats.total}</Badge>
                                                </div>
                                                
                                                {user.taskStats.total > 0 && (
                                                    <>
                                                        <div className="grid grid-cols-4 gap-2 text-xs">
                                                            <div className="text-center">
                                                                <div className="font-semibold text-green-600">{user.taskStats.completed}</div>
                                                                <div className="text-slate-500">הושלמו</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="font-semibold text-orange-600">{user.taskStats.inProgress}</div>
                                                                <div className="text-slate-500">בעבודה</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="font-semibold text-slate-600">{user.taskStats.notStarted}</div>
                                                                <div className="text-slate-500">לא בוצע</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="font-semibold text-blue-600">{user.taskStats.frozen}</div>
                                                                <div className="text-slate-500">מוקפאות</div>
                                                            </div>
                                                        </div>
                                                        
                                                        <Progress 
                                                            value={user.taskStats.completionPercentage} 
                                                            className="h-2"
                                                        />
                                                        
                                                        <div className="text-xs text-slate-500 text-center">
                                                            {user.taskStats.completed} מתוך {user.taskStats.total} משימות פעילות הושלמו
                                                        </div>
                                                    </>
                                                )}
                                                
                                                {user.taskStats.total === 0 && (
                                                    <p className="text-sm text-slate-500 text-center py-2">
                                                        אין משימות פעילות
                                                        {user.taskStats.frozen > 0 && ` (${user.taskStats.frozen} משימות מוקפאות)`}
                                                    </p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <div className="col-span-full text-center py-8">
                                    <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600">אין מתאמנים עם תוכנית בוסטר פעילה.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserIcon className="w-5 h-5" />
                            משימות של {selectedUserForDetail?.name}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[70vh] pe-4">
                        <div className="space-y-4">
                            {selectedUserTasks.length > 0 ? (
                                selectedUserTasks.map(task => (
                                    <Card key={task.id} className={`border-2 ${task.is_frozen ? 'border-blue-300 bg-blue-50' : ''}`}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">
                                                    <span className="text-blue-600">🔵</span> שבוע {task.week} – {task.title}
                                                    {task.is_frozen && <Badge className="me-2 bg-blue-400 text-white">מוקפא</Badge>}
                                                </CardTitle>
                                                {!task.is_frozen && ( // Only allow status change if not frozen
                                                    <div className="flex items-center gap-2">
                                                        <Badge 
                                                            className={
                                                                task.status === 'הושלם' ? 'bg-green-100 text-green-800' :
                                                                task.status === 'בעבודה' ? 'bg-orange-100 text-orange-800' :
                                                                'bg-slate-100 text-slate-600'
                                                            }
                                                        >
                                                            {task.status}
                                                        </Badge>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => updateTaskStatus(
                                                                task.id, 
                                                                task.status === 'הושלם' ? 'לא בוצע' : 'הושלם'
                                                            )}
                                                            disabled={isProcessing}
                                                            className={
                                                                task.status === 'הושלם' 
                                                                    ? 'text-red-600 hover:text-red-700' 
                                                                    : 'text-green-600 hover:text-green-700'
                                                            }
                                                        >
                                                            {isProcessing && <Loader2 className="w-4 h-4 ms-1 animate-spin" />}
                                                            {task.status === 'הושלם' ? (
                                                                <>
                                                                    <XCircle className="w-4 h-4 ms-1" />
                                                                    ביטול השלמה
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="w-4 h-4 ms-1" />
                                                                    סמן כהושלם
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                )}
                                                {task.is_frozen && (
                                                    <span className="text-sm text-blue-600">פעולות מושבתות (מוקפא)</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                תאריכי שבוע: {format(parseISO(task.week_start_date), 'dd/MM/yyyy', { locale: he })} - {format(parseISO(task.week_end_date), 'dd/MM/yyyy', { locale: he })}
                                            </p>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className={`rounded-lg p-3 ${task.is_frozen ? 'bg-blue-100' : 'bg-blue-50'}`}>
                                                <div className="font-semibold text-blue-800 mb-1">🎯 המשימה:</div>
                                                <div className="text-blue-900 text-sm whitespace-pre-line">
                                                    {task.mission_text}
                                                </div>
                                            </div>
                                            
                                            {task.notes_thread && task.notes_thread.length > 0 && (
                                                <div className="bg-slate-50 rounded-lg p-3">
                                                    <div className="font-semibold text-slate-700 mb-2 flex items-center gap-1">
                                                        <MessageSquare className="w-4 h-4" />
                                                        הערות מהמתאמן:
                                                    </div>
                                                    <div className="space-y-2">
                                                        {task.notes_thread.map((note, index) => (
                                                            <div key={index} className="bg-white rounded p-2 text-sm">
                                                                <div className="text-slate-700">{note.text}</div>
                                                                <div className="text-xs text-slate-400 mt-1">
                                                                    {format(parseISO(note.timestamp), 'dd/MM/yyyy HH:mm', { locale: he })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600">אין משימות למתאמן זה.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                            סגור
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

