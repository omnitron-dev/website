import type { ThemeMode } from '@omnitron-dev/prism/theme';

export function readThemePreference(): ThemeMode {
  try {
    const value = localStorage.getItem('omnitron-theme');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

// Parse-blocking initial paint only. PrismProvider owns all live media changes.
// The script is constant; storage values are never inserted into HTML or code.
export const themeBootstrap = `(function(){
  var saved;
  try { saved = localStorage.getItem('omnitron-theme'); } catch (_) {}
  var mode = saved === 'light' || saved === 'dark' ? saved :
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-omnitron-theme', mode);
  document.documentElement.style.colorScheme = mode;
})();`;
