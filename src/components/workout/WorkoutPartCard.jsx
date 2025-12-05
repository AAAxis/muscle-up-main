
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, CheckCircle, Undo2, Trash2, Plus, Image as ImageIcon } from 'lucide-react';

const ExerciseCard = ({ exercise, onUpdate, workout, partKey }) => {
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

  const handleExerciseUpdate = (updatedExercise) => {
    const updatedWorkout = {
      ...workout,
      [partKey]: workout[partKey].map(ex => 
        ex.key === updatedExercise.key ? updatedExercise : ex
      )
    };
    onUpdate(updatedWorkout);
  };

  const toggleExerciseCompletion = () => {
    handleExerciseUpdate({ ...exercise, completed: !exercise.completed });
  };

  const handleSetDataChange = (setIndex, field, value) => {
    const updatedSets = exercise.sets.map((set, index) => {
      if (index === setIndex) {
        const newValue = field === 'completed' ? value : (Number(value) >= 0 ? Number(value) : 0);
        return { ...set, [field]: newValue };
      }
      return set;
    });
    handleExerciseUpdate({ ...exercise, sets: updatedSets });
  };
  
  const handleAddSet = () => {
    const newSet = { repetitions: 0, weight: 0, duration_seconds: 0, completed: false };
    const updatedSets = [...exercise.sets, newSet];
    handleExerciseUpdate({ ...exercise, sets: updatedSets });
  };

  const handleRemoveSet = (setIndex) => {
    const updatedSets = exercise.sets.filter((_, index) => index !== setIndex);
    handleExerciseUpdate({ ...exercise, sets: updatedSets });
  };
  
  return (
    <div
      className={`p-4 border rounded-lg transition-all duration-300 ${exercise.completed ? 'bg-green-50 border-green-200' : 'bg-white shadow-sm'}`}
    >
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Exercise Image Thumbnail */}
          {imageUrl && (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
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
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-800">{exercise.name}</h4>
            {exercise.category && <p className="text-sm text-slate-500">{exercise.category}</p>}
          </div>
        </div>
        {exercise.completed && <Badge className="bg-green-600 text-white flex-shrink-0">בוצע</Badge>}
      </div>
      
      <div className="grid grid-cols-5 gap-2 text-xs text-center mb-2 font-medium text-slate-600">
        <span>סט</span>
        <span>חזרות</span>
        <span>משקל</span>
        <span>זמן (שנ')</span>
        <span></span>
      </div>

      <div className="space-y-2">
        {exercise.sets.map((set, index) => (
          <div key={index} className={`grid grid-cols-5 gap-2 items-center text-center p-1 rounded-md ${set.completed ? 'bg-green-100' : 'bg-slate-50'}`}>
            <span className="font-bold">{index + 1}</span>
            <Input
              type="number"
              inputMode="numeric"
              value={set.repetitions}
              onChange={(e) => handleSetDataChange(index, 'repetitions', e.target.value)}
              className="h-8 text-center"
              disabled={set.completed}
            />
            <Input
              type="number"
              inputMode="numeric"
              value={set.weight}
              onChange={(e) => handleSetDataChange(index, 'weight', e.target.value)}
              className="h-8 text-center"
              disabled={set.completed}
            />
            <Input
              type="number"
              inputMode="numeric"
              value={set.duration_seconds}
              onChange={(e) => handleSetDataChange(index, 'duration_seconds', e.target.value)}
              className="h-8 text-center"
              disabled={set.completed}
            />
            <div className="flex justify-center items-center h-full">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDataChange(index, 'completed', !set.completed)}>
                    {set.completed ? <Undo2 className="w-4 h-4 text-gray-500"/> : <Check className="w-4 h-4 text-green-500"/>}
                </Button>
                {!set.completed && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveSet(index)}>
                      <Trash2 className="w-4 h-4" />
                  </Button>
                )}
            </div>
          </div>
        ))}
      </div>
       <div className="mt-4 flex justify-between items-center">
        <Button variant="outline" size="sm" onClick={handleAddSet}>
            <Plus className="w-4 h-4 ml-2"/> הוסף סט
        </Button>
        <Button
            variant={exercise.completed ? 'outline' : 'default'}
            size="sm"
            onClick={toggleExerciseCompletion}
            className={`transition-all ${exercise.completed ? 'text-green-600 border-green-500 hover:bg-green-100' : 'muscle-primary-gradient'}`}
        >
            {exercise.completed ? <Undo2 className="w-4 h-4 ml-2"/> : <Check className="w-4 h-4 ml-2"/>}
            {exercise.completed ? 'בטל סימון' : 'סמן כהושלם'}
        </Button>
      </div>

    </div>
  );
}


export default function WorkoutPartCard({ title, exercises, partKey, workout, onUpdate }) {
  if (!exercises || exercises.length === 0) {
    return null;
  }
  
  return (
    <Card className="muscle-glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>בצע את התרגילים הבאים לפי הסדר</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {exercises.map((exercise, index) => (
          <ExerciseCard 
            key={exercise.key || `${partKey}-${index}`} 
            exercise={exercise} 
            onUpdate={onUpdate}
            workout={workout}
            partKey={partKey}
          />
        ))}
      </CardContent>
    </Card>
  );
}
