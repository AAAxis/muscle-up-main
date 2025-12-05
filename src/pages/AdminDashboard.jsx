
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from '@/api/entities';
import LockedScreen from '@/components/auth/LockedScreen';

// Lucide Icons for navigation
import { Users, BarChart, Dumbbell, MessageSquare, ClipboardCheck, Mail, TrendingUp, Scale, Settings, Key, LayoutDashboard, FileText, Activity, Lock, Bell } from 'lucide-react'; // Added Activity, Lock, and Bell

// Import all management components
import UserManagement from '@/components/admin/UserManagement';
import UserInvitation from '@/components/admin/UserInvitation';
import BoosterProgramManager from '@/components/admin/BoosterProgramManager';
import GroupManagement from '@/components/admin/GroupManagement';
import RecipeAccessManager from '@/components/admin/RecipeAccessManager';
import LecturesManager from '@/components/admin/LecturesManager';
import WorkoutCreator from '@/components/admin/WorkoutCreator';
import WorkoutTemplatesManager from '@/components/admin/WorkoutTemplatesManager';
import TraineeReportsViewer from '@/components/admin/TraineeReportsViewer';
import SharedMealsViewer from '@/components/admin/SharedMealsViewer';
import ProgressPicturesViewer from '@/components/admin/ProgressPicturesViewer';
import TerminationFeedbackViewer from '@/components/admin/TerminationFeedbackViewer';
import WeightUpdateManager from '@/components/admin/WeightUpdateManager';
import UserSettingsManager from '@/components/admin/UserSettingsManager';
import MenuManagement from '@/components/admin/MenuManagement';
import WeeklyTaskManager from '@/components/admin/WeeklyTaskManager';
import ExerciseLibraryManager from '@/components/admin/ExerciseLibraryManager';
import GroupWeightFocus from '@/components/admin/GroupWeightFocus';
import UnifiedNotificationsViewer from '@/components/admin/UnifiedNotificationsViewer';
import ControlCenter from '@/components/admin/ControlCenter';
import ContractEditor from '@/components/admin/ContractEditor';
import UserTracker from '@/components/admin/BoosterPlusManager'; // Changed BoosterPlusManager import to UserTracker
import GroupNotifications from '@/components/admin/GroupNotifications';

// UI components for ContractEditor dialog (Dialog, DialogContent, etc. are no longer used for ContractEditor)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";


