
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserGroup, WeeklyTask, BoosterPlusTask, MonthlyGoal, GeneratedReport, CoachMessage, WeightEntry, PreMadeWorkout, AdminMessage } from '@/api/entities';
import { SendFCMNotification } from '@/api/integrations';
import { GroupEvent } from '@/api/entities';
import { useAdminDashboard } from '@/contexts/AdminDashboardContext';
import { groupsForStaff } from '@/lib/groupUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Users,
    UserPlus,
    PauseCircle,
    FolderKanban,
    Calendar,
    TrendingUp,
    MessageSquare,
    CheckSquare,
    Send,
    Loader2,
    ChevronDown,
    Settings,
    Weight,
    UserCog,
    UtensilsCrossed,
    ListChecks,
    Users2,
    Filter,
    Target, // Added Target icon
} from 'lucide-react';
import { isWithinInterval, parseISO, startOfDay, endOfDay, isAfter, isFuture, isToday, isBefore, format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, formatTime } from '@/components/utils/timeUtils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import InviteLinkCard from '@/components/admin/InviteLinkCard';

const StatCard = ({ title, value, icon: Icon, description }) => (
    <Card dir="rtl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 sm:px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-4">
            <div className="text-xl sm:text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground truncate desc-rtl">{description}</p>
        </CardContent>
    </Card>
);

const QuickActionCard = ({ title, icon: Icon, color, onClick, description }) => (
    <Button
        variant="outline"
        className={`h-20 sm:h-24 flex flex-col items-center justify-center gap-1 text-center p-1 border-2 transition-all duration-200 hover:scale-105 hover:shadow-md ${color} w-full`}
        onClick={onClick}
        dir="rtl"
    >
        <Icon className="w-5 h-5" />
        <div className="title-rtl desc-rtl">
            <div className="font-semibold text-xs leading-tight">{title}</div>
            {description && <div className="text-xs opacity-70 mt-1 hidden sm:block">{description}</div>}
        </div>
    </Button>
);

