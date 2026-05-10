import {EnnoDatabaseInfo, uuid, deleteFile} from "./utils";

import path from "node:path";
import fs from "node:fs";

export class ScenesEnnoDatabase {
    constructor(private _dbInfo: EnnoDatabaseInfo) {
    }

    getScenesList(): {
        groups: {
            id: string;
            name: string;
            expanded: boolean;
            scenes: { id: string; name: string; exitPins: any }[]
        }[];
        ungrouped: { id: string; name: string; exitPins: any }[]
    } {
        const groups = this._dbInfo.db.prepare("SELECT id, name FROM scene_groups ORDER BY sort_order").all() as any[];
        const result: any = {groups: [], ungrouped: []};
        for (const g of groups) {
            const scenes = this._dbInfo.db.prepare("SELECT id, name, exit_pins AS exitPins FROM scenes WHERE group_id = ? ORDER BY sort_order").all(g.id) as any[];
            result.groups.push({id: g.id, name: g.name, expanded: true, scenes});
        }
        result.ungrouped = this._dbInfo.db.prepare("SELECT id, name, exit_pins AS exitPins FROM scenes WHERE group_id IS NULL ORDER BY sort_order").all() as any[];
        return result;
    }

    createSceneGroup(name: string): { id: string; name: string } {
        const id = uuid();
        const max = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scene_groups").get() as {
            n: number
        };
        this._dbInfo.db.prepare("INSERT INTO scene_groups (id,name,sort_order) VALUES (?,?,?)").run(id, name, max.n);
        return {id, name};
    }

    deleteSceneGroup(id: string): boolean {
        return this._dbInfo.db.prepare("DELETE FROM scene_groups WHERE id = ?").run(id).changes > 0;
    }

    renameSceneGroup(id: string, name: string): boolean {
        return this._dbInfo.db.prepare("UPDATE scene_groups SET name = ? WHERE id = ?").run(name, id).changes > 0;
    }

    reorderScenes(order: { groups: { id: string; sceneIds: string[] }[]; ungroupedIds: string[] }): void {
        const updateScene = this._dbInfo.db.prepare("UPDATE scenes SET group_id = ?, sort_order = ? WHERE id = ?");
        const updateGroup = this._dbInfo.db.prepare("UPDATE scene_groups SET sort_order = ? WHERE id = ?");
        const tx = this._dbInfo.db.transaction(() => {
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

    createScene(): { id: string; name: string; entryId: string; exitId: string } {
        const id = uuid();
        const max = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scenes WHERE group_id IS NULL").get() as {
            n: number
        };
        this._dbInfo.db.prepare("INSERT INTO scenes (id,name,sort_order) VALUES (?,?,?)").run(id, "New Scene", max.n);
        // Create default Entry and Exit actions
        const entryId = uuid();
        const exitId = uuid();
        const defaultExitPinId = uuid();
        this._dbInfo.db.prepare("INSERT INTO scene_actions (id,scene_id,action_type,data,x,y,sort_order) VALUES (?,?,?,?,?,?,?)").run(entryId, id, "entry", JSON.stringify({description: ""}), 100, 200, 0);
        this._dbInfo.db.prepare("INSERT INTO scene_actions (id,scene_id,action_type,data,x,y,sort_order) VALUES (?,?,?,?,?,?,?)").run(exitId, id, "exit", JSON.stringify({
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
        const scene = this._dbInfo.db.prepare("SELECT id, name, group_id AS groupId FROM scenes WHERE id = ?").get(id) as any;
        if (!scene) return null;
        const actions = this._dbInfo.db.prepare("SELECT id, scene_id AS sceneId, action_type AS actionType, data, x, y, sort_order AS sortOrder FROM scene_actions WHERE scene_id = ? ORDER BY sort_order").all(id) as any[];
        const connections = this._dbInfo.db.prepare("SELECT id, scene_id AS sceneId, source_action_id AS sourceActionId, source_pin AS sourcePin, target_action_id AS targetActionId, target_pin AS targetPin FROM scene_connections WHERE scene_id = ?").all(id) as any[];
        const characters = this._dbInfo.db.prepare("SELECT sc.id, sc.character_id AS characterId, c.name, c.avatar_path AS avatarPath FROM scene_characters sc JOIN characters c ON c.id = sc.character_id WHERE sc.scene_id = ?").all(id) as any[];

        console.log(`[DB] getScene ${id}: actions=${actions.length}, connections=${connections.length}, characters=${characters.length}`);
        // Resolve avatar paths
        for (const ch of characters) {
            ch.avatarUrl = ch.avatarPath ? path.join(this._dbInfo.dir, ch.avatarPath) : null;
            delete ch.avatarPath;
        }
        // Load gallery for each action
        for (const action of actions) {
            const gallery = this._dbInfo.db.prepare("SELECT id, image_path FROM scene_action_gallery WHERE scene_action_id = ? ORDER BY sort_order").all(action.id) as any[];
            action.gallery = gallery.map((g: any) => ({id: g.id, path: path.join(this._dbInfo.dir, g.image_path)}));
        }
        return {...scene, actions, connections, characters};
    }

    updateScene(id: string, field: string, value: string): boolean {
        if (!["name"].includes(field)) return false;
        return this._dbInfo.db.prepare(`UPDATE scenes
                                        SET ${field}   = ?,
                                            updated_at = DATETIME('now')
                                        WHERE id = ?`).run(value, id).changes > 0;
    }

    deleteScene(id: string): boolean {
        // Clean gallery files
        const actions = this._dbInfo.db.prepare("SELECT id FROM scene_actions WHERE scene_id = ?").all(id) as any[];
        for (const a of actions) {
            const imgs = this._dbInfo.db.prepare("SELECT image_path FROM scene_action_gallery WHERE scene_action_id = ?").all(a.id) as any[];
            for (const img of imgs) deleteFile(path.join(this._dbInfo.dir, img.image_path));
        }
        return this._dbInfo.db.prepare("DELETE FROM scenes WHERE id = ?").run(id).changes > 0;
    }

    addSceneCharacter(sceneId: string, characterId: string): boolean {
        try {
            this._dbInfo.db.prepare("INSERT INTO scene_characters (id,scene_id,character_id) VALUES (?,?,?)").run(uuid(), sceneId, characterId);
            return true;
        } catch {
            return false;
        }
    }

    removeSceneCharacter(sceneId: string, characterId: string): boolean {
        return this._dbInfo.db.prepare("DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?").run(sceneId, characterId).changes > 0;
    }

    createSceneAction(sceneId: string, actionType: string, x: number, y: number): any {
        const id = uuid();
        let data: any = {};
        if (actionType === "scene") data = {description: ""};
        else if (actionType === "character") data = {description: "", characterId: null};
        else if (actionType === "dialog") data = {characterId: null, text: ""};
        const max = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scene_actions WHERE scene_id = ?").get(sceneId) as {
            n: number
        };
        this._dbInfo.db.prepare("INSERT INTO scene_actions (id,scene_id,action_type,data,x,y,sort_order) VALUES (?,?,?,?,?,?,?)").run(id, sceneId, actionType, JSON.stringify(data), x, y, max.n);
        return {id, sceneId, actionType, data: JSON.stringify(data), x, y, sortOrder: max.n, gallery: []};
    }

    updateSceneAction(id: string, data: string): boolean {
        const ok = this._dbInfo.db.prepare("UPDATE scene_actions SET data = ? WHERE id = ?").run(data, id).changes > 0;
        // If this is an exit action, sync exit_pins to parent scene
        if (ok) {
            const action = this._dbInfo.db.prepare("SELECT scene_id, action_type FROM scene_actions WHERE id = ?").get(id) as any;
            if (action && action.action_type === "exit") {
                this.syncSceneExitPins(action.scene_id);
            }
        }
        return ok;
    }

    syncSceneExitPins(sceneId: string): void {
        const exitAction = this._dbInfo.db.prepare("SELECT data FROM scene_actions WHERE scene_id = ? AND action_type = 'exit' LIMIT 1").get(sceneId) as any;
        if (!exitAction) return;
        let pins: any[] = [];
        try {
            pins = JSON.parse(exitAction.data)?.pins || [];
        } catch {
        }
        const simplified = pins.map((p: any) => ({id: p.id, label: p.label}));
        this._dbInfo.db.prepare("UPDATE scenes SET exit_pins = ? WHERE id = ?").run(JSON.stringify(simplified), sceneId);
    }

    moveSceneAction(id: string, x: number, y: number): boolean {
        return this._dbInfo.db.prepare("UPDATE scene_actions SET x = ?, y = ? WHERE id = ?").run(x, y, id).changes > 0;
    }

    deleteSceneAction(id: string): boolean {
        // Clean gallery
        const imgs = this._dbInfo.db.prepare("SELECT image_path FROM scene_action_gallery WHERE scene_action_id = ?").all(id) as any[];
        for (const img of imgs) deleteFile(path.join(this._dbInfo.dir, img.image_path));
        return this._dbInfo.db.prepare("DELETE FROM scene_actions WHERE id = ?").run(id).changes > 0;
    }

    importSceneActionGallery(actionId: string, sourcePaths: string[]): { id: string; path: string }[] {
        const max = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM scene_action_gallery WHERE scene_action_id = ?").get(actionId) as {
            n: number
        };
        const insert = this._dbInfo.db.prepare("INSERT INTO scene_action_gallery (id,scene_action_id,image_path,sort_order) VALUES (?,?,?,?)");
        const results: { id: string; path: string }[] = [];
        const tx = this._dbInfo.db.transaction(() => {
            for (let i = 0; i < sourcePaths.length; i++) {
                const src = sourcePaths[i];
                const ext = path.extname(src).toLowerCase();
                const imgId = uuid();
                const filename = `${actionId}_${imgId.slice(0, 8)}${ext}`;
                const relativePath = path.join("media", "scenes", "action_gallery", filename);
                const destPath = path.join(this._dbInfo.dir, relativePath);
                fs.copyFileSync(src, destPath);
                insert.run(imgId, actionId, relativePath, max.n + i);
                results.push({id: imgId, path: destPath});
            }
        });
        tx();
        return results;
    }

    removeSceneActionGalleryImage(imageId: string): boolean {
        const row = this._dbInfo.db.prepare("SELECT image_path FROM scene_action_gallery WHERE id = ?").get(imageId) as any;
        if (!row) return false;
        deleteFile(path.join(this._dbInfo.dir, row.image_path));
        return this._dbInfo.db.prepare("DELETE FROM scene_action_gallery WHERE id = ?").run(imageId).changes > 0;
    }

    createSceneConnection(sceneId: string, sourceActionId: string, sourcePin: string, targetActionId: string, targetPin: string): any {
        const id = uuid();
        this._dbInfo.db.prepare("INSERT INTO scene_connections (id,scene_id,source_action_id,source_pin,target_action_id,target_pin) VALUES (?,?,?,?,?,?)").run(id, sceneId, sourceActionId, sourcePin, targetActionId, targetPin);
        return {id, sceneId, sourceActionId, sourcePin, targetActionId, targetPin};
    }

    deleteSceneConnection(id: string): boolean {
        return this._dbInfo.db.prepare("DELETE FROM scene_connections WHERE id = ?").run(id).changes > 0;
    }
}
