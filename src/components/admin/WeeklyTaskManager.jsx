

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WeeklyTask, User, UserGroup } from '@/api/entities';
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
} from 'lucide-react';
import { format, addDays, parseISO, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const TASK_RESET_CODE = "1010";
const TASK_ADMIN_CODE = "2206";

const predefinedTasksMale = [
    {
        week: 1,
        title: "שבוע פתיחת בוסטר",
        mission_text: "לשתות 2–3 ליטר מים ביום.",
        tip_text: "הפעל תזכורת כל שעתיים.\nהשתמש באפליקציה למדידת צריכת מים.\nמים תומכים בתחושת שובע, משפרים חילוף חומרים, מנקים את הגוף ומקדמים ירידה במשקל.",
        booster_text: "המים הם הכלי הפשוט והעוצמתי ביותר ליצירת תנועה קדימה."
    },
    {
        week: 2,
        title: "מיישרים קו עם הצלחת",
        mission_text: "לצלם את כל הארוחות במשך שבוע ולהעלות לאפליקציה.",
        tip_text: "צילום הארוחות מעלה מודעות ומחדד בחירות – בלי שיפוטיות ובלי ביקורת. הוא מאפשר לראות איך נראה יום שלם, לזהות הרגלים חוזרים (כמו חטיפים בלילה או דילוג על ארוחה), ולהבין איפה אפשר לדייק.",
        booster_text: "הצילומים הם לא רק מעקב – הם מראה שמאפשרת למידה אמיתית ושינוי לאורך זמן."
    },
    {
        week: 3,
        title: "לזהות את הפיתוי ולבחור אחרת",
        mission_text: "בכל יום לזהות פיתוי אחד, ולרשום לפני השינה:\n- מה עורר אותו?\n- איך יכולתי או אוכל להתמודד איתו אחרת?",
        tip_text: "פיתוי הוא לא תמיד רעב, הוא לעיתים ביטוי לרגש, לשעמום או להרגל. ברגע שמזהים אותו, נוצרת הזדמנות לעצור, לבחור אחרת ולחזק שליטה פנימית.",
        booster_text: "מי המנהל – אתה או הפיתוי?\nעד עכשיו הפיתויים הובילו אותך, אבל השבוע אתה מתחיל להפוך את הכיוון ולשים את השליטה בחזרה בידיים שלך."
    },
    {
        week: 4,
        title: "לבחור בעצמך גם מחוץ לאוכל",
        mission_text: "לתכנן השבוע לפחות רגע אחד שמיועד רק לך – לא קשור לאוכל או לספורט.\n(זה יכול להיות מסאז', מקלחת שקטה, ציור, הליכה לבד, או אפילו פסק זמן בלי הטלפון).",
        tip_text: "זמן איכות אישי מחזק את הערך העצמי ומקטין את הצורך בחיזוקים מבחוץ.",
        booster_text: "אוכל הוא רק תופעת לוואי של מה שקורה בתוכנו. כשאנחנו דואגים לעצמנו ומראים לתת־מודע שאנחנו באמת חשובים, זה מתבטא גם בתזונה שלנו."
    },
    {
        week: 5,
        title: "לפעול קודם, להרגיש אחר כך",
        mission_text: "בכל בוקר, מיד אחרי שאתה מתעורר, רשום:\n- כוונה ליום הזה (איך אתה רוצה להרגיש ומה חשוב לך להשיג).\n- רשום 3 פעולות קטנות שיקדמו אותך באותו היום ובצע לפחות 2 מהן.",
        tip_text: "כשאנחנו שמים מיקוד במה שאנחנו רוצים, התת־מודע כבר מתחיל לעבוד כדי לעזור לנו להשיג את זה.",
        booster_text: "מוטיבציה לא מובילה לתוצאות - התוצאות הן אלו שמייצרות מוטיבציה."
    },
    {
        week: 6,
        title: "ידע הוא כוח, תרתי משמע",
        mission_text: "להוסיף עוד אימון כוח השבוע ולנסות לעלות עומס אפילו בקילוגרם אחד.",
        tip_text: "- שריר שורף יותר שומן גם במנוחה\n- אימוני כוח תומכים בירידה שקטה ויציבה\n- שריר זה לא גודל, זה חוסן מטבולי",
        booster_text: "הגוף שלך לא רק משתנה, הוא נבנה מחדש, חזק מבפנים."
    },
    {
        week: 7,
        title: "להוריד סטרס, להעלות תוצאה",
        mission_text: "כל יום – 5 דקות של נשימה מודעת או מדיטציה מודרכת.",
        tip_text: "סטרס מעכב ירידה במשקל. רוגע הוא חלק בלתי נפרד מהתהליך.",
        booster_text: "כשהנפש משתחררת – גם הגוף מאפשר."
    },
    {
        week: 8,
        title: "שינוי מתחיל בבחירה אחת",
        mission_text: "במשך סוף השבוע הקרוב (חמישי–שישי–שבת) לצלם את כל הארוחות ולהעלות לאפליקציה. זו נקודת 'איפוס' חשובה לבדוק את עצמנו דווקא בימים המאתגרים יותר, לראות את התמונה המלאה, ולוודא שאנחנו בכיוון לעבר המטרה.",
        tip_text: "הצילום לא נועד לשיפוט אלא למודעות. הוא עוזר לזהות הרגלים שחוזרים, להבין את דפוסי סוף השבוע ולמצוא איפה אפשר לדייק.",
        booster_text: "לא משחזרים את הישן – יוצרים מציאות חדשה, צעד אחרי צעד."
    },
    {
        week: 9,
        title: "לאהוב אותנו",
        mission_text: "לדבר בשפה חיובית כלפיי עצמך והגוף שלך.",
        tip_text: "כשאנחנו מדברים אל עצמנו בצורה חיובית אנחנו בעצם מחזירים לעצמנו אהבה! וזה חלק לא פחות חשוב מהצלחת התהליך; לא רק לרדת במשקל, אלא גם לאהוב את עצמנו על הדרך המדהימה שאנחנו בוחרים לעשות.",
        booster_text: "ההתנהגות שלך מקדימה את התחושה; היא זו שבונה את הזהות."
    },
    {
        week: 10,
        title: "לשנות את הדיבור הפנימי",
        mission_text: "לכתוב משפט מחזק אחד, ולהחליף את שומר המסך למשפט הזה. לקרוא אותו 3 פעמים ביום בקול.",
        tip_text: "השפה הפנימית היא הדלק של התודעה – תבחר אותה בחכמה.",
        booster_text: "תדבר לעצמך כמו שאתה רוצה להרגיש."
    },
    {
        week: 11,
        title: "החלקים מתחברים",
        mission_text: "כל ערב לסכם:\n- מה עבד היום?\n- מה למדתי השבוע על עצמי?",
        tip_text: "עצירה לרגע של הכרה = תחושת הישג אמיתית ומיקוד ליום הבא!",
        booster_text: "תסתכל אחורה – רק כדי להבין כמה התקדמת."
    },
    {
        week: 12,
        title: "הזהות החדשה יוצאת לאור",
        mission_text: "לכתוב מכתב לעצמך הישן. מכתב שמספר על מה שאתה הפכת להיות היום, ולסיים את המכתב בתודה ל'אני הישן' שלך שהיה מוכן לצאת לדרך הזו.",
        tip_text: "הזהות החדשה שלך לא באה מבחוץ; היא נבנתה צעד־צעד, מתוך בחירה, ומעכשיו והלאה אתה הבוס של עצמך!",
        booster_text: "אתה הבנת, אתה עשית, אתה הצלחת.\nזאת לא גרסה חדשה, זאת הגרסה האמיתית שלך, שנולדה מתוך עשייה."
    }
];

const predefinedTasksFemale = [
    {
        week: 1,
        title: "שבוע פתיחת בוסטר",
        mission_text: "לשתות 2–3 ליטר מים ביום.",
        tip_text: "הפעילי תזכורת כל שעתיים.\nהשתמשי באפליקציה למדידת צריכת מים.\nמים תומכים בתחושת שובע, משפרים חילוף חומרים, מנקים את הגוף ומקדמים ירידה במשקל.",
        booster_text: "המים הם הכלי הפשוט והעוצמתי ביותר ליצירת תנועה קדימה."
    },
    {
        week: 2,
        title: "מיישרים קו עם הצלחת",
        mission_text: "לצלם את כל הארוחות במשך שבוע ולהעלות לאפליקציה.",
        tip_text: "צילום הארוחות מעלה מודעות ומחדד בחירות – בלי שיפוטיות ובלי ביקורת. הוא מאפשר לראות איך נראה יום שלם, לזהות הרגלים חוזרים (כמו חטיפים בלילה או דילוג על ארוחה), ולהבין איפה אפשר לדייק.",
        booster_text: "הצילומים הם לא רק מעקב – הם מראה שמאפשרת למידה אמיתית ושינוי לאורך זמן."
    },
    {
        week: 3,
        title: "לזהות את הפיתוי ולבחור אחרת",
        mission_text: "בכל יום לזהות פיתוי אחד, ולרשום לפני השינה:\n- מה עורר אותו?\n- איך יכולתי או אוכל להתמודד איתו אחרת?",
        tip_text: "פיתוי הוא לא תמיד רעב, הוא לעיתים ביטוי לרגש, לשעמום או להרגל. ברגע שמזהים אותו, נוצרת הזדמנות לעצור, לבחור אחרת ולחזק שליטה פנימית.",
        booster_text: "מי המנהלת – את או הפיתוי?\nעד עכשיו הפיתויים הובילו אותך, אבל השבוע את מתחילה להפוך את הכיוון ולשים את השליטה בחזרה בידיים שלך."
    },
    {
        week: 4,
        title: "לבחור בעצמך גם מחוץ לאוכל",
        mission_text: "לתכנן השבוע לפחות רגע אחד שמיועד רק לך – לא קשור לאוכל או לספורט.\n(זה יכול להיות מסאז', מקלחת שקטה, ציור, הליכה לבד, או אפילו פסק זמן בלי הטלפון).",
        tip_text: "זמן איטיות אישי מחזק את הערך העצמי ומקטין את הצורך בחיזוקים מבחוץ.",
        booster_text: "אוכל הוא רק תופעת לוואי של מה שקורה בתוכנו. כשאנחנו דואגות לעצמנו ומראות לתת־מודע שאנחנו באמת חשובות, זה מתבטא גם בתזונה שלנו."
    },
    {
        week: 5,
        title: "לפעול קודם, להרגיש אחר כך",
        mission_text: "בכל בוקר, מיד אחרי שאת מתעוררת, רשמי:\n- כוונה ליום הזה (איך את רוצה להרגיש ומה חשוב לך להשיג).\n- רשמי 3 פעולות קטנות שיקדמו אותך באותו היום ובצעי לפחות 2 מהן.",
        tip_text: "כשאנחנו שמות מיקוד במה שאנחנו רוצות, התת־מודע כבר מתחיל לעבוד כדי לעזור לנו להשיג את זה.",
        booster_text: "מוטיבציה לא מובילה לתוצאות - התוצאות הן אלו שמייצרות מוטיבציה."
    },
    {
        week: 6,
        title: "ידע הוא כוח, תרתי משמע",
        mission_text: "להוסיף עוד אימון כוח השבוע ולנסות לעלות עומס אפילו בקילוגרם אחד.",
        tip_text: "- שריר שורף יותר שומן גם במנוחה\n- אימוני כוח תומכים בירידה שקטה ויציבה\n- שריר זה לא גודל, זה חוסן מטבולי",
        booster_text: "הגוף שלך לא רק משתנה, הוא נבנה מחדש, חזק מבפנים."
    },
    {
        week: 7,
        title: "להוריד סטרס, להעלות תוצאה",
        mission_text: "כל יום – 5 דקות של נשימה מודעת או מדיטציה מודרכת.",
        tip_text: "סטרס מעכב ירידה במשקל. רוגע הוא חלק בלתי נפרד מהתהליך.",
        booster_text: "כשהנפש משתחררת – גם הגוף מאפשר."
    },
    {
        week: 8,
        title: "שינוי מתחיל בבחירה אחת",
        mission_text: "במשך סוף השבוע הקרוב (חמישי–שישי–שבת) לצלם את כל הארוחות ולהעלות לאפליקציה. זו נקודת 'איפוס' חשובה לבדוק את עצמנו דווקא בימים המאתגרים יותר, לראות את התמונה המלאה, ולוודא שאנחנו בכיוון לעבר המטרה.",
        tip_text: "הצילום לא נועד לשיפוט אלא למודעות. הוא עוזר לזהות הרגלים שחוזרים, להבין את דפוסי סוף השבוע ולמצוא איפה אפשר לדייק.",
        booster_text: "לא משחזרים את הישן – יוצרים מציאות חדשה, צעד אחרי צעד."
    },
    {
        week: 9,
        title: "לאהוב אותנו",
        mission_text: "לדבר בשפה חיובית כלפיי עצמך והגוף שלך.",
        tip_text: "כשאנחנו מדברות אל עצמנו בצורה חיובית אנחנו בעצם מחזירות לעצמנו אהבה! וזה חלק לא פחות חשוב מהצלחת התהליך; לא רק לרדת במשקל, אלא גם לאהוב את עצמנו על הדרך המדהימה שאנחנו בוחרות לעשות.",
        booster_text: "ההתנהגות שלך מקדימה את התחושה; היא זו שבונה את הזהות."
    },
    {
        week: 10,
        title: "לשנות את הדיבור הפנימי",
        mission_text: "לכתוב משפט מחזק אחד, ולהחליף את שומר המסך למשפט הזה. לקרוא אותו 3 פעמים ביום בקול.",
        tip_text: "השפה הפנימית היא הדלק של התודעה – תבחרי אותה בחכמה.",
        booster_text: "תדברי לעצמך כמו שאת רוצה להרגיש."
    },
    {
        week: 11,
        title: "החלקים מתחברים",
        mission_text: "כל ערב לסכם:\n- מה עבד היום?\n- מה למדתי השבוע על עצמי?",
        tip_text: "עצירה לרגע של הכרה = תחושת הישג אמיתית ומיקוד ליום הבא!",
        booster_text: "תסתכלי אחורה – רק כדי להבין כמה התקדמת."
    },
    {
        week: 12,
        title: "הזהות החדשה יוצאת לאור",
        mission_text: "לכתוב מכתב לעצמך הישן. מכתב שמספר על מה שאת הפכת להיות היום, ולסיים את המכתב בתודה ל'אני הישן' שלך שהיה מוכן לצאת לדרך הזו.",
        tip_text: "הזהות החדשה שלך לא באה מבחוץ; היא נבנתה צעד־צעד, מתוך בחירה, ומעכשיו והלאה את הבוסית של עצמך!",
        booster_text: "את הבנת, את עשית, את הצלחת.\nזאת לא גרסה חדשה, זאת הגרסה האמיתית שלך, שנולדה מתוך עשייה."
    }
];

export default function WeeklyTaskManager() {
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [targetType, setTargetType] = useState('user'); 
    const [selectedUser, setSelectedUser] = useState(''); // Stores email string for assign tab
    const [selectedGroup, setSelectedGroup] = useState('');
    const [newStartDate, setNewStartDate] = useState(new Date()); // Date object for setting new booster start date
    const [resetCode, setResetCode] = useState('');
    const [adminCode, setAdminCode] = useState(''); // Unified admin code
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
            const [allUsers, allGroups, allTasks] = await Promise.all([
                User.filter({}),
                UserGroup.list(),
                WeeklyTask.list()
            ]);
            setUsers(allUsers || []);
            setGroups(allGroups || []);
            setTasks(allTasks || []);
        } catch (error) {
            console.error('Error loading data:', error);
            setFeedback({ type: 'error', message: 'שגיאה בטעינת הנתונים' });
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, setUsers, setGroups, setTasks, setFeedback]);

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
        if (adminCode !== TASK_ADMIN_CODE) {
            showFeedback('error', 'קוד ניהול שגוי.');
            return;
        }

        const targetUsers = getTargetUsers();
        if (targetUsers.length === 0) {
            showFeedback('error', 'יש לבחור מתאמן או קבוצה.');
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

                const userGender = user.gender === 'female' ? 'female' : 'male';
                const predefinedTasks = userGender === 'female' ? predefinedTasksFemale : predefinedTasksMale;

                const newTasks = predefinedTasks.map(taskTemplate => {
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
            setAdminCode('');
            await loadData();
        } catch (error) {
            console.error('Error setting start date:', error);
            showFeedback('error', 'שגיאה בקביעת תאריך התחלה.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetTasks = async () => {
        if (resetCode !== TASK_RESET_CODE) {
            showFeedback('error', 'קוד איפוס שגוי.');
            return;
        }

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
            setResetCode('');
            await loadData();
        } catch (error) {
            console.error('Error resetting tasks:', error);
            showFeedback('error', 'שגיאה באיפוס משימות הבוסטר.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTaskActivation = async (enable) => {
        if (adminCode !== TASK_ADMIN_CODE) {
            showFeedback('error', 'קוד ניהול שגוי.');
            return;
        }
        
        const targetUsers = getTargetUsers();
        if (targetUsers.length === 0) {
            showFeedback('error', 'יש לבחור מתאמן או קבוצה.');
            return;
        }

        setIsProcessing(true);
        try {
            for (const user of targetUsers) {
                const updatePayload = { booster_enabled: enable };
                if (enable) {
                    updatePayload.booster_unlocked = true;
                    const existingTasks = await WeeklyTask.filter({ user_email: user.email });
                    if (!existingTasks || existingTasks.length === 0) {
                        // If no tasks exist, create them with current date as start
                        const startDate = new Date();
                        const userGender = user.gender === 'female' ? 'female' : 'male';
                        const predefinedTasks = userGender === 'female' ? predefinedTasksFemale : predefinedTasksMale;

                        const newTasks = predefinedTasks.map(taskTemplate => {
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
                }
                await User.update(user.id, updatePayload);
            }
            showFeedback('success', `תוכנית המשימות ${enable ? 'הופעלה' : 'כובתה'} בהצלחה.`);
            await loadData();
        } catch (error) {
            showFeedback('error', 'שגיאה בעדכון סטטוס המשימות.');
            console.error(error);
        } finally {
            setIsProcessing(false);
            setAdminCode('');
        }
    };

    const handleAssignTasks = async () => {
        if (!selectedUserEmailForAssignment || weeksToAssign.length === 0 || adminCode !== TASK_ADMIN_CODE) {
            showFeedback('error', 'יש לבחור מתאמן, שבועות להקצאה ולהזין קוד ניהול תקין.');
            return;
        }

        setIsProcessing(true);
        try {
            const selectedUserData = users.find(u => u.email === selectedUserEmailForAssignment);
            if (!selectedUserData) {
                throw new Error('User not found');
            }

            const tasksToCreate = [];
            const userGender = selectedUserData.gender === 'female' ? 'female' : 'male';
            const predefinedTasks = userGender === 'female' ? predefinedTasksFemale : predefinedTasksMale;
            
            const userStartDate = selectedUserData.booster_start_date ? parseISO(selectedUserData.booster_start_date) : new Date();

            for (const weekNum of weeksToAssign) {
                const taskTemplate = predefinedTasks.find(t => t.week === weekNum);
                
                if (!taskTemplate) {
                    console.warn(`No predefined task found for week ${weekNum}`);
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
            setAdminCode('');
            await loadData();
        } catch (error) {
            console.error('Error assigning tasks:', error);
            showFeedback('error', `שגיאה בהקצאת משימות: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApplyTemplateToAll = async () => {
        if (weeksToAssign.length === 0 || adminCode !== TASK_ADMIN_CODE) {
            showFeedback('error', 'יש לבחור שבועות להקצאה ולהזין קוד ניהול תקין.');
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
                if (user.role === 'admin' || user.role === 'coach') continue;

                const userGender = user.gender === 'female' ? 'female' : 'male';
                const predefinedTasks = userGender === 'female' ? predefinedTasksFemale : predefinedTasksMale;
                
                const userStartDate = user.booster_start_date ? parseISO(user.booster_start_date) : new Date();

                for (const weekNum of weeksToAssign) {
                    const taskTemplate = predefinedTasks.find(t => t.week === weekNum);
                    if (!taskTemplate) {
                        console.warn(`No predefined task found for week ${weekNum} for user ${user.email}`);
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
            setAdminCode('');
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
        if (adminCode !== TASK_ADMIN_CODE) {
            toast({
                title: "שגיאה",
                description: "קוד ניהול שגוי.",
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
            setAdminCode(''); // Clear global adminCode
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
        if (adminCode !== TASK_ADMIN_CODE) {
            toast({
                title: "שגיאה",
                description: "קוד ניהול שגוי.",
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
            setAdminCode('');
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

    const weekOptions = predefinedTasksMale.map(task => ({
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
        <div className="space-y-6">
            {feedback.message && (
                <Alert className={`${feedback.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <AlertTriangle className={`h-4 w-4 ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`} />
                    <AlertDescription className={feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                        {feedback.message}
                    </AlertDescription>
                </Alert>
            )}

            <Card className="muscle-glass border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        ניהול משימות שבועיות - תוכנית בוסטר
                    </CardTitle>
                    <CardDescription>
                        ניהול מתקדם של משימות שבועיות עבור מתאמנים בתוכנית הבוסטר
                    </CardDescription>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3"> {/* Changed to 3 for new tab */}
                    <TabsTrigger value="assign">הקצאת משימות</TabsTrigger>
                    <TabsTrigger value="freeze-unfreeze-control">הקפאה והפשרה</TabsTrigger> {/* New Tab */}
                    <TabsTrigger value="overview">סקירה נוכחית</TabsTrigger>
                </TabsList>

                <TabsContent value="assign" className="mt-6 space-y-6">
                    <Card className="muscle-glass border-0 shadow-lg">
                        <CardContent className="space-y-6">
                            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                                <h4 className="font-semibold text-slate-700">בחירת יעד</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>סוג יעד</Label>
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
                                        <Label>בחר {targetType === 'user' ? 'מתאמן' : 'קבוצה'}</Label>
                                        {targetType === 'user' ? (
                                            <Select value={selectedUser} onValueChange={setSelectedUser}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="בחר מתאמן..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {users.filter(u => u.booster_unlocked).map(u => (
                                                        <SelectItem key={u.id} value={u.email}>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span>{u.name} ({u.email})</span>
                                                                <Badge variant="outline" className="ml-2">
                                                                    {getUserTasksStatus(u.email).percentage}%
                                                                </Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                                <SelectTrigger>
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
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
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

                            <div className="space-y-4 p-4 border rounded-lg">
                                <h4 className="font-semibold flex items-center gap-2">
                                    <Calendar1 className="w-5 h-5 text-green-600" />
                                    קביעת תאריך התחלה חדש
                                (מגדיר תאריכי משימות לכל 12 השבועות)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <Label>תאריך התחלה חדש</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start">
                                                    <Calendar1 className="mr-2 h-4 w-4" />
                                                    {format(newStartDate, 'dd/MM/yyyy')}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
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
                                        <Label>קוד ניהול</Label>
                                        <Input
                                            type="password"
                                            placeholder="הכנס קוד ניהול"
                                            value={adminCode}
                                            onChange={(e) => setAdminCode(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button
                                            onClick={handleSetStartDate}
                                            disabled={isProcessing || !adminCode || getTargetUsers().length === 0}
                                            className="w-full bg-green-600 hover:bg-green-700"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    מעדכן...
                                                </>
                                            ) : (
                                                <>
                                                    <Clock className="w-4 h-4 mr-2" />
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

                    <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold flex items-center gap-2">
                            <Power className="w-5 h-5 text-blue-600" />
                            הפעלה/ביטול משימות שבועיות
                        </h4>
                        <p className="text-sm text-slate-600">
                            מפעיל/מבטל את תוכנית הבוסטר עבור היעד הנבחר. הפעלה תיצור משימות חדשות אם אין קיימות.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                                onClick={() => handleTaskActivation(true)}
                                disabled={isProcessing || !adminCode || getTargetUsers().length === 0}
                                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Play className="w-4 h-4" />
                                הפעל משימות שבועיות
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleTaskActivation(false)}
                                disabled={isProcessing || !adminCode || getTargetUsers().length === 0}
                                className="border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-2"
                            >
                                <Pause className="w-4 h-4" />
                                בטל משימות שבועיות
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold flex items-center gap-2">
                            <Settings className="w-5 h-5 text-indigo-600" />
                            הקצאת שבועות ספציפיים
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label>מתאמן</Label>
                                <Select value={selectedUserEmailForAssignment} onValueChange={setSelectedUserEmailForAssignment}>
                                    <SelectTrigger>
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
                                <Label>שבועות להקצאה</Label>
                                <Select onValueChange={(value) => setWeeksToAssign(value.map(Number))} value={weeksToAssign.map(String)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="בחר שבועות" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {weekOptions.map(option => (
                                            <SelectItem key={option.value} value={String(option.value)}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>היסט (שבועות)</Label>
                                <Input
                                    type="number"
                                    placeholder="אופסט בשבועות"
                                    value={weekOffset}
                                    onChange={(e) => setWeekOffset(Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <Label>קוד ניהול</Label>
                                <Input
                                    type="password"
                                    placeholder="הכנס קוד ניהול"
                                    value={adminCode}
                                    onChange={(e) => setAdminCode(e.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    onClick={handleAssignTasks}
                                    disabled={isProcessing || !adminCode || !selectedUserEmailForAssignment || weeksToAssign.length === 0}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            מקצה...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            הקצה שבועות למתאמן
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="mt-4">
                            <Button
                                onClick={handleApplyTemplateToAll}
                                disabled={isProcessing || !adminCode || weeksToAssign.length === 0}
                                className="w-full bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

                    <div className="space-y-4 p-4 border border-orange-300 bg-orange-50 rounded-lg">
                        <h4 className="font-semibold flex items-center gap-2 text-orange-700">
                            <RotateCcw className="w-5 h-5" />
                            איפוס מלא של משימות שבועיות
                        </h4>
                        <p className="text-orange-600 text-sm">
                            זהירות: פעולה זו תאפס את כל משימות הבוסטר למצב ההתחלתי עבור היעד הנבחר.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>קוד איפוס</Label>
                                <Input
                                    type="password"
                                    placeholder="הכנס קוד איפוס"
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    variant="destructive"
                                    onClick={handleResetTasks}
                                    disabled={isProcessing || !resetCode || getTargetUsers().length === 0}
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
                    </div>

                    {getTargetUsers().length > 0 && (
                        <>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-semibold flex items-center gap-2">
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
                                                                <Shield className="w-3 h-3 ml-1" />
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
                <TabsContent value="freeze-unfreeze-control" className="mt-6 space-y-6">
                    <Card className="muscle-glass border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-teal-600" />
                                ניהול הקפאה והפשרת משימות
                            </CardTitle>
                            <CardDescription>
                                הקפאת משימות תסמן אותן כמוקפאות ותמנע מהן להופיע כפעילות למתאמן. הפשרה תעדכן את תאריכי המשימות בהתאם לתאריך ההתחלה החדש.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Unfreeze Section */}
                            <div className="space-y-4 p-4 border border-green-300 bg-green-50 rounded-lg">
                                <h4 className="font-semibold flex items-center gap-2 text-green-700">
                                    <Play className="w-5 h-5" />
                                    הפשרת משימות (הפעלה מחדש)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>בחר מתאמן</Label>
                                        <Popover open={openUnfreezeUserSelector} onOpenChange={setOpenUnfreezeUserSelector}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openUnfreezeUserSelector}
                                                    className="w-full justify-between"
                                                    disabled={isUnfreezingOperation || isFreezingOperation}
                                                >
                                                    {selectedUserObjectForUnfreeze
                                                        ? selectedUserObjectForUnfreeze.name
                                                        : "בחר משתמש..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                                <Command>
                                                    <CommandInput placeholder="חיפוש משתמש..." />
                                                    <CommandList>
                                                        <CommandEmpty>לא נמצא משתמש.</CommandEmpty>
                                                        <CommandGroup>
                                                            {usersWithBoosterEnabled.map((user) => (
                                                                <CommandItem
                                                                    key={user.email}
                                                                    value={`${user.name} ${user.email}`}
                                                                    onSelect={() => {
                                                                        setSelectedUserObjectForUnfreeze(user);
                                                                        setOpenUnfreezeUserSelector(false);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={`mr-2 h-4 w-4 ${selectedUserObjectForUnfreeze?.email === user.email ? "opacity-100" : "opacity-0"}`}
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
                                        <Label>תאריך התחלה להפשרה (תאריכים יחושבו מחדש)</Label>
                                        <Input
                                            type="date"
                                            value={unfreezeStartDateInput}
                                            onChange={(e) => setUnfreezeStartDateInput(e.target.value)}
                                            disabled={isUnfreezingOperation || isFreezingOperation}
                                            className="text-right"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>קוד ניהול</Label>
                                    <Input
                                        type="password"
                                        placeholder="הכנס קוד ניהול"
                                        value={adminCode}
                                        onChange={(e) => setAdminCode(e.target.value)}
                                        disabled={isUnfreezingOperation || isFreezingOperation}
                                    />
                                </div>
                                <Button
                                    onClick={() => handleUnfreezeTasks(selectedUserObjectForUnfreeze, unfreezeStartDateInput)}
                                    disabled={isUnfreezingOperation || isFreezingOperation || !selectedUserObjectForUnfreeze || !unfreezeStartDateInput || !adminCode}
                                    className="w-full bg-green-600 hover:bg-green-700 flex items-center gap-2"
                                >
                                    {isUnfreezingOperation ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            מפשיר...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 mr-2" />
                                            הפשר משימות
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Freeze Section */}
                            <div className="space-y-4 p-4 border border-orange-300 bg-orange-50 rounded-lg">
                                <h4 className="font-semibold flex items-center gap-2 text-orange-700">
                                    <Pause className="w-5 h-5" />
                                    הקפאת משימות
                                </h4>
                                <p className="text-orange-600 text-sm">
                                    פעולה זו תקפיא את כל המשימות העתידיות של המתאמן. המשימות יוסתרו מהמשתמש עד להפעלה מחדש.
                                </p>
                                <div>
                                    <Label>בחר מתאמן</Label>
                                    <Popover open={openFreezeUserSelector} onOpenChange={setOpenFreezeUserSelector}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openFreezeUserSelector}
                                                className="w-full justify-between"
                                                disabled={isFreezingOperation || isUnfreezingOperation}
                                            >
                                                {selectedUserObjectForFreeze
                                                    ? selectedUserObjectForFreeze.name
                                                    : "בחר משתמש..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                            <Command>
                                                <CommandInput placeholder="חיפוש משתמש..." />
                                                <CommandList>
                                                    <CommandEmpty>לא נמצא משתמש.</CommandEmpty>
                                                    <CommandGroup>
                                                        {usersWithBoosterEnabled.map((user) => (
                                                            <CommandItem
                                                                key={user.email}
                                                                value={`${user.name} ${user.email}`}
                                                                onSelect={() => {
                                                                    setSelectedUserObjectForFreeze(user);
                                                                    setOpenFreezeUserSelector(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={`mr-2 h-4 w-4 ${selectedUserObjectForFreeze?.email === user.email ? "opacity-100" : "opacity-0"}`}
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
                                    <Label>קוד ניהול</Label>
                                    <Input
                                        type="password"
                                        placeholder="הכנס קוד ניהול"
                                        value={adminCode}
                                        onChange={(e) => setAdminCode(e.target.value)}
                                        disabled={isFreezingOperation || isUnfreezingOperation}
                                    />
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            variant="destructive" 
                                            className="w-full flex items-center gap-2"
                                            disabled={isFreezingOperation || isUnfreezingOperation || !selectedUserObjectForFreeze || !adminCode}
                                        >
                                            {isFreezingOperation ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    מקפיא...
                                                </>
                                            ) : (
                                                <>
                                                    <Pause className="w-4 h-4 mr-2" />
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
                    <div className="space-y-4">
                        <Card className="muscle-glass border-0 shadow-lg">
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <BarChart className="w-5 h-5 text-blue-600" />
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
                                        className="cursor-pointer hover:shadow-lg transition-all duration-200 muscle-glass border-l-4"
                                        style={{
                                            borderLeftColor: user.taskStats.completionPercentage >= 75 ? '#22c55e' :
                                                           user.taskStats.completionPercentage >= 50 ? '#f59e0b' :
                                                           user.taskStats.completionPercentage >= 25 ? '#ef4444' : '#64748b'
                                        }}
                                        onClick={() => handleUserTasksView(user)}
                                    >
                                        <CardHeader className="pb-4">
                                            <div className="flex items-center gap-3">
                                                {user.profile_image_url ? (
                                                    <img 
                                                        src={user.profile_image_url} 
                                                        alt={user.name} 
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                                        <UserIcon className="w-5 h-5 text-slate-500" />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg">{user.name}</CardTitle>
                                                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                                                </div>
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
                    
                    <ScrollArea className="max-h-[70vh] pr-4">
                        <div className="space-y-4">
                            {selectedUserTasks.length > 0 ? (
                                selectedUserTasks.map(task => (
                                    <Card key={task.id} className={`border-2 ${task.is_frozen ? 'border-blue-300 bg-blue-50' : ''}`}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">
                                                    <span className="text-blue-600">🔵</span> שבוע {task.week} – {task.title}
                                                    {task.is_frozen && <Badge className="mr-2 bg-blue-400 text-white">מוקפא</Badge>}
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
                                                            {isProcessing && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                                                            {task.status === 'הושלם' ? (
                                                                <>
                                                                    <XCircle className="w-4 h-4 ml-1" />
                                                                    ביטול השלמה
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="w-4 h-4 ml-1" />
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

