import React from 'react';
import { House, PlayCircle, BarChart3, UserCircle2, Plus } from 'lucide-react';

const MobileBottomNav = ({
  isVisible = false,
  activeKey = 'home',
  onHome,
  onLive,
  onStats,
  onProfile,
  onPrimaryAction,
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
      key: 'action',
      label: 'Actions',
      icon: Plus,
      onClick: onPrimaryAction,
      disabled: typeof onPrimaryAction !== 'function',
      isPrimaryAction: true,
    },
    {
      key: 'stats',
      label: 'Stats',
      icon: BarChart3,
      onClick: onStats,
      disabled: typeof onStats !== 'function',
    },
    {
      key: 'profile',
      label: 'Profile',
      icon: UserCircle2,
      onClick: onProfile,
      disabled: typeof onProfile !== 'function',
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
            className={`app-mobile-nav-item ${item.isPrimaryAction ? 'app-mobile-nav-item-primary-action' : ''} ${active ? 'is-active' : ''}`}
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
