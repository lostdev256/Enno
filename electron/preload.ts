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

    // --------- Project State ---------
    onProjectStateChange(callback: (state: { isOpen: boolean, filePath: string | null, projectName: string | null }) => void) {
        ipcRenderer.on('project:state-changed', (_event, state) => callback(state))
    },
    offProjectStateChange() {
        ipcRenderer.removeAllListeners('project:state-changed')
    },

    // --------- File Operations ---------
    createProject() {
        return ipcRenderer.invoke('file:create')
    },
    openProject() {
        return ipcRenderer.invoke('file:open')
    },
    saveProject() {
        return ipcRenderer.invoke('file:save')
    },
    saveProjectAs() {
        return ipcRenderer.invoke('file:save-as')
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
    removeGalleryImage(characterId: string, imageId: string) {
        return ipcRenderer.invoke('characters:gallery:remove', characterId, imageId)
    },

    // --------- Board & Links ---------
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

    // --------- Locations API ---------
    getLocationsTree() {
        return ipcRenderer.invoke('locations:get-tree')
    },
    getLocation(id: string) {
        return ipcRenderer.invoke('locations:get', id)
    },
    createLocation(parentId: string | null) {
        return ipcRenderer.invoke('locations:create', parentId)
    },
    updateLocation(id: string, field: string, value: any) {
        return ipcRenderer.invoke('locations:update', id, field, value)
    },
    deleteLocation(id: string) {
        return ipcRenderer.invoke('locations:delete', id)
    },
    updateLocationsStructure(updates: any[]) {
        return ipcRenderer.invoke('locations:structure:update', updates)
    },
    uploadLocationMapImage(id: string) {
        return ipcRenderer.invoke('locations:map:upload', id)
    },
    updateLocationMapCoords(id: string, x: number, y: number) {
        return ipcRenderer.invoke('locations:map:update-coords', id, x, y)
    },

    // --------- Scenes API ---------
    getScenesList() {
        return ipcRenderer.invoke('scenes:list')
    },
    createScene() {
        return ipcRenderer.invoke('scenes:create')
    },
    getScene(id: string) {
        return ipcRenderer.invoke('scenes:get', id)
    },
    updateScene(id: string, field: string, value: string) {
        return ipcRenderer.invoke('scenes:update', id, field, value)
    },
    deleteScene(id: string) {
        return ipcRenderer.invoke('scenes:delete', id)
    },
    reorderScenes(order: any) {
        return ipcRenderer.invoke('scenes:reorder', order)
    },
    createSceneGroup(name: string) {
        return ipcRenderer.invoke('scenes:group:create', name)
    },
    deleteSceneGroup(id: string) {
        return ipcRenderer.invoke('scenes:group:delete', id)
    },
    renameSceneGroup(id: string, name: string) {
        return ipcRenderer.invoke('scenes:group:rename', id, name)
    },
    addSceneCharacter(sceneId: string, characterId: string) {
        return ipcRenderer.invoke('scenes:characters:add', sceneId, characterId)
    },
    removeSceneCharacter(sceneId: string, characterId: string) {
        return ipcRenderer.invoke('scenes:characters:remove', sceneId, characterId)
    },
    createSceneAction(sceneId: string, actionType: string, x: number, y: number) {
        return ipcRenderer.invoke('scenes:actions:create', sceneId, actionType, x, y)
    },
    updateSceneAction(id: string, data: string) {
        return ipcRenderer.invoke('scenes:actions:update', id, data)
    },
    moveSceneAction(id: string, x: number, y: number) {
        return ipcRenderer.invoke('scenes:actions:move', id, x, y)
    },
    deleteSceneAction(id: string) {
        return ipcRenderer.invoke('scenes:actions:delete', id)
    },
    addSceneActionGallery(actionId: string) {
        return ipcRenderer.invoke('scenes:actions:gallery:add', actionId)
    },
    removeSceneActionGallery(imageId: string) {
        return ipcRenderer.invoke('scenes:actions:gallery:remove', imageId)
    },
    createSceneConnection(sceneId: string, sourceActionId: string, sourcePin: string, targetActionId: string, targetPin: string) {
        return ipcRenderer.invoke('scenes:connections:create', sceneId, sourceActionId, sourcePin, targetActionId, targetPin)
    },
    deleteSceneConnection(id: string) {
        return ipcRenderer.invoke('scenes:connections:delete', id)
    },

    // --------- Quests API ---------
    getQuestsList() {
        return ipcRenderer.invoke('quests:list')
    },
    createQuest(parentId?: string, groupId?: string) {
        return ipcRenderer.invoke('quests:create', parentId, groupId)
    },
    getQuest(id: string) {
        return ipcRenderer.invoke('quests:get', id)
    },
    updateQuest(id: string, field: string, value: string) {
        return ipcRenderer.invoke('quests:update', id, field, value)
    },
    deleteQuest(id: string) {
        return ipcRenderer.invoke('quests:delete', id)
    },
    reorderQuests(order: any) {
        return ipcRenderer.invoke('quests:reorder', order)
    },
    createQuestGroup(name: string) {
        return ipcRenderer.invoke('quests:group:create', name)
    },
    deleteQuestGroup(id: string) {
        return ipcRenderer.invoke('quests:group:delete', id)
    },
    renameQuestGroup(id: string, name: string) {
        return ipcRenderer.invoke('quests:group:rename', id, name)
    },
    uploadQuestIcon(questId: string) {
        return ipcRenderer.invoke('quests:icon:upload', questId)
    },
    addQuestGallery(questId: string) {
        return ipcRenderer.invoke('quests:gallery:add', questId)
    },
    removeQuestGallery(imageId: string) {
        return ipcRenderer.invoke('quests:gallery:remove', imageId)
    },
    updateQuestsStructure(updates: any[]) {
        return ipcRenderer.invoke('quests:structure:update', updates)
    },
    getAllQuestsFlat() {
        return ipcRenderer.invoke('quests:all-flat')
    },

    // --------- Storyline API ---------
    getStorylineData() {
        return ipcRenderer.invoke('storyline:get')
    },
    addStorylineNode(nodeType: string, refId: string | null, groupId: string | null, x: number, y: number, data?: string) {
        return ipcRenderer.invoke('storyline:node:add', nodeType, refId, groupId, x, y, data)
    },
    updateStorylineNode(id: string, x: number, y: number, groupId?: string | null) {
        return ipcRenderer.invoke('storyline:node:update', id, x, y, groupId)
    },
    updateStorylineNodeData(id: string, data: string) {
        return ipcRenderer.invoke('storyline:node:update-data', id, data)
    },
    deleteStorylineNode(id: string) {
        return ipcRenderer.invoke('storyline:node:delete', id)
    },
    createStorylineConnection(sourceNodeId: string, sourcePin: string, targetNodeId: string, targetPin: string) {
        return ipcRenderer.invoke('storyline:connection:create', sourceNodeId, sourcePin, targetNodeId, targetPin)
    },
    deleteStorylineConnection(id: string) {
        return ipcRenderer.invoke('storyline:connection:delete', id)
    },
    updateStorylineGroupPosition(groupId: string, x: number, y: number, width: number, height: number) {
        return ipcRenderer.invoke('storyline:group-position:update', groupId, x, y, width, height)
    },
})
