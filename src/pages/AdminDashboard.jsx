
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from '@/api/entities';
import LockedScreen from '@/components/auth/LockedScreen';
import { AdminDashboardContext } from '@/contexts/AdminDashboardContext';

// Lucide Icons for navigation
import { Users, BarChart, Dumbbell, MessageSquare, ClipboardCheck, Mail, TrendingUp, Scale, Settings, Key, LayoutDashboard, FileText, Activity, Lock, Bell, ShieldCheck, List } from 'lucide-react';

// Import all management components
import UserManagement from '@/components/admin/UserManagement';
import BoosterProgramManager from '@/components/admin/BoosterProgramManager';
import BoosterPlusManager from '@/components/admin/BoosterPlusManager';
import GroupManagement from '@/components/admin/GroupManagement';
import RecipeAccessManager from '@/components/admin/RecipeAccessManager';
import LecturesManager from '@/components/admin/LecturesManager';
import WorkoutCreator from '@/components/admin/WorkoutCreator';
import WorkoutTemplatesManager from '@/components/admin/WorkoutTemplatesManager';
import TraineeReportsViewer from '@/components/admin/TraineeReportsViewer';
import SharedMealsViewer from '@/components/admin/SharedMealsViewer';
import ProgressPicturesViewer from '@/components/admin/ProgressPicturesViewer';
import WeightUpdateManager from '@/components/admin/WeightUpdateManager';
import UserSettingsManager from '@/components/admin/UserSettingsManager';
import MenuManagement from '@/components/admin/MenuManagement';
import WeeklyTaskManager from '@/components/admin/WeeklyTaskManager';
import ExerciseLibraryManager from '@/components/admin/ExerciseLibraryManager';
import GroupWeightFocus from '@/components/admin/GroupWeightFocus';
import UnifiedNotificationsViewer from '@/components/admin/UnifiedNotificationsViewer';
import ControlCenter from '@/components/admin/ControlCenter';
import AdminProfileScreen from '@/components/admin/AdminProfileScreen';
import ContractEditor from '@/components/admin/ContractEditor';
import GroupNotifications from '@/components/admin/GroupNotifications';
import FoodDatabase from '@/components/admin/FoodDatabase';
import TrainerManagement from '@/components/admin/TrainerManagement';
import AdminList from '@/components/admin/AdminList';

// UI components for ContractEditor dialog (Dialog, DialogContent, etc. are no longer used for ContractEditor)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";


