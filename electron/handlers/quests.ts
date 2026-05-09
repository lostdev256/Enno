import {ipcMain, dialog} from "electron";

import {enno} from "./../enno";

export function registerQuestsIpcHandlers() {
    ipcMain.handle("quests:list", async () => {
        if (!enno.db.isOpen) return {groups: [], ungrouped: []};
        return enno.db.getQuestsList();
    });

    ipcMain.handle("quests:create", async (_event, parentId?: string, groupId?: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.createQuest(parentId, groupId);
    });

    ipcMain.handle("quests:get", async (_event, id: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.getQuest(id);
    });

    ipcMain.handle("quests:update", async (_event, id: string, field: string, value: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.updateQuest(id, field, value);
    });

    ipcMain.handle("quests:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.deleteQuest(id);
    });

    ipcMain.handle("quests:reorder", async (_event, order: any) => {
        if (!enno.db.isOpen) return false;
        enno.db.reorderQuests(order);
        return true;
    });

    ipcMain.handle("quests:group:create", async (_event, name: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.createQuestGroup(name);
    });

    ipcMain.handle("quests:group:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.deleteQuestGroup(id);
    });

    ipcMain.handle("quests:group:rename", async (_event, id: string, name: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.renameQuestGroup(id, name);
    });

    ipcMain.handle("quests:icon:upload", async (_event, questId: string) => {
        if (!enno.db.isOpen) return {success: false};
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"]}]
        });
        if (result.canceled || result.filePaths.length === 0) return {success: false};
        const iconUrl = enno.db.importQuestIcon(questId, result.filePaths[0]);
        return {success: true, path: iconUrl};
    });

    ipcMain.handle("quests:gallery:add", async (_event, questId: string) => {
        if (!enno.db.isOpen) return {success: false};
        const result = await dialog.showOpenDialog({
            properties: ["openFile", "multiSelections"],
            filters: [{name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"]}]
        });
        if (result.canceled || result.filePaths.length === 0) return {success: false};
        const images = enno.db.importQuestGallery(questId, result.filePaths);
        return {success: true, images};
    });

    ipcMain.handle("quests:gallery:remove", async (_event, imageId: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.removeQuestGalleryImage(imageId);
    });

    ipcMain.handle("quests:structure:update", async (_event, updates: any[]) => {
        if (!enno.db.isOpen) return false;
        enno.db.updateQuestsStructure(updates);
        return true;
    });

    ipcMain.handle("quests:all-flat", async () => {
        if (!enno.db.isOpen) return [];
        return enno.db.getAllQuestsFlat();
    });
}
