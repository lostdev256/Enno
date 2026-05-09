import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import path from "node:path";
import fs from "node:fs";
import {app} from "electron";
import crypto from "node:crypto";

import schemaSql from "./db/schema.sql?raw";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SidebarCharacter {
    id: string;
    name: string;
    avatarUrl: string | null;
}

export interface SidebarGroup {
    id: string;
    name: string;
    expanded: boolean;
    characters: SidebarCharacter[];
}

export interface SidebarData {
    groups: SidebarGroup[];
    ungrouped: SidebarCharacter[];
}

export interface CharacterFull {
    id: string;
    name: string;
    description: string;
    avatarUrl: string | null;
    gallery: { id: string; path: string }[];
}

export interface ReorderPayload {
    groups: { id: string; characterIds: string[] }[];
    ungroupedIds: string[];
}

export interface BoardNode {
    characterId: string;
    x: number;
    y: number;
}

export interface LinkMode {
    id: string;
    name: string;
    maxLinksPerPair: number;
    dataType: "text" | "enum";
    settings: string; // JSON string
    sortOrder: number;
}

export interface CharacterLink {
    id: string;
    modeId: string;
    sourceId: string;
    targetId: string;
    value: string;
}

export interface BoardData {
    nodes: BoardNode[];
    modes: LinkMode[];
    links: CharacterLink[];
}

export interface LocationTreeItem {
    id: string;
    name: string;
    mapX: number | null;
    mapY: number | null;
    children: LocationTreeItem[];
}

export interface LocationFull {
    id: string;
    parentId: string | null;
    name: string;
    description: string;
    mapImagePath: string | null;
    mapX: number;
    mapY: number;
    sortOrder: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
    return crypto.randomUUID();
}

export function createDB(): EnnoDatabase {
    return new EnnoDatabase();
}

// ─── EnnoDatabase ────────────────────────────────────────────────────────────

class EnnoDatabase {
    private db: Database.Database | null = null;
    private _filePath: string | null = null;   // path to .ennodb file
    private _workDir: string | null = null;    // temp working directory

    // ── Getters ──

    get isOpen(): boolean {
        return this.db !== null;
    }

    get filePath(): string | null {
        return this._filePath;
    }

    get projectName(): string | null {
        return this._filePath ? path.basename(this._filePath) : null;
    }

    // ── Lifecycle ──

    private syncMediaDirs(workDir: string) {
        fs.mkdirSync(path.join(workDir, "media", "characters", "avatars"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "characters", "gallery"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "locations", "maps"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "scenes", "action_gallery"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "quests", "icons"), {recursive: true});
        fs.mkdirSync(path.join(workDir, "media", "quests", "gallery"), {recursive: true});
    }

    create(filePath: string): void {
        this.close();

        // Create temp working directory
        this._workDir = this.createTempDir();
        this._filePath = filePath;

        // Create media directories
        this.syncMediaDirs(this._workDir);

        // Init SQLite database
        const dbPath = path.join(this._workDir, "project.db");
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.initSchema();

        // Save immediately so the file exists on disk
        this.save();
    }

    open(filePath: string): void {
        this.close();

        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Extract ZIP to temp dir
        this._workDir = this.createTempDir();
        this._filePath = filePath;

        const zip = new AdmZip(filePath);
        zip.extractAllTo(this._workDir, true);

        // Ensure media dirs exist (for older files that might lack them)
        this.syncMediaDirs(this._workDir);

        // Open SQLite
        const dbPath = path.join(this._workDir, "project.db");
        if (!fs.existsSync(dbPath)) {
            throw new Error("Invalid .ennodb file: project.db not found");
        }
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");

        // Ensure all tables exist (migrates older files)
        this.initSchema();
    }

    save(): void {
        if (!this.db || !this._workDir || !this._filePath) {
            throw new Error("No project open");
        }

        // Close WAL checkpoint to ensure all data is in main db file
        this.db.pragma("wal_checkpoint(TRUNCATE)");

        // Pack working dir into ZIP (no compression)
        const zip = new AdmZip();
        this.addDirToZip(zip, this._workDir, "");

        // Set all entries to STORE (no compression)
        zip.getEntries().forEach(entry => {
            if (!entry.isDirectory) {
                entry.header.method = 0;
            }
        });

        zip.writeZip(this._filePath);
    }

    saveAs(newPath: string): void {
        this._filePath = newPath;
        this.save();
    }

    close(): void {
        if (this.db) {
            try {
                this.db.close();
            } catch { /* ignore */
            }
            this.db = null;
        }
        if (this._workDir && fs.existsSync(this._workDir)) {
            try {
                fs.rmSync(this._workDir, {recursive: true, force: true});
            } catch { /* ignore */
            }
        }
        this._workDir = null;
        this._filePath = null;
    }

    // ── Schema ──

    private initSchema(): void {
        if (!this.db) return;

        try {
            this.db.exec(schemaSql);
            console.log("Database schema initialized successfully");
        } catch (err) {
            console.error("Failed to initialize database schema:", err);
        }

        // Insert default link modes if table is empty
        const modesCount = this.db.prepare("SELECT COUNT(*) AS c FROM link_modes").get() as { c: number };
        if (modesCount.c === 0) {
            const insertMode = this.db.prepare("INSERT INTO link_modes (id, name, max_links_per_pair, data_type, settings, sort_order) VALUES (?, ?, ?, ?, ?, ?)");

            const attitudesSettings = JSON.stringify({
                lineType: "arrow",
                enumValues: [
                    {id: "neutral", label: "Neutral", color: "#9ca3af"},
                    {id: "hostile", label: "Hostile", color: "#ef4444"},
                    {id: "friendly", label: "Friendly", color: "#22c55e"}
                ]
            });
            insertMode.run("mode-attitudes", "Attitudes", 2, "enum", attitudesSettings, 0);

            const connectionsSettings = JSON.stringify({
                lineType: "line",
                lineColor: "#a5b4fc"
            });
            insertMode.run("mode-connections", "Connections", 1, "text", connectionsSettings, 1);
        }
    }

