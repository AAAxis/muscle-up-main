import React, { useState, useEffect, useMemo } from "react";
import { ExerciseDefinition, ExerciseDefault, User } from "@/api/entities";
import { getExerciseById, searchExercises, getExercisesByBodyPart, getExercisesByEquipment, getBodyPartsEnglish, getEquipmentListEnglish } from "@/api/exercisedbClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Search, Save, Loader2, CheckCircle, Image as ImageIcon, Play, Video, Database, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ExerciseLibrary() {
    const [activeTab, setActiveTab] = useState('firebase'); // 'firebase' or 'exercisedb'
    
    // Firebase exercises state
    const [exercises, setExercises] = useState([]);
    const [user, setUser] = useState(null);
    const [selectedExercise, setSelectedExercise] = useState(null);
    const [defaults, setDefaults] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [savingExercise, setSavingExercise] = useState(null);
    const [savedExercise, setSavedExercise] = useState(null);
    // Cache for ExerciseDB images to avoid repeated API calls
    const [exerciseImagesCache, setExerciseImagesCache] = useState(new Map());
    
    // ExerciseDB state
    const [exerciseDBExercises, setExerciseDBExercises] = useState([]);
    const [exerciseDBSearchTerm, setExerciseDBSearchTerm] = useState('');
    const [exerciseDBSelectedExercise, setExerciseDBSelectedExercise] = useState(null);
    const [isLoadingExerciseDB, setIsLoadingExerciseDB] = useState(false);
    const [exerciseDBBodyParts, setExerciseDBBodyParts] = useState([]);
    const [exerciseDBEquipment, setExerciseDBEquipment] = useState([]);
    const [selectedBodyPart, setSelectedBodyPart] = useState('');
    const [selectedEquipment, setSelectedEquipment] = useState('');
    const [exerciseDBSearchType, setExerciseDBSearchType] = useState('name'); // 'name', 'bodyPart', 'equipment'

    useEffect(() => {
        loadData();
    }, []);

    // Load ExerciseDB body parts and equipment when ExerciseDB tab is active
    useEffect(() => {
        const loadExerciseDBLists = async () => {
            if (activeTab === 'exercisedb') {
                try {
                    const [bodyParts, equipment] = await Promise.all([
                        getBodyPartsEnglish(),
                        getEquipmentListEnglish()
                    ]);
                    setExerciseDBBodyParts(bodyParts || []);
                    setExerciseDBEquipment(equipment || []);
                } catch (error) {
                    console.error('Error loading ExerciseDB lists:', error);
                }
            }
        };
        loadExerciseDBLists();
    }, [activeTab]);

    // ExerciseDB search handler
    const handleExerciseDBSearch = async () => {
        if (!exerciseDBSearchTerm.trim() && exerciseDBSearchType === 'name') {
            return;
        }
        if (exerciseDBSearchType === 'bodyPart' && !selectedBodyPart) {
            return;
        }
        if (exerciseDBSearchType === 'equipment' && !selectedEquipment) {
            return;
        }

        setIsLoadingExerciseDB(true);
        try {
            let results = [];
            if (exerciseDBSearchType === 'name') {
                results = await searchExercises(exerciseDBSearchTerm, 50);
            } else if (exerciseDBSearchType === 'bodyPart') {
                results = await getExercisesByBodyPart(selectedBodyPart, 50);
            } else if (exerciseDBSearchType === 'equipment') {
                results = await getExercisesByEquipment(selectedEquipment, 50);
            }
            setExerciseDBExercises(results || []);
        } catch (error) {
            console.error('Error searching ExerciseDB:', error);
            setExerciseDBExercises([]);
        } finally {
            setIsLoadingExerciseDB(false);
        }
    };

    // Helper to get image URL from ExerciseDB exercise
    const getExerciseDBImageUrl = (exercise) => {
        if (exercise.imageUrl) {
            if (exercise.imageUrl.startsWith('http')) {
                return exercise.imageUrl;
            }
            return `https://cdn.exercisedb.dev/images/${exercise.imageUrl}`;
        }
        if (exercise.image) {
            if (exercise.image.startsWith('http')) {
                return exercise.image;
            }
            return `https://cdn.exercisedb.dev/images/${exercise.image}`;
        }
        return null;
    };

    // Helper to get video URL from ExerciseDB exercise
    const getExerciseDBVideoUrl = (exercise) => {
        if (exercise.videoUrl) {
            if (exercise.videoUrl.startsWith('http')) {
                return exercise.videoUrl;
            }
            return `https://cdn.exercisedb.dev/videos/${exercise.videoUrl}`;
        }
        if (exercise.video) {
            if (exercise.video.startsWith('http')) {
                return exercise.video;
            }
            return `https://cdn.exercisedb.dev/videos/${exercise.video}`;
        }
        return null;
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [exerciseDefs, currentUser] = await Promise.all([
                ExerciseDefinition.list(),
                User.me()
            ]);
            
            setExercises(exerciseDefs.sort((a, b) => a.name_he.localeCompare(b.name_he)));
            setUser(currentUser);

            // Load user's exercise defaults
            const userDefaults = await ExerciseDefault.filter({ user_email: currentUser.email });
            const defaultsMap = {};
            
            // Initialize all exercises with 0 values
            exerciseDefs.forEach(exercise => {
                defaultsMap[exercise.id] = {
                    weight: 0,
                    reps: 0,
                    duration: 0
                };
            });

            // Override with saved user defaults where they exist
            userDefaults.forEach(def => {
                defaultsMap[def.exercise_id] = {
                    weight: def.default_weight || 0,
                    reps: def.default_reps || 0,
                    duration: def.default_duration || 0
                };
            });

            setDefaults(defaultsMap);
        } catch (error) {
            console.error("Error loading exercise library data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDefaultChange = (exerciseId, field, value) => {
        setDefaults(prev => ({
            ...prev,
            [exerciseId]: {
                ...prev[exerciseId],
                [field]: Number(value) || 0
            }
        }));
    };

    const saveDefaults = async (exerciseId) => {
        if (!user) return;
        
        setSavingExercise(exerciseId);
        try {
            const exerciseDefaults = defaults[exerciseId];
            
            // Check if defaults already exist for this user and exercise
            const existingDefaults = await ExerciseDefault.filter({ 
                user_email: user.email, 
                exercise_id: exerciseId 
            });

            const defaultData = {
                user_email: user.email,
                exercise_id: exerciseId,
                default_weight: exerciseDefaults.weight,
                default_reps: exerciseDefaults.reps,
                default_duration: exerciseDefaults.duration,
                last_updated: new Date().toISOString()
            };

            if (existingDefaults.length > 0) {
                await ExerciseDefault.update(existingDefaults[0].id, defaultData);
            } else {
                await ExerciseDefault.create(defaultData);
            }

            // Show success feedback
            setSavedExercise(exerciseId);
            setTimeout(() => {
                setSavedExercise(null);
            }, 2000);

        } catch (error) {
            console.error("Error saving exercise defaults:", error);
        } finally {
            setSavingExercise(null);
        }
    };

    const filteredExercises = exercises.filter(exercise => 
        (exercise.name_he && exercise.name_he.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (exercise.name_en && exercise.name_en.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Function to fetch image from ExerciseDB API
    const fetchExerciseImage = async (exercise) => {
        // If already in cache, return cached value
        if (exerciseImagesCache.has(exercise.id)) {
            return exerciseImagesCache.get(exercise.id);
        }

        // If no exercisedb_id, return null
        if (!exercise.exercisedb_id) {
            return null;
        }

        try {
            // Fetch exercise data from ExerciseDB API
            const exerciseData = await getExerciseById(exercise.exercisedb_id);
            
            // Extract image URL from ExerciseDB response
            let imageUrl = null;
            if (exerciseData) {
                // Handle different API response formats
                if (exerciseData.imageUrl) {
                    if (exerciseData.imageUrl.startsWith('http')) {
                        imageUrl = exerciseData.imageUrl;
                    } else {
                        imageUrl = `https://cdn.exercisedb.dev/images/${exerciseData.imageUrl}`;
                    }
                } else if (exerciseData.image) {
                    if (exerciseData.image.startsWith('http')) {
                        imageUrl = exerciseData.image;
                    } else {
                        imageUrl = `https://cdn.exercisedb.dev/images/${exerciseData.image}`;
                    }
                }
            }

            // Cache the result
            if (imageUrl) {
                setExerciseImagesCache(prev => new Map(prev).set(exercise.id, imageUrl));
            }
            
            return imageUrl;
        } catch (error) {
            console.warn(`Failed to fetch image for exercise ${exercise.exercisedb_id}:`, error);
            // Cache null to avoid repeated failed requests
            setExerciseImagesCache(prev => new Map(prev).set(exercise.id, null));
            return null;
        }
    };

    // Load images for visible exercises
    useEffect(() => {
        const loadImages = async () => {
            // Only load images for exercises that have exercisedb_id and aren't in cache
            const exercisesToLoad = filteredExercises.filter(ex => 
                ex.exercisedb_id && !exerciseImagesCache.has(ex.id)
            );

            // Load images in batches to avoid overwhelming the API
            const batchSize = 5;
            for (let i = 0; i < exercisesToLoad.length; i += batchSize) {
                const batch = exercisesToLoad.slice(i, i + batchSize);
                await Promise.all(batch.map(ex => fetchExerciseImage(ex)));
            }
        };

        if (filteredExercises.length > 0) {
            loadImages();
        }
    }, [filteredExercises, exerciseImagesCache]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>מאגר תרגילים</CardTitle>
                    <p className="text-sm text-slate-600 mt-2">
                        עיין בתרגילים מהמאגר המקומי או חפש בתרגילים מ-ExerciseDB
                    </p>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="firebase" className="flex items-center gap-2">
                                <Flame className="w-4 h-4" />
                                Firebase
                            </TabsTrigger>
                            <TabsTrigger value="exercisedb" className="flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                ExerciseDB
                            </TabsTrigger>
                        </TabsList>

                        {/* Firebase Exercises Tab */}
                        <TabsContent value="firebase" className="space-y-4 mt-4">
                    <div className="relative mb-4">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="חיפוש תרגיל..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-10"
                        />
                    </div>
                    
                    <ScrollArea className="h-[500px]">
                        <div className="space-y-4">
                            {filteredExercises.map((exercise) => {
                                // Get image URL from cache (fetched live from ExerciseDB)
                                const getImageUrl = (ex) => {
                                    // First check cache (live fetched from ExerciseDB)
                                    if (exerciseImagesCache.has(ex.id)) {
                                        return exerciseImagesCache.get(ex.id);
                                    }
                                    // Fallback to stored image URL if available (for backward compatibility)
                                    if (ex.exercisedb_image_url) {
                                        if (ex.exercisedb_image_url.startsWith('http')) {
                                            return ex.exercisedb_image_url;
                                        }
                                        if (ex.exercisedb_image_url.includes('cdn.exercisedb.dev')) {
                                            return ex.exercisedb_image_url;
                                        }
                                        return `https://v2.exercisedb.dev/images/${ex.exercisedb_image_url}`;
                                    }
                                    return null;
                                };

                                const getVideoUrl = (ex) => {
                                    if (ex.video_url) {
                                        if (ex.video_url.startsWith('http')) {
                                            return ex.video_url;
                                        }
                                        return `https://v2.exercisedb.dev/videos/${ex.video_url}`;
                                    }
                                    return null;
                                };

                                const imageUrl = getImageUrl(exercise);
                                const videoUrl = getVideoUrl(exercise);

                                return (
                                    <motion.div
                                        key={exercise.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-slate-50 p-4 rounded-lg border"
                                    >
                                        <div className="flex items-start gap-4 mb-3">
                                            {/* Thumbnail Image/Video - Always show placeholder if no image */}
                                            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                {imageUrl ? (
                                                    <img
                                                        src={imageUrl}
                                                        alt={exercise.name_he}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            // If image fails, show placeholder
                                                            e.target.style.display = 'none';
                                                            const parent = e.target.parentElement;
                                                            if (parent && !parent.querySelector('.image-placeholder')) {
                                                                const placeholder = document.createElement('div');
                                                                placeholder.className = 'image-placeholder w-full h-full flex items-center justify-center bg-slate-200';
                                                                placeholder.innerHTML = '<div class="text-slate-400 text-xs text-center p-2">אין תמונה</div>';
                                                                parent.appendChild(placeholder);
                                                            }
                                                        }}
                                                    />
                                                ) : videoUrl ? (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-200 relative">
                                                        <video
                                                            src={videoUrl}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                const parent = e.target.parentElement;
                                                                if (parent && !parent.querySelector('.image-placeholder')) {
                                                                    const placeholder = document.createElement('div');
                                                                    placeholder.className = 'image-placeholder w-full h-full flex items-center justify-center bg-slate-200';
                                                                    placeholder.innerHTML = '<div class="text-slate-400 text-xs text-center p-2">אין תמונה</div>';
                                                                    parent.appendChild(placeholder);
                                                                }
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                            <Play className="w-6 h-6 text-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                                        <div className="text-slate-400 text-xs text-center p-2">אין תמונה</div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-slate-800 truncate">{exercise.name_he}</p>
                                                        <p className="text-sm text-slate-500 truncate">{exercise.name_en}</p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setSelectedExercise(exercise)}
                                                        className="text-blue-600 hover:bg-blue-100 flex-shrink-0"
                                                    >
                                                        <Info className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                {/* Media indicators */}
                                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                    {imageUrl && (
                                                        <span className="flex items-center gap-1">
                                                            <ImageIcon className="w-3 h-3" />
                                                            תמונה
                                                        </span>
                                                    )}
                                                    {videoUrl && (
                                                        <span className="flex items-center gap-1">
                                                            <Video className="w-3 h-3" />
                                                            וידאו
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                    <div className="grid grid-cols-4 gap-3">
                                        <div>
                                            <Label className="text-xs">משקל (ק"ג)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.5"
                                                value={defaults[exercise.id]?.weight || 0}
                                                onChange={(e) => handleDefaultChange(exercise.id, 'weight', e.target.value)}
                                                className="h-8"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">חזרות</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={defaults[exercise.id]?.reps || 0}
                                                onChange={(e) => handleDefaultChange(exercise.id, 'reps', e.target.value)}
                                                className="h-8"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">זמן (שנ')</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={defaults[exercise.id]?.duration || 0}
                                                onChange={(e) => handleDefaultChange(exercise.id, 'duration', e.target.value)}
                                                className="h-8"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <Button
                                                onClick={() => saveDefaults(exercise.id)}
                                                disabled={savingExercise === exercise.id}
                                                size="sm"
                                                className={`h-8 transition-all duration-200 ${
                                                    savedExercise === exercise.id 
                                                        ? 'bg-green-600 hover:bg-green-700' 
                                                        : 'bg-blue-600 hover:bg-blue-700'
                                                } text-white`}
                                            >
                                                <AnimatePresence mode="wait">
                                                    {savingExercise === exercise.id ? (
                                                        <motion.div
                                                            key="loading"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                        >
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        </motion.div>
                                                    ) : savedExercise === exercise.id ? (
                                                        <motion.div
                                                            key="success"
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            exit={{ scale: 0 }}
                                                        >
                                                            <CheckCircle className="w-3 h-3" />
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div
                                                            key="save"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                        >
                                                            <Save className="w-3 h-3" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                        </TabsContent>

                        {/* ExerciseDB Tab */}
                        <TabsContent value="exercisedb" className="space-y-4 mt-4">
                            <div className="space-y-4">
                                {/* Search Type Selection */}
                                <div className="flex gap-2">
                                    <Button
                                        variant={exerciseDBSearchType === 'name' ? 'default' : 'outline'}
                                        onClick={() => setExerciseDBSearchType('name')}
                                        size="sm"
                                    >
                                        חיפוש לפי שם
                                    </Button>
                                    <Button
                                        variant={exerciseDBSearchType === 'bodyPart' ? 'default' : 'outline'}
                                        onClick={() => setExerciseDBSearchType('bodyPart')}
                                        size="sm"
                                    >
                                        לפי קבוצת שרירים
                                    </Button>
                                    <Button
                                        variant={exerciseDBSearchType === 'equipment' ? 'default' : 'outline'}
                                        onClick={() => setExerciseDBSearchType('equipment')}
                                        size="sm"
                                    >
                                        לפי ציוד
                                    </Button>
                                </div>

                                {/* Search Input */}
                                {exerciseDBSearchType === 'name' && (
                                    <div className="relative">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="text"
                                            placeholder="חפש תרגיל ב-ExerciseDB..."
                                            value={exerciseDBSearchTerm}
                                            onChange={(e) => setExerciseDBSearchTerm(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleExerciseDBSearch()}
                                            className="pr-10"
                                        />
                                    </div>
                                )}

                                {exerciseDBSearchType === 'bodyPart' && (
                                    <Select value={selectedBodyPart} onValueChange={setSelectedBodyPart}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר קבוצת שרירים" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {exerciseDBBodyParts.map(bp => (
                                                <SelectItem key={bp} value={bp}>{bp}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {exerciseDBSearchType === 'equipment' && (
                                    <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר ציוד" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {exerciseDBEquipment.map(eq => (
                                                <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                <Button
                                    onClick={handleExerciseDBSearch}
                                    disabled={isLoadingExerciseDB || (exerciseDBSearchType === 'name' && !exerciseDBSearchTerm.trim()) || (exerciseDBSearchType === 'bodyPart' && !selectedBodyPart) || (exerciseDBSearchType === 'equipment' && !selectedEquipment)}
                                    className="w-full"
                                >
                                    {isLoadingExerciseDB ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            מחפש...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-4 h-4 mr-2" />
                                            חפש ב-ExerciseDB
                                        </>
                                    )}
                                </Button>

                                {/* ExerciseDB Results */}
                                {exerciseDBExercises.length > 0 && (
                                    <div className="text-sm text-slate-600 mb-2">
                                        נמצאו {exerciseDBExercises.length} תרגילים
                                    </div>
                                )}

                                <ScrollArea className="h-[500px]">
                                    <div className="space-y-4">
                                        {exerciseDBExercises.map((exercise, index) => {
                                            const imageUrl = getExerciseDBImageUrl(exercise);
                                            const videoUrl = getExerciseDBVideoUrl(exercise);
                                            const exerciseId = exercise.exerciseId || exercise.id || `ex-${index}`;
                                            const exerciseName = exercise.name || 'Unknown Exercise';

                                            return (
                                                <motion.div
                                                    key={exerciseId}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-slate-50 p-4 rounded-lg border"
                                                >
                                                    <div className="flex items-start gap-4 mb-3">
                                                        {/* Image */}
                                                        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                            {imageUrl ? (
                                                                <img
                                                                    src={imageUrl}
                                                                    alt={exerciseName}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                                                    <div className="text-slate-400 text-xs text-center p-2">אין תמונה</div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-semibold text-slate-800 truncate">{exerciseName}</p>
                                                                    {exercise.bodyParts && exercise.bodyParts.length > 0 && (
                                                                        <p className="text-sm text-slate-500 truncate">
                                                                            {exercise.bodyParts.join(', ')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => setExerciseDBSelectedExercise(exercise)}
                                                                    className="text-blue-600 hover:bg-blue-100 flex-shrink-0"
                                                                >
                                                                    <Info className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                                {imageUrl && (
                                                                    <span className="flex items-center gap-1">
                                                                        <ImageIcon className="w-3 h-3" />
                                                                        תמונה
                                                                    </span>
                                                                )}
                                                                {videoUrl && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Video className="w-3 h-3" />
                                                                        וידאו
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Exercise Info Modal */}
            <Dialog open={!!selectedExercise} onOpenChange={() => setSelectedExercise(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg">
                            {selectedExercise?.name_he || selectedExercise?.name_en || 'פרטי תרגיל'}
                        </DialogTitle>
                        {selectedExercise?.name_en && (
                            <DialogDescription className="text-sm text-slate-500">{selectedExercise.name_en}</DialogDescription>
                        )}
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {/* Image/Video Display */}
                        {(() => {
                            const getImageUrl = (ex) => {
                                // First check cache (live fetched from ExerciseDB)
                                if (exerciseImagesCache.has(ex.id)) {
                                    return exerciseImagesCache.get(ex.id);
                                }
                                // Fallback to stored image URL if available
                                if (ex?.exercisedb_image_url) {
                                    if (ex.exercisedb_image_url.startsWith('http')) {
                                        return ex.exercisedb_image_url;
                                    }
                                    return `https://v2.exercisedb.dev/images/${ex.exercisedb_image_url}`;
                                }
                                return null;
                            };

                            const getVideoUrl = (ex) => {
                                if (ex?.video_url) {
                                    if (ex.video_url.startsWith('http')) {
                                        return ex.video_url;
                                    }
                                    return `https://v2.exercisedb.dev/videos/${ex.video_url}`;
                                }
                                return null;
                            };

                            const imageUrl = getImageUrl(selectedExercise);
                            const videoUrl = getVideoUrl(selectedExercise);
                            
                            // Fetch image for selected exercise if not in cache
                            useEffect(() => {
                                if (selectedExercise && selectedExercise.exercisedb_id && !exerciseImagesCache.has(selectedExercise.id)) {
                                    fetchExerciseImage(selectedExercise);
                                }
                            }, [selectedExercise]);

                            if (imageUrl || videoUrl) {
                                return (
                                    <div className="space-y-3">
                                        {imageUrl && (
                                            <div>
                                                <h4 className="font-semibold mb-2 text-slate-800 flex items-center gap-2">
                                                    <ImageIcon className="w-4 h-4" />
                                                    <span>תמונת דוגמה</span>
                                                </h4>
                                                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                                    <img
                                                        src={imageUrl}
                                                        alt={selectedExercise?.name_he}
                                                        className="w-full h-auto max-h-96 object-contain"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            const errorDiv = e.target.nextElementSibling;
                                                            if (errorDiv) {
                                                                errorDiv.classList.remove('hidden');
                                                            }
                                                        }}
                                                    />
                                                    <div className="hidden text-center p-4 text-slate-400 text-sm">
                                                        לא ניתן לטעון את התמונה
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {videoUrl && (
                                            <div>
                                                <h4 className="font-semibold mb-2 text-slate-800 flex items-center gap-2">
                                                    <Video className="w-4 h-4" />
                                                    <span>סרטון הדגמה</span>
                                                </h4>
                                                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                                    <video
                                                        src={videoUrl}
                                                        controls
                                                        className="w-full h-auto max-h-96"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            const errorDiv = e.target.nextElementSibling;
                                                            if (errorDiv) {
                                                                errorDiv.classList.remove('hidden');
                                                            }
                                                        }}
                                                    >
                                                        הדפדפן שלך לא תומך בתג וידאו.
                                                    </video>
                                                    <div className="hidden text-center p-4 text-slate-400 text-sm">
                                                        לא ניתן לטעון את הסרטון
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div>
                            <h4 className="font-semibold mb-2 text-slate-800 flex items-center gap-2">
                                💪 <span>שרירים עובדים</span>
                            </h4>
                            <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
                                {selectedExercise?.muscle_group}
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2 text-slate-800 flex items-center gap-2">
                                🎯 <span>מטרה ותיאור</span>
                            </h4>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded">
                                {selectedExercise?.description?.split('//')[1]?.trim() || selectedExercise?.description}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold mb-1 text-slate-800 flex items-center gap-2">
                                    ⚡ <span>ציוד</span>
                                </h4>
                                <p className="text-sm text-slate-600">{selectedExercise?.equipment}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-1 text-slate-800 flex items-center gap-2">
                                    🏷️ <span>קטגוריה</span>
                                </h4>
                                <p className="text-sm text-slate-600">{selectedExercise?.category}</p>
                            </div>
                        </div>
                    </div>
                    <Button onClick={() => setSelectedExercise(null)} className="w-full">
                        סגור
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}