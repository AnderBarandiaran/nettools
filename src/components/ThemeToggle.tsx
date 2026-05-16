import { useState, useEffect } from 'react';

function SunMoonIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M6.5 2V1M6.5 12v-1M2 6.5H1M12 6.5h-1M3.4 3.4l-.7-.7M10.3 10.3l-.7-.7M9.6 3.4l.7-.7M2.7 10.3l.7-.7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" style={{ opacity: isDark ? 0 : 1, transition: 'opacity 200ms ease' }} />
      <path d="M6.5 2a4.5 4.5 0 0 0 0 9 3.5 3.5 0 0 1 0-9z" fill="currentColor" style={{ opacity: isDark ? 1 : 0, transition: 'opacity 200ms ease' }} />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('nt-theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
    } else {
      setTheme('dark');
    }
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('nt-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  if (!mounted) {
    return (
      <div
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: '50%',
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-3)',
        cursor: 'pointer',
        transition: 'color 150ms ease, border-color 150ms ease, background-color 150ms ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = 'var(--text-1)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = 'var(--text-3)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      }}
    >
      <SunMoonIcon isDark={theme === 'dark'} />
    </button>
  );
}
