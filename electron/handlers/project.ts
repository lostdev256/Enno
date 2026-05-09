import {ipcMain, dialog} from 'electron'

import {enno} from './../enno'

export function registerProjectIpcHandlers() {
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
}
