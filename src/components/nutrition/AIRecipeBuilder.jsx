
import React, { useState, useEffect } from 'react';
import { InvokeLLM, GenerateImage } from '@/api/integrations';
import { Recipe, User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChefHat, Sparkles, Target, Clock, Users, BrainCircuit, Save, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const jsonSchema = {
    type: "object",
    properties: {
        name: { type: "string", description: "שם קצר וקליט למתכון בעברית" },
        category: { 
            type: "string", 
            enum: ["ארוחות עיקריות", "נשנושים בריאים", "שייקים וחטיפי חלבון", "תוספות וסלטים", "תפריטים לפי מטרה"], 
            description: "הקטגוריה המתאימה ביותר למתכון, בהתבסס על המטרה התזונתית" 
        },
        ingredients: { type: "array", items: { type: "string" }, description: "רשימת מרכיבים מפורטת, כולל כמויות מדויקות" },
        instructions: { type: "string", description: "הוראות הכנה מפורטות, מחולקות לשלבים ברורים וממוספרים" },
        prep_time: { type: "number", description: "זמן הכנה כולל בדקות" },
        servings: { type: "number", description: "מספר מנות שהמתכון מפיק" },
        calories_per_serving: { type: "number", description: "הערכת קלוריות מדויקת למנה" },
        protein_grams: { type: "number", description: "הערכת גרם חלבון מדויקת למנה" },
        carbs_grams: { type: "number", description: "הערכת גרם פחמימות מדויקת למנה" },
        fat_grams: { type: "number", description: "הערכת גרם שומן מדויקת למנה" },
        difficulty: { type: "string", enum: ["קל", "בינוני", "קשה"], description: "רמת הקושי להכנת המתכון" },
        equipment: { type: "string", description: "הציוד הדרוש להכנת המתכון" },
        tips: { type: "string", description: "טיפים חשובים או הערות נוספות למתכון" }
    },
    required: ["name", "category", "ingredients", "instructions", "prep_time", "servings", "calories_per_serving", "protein_grams", "carbs_grams", "fat_grams", "difficulty"]
};

export default function AIRecipeBuilder() {
    const [ingredients, setIngredients] = useState('');
    const [nutritionalGoal, setNutritionalGoal] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [generatedRecipe, setGeneratedRecipe] = useState(null);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to fetch user:", error);
                // Optionally handle UI feedback for user not logged in
            }
        };
        fetchUser();
    }, []);

    const handleGenerateRecipe = async () => {
        if (!ingredients.trim() || !nutritionalGoal) {
            setError('יש להזין מרכיבים ולבחור מטרה תזונתית.');
            return;
        }

        setIsLoading(true);
        setIsGeneratingImage(false);
        setError('');
        setGeneratedRecipe(null);

        const prompt = `
            אתה שף מומחה לתזונה בריאה למפתחי גוף וספורטאים. צור מתכון מפורט ומדויק בעברית על בסיס הנתונים הבאים:

            מרכיבים זמינים: ${ingredients}
            מטרה תזונתית: ${nutritionalGoal}

            דרישות למתכון:
            1. השתמש רק במרכיבים שצוינו או במרכיבים בסיסיים נפוצים (מלח, פלפל, שמן זית וכו')
            2. ודא שהמתכון תואם למטרה התזונתית שנבחרה:
               - "ארוחה מאוזנת": יחס מאוזן של חלבון, פחמימות ושומנים בריאים
               - "חיטוב": דגש על חלבון גבוה וקלוריות נמוכות יחסית
               - "עלייה במסה": דגש על קלוריות גבוהות וחלבון
               - "שמירה על המשקל": מתכון מאוזן עם כמות קלוריות בינונית
            3. תן כמויות מדויקות לכל מרכיב
            4. פרט הוראות הכנה צעד אחר צעד, ממוספרות
            5. חשב ערכים תזונתיים מדויקים על בסיס המרכיבים והכמויות

            חשוב מאוד: החזר את התשובה בפורמט JSON עם המבנה הבא בדיוק. השתמש בשמות השדות באנגלית בלבד:
            {
              "name": "שם המתכון בעברית",
              "category": "ארוחות עיקריות" או "נשנושים בריאים" וכו',
              "ingredients": ["מרכיב 1 - כמות", "מרכיב 2 - כמות", ...],
              "instructions": "הוראות הכנה מפורטות",
              "prep_time": מספר_דקות,
              "servings": מספר_מנות,
              "calories_per_serving": מספר_קלוריות,
              "protein_grams": מספר_גרם,
              "carbs_grams": מספר_גרם,
              "fat_grams": מספר_גרם,
              "difficulty": "קל" או "בינוני" או "קשה",
              "equipment": "ציוד נדרש",
              "tips": "טיפים"
            }

            החזר רק את ה-JSON, ללא טקסט נוסף לפני או אחרי. כל המפתחות (keys) חייבים להיות באנגלית.
        `;

        try {
            let recipeData = await InvokeLLM({
                prompt,
                response_json_schema: jsonSchema
            });

            console.log('Recipe data received:', recipeData);

            // Handle nested structure (e.g., {recipe: {...}})
            if (recipeData.recipe && !recipeData.name) {
                recipeData = recipeData.recipe;
            }

            // Handle ingredients that might be objects instead of strings
            if (recipeData.ingredients && Array.isArray(recipeData.ingredients)) {
                recipeData.ingredients = recipeData.ingredients.map(ing => {
                    if (typeof ing === 'string') {
                        return ing;
                    } else if (ing && typeof ing === 'object') {
                        // Handle object format like {name: "potato", amount: "200", unit: "grams"}
                        const name = ing.name || ing.שם || '';
                        const amount = ing.amount || ing.כמות || '';
                        const unit = ing.unit || ing.יחידה || '';
                        return amount && unit ? `${name} - ${amount} ${unit}` : name;
                    }
                    return String(ing);
                });
            }

            // Validate required fields
            if (!recipeData.name || !recipeData.ingredients || !Array.isArray(recipeData.ingredients)) {
                console.error('Invalid recipe structure:', recipeData);
                throw new Error('AI response is missing required fields. Please try again.');
            }

            setGeneratedRecipe(recipeData);
            setIsLoading(false);

            // Generate image (optional - don't fail if it errors)
            setIsGeneratingImage(true);
            try {
                const imagePrompt = `A beautiful, delicious-looking plate of ${recipeData.name}. Professional food photography, high quality, studio lighting, appetizing. The dish is ${recipeData.category}.`;
                const imageResult = await GenerateImage({ prompt: imagePrompt });
                if (imageResult && imageResult.url) {
                    setGeneratedRecipe(prev => ({ ...prev, image_url: imageResult.url }));
                }
            } catch (imageError) {
                console.warn('Image generation failed (optional feature):', imageError);
                // Don't show error to user - image is optional
            } finally {
                setIsGeneratingImage(false);
            }

        } catch (err) {
            console.error('Error generating recipe:', err);
            setError(err.message || 'שגיאה ביצירת המתכון. נסה שוב או שנה את הפרמטרים.');
            setIsLoading(false);
            setIsGeneratingImage(false);
        }
    };
    
    const handleSaveRecipe = async () => {
        if (!generatedRecipe || !user) {
            setError("יש להתחבר כדי לשמור מתכונים.");
            return;
        }
        setIsSaving(true);
        try {
            await Recipe.create({
                ...generatedRecipe,
                tags: [nutritionalGoal],
                creator_email: user.email,
                is_public: false
            });
            alert("המתכון נשמר בהצלחה בספר המתכונים שלך!");
            setGeneratedRecipe(null);
            setIngredients('');
            setNutritionalGoal('');
        } catch (error) {
            console.error("Failed to save recipe:", error);
            setError("שגיאה בשמירת המתכון.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="muscle-glass border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Input Section */}
                    <Card className="p-6 bg-white/80 backdrop-blur-sm border border-purple-200">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label htmlFor="ingredients" className="text-lg font-semibold flex items-center gap-2">
                                    🥬 מרכיבים זמינים <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="ingredients"
                                    value={ingredients}
                                    onChange={(e) => setIngredients(e.target.value)}
                                    placeholder="הכנס מרכיבים זמינים (למשל: טונה, ביצה, חסה, אבוקדו, קינואה, חזה עוף...)"
                                    className="min-h-24 text-base"
                                />
                                <p className="text-sm text-slate-500">
                                    💡 ככל שתפרט יותר מרכיבים, המתכון יהיה מגוון ומעניין יותר
                                </p>
                            </div>
                            
                            <div className="space-y-3">
                                <Label htmlFor="nutritionalGoal" className="text-lg font-semibold flex items-center gap-2">
                                    🎯 מטרה תזונתית <span className="text-red-500">*</span>
                                </Label>
                                <Select onValueChange={setNutritionalGoal} value={nutritionalGoal}>
                                    <SelectTrigger id="nutritionalGoal" className="text-base h-12">
                                        <SelectValue placeholder="בחר מטרה תזונתית..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ארוחה מאוזנת">⚖️ ארוחה מאוזנת</SelectItem>
                                        <SelectItem value="חיטוב">🔥 חיטוב</SelectItem>
                                        <SelectItem value="עלייה במסה">💪 עלייה במסה</SelectItem>
                                        <SelectItem value="שמירה על המשקל">📊 שמירה על המשירות</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <Button 
                                onClick={handleGenerateRecipe} 
                                disabled={isLoading || !ingredients.trim() || !nutritionalGoal} 
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white h-14 text-lg font-semibold"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2 h-6 w-6" />
                                        מכין מתכון חכם...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-6 w-6" />
                                        צור מתכון חכם
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>

                    {/* Generated Recipe Display */}
                    <div className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertTitle>שגיאה</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {generatedRecipe ? (
                            <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-2xl text-green-800 flex items-center gap-2">
                                                <ChefHat className="w-7 h-7" />
                                                {generatedRecipe.name}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-2 mt-2">
                                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                                    {generatedRecipe.category}
                                                </Badge>
                                                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                                    {nutritionalGoal}
                                                </Badge>
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="relative w-full h-56 bg-slate-200 rounded-lg overflow-hidden mt-4">
                                        {isGeneratingImage ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                                <p>יוצר תמונה ייחודית...</p>
                                            </div>
                                        ) : generatedRecipe.image_url ? (
                                            <img src={generatedRecipe.image_url} alt={generatedRecipe.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-100">
                                                <ImageIcon className="w-12 h-12" />
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4 p-4 bg-white/60 rounded-lg">
                                        <div className="text-center">
                                            <Clock className="w-5 h-5 mx-auto mb-1 text-green-600" />
                                            <p className="text-sm font-medium">{generatedRecipe.prep_time} דק'</p>
                                        </div>
                                        <div className="text-center">
                                            <Users className="w-5 h-5 mx-auto mb-1 text-green-600" />
                                            <p className="text-sm font-medium">{generatedRecipe.servings} מנות</p>
                                        </div>
                                        <div className="text-center">
                                            <Target className="w-5 h-5 mx-auto mb-1 text-green-600" />
                                            <p className="text-sm font-medium">{generatedRecipe.difficulty}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white/60 rounded-lg p-4">
                                        <h4 className="font-semibold mb-3 text-green-800">📊 מידע תזונתי (למנה)</h4>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <span><strong>קלוריות:</strong> {generatedRecipe.calories_per_serving}</span>
                                            <span><strong>חלבון:</strong> {generatedRecipe.protein_grams}g</span>
                                            <span><strong>פחמימות:</strong> {generatedRecipe.carbs_grams}g</span>
                                            <span><strong>שומן:</strong> {generatedRecipe.fat_grams}g</span>
                                        </div>
                                    </div>

                                    <div className="bg-white/60 rounded-lg p-4">
                                        <h4 className="font-semibold mb-3 text-green-800">🥣 מרכיבים</h4>
                                        <ul className="list-disc list-inside text-sm space-y-1">
                                            {generatedRecipe.ingredients && Array.isArray(generatedRecipe.ingredients) 
                                                ? generatedRecipe.ingredients.map((ingredient, i) => (
                                                    <li key={i}>{typeof ingredient === 'string' ? ingredient : JSON.stringify(ingredient)}</li>
                                                ))
                                                : <li>אין מרכיבים זמינים</li>
                                            }
                                        </ul>
                                    </div>

                                    <div className="bg-white/60 rounded-lg p-4">
                                        <h4 className="font-semibold mb-3 text-green-800">👨‍🍳 הוראות הכנה</h4>
                                        <div className="text-sm whitespace-pre-wrap">{generatedRecipe.instructions}</div>
                                    </div>

                                    {generatedRecipe.equipment && (
                                        <div className="bg-white/60 rounded-lg p-4">
                                            <h4 className="font-semibold mb-2 text-green-800">🛠 ציוד דרוש</h4>
                                            <p className="text-sm">{generatedRecipe.equipment}</p>
                                        </div>
                                    )}

                                    {generatedRecipe.tips && (
                                        <div className="bg-white/60 rounded-lg p-4">
                                            <h4 className="font-semibold mb-2 text-green-800">💡 טיפים</h4>
                                            <p className="text-sm">{generatedRecipe.tips}</p>
                                        </div>
                                    )}
                                    
                                    <Button 
                                        onClick={handleSaveRecipe} 
                                        disabled={isSaving || isGeneratingImage || !user} // Disable if no user
                                        className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-lg font-semibold"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                                                שומר...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-5 w-5" />
                                                💾 שמור בספר המתכונים שלי
                                            </>
                                        )}
                                    </Button>
                                    {isGeneratingImage && <p className="text-center text-sm text-slate-500 mt-2">אנא המתן לסיום יצירת התמונה לפני השמירה.</p>}
                                    {!user && <p className="text-center text-red-500 text-sm mt-2">יש להתחבר כדי לשמור מתכונים.</p>}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="bg-white/50 border-dashed border-2 border-slate-300">
                                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                    <ChefHat className="w-20 h-20 text-slate-400 mb-4" />
                                    <h3 className="text-xl font-semibold text-slate-600 mb-2">מוכנים ליצור?</h3>
                                    <p className="text-slate-500 text-base">
                                        הזינו מרכיבים, בחרו מטרה, וה-AI<br />יכין לכם מתכון מדהים ומותאם אישית!
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
