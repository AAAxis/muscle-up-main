
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Loader2, Wrench, Sparkles, BookOpen, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RecipeBook from '../components/nutrition/RecipeBook';
import AIRecipeBuilder from '../components/nutrition/AIRecipeBuilder';
import FavoriteRecipes from '../components/nutrition/FavoriteRecipes';
import { motion } from 'framer-motion';

export default function Recipes() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState('overview'); // 'overview', 'ai', 'recipes', 'favorites'
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUser = await User.me();
            setUser(currentUser);
        } catch (error) {
            console.error("Error loading user:", error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    // Recipe system is now enabled for all authenticated users
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50 flex items-center justify-center px-4">
                <Card className="max-w-md w-full text-center shadow-xl border-t-4 border-blue-500">
                    <CardHeader>
                        <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                            <Wrench className="w-8 h-8 text-blue-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-800">
                            נדרשת התחברות
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-500 text-lg font-semibold">
                            יש להתחבר כדי לגשת למערכת המתכונים
                        </p>
                         <div className="mt-8 text-center">
                            <button 
                                onClick={() => navigate(createPageUrl('Home'))}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            >
                                ← חזור לדף הבית
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const actionCards = [
        {
            id: 'recipes',
            title: '📚 מתכונים',
            description: 'גלה מתכונים נבחרים ומנוסים',
            icon: BookOpen,
            color: 'from-green-500 to-emerald-600',
            textColor: 'text-white'
        },
        {
            id: 'ai',
            title: '🧠 צור מתכון בעזרת AI',
            description: 'הזן מרכיבים זמינים וקבל מתכון מותאם אישית',
            icon: Sparkles,
            color: 'from-purple-500 to-blue-600',
            textColor: 'text-white'
        },
        {
            id: 'favorites',
            title: '❤️ מתכונים מועדפים',
            description: 'המתכונים השמורים שלך',
            icon: Heart,
            color: 'from-pink-500 to-red-500',
            textColor: 'text-white'
        }
    ];

    if (activeView === 'overview') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50 p-4 space-y-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-slate-800 mb-2">🍽️ מתכונים</h1>
                        <p className="text-slate-600">בחר את הפעולה הרצויה</p>
                    </div>

                    {/* Action Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {actionCards.map((card, index) => (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setActiveView(card.id)}
                                className={`relative overflow-hidden rounded-2xl cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl group`}
                            >
                                <div className={`bg-gradient-to-br ${card.color} p-8 h-64 flex flex-col justify-between`}>
                                    <div className="flex items-start justify-between">
                                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                            <card.icon className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                            <span className="text-white text-sm">←</span>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h3 className={`text-xl font-bold mb-2 ${card.textColor}`}>
                                            {card.title}
                                        </h3>
                                        <p className={`text-white/90 text-sm leading-relaxed`}>
                                            {card.description}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-10 -translate-x-10"></div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50 p-4 space-y-8">
            <div className="max-w-7xl mx-auto">
                {/* Back Button and Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button 
                        onClick={() => setActiveView('overview')}
                        className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-slate-600 hover:text-slate-800"
                    >
                        ← חזור
                    </button>
                    <div>
                        <h1 className="text-4xl font-bold text-slate-800 mb-2">
                            {activeView === 'ai' && '🧠 צור מתכון בעזרת AI'}
                            {activeView === 'recipes' && '📚 מתכונים'}
                            {activeView === 'favorites' && '❤️ מתכונים מועדפים'}
                        </h1>
                        <p className="text-slate-600">
                            {activeView === 'ai' && 'הזן מרכיבים זמינים וקבל מתכון מותאם אישית'}
                            {activeView === 'recipes' && 'גלה מתכונים נבחרים ומנוסים'}
                            {activeView === 'favorites' && 'המתכונים השמורים שלך'}
                        </p>
                    </div>
                </div>

                {/* Content based on active view */}
                {activeView === 'ai' && <AIRecipeBuilder />}
                {activeView === 'recipes' && <RecipeBook />}
                {activeView === 'favorites' && <FavoriteRecipes />}
            </div>
        </div>
    );
}
