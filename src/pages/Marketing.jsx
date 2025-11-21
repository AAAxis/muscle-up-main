import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, Download, Star, Users, Dumbbell, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Marketing() {
  const googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.muscleup.muscleup';
  const appStoreUrl = 'https://apps.apple.com/il/app/muscule-up/id6755150643';

  const features = [
    {
      icon: Dumbbell,
      title: 'ניהול אימונים',
      description: 'תוכניות אימון מותאמות אישית לפי היעדים והמטרות שלך'
    },
    {
      icon: Target,
      title: 'מעקב התקדמות',
      description: 'עקוב אחר גרפים וסטטיסטיקות של התקדמות בזמן אמת'
    },
    {
      icon: Users,
      title: 'תקשורת עם המאמן',
      description: 'קבל עדכונים, שאל שאלות וקבע אימונים ישירות מהאפליקציה'
    },
    {
      icon: TrendingUp,
      title: 'ניהול מנוי',
      description: 'בצע צ\'ק-אין, חידוש או שדרוג מנוי לחדר הכושר בקלות'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-block mb-6">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d04615afd_.png"
              alt="Muscle Up Logo"
              className="w-24 h-24 rounded-2xl object-contain mx-auto shadow-lg"
            />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent mb-4">
            Muscle Up
          </h1>
          <p className="text-xl md:text-2xl text-slate-700 mb-2">
            ניהול חדר הכושר שלך - פשוט, מהיר ומעורר מוטיבציה
          </p>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            בין אם אתה מתחיל בחדר הכושר או אתלט מנוסה, האפליקציה שלנו נותנת לך שליטה מלאה על חוויית הכושר שלך — הכל במקום אחד.
          </p>
        </motion.div>

        {/* App Store Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
        >
          <motion.a
            href={googlePlayUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="block"
          >
            <Card className="bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 hover:border-emerald-400 transition-all duration-300 shadow-lg hover:shadow-xl">
              <CardContent className="p-6 flex items-center gap-4 min-w-[280px]">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-slate-500 mb-1">קבל את זה ב</p>
                  <p className="text-xl font-bold text-slate-800">Google Play</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <Download className="w-6 h-6 text-emerald-600" />
              </CardContent>
            </Card>
          </motion.a>

          <motion.a
            href={appStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="block"
          >
            <Card className="bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 hover:border-emerald-400 transition-all duration-300 shadow-lg hover:shadow-xl">
              <CardContent className="p-6 flex items-center gap-4 min-w-[280px]">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-slate-500 mb-1">הורד ב</p>
                  <p className="text-xl font-bold text-slate-800">App Store</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <Download className="w-6 h-6 text-emerald-600" />
              </CardContent>
            </Card>
          </motion.a>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <Card className="h-full bg-white/80 backdrop-blur-sm border border-slate-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{feature.title}</h3>
                        <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-800">
            מוכן להתחיל את המסע שלך?
          </h2>
          <p className="text-lg md:text-xl mb-6 text-slate-600">
            הורד את האפליקציה עכשיו והתחל לנהל את האימונים שלך בצורה חכמה יותר
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold px-8 py-6 text-lg"
            >
              <a href={googlePlayUrl} target="_blank" rel="noopener noreferrer">
                <Smartphone className="w-5 h-5 ml-2" />
                הורד מ-Google Play
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-emerald-600 bg-transparent text-emerald-600 hover:bg-emerald-600 hover:text-white font-semibold px-8 py-6 text-lg"
            >
              <a href={appStoreUrl} target="_blank" rel="noopener noreferrer">
                <Smartphone className="w-5 h-5 ml-2" />
                הורד מ-App Store
              </a>
            </Button>
          </div>
        </motion.div>

        {/* Footer Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-12 pt-8 border-t border-slate-200"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-slate-600">
            <Link
              to="/privacypolicy"
              className="hover:text-emerald-600 transition-colors underline"
            >
              מדיניות פרטיות
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link
              to="/termsofservice"
              className="hover:text-emerald-600 transition-colors underline"
            >
              תנאי שימוש
            </Link>
            <span className="hidden sm:inline">•</span>
            <a
              href={`mailto:yr2206@gmail.com`}
              className="hover:text-emerald-600 transition-colors underline"
            >
              צור קשר
            </a>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            © {new Date().getFullYear()} Muscle Up. כל הזכויות שמורות.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

