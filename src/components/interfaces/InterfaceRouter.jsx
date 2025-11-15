
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '@/api/entities';
import TrainerInterface from './TrainerInterface';
import TraineeInterface from './TraineeInterface';
import NetworkErrorDisplay from '../errors/NetworkErrorDisplay';
import LoginScreen from '../auth/LoginScreen';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function InterfaceRouter({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const navigate = useNavigate();

  const loadUser = async () => {
    setIsLoading(true);
    setNetworkError(false);
    
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user in InterfaceRouter:", error);
      
      // Check if it's a "no user logged in" error - this is normal, not a network error
      if (error.message?.includes("No user logged in") || error.message?.includes("User document not found")) {
        // User is not logged in - this is expected, not an error
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      // Check for actual network errors
      const isNetworkError = 
        error.message?.includes("Network Error") ||
        error.message?.includes("Failed to fetch") ||
        error.code === 'unavailable' ||
        (!navigator.onLine);

      if (isNetworkError && navigator.onLine) {
        setNetworkError(true);
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up Firebase auth state observer
    const unsubscribe = User.onAuthStateChanged(async (firebaseAuthUser) => {
      setFirebaseUser(firebaseAuthUser);
      
      if (firebaseAuthUser) {
        // User is signed in, load user data from Firestore
        await loadUser();
      } else {
        // User is signed out - show login screen
        setUser(null);
        setIsLoading(false);
        setNetworkError(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const memoizedUserChecks = useMemo(() => {
    if (isLoading || !user) {
      return null; // Do nothing until user is loaded
    }

    // Allow access to registration page if a token is present in the URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token') && currentPageName === 'UserRegistration') {
      return null;
    }

    // Treat 'coach' and 'admin' as admin roles
    const isAdmin = user.role === 'admin' || user.role === 'coach';
    
    if (!isAdmin) {
      // Define what a complete profile is
      const isProfileComplete = user.name && user.gender && user.birth_date && user.height && user.initial_weight;

      // Check 1: Profile not complete - redirect to CompleteProfile
      if (!isProfileComplete) {
        if (currentPageName !== 'CompleteProfile' && currentPageName !== 'UserRegistration') {
          return createPageUrl('CompleteProfile');
        }
      }
      // Check 2: Contract not signed (runs only if profile IS complete) - redirect to Contract
      else if (!user.contract_signed) {
        if (currentPageName !== 'Contract') {
          return createPageUrl('Contract');
        }
      }
    }
    return null; // All checks passed
  }, [user, isLoading, currentPageName]);


  useEffect(() => {
    if (memoizedUserChecks) {
      navigate(memoizedUserChecks, { replace: true });
    }
  }, [memoizedUserChecks, navigate]);


  const handleRetry = () => {
    setNetworkError(false);
    loadUser();
  };

  // Show login screen if user is not authenticated
  if (!firebaseUser && !isLoading) {
    return <LoginScreen />;
  }

  if (isLoading || memoizedUserChecks) { // Show loader while redirecting
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
  
  if (networkError) {
    return <NetworkErrorDisplay onRetry={handleRetry} />;
  }

  // Route to appropriate interface based on user role
  // Treat 'coach' and 'admin' as admin roles
  const isAdmin = user?.role === 'admin' || user?.role === 'coach';
  if (isAdmin) {
    return <TrainerInterface user={user} />;
  } else if (user) {
    return (
      <TraineeInterface currentPageName={currentPageName}>
        {children}
      </TraineeInterface>
    );
  }

  // Fallback: show login if no user
  return <LoginScreen />;
}
