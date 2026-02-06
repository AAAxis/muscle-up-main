
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WeightEntry, User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, VisuallyHidden } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Activity, Heart, Ruler, Scale, Zap, Dna, Droplets, ShieldAlert, Target, Recycle, Dumbbell, Info, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { formatDate } from "@/components/utils/timeUtils";

// --- Status Calculation Helpers ---
const getBMICategory = (bmi) => {
    if (bmi === null || isNaN(bmi)) return { level: null, text: 'לא חושב', color: 'bg-gray-100 text-gray-600' };
    if (bmi < 18.5) return { level: 'סיכון גבוה', text: 'תת משקל', color: 'bg-red-100 text-red-700' };
    if (bmi < 25) return { level: 'תקין', text: 'תקין', color: 'bg-green-100 text-green-700' };
    if (bmi < 30) return { level: 'מעקב', text: 'עודף משקל', color: 'bg-yellow-100 text-yellow-700' };
    return { level: 'סיכון גבוה', text: 'השמנה', color: 'bg-red-100 text-red-700' };
};

const getFatPercentageCategory = (fat, gender) => {
    if (fat === null || isNaN(fat)) return { level: null, text: 'לא נמדד', color: 'bg-gray-100 text-gray-600' };
    if (gender === 'female') {
        if (fat < 21) return { level: 'תקין', text: 'נמוך', color: 'bg-blue-100 text-blue-700' };
        if (fat <= 33) return { level: 'תקין', text: 'תקין', color: 'bg-green-100 text-green-700' };
        if (fat <= 39) return { level: 'מעקב', text: 'גבוה', color: 'bg-yellow-100 text-yellow-700' };
        return { level: 'סיכון גבוה', text: 'גבוה מאוד', color: 'bg-red-100 text-red-700' };
    } else { // male
        if (fat < 8) return { level: 'תקין', text: 'נמוך', color: 'bg-blue-100 text-blue-700' };
        if (fat <= 20) return { level: 'תקין', text: 'תקין', color: 'bg-green-100 text-green-700' };
        if (fat <= 25) return { level: 'מעקב', text: 'גבוה', color: 'bg-yellow-100 text-yellow-700' };
        return { level: 'סיכון גבוה', text: 'גבוה מאוד', color: 'bg-red-100 text-red-700' };
    }
};

const getMetabolicAgeStatus = (metabolicAge, realAge) => {
    if (metabolicAge === null || isNaN(metabolicAge) || realAge === null || isNaN(realAge)) return { level: null, text: 'לא נמדד', color: 'bg-gray-100 text-gray-600' };
    const diff = metabolicAge - realAge;
    if (diff <= 0) return { level: 'תקין', text: 'צעיר מהגיל', color: 'bg-green-100 text-green-700' };
    if (diff <= 5) return { level: 'מעקב', text: 'מעל הגיל', color: 'bg-yellow-100 text-yellow-700' };
    return { level: 'סיכון גבוה', text: 'גבוה מהגיל', color: 'bg-red-100 text-red-700' };
};

const getVisceralFatStatus = (level) => {
    if (level === null || isNaN(level)) return { level: null, text: 'לא נמדד', color: 'bg-gray-100 text-gray-600' };
    if (level <= 12) return { level: 'תקין', text: 'תקין', color: 'bg-green-100 text-green-700' };
    return { level: 'סיכון גבוה', text: 'גבוה', color: 'bg-red-100 text-red-700' };
};

