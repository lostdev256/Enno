import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
        },
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
    //win.webContents.openDevTools();
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// --------- Application Menu ---------
function buildMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => win?.webContents.send('menu:action', 'file:open'),
                },
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

// --------- IPC Handlers (stubs) ---------

ipcMain.handle('file:open', async () => {
    console.log('[IPC] file:open — stub')
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Enno Files', extensions: ['enno', 'json'] }],
    })
    return { cancelled: result.canceled, filePaths: result.filePaths }
})

ipcMain.handle('file:save', async () => {
    console.log('[IPC] file:save — stub')
    return { success: true }
})

ipcMain.handle('file:save-as', async () => {
    console.log('[IPC] file:save-as — stub')
    const result = await dialog.showSaveDialog({
        filters: [{ name: 'Enno Files', extensions: ['enno', 'json'] }],
    })
    return { cancelled: result.canceled, filePath: result.filePath }
})

ipcMain.handle('characters:cards', async () => {
    console.log('[IPC] characters:cards — stub')
    return { success: true }
})

ipcMain.handle('characters:links', async () => {
    console.log('[IPC] characters:links — stub')
    return { success: true }
})

ipcMain.handle('help:about', async () => {
    console.log('[IPC] help:about — stub')
    return { name: 'Enno', version: '0.0.0' }
})

// --------- Character Data Store (in-memory, hardcoded) ---------

interface CharacterData {
    id: string
    name: string
    description: string
    avatarUrl: string | null
    gallery: string[]
}

interface GroupData {
    id: string
    name: string
    expanded: boolean
    characters: CharacterData[]
}

let nextId = 100

function genId(): string {
    return `char_${nextId++}`
}

function genGroupId(): string {
    return `group_${nextId++}`
}

const characterGroups: GroupData[] = [
    {
        id: 'group_1',
        name: 'Main Heroes',
        expanded: true,
        characters: [
            {
                id: 'char_1',
                name: 'Arden Voss',
                description: 'A seasoned navigator of the Ashward Expanse. Once a military cartographer, he now charts forbidden territories where maps tend to lie. His left eye bears a strange silver mark — a gift from an encounter he refuses to discuss. Quiet, methodical, but capable of sudden bursts of reckless action when cornered.',
                avatarUrl: null,
                gallery: [],
            },
            {
                id: 'char_2',
                name: 'Lyra Duskmantle',
                description: 'A former court alchemist turned fugitive. She speaks in measured half-truths and always carries three vials of unknown substances. Her knowledge of poisons is rivaled only by her talent for brewing antidotes. She claims to serve no master, though letters sealed in black wax still reach her.',
                avatarUrl: null,
                gallery: [],
            },
            {
                id: 'char_3',
                name: 'Kael Thornwood',
                description: 'The youngest general in the history of the Iron Accord. Now dishonored and stripped of rank, he wanders the border towns seeking redemption — or perhaps revenge. Carries a broken halberd that he refuses to repair, calling it "a reminder." Despite his gruff exterior, he has a weakness for stray animals.',
                avatarUrl: null,
                gallery: [],
            },
        ],
    },
    {
        id: 'group_2',
        name: 'Antagonists',
        expanded: true,
        characters: [
            {
                id: 'char_4',
                name: 'Seraphine Coldwell',
                description: 'Head of the Obsidian Syndicate and master of political subterfuge. Publicly known as a philanthropist; privately feared as a spymaster. She never raises her voice — she doesn\'t need to. Her network of informants spans three kingdoms.',
                avatarUrl: null,
                gallery: [],
            },
            {
                id: 'char_5',
                name: 'Mordecai Ashgloom',
                description: 'A rogue scholar obsessed with forbidden chronolinguistics — the study of time-locked languages. His experiments have left him partially "unanchored" from the present, causing him to occasionally speak in tenses that haven\'t happened yet.',
                avatarUrl: null,
                gallery: [],
            },
        ],
    },
]

const ungroupedCharacters: CharacterData[] = [
    {
        id: 'char_6',
        name: 'Pip Sundew',
        description: 'A cheerful street urchin who claims to be 12 years old (he\'s been claiming this for at least four years). He runs messages across the city faster than any courier service, knows every shortcut, and has an uncanny ability to appear exactly where he\'s needed — and disappear when he\'s not.',
        avatarUrl: null,
        gallery: [],
    },
]

// Helper: find character by id across all groups and ungrouped
function findCharacter(id: string): { char: CharacterData, source: CharacterData[] } | null {
    for (const group of characterGroups) {
        const idx = group.characters.findIndex(c => c.id === id)
        if (idx !== -1) return { char: group.characters[idx], source: group.characters }
    }
    const idx = ungroupedCharacters.findIndex(c => c.id === id)
    if (idx !== -1) return { char: ungroupedCharacters[idx], source: ungroupedCharacters }
    return null
}

// --------- Character IPC Handlers ---------

ipcMain.handle('characters:list', async () => {
    console.log('[IPC] characters:list')
    return {
        groups: characterGroups.map(g => ({
            ...g,
            characters: g.characters.map(c => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl })),
        })),
        ungrouped: ungroupedCharacters.map(c => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl })),
    }
})

