
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import NetworkErrorDisplay from '../components/errors/NetworkErrorDisplay';
import WelcomeModal from '../components/auth/WelcomeModal';
import { cn } from '@/lib/utils';

export default function CompleteProfile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [networkError, setNetworkError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [coaches, setCoaches] = useState([]);
    const [isLoadingCoaches, setIsLoadingCoaches] = useState(false);
    const [isCoachPickerOpen, setIsCoachPickerOpen] = useState(false);
    const [selectedCoach, setSelectedCoach] = useState(null);
    
    const [formData, setFormData] = useState({
        name: '',
        gender: '',
        birth_date: '',
        height: '',
        initial_weight: '',
        coach_name: '',
        coach_email: '',
        coach_phone: ''
    });

    useEffect(() => {
        const loadCoaches = async () => {
            setIsLoadingCoaches(true);
            try {
                const allUsers = await User.list();
                const adminUsers = allUsers.filter(u => (u.role === 'admin' || u.role === 'coach') && u.email && u.name);
                setCoaches(adminUsers);
            } catch (error) {
                console.error('Error loading coaches:', error);
            } finally {
                setIsLoadingCoaches(false);
            }
        };
        loadCoaches();
    }, []);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);

                // Check if profile is incomplete
                const isProfileIncomplete = !currentUser.name || !currentUser.gender || !currentUser.birth_date || !currentUser.height || !currentUser.initial_weight || !currentUser.coach_name || !currentUser.coach_email;

                if (isProfileIncomplete) {
                    // Show welcome modal for first-time users
                    console.log('Profile incomplete, showing welcome modal');
                    setShowWelcomeModal(true);
                    
                    // Initialize form with existing data
                    const coachData = {
                        coach_name: currentUser.coach_name || '',
                        coach_email: currentUser.coach_email || '',
                        coach_phone: currentUser.coach_phone || ''
                    };
                    
                    setFormData({
                        name: currentUser.name || '',
                        gender: currentUser.gender || '',
                        birth_date: currentUser.birth_date ? format(parseISO(currentUser.birth_date), 'yyyy-MM-dd') : '',
                        height: currentUser.height ? (currentUser.height * 100).toFixed(1) : '', // .toFixed(1) to allow decimals
                        initial_weight: currentUser.initial_weight?.toString() || '',
                        ...coachData
                    });
                } else {
                    // If profile is complete, redirect to home or contract
                    const isContractUnsigned = !currentUser.contract_signed;
                    if (isContractUnsigned) {
                        navigate(createPageUrl('Contract'));
                    } else {
                        navigate(createPageUrl('Home'));
                    }
                    return; // Exit early if redirecting
                }
            } catch (error) {
                console.error('Error loading user:', error);
                if (error.message?.includes('Network Error') || !navigator.onLine) {
                    setNetworkError(true);
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadUser();
    }, [navigate]);

    // Set selected coach when coaches are loaded and user has coach email
    useEffect(() => {
        if (coaches.length > 0 && formData.coach_email && !selectedCoach) {
            const foundCoach = coaches.find(c => c.email === formData.coach_email);
            if (foundCoach) {
                setSelectedCoach(foundCoach);
            }
        }
    }, [coaches, formData.coach_email, selectedCoach]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        if (error) setError('');
        if (success) setSuccess('');
    };

    const handleGenderChange = (value) => {
        setFormData(prev => ({ ...prev, gender: value }));
        if (error) setError('');
        if (success) setSuccess('');
    };

    const handleCoachSelect = (coach) => {
        setSelectedCoach(coach);
        setFormData(prev => ({
            ...prev,
            coach_name: coach.name || '',
            coach_email: coach.email || '',
            coach_phone: coach.phone || ''
        }));
        setIsCoachPickerOpen(false);
        if (error) setError('');
        if (success) setSuccess('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        setError('');
        setSuccess('');

        // Validation
        const requiredFields = ['name', 'gender', 'birth_date', 'height', 'initial_weight'];
        const missingFields = requiredFields.filter(field => !formData[field]?.trim());
        
        if (missingFields.length > 0 || !selectedCoach) {
            setError('אנא מלא את כל השדות החובה כולל בחירת מאמן.');
            setIsSaving(false);
            return;
        }

        try {
            const updateData = {
                name: formData.name.trim(),
                gender: formData.gender,
                birth_date: formData.birth_date,
                height: parseFloat(formData.height) / 100, // Convert cm to meters
                initial_weight: parseFloat(formData.initial_weight),
                coach_name: formData.coach_name.trim(),
                coach_email: formData.coach_email.trim(),
                coach_phone: formData.coach_phone.trim(),
                start_date: new Date().toISOString().split('T')[0]
            };

            await User.updateMyUserData(updateData);
            
            // Show success message briefly, then navigate
            setSuccess('הפרופיל עודכן בהצלחה!');
            setIsNavigating(true);
            
            // Navigate after a short delay to show success message
            // Keep spinner visible during navigation
            setTimeout(() => {
                navigate(createPageUrl('Contract'));
            }, 600);
            
        } catch (error) {
            console.error('Error updating profile:', error);
            setError('שגיאה בשמירת הפרופיל. אנא נסה שוב.');
            setIsSaving(false);
            setIsNavigating(false);
        }
    };

    const handleWelcomeModalClose = () => {
        setShowWelcomeModal(false);
    };

    const retryLoad = () => {
        setNetworkError(false);
        window.location.reload();
    };

    if (networkError) {
        return <NetworkErrorDisplay onRetry={retryLoad} />;
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50" dir="rtl">
                <div className="relative">
                    <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d04615afd_.png"
                        alt="טוען..."
                        className="w-20 h-20 rounded-2xl object-contain animate-pulse"
                    />
                    <div className="absolute -inset-1 w-22 h-22 rounded-full border-4 border-blue-300 border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50 p-4" dir="rtl">
            {/* Welcome Modal */}
            <WelcomeModal 
                isOpen={showWelcomeModal} 
                onClose={handleWelcomeModalClose}
                user={user}
            />
            
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d04615afd_.png"
                        alt="MUSCLE UP YAVNE"
                        className="w-16 h-16 rounded-2xl object-contain mx-auto mb-4"
                    />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-yellow-500 to-blue-500 bg-clip-text text-transparent">
                        השלמת פרופיל אישי
                    </h1>
                    <p className="text-slate-600 mt-2">
                        בואו נכיר אותך טוב יותר כדי להתאים לך את החוויה הטובה ביותר
                    </p>
                </div>

                <Card className="muscle-glass border-0 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-center text-xl">פרטים אישיים</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
                        {success && <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Personal Information Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">מידע אישי</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">שם מלא <span className="text-red-500">*</span></Label>
                                        <Input 
                                            id="name" 
                                            type="text" 
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                            autoComplete="name"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="gender">מין <span className="text-red-500">*</span></Label>
                                        <Select value={formData.gender} onValueChange={handleGenderChange} disabled={isSaving}>
                                            <SelectTrigger><SelectValue placeholder="בחר מין" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="male">גבר</SelectItem>
                                                <SelectItem value="female">אישה</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="birth_date">תאריך לידה <span className="text-red-500">*</span></Label>
                                        <Input 
                                            id="birth_date" 
                                            type="date" 
                                            value={formData.birth_date}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="height">גובה (ס"מ) <span className="text-red-500">*</span></Label>
                                        <Input 
                                            id="height" 
                                            type="text" 
                                            inputMode="decimal" 
                                            pattern="[0-9.]*"
                                            value={formData.height}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                            placeholder="170.5" 
                                            autoComplete="off"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="initial_weight">משקל נוכחי (ק"ג) <span className="text-red-500">*</span></Label>
                                        <Input 
                                            id="initial_weight" 
                                            type="text" 
                                            inputMode="decimal" 
                                            pattern="[0-9.]*"
                                            value={formData.initial_weight}
                                            onChange={handleInputChange}
                                            disabled={isSaving}
                                            placeholder="70.2" 
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Coach Information Section */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">פרטי המאמן</h3>
                                
                                <div className="space-y-2">
                                    <Label>בחר מאמן <span className="text-red-500">*</span></Label>
                                    <Popover open={isCoachPickerOpen} onOpenChange={setIsCoachPickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isCoachPickerOpen}
                                                className="w-full justify-between"
                                                disabled={isSaving || isLoadingCoaches}
                                            >
                                                <span className="truncate">
                                                    {selectedCoach 
                                                        ? `${selectedCoach.name} (${selectedCoach.email})`
                                                        : isLoadingCoaches 
                                                        ? "טוען מאמנים..." 
                                                        : "בחר מאמן מהרשימה"}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" dir="rtl">
                                            <Command>
                                                <CommandInput placeholder="חפש מאמן לפי שם או אימייל..." />
                                                <CommandList>
                                                    <CommandEmpty>לא נמצא מאמן.</CommandEmpty>
                                                    <CommandGroup>
                                                        {coaches.map((coach) => (
                                                            <CommandItem
                                                                key={coach.email}
                                                                value={`${coach.name} ${coach.email}`}
                                                                onSelect={() => handleCoachSelect(coach)}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        selectedCoach?.email === coach.email ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{coach.name}</span>
                                                                    <span className="text-xs text-slate-500">{coach.email}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                
                                {selectedCoach && (
                                    <div className="p-3 bg-slate-50 rounded-lg space-y-1 text-sm">
                                        <p><strong>שם:</strong> {formData.coach_name}</p>
                                        <p><strong>אימייל:</strong> {formData.coach_email}</p>
                                        {formData.coach_phone && (
                                            <p><strong>טלפון:</strong> {formData.coach_phone}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <Button 
                                type="submit" 
                                disabled={isSaving || isNavigating}
                                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 px-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                            >
                                {(isSaving || isNavigating) ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        {isNavigating ? 'מעבר לשלב הבא...' : 'שומר פרטים...'}
                                    </>
                                ) : (
                                    'שמור פרטים ומעבר לשלב הבא'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
