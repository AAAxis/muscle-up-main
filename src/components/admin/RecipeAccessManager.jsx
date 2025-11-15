import React, { useState, useEffect } from 'react';
import { Recipe, User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadFile } from '@/api/integrations';
import { 
  Users, 
  ChefHat, 
  Lock, 
  Unlock, 
  Search, 
  Loader2, 
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

export default function RecipeAccessManager() {
  const [recipes, setRecipes] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Recipe Management States
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    category: 'ארוחות עיקריות',
    ingredients: [],
    instructions: '',
    prep_time: '',
    servings: '',
    calories_per_serving: '',
    protein_grams: '',
    carbs_grams: '',
    fat_grams: '',
    difficulty: 'קל',
    tags: [],
    image_url: '',
    video_url: '',
    equipment: '',
    tips: '',
    is_public: false
  });
  const [newIngredient, setNewIngredient] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recipesData, usersData] = await Promise.all([
        Recipe.list(),
        User.list()
      ]);
      setRecipes(recipesData);
      setUsers(usersData.filter(u => u.role !== 'admin' && u.role !== 'coach'));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecipeAccess = async (recipeId, currentStatus) => {
    try {
      await Recipe.update(recipeId, { is_public: !currentStatus });
      await loadData();
    } catch (error) {
      console.error('Error updating recipe access:', error);
      alert('שגיאה בעדכון הגישה למתכון');
    }
  };

  // Recipe Management Functions
  const handleOpenRecipeDialog = (recipe = null) => {
    if (recipe) {
      setEditingRecipe(recipe);
      setRecipeForm({
        name: recipe.name || '',
        category: recipe.category || 'ארוחות עיקריות',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || '',
        prep_time: recipe.prep_time?.toString() || '',
        servings: recipe.servings?.toString() || '',
        calories_per_serving: recipe.calories_per_serving?.toString() || '',
        protein_grams: recipe.protein_grams?.toString() || '',
        carbs_grams: recipe.carbs_grams?.toString() || '',
        fat_grams: recipe.fat_grams?.toString() || '',
        difficulty: recipe.difficulty || 'קל',
        tags: recipe.tags || [],
        image_url: recipe.image_url || '',
        video_url: recipe.video_url || '',
        equipment: recipe.equipment || '',
        tips: recipe.tips || '',
        is_public: recipe.is_public || false
      });
    } else {
      setEditingRecipe(null);
      setRecipeForm({
        name: '',
        category: 'ארוחות עיקריות',
        ingredients: [],
        instructions: '',
        prep_time: '',
        servings: '',
        calories_per_serving: '',
        protein_grams: '',
        carbs_grams: '',
        fat_grams: '',
        difficulty: 'קל',
        tags: [],
        image_url: '',
        video_url: '',
        equipment: '',
        tips: '',
        is_public: false
      });
    }
    setIsRecipeDialogOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const { file_url } = await UploadFile({ file });
      setRecipeForm(prev => ({ ...prev, image_url: file_url }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('שגיאה בהעלאת התמונה');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setRecipeForm(prev => ({
        ...prev,
        ingredients: [...prev.ingredients, newIngredient.trim()]
      }));
      setNewIngredient('');
    }
  };

  const handleRemoveIngredient = (index) => {
    setRecipeForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setRecipeForm(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (index) => {
    setRecipeForm(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const handleSaveRecipe = async () => {
    if (!recipeForm.name.trim()) {
      alert('יש להזין שם למתכון');
      return;
    }

    if (recipeForm.ingredients.length === 0) {
      alert('יש להוסיף לפחות מרכיב אחד');
      return;
    }

    if (!recipeForm.instructions.trim()) {
      alert('יש להזין הוראות הכנה');
      return;
    }

    setIsSavingRecipe(true);
    try {
      const recipeData = {
        name: recipeForm.name.trim(),
        category: recipeForm.category,
        ingredients: recipeForm.ingredients,
        instructions: recipeForm.instructions.trim(),
        prep_time: recipeForm.prep_time ? parseInt(recipeForm.prep_time) : null,
        servings: recipeForm.servings ? parseInt(recipeForm.servings) : null,
        calories_per_serving: recipeForm.calories_per_serving ? parseInt(recipeForm.calories_per_serving) : null,
        protein_grams: recipeForm.protein_grams ? parseFloat(recipeForm.protein_grams) : null,
        carbs_grams: recipeForm.carbs_grams ? parseFloat(recipeForm.carbs_grams) : null,
        fat_grams: recipeForm.fat_grams ? parseFloat(recipeForm.fat_grams) : null,
        difficulty: recipeForm.difficulty,
        tags: recipeForm.tags,
        image_url: recipeForm.image_url || null,
        video_url: recipeForm.video_url || null,
        equipment: recipeForm.equipment || null,
        tips: recipeForm.tips || null,
        is_public: recipeForm.is_public
      };

      if (editingRecipe) {
        await Recipe.update(editingRecipe.id, recipeData);
        alert('המתכון עודכן בהצלחה!');
      } else {
        await Recipe.create(recipeData);
        alert('המתכון נוצר בהצלחה!');
      }

      await loadData();
      setIsRecipeDialogOpen(false);
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('שגיאה בשמירת המתכון');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const handleDeleteRecipe = async (recipeId, recipeName) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המתכון "${recipeName}"? פעולה זו אינה ניתנת לשחזור.`)) {
      return;
    }

    try {
      await Recipe.delete(recipeId);
      alert('המתכון נמחק בהצלחה');
      await loadData();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('שגיאה במחיקת המתכון');
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recipe.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 ml-2" />
          <span>טוען נתונים...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="access" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            בקרת גישה
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <ChefHat className="w-4 h-4" />
            ניהול מתכונים
          </TabsTrigger>
        </TabsList>

        {/* Access Control Tab */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                בקרת גישה למתכונים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="חיפוש מתכון..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-800">
                  💡 <strong>מתכונים ציבוריים</strong> - נגישים לכל המשתמשים
                </p>
                <p className="text-blue-800">
                  🔒 <strong>מתכונים פרטיים</strong> - נגישים רק למי שיצר אותם
                </p>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredRecipes.map(recipe => (
                    <div
                      key={recipe.id}
                      className="p-4 border rounded-lg bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-slate-800">{recipe.name}</h3>
                            <Badge variant={recipe.is_public ? "default" : "secondary"}>
                              {recipe.is_public ? 'ציבורי' : 'פרטי'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600">{recipe.category}</p>
                          {recipe.creator_email && (
                            <p className="text-xs text-slate-500 mt-1">
                              נוצר על ידי: {recipe.creator_email}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleRecipeAccess(recipe.id, recipe.is_public)}
                          className="flex items-center gap-2"
                        >
                          {recipe.is_public ? (
                            <>
                              <Lock className="w-4 h-4" />
                              הפוך לפרטי
                            </>
                          ) : (
                            <>
                              <Unlock className="w-4 h-4" />
                              הפוך לציבורי
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  <strong>סה"כ מתכונים:</strong> {recipes.length}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>ציבוריים:</strong> {recipes.filter(r => r.is_public).length}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>פרטיים:</strong> {recipes.filter(r => !r.is_public).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recipe Management Tab */}
        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5" />
                  ניהול מתכונים
                </CardTitle>
                <Button onClick={() => handleOpenRecipeDialog()} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  הוסף מתכון חדש
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="חיפוש מתכון..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>

              <ScrollArea className="h-[500px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRecipes.map(recipe => (
                    <Card key={recipe.id} className="overflow-hidden">
                      {recipe.image_url && (
                        <div className="h-48 bg-slate-200 overflow-hidden">
                          <img
                            src={recipe.image_url}
                            alt={recipe.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-800">{recipe.name}</h3>
                          <Badge variant={recipe.is_public ? "default" : "secondary"}>
                            {recipe.is_public ? 'ציבורי' : 'פרטי'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{recipe.category}</p>
                        <div className="flex gap-2 text-xs text-slate-500 mb-3">
                          {recipe.prep_time && <span>⏱️ {recipe.prep_time} דק'</span>}
                          {recipe.servings && <span>👥 {recipe.servings} מנות</span>}
                          {recipe.calories_per_serving && <span>🔥 {recipe.calories_per_serving} קק"ל</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRecipeDialog(recipe)}
                            className="flex-1"
                          >
                            <Edit className="w-4 h-4 ml-1" />
                            ערוך
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recipe Dialog */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe ? 'עריכת מתכון' : 'הוספת מתכון חדש'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>שם המתכון <span className="text-red-500">*</span></Label>
                <Input
                  value={recipeForm.name}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="לדוגמה: סלט קינואה עם ירקות"
                />
              </div>

              <div>
                <Label>קטגוריה <span className="text-red-500">*</span></Label>
                <Select
                  value={recipeForm.category}
                  onValueChange={(value) => setRecipeForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ארוחות עיקריות">ארוחות עיקריות</SelectItem>
                    <SelectItem value="נשנושים בריאים">נשנושים בריאים</SelectItem>
                    <SelectItem value="שייקים וחטיפי חלבון">שייקים וחטיפי חלבון</SelectItem>
                    <SelectItem value="תוספות וסלטים">תוספות וסלטים</SelectItem>
                    <SelectItem value="תפריטים לפי מטרה">תפריטים לפי מטרה</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>רמת קושי</Label>
                <Select
                  value={recipeForm.difficulty}
                  onValueChange={(value) => setRecipeForm(prev => ({ ...prev, difficulty: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="קל">קל</SelectItem>
                    <SelectItem value="בינוני">בינוני</SelectItem>
                    <SelectItem value="קשה">קשה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <Label>תמונת המתכון</Label>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploadingImage}
                  />
                </div>
                {recipeForm.image_url && (
                  <img
                    src={recipeForm.image_url}
                    alt="תצוגה מקדימה"
                    className="w-24 h-24 object-cover rounded-lg border"
                  />
                )}
              </div>
              {isUploadingImage && (
                <p className="text-sm text-blue-600 mt-1">מעלה תמונה...</p>
              )}
            </div>

            {/* Ingredients */}
            <div>
              <Label>מרכיבים <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
                  placeholder="הוסף מרכיב..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIngredient())}
                />
                <Button onClick={handleAddIngredient} type="button">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {recipeForm.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                    <span className="text-sm">{ingredient}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveIngredient(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <Label>הוראות הכנה <span className="text-red-500">*</span></Label>
              <Textarea
                value={recipeForm.instructions}
                onChange={(e) => setRecipeForm(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="תאר את שלבי ההכנה..."
                rows={6}
              />
            </div>

            {/* Nutrition & Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>זמן הכנה (דקות)</Label>
                <Input
                  type="number"
                  value={recipeForm.prep_time}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, prep_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>מספר מנות</Label>
                <Input
                  type="number"
                  value={recipeForm.servings}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, servings: e.target.value }))}
                />
              </div>
              <div>
                <Label>קלוריות למנה</Label>
                <Input
                  type="number"
                  value={recipeForm.calories_per_serving}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, calories_per_serving: e.target.value }))}
                />
              </div>
              <div>
                <Label>חלבון (גרם)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={recipeForm.protein_grams}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, protein_grams: e.target.value }))}
                />
              </div>
              <div>
                <Label>פחמימות (גרם)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={recipeForm.carbs_grams}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, carbs_grams: e.target.value }))}
                />
              </div>
              <div>
                <Label>שומן (גרם)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={recipeForm.fat_grams}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, fat_grams: e.target.value }))}
                />
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <div>
                <Label>ציוד נדרש</Label>
                <Input
                  value={recipeForm.equipment}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, equipment: e.target.value }))}
                  placeholder="לדוגמה: בלנדר, תנור, מחבת..."
                />
              </div>

              <div>
                <Label>טיפים והערות</Label>
                <Textarea
                  value={recipeForm.tips}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, tips: e.target.value }))}
                  placeholder="טיפים נוספים להכנה..."
                  rows={3}
                />
              </div>

              <div>
                <Label>קישור לסרטון הדגמה</Label>
                <Input
                  value={recipeForm.video_url}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, video_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              {/* Tags */}
              <div>
                <Label>תגיות</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="הוסף תגית (טבעוני, ללא גלוטן...)"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <Button onClick={handleAddTag} type="button">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipeForm.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(index)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Public Access */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={recipeForm.is_public}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, is_public: e.target.checked }))}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_public" className="cursor-pointer">
                  הפוך את המתכון לציבורי (נגיש לכל המשתמשים)
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRecipeDialogOpen(false)}
              disabled={isSavingRecipe}
            >
              ביטול
            </Button>
            <Button
              onClick={handleSaveRecipe}
              disabled={isSavingRecipe}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSavingRecipe ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 ml-2" />
                  {editingRecipe ? 'עדכן מתכון' : 'צור מתכון'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}