/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Series from './pages/Series';
import Reader from './pages/Reader';
import Profile from './pages/Profile';
import Search from './pages/Search';
import Admin from './pages/Admin';
import Leaderboard from './pages/Leaderboard';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Support from './pages/Support';
import CompleteProfileModal from './components/CompleteProfileModal';
import { AppInterceptors } from './components/AppInterceptors';
import { ScrollToTop } from './components/ScrollToTop';

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppInterceptors />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/series/:id" element={<Series />} />
              <Route path="/reader/:seriesId/:chapterId" element={<Reader />} />
              <Route path="/series/:seriesId/chapter/:chapterId" element={<Reader />} />
              <Route path="/series/:seriesId/chapters/:chapterId" element={<Reader />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search" element={<Search />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/support" element={<Support />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<Home />} />
            </Routes>
            <CompleteProfileModal />
          </BrowserRouter>
        </AuthProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

