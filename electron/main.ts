import { app, BrowserWindow, Menu, ipcMain, dialog, protocol, net } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import Store from 'electron-store'
import { EnnoDatabase } from './database'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.commandLine.appendSwitch('remote-debugging-port', '9222');

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// --------- Persistent Settings ---------
const store = new Store({
  defaults: {
    lastOpenedFile: null as string | null,
  },
})

// --------- Database ---------
const db = new EnnoDatabase()

function updateWindowTitle() {
  if (!win) return
  if (db.isOpen && db.projectName) {
    win.setTitle(`Enno — ${db.projectName}`)
  } else {
    win.setTitle('Enno')
  }
}

function notifyProjectState() {
  if (!win) return
  win.webContents.send('project:state-changed', {
    isOpen: db.isOpen,
    filePath: db.filePath,
    projectName: db.projectName,
  })
  updateWindowTitle()
}

// --------- Window ---------
function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
        },
    })

    // Auto-open last project after window loads
    win.webContents.on('did-finish-load', () => {
        const lastFile = store.get('lastOpenedFile') as string | null
        if (lastFile && require('fs').existsSync(lastFile)) {
            try {
                db.open(lastFile)
                notifyProjectState()
            } catch (err) {
                console.error('[Auto-open] Failed:', err)
                store.set('lastOpenedFile', null)
                notifyProjectState()
            }
        } else {
            notifyProjectState()
        }
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
}

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Clean up on quit
app.on('before-quit', () => {
    db.close()
})

// --------- Application Menu ---------
function buildMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Create',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => win?.webContents.send('menu:action', 'file:create'),
                },
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => win?.webContents.send('menu:action', 'file:open'),
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => win?.webContents.send('menu:action', 'file:save'),
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => win?.webContents.send('menu:action', 'file:save-as'),
                },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            label: 'Characters',
            submenu: [
                {
                    label: 'Cards',
                    click: () => win?.webContents.send('menu:action', 'characters:cards'),
                },
                {
                    label: 'Links',
                    click: () => win?.webContents.send('menu:action', 'characters:links'),
                },
            ],
        },
        {
            label: 'Scenes',
            submenu: [
                {
                    label: 'Editor',
                    click: () => win?.webContents.send('menu:action', 'scenes:editor'),
                },
                {
                    label: 'Storyline',
                    click: () => win?.webContents.send('menu:action', 'scenes:storyline'),
                },
            ],
        },
        {
            label: 'Quests',
            submenu: [
                {
                    label: 'Cards',
                    click: () => win?.webContents.send('menu:action', 'quests:cards'),
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => win?.webContents.send('menu:action', 'help:about'),
                },
            ],
        },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

// --------- File IPC Handlers ---------

