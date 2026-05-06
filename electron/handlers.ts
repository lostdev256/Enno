import {ipcMain, dialog} from 'electron'

import {enno} from './enno'

export function registerIpcHandlers() {
// --------- File IPC Handlers ---------

    ipcMain.handle('file:create', async () => {
        console.log('[IPC] file:create')
        const result = await dialog.showSaveDialog({
            title: 'Create Enno Project',
            defaultPath: 'Untitled.ennodb',
            filters: [{name: 'Enno Database', extensions: ['ennodb']}],
        })
        if (result.canceled || !result.filePath) return {success: false, cancelled: true}

        try {
            enno.db.create(result.filePath)
            enno.store.set('lastOpenedFile', result.filePath)
            enno.wnd.notifyProjectState()
            return {success: true, filePath: result.filePath}
        } catch (err: any) {
            return {success: false, error: err.message}
        }
    })

    ipcMain.handle('file:open', async () => {
        console.log('[IPC] file:open')
        const result = await dialog.showOpenDialog({
            title: 'Open Enno Project',
            properties: ['openFile'],
            filters: [{name: 'Enno Database', extensions: ['ennodb']}],
        })
        if (result.canceled || result.filePaths.length === 0) return {success: false, cancelled: true}

        try {
            enno.db.open(result.filePaths[0])
            enno.store.set('lastOpenedFile', result.filePaths[0])
            enno.wnd.notifyProjectState()
            return {success: true, filePath: result.filePaths[0]}
        } catch (err: any) {
            return {success: false, error: err.message}
        }
    })

    ipcMain.handle('file:save', async () => {
        console.log('[IPC] file:save')
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        try {
            enno.db.save()
            return {success: true}
        } catch (err: any) {
            return {success: false, error: err.message}
        }
    })

    ipcMain.handle('file:save-as', async () => {
        console.log('[IPC] file:save-as')
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}

        const result = await dialog.showSaveDialog({
            title: 'Save Enno Project As',
            defaultPath: enno.db.projectName || 'Untitled.ennodb',
            filters: [{name: 'Enno Database', extensions: ['ennodb']}],
        })
        if (result.canceled || !result.filePath) return {success: false, cancelled: true}

        try {
            enno.db.saveAs(result.filePath)
            enno.store.set('lastOpenedFile', result.filePath)
            enno.wnd.notifyProjectState()
            return {success: true, filePath: result.filePath}
        } catch (err: any) {
            return {success: false, error: err.message}
        }
    })

// --------- Help ---------

    ipcMain.handle('help:about', async () => {
        console.log('[IPC] help:about')
        return {name: 'Enno', version: '0.1.0'}
    })

