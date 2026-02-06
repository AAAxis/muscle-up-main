import React, { useState, useEffect } from 'react';
import { Lecture, LectureView, User, UserGroup } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Users, 
  Calendar as CalendarIcon, 
  Video,
  ExternalLink,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, parseISO, isPast, isFuture } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function LecturesManager() {
    const [lectures, setLectures] = useState([]);
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [lectureViews, setLectureViews] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingLecture, setEditingLecture] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        video_url: '',
        thumbnail_url: '',
        target_audience_type: 'all_users',
        target_user_emails: [],
        target_groups: [],
        start_date: '',
        end_date: '',
        is_active: true
    });

    const loadLectures = async () => {
        setIsLoading(true);
        setError('');
        try {
            const allLectures = await Lecture.list('-start_date');
            setLectures(allLectures || []);
            
            const [allUsers, allGroups, allViews] = await Promise.all([
                User.list(),
                UserGroup.list(),
                LectureView.list()
            ]);
            setUsers(allUsers || []);
            setGroups(allGroups || []);
            setLectureViews(allViews || []);
        } catch (error) {
            console.error('Error loading data:', error);
            setError('אירעה שגיאה בטעינת הנתונים.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadLectures();
    }, []);

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            video_url: '',
            thumbnail_url: '',
            target_audience_type: 'all_users',
            target_user_emails: [],
            target_groups: [],
            start_date: '',
            end_date: '',
            is_active: true
        });
        setEditingLecture(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const lectureData = {
                ...formData,
                created_by_coach: 'נדיה בלשוב',
                ...(editingLecture ? {} : { created_date: new Date().toISOString() }),
            };

            if (editingLecture) {
                await Lecture.update(editingLecture.id, lectureData);
            } else {
                await Lecture.create(lectureData);
            }

            setIsDialogOpen(false);
            resetForm();
            loadLectures();
        } catch (error) {
            console.error('Error saving lecture:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (lecture) => {
        setEditingLecture(lecture);
        setFormData({
            title: lecture.title,
            description: lecture.description || '',
            video_url: lecture.video_url,
            thumbnail_url: lecture.thumbnail_url || '',
            target_audience_type: lecture.target_audience_type,
            target_user_emails: lecture.target_user_emails || [],
            target_groups: lecture.target_groups || [],
            start_date: lecture.start_date ? format(parseISO(lecture.start_date), 'yyyy-MM-dd HH:mm') : '',
            end_date: lecture.end_date ? format(parseISO(lecture.end_date), 'yyyy-MM-dd HH:mm') : '',
            is_active: lecture.is_active
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (lectureId) => {
        setDeletingId(lectureId);
        try {
            await Lecture.delete(lectureId);
            loadLectures();
        } catch (error) {
            console.error('Error deleting lecture:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const getViewCount = (lectureId) => {
        return lectureViews.filter(view => view.lecture_id === lectureId).length;
    };

    const getLectureStatus = (lecture) => {
        const now = new Date();
        const startDate = lecture.start_date ? parseISO(lecture.start_date) : new Date();
        const endDate = lecture.end_date ? parseISO(lecture.end_date) : null;

        if (!lecture.is_active) {
            return { label: 'לא פעילה', color: 'bg-gray-100 text-gray-600' };
        } else if (lecture.start_date && isFuture(startDate)) {
            return { label: 'מתוכננת', color: 'bg-blue-100 text-blue-800' };
        } else if (endDate && isPast(endDate)) {
            return { label: 'הסתיימה', color: 'bg-red-100 text-red-800' };
        } else {
            return { label: 'זמינה', color: 'bg-green-100 text-green-800' };
        }
    };

    const getAudienceDisplay = (lecture) => {
        switch (lecture.target_audience_type) {
            case 'all_users':
                return { text: 'כל המתאמנים', icon: Users, color: 'text-blue-600' };
            case 'groups':
                return { 
                    text: `קבוצות: ${lecture.target_groups?.join(', ') || 'לא צוין'}`, 
                    icon: Users, 
                    color: 'text-green-600' 
                };
            case 'specific_users':
                return { 
                    text: `${lecture.target_user_emails?.length || 0} משתמשים`, 
                    icon: Users, 
                    color: 'text-purple-600' 
                };
            default:
                return { text: 'לא צוין', icon: Users, color: 'text-gray-600' };
        }
    };

    const getYouTubeThumbnail = (url) => {
        if (!url) return null;
        const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
    };

    const getThumbnail = (lecture) => lecture.thumbnail_url || getYouTubeThumbnail(lecture.video_url);

    const getMediaType = (videoUrl) => {
        if (videoUrl?.includes('drive.google.com')) {
            return { text: 'Google Drive', icon: Video };
        } else if (videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be')) {
            return { text: 'YouTube', icon: Play };
        } else {
            return { text: 'וידאו', icon: Video };
        }
    };

    const filteredLectures = lectures.filter(lecture => {
        switch (activeTab) {
            case 'active':
                return lecture.is_active;
            case 'inactive':
                return !lecture.is_active;
            default:
                return true;
        }
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredLectures.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedLectures = filteredLectures.slice(startIndex, endIndex);

    // Reset to page 1 when tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">ניהול הרצאות</h2>
                    <p className="text-gray-600">ניהול והעלאה של הרצאות וידאו למתאמנים</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    הוסף הרצאה חדשה
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">כל ההרצאות ({lectures.length})</TabsTrigger>
                    <TabsTrigger value="active">פעילות ({lectures.filter(l => l.is_active).length})</TabsTrigger>
                    <TabsTrigger value="inactive">לא פעילות ({lectures.filter(l => !l.is_active).length})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {filteredLectures.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Video className="w-12 h-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                                    {activeTab === 'active' ? 'אין הרצאות פעילות' : 
                                     activeTab === 'inactive' ? 'אין הרצאות לא פעילות' : 'אין הרצאות'}
                                </h3>
                                <p className="text-gray-500 text-center">
                                    {activeTab === 'all' && 'התחל בהוספת הרצאה חדשה למתאמנים שלך'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <div className="hidden md:block">
                                <div className="bg-white rounded-lg border">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="border-b bg-gray-50">
                                                <tr>
                                                    <th className="text-right p-4 font-semibold">כותרת</th>
                                                    <th className="text-right p-4 font-semibold">תאריך יצירה</th>
                                                    <th className="text-right p-4 font-semibold">קהל יעד</th>
                                                    <th className="text-right p-4 font-semibold">סטטוס</th>
                                                    <th className="text-right p-4 font-semibold">צפיות</th>
                                                    <th className="text-right p-4 font-semibold">פעולות</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <AnimatePresence>
                                                    {paginatedLectures.map((lecture) => {
                                                        const status = getLectureStatus(lecture);
                                                        const viewCount = getViewCount(lecture.id);
                                                        const audience = getAudienceDisplay(lecture);
                                                        const mediaInfo = getMediaType(lecture.video_url);
                                                        
                                                        return (
                                                            <motion.tr
                                                                key={lecture.id}
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                className="border-b hover:bg-gray-50 transition-colors"
                                                            >
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-3">
                                                                        {getThumbnail(lecture) ? (
                                                                            <img
                                                                                src={getThumbnail(lecture)}
                                                                                alt={lecture.title}
                                                                                className="w-20 h-12 object-cover rounded flex-shrink-0"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-20 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                                                                <Video className="w-5 h-5 text-gray-400" />
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <div className="font-medium">{lecture.title}</div>
                                                                            {lecture.description && (
                                                                                <div className="text-sm text-gray-500 mt-1">
                                                                                    {lecture.description.length > 50
                                                                                        ? `${lecture.description.slice(0, 50)}...`
                                                                                        : lecture.description}
                                                                                </div>
                                                                            )}
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                <mediaInfo.icon className="w-4 h-4 text-blue-600" />
                                                                                <span className="text-xs text-blue-600">{mediaInfo.text}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-sm">
                                                                    {lecture.created_date ? format(parseISO(lecture.created_date), 'dd/MM/yyyy HH:mm', { locale: he }) : '—'}
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className={`flex items-center gap-2 ${audience.color}`}>
                                                                        <audience.icon className="w-4 h-4" />
                                                                        <span className="text-sm">{audience.text}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <Badge className={status.color}>{status.label}</Badge>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <Eye className="w-4 h-4 text-gray-500" />
                                                                        <span className="text-sm">{viewCount}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => window.open(lecture.video_url, '_blank')}
                                                                            title="צפה בהרצאה"
                                                                        >
                                                                            <ExternalLink className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleEdit(lecture)}
                                                                            title="ערוך הרצאה"
                                                                        >
                                                                            <Edit className="w-4 h-4" />
                                                                        </Button>
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    disabled={deletingId === lecture.id}
                                                                                    title="מחק הרצאה"
                                                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                                >
                                                                                    {deletingId === lecture.id ? (
                                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                                    ) : (
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    )}
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>מחיקת הרצאה</AlertDialogTitle>
                                                                                    <AlertDialogDescription>
                                                                                        האם אתה בטוח שברצונך למחוק את ההרצאה "{lecture.title}"?
                                                                                        פעולה זו אינה הפיכה והרצאה לא תהיה זמינה עוד למתאמנים.
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                                                    <AlertDialogAction
                                                                                        onClick={() => handleDelete(lecture.id)}
                                                                                        className="bg-red-600 hover:bg-red-700"
                                                                                    >
                                                                                        מחק הרצאה
                                                                                    </AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        );
                                                    })}
                                                </AnimatePresence>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="md:hidden space-y-4">
                                <AnimatePresence>
                                    {paginatedLectures.map((lecture) => {
                                        const lectureStatus = getLectureStatus(lecture);
                                        const viewCount = getViewCount(lecture.id);
                                        const audienceInfo = getAudienceDisplay(lecture);
                                        const mediaInfo = getMediaType(lecture.video_url);
                                        
                                        return (
                                            <motion.div
                                                key={lecture.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -20 }}
                                                layout
                                            >
                                                <Card className="border shadow-sm overflow-hidden">
                                                    {getThumbnail(lecture) && (
                                                        <img
                                                            src={getThumbnail(lecture)}
                                                            alt={lecture.title}
                                                            className="w-full h-40 object-cover"
                                                        />
                                                    )}
                                                    <CardContent className="p-4">
                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <h3 className="font-semibold text-lg">{lecture.title}</h3>
                                                                    {lecture.description && (
                                                                        <p className="text-sm text-gray-600 mt-1">
                                                                            {lecture.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <Badge className={lectureStatus.color}>
                                                                    {lectureStatus.label}
                                                                </Badge>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <CalendarIcon className="w-4 h-4 text-gray-500" />
                                                                    <span>
                                                                        {lecture.created_date ? format(parseISO(lecture.created_date), 'dd/MM/yyyy') : '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <mediaInfo.icon className="w-4 h-4 text-blue-600" />
                                                                    <span>{mediaInfo.text}</span>
                                                                </div>
                                                                <div className={`flex items-center gap-2 ${audienceInfo.color}`}>
                                                                    <audienceInfo.icon className="w-4 h-4" />
                                                                    <span>{audienceInfo.text}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Eye className="w-4 h-4 text-gray-500" />
                                                                    <span>{viewCount} צפיות</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-center items-center gap-3 pt-3 border-t">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => window.open(lecture.video_url, '_blank')}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                    צפה
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleEdit(lecture)}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                    ערוך
                                                                </Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            disabled={deletingId === lecture.id}
                                                                            className="text-red-600 hover:text-red-700 border-red-200 flex items-center gap-2"
                                                                        >
                                                                            {deletingId === lecture.id ? (
                                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                            ) : (
                                                                                <Trash2 className="w-4 h-4" />
                                                                            )}
                                                                            מחק
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>מחיקת הרצאה</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                האם אתה בטוח שברצונך למחוק את ההרצאה "{lecture.title}"?
                                                                                פעולה זו אינה הפיכה והרצאה לא תהיה זמינה עוד למתאמנים.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                                            <AlertDialogAction
                                                                                onClick={() => handleDelete(lecture.id)}
                                                                                className="bg-red-600 hover:bg-red-700"
                                                                            >
                                                                                מחק הרצאה
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {filteredLectures.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-6 border-t border-slate-200">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="itemsPerPage" className="text-sm text-slate-600">הרצאות לעמוד:</Label>
                                <Select 
                                    value={itemsPerPage.toString()} 
                                    onValueChange={(value) => {
                                        setItemsPerPage(Number(value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5</SelectItem>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-slate-600">
                                    עמוד {currentPage} מתוך {totalPages} ({filteredLectures.length} הרצאות)
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                    קודם
                                </Button>
                                
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className="w-10"
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    הבא
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingLecture ? 'עריכת הרצאה' : 'הוספת הרצאה חדשה'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">כותרת ההרצאה *</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    required
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="video_url">קישור לוידאו *</Label>
                                <Input
                                    id="video_url"
                                    type="url"
                                    value={formData.video_url}
                                    onChange={(e) => setFormData({...formData, video_url: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">תיאור ההרצאה</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="thumbnail_url">תמונה ממוזערת (אופציונלי)</Label>
                            <Input
                                id="thumbnail_url"
                                type="url"
                                value={formData.thumbnail_url}
                                onChange={(e) => setFormData({...formData, thumbnail_url: e.target.value})}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start_date">תאריך התחלת צפייה *</Label>
                                <Input
                                    id="start_date"
                                    type="datetime-local"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                                    required
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="end_date">תאריך סיום צפייה (אופציונלי)</Label>
                                <Input
                                    id="end_date"
                                    type="datetime-local"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>קהל יעד</Label>
                            <Select
                                value={formData.target_audience_type}
                                onValueChange={(value) => setFormData({...formData, target_audience_type: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all_users">כל המתאמנים</SelectItem>
                                    <SelectItem value="groups">קבוצות ספציפיות</SelectItem>
                                    <SelectItem value="specific_users">משתמשים ספציפיים</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.target_audience_type === 'groups' && (
                            <div className="space-y-2">
                                <Label>בחר קבוצות</Label>
                                <ScrollArea className="h-32 border rounded p-2">
                                    {groups.map(group => (
                                        <div key={group.id} className="flex items-center space-x-2 mb-2">
                                            <Checkbox
                                                id={group.id}
                                                checked={formData.target_groups.includes(group.name)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setFormData({
                                                            ...formData,
                                                            target_groups: [...formData.target_groups, group.name]
                                                        });
                                                    } else {
                                                        setFormData({
                                                            ...formData,
                                                            target_groups: formData.target_groups.filter(g => g !== group.name)
                                                        });
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={group.id}>{group.name}</Label>
                                        </div>
                                    ))}
                                </ScrollArea>
                            </div>
                        )}

                        {formData.target_audience_type === 'specific_users' && (
                            <div className="space-y-2">
                                <Label>בחר משתמשים</Label>
                                <ScrollArea className="h-32 border rounded p-2">
                                    {users.filter(u => u.role === 'user').map(user => (
                                        <div key={user.id} className="flex items-center space-x-2 mb-2">
                                            <Checkbox
                                                id={user.id}
                                                checked={formData.target_user_emails.includes(user.email)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setFormData({
                                                            ...formData,
                                                            target_user_emails: [...formData.target_user_emails, user.email]
                                                        });
                                                    } else {
                                                        setFormData({
                                                            ...formData,
                                                            target_user_emails: formData.target_user_emails.filter(e => e !== user.email)
                                                        });
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={user.id}>{user.name} ({user.email})</Label>
                                        </div>
                                    ))}
                                </ScrollArea>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                            />
                            <Label htmlFor="is_active">הרצאה פעילה</Label>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsDialogOpen(false);
                                    resetForm();
                                }}
                            >
                                ביטול
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                {editingLecture ? 'עדכן הרצאה' : 'הוסף הרצאה'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}