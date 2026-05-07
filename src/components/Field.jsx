import React from 'react';

const Field = ({ name, icon, placeholder, type = 'text', error, inputStyle = {}, value, onChange, onBlur }) => (
  <div>
    <div className={`input-wrapper flex items-center gap-3 bg-[#e0eaff] dark:bg-[#1e2a5c] border-[1.5px] rounded-[10px] px-4 h-[50px] transition-all duration-200 ${error ? 'border-red-300' : 'border-[#0a1628] dark:border-[#2d3a6c] focus-within:border-indigo-500 focus-within:bg-[#ffffff] dark:focus-within:bg-[#162048] focus-within:shadow-[0_0_0_3px_rgba(78,84,200,.08)]'}`}>
      <svg>
        <rect />
      </svg>
      <span className="material-symbols-outlined text-[17px] text-[#4a5d73] dark:text-[#94a3b8] flex-shrink-0 relative z-10">{icon}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        type={type}
        className="flex-1 bg-transparent border-none outline-none text-[0.88rem] text-[#0a1628] dark:text-[#e6edf7] placeholder-[#4a5d73] dark:placeholder-[#94a3b8] font-medium relative z-10 h-full"
        style={inputStyle}
      />
    </div>
    {error && (
      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
        <span className="material-symbols-outlined text-[14px]">error</span>
        {error}
      </div>
    )}
  </div>
);

export default Field;
