import Database from 'better-sqlite3'
import AdmZip from 'adm-zip'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import crypto from 'node:crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SidebarCharacter {
  id: string
  name: string
  avatarUrl: string | null
}

export interface SidebarGroup {
  id: string
  name: string
  expanded: boolean
  characters: SidebarCharacter[]
}

export interface SidebarData {
  groups: SidebarGroup[]
  ungrouped: SidebarCharacter[]
}

export interface CharacterFull {
  id: string
  name: string
  description: string
  avatarUrl: string | null
  gallery: { id: string; path: string }[]
}

export interface ReorderPayload {
  groups: { id: string; characterIds: string[] }[]
  ungroupedIds: string[]
}

export interface BoardNode {
  characterId: string
  x: number
  y: number
}

export interface LinkMode {
  id: string
  name: string
  maxLinksPerPair: number
  dataType: 'text' | 'enum'
  settings: string // JSON string
  sortOrder: number
}

export interface CharacterLink {
  id: string
  modeId: string
  sourceId: string
  targetId: string
  value: string
}

export interface BoardData {
  nodes: BoardNode[]
  modes: LinkMode[]
  links: CharacterLink[]
}

export interface LocationTreeItem {
  id: string
  name: string
  mapX: number | null
  mapY: number | null
  children: LocationTreeItem[]
}

export interface LocationFull {
  id: string
  parentId: string | null
  name: string
  description: string
  mapImagePath: string | null
  mapX: number
  mapY: number
  sortOrder: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID()
}

// ─── EnnoDatabase ────────────────────────────────────────────────────────────

export class EnnoDatabase {
  private db: Database.Database | null = null
  private _filePath: string | null = null   // path to .ennodb file
  private _workDir: string | null = null    // temp working directory

  // ── Getters ──

  get isOpen(): boolean { return this.db !== null }
  get filePath(): string | null { return this._filePath }
  get projectName(): string | null {
    return this._filePath ? path.basename(this._filePath) : null
  }

  // ── Lifecycle ──

