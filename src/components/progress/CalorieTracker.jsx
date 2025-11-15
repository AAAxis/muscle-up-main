
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CalorieTracking, User, MealTemplate } from '@/api/entities';
import { UploadFile, InvokeLLM } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, PlusCircle, CheckCircle, AlertTriangle, BookOpen, BrainCircuit, Trash2, Pencil, Utensils, Image as ImageIcon, ChevronDown, ChevronUp, Calendar, Target, TrendingUp, TrendingDown, RefreshCw, Save, Edit, MessageSquare, Zap, MoreVertical, Star, FileText } from 'lucide-react';
import { format, parseISO, isSameDay, startOfToday } from 'date-fns';
import { he } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { groupBy } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";


import { SafeDataBoundary } from '../common/SafeDataHandler';
import { formatDateTime, getRelativeTime, formatDate, formatTime, getCurrentDateString, getCurrentISOString, formatTimestampForEmail } from "@/components/utils/timeUtils";
import CoachMenuDisplay from "@/components/nutrition/CoachMenuDisplay";

const mealTypeOptions = ["ארוחת בוקר", "ארוחת ביניים", "ארוחת צהריים", "ארוחת ערב", "חטיף", "אחר"];

const safeFormatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = parseISO(dateString);
        return format(date, 'd MMMM yyyy', { locale: he });
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return dateString;
    }
};

const safeFormatTime = (dateString) => {
    if (!dateString) return '';
    try {
        return format(parseISO(dateString), 'HH:mm', { locale: he });
    } catch (e) {
        console.error("Error formatting time:", dateString, e);
        return '';
    }
};

const getMealTypeColor = (mealType) => {
    switch (mealType) {
        case "ארוחת בוקר":
            return "bg-blue-100 text-blue-800 border-blue-200";
        case "ארוחת צהריים":
            return "bg-orange-100 text-orange-800 border-orange-200";
        case "ארוחת ערב":
            return "bg-indigo-100 text-indigo-800 border-indigo-200";
        case "ארוחת ביניים":
        case "חטיף":
            return "bg-yellow-100 text-yellow-800 border-yellow-200";
        default:
            return "bg-slate-100 text-slate-800 border-slate-200";
    }
};