ipcMain.handle('file:create', async () => {
    console.log('[IPC] file:create')
    const result = await dialog.showSaveDialog({
        title: 'Create Enno Project',
        defaultPath: 'Untitled.ennodb',
        filters: [{ name: 'Enno Database', extensions: ['ennodb'] }],
    })
    if (result.canceled || !result.filePath) return { success: false, cancelled: true }

    try {
        db.create(result.filePath)
        store.set('lastOpenedFile', result.filePath)
        notifyProjectState()
        return { success: true, filePath: result.filePath }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
})

ipcMain.handle('file:open', async () => {
    console.log('[IPC] file:open')
    const result = await dialog.showOpenDialog({
        title: 'Open Enno Project',
        properties: ['openFile'],
        filters: [{ name: 'Enno Database', extensions: ['ennodb'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, cancelled: true }

    try {
        db.open(result.filePaths[0])
        store.set('lastOpenedFile', result.filePaths[0])
        notifyProjectState()
        return { success: true, filePath: result.filePaths[0] }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
})

ipcMain.handle('file:save', async () => {
    console.log('[IPC] file:save')
    if (!db.isOpen) return { success: false, error: 'No project open' }
    try {
        db.save()
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
})

ipcMain.handle('file:save-as', async () => {
    console.log('[IPC] file:save-as')
    if (!db.isOpen) return { success: false, error: 'No project open' }

    const result = await dialog.showSaveDialog({
        title: 'Save Enno Project As',
        defaultPath: db.projectName || 'Untitled.ennodb',
        filters: [{ name: 'Enno Database', extensions: ['ennodb'] }],
    })
    if (result.canceled || !result.filePath) return { success: false, cancelled: true }

    try {
        db.saveAs(result.filePath)
        store.set('lastOpenedFile', result.filePath)
        notifyProjectState()
        return { success: true, filePath: result.filePath }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
})

// --------- Help ---------

ipcMain.handle('help:about', async () => {
    console.log('[IPC] help:about')
    return { name: 'Enno', version: '0.1.0' }
})

// --------- Character IPC Handlers ---------

ipcMain.handle('characters:list', async () => {
    console.log('[IPC] characters:list')
    if (!db.isOpen) return { groups: [], ungrouped: [] }
    return db.getCharactersList()
})

ipcMain.handle('characters:get', async (_event, id: string) => {
    console.log(`[IPC] characters:get — ${id}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }
    const character = db.getCharacter(id)
    if (!character) return { success: false, error: 'Character not found' }
    return { success: true, character }
})

ipcMain.handle('characters:create', async () => {
    console.log('[IPC] characters:create')
    if (!db.isOpen) return { success: false, error: 'No project open' }
    const character = db.createCharacter()
    return { success: true, character }
})

ipcMain.handle('characters:update', async (_event, id: string, field: string, value: string) => {
    console.log(`[IPC] characters:update — ${id}.${field}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }
    const ok = db.updateCharacter(id, field, value)
    return { success: ok }
})

ipcMain.handle('characters:delete', async (_event, id: string) => {
    console.log(`[IPC] characters:delete — ${id}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }
    const ok = db.deleteCharacter(id)
    return { success: ok }
})

ipcMain.handle('characters:reorder', async (_event, order) => {
    console.log('[IPC] characters:reorder')
    if (!db.isOpen) return { success: false, error: 'No project open' }
    db.reorderCharacters(order)
    return { success: true }
})

// --------- Group IPC Handlers ---------

ipcMain.handle('characters:group:create', async (_event, name: string) => {
    console.log(`[IPC] characters:group:create — ${name}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }
    const group = db.createGroup(name)
    return { success: true, group: { ...group, expanded: true, characters: [] } }
})

ipcMain.handle('characters:group:delete', async (_event, groupId: string) => {
    console.log(`[IPC] characters:group:delete — ${groupId}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }
    const ok = db.deleteGroup(groupId)
    return { success: ok }
})

ipcMain.handle('characters:group:rename', async (_event, groupId: string, newName: string) => {
    console.log(`[IPC] characters:group:rename — ${groupId} → ${newName}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }
    const ok = db.renameGroup(groupId, newName)
    return { success: ok }
})

// --------- Avatar & Gallery IPC Handlers ---------

ipcMain.handle('characters:avatar:upload', async (_event, characterId: string) => {
    console.log(`[IPC] characters:avatar:upload — ${characterId}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }

    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, cancelled: true }

    const avatarUrl = db.importAvatar(characterId, result.filePaths[0])
    return { success: true, path: avatarUrl }
})

ipcMain.handle('characters:gallery:add', async (_event, characterId: string) => {
    console.log(`[IPC] characters:gallery:add — ${characterId}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }

    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, cancelled: true }

    const images = db.importGalleryImages(characterId, result.filePaths)
    return { success: true, images }
})

ipcMain.handle('characters:gallery:remove', async (_event, _characterId: string, imageId: string) => {
    console.log(`[IPC] characters:gallery:remove — ${imageId}`)
    if (!db.isOpen) return { success: false, error: 'No project open' }

    const ok = db.removeGalleryImage(imageId)
    return { success: ok }
})

// --------- Board & Links Handlers ---------

ipcMain.handle('characters:board:get', async () => {
    if (!db.isOpen) return null
    return db.getBoardData()
})

ipcMain.handle('characters:board:addNode', async (_event, characterId: string, x: number, y: number) => {
    if (!db.isOpen) return false
    return db.addBoardNode(characterId, x, y)
})

ipcMain.handle('characters:board:updateNodePosition', async (_event, characterId: string, x: number, y: number) => {
    if (!db.isOpen) return false
    return db.updateBoardNode(characterId, x, y)
})

ipcMain.handle('characters:board:removeNode', async (_event, characterId: string) => {
    if (!db.isOpen) return false
    return db.removeBoardNode(characterId)
})

ipcMain.handle('characters:linkModes:create', async (_event, name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string) => {
    if (!db.isOpen) return null
    return db.createLinkMode(name, maxLinks, dataType, settings)
})

ipcMain.handle('characters:linkModes:update', async (_event, id: string, name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string) => {
    if (!db.isOpen) return false
    return db.updateLinkMode(id, name, maxLinks, dataType, settings)
})

ipcMain.handle('characters:linkModes:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteLinkMode(id)
})

ipcMain.handle('characters:linkModes:reorder', async (_event, modeIds: string[]) => {
    if (!db.isOpen) return false
    db.reorderLinkModes(modeIds)
    return true
})

ipcMain.handle('characters:links:create', async (_event, modeId: string, sourceId: string, targetId: string, value: string) => {
    if (!db.isOpen) return null
    return db.createLink(modeId, sourceId, targetId, value)
})

ipcMain.handle('characters:links:update', async (_event, id: string, value: string) => {
    if (!db.isOpen) return false
    return db.updateLink(id, value)
})

ipcMain.handle('characters:links:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteLink(id)
})

// --------- Locations IPC Handlers ---------

ipcMain.handle('locations:get-tree', async () => {
    if (!db.isOpen) return []
    return db.getLocationsTree()
})

ipcMain.handle('locations:get', async (_event, id: string) => {
    if (!db.isOpen) return null
    return db.getLocation(id)
})

ipcMain.handle('locations:create', async (_event, parentId: string | null) => {
    if (!db.isOpen) return null
    return db.createLocation(parentId)
})

ipcMain.handle('locations:update', async (_event, id: string, field: string, value: any) => {
    if (!db.isOpen) return false
    return db.updateLocation(id, field, value)
})

ipcMain.handle('locations:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteLocation(id)
})

ipcMain.handle('locations:structure:update', async (_event, updates: any[]) => {
    if (!db.isOpen) return false
    db.updateLocationsStructure(updates)
    return true
})

ipcMain.handle('locations:map:upload', async (_event, id: string) => {
    if (!db.isOpen) return false
    const result = await dialog.showOpenDialog({
        title: 'Select Map Image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return false
    return db.updateLocation(id, 'map_image_path', result.filePaths[0])
})

ipcMain.handle('locations:map:update-coords', async (_event, id: string, x: number, y: number) => {
    if (!db.isOpen) return false
    db.updateLocation(id, 'map_x', x)
    return db.updateLocation(id, 'map_y', y)
})

// --------- Scenes IPC Handlers ---------

ipcMain.handle('scenes:list', async () => {
    if (!db.isOpen) return { groups: [], ungrouped: [] }
    return db.getScenesList()
})

ipcMain.handle('scenes:create', async () => {
    if (!db.isOpen) return null
    return db.createScene()
})

ipcMain.handle('scenes:get', async (_event, id: string) => {
    if (!db.isOpen) return null
    return db.getScene(id)
})

ipcMain.handle('scenes:update', async (_event, id: string, field: string, value: string) => {
    if (!db.isOpen) return false
    return db.updateScene(id, field, value)
})

ipcMain.handle('scenes:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteScene(id)
})

ipcMain.handle('scenes:reorder', async (_event, order: any) => {
    if (!db.isOpen) return false
    db.reorderScenes(order)
    return true
})

ipcMain.handle('scenes:group:create', async (_event, name: string) => {
    if (!db.isOpen) return null
    return db.createSceneGroup(name)
})

ipcMain.handle('scenes:group:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteSceneGroup(id)
})

ipcMain.handle('scenes:group:rename', async (_event, id: string, name: string) => {
    if (!db.isOpen) return false
    return db.renameSceneGroup(id, name)
})

ipcMain.handle('scenes:characters:add', async (_event, sceneId: string, characterId: string) => {
    if (!db.isOpen) return false
    return db.addSceneCharacter(sceneId, characterId)
})

ipcMain.handle('scenes:characters:remove', async (_event, sceneId: string, characterId: string) => {
    if (!db.isOpen) return false
    return db.removeSceneCharacter(sceneId, characterId)
})

ipcMain.handle('scenes:actions:create', async (_event, sceneId: string, actionType: string, x: number, y: number) => {
    if (!db.isOpen) return null
    return db.createSceneAction(sceneId, actionType, x, y)
})

ipcMain.handle('scenes:actions:update', async (_event, id: string, data: string) => {
    if (!db.isOpen) return false
    return db.updateSceneAction(id, data)
})

ipcMain.handle('scenes:actions:move', async (_event, id: string, x: number, y: number) => {
    if (!db.isOpen) return false
    return db.moveSceneAction(id, x, y)
})

ipcMain.handle('scenes:actions:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteSceneAction(id)
})

ipcMain.handle('scenes:actions:gallery:add', async (_event, actionId: string) => {
    if (!db.isOpen) return { success: false }
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    const images = db.importSceneActionGallery(actionId, result.filePaths)
    return { success: true, images }
})

ipcMain.handle('scenes:actions:gallery:remove', async (_event, imageId: string) => {
    if (!db.isOpen) return false
    return db.removeSceneActionGalleryImage(imageId)
})

ipcMain.handle('scenes:connections:create', async (_event, sceneId: string, sourceActionId: string, sourcePin: string, targetActionId: string, targetPin: string) => {
    if (!db.isOpen) return null
    return db.createSceneConnection(sceneId, sourceActionId, sourcePin, targetActionId, targetPin)
})

ipcMain.handle('scenes:connections:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteSceneConnection(id)
})

// --------- Quests IPC Handlers ---------

ipcMain.handle('quests:list', async () => {
    if (!db.isOpen) return { groups: [], ungrouped: [] }
    return db.getQuestsList()
})

ipcMain.handle('quests:create', async (_event, parentId?: string, groupId?: string) => {
    if (!db.isOpen) return null
    return db.createQuest(parentId, groupId)
})

ipcMain.handle('quests:get', async (_event, id: string) => {
    if (!db.isOpen) return null
    return db.getQuest(id)
})

ipcMain.handle('quests:update', async (_event, id: string, field: string, value: string) => {
    if (!db.isOpen) return false
    return db.updateQuest(id, field, value)
})

ipcMain.handle('quests:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteQuest(id)
})

ipcMain.handle('quests:reorder', async (_event, order: any) => {
    if (!db.isOpen) return false
    db.reorderQuests(order)
    return true
})

ipcMain.handle('quests:group:create', async (_event, name: string) => {
    if (!db.isOpen) return null
    return db.createQuestGroup(name)
})

ipcMain.handle('quests:group:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteQuestGroup(id)
})

