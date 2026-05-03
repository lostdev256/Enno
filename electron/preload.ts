import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },

    // You can expose other APTs you need here.
    // ...
})

// --------- Enno-specific API ---------
contextBridge.exposeInMainWorld('ennoAPI', {
    /** Subscribe to menu actions triggered from the native menu bar */
    onMenuAction(callback: (action: string) => void) {
        ipcRenderer.on('menu:action', (_event, action: string) => callback(action))
    },
    /** Invoke a backend handler for a menu action */
    invokeMenuAction(action: string) {
        return ipcRenderer.invoke(action)
    },

    // --------- Characters API ---------
    getCharactersList() {
        return ipcRenderer.invoke('characters:list')
    },
    getCharacter(id: string) {
        return ipcRenderer.invoke('characters:get', id)
    },
    createCharacter() {
        return ipcRenderer.invoke('characters:create')
    },
    updateCharacter(id: string, field: string, value: string) {
        return ipcRenderer.invoke('characters:update', id, field, value)
    },
    deleteCharacter(id: string) {
        return ipcRenderer.invoke('characters:delete', id)
    },
    reorderCharacters(order: { groups: { id: string, characterIds: string[] }[], ungroupedIds: string[] }) {
        return ipcRenderer.invoke('characters:reorder', order)
    },

    // --------- Groups API ---------
    createGroup(name: string) {
        return ipcRenderer.invoke('characters:group:create', name)
    },
    deleteGroup(id: string) {
        return ipcRenderer.invoke('characters:group:delete', id)
    },
    renameGroup(id: string, newName: string) {
        return ipcRenderer.invoke('characters:group:rename', id, newName)
    },

    // --------- Avatar & Gallery API ---------
    uploadAvatar(characterId: string) {
        return ipcRenderer.invoke('characters:avatar:upload', characterId)
    },
    addGalleryImages(characterId: string) {
        return ipcRenderer.invoke('characters:gallery:add', characterId)
    },
    removeGalleryImage(characterId: string, imageIndex: number) {
        return ipcRenderer.invoke('characters:gallery:remove', characterId, imageIndex)
    },
})
