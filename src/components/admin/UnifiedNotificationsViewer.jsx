
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, WeeklyCheckin, NotificationResponse, GeneratedReport, EventParticipation, GroupEvent, UserGroup, CoachNotification } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Bell, Search, User as UserIcon, Calendar, MessageCircle, FileText, Eye, ChevronRight, Activity, Clock, ClipboardCheck, Users as UsersIcon, Loader2, Filter, Check, ChevronsUpDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label"; // Added Label import

// Helper function to introduce a delay
const delay = ms => new Promise(res => setTimeout(res, ms));

// Helper function with retry logic for API calls
const withRetry = async (apiCall, retries = 3, baseDelay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        const waitTime = baseDelay * Math.pow(2, i);
        console.warn(`Rate limit hit. Retrying in ${waitTime}ms... (attempt ${i + 1}/${retries})`);
        await delay(waitTime);
      } else {
        throw error;
      }
    }
  }
  throw new Error('API call failed after multiple retries due to rate limiting.');
};

export default function UnifiedNotificationsViewer() {
  const [users, setUsers] = useState([]); // This state holds trainees (role: 'user')
  const [allUsersData, setAllUsersData] = useState([]); // This state holds all users for group filtering
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');

  const [weeklyCheckins, setWeeklyCheckins] = useState([]);
  const [traineeResponses, setTraineeResponses] = useState([]);
  const [notificationStatuses, setNotificationStatuses] = useState([]);
  const [eventParticipations, setEventParticipations] = useState([]);
  const [groupEvents, setGroupEvents] = useState([]);
  const [boosterRequests, setBoosterRequests] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null); // This is for the detailed dialog, holds full user object

  // New states for trainee filter
  const [selectedUserEmailFilter, setSelectedUserEmailFilter] = useState('all'); // This is for the filter dropdown, holds user email string
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // States for event responses and tabs
  const [eventResponses, setEventResponses] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [activeTab, setActiveTab] = useState('events'); // Changed default to 'events'

  // New states for staged loading
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isLoadingCheckins, setIsLoadingCheckins] = useState(false);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [isLoadingBoosterRequests, setIsLoadingBoosterRequests] = useState(false);

  // New states for lazy loading and caching
  const [loadedTabs, setLoadedTabs] = useState(new Set());
  const [lastLoadTime, setLastLoadTime] = useState({});

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

  // Helper to check if data is cached and still valid
  const isCacheValid = useCallback((tabName) => {
    return lastLoadTime[tabName] && (Date.now() - lastLoadTime[tabName] < CACHE_DURATION);
  }, [lastLoadTime, CACHE_DURATION]);

  // Specific loading functions for each data type
  const loadUsers = useCallback(async () => {
    try {
      const usersData = await withRetry(() => User.filter({ role: 'user' }));
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading trainee users:', error);
      setUsers([]);
    }
  }, []);

  const loadAllUsersAndGroups = useCallback(async () => {
    try {
      const [allUsers, allGroups] = await Promise.all([
        withRetry(() => User.list(), 2, 1500), // Get ALL users for group filtering
        withRetry(() => UserGroup.list(), 2, 1500)
      ]);
      setAllUsersData(allUsers || []);
      setUserGroups(allGroups || []);
    } catch (error) {
      console.error('Error loading all users and groups:', error);
      setAllUsersData([]);
      setUserGroups([]);
    }
  }, []);

  // Load group events to get event names and dates
  const loadGroupEvents = useCallback(async () => {
    if (isCacheValid('groupEvents')) {
      console.log('Using cached group events');
      return;
    }
    try {
      const groupEventsData = await withRetry(() => GroupEvent.list('-start_datetime', 100), 2, 2000);
      setGroupEvents(groupEventsData || []);
      setLastLoadTime(prev => ({ ...prev, groupEvents: Date.now() }));
    } catch (error) {
      console.error('Error loading group events:', error);
      setGroupEvents([]);
    }
  }, [isCacheValid]);

  const loadEventParticipations = useCallback(async () => {
    try {
      const participationsData = await withRetry(() => EventParticipation.list('-responded_at', 200));
      setEventParticipations(participationsData || []);
    } catch (error) {
      console.error('Error loading event participations:', error);
      setEventParticipations([]);
    }
  }, []);

  const loadNotificationStatuses = useCallback(async () => {
    if (isCacheValid('notifications')) {
      console.log('Using cached notification statuses');
      return;
    }

    setIsLoadingNotifications(true);
    try {
      const reports = await withRetry(() => GeneratedReport.list('-generated_at', 100), 2, 2000);
      setNotificationStatuses(reports || []);
      setLastLoadTime(prev => ({ ...prev, notifications: Date.now() }));
    } catch (error) {
      console.error('Error loading notification statuses:', error);
      setNotificationStatuses([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [isCacheValid]);

  const loadWeeklyCheckins = useCallback(async () => {
    if (isCacheValid('checkins')) {
      console.log('Using cached weekly checkins');
      return;
    }

    setIsLoadingCheckins(true);
    try {
      const checkins = await withRetry(() => WeeklyCheckin.list('-submitted_at', 200), 2, 2000);
      setWeeklyCheckins(checkins || []);
      setLastLoadTime(prev => ({ ...prev, checkins: Date.now() }));
    } catch (error) {
      console.error('Error loading weekly checkins:', error);
      setWeeklyCheckins([]);
    } finally {
      setIsLoadingCheckins(false);
    }
  }, [isCacheValid]);

  const loadTraineeResponses = useCallback(async () => {
    if (isCacheValid('responses')) {
      console.log('Using cached trainee responses');
      return;
    }

    setIsLoadingResponses(true);
    try {
      const responses = await withRetry(() => NotificationResponse.list('-responded_at', 200), 2, 2000);
      setTraineeResponses(responses || []);
      setLastLoadTime(prev => ({ ...prev, responses: Date.now() }));
    } catch (error) {
      console.error('Error loading trainee responses:', error);
      setTraineeResponses([]);
    } finally {
      setIsLoadingResponses(false);
    }
  }, [isCacheValid]);

  const loadBoosterRequests = useCallback(async () => {
    if (isCacheValid('boosterRequests')) {
      console.log('Using cached booster requests');
      return;
    }

    setIsLoadingBoosterRequests(true);
    try {
      const requests = await withRetry(() => CoachNotification.filter({ 
        notification_type: 'booster_request',
        is_read: false 
      }, '-created_date', 100), 2, 2000);
      setBoosterRequests(requests || []);
      setLastLoadTime(prev => ({ ...prev, boosterRequests: Date.now() }));
    } catch (error) {
      console.error('Error loading booster requests:', error);
      setBoosterRequests([]);
    } finally {
      setIsLoadingBoosterRequests(false);
    }
  }, [isCacheValid]);

  const loadEventResponses = useCallback(async () => {
    if (isCacheValid('events')) {
      console.log('Using cached event responses');
      return;
    }

    setIsLoadingEvents(true);
    try {
      // Ensure groupEvents are loaded before proceeding, and use a local copy for potential state lag
      let currentGroupEvents = groupEvents;
      if (!isCacheValid('groupEvents') || groupEvents.length === 0) {
        await loadGroupEvents(); // This updates the state asynchronously
        // For immediate use within this function, re-fetch or use a temp variable if needed
        // For now, rely on `groupEvents` being in the dependency array to trigger memoization correctly.
        // If it's empty after loadGroupEvents, it means the state hasn't updated yet.
        // A direct fetch here might be more robust if there are immediate dependencies.
        // For simplicity, we'll assume `groupEvents` will be available after `await loadGroupEvents()`.
        // A more robust approach might pass the result of loadGroupEvents back or fetch it again here if needed.
        // Given the current structure, adding a slight delay or re-checking `groupEvents` after the await might be useful.
        // However, the `groupEvents` in the dependency array of the memoized function implies it's updated.
      }
      
      const [participations, notificationResponsesEvents] = await Promise.all([
        withRetry(() => EventParticipation.list('-responded_at'), 2, 3000),
        withRetry(() => NotificationResponse.filter({ notification_type: 'event' }, '-responded_at'), 2, 3000)
      ]);

      // Using the potentially updated `groupEvents` from the dependency array for mapping.
      const combinedResponses = [
        ...participations.map(p => ({
          id: p.id,
          user_email: p.user_email,
          event_id: p.event_id,
          status: p.status,
          responded_at: p.responded_at,
          type: 'event_participation',
          notification_title: groupEvents.find(ge => ge.id === p.event_id)?.event_title || `אירוע ${p.event_id}`
        })),
        ...notificationResponsesEvents.map(nr => ({
          id: nr.id,
          user_email: nr.user_email,
          user_name: nr.user_name,
          event_id: nr.notification_id,
          status: nr.response_status,
          responded_at: nr.responded_at,
          response_details: nr.response_details,
          notification_title: nr.notification_title,
          type: 'notification_response'
        }))
      ];

      combinedResponses.sort((a, b) => new Date(b.responded_at) - new Date(a.responded_at));

      setEventResponses(combinedResponses);
      setLastLoadTime(prev => ({ ...prev, events: Date.now() }));
    } catch (error) {
      console.error('Error loading event responses:', error);
      setEventResponses([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [loadGroupEvents, isCacheValid, groupEvents]); // Added groupEvents to dependency array as it's used within

  // Load data for specific tab when accessed
  const loadTabData = useCallback(async (tabName) => {
    if (loadedTabs.has(tabName) && isCacheValid(tabName)) {
      return;
    }

    console.log(`Loading data for tab: ${tabName}`);
    
    switch (tabName) {
      case 'notifications':
        await loadNotificationStatuses();
        break;
      case 'checkins':
        await loadWeeklyCheckins();
        break;
      case 'responses':
        await loadTraineeResponses();
        break;
      case 'events':
        await loadEventResponses();
        break;
      case 'booster':
        await loadBoosterRequests();
        break;
      default:
        break;
    }

    setLoadedTabs(prev => new Set([...prev, tabName]));
  }, [loadedTabs, isCacheValid, loadNotificationStatuses, loadWeeklyCheckins, loadTraineeResponses, loadEventResponses, loadBoosterRequests]);

  // Handle tab change with lazy loading
  const handleTabChange = useCallback(async (newTab) => {
    setActiveTab(newTab);
    await loadTabData(newTab);
  }, [loadTabData]);

  // Load base data (users, all users, groups, event participations) once on mount
  useEffect(() => {
    const loadBaseData = async () => {
      console.log('Loading initial base data (users, allUsers, groups, participations)...');
      await loadUsers(); // Load trainees for the main list
      await loadAllUsersAndGroups(); // Load all users and groups for filtering
      await loadEventParticipations();
      await loadGroupEvents();
    };
    loadBaseData();
  }, [loadUsers, loadAllUsersAndGroups, loadEventParticipations, loadGroupEvents]);

  // Load initial tab data only
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // Memo for users to display in the new trainee filter dropdown
  const usersForDropdown = useMemo(() => {
    let usersToDisplay = [...users]; // Start with all trainees

    // If a group is selected, filter the dropdown to only show trainees in that group
    if (selectedGroup !== 'all') {
      usersToDisplay = usersToDisplay.filter(user => user.group_names?.includes(selectedGroup));
    }

    // Sort by name
    return usersToDisplay.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users, selectedGroup]);

  // Memo for filtering data based on selected group AND selected user email
  const filteredUsersEmails = useMemo(() => {
    // If a specific user email is selected, prioritize it
    if (selectedUserEmailFilter !== 'all') {
        return new Set([selectedUserEmailFilter]);
    }
    // If no specific user is selected but a group is, filter by group
    if (selectedGroup !== 'all') {
        // We filter the 'users' state (which contains trainees) based on group_names
        // and map their emails. This means only trainees within the selected group
        // will be included.
        const groupTrainees = users.filter(user => user.group_names?.includes(selectedGroup));
        return new Set(groupTrainees.map(user => user.email));
    }
    // If neither a specific user nor a group is selected, no email filter applied
    return null;
  }, [selectedGroup, selectedUserEmailFilter, users]);

  // Apply group filter to general notification statuses
  const filteredNotificationStatuses = useMemo(() => {
    if (!filteredUsersEmails) return notificationStatuses;
    return notificationStatuses.filter(report => filteredUsersEmails.has(report.user_email));
  }, [notificationStatuses, filteredUsersEmails]);

  // Apply group filter to weekly checkins
  const filteredWeeklyCheckins = useMemo(() => {
    if (!filteredUsersEmails) return weeklyCheckins;
    return weeklyCheckins.filter(checkin => filteredUsersEmails.has(checkin.user_email));
  }, [weeklyCheckins, filteredUsersEmails]);

  // Summary for weekly checkins, grouped by week number
  const weeklyCheckinsSummary = useMemo(() => {
    // Use filteredWeeklyCheckins to respect the group/user filter
    const groupedByWeek = filteredWeeklyCheckins.reduce((acc, checkin) => {
      const weekKey = checkin.week_number;
      if (!acc[weekKey]) {
        acc[weekKey] = {
          week_number: checkin.week_number,
          responses: []
        };
      }
      acc[weekKey].responses.push(checkin);
      return acc;
    }, {});

    // Sort weeks by week_number descending
    return Object.values(groupedByWeek).sort((a, b) => b.week_number - a.week_number);
  }, [filteredWeeklyCheckins]);

  // Apply group filter to trainee responses
  const filteredTraineeResponses = useMemo(() => {
    if (!filteredUsersEmails) return traineeResponses;
    return traineeResponses.filter(response => filteredUsersEmails.has(response.user_email));
  }, [traineeResponses, filteredUsersEmails]);

  // Create user activity summary (still based on trainees)
  const usersWithActivity = useMemo(() => {
    return users.map(user => {
      const userCheckins = weeklyCheckins.filter(c => c.user_email === user.email);
      const userResponses = traineeResponses.filter(r => r.user_email === user.email);
      const userReports = notificationStatuses.filter(r => r.user_email === user.email);
      const userEventParticipations = eventParticipations.filter(p => p.user_email === user.email);

      const totalActivity = userCheckins.length + userResponses.length + userReports.length + userEventParticipations.length;
      
      const allActivities = [
        ...userCheckins.map(c => ({ type: 'checkin', date: c.submitted_at })),
        ...userResponses.map(r => ({ type: 'response', date: r.responded_at })),
        ...userReports.map(r => ({ type: 'report', date: r.generated_at })),
        ...userEventParticipations.map(p => ({ type: 'event', date: p.responded_at }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      const lastActivity = allActivities[0];

      return {
        ...user,
        activity: {
          total: totalActivity,
          checkins: userCheckins.length,
          responses: userResponses.length,
          reports: userReports.length,
          events: userEventParticipations.length,
          lastActivity: lastActivity ? new Date(lastActivity.date) : null,
          lastActivityType: lastActivity?.type || null
        },
        data: {
          checkins: userCheckins,
          responses: userResponses,
          reports: userReports,
          events: userEventParticipations
        }
      };
    });
  }, [users, weeklyCheckins, traineeResponses, notificationStatuses, eventParticipations]);

  // Filter users based on search, activity level, and selected group/user
  const filteredUsers = useMemo(() => {
    let currentUsers = usersWithActivity;

    if (filteredUsersEmails) {
        currentUsers = currentUsers.filter(user => filteredUsersEmails.has(user.email));
    }

    return currentUsers.filter(user => {
      const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesActivity = activityFilter === 'all' ||
                             (activityFilter === 'active' && user.activity.total > 0) ||
                             (activityFilter === 'inactive' && user.activity.total === 0) ||
                             (activityFilter === 'high' && user.activity.total > 5);
      
      return matchesSearch && matchesActivity;
    });
  }, [usersWithActivity, searchTerm, activityFilter, filteredUsersEmails]);

  // Enhanced event responses summary with event details and group/user filtering, and trainee names
  const eventResponsesSummary = useMemo(() => {
    // Create a map for quick user name lookup from all users
    const userMap = new Map(allUsersData.map(u => [u.email, u.name]));

    const grouped = eventResponses.reduce((acc, response) => {
      // Apply group/user filter here too, so only relevant responses are grouped
      if (filteredUsersEmails && !filteredUsersEmails.has(response.user_email)) {
        return acc;
      }

      const eventId = response.event_id;
      if (!acc[eventId]) {
        const eventDetails = groupEvents.find(e => e.id === eventId);
        
        acc[eventId] = {
          event_id: eventId,
          event_title: eventDetails?.event_title || response.notification_title || `אירוע ${eventId}`,
          event_date: eventDetails?.start_datetime ? format(parseISO(eventDetails.start_datetime), 'dd/MM/yyyy HH:mm', { locale: he }) : null,
          event_description: eventDetails?.event_description || null,
          responses: [],
          participating: 0,
          not_participating: 0,
          maybe: 0,
          other: 0,
          total: 0
        };
      }
      
      // Enrich the response with user_name
      // Prioritize existing user_name on response, then userMap, then email
      const enrichedResponse = {
        ...response,
        user_name: response.user_name || userMap.get(response.user_email) || response.user_email,
      };

      acc[eventId].responses.push(enrichedResponse);
      acc[eventId].total++;
      
      switch(enrichedResponse.status) { // Use enrichedResponse.status
        case 'participating':
          acc[eventId].participating++;
          break;
        case 'not_participating':
          acc[eventId].not_participating++;
          break;
        case 'maybe':
          acc[eventId].maybe++;
          break;
        default:
          acc[eventId].other++;
      }
      
      return acc;
    }, {});
    
    return Object.values(grouped).sort((a, b) => {
      // Sort by event date (newest first), then by total responses if dates are same
      // event_date in summary is a formatted string, so parse it for sorting
      const dateA = a.event_date ? parseISO(a.event_date.split(' ')[0]) : null; // Parse only date part
      const dateB = b.event_date ? parseISO(b.event_date.split(' ')[0]) : null; // Parse only date part

      if (dateA && dateB) {
        const dateComparison = dateB.getTime() - dateA.getTime();
        if (dateComparison !== 0) return dateComparison;
      } else if (dateA) { // A has date, B doesn't, A comes first (more recent)
        return -1;
      } else if (dateB) { // B has date, A doesn't, B comes first
        return 1;
      }
      return b.total - a.total; // Fallback to total if no dates
    });
  }, [eventResponses, groupEvents, filteredUsersEmails, allUsersData]); // Added 'allUsersData' to dependencies

  const handleUserClick = (user) => {
    setSelectedUser(user); // This is the selectedUser for the dialog, full object
    setIsDetailDialogOpen(true);
  };

  const getActivityLevelBadge = (total) => {
    if (total === 0) return <Badge variant="secondary">לא פעיל</Badge>;
    if (total <= 3) return <Badge className="bg-yellow-100 text-yellow-800">פעילות נמוכה</Badge>;
    if (total <= 10) return <Badge className="bg-green-100 text-green-800">פעילות טובה</Badge>;
    return <Badge className="bg-blue-100 text-blue-800">פעילות גבוהה</Badge>;
  };

  const getActivityTypeIcon = (type) => {
    switch(type) {
      case 'checkin': return <MessageCircle className="w-4 h-4" />;
      case 'response': return <Bell className="w-4 h-4" />;
      case 'report': return <FileText className="w-4 h-4" />;
      case 'event': return <Calendar className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getParticipationStatusBadge = (status) => {
    const statusConfig = {
      'participating': { label: 'מגיע/ה', className: 'bg-green-100 text-green-800', icon: '✅' },
      'not_participating': { label: 'לא מגיע/ה', className: 'bg-red-100 text-red-800', icon: '❌' },
      'maybe': { label: 'אולי', className: 'bg-yellow-100 text-yellow-800', icon: '❓' }
    };
    
    const config = statusConfig[status] || { label: status, className: 'bg-slate-100 text-slate-800', icon: '❔' };
    
    return (
      <Badge className={config.className}>
        <span className="ml-1">{config.icon}</span>
        {config.label}
      </Badge>
    );
  };

  // Helper function for date formatting
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'dd/MM HH:mm', { locale: he });
    } catch (e) {
      console.error("Error parsing date:", dateString, e);
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">📊 סטטוס והתראות</h2>
        <p className="text-slate-600">מעקב אחר פעילות המתאמנים והתגובות שלהם</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5 text-slate-600" />
            סינונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="group-select">סינון לפי קבוצה</Label>
              <Select
                value={selectedGroup}
                onValueChange={(value) => {
                  setSelectedGroup(value);
                  setSelectedUserEmailFilter('all'); // Reset user filter when group changes
                }}
              >
                <SelectTrigger id="group-select">
                  <SelectValue placeholder="בחר קבוצה..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הקבוצות</SelectItem>
                  {userGroups.map(group => (
                    <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="user-select">סינון לפי מתאמן</Label>
              <Popover open={isUserPickerOpen} onOpenChange={setIsUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserPickerOpen}
                    className="w-full justify-between"
                    id="user-select"
                  >
                    <span className="truncate">
                      {selectedUserEmailFilter === 'all'
                        ? "כל המתאמנים"
                        : users.find(u => u.email === selectedUserEmailFilter)?.name || selectedUserEmailFilter}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="חפש מתאמן..." />
                    <CommandList>
                      <CommandEmpty>לא נמצא מתאמן.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setSelectedUserEmailFilter('all');
                            setIsUserPickerOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedUserEmailFilter === 'all' ? "opacity-100" : "opacity-0")} />
                          כל המתאמנים
                        </CommandItem>
                        {usersForDropdown.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.email}
                            onSelect={(currentValue) => {
                              setSelectedUserEmailFilter(currentValue === selectedUserEmailFilter ? 'all' : currentValue);
                              setIsUserPickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedUserEmailFilter === user.email ? "opacity-100" : "opacity-0")} />
                            {user.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="booster" className="text-xs sm:text-sm py-2">
            <Bell className="w-4 h-4 mr-1 text-orange-600" />
            בקשות בוסטר
            {boosterRequests.length > 0 && (
              <Badge className="ml-1 bg-orange-500 text-white">{boosterRequests.length}</Badge>
            )}
            {isCacheValid('boosterRequests') && (
              <div className="w-2 h-2 bg-green-500 rounded-full ml-1" title="נתונים עדכניים" />
            )}
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs sm:text-sm py-2">
            <Calendar className="w-4 h-4 mr-1 text-red-600" />
            אירועים
            {isCacheValid('events') && (
              <div className="w-2 h-2 bg-green-500 rounded-full ml-1" title="נתונים עדכניים" />
            )}
          </TabsTrigger>
          <TabsTrigger value="checkins" className="text-xs sm:text-sm py-2">
            <MessageCircle className="w-4 h-4 mr-1" />
            צ'ק-אינים
            {isCacheValid('checkins') && (
              <div className="w-2 h-2 bg-green-500 rounded-full ml-1" title="נתונים עדכניים" />
            )}
          </TabsTrigger>
          <TabsTrigger value="responses" className="text-xs sm:text-sm py-2">
            <UsersIcon className="w-4 h-4 mr-1" />
            תגובות
            {isCacheValid('responses') && (
              <div className="w-2 h-2 bg-green-500 rounded-full ml-1" title="נתונים עדכניים" />
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm py-2">
            <ClipboardCheck className="w-4 h-4 mr-1" />
            התראות
            {isCacheValid('notifications') && (
              <div className="w-2 h-2 bg-green-500 rounded-full ml-1" title="נתונים עדכניים" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* 'notifications' tab content */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                סטטוס התראות ({filteredNotificationStatuses.length} דוחות)
              </CardTitle>
              <CardDescription>סיכום כללי של דוחות וסטטוסים</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingNotifications ? (
                  <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 ml-2" />
                      <span className="text-slate-600">טוען דוחות...</span>
                  </div>
              ) : filteredNotificationStatuses.length === 0 ? (
                  <p className="text-center py-8 text-slate-500">
                    לא נמצאו התראות עבור הקבוצה/מתאמן שנבחר/ה.
                  </p>
              ) : (
                  <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                          {filteredNotificationStatuses.map((report, index) => (
                              <div key={report.id || index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                  <div className="flex-1">
                                      <p className="font-medium text-slate-800">{report.user_name || report.user_email}</p>
                                      <p className="text-sm text-slate-600">
                                          סוג: {report.report_type}, תקופה: {format(parseISO(report.start_date), 'dd/MM')} - {format(parseISO(report.end_date), 'dd/MM')}
                                      </p>
                                  </div>
                                  <span className="text-xs text-slate-500">
                                      {formatDateTime(report.generated_at)}
                                  </span>
                              </div>
                          ))}
                      </div>
                  </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 'checkins' tab content */}
        <TabsContent value="checkins" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                צ'ק-אינים שבועיים
              </CardTitle>
              <CardDescription>סיכום דיווחי צ'ק-אין שבועיים מהמתאמנים</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCheckins ? (
                  <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 ml-2" />
                      <span className="text-slate-600">טוען צ'ק-אינים...</span>
                  </div>
              ) : weeklyCheckinsSummary.length === 0 ? (
                  <p className="text-center py-8 text-slate-500">
                    לא נמצאו צ'ק-אינים עבור הקבוצה/מתאמן שנבחר/ה.
                  </p>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {weeklyCheckinsSummary.map((week) => (
                    <AccordionItem key={`week-${week.week_number}`} value={`week-${week.week_number}`} className="border rounded-lg">
                      <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="flex justify-between w-full">
                          <span className="font-semibold">שבוע {week.week_number}</span>
                          <Badge>{week.responses.length} תגובות</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 border-t">
                        <div className="space-y-3">
                          {week.responses.map(checkin => (
                            <div key={checkin.id} className="p-3 bg-slate-50 rounded-md">
                              <p className="font-semibold text-sm">{checkin.user_name || checkin.user_email}</p>
                              <p className="text-xs text-slate-600 mt-1">
                                <strong>שאלה:</strong> {checkin.question_text}
                              </p>
                              <p className="text-sm mt-1">
                                <strong>תשובה:</strong> {checkin.answer_text}
                              </p>
                              <p className="text-xs text-slate-400 mt-2 text-left">{formatDateTime(checkin.submitted_at)}</p>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 'responses' tab content - Now displays detailed trainee responses */}
        <TabsContent value="responses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-purple-600" />
                תגובות מתאמנים ({filteredTraineeResponses.length})
              </CardTitle>
              <CardDescription>
                תגובות המתאמנים להתראות שהונפקו
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter Controls are intentionally removed from here as per outline's implied change */}
              {isLoadingResponses ? (
                  <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 ml-2" />
                      <span className="text-slate-600">טוען תגובות...</span>
                  </div>
              ) : filteredTraineeResponses.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <UserIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">לא נמצאו תגובות מתאמנים עבור הקבוצה/מתאמן שנבחר/ה.</p>
                  <p className="text-sm">נסה לשנות את תנאי הסינון או הקבוצה.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="grid gap-4">
                    <AnimatePresence>
                      {filteredTraineeResponses.map((response) => (
                        <motion.div
                          key={response.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                        >
                          <Card className="hover:shadow-md transition-all duration-200">
                            <CardContent className="p-4 flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-semibold text-slate-800 text-md">
                                  {response.notification_title || 'התראה ללא כותרת'}
                                </h3>
                                <p className="text-sm text-slate-600 mb-1">
                                  {response.user_name || response.user_email}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{response.notification_type}</Badge>
                                  <Badge className={`${
                                    response.response_status === 'participating' ? 'bg-green-100 text-green-800' :
                                    response.response_status === 'not_participating' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {response.response_status === 'participating' ? 'משתתף' :
                                     response.response_status === 'not_participating' ? 'לא משתתף' :
                                     response.response_status === 'maybe' ? 'אולי' : response.response_status}
                                  </Badge>
                                </div>
                                {response.response_details && (
                                  <p className="text-sm text-slate-600 mt-2">
                                    <strong>פרטים:</strong> {response.response_details}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 text-right">
                                {formatDateTime(response.responded_at)}
                              </span>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 'booster' tab content */}
        <TabsContent value="booster" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-600" />
                בקשות להצטרפות לתכנית הבוסטר ({boosterRequests.length})
              </CardTitle>
              <CardDescription>
                בקשות מתאמנים להצטרף לתכנית הבוסטר
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBoosterRequests ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-600 ml-2" />
                  <span className="text-slate-600">טוען בקשות בוסטר...</span>
                </div>
              ) : boosterRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>אין בקשות פתוחות להצטרפות לתכנית הבוסטר.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {boosterRequests.map((request) => (
                      <Card key={request.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-slate-800 text-lg">
                                  {request.notification_title}
                                </h3>
                                <Badge className="bg-orange-100 text-orange-800">חדש</Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">
                                <strong>מתאמן/ת:</strong> {request.user_name || request.user_email}
                              </p>
                              <p className="text-sm text-slate-600 mb-2">
                                {request.notification_message}
                              </p>
                              {request.notification_details && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm">
                                  <p><strong>אימייל:</strong> {request.notification_details.user_email}</p>
                                  {request.notification_details.coach_name && (
                                    <p><strong>מאמן:</strong> {request.notification_details.coach_name}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-2">
                                    תאריך בקשה: {formatDateTime(request.created_date)}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await CoachNotification.update(request.id, { is_read: true });
                                    setBoosterRequests(prev => prev.filter(r => r.id !== request.id));
                                    setLastLoadTime(prev => ({ ...prev, boosterRequests: Date.now() - CACHE_DURATION }));
                                  } catch (error) {
                                    console.error('Error marking request as read:', error);
                                    alert('שגיאה בסימון הבקשה כנקראה');
                                  }
                                }}
                              >
                                סמן כנקרא
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New 'events' tab content from outline */}
        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-red-600" />
                סיכום תגובות לאירועים
              </CardTitle>
              <CardDescription>
                מעקב אחר התגובות של המתאמנים לאירועים שנוצרו
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 ml-2" />
                  <span className="text-slate-600">טוען תגובות לאירועים...</span>
                </div>
              ) : eventResponsesSummary.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>לא נמצאו תגובות לאירועים עבור הקבוצה/מתאמן שנבחר/ה.</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {eventResponsesSummary.map((eventSummary) => (
                    <AccordionItem key={eventSummary.event_id} value={eventSummary.event_id} className="border rounded-lg">
                      <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="flex justify-between w-full items-center">
                          <div className="flex-1 text-right">
                            <p className="font-semibold text-slate-800">{eventSummary.event_title}</p>
                            {eventSummary.event_date && (
                                <p className="text-sm text-slate-600 mt-1">
                                    📅 {eventSummary.event_date}
                                </p>
                            )}
                          </div>
                          <div className="flex gap-2 mr-4">
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              מגיעים: {eventSummary.participating}
                            </Badge>
                            <Badge variant="outline" className="bg-red-100 text-red-800">
                              לא מגיעים: {eventSummary.not_participating}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 border-t">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">שם מתאמן</TableHead>
                                        <TableHead className="text-right">סטטוס</TableHead>
                                        <TableHead className="text-right">תאריך תגובה</TableHead>
                                        <TableHead className="text-right">פרטים נוספים</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {eventSummary.responses.map(response => (
                                        <TableRow key={response.id}>
                                            <TableCell className="p-2">
                                                <div>
                                                    <div className="font-medium text-slate-800">
                                                        {response.user_name}
                                                    </div>
                                                    {response.user_name !== response.user_email && (
                                                        <div className="text-xs text-slate-500">
                                                            {response.user_email}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    response.status === 'participating' 
                                                        ? 'bg-green-100 text-green-800'
                                                        : response.status === 'not_participating'
                                                        ? 'bg-red-100 text-red-800'
                                                        : response.status === 'maybe'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-slate-100 text-slate-800'
                                                }`}>
                                                    {response.status === 'participating' ? 'משתתף' :
                                                    response.status === 'not_participating' ? 'לא משתתף' :
                                                    response.status === 'maybe' ? 'אולי' : response.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="p-2 text-slate-600">
                                                {formatDateTime(response.responded_at)}
                                            </TableCell>
                                            <TableCell className="p-2 text-slate-600">
                                                {response.response_details || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Detail Dialog (remains unchanged from original code, but `filteredUsers` affects which users are clickable) */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" dir="rtl">
          {selectedUser && (
            <>
              <DialogHeader className="pb-4">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                    {(selectedUser.name || selectedUser.email || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <div>{selectedUser.name || 'חסר שם'}</div>
                    <div className="text-sm text-slate-600 font-normal">{selectedUser.email}</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="max-h-[70vh] px-1">
                <Tabs defaultValue="checkins" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="checkins">
                      צ'ק-אין שבועי ({selectedUser.data.checkins.length})
                    </TabsTrigger>
                    <TabsTrigger value="responses">
                      תגובות ({selectedUser.data.responses.length})
                    </TabsTrigger>
                    <TabsTrigger value="reports">
                      דוחות ({selectedUser.data.reports.length})
                    </TabsTrigger>
                    <TabsTrigger value="events">
                      אירועים ({selectedUser.data.events.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="checkins" className="mt-4">
                    <div className="space-y-3">
                      {selectedUser.data.checkins.map((checkin, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-800 mb-2">
                                  שבוע {checkin.week_number}
                                </p>
                                <p className="text-sm text-slate-600 mb-2">
                                  <strong>שאלה:</strong> {checkin.question_text}
                                </p>
                                <p className="text-sm">
                                  <strong>תשובה:</strong> {checkin.answer_text}
                                </p>
                              </div>
                              <span className="text-xs text-slate-500">
                                {format(new Date(checkin.submitted_at), 'dd/MM/yyyy HH:mm')}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {selectedUser.data.checkins.length === 0 && (
                        <p className="text-center py-8 text-slate-500">אין דיווחי צ'ק-אין</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="responses" className="mt-4">
                    <div className="space-y-3">
                      {selectedUser.data.responses.map((response, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-800 mb-2">
                                  {response.notification_title}
                                </p>
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">{response.notification_type}</Badge>
                                  <Badge className={`${
                                    response.response_status === 'participating' ? 'bg-green-100 text-green-800' :
                                    response.response_status === 'not_participating' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {response.response_status === 'participating' ? 'משתתף' :
                                     response.response_status === 'not_participating' ? 'לא משתתף' :
                                     'אחר'}
                                  </Badge>
                                </div>
                                {response.response_details && (
                                  <p className="text-sm text-slate-600">
                                    <strong>פרטים:</strong> {response.response_details}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">
                                {format(new Date(response.responded_at), 'dd/MM/yyyy HH:mm')}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {selectedUser.data.responses.length === 0 && (
                        <p className="text-center py-8 text-slate-500">אין תגובות להתראות</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="reports" className="mt-4">
                    <div className="space-y-3">
                      {selectedUser.data.reports.map((report, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">{report.report_type}</Badge>
                                  {report.viewed_by_coach ? (
                                    <Badge className="bg-green-100 text-green-800">
                                      <Eye className="w-3 h-3 ml-1" />
                                      נצפה
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-yellow-100 text-yellow-800">
                                      חדש
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600">
                                  תקופת הדוח: {format(new Date(report.start_date), 'dd/MM/yyyy')} - {format(new Date(report.end_date), 'dd/MM/yyyy')}
                                </p>
                              </div>
                              <span className="text-xs text-slate-500">
                                {format(new Date(report.generated_at), 'dd/MM/yyyy HH:mm')}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {selectedUser.data.reports.length === 0 && (
                        <p className="text-center py-8 text-slate-500">אין דוחות שנוצרו</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="events" className="mt-4">
                    <div className="space-y-3">
                      {selectedUser.data.events.map((event, index) => {
                        const groupEvent = groupEvents.find(e => e.id === event.event_id);
                        return (
                          <Card key={index}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-800 mb-2">
                                    {groupEvent?.event_title || 'אירוע לא ידוע'}
                                  </p>
                                  <div className="flex items-center gap-2 mb-2">
                                    {groupEvent && (
                                      <Badge variant="outline">
                                        {groupEvent.event_type === 'workout' ? 'אימון' :
                                         groupEvent.event_type === 'meeting' ? 'פגישה' :
                                         groupEvent.event_type === 'assessment' ? 'מדידות' : 'אחר'}
                                      </Badge>
                                    )}
                                    {getParticipationStatusBadge(event.status)}
                                  </div>
                                  {groupEvent && (
                                    <p className="text-sm text-slate-600 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {format(new Date(groupEvent.start_datetime), 'dd/MM/yyyy HH:mm', { locale: he })}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">
                                  הגיב: {format(new Date(event.responded_at), 'dd/MM HH:mm')}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {selectedUser.data.events.length === 0 && (
                        <p className="text-center py-8 text-slate-500">אין תגובות לאירועים</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
