import { Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';
import { Pill, TabBar } from '../components/UI';

const links = [
  { to: '/', label: 'Home', icon: 'H' },
  { to: '/tasks', label: 'Tasks', icon: 'T' },
  { to: '/calendar', label: 'Plan', icon: 'P' },
  { to: '/breaks', label: 'Breaks', icon: 'B' },
  { to: '/settings', label: 'More', icon: 'M' },
];

export function AppLayout() {
  const { household, decompressionBadgeCount, indexBanner } = useHousehold();
  const { toasts } = useToast();
  const location = useLocation();
  const title = useMemo(() => {
    if (location.pathname === '/') return 'Parent PTO';
    return links.find((item) => item.to === location.pathname)?.label ?? 'Parent PTO';
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-copy">
          <p className="eyebrow">{household?.name ?? 'Household'}</p>
          <h1>{title}</h1>
        </div>
        <div className="topbar-badges">
          {decompressionBadgeCount > 0 && <Pill className="pill-warn">{decompressionBadgeCount} pending</Pill>}
          {toasts.length > 0 && <Pill className="pill-soft">Live</Pill>}
        </div>
      </header>
      {indexBanner && <div className="index-banner">{indexBanner}</div>}
      <main className="app-content">
        <Outlet />
      </main>
      <TabBar links={links} />
    </div>
  );
}

