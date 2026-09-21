'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only channel between the launcher UI and the main process.
 *
 * Everything is an explicit, named call -- the renderer never gets a handle to
 * ipcRenderer itself, so it cannot invent new messages, and the main process
 * validates every argument regardless.
 */

const VALID_EVENTS = new Set(['state', 'apps', 'blocked', 'toast']);

contextBridge.exposeInMainWorld('sukhi', {
  /** Initial payload: catalog, settings, version, paths. */
  ready: () => ipcRenderer.invoke('shell:ready'),

  /** Open one of the catalog entries. */
  launch: (appId) => ipcRenderer.invoke('shell:launch', String(appId)),

  /** Close the game and go back to the tile screen. */
  goHome: () => ipcRenderer.invoke('shell:go-home'),

  /** Ask the main process to show the grown-up exit gate. */
  openGate: (intent) => ipcRenderer.invoke('shell:open-gate', String(intent || 'exit')),

  /** Back out of the exit gate. */
  closeGate: () => ipcRenderer.invoke('shell:close-gate'),

  /** Ask for the addition, when the way in is a sum. */
  gateQuestion: () => ipcRenderer.invoke('shell:gate-question'),

  /** Tell main the hold finished. Main times it and decides. */
  completeHold: () => ipcRenderer.invoke('shell:complete-hold'),

  /** Submit a PIN, only used when gateMode is "pin". Resolves { ok, message }. */
  answerGate: (answer) => ipcRenderer.invoke('shell:answer-gate', String(answer)),

  /** Hold only, or hold and a sum, before the grown-up screen opens. */
  setGateMode: (mode) => ipcRenderer.invoke('shell:set-gate-mode', String(mode)),


  /** Add minutes to the session that just ran out. Parent only. */
  moreTime: (minutes) => ipcRenderer.invoke('shell:more-time', Number(minutes)),

  /** Set how long a session lasts, in minutes. 0 is no limit. Parent only. */
  setSessionMinutes: (minutes) => ipcRenderer.invoke('shell:set-session-minutes', Number(minutes)),

  /** Wipe everything back to a first run. Relaunches the app. */
  resetEverything: () => ipcRenderer.invoke('shell:reset-everything'),

  /** Ask GitHub whether a newer release exists. Reports only. */
  checkUpdate: () => ipcRenderer.invoke('shell:check-update'),

  /** Open the releases page in the normal browser. */
  openReleases: () => ipcRenderer.invoke('shell:open-releases'),

  /** Close the whole app. Only works after the gate has been answered. */
  quitApp: () => ipcRenderer.invoke('shell:quit'),

  /** Enter the first-run walkthrough. */
  beginOnboarding: () => ipcRenderer.invoke('shell:begin-onboarding'),

  /** Mark the walkthrough done and go to the tile screen. */
  finishOnboarding: () => ipcRenderer.invoke('shell:finish-onboarding'),

  /** Keep the walkthrough's unlock alive while the parent works through it. */
  keepUnlocked: () => ipcRenderer.invoke('shell:keep-unlocked'),

  /** The grown-up library: my sites plus the bundled suggestions. */
  library: () => ipcRenderer.invoke('shell:library'),

  /** Is this address already set up? Asked before the slow probe. */
  siteExists: (url) => ipcRenderer.invoke('shell:site-exists', String(url)),

  /** Visit a site once and report the hosts it needs. */
  probeSite: (url) => ipcRenderer.invoke('shell:probe-site', String(url)),

  /** Add a site discovered by probeSite. */
  addSite: (entry) => ipcRenderer.invoke('shell:add-site', entry),

  /** Change a site (enable/disable, ad filtering, title). */
  updateSite: (id, patch) => ipcRenderer.invoke('shell:update-site', String(id), patch),

  /** Delete a site. */
  removeSite: (id) => ipcRenderer.invoke('shell:remove-site', String(id)),

  /** Renderer signals it has finished booting (used by --check). */
  rendererIdle: () => ipcRenderer.send('shell:renderer-idle'),

  /** Renderer confirms the launcher actually rendered. Clears the watchdog. */
  rendererReady: () => ipcRenderer.send('shell:renderer-ready'),

  /** Subscribe to main-process events. Returns an unsubscribe function. */
  on: (event, handler) => {
    if (!VALID_EVENTS.has(event) || typeof handler !== 'function') return () => {};
    const listener = (_e, payload) => handler(payload);
    ipcRenderer.on(`shell:${event}`, listener);
    return () => ipcRenderer.removeListener(`shell:${event}`, listener);
  }
});
