
import React, { useState, useEffect } from 'react';
import { WeightEntry, User, WeeklyCheckin, WeeklyTask, CoachNotification } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Scale, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, differenceInWeeks } from 'date-fns';
import { he } from 'date-fns/locale';
// SendEmail removed - using CoachNotification instead
import { getCurrentDateString, formatDate, getCurrentISOString } from "@/components/utils/timeUtils";
import WeightEntryForm from './WeightEntryForm';
import CheckinModal from './CheckinModal';

const weeklyQuestions = [
    "איך אתה מרגיש עם ההתחלה של התהליך (פיזית, מנטלית, רגשית)?",
    "מה הכי הפתיע אותך עד עכשיו?",
    "איזה הרגל אחד הצלחת לשנות בשבועות האחרונים?",
    "מה אתה צריך ממני כדי להרגיש יותר בטוח בדרך שלך?",
    "איזה מחשבה חוזרת מקשה עליך – ואיך אתה מתמודד איתה?",
    "מה עזר לך להישאר עקבי גם כשלא היה מושלם?",
    "מה אתה הכי גאה שעשית עד עכשיו בתהליך הזה?",
    "מה למדת על עצמך כשנפלת או סטית מהתוכנית?",
    "איך אתה מדבר לעצמך כשקשה? זה עוזר או תוקע?",
    "אם היית פוגש את עצמך בתחילת הדרך – מה היית אומר לו?",
    "איזה שינוי קטן ייקח אותך עוד צעד קדימה בשבוע הקרוב?",
    "סכם את כל הדרך במשפט אחד שנותן לך כוח להמשיך קדימה."
];

