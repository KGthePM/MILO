import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MoviesPage from './pages/MoviesPage';
import TVSeriesPage from './pages/TVSeriesPage';
import TimelinePage from './pages/TimelinePage';
import LandingPage from './pages/LandingPage';
import SettingsPage from './pages/SettingsPage';
import FriendsPage from './pages/FriendsPage';
import FriendProfilePage from './pages/FriendProfilePage';
import AuthGate from './components/AuthGate';
import MiloAssistantFab from './components/shared/MiloAssistantFab';
import { MovieProvider } from './utils/MovieContext';
import { TVSeriesProvider } from './utils/TVSeriesContext';
import { IS_CLOUD } from './utils/mode';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing page — rendered outside the auth gate */}
        <Route path="/landing" element={<LandingPage />} />
        {/* Everything else is gated behind auth (cloud mode) */}
        <Route path="/*" element={<GatedApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function GatedApp() {
  return (
    <AuthGate>
      <MovieProvider>
        <TVSeriesProvider>
          <Routes>
            <Route path="/" element={<MoviesPage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/tv" element={<TVSeriesPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {IS_CLOUD && <Route path="/friends" element={<FriendsPage />} />}
            {IS_CLOUD && <Route path="/friends/:friendId" element={<FriendProfilePage />} />}
          </Routes>
          <MiloAssistantFab />
        </TVSeriesProvider>
      </MovieProvider>
    </AuthGate>
  );
}

export default App;
