import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users } from 'lucide-react';

const AutocompleteInput = ({ 
  value, 
  onChange, 
  placeholder, 
  playerDatabase = [],
  excludeNames = [],
  className = "" 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  const suggestions = useMemo(() => {
    const normalizedPlayers = playerDatabase
      .filter(player => typeof player === 'string' && player.trim() !== '')
      .map(player => player.trim());

    const uniquePlayers = [...new Set(normalizedPlayers)];
    const searchTerm = value.toLowerCase().trim();
    const excludeSet = new Set(
      excludeNames
        .map((name) => String(name || '').trim().toLowerCase())
        .filter(Boolean),
    );

    const availablePlayers = uniquePlayers.filter((player) => {
      const normalized = player.toLowerCase().trim();
      return !excludeSet.has(normalized) || normalized === searchTerm;
    });

    if (searchTerm === '') {
      return availablePlayers.slice(0, 8);
    }

    return availablePlayers
      .filter(player =>
        player.toLowerCase().includes(searchTerm)
      )
      .slice(0, 8);
  }, [value, playerDatabase, excludeNames]);

  // FIX: use mousedown and container ref
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion) => {
    onChange(suggestion);
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all ${className}`}
      />

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-xl shadow-lg max-h-40 overflow-y-auto autocomplete-dropdown">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion}-${index}`}
              onMouseDown={() => handleSelect(suggestion)} 
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2 autocomplete-option"
            >
              <Users size={14} className="text-blue-500" />
              <span className="text-sm">{suggestion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
