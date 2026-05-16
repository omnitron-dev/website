/**
 * Chunk-load-error recovery.
 *
 * Docusaurus is a single-page app whose route handlers are split into
 * lazily-loaded webpack chunks. When a user visits the site and stays
 * on it, their cached HTML pins the chunk hashes that existed at
 * fetch time. If a new deploy ships before they navigate (or reload),
 * the next route push triggers a chunk import for a file that no
 * longer exists on the server — webpack throws `ChunkLoadError`.
 *
 * The fix is to detect this specific failure and force a hard reload,
 * which re-fetches the current HTML with the new chunk hashes. We
 * reload at most once per session (via sessionStorage flag) so we
 * never get caught in a loop if the failure is real.
 *
 * @see https://docusaurus.io/docs/advanced/client#client-modules
 */

const RELOAD_FLAG_KEY = 'omni:chunk-error-reloaded';

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name;
  const message = error.message;
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk \S+ failed/.test(message) ||
    /Loading CSS chunk \S+ failed/.test(message) ||
    /Failed to fetch dynamically imported module/.test(message)
  );
}

function attemptRecovery(source: string): void {
  // Guard against reload loops: if we've already reloaded once this
  // session and the error fires again, surface it instead of looping.
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(RELOAD_FLAG_KEY) === '1') {
      // Already tried; let the user see the error.
      console.warn(`[omni] chunk-error-handler: already reloaded once this session, surfacing the error (${source})`);
      return;
    }
    window.sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
  } catch {
    // sessionStorage may be blocked (private mode, etc.) — proceed without the guard.
  }
  // `location.reload()` re-fetches the HTML; the new HTML references
  // the current chunk hashes.
  window.location.reload();
}

if (typeof window !== 'undefined') {
  // Catch synchronous + thrown errors from the chunk loader.
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error)) {
      attemptRecovery('window.error');
    }
  });

  // Catch the more common case — dynamic import failures surface as
  // unhandled promise rejections.
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      attemptRecovery('unhandledrejection');
    }
  });
}
