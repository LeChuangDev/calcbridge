import { useTheme } from '@/shared/lib/providers/ThemeProvider';

/** 页头主题开关：深色 / 浅色一键切换。 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? '浅色' : '深色';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title={`切换到${next}主题`}
      aria-label={`切换到${next}主题`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '◐' : '◑'}</span>
    </button>
  );
}