export default function AdminDashboard({ activeTab: externalActiveTab, setActiveTab: externalSetActiveTab, hideNavigation = false, onNavigateToTab: externalNavigateToTab }) {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const pathname = location.pathname;
  // Base path: /admin for system admin, /trainer for trainer (from URL; redirect by role applied when user loads)
  const basePath = pathname.startsWith('/trainer') ? '/trainer' : '/admin';
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get tab from URL params, fallback to external prop, then default to 'control-center'
  const urlTab = params.tab;
  const urlSubTab = params.subTab;
  const urlUserEmail = params.userEmail; // from route /admin/user-management/user-list/:userEmail
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

  // Derive role flags early so redirect useEffect can use them (user may still be null while loading)
  const isSystemAdmin = user && (
    (user.role || '').toLowerCase() === 'admin' ||
    user.is_admin === true ||
    user.isAdmin === true ||
    user.admin === true ||
    (user.type || '').toLowerCase() === 'admin' ||
    (Array.isArray(user.permissions) && user.permissions.some(p => String(p || '').toLowerCase() === 'admin'))
  );
  const isTrainer = (user?.role || '').toLowerCase() === 'trainer';

  // Redirect to control-center if no tab in URL (initial load) or if URL contains null
  useEffect(() => {
    if (location.pathname.includes('/null')) {
      navigate(`${basePath}/control-center`, { replace: true });
      return;
    }
    if (!urlTab && (pathname === basePath || pathname === '/admindashboard' || pathname === '/AdminDashboard')) {
      navigate(`${basePath}/control-center`, { replace: true });
    }
    // Redirect trainers away from admin-only tabs
    if (urlTab && !isSystemAdmin && (urlTab === 'admin-management' || urlTab === 'trainer-management')) {
      navigate(`${basePath}/control-center`, { replace: true });
    }
  }, [urlTab, pathname, basePath, navigate, isSystemAdmin]);

  // Initialize tab from URL on mount or when URL changes
  useEffect(() => {
    if (urlTab) {
      // Guard against null/undefined tab values from URL
      if (urlTab === 'null' || urlTab === 'undefined') {
        console.warn('AdminDashboard: Invalid tab in URL, redirecting to control-center');
        navigate(`${basePath}/control-center`, { replace: true });
        return;
      }

      if (urlTab !== internalActiveTab) {
        setInternalActiveTab(urlTab);
      }

      // Update sub-tabs based on URL - ignore null/undefined subTab values
      if (urlSubTab && urlSubTab !== 'null' && urlSubTab !== 'undefined') {
        // Legacy: invitation tab was removed; redirect to control-center (invite via link only)
        if (urlTab === 'user-management' && urlSubTab === 'invitation') {
          navigate(`${basePath}/control-center`, { replace: true });
          return;
        }
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
        navigate(`${basePath}/${urlTab}`, { replace: true });
        return;
      } else {
        // If no sub-tab in URL, set defaults and update URL
        switch (urlTab) {
          case 'user-management':
            if (userManagementTab !== 'user-list') {
              setUserManagementTab('user-list');
              navigate(`${basePath}/user-management/user-list`, { replace: true });
            }
            break;
          case 'progress-media':
            if (progressMediaTab !== 'notification-status') {
              setProgressMediaTab('notification-status');
              navigate(`${basePath}/progress-media/notification-status`, { replace: true });
            }
            break;
          case 'workout-creator':
            if (workoutCreatorTab !== 'send-workout') {
              setWorkoutCreatorTab('send-workout');
              navigate(`${basePath}/workout-creator/send-workout`, { replace: true });
            }
            break;
        }
      }
    }
  }, [urlTab, urlSubTab, internalActiveTab, navigate, userManagementTab, progressMediaTab, workoutCreatorTab, programsTab, basePath]);

  // Update internal state when external activeTab changes (for backward compatibility)
  useEffect(() => {
    if (externalActiveTab && externalActiveTab !== internalActiveTab && !urlTab) {
      setInternalActiveTab(externalActiveTab);
    }
  }, [externalActiveTab, internalActiveTab, urlTab]);

  // When route is /admin/user-management/user-list/:userEmail, show user-list tab and pass user to UserManagement (search bar will show user id)
  useEffect(() => {
    if (!urlUserEmail) return;
    const decoded = decodeURIComponent(urlUserEmail);
    setInternalActiveTab('user-management');
    setUserManagementTab('user-list');
    setUserManagementProps({ initialUserEmail: decoded, startInEditMode: false });
  }, [urlUserEmail]);

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
      navigate(`${basePath}/${newTab}/${subTab}`, { replace: true });
    } else {
      navigate(`${basePath}/${newTab}`, { replace: true });
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
        setUserManagementTab('user-list');
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
          navigate(`${basePath}/${newTab}/${defaultSubTab}`, { replace: true });
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

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      console.error('AdminDashboard: Error loading user:', error);
      if (error.message?.includes("Session expired") ||
        error.message?.includes("400") ||
        error.code === 'auth/invalid-user-token') {
        console.warn('AdminDashboard: Session expired, will be handled by InterfaceRouter');
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Function to handle loading a template into the WorkoutCreator
  const handleLoadTemplate = (template) => {
    setTemplateToLoad(template);
    handleTabChange('workout-creator', 'send-workout'); // Use handleTabChange to ensure main tab switches with sub-tab
  };

  // Memoized UserManagement component to re-render when initialUserEmail changes (from outline)
  const memoizedUserManagement = useMemo(() => {
    // By using a key, we ensure the component re-mounts with new initial props
    // This is crucial for making the initialUserEmail prop work reliably if UserManagement itself doesn't react to prop changes
    return <UserManagement key={userManagementProps.initialUserEmail || 'default-user-management'} {...userManagementProps} adminUser={user} />;
  }, [userManagementProps, user]);

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

  // Updated userManagementSubTabs (invitation screen removed — invite via link only in Control Center)
  const userManagementSubTabs = useMemo(() => [
    { id: 'user-list', label: 'רשימת משתמשים', icon: List },
    { id: 'groups', label: 'ניהול קבוצות', icon: Users },
    { id: 'weight-update', label: 'עדכון משקל', icon: Scale },
    { id: 'recipes', label: 'מתכונים', icon: Lock }
  ], []);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-4 border-blue-300 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Staff flags (isSystemAdmin, isTrainer already defined above)
  const isStaff = isSystemAdmin || isTrainer;
  // Always show "מנהלים" tab so admins (including legacy) always see it; content still gated by isSystemAdmin
  const showAdminTab = true;
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
  if (!isStaff) {
    console.warn('AdminDashboard: User is not admin/trainer. Role:', user?.role);
    return <LockedScreen message="גישה מוגבלת - נדרשות הרשאות מנהל או מאמן" />;
  }
  // Redirect by role: trainer must use /trainer, system admin must use /admin
  if (pathname.startsWith('/admin') && isTrainer) {
    const rest = pathname.slice(5) || '/control-center';
    return <Navigate to={'/trainer' + rest} replace />;
  }
  if (pathname.startsWith('/trainer') && isSystemAdmin) {
    const rest = pathname.slice(8) || '/control-center';
    return <Navigate to={'/admin' + rest} replace />;
  }

  // Define programs & settings sub-categories with enhanced layout
  const settingsCategories = [
    {
      value: "booster",
      title: "ניהול בוסטר",
      icon: "🚀",
      description: "הפעלה, איפוס והסרת מתאמנים",
      color: "from-blue-500 to-purple-600"
    },
    {
      value: "booster-plus",
      title: "בוסטר פלוס",
      icon: "⚡",
      description: "ניהול תכנית בוסטר פלוס ומתאמנים",
      color: "from-amber-500 to-orange-600"
    },
    {
      value: "weekly-tasks",
      title: "משימות שבועיות",
      icon: "📅",
      description: "ניהול משימות שבועיות למתאמנים",
      color: "from-blue-500 to-cyan-500"
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
    },
    {
      value: "food-database",
      title: "מאגר מזונות",
      icon: "🍎",
      description: "ניהול בסיס נתונים של מזונות וערכים תזונתיים",
      color: "from-green-500 to-emerald-600"
    },
    {
      value: "settings",
      title: "הגדרות משתמש",
      icon: "⚙️",
      description: "הגדרות מתאמנים והרשאות",
      color: "from-slate-500 to-slate-700"
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
        navigate(`${basePath}/user-management/${subTab}`, { replace: true });
        break;
      case 'progress-media':
        setProgressMediaTab(subTab);
        navigate(`${basePath}/progress-media/${subTab}`, { replace: true });
        break;
      case 'workout-creator':
        setWorkoutCreatorTab(subTab);
        navigate(`${basePath}/workout-creator/${subTab}`, { replace: true });
        break;
      case 'programs':
        setProgramsTab(subTab);
        navigate(`${basePath}/programs/${subTab}`, { replace: true });
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
      {/* Adjusted grid-cols to 7 after removing termination-feedback */}
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 h-auto">
        <TabsTrigger value="notification-status" className="text-xs sm:text-sm py-2 flex items-center justify-center gap-1">
          <ClipboardCheck className="w-3 h-3 sm:w-4 sm:h-4 me-1" />
          סטטוס והתראות
        </TabsTrigger>
        <TabsTrigger value="group-notifications" className="text-xs sm:text-sm py-2 flex items-center justify-center gap-1">
          <Bell className="w-3 h-3 sm:w-4 sm:h-4 me-1" />
          התראות קבוצה
        </TabsTrigger>
        <TabsTrigger value="shared-meals" className="text-xs sm:text-sm py-2">ארוחות משותפות</TabsTrigger>
        <TabsTrigger value="trainee-reports" className="text-xs sm:text-sm py-2">דוחות מתאמנים</TabsTrigger>
        <TabsTrigger value="progress-pictures" className="text-xs sm:text-sm py-2">תמונות התקדמות</TabsTrigger>
        <TabsTrigger value="lectures" className="text-xs sm:text-sm py-2">ניהול הרצאות</TabsTrigger>
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
        case 'booster': return <BoosterProgramManager />;
        case 'booster-plus': return <BoosterPlusManager />;
        case 'weekly-tasks': return <WeeklyTaskManager />;
        case 'menu-management': return <MenuManagement />;
        case 'contract-editor': return <ContractEditor />;
        case 'food-database': return <FoodDatabase />;
        case 'settings': return memoizedUserSettingsManager;
        default: return null;
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-center w-full mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-2">תוכניות והגדרות</h2>
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
                  className={`transition-all duration-300 w-full overflow-hidden ${isExpanded
                      ? 'ring-2 ring-blue-500 shadow-xl'
                      : 'hover:shadow-md'
                    }`}
                >
                  <motion.div
                    layout="position"
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => {
                      const newTab = programsTab === category.value ? null : category.value;
                      setProgramsTab(newTab);
                      if (newTab) {
                        navigate(`${basePath}/programs/${newTab}`, { replace: true });
                      } else {
                        navigate(`${basePath}/programs`, { replace: true });
                      }
                    }}
                  >
                    <div className={`w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center text-2xl p-2 bg-gradient-to-br ${category.color}`}>
                      {category.icon}
                    </div>
                    <div className="flex-grow min-w-0" dir="rtl">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-base font-bold text-slate-800">
                          {category.title}
                        </CardTitle>
                        {isExpanded && (
                          <Badge variant="outline" className="text-blue-600 border-blue-400 flex-shrink-0">
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
    <AdminDashboardContext.Provider value={{ user, isSystemAdmin, refreshUser: loadUser }}>
    <div className="max-w-full mx-auto p-2 sm:p-4 space-y-6" dir="rtl">
      {/* Navigation Tabs - buttons that call navigate() so URL always updates */}
      {!hideNavigation && (
        <>
          <div className="overflow-x-auto pb-2">
            <div
              role="tablist"
              className={`grid w-full h-14 bg-white shadow-lg rounded-xl border muscle-glass min-w-[700px] ${isSystemAdmin ? 'grid-cols-7' : 'grid-cols-5'}`}
            >
              <button
                type="button"
                onClick={() => navigate(`${basePath}/control-center`, { replace: true })}
                className={
                  'flex items-center justify-center gap-2 text-xs md:text-sm border-b-2 transition-colors rounded-t-lg px-2 py-3 ' +
                  (pathname === `${basePath}/control-center` ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-transparent hover:bg-slate-100')
                }
              >
                <LayoutDashboard className="w-4 h-4" />
                מרכז שליטה
              </button>
              <button
                type="button"
                onClick={() => navigate(`${basePath}/user-management/user-list`, { replace: true })}
                className={
                  'flex items-center justify-center gap-2 text-xs md:text-sm border-b-2 transition-colors rounded-t-lg px-2 py-3 ' +
                  (pathname.startsWith(`${basePath}/user-management`) ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-transparent hover:bg-slate-100')
                }
              >
                <Users className="w-4 h-4" />
                ניהול משתמשים
              </button>
              {isSystemAdmin && (
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/admin-management`, { replace: true })}
                  className={
                    'flex items-center justify-center gap-2 text-xs md:text-sm border-b-2 transition-colors rounded-t-lg px-2 py-3 ' +
                    (pathname.startsWith(`${basePath}/admin-management`) ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-transparent hover:bg-slate-100')
                  }
                >
                  <Key className="w-4 h-4" />
                  מנהלים
                </button>
              )}
              {isSystemAdmin && (
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/trainer-management`, { replace: true })}
                  className={
                    'flex items-center justify-center gap-2 text-xs md:text-sm border-b-2 transition-colors rounded-t-lg px-2 py-3 ' +
                    (pathname === `${basePath}/trainer-management` ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-transparent hover:bg-slate-100')
                  }
                >
                  <ShieldCheck className="w-4 h-4" />
                  ניהול מאמנים
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(`${basePath}/progress-media/notification-status`, { replace: true })}
                className={
                  'flex items-center justify-center gap-2 text-xs md:text-sm border-b-2 transition-colors rounded-t-lg px-2 py-3 ' +
                  (pathname.startsWith(`${basePath}/progress-media`) ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-transparent hover:bg-slate-100')
                }
              >
                <BarChart className="w-4 h-4" />
                התקדמות ומדיה
              </button>
              <button
                type="button"
                onClick={() => navigate(`${basePath}/workout-creator/send-workout`, { replace: true })}
                className={
                  'flex items-center justify-center gap-2 text-xs md:text-sm border-b-2 transition-colors rounded-t-lg px-2 py-3 ' +
                  (pathname.startsWith(`${basePath}/workout-creator`) ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-transparent hover:bg-slate-100')
                }
              >
                <Dumbbell className="w-4 h-4" />
                יוצר אימונים
              </button>
              <button
                type="button"
                onClick={() => navigate(`${basePath}/programs`, { replace: true })}
                className={
                  'flex items-center justify-center gap-2 text-xs md:text-sm border-b-2 transition-colors rounded-t-lg px-2 py-3 ' +
                  (pathname.startsWith(`${basePath}/programs`) ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-transparent hover:bg-slate-100')
                }
              >
                <Settings className="w-4 h-4" />
                תוכניות והגדרות
              </button>
            </div>
          </div>
          <div className="mt-6">
            {(urlTab || internalActiveTab) === 'control-center' && (
              <ControlCenter onNavigateToTab={handleTabChange} />
            )}
            {(urlTab || internalActiveTab) === 'user-management' && <UserManagementTab />}
            {(urlTab || internalActiveTab) === 'admin-management' && isSystemAdmin && <AdminList canAccess={isSystemAdmin} />}
            {(urlTab || internalActiveTab) === 'trainer-management' && isSystemAdmin && (
              <TrainerManagement onNavigateToTab={handleTabChange} />
            )}
            {(urlTab || internalActiveTab) === 'progress-media' && <ProgressMediaTab />}
            {(urlTab || internalActiveTab) === 'workout-creator' && <WorkoutCreatorMainTab />}
            {(urlTab || internalActiveTab) === 'programs' && <ProgramsSettingsTab />}
          </div>
        </>
      )}

      {/* Content without navigation wrapper when hideNavigation is true */}
      {hideNavigation && (
        <div>
          {internalActiveTab === 'control-center' && <ControlCenter onNavigateToTab={handleTabChange} />}
          {internalActiveTab === 'user-management' && <UserManagementTab />}
          {internalActiveTab === 'admin-management' && isSystemAdmin && <AdminList canAccess={isSystemAdmin} />}
          {internalActiveTab === 'trainer-management' && isSystemAdmin && <TrainerManagement onNavigateToTab={handleTabChange} />}
          {internalActiveTab === 'progress-media' && <ProgressMediaTab />}
          {internalActiveTab === 'workout-creator' && <WorkoutCreatorMainTab />}
          {internalActiveTab === 'programs' && <ProgramsSettingsTab />}
          {internalActiveTab === 'profile' && <AdminProfileScreen />}
        </div>
      )}
    </div>
    </AdminDashboardContext.Provider>
  );
}
