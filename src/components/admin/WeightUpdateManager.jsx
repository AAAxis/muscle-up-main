
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, WeightEntry, WeightReminder } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Clock, Loader2, RefreshCw, ArrowUpDown, Scale, Edit, Save, X, Heart, Ruler, Zap, Dna, Activity, Droplets, ShieldAlert, Target, Recycle, Dumbbell, Pencil, Info } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { getCurrentDateString } from '@/components/utils/timeUtils';


const STORAGE_KEY = 'weightReminderSentDates';

// --- Status Calculation Helpers ---
const getBMICategory = (bmi) => {
    if (!bmi) return { level: null, text: 'לא חושב' };
    const bmiVal = parseFloat(bmi);
    if (bmiVal < 18.5) return { level: 'סיכון גבוה', text: 'תת משקל' };
    if (bmiVal < 25) return { level: 'תקין', text: 'תקין' };
    if (bmiVal < 30) return { level: 'מעקב', text: 'עודף משקל' };
    return { level: 'סיכון גבוה', text: 'השמנה' };
};

const getBMIColor = (bmi) => {
    if (!bmi) return 'default';
    const bmiVal = parseFloat(bmi);
    if (bmiVal < 18.5) return 'blue'; // Underweight
    if (bmiVal < 25) return 'green'; // Normal
    if (bmiVal < 30) return 'yellow'; // Overweight
    return 'red'; // Obese
};

const getFatPercentageCategory = (fat, gender) => {
    if (!fat) return null;
    const fatVal = parseFloat(fat);
    if (gender === 'female') {
        if (fatVal < 21) return { level: 'תקין', text: 'נמוך' };
        if (fatVal <= 33) return { level: 'תקין', text: 'תקין' };
        if (fatVal <= 39) return { level: 'מעקב', text: 'גבוה' };
        return { level: 'סיכון גבוה', text: 'גבוה מאוד' };
    } else { // male
        if (fatVal < 8) return { level: 'תקין', text: 'נמוך' };
        if (fatVal <= 20) return { level: 'תקין', text: 'תקין' };
        if (fatVal <= 25) return { level: 'מעקב', text: 'גבוה' };
        return { level: 'סיכון גבוה', text: 'גבוה מאוד' };
    }
};

const getMetabolicAgeStatus = (metabolicAge, realAge) => {
    if (!metabolicAge || !realAge) return null;
    const metabolicAgeVal = parseFloat(metabolicAge);
    const diff = metabolicAgeVal - realAge;
    if (diff <= 0) return { level: 'תקין', text: 'צעיר מגילך' };
    if (diff <= 5) return { level: 'מעקב', text: 'מעט מעל גילך' };
    return { level: 'סיכון גבוה', text: 'גבוה מגילך' };
};

const getVisceralFatStatus = (level) => {
    if (!level) return null;
    const levelVal = parseFloat(level);
    if (levelVal <= 12) return { level: 'תקין', text: 'תקין' };
    return { level: 'סיכון גבוה', text: 'גבוה' };
};

