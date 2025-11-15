
import React, { useState, useEffect } from "react";
import { User, Workout, WeightEntry, CalorieTracking, WeeklyTask, ProgressPicture, Goal, MonthlyGoal, CoachMenu, CoachNotification } from "@/api/entities";
// SendEmail removed - using CoachNotification instead
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea"; // Added Textarea import
import { Share2, FileDown, MessageCircle, FileText, CalendarCheck, Award, Mail, BookHeart, Save, Loader2 } from "lucide-react"; // Added BookHeart, Save, and Loader2 icons
import { motion } from "framer-motion";
import { format, parseISO, subDays } from "date-fns";
import { he } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Export() {
  const [user, setUser] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [summaryLetter, setSummaryLetter] = useState(""); // New state for the summary letter
  const [isSavingLetter, setIsSavingLetter] = useState(false); // New state for saving status
  const [saveStatus, setSaveStatus] = useState(""); // New state for save status message

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      setSummaryLetter(currentUser.trainee_personal_summary || ""); // Initialize summaryLetter
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // Effect for auto-saving removed - now manual save only
  const handleSaveLetter = async () => {
    setIsSavingLetter(true);
    setSaveStatus("שומר...");
    try {
        await User.updateMyUserData({ trainee_personal_summary: summaryLetter });
        const updatedUser = await User.me(); // Fetch updated user data to ensure UI is in sync
        setUser(updatedUser); // Update local user state
        setSaveStatus("נשמר בהצלחה! המכתב יופיע בדוח הסיום ✅");
        setTimeout(() => setSaveStatus(""), 3000); // Clear status after a delay
    } catch (error) {
        console.error("Error saving letter:", error);
        setSaveStatus("שגיאה בשמירה ❌");
    } finally {
        setIsSavingLetter(false);
    }
  };

  const generateProfessionalReport = async (reportType) => {
    setIsExporting(true);
    try {
        const currentUser = user;
        const today = new Date();
        let startDate;
        let reportTitle;
        let emailSubject;
        let isBoosterReport = currentUser.booster_unlocked && ['weekly-booster', 'monthly-booster', 'summary'].includes(reportType);

        switch(reportType) {
            case 'weekly-booster':
                startDate = subDays(today, 7);
                reportTitle = `דוח בוסטר שבועי - ${currentUser.name}`;
                emailSubject = `🚀 דוח בוסטר שבועי — ${currentUser.name}`;
                break;
            case 'monthly-booster':
                startDate = subDays(today, 30);
                reportTitle = `דוח בוסטר חודשי — ${currentUser.name}`;
                emailSubject = `🚀 דוח בוסטר חודשי — ${currentUser.name}`;
                break;
            case 'summary':
                startDate = null; // Get all data
                reportTitle = `דוח סיום בוסטר — סיכום 12 שבועות — ${currentUser.name}`;
                emailSubject = `🏆 דוח סיום בוסטר — ${currentUser.name}`;
                break;
            default: // Legacy reports (not used in UI, but kept for logic)
                startDate = subDays(today, 7);
                reportTitle = `דוח שבועי מקצועי - ${currentUser.name}`;
                emailSubject = `📄 דוח שבועי — ${currentUser.name}`;
        }
        
        const filterOptions = { created_by: currentUser.email };
        const userEmailFilter = { user_email: currentUser.email };

        const dataPromises = [
            CalorieTracking.filter(filterOptions, "-date"),
            WeightEntry.filter(filterOptions, "-date"),
            isBoosterReport ? Workout.filter({ ...filterOptions, status: "completed" }, "-date") : Promise.resolve([]),
            isBoosterReport ? WeeklyTask.filter(userEmailFilter, "-completion_date") : Promise.resolve([]),
            isBoosterReport ? ProgressPicture.filter(filterOptions, "-photo_date") : Promise.resolve([]),
            isBoosterReport ? MonthlyGoal.filter(filterOptions, "month") : Promise.resolve([]),
            isBoosterReport ? CoachMenu.filter(userEmailFilter, "-upload_date") : Promise.resolve([]),
        ];

        const [allCalorieData, allWeightData, allWorkoutData, allTasksData, allProgressPicturesData, allMonthlyGoalsData, allCoachMenus] = await Promise.all(dataPromises);

        const filterByDate = (data, dateKey = 'date') => {
            if (!startDate || !data || data.length === 0) return data;
            return data.filter(entry => entry[dateKey] && parseISO(entry[dateKey]) >= startDate);
        };
        
        const latestCoachMenu = allCoachMenus.find(menu => !startDate || (menu.upload_date && parseISO(menu.upload_date) >= startDate));

        const reportData = {
            user: currentUser,
            isBoosterReport,
            title: reportTitle,
            startDateFormatted: startDate ? format(startDate, "dd/MM/yyyy", { locale: he }) : (currentUser.start_date ? format(parseISO(currentUser.start_date), "dd/MM/yyyy", { locale: he }) : 'לא צוין'),
            endDateFormatted: format(today, "dd/MM/yyyy", { locale: he }),
            calories: filterByDate(allCalorieData),
            weights: allWeightData.filter(entry => !startDate || parseISO(entry.date) >= startDate).sort((a,b) => new Date(a.date) - new Date(b.date)),
            workouts: filterByDate(allWorkoutData),
            tasks: filterByDate(allTasksData, 'completion_date'),
            allTasks: allTasksData,
            progressPictures: filterByDate(allProgressPicturesData, 'photo_date'),
            monthlyGoals: allMonthlyGoalsData,
            coachMenu: latestCoachMenu,
        };

        const htmlContent = generateReportHTML(reportData, reportType);

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportType}-${currentUser.name}-${format(today, 'dd-MM-yyyy')}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (currentUser.coach_email) {
            // Create notification instead of sending email
            await CoachNotification.create({
              user_email: currentUser.email,
              user_name: currentUser.name || currentUser.full_name || 'משתמש לא ידוע',
              coach_email: currentUser.coach_email,
              notification_type: 'progress_report',
              notification_title: emailSubject,
              notification_message: `המתאמן/ת ${currentUser.name} שלח/ה דוח התקדמות`,
              notification_details: {
                report_date: new Date().toISOString(),
                report_type: 'progress_export'
              },
              is_read: false,
              created_date: new Date().toISOString()
            });
            
            await User.updateMyUserData({ last_report_sent_date: new Date().toISOString() });
            alert(`הדוח הופק בהצלחה והתראה נשלחה למאמן: ${currentUser.coach_email}`);
        } else {
            alert('הדוח הופק בהצלחה! אנא הגדר כתובת מייל למאמן בפרופיל לשליחה אוטומטית.');
        }

    } catch (error) {
        console.error('Error generating report:', error);
        alert('אירעה שגיאה ביצירת הדוח. נסה שוב.');
    } finally {
        setIsExporting(false);
    }
  };

  const generateReportHTML = (data, reportType) => {
    const cssStyles = `
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; direction: rtl; text-align: right; background-color: #f9f9f9; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 800px; margin: auto; background: white; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.05); padding: 40px; }
            .header { text-align: center; border-bottom: 2px solid #7F9253; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #7F9253; font-size: 28px; }
            .subtitle { font-size: 14px; color: #555; }
            .section { margin-bottom: 30px; }
            h2 { font-size: 22px; color: #5E737B; border-bottom: 1px solid #ddd; padding: 10px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .insight-box { background-color: #f0f8ff; border: 1px solid #d1e7fd; padding: 15px; margin-top: 20px; border-radius: 5px; }
            .insight-box h3 { margin-top: 0; color: #0c5464; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
            .page-break { page-break-before: always; }
            .personal-letter-page { 
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); 
                padding: 60px 40px; 
                min-height: 100vh; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
            }
            .letter-header { text-align: center; margin-bottom: 40px; }
            .letter-content { 
                background: white; 
                padding: 40px; 
                border-radius: 15px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
                border-right: 6px solid #7F9253; 
                line-height: 1.8; 
                font-size: 16px; 
            }
            .letter-signature { 
                text-align: left; 
                margin-top: 30px; 
                font-style: italic; 
                color: #666; 
                border-top: 1px solid #eee; 
                padding-top: 20px; 
            }
        `;

    const userInfoSection = `
        <div class="section">
            <h2>👤 פרטים אישיים</h2>
            <p><strong>שם מתאמן:</strong> ${data.user.name || 'לא צוין'}</p>
            <p><strong>כתובת מייל:</strong> ${data.user.email || 'לא צוין'}</p>
            ${data.user.start_date ? `<p><strong>תאריך תחילת מעקב:</strong> ${format(parseISO(data.user.start_date), "dd/MM/yyyy", { locale: he })}</p>` : ''}
            ${data.user.coach_name ? `<p><strong>מאמן מלווה:</strong> ${data.user.coach_name}</p>` : ''}
        </div>
    `;

    const weightSection = data.weights && data.weights.length > 0 ? `
        <div class="section">
            <h2>⚖️ מעקב משקל</h2>
            <table>
                <tr>
                    <th>תאריך</th>
                    <th>משקל (ק"ג)</th>
                </tr>
                ${data.weights.map(w => `
                <tr>
                    <td>${format(parseISO(w.date), 'dd/MM/yyyy', { locale: he })}</td>
                    <td>${w.weight_kg || '-'}</td>
                </tr>
                `).join('')}
            </table>
            <div class="insight-box">
                <h3>📌 תובנות משקל</h3>
                ${(() => {
                    const sortedWeights = [...data.weights].sort((a,b) => parseISO(a.date) - parseISO(b.date));
                    if (sortedWeights.length === 0) return '<p>אין נתוני משקל בתקופה זו.</p>';
                    const initialWeight = sortedWeights[0].weight_kg;
                    const finalWeight = sortedWeights[sortedWeights.length - 1].weight_kg;
                    const minWeight = Math.min(...sortedWeights.map(w => w.weight_kg));
                    const maxWeight = Math.max(...sortedWeights.map(w => w.weight_kg));
                    let change = '';
                    if (initialWeight && finalWeight) {
                        const diff = (finalWeight - initialWeight).toFixed(1);
                        change = diff > 0 ? `עליה של ${diff} ק"ג` : diff < 0 ? `ירידה של ${Math.abs(diff)} ק"ג` : 'ללא שינוי';
                    }
                    return `
                        <p><strong>משקל התחלתי:</strong> ${initialWeight ? `${initialWeight} ק"ג` : 'N/A'}</p>
                        <p><strong>משקל נוכחי:</strong> ${finalWeight ? `${finalWeight} ק"ג` : 'N/A'}</p>
                        <p><strong>שינוי כולל:</strong> ${change}</p>
                        <p><strong>משקל מינימלי:</strong> ${minWeight ? `${minWeight} ק"ג` : 'N/A'}</p>
                        <p><strong>משקל מקסימלי:</strong> ${maxWeight ? `${maxWeight} ק"ג` : 'N/A'}</p>
                    `;
                })()}
            </div>
        </div>
    ` : '';

    const workoutSection = data.isBoosterReport && data.workouts.length > 0 ? `
        <div class="section">
            <h2>🏋️ מעקב אימונים</h2>
            <table>
                <tr>
                    <th>תאריך</th>
                    <th>סוג אימון</th>
                    <th>פירוט</th>
                    <th>משך (דקות)</th>
                    <th>קושי (1-10)</th>
                </tr>
                ${data.workouts.map(w => `
                <tr>
                    <td>${format(parseISO(w.date), 'dd/MM/yyyy')}</td>
                    <td>${w.workout_type || ''}</td>
                    <td>${w.exercises?.[0]?.notes || w.notes || '-'}</td>
                    <td>60</td>
                    <td>${w.difficulty_rating || '-'}</td>
                </tr>
                `).join('')}
            </table>
            <div class="insight-box">
                <h3>📌 סיכום אימונים בתקופה</h3>
                <p><strong>סה"כ אימונים:</strong> ${data.workouts.length}</p>
                <p><strong>משך אימון ממוצע:</strong> 60 דקות</p>
            </div>
        </div>
    ` : '';
    
    const calorieSection = data.calories && data.calories.length > 0 ? `
        <div class="section">
            <h2>🥗 מעקב קלוריות</h2>
            <table>
                <tr>
                    <th>תאריך</th>
                    <th>קלוריות</th>
                    <th>חלבון (גרם)</th>
                    <th>פחמימה (גרם)</th>
                    <th>שומן (גרם)</th>
                </tr>
                ${data.calories.map(c => `
                <tr>
                    <td>${format(parseISO(c.date), 'dd/MM/yyyy', { locale: he })}</td>
                    <td>${c.total_calories || '-'}</td>
                    <td>${c.total_protein || '-'}</td>
                    <td>${c.total_carbs || '-'}</td>
                    <td>${c.total_fat || '-'}</td>
                </tr>
                `).join('')}
            </table>
            <div class="insight-box">
                <h3>📌 תובנות קלוריות</h3>
                ${(() => {
                    if (data.calories.length === 0) return '<p>אין נתוני קלוריות בתקופה זו.</p>';
                    const avgCalories = (data.calories.reduce((sum, c) => sum + (c.total_calories || 0), 0) / data.calories.length).toFixed(0);
                    const avgProtein = (data.calories.reduce((sum, c) => sum + (c.total_protein || 0), 0) / data.calories.length).toFixed(0);
                    const avgCarbs = (data.calories.reduce((sum, c) => sum + (c.total_carbs || 0), 0) / data.calories.length).toFixed(0);
                    const avgFat = (data.calories.reduce((sum, c) => sum + (c.total_fat || 0), 0) / data.calories.length).toFixed(0);
                    return `
                        <p><strong>ממוצע יומי קלוריות:</strong> ${avgCalories} קק"ל</p>
                        <p><strong>ממוצע יומי חלבון:</strong> ${avgProtein} גרם</p>
                        <p><strong>ממוצע יומי פחמימה:</strong> ${avgCarbs} גרם</p>
                        <p><strong>ממוצע יומי שומן:</strong> ${avgFat} גרם</p>
                    `;
                })()}
            </div>
        </div>
    ` : '';

    const weeklyTasksSection = data.isBoosterReport && data.tasks && data.tasks.length > 0 ? `
        <div class="section">
            <h2>✅ משימות שבועיות</h2>
            <table>
                <tr>
                    <th>תאריך השלמה</th>
                    <th>משימה</th>
                    <th>סטטוס</th>
                </tr>
                ${data.tasks.map(t => `
                <tr>
                    <td>${t.completion_date ? format(parseISO(t.completion_date), 'dd/MM/yyyy', { locale: he }) : '-'}</td>
                    <td>${t.description || '-'}</td>
                    <td>${t.is_completed ? 'הושלם ✅' : 'לא הושלם ❌'}</td>
                </tr>
                `).join('')}
            </table>
            <div class="insight-box">
                <h3>📌 סיכום משימות</h3>
                ${(() => {
                    const completedTasks = data.tasks.filter(t => t.is_completed).length;
                    const totalTasks = data.tasks.length;
                    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : 0;
                    return `
                        <p><strong>סה"כ משימות בתקופה:</strong> ${totalTasks}</p>
                        <p><strong>משימות שהושלמו:</strong> ${completedTasks}</p>
                        <p><strong>אחוז השלמה:</strong> ${completionRate}%</p>
                    `;
                })()}
            </div>
        </div>
    ` : '';

    const progressPicturesSection = data.isBoosterReport && data.progressPictures && data.progressPictures.length > 0 ? `
        <div class="section">
            <h2>📸 תמונות התקדמות</h2>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 15px;">
                ${data.progressPictures.map(p => `
                <div style="text-align: center; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                    <img src="${p.photo_url}" alt="Progress Picture" style="max-width: 150px; height: auto; border-radius: 3px;">
                    <p style="font-size: 12px; margin-top: 5px;">${format(parseISO(p.photo_date), 'dd/MM/yyyy', { locale: he })}</p>
                </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    const monthlyGoalsSection = data.isBoosterReport && data.monthlyGoals && data.monthlyGoals.length > 0 ? `
        <div class="section">
            <h2>🎯 יעדים חודשיים</h2>
            <table>
                <tr>
                    <th>חודש</th>
                    <th>יעד</th>
                    <th>סטטוס</th>
                </tr>
                ${data.monthlyGoals.map(g => `
                <tr>
                    <td>${g.month || '-'}</td>
                    <td>${g.description || '-'}</td>
                    <td>${g.is_achieved ? 'הושג 🎉' : 'לא הושג 😔'}</td>
                </tr>
                `).join('')}
            </table>
        </div>
    ` : '';

    const coachMenuSection = data.isBoosterReport && data.coachMenu ? `
        <div class="section">
            <h2>📜 תפריט / הנחיות מהמאמן</h2>
            <p><strong>תאריך העלאת התפריט האחרון:</strong> ${data.coachMenu.upload_date ? format(parseISO(data.coachMenu.upload_date), 'dd/MM/yyyy', { locale: he }) : 'לא צוין'}</p>
            <p>
                ${data.coachMenu.file_url ? `<a href="${data.coachMenu.file_url}" target="_blank" style="color: #007bff; text-decoration: none;">צפה בתפריט/הנחיות</a>` : 'אין תפריט/הנחיות זמינים.'}
            </p>
        </div>
    ` : '';

    // Add personal summary section only for summary reports and only if trainee wrote something
    const personalSummarySection = (reportType === 'summary' && data.user.trainee_personal_summary) ? `
        <div class="page-break">
            <div class="personal-letter-page">
                <div class="letter-header">
                    <h1 style="color: #7F9253; font-size: 36px; margin-bottom: 10px;">💌 המכתב האישי שלי</h1>
                    <p style="font-size: 18px; color: #666; margin: 0;">רגעי אמת מהמסע האישי</p>
                </div>
                <div class="letter-content">
                    <p style="margin: 0; font-size: 18px; color: #333; white-space: pre-wrap;">${data.user.trainee_personal_summary}</p>
                    <div class="letter-signature">
                        <p style="margin: 0; font-size: 16px;">
                            בכבוד רב,<br>
                            <strong>${data.user.name}</strong><br>
                            ${format(new Date(), "dd בMMMM yyyy", { locale: he })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    ` : '';


    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title}</title>
        <style>
            ${cssStyles}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                 <h1>${data.title}</h1>
                 <div class="subtitle">
                    מאמן מלווה: ${data.user.coach_name || 'לא צוין'}<br>
                    טווח דיווח: ${data.startDateFormatted} - ${data.endDateFormatted}<br>
                    תאריך הפקת הדוח: ${format(new Date(), "dd/MM/yyyy", { locale: he })}
                </div>
            </div>
            
            ${userInfoSection}
            ${weightSection}
            ${workoutSection}
            ${calorieSection}
            ${weeklyTasksSection}
            ${progressPicturesSection}
            ${monthlyGoalsSection}
            ${coachMenuSection}

            <div class="footer">
                 <p>דוח זה הופק באמצעות מערכת MUSCLE UP YAVNE.</p>
            </div>
        </div>
        
        ${personalSummarySection}
    </body>
    </html>`;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-yellow-500 to-blue-500 bg-clip-text text-transparent mb-2">ייצוא ושליחת דוחות</h1>
        <p className="text-slate-600">הפק דוחות מקצועיים ושלח אותם אוטומטית למאמן המלווה</p>
      </motion.div>

      {user?.coach_email && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Alert className="bg-blue-50 border-blue-200">
            <Mail className="h-4 w-4" />
            <AlertDescription>הדוחות יישלחו אוטומטית לכתובת המייל של המאמן: <strong>{user.coach_email}</strong></AlertDescription>
          </Alert>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="muscle-glass border-0 shadow-lg hover:shadow-xl transition-all duration-300 border-green-200 bg-gradient-to-br from-green-50 to-lime-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <CalendarCheck className="w-6 h-6 text-green-600" />
                דוח שבועי
              </CardTitle>
              <CardDescription>סיכום פעילות שבועית במסגרת תוכנית הבוסטר</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => generateProfessionalReport('weekly-booster')} disabled={isExporting || !user.booster_unlocked} className="w-full muscle-primary-gradient text-white hover:shadow-lg">
                {isExporting ? "מייצא..." : "ייצא דוח שבועי"}
              </Button>
              {!user.booster_unlocked && <p className="text-xs text-slate-500 mt-2 text-center">זמין רק לאחר הפעלת תוכנית הבוסטר.</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="muscle-glass border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <FileText className="w-6 h-6 text-blue-600" />
                דוח חודשי
              </CardTitle>
              <CardDescription>סיכום מקיף של 30 הימים האחרונים</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => generateProfessionalReport('monthly-booster')} disabled={isExporting || !user.booster_unlocked} className="w-full bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg">
                {isExporting ? "מייצא..." : "ייצא דוח חודשי"}
              </Button>
              {!user.booster_unlocked && <p className="text-xs text-slate-500 mt-2 text-center">זמין רק לאחר הפעלת תוכנית הבוסטר.</p>}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="muscle-glass border-0 shadow-lg hover:shadow-xl transition-all duration-300 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Award className="w-6 h-6 text-orange-600" />
              דוח סיום בוסטר
            </CardTitle>
            <CardDescription>דוח מקיף לסיכום 12 שבועות</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => generateProfessionalReport('summary')} disabled={isExporting || !user.booster_unlocked} className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white hover:shadow-lg">
              {isExporting ? "מייצא..." : "ייצא דוח סיום"}
            </Button>
            {!user.booster_unlocked && <p className="text-xs text-slate-500 mt-2 text-center">זמין רק לאחר הפעלת תוכנית הבוסטר.</p>}
          </CardContent>
        </Card>
      </motion.div>

      {/* Booster Summary Letter - Moved below reports */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="muscle-glass border-0 shadow-lg hover:shadow-xl transition-all duration-300 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <BookHeart className="w-6 h-6 text-purple-600" />
              מכתב סיכום בוסטר
            </CardTitle>
            <CardDescription>כתוב את החוויה האישית שלך מהתהליך. לחץ "שמור" כדי שהמכתב יופיע בדוח הסיום.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={summaryLetter}
              onChange={(e) => setSummaryLetter(e.target.value)}
              placeholder="מה למדת? איך השתנית? תחושות, רגשות, ומחשבות מהמסע שעברת..."
              className="h-40 bg-white"
              disabled={isSavingLetter}
            />
            
            <div className="flex justify-between items-center">
              <Button
                onClick={handleSaveLetter}
                disabled={isSavingLetter || !summaryLetter.trim()} // Disable if empty or saving
                className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
              >
                {isSavingLetter ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    שמור מכתב
                  </>
                )}
              </Button>
              
              <div className="text-xs text-slate-500 h-4 text-left"> {/* Aligned to left for RTL text */}
                {saveStatus}
              </div>
            </div>
            
            <div className="text-xs text-slate-600 bg-purple-50 p-3 rounded-lg">
              💡 <strong>הערה:</strong> המכתב יופיע בדוח הסיום רק לאחר שמירה. ניתן לערוך ולשמור מספר פעמים.
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
