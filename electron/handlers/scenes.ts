import {ipcMain, dialog} from 'electron'

import {enno} from './../enno'

export function registerScenesIpcHandlers() {
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
}
