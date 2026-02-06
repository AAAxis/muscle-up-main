
import React, { useState, useEffect, useCallback } from 'react';
import { Lecture, LectureView, User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlayCircle, Eye, CheckCircle, Clock, Loader2, Video, X } from 'lucide-react';
import { format, isPast, isFuture, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { motion } from 'framer-motion';

// Extract YouTube video ID from various URL formats
const getYouTubeVideoId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const getYouTubeThumbnail = (url) => {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
};

const isYouTubeUrl = (url) => url?.includes('youtube.com') || url?.includes('youtu.be');

// Separate Video Player component for cleaner code
const FullscreenVideoPlayer = ({ videoUrl, onClose }) => {
  const isGoogleDrive = videoUrl.includes('drive.google.com');
  const isYouTube = isYouTubeUrl(videoUrl);

  const getEmbedUrl = (url) => {
    if (isGoogleDrive) {
      return url.replace('/view?usp=sharing', '/preview').replace('/view', '/preview');
    }
    if (isYouTube) {
      const videoId = getYouTubeVideoId(url);
      return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(videoUrl);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-screen h-screen p-0 bg-black border-0 rounded-none flex items-center justify-center">
        <div className="relative w-full h-full">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all"
            aria-label="Close video player"
          >
            <X className="w-8 h-8" />
          </button>

          {isGoogleDrive || isYouTube ? (
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Lecture Video"
            ></iframe>
          ) : (
            <video
              src={embedUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              onEnded={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function LecturesViewer() {
  const [user, setUser] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [lectureViews, setLectureViews] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const now = new Date();

      const [allLectures, userViews] = await Promise.all([
        Lecture.filter({ is_active: true }),
        LectureView.filter({ user_email: currentUser.email })
      ]);

      const viewsMap = new Map(userViews.map(view => [view.lecture_id, view]));
      
      const availableLectures = allLectures.filter(lecture => {
        const startDate = parseISO(lecture.start_date);
        const endDate = lecture.end_date ? parseISO(lecture.end_date) : null;
        
        return isPast(startDate) && (!endDate || isFuture(endDate) || isFuture(now));
      }).sort((a,b) => parseISO(b.start_date) - parseISO(a.start_date));
      
      setLectures(availableLectures);
      setLectureViews(viewsMap);

    } catch (err) {
      console.error('Failed to load lectures:', err);
      setError('שגיאה בטעינת ההרצאות. נסה לרענן את העמוד.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWatchLecture = async (lecture) => {
    setCurrentVideo(lecture);

    const existingView = lectureViews.get(lecture.id);

    if (!existingView) {
      try {
        const newView = await LectureView.create({
          lecture_id: lecture.id,
          user_email: user.email,
          viewed_at: new Date().toISOString(),
          completed: false
        });
        
        setLectureViews(prev => new Map(prev).set(lecture.id, newView));
        
        await Lecture.update(lecture.id, { view_count: (lecture.view_count || 0) + 1 });
        
      } catch (error) {
        console.error('Failed to mark lecture as viewed:', error);
      }
    }
  };

  const handleCloseVideo = async () => {
    if (!currentVideo) return;
    
    const view = lectureViews.get(currentVideo.id);

    if (view && !view.completed) {
      try {
        const updatedView = await LectureView.update(view.id, { completed: true });
        setLectureViews(prev => new Map(prev).set(currentVideo.id, updatedView));
      } catch (error) {
        console.error('Failed to mark lecture as completed:', error);
      }
    }
    
    setCurrentVideo(null);
  };

  const getLectureStatus = (lecture) => {
    const view = lectureViews.get(lecture.id);
    if (view?.completed) {
      return { status: 'completed', label: 'נצפתה', color: 'bg-green-100 text-green-800' };
    } else if (view) {
      return { status: 'viewed', label: 'החל צפייה', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { status: 'new', label: 'חדש', color: 'bg-blue-100 text-blue-800' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="mr-3 text-slate-600">טוען ספריית הרצאות...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="muscle-glass border-0 shadow-lg">
        <CardContent className="text-center py-12">
          <Video className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h3 className="text-xl font-semibold text-red-700 mb-2">שגיאה בטעינת ההרצאות</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
            <Clock className="w-4 h-4 mr-2" />
            נסה שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (lectures.length === 0) {
    return (
      <Card className="muscle-glass border-0 shadow-lg">
        <CardContent className="text-center py-12">
          <Video className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">אין הרצאות זמינות</h3>
          <p className="text-slate-500">כרגע אין הרצאות פעילות במערכת.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="muscle-glass border-0 shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Video className="w-7 h-7 text-purple-600" />
            ספריית הרצאות מקצועיות
          </CardTitle>
          <CardDescription className="text-lg">
            הרצאות ייעודיות למתאמני הבוסטר | {lectures.length} הרצאות זמינות
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {lectures.map((lecture, index) => {
          const lectureStatus = getLectureStatus(lecture);
          
          return (
            <motion.div
              key={lecture.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <Card className="muscle-glass border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                <div className="relative">
                  {(lecture.thumbnail_url || getYouTubeThumbnail(lecture.video_url)) ? (
                    <>
                      <img
                        src={lecture.thumbnail_url || getYouTubeThumbnail(lecture.video_url)}
                        alt={lecture.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.querySelector('[data-fallback]').style.display = 'flex';
                        }}
                      />
                      <div data-fallback className="w-full h-48 bg-gradient-to-br from-purple-100 to-indigo-200 items-center justify-center" style={{ display: 'none' }}>
                        <Video className="w-16 h-16 text-purple-600" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center group-hover:from-purple-200 group-hover:to-indigo-300 transition-all duration-300">
                      <Video className="w-16 h-16 text-purple-600" />
                    </div>
                  )}
                  
                  <div className="absolute top-3 right-3">
                    <Badge className={`${lectureStatus.color} font-medium shadow-sm`}>
                      {lectureStatus.label}
                    </Badge>
                  </div>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <Button
                      size="lg"
                      onClick={() => handleWatchLecture(lecture)}
                      className="bg-white/90 text-purple-700 hover:bg-white border-0 shadow-lg backdrop-blur-sm"
                    >
                      <PlayCircle className="w-6 h-6 ml-2" />
                      צפה עכשיו
                    </Button>
                  </div>
                </div>

                <CardHeader className="pb-3">
                  <CardTitle className="text-lg leading-tight line-clamp-2">
                    {lecture.title}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(parseISO(lecture.start_date), 'dd/MM/yyyy', { locale: he })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {lecture.view_count || 0} צפיות
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  {lecture.description && (
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                      {lecture.description}
                    </p>
                  )}

                  {lectureStatus.status === 'viewed' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 font-medium">התקדמות צפייה:</Label>
                      <Progress value={50} className="h-2" />
                      <p className="text-xs text-slate-500">צפייה החלה • המשך צפייה לסיום מלא</p>
                    </div>
                  )}

                  {lectureStatus.status === 'completed' && (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded-md">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">הושלמה בהצלחה</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {currentVideo && (
        <FullscreenVideoPlayer
          videoUrl={currentVideo.video_url}
          onClose={handleCloseVideo}
        />
      )}
    </div>
  );
}
