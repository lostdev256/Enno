import {ipcMain} from "electron";

import {enno} from "./../enno";

export function registerStorylineIpcHandlers() {
    ipcMain.handle("storyline:get", async () => {
        if (!enno.db.isOpen) return null;
        return enno.db.getStorylineData();
    });

    ipcMain.handle("storyline:node:add", async (_event, nodeType: string, refId: string | null, groupId: string | null, x: number, y: number, data?: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.addStorylineNode(nodeType, refId, groupId, x, y, data);
    });

    ipcMain.handle("storyline:node:update", async (_event, id: string, x: number, y: number, groupId?: string | null) => {
        if (!enno.db.isOpen) return false;
        return enno.db.updateStorylineNode(id, x, y, groupId);
    });

    ipcMain.handle("storyline:node:update-data", async (_event, id: string, data: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.updateStorylineNodeData(id, data);
    });

    ipcMain.handle("storyline:node:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.deleteStorylineNode(id);
    });

    ipcMain.handle("storyline:connection:create", async (_event, sourceNodeId: string, sourcePin: string, targetNodeId: string, targetPin: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.createStorylineConnection(sourceNodeId, sourcePin, targetNodeId, targetPin);
    });

    ipcMain.handle("storyline:connection:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.deleteStorylineConnection(id);
    });

    ipcMain.handle("storyline:group-position:update", async (_event, groupId: string, x: number, y: number, width: number, height: number) => {
        if (!enno.db.isOpen) return false;
        enno.db.updateStorylineGroupPosition(groupId, x, y, width, height);
        return true;
    });
}
