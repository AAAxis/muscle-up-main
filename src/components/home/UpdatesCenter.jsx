
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { User, CoachMessage, GroupMessage, GroupEvent, WeightReminder, EventParticipation, PreMadeWorkout, AdminMessage } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, MessageSquare, Users, Calendar as CalendarIcon, Scale, CheckCircle2, Loader2, RefreshCw, AlertTriangle, CalendarClock, Dumbbell, Star, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '../utils/timeUtils';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { parseISO, isToday, addMinutes, subHours, isAfter, isBefore } from 'date-fns';

// Simple in-memory cache with expiration
class SimpleCache {
    constructor(expirationMinutes = 5) {
        this.cache = new Map();
        this.expirationMs = expirationMinutes * 60 * 1000;
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() - item.timestamp > this.expirationMs) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    clear() {
        this.cache.clear();
    }
}

// Global cache instance
const apiCache = new SimpleCache(5); // 5 minutes cache

export default function UpdatesCenter() {
    const [user, setUser] = useState(null);
    const [allNotifications, setAllNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    // This state will now hold the authoritative participation data.
    const [eventParticipations, setEventParticipations] = useState(new Map());
    const [expandedMessageId, setExpandedMessageId] = useState(null);

    const [dismissedGroupMessages, setDismissedGroupMessages] = useState(() => {
        const saved = localStorage.getItem('dismissedGroupMessages');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const navigate = useNavigate();
    const location = useLocation();

    const loadData = useCallback(async (forceRefresh = false) => {
        if (!user) return;

        setIsLoading(true);
        setLoadError(null);

        const cacheKey = `notifications_${user.email}`;
        if (!forceRefresh) {
            const cachedData = apiCache.get(cacheKey);
            if (cachedData && Array.isArray(cachedData.notifications) && Array.isArray(cachedData.participations)) {
                setAllNotifications(cachedData.notifications);
                // When loading from cache, ensure participations map is recreated correctly
                setEventParticipations(new Map(cachedData.participations)); // Recreate Map from array
                setIsLoading(false);
                return;
            }
        }

        // Clear cache on forced refresh or if no cached data
        apiCache.clear();

        try {
            const dataSources = [
                EventParticipation.filter({ user_email: user.email }),
                CoachMessage.filter({ user_email: user.email, is_read: false }, '-created_date'),
                PreMadeWorkout.filter({ target_user_email: user.email, is_accepted: false }, '-created_date'),
                WeightReminder.filter({ user_email: user.email, is_dismissed: false }, '-created_date'),
                AdminMessage.list('-sent_date'), // Get all admin messages
                user.group_names?.length > 0 ? GroupMessage.filter({ group_name: { $in: user.group_names } }, '-sent_date') : Promise.resolve([]),
                user.group_names?.length > 0 ? GroupEvent.list('-start_datetime') : Promise.resolve([])
            ];

            const results = await Promise.allSettled(dataSources);

            const [
                participationsResult,
                coachMessagesResult,
                newWorkoutsResult,
                weightRemindersResult,
                adminMessagesResult,
                groupMessagesResult,
                groupEventsResult
            ] = results;

            // Process participations first as other notifications might depend on it
            const participationsData = (participationsResult.status === 'fulfilled' && Array.isArray(participationsResult.value)) 
                ? participationsResult.value 
                : [];
            const participationsMap = new Map(participationsData.map(p => [p.event_id, p]));
            setEventParticipations(participationsMap); // Update state here

            const fetchedNotifications = [];
            const notificationIds = new Set(); // To prevent duplicates

            // Process Coach Messages - with dismiss functionality
            if (coachMessagesResult.status === 'fulfilled' && Array.isArray(coachMessagesResult.value)) {
                coachMessagesResult.value.forEach(msg => {
                    const id = `coach_${msg.id}`;
                    if (!notificationIds.has(id)) {
                        fetchedNotifications.push({
                            id, 
                            type: 'coach_message', 
                            title: 'הודעה מהמאמן', 
                            details: msg.message_text, 
                            date: msg.created_date,
                            icon: 'MessageSquare', 
                            bgColor: 'bg-blue-100', 
                            iconColor: 'text-blue-600', 
                            data: msg
                        });
                        notificationIds.add(id);
                    }
                });
            }

            // Process New Workouts
            if (newWorkoutsResult.status === 'fulfilled' && Array.isArray(newWorkoutsResult.value)) {
                newWorkoutsResult.value.forEach(workout => {
                    const id = `workout_${workout.id}`;
                    if (!notificationIds.has(id)) {
                        fetchedNotifications.push({
                            id, type: 'coach_workout', title: `אימון חדש: ${workout.workout_title}`, details: workout.workout_description || 'אימון מהמאמן שלך מחכה לך',
                            date: workout.created_date, icon: 'Dumbbell', bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600', data: workout
                        });
                        notificationIds.add(id);
                    }
                });
            }

            // Process Weight Reminders
            if (weightRemindersResult.status === 'fulfilled' && Array.isArray(weightRemindersResult.value)) {
                weightRemindersResult.value.forEach(reminder => {
                    const id = `weight_${reminder.id}`;
                    if (!notificationIds.has(id)) {
                        fetchedNotifications.push({
                            id, type: 'weight_reminder', title: 'תזכורת לעדכון משקל', details: reminder.message, date: reminder.reminder_date || reminder.created_date,
                            icon: 'Scale', bgColor: 'bg-green-100', iconColor: 'text-green-600', data: reminder
                        });
                        notificationIds.add(id);
                    }
                });
            }

            // Process Admin Messages
            if (adminMessagesResult.status === 'fulfilled' && Array.isArray(adminMessagesResult.value)) {
                adminMessagesResult.value.forEach(msg => {
                    // Check if this message is relevant for current user
                    let isRelevant = false;
                    
                    if (msg.target_type === 'all_users') {
                        isRelevant = true;
                    } else if (msg.target_type === 'specific_group' && msg.target_group && user.group_names?.includes(msg.target_group)) {
                        isRelevant = true;
                    } else if (msg.target_type === 'specific_user' && msg.target_user_email === user.email) {
                        isRelevant = true;
                    }

                    if (isRelevant) {
                        // Check if user has read this message
                        const hasRead = msg.read_receipts?.some(r => r.user_email === user.email && r.is_read);
                        
                        if (!hasRead) {
                            const id = `admin_${msg.id}`;
                            if (!notificationIds.has(id)) {
                                fetchedNotifications.push({
                                    id, type: 'admin_message', title: msg.message_title, details: msg.message_content, date: msg.sent_date,
                                    icon: 'MessageSquare', bgColor: 'bg-red-100', iconColor: 'text-red-600', data: msg
                                });
                                notificationIds.add(id);
                            }
                        }
                    }
                });
            }

            // Process Group Messages
            if (groupMessagesResult.status === 'fulfilled' && Array.isArray(groupMessagesResult.value)) {
                groupMessagesResult.value.forEach(msg => {
                    const hasRead = msg.read_receipts?.some(r => r.user_email === user.email && r.is_read);
                    const id = `group_${msg.id}`;
                    if (!hasRead && !dismissedGroupMessages.has(id) && !notificationIds.has(id)) {
                        fetchedNotifications.push({
                            id, type: 'group_message', title: msg.message_title, details: msg.message_content, date: msg.sent_date,
                            icon: 'Users', bgColor: 'bg-purple-100', iconColor: 'text-purple-600', data: msg
                        });
                        notificationIds.add(id);
                    }
                });
            }

            // Process Group Events - The notification stays until the event starts, status changes on response.
            if (groupEventsResult.status === 'fulfilled' && Array.isArray(groupEventsResult.value)) {
                const now = new Date();
                groupEventsResult.value
                    .filter(event => user.group_names?.includes(event.group_name))
                    .forEach(event => {
                        try {
                            const eventStart = parseISO(event.start_datetime);
                            const reminderStartTime = subHours(eventStart, 48);
                            const reminderId = `event_reminder_${event.id}`;

                            // Show the notification if we are in the time window (48h before until event start).
                            // It will be displayed whether the user responded or not.
                            if (isAfter(now, reminderStartTime) && isBefore(now, eventStart)) {
                                if (!notificationIds.has(reminderId)) {
                                    const hasResponded = participationsMap.has(event.id);
                                    
                                    fetchedNotifications.push({
                                        id: reminderId,
                                        type: 'event_reminder',
                                        title: `תזכורת: ${event.event_title}`,
                                        details: hasResponded 
                                            ? 'תודה על תגובתך, נתראה באירוע!' 
                                            : `האירוע מתקרב. אנא אשר/י הגעה.`,
                                        date: event.start_datetime,
                                        icon: 'CalendarClock',
                                        bgColor: hasResponded ? 'bg-green-50' : 'bg-amber-100',
                                        iconColor: hasResponded ? 'text-green-600' : 'text-amber-600',
                                        data: event
                                    });
                                    notificationIds.add(reminderId);
                                }
                            }
                        } catch (e) {
                            console.warn(`Could not process event ${event.id}:`, e);
                        }
                    });
            }


            const sortedNotifications = fetchedNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Cache both notifications and participations map
            // Convert Map to array of [key, value] pairs for caching
            apiCache.set(cacheKey, { notifications: sortedNotifications, participations: Array.from(participationsMap.entries()) });
            setAllNotifications(sortedNotifications);

        } catch (error) {
            console.error('Error in loadData:', error);
            setLoadError(error.message || 'שגיאה בטעינת העדכונים');
        } finally {
            setIsLoading(false);
        }
    }, [user, dismissedGroupMessages]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to load user", error);
                setLoadError('שגיאה בטעינת נתוני המשתמש');
                setIsLoading(false); // Ensure loading state is false even on user fetch error
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (user) {
            const shouldRefresh = location.state?.refreshUpdates;
            loadData(shouldRefresh);
            if (shouldRefresh) {
                // Clean up the state to prevent re-fetching on other renders
                window.history.replaceState({}, document.title, location.pathname); // Preserve path
            }
        }
    }, [user, loadData, location.state, location.pathname]);

    const handleNavigateToEvents = () => {
        navigate(createPageUrl('BoosterEvents'));
    };

    const handleDismissCoachMessage = async (notificationItem) => {
        try {
            const messageData = notificationItem.data;
            
            if (!messageData || !messageData.id) {
                console.warn('Cannot dismiss coach message: missing message data.');
                return;
            }

            // Update the message to mark as read
            await CoachMessage.update(messageData.id, {
                is_read: true
            });

            // Remove from UI immediately
            setAllNotifications(prev => prev.filter(n => n.id !== notificationItem.id));

            apiCache.clear();
        } catch (error) {
            console.error('Error marking coach message as read:', error);
        }
    };

    const handleDismissGroupMessage = async (notificationItem) => {
        try {
            const messageData = notificationItem.data;
            const currentUser = user;

            // Add safety checks for user object
            if (!messageData || !currentUser?.email) {
                console.warn('Cannot dismiss group message: missing message data or user info.');
                // Even if not fully processed, add to dismissed set to remove from view
                setDismissedGroupMessages(prev => {
                    const newSet = new Set(prev).add(String(notificationItem.id));
                    localStorage.setItem('dismissedGroupMessages', JSON.stringify(Array.from(newSet)));
                    return newSet;
                });
                return;
            }

            const updatedReadReceipts = messageData.read_receipts ? [...messageData.read_receipts] : [];
            const existingIndex = updatedReadReceipts.findIndex(r => r.user_email === currentUser.email);

            if (existingIndex >= 0) {
                updatedReadReceipts[existingIndex] = {
                    ...updatedReadReceipts[existingIndex],
                    is_read: true,
                    read_timestamp: new Date().toISOString()
                };
            } else {
                updatedReadReceipts.push({
                    user_email: currentUser.email,
                    user_name: currentUser.name || currentUser.full_name || 'משתמש לא ידוע',
                    is_read: true,
                    read_timestamp: new Date().toISOString()
                });
            }

            await GroupMessage.update(messageData.id, {
                read_receipts: updatedReadReceipts
            });

            setDismissedGroupMessages(prev => {
                const newSet = new Set(prev).add(String(notificationItem.id));
                localStorage.setItem('dismissedGroupMessages', JSON.stringify(Array.from(newSet)));
                return newSet;
            });

            apiCache.clear();
            loadData(true); // Force refresh to remove the dismissed item

        } catch (error) {
            console.error('Error marking group message as read:', error);
            // On error, still try to dismiss from view to avoid user frustration
            setDismissedGroupMessages(prev => {
                const newSet = new Set(prev).add(String(notificationItem.id));
                localStorage.setItem('dismissedGroupMessages', JSON.stringify(Array.from(newSet)));
                return newSet;
            });
        }
    };

    const handleAdminMessageRead = async (notificationItem) => {
        try {
            const messageData = notificationItem.data;
            const currentUser = user;

            if (!messageData || !currentUser?.email) {
                console.warn('Cannot mark admin message as read: missing data');
                return;
            }

            const updatedReadReceipts = messageData.read_receipts ? [...messageData.read_receipts] : [];
            const existingIndex = updatedReadReceipts.findIndex(r => r.user_email === currentUser.email);

            if (existingIndex >= 0) {
                updatedReadReceipts[existingIndex] = {
                    ...updatedReadReceipts[existingIndex],
                    is_read: true,
                    read_timestamp: new Date().toISOString()
                };
            } else {
                updatedReadReceipts.push({
                    user_email: currentUser.email,
                    user_name: currentUser.name || currentUser.full_name || 'משתמש לא ידוע',
                    is_read: true,
                    read_timestamp: new Date().toISOString()
                });
            }

            await AdminMessage.update(messageData.id, {
                read_receipts: updatedReadReceipts
            });

            // Remove from UI immediately
            setAllNotifications(prev => prev.filter(n => n.id !== notificationItem.id));

            apiCache.clear();
        } catch (error) {
            console.error('Error marking admin message as read:', error);
        }
    };

    const handleToggleMessage = (messageId) => {
        setExpandedMessageId(prev => prev === messageId ? null : messageId);
    };

    const isMessageExpanded = (messageId) => {
        return expandedMessageId === messageId;
    };

    const handleWeightReminderAction = async (notificationItem) => {
        try {
            // Optimistically remove from UI for instant feedback
            setAllNotifications(prev => prev.filter(n => n.id !== notificationItem.id));
            
            // Navigate to the correct page and module
            navigate(createPageUrl('Progress'), { state: { openModule: 'weight' } });

            // Update the entity in the background to permanently dismiss it
            const reminderData = notificationItem.data;
            if (reminderData?.id) {
                await WeightReminder.update(reminderData.id, { is_dismissed: true });
                apiCache.clear(); // Clear cache to ensure fresh data on next load
            }
        } catch (error) {
            console.error('Error handling weight reminder:', error);
            // Optionally, handle the error, e.g., by reloading data to show the notification again if the update failed
            loadData(true);
        }
    };

    const handleRetryLoad = () => {
        apiCache.clear();
        setLoadError(null);
        loadData(true); // Force refresh on retry
    };

    const displayedNotifications = useMemo(() => {
        if (!Array.isArray(allNotifications) || allNotifications.length === 0) {
            return [];
        }

        return allNotifications.map(item => {
            const dateObj = new Date(item.date);
            const formattedDate = formatDate(dateObj);
            const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return {
                ...item,
                date: formattedDate,
                time: formattedTime,
            };
        });
    }, [allNotifications]);

    const iconMapForDisplay = {
        Bell: Bell,
        MessageSquare: MessageSquare,
        Users: Users,
        Calendar: CalendarIcon,
        Scale: Scale,
        Dumbbell: Dumbbell,
        CalendarClock: CalendarClock,
        Star: Star,
        AlertTriangle: AlertTriangle,
        Info: Info
    };

    if (loadError) {
        return (
            <Card className="bg-gradient-to-br from-white to-red-50 border border-red-200/80 shadow-lg" dir="rtl">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 ml-2 text-red-600" />
                            שגיאה בטעינת העדכונים
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div className="text-center py-4">
                        <p className="text-slate-600 mb-4">{loadError}</p>
                        <Button onClick={handleRetryLoad} variant="outline">
                            <RefreshCw className="w-4 h-4 ml-2" />
                            נסה שוב
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-white to-yellow-50 border border-yellow-200/80 shadow-lg" dir="rtl">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 ml-2 text-yellow-600" />
                        מרכז עדכונים
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {isLoading && displayedNotifications.length === 0 ? (
                    <div className="text-center py-4 text-slate-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                        <p className="text-slate-600 mt-2">טוען עדכונים...</p>
                    </div>
                ) : displayedNotifications.length === 0 ? (
                    (!user || !user.group_names || user.group_names.length === 0) ? (
                        <div className="text-center py-4 text-slate-600">
                            <p className="font-semibold text-lg text-slate-800">ברוכים הבאים, {user?.name || user?.full_name}!</p>
                            <p className="text-sm mt-1">עדיין לא שויכת לקבוצה. עדכונים יופיעו כאן בקרוב.</p>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-slate-500">
                            <p>אין עדכונים חדשים כרגע</p>
                        </div>
                    )
                ) : (
                    <ScrollArea className="h-60">
                        <div className="space-y-3 pl-2" dir="rtl">
                            <AnimatePresence>
                                {displayedNotifications.map(item => {
                                    const Icon = iconMapForDisplay[item.icon];
                                    const isResponded = item.type === 'event_reminder' && eventParticipations.has(item.data?.id);
                                    const isExpanded = isMessageExpanded(item.id); // This already checks for the current item

                                    const handleNotificationClick = () => {
                                        if (item.type === 'event_reminder') {
                                            navigate(createPageUrl('BoosterEvents'));
                                        } else if (item.type === 'admin_message' || item.type === 'coach_message') {
                                            handleToggleMessage(item.id);
                                        }
                                    };

                                    const isClickable = item.type === 'event_reminder' || item.type === 'admin_message' || item.type === 'coach_message';

                                    return (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                                            className={`p-3 rounded-lg transition-all duration-300 ${item.bgColor} ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}`}
                                            onClick={isClickable ? handleNotificationClick : undefined}
                                            dir="rtl"
                                        >
                                            <div className="flex items-start gap-3" dir="rtl">
                                                {/* Action Button on the LEFT side */}
                                                <div className="flex-shrink-0 order-first">
                                                    {isResponded ? (
                                                        <div className="flex items-center gap-1 text-green-600 text-sm font-semibold px-2 py-1 rounded-md bg-green-100">
                                                            <CheckCircle2 className="w-4 h-4 ml-1" />
                                                            <span>הגבת</span>
                                                        </div>
                                                    ) : item.type === 'event_reminder' ? (
                                                        <Button
                                                            size="sm"
                                                            className="whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                navigate(createPageUrl('BoosterEvents'));
                                                            }}
                                                        >
                                                            {user?.gender === 'female' ? 'הגיבי' : 'הגב'}
                                                        </Button>
                                                    ) : item.type === 'coach_message' ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="whitespace-nowrap bg-white/80 hover:bg-white border-blue-200 text-blue-600 hover:text-blue-700"
                                                            disabled={!isExpanded}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isExpanded) {
                                                                    handleDismissCoachMessage(item);
                                                                }
                                                            }}
                                                        >
                                                            {isExpanded ? 'אישור' : 'קרא תחילה'}
                                                        </Button>
                                                    ) : item.type === 'weight_reminder' ? (
                                                        <Button
                                                            size="sm"
                                                            className="whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleWeightReminderAction(item);
                                                            }}
                                                        >
                                                            {user?.gender === 'female' ? 'עדכני' : 'עדכן'}
                                                        </Button>
                                                    ) : item.type === 'group_message' ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="whitespace-nowrap"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDismissGroupMessage(item);
                                                            }}
                                                        >
                                                            אישור
                                                        </Button>
                                                    ) : item.type === 'admin_message' ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="whitespace-nowrap bg-white/80 hover:bg-white border-red-200 text-red-600 hover:text-red-700"
                                                            disabled={!isExpanded}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isExpanded) {
                                                                    handleAdminMessageRead(item);
                                                                }
                                                            }}
                                                        >
                                                            {isExpanded ? 'אישור' : 'קרא תחילה'}
                                                        </Button>
                                                    ) : null}
                                                </div>

                                                {/* Content on the RIGHT side */}
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {Icon && <Icon className={`w-5 h-5 mt-1 flex-shrink-0 ${item.iconColor}`} />}
                                                    <div className="flex-1 text-right">
                                                        <p className={`font-semibold text-sm ${item.iconColor} text-right`}>{item.title}</p>
                                                        {item.type === 'admin_message' || item.type === 'coach_message' ? (
                                                            <div className="mt-1 text-right">
                                                                <p className={`text-xs text-slate-700 text-right ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                                    {item.details}
                                                                </p>
                                                                {!isExpanded && item.details.length > 100 && (
                                                                    <span className="text-xs text-blue-600 cursor-pointer">לחץ לקריאה מלאה...</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-700 mt-1 line-clamp-2 text-right">{item.details}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