// --- Measurement explanations (for Dialog) ---
const getMeasurementExplanation = (type, value, userGender, userAge, category) => {
    const explanations = {
        weight: {
            title: "משקל גוף",
            explanation: "משקל הגוף הוא מדד בסיסי המשקף את כמות הרקמות בגוף. משקל בריא תלוי בגובה, מין, גיל ומבנה הגוף.",
            currentStatus: `המשקל הנוכחי שלך הוא ${value !== null && value !== undefined ? value : 'לא ידוע'} ק״ג.`,
            recommendations: "שמירה על משקל יציב תורמת לבריאות הכללית. שינויים הדרגתיים ובטוחים הם המועילים ביותר."
        },
        height: {
            title: "גובה",
            explanation: "הגובה הוא מדד קבוע המשמש לחישוב מדדים נוספים כמו BMI ו-BMR.",
            currentStatus: `הגובה שלך הוא ${value !== null && value !== undefined ? (value > 3 ? Math.round(value) : (value * 100).toFixed(0)) : 'לא ידוע'} ס״מ.`,
            recommendations: "הגובה נקבע גנטית ואינו משתנה בבגרות. שמור על יציבה נכונה לבריאות העמוד השדרה."
        },
        bmi: {
            title: "מדד מסת הגוף (BMI)",
            explanation: "BMI הוא חישוב המבוסס על היחס בין המשקל לגובה. הוא מספק הערכה ראשונית של מצב הגוף.",
            currentStatus: `ה-BMI שלך הוא ${value !== null && value !== undefined ? value : 'לא ידוע'} - ${category?.text || 'לא מוגדר'}.`,
            recommendations: category?.level === 'תקין' ? "BMI תקין! המשך לשמור על אורח חיים בריא." :
                            category?.level === 'מעקב' ? "מומלץ להתייעץ עם מאמן או דיאטן לקבלת המלצות מותאמות." :
                            "חשוב להתייעץ עם איש מקצוע לקבלת תכנית מותאמת אישית."
        },
        fat_percentage: {
            title: "אחוז שומן בגוף",
            explanation: `אחוז השומן מציין את כמות הרקמה השומנית ביחס לכלל מסת הגוף. ${userGender === 'female' ? 'לנשים טווח בריא הוא 21-33%' : 'לגברים טווח בריא הוא 8-20%'}.`,
            currentStatus: `אחוז השומן שלך הוא ${value !== null && value !== undefined ? value : 'לא הוערך'}% - ${category?.text || 'לא הוערך'}.`,
            recommendations: category?.level === 'תקין' ? "אחוז השומן שלך בטווח הבריא. המשך באורח החיים הנוכחי." :
                            category?.level === 'מעקב' ? "מומלץ לשלב אימוני כוח ופעילות קרדיו מותאמת." :
                            "התייעץ עם מאמן לתכנית אימונים ותזונה מותאמת להורדת אחוז שומן."
        },
        muscle_mass: {
            title: "מסת שריר",
            explanation: "מסת השריר היא כמות הרקמה השרירית בגוף. שריר פעיל שורף יותר קלוריות במנוחה ותורם לכוח ויציבות.",
            currentStatus: `מסת השריר שלך היא ${value !== null && value !== undefined ? value : 'לא ידוע'} ק״ג.`,
            recommendations: "לשמירה והגדלת מסת השריר מומלץ לשלב אימוני כוח קבועים וצריכת חלבון מספקת."
        },
        bmr: {
            title: "קצב חילוף חומרים בסיסי (BMR)",
            explanation: "BMR הוא כמות הקלוריות שהגוף צורך במנוחה מוחלטת. זהו הבסיס לחישוב הצרכים הקלוריים היומיים.",
            currentStatus: `ה-BMR שלך הוא ${value !== null && value !== undefined ? value : 'לא ידוע'} קלוריות ליום.`,
            recommendations: "הוסף 20-30% לצרכי הפעילות היומית. BMR גבוה יותר מעיד על חילוף חומרים יעיל יותר."
        },
        metabolic_age: {
            title: "גיל מטבולי",
            explanation: "הגיל המטבולי משווה את קצב חילוף החומרים שלך לאדם ממוצע בגילאים שונים. גיל מטבולי נמוך מהגיל הביולוגי מצביע על מצב מטבולי טוב.",
            currentStatus: `הגיל המטבולי שלך הוא ${value !== null && value !== undefined ? value : 'לא ידוע'} שנים (לעומת גיל ${userAge || 'לא ידוע'} שנים).`,
            recommendations: category?.level === 'תקין' ? "מצוין! המטבוליזם שלך צעיר יותר מגילך הביולוגי." :
                            "ניתן לשפר את הגיל המטבולי באמצעות אימוני כוח, פעילות קרדיו ותזונה מאוזנת."
        },
        visceral_fat: {
            title: "שומן ויסצרלי",
            explanation: "השומן הויסצרלי נמצא סביב האיברים הפנימיים. רמה גבוהה עלולה להגביר את הסיכון למחלות לב וסוכרת.",
            currentStatus: `רמת השומן הויסצרלי שלך היא ${value !== null && value !== undefined ? value : 'לא ידוע'}.`,
            recommendations: category?.level === 'תקין' ? "רמת השומן הויסצרלי תקינה. המשך באורח החיים הבריא." :
                            "מומלץ להפחית שומן ויסצרלי באמצעות פעילות קרדיו, אימוני כוח והפחתת סוכרים מהתפריט."
        },
        body_water_percentage: {
            title: "אחוזי ממים בגוף",
            explanation: "המים מהווים חלק משמעותי מהגוף ומעורבים בכל התהליכים החיוניים. אחוז תקין משתנה לפי גיל ומין.",
            currentStatus: `אחוז המים בגוף שלך הוא ${value !== null && value !== undefined ? value : 'לא ידוע'}%.`,
            recommendations: "שמור על לחות מספקת על ידי שתיית מים קבועה לאורך היום, במיוחד לפני ואחרי פעילות גופנית."
        },
        physique_rating: {
            title: "דירוג מבנה גוף",
            explanation: "דירוג כללי של מבנה הגוף המשלב מספר פרמטרים. סקאלה של 1-9, כאשר 9 הוא הטוב ביותר.",
            currentStatus: `דירוג מבנה הגוף שלך הוא ${value !== null && value !== undefined ? value : 'לא ידוע'}/9.`,
            recommendations: (value && value >= 7) ? "דירוג מצוין! המשך לשמור על הרמה הנוכחית." :
                            (value && value >= 5) ? "דירוג טוב. ניתן לשפר באמצעות אימונים מגוונים ותזונה מותאמת." :
                            "יש מקום לשיפור. התייעץ עם מאמן לתכנית מקיפה."
        }
    };

    return explanations[type] || {
        title: "מדד לא מוכר",
        explanation: "אין מידע זמין על מדד זה.",
        currentStatus: "",
        recommendations: ""
    };
};

