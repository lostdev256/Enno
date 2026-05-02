const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    appVersion: process.versions.electron,
    sendMessage: (channel, data) => ipcRenderer.send(channel, data)
});
