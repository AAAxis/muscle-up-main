import Layout from "./Layout.jsx";

import Home from "./Home";

import Journal from "./Journal";

import Progress from "./Progress";

import Export from "./Export";

import ExercisesSetup from "./ExercisesSetup";

import Tracking from "./Tracking";

import AdminDashboard from "./AdminDashboard";

import Recipes from "./Recipes";

import UserRegistration from "./UserRegistration";

import CompleteProfile from "./CompleteProfile";

import ExerciseLibrary from "./ExerciseLibrary";

import Contract from "./Contract";

import BoosterEvents from "./BoosterEvents";

import Maintenance from "./Maintenance";

import Marketing from "./Marketing";

import PrivacyPolicy from "./PrivacyPolicy";

import TermsOfService from "./TermsOfService";

import ExerciseDBTester from "./ExerciseDBTester";

import DeleteRequest from "./DeleteRequest";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {

    Home: Home,

    Journal: Journal,

    Progress: Progress,

    Export: Export,

    ExercisesSetup: ExercisesSetup,

    Tracking: Tracking,

    AdminDashboard: AdminDashboard,

    Recipes: Recipes,

    UserRegistration: UserRegistration,

    CompleteProfile: CompleteProfile,

    ExerciseLibrary: ExerciseLibrary,

    Contract: Contract,

    BoosterEvents: BoosterEvents,

    Maintenance: Maintenance,

    Marketing: Marketing,

    PrivacyPolicy: PrivacyPolicy,

    TermsOfService: TermsOfService,

    ExerciseDBTester: ExerciseDBTester,

    DeleteRequest: DeleteRequest,
}

function _getCurrentPage(url) {
    if (!url || typeof url !== 'string') {
        return Object.keys(PAGES)[0]; // Return default page if url is invalid
    }
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart && urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Layout currentPageName={currentPage}>
            <Routes>

                <Route path="/" element={<Home />} />


                <Route path="/Home" element={<Home />} />
                <Route path="/home" element={<Home />} />

                <Route path="/Journal" element={<Journal />} />
                <Route path="/journal" element={<Journal />} />

                <Route path="/Progress" element={<Progress />} />
                <Route path="/progress" element={<Progress />} />

                <Route path="/Export" element={<Export />} />
                <Route path="/export" element={<Export />} />

                <Route path="/ExercisesSetup" element={<ExercisesSetup />} />
                <Route path="/exercisessetup" element={<ExercisesSetup />} />

                <Route path="/Tracking" element={<Tracking />} />
                <Route path="/tracking" element={<Tracking />} />

                <Route path="/AdminDashboard/:tab/:subTab" element={<AdminDashboard />} />
                <Route path="/admindashboard/:tab/:subTab" element={<AdminDashboard />} />
                <Route path="/AdminDashboard/:tab" element={<AdminDashboard />} />
                <Route path="/admindashboard/:tab" element={<AdminDashboard />} />
                <Route path="/AdminDashboard" element={<AdminDashboard />} />
                <Route path="/admindashboard" element={<AdminDashboard />} />

                <Route path="/Recipes" element={<Recipes />} />
                <Route path="/recipes" element={<Recipes />} />

                <Route path="/UserRegistration" element={<UserRegistration />} />
                <Route path="/userregistration" element={<UserRegistration />} />

                <Route path="/CompleteProfile" element={<CompleteProfile />} />
                <Route path="/completeprofile" element={<CompleteProfile />} />

                <Route path="/ExerciseLibrary" element={<ExerciseLibrary />} />
                <Route path="/exerciselibrary" element={<ExerciseLibrary />} />

                <Route path="/Contract" element={<Contract />} />
                <Route path="/contract" element={<Contract />} />

                <Route path="/BoosterEvents" element={<BoosterEvents />} />
                <Route path="/boosterevents" element={<BoosterEvents />} />

                <Route path="/Maintenance" element={<Maintenance />} />
                <Route path="/maintenance" element={<Maintenance />} />

                <Route path="/Marketing" element={<Marketing />} />
                <Route path="/marketing" element={<Marketing />} />

                <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
                <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                <Route path="/TermsOfService" element={<TermsOfService />} />
                <Route path="/termsofservice" element={<TermsOfService />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/terms" element={<TermsOfService />} />

                <Route path="/ExerciseDBTester" element={<ExerciseDBTester />} />
                <Route path="/exercisedbtester" element={<ExerciseDBTester />} />

                <Route path="/DeleteRequest" element={<DeleteRequest />} />
                <Route path="/deleterequest" element={<DeleteRequest />} />
                <Route path="/delete-request" element={<DeleteRequest />} />

            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}