// --------- Character IPC Handlers ---------

    ipcMain.handle('characters:list', async () => {
        console.log('[IPC] characters:list')
        if (!enno.db.isOpen) return {groups: [], ungrouped: []}
        return enno.db.getCharactersList()
    })

    ipcMain.handle('characters:get', async (_event, id: string) => {
        console.log(`[IPC] characters:get — ${id}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        const character = enno.db.getCharacter(id)
        if (!character) return {success: false, error: 'Character not found'}
        return {success: true, character}
    })

    ipcMain.handle('characters:create', async () => {
        console.log('[IPC] characters:create')
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        const character = enno.db.createCharacter()
        return {success: true, character}
    })

    ipcMain.handle('characters:update', async (_event, id: string, field: string, value: string) => {
        console.log(`[IPC] characters:update — ${id}.${field}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        const ok = enno.db.updateCharacter(id, field, value)
        return {success: ok}
    })

    ipcMain.handle('characters:delete', async (_event, id: string) => {
        console.log(`[IPC] characters:delete — ${id}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        const ok = enno.db.deleteCharacter(id)
        return {success: ok}
    })

    ipcMain.handle('characters:reorder', async (_event, order) => {
        console.log('[IPC] characters:reorder')
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        enno.db.reorderCharacters(order)
        return {success: true}
    })

// --------- Group IPC Handlers ---------

    ipcMain.handle('characters:group:create', async (_event, name: string) => {
        console.log(`[IPC] characters:group:create — ${name}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        const group = enno.db.createGroup(name)
        return {success: true, group: {...group, expanded: true, characters: []}}
    })

    ipcMain.handle('characters:group:delete', async (_event, groupId: string) => {
        console.log(`[IPC] characters:group:delete — ${groupId}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        const ok = enno.db.deleteGroup(groupId)
        return {success: ok}
    })

    ipcMain.handle('characters:group:rename', async (_event, groupId: string, newName: string) => {
        console.log(`[IPC] characters:group:rename — ${groupId} → ${newName}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}
        const ok = enno.db.renameGroup(groupId, newName)
        return {success: ok}
    })

// --------- Avatar & Gallery IPC Handlers ---------

    ipcMain.handle('characters:avatar:upload', async (_event, characterId: string) => {
        console.log(`[IPC] characters:avatar:upload — ${characterId}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}

        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']}],
        })
        if (result.canceled || result.filePaths.length === 0) return {success: false, cancelled: true}

        const avatarUrl = enno.db.importAvatar(characterId, result.filePaths[0])
        return {success: true, path: avatarUrl}
    })

    ipcMain.handle('characters:gallery:add', async (_event, characterId: string) => {
        console.log(`[IPC] characters:gallery:add — ${characterId}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}

        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']}],
        })
        if (result.canceled || result.filePaths.length === 0) return {success: false, cancelled: true}

        const images = enno.db.importGalleryImages(characterId, result.filePaths)
        return {success: true, images}
    })

    ipcMain.handle('characters:gallery:remove', async (_event, _characterId: string, imageId: string) => {
        console.log(`[IPC] characters:gallery:remove — ${imageId}`)
        if (!enno.db.isOpen) return {success: false, error: 'No project open'}

        const ok = enno.db.removeGalleryImage(imageId)
        return {success: ok}
    })

// --------- Board & Links Handlers ---------

    ipcMain.handle('characters:board:get', async () => {
        if (!enno.db.isOpen) return null
        return enno.db.getBoardData()
    })

    ipcMain.handle('characters:board:addNode', async (_event, characterId: string, x: number, y: number) => {
        if (!enno.db.isOpen) return false
        return enno.db.addBoardNode(characterId, x, y)
    })

    ipcMain.handle('characters:board:updateNodePosition', async (_event, characterId: string, x: number, y: number) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateBoardNode(characterId, x, y)
    })

    ipcMain.handle('characters:board:removeNode', async (_event, characterId: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.removeBoardNode(characterId)
    })

    ipcMain.handle('characters:linkModes:create', async (_event, name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.createLinkMode(name, maxLinks, dataType, settings)
    })

    ipcMain.handle('characters:linkModes:update', async (_event, id: string, name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateLinkMode(id, name, maxLinks, dataType, settings)
    })

    ipcMain.handle('characters:linkModes:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteLinkMode(id)
    })

    ipcMain.handle('characters:linkModes:reorder', async (_event, modeIds: string[]) => {
        if (!enno.db.isOpen) return false
        enno.db.reorderLinkModes(modeIds)
        return true
    })

    ipcMain.handle('characters:links:create', async (_event, modeId: string, sourceId: string, targetId: string, value: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.createLink(modeId, sourceId, targetId, value)
    })

    ipcMain.handle('characters:links:update', async (_event, id: string, value: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateLink(id, value)
    })

    ipcMain.handle('characters:links:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteLink(id)
    })

