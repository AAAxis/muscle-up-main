
import React, { useState, useEffect } from 'react';
import { User, WeightEntry } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { calculateBMI, getBMICategory } from '../common/SafeDataHandler';

export default function UserWeightUpdate() {
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        weight: '',
        fat_percentage: '',
        muscle_mass: '',
        chest_circumference: '',
        waist_circumference: '',
        hip_circumference: '',
        thigh_circumference_right: '',
        thigh_circumference_left: '',
        calf_circumference_right: '',
        calf_circumference_left: '',
        bicep_circumference_right: '',
        bicep_circumference_left: '',
        notes: ''
    });
    const [status, setStatus] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const loadUsers = async () => {
            setStatus('loading');
            try {
                const allUsers = await User.list();
                setUsers(allUsers.filter(u => u.role !== 'admin' && u.role !== 'coach'));
                setStatus('');
            } catch (err) {
                setStatus('error');
                setStatusMessage('שגיאה בטעינת משתמשים.');
                console.error(err);
            }
        };
        loadUsers();
    }, []);
    
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleUserChange = (userId) => {
        setSelectedUserId(userId);
        setFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            weight: '', fat_percentage: '', muscle_mass: '',
            chest_circumference: '', waist_circumference: '', hip_circumference: '',
            thigh_circumference_right: '', thigh_circumference_left: '',
            calf_circumference_right: '', calf_circumference_left: '',
            bicep_circumference_right: '', bicep_circumference_left: '',
            notes: ''
        });
        setStatus('');
        setStatusMessage('');
    };

    const handleSaveMeasurement = async () => {
        if (!selectedUserId || !formData.weight || !formData.date) {
            setStatus('error');
            setStatusMessage('יש לבחור מתאמן ולמלא תאריך ומשקל.');
            return;
        }

        setStatus('saving');
        setStatusMessage('שומר מדידה...');

        try {
            const selectedUser = users.find(u => u.id === selectedUserId);
            if (!selectedUser) throw new Error('User not found');

            const height = selectedUser.height;
            const weightValue = parseFloat(formData.weight);
            
            const bmi = calculateBMI(weightValue, height);
            const bmiInfo = getBMICategory(bmi);

            const measurementData = {
                user_email: selectedUser.email,
                date: formData.date,
                weight: weightValue,
                height: height,
                bmi: bmi,
                bmi_category: bmiInfo.label,
                bmi_alert: !!(bmi && (bmi < 18.5 || bmi >= 30)),
                fat_percentage: formData.fat_percentage ? parseFloat(formData.fat_percentage) : null,
                muscle_mass: formData.muscle_mass ? parseFloat(formData.muscle_mass) : null,
                chest_circumference: formData.chest_circumference ? parseFloat(formData.chest_circumference) : null,
                waist_circumference: formData.waist_circumference ? parseFloat(formData.waist_circumference) : null,
                hip_circumference: formData.hip_circumference ? parseFloat(formData.hip_circumference) : null,
                thigh_circumference_right: formData.thigh_circumference_right ? parseFloat(formData.thigh_circumference_right) : null,
                thigh_circumference_left: formData.thigh_circumference_left ? parseFloat(formData.thigh_circumference_left) : null,
                calf_circumference_right: formData.calf_circumference_right ? parseFloat(formData.calf_circumference_right) : null,
                calf_circumference_left: formData.calf_circumference_left ? parseFloat(formData.calf_circumference_left) : null,
                bicep_circumference_right: formData.bicep_circumference_right ? parseFloat(formData.bicep_circumference_right) : null,
                bicep_circumference_left: formData.bicep_circumference_left ? parseFloat(formData.bicep_circumference_left) : null,
                notes: formData.notes,
            };

            await WeightEntry.create(measurementData);
            await User.update(selectedUser.id, { current_weight: weightValue });

            setStatus('success');
            setStatusMessage('המדידה נשמרה בהצלחה!');
            setTimeout(() => { setStatus(''); setStatusMessage(''); }, 3000);

        } catch (error) {
            console.error("Failed to save measurement:", error);
            setStatus('error');
            setStatusMessage('שגיאה בשמירת המדידה. בדוק את המסוף לפרטים.');
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Scale className="w-5 h-5"/> עדכון מדידות גוף למתאמן</CardTitle>
                <CardDescription>בחר מתאמן והזן את המדידות העדכניות שלו.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="user-select">בחר מתאמן</Label>
                    <Select onValueChange={handleUserChange} value={selectedUserId}>
                        <SelectTrigger id="user-select">
                            <SelectValue placeholder="בחר מתאמן..." />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>{user.name || user.email}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedUserId && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="weight">משקל נוכחי (ק"ג) *</Label>
                                <Input id="weight" type="number" value={formData.weight} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">תאריך מדידה *</Label>
                                <Input id="date" type="date" value={formData.date} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fat_percentage">אחוז שומן (%)</Label>
                                <Input id="fat_percentage" type="number" value={formData.fat_percentage} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="muscle_mass">מסת שריר (ק"ג)</Label>
                                <Input id="muscle_mass" type="number" value={formData.muscle_mass} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="chest_circumference">חזה (ס"מ)</Label>
                                <Input id="chest_circumference" type="number" value={formData.chest_circumference} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="waist_circumference">מותן (ס"מ)</Label>
                                <Input id="waist_circumference" type="number" value={formData.waist_circumference} onChange={handleInputChange} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="hip_circumference">ירכיים (ס"מ)</Label>
                                <Input id="hip_circumference" type="number" value={formData.hip_circumference} onChange={handleInputChange} />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-2 border rounded-md space-y-2">
                                <Label>ירך (ס"מ)</Label>
                                <div className="flex gap-2">
                                    <Input id="thigh_circumference_right" type="number" placeholder="ימין" value={formData.thigh_circumference_right} onChange={handleInputChange}/>
                                    <Input id="thigh_circumference_left" type="number" placeholder="שמאל" value={formData.thigh_circumference_left} onChange={handleInputChange}/>
                                </div>
                            </div>
                            <div className="p-2 border rounded-md space-y-2">
                                <Label>שוק (ס"מ)</Label>
                                <div className="flex gap-2">
                                    <Input id="calf_circumference_right" type="number" placeholder="ימין" value={formData.calf_circumference_right} onChange={handleInputChange}/>
                                    <Input id="calf_circumference_left" type="number" placeholder="שמאל" value={formData.calf_circumference_left} onChange={handleInputChange}/>
                                </div>
                            </div>
                            <div className="p-2 border rounded-md space-y-2">
                                <Label>יד קדמית (ס"מ)</Label>
                                <div className="flex gap-2">
                                    <Input id="bicep_circumference_right" type="number" placeholder="ימין" value={formData.bicep_circumference_right} onChange={handleInputChange}/>
                                    <Input id="bicep_circumference_left" type="number" placeholder="שמאל" value={formData.bicep_circumference_left} onChange={handleInputChange}/>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">הערות נוספות</Label>
                            <Textarea id="notes" value={formData.notes} onChange={handleInputChange} placeholder="הערות על המדידה..."/>
                        </div>
                        
                        <Button onClick={handleSaveMeasurement} disabled={status === 'saving'}>
                            {status === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>שומר...</> : <><Save className="w-4 h-4 mr-2"/>שמור מדידה</>}
                        </Button>
                        
                        {statusMessage && (
                            <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-green-500'}`}>{statusMessage}</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