export default function ControlCenter({ onNavigateToTab }) {
    const { user: currentUser, isSystemAdmin } = useAdminDashboard();
    const [stats, setStats] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [allGroups, setAllGroups] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [allEvents, setAllEvents] = useState([]);
    const [notifications, setNotifications] = useState([]);

    const [isLoading, setIsLoading] = useState(true);

    const [isMessengerExpanded, setIsMessengerExpanded] = useState(false);
    const [isWeeklyTasksExpanded, setIsWeeklyTasksExpanded] = useState(false);
    const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
    const [messageTarget, setMessageTarget] = useState('all');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState('');

    // State for Group Task Progress
    const [selectedTaskGroup, setSelectedTaskGroup] = useState('');
    const [groupUsers, setGroupUsers] = useState([]);
    const [userTasksData, setUserTasksData] = useState([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [expandedUserId, setExpandedUserId] = useState(null); // NEW
    const [currentGroupTask, setCurrentGroupTask] = useState(null); // NEW

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogContent, setDialogContent] = useState({ title: '', items: [], type: 'users' });

    // State for Status Dialog
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [selectedStatusUsers, setSelectedStatusUsers] = useState([]);
    const [selectedStatusTitle, setSelectedStatusTitle] = useState('');

    const messageTemplates = [
        { id: 'welcome', title: 'ברוך הבא', content: 'שלום {userName}, ברוך הבא למשפחת Vitrix! אנחנו שמחים שהצטרפת אלינו.' },
        { id: 'reminder', title: 'תזכורת ידידותית', content: 'היי {userName}, רק רציתי להזכיר לך לעדכן את המשקל שלך השבוע. בהצלחה!' },
        { id: 'birthday', title: 'יום הולדת שמח', content: 'מזל טוב ליום הולדתך, {userName}! מאחלים לך שנה של בריאות, כושר והגשמת מטרות!' }
    ];

    const traineeUsers = useMemo(() => allUsers.filter(u => u.role !== 'admin'), [allUsers]);

    // Filter groups that have at least one user with booster program
    const groupsWithBoosterUsers = useMemo(() => {
        if (!allGroups || !allUsers) return [];
        
        return allGroups
            .filter(g => g.status === 'Active' && g.name !== 'מנהלה') // Ensure group is active and not 'מנהלה'
            .filter(group => {
                // Check if this group has at least one user with booster enabled
                const hasBoosterUsers = allUsers.some(user => 
                    user.group_names?.includes(group.name) && 
                    (user.booster_enabled || user.booster_plus_enabled)
                );
                return hasBoosterUsers;
            });
    }, [allGroups, allUsers]);

    const handleTemplateChange = (templateId) => {
        const template = messageTemplates.find(t => t.id === templateId);
        if (template) {
            let content = template.content;

            if (messageTarget === 'user' && selectedUser) {
                const targetUser = allUsers.find(u => u.email === selectedUser);
                if (targetUser) {
                    content = content.replace(/{userName}/g, targetUser.name);
                }
            } else if (messageTarget === 'group' || messageTarget === 'all') {
                content = content.replace(/{userName}/g, 'חבר/ה יקר/ה');
            }

            setMessageContent(content);
            setSelectedTemplate(templateId);
        } else {
            setMessageContent('');
            setSelectedTemplate('');
        }
    };

    const handleTargetChangeWithTemplate = (value) => {
        setMessageTarget(value);
        setSelectedGroup('');
        setSelectedUser('');

        if (selectedTemplate) {
            const template = messageTemplates.find(t => t.id === selectedTemplate);
            if (template) {
                let content = template.content;
                if (value === 'all' || value === 'group') {
                    content = content.replace(/{userName}/g, 'חבר/ה יקר/ה');
                }
                setMessageContent(content);
            }
        }
    };

    const handleUserChange = (userEmail) => {
        setSelectedUser(userEmail);

        if (selectedTemplate) {
            const template = messageTemplates.find(t => t.id === selectedTemplate);
            const targetUser = allUsers.find(u => u.email === userEmail);
            if (template && targetUser) {
                const content = template.content.replace(/{userName}/g, targetUser.name);
                setMessageContent(content);
            } else if (template) {
                setMessageContent(template.content);
            }
        }
    };

    const handleGroupChange = (groupName) => {
        setSelectedGroup(groupName);

        if (selectedTemplate) {
            const template = messageTemplates.find(t => t.id === selectedTemplate);
            if (template) {
                const content = template.content.replace(/{userName}/g, 'חבר/ה יקר/ה');
                setMessageContent(content);
            }
        }
    };

    const handleSendMessage = async () => {
        if (!messageContent.trim()) return;

        setIsSending(true);
        setSendSuccess('');

        try {
            const messageData = {
                message_title: selectedTemplate ? messageTemplates.find(t => t.id === selectedTemplate)?.title || 'הודעה מהמנהל' : 'הודעה מהמנהל',
                message_content: messageContent,
                target_type: messageTarget === 'all' ? 'all_users' : messageTarget === 'group' ? 'specific_group' : 'specific_user',
                sent_by: 'admin@vitrix.com',
                sent_date: new Date().toISOString(),
                template_used: selectedTemplate || null
            };

            if (messageTarget === 'group') {
                messageData.target_group = selectedGroup;
            } else if (messageTarget === 'user') {
                messageData.target_user_email = selectedUser;
            }

            let readReceipts = [];
            if (messageTarget === 'all') {
                readReceipts = allUsers.map(user => ({
                    user_email: user.email,
                    user_name: user.name,
                    is_read: false
                }));
            } else if (messageTarget === 'group' && selectedGroup) {
                const targetGroupUsers = allUsers.filter(user =>
                    user.group_names && user.group_names.includes(selectedGroup)
                );
                readReceipts = targetGroupUsers.map(user => ({
                    user_email: user.email,
                    user_name: user.name,
                    is_read: false
                }));
            } else if (messageTarget === 'user' && selectedUser) {
                const targetUser = allUsers.find(u => u.email === selectedUser);
                if (targetUser) {
                    readReceipts = [{
                        user_email: targetUser.email,
                        user_name: targetUser.name,
                        is_read: false
                    }];
                }
            }

            messageData.read_receipts = readReceipts;

            await AdminMessage.create(messageData);

            // Send push notifications and emails to each recipient (like booster allow)
            const title = messageData.message_title || 'הודעה מהמנהל';
            const shortBody = (messageData.message_content || '').length > 80
                ? messageData.message_content.slice(0, 77) + '...'
                : (messageData.message_content || '');
            const emailMessage = messageData.message_content || '';
            for (const receipt of readReceipts) {
                const email = receipt.user_email;
                if (!email) continue;
                try {
                    await SendFCMNotification({
                        userEmail: email,
                        title,
                        body: shortBody,
                        data: { type: 'admin_message', user_email: email },
                    });
                } catch (fcmErr) {
                    console.warn('FCM push failed for', email, fcmErr);
                }
                try {
                    const emailRes = await fetch('/api/send-group-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userEmail: email,
                            title,
                            message: emailMessage,
                        }),
                    });
                    const emailData = await emailRes.json().catch(() => ({}));
                    if (emailData.success !== true || (emailData.successCount === 0 && emailData.failureCount > 0)) {
                        console.warn('Email failed for', email, emailData.error || emailData);
                    }
                } catch (emailErr) {
                    console.warn('Email send failed for', email, emailErr);
                }
            }

            setSendSuccess('ההודעה נשלחה בהצלחה!');
            setMessageContent('');
            setSelectedTemplate('');
            setSelectedGroup('');
            setSelectedUser('');

            setTimeout(() => setSendSuccess(''), 4000);
        } catch (error) {
            console.error('Error sending message:', error);
            setSendSuccess('שגיאה בשליחת ההודעה. אנא נסה שוב.');
        } finally {
            setIsSending(false);
        }
    };

    const userStats = useMemo(() => {
        if (!traineeUsers || !allGroups) return { active: 0, inactive: 0, newToAssign: 0, total: 0, groups: 0 };
        return {
            active: traineeUsers.filter(u => u.status === 'פעיל').length,
            inactive: traineeUsers.filter(u => ['מוקפא', 'הסתיים', 'לא פעיל'].includes(u.status)).length,
            newToAssign: traineeUsers.filter(u => !u.group_names || u.group_names.length === 0).length,
            total: traineeUsers.length,
            groups: allGroups.filter(g => g.status === 'Active').length,
        };
    }, [traineeUsers, allGroups]);


    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                const [usersData, groupsData, tasksData, eventsData, notificationsData] = await Promise.all([
                    User.listForStaff(currentUser),
                    UserGroup.list(),
                    WeeklyTask.list('-week_start_date'),
                    GroupEvent.list('start_datetime'),
                    AdminMessage.filter({ is_read: false }, '-created_date', 10),
                ]);

                setAllUsers(usersData || []);
                const myGroups = groupsForStaff(groupsData || [], currentUser, isSystemAdmin);
                setAllGroups(myGroups);

                const filteredGroups = myGroups.filter(group => group.name !== 'מנהלה');
                const usersForStatsAndProgress = (usersData || []).filter(user =>
                    user.role !== 'admin' && user.role !== 'trainer' && (!user.group_names?.includes('מנהלה'))
                );
                setFilteredUsers(usersForStatsAndProgress);

                setAllEvents(eventsData || []);
                setNotifications(notificationsData || []);

                const totalGroups = filteredGroups.length;

                const today = new Date();
                const twoWeeksAgo = new Date(today);
                twoWeeksAgo.setDate(today.getDate() - 14);

                const groupProgress = filteredGroups.map(group => {
                    const groupActiveUsers = usersForStatsAndProgress.filter(u => u.group_names?.includes(group.name) && u.status === 'פעיל');

                    if (groupActiveUsers.length === 0) {
                        return null;
                    }

                    const groupUserEmails = groupActiveUsers.map(u => u.email);
                    const allGroupTasks = tasksData.filter(t => groupUserEmails.includes(t.user_email));

                    const now = new Date();
                    let totalActiveTasksInGroup = 0;
                    allGroupTasks.forEach(task => {
                        const isFutureTask = task.week_start_date && isBefore(now, parseISO(task.week_start_date));
                        if (!isFutureTask && task.status !== 'הושלם' && !task.is_frozen) {
                            totalActiveTasksInGroup++;
                        }
                    });

                    const completedTasks = allGroupTasks.filter(t => t.status === 'הושלם');
                    const maxCompletedWeek = completedTasks.reduce((max, task) => Math.max(max, task.week || 0), 0);

                    let isGroupRecentlyCompleted = false;
                    let lastCompletionDateString = 'לא זמין';

                    if (maxCompletedWeek >= 12) {
                        const week12Tasks = completedTasks.filter(t => t.week === 12 && t.completion_date);
                        const lastCompletionDate = week12Tasks.reduce((latest, task) => {
                            try {
                                const taskDate = parseISO(task.completion_date);
                                return !latest || taskDate > latest ? taskDate : latest;
                            } catch (e) { return latest; }
                        }, null);

                        if (lastCompletionDate) {
                            lastCompletionDateString = lastCompletionDate.toLocaleDateString('he-IL');
                            if (!isAfter(twoWeeksAgo, lastCompletionDate)) {
                                isGroupRecentlyCompleted = true;
                            }
                        }
                    }

                    if (!isGroupRecentlyCompleted && totalActiveTasksInGroup === 0) {
                        return null;
                    }

                    if (isGroupRecentlyCompleted) {
                        return {
                            name: group.name,
                            total: groupActiveUsers.length,
                            isProgramCompleted: true,
                            lastCompletionDate: lastCompletionDateString
                        };
                    }

                    const currentTasksForGroup = allGroupTasks.filter(task => {
                        try {
                            const startDate = startOfDay(parseISO(task.week_start_date));
                            const endDate = endOfDay(parseISO(task.week_end_date));
                            return isWithinInterval(today, { start: startDate, end: endDate });
                        } catch (e) { return false; }
                    });

                    const tasksByEmailForCurrentWeek = currentTasksForGroup.reduce((acc, task) => {
                        acc[task.user_email] = task;
                        return acc;
                    }, {});

                    let completed = 0;
                    let in_progress = 0;
                    let groupCurrentTask = null;

                    const firstUserWithTask = groupActiveUsers.find(u => tasksByEmailForCurrentWeek[u.email]);
                    if (firstUserWithTask) {
                        groupCurrentTask = tasksByEmailForCurrentWeek[firstUserWithTask.email];
                    }

                    groupActiveUsers.forEach(user => {
                        const task = tasksByEmailForCurrentWeek[user.email];
                        if (task) {
                            if (task.status === 'הושלם') {
                                completed++;
                            } else if (task.status === 'בעבודה') {
                                in_progress++;
                            }
                        }
                    });

                    const not_started = groupActiveUsers.length - completed - in_progress;
                    const completionRate = groupActiveUsers.length > 0 ? Math.round((completed / groupActiveUsers.length) * 100) : 0;

                    return { name: group.name, total: groupActiveUsers.length, completed, in_progress, not_started, completionRate, currentTask: groupCurrentTask, isProgramCompleted: false };
                }).filter(Boolean);

                setStats({
                    totalGroups,
                    groupProgress,
                });

            } catch (error) {
                console.error("Failed to load control center data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [currentUser]);

    const upcomingEvents = useMemo(() => {
        if (!allEvents) return [];

        const uniqueEvents = Array.from(new Map(allEvents.map(event => [event.id, event])).values());

        return uniqueEvents
            .filter(event => {
                try {
                    const eventDate = parseISO(event.start_datetime);
                    return isFuture(eventDate) || isToday(eventDate);
                } catch {
                    return false;
                }
            })
            .sort((a, b) => parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime())
            .slice(0, 5);
    }, [allEvents]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'הושלם':
                return 'text-green-600 bg-green-100';
            case 'בעבודה':
                return 'text-yellow-600 bg-yellow-100';
            case 'לא החל':
                return 'text-gray-600 bg-gray-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const openDialog = (type, title, items) => {
        setDialogContent({ type, title, items });
        setIsDialogOpen(true);
    };

    const handleUserClick = (userEmail) => {
        setIsDialogOpen(false);
        setStatusDialogOpen(false); // Close status dialog if it's open
        if (onNavigateToTab) {
            onNavigateToTab('user-management', 'user-list', { userEmail: userEmail, startInEditMode: true });
        }
    };

    const quickActions = [
        {
            title: "ניהול מתאמנים",
            icon: Users,
            color: "border-blue-200 hover:border-blue-300 hover:bg-blue-50 text-blue-700",
            description: "הוספה, עריכה ומחיקה",
            onClick: () => onNavigateToTab && onNavigateToTab('user-management', 'user-list')
        },
        {
            title: "ניהול קבוצות",
            icon: Users2,
            color: "border-green-200 hover:border-green-300 hover:bg-green-50 text-green-700",
            description: "יצירה ועריכת קבוצות",
            onClick: () => onNavigateToTab && onNavigateToTab('user-management', 'groups')
        },
        {
            title: "עדכון משקל",
            icon: Weight,
            color: "border-purple-200 hover:border-purple-300 hover:bg-purple-50 text-purple-700",
            description: "עדכון נתוני משקל ומדדים",
            onClick: () => onNavigateToTab && onNavigateToTab('user-management', 'weight-update')
        },
        {
            title: "ניהול תפריטים",
            icon: UtensilsCrossed,
            color: "border-yellow-200 hover:border-yellow-300 hover:bg-yellow-50 text-yellow-700",
            description: "העלאת תפריטים אישיים",
            onClick: () => onNavigateToTab && onNavigateToTab('programs', 'menu-management')
        },
        {
            title: "הגדרות משתמש",
            icon: UserCog,
            color: "border-orange-200 hover:border-orange-300 hover:bg-orange-50 text-orange-700",
            description: "הגדרות וטיפול במשתמשים",
            onClick: () => onNavigateToTab && onNavigateToTab('user-management', 'user-list')
        }
    ];

    // Added new function
    const toggleUserExpanded = (userId) => {
        setExpandedUserId(prev => prev === userId ? null : userId);
    };

    const loadGroupTaskProgress = async (groupName) => {
        if (!groupName) {
            setUserTasksData([]);
            setGroupUsers([]);
            setCurrentGroupTask(null);
            return;
        }
        
        setIsLoadingTasks(true);
        setExpandedUserId(null); // Reset expanded user when changing group
        setCurrentGroupTask(null);
        
        try {
            // Use already-loaded scoped users and filter by group
            const users = (allUsers || []).filter(u => Array.isArray(u.group_names) && u.group_names.includes(groupName));
            const traineeUsersInGroup = users.filter(u => u.role !== 'admin' && u.role !== 'trainer');
            setGroupUsers(traineeUsersInGroup); // Store all users for potential future use or display

            const now = new Date();

            const tasksDataPromises = traineeUsersInGroup.map(async (user) => {
                let tasks = [];
                let programType = 'none';

                // Determine program type and fetch tasks
                if (user.booster_plus_enabled) {
                    programType = 'booster_plus';
                    tasks = await BoosterPlusTask.filter({ user_email: user.email });
                } else if (user.booster_enabled) {
                    programType = 'booster';
                    tasks = await WeeklyTask.filter({ user_email: user.email });
                }

                // Filter out frozen tasks
                const activeTasks = tasks.filter(task => !task.is_frozen);

                // Filter for relevant tasks (past or current week)
                const relevantTasks = activeTasks.filter(task => {
                    try {
                        const startDate = parseISO(task.week_start_date);
                        // Include tasks that started in the past or are today
                        return isBefore(startDate, now) || isToday(startDate);
                    } catch (error) {
                        console.warn(`Error parsing date for task ${task.id} (user: ${user.email}):`, task.week_start_date, error);
                        return false;
                    }
                });

                // Find the current week's task
                const currentTask = relevantTasks.find(task => {
                    try {
                        const startDate = parseISO(task.week_start_date);
                        const endDate = parseISO(task.week_end_date);
                        return isWithinInterval(now, { start: startDate, end: endDate });
                    } catch (error) {
                        console.warn(`Error parsing date for current task ${task.id} (user: ${user.email}):`, task.week_start_date, task.week_end_date, error);
                        return false;
                    }
                });

                // Prepare recent tasks (current and last completed/past)
                const sortedTasks = [...relevantTasks].sort((a, b) => b.week - a.week); // Sort by week descending
                const recentTasks = [];
                
                if (currentTask) {
                    recentTasks.push(currentTask);
                }
                
                const lastPastTask = sortedTasks.find(task => {
                    try {
                        const endDate = parseISO(task.week_end_date);
                        // Must be in the past and not the current task
                        return isBefore(endDate, now) && task.id !== currentTask?.id;
                    } catch (error) {
                        console.warn(`Error parsing date for past task ${task.id} (user: ${user.email}):`, task.week_end_date, error);
                        return false;
                    }
                });
                
                if (lastPastTask && recentTasks.length < 2) { // Ensure we only get up to two recent tasks
                    recentTasks.push(lastPastTask);
                }

                // Calculate stats for the user's tasks
                const totalTasks = relevantTasks.length;
                const completedTasks = relevantTasks.filter(t => t.status === 'הושלם').length;
                const inProgressTasks = relevantTasks.filter(t => t.status === 'בעבודה').length;
                const notStartedTasks = relevantTasks.filter(t => t.status === 'לא בוצע').length;

                return {
                    user,
                    programType,
                    tasks: relevantTasks,
                    recentTasks: recentTasks.sort((a, b) => b.week - a.week), // Ensure recent tasks are sorted correctly
                    currentTask,
                    stats: {
                        total: totalTasks,
                        completed: completedTasks,
                        inProgress: inProgressTasks,
                        notStarted: notStartedTasks,
                        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
                    }
                };
            });

            const tasksData = await Promise.all(tasksDataPromises);
            // Filter for users who actually have an active program and tasks
            const activeUsersData = tasksData.filter(data => data.programType !== 'none' && data.tasks.length > 0);
            
            setUserTasksData(activeUsersData);

            // Set current group task from first user with a current task
            const firstUserWithCurrentTask = activeUsersData.find(data => data.currentTask);
            if (firstUserWithCurrentTask?.currentTask) {
                const task = firstUserWithCurrentTask.currentTask;
                
                // Calculate group stats for this specific current task
                const usersWithThisCurrentTask = activeUsersData.filter(data => 
                    data.currentTask && data.currentTask.week === task.week
                );
                
                const groupStats = {
                    total: usersWithThisCurrentTask.length,
                    completed: usersWithThisCurrentTask.filter(data => data.currentTask.status === 'הושלם').length,
                    inProgress: usersWithThisCurrentTask.filter(data => data.currentTask.status === 'בעבודה').length,
                    notStarted: usersWithThisCurrentTask.filter(data => data.currentTask.status === 'לא בוצע').length,
                };

                setCurrentGroupTask({
                    ...task,
                    groupStats
                });
            }
            
        } catch (error) {
            console.error('Error loading group task progress:', error);
            setUserTasksData([]);
            setGroupUsers([]);
            setCurrentGroupTask(null);
        } finally {
            setIsLoadingTasks(false);
        }
    };

    // Memoized array of users for the current group task
    const usersWithCurrentTask = useMemo(() => {
        if (!currentGroupTask || !userTasksData || userTasksData.length === 0) return [];
        return userTasksData.filter(data => 
            data.currentTask && data.currentTask.week === currentGroupTask.week
        );
    }, [currentGroupTask, userTasksData]);

    const handleStatusClick = (statusType) => {
        if (!currentGroupTask) return;

        let filteredUsers = [];
        let title = '';

        switch (statusType) {
            case 'all':
                filteredUsers = usersWithCurrentTask;
                title = `כל המשתתפים (${usersWithCurrentTask.length})`;
                break;
            case 'completed':
                filteredUsers = usersWithCurrentTask.filter(data => data.currentTask.status === 'הושלם');
                title = `השלימו את המשימה (${filteredUsers.length})`;
                break;
            case 'inProgress':
                filteredUsers = usersWithCurrentTask.filter(data => data.currentTask.status === 'בעבודה');
                title = `בעבודה על המשימה (${filteredUsers.length})`;
                break;
            case 'notStarted':
                filteredUsers = usersWithCurrentTask.filter(data => data.currentTask.status === 'לא בוצע');
                title = `לא התחילו את המשימה (${filteredUsers.length})`;
                break;
            default:
                filteredUsers = [];
                title = '';
        }

        setSelectedStatusUsers(filteredUsers);
        setSelectedStatusTitle(title);
        setStatusDialogOpen(true);
    };

    const getProgramBadge = (programType) => {
        if (programType === 'booster_plus' || programType === 'booster') {
            return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">🔵 בוסטר</Badge>;
        }
        return null;
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'הושלם': { color: 'bg-green-100 text-green-800 border-green-300', icon: '✓' },
            'בעבודה': { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: '⏳' },
            'לא בוצע': { color: 'bg-slate-100 text-slate-800 border-slate-300', icon: '○' }
        };

        const config = statusConfig[status] || statusConfig['לא בוצע'];
        return <Badge className={config.color}>{config.icon} {status}</Badge>;
    };

    const isCurrentTask = (task, currentTask) => {
        return currentTask && task.id === currentTask.id;
    };

    const renderGroupTaskProgress = () => {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        התקדמות משימות קבוצתיות
                    </CardTitle>
                    <CardDescription>
                        מעקב אחר התקדמות המשימות השבועיות של כל משתמש בקבוצה
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-6">
                    <div className="space-y-6">
                        {/* Group Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="group-select">בחר קבוצה</Label>
                            <Select value={selectedTaskGroup} onValueChange={(value) => {
                                setSelectedTaskGroup(value);
                                loadGroupTaskProgress(value);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר קבוצה..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {groupsWithBoosterUsers.length > 0 ? (
                                        groupsWithBoosterUsers.map((group) => (
                                            <SelectItem key={group.id} value={group.name}>
                                                {group.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="no-groups" disabled>
                                            אין קבוצות עם משתמשי בוסטר
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {groupsWithBoosterUsers.length === 0 && (
                                <p className="text-sm text-slate-500 mt-2">
                                    💡 רק קבוצות עם משתמשים בתוכנית בוסטר מוצגות כאן
                                </p>
                            )}
                        </div>

                        {/* Loading State */}
                        {isLoadingTasks && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600 ms-2" />
                                <span className="text-slate-600">טוען נתוני משימות...</span>
                            </div>
                        )}

                        {/* Current Group Task Preview */}
                        {!isLoadingTasks && currentGroupTask && selectedTaskGroup && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <CheckSquare className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-blue-900">
                                            משימת השבוע הנוכחית
                                        </h3>
                                        <p className="text-sm text-blue-600">
                                            שבוע {currentGroupTask.week} • {formatDate(currentGroupTask.week_start_date)} - {formatDate(currentGroupTask.week_end_date)}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg p-4 mb-4">
                                    <h4 className="font-semibold text-slate-800 mb-2">{currentGroupTask.title}</h4>
                                    
                                    <div className="space-y-3 text-sm">
                                        {currentGroupTask.mission_text && (
                                            <div className="bg-blue-50 p-3 rounded-md">
                                                <p className="font-semibold text-blue-900 mb-1">📋 המשימה:</p>
                                                <p className="text-slate-700 whitespace-pre-line">{currentGroupTask.mission_text}</p>
                                            </div>
                                        )}
                                        
                                        {currentGroupTask.tip_text && (
                                            <div className="bg-green-50 p-3 rounded-md">
                                                <p className="font-semibold text-green-900 mb-1">💡 טיפ:</p>
                                                <p className="text-slate-700 whitespace-pre-line">{currentGroupTask.tip_text}</p>
                                            </div>
                                        )}
                                        
                                        {(currentGroupTask.booster_text || currentGroupTask.insight) && (
                                            <div className="bg-purple-50 p-3 rounded-md">
                                                <p className="font-semibold text-purple-900 mb-1">🚀 בוסטר:</p>
                                                <p className="text-slate-700 whitespace-pre-line">{currentGroupTask.booster_text || currentGroupTask.insight}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Group Status Stats */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <button
                                        onClick={() => handleStatusClick('all')}
                                        className="bg-white p-4 rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="text-2xl font-bold text-slate-800">
                                            {usersWithCurrentTask.length}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">משתתפים</div>
                                    </button>

                                    <button
                                        onClick={() => handleStatusClick('completed')}
                                        className="bg-white p-4 rounded-lg border-2 border-slate-200 hover:border-green-400 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="text-2xl font-bold text-green-600">
                                            {usersWithCurrentTask.filter(d => d.currentTask.status === 'הושלם').length}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">הושלמו</div>
                                    </button>

                                    <button
                                        onClick={() => handleStatusClick('inProgress')}
                                        className="bg-white p-4 rounded-lg border-2 border-slate-200 hover:border-yellow-400 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="text-2xl font-bold text-yellow-600">
                                            {usersWithCurrentTask.filter(d => d.currentTask.status === 'בעבודה').length}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">בעבודה</div>
                                    </button>

                                    <button
                                        onClick={() => handleStatusClick('notStarted')}
                                        className="bg-white p-4 rounded-lg border-2 border-slate-200 hover:border-red-400 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="text-2xl font-bold text-red-600">
                                            {usersWithCurrentTask.filter(d => d.currentTask.status === 'לא בוצע').length}
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">לא התחילו</div>
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Users Progress - Collapsible */}
                        {!isLoadingTasks && userTasksData.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="font-semibold text-slate-700">התקדמות אישית:</h3>
                                {userTasksData.map((userData) => {
                                        const isExpanded = expandedUserId === userData.user.id;
                                        
                                        return (
                                            <Card 
                                                key={userData.user.id} 
                                                className={`border-2 transition-all ${
                                                    isExpanded ? 'border-blue-300' : 'border-slate-200'
                                                }`}
                                            >
                                                <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleUserExpanded(userData.user.id)}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold">
                                                                {userData.user.name?.charAt(0) || 'M'}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-slate-800">{userData.user.name}</h4>
                                                                <p className="text-sm text-slate-500">{userData.user.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {getProgramBadge(userData.programType)}
                                                            <Badge className={`${
                                                                userData.stats.completionRate >= 75 ? 'bg-green-100 text-green-800' :
                                                                userData.stats.completionRate >= 50 ? 'bg-orange-100 text-orange-800' :
                                                                'bg-slate-100 text-slate-800'
                                                            }`}>
                                                                {userData.stats.completionRate}%
                                                            </Badge>
                                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${
                                                                isExpanded ? 'rotate-180' : ''
                                                            }`} />
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3 }}
                                                        >
                                                            <CardContent className="space-y-4 pt-0">
                                                                {/* Stats */}
                                                                <div className="grid grid-cols-4 gap-2">
                                                                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                                        <div className="text-lg font-bold text-slate-800">{userData.stats.total}</div>
                                                                        <div className="text-xs text-slate-500">סה"כ</div>
                                                                    </div>
                                                                    <div className="text-center p-2 bg-green-50 rounded-lg">
                                                                        <div className="text-lg font-bold text-green-600">{userData.stats.completed}</div>
                                                                        <div className="text-xs text-green-600">הושלמו</div>
                                                                    </div>
                                                                    <div className="text-center p-2 bg-orange-50 rounded-lg">
                                                                        <div className="text-lg font-bold text-orange-600">{userData.stats.inProgress}</div>
                                                                        <div className="text-xs text-orange-600">בעבודה</div>
                                                                    </div>
                                                                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                                                                        <div className="text-lg font-bold text-slate-600">{userData.stats.notStarted}</div>
                                                                        <div className="text-xs text-slate-600">לא התחילו</div>
                                                                    </div>
                                                                </div>

                                                                {/* Progress Bar */}
                                                                <div>
                                                                    <div className="flex justify-between text-sm mb-2">
                                                                        <span className="font-medium text-slate-700">התקדמות כללית</span>
                                                                        <span className="font-bold text-green-600">{userData.stats.completionRate}%</span>
                                                                    </div>
                                                                    <Progress value={userData.stats.completionRate} className="h-3" />
                                                                </div>

                                                                {/* Recent Tasks */}
                                                                {userData.recentTasks.length > 0 && (
                                                                    <div>
                                                                        <h5 className="font-semibold text-slate-700 mb-2 text-sm">משימות אחרונות:</h5>
                                                                        <div className="space-y-2">
                                                                            {userData.recentTasks.map((task) => {
                                                                                const isCurrent = isCurrentTask(task, userData.currentTask);
                                                                                return (
                                                                                    <div 
                                                                                        key={task.id} 
                                                                                        className={`p-3 rounded-lg border-2 transition-all ${
                                                                                            isCurrent 
                                                                                                ? 'bg-orange-50 border-orange-300' 
                                                                                                : 'bg-slate-50 border-slate-200'
                                                                                        }`}
                                                                                    >
                                                                                        <div className="flex items-center justify-between mb-2">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="font-semibold text-slate-800">
                                                                                                    שבוע {task.week} - {task.title}
                                                                                                </span>
                                                                                                {isCurrent && (
                                                                                                    <Badge className="bg-orange-500 text-white border-orange-600">
                                                                                                        משימה נוכחית
                                                                                                    </Badge>
                                                                                                )}
                                                                                            </div>
                                                                                            {getStatusBadge(task.status)}
                                                                                        </div>
                                                                                        <div className="text-xs text-slate-500">
                                                                                            {formatDate(task.week_start_date)} - {formatDate(task.week_end_date)}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </CardContent>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </Card>
                                        );
                                    })}
                            </div>
                        )}

                        {/* Empty State for selected group with no active programs */}
                        {!isLoadingTasks && selectedTaskGroup && userTasksData.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <CheckSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                <p className="text-lg font-medium">אין משתמשים עם תוכנית בוסטר פעילה בקבוצה זו</p>
                                <p className="text-sm mt-2">הפעל תוכנית בוסטר למשתמשים בקבוצה</p>
                            </div>
                        )}

                        {/* Empty State for no group selected */}
                        {!selectedTaskGroup && (
                            <div className="text-center py-8 text-slate-500">
                                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                <p className="text-lg font-medium">בחר קבוצה כדי לראות את התקדמות המשימות</p>
                            </div>
                        )}
                    </div>
                </CardContent>

                {/* Status Users Dialog */}
                <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[80vh]" dir="rtl">
                        <DialogHeader>
                            <DialogTitle className="text-xl">{selectedStatusTitle}</DialogTitle>
                            <DialogDescription>
                                רשימת המשתמשים במשימה: {currentGroupTask?.title}
                            </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-3 p-4">
                                {selectedStatusUsers.length > 0 ? (
                                    selectedStatusUsers.map((userData) => (
                                        <div 
                                            key={userData.user.id} 
                                            className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                                            onClick={() => {
                                                handleUserClick(userData.user.email);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                                    {userData.user.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-800">{userData.user.name}</h4>
                                                    <p className="text-sm text-slate-500">{userData.user.email}</p>
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                {getProgramBadge(userData.programType)}
                                                {userData.currentTask && (
                                                    <Badge className={`mt-1 ${
                                                        userData.currentTask.status === 'הושלם' ? 'bg-green-100 text-green-800' :
                                                        userData.currentTask.status === 'בעבודה' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {userData.currentTask.status}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-500">
                                        <p>אין משתמשים בסטטוס זה</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </Card>
        );
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>;
    }

    if (!allUsers || !allGroups || !stats) {
         return <div className="text-center py-10">לא הצלחנו לטעון את הנתונים. נסה לרענן את העמוד.</div>;
    }


    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <div className="space-y-4" dir="rtl">
                <div className="flex justify-center w-full">
                    <h1 className="text-xl sm:text-2xl font-bold">מרכז שליטה</h1>
                </div>

                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 md:grid-cols-4">
                    <DialogTrigger asChild>
                        <button onClick={() => openDialog('users', 'מתאמנים פעילים', traineeUsers.filter(u => u.status === 'פעיל'))} className="w-full text-right cursor-pointer">
                            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-md transition-shadow h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">פעילים</CardTitle>
                                    <Users className="h-4 w-4 text-green-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl sm:text-2xl font-bold">{userStats.active}</div>
                                    <p className="text-xs text-muted-foreground">מתוך {userStats.total} מתאמנים</p>
                                </CardContent>
                            </Card>
                        </button>
                    </DialogTrigger>

                    <DialogTrigger asChild>
                        <button onClick={() => openDialog('users', 'מתאמנים לא פעילים', traineeUsers.filter(u => ['מוקפא', 'הסתיים', 'לא פעיל'].includes(u.status)))} className="w-full text-right cursor-pointer">
                             <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-md transition-shadow h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">לא פעילים</CardTitle>
                                    <PauseCircle className="h-4 w-4 text-amber-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl sm:text-2xl font-bold">{userStats.inactive}</div>
                                     <p className="text-xs text-muted-foreground">מתוך {userStats.total} מתאמנים</p>
                                </CardContent>
                            </Card>
                        </button>
                    </DialogTrigger>

                    <DialogTrigger asChild>
                        <button onClick={() => openDialog('users', 'משתמשים ללא קבוצה', traineeUsers.filter(u => !u.group_names || u.group_names.length === 0))} className="w-full text-right cursor-pointer">
                            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-md transition-shadow h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">ממתינים לשיוך</CardTitle>
                                    <UserPlus className="h-4 w-4 text-blue-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl sm:text-2xl font-bold">{userStats.newToAssign}</div>
                                    <p className="text-xs text-muted-foreground">מתאמנים ללא קבוצה</p>
                                </CardContent>
                            </Card>
                        </button>
                    </DialogTrigger>

                    <DialogTrigger asChild>
                         <button onClick={() => openDialog('groups', 'קבוצות פעילות', allGroups.filter(g => g.status === 'Active'))} className="w-full text-right cursor-pointer">
                            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-md transition-shadow h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">קבוצות פעילות</CardTitle>
                                    <FolderKanban className="h-4 w-4 text-purple-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl sm:text-2xl font-bold">{userStats.groups}</div>
                                    <p className="text-xs text-muted-foreground">מתוך {allGroups.length} קבוצות</p>
                                </CardContent>
                            </Card>
                        </button>
                    </DialogTrigger>
                </div>

                <Card>
                    <CardHeader className="py-3 px-4 sm:px-6">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Settings className="w-5 h-5" />
                            פעולות מהירות
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4">
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            {quickActions.map((action, index) => (
                                <QuickActionCard
                                    key={index}
                                    title={action.title}
                                    icon={action.icon}
                                    color={action.color}
                                    description={action.description}
                                    onClick={action.onClick}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <InviteLinkCard />

                <Card>
                    <div
                        className="cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-lg"
                        onClick={() => setIsMessengerExpanded(!isMessengerExpanded)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 sm:py-4 sm:px-6">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                <CardTitle className="text-base sm:text-lg">תקשורת עם משתמשים</CardTitle>
                            </div>
                            <motion.div
                                animate={{ rotate: isMessengerExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            </motion.div>
                        </CardHeader>
                        {!isMessengerExpanded && (
                            <CardDescription className="px-4 pb-3 -mt-2 text-xs sm:text-sm">
                                שליחת הודעות מערכת למשתמשים. לחץ להרחבה.
                            </CardDescription>
                        )}
                    </div>

                    <AnimatePresence>
                        {isMessengerExpanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <CardDescription className="px-6 pb-4">
                                    הודעות מערכת (פופ-אפ/Push Notification) לכל המשתמשים/קבוצה/משתמש ספציפי
                                </CardDescription>
                                <CardContent className="pt-0 space-y-4">
                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="target">נמען</Label>
                                            <Select value={messageTarget} onValueChange={handleTargetChangeWithTemplate}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="בחר נמען" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">כל המשתמשים</SelectItem>
                                                    <SelectItem value="group">קבוצה ספציפית</SelectItem>
                                                    <SelectItem value="user">משתמש ספציפי</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {messageTarget === 'group' && stats?.groupProgress && (
                                            <div>
                                                <Label htmlFor="group">בחר קבוצה</Label>
                                                <Select value={selectedGroup} onValueChange={handleGroupChange}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="בחר קבוצה" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {stats.groupProgress.map(g => (
                                                            <SelectItem key={g.name} value={g.name}>{g.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {messageTarget === 'user' && (
                                            <div>
                                                <Label htmlFor="user">בחר משתמש</Label>
                                                <Select value={selectedUser} onValueChange={handleUserChange}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="בחר משתמש" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60 overflow-y-auto">
                                                        {allUsers.map(u => (
                                                            <SelectItem key={u.email} value={u.email}>
                                                                {u.name} ({u.email})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="template-select">תבניות מוכנות (אופציונלי)</Label>
                                        <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                                            <SelectTrigger id="template-select"><SelectValue placeholder="בחר תבנית..." /></SelectTrigger>
                                            <SelectContent>
                                                {messageTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="message-content">תוכן ההודעה</Label>
                                        <Textarea
                                            id="message-content"
                                            placeholder="כתוב את ההודעה שלך כאן..."
                                            value={messageContent}
                                            onChange={(e) => setMessageContent(e.target.value)}
                                            rows={4}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            ניתן להשתמש ב-`{'{userName}'}` וזה יוחלף אוטומטית בשם המשתמש.
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={isSending || !messageContent.trim() || (messageTarget === 'group' && !selectedGroup) || (messageTarget === 'user' && !selectedUser)}
                                        >
                                            {isSending ? (
                                                <><Loader2 className="w-4 h-4 ms-2 animate-spin" />שולח...</>
                                            ) : (
                                                <><Send className="w-4 h-4 ms-2" />שלח הודעה</>
                                            )}
                                        </Button>
                                        {sendSuccess && <p className="text-sm text-green-600">{sendSuccess}</p>}
                                    </div>

                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                <Card>
                    <div
                        className="cursor-pointer hover:bg-slate-50/50 transition-colors rounded-lg"
                        onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                    >
                        <CardHeader className="py-3 px-4 sm:px-6 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                <CardTitle className="text-base sm:text-lg">לוח אירועים</CardTitle>
                            </div>
                            <motion.div
                                animate={{ rotate: isCalendarExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            </motion.div>
                        </CardHeader>
                        {!isCalendarExpanded && (
                            <CardDescription className="px-6 pb-4 -mt-2">
                                הצצה מהירה לאירועים הקרובים של כל הקבוצות. לחץ להרחבה.
                            </CardDescription>
                        )}
                    </div>
                    <AnimatePresence>
                        {isCalendarExpanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <CardContent className="pt-2 px-4 sm:px-6 pb-4 space-y-3">
                                    {upcomingEvents.length > 0 ? (
                                        upcomingEvents.map(event => (
                                            <div key={event.id} className="flex items-center justify-between p-2 rounded-md bg-slate-50 border-b last:border-b-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-purple-100 p-2 rounded-full">
                                                        <Calendar className="w-4 h-4 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">{event.event_title}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatDate(event.start_datetime)} • {formatTime(event.start_datetime)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                                                    {event.group_name}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-sm text-muted-foreground py-4">אין אירועים קרובים בלו"ז.</p>
                                    )}
                                </CardContent>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>

                <Card>
                    <div
                        className="cursor-pointer hover:bg-slate-50/50 transition-colors rounded-lg"
                        onClick={() => setIsWeeklyTasksExpanded(!isWeeklyTasksExpanded)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 sm:py-4 sm:px-6">
                            <div className="flex items-center gap-2">
                                <ListChecks className="w-5 h-5" />
                                <CardTitle className="text-base sm:text-lg">התקדמות משימות קבוצתיות</CardTitle>
                            </div>
                            <motion.div
                                animate={{ rotate: isWeeklyTasksExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            </motion.div>
                        </CardHeader>
                        {!isWeeklyTasksExpanded && (
                            <CardDescription className="px-4 pb-3 -mt-2 text-xs sm:text-sm">
                                מעקב אחר התקדמות המשימות השבועיות של כל משתמש בקבוצה. לחץ להרחבה.
                            </CardDescription>
                        )}
                    </div>
                    <AnimatePresence>
                        {isWeeklyTasksExpanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                {renderGroupTaskProgress()}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{dialogContent.title}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-96">
                        <ul className="space-y-2 p-1">
                            {dialogContent.items.map((item) => (
                                <li key={item.id || item.email}>
                                    {dialogContent.type === 'users' ? (
                                        <button
                                            onClick={() => handleUserClick(item.email)}
                                            className="w-full text-right p-2 rounded-md hover:bg-slate-100 transition-colors flex justify-between items-center"
                                        >
                                            <span>{item.name || 'שם לא זמין'}</span>
                                            {item.group_names?.length > 0 && (
                                                <Badge variant="secondary">{item.group_names.join(', ')}</Badge>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="p-2">
                                            {item.name}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                        {dialogContent.items.length === 0 && (
                            <p className="text-center text-slate-500 py-4">אין נתונים להצגה.</p>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