export default function CalorieTracker({ user: initialUser, calorieEntries: initialEntries, onUpdateEntries }) {
    const nowISO = getCurrentISOString();

    // Local state for user and entries from props
    const [user, setUser] = useState(initialUser);
    const [entries, setEntries] = useState(initialEntries || []);

    useEffect(() => setUser(initialUser), [initialUser]);
    useEffect(() => setEntries(initialEntries || []), [initialEntries]);

    const [newMeal, setNewMeal] = useState({
        date: format(parseISO(nowISO), 'yyyy-MM-dd'),
        meal_timestamp: nowISO,
        meal_type: mealTypeOptions[0],
        meal_description: '',
        estimated_calories: '',
        protein_grams: '',
        carbs_grams: '',
        fat_grams: '',
        meal_image: null,
        coach_note: '',
        ai_assisted: false,
    });
    const [mealImageFile, setMealImageFile] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Used to trigger refresh for user-related displays
    const [selectedImage, setSelectedImage] = useState(null); // For image modal

    const fileInputRef = useRef(null);
    const { toast } = useToast(); // Initialize useToast

    // New states for templates
    const [templates, setTemplates] = useState([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
    const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    // Force refresh when user data changes (e.g., calorie_target updated by coach)
    useEffect(() => {
        setRefreshTrigger(prev => prev + 1);
    }, [user?.calorie_target]); // Use local user state

    // Load meal templates
    const loadTemplates = useCallback(async () => {
        if (!user?.email) return;
        setIsLoadingTemplates(true);
        try {
            const templatesData = await MealTemplate.filter({ user_email: user.email }, '-created_date');
            setTemplates(templatesData || []);
        } catch (e) {
            console.error("Error loading templates", e);
            toast({
                title: "שגיאה בטעינת תבניות",
                description: "לא ניתן היה לטעון את תבניות הארוחה.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingTemplates(false);
        }
    }, [user?.email, toast]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);


    // Filter today's entries for progress display
    const todayEntries = useMemo(() => {
        if (!entries || entries.length === 0 || !user?.email) return [];

        const today = getCurrentDateString();
        return entries.filter(entry =>
            entry.user_email === user.email && entry.date === today
        );
    }, [entries, user?.email]);

    // Logic for the new inline progress bar
    const totalCaloriesToday = useMemo(() => {
        return todayEntries.reduce((sum, entry) => sum + (entry.estimated_calories || 0), 0);
    }, [todayEntries]);

    const calorieGoal = user?.calorie_target || 2000; // Use local 'user' state for goal

    const progressPercentage = (totalCaloriesToday / calorieGoal) * 100;

    const getProgressColor = () => {
        if (progressPercentage > 110) return "bg-red-500";
        if (progressPercentage > 100) return "bg-yellow-500";
        return "bg-green-500";
    };

    // Get sorted user's calorie entries for display in the journal section
    const sortedUserCalorieEntries = useMemo(() => {
        if (!entries || entries.length === 0 || !user?.email) return [];
        return entries
            .filter(entry => entry.user_email === user.email)
            .sort((a, b) => {
                const timeA = new Date(a.meal_timestamp || a.created_date);
                const timeB = new Date(b.meal_timestamp || b.created_date);
                return timeB - timeA; // Most recent first
            });
    }, [entries, user?.email]);

    const resetForm = () => {
        const nowISO = getCurrentISOString();
        setNewMeal({
            date: format(parseISO(nowISO), 'yyyy-MM-dd'),
            meal_timestamp: nowISO,
            meal_type: mealTypeOptions[0],
            meal_description: '',
            estimated_calories: '',
            protein_grams: '',
            carbs_grams: '',
            fat_grams: '',
            meal_image: null,
            coach_note: '',
            ai_assisted: false,
        });
        setMealImageFile(null);
        setEditingEntry(null);
        setError('');
        setSuccessMessage('');
        setAnalysisResult(null); // Clear AI structured analysis result
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleInputChange = (id, value) => {
        // If the user changes the description after an analysis, reset the AI state
        if (id === 'meal_description' && newMeal.ai_assisted) {
            setAnalysisResult(null); // Clear AI structured analysis result
            setNewMeal(prev => ({ ...prev, [id]: value, ai_assisted: false }));
            return;
        }

        setNewMeal(prev => {
            let updatedMeal = { ...prev, [id]: value };

            // If meal_timestamp changes, update the date field accordingly
            if (id === 'meal_timestamp') {
                try {
                    const dateObj = parseISO(value);
                    if (!isNaN(dateObj.getTime())) { // Check if parsing was successful
                        updatedMeal.date = format(dateObj, 'yyyy-MM-dd');
                    }
                } catch (e) {
                    console.error("Error parsing meal_timestamp:", e);
                }
            }
            return updatedMeal;
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setMealImageFile(file);
        if (file) {
            handleInputChange('meal_image', null);
            // If user changes image, reset AI analysis
            setNewMeal(prev => ({ ...prev, ai_assisted: false }));
            setAnalysisResult(null); // Clear AI structured analysis result
        }
    };

    const handleAnalyzeMeal = async () => {
        if (!newMeal.meal_description?.trim()) {
            setError('יש להזין תיאור ארוחה לפני ניתוח AI.');
            return;
        }
        setIsAnalyzing(true);
        setError('');
        setSuccessMessage('');
        setAnalysisResult(null);

        try {
            // Handle image upload separately for documentation only
            let imageUrlForDocumentation = newMeal.meal_image;
            if (mealImageFile) {
                const { file_url } = await UploadFile({ file: mealImageFile });
                imageUrlForDocumentation = file_url;
            }

            const userDescription = newMeal.meal_description.trim();

            const prompt = `אתה מומחה תזונה מוסמך עם ניסיון של 15 שנה בניתוח ארוחות. יש לך גישה למידע תזונתי עדכני מהאינטרנט. המשימה שלך היא לבצע ניתוח מקצועי ומדויק ככל האפשר של הארוחה על בסיס התיאור הטקסטואלי בלבד.

חשוב מאוד:
- השתמש בגישה שלך לאינטרנט כדי למצוא ערכים תזונתיים מדויקים למאכלים שהמשתמש תיאר.
- אם התיאור לא מספיק מפורט - כתוב "לא ניתן לקבוע בדיוק".
- אל תמציא נתונים או תניח הנחות לא מבוססות.
- היה שמרני בהערכות הכמות.
- בקש מהמשתמש פרטים נוספים אם התיאור לא ברור.

דוגמאות לתיאורים טובים:
- "חזה עוף צלוי 150 גרם, אורז מבושל חצי כוס, סלט ירקות עם כף שמן זית"
- "שני ביצים מקושקשות, שתי פרוסות לחם מחיטה מלאה, אבוקדו רבע יחידה"

אם התיאור לא מספיק ספציפי - ציין מה חסר לניתוח מדויק יותר.

תיאור המשתמש: "${userDescription}"`;

            const response_json_schema = {
                type: "object",
                properties: {
                    analysis_description: {
                        type: "string",
                        description: "ניתוח מקצועי ומפורט של המזונות שתוארו, כולל אי-ודאויות ומגבלות הניתוח. אם יש ספק - יש לציין זאת."
                    },
                    detailed_breakdown: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                food_item: { type: "string", description: "שם המזון כפי שתואר" },
                                quantity: { type: "string", description: "כמות משוערת או כפי שצוינה" },
                                calories_per_unit: { type: "number", description: "קלוריות ליחידה או ל-100 גרם" },
                                total_calories: { type: "number", description: "סך קלוריות למזון זה" },
                                protein: { type: "number", description: "גרמי חלבון" },
                                carbs: { type: "number", description: "גרמי פחמימות" },
                                fat: { type: "number", description: "גרמי שומן" }
                            }
                        },
                        description: "פירוט מדויק של כל מרכיב במזון"
                    },
                    calories: {
                        type: "number",
                        description: "סך הקלוריות של כל הארוחה"
                    },
                    protein: {
                        type: "number",
                        description: "סך גרמי החלבון"
                    },
                    carbs: {
                        type: "number",
                        description: "סך גרמי הפחמימות"
                    },
                    fat: {
                        type: "number",
                        description: "סך גרמי השומן"
                    },
                    confidence_level: {
                        type: "string",
                        enum: ["גבוה", "בינוני", "נמוך"],
                        description: "רמת הוודאות בניתוח בהתבסס על פירוט התיאור"
                    },
                    limitations: {
                        type: "string",
                        description: "מגבלות הניתוח - מה לא ניתן לקבוע בדיוק ומדוע, או איזה פרטים נוספים יכולים לשפר את הדיוק"
                    },
                    suggestions_for_better_description: {
                        type: "string",
                        description: "הצעות לשיפור התיאור עבור ניתוח מדויק יותר בעתיד"
                    }
                },
                required: ["analysis_description", "detailed_breakdown", "calories", "protein", "carbs", "fat", "confidence_level", "limitations"]
            };

            const llmAnalysisResult = await InvokeLLM({
                prompt,
                response_json_schema,
                add_context_from_internet: true
            });

            if (llmAnalysisResult && llmAnalysisResult.analysis_description) {
                // Only update fields if AI provided meaningful data
                const calories = llmAnalysisResult.calories && llmAnalysisResult.calories > 0 ? llmAnalysisResult.calories.toString() : '';
                const protein = llmAnalysisResult.protein && llmAnalysisResult.protein > 0 ? llmAnalysisResult.protein.toString() : '';
                const carbs = llmAnalysisResult.carbs && llmAnalysisResult.carbs > 0 ? llmAnalysisResult.carbs.toString() : '';
                const fat = llmAnalysisResult.fat && llmAnalysisResult.fat > 0 ? llmAnalysisResult.fat.toString() : '';

                setNewMeal(prev => ({
                    ...prev,
                    estimated_calories: calories,
                    protein_grams: protein,
                    carbs_grams: carbs,
                    fat_grams: fat,
                    meal_image: imageUrlForDocumentation || null, // Store image for documentation only, or null
                    ai_assisted: true
                }));

                setAnalysisResult(llmAnalysisResult); // Store the full structured result

                const confidenceMessage = llmAnalysisResult.confidence_level === 'גבוה' ?
                    'ניתוח AI הושלם בהצלחה! הערכים התזונתיים עודכנו.' :
                    llmAnalysisResult.confidence_level === 'בינוני' ?
                        'ניתוח AI הושלם. אנא בדוק את הערכים ועדכן במידת הצורך.' :
                        'ניתוח AI הושלם עם ודאות נמוכה. מומלץ לעדכן ידנית את הערכים.';

                setSuccessMessage(confidenceMessage);
            } else {
                throw new Error("תגובת ה-AI לא הייתה בפורמט הצפוי או לא כללה נתונים מספקים.");
            }

        } catch (err) {
            console.error("AI analysis failed:", err);
            setError("שגיאה בניתוח AI. זה יכול לקרות אם התיאור לא מספיק מפורט או שהשירות עמוס. נסה שוב או הזן ידנית.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async (mealToSave) => {
        if (!mealToSave.meal_type || !mealToSave.meal_description) {
            setError('שגיאה: יש למלא סוג ארוחה ותיאור לפני השמירה.');
            return;
        }
        if (!mealToSave.meal_timestamp) {
            setError('שגיאה: יש לבחור תאריך ושעת ארוחה לפני השמירה.');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const currentUser = await User.me();

            // CRITICAL FIX: Ensure user_email is always the current user
            const dataToSave = {
                ...mealToSave,
                user_email: currentUser.email, // Force current user's email
                estimated_calories: Number(mealToSave.estimated_calories) || null,
                protein_grams: Number(mealToSave.protein_grams) || null,
                carbs_grams: Number(mealToSave.carbs_grams) || null,
                fat_grams: Number(mealToSave.fat_grams) || null,
                shared_with_coach: true,
                viewed_by_coach: false,
                created_date: editingEntry ? editingEntry.created_date : getCurrentISOString(),
                meal_timestamp: mealToSave.meal_timestamp,
            };

            let savedEntry;
            if (editingEntry) {
                // Additional security check for editing
                if (editingEntry.user_email !== currentUser.email) {
                    setError('שגיאה: אין לך הרשאה לערוך ארוחה זו.');
                    setIsSaving(false);
                    return;
                }
                savedEntry = await CalorieTracking.update(editingEntry.id, dataToSave);
            } else {
                savedEntry = await CalorieTracking.create(dataToSave);
            }

            setSuccessMessage('הארוחה נשמרה בהצלחה!');
            setTimeout(() => setSuccessMessage(''), 3000);

            // Refresh entries - pass current user email to ensure proper filtering
            if (onUpdateEntries) {
                onUpdateEntries(currentUser.email);
            }
            resetForm();

            // Note: Email sending has been removed - sharing is app-only
            console.log('Meal saved and shared with coach via app only');

        } catch (err) {
            console.error("Error saving entry:", err);
            setError('שגיאה בשמירת הארוחה. אנא נסה/י שוב מאוחר יותר.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        let imageUrl = newMeal.meal_image;

        if (mealImageFile) {
            try {
                const { file_url } = await UploadFile({ file: mealImageFile });
                imageUrl = file_url;
            } catch (uploadErr) {
                console.error("Error uploading image:", uploadErr);
                setError("שגיאה בהעלאת התמונה. אנא נסה/י שוב.");
                return;
            }
        }

        const mealData = {
            ...newMeal,
            meal_image: imageUrl,
        };

        await handleSave(mealData);
    };

    const handleDeleteEntry = async (entryId) => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק את רישום הארוחה? פעולה זו בלתי הפיכה.')) {
            setError('');
            setSuccessMessage('');
            try {
                const currentUser = await User.me();

                // Security check: ensure user can only delete their own entries
                const entryToDelete = entries.find(entry =>
                    entry.id === entryId && entry.user_email === currentUser.email
                );

                if (!entryToDelete) {
                    setError('שגיאה: אין לך הרשאה למחוק ארוחה זו.');
                    return;
                }

                await CalorieTracking.delete(entryId);
                setSuccessMessage('הארוחה נמחקה בהצלחה.');

                if (onUpdateEntries) {
                    onUpdateEntries(currentUser.email);
                }
            } catch (err) {
                console.error('Error deleting calorie entry:', err);
                setError('שגיאה במחיקת הארוחה. אנא נסה/י שוב.');
            }
        }
    };

    const handleEdit = useCallback((entry) => {
        // Security check: ensure user can only edit their own entries
        if (entry.user_email !== user?.email) {
            setError('שגיאה: אין לך הרשאה לערוך ארוחה זו.');
            return;
        }

        // Fallback to created_date if meal_timestamp doesn't exist (for old entries)
        const effectiveTimestamp = entry.meal_timestamp || entry.created_date || getCurrentISOString();
        setEditingEntry(entry);
        setNewMeal({
            date: format(parseISO(effectiveTimestamp), 'yyyy-MM-dd'), // Derive date from timestamp
            meal_timestamp: effectiveTimestamp, // Use actual or fallback timestamp
            meal_type: entry.meal_type,
            meal_description: entry.meal_description,
            estimated_calories: entry.estimated_calories?.toString() || '',
            protein_grams: entry.protein_grams?.toString() || '',
            carbs_grams: entry.carbs_grams?.toString() || '',
            fat_grams: entry.fat_grams?.toString() || '',
            meal_image: entry.meal_image || null, // Ensure null if not present
            coach_note: entry.coach_note || '',
            ai_assisted: entry.ai_assisted || false,
        });
        setMealImageFile(null);
        setError('');
        setSuccessMessage('');
        setAnalysisResult(null); // Clear previous AI analysis on edit
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [user, fileInputRef]);

    const handleUseTemplate = (template) => {
        setNewMeal(prev => ({
            ...prev,
            meal_description: template.meal_description || '',
            estimated_calories: template.estimated_calories?.toString() || '',
            protein_grams: template.protein_grams?.toString() || '',
            carbs_grams: template.carbs_grams?.toString() || '',
            fat_grams: template.fat_grams?.toString() || '',
            meal_image: template.image_url || null, // Use null for image
            ai_assisted: true, // Mark as AI-assisted if loaded from template
        }));
        setMealImageFile(null); // Clear any existing file
        setAnalysisResult(null); // Clear AI structured analysis result if existing
        // Optional: pre-fill AI analysis result if template data is complete
        if (template.estimated_calories) {
            setAnalysisResult({
                calories: template.estimated_calories,
                protein: template.protein_grams,
                carbs: template.carbs_grams,
                fat: template.fat_grams,
                analysis_description: `פרטי ארוחה נטענו מתבנית: "${template.template_name}".`,
                detailed_breakdown: [], // No detailed breakdown from template
                confidence_level: "גבוה", // Assume high confidence if loaded from template
                limitations: "נתונים נטענו מתבנית, ללא ניתוח AI חדש.",
                suggestions_for_better_description: "",
            });
        }

        toast({
            title: "תבנית נטענה",
            description: `הפרטים של "${template.template_name}" מולאו בטופס.`,
        });
        // Consider adding a state to switch to the "Add Meal" tab automatically
        // For now, let the user navigate manually or add `const [activeTab, setActiveTab] = useState('add');`
        // and set `setActiveTab('add');` here, then control `Tabs` with it.
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim() || !analysisResult) {
            toast({
                title: "שגיאה",
                description: "יש לנתח ארוחה ולתת שם לתבנית לפני השמירה.",
                variant: "destructive",
            });
            return;
        }

        try {
            const newTemplate = {
                user_email: user.email,
                template_name: newTemplateName.trim(),
                meal_description: newMeal.meal_description,
                estimated_calories: Number(analysisResult.calories) || 0,
                protein_grams: Number(analysisResult.protein) || 0,
                carbs_grams: Number(analysisResult.carbs) || 0,
                fat_grams: Number(analysisResult.fat) || 0,
                image_url: newMeal.meal_image || null,
            };
            await MealTemplate.create(newTemplate);
            toast({
                title: "תבנית נשמרה!",
                description: `הארוחה "${newTemplateName.trim()}" נשמרה לשימוש עתידי.`,
            });
            loadTemplates();
            setIsSaveTemplateDialogOpen(false);
            setNewTemplateName('');
        } catch (error) {
            console.error("Error saving template", error);
            toast({
                title: "שגיאה בשמירת תבנית",
                description: "לא ניתן היה לשמור את התבנית. נסה שוב.",
                variant: "destructive",
            });
        }
    };

    const handleDeleteTemplate = async (templateId) => {
        if (window.confirm("האם אתה בטוח שברצונך למחוק תבנית זו? פעולה זו בלתי הפיכה.")) {
            try {
                await MealTemplate.delete(templateId);
                toast({
                    title: "תבנית נמחקה",
                    description: "התבנית נמחקה בהצלחה.",
                });
                loadTemplates();
            } catch (error) {
                console.error("Error deleting template:", error);
                toast({
                    title: "שגיאה במחיקת תבנית",
                    description: "לא ניתן היה למחוק את התבנית. נסה שוב.",
                });
            }
        }
    };


    const groupedEntries = useMemo(() => {
        if (!sortedUserCalorieEntries || sortedUserCalorieEntries.length === 0) return {};
        const grouped = {};
        sortedUserCalorieEntries.forEach(entry => {
            const dateKey = entry.date; // entry.date is already YYYY-MM-DD
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(entry);
        });
        // Sort keys (dates) in descending order to show most recent days first
        const sortedKeys = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
        const sortedGrouped = {};
        sortedKeys.forEach(key => {
            // Sort entries within each day by meal_timestamp (most recent first)
            sortedGrouped[key] = grouped[key].sort((a, b) => new Date(b.meal_timestamp || b.created_date) - new Date(a.meal_timestamp || a.created_date));
        });
        return sortedGrouped;
    }, [sortedUserCalorieEntries]);

    const firstDay = Object.keys(groupedEntries).length > 0 ? Object.keys(groupedEntries)[0] : '';


    return (
        <SafeDataBoundary>
            <div className="w-full max-w-none space-y-6">
                {user && <CoachMenuDisplay user={user} />}

                <Card className="muscle-glass border-0 shadow-lg">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-slate-800">
                                    <Utensils className="w-6 h-6 text-orange-600" />
                                    מעקב קלוריות ותזונה
                                </CardTitle>
                                <CardDescription>תעד את הארוחות שלך ועקוב אחר צריכת הקלוריות</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Daily Progress Bar (New implementation) */}
                        {todayEntries.length > 0 && (
                            <div className="mb-6">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 sm:p-6 border shadow-lg"
                                >
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                                        <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                                            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                                            התקדמות יומית - קלוריות
                                        </h3>
                                        <div className="text-right">
                                            <p className="text-xl sm:text-2xl font-bold text-slate-900">{totalCaloriesToday.toLocaleString()}</p>
                                            <p className="text-xs sm:text-sm text-slate-600">
                                                מתוך {calorieGoal.toLocaleString()} קק"ל
                                                {user?.calorie_target && (
                                                    <span className="text-xs text-green-600 block font-medium">
                                                        ✓ נקבע ע"י המאמן
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Progress
                                            value={Math.min(progressPercentage, 100)} // Ensure value doesn't exceed 100 for visual bar
                                            className={`w-full bg-gray-200 rounded-full h-2 sm:h-3 mb-2 [&>div]:${getProgressColor()} [&>div]:rounded-full`}
                                        />
                                        <div className="flex justify-between text-xs sm:text-sm text-slate-600 mt-2">
                                            <span>{progressPercentage.toFixed(1)}% מהיעד</span>
                                            <span>נשארו: {Math.max(calorieGoal - totalCaloriesToday, 0).toLocaleString()} קק"ל</span>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {/* AI Food Analysis Form */}
                        <Tabs defaultValue="add" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-lg">
                                <TabsTrigger value="add" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-400 data-[state=active]:to-yellow-400 data-[state=active]:text-white data-[state=active]:shadow-md">הוספת ארוחה</TabsTrigger>
                                <TabsTrigger value="templates" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-400 data-[state=active]:to-yellow-400 data-[state=active]:text-white data-[state=active]:shadow-md">תבניות שמורות</TabsTrigger>
                            </TabsList>

                            <TabsContent value="add" className="mt-4">
                                <div className="mb-6 p-3 sm:p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                                    <form onSubmit={handleFormSubmit} className="space-y-4">
                                        <h3 className="text-base sm:text-lg font-semibold">{editingEntry ? 'עריכת ארוחה קיימת' : 'הוספת ארוחה חדשה'}</h3>
                                        {/* Success Message */}
                                        <AnimatePresence>
                                            {successMessage && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -20 }}
                                                    className="p-3 bg-green-50 border border-green-200 rounded-lg"
                                                >
                                                    <p className="text-xs sm:text-sm text-green-800 break-words">{successMessage}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {/* Error Message */}
                                        <AnimatePresence>
                                            {error && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -20 }}
                                                    className="p-3 bg-red-50 border border-red-200 rounded-lg"
                                                >
                                                    <p className="text-xs sm:text-sm text-red-800 break-words">{error}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="meal_timestamp" className="text-sm">תאריך ושעת ארוחה *</Label>
                                                <Input
                                                    id="meal_timestamp"
                                                    type="datetime-local"
                                                    // Format ISO string from state for datetime-local input
                                                    value={newMeal.meal_timestamp ? format(parseISO(newMeal.meal_timestamp), "yyyy-MM-dd'T'HH:mm") : ''}
                                                    onChange={(e) => {
                                                        const localDateTimeString = e.target.value;
                                                        if (localDateTimeString) {
                                                            // Convert local date-time string to Date object
                                                            const selectedDate = new Date(localDateTimeString);
                                                            // Convert Date object to ISO string (UTC) for storage
                                                            const isoString = selectedDate.toISOString();
                                                            handleInputChange('meal_timestamp', isoString);
                                                        } else {
                                                            handleInputChange('meal_timestamp', '');
                                                        }
                                                    }}
                                                    required
                                                    className="text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="meal_type" className="text-sm">סוג הארוחה *</Label>
                                                <Select value={newMeal.meal_type} onValueChange={(val) => handleInputChange('meal_type', val)}>
                                                    <SelectTrigger className="text-sm"><SelectValue placeholder="בחר סוג ארוחה" /></SelectTrigger>
                                                    <SelectContent>
                                                        {mealTypeOptions.map(option => (
                                                            <SelectItem key={option} value={option} className="text-sm">{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="meal_description" className="text-sm">תיאור הארוחה *</Label>
                                            <Textarea
                                                id="meal_description"
                                                value={newMeal.meal_description}
                                                onChange={(e) => handleInputChange('meal_description', e.target.value)}
                                                placeholder="תאר בפירוט את הארוחה שלך - מה אכלת ובאיזו כמות. לדוגמה: חזה עוף צלוי 150 גרם, אורז מבושל חצי כוס, סלט ירקות עם כף שמן זית. תיאור מפורט יעזור ל-AI לנתח בצורה טובה יותר."
                                                required
                                                className="text-sm min-h-[80px] resize-none"
                                                dir="rtl"
                                            />
                                            <p className="text-xs text-slate-500 mt-1 break-words">
                                                💡 תיאור מפורט עם כמויות יעזור ל-AI לתת ניתוח מדויק יותר של הערכים התזונתיים
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="meal_image_file" className="text-sm">תמונה של הארוחה (אופציונלי - לתיעוד בלבד)</Label>
                                            <Input id="meal_image_file" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="text-sm" />
                                            <p className="text-xs text-slate-500 mt-1 break-words">
                                                📸 התמונה תשמר לתיעוד ותיראה למאמן שלך, אך הניתוח מתבסס על התיאור בלבד
                                            </p>
                                            {newMeal.meal_image && !mealImageFile && (
                                                <p className="text-xs text-gray-500 mt-1 break-words">
                                                    תמונה קיימת: <a href={newMeal.meal_image} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">צפה בתמונה</a>
                                                </p>
                                            )}
                                        </div>

                                        {newMeal.meal_description?.trim() && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handleAnalyzeMeal}
                                                disabled={isAnalyzing}
                                                className="w-full sm:w-auto flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 text-sm h-10 sm:h-11"
                                            >
                                                {isAnalyzing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                                                        <span className="truncate">מנתח...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Zap className="mr-2 h-4 w-4 flex-shrink-0" />
                                                        <span className="truncate">נתח ארוחה עם AI (מבוסס על התיאור)</span>
                                                    </>
                                                )}
                                            </Button>
                                        )}

                                        {analysisResult && !isAnalyzing && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mt-4 p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200 shadow-sm"
                                            >
                                                <div className="flex items-start gap-2 mb-3">
                                                    <Zap className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
                                                    <h4 className="text-sm sm:text-base font-semibold text-purple-800">תוצאות ניתוח ארוחה (AI)</h4>
                                                </div>

                                                {/* Summary totals */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
                                                    <div className="p-2 bg-white rounded-md shadow-sm border border-slate-100">
                                                        <p className="text-xs text-slate-500">קלוריות</p>
                                                        <p className="font-semibold text-base sm:text-lg text-orange-600">{analysisResult.calories?.toLocaleString() || '0'}</p>
                                                    </div>
                                                    <div className="p-2 bg-white rounded-md shadow-sm border border-slate-100">
                                                        <p className="text-xs text-slate-500">חלבון (ג)</p>
                                                        <p className="font-semibold text-base sm:text-lg text-blue-600">{analysisResult.protein?.toLocaleString() || '0'}</p>
                                                    </div>
                                                    <div className="p-2 bg-white rounded-md shadow-sm border border-slate-100">
                                                        <p className="text-xs text-slate-500">פחמימה (ג)</p>
                                                        <p className="font-semibold text-base sm:text-lg text-red-600">{analysisResult.carbs?.toLocaleString() || '0'}</p>
                                                    </div>
                                                    <div className="p-2 bg-white rounded-md shadow-sm border border-slate-100">
                                                        <p className="text-xs text-slate-500">שומן (ג)</p>
                                                        <p className="font-semibold text-base sm:text-lg text-green-600">{analysisResult.fat?.toLocaleString() || '0'}</p>
                                                    </div>
                                                </div>

                                                {/* Analysis Description */}
                                                {analysisResult.analysis_description && (
                                                    <div className="mb-4">
                                                        <h5 className="font-bold text-sm text-slate-700 mb-2">תיאור הניתוח:</h5>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{analysisResult.analysis_description}</p>
                                                    </div>
                                                )}

                                                {/* Detailed Breakdown Accordion */}
                                                {analysisResult.detailed_breakdown && analysisResult.detailed_breakdown.length > 0 && (
                                                    <Accordion type="single" collapsible className="w-full">
                                                        <AccordionItem value="detailed-breakdown">
                                                            <AccordionTrigger className="text-sm font-medium">פירוט מרכיבים (קליק להרחבה)</AccordionTrigger>
                                                            <AccordionContent>
                                                                <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                                                                    {analysisResult.detailed_breakdown.map((item, index) => (
                                                                        <li key={index} className="p-2 bg-slate-50 rounded-md flex justify-between items-center gap-2">
                                                                            <span className="flex-1 min-w-0 break-words text-right">
                                                                                {item.food_item} ({item.quantity})
                                                                            </span>
                                                                            <span className="font-semibold shrink-0 text-slate-800">
                                                                                {item.total_calories} קק"ל
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                )}

                                                {/* Confidence, Limitations, Suggestions */}
                                                <div className="mt-4 space-y-3">
                                                    {analysisResult.confidence_level && (
                                                        <p className="text-sm text-slate-700">
                                                            <span className="font-semibold">רמת ודאות:</span> {analysisResult.confidence_level}
                                                        </p>
                                                    )}
                                                    {analysisResult.limitations && (
                                                        <div className="p-2 rounded-md bg-yellow-50 border border-yellow-200">
                                                            <p className="text-sm text-yellow-800">
                                                                <span className="font-semibold">מגבלות הניתוח:</span> {analysisResult.limitations}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {analysisResult.suggestions_for_better_description && (
                                                        <div className="p-2 rounded-md bg-blue-50 border border-blue-200">
                                                            <p className="text-sm text-blue-800">
                                                                <span className="font-semibold">הצעות לשיפור התיאור:</span> {analysisResult.suggestions_for_better_description}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                                                        💡 המלצה: {analysisResult.confidence_level === 'נמוך' ?
                                                            'בשל רמת הודאות הנמוכה, מומלץ לוודא ולעדכן את הערכים התזונתיים ידנית.' :
                                                            'ניתן לערוך את הערכים במידת הצורך לפני השמירה.'
                                                        }
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => setIsSaveTemplateDialogOpen(true)}
                                                    className="gap-2 mt-4 w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white"
                                                >
                                                    <Save className="w-4 h-4" /> שמור כתבנית
                                                </Button>
                                            </motion.div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t">
                                            <div className="space-y-1">
                                                <Label htmlFor="estimated_calories" className="text-sm">קלוריות משוערות</Label>
                                                <Input
                                                    id="estimated_calories"
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={newMeal.estimated_calories}
                                                    onChange={(e) => handleInputChange('estimated_calories', e.target.value)}
                                                    placeholder="0"
                                                    className="text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="protein_grams" className="text-sm">חלבון (גרם)</Label>
                                                <Input
                                                    id="protein_grams"
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={newMeal.protein_grams}
                                                    onChange={(e) => handleInputChange('protein_grams', e.target.value)}
                                                    placeholder="0"
                                                    className="text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="carbs_grams" className="text-sm">פחמימות (גרם)</Label>
                                                <Input
                                                    id="carbs_grams"
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={newMeal.carbs_grams}
                                                    onChange={(e) => handleInputChange('carbs_grams', e.target.value)}
                                                    placeholder="0"
                                                    className="text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="fat_grams" className="text-sm">שומן (גרם)</Label>
                                                <Input
                                                    id="fat_grams"
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={newMeal.fat_grams}
                                                    onChange={(e) => handleInputChange('fat_grams', e.target.value)}
                                                    placeholder="0"
                                                    className="text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="coach_note" className="text-sm">הערה למאמן/ת (אופציונלי)</Label>
                                            <Textarea
                                                id="coach_note"
                                                value={newMeal.coach_note}
                                                onChange={(e) => handleInputChange('coach_note', e.target.value)}
                                                placeholder="כתוב הערה או שאלה למאמן שלך..."
                                                className="h-16 sm:h-20 text-sm resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2">
                                            <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving || isAnalyzing} className="w-full sm:w-auto text-sm">
                                                ביטול
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={isSaving || isAnalyzing}
                                                className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white h-10 sm:h-11 text-sm"
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        שומר...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Utensils className="mr-2 h-4 w-4" />
                                                        שמור ארוחה
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </TabsContent>

                            <TabsContent value="templates" className="mt-4 p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 min-h-[200px]">
                                {isLoadingTemplates ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mb-3" />
                                        <p>טוען תבניות...</p>
                                    </div>
                                ) : templates.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 flex flex-col items-center justify-center h-full min-h-[150px]">
                                        <FileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                                        <p className="mt-2 text-base">אין לך תבניות שמורות.</p>
                                        <p className="text-sm">שמור ארוחות לאחר ניתוח כדי להשתמש בהן שוב בקלות.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {templates.map(template => (
                                            <Card key={template.id} className="p-4 bg-white shadow-sm border border-slate-100 flex flex-col justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
                                                        <Star className="w-5 h-5 text-yellow-500 flex-shrink-0"/>{template.template_name}
                                                    </p>
                                                    <p className="text-sm text-slate-600 line-clamp-2">{template.meal_description}</p>
                                                    <div className="text-xs text-slate-500 mt-2">
                                                        <span className="font-medium text-orange-600">{template.estimated_calories} קק"ל</span>
                                                        {template.protein_grams && ` · ${template.protein_grams}ג חלבון`}
                                                        {template.carbs_grams && ` · ${template.carbs_grams}ג פחמימה`}
                                                        {template.fat_grams && ` · ${template.fat_grams}ג שומן`}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 mt-4 justify-end">
                                                    <Button size="sm" onClick={() => handleUseTemplate(template)} className="flex-1 sm:flex-none">
                                                        <PlusCircle className="w-4 h-4 ml-1"/> השתמש
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(template.id)} className="flex-1 sm:flex-none text-red-500 hover:bg-red-50">
                                                        <Trash2 className="w-4 h-4"/> מחק
                                                    </Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>


                        {/* Meal Entries */}
                        <div className="mt-8">
                            <h3 className="text-lg font-semibold mb-4 text-slate-800 text-center">יומן ארוחות</h3>
                            {sortedUserCalorieEntries.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <Utensils className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                                    <p>עדיין לא נרשמו ארוחות</p>
                                    <p className="text-sm">התחל לתעד את הארוחות שלך כדי לעקוב אחר התזונה שלך!</p>
                                    <Button onClick={resetForm}>
                                        <PlusCircle className="w-4 h-4 mr-2" />
                                        הוסף ארוחה ראשונה
                                    </Button>
                                </div>
                            ) : (
                                <Accordion type="single" collapsible defaultValue={firstDay} className="w-full space-y-3">
                                    {Object.entries(groupedEntries).map(([date, dailyEntries]) => {
                                        const totalCalories = dailyEntries.reduce((sum, e) => sum + (e.estimated_calories || 0), 0);
                                        const mealCount = dailyEntries.length;

                                        return (
                                            <AccordionItem value={date} key={date} className="bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm">
                                                <AccordionTrigger className="px-4 py-3 text-base font-semibold text-slate-700 hover:no-underline hover:bg-slate-50 rounded-t-xl">
                                                    <div className="flex justify-between w-full items-center">
                                                        <span>{safeFormatDate(date)}</span>
                                                        <Badge variant="outline" className="text-sm font-medium">{mealCount} ארוחות · {totalCalories.toLocaleString()} קק"ל</Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 border-t border-slate-200">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 justify-items-center">
                                                        <AnimatePresence>
                                                            {dailyEntries.map((entry) => (
                                                                <motion.div
                                                                    key={entry.id}
                                                                    layout
                                                                    initial={{ opacity: 0, y: 20 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: -20 }}
                                                                    className="w-full max-w-sm"
                                                                >
                                                                    <Card className="muscle-glass border-0 shadow-md hover:shadow-lg transition-all duration-200 h-full">
                                                                        <CardHeader className="pb-3">
                                                                            <div className="flex items-start justify-between">
                                                                                <div className="flex-1">
                                                                                    <CardTitle className="text-base font-semibold text-slate-800 line-clamp-2">
                                                                                        {entry.meal_description}
                                                                                    </CardTitle>
                                                                                    <div className="flex items-center gap-2 mt-2">
                                                                                        <Badge className={getMealTypeColor(entry.meal_type)}>
                                                                                            {entry.meal_type}
                                                                                        </Badge>
                                                                                        <span className="text-xs text-slate-500">
                                                                                            {safeFormatTime(entry.meal_timestamp || entry.created_date)}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                                                            <MoreVertical className="h-4 w-4" />
                                                                                        </Button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent align="end">
                                                                                        <DropdownMenuItem onClick={() => handleEdit(entry)}>
                                                                                            <Pencil className="mr-2 h-4 w-4" />
                                                                                            ערוך
                                                                                        </DropdownMenuItem>
                                                                                        <DropdownMenuItem onClick={() => handleDeleteEntry(entry.id)}>
                                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                                            מחק
                                                                                        </DropdownMenuItem>
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                            </div>
                                                                        </CardHeader>

                                                                        {entry.meal_image && (
                                                                            <div className="px-4 pb-3">
                                                                                <img
                                                                                    src={entry.meal_image}
                                                                                    alt={entry.meal_description}
                                                                                    className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                                    onClick={() => setSelectedImage(entry.meal_image)}
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        <CardContent className="pt-0">
                                                                            <div className="space-y-2">
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-sm text-slate-600">קלוריות:</span>
                                                                                    <span className="font-semibold text-orange-600">
                                                                                        {entry.estimated_calories || '0'} קק"ל
                                                                                    </span>
                                                                                </div>

                                                                                {entry.protein_grams && (
                                                                                    <div className="flex justify-between items-center">
                                                                                        <span className="text-xs text-slate-500">חלבון:</span>
                                                                                        <span className="text-xs font-medium">{entry.protein_grams}ג</span>
                                                                                    </div>
                                                                                )}

                                                                                {entry.carbs_grams && (
                                                                                    <div className="flex justify-between items-center">
                                                                                        <span className="text-xs text-slate-500">פחמימה:</span>
                                                                                        <span className="text-xs font-medium">{entry.carbs_grams}ג</span>
                                                                                    </div>
                                                                                )}

                                                                                {entry.fat_grams && (
                                                                                    <div className="flex justify-between items-center">
                                                                                        <span className="text-xs text-slate-500">שומן:</span>
                                                                                        <span className="text-xs font-medium">{entry.fat_grams}ג</span>
                                                                                    </div>
                                                                                )}

                                                                                <div className="pt-2 border-t">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-xs text-slate-400">
                                                                                            {safeFormatDate(entry.date)}
                                                                                        </span>
                                                                                        {entry.ai_assisted && (
                                                                                            <Badge variant="secondary" className="text-xs">
                                                                                                🤖 AI
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </CardContent>
                                                                    </Card>
                                                                </motion.div>
                                                            ))}
                                                        </AnimatePresence>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                </Accordion>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Image Modal */}
                <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                    <DialogContent className="max-w-2xl" dir="rtl">
                        <DialogHeader>
                            <DialogTitle>תמונת ארוחה</DialogTitle>
                        </DialogHeader>
                        <div className="flex justify-center">
                            <img
                                src={selectedImage}
                                alt="תמונת ארוחה"
                                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                            />
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Save Template Dialog */}
                <Dialog open={isSaveTemplateDialogOpen} onOpenChange={setIsSaveTemplateDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>שמור ארוחה כתבנית</DialogTitle>
                            <DialogDescription>
                                הזן שם עבור התבנית כדי שתוכל להשתמש בה שוב בקלות.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="template_name">שם התבנית</Label>
                                <Input
                                    id="template_name"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="לדוגמה: ארוחת הבוקר הקבועה שלי"
                                />
                            </div>
                            <Button onClick={handleSaveTemplate} disabled={!newTemplateName.trim()} className="w-full">
                                שמור תבנית
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </SafeDataBoundary>
    );
}
