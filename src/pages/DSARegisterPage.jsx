import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { publicRegisterDSA, publicLookupPan } from '../api/tenantService';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { countries } from '../lib/countries';

const initialForm = {
  pan_number: '',
  name: '',
  email: '',
  mobile: '',
  mobile_country_code: '+91',
  gst_number: '',
  company_type: '',
  address_line: '',
  state: '',
  city: '',
  pincode: '',
  operational_states: [],
  admin_name: '',
  admin_password: '',
};

const companyTypeOptions = ['Private Limited', 'Public Limited', 'Partnership', 'Proprietorship', 'LLP'];

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const countryOptions = countries.map(c => ({
  value: c.dialCode,
  label: `${c.emoji} ${c.name} (${c.dialCode})`
}));

// Not provisioned yet (needs a free Cloudflare account, no DNS change) —
// the widget simply doesn't render and nothing is gated until it's set.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const TurnstileWidget = ({ siteKey, onToken }) => {
  const containerRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
      const script = existing || document.createElement('script');
      if (!existing) {
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
      return () => script.removeEventListener('load', render);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={containerRef} />;
};

// Best-effort map from Signzy/GST's free-text "constitution of business" to
// our fixed dropdown options — always overridable by the DSA afterward, so a
// miss here just means the field stays blank rather than blocking anything.
function normalizeCompanyType(raw) {
  const v = String(raw || '').toLowerCase();
  if (!v) return '';
  if (v.includes('liability partnership') || v === 'llp') return 'LLP';
  if (v.includes('private')) return 'Private Limited';
  if (v.includes('public')) return 'Public Limited';
  if (v.includes('partnership')) return 'Partnership';
  if (v.includes('proprietorship') || v.includes('individual')) return 'Proprietorship';
  return '';
}

