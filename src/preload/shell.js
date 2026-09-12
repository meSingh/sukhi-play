'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only channel between the launcher UI and the main process.
 *
 * Everything is an explicit, named call -- the renderer never gets a handle to
 * ipcRenderer itself, so it cannot invent new messages, and the main process
 * validates every argument regardless.
 */

const VALID_EVENTS = new Set(['state', 'blocked', 'toast']);

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

  /** Tell main the hold finished. Main times it and decides. */
  completeHold: () => ipcRenderer.invoke('shell:complete-hold'),

  /** Submit a PIN, only used when gateMode is "pin". Resolves { ok, message }. */
  answerGate: (answer) => ipcRenderer.invoke('shell:answer-gate', String(answer)),

  /** Close the whole app. Only works after the gate has been answered. */
  quitApp: () => ipcRenderer.invoke('shell:quit'),

  /** Leave the gate for the tile screen. Only works after the gate is answered. */
  goHomeUnlocked: () => ipcRenderer.invoke('shell:go-home-unlocked'),

  /** The grown-up library: my sites plus the bundled suggestions. */
  library: () => ipcRenderer.invoke('shell:library'),

  /** Visit a site once and report the hosts it needs. */
  probeSite: (url) => ipcRenderer.invoke('shell:probe-site', String(url)),

  /** Add a site discovered by probeSite. */
  addSite: (entry) => ipcRenderer.invoke('shell:add-site', entry),

  /** Add one of the bundled suggestions. */
  addSuggestion: (id) => ipcRenderer.invoke('shell:add-suggestion', String(id)),

  /** Change a site (enable/disable, ad filtering, title). */
  updateSite: (id, patch) => ipcRenderer.invoke('shell:update-site', String(id), patch),

  /** Delete a site. */
  removeSite: (id) => ipcRenderer.invoke('shell:remove-site', String(id)),

  /** Reveal the folder holding catalog.json / settings.json. */
  openConfigFolder: () => ipcRenderer.invoke('shell:open-config-folder'),

  /** Renderer signals it has finished booting (used by --check). */
  rendererIdle: () => ipcRenderer.send('shell:renderer-idle'),

  /** Subscribe to main-process events. Returns an unsubscribe function. */
  on: (event, handler) => {
    if (!VALID_EVENTS.has(event) || typeof handler !== 'function') return () => {};
    const listener = (_e, payload) => handler(payload);
    ipcRenderer.on(`shell:${event}`, listener);
    return () => ipcRenderer.removeListener(`shell:${event}`, listener);
  }
});