// Helper function to get ranges for each measurement
const getMeasurementRanges = (type, gender, age) => {
    switch (type) {
        case 'bmi':
            return [
                { label: 'תת משקל', range: 'מתחת ל-18.5' },
                { label: 'תקין', range: '18.5-24.9' },
                { label: 'עודף משקל', range: '25-29.9' },
                { label: 'השמנה', range: '30 ומעלה' }
            ];
        case 'fat_percentage':
            if (gender === 'female') {
                return [
                    { label: 'נמוך', range: 'מתחת ל-21%' },
                    { label: 'תקין', range: '21-33%' },
                    { label: 'גבוה', range: '34-39%' },
                    { label: 'גבוה מאוד', range: '40% ומעלה' }
                ];
            } else { // male
                return [
                    { label: 'נמוך', range: 'מתחת ל-8%' },
                    { label: 'תקין', range: '8-20%' },
                    { label: 'גבוה', range: '21-25%' },
                    { label: 'גבוה מאוד', range: '26% ומעלה' }
                ];
            }
        case 'visceral_fat':
            return [
                { label: 'תקין', range: '1-12' },
                { label: 'גבוה', range: '13 ומעלה' }
            ];
        case 'body_water_percentage':
            if (gender === 'female') {
                return [
                    { label: 'תקין (20-29)', range: '45-60%' },
                    { label: 'תקין (30-39)', range: '41-55%' },
                    { label: 'תקין (40+)', range: '37-47%' }
                ];
            } else { // male
                return [
                    { label: 'תקין (20-29)', range: '50-65%' },
                    { label: 'תקין (30-39)', range: '47-56%' },
                    { label: 'תקין (40+)', range: '42-52%' }
                ];
            }
        case 'physique_rating':
            return [
                { label: 'מצוין', range: '7-9' },
                { label: 'טוב', range: '5-6' },
                { label: 'ממוצע', range: '3-4' },
                { label: 'נמוך', range: '1-2' }
            ];
        case 'metabolic_age':
            if (age === null || isNaN(age)) {
                return [
                    { label: 'צעיר מגילך', range: '< הגיל הביולוגי' },
                    { label: 'קרוב לגילך', range: '0 עד +5 שנים' },
                    { label: 'גבוה מגילך', range: '> +5 שנים' }
                ];
            }
            return [
                { label: 'צעיר מגילך', range: `מתחת ל-${age} שנים` },
                { label: 'קרוב לגילך', range: `${age}-${age + 5} שנים` },
                { label: 'גבוה מגילך', range: `מעל ל-${age + 5} שנים` }
            ];
        default:
            return null;
    }
};