// Helper functions for measurement status indicators
const getMeasurementStatus = (type, value, userGender, userAge) => {
    if (value === '' || value === null || isNaN(parseFloat(value))) return null;
    const numValue = parseFloat(value);

    switch (type) {
        case 'bmi':
            if (numValue < 18.5) return { color: 'text-red-600 bg-red-50', text: 'תת משקל', icon: '⚠️' };
            if (numValue < 25) return { color: 'text-green-600 bg-green-50', text: 'תקין', icon: '✓' };
            if (numValue < 30) return { color: 'text-yellow-600 bg-yellow-50', text: 'עודף משקל', icon: '⚡' };
            return { color: 'text-red-600 bg-red-50', text: 'השמנה', icon: '⚠️' };

        case 'fat_percentage':
            if (userGender === 'female') {
                if (numValue < 21) return { color: 'text-blue-600 bg-blue-50', text: 'נמוך', icon: '⬇️' };
                if (numValue <= 33) return { color: 'text-green-600 bg-green-50', text: 'תקין', icon: '✓' };
                if (numValue <= 39) return { color: 'text-yellow-600 bg-yellow-50', text: 'גבוה', icon: '⚡' };
                return { color: 'text-red-600 bg-red-50', text: 'גבוה מאוד', icon: '⚠️' };
            } else { // male
                if (numValue < 8) return { color: 'text-blue-600 bg-blue-50', text: 'נמוך', icon: '⬇️' };
                if (numValue <= 20) return { color: 'text-green-600 bg-green-50', text: 'תקין', icon: '✓' };
                if (numValue <= 25) return { color: 'text-yellow-600 bg-yellow-50', text: 'גבוה', icon: '⚡' };
                return { color: 'text-red-600 bg-red-50', text: 'גבוה מאוד', icon: '⚠️' };
            }

        case 'visceral_fat':
            if (numValue <= 12) return { color: 'text-green-600 bg-green-50', text: 'תקין', icon: '✓' };
            return { color: 'text-red-600 bg-red-50', text: 'גבוה', icon: '⚠️' };

        case 'metabolic_age':
            if (!userAge) return null;
            const ageDiff = numValue - userAge;
            if (ageDiff <= 0) return { color: 'text-green-600 bg-green-50', text: 'צעיר מהגיל', icon: '✓' };
            if (ageDiff <= 5) return { color: 'text-yellow-600 bg-yellow-50', text: 'מעל הגיל', icon: '⚡' };
            return { color: 'text-red-600 bg-red-50', text: 'גבוה מהגיל', icon: '⚠️' };

        case 'physique_rating':
            if (numValue >= 7) return { color: 'text-green-600 bg-green-50', text: 'מצוין', icon: '✓' };
            if (numValue >= 5) return { color: 'text-yellow-600 bg-yellow-50', text: 'טוב', icon: '⚡' };
            if (numValue >= 3) return { color: 'text-orange-600 bg-orange-50', text: 'ממוצע', icon: '➡️' };
            return { color: 'text-red-600 bg-red-50', text: 'נמוך', icon: '⚠️' };

        case 'body_water_percentage':
            // Simplified water percentage ranges
            if (userGender === 'female') {
                if (numValue >= 45 && numValue <= 60) return { color: 'text-green-600 bg-green-50', text: 'תקין', icon: '✓' };
            } else {
                if (numValue >= 50 && numValue <= 65) return { color: 'text-green-600 bg-green-50', text: 'תקין', icon: '✓' };
            }
            return { color: 'text-yellow-600 bg-yellow-50', text: 'מחוץ לטווח', icon: '⚡' };

        default:
            return null;
    }
};

// Auto-calculate physique rating from body fat % and muscle mass
const calculatePhysiqueRating = (fatPercent, muscleMass, weight, gender) => {
    if (!fatPercent || !muscleMass || !weight) return null;
    const fat = parseFloat(fatPercent);
    const muscle = parseFloat(muscleMass);
    const w = parseFloat(weight);
    if (!fat || !muscle || !w) return null;

    const muscleRatio = muscle / w;
    // Determine fat level
    const isFemaleLowFat = gender === 'female' ? fat < 23 : fat < 15;
    const isFemaleHighFat = gender === 'female' ? fat > 33 : fat > 25;
    // Determine muscle level
    const lowMuscle = muscleRatio < 0.33;
    const highMuscle = muscleRatio > 0.40;

    if (isFemaleLowFat) return lowMuscle ? 7 : highMuscle ? 9 : 8;
    if (isFemaleHighFat) return lowMuscle ? 1 : highMuscle ? 3 : 2;
    return lowMuscle ? 4 : highMuscle ? 6 : 5; // average fat
};

const calculateBMI = (weight, height) => {
    if (!weight || !height || parseFloat(height) <= 0) return null;
    // height is in meters, weight in kg
    return (parseFloat(weight) / (parseFloat(height) * parseFloat(height))).toFixed(1);
};


