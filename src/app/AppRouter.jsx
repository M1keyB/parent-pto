import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { AppLayout } from './AppLayout';
import { OnboardingPage } from '../pages/OnboardingPage';
import { HomePage } from '../pages/HomePage';
import { TasksPage } from '../pages/TasksPage';
import { CalendarPage } from '../pages/CalendarPage';
import { BreaksPage } from '../pages/BreaksPage';
import { SettingsPage } from '../pages/SettingsPage';

function LoadingScreen() {
  return <div className="center-screen">Syncing the family timeline...</div>;
}

export function AppRouter() {
  const { user, loading: authLoading } = useAuth();
  const { householdId, loading: householdLoading } = useHousehold();

  if (authLoading || householdLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoadingScreen />;
  }

  if (!householdId) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/breaks" element={<BreaksPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
