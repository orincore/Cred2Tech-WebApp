import { useTheme } from "../context/ThemeContext";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState(theme);

  useEffect(() => {
    setResolvedTheme(theme);
  }, [theme]);

  if (!mounted) {
    return <div className="w-10 h-10 rounded-lg bg-white border-2 border-gray-300" />;
  }

  const isDark = theme === "dark";

  const handleToggle = (e) => {
    e.preventDefault();
    // Check for View Transitions API support
    const isTransitionSupported = 
      typeof document !== 'undefined' && 
      document.startViewTransition !== undefined;

    const nextTheme = isDark ? "light" : "dark";

    if (!isTransitionSupported) {
      setTheme(nextTheme);
      return;
    }

    // Set transition class based on target theme
    const transitionClass = nextTheme === 'dark' ? 'wipe-to-dark' : 'wipe-to-light';
    document.documentElement.classList.add(transitionClass);

    // Trigger the view transition
    const transition = document.startViewTransition(() => {
      setTheme(nextTheme);
    });

    // Clean up class after transition
    transition.finished.finally(() => {
      document.documentElement.classList.remove(transitionClass);
    });
  };

  return (
    <div
      onClick={handleToggle}
      className="w-10 h-10 rounded-lg flex items-center justify-center border-2 cursor-pointer"
      style={{
        backgroundColor: !isDark ? '#1a2a4a' : '#ffffff',
        color: !isDark ? '#ffffff' : '#1a2a4a',
        borderColor: !isDark ? '#1a2a4a' : '#ffffff'
      }}
      role="button"
      tabIndex={0}
      aria-label="Toggle Theme"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      {isDark ? (
        <span className="material-symbols-outlined text-[20px]">light_mode</span>
      ) : (
        <span className="material-symbols-outlined text-[20px]">dark_mode</span>
      )}
    </div>
  );
}
