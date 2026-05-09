import {ipcRenderer} from 'electron'

export const charactersApi = {
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

    createGroup(name: string) {
        return ipcRenderer.invoke('characters:group:create', name)
    },
    deleteGroup(id: string) {
        return ipcRenderer.invoke('characters:group:delete', id)
    },
    renameGroup(id: string, newName: string) {
        return ipcRenderer.invoke('characters:group:rename', id, newName)
    },

    uploadAvatar(characterId: string) {
        return ipcRenderer.invoke('characters:avatar:upload', characterId)
    },
    addGalleryImages(characterId: string) {
        return ipcRenderer.invoke('characters:gallery:add', characterId)
    },
    removeGalleryImage(characterId: string, imageId: string) {
        return ipcRenderer.invoke('characters:gallery:remove', characterId, imageId)
    },

    getBoardData() {
        return ipcRenderer.invoke('characters:board:get')
    },
    addBoardNode(characterId: string, x: number, y: number) {
        return ipcRenderer.invoke('characters:board:addNode', characterId, x, y)
    },
    updateBoardNode(characterId: string, x: number, y: number) {
        return ipcRenderer.invoke('characters:board:updateNodePosition', characterId, x, y)
    },
    removeBoardNode(characterId: string) {
        return ipcRenderer.invoke('characters:board:removeNode', characterId)
    },

    createLinkMode(name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string) {
        return ipcRenderer.invoke('characters:linkModes:create', name, maxLinks, dataType, settings)
    },
    updateLinkMode(id: string, name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string) {
        return ipcRenderer.invoke('characters:linkModes:update', id, name, maxLinks, dataType, settings)
    },
    deleteLinkMode(id: string) {
        return ipcRenderer.invoke('characters:linkModes:delete', id)
    },
    reorderLinkModes(modeIds: string[]) {
        return ipcRenderer.invoke('characters:linkModes:reorder', modeIds)
    },

    createLink(modeId: string, sourceId: string, targetId: string, value: string) {
        return ipcRenderer.invoke('characters:links:create', modeId, sourceId, targetId, value)
    },
    updateLink(id: string, value: string) {
        return ipcRenderer.invoke('characters:links:update', id, value)
    },
    deleteLink(id: string) {
        return ipcRenderer.invoke('characters:links:delete', id)
    },
}