ipcMain.handle('quests:group:rename', async (_event, id: string, name: string) => {
    if (!db.isOpen) return false
    return db.renameQuestGroup(id, name)
})

ipcMain.handle('quests:icon:upload', async (_event, questId: string) => {
    if (!db.isOpen) return { success: false }
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    const iconUrl = db.importQuestIcon(questId, result.filePaths[0])
    return { success: true, path: iconUrl }
})

ipcMain.handle('quests:gallery:add', async (_event, questId: string) => {
    if (!db.isOpen) return { success: false }
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    const images = db.importQuestGallery(questId, result.filePaths)
    return { success: true, images }
})

ipcMain.handle('quests:gallery:remove', async (_event, imageId: string) => {
    if (!db.isOpen) return false
    return db.removeQuestGalleryImage(imageId)
})

ipcMain.handle('quests:structure:update', async (_event, updates: any[]) => {
    if (!db.isOpen) return false
    db.updateQuestsStructure(updates)
    return true
})

ipcMain.handle('quests:all-flat', async () => {
    if (!db.isOpen) return []
    return db.getAllQuestsFlat()
})

// --------- Storyline IPC Handlers ---------

ipcMain.handle('storyline:get', async () => {
    if (!db.isOpen) return null
    return db.getStorylineData()
})

