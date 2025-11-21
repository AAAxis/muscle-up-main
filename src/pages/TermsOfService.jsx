import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Mail, Scale, AlertCircle, Shield, X } from 'lucide-react';

export default function TermsOfService() {
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
            <Scale className="w-16 h-16 text-emerald-600 mx-auto" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent mb-4">
            תנאי שימוש
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
                ברוכים הבאים ל-Muscle Up. על ידי שימוש באפליקציה שלנו, אתה מסכים לתנאי השימוש המפורטים להלן. אנא קרא אותם בעיון לפני השימוש בשירותים שלנו.
              </p>
            </CardContent>
          </Card>

          {/* Section 1 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                1. קבלת התנאים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">
                על ידי גישה לשימוש באפליקציה Muscle Up, אתה מאשר שקראת, הבנת והסכמת להיות כפוף לתנאי השימוש הללו ולכל החוקים והתקנות החלים. אם אינך מסכים עם כל אחד מהתנאים, אנא אל תשתמש באפליקציה.
              </p>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <Shield className="w-5 h-5" />
                2. תיאור השירות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                Muscle Up היא אפליקציה לניהול חדר כושר המספקת:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 mr-4">
                <li>ניהול מנוי לחדר כושר</li>
                <li>תוכניות אימון מותאמות אישית</li>
                <li>מעקב אחר התקדמות ואימונים</li>
                <li>תקשורת עם מאמנים</li>
                <li>ניהול תזונה ומתכונים</li>
                <li>תכונות נוספות כפי שיוצעו מעת לעת</li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 3 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                3. הרשמה וחשבון משתמש
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">דרישות הרשמה:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mr-4">
                  <li>עליך להיות לפחות בן 18 (או גיל הרוב במדינתך)</li>
                  <li>עליך לספק מידע מדויק ומעודכן</li>
                  <li>עליך לשמור על סודיות פרטי הכניסה שלך</li>
                  <li>אתה אחראי לכל הפעילות בחשבון שלך</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">אבטחת חשבון:</h3>
                <p className="text-slate-700 leading-relaxed">
                  אתה אחראי לשמירה על סודיות פרטי הכניסה שלך ולכל הפעילות המבוצעת בחשבון שלך. עליך להודיע לנו מיד על כל שימוש לא מורשה בחשבון שלך.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 4 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <AlertCircle className="w-5 h-5" />
                4. שימוש מותר ואסור
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">מותר:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mr-4">
                  <li>שימוש באפליקציה למטרות אישיות וחוקיות</li>
                  <li>שיתוף תוכן שלך עם מאמנים מורשים</li>
                  <li>שימוש בתכונות כפי שהן מוצעות</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">אסור:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mr-4">
                  <li>שימוש באפליקציה למטרות בלתי חוקיות</li>
                  <li>ניסיון לפרוץ או לפגוע באבטחת האפליקציה</li>
                  <li>העלאת תוכן פוגעני, אלים או לא חוקי</li>
                  <li>העתקה או הפצה של תוכן האפליקציה ללא רשות</li>
                  <li>שימוש בוטים או כלים אוטומטיים</li>
                  <li>התחזות לאדם אחר</li>
                  <li>הפרעה לפעילות האפליקציה או למשתמשים אחרים</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 5 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                5. תוכן משתמש
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                אתה שומר על כל הזכויות בתוכן שאתה מעלה לאפליקציה. עם זאת, על ידי העלאת תוכן, אתה מעניק לנו רישיון לא בלעדי, ברחבי העולם, ללא תשלום, להשתמש, להעתיק, לשנות ולהציג את התוכן שלך במסגרת האפליקציה.
              </p>
              <p className="text-slate-700 leading-relaxed">
                אתה מתחייב שהתוכן שאתה מעלה אינו מפר זכויות יוצרים, סימני מסחר או זכויות אחרות של צדדים שלישיים.
              </p>
            </CardContent>
          </Card>

          {/* Section 6 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <X className="w-5 h-5" />
                6. אחריות והגבלת אחריות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                האפליקציה מסופקת "כפי שהיא" ללא כל אחריות מפורשת או משתמעת. אנו לא מתחייבים שהאפליקציה תהיה זמינה ללא הפרעות, ללא שגיאות או בטוחה לחלוטין.
              </p>
              <p className="text-slate-700 leading-relaxed mb-4">
                <strong>שימו לב:</strong> תוכניות האימון והעצות באפליקציה הן להנחיה בלבד ואינן מהוות תחליף לייעוץ רפואי מקצועי. עליך להתייעץ עם רופא לפני תחילת כל תוכנית אימון.
              </p>
              <p className="text-slate-700 leading-relaxed">
                אנו לא נהיה אחראים לכל נזק ישיר, עקיף, מקרי או תוצאתי הנובע משימוש או אי יכולת להשתמש באפליקציה.
              </p>
            </CardContent>
          </Card>

          {/* Section 7 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                7. ביטול והשעיה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed mb-4">
                אנו שומרים לעצמנו את הזכות לבטל או להשעות את הגישה שלך לאפליקציה בכל עת, ללא הודעה מוקדמת, מכל סיבה שהיא, כולל הפרה של תנאי השימוש הללו.
              </p>
              <p className="text-slate-700 leading-relaxed">
                אתה רשאי לבטל את החשבון שלך בכל עת דרך הגדרות האפליקציה או על ידי יצירת קשר איתנו.
              </p>
            </CardContent>
          </Card>

          {/* Section 8 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                8. שינויים בתנאים
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">
                אנו שומרים לעצמנו את הזכות לעדכן או לשנות את תנאי השימוש בכל עת. שינויים ייכנסו לתוקף מייד עם פרסומם באפליקציה. המשך השימוש באפליקציה לאחר שינויים מהווה הסכמה לתנאים המעודכנים.
              </p>
            </CardContent>
          </Card>

          {/* Section 9 */}
          <Card className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <FileText className="w-5 h-5" />
                9. חוק שולט וסמכות שיפוט
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">
                תנאי השימוש הללו נשלטים על פי חוקי מדינת ישראל. כל מחלוקת הנובעת מתנאים אלה תיפתר בבתי המשפט המוסמכים בישראל.
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
                    אם יש לך שאלות או בקשות לגבי תנאי השימוש, אנא צור איתנו קשר:
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

