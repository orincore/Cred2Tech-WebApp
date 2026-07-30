import React from 'react';
import CountryCodeSelector from './CountryCodeSelector';

const PhoneField = ({ 
  countryCode, 
  phoneNumber, 
  onCountryCodeChange, 
  onPhoneNumberChange, 
  error, 
  placeholder = "9876543210",
  onBlur 
}) => {
  const handlePhoneInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    onPhoneNumberChange({ target: { value } });
  };

  const handleBlur = (e) => {
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div>
      <div className={`input-wrapper flex items-center gap-2 bg-[#e0eaff] dark:bg-[#1e2a5c] border-[1.5px] rounded-[10px] px-4 h-[50px] transition-all duration-200 ${error ? 'border-red-300' : 'border-[#0a1628] dark:border-[#2d3a6c] focus-within:border-indigo-500 focus-within:bg-[#ffffff] dark:focus-within:bg-[#162048] focus-within:shadow-[0_0_0_3px_rgba(78,84,200,.08)]'}`}>
        <svg>
          <rect />
        </svg>
        <span className="material-symbols-outlined text-[17px] text-[#0a1628] dark:text-[#e6edf7] flex-shrink-0 relative z-10">phone</span>
        
        <div className="flex items-center gap-1 flex-1">
          <div className="min-w-0">
            <CountryCodeSelector 
              value={countryCode} 
              onChange={onCountryCodeChange}
              error={error && error.includes('country code') ? error : null}
            />
          </div>
          
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneInputChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-none outline-none text-[0.88rem] text-[#0a1628] dark:text-[#e6edf7] placeholder-[#0a1628] dark:placeholder-[#e6edf7] font-medium relative z-10 h-full"
            maxLength={10}
          />
        </div>
      </div>
      
      {error && !error.includes('country code') && (
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </div>
      )}
    </div>
  );
};

export default PhoneField;
