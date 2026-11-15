import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Drop-in replacement for a native <select> — same children (<option value=.. disabled?>Label</option>),
// same value/onChange(e => e.target.value)/name/className/style/disabled contract, so existing call
// sites only need the tag renamed (<select> -> <CustomSelect>), not restructured. Exists because the
// native <select> popup always renders with the OS/browser's own light-or-dark palette regardless of
// this app's .dark class (see index.css's color-scheme comment) — every option became unreadable in
// dark mode. This renders its own themed popup instead, so it always matches the app's CSS variables.

function getOptionText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getOptionText).join('');
  if (node.props && node.props.children != null) return getOptionText(node.props.children);
  return '';
}

// Flattens <option> children one level deep so a plain array/fragment of
// options (from .map()) or an <optgroup> wrapper both work the same as
// passing <option> elements directly.
function parseOptions(children) {
  const options = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'option') {
      const value = child.props.value !== undefined ? child.props.value : getOptionText(child.props.children);
      options.push({ value, label: getOptionText(child.props.children), disabled: !!child.props.disabled });
    } else if (child.props && child.props.children) {
      options.push(...parseOptions(child.props.children));
    }
  });
  return options;
}

const MENU_MAX_HEIGHT = 300;

const CustomSelect = ({
  value,
  onChange,
  onBlur,
  onFocus,
  name,
  id,
  disabled,
  required,
  className = '',
  style,
  placeholder,
  hideChevron,
  // Opt-in dense mode for toolbars: smaller gap, chevron and option rows. `menuMinWidth` keeps the popup readable
  // when the trigger itself is narrow. Neither changes anything for existing call sites.
  compact = false,
  menuMinWidth,
  // Opt-in: a search box at the top of the popup that filters the options as you type (long lists, e.g. states).
  searchable = false,
  searchPlaceholder = 'Search',
  children,
  ...rest
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const [highlighted, setHighlighted] = useState(-1);
  const [menuRect, setMenuRect] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const typeaheadRef = useRef({ str: '', timer: null });

  const options = useMemo(() => parseOptions(children), [children]);

  const selectedIndex = useMemo(
    () => options.findIndex((o) => String(o.value) === String(value ?? '')),
    [options, value]
  );
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : '';

  // indexes (into `options`) that match the search text; every option when not searching
  const visible = useMemo(() => {
    const q = searchable ? query.trim().toLowerCase() : '';
    const idx = [];
    options.forEach((o, i) => { if (!q || o.label.toLowerCase().includes(q)) idx.push(i); });
    return idx;
  }, [options, query, searchable]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 180 && rect.top > spaceBelow;
    setMenuRect({
      left: rect.left,
      width: rect.width,
      openUp,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      maxHeight: Math.max(120, Math.min(MENU_MAX_HEIGHT, (openUp ? rect.top : spaceBelow) - 12)),
    });
  }, []);

  const closeMenu = useCallback((refocus) => {
    setOpen(false);
    setHighlighted(-1);
    setQuery('');
    if (refocus && triggerRef.current) triggerRef.current.focus();
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setOpen(true);
    setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
  }, [disabled, updatePosition, selectedIndex]);

  useEffect(() => {
    if (open && searchable && menuRect) searchRef.current?.focus();
  }, [open, searchable, !!menuRect]); // eslint-disable-line react-hooks/exhaustive-deps

  // typing narrows the list: keep the highlight on a row that is still shown
  useEffect(() => {
    if (!searchable || !open) return;
    if (!visible.includes(highlighted)) setHighlighted(visible.length ? visible[0] : -1);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reposition while open instead of closing on scroll — the trigger can sit
  // inside a scrollable card/table/modal, and snapping shut on every scroll
  // tick (rather than just tracking the trigger) reads as broken.
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      closeMenu(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open, closeMenu]);

  const commitSelection = useCallback(
    (index) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      if (String(opt.value) !== String(value ?? '')) {
        onChange?.({
          target: { name, value: String(opt.value), type: 'select-one' },
          type: 'change',
          preventDefault() {},
          stopPropagation() {},
        });
      }
      closeMenu(true);
    },
    [options, onChange, name, value, closeMenu]
  );

  const moveHighlight = useCallback(
    (dir) => {
      setHighlighted((prev) => {
        if (visible.length === 0) return prev;
        let pos = visible.indexOf(prev);
        for (let i = 0; i < visible.length; i++) {
          pos = (pos + dir + visible.length) % visible.length;
          if (!options[visible[pos]].disabled) break;
        }
        return visible[pos];
      });
    },
    [options, visible]
  );

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveHighlight(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveHighlight(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); commitSelection(highlighted); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    else if (e.key === 'Tab') closeMenu(false);
  };

  const handleTypeahead = useCallback(
    (char) => {
      const t = typeaheadRef.current;
      clearTimeout(t.timer);
      t.str += char.toLowerCase();
      t.timer = setTimeout(() => {
        t.str = '';
      }, 600);
      const idx = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.str));
      if (idx >= 0) setHighlighted(idx);
    },
    [options]
  );

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    const { key } = e;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        e.preventDefault();
        openMenu();
      } else if (key.length === 1 && key !== ' ') {
        e.preventDefault();
        openMenu();
        handleTypeahead(key);
      }
      return;
    }
    if (key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      commitSelection(highlighted);
    } else if (key === 'Escape') {
      e.preventDefault();
      closeMenu(true);
    } else if (key === 'Tab') {
      closeMenu(false);
    } else if (key.length === 1) {
      handleTypeahead(key);
    }
  };

  // When the caller supplies its own className (e.g. "form-control"), that
  // class fully owns the box appearance (border/background/padding/color) —
  // we only contribute non-conflicting layout. With no className at all,
  // fall back to a sensible themed default so the control still looks right
  // out of the box. An explicit `style` prop always wins either way, same as
  // it would on a real <select>.
  const hasCustomClass = !!className;
  const layoutStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: compact ? 4 : 8,
    boxSizing: 'border-box',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    textAlign: 'left',
    font: 'inherit',
    userSelect: 'none',
  };
  const fallbackBoxStyle = hasCustomClass
    ? {}
    : {
        border: '1px solid var(--border)',
        // Flat corners everywhere — this app's inputs/panels/buttons are all
        // sharp-edged (see .form-control's border-radius: 0 in index.css), so
        // this trigger and the popup/options below it (same treatment) no
        // longer stood out as the one rounded ("curved") control on the page.
        borderRadius: 0,
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        padding: '8px 12px',
        fontSize: 14,
        minWidth: 80,
      };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        onClick={() => (open ? closeMenu(true) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        className={className || undefined}
        style={{ ...layoutStyle, ...fallbackBoxStyle, ...style }}
        {...rest}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selectedLabel ? 'inherit' : 'var(--text-tertiary)',
          }}
        >
          {selectedLabel || placeholder || ' '}
        </span>
        {!hideChevron && (
          <ChevronDown
            size={compact ? 12 : 16}
            style={{
              flexShrink: 0,
              transition: 'transform 0.15s ease',
              transform: open ? 'rotate(180deg)' : 'none',
              opacity: 0.6,
            }}
          />
        )}
      </button>
      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              left: menuMinWidth ? Math.max(8, Math.min(menuRect.left, window.innerWidth - Math.max(menuRect.width, menuMinWidth) - 8)) : menuRect.left,
              top: menuRect.top,
              bottom: menuRect.bottom,
              width: menuMinWidth ? Math.max(menuRect.width, menuMinWidth) : menuRect.width,
              maxHeight: menuRect.maxHeight,
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 0,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 10000,
              padding: compact ? 2 : 4,
            }}
          >
            {searchable && (
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                style={{
                  position: 'sticky', top: 0, zIndex: 1, display: 'block', width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', marginBottom: 4, fontSize: 14, font: 'inherit',
                  border: '1px solid var(--border)', borderRadius: 0, outline: 'none',
                  background: 'var(--bg-surface)', color: 'var(--text-primary)',
                }}
              />
            )}
            {visible.length === 0 ? (
              <div style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 13 }}>{options.length === 0 ? 'No options' : 'No matches'}</div>
            ) : (
              visible.map((i) => [i, options[i]]).map(([i, opt]) => (
                <div
                  key={`${opt.value}-${i}`}
                  role="option"
                  aria-selected={i === selectedIndex}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitSelection(i)}
                  style={{
                    padding: compact ? '3px 10px' : '8px 12px',
                    borderRadius: 0,
                    fontSize: compact ? 12 : 14,
                    ...(compact ? { lineHeight: '18px', whiteSpace: 'nowrap' } : {}),
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    opacity: opt.disabled ? 0.5 : 1,
                    background:
                      i === highlighted ? 'var(--bg-elevated)' : i === selectedIndex ? 'var(--primary-subtle)' : 'transparent',
                    color: i === selectedIndex ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: i === selectedIndex ? 600 : 400,
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default CustomSelect;