// Helper function to get current status explanation for the card
const getCurrentStatusExplanation = (type, value, category, gender, age) => {
    if (value === null || value === undefined || value === 'N/A' || isNaN(Number(value))) return null;
    
    switch (type) {
        case 'height':
            return "הגובה הוא מדד קבוע, אך חשוב לוודא יציבה נכונה.";
        case 'weight':
            return "משקל תקין משתנה מאוד בין אנשים. המפתח הוא יציבות.";
        case 'bmi':
            return category?.level === 'תקין' ? 
                "מדד BMI מצביע על משקל בריא ביחס לגובה." : 
                "ה-BMI שלך מחוץ לטווח התקין, מומלץ לבדוק לעומק.";
        case 'fat_percentage':
            return category?.level === 'תקין' ? 
                "אחוז השומן שלך בטווח הבריא והמומלץ!" : 
                "אחוז השומן שלך מחוץ לטווח הבריא, כדאי לשקול פעולות שיפור.";
        case 'muscle_mass':
            return "מסת שריר גבוהה תורמת לחילוף חומרים מהיר יותר ולכוח.";
        case 'bmr':
            return "זהו קצב חילוף החומרים הבסיסי שלך. גבוה יותר = שורף יותר במנוחה.";
        case 'metabolic_age':
            return category?.level === 'תקין' ? 
                "הגיל המטבולי שלך צעיר יותר מגילך הביולוגי - מצוין!" : 
                "הגיל המטבולי שלך גבוה מגילך הביולוגי. ניתן לשפר באורח חיים בריא.";
        case 'visceral_fat':
            return category?.level === 'תקין' ? 
                "רמת השומן הויסצרלי שלך תקינה, המשך לשמור על בריאותך." : 
                "רמת שומן ויסצרלי גבוהה, מומלץ לנקוט בצעדים להפחתה.";
        case 'body_water_percentage':
            return 'חשוב לשמור על לחות מספקת בגוף לצורך תפקוד מיטבי.';
        case 'physique_rating':
            if (value >= 7) return "דירוג מבנה גוף מצוין - המשך לשמור על ההישגים!";
            if (value >= 5) return "דירוג טוב, עם פוטנציאל לשיפור נוסף.";
            return "דירוג נמוך, יש מקום רב לשיפור מבנה הגוף באמצעות אימונים ותזונה.";
        default:
            return null;
    }
};

