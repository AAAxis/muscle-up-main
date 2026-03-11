import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import Progress from '@/pages/Progress';
import Export from '@/pages/Export';
import ExercisesSetup from '@/pages/ExercisesSetup';
import Tracking from '@/pages/Tracking';
import AdminDashboard from '@/pages/AdminDashboard';
import Recipes from '@/pages/Recipes';
import UserRegistration from '@/pages/UserRegistration';
import CompleteProfile from '@/pages/CompleteProfile';
import ExerciseLibrary from '@/pages/ExerciseLibrary';
import Contract from '@/pages/Contract';
import BoosterEvents from '@/pages/BoosterEvents';
import Maintenance from '@/pages/Maintenance';
import Marketing from '@/pages/Marketing';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import ExerciseDBTester from '@/pages/ExerciseDBTester';
import DeleteRequest from '@/pages/DeleteRequest';
import InviteRedirect from '@/pages/InviteRedirect';
import AdminUserDetail from '@/pages/AdminUserDetail';

/**
 * Canonical path for each page (one route per tab).
 * Used to build <Route>s and to resolve pathname -> page name.
 */
export const ROUTES = [
  { path: '/', pageName: 'Home', element: <Navigate to="/home" replace /> },
  { path: '/home', pageName: 'Home', element: <Home /> },
  { path: '/journal', pageName: 'Journal', element: <Journal /> },
  { path: '/progress', pageName: 'Progress', element: <Progress /> },
  { path: '/export', pageName: 'Export', element: <Export /> },
  { path: '/exercises-setup', pageName: 'ExercisesSetup', element: <ExercisesSetup /> },
  { path: '/tracking', pageName: 'Tracking', element: <Tracking /> },
  { path: '/recipes', pageName: 'Recipes', element: <Recipes /> },
  { path: '/user-registration', pageName: 'UserRegistration', element: <UserRegistration /> },
  { path: '/complete-profile', pageName: 'CompleteProfile', element: <CompleteProfile /> },
  { path: '/exercise-library', pageName: 'ExerciseLibrary', element: <ExerciseLibrary /> },
  { path: '/contract', pageName: 'Contract', element: <Contract /> },
  { path: '/booster-events', pageName: 'BoosterEvents', element: <BoosterEvents /> },
  { path: '/maintenance', pageName: 'Maintenance', element: <Maintenance /> },
  { path: '/marketing', pageName: 'Marketing', element: <Marketing /> },
  { path: '/privacy-policy', pageName: 'PrivacyPolicy', element: <PrivacyPolicy /> },
  { path: '/terms-of-service', pageName: 'TermsOfService', element: <TermsOfService /> },
  { path: '/terms', pageName: 'TermsOfService', element: <TermsOfService /> },
  { path: '/exercise-db-tester', pageName: 'ExerciseDBTester', element: <ExerciseDBTester /> },
  { path: '/delete-request', pageName: 'DeleteRequest', element: <DeleteRequest /> },
  { path: '/invite', pageName: 'InviteRedirect', element: <InviteRedirect /> },
  // Admin user detail (most specific first) — now handled by dashboard so search bar shows user id
  { path: '/admin/user-management/user-list/:userEmail', pageName: 'AdminDashboard', element: <AdminDashboard /> },
  { path: '/trainer/user-management/user-list/:userEmail', pageName: 'AdminDashboard', element: <AdminDashboard /> },
  // Admin (system admin) dashboard — most specific first so params are correct
  { path: '/admin/:tab/:subTab', pageName: 'AdminDashboard', element: <AdminDashboard /> },
  { path: '/admin/:tab', pageName: 'AdminDashboard', element: <AdminDashboard /> },
  { path: '/admin', pageName: 'AdminDashboard', element: <AdminDashboard /> },
  // Trainer dashboard (same UI, scoped data)
  { path: '/trainer/:tab/:subTab', pageName: 'AdminDashboard', element: <AdminDashboard /> },
  { path: '/trainer/:tab', pageName: 'AdminDashboard', element: <AdminDashboard /> },
  { path: '/trainer', pageName: 'AdminDashboard', element: <AdminDashboard /> },
];

