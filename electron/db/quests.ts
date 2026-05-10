import {EnnoDatabaseInfo, uuid, deleteFile} from "./utils";

import path from "node:path";
import fs from "node:fs";

export class QuestsEnnoDatabase {
    constructor(private _dbInfo: EnnoDatabaseInfo) {
    }

    getQuestsList(): { groups: { id: string; name: string; expanded: boolean; quests: any[] }[]; ungrouped: any[] } {
        const groups = this._dbInfo.db.prepare("SELECT id, name FROM quest_groups ORDER BY sort_order").all() as any[];
        const result: any = {groups: [], ungrouped: []};
        for (const g of groups) {
            const quests = this._dbInfo.db.prepare("SELECT id, name, icon_path AS iconPath, parent_id AS parentId FROM quests WHERE group_id = ? ORDER BY sort_order").all(g.id) as any[];
            for (const q of quests) q.iconUrl = q.iconPath ? path.join(this._dbInfo.dir, q.iconPath) : null;
            result.groups.push({id: g.id, name: g.name, expanded: true, quests});
        }
        const ungrouped = this._dbInfo.db.prepare("SELECT id, name, icon_path AS iconPath, parent_id AS parentId FROM quests WHERE group_id IS NULL ORDER BY sort_order").all() as any[];
        for (const q of ungrouped) q.iconUrl = q.iconPath ? path.join(this._dbInfo.dir, q.iconPath) : null;
        result.ungrouped = ungrouped;
        return result;
    }

