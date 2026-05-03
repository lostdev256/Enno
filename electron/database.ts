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

    // Open SQLite
    const dbPath = path.join(this._workDir, 'project.db')
    if (!fs.existsSync(dbPath)) {
      throw new Error('Invalid .ennodb file: project.db not found')
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
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
    `)

    // Insert meta if not exists
    const existing = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version')
    if (!existing) {
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', '1')
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('app_version', '0.1.0')
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
        const dir = zipPrefix || ''
        zip.addFile(zipPath, content)
      }
    }
  }
}
