import {EnnoDatabaseInfo, uuid} from "./utils";

import path from "node:path";
import fs from "node:fs";

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

export class LocationsEnnoDatabase {
    constructor(private _dbInfo: EnnoDatabaseInfo) {
    }

    getLocationsFlat(): any[] {
        return this._dbInfo.db.prepare("SELECT id, parent_id AS parentId, name, description, map_image_path AS mapImagePath, map_x AS mapX, map_y AS mapY, sort_order AS sortOrder FROM locations ORDER BY sort_order ASC").all();
    }

    getLocationsTree(): LocationTreeItem[] {
        const flat = this.getLocationsFlat();
        const map = new Map<string, LocationTreeItem>();
        const roots: LocationTreeItem[] = [];

        for (const loc of flat) {
            map.set(loc.id, {
                id: loc.id,
                name: loc.name,
                mapX: loc.mapX,
                mapY: loc.mapY,
                children: []
            });
        }

        for (const loc of flat) {
            const item = map.get(loc.id)!;
            if (loc.parentId) {
                const parent = map.get(loc.parentId);
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
        const row = this._dbInfo.db.prepare("SELECT id, parent_id AS parentId, name, description, map_image_path AS mapImagePath, map_x AS mapX, map_y AS mapY, sort_order AS sortOrder FROM locations WHERE id = ?").get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            parentId: row.parentId,
            name: row.name,
            description: row.description,
            mapImagePath: row.mapImagePath ? path.join(this._dbInfo.dir, row.mapImagePath) : null,
            mapX: row.mapX,
            mapY: row.mapY,
            sortOrder: row.sortOrder
        };
    }

    createLocation(parentId: string | null): string {
        const id = uuid();
        const maxOrderRow = this._dbInfo.db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM locations WHERE IFNULL(parent_id, '') = ?").get(parentId || "") as {
            next: number
        };
        this._dbInfo.db.prepare(`
            INSERT
            INTO locations (id, parent_id, sort_order)
            VALUES (?, ?, ?)
        `).run(id, parentId, maxOrderRow.next);
        return id;
    }

    updateLocation(id: string, field: string, value: any): boolean {
        const validFields = ["name", "description", "parent_id", "map_image_path", "map_x", "map_y", "sort_order"];
        if (!validFields.includes(field)) throw new Error("Invalid field");

        // Copy map image if needed
        if (field === "map_image_path" && value) {
            const ext = path.extname(value);
            const fileName = `${uuid()}${ext}`;
            const relPath = path.join("media", "locations", "maps", fileName);
            const absPath = path.join(this._dbInfo.dir, relPath);
            fs.copyFileSync(value, absPath);

            // Delete old
            const old = this._dbInfo.db.prepare("SELECT map_image_path FROM locations WHERE id = ?").get(id) as {
                map_image_path: string | null
            };
            if (old && old.map_image_path) {
                try {
                    fs.unlinkSync(path.join(this._dbInfo.dir, old.map_image_path));
                } catch {
                }
            }
            value = relPath;
        }

        const res = this._dbInfo.db.prepare(`UPDATE locations
                                             SET ${field}   = ?,
                                                 updated_at = DATETIME('now')
                                             WHERE id = ?`).run(value, id);
        return res.changes > 0;
    }

    deleteLocation(id: string): boolean {
        // Find image to delete
        const old = this._dbInfo.db.prepare("SELECT map_image_path FROM locations WHERE id = ?").get(id) as {
            map_image_path: string | null
        };
        if (old && old.map_image_path) {
            try {
                fs.unlinkSync(path.join(this._dbInfo.dir, old.map_image_path));
            } catch {
            }
        }
        const res = this._dbInfo.db.prepare("DELETE FROM locations WHERE id = ?").run(id);
        return res.changes > 0;
    }

    updateLocationsStructure(updates: { id: string, parentId: string | null, sortOrder: number }[]): void {
        const update = this._dbInfo.db.prepare("UPDATE locations SET parent_id = ?, sort_order = ?, updated_at = DATETIME('now') WHERE id = ?");
        const tx = this._dbInfo.db.transaction(() => {
            for (const u of updates) {
                update.run(u.parentId, u.sortOrder, u.id);
            }
        });
        tx();
    }
}
