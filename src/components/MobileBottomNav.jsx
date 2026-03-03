import React from 'react';
import { House, PlayCircle, History, BarChart3, SlidersHorizontal } from 'lucide-react';

const MobileBottomNav = ({
  isVisible = false,
  activeKey = 'home',
  onHome,
  onLive,
  onHistory,
  onStats,
  onUtilities,
}) => {
  if (!isVisible) return null;

  const items = [
    {
      key: 'home',
      label: 'Home',
      icon: House,
      onClick: onHome,
      disabled: typeof onHome !== 'function',
    },
    {
      key: 'live',
      label: 'Live',
      icon: PlayCircle,
      onClick: onLive,
      disabled: typeof onLive !== 'function',
    },
    {
      key: 'history',
      label: 'History',
      icon: History,
      onClick: onHistory,
      disabled: typeof onHistory !== 'function',
    },
    {
      key: 'stats',
      label: 'Stats',
      icon: BarChart3,
      onClick: onStats,
      disabled: typeof onStats !== 'function',
    },
    {
      key: 'utilities',
      label: 'Tools',
      icon: SlidersHorizontal,
      onClick: onUtilities,
      disabled: typeof onUtilities !== 'function',
    },
  ];

  return (
    <nav className="app-mobile-nav" aria-label="Primary mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={`app-mobile-nav-item ${active ? 'is-active' : ''}`}
            onClick={item.onClick}
            disabled={item.disabled}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default React.memo(MobileBottomNav);