    // ── Characters: List ──

    getCharactersList(): SidebarData {
        this.ensureOpen();

        const groups = this.db!.prepare(
            "SELECT id, name, sort_order FROM character_groups ORDER BY sort_order"
        ).all() as { id: string; name: string; sort_order: number }[];

        const result: SidebarData = {groups: [], ungrouped: []};

        for (const g of groups) {
            const chars = this.db!.prepare(
                "SELECT id, name, avatar_path FROM characters WHERE group_id = ? ORDER BY sort_order"
            ).all(g.id) as { id: string; name: string; avatar_path: string | null }[];

            result.groups.push({
                id: g.id,
                name: g.name,
                expanded: true,
                characters: chars.map(c => ({
                    id: c.id,
                    name: c.name,
                    avatarUrl: c.avatar_path ? this.resolveMediaPath(c.avatar_path) : null
                }))
            });
        }

        // Ungrouped characters
        const ungrouped = this.db!.prepare(
            "SELECT id, name, avatar_path FROM characters WHERE group_id IS NULL ORDER BY sort_order"
        ).all() as { id: string; name: string; avatar_path: string | null }[];

        result.ungrouped = ungrouped.map(c => ({
            id: c.id,
            name: c.name,
            avatarUrl: c.avatar_path ? this.resolveMediaPath(c.avatar_path) : null
        }));

        return result;
    }

    // ── Characters: Get ──

