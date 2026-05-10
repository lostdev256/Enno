import {ipcMain, dialog} from "electron";

import {enno} from "./../enno";

export function registerLocationsIpcHandlers() {
    ipcMain.handle("locations:get-tree", async () => {
        if (!enno.db.isOpen) return [];
        return enno.db.locations?.getLocationsTree();
    });

    ipcMain.handle("locations:get", async (_event, id: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.locations?.getLocation(id);
    });

    ipcMain.handle("locations:create", async (_event, parentId: string | null) => {
        if (!enno.db.isOpen) return null;
        return enno.db.locations?.createLocation(parentId);
    });

    ipcMain.handle("locations:update", async (_event, id: string, field: string, value: any) => {
        if (!enno.db.isOpen) return false;
        return enno.db.locations?.updateLocation(id, field, value);
    });

    ipcMain.handle("locations:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.locations?.deleteLocation(id);
    });

    ipcMain.handle("locations:structure:update", async (_event, updates: any[]) => {
        if (!enno.db.isOpen) return false;
        enno.db.locations?.updateLocationsStructure(updates);
        return true;
    });

    ipcMain.handle("locations:map:upload", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        const result = await dialog.showOpenDialog({
            title: "Select Map Image",
            properties: ["openFile"],
            filters: [{name: "Images", extensions: ["jpg", "png", "gif", "webp", "jpeg"]}]
        });
        if (result.canceled || result.filePaths.length === 0) return false;
        return enno.db.locations?.updateLocation(id, "map_image_path", result.filePaths[0]);
    });

    ipcMain.handle("locations:map:update-coords", async (_event, id: string, x: number, y: number) => {
        if (!enno.db.isOpen) return false;
        enno.db.locations?.updateLocation(id, "map_x", x);
        return enno.db.locations?.updateLocation(id, "map_y", y);
    });
}