export default function WeightTracker({ user, weightEntries, onUpdateEntries }) {
  const [entries, setEntries] = useState([]);
  const [formData, setFormData] = useState({
    date: getCurrentDateString(),
    weight: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [currentCheckinWeek, setCurrentCheckinWeek] = useState(0);
  const [checkinQuestion, setCheckinQuestion] = useState(''); // Initialize with empty string

  useEffect(() => {
    if (user?.email && weightEntries) {
      // The parent component provides weightEntries sorted descendingly (newest first).
      setEntries(weightEntries); 
    } else if (user?.email) {
      loadEntries();
    }
  }, [user, weightEntries]);

  const loadEntries = async () => {
    try {
      // Fetch entries sorted by date in descending order (newest to oldest)
      const userEntries = await WeightEntry.filter({ user_email: user.email }, "-date");
      setEntries(userEntries || []);
      if (onUpdateEntries) {
          onUpdateEntries(userEntries || []);
      }
      setError('');
    } catch (error) {
      console.error("Error loading weight entries:", error);
      setError('שגיאה בטעינת המדידות. אנא נסה שוב.');
      setEntries([]);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setError('');
    setSuccess('');
  };

  const calculateBMI = (weight, height) => {
    if (!weight || !height || height <= 0) return null;
    const heightInMeters = height > 3 ? height / 100 : height;
    return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10;
  };

  const getBMICategory = (bmi) => {
    if (!bmi) return null;
    if (bmi < 18.5) return "תת-משקל";
    if (bmi < 25) return "משקל תקין";
    if (bmi < 30) return "עודף משקל";
    return "השמנה";
  };

  const handleSaveEntry = async () => {
    if (!formData.weight || !formData.date) {
      setError("יש למלא משקל ותאריך.");
      return;
    }
    const weightValue = parseFloat(formData.weight);
    if (isNaN(weightValue) || weightValue <= 20 || weightValue > 300) {
      setError("נא להזין משקל תקין (20-300 ק\"ג).");
      return;
    }
    if (!user?.email || !user.height) {
      setError("שגיאה: פרטי גובה חסרים בפרופיל המשתמש. אנא עדכן את הפרופיל האישי כדי לחשב BMI.");
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const bmi = calculateBMI(weightValue, user.height);
      const bmi_category = getBMICategory(bmi);

      const entryData = {
        user_email: user.email,
        date: formData.date,
        weight: weightValue,
        height: user.height,
        bmi: bmi,
        bmi_category: bmi_category,
        bmi_alert: !!(bmi && (bmi < 18.5 || bmi >= 30))
      };

      const newEntry = await WeightEntry.create(entryData);
      await User.updateMyUserData({ current_weight: weightValue });
      
      setSuccess('המשקל עודכן ונשמר בהצלחה!');
      
      setFormData({ date: getCurrentDateString(), weight: '' });
      
      if (onUpdateEntries) {
        await onUpdateEntries(); // Notify parent to re-fetch and update entries prop
      }

      // --- Updated Logic for Weekly Check-in ---
      // Check if user should see weekly question based on active weekly tasks
      try {
        const userTasks = await WeeklyTask.filter({ user_email: user.email });
        const today = new Date();
        
        // Find if there's an active task this week
        const activeTask = userTasks.find(task => {
          if (!task.week_start_date || !task.week_end_date) return false;
          const startDate = parseISO(task.week_start_date);
          const endDate = parseISO(task.week_end_date);
          // Check if today is within the task's week range (inclusive)
          return today >= startDate && today <= endDate;
        });

        if (activeTask) {
          // Check if user already answered this week's question
          const existingCheckin = await WeeklyCheckin.filter({ 
            user_email: user.email, 
            week_number: activeTask.week 
          });
          
          if (existingCheckin.length === 0) {
            // User hasn't answered yet - show the modal
            const questionIndex = activeTask.week - 1;
            if (questionIndex >= 0 && questionIndex < weeklyQuestions.length) {
              setCurrentCheckinWeek(activeTask.week);
              setCheckinQuestion(weeklyQuestions[questionIndex]); // Arrays are 0-indexed
              setIsCheckinModalOpen(true);
            }
          }
        }
      } catch (taskError) {
        console.error("Error checking weekly tasks, falling back to date-based calculation:", taskError);
        // If tasks aren't available, fall back to date-based calculation
        // This query specifically needs entries sorted ascendingly to find the first entry date
        const allWeightEntries = await WeightEntry.filter({ user_email: user.email }, 'date'); 
        if (allWeightEntries.length > 0) {
          const startDate = parseISO(allWeightEntries[0].date); // The very first entry date
          const weekNumber = differenceInWeeks(new Date(), startDate) + 1; // +1 to make it 1-indexed week

          if (weekNumber > 0 && weekNumber <= weeklyQuestions.length) {
            const existingCheckins = await WeeklyCheckin.filter({ 
              user_email: user.email, 
              week_number: weekNumber 
            });
            if (existingCheckins.length === 0) {
              setCurrentCheckinWeek(weekNumber);
              setCheckinQuestion(weeklyQuestions[weekNumber - 1]);
              setIsCheckinModalOpen(true);
            }
          }
        }
      }
      
      if (user.coach_email) {
        try {
          const subject = `עדכון משקל חדש - ${user.name}`;
          const body = `
            <div dir="rtl" style="font-family: Arial, sans-serif;">
              <h3>שלום ${user.coach_name || 'מאמן/ת'},</h3>
              <p>המתאמן <strong>${user.name}</strong> עדכן את המשקל שלו דרך האפליקציה.</p>
              <ul style="list-style-type: none; padding: 0;">
                <li style="margin-bottom: 5px;"><strong>משקל חדש:</strong> ${weightValue} ק"ג</li>
                <li style="margin-bottom: 5px;"><strong>תאריך:</strong> ${format(parseISO(formData.date), 'dd/MM/yyyy')}</li>
                ${bmi ? `<li style="margin-bottom: 5px;"><strong>BMI:</strong> ${bmi} (${bmi_category})</li>` : ''}
              </ul>
              <p>הנתונים סונכרנו וזמינים לצפייה בפאנל הניהול.</p>
            </div>`;
          // Create notification instead of sending email
          await CoachNotification.create({
            user_email: user.email,
            user_name: user.name || user.full_name || 'משתמש לא ידוע',
            coach_email: user.coach_email,
            notification_type: 'weight_update',
            notification_title: subject,
            notification_message: `המתאמן/ת ${user.name} עדכן/ה את המשקל: ${weightValue} ק"ג`,
            notification_details: {
              new_weight: weightValue,
              date: formData.date,
              bmi: bmi,
              bmi_category: bmi_category
            },
            is_read: false,
            created_date: new Date().toISOString()
          });
        } catch (notificationError) {
          console.error("Failed to send notification to coach:", notificationError);
        }
      }
      
    } catch (error) {
      console.error("Error saving weight entry:", error);
      setError('אירעה שגיאה בשמירת המדידה. אנא נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      date: getCurrentDateString(),
      weight: ''
    });
    setError('');
    setSuccess('');
  };

  // Prepare chart data: get the 10 newest entries.
  // entries array is sorted newest to oldest. slice(0, 10) gets the 10 newest in that order.
  // To display oldest on the left and newest on the right, we reverse the sliced array.
  const chartData = entries.slice(0, 10).reverse().map((entry) => ({
    date: format(parseISO(entry.date), 'dd/MM', { locale: he }),
    weight: entry.weight
  }));

  // Calculate weight change correctly - current weight (index 0) minus previous weight (index 1)
  // because the array is sorted from newest to oldest.
  const weightChange = entries.length >= 2 ? 
    entries[0].weight - entries[1].weight : 0;
  
  // Determine trend based on weight change
  const trend = Math.abs(weightChange) < 0.1 ? 'stable' : weightChange > 0 ? 'up' : 'down';

  return (
    <div className="space-y-6">
      <Card className="muscle-glass border-0 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Scale className="w-6 h-6 text-blue-600" />
                מעקב משקל
              </CardTitle>
              <CardDescription>הזן כאן את המשקל העדכני שלך</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <WeightEntryForm
                user={user}
                formData={formData}
                handleInputChange={handleInputChange}
                handleSaveEntry={handleSaveEntry}
                onCancel={resetForm}
                isSaving={isSaving}
              />
          </div>

          {/* Weight Summary */}
          {entries.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Scale className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-blue-600">משקל נוכחי</p>
                {/* Display the most recent weight (first element in the newest-to-oldest array) */}
                <p className="text-2xl font-bold text-blue-800">{entries[0]?.weight} ק"ג</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="flex justify-center mb-2">
                  {trend === 'down' ? <TrendingDown className="w-8 h-8 text-green-600" /> : 
                   trend === 'up' ? <TrendingUp className="w-8 h-8 text-red-600" /> : 
                   <div className="w-8 h-8 flex items-center justify-center text-gray-600">━</div>}
                </div>
                <p className="text-sm text-purple-600">שינוי אחרון</p>
                <p className={`text-xl font-bold ${
                  trend === 'down' ? 'text-green-600' : 
                  trend === 'up' ? 'text-red-800' : 
                  'text-gray-800'
                }`}>
                  {weightChange !== 0 ? (weightChange > 0 ? '+' : '') + weightChange.toFixed(1) : '0.0'} ק"ג
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-sm text-green-600">סך מדידות</p>
                <p className="text-2xl font-bold text-green-800">{entries.length}</p>
              </div>
            </div>
          )}

          {/* Weight Chart - Normal reading direction */}
          {chartData.length > 1 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">גרף המשקל</h3>
              <div className="h-64 bg-white rounded-lg p-4 border">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={{ stroke: '#cbd5e1' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis 
                      domain={['dataMin - 0.5', 'dataMax + 0.5']} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={{ stroke: '#cbd5e1' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        direction: 'rtl'
                      }}
                      formatter={(value) => [`${value} ק"ג`, 'משקל']}
                      labelFormatter={(label) => `תאריך: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: '#ffffff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Entries */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-800">מדידות אחרונות</h3>
            {entries.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Scale className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>טרם בוצעו מדידות משקל</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Display the 5 most recent entries, with the oldest of those 5 on top */}
                {entries.slice(0, 5).reverse().map((entry) => (
                  <div key={entry.id} className="p-3 border rounded-lg bg-white flex justify-between items-center shadow-sm">
                    <div>
                      <p className="font-semibold text-slate-800">{entry.weight} ק"ג</p>
                      <p className="text-sm text-slate-500">{formatDate(entry.date)}</p>
                    </div>
                    {entry.bmi && (
                      <div className="text-right">
                        <p className="text-sm font-medium">BMI: {entry.bmi}</p>
                        <p className="text-xs text-slate-500">{entry.bmi_category}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <CheckinModal 
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        question={checkinQuestion}
        weekNumber={currentCheckinWeek}
        user={user}
      />
    </div>
  );
}
