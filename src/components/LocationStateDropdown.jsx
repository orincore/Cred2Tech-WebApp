import React from 'react';

const indianStates = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

const LocationStateDropdown = ({ 
  state, 
  city, 
  pincode, 
  stateError, 
  cityError, 
  pincodeError,
  onStateChange,
  onCityChange,
  onPincodeChange,
  onStateBlur,
  onCityBlur,
  onPincodeBlur
}) => {
  const handleCityChange = (e) => {
    const value = e.target.value;
    // Only allow letters, spaces, and hyphens
    const filteredValue = value.replace(/[^a-zA-Z\s\-]/g, '');
    onCityChange({ target: { name: 'city', value: filteredValue } });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          State <span className="text-indigo-600">*</span>
        </label>
        <div className={`input-wrapper flex items-center gap-3 bg-[#e0eaff] dark:bg-[#1e2a5c] border-[1.5px] rounded-[10px] px-4 h-[50px] transition-all duration-200 ${stateError ? 'border-red-300' : 'border-[#0a1628] dark:border-[#2d3a6c] focus-within:border-indigo-500 focus-within:bg-[#ffffff] dark:focus-within:bg-[#162048] focus-within:shadow-[0_0_0_3px_rgba(78,84,200,.08)]'}`}>
          <svg>
            <rect />
          </svg>
          <span className="material-symbols-outlined text-[17px] text-[#4a5d73] dark:text-[#94a3b8] flex-shrink-0 relative z-10">map</span>
          <select
            name="state"
            value={state}
            onChange={onStateChange}
            onBlur={onStateBlur}
            className="flex-1 bg-transparent border-none outline-none text-[0.88rem] text-[#0a1628] dark:text-[#e6edf7] font-medium cursor-pointer relative z-10 appearance-none"
          >
            <option value="">Select State…</option>
            {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="material-symbols-outlined text-[18px] text-[#4a5d73] dark:text-[#94a3b8] flex-shrink-0">arrow_drop_down</span>
        </div>
        {stateError && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {stateError}
          </div>
        )}
      </div>
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          City <span className="text-indigo-600">*</span>
        </label>
        <div className={`input-wrapper flex items-center gap-3 bg-[#e0eaff] dark:bg-[#1e2a5c] border-[1.5px] rounded-[10px] px-4 h-[50px] transition-all duration-200 ${cityError ? 'border-red-300' : 'border-[#0a1628] dark:border-[#2d3a6c] focus-within:border-indigo-500 focus-within:bg-[#ffffff] dark:focus-within:bg-[#162048] focus-within:shadow-[0_0_0_3px_rgba(78,84,200,.08)]'}`}>
          <svg>
            <rect />
          </svg>
          <span className="material-symbols-outlined text-[17px] text-[#4a5d73] dark:text-[#94a3b8] flex-shrink-0 relative z-10">location_city</span>
          <input
            type="text"
            name="city"
            value={city}
            onChange={handleCityChange}
            onBlur={onCityBlur}
            placeholder="City"
            className="flex-1 bg-transparent border-none outline-none text-[0.88rem] text-[#0a1628] dark:text-[#e6edf7] font-medium relative z-10"
          />
        </div>
        {cityError && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {cityError}
          </div>
        )}
      </div>
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Pincode <span className="text-indigo-600">*</span>
        </label>
        <div className={`input-wrapper flex items-center gap-3 bg-[#e0eaff] dark:bg-[#1e2a5c] border-[1.5px] rounded-[10px] px-4 h-[50px] transition-all duration-200 ${pincodeError ? 'border-red-300' : 'border-[#0a1628] dark:border-[#2d3a6c] focus-within:border-indigo-500 focus-within:bg-[#ffffff] dark:focus-within:bg-[#162048] focus-within:shadow-[0_0_0_3px_rgba(78,84,200,.08)]'}`}>
          <svg>
            <rect />
          </svg>
          <span className="material-symbols-outlined text-[17px] text-[#4a5d73] dark:text-[#94a3b8] flex-shrink-0 relative z-10">location_on</span>
          <input
            type="text"
            name="pincode"
            value={pincode}
            onChange={onPincodeChange}
            onBlur={onPincodeBlur}
            placeholder="400001"
            className="flex-1 bg-transparent border-none outline-none text-[0.88rem] text-[#0a1628] dark:text-[#e6edf7] font-medium relative z-10"
            maxLength={6}
          />
        </div>
        {pincodeError && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {pincodeError}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationStateDropdown;
