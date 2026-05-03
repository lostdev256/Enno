import { app, BrowserWindow, Menu, ipcMain, dialog, protocol, net } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import Store from 'electron-store'
import { EnnoDatabase } from './database'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

// --------- App Ready ---------

app.whenReady().then(() => {
    protocol.handle('enno', (request) => {
        const filePath = decodeURIComponent(request.url.replace('enno://', ''))
        return net.fetch(pathToFileURL(filePath).href)
    })

    buildMenu()
    createWindow()
})