const CustomDropdown = ({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  hasError,
  className,
  isPhoneCode = false,
  name,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const focusRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onBlur]);

  return (
    <div className={`relative ${isPhoneCode ? 'shrink-0' : 'w-full'} ${className || ''}`} ref={dropdownRef}>
      <div
        ref={focusRef}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onBlur={() => { }}
        className={`flex items-center justify-between ${isPhoneCode ? 'w-auto gap-1 p-0 pr-1 pb-0.5' : 'w-full pb-3 border-b'} bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold ${hasError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400'} transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <span className={!value ? 'text-[#0a1628]/60 dark:text-[#e6edf7]/60' : ''}>
          {value || placeholder}
        </span>
        <span className={`material-symbols-outlined text-[18px] text-[#0a1628] dark:text-[#e6edf7] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </div>

      {isOpen && (
        <div className={`absolute z-50 ${isPhoneCode ? 'min-w-[280px] max-w-[320px]' : 'w-full min-w-[120px]'} top-[calc(100%+4px)] left-0 bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-gray-800 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar overflow-x-hidden`}>
          {options.map((opt, idx) => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            const isSelected = value === optValue;

            return (
              <div
                key={`${optValue}-${idx}`}
                className={`px-4 py-2.5 text-[14px] cursor-pointer transition-colors truncate
                  ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-[#0a1628] dark:text-[#e6edf7] hover:bg-gray-50 dark:hover:bg-white/5'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ target: { name, value: optValue } });
                  setIsOpen(false);

                  // Use setTimeout to ensure focus removal happens after state updates
                  setTimeout(() => {
                    if (focusRef.current) {
                      focusRef.current.blur();
                    }
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }, 0);
                }}
              >
                {optLabel}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Checkbox multi-select, same visual language as CustomDropdown above but
// keeps the panel open across multiple picks and shows selection as chips.
const MultiSelectDropdown = ({ value, onChange, options, placeholder, hasError }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (opt) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  return (
    <div className="relative w-full" ref={ref}>
      <div
        tabIndex={0}
        className={`flex items-center justify-between w-full pb-3 border-b bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold ${hasError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400'} cursor-pointer transition-colors`}
        onClick={() => setIsOpen((o) => !o)}
      >
        <span className={value.length === 0 ? 'text-[#0a1628]/60 dark:text-[#e6edf7]/60' : ''}>
          {value.length === 0 ? placeholder : `${value.length} state${value.length > 1 ? 's' : ''} selected`}
        </span>
        <span className={`material-symbols-outlined text-[18px] text-[#0a1628] dark:text-[#e6edf7] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {value.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold">
              {s}
              <span
                className="material-symbols-outlined text-[13px] cursor-pointer"
                onClick={(e) => { e.stopPropagation(); toggle(s); }}
              >
                close
              </span>
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-50 w-full min-w-[220px] top-[calc(100%+4px)] left-0 bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-gray-800 rounded-lg shadow-xl max-h-64 overflow-y-auto custom-scrollbar overflow-x-hidden p-1">
          {options.map((opt) => {
            const isSelected = value.includes(opt);
            return (
              <label
                key={opt}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[14px] cursor-pointer transition-colors
                  ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-[#0a1628] dark:text-[#e6edf7] hover:bg-gray-50 dark:hover:bg-white/5'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input type="checkbox" checked={isSelected} onChange={() => toggle(opt)} className="w-4 h-4 accent-indigo-600 shrink-0" />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DSARegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [isPincodeFetching, setIsPincodeFetching] = useState(false);

  // PAN → auto-fill state
  const [panLookup, setPanLookup] = useState({ status: 'idle', error: '' }); // idle | loading | done | error
  const [gstRecords, setGstRecords] = useState([]);
  const [selectedGstin, setSelectedGstin] = useState(''); // '' | 'manual' | a gstin
  const lastLookedUpPan = useRef('');
  const [turnstileToken, setTurnstileToken] = useState('');

  // Auto-fill fields must never be hand-typed ahead of the API — that's the
  // whole point of driving them off PAN/GST lookup instead of a free-text
  // form a script could fill blindly. They unlock only once a lookup
  // attempt has actually resolved (success or failure), never before.
  const panFieldsLocked = panLookup.status === 'idle' || panLookup.status === 'loading';
  const addressFieldsLocked = !selectedGstin;

  const [step, setStep] = useState(1);

  useEffect(() => {
    document.title = 'Cred2Tech | DSA Registration';
  }, []);

  const handleChange = (e) => {
    let { name, value } = e.target;

    // Character limits & formatting
    if (name === 'pan_number') {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    } else if (name === 'gst_number') {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    } else if (name === 'pincode') {
      value = value.replace(/\D/g, '').slice(0, 6);
    } else if (name === 'city') {
      value = value.replace(/[^a-zA-Z\s\-]/g, '');
    }

    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setApiError('');

    // Trigger Pincode Lookup (manual-address correction path)
    if (name === 'pincode' && value.length === 6) {
      fetchLocationData(value);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  const fetchLocationData = async (pincode) => {
    setIsPincodeFetching(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();

      if (data && data[0] && data[0].Status === 'Success') {
        const postOffice = data[0].PostOffice[0];
        const state = postOffice.State;
        const city = postOffice.Name; // Using Name for more precise locality/city

        setForm(p => ({
          ...p,
          state: state,
          city: city
        }));

        // Clear errors for these fields if they were set
        setErrors(p => ({ ...p, state: '', city: '' }));
        toast.success(`Location detected: ${city}, ${state}`);
      } else {
        toast.error('Invalid Pincode or no data found.');
      }
    } catch (err) {
      console.error('Pincode fetch error:', err);
      toast.error('Could not autofill location. Please enter manually.');
    } finally {
      setIsPincodeFetching(false);
    }
  };

  // PAN lookup: fires once the PAN reaches a valid, well-formed 10-char
  // value. Auto-fills organization name / GST / company type / address
  // options — every field it touches stays a normal editable input
  // afterward, so a wrong or incomplete vendor response never blocks
  // registration.
  useEffect(() => {
    const pan = form.pan_number;
    const isValidPan = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
    if (!isValidPan || pan === lastLookedUpPan.current) return;

    lastLookedUpPan.current = pan;
    setPanLookup({ status: 'loading', error: '' });
    setGstRecords([]);
    setSelectedGstin('');

    (async () => {
      try {
        const data = await publicLookupPan(pan);
        setPanLookup({ status: 'done', error: '' });

        setForm((p) => ({
          ...p,
          name: p.name || data.name || p.name,
          gst_number: p.gst_number || data.gst_number || '',
          company_type: p.company_type || normalizeCompanyType(data.company_type) || '',
        }));

        const records = data.gst_records || [];
        setGstRecords(records);
        if (records.length > 0) {
          applyGstSelection(records[0]);
        } else {
          setSelectedGstin('manual');
        }
        if (records.length > 0 || data.name) {
          toast.success('Business details auto-filled from PAN. Please review before continuing.');
        }
      } catch (err) {
        setPanLookup({ status: 'error', error: err?.response?.data?.error || 'Could not auto-fetch details for this PAN. You can continue and fill details manually.' });
        setSelectedGstin('manual');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pan_number]);

  const applyGstSelection = (record) => {
    setSelectedGstin(record.gstin);
    setForm((p) => ({
      ...p,
      state: record.state || p.state,
      city: record.city || p.city,
      pincode: record.pincode || p.pincode,
      address_line: record.address || p.address_line,
    }));
  };

  const handleGstOptionSelect = (option) => {
    if (option === 'manual') {
      setSelectedGstin('manual');
      return;
    }
    const record = gstRecords.find((r) => r.gstin === option);
    if (record) applyGstSelection(record);
  };

  const handlePhoneChange = (field, value) => {
    // Only digits and limit to exactly 10
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setForm((p) => ({ ...p, [field]: cleaned }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const handleCountryCodeChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    // Re-validate phone when country code changes
    if (form.mobile) handleFieldBlur('mobile');

    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const handleFieldBlur = (field, directValue = null) => {
    const value = directValue !== null ? directValue : (form[field] || '');
    let errorMsg = '';

    switch (field) {
      case 'email':
        const spamEmailPatterns = [
          /^(test|demo|sample|example|abc|xyz|temp|fake|spam)@/i,
          /@(test|demo|sample|example|temp|fake)\./i,
          /^(admin|user|email|mail|info)@/i,
        ];
        if (!value.trim()) {
          errorMsg = 'Email is required';
        } else if (spamEmailPatterns.some(pattern => pattern.test(value))) {
          errorMsg = 'Please enter a valid business email address';
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
          errorMsg = 'Invalid email format (e.g. abc@xyz.com)';
        }
        break;

      case 'mobile':
        if (!value.trim()) {
          errorMsg = 'Mobile number is required';
        } else if (value.length !== 10) {
          errorMsg = 'Mobile number must be exactly 10 digits';
        } else if (/^(.)\1{9}$/.test(value)) {
          errorMsg = 'Please enter a valid mobile number (repeated digits detected)';
        } else if (/^0123456789$|^9876543210$|^1234567890$/.test(value)) {
          errorMsg = 'Please enter a valid mobile number (sequential digits detected)';
        } else {
          const countryCode = form.mobile_country_code;
          const fullMobile = countryCode + value.replace(/\s/g, '');
          // Basic check for valid mobile start digits if country code is +91
          if (countryCode === '+91' && !/^[6-9]\d{9}$/.test(value)) {
            errorMsg = 'Indian mobile numbers must start with 6-9';
          } else if (!/^\+[1-9]\d{1,3}[1-9]\d{4,12}$/.test(fullMobile)) {
            errorMsg = 'Invalid mobile format';
          }
        }
        break;

      case 'pan_number':
        if (!value.trim()) {
          errorMsg = 'PAN number is required';
        } else if (value.length !== 10) {
          errorMsg = 'PAN must be exactly 10 characters';
        } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase())) {
          errorMsg = 'Invalid PAN format (e.g. ABCDE1234F)';
        }
        break;

      case 'gst_number':
        if (value.trim()) {
          if (value.length !== 15) {
            errorMsg = 'GST number must be 15 characters';
          } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value.toUpperCase())) {
            errorMsg = 'Invalid GST format';
          }
        }
        break;

      case 'pincode':
        if (!value.trim()) {
          errorMsg = 'Pincode is required';
        } else if (value.length !== 6) {
          errorMsg = 'Pincode must be exactly 6 digits';
        } else if (!/^[1-9][0-9]{5}$/.test(value)) {
          errorMsg = 'Invalid pincode format';
        }
        break;

      case 'admin_password':
        if (!value) {
          errorMsg = 'Password is required';
        } else if (value.length < 12) {
          errorMsg = 'Minimum 12 characters required';
        } else if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[!@#$%^&*]/.test(value)) {
          errorMsg = 'Password must include uppercase, lowercase, number and special char';
        }
        break;

      case 'company_type':
      case 'state':
      case 'pincode':
        // Don't show "required" error on blur for these to avoid unnecessary distraction
        // Validation will still happen during form submission or step progression
        break;

      default:
        if (!value.trim()) {
          errorMsg = 'This field is required';
        }
    }

    setErrors((p) => ({ ...p, [field]: errorMsg }));
  };

  const getPasswordRequirements = (pwd = '') => {
    return {
      length: pwd.length >= 12,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
  };

  const allPasswordRequirementsMet = (pwd) => {
    const reqs = getPasswordRequirements(pwd);
    return Object.values(reqs).every(Boolean);
  };

  const hasStepErrors = () => {
    const stepFields = {
      1: ['pan_number', 'name', 'email', 'mobile', 'company_type'],
      2: ['state', 'city', 'pincode'],
      3: ['admin_name', 'admin_password']
    };
    if (step === 1 && panFieldsLocked) return true; // wait for the PAN lookup to resolve before advancing
    if (step === 2 && form.operational_states.length === 0) return true;
    if (step === 3 && TURNSTILE_SITE_KEY && !turnstileToken) return true;
    return stepFields[step].some(f => errors[f]) || (step === 3 && !allPasswordRequirementsMet(form.admin_password));
  };

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.pan_number.trim()) e.pan_number = 'PAN required for compliance';
      else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number.toUpperCase())) e.pan_number = 'Invalid PAN format (e.g. ABCDE1234F)';

      if (!form.name.trim()) e.name = 'Organization name is required';

      if (!form.email.trim()) e.email = 'Business email is required';
      else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) e.email = 'Invalid email format (e.g. abc@xyz.com)';

      if (!form.mobile.trim()) e.mobile = 'Business mobile is required';
      else {
        const fullMobile = form.mobile_country_code + form.mobile.replace(/\s/g, '');
        if (!/^\+[1-9]\d{1,3}[6-9]\d{9}$/.test(fullMobile)) {
          e.mobile = 'Invalid mobile format (e.g. +91 9876543210)';
        }
      }

      if (form.gst_number && form.gst_number.trim()) {
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst_number.toUpperCase().replace(/\s/g, ''))) {
          e.gst_number = 'Invalid GST format (e.g. 27AAACR5055K1Z7)';
        }
      }

      if (!form.company_type) e.company_type = 'Company type is required';
    }
    if (s === 2) {
      if (!form.state.trim()) e.state = 'State is required';
      if (!form.city.trim()) e.city = 'City is required';
      if (!form.pincode) e.pincode = 'Pincode is required';
      else if (!/^[1-9][0-9]{5}$/.test(form.pincode)) e.pincode = 'Invalid 6-digit pincode';
      if (form.operational_states.length === 0) e.operational_states = 'Select at least one state you provide service in';
    }
    if (s === 3) {
      if (!form.admin_name.trim()) e.admin_name = 'Admin name is required';

      if (!form.admin_password) e.admin_password = 'Password is required';
      else if (!allPasswordRequirementsMet(form.admin_password)) e.admin_password = 'Password requirements not met';
    }
    return e;
  };

  const validateForm = () => {
    let e = {};
    e = { ...e, ...validateStep(1), ...validateStep(2), ...validateStep(3) };
    return e;
  };

  const [showDevPopup, setShowDevPopup] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Restrict registration if not in production
    if (import.meta.env.VITE_APP_ENV !== 'production') {
      setShowDevPopup(true);
      return;
    }

    setIsLoading(true);
    setApiError('');
    try {
      await publicRegisterDSA({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile_country_code + form.mobile.trim(),
        pan_number: form.pan_number.toUpperCase(),
        gst_number: form.gst_number ? form.gst_number.toUpperCase() : undefined,
        company_type: form.company_type,
        state: form.state.trim(),
        city: form.city.trim(),
        pincode: form.pincode,
        address_line: form.address_line.trim() || undefined,
        operational_states: form.operational_states,
        admin_name: form.admin_name.trim(),
        admin_password: form.admin_password,
        website: '', // honeypot — always empty for real users, see hidden input below
        turnstile_token: turnstileToken || undefined,
      });
      setSuccess(true);
      toast.success('Registration successful! You can now log in.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Registration failed. Please try again.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = (e) => {
    e.preventDefault();
    if (step === 1 && panFieldsLocked) return; // Enter-key submits bypass the disabled button — block here too
    const errs = validateStep(step);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setStep((s) => s + 1);
  };

  const prevStep = () => {
    setStep((s) => s - 1);
  };

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, title: 'Business Identity' },
      { num: 2, title: 'Address & Coverage' },
      { num: 3, title: 'Admin Account' },
    ];

    return (
      <div className="flex flex-col mt-12 w-full">
        {steps.map((s, idx) => {
          const isActive = step === s.num;
          const isCompleted = step > s.num;
          const isLast = idx === steps.length - 1;

          return (
            <div key={s.num} className="flex gap-5 group">
              {/* Left Column: Circle & Connecting Line */}
              <div className="flex flex-col items-center w-10 shrink-0">
                {/* Step Circle */}
                <div
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 transition-all duration-500 ease-out z-10
                    ${isActive ? 'bg-white border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)] text-indigo-600' :
                      isCompleted ? 'bg-white/90 border-white/90 text-indigo-600' : 'bg-[#4f46e5] dark:bg-[#312e81] border-white/30 text-white/40'}`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[20px] font-bold">
                      check
                    </span>
                  ) : (
                    <span className={`text-[15px] font-bold`}>
                      {s.num}
                    </span>
                  )}
                </div>

                {/* Flexible Connecting Line */}
                {!isLast && (
                  <div className="w-[2px] flex-1 my-2 bg-white/10 dark:bg-white/5 rounded-full relative">
                    {/* Animated Progress Fill */}
                    <div
                      className="absolute top-0 left-0 w-full bg-white rounded-full transition-all duration-700 ease-in-out"
                      style={{ height: step > s.num ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Text */}
              <div className={`flex flex-col justify-start ${isLast ? '' : 'pb-10'} transition-transform duration-500 ease-out`} style={{ transform: isActive ? 'translateX(4px)' : 'translateX(0)' }}>
                <div className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-colors duration-300 mb-0.5 mt-0.5 ${isActive ? 'text-indigo-200' : isCompleted ? 'text-white/60' : 'text-white/30'}`}>
                  Step {s.num}
                </div>
                <div className={`text-[16px] transition-all duration-300 leading-tight ${isActive ? 'text-white font-bold' : isCompleted ? 'text-white/90 font-semibold' : 'text-white/40 font-medium'}`}>
                  {s.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
      `}</style>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#ffffff] dark:bg-[#0a1628] font-sans overflow-hidden">

        {/* Left Sidebar - Hidden on small screens, takes 40% on desktop */}
        <div className="hidden md:flex flex-col w-2/5 max-w-[480px] bg-indigo-600 dark:bg-indigo-900 relative overflow-hidden shrink-0">
          <div className="p-10 flex-1 z-10">
            <div className="mb-8">
              <Logo size="xlarge" isDark={false} className="brightness-0 invert" />
            </div>
            {renderStepIndicator()}
          </div>
          {/* Illustration at bottom */}
          <div className="relative mt-auto w-full flex items-end justify-center pointer-events-none pb-8 pt-12 overflow-hidden">
            <img src="/lottie/registration.gif" alt="Registration" className="w-full max-w-[420px] object-contain opacity-90 scale-125 origin-bottom translate-y-2" />
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-600 dark:from-indigo-900 via-transparent to-transparent opacity-60" />
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col relative h-screen overflow-y-auto">
          {/* Mobile Header */}
          <div className="flex md:hidden items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <Logo size="large" />
            <ThemeToggle />
          </div>

          {/* Desktop Theme Toggle */}
          <div className="hidden md:flex absolute top-6 right-6 z-50">
            <ThemeToggle />
          </div>

          <div className="flex-1 flex flex-col px-6 py-8 md:px-16 lg:px-24 md:py-16 max-w-3xl mx-auto w-full mt-4 md:mt-0">
            {/* Back Button */}
            {step > 1 ? (
              <button onClick={prevStep} type="button" className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-sm mb-8 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors w-fit">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                {step === 2 && 'Business Identity'}
                {step === 3 && 'Address & Coverage'}
              </button>
            ) : (
              <div className="h-12 mb-8 md:block hidden"></div>
            )}

            {/* Success & API Error */}
            {success && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm font-medium bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                <span className="material-symbols-outlined text-[20px] flex-shrink-0">check_circle</span>
                Registration successful! Redirecting to login…
              </div>
            )}
            {apiError && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">error</span>
                <span className="leading-relaxed">{apiError}</span>
              </div>
            )}

            {/* Step Titles */}
            <div className="mb-10">
              <h2 className="text-3xl md:text-[32px] font-bold text-slate-900 dark:text-white mb-2">
                {step === 1 && 'Tell us about your business'}
                {step === 2 && 'Where do you operate?'}
                {step === 3 && 'Create your admin account'}
              </h2>
              <p className="text-[15px] text-[#0a1628] dark:text-[#e6edf7] font-medium">
                {step === 1 && 'Start with your PAN — we\'ll auto-fill your business details from it.'}
                {step === 2 && 'Confirm your registered address and pick the states you service.'}
                {step === 3 && 'This will be your DSA Admin login, using the business email and mobile above. You can add team members later.'}
              </p>
            </div>

            <form onSubmit={step === 3 ? handleSubmit : nextStep} className="flex-1 flex flex-col">

              {/* Honeypot — hidden from real users, only a bot filling every field blindly trips it */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value=""
                onChange={() => {}}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                aria-hidden="true"
              />

              {/* Fields */}
              <div className="flex-1">
                {step === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                    <div className="md:col-span-2">
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">PAN Number *</label>
                      <div className="relative">
                        <input name="pan_number" placeholder="ABCDE1234F" value={form.pan_number} onChange={handleChange} onBlur={() => handleFieldBlur('pan_number')} style={{ textTransform: 'uppercase' }} className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b ${errors.pan_number ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400'} focus:ring-0 transition-colors p-0`} />
                        {panLookup.status === 'loading' && (
                          <div className="absolute right-0 bottom-3 w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                        )}
                      </div>
                      {errors.pan_number && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.pan_number}</span>}
                      {!errors.pan_number && panLookup.status === 'loading' && <span className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1.5 block">Fetching your business details…</span>}
                      {!errors.pan_number && panLookup.status === 'done' && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 block">Details auto-filled below — please review.</span>}
                      {!errors.pan_number && panLookup.status === 'error' && <span className="text-[11px] text-amber-600 dark:text-amber-500 mt-1.5 block">{panLookup.error}</span>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Organization Name *</label>
                      <input name="name" placeholder={panFieldsLocked ? 'Enter your PAN above to auto-fill' : 'e.g. Acme FinServe Pvt Ltd'} value={form.name} disabled={panFieldsLocked} onChange={handleChange} onBlur={() => handleFieldBlur('name')} className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400'} focus:ring-0 transition-colors p-0 ${panFieldsLocked ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      {errors.name && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.name}</span>}
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Business Email *</label>
                      <input name="email" type="email" placeholder="office@acme.com" value={form.email} onChange={handleChange} onBlur={() => handleFieldBlur('email')} className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b ${errors.email ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400'} focus:ring-0 transition-colors p-0`} />
                      {errors.email && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.email}</span>}
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Business Mobile *</label>
                      <div className={`flex items-center pb-3 border-b ${errors.mobile ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400'} transition-colors`}>
                        <CustomDropdown
                          name="mobile_country_code"
                          value={form.mobile_country_code}
                          onChange={(e) => handleCountryCodeChange('mobile_country_code', e.target.value)}
                          options={countryOptions}
                          isPhoneCode={true}
                        />
                        <input name="mobile" type="tel" placeholder="98765 43210" value={form.mobile} onChange={(e) => handlePhoneChange('mobile', e.target.value)} onBlur={() => handleFieldBlur('mobile')} className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 focus:ring-0" />
                      </div>
                      {errors.mobile && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.mobile}</span>}
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">GST Number (optional)</label>
                      <input name="gst_number" placeholder={panFieldsLocked ? 'Auto-filled from PAN' : '27AAACR5055K1Z7'} value={form.gst_number} disabled={panFieldsLocked} onChange={handleChange} onBlur={() => handleFieldBlur('gst_number')} style={{ textTransform: 'uppercase' }} className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b ${errors.gst_number ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400'} focus:ring-0 transition-colors p-0 ${panFieldsLocked ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      {errors.gst_number && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.gst_number}</span>}
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Company Type *</label>
                      <CustomDropdown
                        name="company_type"
                        value={form.company_type}
                        onChange={handleChange}
                        onBlur={() => handleFieldBlur('company_type')}
                        options={companyTypeOptions}
                        placeholder={panFieldsLocked ? 'Waiting for PAN lookup…' : 'Select Type…'}
                        hasError={!!errors.company_type}
                        disabled={panFieldsLocked}
                      />
                      {errors.company_type && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.company_type}</span>}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="flex flex-col gap-8">
                    {gstRecords.length > 0 && (
                      <div>
                        <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-2.5">
                          We found {gstRecords.length > 1 ? 'these GST registrations' : 'a GST registration'} linked to your PAN — pick your registered address
                        </label>
                        <div className="flex flex-col gap-2.5">
                          {gstRecords.map((r) => (
                            <div
                              key={r.gstin}
                              onClick={() => handleGstOptionSelect(r.gstin)}
                              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${selectedGstin === r.gstin ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                              <span className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${selectedGstin === r.gstin ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300 dark:text-gray-600'}`}>
                                {selectedGstin === r.gstin ? 'radio_button_checked' : 'radio_button_unchecked'}
                              </span>
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold text-[#0a1628] dark:text-[#e6edf7] truncate">{r.trade_name || r.legal_name || r.gstin}</div>
                                <div className="text-[11px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 mt-0.5">{r.gstin}{r.status ? ` · ${r.status}` : ''}</div>
                                {r.address && <div className="text-[12px] text-[#0a1628]/80 dark:text-[#e6edf7]/80 mt-1 leading-relaxed">{[r.address, r.city, r.state, r.pincode].filter(Boolean).join(', ')}</div>}
                              </div>
                            </div>
                          ))}
                          <div
                            onClick={() => handleGstOptionSelect('manual')}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${selectedGstin === 'manual' ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                          >
                            <span className={`material-symbols-outlined text-[20px] shrink-0 ${selectedGstin === 'manual' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300 dark:text-gray-600'}`}>
                              {selectedGstin === 'manual' ? 'radio_button_checked' : 'radio_button_unchecked'}
                            </span>
                            <span className="text-[13px] font-semibold text-[#0a1628] dark:text-[#e6edf7]">None of these — I'll enter my address manually</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                      <div className="md:col-span-2">
                        <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Address {!addressFieldsLocked && '(editable)'}</label>
                        <input name="address_line" placeholder={addressFieldsLocked ? 'Waiting for PAN/GST lookup…' : 'Building, street, area'} value={form.address_line} disabled={addressFieldsLocked} onChange={handleChange} className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-0 transition-colors p-0 ${addressFieldsLocked ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      </div>
                      <div>
                        <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Pin Code *</label>
                        <div className="relative">
                          <input name="pincode" placeholder={addressFieldsLocked ? 'Waiting…' : '123 456'} maxLength={6} value={form.pincode} disabled={addressFieldsLocked} onChange={handleChange} onBlur={(e) => handleFieldBlur('pincode', e.target.value)} className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b ${errors.pincode ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400'} focus:ring-0 transition-colors p-0 ${addressFieldsLocked ? 'opacity-50 cursor-not-allowed' : ''}`} />
                          {isPincodeFetching && (
                            <div className="absolute right-0 bottom-3 w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                          )}
                        </div>
                        {errors.pincode && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.pincode}</span>}
                      </div>
                      <div>
                        <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">City *</label>
                        <input
                          name="city"
                          placeholder={addressFieldsLocked ? 'Waiting…' : 'e.g. Bangalore'}
                          value={form.city}
                          disabled={addressFieldsLocked}
                          onChange={(e) => handleChange({ target: { name: 'city', value: e.target.value.replace(/[^a-zA-Z\s\-]/g, '') } })}
                          onBlur={() => handleFieldBlur('city')}
                          className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b ${errors.city ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400'} focus:ring-0 transition-colors p-0 ${addressFieldsLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {errors.city && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.city}</span>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">State *</label>
                        <CustomDropdown
                          name="state"
                          value={form.state}
                          onChange={handleChange}
                          onBlur={() => handleFieldBlur('state')}
                          options={indianStates}
                          placeholder={addressFieldsLocked ? 'Waiting for PAN/GST lookup…' : 'Select State…'}
                          hasError={!!errors.state}
                          disabled={addressFieldsLocked}
                        />
                        {errors.state && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.state}</span>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Operational States *</label>
                        <p className="text-[11px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 mb-2">States you provide DSA service in — used to match you with leads in the admin panel.</p>
                        <MultiSelectDropdown
                          value={form.operational_states}
                          onChange={(vals) => { setForm((p) => ({ ...p, operational_states: vals })); setErrors((p) => ({ ...p, operational_states: '' })); }}
                          options={indianStates}
                          placeholder="Select states…"
                          hasError={!!errors.operational_states}
                        />
                        {errors.operational_states && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.operational_states}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                    <div className="md:col-span-2">
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Full Name *</label>
                      <input name="admin_name" placeholder="e.g. Rahul Sharma" value={form.admin_name} onChange={handleChange} onBlur={() => handleFieldBlur('admin_name')} className={`w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold pb-3 border-b ${errors.admin_name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-600 dark:focus:border-indigo-400'} focus:ring-0 transition-colors p-0`} />
                      {errors.admin_name && <span className="text-[11px] text-red-500 mt-1.5 block">{errors.admin_name}</span>}
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#f6f8ff] dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c]">
                      <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">info</span>
                      <p className="text-[12px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
                        You'll log in with <span className="font-bold">{form.email || 'your business email'}</span>.
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Password *</label>
                      <div className={`flex items-center pb-3 border-b ${errors.admin_password && form.admin_password.length > 0 && !allPasswordRequirementsMet(form.admin_password) ? 'border-gray-200 dark:border-gray-700' : errors.admin_password ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400'} transition-colors`}>
                        <input type={showPwd ? 'text' : 'password'} name="admin_password" placeholder="Create password" value={form.admin_password} onChange={handleChange} onBlur={() => handleFieldBlur('admin_password')} className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 focus:ring-0" />
                        <span onClick={() => setShowPwd(!showPwd)} className="material-symbols-outlined text-[18px] text-[#0a1628] dark:text-[#e6edf7] cursor-pointer hover:text-indigo-600 transition-colors ml-2">
                          {showPwd ? 'visibility_off' : 'visibility'}
                        </span>
                      </div>

                      {/* Password Requirements Checklist */}
                      <div className="mt-6 flex flex-col gap-2.5">
                        {Object.entries({
                          length: 'At least 12 characters',
                          upper: 'One uppercase letter',
                          lower: 'One lowercase letter',
                          number: 'One number',
                          special: 'One special character'
                        }).map(([key, label]) => {
                          const isMet = getPasswordRequirements(form.admin_password)[key];
                          return (
                            <div key={key} className={`flex items-center gap-2.5 text-[12px] font-medium transition-colors duration-300 ${isMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-500'}`}>
                              <span className="material-symbols-outlined text-[16px] shrink-0">
                                {isMet ? 'check_circle' : 'cancel'}
                              </span>
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {TURNSTILE_SITE_KEY && (
                      <div className="md:col-span-2">
                        <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={setTurnstileToken} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-10 mb-6">
                <TravelingBorderButton
                  type="submit"
                  disabled={hasStepErrors(step) || isLoading || isPincodeFetching || (step === 3 && !allPasswordRequirementsMet(form.admin_password))}
                  solid
                  showIcon={false}
                  size="md"
                  className="w-full py-4 text-[15px] flex items-center justify-center font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Processing…' : isPincodeFetching ? 'Fetching Address…' : step === 3 ? 'Register Now' : 'Continue'}
                </TravelingBorderButton>

                {step === 1 && (
                  <p className="text-center text-sm mt-6 text-[#0a1628] dark:text-[#e6edf7] font-medium">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Sign in here
                    </Link>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Dev Popup Modal */}
      {showDevPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all text-center">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600 dark:text-indigo-400">
              <span className="material-symbols-outlined text-3xl">build</span>
            </div>
            <h3 className="text-2xl font-bold text-[#0a1628] dark:text-white mb-4">Under Development</h3>
            <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium leading-relaxed mb-8 text-[15px]">
              Oops! We know that you are interested in our platform to onboard. Our team is currently developing this platform and will be able to serve you at the earliest. Sorry for the inconvenience.
            </p>
            <button
              onClick={() => setShowDevPopup(false)}
              className="w-full py-3.5 bg-[#0a1628] dark:bg-white text-white dark:text-[#0a1628] font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Okay, I understand
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DSARegisterPage;