    getCharacter(id: string): CharacterFull | null {
        this.ensureOpen();

        const row = this.db!.prepare(
            "SELECT id, name, description, avatar_path FROM characters WHERE id = ?"
        ).get(id) as { id: string; name: string; description: string; avatar_path: string | null } | undefined;

        if (!row) return null;

        const galleryRows = this.db!.prepare(
            "SELECT id, image_path FROM character_gallery WHERE character_id = ? ORDER BY sort_order"
        ).all(id) as { id: string; image_path: string }[];

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            avatarUrl: row.avatar_path ? this.resolveMediaPath(row.avatar_path) : null,
            gallery: galleryRows.map(g => ({
                id: g.id,
                path: this.resolveMediaPath(g.image_path)
            }))
        };
    }

    // ── Characters: Create ──

    createCharacter(): CharacterFull {
        this.ensureOpen();

        const id = uuid();
        const maxOrder = this.db!.prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS NEXT FROM characters WHERE group_id IS NULL"
        ).get() as { next: number };

        this.db!.prepare(
            "INSERT INTO characters (id, name, description, sort_order) VALUES (?, ?, ?, ?)"
        ).run(id, "New Character", "", maxOrder.next);

        return {id, name: "New Character", description: "", avatarUrl: null, gallery: []};
    }

    // ── Characters: Update ──

    updateCharacter(id: string, field: string, value: string): boolean {
        this.ensureOpen();

        const allowedFields = ["name", "description"];
        if (!allowedFields.includes(field)) return false;

        this.db!.prepare(
            `UPDATE characters
             SET ${field}   = ?,
                 updated_at = datetime('now')
             WHERE id = ?`
        ).run(value, id);

        return true;
    }

    // ── Characters: Delete ──

    deleteCharacter(id: string): boolean {
        this.ensureOpen();

        // Get avatar and gallery paths to clean up files
        const char = this.db!.prepare("SELECT avatar_path FROM characters WHERE id = ?").get(id) as {
            avatar_path: string | null
        } | undefined;
        if (!char) return false;

        // Delete gallery files
        const galleryRows = this.db!.prepare("SELECT image_path FROM character_gallery WHERE character_id = ?").all(id) as {
            image_path: string
        }[];
        for (const g of galleryRows) {
            this.deleteMediaFile(g.image_path);
        }

        // Delete avatar file
        if (char.avatar_path) {
            this.deleteMediaFile(char.avatar_path);
        }

        // DELETE CASCADE will handle character_gallery
        this.db!.prepare("DELETE FROM characters WHERE id = ?").run(id);
        return true;
    }

    // ── Characters: Reorder ──

    reorderCharacters(order: ReorderPayload): void {
        this.ensureOpen();

        const updateChar = this.db!.prepare("UPDATE characters SET group_id = ?, sort_order = ? WHERE id = ?");
        const updateGroup = this.db!.prepare("UPDATE character_groups SET sort_order = ? WHERE id = ?");

        const tx = this.db!.transaction(() => {
            // Update group order
            for (let gi = 0; gi < order.groups.length; gi++) {
                const g = order.groups[gi];
                updateGroup.run(gi, g.id);

                // Update characters within this group
                for (let ci = 0; ci < g.characterIds.length; ci++) {
                    updateChar.run(g.id, ci, g.characterIds[ci]);
                }
            }

            // Update ungrouped characters
            for (let i = 0; i < order.ungroupedIds.length; i++) {
                updateChar.run(null, i, order.ungroupedIds[i]);
            }
        });

        tx();
    }

    // ── Groups ──

    createGroup(name: string): { id: string; name: string } {
        this.ensureOpen();

        const id = uuid();
        const maxOrder = this.db!.prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS NEXT FROM character_groups"
        ).get() as { next: number };

        this.db!.prepare(
            "INSERT INTO character_groups (id, name, sort_order) VALUES (?, ?, ?)"
        ).run(id, name, maxOrder.next);

        return {id, name};
    }

    deleteGroup(id: string): boolean {
        this.ensureOpen();
        // Characters become ungrouped (ON DELETE SET NULL)
        const result = this.db!.prepare("DELETE FROM character_groups WHERE id = ?").run(id);
        return result.changes > 0;
    }

    renameGroup(id: string, newName: string): boolean {
        this.ensureOpen();
        const result = this.db!.prepare("UPDATE character_groups SET name = ? WHERE id = ?").run(newName, id);
        return result.changes > 0;
    }

    // ── Avatar ──

    importAvatar(characterId: string, sourcePath: string): string | null {
        this.ensureOpen();
        if (!this._workDir) return null;

        const ext = path.extname(sourcePath).toLowerCase();
        const filename = `${characterId}${ext}`;
        const relativePath = path.join("media", "characters", "avatars", filename);
        const destPath = path.join(this._workDir, relativePath);

        // Remove old avatar if exists
        const old = this.db!.prepare("SELECT avatar_path FROM characters WHERE id = ?").get(characterId) as {
            avatar_path: string | null
        } | undefined;
        if (old?.avatar_path) {
            this.deleteMediaFile(old.avatar_path);
        }

        // Copy new file
        fs.copyFileSync(sourcePath, destPath);

        // Update DB
        this.db!.prepare("UPDATE characters SET avatar_path = ?, updated_at = datetime('now') WHERE id = ?").run(relativePath, characterId);

        return this.resolveMediaPath(relativePath);
    }

    // ── Gallery ──

    importGalleryImages(characterId: string, sourcePaths: string[]): { id: string; path: string }[] {
        this.ensureOpen();
        if (!this._workDir) return [];

        const maxOrder = this.db!.prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS NEXT FROM character_gallery WHERE character_id = ?"
        ).get(characterId) as { next: number };

        const insert = this.db!.prepare(
            "INSERT INTO character_gallery (id, character_id, image_path, sort_order) VALUES (?, ?, ?, ?)"
        );

        const results: { id: string; path: string }[] = [];

        const tx = this.db!.transaction(() => {
            for (let i = 0; i < sourcePaths.length; i++) {
                const src = sourcePaths[i];
                const ext = path.extname(src).toLowerCase();
                const imgId = uuid();
                const filename = `${characterId}_${imgId.slice(0, 8)}${ext}`;
                const relativePath = path.join("media", "characters", "gallery", filename);
                const destPath = path.join(this._workDir!, relativePath);

                fs.copyFileSync(src, destPath);
                insert.run(imgId, characterId, relativePath, maxOrder.next + i);

                results.push({id: imgId, path: this.resolveMediaPath(relativePath)});
            }
        });

        tx();
        return results;
    }

    removeGalleryImage(imageId: string): boolean {
        this.ensureOpen();

        const row = this.db!.prepare("SELECT image_path FROM character_gallery WHERE id = ?").get(imageId) as {
            image_path: string
        } | undefined;
        if (!row) return false;

        this.deleteMediaFile(row.image_path);
        this.db!.prepare("DELETE FROM character_gallery WHERE id = ?").run(imageId);
        return true;
    }

    // ── Private Helpers ──

    private ensureOpen(): void {
        if (!this.db) throw new Error("No project open");
    }

    private createTempDir(): string {
        const tmpBase = path.join(app.getPath("temp"), "enno-projects");
        fs.mkdirSync(tmpBase, {recursive: true});
        return fs.mkdtempSync(path.join(tmpBase, "proj-"));
    }

    private resolveMediaPath(relativePath: string): string {
        if (!this._workDir) return relativePath;
        return path.join(this._workDir, relativePath);
    }

    private deleteMediaFile(relativePath: string): void {
        if (!this._workDir) return;
        const fullPath = path.join(this._workDir, relativePath);
        try {
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch { /* ignore */
        }
    }

    private addDirToZip(zip: AdmZip, dirPath: string, zipPrefix: string): void {
        const entries = fs.readdirSync(dirPath, {withFileTypes: true});
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;

            // Skip WAL/SHM files — they're temp SQLite files
            if (entry.name.endsWith("-wal") || entry.name.endsWith("-shm")) continue;

            if (entry.isDirectory()) {
                this.addDirToZip(zip, fullPath, zipPath);
            } else {
                const content = fs.readFileSync(fullPath);
                // adm-zip addFile expects the directory path (without filename) as second-ish arg
                zip.addFile(zipPath, content);
            }
        }
    }

    // ── Board Nodes ──

    getBoardData(): BoardData {
        this.ensureOpen();
        const nodes = this.db!.prepare("SELECT character_id AS characterid, x, y FROM character_board_nodes").all() as BoardNode[];
        const modes = this.db!.prepare("SELECT id, name, max_links_per_pair AS maxlinksperpair, data_type AS datatype, settings, sort_order AS sortorder FROM link_modes ORDER BY sort_order").all() as LinkMode[];
        const links = this.db!.prepare("SELECT id, mode_id AS modeid, source_id AS sourceid, target_id AS targetid, value FROM character_links").all() as CharacterLink[];

        return {nodes, modes, links};
    }

    addBoardNode(characterId: string, x: number, y: number): boolean {
        this.ensureOpen();
        try {
            this.db!.prepare("INSERT INTO character_board_nodes (character_id, x, y) VALUES (?, ?, ?)").run(characterId, x, y);
            return true;
        } catch {
            return false;
        }
    }

    updateBoardNode(characterId: string, x: number, y: number): boolean {
        this.ensureOpen();
        const res = this.db!.prepare("UPDATE character_board_nodes SET x = ?, y = ? WHERE character_id = ?").run(x, y, characterId);
        return res.changes > 0;
    }

    removeBoardNode(characterId: string): boolean {
        this.ensureOpen();
        const res = this.db!.prepare("DELETE FROM character_board_nodes WHERE character_id = ?").run(characterId);
        return res.changes > 0;
    }

    // ── Link Modes ──

    createLinkMode(name: string, maxLinks: number, dataType: "text" | "enum", settings: string): LinkMode {
        this.ensureOpen();
        const id = uuid();
        const maxOrder = this.db!.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS NEXT FROM link_modes").get() as {
            next: number
        };
        this.db!.prepare("INSERT INTO link_modes (id, name, max_links_per_pair, data_type, settings, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, name, maxLinks, dataType, settings, maxOrder.next);
        return {id, name, maxLinksPerPair: maxLinks, dataType, settings, sortOrder: maxOrder.next};
    }

    updateLinkMode(id: string, name: string, maxLinks: number, dataType: "text" | "enum", settings: string): boolean {
        this.ensureOpen();
        const res = this.db!.prepare("UPDATE link_modes SET name = ?, max_links_per_pair = ?, data_type = ?, settings = ? WHERE id = ?")
        .run(name, maxLinks, dataType, settings, id);
        return res.changes > 0;
    }

    deleteLinkMode(id: string): boolean {
        this.ensureOpen();
        const res = this.db!.prepare("DELETE FROM link_modes WHERE id = ?").run(id);
        return res.changes > 0;
    }

    reorderLinkModes(modeIds: string[]): void {
        this.ensureOpen();
        const update = this.db!.prepare("UPDATE link_modes SET sort_order = ? WHERE id = ?");
        const tx = this.db!.transaction(() => {
            for (let i = 0; i < modeIds.length; i++) {
                update.run(i, modeIds[i]);
            }
        });
        tx();
    }

    // ── Links ──

    createLink(modeId: string, sourceId: string, targetId: string, value: string): CharacterLink | null {
        this.ensureOpen();
        const id = uuid();
        try {
            this.db!.prepare("INSERT INTO character_links (id, mode_id, source_id, target_id, value) VALUES (?, ?, ?, ?, ?)")
            .run(id, modeId, sourceId, targetId, value);
            return {id, modeId, sourceId, targetId, value};
        } catch {
            return null;
        }
    }

    updateLink(id: string, value: string): boolean {
        this.ensureOpen();
        const res = this.db!.prepare("UPDATE character_links SET value = ? WHERE id = ?").run(value, id);
        return res.changes > 0;
    }

    deleteLink(id: string): boolean {
        this.ensureOpen();
        const res = this.db!.prepare("DELETE FROM character_links WHERE id = ?").run(id);
        return res.changes > 0;
    }

    // ── Locations ──

    getLocationsFlat(): any[] {
        this.ensureOpen();
        return this.db!.prepare("SELECT * FROM locations ORDER BY sort_order ASC").all();
    }

    getLocationsTree(): LocationTreeItem[] {
        const flat = this.getLocationsFlat();
        const map = new Map<string, LocationTreeItem>();
        const roots: LocationTreeItem[] = [];

        for (const loc of flat) {
            map.set(loc.id, {
                id: loc.id,
                name: loc.name,
                mapX: loc.map_x,
                mapY: loc.map_y,
                children: []
            });
        }

        for (const loc of flat) {
            const item = map.get(loc.id)!;
            if (loc.parent_id) {
                const parent = map.get(loc.parent_id);
                if (parent) {
                    parent.children.push(item);
                } else {
                    roots.push(item); // Fallback if parent missing
                }
            } else {
                roots.push(item);
            }
        }
        return roots;
    }

    getLocation(id: string): LocationFull | null {
        this.ensureOpen();
        const row = this.db!.prepare("SELECT * FROM locations WHERE id = ?").get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            parentId: row.parent_id,
            name: row.name,
            description: row.description,
            mapImagePath: row.map_image_path ? path.join(this._workDir!, row.map_image_path) : null,
            mapX: row.map_x,
            mapY: row.map_y,
            sortOrder: row.sort_order
        };
    }

    createLocation(parentId: string | null): string {
        this.ensureOpen();
        const id = uuid();
        const maxOrderRow = this.db!.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS NEXT FROM locations WHERE IFNULL(parent_id, '') = ?").get(parentId || "") as {
            next: number
        };
        this.db!.prepare(`
            INSERT
            INTO locations (id, parent_id, sort_order)
            VALUES (?, ?, ?)
        `).run(id, parentId, maxOrderRow.next);
        return id;
    }

    updateLocation(id: string, field: string, value: any): boolean {
        this.ensureOpen();
        const validFields = ["name", "description", "parent_id", "map_image_path", "map_x", "map_y", "sort_order"];
        if (!validFields.includes(field)) throw new Error("Invalid field");

        // Copy map image if needed
        if (field === "map_image_path" && value) {
            const ext = path.extname(value);
            const fileName = `${uuid()}${ext}`;
            const relPath = path.join("media", "locations", "maps", fileName);
            const absPath = path.join(this._workDir!, relPath);
            fs.copyFileSync(value, absPath);

            // Delete old
            const old = this.db!.prepare("SELECT map_image_path FROM locations WHERE id = ?").get(id) as {
                map_image_path: string | null
            };
            if (old && old.map_image_path) {
                try {
                    fs.unlinkSync(path.join(this._workDir!, old.map_image_path));
                } catch {
                }
            }
            value = relPath;
        }

        const res = this.db!.prepare(`UPDATE locations
                                      SET ${field}   = ?,
                                          updated_at = datetime('now')
                                      WHERE id = ?`).run(value, id);
        return res.changes > 0;
    }

    deleteLocation(id: string): boolean {
        this.ensureOpen();
        // Find image to delete
        const old = this.db!.prepare("SELECT map_image_path FROM locations WHERE id = ?").get(id) as {
            map_image_path: string | null
        };
        if (old && old.map_image_path) {
            try {
                fs.unlinkSync(path.join(this._workDir!, old.map_image_path));
            } catch {
            }
        }
        const res = this.db!.prepare("DELETE FROM locations WHERE id = ?").run(id);
        return res.changes > 0;
    }

    updateLocationsStructure(updates: { id: string, parentId: string | null, sortOrder: number }[]): void {
        this.ensureOpen();
        const update = this.db!.prepare("UPDATE locations SET parent_id = ?, sort_order = ?, updated_at = datetime(now) WHERE id = ?");
        const tx = this.db!.transaction(() => {
            for (const u of updates) {
                update.run(u.parentId, u.sortOrder, u.id);
            }
        });
        tx();
    }

    // ══ Scene Groups ══

    getScenesList(): {
        groups: {
            id: string;
            name: string;
            expanded: boolean;
            scenes: { id: string; name: string; exitPins: any }[]
        }[];
        ungrouped: { id: string; name: string; exitPins: any }[]
    } {
        this.ensureOpen();
        const groups = this.db!.prepare("SELECT id, name FROM scene_groups ORDER BY sort_order").all() as any[];
        const result: any = {groups: [], ungrouped: []};
        for (const g of groups) {
            const scenes = this.db!.prepare("SELECT id, name, exit_pins AS exitpins FROM scenes WHERE group_id = ? ORDER BY sort_order").all(g.id) as any[];
            result.groups.push({id: g.id, name: g.name, expanded: true, scenes});
        }
        result.ungrouped = this.db!.prepare("SELECT id, name, exit_pins AS exitpins FROM scenes WHERE group_id IS NULL ORDER BY sort_order").all() as any[];
        return result;
    }

    createSceneGroup(name: string): { id: string; name: string } {
        this.ensureOpen();
        const id = uuid();
        const max = this.db!.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scene_groups").get() as {
            n: number
        };
        this.db!.prepare("INSERT INTO scene_groups (id,name,sort_order) VALUES (?,?,?)").run(id, name, max.n);
        return {id, name};
    }

    deleteSceneGroup(id: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("DELETE FROM scene_groups WHERE id = ?").run(id).changes > 0;
    }

    renameSceneGroup(id: string, name: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("UPDATE scene_groups SET name = ? WHERE id = ?").run(name, id).changes > 0;
    }

    reorderScenes(order: { groups: { id: string; sceneIds: string[] }[]; ungroupedIds: string[] }): void {
        this.ensureOpen();
        const updateScene = this.db!.prepare("UPDATE scenes SET group_id = ?, sort_order = ? WHERE id = ?");
        const updateGroup = this.db!.prepare("UPDATE scene_groups SET sort_order = ? WHERE id = ?");
        const tx = this.db!.transaction(() => {
            for (let gi = 0; gi < order.groups.length; gi++) {
                const g = order.groups[gi];
                updateGroup.run(gi, g.id);
                for (let si = 0; si < g.sceneIds.length; si++) {
                    updateScene.run(g.id, si, g.sceneIds[si]);
                }
            }
            for (let i = 0; i < order.ungroupedIds.length; i++) {
                updateScene.run(null, i, order.ungroupedIds[i]);
            }
        });
        tx();
    }

    // ══ Scenes ══

    createScene(): { id: string; name: string; entryId: string; exitId: string } {
        this.ensureOpen();
        const id = uuid();
        const max = this.db!.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scenes WHERE group_id IS NULL").get() as {
            n: number
        };
        this.db!.prepare("INSERT INTO scenes (id,name,sort_order) VALUES (?,?,?)").run(id, "New Scene", max.n);
        // Create default Entry and Exit actions
        const entryId = uuid();
        const exitId = uuid();
        const defaultExitPinId = uuid();
        this.db!.prepare("INSERT INTO scene_actions (id,scene_id,action_type,data,x,y,sort_order) VALUES (?,?,?,?,?,?,?)").run(entryId, id, "entry", JSON.stringify({description: ""}), 100, 200, 0);
        this.db!.prepare("INSERT INTO scene_actions (id,scene_id,action_type,data,x,y,sort_order) VALUES (?,?,?,?,?,?,?)").run(exitId, id, "exit", JSON.stringify({
            pins: [{
                id: defaultExitPinId,
                label: "Default",
                description: ""
            }]
        }), 800, 200, 1);
        this.syncSceneExitPins(id);
        return {id, name: "New Scene", entryId, exitId};
    }

    getScene(id: string): any {
        this.ensureOpen();
        const scene = this.db!.prepare("SELECT id, name, group_id AS groupid FROM scenes WHERE id = ?").get(id) as any;
        if (!scene) return null;
        const actions = this.db!.prepare("SELECT id, scene_id AS sceneid, action_type AS actiontype, data, x, y, sort_order AS sortorder FROM scene_actions WHERE scene_id = ? ORDER BY sort_order").all(id) as any[];
        const connections = this.db!.prepare("SELECT id, scene_id AS sceneid, source_action_id AS sourceactionid, source_pin AS sourcepin, target_action_id AS targetactionid, target_pin AS targetpin FROM scene_connections WHERE scene_id = ?").all(id) as any[];
        const characters = this.db!.prepare("SELECT sc.id, sc.character_id AS characterid, c.name, c.avatar_path AS avatarpath FROM scene_characters sc JOIN characters c ON c.id = sc.character_id WHERE sc.scene_id = ?").all(id) as any[];
        // Resolve avatar paths
        for (const ch of characters) {
            ch.avatarUrl = ch.avatarPath ? this.resolveMediaPath(ch.avatarPath) : null;
            delete ch.avatarPath;
        }
        // Load gallery for each action
        for (const action of actions) {
            const gallery = this.db!.prepare("SELECT id, image_path FROM scene_action_gallery WHERE scene_action_id = ? ORDER BY sort_order").all(action.id) as any[];
            action.gallery = gallery.map((g: any) => ({id: g.id, path: this.resolveMediaPath(g.image_path)}));
        }
        return {...scene, actions, connections, characters};
    }

    updateScene(id: string, field: string, value: string): boolean {
        this.ensureOpen();
        if (!["name"].includes(field)) return false;
        return this.db!.prepare(`UPDATE scenes
                                 SET ${field}   = ?,
                                     updated_at = datetime('now')
                                 WHERE id = ?`).run(value, id).changes > 0;
    }

    deleteScene(id: string): boolean {
        this.ensureOpen();
        // Clean gallery files
        const actions = this.db!.prepare("SELECT id FROM scene_actions WHERE scene_id = ?").all(id) as any[];
        for (const a of actions) {
            const imgs = this.db!.prepare("SELECT image_path FROM scene_action_gallery WHERE scene_action_id = ?").all(a.id) as any[];
            for (const img of imgs) this.deleteMediaFile(img.image_path);
        }
        return this.db!.prepare("DELETE FROM scenes WHERE id = ?").run(id).changes > 0;
    }

    // ══ Scene Characters ══

    addSceneCharacter(sceneId: string, characterId: string): boolean {
        this.ensureOpen();
        try {
            this.db!.prepare("INSERT INTO scene_characters (id,scene_id,character_id) VALUES (?,?,?)").run(uuid(), sceneId, characterId);
            return true;
        } catch {
            return false;
        }
    }

    removeSceneCharacter(sceneId: string, characterId: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?").run(sceneId, characterId).changes > 0;
    }

    // ══ Scene Actions ══

    createSceneAction(sceneId: string, actionType: string, x: number, y: number): any {
        this.ensureOpen();
        const id = uuid();
        let data: any = {};
        if (actionType === "scene") data = {description: ""};
        else if (actionType === "character") data = {description: "", characterId: null};
        else if (actionType === "dialog") data = {characterId: null, text: ""};
        const max = this.db!.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scene_actions WHERE scene_id = ?").get(sceneId) as {
            n: number
        };
        this.db!.prepare("INSERT INTO scene_actions (id,scene_id,action_type,data,x,y,sort_order) VALUES (?,?,?,?,?,?,?)").run(id, sceneId, actionType, JSON.stringify(data), x, y, max.n);
        return {id, sceneId, actionType, data: JSON.stringify(data), x, y, sortOrder: max.n, gallery: []};
    }

    updateSceneAction(id: string, data: string): boolean {
        this.ensureOpen();
        const ok = this.db!.prepare("UPDATE scene_actions SET data = ? WHERE id = ?").run(data, id).changes > 0;
        // If this is an exit action, sync exit_pins to parent scene
        if (ok) {
            const action = this.db!.prepare("SELECT scene_id, action_type FROM scene_actions WHERE id = ?").get(id) as any;
            if (action && action.action_type === "exit") {
                this.syncSceneExitPins(action.scene_id);
            }
        }
        return ok;
    }

    syncSceneExitPins(sceneId: string): void {
        const exitAction = this.db!.prepare("SELECT data FROM scene_actions WHERE scene_id = ? AND action_type = 'exit' LIMIT 1").get(sceneId) as any;
        if (!exitAction) return;
        let pins: any[] = [];
        try {
            pins = JSON.parse(exitAction.data)?.pins || [];
        } catch {
        }
        const simplified = pins.map((p: any) => ({id: p.id, label: p.label}));
        this.db!.prepare("UPDATE scenes SET exit_pins = ? WHERE id = ?").run(JSON.stringify(simplified), sceneId);
    }

    moveSceneAction(id: string, x: number, y: number): boolean {
        this.ensureOpen();
        return this.db!.prepare("UPDATE scene_actions SET x = ?, y = ? WHERE id = ?").run(x, y, id).changes > 0;
    }

    deleteSceneAction(id: string): boolean {
        this.ensureOpen();
        // Clean gallery
        const imgs = this.db!.prepare("SELECT image_path FROM scene_action_gallery WHERE scene_action_id = ?").all(id) as any[];
        for (const img of imgs) this.deleteMediaFile(img.image_path);
        return this.db!.prepare("DELETE FROM scene_actions WHERE id = ?").run(id).changes > 0;
    }

    // ══ Scene Action Gallery ══

    importSceneActionGallery(actionId: string, sourcePaths: string[]): { id: string; path: string }[] {
        this.ensureOpen();
        if (!this._workDir) return [];
        const max = this.db!.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scene_action_gallery WHERE scene_action_id = ?").get(actionId) as {
            n: number
        };
        const insert = this.db!.prepare("INSERT INTO scene_action_gallery (id,scene_action_id,image_path,sort_order) VALUES (?,?,?,?)");
        const results: { id: string; path: string }[] = [];
        const tx = this.db!.transaction(() => {
            for (let i = 0; i < sourcePaths.length; i++) {
                const src = sourcePaths[i];
                const ext = path.extname(src).toLowerCase();
                const imgId = uuid();
                const filename = `${actionId}_${imgId.slice(0, 8)}${ext}`;
                const relativePath = path.join("media", "scenes", "action_gallery", filename);
                fs.copyFileSync(src, path.join(this._workDir!, relativePath));
                insert.run(imgId, actionId, relativePath, max.n + i);
                results.push({id: imgId, path: this.resolveMediaPath(relativePath)});
            }
        });
        tx();
        return results;
    }

    removeSceneActionGalleryImage(imageId: string): boolean {
        this.ensureOpen();
        const row = this.db!.prepare("SELECT image_path FROM scene_action_gallery WHERE id = ?").get(imageId) as any;
        if (!row) return false;
        this.deleteMediaFile(row.image_path);
        return this.db!.prepare("DELETE FROM scene_action_gallery WHERE id = ?").run(imageId).changes > 0;
    }

    // ══ Scene Connections ══

    createSceneConnection(sceneId: string, sourceActionId: string, sourcePin: string, targetActionId: string, targetPin: string): any {
        this.ensureOpen();
        const id = uuid();
        this.db!.prepare("INSERT INTO scene_connections (id,scene_id,source_action_id,source_pin,target_action_id,target_pin) VALUES (?,?,?,?,?,?)").run(id, sceneId, sourceActionId, sourcePin, targetActionId, targetPin);
        return {id, sceneId, sourceActionId, sourcePin, targetActionId, targetPin};
    }

    deleteSceneConnection(id: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("DELETE FROM scene_connections WHERE id = ?").run(id).changes > 0;
    }

    // ══ Quest Groups ══

    getQuestsList(): { groups: { id: string; name: string; expanded: boolean; quests: any[] }[]; ungrouped: any[] } {
        this.ensureOpen();
        const groups = this.db!.prepare("SELECT id, name FROM quest_groups ORDER BY sort_order").all() as any[];
        const result: any = {groups: [], ungrouped: []};
        for (const g of groups) {
            const quests = this.db!.prepare("SELECT id, name, icon_path AS iconpath, parent_id AS parentid FROM quests WHERE group_id = ? ORDER BY sort_order").all(g.id) as any[];
            for (const q of quests) q.iconUrl = q.iconPath ? this.resolveMediaPath(q.iconPath) : null;
            result.groups.push({id: g.id, name: g.name, expanded: true, quests});
        }
        const ungrouped = this.db!.prepare("SELECT id, name, icon_path AS iconpath, parent_id AS parentid FROM quests WHERE group_id IS NULL ORDER BY sort_order").all() as any[];
        for (const q of ungrouped) q.iconUrl = q.iconPath ? this.resolveMediaPath(q.iconPath) : null;
        result.ungrouped = ungrouped;
        return result;
    }

    createQuestGroup(name: string): { id: string; name: string } {
        this.ensureOpen();
        const id = uuid();
        const max = this.db!.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM quest_groups").get() as {
            n: number
        };
        this.db!.prepare("INSERT INTO quest_groups (id,name,sort_order) VALUES (?,?,?)").run(id, name, max.n);
        return {id, name};
    }

    deleteQuestGroup(id: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("DELETE FROM quest_groups WHERE id = ?").run(id).changes > 0;
    }

    renameQuestGroup(id: string, name: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("UPDATE quest_groups SET name = ? WHERE id = ?").run(name, id).changes > 0;
    }

    reorderQuests(order: { groups: { id: string; questIds: string[] }[]; ungroupedIds: string[] }): void {
        this.ensureOpen();
        const updateQuest = this.db!.prepare("UPDATE quests SET group_id = ?, sort_order = ? WHERE id = ?");
        const updateGroup = this.db!.prepare("UPDATE quest_groups SET sort_order = ? WHERE id = ?");
        const tx = this.db!.transaction(() => {
            for (let gi = 0; gi < order.groups.length; gi++) {
                const g = order.groups[gi];
                updateGroup.run(gi, g.id);
                for (let qi = 0; qi < g.questIds.length; qi++) updateQuest.run(g.id, qi, g.questIds[qi]);
            }
            for (let i = 0; i < order.ungroupedIds.length; i++) updateQuest.run(null, i, order.ungroupedIds[i]);
        });
        tx();
    }

    // ══ Quests ══

    createQuest(parentId?: string | null, groupId?: string | null): any {
        this.ensureOpen();
        const id = uuid();
        const max = this.db!.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM quests WHERE ifnull(group_id,'') = ? AND ifnull(parent_id,'') = ?").get(groupId || "", parentId || "") as {
            n: number
        };
        this.db!.prepare("INSERT INTO quests (id,name,parent_id,group_id,sort_order) VALUES (?,?,?,?,?)").run(id, "New Quest", parentId || null, groupId || null, max.n);
        return {
            id,
            name: "New Quest",
            description: "",
            iconUrl: null,
            parentId: parentId || null,
            groupId: groupId || null,
            gallery: []
        };
    }

    getQuest(id: string): any {
        this.ensureOpen();
        const row = this.db!.prepare("SELECT id, name, description, icon_path, parent_id AS parentid, group_id AS groupid FROM quests WHERE id = ?").get(id) as any;
        if (!row) return null;
        const gallery = this.db!.prepare("SELECT id, image_path FROM quest_gallery WHERE quest_id = ? ORDER BY sort_order").all(id) as any[];
        return {
            id: row.id, name: row.name, description: row.description,
            iconUrl: row.icon_path ? this.resolveMediaPath(row.icon_path) : null,
            parentId: row.parentId, groupId: row.groupId,
            gallery: gallery.map((g: any) => ({id: g.id, path: this.resolveMediaPath(g.image_path)}))
        };
    }

    updateQuest(id: string, field: string, value: string): boolean {
        this.ensureOpen();
        if (!["name", "description"].includes(field)) return false;
        return this.db!.prepare(`UPDATE quests
                                 SET ${field}   = ?,
                                     updated_at = datetime('now')
                                 WHERE id = ?`).run(value, id).changes > 0;
    }

    deleteQuest(id: string): boolean {
        this.ensureOpen();
        // Clean icon
        const row = this.db!.prepare("SELECT icon_path FROM quests WHERE id = ?").get(id) as any;
        if (row?.icon_path) this.deleteMediaFile(row.icon_path);
        // Clean gallery
        const imgs = this.db!.prepare("SELECT image_path FROM quest_gallery WHERE quest_id = ?").all(id) as any[];
        for (const img of imgs) this.deleteMediaFile(img.image_path);
        return this.db!.prepare("DELETE FROM quests WHERE id = ?").run(id).changes > 0;
    }

    importQuestIcon(questId: string, sourcePath: string): string | null {
        this.ensureOpen();
        if (!this._workDir) return null;
        const ext = path.extname(sourcePath).toLowerCase();
        const filename = `${questId}${ext}`;
        const relativePath = path.join("media", "quests", "icons", filename);
        const destPath = path.join(this._workDir, relativePath);
        // Remove old
        const old = this.db!.prepare("SELECT icon_path FROM quests WHERE id = ?").get(questId) as any;
        if (old?.icon_path) this.deleteMediaFile(old.icon_path);
        fs.copyFileSync(sourcePath, destPath);
        this.db!.prepare("UPDATE quests SET icon_path = ?, updated_at = datetime('now') WHERE id = ?").run(relativePath, questId);
        return this.resolveMediaPath(relativePath);
    }

    importQuestGallery(questId: string, sourcePaths: string[]): { id: string; path: string }[] {
        this.ensureOpen();
        if (!this._workDir) return [];
        const max = this.db!.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM quest_gallery WHERE quest_id = ?").get(questId) as {
            n: number
        };
        const insert = this.db!.prepare("INSERT INTO quest_gallery (id,quest_id,image_path,sort_order) VALUES (?,?,?,?)");
        const results: { id: string; path: string }[] = [];
        const tx = this.db!.transaction(() => {
            for (let i = 0; i < sourcePaths.length; i++) {
                const imgId = uuid();
                const ext = path.extname(sourcePaths[i]).toLowerCase();
                const filename = `${questId}_${imgId.slice(0, 8)}${ext}`;
                const relativePath = path.join("media", "quests", "gallery", filename);
                fs.copyFileSync(sourcePaths[i], path.join(this._workDir!, relativePath));
                insert.run(imgId, questId, relativePath, max.n + i);
                results.push({id: imgId, path: this.resolveMediaPath(relativePath)});
            }
        });
        tx();
        return results;
    }

    removeQuestGalleryImage(imageId: string): boolean {
        this.ensureOpen();
        const row = this.db!.prepare("SELECT image_path FROM quest_gallery WHERE id = ?").get(imageId) as any;
        if (!row) return false;
        this.deleteMediaFile(row.image_path);
        return this.db!.prepare("DELETE FROM quest_gallery WHERE id = ?").run(imageId).changes > 0;
    }

    updateQuestsStructure(updates: {
        id: string;
        parentId: string | null;
        groupId: string | null;
        sortOrder: number
    }[]): void {
        this.ensureOpen();
        const update = this.db!.prepare("UPDATE quests SET parent_id = ?, group_id = ?, sort_order = ?, updated_at = datetime(now) WHERE id = ?");
        const tx = this.db!.transaction(() => {
            for (const u of updates) update.run(u.parentId, u.groupId, u.sortOrder, u.id);
        });
        tx();
    }

    // ══ Storyline ══

    getStorylineData(): any {
        this.ensureOpen();
        const nodes = this.db!.prepare("SELECT id, node_type AS nodetype, ref_id AS refid, data, group_id AS groupid, x, y FROM storyline_nodes").all();
        const connections = this.db!.prepare("SELECT id, source_node_id AS sourcenodeid, source_pin AS sourcepin, target_node_id AS targetnodeid, target_pin AS targetpin FROM storyline_connections").all();
        const groupPositions = this.db!.prepare("SELECT group_id AS groupid, x, y, width, height FROM storyline_group_positions").all();
        return {nodes, connections, groupPositions};
    }

    addStorylineNode(nodeType: string, refId: string | null, groupId: string | null, x: number, y: number, data?: string): any {
        this.ensureOpen();
        const id = uuid();
        this.db!.prepare("INSERT INTO storyline_nodes (id,node_type,ref_id,data,group_id,x,y) VALUES (?,?,?,?,?,?,?)").run(id, nodeType, refId, data || "{}", groupId, x, y);
        return {id, nodeType, refId, data: data || "{}", groupId, x, y};
    }

    updateStorylineNode(id: string, x: number, y: number, groupId?: string | null): boolean {
        this.ensureOpen();
        if (groupId !== undefined) {
            return this.db!.prepare("UPDATE storyline_nodes SET x = ?, y = ?, group_id = ? WHERE id = ?").run(x, y, groupId, id).changes > 0;
        }
        return this.db!.prepare("UPDATE storyline_nodes SET x = ?, y = ? WHERE id = ?").run(x, y, id).changes > 0;
    }

    updateStorylineNodeData(id: string, data: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("UPDATE storyline_nodes SET data = ? WHERE id = ?").run(data, id).changes > 0;
    }

    deleteStorylineNode(id: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("DELETE FROM storyline_nodes WHERE id = ?").run(id).changes > 0;
    }

    createStorylineConnection(sourceNodeId: string, sourcePin: string, targetNodeId: string, targetPin: string): any {
        this.ensureOpen();
        const id = uuid();
        this.db!.prepare("INSERT INTO storyline_connections (id,source_node_id,source_pin,target_node_id,target_pin) VALUES (?,?,?,?,?)").run(id, sourceNodeId, sourcePin, targetNodeId, targetPin);
        return {id, sourceNodeId, sourcePin, targetNodeId, targetPin};
    }

    deleteStorylineConnection(id: string): boolean {
        this.ensureOpen();
        return this.db!.prepare("DELETE FROM storyline_connections WHERE id = ?").run(id).changes > 0;
    }

    updateStorylineGroupPosition(groupId: string, x: number, y: number, width: number, height: number): void {
        this.ensureOpen();
        const exists = this.db!.prepare("SELECT 1 FROM storyline_group_positions WHERE group_id = ?").get(groupId);
        if (exists) {
            this.db!.prepare("UPDATE storyline_group_positions SET x=?,y=?,width=?,height=? WHERE group_id=?").run(x, y, width, height, groupId);
        } else {
            this.db!.prepare("INSERT INTO storyline_group_positions (group_id,x,y,width,height) VALUES (?,?,?,?,?)").run(groupId, x, y, width, height);
        }
    }

    // ══ Quests List (for pickers) ══

    getAllQuestsFlat(): { id: string; name: string; iconUrl: string | null }[] {
        this.ensureOpen();
        const rows = this.db!.prepare("SELECT id, name, icon_path FROM quests ORDER BY name").all() as any[];
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            iconUrl: r.icon_path ? this.resolveMediaPath(r.icon_path) : null
        }));
    }
}