export default function WeightUpdateManager() {
    const [users, setUsers] = useState([]); // Renamed from usersWithWeight
    const [isLoading, setIsLoading] = useState(true);
    const [sendingStates, setSendingStates] = useState({});
    const [sentReminders, setSentReminders] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'daysSinceLastUpdate', direction: 'descending' });
    
    // New states for measurements update
    const [selectedUser, setSelectedUser] = useState(null);
    const [showMeasurementDialog, setShowMeasurementDialog] = useState(false); // Renamed from isUpdateDialogOpen
    const [isSavingMeasurement, setIsSavingMeasurement] = useState(false); // Renamed from isSaving
    const [currentUserAge, setCurrentUserAge] = useState(null);
    const [measurementForm, setMeasurementForm] = useState({ // Renamed from measurementData
        date: getCurrentDateString(),
        weight: '',
        fat_percentage: '',
        muscle_mass: '',
        bmr: '',
        metabolic_age: '',
        visceral_fat: '',
        body_water_percentage: '',
        physique_rating: '',
        neck_circumference: '',
        chest_circumference: '',
        waist_circumference: '',
        glutes_circumference: '',
        thigh_circumference_right: '',
        thigh_circumference_left: '',
        bicep_circumference_right: '',
        bicep_circumference_left: '',
        calf_circumference_right: '',
        calf_circumference_left: '',
        notes: ''
    });

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch ALL users with the role 'user', regardless of status
            const allUsers = await User.filter({ role: 'user' }, '-created_date');
            
            const allWeightEntries = await WeightEntry.list('-date');
            
            const weightEntriesByUser = allWeightEntries.reduce((acc, entry) => {
                if (!acc[entry.user_email]) {
                    acc[entry.user_email] = [];
                }
                acc[entry.user_email].push(entry);
                return acc;
            }, {});

            const usersWithWeightData = allUsers.map(user => {
                const userEntries = weightEntriesByUser[user.email] || [];
                const lastWeightUpdate = userEntries[0]?.date;
                const daysSinceLastUpdate = lastWeightUpdate ? differenceInDays(new Date(), parseISO(lastWeightUpdate)) : null;

                return {
                    name: user.name || user.email,
                    email: user.email,
                    gender: user.gender, // Added gender for fat percentage calculation
                    birth_date: user.birth_date, // Added birth_date for age calculation
                    height: user.height, // Added height for BMI calculation
                    coachEmail: user.coach_email,
                    coachName: user.coach_name,
                    lastWeightUpdate,
                    daysSinceLastUpdate,
                    currentWeight: userEntries[0]?.weight,
                    status: user.status || 'פעיל' // Add status for potential future filtering
                };
            });

            setUsers(usersWithWeightData); // Now sets all users, no filtering by daysSinceLastUpdate here
        } catch (error) {
            console.error("Error loading users and weight data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                const today = getCurrentDateString();
                const todayReminders = {};
                for (const email in parsedData) {
                    if (parsedData[email] === today) {
                        todayReminders[email] = today;
                    }
                }
                setSentReminders(todayReminders);
                // Optionally, clear old entries from localStorage to keep it tidy
                localStorage.setItem(STORAGE_KEY, JSON.stringify(todayReminders));
            }
        } catch (error) {
            console.error("Failed to parse sent reminders from localStorage", error);
        }
        loadData();
    }, [loadData]);
    
    // --- Calculations for measurements dialog ---
    // Helper to get selected user's gender
    const getUserGender = () => selectedUser?.gender;
    // Helper to get selected user's height in meters
    const getUserHeight = () => selectedUser?.height;

    // Calculated BMI for display and submission
    const currentBMI = useMemo(() => {
        return calculateBMI(measurementForm.weight, selectedUser?.height);
    }, [measurementForm.weight, selectedUser?.height]);

    const calculatedBMR = useMemo(() => {
        const weight = parseFloat(measurementForm.weight);
        const heightInMeters = selectedUser?.height; // Get height directly in meters
        if (weight > 0 && heightInMeters > 0 && currentUserAge !== null && selectedUser?.gender) {
            const heightInCm = heightInMeters * 100;
            if (selectedUser.gender === 'male') {
                return Math.round(88.362 + (13.397 * weight) + (4.799 * heightInCm) - (5.677 * currentUserAge));
            } else { // female
                return Math.round(447.593 + (9.247 * weight) + (3.098 * heightInCm) - (4.330 * currentUserAge));
            }
        }
        return null;
    }, [measurementForm.weight, selectedUser?.height, currentUserAge, selectedUser?.gender]);

    const handleOpenUpdateDialog = useCallback(async (user) => {
        setSelectedUser(user);

        let age = null;
        if (user.birth_date) {
            const birthDate = parseISO(user.birth_date);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setCurrentUserAge(age);
        } else {
            setCurrentUserAge(null);
        }
        
        // Fetch the latest entry specifically for the selected user to populate the form
        const entries = await WeightEntry.filter({ user_email: user.email }, "-date", 1);
        const latestEntry = entries[0] || {};
        
        setMeasurementForm({
            date: getCurrentDateString(), // Always set to current date by default
            weight: latestEntry.weight || '',
            fat_percentage: latestEntry.fat_percentage || '',
            muscle_mass: latestEntry.muscle_mass || '',
            bmr: latestEntry.bmr || '', // Default to last saved BMR
            metabolic_age: latestEntry.metabolic_age || '',
            visceral_fat: latestEntry.visceral_fat || '',
            body_water_percentage: latestEntry.body_water_percentage || '',
            physique_rating: latestEntry.physique_rating || '',
            neck_circumference: latestEntry.neck_circumference || '',
            chest_circumference: latestEntry.chest_circumference || '',
            waist_circumference: latestEntry.waist_circumference || '',
            glutes_circumference: latestEntry.glutes_circumference || '',
            thigh_circumference_right: latestEntry.thigh_circumference_right || '',
            thigh_circumference_left: latestEntry.thigh_circumference_left || '',
            bicep_circumference_right: latestEntry.bicep_circumference_right || '',
            bicep_circumference_left: latestEntry.bicep_circumference_left || '',
            calf_circumference_right: latestEntry.calf_circumference_right || '',
            calf_circumference_left: latestEntry.calf_circumference_left || '',
            notes: latestEntry.notes || ''
        });
        setShowMeasurementDialog(true);
    }, []);

    // handleMeasurementInputChange is no longer directly used by inputs with badges,
    // as they now use inline setMeasurementForm. Keep for potential other inputs.
    const handleMeasurementInputChange = (e) => {
        const { name, value } = e.target;
        setMeasurementForm(prev => ({ ...prev, [name]: value }));
    };

    const handleMeasurementSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission
        if (!selectedUser) return;
        setIsSavingMeasurement(true);
        try {
            if (!measurementForm.date || !measurementForm.weight) {
                alert("יש להזין תאריך ומשקל.");
                return;
            }

            const dataToSave = {
                user_email: selectedUser.email,
                date: measurementForm.date,
                notes: measurementForm.notes,
            };
            
            // Calculate BMI from form data + user height
            if (currentBMI) {
                dataToSave.bmi = parseFloat(currentBMI);
                dataToSave.bmi_category = getBMICategory(currentBMI).text;
            }

            const currentBMR = calculatedBMR || (measurementForm.bmr ? parseFloat(measurementForm.bmr) : null);
            if (currentBMR) {
                dataToSave.bmr = currentBMR;
            }

            // Add other fields only if they have a value and are valid numbers
            const numericFields = [
                'weight', 'fat_percentage', 'muscle_mass', 'metabolic_age', 'visceral_fat',
                'body_water_percentage', 'physique_rating', 'neck_circumference',
                'chest_circumference', 'waist_circumference', 'glutes_circumference',
                'thigh_circumference_right', 'thigh_circumference_left',
                'bicep_circumference_right', 'bicep_circumference_left',
                'calf_circumference_right', 'calf_circumference_left'
            ];

            numericFields.forEach(field => {
                const value = measurementForm[field];
                if (value !== '' && value !== null && !isNaN(parseFloat(value))) {
                    dataToSave[field] = parseFloat(value);
                }
            });

            // Check if an entry for today already exists
            const existingEntries = await WeightEntry.filter({ user_email: selectedUser.email, date: measurementForm.date });

            if (existingEntries.length > 0) {
                // Update existing entry
                await WeightEntry.update(existingEntries[0].id, dataToSave);
            } else {
                // Create new entry
                await WeightEntry.create(dataToSave);
            }
            
            setShowMeasurementDialog(false);
            loadData(); // Refresh main table
            alert('המדידות נשמרו בהצלחה!');
        } catch (error) {
            console.error("Error saving measurements:", error);
            alert('שגיאה בשמירת המדידות');
        } finally {
            setIsSavingMeasurement(false);
        }
    };
    
    const sendReminder = async (userEmail, userName, daysDiff) => {
        setSendingStates(prev => ({ ...prev, [userEmail]: true }));
        try {
            const message = `שלום ${userName}, שמנו לב שלא עדכנת את משקלך כבר ${daysDiff} ימים. נשמח אם תוכל/י לעדכן בקרוב!`;
            await WeightReminder.create({
                user_email: userEmail,
                message: message,
                reminder_date: new Date().toISOString(),
                days_since_last_update: daysDiff,
                is_dismissed: false,
            });

            const today = getCurrentDateString();
            const newSentReminders = { ...sentReminders, [userEmail]: today };
            setSentReminders(newSentReminders);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newSentReminders));

        } catch (error) {
            console.error(`Failed to send reminder to ${userEmail}:`, error);
            alert(`שגיאה בשליחת תזכורת ל-${userName}`);
        } finally {
            setSendingStates(prev => ({ ...prev, [userEmail]: false }));
        }
    };

    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'descending' ? 'ascending' : 'descending'
        }));
    };

    const sortedFilteredUsers = useMemo(() => {
        let filtered = users.filter(user => // Now filters all users loaded into 'users'
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle null/undefined values for sorting, treating them as very old for 'descending' and very new for 'ascending'
            if (aValue === null || aValue === undefined) aValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
            if (bValue === null || bValue === undefined) bValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;

            if (sortConfig.direction === 'ascending') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }, [users, searchTerm, sortConfig]);

    if (isLoading) {
        return (
            <Card className="muscle-glass border-0 shadow-lg">
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="mr-2">טוען נתוני משקל...</span>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card className="muscle-glass border-0 shadow-lg">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Scale className="w-5 h-5 text-emerald-600" />
                            ניהול עדכוני משקל
                        </CardTitle>
                        <CardDescription className="text-sm">סקירת משתמשים ועדכון מדידות.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            placeholder="חפש..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="text-sm"
                        />
                        <Button onClick={loadData} disabled={isLoading} size="sm" variant="outline" className="whitespace-nowrap">
                            <RefreshCw className={`w-4 h-4 ml-1 ${isLoading ? 'animate-spin' : ''}`} />
                            רענן
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-4 px-4">
                        <div className="min-w-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right w-1/3">משתמש</TableHead>
                                        <TableHead className="text-right hidden md:table-cell">עדכון אחרון</TableHead>
                                        <TableHead className="text-right hidden lg:table-cell">
                                            <Button variant="ghost" onClick={() => handleSort('daysSinceLastUpdate')} className="h-auto p-0 font-semibold">
                                                ימים <ArrowUpDown className="mr-2 h-4 w-4" />
                                            </Button>
                                        </TableHead>
                                        <TableHead className="text-right w-1/3">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedFilteredUsers.map((user) => {
                                        const isReminderSent = sentReminders[user.email] === getCurrentDateString();
                                        const isSending = sendingStates[user.email];

                                        return (
                                            <TableRow key={user.email}>
                                                <TableCell className="py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-semibold text-sm leading-tight">{user.name}</span>
                                                        <span className="text-xs text-slate-500 md:hidden">{user.email}</span>
                                                        {user.currentWeight && (
                                                            <span className="text-xs text-blue-600">
                                                                {user.currentWeight} ק״ג
                                                            </span>
                                                        )}
                                                        <div className="md:hidden mt-1">
                                                            {user.lastWeightUpdate ? (
                                                                <span className="text-xs text-slate-600">
                                                                    {format(parseISO(user.lastWeightUpdate), 'dd/MM/yyyy')}
                                                                </span>
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs">לא עודכן</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell py-3">
                                                    {user.lastWeightUpdate ? (
                                                        <div>
                                                            <div className="text-sm">{format(parseISO(user.lastWeightUpdate), 'dd/MM/yyyy')}</div>
                                                            {user.currentWeight && (
                                                                <div className="text-xs text-blue-600">{user.currentWeight} ק״ג</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-yellow-600 text-xs">לא עודכן</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell py-3">
                                                    {user.daysSinceLastUpdate !== null ? (
                                                        <Badge variant={user.daysSinceLastUpdate >= 7 ? "destructive" : user.daysSinceLastUpdate >= 3 ? "outline" : "default"} className="text-xs">
                                                            {user.daysSinceLastUpdate} ימים
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-yellow-600 text-xs">לא עודכן</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleOpenUpdateDialog(user)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                                                        >
                                                            <Edit className="w-3 h-3 ml-1" />
                                                            עדכן
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => sendReminder(user.email, user.name, user.daysSinceLastUpdate)}
                                                            disabled={isSending || isReminderSent || user.daysSinceLastUpdate === null}
                                                            variant={isReminderSent ? "secondary" : "outline"}
                                                            className="text-xs h-8"
                                                        >
                                                            {isSending ? (
                                                                <>
                                                                    <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                                                                    שולח
                                                                </>
                                                            ) : isReminderSent ? (
                                                                <>
                                                                    <Clock className="w-3 h-3 ml-1" />
                                                                    נשלח
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Send className="w-3 h-3 ml-1" />
                                                                    תזכורת
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                {sortedFilteredUsers.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-slate-500">
                        <Scale className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <p>לא נמצאו משתמשים התואמים לחיפוש/סינון.</p>
                    </div>
                )}
            </CardContent>

            {/* Measurement Update Dialog */}
            <Dialog open={showMeasurementDialog} onOpenChange={setShowMeasurementDialog}>
                <DialogContent className="max-w-4xl w-[95vw] mx-auto max-h-[90vh] overflow-hidden" dir="rtl">
                    <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <Activity className="w-5 h-5 text-emerald-600" />
                            עדכון מדידות עבור {selectedUser?.name}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-600">
                            מלא את המדידות האחרונות של {selectedUser?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="overflow-y-auto max-h-[75vh] px-1">
                        <form onSubmit={handleMeasurementSubmit} className="space-y-6 py-4">
                            
                            {/* Basic Info with BMI indicator */}
                            <div className="bg-slate-50 rounded-lg p-4 sticky top-0 z-5 border-b">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="date" className="text-sm font-semibold">תאריך מדידה <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            value={measurementForm.date}
                                            onChange={(e) => setMeasurementForm({...measurementForm, date: e.target.value})}
                                            required
                                            name="date"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="weight" className="text-sm font-semibold">משקל (ק״ג) <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="weight"
                                            type="number"
                                            step="0.1"
                                            placeholder="75.5"
                                            value={measurementForm.weight}
                                            onChange={(e) => {
                                                const newWeight = e.target.value;
                                                const autoRating = calculatePhysiqueRating(measurementForm.fat_percentage, measurementForm.muscle_mass, newWeight, getUserGender());
                                                setMeasurementForm({...measurementForm, weight: newWeight, ...(autoRating ? { physique_rating: String(autoRating) } : {})});
                                            }}
                                            required
                                            name="weight"
                                            className="mt-1"
                                        />
                                    </div>
                                    {/* BMI Display */}
                                    {currentBMI && (
                                        <div>
                                            <Label className="text-sm font-semibold">BMI (מחושב)</Label>
                                            <div className="mt-1 p-2 rounded border bg-white">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-lg font-bold">{currentBMI}</span>
                                                    {(() => {
                                                        const status = getMeasurementStatus('bmi', currentBMI, getUserGender(), currentUserAge);
                                                        return status ? (
                                                            <Badge className={`text-xs ${status.color}`}>
                                                                {status.icon} {status.text}
                                                            </Badge>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Body Composition Measurements with indicators */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                                    <Dumbbell className="w-5 h-5 text-green-600" />
                                    <h3 className="text-lg font-semibold text-slate-800">הרכב גוף</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="fat_percentage" className="text-sm font-semibold flex items-center gap-2">
                                            אחוז שומן (%)
                                            {(() => {
                                                const status = getMeasurementStatus('fat_percentage', measurementForm.fat_percentage, getUserGender(), currentUserAge);
                                                return status ? (
                                                    <Badge className={`text-xs ${status.color}`}>
                                                        {status.icon} {status.text}
                                                    </Badge>
                                                ) : null;
                                            })()}
                                        </Label>
                                        <Input
                                            id="fat_percentage"
                                            type="number"
                                            step="0.1"
                                            placeholder={getUserGender() === 'female' ? '21-33 (תקין)' : '8-20 (תקין)'}
                                            value={measurementForm.fat_percentage}
                                            onChange={(e) => {
                                                const newFat = e.target.value;
                                                const autoRating = calculatePhysiqueRating(newFat, measurementForm.muscle_mass, measurementForm.weight, getUserGender());
                                                setMeasurementForm({...measurementForm, fat_percentage: newFat, ...(autoRating ? { physique_rating: String(autoRating) } : {})});
                                            }}
                                            name="fat_percentage"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="muscle_mass" className="text-sm font-semibold">מסת שריר (ק״ג)</Label>
                                        <Input
                                            id="muscle_mass"
                                            type="number"
                                            step="0.1"
                                            placeholder="45.2"
                                            value={measurementForm.muscle_mass}
                                            onChange={(e) => {
                                                const newMuscle = e.target.value;
                                                const autoRating = calculatePhysiqueRating(measurementForm.fat_percentage, newMuscle, measurementForm.weight, getUserGender());
                                                setMeasurementForm({...measurementForm, muscle_mass: newMuscle, ...(autoRating ? { physique_rating: String(autoRating) } : {})});
                                            }}
                                            name="muscle_mass"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="body_water_percentage" className="text-sm font-semibold flex items-center gap-2">
                                            אחוזי מים (%)
                                            {(() => {
                                                const status = getMeasurementStatus('body_water_percentage', measurementForm.body_water_percentage, getUserGender(), currentUserAge);
                                                return status ? (
                                                    <Badge className={`text-xs ${status.color}`}>
                                                        {status.icon} {status.text}
                                                    </Badge>
                                                ) : null;
                                            })()}
                                        </Label>
                                        <Input
                                            id="body_water_percentage"
                                            type="number"
                                            step="0.1"
                                            placeholder={getUserGender() === 'female' ? '45-60 (תקין)' : '50-65 (תקין)'}
                                            value={measurementForm.body_water_percentage}
                                            onChange={(e) => setMeasurementForm({...measurementForm, body_water_percentage: e.target.value})}
                                            name="body_water_percentage"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Advanced Metrics with indicators */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                                    <Target className="w-5 h-5 text-purple-600" />
                                    <h3 className="text-lg font-semibold text-slate-800">מדדים מתקדמים</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <Label htmlFor="bmr" className="text-sm font-semibold">BMR (קק״ל/יום)</Label>
                                        <Input
                                            id="bmr"
                                            type="number"
                                            placeholder="1500"
                                            value={measurementForm.bmr}
                                            onChange={(e) => setMeasurementForm({...measurementForm, bmr: e.target.value})}
                                            name="bmr"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="metabolic_age" className="text-sm font-semibold flex items-center gap-2">
                                            גיל מטבולי
                                            {(() => {
                                                const status = getMeasurementStatus('metabolic_age', measurementForm.metabolic_age, getUserGender(), currentUserAge);
                                                return status ? (
                                                    <Badge className={`text-xs ${status.color}`}>
                                                        {status.icon} {status.text}
                                                    </Badge>
                                                ) : null;
                                            })()}
                                        </Label>
                                        <Input
                                            id="metabolic_age"
                                            type="number"
                                            placeholder={currentUserAge ? `מתחת ל-${currentUserAge} (מצוין)` : '25'}
                                            value={measurementForm.metabolic_age}
                                            onChange={(e) => setMeasurementForm({...measurementForm, metabolic_age: e.target.value})}
                                            name="metabolic_age"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="visceral_fat" className="text-sm font-semibold flex items-center gap-2">
                                            שומן ויסצרלי (1-59)
                                            {(() => {
                                                const status = getMeasurementStatus('visceral_fat', measurementForm.visceral_fat, getUserGender(), currentUserAge);
                                                return status ? (
                                                    <Badge className={`text-xs ${status.color}`}>
                                                        {status.icon} {status.text}
                                                    </Badge>
                                                ) : null;
                                            })()}
                                        </Label>
                                        <Input
                                            id="visceral_fat"
                                            type="number"
                                            placeholder="1-12 (תקין)"
                                            value={measurementForm.visceral_fat}
                                            onChange={(e) => setMeasurementForm({...measurementForm, visceral_fat: e.target.value})}
                                            name="visceral_fat"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="physique_rating" className="text-sm font-semibold flex items-center gap-2">
                                            דירוג מבנה גוף (1-9)
                                            {(() => {
                                                const status = getMeasurementStatus('physique_rating', measurementForm.physique_rating, getUserGender(), currentUserAge);
                                                return status ? (
                                                    <Badge className={`text-xs ${status.color}`}>
                                                        {status.icon} {status.text}
                                                    </Badge>
                                                ) : null;
                                            })()}
                                        </Label>
                                        <Input
                                            id="physique_rating"
                                            type="number"
                                            min="1"
                                            max="9"
                                            placeholder="7-9 (מצוין)"
                                            value={measurementForm.physique_rating}
                                            onChange={(e) => setMeasurementForm({...measurementForm, physique_rating: e.target.value})}
                                            name="physique_rating"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Circumference Measurements */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                                    <Ruler className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-lg font-semibold text-slate-800">היקפים (ס״מ)</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="neck_circumference" className="text-sm font-semibold">היקף צוואר</Label>
                                        <Input
                                            id="neck_circumference"
                                            type="number"
                                            step="0.1"
                                            placeholder="35.5"
                                            value={measurementForm.neck_circumference}
                                            onChange={(e) => setMeasurementForm({...measurementForm, neck_circumference: e.target.value})}
                                            name="neck_circumference"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="chest_circumference" className="text-sm font-semibold">היקף חזה</Label>
                                        <Input
                                            id="chest_circumference"
                                            type="number"
                                            step="0.1"
                                            placeholder="95.0"
                                            value={measurementForm.chest_circumference}
                                            onChange={(e) => setMeasurementForm({...measurementForm, chest_circumference: e.target.value})}
                                            name="chest_circumference"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="waist_circumference" className="text-sm font-semibold">היקף מותן</Label>
                                        <Input
                                            id="waist_circumference"
                                            type="number"
                                            step="0.1"
                                            placeholder="80.0"
                                            value={measurementForm.waist_circumference}
                                            onChange={(e) => setMeasurementForm({...measurementForm, waist_circumference: e.target.value})}
                                            name="waist_circumference"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="glutes_circumference" className="text-sm font-semibold">היקף ישבן</Label>
                                        <Input
                                            id="glutes_circumference"
                                            type="number"
                                            step="0.1"
                                            placeholder="95.0"
                                            value={measurementForm.glutes_circumference}
                                            onChange={(e) => setMeasurementForm({...measurementForm, glutes_circumference: e.target.value})}
                                            name="glutes_circumference"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="thigh_circumference_right" className="text-sm font-semibold">היקף ירך ימין</Label>
                                        <Input
                                            id="thigh_circumference_right"
                                            type="number"
                                            step="0.1"
                                            placeholder="55.0"
                                            value={measurementForm.thigh_circumference_right}
                                            onChange={(e) => setMeasurementForm({...measurementForm, thigh_circumference_right: e.target.value})}
                                            name="thigh_circumference_right"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="thigh_circumference_left" className="text-sm font-semibold">היקף ירך שמאל</Label>
                                        <Input
                                            id="thigh_circumference_left"
                                            type="number"
                                            step="0.1"
                                            placeholder="55.0"
                                            value={measurementForm.thigh_circumference_left}
                                            onChange={(e) => setMeasurementForm({...measurementForm, thigh_circumference_left: e.target.value})}
                                            name="thigh_circumference_left"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="bicep_circumference_right" className="text-sm font-semibold">היקף יד קדמית ימין</Label>
                                        <Input
                                            id="bicep_circumference_right"
                                            type="number"
                                            step="0.1"
                                            placeholder="32.0"
                                            value={measurementForm.bicep_circumference_right}
                                            onChange={(e) => setMeasurementForm({...measurementForm, bicep_circumference_right: e.target.value})}
                                            name="bicep_circumference_right"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="bicep_circumference_left" className="text-sm font-semibold">היקף יד קדמית שמאל</Label>
                                        <Input
                                            id="bicep_circumference_left"
                                            type="number"
                                            step="0.1"
                                            placeholder="32.0"
                                            value={measurementForm.bicep_circumference_left}
                                            onChange={(e) => setMeasurementForm({...measurementForm, bicep_circumference_left: e.target.value})}
                                            name="bicep_circumference_left"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="calf_circumference_right" className="text-sm font-semibold">היקף שוק ימין</Label>
                                        <Input
                                            id="calf_circumference_right"
                                            type="number"
                                            step="0.1"
                                            placeholder="36.0"
                                            value={measurementForm.calf_circumference_right}
                                            onChange={(e) => setMeasurementForm({...measurementForm, calf_circumference_right: e.target.value})}
                                            name="calf_circumference_right"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="calf_circumference_left" className="text-sm font-semibold">היקף שוק שמאל</Label>
                                        <Input
                                            id="calf_circumference_left"
                                            type="number"
                                            step="0.1"
                                            placeholder="36.0"
                                            value={measurementForm.calf_circumference_left}
                                            onChange={(e) => setMeasurementForm({...measurementForm, calf_circumference_left: e.target.value})}
                                            name="calf_circumference_left"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Notes */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                                    <Info className="w-5 h-5 text-indigo-600" />
                                    <h3 className="text-lg font-semibold text-slate-800">הערות</h3>
                                </div>
                                <div>
                                    <Label htmlFor="notes" className="text-sm font-semibold">הערות נוספות</Label>
                                    <textarea
                                        id="notes"
                                        name="notes"
                                        rows="3"
                                        placeholder="הערות כלליות על המדידה..."
                                        value={measurementForm.notes}
                                        onChange={(e) => setMeasurementForm({...measurementForm, notes: e.target.value})}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        dir="rtl"
                                    />
                                </div>
                            </section>
                        </form>
                    </div>

                    {/* Sticky Footer with Buttons */}
                    <DialogFooter className="sticky bottom-0 bg-white border-t pt-4 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowMeasurementDialog(false)}
                            disabled={isSavingMeasurement}
                        >
                            <X className="w-4 h-4 ml-1" />
                            ביטול
                        </Button>
                        <Button
                            onClick={handleMeasurementSubmit}
                            disabled={isSavingMeasurement || !measurementForm.date || !measurementForm.weight}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isSavingMeasurement ? (
                                <>
                                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                                    שומר...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 ml-1" />
                                    שמור מדידות
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
