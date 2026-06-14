import React from 'react';

const MobileBottomNav = ({
  isVisible = false,
  activeKey = 'home',
  onHome,
  onLive,
  onStats,
  onProfile,
  onPrimaryAction,
  hubMode = false,
}) => {
  if (!isVisible) return null;

  const allItems = [
    {
      key: 'home',
      label: 'Home',
      glyph: '🏠',
      onClick: onHome,
      disabled: typeof onHome !== 'function',
    },
    {
      key: 'live',
      label: 'Live',
      glyph: '🔄',
      onClick: onLive,
      disabled: typeof onLive !== 'function',
    },
    {
      key: 'create',
      label: 'Start',
      glyph: '➕',
      onClick: onPrimaryAction,
      disabled: typeof onPrimaryAction !== 'function',
    },
    {
      key: 'stats',
      label: 'Stats',
      glyph: '📊',
      onClick: onStats,
      disabled: typeof onStats !== 'function',
    },
    {
      key: 'profile',
      label: 'Profile',
      glyph: '👤',
      onClick: onProfile,
      disabled: typeof onProfile !== 'function',
    },
  ];

  const items = hubMode
    ? allItems.filter((item) => item.key === 'home' || item.key === 'profile')
    : allItems;

  return (
    <nav className="tour-command-bar-shell app-mobile-bottom-command-bar" aria-label="Primary mobile navigation">
      <div className="tour-command-bar" style={{ '--tour-command-cols': items.length }}>
        {items.map((item) => {
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`tour-command-btn ${active ? 'tour-command-btn-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={item.onClick}
              disabled={item.disabled}
              aria-current={active ? 'page' : undefined}
            >
              <span className="tour-command-glyph">{item.glyph}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default React.memo(MobileBottomNav);
