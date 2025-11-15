import React, { useState, useEffect } from 'react';
import { User, UserGroup, AdminActionLog } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function RecipePermissions() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [assignMode, setAssignMode] = useState('individual'); // individual or group
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [fetchedUsers, fetchedGroups, adminUser] = await Promise.all([User.list(), UserGroup.list(), User.me()]);
        setUsers(fetchedUsers.filter(u => u.role !== 'admin' && u.role !== 'coach')); // Exclude admins/coaches from this list
        setGroups(fetchedGroups);
        setCurrentUser(adminUser);
      } catch (error) {
        console.error("Error fetching data:", error);
        setStatusMessage('שגיאה בטעינת הנתונים.');
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleAccessChange = async (user, hasAccess) => {
    setUpdatingUserId(user.id);
    setStatusMessage('');
    try {
      await User.update(user.id, { nutrition_access: hasAccess });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, nutrition_access: hasAccess } : u));
      setStatusMessage(`הרשאה עודכנה עבור ${user.name || user.email}`);

      if (currentUser) {
        await AdminActionLog.create({
            admin_email: currentUser.email,
            action_type: 'permission_change',
            target_user_email: user.email,
            action_details: `Recipe access ${hasAccess ? 'granted' : 'revoked'} for ${user.name || user.email}`,
            previous_state: `nutrition_access: ${!hasAccess}`,
            new_state: `nutrition_access: ${hasAccess}`
        });
      }
    } catch (error) {
      console.error(`Error updating access for ${user.email}:`, error);
      setStatusMessage(`שגיאה בעדכון הרשאה עבור ${user.name || user.email}`);
    } finally {
        setUpdatingUserId(null);
    }
  };

  const handleGroupAccessChange = async (hasAccess) => {
    if (!selectedGroupId) {
      setStatusMessage('יש לבחור קבוצה.');
      return;
    }
    setIsLoading(true);
    setStatusMessage('');
    const group = groups.find(g => g.id === selectedGroupId);
    const usersInGroup = users.filter(u => u.group_name === group.name);

    try {
      for (const user of usersInGroup) {
        await User.update(user.id, { nutrition_access: hasAccess });
      }
      
      if (currentUser) {
        await AdminActionLog.create({
            admin_email: currentUser.email,
            action_type: 'permission_change',
            target_user_email: `group: ${group.name}`,
            action_details: `Recipe access ${hasAccess ? 'granted' : 'revoked'} for group "${group.name}" (${usersInGroup.length} users)`,
            previous_state: `nutrition_access: ${!hasAccess}`,
            new_state: `nutrition_access: ${hasAccess}`
        });
      }

      const updatedUsers = await User.list();
      setUsers(updatedUsers.filter(u => u.role !== 'admin' && u.role !== 'coach'));
      setStatusMessage(`ההרשאה למתכונים עודכנה בהצלחה ל-${usersInGroup.length} חברי קבוצת "${group.name}".`);
    } catch (error) {
      console.error('Error updating group access:', error);
      setStatusMessage('שגיאה בעדכון ההרשאה הקבוצתית.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && users.length === 0) {
    return <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        נהל גישה ללשונית המתכונים עבור מתאמנים. מתאמנים שמקבלים גישה לתוכנית הבוסטר מקבלים גישה למתכונים באופן אוטומטי.
      </p>
      <RadioGroup defaultValue="individual" onValueChange={setAssignMode} className="flex gap-4">
          <RadioGroupItem value="individual" id="recipe-individual" />
          <Label htmlFor="recipe-individual">ניהול פרטני</Label>
          <RadioGroupItem value="group" id="recipe-group" />
          <Label htmlFor="recipe-group">ניהול קבוצתי</Label>
      </RadioGroup>

      {assignMode === 'group' && (
        <div className="p-4 border rounded-lg space-y-3 bg-slate-50">
          <h4 className="font-semibold">הענק הרשאת מתכונים לקבוצה שלמה</h4>
          <Select onValueChange={setSelectedGroupId}>
              <SelectTrigger><SelectValue placeholder="בחר קבוצה..." /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
              <Button onClick={() => handleGroupAccessChange(true)} disabled={isLoading || !selectedGroupId} className="bg-green-600 hover:bg-green-700 text-white">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'הענק גישה'}
              </Button>
              <Button onClick={() => handleGroupAccessChange(false)} disabled={isLoading || !selectedGroupId} variant="destructive">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'בטל גישה'}
              </Button>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="flex items-center gap-2 text-sm text-green-600 p-2 bg-green-50 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          {statusMessage}
        </div>
      )}

      {assignMode === 'individual' && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
              <Label htmlFor={`access-${user.id}`} className="flex-1 cursor-pointer">
                {user.name || user.email}
                {user.group_name && <span className="text-xs text-blue-500 mr-2">({user.group_name})</span>}
              </Label>
              <div className="flex items-center gap-2">
                {updatingUserId === user.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                <Switch
                  id={`access-${user.id}`}
                  checked={!!user.nutrition_access}
                  onCheckedChange={(checked) => handleAccessChange(user, checked)}
                  disabled={updatingUserId === user.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}