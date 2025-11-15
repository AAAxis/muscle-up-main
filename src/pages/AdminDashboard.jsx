
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from '@/api/entities';
import LockedScreen from '@/components/auth/LockedScreen';

// Lucide Icons for navigation
import { Users, BarChart, Dumbbell, MessageSquare, ClipboardCheck, Mail, TrendingUp, Scale, Settings, Key, LayoutDashboard, FileText, Activity, Lock } from 'lucide-react'; // Added Activity and Lock

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

// UI components for ContractEditor dialog (Dialog, DialogContent, etc. are no longer used for ContractEditor)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";


export default function AdminDashboard({ activeTab = 'control-center', setActiveTab: externalSetActiveTab, hideNavigation = false }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Internal state for active tab, initialized from external prop or default. Changed default to 'control-center'.
  const [internalActiveTab, setInternalActiveTab] = useState(activeTab); // Renamed to avoid conflict with prop

  // States for sub-tabs
  const [userManagementTab, setUserManagementTab] = useState('user-list');
  const [progressMediaTab, setProgressMediaTab] = useState('notification-status');
  const [workoutCreatorTab, setWorkoutCreatorTab] = useState('send-workout');
  // Changed initial state to null to start collapsed
  const [programsTab, setProgramsTab] = useState(null);
  const [templateToLoad, setTemplateToLoad] = useState(null);

  // New state for direct user navigation, as per outline
  const [userManagementProps, setUserManagementProps] = useState({});
  const [userSettingsProps, setUserSettingsProps] = useState({}); // New state for UserSettingsManager props

  // Update internal state when external activeTab changes
  useEffect(() => {
    if (activeTab && activeTab !== internalActiveTab) {
      setInternalActiveTab(activeTab);
    }
  }, [activeTab, internalActiveTab]);

  // Update external state when internal activeTab changes - Enhanced to handle sub-tabs and props
  // Renamed from handleNavigation in outline to handleTabChange to match existing structure
  const handleTabChange = (newTab, subTab = null, props = {}) => {
    setInternalActiveTab(newTab);
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
      }
      // Default to primary sub-tabs for others if no subTab is specified
      if (newTab === 'user-management') {
          setUserManagementTab('user-list');
      }
      if (newTab === 'progress-media') {
          setProgressMediaTab('notification-status');
      }
      if (newTab === 'workout-creator') {
          setWorkoutCreatorTab('send-workout');
      }
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
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
    setWorkoutCreatorTab('send-workout');
    handleTabChange('workout-creator'); // Use handleTabChange to ensure main tab switches
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
      <div className="flex items-center justify-center min-h96">
        <div className="relative">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d04615afd_.png"
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
  if (!user || !isAdmin) {
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

  // Components for each main tab's content, defined inside AdminDashboard to access its state and functions
  const UserManagementTab = () => (
    <Tabs value={userManagementTab} onValueChange={setUserManagementTab} className="w-full">
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
    <Tabs value={progressMediaTab} onValueChange={setProgressMediaTab} className="w-full">
      {/* Adjusted grid-cols to 7 after removing 'Shared Images' */}
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-7 h-auto">
        <TabsTrigger value="notification-status" className="text-xs sm:text-sm py-2 flex items-center justify-center gap-1">
          <ClipboardCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          סטטוס והתראות
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
      <Tabs value={workoutCreatorTab} onValueChange={setWorkoutCreatorTab} className="w-full">
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
                    onClick={() => setProgramsTab(prev => prev === category.value ? null : category.value)}
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
