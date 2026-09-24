/**
 * Registers the offline worker, where there is one to register: on the web,
 * over https. Inside Sukhi Play the app is files on a disk, served over a
 * private scheme, and there is nothing to go offline from. Guarded, so a
 * failed registration costs offline use on a second visit, never the first.
 * Not in development, where the dev server's file names never change and a
 * cache-first worker would go on serving yesterday's code.
 */
export function install (): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) {
    void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
    return;
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* a bonus, not a requirement */ });
  });
}
