import React, { useState, useEffect } from 'react';
import { User, CoachMenu } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UploadCloud, CheckCircle, ChefHat, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function UploadCoachMenu() {
  const [file, setFile] = useState(null);
  const [instructions, setInstructions] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [recentMenus, setRecentMenus] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const users = await User.list();
            setAllUsers(users.filter(u => u.role !== 'admin' && u.role !== 'coach')); // Don't show admins/coaches
            
            // Load recent menus for display
            const menus = await CoachMenu.list();
            setRecentMenus(menus.slice(0, 5)); // Show last 5 uploads
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };
    fetchData();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setSuccessMessage("");
  };

  const handleUpload = async () => {
    if (!file) {
      alert("יש לבחור קובץ להעלאה.");
      return;
    }
    if (!selectedUserEmail) {
        alert("יש לבחור מתאמן מהרשימה.");
        return;
    }

    setIsUploading(true);
    setSuccessMessage("");
    try {
      const { file_url } = await UploadFile({ file });

      const menuData = {
        user_email: selectedUserEmail,
        upload_date: format(new Date(), "yyyy-MM-dd"),
        menu_file_url: file_url,
        instructions: instructions.trim() || null
      };

      await CoachMenu.create(menuData);
      
      const selectedUserName = allUsers.find(u => u.email === selectedUserEmail)?.name || selectedUserEmail;
      setSuccessMessage(`התפריט הועלה ונקשר ל${selectedUserName} בהצלחה!`);
      
      // Reset form
      setFile(null);
      setInstructions("");
      setSelectedUserEmail("");
      if (document.getElementById('menu-file-input')) {
        document.getElementById('menu-file-input').value = "";
      }

      // Refresh recent menus
      const menus = await CoachMenu.list();
      setRecentMenus(menus.slice(0, 5));

    } catch (error) {
      console.error("Error uploading menu:", error);
      alert("אירעה שגיאה בהעלאת התפריט.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="muscle-glass border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <ChefHat className="w-6 h-6 text-green-600" />
            העלאת תפריט תזונה למתאמן
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-select-menu">בחר מתאמן</Label>
            <Select onValueChange={setSelectedUserEmail} value={selectedUserEmail}>
                <SelectTrigger id="user-select-menu">
                    <SelectValue placeholder="בחר מתאמן..." />
                </SelectTrigger>
                <SelectContent>
                    {allUsers.map(user => (
                        <SelectItem key={user.id} value={user.email}>
                            {user.name || user.email}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="menu-file-input" className="font-semibold text-slate-700">
              העלאת קובץ תפריט (תמונה או PDF)
            </Label>
            <Input 
              id="menu-file-input"
              type="file" 
              accept="image/*,.pdf" 
              onChange={handleFileChange} 
              disabled={isUploading} 
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            {file && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                נבחר: {file.name}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="instructions">הנחיות נלוות לתפריט</Label>
            <Textarea
              id="instructions"
              placeholder="כתוב כאן הנחיות כלליות, דגשים, או כל מידע רלוונטי לתפריט...

לדוגמה:
• יש לשלב חלבון בכל ארוחה
• לצמצם מתוקים
• להקפיד על שתיית מים"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={isUploading}
              className="h-32 resize-none"
            />
          </div>
          
          <Button 
            onClick={handleUpload} 
            disabled={isUploading || !file || !selectedUserEmail} 
            className="w-full muscle-primary-gradient text-white hover:shadow-lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                מעלה תפריט...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                העלה וקשר למתאמן
              </>
            )}
          </Button>
          
          {successMessage && (
            <div className="flex items-center gap-2 text-sm text-green-600 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="w-5 h-5" />
              {successMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Uploads Display */}
      {Array.isArray(recentMenus) && recentMenus.length > 0 && (
        <Card className="muscle-glass border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              <Calendar className="w-5 h-5 text-blue-600" />
              תפריטים שהועלו לאחרונה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMenus.map((menu, index) => {
                const user = allUsers.find(u => u.email === menu.user_email);
                return (
                  <div key={menu.id || index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-slate-700">
                        {user?.name || menu.user_email}
                      </p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(menu.upload_date), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(menu.menu_file_url, '_blank')}
                    >
                      צפה
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}