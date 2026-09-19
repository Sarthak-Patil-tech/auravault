'use strict';

/**
 * AuraVault — preload.
 *
 * A minimal, explicitly allow-listed bridge between the renderer and the
 * main process. `contextIsolation` + `sandbox` are ON: the renderer has no
 * access to Node, only to these promise-based functions.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

function subscribe(channel, cb) {
  const listener = (...args) => cb(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('vault', {
  mode: 'electron',

  // synchronous, used once at startup to avoid a theme flash
  getThemeSync: () => ipcRenderer.sendSync('theme:get-sync'),

  status: () => invoke('vault:status'),
  createVault: (masterPassword) => invoke('vault:create', masterPassword),
  unlock: (masterPassword) => invoke('vault:unlock', masterPassword),
  lock: () => invoke('vault:lock'),

  getItems: () => invoke('vault:getItems'),
  upsertItem: (item) => invoke('vault:upsertItem', item),
  setFavorite: (id, fav) => invoke('vault:setFavorite', id, fav),
  trashItem: (id) => invoke('vault:trashItem', id),
  restoreItem: (id) => invoke('vault:restoreItem', id),
  deleteItemForever: (id) => invoke('vault:deleteItemForever', id),
  emptyTrash: () => invoke('vault:emptyTrash'),

  generatePassword: (opts) => invoke('vault:generatePassword', opts),
  changeMaster: (current, next) => invoke('vault:changeMaster', current, next),

  exportBackup: () => invoke('vault:export'),
  importPick: () => invoke('vault:importPick'),
  importWithPassword: (password, blob) => invoke('vault:importWithPassword', password, blob),

  copy: (text) => invoke('clipboard:write', text),
  getSettings: () => invoke('settings:get'),
  setSettings: (patch) => invoke('settings:set', patch),
  openExternal: (url) => invoke('app:openExternal', url),

  winMinimize: () => invoke('win:minimize'),
  winMaximize: () => invoke('win:maximize'),
  winClose: () => invoke('win:closeRequest'),
  closeNow: () => { try { ipcRenderer.send('win:closeNow'); } catch { /* shutting down */ } },

  activity: () => { try { ipcRenderer.send('activity'); } catch { /* shutting down */ } },

  onLocked: (cb) => subscribe('vault:locked', cb),
  onClipboardCleared: (cb) => subscribe('clipboard:cleared', cb),
  onClosing: (cb) => subscribe('app:closing', cb),
  onMaximized: (cb) => subscribe('win:maximized', cb),
});