  create(filePath: string): void {
    this.close()

    // Create temp working directory
    this._workDir = this.createTempDir()
    this._filePath = filePath

    // Create media directories
    fs.mkdirSync(path.join(this._workDir, 'media', 'characters', 'avatars'), { recursive: true })
    fs.mkdirSync(path.join(this._workDir, 'media', 'characters', 'gallery'), { recursive: true })
    fs.mkdirSync(path.join(this._workDir, 'media', 'locations', 'maps'), { recursive: true })

    // Init SQLite database
    const dbPath = path.join(this._workDir, 'project.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initSchema()

    // Save immediately so the file exists on disk
    this.save()
  }

  open(filePath: string): void {
    this.close()

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    // Extract ZIP to temp dir
    this._workDir = this.createTempDir()
    this._filePath = filePath

    const zip = new AdmZip(filePath)
    zip.extractAllTo(this._workDir, true)

    // Ensure media dirs exist (for older files that might lack them)
    fs.mkdirSync(path.join(this._workDir, 'media', 'characters', 'avatars'), { recursive: true })
    fs.mkdirSync(path.join(this._workDir, 'media', 'characters', 'gallery'), { recursive: true })
    fs.mkdirSync(path.join(this._workDir, 'media', 'locations', 'maps'), { recursive: true })

    // Open SQLite
    const dbPath = path.join(this._workDir, 'project.db')
    if (!fs.existsSync(dbPath)) {
      throw new Error('Invalid .ennodb file: project.db not found')
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    
    // Ensure all tables exist (migrates older files)
    this.initSchema()
  }

  save(): void {
    if (!this.db || !this._workDir || !this._filePath) {
      throw new Error('No project open')
    }

    // Close WAL checkpoint to ensure all data is in main db file
    this.db.pragma('wal_checkpoint(TRUNCATE)')

    // Pack working dir into ZIP (no compression)
    const zip = new AdmZip()
    this.addDirToZip(zip, this._workDir, '')

    // Set all entries to STORE (no compression)
    zip.getEntries().forEach(entry => {
      if (!entry.isDirectory) {
        entry.header.method = 0
      }
    })

    zip.writeZip(this._filePath)
  }

  saveAs(newPath: string): void {
    this._filePath = newPath
    this.save()
  }

  close(): void {
    if (this.db) {
      try { this.db.close() } catch { /* ignore */ }
      this.db = null
    }
    if (this._workDir && fs.existsSync(this._workDir)) {
      try { fs.rmSync(this._workDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
    this._workDir = null
    this._filePath = null
  }

  // ── Schema ──

  private initSchema(): void {
    if (!this.db) return

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS character_groups (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS characters (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL DEFAULT 'New Character',
        description TEXT NOT NULL DEFAULT '',
        avatar_path TEXT,
        group_id    TEXT,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (group_id) REFERENCES character_groups(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS character_gallery (
        id           TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        image_path   TEXT NOT NULL,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS character_board_nodes (
        character_id TEXT PRIMARY KEY,
        x REAL NOT NULL,
        y REAL NOT NULL,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS link_modes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        max_links_per_pair INTEGER NOT NULL DEFAULT 1,
        data_type TEXT NOT NULL,
        settings TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS character_links (
        id TEXT PRIMARY KEY,
        mode_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        value TEXT NOT NULL,
        FOREIGN KEY (mode_id) REFERENCES link_modes(id) ON DELETE CASCADE,
        FOREIGN KEY (source_id) REFERENCES characters(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        parent_id TEXT NULL,
        name TEXT NOT NULL DEFAULT 'New Location',
        description TEXT NOT NULL DEFAULT '',
        map_image_path TEXT,
        map_x REAL DEFAULT NULL,
        map_y REAL DEFAULT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES locations(id) ON DELETE CASCADE
      );
    `)

    // Insert meta if not exists
    const existing = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version')
    if (!existing) {
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', '1')
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('app_version', '0.1.0')
    }

    // Insert default link modes if table is empty
    const modesCount = this.db.prepare('SELECT COUNT(*) as c FROM link_modes').get() as { c: number }
    if (modesCount.c === 0) {
      const insertMode = this.db.prepare('INSERT INTO link_modes (id, name, max_links_per_pair, data_type, settings, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      
      const attitudesSettings = JSON.stringify({
        lineType: 'arrow',
        enumValues: [
          { id: 'neutral', label: 'Neutral', color: '#9ca3af' },
          { id: 'hostile', label: 'Hostile', color: '#ef4444' },
          { id: 'friendly', label: 'Friendly', color: '#22c55e' }
        ]
      })
      insertMode.run('mode-attitudes', 'Attitudes', 2, 'enum', attitudesSettings, 0)
      
      const connectionsSettings = JSON.stringify({
        lineType: 'line',
        lineColor: '#a5b4fc'
      })
      insertMode.run('mode-connections', 'Connections', 1, 'text', connectionsSettings, 1)
    }
  }

  // ── Characters: List ──

  getCharactersList(): SidebarData {
    this.ensureOpen()

    const groups = this.db!.prepare(
      'SELECT id, name, sort_order FROM character_groups ORDER BY sort_order'
    ).all() as { id: string; name: string; sort_order: number }[]

    const result: SidebarData = { groups: [], ungrouped: [] }

    for (const g of groups) {
      const chars = this.db!.prepare(
        'SELECT id, name, avatar_path FROM characters WHERE group_id = ? ORDER BY sort_order'
      ).all(g.id) as { id: string; name: string; avatar_path: string | null }[]

      result.groups.push({
        id: g.id,
        name: g.name,
        expanded: true,
        characters: chars.map(c => ({
          id: c.id,
          name: c.name,
          avatarUrl: c.avatar_path ? this.resolveMediaPath(c.avatar_path) : null,
        })),
      })
    }

    // Ungrouped characters
    const ungrouped = this.db!.prepare(
      'SELECT id, name, avatar_path FROM characters WHERE group_id IS NULL ORDER BY sort_order'
    ).all() as { id: string; name: string; avatar_path: string | null }[]

    result.ungrouped = ungrouped.map(c => ({
      id: c.id,
      name: c.name,
      avatarUrl: c.avatar_path ? this.resolveMediaPath(c.avatar_path) : null,
    }))

    return result
  }

  // ── Characters: Get ──

  getCharacter(id: string): CharacterFull | null {
    this.ensureOpen()

    const row = this.db!.prepare(
      'SELECT id, name, description, avatar_path FROM characters WHERE id = ?'
    ).get(id) as { id: string; name: string; description: string; avatar_path: string | null } | undefined

    if (!row) return null

    const galleryRows = this.db!.prepare(
      'SELECT id, image_path FROM character_gallery WHERE character_id = ? ORDER BY sort_order'
    ).all(id) as { id: string; image_path: string }[]

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      avatarUrl: row.avatar_path ? this.resolveMediaPath(row.avatar_path) : null,
      gallery: galleryRows.map(g => ({
        id: g.id,
        path: this.resolveMediaPath(g.image_path),
      })),
    }
  }

  // ── Characters: Create ──

  createCharacter(): CharacterFull {
    this.ensureOpen()

    const id = uuid()
    const maxOrder = this.db!.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM characters WHERE group_id IS NULL'
    ).get() as { next: number }

    this.db!.prepare(
      'INSERT INTO characters (id, name, description, sort_order) VALUES (?, ?, ?, ?)'
    ).run(id, 'New Character', '', maxOrder.next)

    return { id, name: 'New Character', description: '', avatarUrl: null, gallery: [] }
  }

  // ── Characters: Update ──

  updateCharacter(id: string, field: string, value: string): boolean {
    this.ensureOpen()

    const allowedFields = ['name', 'description']
    if (!allowedFields.includes(field)) return false

    this.db!.prepare(
      `UPDATE characters SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(value, id)

    return true
  }

  // ── Characters: Delete ──

  deleteCharacter(id: string): boolean {
    this.ensureOpen()

    // Get avatar and gallery paths to clean up files
    const char = this.db!.prepare('SELECT avatar_path FROM characters WHERE id = ?').get(id) as { avatar_path: string | null } | undefined
    if (!char) return false

    // Delete gallery files
    const galleryRows = this.db!.prepare('SELECT image_path FROM character_gallery WHERE character_id = ?').all(id) as { image_path: string }[]
    for (const g of galleryRows) {
      this.deleteMediaFile(g.image_path)
    }

    // Delete avatar file
    if (char.avatar_path) {
      this.deleteMediaFile(char.avatar_path)
    }

    // DELETE CASCADE will handle character_gallery
    this.db!.prepare('DELETE FROM characters WHERE id = ?').run(id)
    return true
  }

  // ── Characters: Reorder ──

  reorderCharacters(order: ReorderPayload): void {
    this.ensureOpen()

    const updateChar = this.db!.prepare('UPDATE characters SET group_id = ?, sort_order = ? WHERE id = ?')
    const updateGroup = this.db!.prepare('UPDATE character_groups SET sort_order = ? WHERE id = ?')

    const tx = this.db!.transaction(() => {
      // Update group order
      for (let gi = 0; gi < order.groups.length; gi++) {
        const g = order.groups[gi]
        updateGroup.run(gi, g.id)

        // Update characters within this group
        for (let ci = 0; ci < g.characterIds.length; ci++) {
          updateChar.run(g.id, ci, g.characterIds[ci])
        }
      }

      // Update ungrouped characters
      for (let i = 0; i < order.ungroupedIds.length; i++) {
        updateChar.run(null, i, order.ungroupedIds[i])
      }
    })

    tx()
  }

  // ── Groups ──

  createGroup(name: string): { id: string; name: string } {
    this.ensureOpen()

    const id = uuid()
    const maxOrder = this.db!.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM character_groups'
    ).get() as { next: number }

    this.db!.prepare(
      'INSERT INTO character_groups (id, name, sort_order) VALUES (?, ?, ?)'
    ).run(id, name, maxOrder.next)

    return { id, name }
  }

  deleteGroup(id: string): boolean {
    this.ensureOpen()
    // Characters become ungrouped (ON DELETE SET NULL)
    const result = this.db!.prepare('DELETE FROM character_groups WHERE id = ?').run(id)
    return result.changes > 0
  }

  renameGroup(id: string, newName: string): boolean {
    this.ensureOpen()
    const result = this.db!.prepare('UPDATE character_groups SET name = ? WHERE id = ?').run(newName, id)
    return result.changes > 0
  }

  // ── Avatar ──

  importAvatar(characterId: string, sourcePath: string): string | null {
    this.ensureOpen()
    if (!this._workDir) return null

    const ext = path.extname(sourcePath).toLowerCase()
    const filename = `${characterId}${ext}`
    const relativePath = path.join('media', 'characters', 'avatars', filename)
    const destPath = path.join(this._workDir, relativePath)

    // Remove old avatar if exists
    const old = this.db!.prepare('SELECT avatar_path FROM characters WHERE id = ?').get(characterId) as { avatar_path: string | null } | undefined
    if (old?.avatar_path) {
      this.deleteMediaFile(old.avatar_path)
    }

    // Copy new file
    fs.copyFileSync(sourcePath, destPath)

    // Update DB
    this.db!.prepare("UPDATE characters SET avatar_path = ?, updated_at = datetime('now') WHERE id = ?").run(relativePath, characterId)

    return this.resolveMediaPath(relativePath)
  }

  // ── Gallery ──

  importGalleryImages(characterId: string, sourcePaths: string[]): { id: string; path: string }[] {
    this.ensureOpen()
    if (!this._workDir) return []

    const maxOrder = this.db!.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM character_gallery WHERE character_id = ?'
    ).get(characterId) as { next: number }

    const insert = this.db!.prepare(
      'INSERT INTO character_gallery (id, character_id, image_path, sort_order) VALUES (?, ?, ?, ?)'
    )

    const results: { id: string; path: string }[] = []

    const tx = this.db!.transaction(() => {
      for (let i = 0; i < sourcePaths.length; i++) {
        const src = sourcePaths[i]
        const ext = path.extname(src).toLowerCase()
        const imgId = uuid()
        const filename = `${characterId}_${imgId.slice(0, 8)}${ext}`
        const relativePath = path.join('media', 'characters', 'gallery', filename)
        const destPath = path.join(this._workDir!, relativePath)

        fs.copyFileSync(src, destPath)
        insert.run(imgId, characterId, relativePath, maxOrder.next + i)

        results.push({ id: imgId, path: this.resolveMediaPath(relativePath) })
      }
    })

    tx()
    return results
  }

  removeGalleryImage(imageId: string): boolean {
    this.ensureOpen()

    const row = this.db!.prepare('SELECT image_path FROM character_gallery WHERE id = ?').get(imageId) as { image_path: string } | undefined
    if (!row) return false

    this.deleteMediaFile(row.image_path)
    this.db!.prepare('DELETE FROM character_gallery WHERE id = ?').run(imageId)
    return true
  }

  // ── Private Helpers ──

  private ensureOpen(): void {
    if (!this.db) throw new Error('No project open')
  }

  private createTempDir(): string {
    const tmpBase = path.join(app.getPath('temp'), 'enno-projects')
    fs.mkdirSync(tmpBase, { recursive: true })
    const dir = fs.mkdtempSync(path.join(tmpBase, 'proj-'))
    return dir
  }

  private resolveMediaPath(relativePath: string): string {
    if (!this._workDir) return relativePath
    return path.join(this._workDir, relativePath)
  }

  private deleteMediaFile(relativePath: string): void {
    if (!this._workDir) return
    const fullPath = path.join(this._workDir, relativePath)
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    } catch { /* ignore */ }
  }

  private addDirToZip(zip: AdmZip, dirPath: string, zipPrefix: string): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name

      // Skip WAL/SHM files — they're temp SQLite files
      if (entry.name.endsWith('-wal') || entry.name.endsWith('-shm')) continue

      if (entry.isDirectory()) {
        this.addDirToZip(zip, fullPath, zipPath)
      } else {
        const content = fs.readFileSync(fullPath)
        // adm-zip addFile expects the directory path (without filename) as second-ish arg
        zip.addFile(zipPath, content)
      }
    }
  }

  // ── Board Nodes ──

  getBoardData(): BoardData {
    this.ensureOpen()
    const nodes = this.db!.prepare('SELECT character_id as characterId, x, y FROM character_board_nodes').all() as BoardNode[]
    const modes = this.db!.prepare('SELECT id, name, max_links_per_pair as maxLinksPerPair, data_type as dataType, settings, sort_order as sortOrder FROM link_modes ORDER BY sort_order').all() as LinkMode[]
    const links = this.db!.prepare('SELECT id, mode_id as modeId, source_id as sourceId, target_id as targetId, value FROM character_links').all() as CharacterLink[]
    
    return { nodes, modes, links }
  }

  addBoardNode(characterId: string, x: number, y: number): boolean {
    this.ensureOpen()
    try {
      this.db!.prepare('INSERT INTO character_board_nodes (character_id, x, y) VALUES (?, ?, ?)').run(characterId, x, y)
      return true
    } catch { return false }
  }

  updateBoardNode(characterId: string, x: number, y: number): boolean {
    this.ensureOpen()
    const res = this.db!.prepare('UPDATE character_board_nodes SET x = ?, y = ? WHERE character_id = ?').run(x, y, characterId)
    return res.changes > 0
  }

  removeBoardNode(characterId: string): boolean {
    this.ensureOpen()
    const res = this.db!.prepare('DELETE FROM character_board_nodes WHERE character_id = ?').run(characterId)
    return res.changes > 0
  }

  // ── Link Modes ──

  createLinkMode(name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string): LinkMode {
    this.ensureOpen()
    const id = uuid()
    const maxOrder = this.db!.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM link_modes').get() as { next: number }
    this.db!.prepare('INSERT INTO link_modes (id, name, max_links_per_pair, data_type, settings, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, maxLinks, dataType, settings, maxOrder.next)
    return { id, name, maxLinksPerPair: maxLinks, dataType, settings, sortOrder: maxOrder.next }
  }

  updateLinkMode(id: string, name: string, maxLinks: number, dataType: 'text' | 'enum', settings: string): boolean {
    this.ensureOpen()
    const res = this.db!.prepare('UPDATE link_modes SET name = ?, max_links_per_pair = ?, data_type = ?, settings = ? WHERE id = ?')
      .run(name, maxLinks, dataType, settings, id)
    return res.changes > 0
  }

  deleteLinkMode(id: string): boolean {
    this.ensureOpen()
    const res = this.db!.prepare('DELETE FROM link_modes WHERE id = ?').run(id)
    return res.changes > 0
  }
  
  reorderLinkModes(modeIds: string[]): void {
    this.ensureOpen()
    const update = this.db!.prepare('UPDATE link_modes SET sort_order = ? WHERE id = ?')
    const tx = this.db!.transaction(() => {
      for (let i = 0; i < modeIds.length; i++) {
        update.run(i, modeIds[i])
      }
    })
    tx()
  }

  // ── Links ──

  createLink(modeId: string, sourceId: string, targetId: string, value: string): CharacterLink | null {
    this.ensureOpen()
    const id = uuid()
    try {
      this.db!.prepare('INSERT INTO character_links (id, mode_id, source_id, target_id, value) VALUES (?, ?, ?, ?, ?)')
        .run(id, modeId, sourceId, targetId, value)
      return { id, modeId, sourceId, targetId, value }
    } catch {
      return null
    }
  }

  updateLink(id: string, value: string): boolean {
    this.ensureOpen()
    const res = this.db!.prepare('UPDATE character_links SET value = ? WHERE id = ?').run(value, id)
    return res.changes > 0
  }

  deleteLink(id: string): boolean {
    this.ensureOpen()
    const res = this.db!.prepare('DELETE FROM character_links WHERE id = ?').run(id)
    return res.changes > 0
  }

  // ── Locations ──

  getLocationsFlat(): any[] {
    this.ensureOpen()
    return this.db!.prepare('SELECT * FROM locations ORDER BY sort_order ASC').all()
  }

  getLocationsTree(): LocationTreeItem[] {
    const flat = this.getLocationsFlat()
    const map = new Map<string, LocationTreeItem>()
    const roots: LocationTreeItem[] = []

    for (const loc of flat) {
      map.set(loc.id, { 
        id: loc.id, 
        name: loc.name, 
        mapX: loc.map_x,
        mapY: loc.map_y,
        children: [] 
      })
    }

    for (const loc of flat) {
      const item = map.get(loc.id)!
      if (loc.parent_id) {
        const parent = map.get(loc.parent_id)
        if (parent) {
          parent.children.push(item)
        } else {
          roots.push(item) // Fallback if parent missing
        }
      } else {
        roots.push(item)
      }
    }
    return roots
  }

  getLocation(id: string): LocationFull | null {
    this.ensureOpen()
    const row = this.db!.prepare('SELECT * FROM locations WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      parentId: row.parent_id,
      name: row.name,
      description: row.description,
      mapImagePath: row.map_image_path ? path.join(this._workDir!, row.map_image_path) : null,
      mapX: row.map_x,
      mapY: row.map_y,
      sortOrder: row.sort_order
    }
  }

  createLocation(parentId: string | null): string {
    this.ensureOpen()
    const id = uuid()
    const maxOrderRow = this.db!.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM locations WHERE IFNULL(parent_id, \'\') = ?').get(parentId || "") as { next: number }
    this.db!.prepare(`
      INSERT INTO locations (id, parent_id, sort_order)
      VALUES (?, ?, ?)
    `).run(id, parentId, maxOrderRow.next)
    return id
  }

  updateLocation(id: string, field: string, value: any): boolean {
    this.ensureOpen()
    const validFields = ['name', 'description', 'parent_id', 'map_image_path', 'map_x', 'map_y', 'sort_order']
    if (!validFields.includes(field)) throw new Error('Invalid field')
    
    // Copy map image if needed
    if (field === 'map_image_path' && value) {
      const ext = path.extname(value)
      const fileName = `${uuid()}${ext}`
      const relPath = path.join('media', 'locations', 'maps', fileName)
      const absPath = path.join(this._workDir!, relPath)
      fs.copyFileSync(value, absPath)
      
      // Delete old
      const old = this.db!.prepare('SELECT map_image_path FROM locations WHERE id = ?').get(id) as { map_image_path: string | null }
      if (old && old.map_image_path) {
        try { fs.unlinkSync(path.join(this._workDir!, old.map_image_path)) } catch {}
      }
      value = relPath
    }

    const res = this.db!.prepare(`UPDATE locations SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).run(value, id)
    return res.changes > 0
  }

  deleteLocation(id: string): boolean {
    this.ensureOpen()
    // Find image to delete
    const old = this.db!.prepare('SELECT map_image_path FROM locations WHERE id = ?').get(id) as { map_image_path: string | null }
    if (old && old.map_image_path) {
      try { fs.unlinkSync(path.join(this._workDir!, old.map_image_path)) } catch {}
    }
    const res = this.db!.prepare('DELETE FROM locations WHERE id = ?').run(id)
    return res.changes > 0
  }

  updateLocationsStructure(updates: { id: string, parentId: string | null, sortOrder: number }[]): void {
    this.ensureOpen()
    const update = this.db!.prepare('UPDATE locations SET parent_id = ?, sort_order = ?, updated_at = datetime("now") WHERE id = ?')
    const tx = this.db!.transaction(() => {
      for (const u of updates) {
        update.run(u.parentId, u.sortOrder, u.id)
      }
    })
    tx()
  }
}