const MeasurementCard = ({ icon: Icon, title, value, unit, status, ranges, currentStatus, onClick, isClickable = true }) => {
    const cardClasses = `
        relative p-4 rounded-xl border-2 transition-all duration-200 
        ${status?.color || 'bg-gray-50 border-gray-200'}
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:scale-105' : 'cursor-default'}
    `;

    return (
        <div className={cardClasses} onClick={isClickable ? onClick : undefined}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{title}</span>
                </div>
                {isClickable && <Info className="w-4 h-4 opacity-50" />}
            </div>
            <div className="text-center mb-3">
                <p className="text-2xl font-bold">{value}</p>
                {unit && <p className="text-xs opacity-70">{unit}</p>}
            </div>
            
            {/* Status Badge */}
            {status?.text && (
                <div className="text-center mb-2">
                    <Badge className={`text-xs ${status.color}`}>
                        {status.text}
                    </Badge>
                </div>
            )}
            
            {/* Ranges Display */}
            {ranges && (
                <div className="text-xs text-slate-600 space-y-1 border-t pt-2 mt-2">
                    <p className="font-semibold">טווחים:</p>
                    {ranges.map((range, index) => (
                        <div key={index} className="flex justify-between">
                            <span>{range.label}:</span>
                            <span className="font-medium">{range.range}</span>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Current Status */}
            {currentStatus && (
                <div className="text-xs mt-2 p-2 bg-blue-50 rounded text-blue-800">
                    <p>{currentStatus}</p>
                </div>
            )}
        </div>
    );
};

export default function BoosterMeasurements({ user }) {
    const [latestCoachMeasurement, setLatestCoachMeasurement] = useState(null);
    const [latestUserWeight, setLatestUserWeight] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMeasurement, setSelectedMeasurement] = useState(null);
    const [isExplanationDialogOpen, setIsExplanationDialogOpen] = useState(false);
    const [age, setAge] = useState(null);

    const loadData = useCallback(async () => {
        if (!user?.email) return;
        setIsLoading(true);
        try {
            // Get all weight entries for this user
            const allEntries = await WeightEntry.filter({ user_email: user.email }, "-date");
            
            // Find the latest coach measurement (entry with advanced metrics)
            const coachMeasurement = allEntries.find(entry => 
                entry.fat_percentage || entry.muscle_mass || entry.bmr || 
                entry.metabolic_age || entry.visceral_fat || entry.body_water_percentage ||
                entry.physique_rating || entry.neck_circumference || entry.chest_circumference
            );
            
            // Get the latest weight entry (for weight and BMI)
            const latestWeight = allEntries[0]; // This is correct, as it's sorted by date desc
            
            setLatestCoachMeasurement(coachMeasurement || {});
            setLatestUserWeight(latestWeight || {});

            // Calculate user's age
            if (user.birth_date) {
                const birthDate = new Date(user.birth_date);
                const today = new Date();
                let calculatedAge = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    calculatedAge--;
                }
                setAge(calculatedAge);
            }
        } catch (error) {
            console.error("Error loading measurements:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // BMI calculation using latest weight and user height
    const calculatedBMI = useMemo(() => {
        const weight = latestUserWeight?.weight;
        const rawHeight = user?.height;
        if (weight > 0 && rawHeight > 0) {
            // Handle height stored as cm (>3) or meters (<=3)
            const heightM = rawHeight > 3 ? rawHeight / 100 : rawHeight;
            return parseFloat((weight / (heightM ** 2)).toFixed(1));
        }
        return null;
    }, [latestUserWeight?.weight, user?.height]);

    // Estimate missing body composition values from available data
    const estimatedMetrics = useMemo(() => {
        const weight = latestUserWeight?.weight || 0;
        const bmi = calculatedBMI || 0;
        const userAge = age || 30;
        const isMale = user?.gender === 'male';
        const storedFat = latestCoachMeasurement?.fat_percentage;
        const storedMuscle = latestCoachMeasurement?.muscle_mass;

        // Estimate body fat from BMI (Deurenberg formula)
        const fatPercentage = (storedFat != null && !isNaN(Number(storedFat))) ? Number(storedFat) :
            (bmi > 0 ? parseFloat((1.20 * bmi + 0.23 * userAge - (isMale ? 16.2 : 5.4)).toFixed(1)) : null);

        // Estimate muscle mass from weight and body fat
        const muscleMass = (storedMuscle != null && !isNaN(Number(storedMuscle))) ? Number(storedMuscle) :
            (weight > 0 && fatPercentage !== null ? parseFloat((weight * (1 - fatPercentage / 100) * 0.75).toFixed(1)) : null);

        // Estimate BMR (Mifflin-St Jeor)
        const storedBmr = latestCoachMeasurement?.bmr;
        const rawH = user?.height;
        const hCm = rawH > 3 ? Math.round(rawH) : Math.round(rawH * 100);
        const bmr = (storedBmr != null && !isNaN(Number(storedBmr)) && Number(storedBmr) > 0) ? Number(storedBmr) :
            (weight > 0 && hCm > 0 ? Math.round(10 * weight + 6.25 * hCm - 5 * userAge + (isMale ? 5 : -161)) : null);

        // Estimate visceral fat
        const storedVisceral = latestCoachMeasurement?.visceral_fat;
        const visceralFat = (storedVisceral != null && !isNaN(Number(storedVisceral))) ? Number(storedVisceral) :
            (bmi > 0 ? Math.max(1, Math.min(59, Math.round(
                isMale ? (userAge * 0.15) + (bmi * 0.6) - 8 : (userAge * 0.12) + (bmi * 0.5) - 8
            ))) : null);

        // Estimate body type rating (1-9)
        const storedRating = latestCoachMeasurement?.physique_rating;
        const bodyTypeRating = (storedRating != null && !isNaN(Number(storedRating))) ? Number(storedRating) :
            (fatPercentage !== null && weight > 0 ? Math.max(1, Math.min(9, Math.round(
                9 - (fatPercentage / 8) + ((muscleMass || 0) / weight) * 3
            ))) : null);

        // Estimate water percentage
        const storedWater = latestCoachMeasurement?.body_water_percentage;
        const waterPercent = (storedWater != null && !isNaN(Number(storedWater))) ? Number(storedWater) :
            (fatPercentage !== null ? parseFloat(((isMale ? 72 : 68) - fatPercentage * 0.6).toFixed(1)) : null);

        // Estimate metabolic age
        const storedMetaAge = latestCoachMeasurement?.metabolic_age;
        const metabolicAge = (storedMetaAge != null && !isNaN(Number(storedMetaAge))) ? Number(storedMetaAge) :
            (bmi > 0 && fatPercentage !== null ? Math.max(10, Math.round(
                userAge + (bmi - 22) * 0.8 + (fatPercentage - (isMale ? 15 : 25)) * 0.3
            )) : null);

        return { fatPercentage, muscleMass, bmr, visceralFat, bodyTypeRating, waterPercent, metabolicAge };
    }, [latestUserWeight?.weight, calculatedBMI, age, user?.gender, user?.height, latestCoachMeasurement]);

    const handleMeasurementClick = (type, value, category = null) => {
        if (value === null || value === undefined || value === 'N/A') return;
        const explanation = getMeasurementExplanation(type, value, user.gender, age, category);
        setSelectedMeasurement({
            type,
            value,
            category,
            ...explanation
        });
        setIsExplanationDialogOpen(true);
    };

    if (isLoading) {
        return (
            <Card className="muscle-glass border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                        <Activity className="w-6 h-6 text-green-600" />
                        מדדי גוף
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </CardContent>
            </Card>
        );
    }

    const bmiCategory = getBMICategory(calculatedBMI);
    const fatCategory = getFatPercentageCategory(estimatedMetrics.fatPercentage, user.gender);
    const metabolicAgeCategory = getMetabolicAgeStatus(estimatedMetrics.metabolicAge, age);
    const visceralFatCategory = getVisceralFatStatus(estimatedMetrics.visceralFat);

    const formatValue = (value, fractionDigits = 1) => {
        if (value === null || value === undefined) return 'N/A';
        const num = Number(value);
        if (isNaN(num)) return 'N/A';
        return num.toFixed(fractionDigits);
    };
    
    const formatIntValue = (value) => {
        if (value === null || value === undefined) return 'N/A';
        const num = Number(value);
        if (isNaN(num)) return 'N/A';
        return Math.round(num);
    };


    return (
        <Card className="muscle-glass border-0 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Activity className="w-6 h-6 text-green-600" />
                    מדדי גוף
                </CardTitle>
                <CardDescription>
                    <div className="flex flex-col gap-1 text-sm">
                        {latestUserWeight?.date && (
                            <span>משקל אחרון: {formatDate(latestUserWeight.date)}</span>
                        )}
                        {latestCoachMeasurement?.date && (
                            <span>מדידת מאמן: {formatDate(latestCoachMeasurement.date)}</span>
                        )}
                        {!latestUserWeight?.date && !latestCoachMeasurement?.date && (
                            <span>טרם בוצעו מדידות</span>
                        )}
                    </div>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Basic Measurements */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                        <Ruler className="w-5 h-5 text-blue-600" />
                        מדידות בסיסיות
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <MeasurementCard
                            icon={Ruler}
                            title="גובה"
                            value={user?.height ? (user.height > 3 ? Math.round(user.height) : Math.round(user.height * 100)) : 'N/A'}
                            unit="ס״מ"
                            currentStatus={getCurrentStatusExplanation('height', user?.height)}
                            onClick={() => handleMeasurementClick('height', user?.height)}
                        />
                        <MeasurementCard
                            icon={Scale}
                            title="משקל"
                            value={formatValue(latestUserWeight?.weight, 1)}
                            unit="ק״ג"
                            currentStatus={getCurrentStatusExplanation('weight', latestUserWeight?.weight)}
                            onClick={() => handleMeasurementClick('weight', latestUserWeight?.weight)}
                        />
                        <MeasurementCard
                            icon={Heart}
                            title="BMI (מחושב)"
                            value={formatValue(calculatedBMI, 1)}
                            status={bmiCategory}
                            ranges={getMeasurementRanges('bmi', user.gender, age)}
                            currentStatus={getCurrentStatusExplanation('bmi', calculatedBMI, bmiCategory, user.gender, age)}
                            onClick={() => handleMeasurementClick('bmi', calculatedBMI, bmiCategory)}
                        />
                    </div>
                </section>

                {/* Body Composition - from coach measurements */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                        <Dumbbell className="w-5 h-5 text-green-600" />
                        הרכב גוף
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <MeasurementCard
                            icon={Activity}
                            title="אחוז שומן"
                            value={formatValue(estimatedMetrics.fatPercentage, 1)}
                            unit="%"
                            status={fatCategory}
                            ranges={getMeasurementRanges('fat_percentage', user.gender, age)}
                            currentStatus={getCurrentStatusExplanation('fat_percentage', estimatedMetrics.fatPercentage, fatCategory, user.gender, age)}
                            onClick={() => handleMeasurementClick('fat_percentage', estimatedMetrics.fatPercentage, fatCategory)}
                        />
                        <MeasurementCard
                            icon={Dumbbell}
                            title="מסת שריר"
                            value={formatValue(estimatedMetrics.muscleMass, 1)}
                            unit="ק״ג"
                            currentStatus={getCurrentStatusExplanation('muscle_mass', estimatedMetrics.muscleMass)}
                            onClick={() => handleMeasurementClick('muscle_mass', estimatedMetrics.muscleMass)}
                        />
                        <MeasurementCard
                            icon={Zap}
                            title="BMR"
                            value={formatIntValue(estimatedMetrics.bmr)}
                            unit="קק״ל/יום"
                            currentStatus={getCurrentStatusExplanation('bmr', estimatedMetrics.bmr)}
                            onClick={() => handleMeasurementClick('bmr', estimatedMetrics.bmr)}
                        />
                    </div>
                </section>

                {/* Advanced Metrics - from coach measurements */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-purple-600" />
                        מדדים מתקדמים
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MeasurementCard
                            icon={Recycle}
                            title="גיל מטבולי"
                            value={formatIntValue(estimatedMetrics.metabolicAge)}
                            unit="שנים"
                            status={metabolicAgeCategory}
                            ranges={getMeasurementRanges('metabolic_age', user.gender, age)}
                            currentStatus={getCurrentStatusExplanation('metabolic_age', estimatedMetrics.metabolicAge, metabolicAgeCategory, user.gender, age)}
                            onClick={() => handleMeasurementClick('metabolic_age', estimatedMetrics.metabolicAge, metabolicAgeCategory)}
                        />
                        <MeasurementCard
                            icon={ShieldAlert}
                            title="שומן ויסצרלי"
                            value={formatIntValue(estimatedMetrics.visceralFat)}
                            unit="רמה"
                            status={visceralFatCategory}
                            ranges={getMeasurementRanges('visceral_fat', user.gender, age)}
                            currentStatus={getCurrentStatusExplanation('visceral_fat', estimatedMetrics.visceralFat, visceralFatCategory, user.gender, age)}
                            onClick={() => handleMeasurementClick('visceral_fat', estimatedMetrics.visceralFat, visceralFatCategory)}
                        />
                        <MeasurementCard
                            icon={Droplets}
                            title="אחוזי מים"
                            value={formatValue(estimatedMetrics.waterPercent, 1)}
                            unit="%"
                            ranges={getMeasurementRanges('body_water_percentage', user.gender, age)}
                            currentStatus={getCurrentStatusExplanation('body_water_percentage', estimatedMetrics.waterPercent, null, user.gender, age)}
                            onClick={() => handleMeasurementClick('body_water_percentage', estimatedMetrics.waterPercent)}
                        />
                        <MeasurementCard
                            icon={Dna}
                            title="דירוג מבנה גוף"
                            value={formatIntValue(estimatedMetrics.bodyTypeRating)}
                            unit="/9"
                            ranges={getMeasurementRanges('physique_rating', user.gender, age)}
                            currentStatus={getCurrentStatusExplanation('physique_rating', estimatedMetrics.bodyTypeRating, null, user.gender, age)}
                            onClick={() => handleMeasurementClick('physique_rating', estimatedMetrics.bodyTypeRating)}
                        />
                    </div>
                </section>

                {/* Circumferences - from coach measurements only if exist */}
                {(latestCoachMeasurement?.neck_circumference !== undefined && latestCoachMeasurement?.neck_circumference !== null ||
                  latestCoachMeasurement?.chest_circumference !== undefined && latestCoachMeasurement?.chest_circumference !== null || 
                  latestCoachMeasurement?.waist_circumference !== undefined && latestCoachMeasurement?.waist_circumference !== null || 
                  latestCoachMeasurement?.glutes_circumference !== undefined && latestCoachMeasurement?.glutes_circumference !== null || 
                  latestCoachMeasurement?.thigh_circumference_right !== undefined && latestCoachMeasurement?.thigh_circumference_right !== null ||
                  latestCoachMeasurement?.bicep_circumference_right !== undefined && latestCoachMeasurement?.bicep_circumference_right !== null || 
                  latestCoachMeasurement?.calf_circumference_right !== undefined && latestCoachMeasurement?.calf_circumference_right !== null) && (
                    <section>
                        <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
                            <Ruler className="w-5 h-5 text-indigo-600" />
                            היקפים
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                            {latestCoachMeasurement?.neck_circumference !== undefined && latestCoachMeasurement?.neck_circumference !== null && (
                                <MeasurementCard
                                    icon={Ruler}
                                    title="צוואר"
                                    value={formatValue(latestCoachMeasurement.neck_circumference, 1)}
                                    unit="ס״מ"
                                    isClickable={false}
                                />
                            )}
                            {latestCoachMeasurement?.chest_circumference !== undefined && latestCoachMeasurement?.chest_circumference !== null && (
                                <MeasurementCard
                                    icon={Ruler}
                                    title="חזה"
                                    value={formatValue(latestCoachMeasurement.chest_circumference, 1)}
                                    unit="ס״מ"
                                    isClickable={false}
                                />
                            )}
                            {latestCoachMeasurement?.waist_circumference !== undefined && latestCoachMeasurement?.waist_circumference !== null && (
                                <MeasurementCard
                                    icon={Ruler}
                                    title="מותן"
                                    value={formatValue(latestCoachMeasurement.waist_circumference, 1)}
                                    unit="ס״מ"
                                    isClickable={false}
                                />
                            )}
                            {latestCoachMeasurement?.glutes_circumference !== undefined && latestCoachMeasurement?.glutes_circumference !== null && (
                                <MeasurementCard
                                    icon={Ruler}
                                    title="ישבן"
                                    value={formatValue(latestCoachMeasurement.glutes_circumference, 1)}
                                    unit="ס״מ"
                                    isClickable={false}
                                />
                            )}
                            {latestCoachMeasurement?.thigh_circumference_right !== undefined && latestCoachMeasurement?.thigh_circumference_right !== null && (
                                <MeasurementCard
                                    icon={Ruler}
                                    title="ירך ימין"
                                    value={formatValue(latestCoachMeasurement.thigh_circumference_right, 1)}
                                    unit="ס״מ"
                                    isClickable={false}
                                />
                            )}
                            {latestCoachMeasurement?.bicep_circumference_right !== undefined && latestCoachMeasurement?.bicep_circumference_right !== null && (
                                <MeasurementCard
                                    icon={Ruler}
                                    title="יד ימין"
                                    value={formatValue(latestCoachMeasurement.bicep_circumference_right, 1)}
                                    unit="ס״מ"
                                    isClickable={false}
                                />
                            )}
                            {latestCoachMeasurement?.calf_circumference_right !== undefined && latestCoachMeasurement?.calf_circumference_right !== null && (
                                <MeasurementCard
                                    icon={Ruler}
                                    title="שוק ימין"
                                    value={formatValue(latestCoachMeasurement.calf_circumference_right, 1)}
                                    unit="ס״מ"
                                    isClickable={false}
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* Show message if no coach measurements exist */}
                {(!latestCoachMeasurement || !Object.values(latestCoachMeasurement).some(v => v !== null && v !== undefined && v !== 'N/A')) && (
                    <div className="text-center py-12 text-slate-500">
                        <Scale className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <p className="text-lg">אין מדידות מאמן</p>
                        <p className="text-sm">צור קשר עם המאמן שלך לביצוע מדידות מתקדמות</p>
                    </div>
                )}
            </CardContent>

            {/* Explanation Dialog */}
            <Dialog open={isExplanationDialogOpen} onOpenChange={setIsExplanationDialogOpen}>
                <DialogContent className="max-w-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            {selectedMeasurement ? (
                                <>
                                    <Info className="w-6 h-6 text-blue-600" />
                                    {selectedMeasurement.title}
                                </>
                            ) : (
                                <VisuallyHidden>פרטי מדידה</VisuallyHidden>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedMeasurement && (
                        <>
                            <div className="space-y-6 py-4">
                                {/* Current Status */}
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" />
                                        המצב הנוכחי שלך
                                    </h4>
                                    <p className="text-blue-800">{selectedMeasurement.currentStatus}</p>
                                </div>

                                {/* Explanation */}
                                <div className="space-y-3">
                                    <h4 className="font-semibold text-slate-900">מה זה אומר?</h4>
                                    <p className="text-slate-700 leading-relaxed">{selectedMeasurement.explanation}</p>
                                </div>

                                {/* Recommendations */}
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        המלצות
                                    </h4>
                                    <p className="text-green-800">{selectedMeasurement.recommendations}</p>
                                </div>

                                {/* Status Badge */}
                                {selectedMeasurement.category && (
                                    <div className="text-center">
                                        <Badge className={`text-sm px-4 py-2 ${selectedMeasurement.category.color}`}>
                                            {selectedMeasurement.category.level === 'סיכון גבוה' && <AlertTriangle className="w-4 h-4 ml-1" />}
                                            {selectedMeasurement.category.level === 'תקין' && <CheckCircle className="w-4 h-4 ml-1" />}
                                            סטטוס: {selectedMeasurement.category.text}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {!selectedMeasurement && (
                        <div className="py-8 text-center text-slate-500">
                            אין מדידה נבחרת להצגה
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
