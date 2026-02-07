import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';

const AutocompleteInput = ({ 
  value, 
  onChange, 
  placeholder, 
  playerDatabase = [],
  className = "" 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (value && value.trim() !== '') {
      const searchTerm = value.toLowerCase().trim();
      const filtered = playerDatabase
        .filter(player => player.toLowerCase().includes(searchTerm))
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [value, playerDatabase]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
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
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all ${className}`}
      />
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-xl shadow-lg max-h-40 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSelect(suggestion)}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2"
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