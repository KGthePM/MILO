import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MoviesPage from './pages/MoviesPage';
import TVSeriesPage from './pages/TVSeriesPage';
import PodcastsPage from './pages/PodcastsPage';
import TimelinePage from './pages/TimelinePage';
import LandingPage from './pages/LandingPage';
import SettingsPage from './pages/SettingsPage';
import FriendsPage from './pages/FriendsPage';
import FriendProfilePage from './pages/FriendProfilePage';
import AuthGate from './components/AuthGate';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MiloAssistantFab from './components/shared/MiloAssistantFab';
import AppLockGate from './components/shared/AppLockGate';
import ScrollToTop from './components/shared/ScrollToTop';
import { MovieProvider } from './utils/MovieContext';
import { TVSeriesProvider } from './utils/TVSeriesContext';
import { PodcastProvider } from './utils/PodcastContext';
import { IS_CLOUD } from './utils/mode';
import { IS_NATIVE } from './utils/native';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Public marketing page — rendered outside the auth gate.
            Web only: inside the Capacitor app the route redirects to /, so
            marketing/Download/clone CTAs are structurally unreachable on
            iOS (and any stray /landing link lands on sign-in). */}
        <Route
          path="/landing"
          element={IS_NATIVE ? <Navigate to="/" replace /> : <LandingPage />}
        />
        {/* Password reset — public: the recovery-link landing state must
            render even when the link is expired (no session). Once a valid
            recovery session exists, the page itself collects the new
            password via updateUser(). */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Everything else is gated behind auth (cloud mode) */}
        <Route path="/*" element={<GatedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function GatedApp() {
  return (
    <AuthGate>
      <AppLockGate>
        <MovieProvider>
        <TVSeriesProvider>
          <PodcastProvider>
            <Routes>
              <Route path="/" element={<MoviesPage />} />
              <Route path="/movies" element={<MoviesPage />} />
              <Route path="/tv" element={<TVSeriesPage />} />
              <Route path="/podcasts" element={<PodcastsPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {IS_CLOUD && <Route path="/friends" element={<FriendsPage />} />}
              {IS_CLOUD && <Route path="/friends/:friendId" element={<FriendProfilePage />} />}
            </Routes>
            <MiloAssistantFab />
          </PodcastProvider>
        </TVSeriesProvider>
      </MovieProvider>
      </AppLockGate>
    </AuthGate>
  );
}

export default App;