ipcMain.handle('characters:get', async (_event, id: string) => {
    console.log(`[IPC] characters:get — ${id}`)
    const found = findCharacter(id)
    if (!found) return { success: false, error: 'Character not found' }
    return { success: true, character: found.char }
})

ipcMain.handle('characters:create', async () => {
    console.log('[IPC] characters:create')
    const newChar: CharacterData = {
        id: genId(),
        name: 'New Character',
        description: '',
        avatarUrl: null,
        gallery: [],
    }
    ungroupedCharacters.push(newChar)
    return { success: true, character: newChar }
})

ipcMain.handle('characters:update', async (_event, id: string, field: string, value: string) => {
    console.log(`[IPC] characters:update — ${id}.${field}`)
    const found = findCharacter(id)
    if (!found) return { success: false, error: 'Character not found' }
    if (field === 'name') found.char.name = value
    else if (field === 'description') found.char.description = value
    return { success: true }
})

ipcMain.handle('characters:delete', async (_event, id: string) => {
    console.log(`[IPC] characters:delete — ${id}`)
    for (const group of characterGroups) {
        const idx = group.characters.findIndex(c => c.id === id)
        if (idx !== -1) { group.characters.splice(idx, 1); return { success: true } }
    }
    const idx = ungroupedCharacters.findIndex(c => c.id === id)
    if (idx !== -1) { ungroupedCharacters.splice(idx, 1); return { success: true } }
    return { success: false, error: 'Character not found' }
})

ipcMain.handle('characters:reorder', async (_event, newOrder: { groups: { id: string, characterIds: string[] }[], ungroupedIds: string[] }) => {
    console.log('[IPC] characters:reorder')
    // Collect all characters into a flat map
    const allChars = new Map<string, CharacterData>()
    for (const g of characterGroups) for (const c of g.characters) allChars.set(c.id, c)
    for (const c of ungroupedCharacters) allChars.set(c.id, c)

    // Rebuild groups order
    for (const orderGroup of newOrder.groups) {
        const existingGroup = characterGroups.find(g => g.id === orderGroup.id)
        if (existingGroup) {
            existingGroup.characters = orderGroup.characterIds
                .map(cid => allChars.get(cid))
                .filter((c): c is CharacterData => !!c)
        }
    }

    // Rebuild ungrouped
    ungroupedCharacters.length = 0
    for (const cid of newOrder.ungroupedIds) {
        const c = allChars.get(cid)
        if (c) ungroupedCharacters.push(c)
    }

    return { success: true }
})

// --------- Group IPC Handlers ---------

ipcMain.handle('characters:group:create', async (_event, name: string) => {
    console.log(`[IPC] characters:group:create — ${name}`)
    const newGroup: GroupData = {
        id: genGroupId(),
        name,
        expanded: true,
        characters: [],
    }
    characterGroups.push(newGroup)
    return { success: true, group: { id: newGroup.id, name: newGroup.name, expanded: true, characters: [] } }
})

ipcMain.handle('characters:group:delete', async (_event, groupId: string) => {
    console.log(`[IPC] characters:group:delete — ${groupId}`)
    const idx = characterGroups.findIndex(g => g.id === groupId)
    if (idx === -1) return { success: false, error: 'Group not found' }
    // Move characters to ungrouped
    ungroupedCharacters.push(...characterGroups[idx].characters)
    characterGroups.splice(idx, 1)
    return { success: true }
})

ipcMain.handle('characters:group:rename', async (_event, groupId: string, newName: string) => {
    console.log(`[IPC] characters:group:rename — ${groupId} → ${newName}`)
    const group = characterGroups.find(g => g.id === groupId)
    if (!group) return { success: false, error: 'Group not found' }
    group.name = newName
    return { success: true }
})

// --------- Avatar & Gallery IPC Handlers ---------

ipcMain.handle('characters:avatar:upload', async (_event, characterId: string) => {
    console.log(`[IPC] characters:avatar:upload — ${characterId}`)
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, cancelled: true }
    const filePath = result.filePaths[0]
    const found = findCharacter(characterId)
    if (found) found.char.avatarUrl = filePath
    return { success: true, path: filePath }
})

ipcMain.handle('characters:gallery:add', async (_event, characterId: string) => {
    console.log(`[IPC] characters:gallery:add — ${characterId}`)
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, cancelled: true }
    const found = findCharacter(characterId)
    if (found) found.char.gallery.push(...result.filePaths)
    return { success: true, paths: result.filePaths }
})

ipcMain.handle('characters:gallery:remove', async (_event, characterId: string, imageIndex: number) => {
    console.log(`[IPC] characters:gallery:remove — ${characterId}[${imageIndex}]`)
    const found = findCharacter(characterId)
    if (!found) return { success: false, error: 'Character not found' }
    if (imageIndex >= 0 && imageIndex < found.char.gallery.length) {
        found.char.gallery.splice(imageIndex, 1)
        return { success: true }
    }
    return { success: false, error: 'Invalid index' }
})

app.whenReady().then(() => {
    buildMenu()
    createWindow()
})