// --------- Locations IPC Handlers ---------

    ipcMain.handle('locations:get-tree', async () => {
        if (!enno.db.isOpen) return []
        return enno.db.getLocationsTree()
    })

    ipcMain.handle('locations:get', async (_event, id: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.getLocation(id)
    })

    ipcMain.handle('locations:create', async (_event, parentId: string | null) => {
        if (!enno.db.isOpen) return null
        return enno.db.createLocation(parentId)
    })

    ipcMain.handle('locations:update', async (_event, id: string, field: string, value: any) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateLocation(id, field, value)
    })

    ipcMain.handle('locations:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteLocation(id)
    })

    ipcMain.handle('locations:structure:update', async (_event, updates: any[]) => {
        if (!enno.db.isOpen) return false
        enno.db.updateLocationsStructure(updates)
        return true
    })

    ipcMain.handle('locations:map:upload', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        const result = await dialog.showOpenDialog({
            title: 'Select Map Image',
            properties: ['openFile'],
            filters: [{name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg']}],
        })
        if (result.canceled || result.filePaths.length === 0) return false
        return enno.db.updateLocation(id, 'map_image_path', result.filePaths[0])
    })

    ipcMain.handle('locations:map:update-coords', async (_event, id: string, x: number, y: number) => {
        if (!enno.db.isOpen) return false
        enno.db.updateLocation(id, 'map_x', x)
        return enno.db.updateLocation(id, 'map_y', y)
    })

// --------- Scenes IPC Handlers ---------

    ipcMain.handle('scenes:list', async () => {
        if (!enno.db.isOpen) return {groups: [], ungrouped: []}
        return enno.db.getScenesList()
    })

    ipcMain.handle('scenes:create', async () => {
        if (!enno.db.isOpen) return null
        return enno.db.createScene()
    })

    ipcMain.handle('scenes:get', async (_event, id: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.getScene(id)
    })

    ipcMain.handle('scenes:update', async (_event, id: string, field: string, value: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateScene(id, field, value)
    })

    ipcMain.handle('scenes:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteScene(id)
    })

    ipcMain.handle('scenes:reorder', async (_event, order: any) => {
        if (!enno.db.isOpen) return false
        enno.db.reorderScenes(order)
        return true
    })

    ipcMain.handle('scenes:group:create', async (_event, name: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.createSceneGroup(name)
    })

    ipcMain.handle('scenes:group:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteSceneGroup(id)
    })

    ipcMain.handle('scenes:group:rename', async (_event, id: string, name: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.renameSceneGroup(id, name)
    })

    ipcMain.handle('scenes:characters:add', async (_event, sceneId: string, characterId: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.addSceneCharacter(sceneId, characterId)
    })

    ipcMain.handle('scenes:characters:remove', async (_event, sceneId: string, characterId: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.removeSceneCharacter(sceneId, characterId)
    })

    ipcMain.handle('scenes:actions:create', async (_event, sceneId: string, actionType: string, x: number, y: number) => {
        if (!enno.db.isOpen) return null
        return enno.db.createSceneAction(sceneId, actionType, x, y)
    })

    ipcMain.handle('scenes:actions:update', async (_event, id: string, data: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateSceneAction(id, data)
    })

    ipcMain.handle('scenes:actions:move', async (_event, id: string, x: number, y: number) => {
        if (!enno.db.isOpen) return false
        return enno.db.moveSceneAction(id, x, y)
    })

    ipcMain.handle('scenes:actions:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteSceneAction(id)
    })

    ipcMain.handle('scenes:actions:gallery:add', async (_event, actionId: string) => {
        if (!enno.db.isOpen) return {success: false}
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']}],
        })
        if (result.canceled || result.filePaths.length === 0) return {success: false}
        const images = enno.db.importSceneActionGallery(actionId, result.filePaths)
        return {success: true, images}
    })

    ipcMain.handle('scenes:actions:gallery:remove', async (_event, imageId: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.removeSceneActionGalleryImage(imageId)
    })

    ipcMain.handle('scenes:connections:create', async (_event, sceneId: string, sourceActionId: string, sourcePin: string, targetActionId: string, targetPin: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.createSceneConnection(sceneId, sourceActionId, sourcePin, targetActionId, targetPin)
    })

    ipcMain.handle('scenes:connections:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteSceneConnection(id)
    })

