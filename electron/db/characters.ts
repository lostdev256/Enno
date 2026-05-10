import {EnnoDatabaseInfo, uuid, deleteFile} from "./utils";

import path from "node:path";
import fs from "node:fs";

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

export class CharactersEnnoDatabase {
    constructor(private _dbInfo: EnnoDatabaseInfo) {
    }

    getCharactersList(): SidebarData {
        const groups = this._dbInfo.db.prepare(
            "SELECT id, name, sort_order FROM character_groups ORDER BY sort_order"
        ).all() as { id: string; name: string; sort_order: number }[];

        const result: SidebarData = {groups: [], ungrouped: []};

        for (const g of groups) {
            const chars = this._dbInfo.db.prepare(
                "SELECT id, name, avatar_path FROM characters WHERE group_id = ? ORDER BY sort_order"
            ).all(g.id) as { id: string; name: string; avatar_path: string | null }[];

            result.groups.push({
                id: g.id,
                name: g.name,
                expanded: true,
                characters: chars.map(c => ({
                    id: c.id,
                    name: c.name,
                    avatarUrl: c.avatar_path ? path.join(this._dbInfo.dir, c.avatar_path) : null
                }))
            });
        }

        // Ungrouped characters
        const ungrouped = this._dbInfo.db.prepare(
            "SELECT id, name, avatar_path AS avatarPath FROM characters WHERE group_id IS NULL ORDER BY sort_order"
        ).all() as { id: string; name: string; avatarPath: string | null }[];

        result.ungrouped = ungrouped.map(c => ({
            id: c.id,
            name: c.name,
            avatarUrl: c.avatarPath ? path.join(this._dbInfo.dir, c.avatarPath) : null
        }));

        return result;
    }

