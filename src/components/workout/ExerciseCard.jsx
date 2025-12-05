
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Clock, Repeat, Edit, Info, ChevronDown, ChevronUp, Video, StickyNote, Weight, Image as ImageIcon } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import NumberPicker from './NumberPicker'; // Import the new component

const ExerciseCard = memo(({ exercise, partIndex, exerciseIndex, onSetChange, onNoteChange, onToggleComplete, isExpanded, onToggleExpand }) => {
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerConfig, setPickerConfig] = useState({});

    const openPicker = (config) => {
        setPickerConfig(config);
        setIsPickerOpen(true);
    };

    // Helper function to get image URL from exercise
    const getImageUrl = (ex) => {
        if (ex?.exercisedb_image_url) {
            if (ex.exercisedb_image_url.startsWith('http')) {
                return ex.exercisedb_image_url;
            }
            return `https://v2.exercisedb.dev/images/${ex.exercisedb_image_url}`;
        }
        // Also check for cdn.exercisedb.dev format
        if (ex?.exercisedb_image_url && ex.exercisedb_image_url.includes('cdn.exercisedb.dev')) {
            return ex.exercisedb_image_url;
        }
        return null;
    };

    const imageUrl = getImageUrl(exercise);

    const SetRow = ({ set, setIndex }) => {
        const isTimeBased = set.duration_seconds > 0;
        const isCompleted = set.completed;

        const handleSetCompletionToggle = (completed) => {
            onSetChange(partIndex, exerciseIndex, setIndex, 'completed', completed);
        };

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex flex-col sm:flex-row items-center gap-4 p-3 rounded-lg transition-colors duration-300 ${isCompleted ? 'bg-green-100' : 'bg-slate-50'}`}
            >
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <Label className="text-lg font-bold text-slate-600">
                        {setIndex + 1}
                    </Label>
                    <Checkbox
                        checked={isCompleted}
                        onCheckedChange={handleSetCompletionToggle}
                        className="w-6 h-6"
                        aria-label={`Mark set ${setIndex + 1} as complete`}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow w-full">
                    {isTimeBased ? (
                        <div className="flex flex-col items-center">
                            <Label className="text-xs text-slate-500 mb-1">זמן</Label>
                            <Button variant="outline" className="w-full text-center" onClick={() => openPicker({
                                title: 'בחר זמן',
                                value: set.duration_seconds || 0,
                                onSave: (newValue) => onSetChange(partIndex, exerciseIndex, setIndex, 'duration_seconds', newValue),
                                min: 5, max: 300, step: 5, unit: 'שניות'
                            })}>
                                <Clock className="w-4 h-4 mr-2" />
                                {set.duration_seconds || 0} שניות
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col items-center">
                                <Label className="text-xs text-slate-500 mb-1">משקל (ק"ג)</Label>
                                <Button variant="outline" className="w-full text-center" onClick={() => openPicker({
                                    title: 'בחר משקל',
                                    value: set.weight || 0,
                                    onSave: (newValue) => onSetChange(partIndex, exerciseIndex, setIndex, 'weight', newValue),
                                    min: 0, max: 200, step: 0.5, unit: 'ק"ג'
                                })}>
                                    <Weight className="w-4 h-4 mr-2" />
                                    {set.weight || 0} ק"ג
                                </Button>
                            </div>
                            <div className="flex flex-col items-center">
                                <Label className="text-xs text-slate-500 mb-1">חזרות</Label>
                                <Button variant="outline" className="w-full text-center" onClick={() => openPicker({
                                    title: 'בחר חזרות',
                                    value: set.repetitions || 0,
                                    onSave: (newValue) => onSetChange(partIndex, exerciseIndex, setIndex, 'repetitions', newValue),
                                    min: 1, max: 50, step: 1, unit: 'חזרות'
                                })}>
                                    <Repeat className="w-4 h-4 mr-2" />
                                    {set.repetitions || 0} חזרות
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <>
            <Card className="overflow-hidden muscle-glass border-0 shadow-lg">
                <CardHeader className="cursor-pointer" onClick={() => onToggleExpand(partIndex, exerciseIndex)}>
                    <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Thumbnail Image */}
                            {imageUrl && !isExpanded && (
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                    <img
                                        src={imageUrl}
                                        alt={exercise.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                            <CardTitle className="flex items-center gap-3 text-slate-800 flex-1 min-w-0">
                                <Dumbbell className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                <span className="text-xl truncate">{exercise.name}</span>
                            </CardTitle>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 flex-shrink-0" />}
                    </div>
                    {exercise.category && <Badge variant="secondary" className="mt-2">{exercise.category}</Badge>}
                </CardHeader>
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <CardContent className="pt-0 pb-4">
                                <div className="space-y-4">
                                    {/* Exercise Image */}
                                    {imageUrl && (
                                        <div className="mt-2">
                                            <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                                <img
                                                    src={imageUrl}
                                                    alt={exercise.name}
                                                    className="w-full h-auto max-h-64 object-contain"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Exercise Video */}
                                    {exercise.video_url && (
                                        <div className="mt-2">
                                           <VideoPlayer videoUrl={exercise.video_url} />
                                        </div>
                                    )}

                                    {exercise.notes && (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                                            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>{exercise.notes}</span>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {exercise.sets.map((set, index) => (
                                            <SetRow key={index} set={set} setIndex={index} />
                                        ))}
                                    </div>
                                    
                                    <div className="pt-2">
                                        <Label className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-600">
                                            <StickyNote className="w-4 h-4" />
                                            הערות אישיות
                                        </Label>
                                        <Textarea
                                            placeholder="רשום כאן כל דבר שיעזור לך לזכור את התרגיל (תחושות, דגשים, וכו')..."
                                            value={exercise.user_notes || ''}
                                            onChange={(e) => onNoteChange(partIndex, exerciseIndex, e.target.value)}
                                            className="bg-white"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
            <NumberPicker
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                {...pickerConfig}
            />
        </>
    );
});

export default ExerciseCard;
