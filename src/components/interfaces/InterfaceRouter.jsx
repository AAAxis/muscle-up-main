
import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { User } from '@/api/entities';
import { auth } from '@/api/firebaseConfig';
import TrainerInterface from './TrainerInterface';
import TraineeInterface from './TraineeInterface';
import NetworkErrorDisplay from '../errors/NetworkErrorDisplay';
import LoginScreen from '../auth/LoginScreen';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Public pages that don't require authentication
const PUBLIC_PAGES = ['Marketing', 'PrivacyPolicy', 'TermsOfService', 'DeleteRequest', 'deleterequest', 'delete-request'];

export default function InterfaceRouter({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if current page is public - check both currentPageName and URL pathname
  const pathname = location.pathname.toLowerCase();
  const isPublicPage = PUBLIC_PAGES.includes(currentPageName) ||
    pathname.includes('marketing') ||
    pathname.includes('privacypolicy') ||
    pathname.includes('privacy-policy') ||
    pathname.includes('termsofservice') ||
    pathname.includes('terms-of-service') ||
    pathname === '/terms' ||
    pathname.includes('delete-request') ||
    pathname.includes('deleterequest');

  // Immediately set loading to false for public pages (runs synchronously before paint)
  useLayoutEffect(() => {
    if (isPublicPage) {
      setIsLoading(false);
    }
  }, [isPublicPage]);

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

      // Check if it's a session expired error (token refresh failed)
      if (error.message?.includes("Session expired") ||
        error.message?.includes("400") ||
        error.code === 'auth/invalid-user-token' ||
        error.code === 'auth/user-token-expired' ||
        error.message?.includes('Bad Request')) {
        // Session is invalid, clear it and show login
        console.warn("Session expired, clearing auth state...");
        // Try to logout to clear Firebase state
        User.logout().catch(console.error);
        // Clear all local state
        setUser(null);
        setFirebaseUser(null);
        setIsLoading(false);
        setNetworkError(false);
        // Clear Firebase auth state from localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('firebase:authUser:')) {
            localStorage.removeItem(key);
          }
        });
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
    // Skip auth setup for public pages
    if (isPublicPage) {
      setIsLoading(false);
      return;
    }

    // Immediately check if there's a current user and validate their token
    const validateCurrentSession = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          // Try to get a fresh token - this will fail if token is invalid
          await currentUser.getIdToken(true);
        } catch (tokenError) {
          console.error("Token validation failed on mount:", tokenError);
          // If token is invalid, clear the session immediately
          if (tokenError.code === 'auth/invalid-user-token' ||
            tokenError.code === 'auth/user-token-expired' ||
            tokenError.message?.includes('400') ||
            tokenError.message?.includes('Bad Request') ||
            tokenError.code?.includes('400')) {
            console.warn("Invalid token detected on mount, clearing session...");
            try {
              await User.logout();
            } catch (logoutError) {
              console.error("Error during logout:", logoutError);
              // Even if logout fails, clear local state
            }
            // Force clear all state
            setUser(null);
            setFirebaseUser(null);
            setIsLoading(false);
            setNetworkError(false);
            // Clear Firebase auth state from localStorage
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('firebase:authUser:')) {
                localStorage.removeItem(key);
              }
            });
            return;
          }
        }
      } else {
        // No current user, ensure we're not in loading state
        setUser(null);
        setFirebaseUser(null);
        setIsLoading(false);
      }
    };

    // Run validation immediately
    validateCurrentSession();

    let timeoutHandled = false;

    // Add a timeout to prevent infinite loading if auth state doesn't resolve
    const loadingTimeout = setTimeout(() => {
      if (timeoutHandled) return;
      timeoutHandled = true;

      console.warn("Auth state loading timeout - checking current auth state...");
      // Check if there's a current user but auth state hasn't fired
      const currentUser = auth.currentUser;
      if (currentUser) {
        // User exists but auth state observer hasn't fired - try to load user
        loadUser().catch((error) => {
          console.error("Error loading user after timeout:", error);
          // If it fails, clear the session
          if (error.message?.includes("Session expired") ||
            error.message?.includes("400") ||
            error.code === 'auth/invalid-user-token') {
            User.logout().catch(console.error);
          }
          setUser(null);
          setFirebaseUser(null);
          setIsLoading(false);
        });
      } else {
        // No user, show login
        setUser(null);
        setFirebaseUser(null);
        setIsLoading(false);
      }
    }, 3000); // Reduced to 3 second timeout

    // Set up Firebase auth state observer with error handling
    const unsubscribe = User.onAuthStateChanged(async (firebaseAuthUser) => {
      if (timeoutHandled) return; // Don't process if timeout already handled
      clearTimeout(loadingTimeout); // Clear timeout if auth state resolves

      try {
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
      } catch (error) {
        console.error("Error in auth state observer:", error);

        // If token refresh failed (400 error), clear the invalid session
        if (error.code === 'auth/invalid-user-token' ||
          error.code === 'auth/user-token-expired' ||
          error.message?.includes('400') ||
          error.message?.includes('Bad Request') ||
          error.message?.includes('Session expired')) {
          console.warn("Invalid token detected, signing out...");
          try {
            await User.logout();
          } catch (logoutError) {
            console.error("Error during logout:", logoutError);
          }
          setUser(null);
          setFirebaseUser(null);
          setIsLoading(false);
          setNetworkError(false);
        } else {
          // For other errors, show network error or set user to null
          const isNetworkError =
            error.message?.includes("Network Error") ||
            error.message?.includes("Failed to fetch") ||
            error.code === 'unavailable' ||
            (!navigator.onLine);

          if (isNetworkError && navigator.onLine) {
            setNetworkError(true);
          } else {
            setUser(null);
            setIsLoading(false);
          }
        }
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [isPublicPage]);

  const memoizedUserChecks = useMemo(() => {
    // Skip checks for public pages
    if (isPublicPage) {
      return null;
    }

    if (isLoading || !user) {
      return null; // Do nothing until user is loaded
    }

    // Allow access to registration page if a token is present in the URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token') && currentPageName === 'UserRegistration') {
      return null;
    }

  // Treat 'admin' or legacy is_admin/isAdmin as system admin; 'trainer' as staff
    const isAdmin = (user.role || '').toLowerCase() === 'admin' || user.is_admin === true || user.isAdmin === true;
    const isTrainer = (user.role || '').toLowerCase() === 'trainer';
    const isStaff = isAdmin || isTrainer;

    if (!isStaff) {
      // Define what a complete profile is (must match CompleteProfile.jsx required fields)
      const isProfileComplete = user.name && user.gender && user.birth_date && user.height != null && user.initial_weight != null && user.coach_name && user.coach_email;

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
  }, [user, isLoading, currentPageName, isPublicPage]);


  // Refetch user when route changes so redirect logic uses fresh data (e.g. after completing profile).
  // Without this, navigating from CompleteProfile -> Contract keeps stale user and redirects back -> loop.
  const prevPathRef = React.useRef(location.pathname);
  useEffect(() => {
    if (isPublicPage || !user) return;
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      loadUser();
    }
  }, [location.pathname, isPublicPage, user]);

  useEffect(() => {
    if (memoizedUserChecks) {
      navigate(memoizedUserChecks, { replace: true });
    }
  }, [memoizedUserChecks, navigate]);

  // Staff (admin/trainer) should be on /admin or /trainer; redirect if they landed elsewhere
  useEffect(() => {
    if (!user || isLoading) return;
    const isAdmin = (user.role || '').toLowerCase() === 'admin' || user.is_admin === true || user.isAdmin === true;
    const isTrainer = (user.role || '').toLowerCase() === 'trainer';
    if (!isAdmin && !isTrainer) return;
    const pathname = location.pathname;
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/trainer')) {
      navigate(isTrainer ? '/trainer' : '/admin', { replace: true });
    }
  }, [user, isLoading, location.pathname, navigate]);


  const handleRetry = () => {
    setNetworkError(false);
    loadUser();
  };

  // Allow public pages to be accessed without authentication - check this FIRST
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Show login screen if user is not authenticated (only for non-public pages)
  // Also show login if we've been loading for too long without a valid user
  if ((!firebaseUser && !isLoading) || (!user && !firebaseUser && !isLoading)) {
    return <LoginScreen />;
  }

  if (isLoading || memoizedUserChecks) { // Show loader while redirecting
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-lime-50" dir="rtl">
        <div className="relative">
          <img
            src="/logo.jpeg"
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
  // System admin (admin or legacy is_admin/isAdmin) see everything; trainer sees only their invited users
  const isAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.is_admin === true || user?.isAdmin === true;
  const isTrainer = (user?.role || '').toLowerCase() === 'trainer';
  const isStaff = isAdmin || isTrainer;
  if (isStaff) {
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
