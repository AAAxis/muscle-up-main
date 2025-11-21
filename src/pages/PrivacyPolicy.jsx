import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Mail, Lock, Eye, FileText } from 'lucide-react';

export default function PrivacyPolicy() {
  const contactEmail = 'yr2206@gmail.com';
  const lastUpdated = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-block mb-4">
            <Shield className="w-16 h-16 text-emerald-600 mx-auto" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent mb-4">
            מדיניות פרטיות
          </h1>
          <p className="text-slate-600">
            עודכן לאחרונה: {lastUpdated}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Introduction */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardContent className="p-6">
              <p className="text-slate-700 leading-relaxed">
                ב-Muscle Up, אנו מחויבים להגנה על הפרטיות שלך. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים, מגנים ומחשיפים את המידע שלך בעת השימוש באפליקציה שלנו.
              </p>
            </CardContent>
          </Card>

          {/* Section 1 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                1. איזה מידע אנו אוספים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">מידע אישי:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mr-4">
                  <li>שם מלא</li>
                  <li>כתובת אימייל</li>
                  <li>מספר טלפון</li>
                  <li>תאריך לידה</li>
                  <li>מין</li>
                  <li>גובה ומשקל</li>
                  <li>תמונות פרופיל</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">מידע על אימונים:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mr-4">
                  <li>תוכניות אימון</li>
                  <li>תרגילים שבוצעו</li>
                  <li>משקלים וחזרות</li>
                  <li>תמונות התקדמות</li>
                  <li>נתוני מעקב משקל</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">מידע טכני:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mr-4">
                  <li>כתובת IP</li>
                  <li>סוג מכשיר ומערכת הפעלה</li>
                  <li>נתוני שימוש באפליקציה</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <Eye className="w-5 h-5" />
                2. כיצד אנו משתמשים במידע
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-slate-700 mr-4">
                <li>לספק ולשפר את השירותים שלנו</li>
                <li>ליצור תוכניות אימון מותאמות אישית</li>
                <li>לעקוב אחר התקדמותך ולספק משוב</li>
                <li>לתקשר איתך לגבי השירותים והעדכונים</li>
                <li>לספק תמיכה טכנית</li>
                <li>לשמור על אבטחת האפליקציה ולמנוע הונאות</li>
                <li>לעמוד בדרישות משפטיות</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 3 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <Lock className="w-5 h-5" />
                3. הגנה על המידע
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                אנו משתמשים באמצעי אבטחה טכנולוגיים וארגוניים מתקדמים כדי להגן על המידע שלך:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 mr-4">
                <li>הצפנת נתונים בתעבורה ובמנוחה</li>
                <li>גישה מוגבלת למידע רק לעובדים הזקוקים לו</li>
                <li>גיבויים קבועים של הנתונים</li>
                <li>מערכות אבטחה מתקדמות למניעת גישה לא מורשית</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 4 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                4. שיתוף מידע עם צדדים שלישיים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                אנו לא מוכרים את המידע האישי שלך. אנו עשויים לשתף מידע רק במקרים הבאים:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 mr-4">
                <li>עם ספקי שירותים המסייעים לנו להפעיל את האפליקציה (תחת הסכמי סודיות)</li>
                <li>כאשר נדרש על פי חוק או צו בית משפט</li>
                <li>כדי להגן על זכויותינו או על בטיחות המשתמשים</li>
                <li>במקרה של מיזוג, רכישה או מכירה של עסק</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 5 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                5. זכויותיך
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                יש לך זכויות הבאות ביחס למידע האישי שלך:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 mr-4">
                <li>זכות גישה למידע האישי שלך</li>
                <li>זכות לעדכן או לתקן מידע לא מדויק</li>
                <li>זכות למחוק את החשבון והמידע שלך</li>
                <li>זכות להתנגד לעיבוד המידע שלך</li>
                <li>זכות להעביר את המידע שלך (נתוני פורטביליות)</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 6 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                6. עוגיות וטכנולוגיות מעקב
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">
                האפליקציה שלנו עשויה להשתמש בעוגיות וטכנולוגיות דומות כדי לשפר את החוויה שלך. אתה יכול לשלוט בעוגיות דרך הגדרות הדפדפן או המכשיר שלך.
              </p>
            </CardContent>
          </Card>

          {/* Section 7 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                7. שינויים במדיניות הפרטיות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">
                אנו עשויים לעדכן את מדיניות הפרטיות מעת לעת. כל שינוי יפורסם בדף זה עם תאריך העדכון. מומלץ לבדוק את המדיניות באופן קבוע.
              </p>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="bg-gradient-to-r from-emerald-500 to-teal-500 border-0 shadow-xl">
            <CardContent className="p-6 text-white">
              <div className="flex items-start gap-4">
                <Mail className="w-6 h-6 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold mb-2">צור קשר</h3>
                  <p className="mb-3 opacity-90">
                    אם יש לך שאלות או בקשות לגבי מדיניות הפרטיות שלנו, אנא צור איתנו קשר:
                  </p>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-white font-semibold hover:underline inline-flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    {contactEmail}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