    createQuestGroup(name: string): { id: string; name: string } {
        const id = uuid();
        const max = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM quest_groups").get() as {
            n: number
        };
        this._dbInfo.db.prepare("INSERT INTO quest_groups (id,name,sort_order) VALUES (?,?,?)").run(id, name, max.n);
        return {id, name};
    }

    deleteQuestGroup(id: string): boolean {
        return this._dbInfo.db.prepare("DELETE FROM quest_groups WHERE id = ?").run(id).changes > 0;
    }

    renameQuestGroup(id: string, name: string): boolean {
        return this._dbInfo.db.prepare("UPDATE quest_groups SET name = ? WHERE id = ?").run(name, id).changes > 0;
    }

    reorderQuests(order: { groups: { id: string; questIds: string[] }[]; ungroupedIds: string[] }): void {
        const updateQuest = this._dbInfo.db.prepare("UPDATE quests SET group_id = ?, sort_order = ? WHERE id = ?");
        const updateGroup = this._dbInfo.db.prepare("UPDATE quest_groups SET sort_order = ? WHERE id = ?");
        const tx = this._dbInfo.db.transaction(() => {
            for (let gi = 0; gi < order.groups.length; gi++) {
                const g = order.groups[gi];
                updateGroup.run(gi, g.id);
                for (let qi = 0; qi < g.questIds.length; qi++) updateQuest.run(g.id, qi, g.questIds[qi]);
            }
            for (let i = 0; i < order.ungroupedIds.length; i++) updateQuest.run(null, i, order.ungroupedIds[i]);
        });
        tx();
    }

    createQuest(parentId?: string | null, groupId?: string | null): any {
        const id = uuid();
        const max = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM quests WHERE IFNULL(group_id,'') = ? AND IFNULL(parent_id,'') = ?").get(groupId || "", parentId || "") as {
            n: number
        };
        this._dbInfo.db.prepare("INSERT INTO quests (id,name,parent_id,group_id,sort_order) VALUES (?,?,?,?,?)").run(id, "New Quest", parentId || null, groupId || null, max.n);
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
        const row = this._dbInfo.db.prepare("SELECT id, name, description, icon_path AS iconPath, parent_id AS parentId, group_id AS groupId FROM quests WHERE id = ?").get(id) as any;
        if (!row) return null;
        const gallery = this._dbInfo.db.prepare("SELECT id, image_path AS imagePath FROM quest_gallery WHERE quest_id = ? ORDER BY sort_order").all(id) as any[];
        return {
            id: row.id, name: row.name, description: row.description,
            iconUrl: row.iconPath ? path.join(this._dbInfo.dir, row.iconPath) : null,
            parentId: row.parentId, groupId: row.groupId,
            gallery: gallery.map((g: any) => ({id: g.id, path: path.join(this._dbInfo.dir, g.imagePath)}))
        };
    }

    updateQuest(id: string, field: string, value: string): boolean {
        if (!["name", "description"].includes(field)) return false;
        return this._dbInfo.db.prepare(`UPDATE quests
                                        SET ${field}   = ?,
                                            updated_at = DATETIME('now')
                                        WHERE id = ?`).run(value, id).changes > 0;
    }

    deleteQuest(id: string): boolean {
        // Clean icon
        const row = this._dbInfo.db.prepare("SELECT icon_path FROM quests WHERE id = ?").get(id) as any;
        if (row?.icon_path) deleteFile(path.join(this._dbInfo.dir, row.icon_path));
        // Clean gallery
        const imgs = this._dbInfo.db.prepare("SELECT image_path FROM quest_gallery WHERE quest_id = ?").all(id) as any[];
        for (const img of imgs) deleteFile(path.join(this._dbInfo.dir, img.image_path));
        return this._dbInfo.db.prepare("DELETE FROM quests WHERE id = ?").run(id).changes > 0;
    }

    importQuestIcon(questId: string, sourcePath: string): string | null {
        const ext = path.extname(sourcePath).toLowerCase();
        const filename = `${questId}${ext}`;
        const relativePath = path.join("media", "quests", "icons", filename);
        const destPath = path.join(this._dbInfo.dir, relativePath);
        // Remove old
        const old = this._dbInfo.db.prepare("SELECT icon_path FROM quests WHERE id = ?").get(questId) as any;
        if (old?.icon_path) deleteFile(path.join(this._dbInfo.dir, old.icon_path));
        fs.copyFileSync(sourcePath, destPath);
        this._dbInfo.db.prepare("UPDATE quests SET icon_path = ?, updated_at = DATETIME('now') WHERE id = ?").run(relativePath, questId);
        return destPath;
    }

    importQuestGallery(questId: string, sourcePaths: string[]): { id: string; path: string }[] {
        const max = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM quest_gallery WHERE quest_id = ?").get(questId) as {
            n: number
        };
        const insert = this._dbInfo.db.prepare("INSERT INTO quest_gallery (id,quest_id,image_path,sort_order) VALUES (?,?,?,?)");
        const results: { id: string; path: string }[] = [];
        const tx = this._dbInfo.db.transaction(() => {
            for (let i = 0; i < sourcePaths.length; i++) {
                const imgId = uuid();
                const ext = path.extname(sourcePaths[i]).toLowerCase();
                const filename = `${questId}_${imgId.slice(0, 8)}${ext}`;
                const relativePath = path.join("media", "quests", "gallery", filename);
                const destPath = path.join(this._dbInfo.dir, relativePath);
                fs.copyFileSync(sourcePaths[i], destPath);
                insert.run(imgId, questId, relativePath, max.n + i);
                results.push({id: imgId, path: destPath});
            }
        });
        tx();
        return results;
    }

    removeQuestGalleryImage(imageId: string): boolean {
        const row = this._dbInfo.db.prepare("SELECT image_path FROM quest_gallery WHERE id = ?").get(imageId) as any;
        if (!row) return false;
        deleteFile(path.join(this._dbInfo.dir, row.image_path));
        return this._dbInfo.db.prepare("DELETE FROM quest_gallery WHERE id = ?").run(imageId).changes > 0;
    }

    updateQuestsStructure(updates: {
        id: string;
        parentId: string | null;
        groupId: string | null;
        sortOrder: number
    }[]): void {
        const update = this._dbInfo.db.prepare("UPDATE quests SET parent_id = ?, group_id = ?, sort_order = ?, updated_at = DATETIME('now') WHERE id = ?");
        const tx = this._dbInfo.db.transaction(() => {
            for (const u of updates) update.run(u.parentId, u.groupId, u.sortOrder, u.id);
        });
        tx();
    }

    getAllQuestsFlat(): { id: string; name: string; iconUrl: string | null }[] {
        const rows = this._dbInfo.db.prepare("SELECT id, name, icon_path AS iconPath FROM quests ORDER BY name").all() as any[];
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            iconUrl: r.iconPath ? path.join(this._dbInfo.dir, r.iconPath) : null
        }));
    }
}
