import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function WelcomeModal({ isOpen, onClose, user }) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl border-0 overflow-hidden"
        dir="rtl"
        hideCloseButton={true}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>ברוך הבא ל-MUSCLE UP YAVNE</DialogTitle>
        </DialogHeader>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative text-center p-8 space-y-6 overflow-hidden"
        >
          {/* Background Logo */}
          <div className="absolute inset-0 flex items-center justify-center z-0 opacity-10">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d04615afd_.png"
              alt="Background Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="relative z-10 space-y-6">
              {/* Title */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold">
                  <span className="bg-gradient-to-r from-green-600 via-yellow-500 to-blue-500 bg-clip-text text-transparent">
                    MUSCLE UP YAVNE
                  </span>
                </h1>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-slate-800">
                    ברוך הבא{user?.gender === 'female' ? 'ה' : ''}
                  </h2>
                  <p className="text-slate-600 text-lg font-medium">
                    Better Than Yesterday
                  </p>
                </div>
              </div>

              {/* Welcome Message */}
              <div className="bg-gradient-to-r from-green-50/20 to-blue-50/20 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/30">
                <p className="text-slate-700 leading-relaxed">
                  {user?.name ? `שלום ${user.name}, ` : ''}
                  ברוך הבא למשפחת MUSCLE UP YAVNE! 
                  <br />
                  בואו נתחיל להכיר אותך טוב יותר.
                </p>
              </div>

              {/* Start Button */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  התחל את המסע שלך
                </Button>
              </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}