    getCharacter(id: string): CharacterFull | null {
        const row = this._dbInfo.db.prepare(
            "SELECT id, name, description, avatar_path FROM characters WHERE id = ?"
        ).get(id) as { id: string; name: string; description: string; avatar_path: string | null } | undefined;

        if (!row) return null;

        const galleryRows = this._dbInfo.db.prepare(
            "SELECT id, image_path AS imagePath FROM character_gallery WHERE character_id = ? ORDER BY sort_order"
        ).all(id) as { id: string; imagePath: string }[];

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            avatarUrl: row.avatar_path ? path.join(this._dbInfo.dir, row.avatar_path) : null,
            gallery: galleryRows.map(g => ({
                id: g.id,
                path: path.join(this._dbInfo.dir, g.imagePath)
            }))
        };
    }

    createCharacter(): CharacterFull {
        const id = uuid();
        const maxOrder = this._dbInfo.db.prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM characters WHERE group_id IS NULL"
        ).get() as { next: number };

        this._dbInfo.db.prepare(
            "INSERT INTO characters (id, name, description, sort_order) VALUES (?, ?, ?, ?)"
        ).run(id, "New Character", "", maxOrder.next);

        return {id, name: "New Character", description: "", avatarUrl: null, gallery: []};
    }

    updateCharacter(id: string, field: string, value: string): boolean {
        const allowedFields = ["name", "description"];
        if (!allowedFields.includes(field)) return false;

        this._dbInfo.db.prepare(
            `UPDATE characters
             SET ${field}   = ?,
                 updated_at = DATETIME('now')
             WHERE id = ?`
        ).run(value, id);

        return true;
    }

    deleteCharacter(id: string): boolean {
        // Get avatar and gallery paths to clean up files
        const char = this._dbInfo.db.prepare("SELECT avatar_path FROM characters WHERE id = ?").get(id) as {
            avatar_path: string | null
        } | undefined;
        if (!char) return false;

        // Delete gallery files
        const galleryRows = this._dbInfo.db.prepare("SELECT image_path FROM character_gallery WHERE character_id = ?").all(id) as {
            image_path: string
        }[];
        for (const g of galleryRows) {
            deleteFile(path.join(this._dbInfo.dir, g.image_path));
        }

        // Delete avatar file
        if (char.avatar_path) {
            deleteFile(path.join(this._dbInfo.dir, char.avatar_path));
        }

        // DELETE CASCADE will handle character_gallery
        this._dbInfo.db.prepare("DELETE FROM characters WHERE id = ?").run(id);
        return true;
    }

    reorderCharacters(order: ReorderPayload): void {
        const updateChar = this._dbInfo.db.prepare("UPDATE characters SET group_id = ?, sort_order = ? WHERE id = ?");
        const updateGroup = this._dbInfo.db.prepare("UPDATE character_groups SET sort_order = ? WHERE id = ?");

        const tx = this._dbInfo.db.transaction(() => {
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

    createGroup(name: string): { id: string; name: string } {
        const id = uuid();
        const maxOrder = this._dbInfo.db.prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM character_groups"
        ).get() as { next: number };

        this._dbInfo.db.prepare(
            "INSERT INTO character_groups (id, name, sort_order) VALUES (?, ?, ?)"
        ).run(id, name, maxOrder.next);

        return {id, name};
    }

    deleteGroup(id: string): boolean {
        // Characters become ungrouped (ON DELETE SET NULL)
        const result = this._dbInfo.db.prepare("DELETE FROM character_groups WHERE id = ?").run(id);
        return result.changes > 0;
    }

    renameGroup(id: string, newName: string): boolean {
        const result = this._dbInfo.db.prepare("UPDATE character_groups SET name = ? WHERE id = ?").run(newName, id);
        return result.changes > 0;
    }

    importAvatar(characterId: string, sourcePath: string): string | null {
        const ext = path.extname(sourcePath).toLowerCase();
        const filename = `${characterId}${ext}`;
        const relativePath = path.join("media", "characters", "avatars", filename);
        const destPath = path.join(this._dbInfo.dir, relativePath);

        // Remove old avatar if exists
        const old = this._dbInfo.db.prepare("SELECT avatar_path FROM characters WHERE id = ?").get(characterId) as {
            avatar_path: string | null
        } | undefined;
        if (old?.avatar_path) {
            deleteFile(path.join(this._dbInfo.dir, old.avatar_path));
        }

        // Copy new file
        fs.copyFileSync(sourcePath, destPath);

        // Update DB
        this._dbInfo.db.prepare("UPDATE characters SET avatar_path = ?, updated_at = DATETIME('now') WHERE id = ?").run(relativePath, characterId);

        return destPath;
    }

    importGalleryImages(characterId: string, sourcePaths: string[]): { id: string; path: string }[] {
        const maxOrder = this._dbInfo.db.prepare(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM character_gallery WHERE character_id = ?"
        ).get(characterId) as { next: number };

        const insert = this._dbInfo.db.prepare(
            "INSERT INTO character_gallery (id, character_id, image_path, sort_order) VALUES (?, ?, ?, ?)"
        );

        const results: { id: string; path: string }[] = [];

        const tx = this._dbInfo.db.transaction(() => {
            for (let i = 0; i < sourcePaths.length; i++) {
                const src = sourcePaths[i];
                const ext = path.extname(src).toLowerCase();
                const imgId = uuid();
                const filename = `${characterId}_${imgId.slice(0, 8)}${ext}`;
                const relativePath = path.join("media", "characters", "gallery", filename);
                const destPath = path.join(this._dbInfo.dir, relativePath);

                fs.copyFileSync(src, destPath);
                insert.run(imgId, characterId, relativePath, maxOrder.next + i);

                results.push({id: imgId, path: destPath});
            }
        });

        tx();
        return results;
    }

    removeGalleryImage(imageId: string): boolean {
        const row = this._dbInfo.db.prepare("SELECT image_path FROM character_gallery WHERE id = ?").get(imageId) as {
            image_path: string
        } | undefined;
        if (!row) return false;

        deleteFile(path.join(this._dbInfo.dir, row.image_path));
        this._dbInfo.db.prepare("DELETE FROM character_gallery WHERE id = ?").run(imageId);
        return true;
    }

    getBoardData(): BoardData {
        const nodes = this._dbInfo.db.prepare("SELECT character_id AS characterId, x, y FROM character_board_nodes").all() as BoardNode[];
        const modes = this._dbInfo.db.prepare("SELECT id, name, max_links_per_pair AS maxLinksPerPair, data_type AS dataType, settings, sort_order AS sortOrder FROM link_modes ORDER BY sort_order").all() as LinkMode[];
        const links = this._dbInfo.db.prepare("SELECT id, mode_id AS modeId, source_id AS sourceId, target_id AS targetId, value FROM character_links").all() as CharacterLink[];

        return {nodes, modes, links};
    }

    addBoardNode(characterId: string, x: number, y: number): boolean {
        try {
            this._dbInfo.db.prepare("INSERT INTO character_board_nodes (character_id, x, y) VALUES (?, ?, ?)").run(characterId, x, y);
            return true;
        } catch {
            return false;
        }
    }

    updateBoardNode(characterId: string, x: number, y: number): boolean {
        const res = this._dbInfo.db.prepare("UPDATE character_board_nodes SET x = ?, y = ? WHERE character_id = ?").run(x, y, characterId);
        return res.changes > 0;
    }

    removeBoardNode(characterId: string): boolean {
        const res = this._dbInfo.db.prepare("DELETE FROM character_board_nodes WHERE character_id = ?").run(characterId);
        return res.changes > 0;
    }

    createLinkMode(name: string, maxLinks: number, dataType: "text" | "enum", settings: string): LinkMode {
        const id = uuid();
        const maxOrder = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM link_modes").get() as {
            next: number
        };
        this._dbInfo.db.prepare("INSERT INTO link_modes (id, name, max_links_per_pair, data_type, settings, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, name, maxLinks, dataType, settings, maxOrder.next);
        return {id, name, maxLinksPerPair: maxLinks, dataType, settings, sortOrder: maxOrder.next};
    }

    updateLinkMode(id: string, name: string, maxLinks: number, dataType: "text" | "enum", settings: string): boolean {
        const res = this._dbInfo.db.prepare("UPDATE link_modes SET name = ?, max_links_per_pair = ?, data_type = ?, settings = ? WHERE id = ?")
            .run(name, maxLinks, dataType, settings, id);
        return res.changes > 0;
    }

    deleteLinkMode(id: string): boolean {
        const res = this._dbInfo.db.prepare("DELETE FROM link_modes WHERE id = ?").run(id);
        return res.changes > 0;
    }

    reorderLinkModes(modeIds: string[]): void {
        const update = this._dbInfo.db.prepare("UPDATE link_modes SET sort_order = ? WHERE id = ?");
        const tx = this._dbInfo.db.transaction(() => {
            for (let i = 0; i < modeIds.length; i++) {
                update.run(i, modeIds[i]);
            }
        });
        tx();
    }

    createLink(modeId: string, sourceId: string, targetId: string, value: string): CharacterLink | null {
        const id = uuid();
        try {
            this._dbInfo.db.prepare("INSERT INTO character_links (id, mode_id, source_id, target_id, value) VALUES (?, ?, ?, ?, ?)")
                .run(id, modeId, sourceId, targetId, value);
            return {id, modeId, sourceId, targetId, value};
        } catch {
            return null;
        }
    }

    updateLink(id: string, value: string): boolean {
        const res = this._dbInfo.db.prepare("UPDATE character_links SET value = ? WHERE id = ?").run(value, id);
        return res.changes > 0;
    }

    deleteLink(id: string): boolean {
        const res = this._dbInfo.db.prepare("DELETE FROM character_links WHERE id = ?").run(id);
        return res.changes > 0;
    }
}