ipcMain.handle('storyline:node:add', async (_event, nodeType: string, refId: string | null, groupId: string | null, x: number, y: number, data?: string) => {
    if (!db.isOpen) return null
    return db.addStorylineNode(nodeType, refId, groupId, x, y, data)
})

ipcMain.handle('storyline:node:update', async (_event, id: string, x: number, y: number, groupId?: string | null) => {
    if (!db.isOpen) return false
    return db.updateStorylineNode(id, x, y, groupId)
})

ipcMain.handle('storyline:node:update-data', async (_event, id: string, data: string) => {
    if (!db.isOpen) return false
    return db.updateStorylineNodeData(id, data)
})

ipcMain.handle('storyline:node:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteStorylineNode(id)
})

ipcMain.handle('storyline:connection:create', async (_event, sourceNodeId: string, sourcePin: string, targetNodeId: string, targetPin: string) => {
    if (!db.isOpen) return null
    return db.createStorylineConnection(sourceNodeId, sourcePin, targetNodeId, targetPin)
})

ipcMain.handle('storyline:connection:delete', async (_event, id: string) => {
    if (!db.isOpen) return false
    return db.deleteStorylineConnection(id)
})

ipcMain.handle('storyline:group-position:update', async (_event, groupId: string, x: number, y: number, width: number, height: number) => {
    if (!db.isOpen) return false
    db.updateStorylineGroupPosition(groupId, x, y, width, height)
    return true
})

// --------- App Ready ---------

app.whenReady().then(() => {
    protocol.handle('enno', (request) => {
        const filePath = decodeURIComponent(request.url.replace('enno://', ''))
        return net.fetch(pathToFileURL(filePath).href)
    })

    buildMenu()
    createWindow()
})

