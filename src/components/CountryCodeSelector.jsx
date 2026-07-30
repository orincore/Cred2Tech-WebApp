import React, { useState } from 'react';

const CountryCodeSelector = ({ value, onChange, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const countries = [
    { code: '+91', name: 'India', flag: '🇮🇳' },
    { code: '+1', name: 'United States', flag: '🇺🇸' },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+61', name: 'Australia', flag: '🇦🇺' },
    { code: '+86', name: 'China', flag: '🇨🇳' },
    { code: '+81', name: 'Japan', flag: '🇯🇵' },
    { code: '+49', name: 'Germany', flag: '🇩🇪' },
    { code: '+33', name: 'France', flag: '🇫🇷' },
    { code: '+39', name: 'Italy', flag: '🇮🇹' },
    { code: '+34', name: 'Spain', flag: '🇪🇸' },
    { code: '+7', name: 'Russia', flag: '🇷🇺' },
    { code: '+55', name: 'Brazil', flag: '🇧🇷' },
    { code: '+27', name: 'South Africa', flag: '🇿🇦' },
    { code: '+82', name: 'South Korea', flag: '🇰🇷' },
    { code: '+65', name: 'Singapore', flag: '🇸🇬' },
    { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '+66', name: 'Thailand', flag: '🇹🇭' },
    { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
    { code: '+63', name: 'Philippines', flag: '🇵🇭' },
    { code: '+64', name: 'New Zealand', flag: '🇳🇿' }
  ];

  const selectedCountry = countries.find(c => c.code === value) || countries[0];

  const handleSelect = (country) => {
    onChange(country.code);
    setIsOpen(false);
  };

  return (
    <div className="relative min-w-[30px]">
      <div 
        className={`flex items-center gap-0 px-0 py-1 bg-transparent cursor-pointer transition-all duration-200 ${
          error ? 'text-red-600' : 'text-[#0a1628] dark:text-[#e6edf7]'
        }`}
        style={{ width: '35px' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-medium">{selectedCountry.code}</span>
        <span className="material-symbols-outlined text-[14px] text-[#0a1628] dark:text-[#e6edf7]">
          {isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-[#ffffff] dark:bg-[#162048] border border-[#c7d2fe] dark:border-[#2d3a6c] rounded-[8px] shadow-lg z-50 max-h-60 overflow-y-auto min-w-[200px]">
          {countries.map((country) => (
            <div
              key={country.code}
              className="flex items-center gap-3 px-3 py-2 hover:bg-[#e0eaff] dark:hover:bg-[#1e2a5c] cursor-pointer transition-colors duration-150"
              onClick={() => handleSelect(country)}
            >
              <span className="text-lg">{country.flag}</span>
              <span className="text-sm font-medium text-[#0a1628] dark:text-[#e6edf7]">{country.code}</span>
              <span className="text-xs text-[#0a1628] dark:text-[#e6edf7] font-medium">{country.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </div>
      )}
    </div>
  );
};

export default CountryCodeSelector;