/** Legacy paths (old URLs) -> redirect to canonical path */
const LEGACY_REDIRECTS = [
  ['/Home', '/home'],
  ['/Journal', '/journal'],
  ['/Progress', '/progress'],
  ['/Export', '/export'],
  ['/ExercisesSetup', '/exercises-setup'],
  ['/exercisessetup', '/exercises-setup'],
  ['/Tracking', '/tracking'],
  ['/Recipes', '/recipes'],
  ['/UserRegistration', '/user-registration'],
  ['/userregistration', '/user-registration'],
  ['/CompleteProfile', '/complete-profile'],
  ['/completeprofile', '/complete-profile'],
  ['/ExerciseLibrary', '/exercise-library'],
  ['/exerciselibrary', '/exercise-library'],
  ['/Contract', '/contract'],
  ['/BoosterEvents', '/booster-events'],
  ['/boosterevents', '/booster-events'],
  ['/Maintenance', '/maintenance'],
  ['/Marketing', '/marketing'],
  ['/PrivacyPolicy', '/privacy-policy'],
  ['/privacypolicy', '/privacy-policy'],
  ['/TermsOfService', '/terms-of-service'],
  ['/termsofservice', '/terms-of-service'],
  ['/ExerciseDBTester', '/exercise-db-tester'],
  ['/exercisedbtester', '/exercise-db-tester'],
  ['/DeleteRequest', '/delete-request'],
  ['/deleterequest', '/delete-request'],
  ['/AdminDashboard', '/admin'],
  ['/admindashboard', '/admin'],
];

/** Redirect any /admindashboard or /admindashboard/* to /admin (old links excluded; they don't work as bookmarks) */
function AdmindashboardRedirect() {
  return <Navigate to="/admin" replace />;
}

/** Redirect /AdminDashboard/:tab/:subTab to /admin/:tab (capital A only; lowercase admindashboard uses AdmindashboardRedirect) */
function LegacyAdminRedirect() {
  const location = useLocation();
  const { tab, subTab } = useParams();
  const path = subTab ? `/admin/${tab}/${subTab}` : tab ? `/admin/${tab}` : '/admin';
  return <Navigate to={path + location.search} replace />;
}

/** Redirect to canonical path while preserving query string (e.g. invitation links). */
function LegacyRedirectTo({ to }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

/** Map pageName -> canonical path (first matching route) */
const PAGE_TO_PATH = {};
ROUTES.forEach(({ path, pageName }) => {
  if (path !== '/' && !PAGE_TO_PATH[pageName]) {
    PAGE_TO_PATH[pageName] = path;
  }
});

/**
 * Get canonical URL path for a page name (for Links and navigate).
 */
export function getPathForPage(pageName) {
  if (!pageName) return '/home';
  const normalized = String(pageName).trim();
  return PAGE_TO_PATH[normalized] ?? `/home`;
}

/**
 * Resolve current pathname to a page name (for Layout/InterfaceRouter).
 */
export function getPageNameFromPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return 'Home';
  let path = pathname.replace(/\?.*$/, '').replace(/\/$/, '') || '/';
  // Staff dashboards: any path under /admin or /trainer
  if (path.toLowerCase().startsWith('/admin') || path.toLowerCase().startsWith('/trainer')) return 'AdminDashboard';
  // Exact match
  const exact = ROUTES.find((r) => r.path !== '/' && path.toLowerCase() === r.path.toLowerCase());
  if (exact) return exact.pageName;
  // Prefix match (e.g. /admin/control-center or /trainer/user-management)
  const prefix = ROUTES.slice()
    .filter((r) => r.path.includes(':'))
    .sort((a, b) => b.path.length - a.path.length)
    .find((r) => {
      const prefix = r.path.split('/:')[0];
      return path.toLowerCase().startsWith(prefix.toLowerCase());
    });
  if (prefix) return prefix.pageName;
  return 'Home';
}

export default ROUTES;
export { LEGACY_REDIRECTS, LegacyAdminRedirect, AdmindashboardRedirect, LegacyRedirectTo };