// --------- Quests IPC Handlers ---------

    ipcMain.handle('quests:list', async () => {
        if (!enno.db.isOpen) return {groups: [], ungrouped: []}
        return enno.db.getQuestsList()
    })

    ipcMain.handle('quests:create', async (_event, parentId?: string, groupId?: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.createQuest(parentId, groupId)
    })

    ipcMain.handle('quests:get', async (_event, id: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.getQuest(id)
    })

    ipcMain.handle('quests:update', async (_event, id: string, field: string, value: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateQuest(id, field, value)
    })

    ipcMain.handle('quests:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteQuest(id)
    })

    ipcMain.handle('quests:reorder', async (_event, order: any) => {
        if (!enno.db.isOpen) return false
        enno.db.reorderQuests(order)
        return true
    })

    ipcMain.handle('quests:group:create', async (_event, name: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.createQuestGroup(name)
    })

    ipcMain.handle('quests:group:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteQuestGroup(id)
    })

    ipcMain.handle('quests:group:rename', async (_event, id: string, name: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.renameQuestGroup(id, name)
    })

    ipcMain.handle('quests:icon:upload', async (_event, questId: string) => {
        if (!enno.db.isOpen) return {success: false}
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']}],
        })
        if (result.canceled || result.filePaths.length === 0) return {success: false}
        const iconUrl = enno.db.importQuestIcon(questId, result.filePaths[0])
        return {success: true, path: iconUrl}
    })

    ipcMain.handle('quests:gallery:add', async (_event, questId: string) => {
        if (!enno.db.isOpen) return {success: false}
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']}],
        })
        if (result.canceled || result.filePaths.length === 0) return {success: false}
        const images = enno.db.importQuestGallery(questId, result.filePaths)
        return {success: true, images}
    })

    ipcMain.handle('quests:gallery:remove', async (_event, imageId: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.removeQuestGalleryImage(imageId)
    })

    ipcMain.handle('quests:structure:update', async (_event, updates: any[]) => {
        if (!enno.db.isOpen) return false
        enno.db.updateQuestsStructure(updates)
        return true
    })

    ipcMain.handle('quests:all-flat', async () => {
        if (!enno.db.isOpen) return []
        return enno.db.getAllQuestsFlat()
    })

// --------- Storyline IPC Handlers ---------

    ipcMain.handle('storyline:get', async () => {
        if (!enno.db.isOpen) return null
        return enno.db.getStorylineData()
    })

    ipcMain.handle('storyline:node:add', async (_event, nodeType: string, refId: string | null, groupId: string | null, x: number, y: number, data?: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.addStorylineNode(nodeType, refId, groupId, x, y, data)
    })

    ipcMain.handle('storyline:node:update', async (_event, id: string, x: number, y: number, groupId?: string | null) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateStorylineNode(id, x, y, groupId)
    })

    ipcMain.handle('storyline:node:update-data', async (_event, id: string, data: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.updateStorylineNodeData(id, data)
    })

    ipcMain.handle('storyline:node:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteStorylineNode(id)
    })

    ipcMain.handle('storyline:connection:create', async (_event, sourceNodeId: string, sourcePin: string, targetNodeId: string, targetPin: string) => {
        if (!enno.db.isOpen) return null
        return enno.db.createStorylineConnection(sourceNodeId, sourcePin, targetNodeId, targetPin)
    })

    ipcMain.handle('storyline:connection:delete', async (_event, id: string) => {
        if (!enno.db.isOpen) return false
        return enno.db.deleteStorylineConnection(id)
    })

    ipcMain.handle('storyline:group-position:update', async (_event, groupId: string, x: number, y: number, width: number, height: number) => {
        if (!enno.db.isOpen) return false
        enno.db.updateStorylineGroupPosition(groupId, x, y, width, height)
        return true
    })
}
