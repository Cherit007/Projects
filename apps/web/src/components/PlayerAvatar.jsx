import React, { useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { getDefaultAvatarUrl } from '../utils/playerPhotos';

const COLORS = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-indigo-100 text-indigo-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700'];

const hashString = (value = '') => value.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const sizeClassMap = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-20 h-20 text-lg',
};

const PlayerAvatar = ({ name = '', photoUrl = '', size = 'md', className = '' }) => {
  const [showFallback, setShowFallback] = useState(false);
  const defaultUrl = useMemo(() => getDefaultAvatarUrl(name), [name]);
  const src = photoUrl || defaultUrl;

  const colorClass = COLORS[hashString(name) % COLORS.length];
  const sizeClass = sizeClassMap[size] || sizeClassMap.md;

  if (showFallback) {
    return (
      <div className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}>
        {name ? getInitials(name) : <User size={14} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name ? `${name} avatar` : 'Player avatar'}
      className={`${sizeClass} rounded-full object-cover border border-gray-200 shrink-0 ${className}`}
      loading="lazy"
      onError={() => setShowFallback(true)}
    />
  );
};

export default PlayerAvatar;