export default function AdminDashboard({ activeTab: externalActiveTab, setActiveTab: externalSetActiveTab, hideNavigation = false, onNavigateToTab: externalNavigateToTab }) {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get tab from URL params, fallback to external prop, then default to 'control-center'
  const urlTab = params.tab;
  const urlSubTab = params.subTab;
  const initialTab = urlTab || externalActiveTab || 'control-center';

  // Internal state for active tab, initialized from URL or external prop or default
  const [internalActiveTab, setInternalActiveTab] = useState(initialTab);

  // States for sub-tabs - initialize from URL if available
  const getInitialSubTab = (mainTab, subTabValue, defaultValue) => {
    if (urlTab === mainTab && urlSubTab) {
      return urlSubTab;
    }
    return defaultValue;
  };

  const [userManagementTab, setUserManagementTab] = useState(getInitialSubTab('user-management', urlSubTab, 'user-list'));
  const [progressMediaTab, setProgressMediaTab] = useState(getInitialSubTab('progress-media', urlSubTab, 'notification-status'));
  const [workoutCreatorTab, setWorkoutCreatorTab] = useState(getInitialSubTab('workout-creator', urlSubTab, 'send-workout'));
  // Changed initial state to null to start collapsed
  const [programsTab, setProgramsTab] = useState(getInitialSubTab('programs', urlSubTab, null));
  const [templateToLoad, setTemplateToLoad] = useState(null);

  // New state for direct user navigation, as per outline
  const [userManagementProps, setUserManagementProps] = useState({});
  const [userSettingsProps, setUserSettingsProps] = useState({}); // New state for UserSettingsManager props

  // Redirect to control-center if no tab in URL (initial load) or if URL contains null
  useEffect(() => {
    if (location.pathname.includes('/null')) {
      // If URL contains /null, redirect to control-center
      navigate('/admindashboard/control-center', { replace: true });
      return;
    }
    if (!urlTab && (location.pathname === '/admindashboard' || location.pathname === '/AdminDashboard')) {
      navigate('/admindashboard/control-center', { replace: true });
    }
  }, [urlTab, location.pathname, navigate]);

  // Initialize tab from URL on mount or when URL changes
  useEffect(() => {
    if (urlTab) {
      // Guard against null/undefined tab values from URL
      if (urlTab === 'null' || urlTab === 'undefined') {
        console.warn('AdminDashboard: Invalid tab in URL, redirecting to control-center');
        navigate('/admindashboard/control-center', { replace: true });
        return;
      }
      
      if (urlTab !== internalActiveTab) {
        setInternalActiveTab(urlTab);
      }
      
      // Update sub-tabs based on URL - ignore null/undefined subTab values
      if (urlSubTab && urlSubTab !== 'null' && urlSubTab !== 'undefined') {
        switch (urlTab) {
          case 'user-management':
            if (userManagementTab !== urlSubTab) {
              setUserManagementTab(urlSubTab);
            }
            break;
          case 'progress-media':
            if (progressMediaTab !== urlSubTab) {
              setProgressMediaTab(urlSubTab);
            }
            break;
          case 'workout-creator':
            if (workoutCreatorTab !== urlSubTab) {
              setWorkoutCreatorTab(urlSubTab);
            }
            break;
          case 'programs':
            if (programsTab !== urlSubTab) {
              setProgramsTab(urlSubTab);
            }
            break;
        }
      } else if (urlSubTab === 'null' || urlSubTab === 'undefined') {
        // If subTab is explicitly "null" or "undefined" in URL, redirect to tab without subTab
        navigate(`/admindashboard/${urlTab}`, { replace: true });
        return;
      } else {
        // If no sub-tab in URL, set defaults and update URL
        switch (urlTab) {
          case 'user-management':
            if (userManagementTab !== 'user-list') {
              setUserManagementTab('user-list');
              navigate(`/admindashboard/user-management/user-list`, { replace: true });
            }
            break;
          case 'progress-media':
            if (progressMediaTab !== 'notification-status') {
              setProgressMediaTab('notification-status');
              navigate(`/admindashboard/progress-media/notification-status`, { replace: true });
            }
            break;
          case 'workout-creator':
            if (workoutCreatorTab !== 'send-workout') {
              setWorkoutCreatorTab('send-workout');
              navigate(`/admindashboard/workout-creator/send-workout`, { replace: true });
            }
            break;
        }
      }
    }
  }, [urlTab, urlSubTab, internalActiveTab, navigate, userManagementTab, progressMediaTab, workoutCreatorTab, programsTab]);

  // Update internal state when external activeTab changes (for backward compatibility)
  useEffect(() => {
    if (externalActiveTab && externalActiveTab !== internalActiveTab && !urlTab) {
      setInternalActiveTab(externalActiveTab);
    }
  }, [externalActiveTab, internalActiveTab, urlTab]);

  // Update external state when internal activeTab changes - Enhanced to handle sub-tabs and props
  // Renamed from handleNavigation in outline to handleTabChange to match existing structure
  const handleTabChange = (newTab, subTab = null, props = {}) => {
    // Guard against null/undefined tab values
    if (!newTab || newTab === 'null' || newTab === 'undefined') {
      console.warn('AdminDashboard: Invalid tab value:', newTab);
      return;
    }
    
    setInternalActiveTab(newTab);
    
    // Update URL when tab changes - ensure subTab is valid and not null/undefined
    if (subTab && subTab !== 'null' && subTab !== 'undefined') {
      navigate(`/admindashboard/${newTab}/${subTab}`, { replace: true });
    } else {
      navigate(`/admindashboard/${newTab}`, { replace: true });
    }
    
    if (externalSetActiveTab) {
      externalSetActiveTab(newTab);
    }

    // Clear props by default for other components
    let newUserManagementProps = {};
    let newUserSettingsProps = {};

    // Handle specific user-related navigation (e.g., from ControlCenter)
    if (props.userEmail) {
      if (newTab === 'user-management') {
        newUserManagementProps = { initialUserEmail: props.userEmail, startInEditMode: props.startInEditMode || false };
        setUserManagementTab('user-list'); // Ensure we are on the user list sub-tab if navigating to a specific user within general user management
      } else if (newTab === 'programs' && subTab === 'user-settings') { // This is the new logic for user-settings
        newUserSettingsProps = {
          initialUserEmail: props.userEmail,
          startInEditMode: props.startInEditMode || false
        };
        setProgramsTab('user-settings'); // Explicitly set the programs sub-tab to user-settings
      }
    }

    setUserManagementProps(newUserManagementProps);
    setUserSettingsProps(newUserSettingsProps);

    // Handle specific sub-tab navigation if subTab is provided
    if (subTab) {
      switch (newTab) {
        case 'user-management':
          setUserManagementTab(subTab);
          break;
        case 'progress-media':
          setProgressMediaTab(subTab);
          break;
        case 'workout-creator':
          setWorkoutCreatorTab(subTab);
          break;
        case 'programs':
          setProgramsTab(subTab);
          break;
      }
    } else {
      // If no specific sub-tab is passed, set default sub-tabs or collapse 'programs'
      if (newTab === 'programs' && !props.userEmail) { // Only collapse if not navigating to a specific user's settings
        setProgramsTab(null);
        // Don't add sub-tab to URL for programs when collapsed
      } else {
        // Default to primary sub-tabs for others if no subTab is specified
        let defaultSubTab = null;
        if (newTab === 'user-management') {
          setUserManagementTab('user-list');
          defaultSubTab = 'user-list';
        } else if (newTab === 'progress-media') {
          setProgressMediaTab('notification-status');
          defaultSubTab = 'notification-status';
        } else if (newTab === 'workout-creator') {
          setWorkoutCreatorTab('send-workout');
          defaultSubTab = 'send-workout';
        }
        
        // Update URL with default sub-tab if applicable
        if (defaultSubTab) {
          navigate(`/admindashboard/${newTab}/${defaultSubTab}`, { replace: true });
        }
      }
    }
  };

  // Expose handleTabChange to parent component
  useEffect(() => {
    if (externalNavigateToTab) {
      externalNavigateToTab(handleTabChange);
    }
  }, [externalNavigateToTab]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        console.log('AdminDashboard: User loaded:', currentUser);
        setUser(currentUser);
      } catch (error) {
        console.error('AdminDashboard: Error loading user:', error);
        // If it's a session error, don't set user to null - let InterfaceRouter handle it
        if (error.message?.includes("Session expired") || 
            error.message?.includes("400") ||
            error.code === 'auth/invalid-user-token') {
          console.warn('AdminDashboard: Session expired, will be handled by InterfaceRouter');
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  // Function to handle loading a template into the WorkoutCreator
  const handleLoadTemplate = (template) => {
    setTemplateToLoad(template);
    handleTabChange('workout-creator', 'send-workout'); // Use handleTabChange to ensure main tab switches with sub-tab
  };

  // Memoized UserManagement component to re-render when initialUserEmail changes (from outline)
  const memoizedUserManagement = useMemo(() => {
    // By using a key, we ensure the component re-mounts with new initial props
    // This is crucial for making the initialUserEmail prop work reliably if UserManagement itself doesn't react to prop changes
    return <UserManagement key={userManagementProps.initialUserEmail || 'default-user-management'} {...userManagementProps} />;
  }, [userManagementProps]);

  // Memoized UserSettingsManager component to re-render when initialUserEmail changes
  const memoizedUserSettingsManager = useMemo(() => {
    // The logic is now entirely self-contained in UserSettingsManager.
    // We just pass the props.
    return <UserSettingsManager
                   key={userSettingsProps.initialUserEmail || 'default-user-settings'}
                   {...userSettingsProps}
               />;
  }, [userSettingsProps]);

  const memoizedGroupManagement = useMemo(() => <GroupManagement />, []);

  // Updated userManagementSubTabs - removed user-tracking
  const userManagementSubTabs = useMemo(() => [
    { id: 'user-list', label: 'רשימת משתמשים', icon: Users },
    { id: 'groups', label: 'ניהול קבוצות', icon: Users },
    { id: 'weight-update', label: 'עדכון משקל', icon: Scale },
    { id: 'recipes', label: 'מתכונים', icon: Lock }
  ], []);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <img
            src="/logo.jpeg"
            alt="טוען..."
            className="w-12 h-12 rounded-2xl object-contain animate-pulse"
          />
          <div className="absolute -inset-1 w-14 h-14 rounded-full border-4 border-blue-300 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Treat 'coach' and 'admin' as admin roles
  const isAdmin = user?.role === 'admin' || user?.role === 'coach';
  if (!user) {
    console.warn('AdminDashboard: No user found');
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-slate-600">טוען משתמש...</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    console.warn('AdminDashboard: User is not admin/coach. Role:', user?.role);
    return <LockedScreen message="גישה מוגבלת - נדרשות הרשאות מנהל" />;
  }

  // Define programs & settings sub-categories with enhanced layout
  // Added user-settings here
  const settingsCategories = [
    {
      value: "user-settings",
      title: "הגדרות משתמשים",
      icon: "⚙️",
      description: "עריכת פרטי משתמשים, קבוצות והגדרות אישיות",
      color: "from-slate-500 to-gray-600"
    },
    {
      value: "booster",
      title: "ניהול בוסטר",
      icon: "🚀",
      description: "הפעלה, איפוס והסרת מתאמנים",
      color: "from-blue-500 to-purple-600"
    },
    {
      value: "weekly-tasks",
      title: "משימות שבועיות",
      icon: "📅",
      description: "ניהול משימות שבועיות למתאמנים",
      color: "from-blue-500 to-cyan-500"
    },
    {
      value: "booster-plus",
      title: "ניהול בוסטר פלוס",
      icon: "✨",
      description: "ניהול תוכנית בוסטר פלוס ויצירה/ניהול תבניות משימות",
      color: "from-pink-500 to-rose-500"
    },
    {
      value: "menu-management",
      title: "ניהול תפריטים",
      icon: "🍽️",
      description: "העלאת תפריטים אישיים",
      color: "from-yellow-500 to-orange-600"
    },
    {
      value: "contract-editor",
      title: "עריכת חוזה",
      icon: "✍️",
      description: "ניהול ועדכון חוזים אישיים",
      color: "from-purple-500 to-indigo-600"
    }
  ];

  // Helper function to handle sub-tab changes with URL update
  const handleSubTabChange = (mainTab, subTab) => {
    // Guard against null/undefined values
    if (!subTab || subTab === 'null' || subTab === 'undefined') {
      console.warn('AdminDashboard: Invalid subTab value:', subTab);
      return;
    }
    
    switch (mainTab) {
      case 'user-management':
        setUserManagementTab(subTab);
        navigate(`/admindashboard/user-management/${subTab}`, { replace: true });
        break;
      case 'progress-media':
        setProgressMediaTab(subTab);
        navigate(`/admindashboard/progress-media/${subTab}`, { replace: true });
        break;
      case 'workout-creator':
        setWorkoutCreatorTab(subTab);
        navigate(`/admindashboard/workout-creator/${subTab}`, { replace: true });
        break;
      case 'programs':
        setProgramsTab(subTab);
        navigate(`/admindashboard/programs/${subTab}`, { replace: true });
        break;
    }
  };

  // Components for each main tab's content, defined inside AdminDashboard to access its state and functions
  const UserManagementTab = () => (
    <Tabs value={userManagementTab} onValueChange={(value) => handleSubTabChange('user-management', value)} className="w-full">
      {/* Updated grid-cols to lg:grid-cols-4 since we now have 4 sub-tabs */}
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 h-auto">
        {userManagementSubTabs.map(cat => (
          <TabsTrigger key={cat.id} value={cat.id} className="text-xs sm:text-sm py-2 flex items-center justify-center gap-2">
            <cat.icon className="w-3 h-3 sm:w-4 sm:h-4" />
            {cat.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="user-list" className="mt-4 sm:mt-6">
        {memoizedUserManagement}
      </TabsContent>
      <TabsContent value="groups" className="mt-4 sm:mt-6">
        {memoizedGroupManagement}
      </TabsContent>
      <TabsContent value="weight-update" className="mt-4 sm:mt-6">
        <WeightUpdateManager />
      </TabsContent>
      {/* Removed TabsContent for user-tracking */}
      <TabsContent value="recipes" className="mt-4 sm:mt-6">
        <RecipeAccessManager />
      </TabsContent>
    </Tabs>
  );

  const ProgressMediaTab = () => (
    <Tabs value={progressMediaTab} onValueChange={(value) => handleSubTabChange('progress-media', value)} className="w-full">
      {/* Adjusted grid-cols to 8 after adding 'Group Notifications' */}
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 h-auto">
        <TabsTrigger value="notification-status" className="text-xs sm:text-sm py-2 flex items-center justify-center gap-1">
          <ClipboardCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          סטטוס והתראות
        </TabsTrigger>
        <TabsTrigger value="group-notifications" className="text-xs sm:text-sm py-2 flex items-center justify-center gap-1">
          <Bell className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          התראות קבוצה
        </TabsTrigger>
        <TabsTrigger value="shared-meals" className="text-xs sm:text-sm py-2">ארוחות משותפות</TabsTrigger>
        <TabsTrigger value="trainee-reports" className="text-xs sm:text-sm py-2">דוחות מתאמנים</TabsTrigger>
        <TabsTrigger value="progress-pictures" className="text-xs sm:text-sm py-2">תמונות התקדמות</TabsTrigger>
        <TabsTrigger value="lectures" className="text-xs sm:text-sm py-2">ניהול הרצאות</TabsTrigger>
        <TabsTrigger value="termination-feedback" className="text-xs sm:text-sm py-2">משוב סיום</TabsTrigger>
        {/* NEW: TabTrigger for Group Weight Focus */}
        <TabsTrigger value="group-weight-focus" className="text-xs sm:text-sm py-2">התקדמות קבוצתית</TabsTrigger>
        {/* Removed: TabTrigger for Shared Images */}
      </TabsList>
      <TabsContent value="notification-status" className="mt-4 sm:mt-6">
        <UnifiedNotificationsViewer />
      </TabsContent>
      <TabsContent value="group-notifications" className="mt-4 sm:mt-6">
        <GroupNotifications />
      </TabsContent>
      <TabsContent value="shared-meals" className="mt-4 sm:mt-6">
        <SharedMealsViewer />
      </TabsContent>
      <TabsContent value="trainee-reports" className="mt-4 sm:mt-6">
        <TraineeReportsViewer />
      </TabsContent>
      <TabsContent value="progress-pictures" className="mt-4 sm:mt-6">
        <ProgressPicturesViewer />
      </TabsContent>
      <TabsContent value="lectures" className="mt-4 sm:mt-6">
        <LecturesManager />
      </TabsContent>
      <TabsContent value="termination-feedback" className="mt-4 sm:mt-6">
        <TerminationFeedbackViewer />
      </TabsContent>
      {/* NEW: TabsContent for Group Weight Focus */}
      <TabsContent value="group-weight-focus" className="mt-4 sm:mt-6">
        <GroupWeightFocus />
      </TabsContent>
      {/* Removed: TabsContent for Shared Images */}
    </Tabs>
  );

  const WorkoutCreatorMainTab = () => { // Renamed to avoid direct name conflict with WorkoutCreator component
    return (
      <Tabs value={workoutCreatorTab} onValueChange={(value) => handleSubTabChange('workout-creator', value)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="send-workout" className="text-xs sm:text-sm py-2">שלח אימון</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs sm:text-sm py-2">תבניות אימון</TabsTrigger>
          <TabsTrigger value="exercise-library" className="text-xs sm:text-sm py-2">מאגר תרגילים</TabsTrigger>
        </TabsList>
        <TabsContent value="send-workout" className="mt-4 sm:mt-6">
          <WorkoutCreator templateToLoad={templateToLoad} onTemplateLoaded={() => setTemplateToLoad(null)} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4 sm:mt-6">
          <WorkoutTemplatesManager onLoadTemplate={handleLoadTemplate} onEditTemplate={handleLoadTemplate} />
        </TabsContent>
        <TabsContent value="exercise-library" className="mt-4 sm:mt-6">
          <ExerciseLibraryManager />
        </TabsContent>
      </Tabs>
    );
  };

  const ProgramsSettingsTab = () => {
    const renderSubComponent = (tab) => {
        switch (tab) {
            case 'user-settings': return <UserSettingsManager {...userSettingsProps} />;
            case 'booster': return <BoosterProgramManager />;
            case 'weekly-tasks': return <WeeklyTaskManager />;
            case 'menu-management': return <MenuManagement />;
            case 'contract-editor': return <ContractEditor />;
            case 'booster-plus': return <UserTracker />; // Now renders UserTracker (which is BoosterPlusManager)
            default: return null;
        }
    };

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-2">⚙️ תוכניות והגדרות</h2>
          <p className="text-slate-600">ניהול מתקדם של תוכניות אימון והגדרות מערכת</p>
        </div>

        <div className="flex flex-col gap-4">
          {settingsCategories.map((category, index) => { // Using the renamed settingsCategories
            const isExpanded = programsTab === category.value;

            return (
              <motion.div
                key={category.value}
                layout
                initial={{ borderRadius: 12 }}
                className="w-full"
              >
                <Card
                  className={`transition-all duration-300 w-full overflow-hidden ${
                    isExpanded
                      ? 'ring-2 ring-blue-500 shadow-xl'
                      : 'hover:shadow-md'
                  }`}
                >
                  <motion.div
                    layout="position"
                    className="flex items-center p-4 cursor-pointer"
                    onClick={() => {
                      const newTab = programsTab === category.value ? null : category.value;
                      setProgramsTab(newTab);
                      if (newTab) {
                        navigate(`/admindashboard/programs/${newTab}`, { replace: true });
                      } else {
                        navigate(`/admindashboard/programs`, { replace: true });
                      }
                    }}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl mr-4 bg-gradient-to-br ${category.color}`}>
                      {category.icon}
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-bold text-slate-800">
                          {category.title}
                        </CardTitle>
                        {isExpanded && (
                          <Badge variant="outline" className="text-blue-600 border-blue-400">
                            פעיל
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-slate-600 text-xs leading-relaxed mt-1">
                        {category.description}
                      </CardDescription>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <Separator className="mx-4 w-auto" />
                        <div className="p-4 sm:p-6">
                          {renderSubComponent(category.value)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    )
  };

  return (
    <div className="max-w-full mx-auto p-2 sm:p-4 space-y-6" dir="rtl">
      {/* Header - Only show when navigation is not hidden */}
      {!hideNavigation && (
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 via-yellow-500 to-blue-500 bg-clip-text text-transparent">
            🏋️‍♂️ לוח ניהול מאמנים
          </h1>
          <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
            ניהול מתאמנים, יצירת אימונים ותוכניות, מעקב התקדמות ועוד.
          </p>
        </div>
      )}

      {/* Navigation Tabs - Only show when navigation is not hidden */}
      {!hideNavigation && (
        <Tabs value={internalActiveTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="grid w-full grid-cols-5 h-14 bg-white shadow-lg rounded-xl border muscle-glass min-w-[600px]">
              {/* Added new Control Center Tab */}
              <TabsTrigger value="control-center" className="flex items-center gap-2 text-xs md:text-sm">
                <LayoutDashboard className="w-4 h-4" />
                מרכז שליטה
              </TabsTrigger>
              <TabsTrigger value="user-management" className="flex items-center gap-2 text-xs md:text-sm">
                <Users className="w-4 h-4" />
                ניהול משתמשים
              </TabsTrigger>
              <TabsTrigger value="progress-media" className="flex items-center gap-2 text-xs md:text-sm">
                <BarChart className="w-4 h-4" />
                התקדמות ומדיה
              </TabsTrigger>
              <TabsTrigger value="workout-creator" className="flex items-center gap-2 text-xs md:text-sm">
                <Dumbbell className="w-4 h-4" />
                יוצר אימונים
              </TabsTrigger>
              <TabsTrigger value="programs" className="flex items-center gap-2 text-xs md:text-sm">
                <Settings className="w-4 h-4" />
                תוכניות והגדרות
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="mt-6">
            {/* Tab Contents */}
            {/* Added new Control Center Content */}
            <TabsContent value="control-center">
              {/* Pass handleTabChange to ControlCenter to enable direct navigation */}
              <ControlCenter onNavigateToTab={handleTabChange} />
            </TabsContent>
            <TabsContent value="user-management">
              <UserManagementTab />
            </TabsContent>
            <TabsContent value="progress-media">
              <ProgressMediaTab />
            </TabsContent>
            <TabsContent value="workout-creator">
              <WorkoutCreatorMainTab />
            </TabsContent>
            <TabsContent value="programs">
              <ProgramsSettingsTab />
            </TabsContent>
          </div>
        </Tabs>
      )}

      {/* Content without navigation wrapper when hideNavigation is true */}
      {hideNavigation && (
        <div>
          {internalActiveTab === 'control-center' && <ControlCenter onNavigateToTab={handleTabChange} />}
          {internalActiveTab === 'user-management' && <UserManagementTab />}
          {internalActiveTab === 'progress-media' && <ProgressMediaTab />}
          {internalActiveTab === 'workout-creator' && <WorkoutCreatorMainTab />}
          {internalActiveTab === 'programs' && <ProgramsSettingsTab />}
        </div>
      )}
    </div>
  );
}
