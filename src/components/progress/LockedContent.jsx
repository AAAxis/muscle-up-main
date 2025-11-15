
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Check, Mail, Loader2 } from 'lucide-react';
import { User, CoachNotification } from '@/api/entities';

export default function LockedContent() {
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState("");

  const handleBoosterRequest = async () => {
    setIsSendingRequest(true);
    setRequestStatus("");

    try {
      // Get current user info
      const currentUser = await User.me();
      
      // Check if a request already exists
      const existingRequests = await CoachNotification.filter({ 
        user_email: currentUser.email,
        notification_type: 'booster_request',
        is_read: false
      });
      
      if (existingRequests && existingRequests.length > 0) {
        setRequestStatus("ℹ️ כבר קיימת בקשה פתוחה. המאמן יראה אותה בקרוב.");
        setIsSendingRequest(false);
        return;
      }
      
      // Use coach email from user profile, or fallback to admin
      let coachEmail = currentUser.coach_email;
      
      if (!coachEmail) {
        // Find the admin as fallback
        const admins = await User.filter({ role: 'admin' });
        if (!admins || admins.length === 0) {
          setRequestStatus("❌ שגיאה: לא נמצא מאמן ליצירת קשר.");
          setIsSendingRequest(false);
          return;  
        }
        coachEmail = admins[0].email;
      }
      
      // Create notification in Firestore instead of sending email
      await CoachNotification.create({
        user_email: currentUser.email,
        user_name: currentUser.name || currentUser.full_name || 'משתמש לא ידוע',
        coach_email: coachEmail,
        notification_type: 'booster_request',
        notification_title: '🚀 בקשה להצטרפות לתכנית הבוסטר',
        notification_message: `המתאמן/ת ${currentUser.name || currentUser.email} מבקש/ת להצטרף לתכנית הבוסטר.`,
        notification_details: {
          user_name: currentUser.name,
          user_email: currentUser.email,
          coach_name: currentUser.coach_name || 'לא צוין',
          request_date: new Date().toISOString()
        },
        is_read: false,
        created_date: new Date().toISOString()
      });

      setRequestStatus("✅ הבקשה נשלחה בהצלחה למאמן! הוא יראה אותה בלוח הבקרה.");
    } catch (error) {
      console.error("Error sending booster request:", error);
      setRequestStatus("❌ אירעה שגיאה בשליחת הבקשה. אנא נסה שוב מאוחר יותר.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card className="muscle-glass border-0 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800 mb-2">🔒 תכנית הבוסטר</CardTitle>
          <CardDescription className="text-lg text-slate-600 font-medium">
            התקדמות מדודה. תוצאות מדויקות.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-8">
          {/* Main Description */}
          <div className="text-center bg-slate-50 rounded-xl p-6">
            <p className="text-slate-700 leading-relaxed text-lg">
              תכנית הבוסטר היא מערכת מתקדמת לניהול, מעקב והתייעלות, המיועדת למתאמנים מחויבים המעוניינים לשפר ביצועים ולמקסם תוצאות לאורך זמן.
            </p>
            <p className="text-slate-600 mt-4 font-medium">
              הגישה לתכנית ניתנת באישור המאמן בלבד, לאחר שלב הערכה והתאמה אישית.
            </p>
          </div>

          {/* Program Components */}
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">רכיבי התכנית:</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white border border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Check className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">משימות שבועיות ממוקדות</h4>
                      <p className="text-slate-600 text-sm">התאמה לפי מטרות האימון שלך, כולל תזכורות ובקרה רציפה.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Check className="w-6 h-6 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">הגדרת מטרות חודשיות ומדדי הצלחה</h4>
                      <p className="text-slate-600 text-sm">מעקב אחר התקדמות לפי אבני דרך מוגדרות מראש.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-purple-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Check className="w-6 h-6 text-purple-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">מערכת מתקדמת למעקב תזונתי</h4>
                      <p className="text-slate-600 text-sm">כוללת ניתוח תמונה או תיאור של הארוחה לצורך הערכת הרכב תזונתי – חלבונים, פחמימות ושומנים – עם אפשרות לשמירה, תיעוד והפקת דוחות.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-orange-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Check className="w-6 h-6 text-orange-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">תיעוד גרפי ודוחות שיפור אישי</h4>
                      <p className="text-slate-600 text-sm">העלאת תמונות, השוואת ביצועים והפקת דוחות מותאמים אישית.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Call to Action */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 text-center">
            <div className="text-2xl mb-4">🔐</div>
            <p className="text-slate-700 text-lg font-medium mb-6 leading-relaxed">
              התכנית מאפשרת לך לעבור מאימון כללי לניהול מתקדם של התקדמות אישית – עם שליטה, בקרה ודיוק בכל שלב.
            </p>
            
            <div className="space-y-4">
              <p className="text-slate-600 font-medium">לפרטים ולהצטרפות:</p>
              <Button 
                onClick={handleBoosterRequest}
                disabled={isSendingRequest}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isSendingRequest ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    שולח בקשה...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    שלח בקשה למאמן
                  </>
                )}
              </Button>
            </div>

            {requestStatus && (
              <div className={`mt-4 p-3 rounded-lg ${
                requestStatus.includes("שגיאה") || requestStatus.includes("אירעה")
                  ? "bg-red-100 text-red-700 border border-red-300"
                  : "bg-green-100 text-green-700 border border-green-300"
              }`}>
                {requestStatus}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
