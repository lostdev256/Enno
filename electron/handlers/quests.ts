import {ipcMain, dialog} from "electron";

import {enno} from "./../enno";

export function registerQuestsIpcHandlers() {
    ipcMain.handle("quests:list", async () => {
        if (!enno.db.isOpen) return {groups: [], ungrouped: []};
        return enno.db.quests?.getQuestsList();
    });

    ipcMain.handle("quests:create", async (_event, parentId?: string, groupId?: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.quests?.createQuest(parentId, groupId);
    });

    ipcMain.handle("quests:get", async (_event, id: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.quests?.getQuest(id);
    });

    ipcMain.handle("quests:update", async (_event, id: string, field: string, value: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.quests?.updateQuest(id, field, value);
    });

    ipcMain.handle("quests:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.quests?.deleteQuest(id);
    });

    ipcMain.handle("quests:reorder", async (_event, order: any) => {
        if (!enno.db.isOpen) return false;
        enno.db.quests?.reorderQuests(order);
        return true;
    });

    ipcMain.handle("quests:group:create", async (_event, name: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.quests?.createQuestGroup(name);
    });

    ipcMain.handle("quests:group:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.quests?.deleteQuestGroup(id);
    });

    ipcMain.handle("quests:group:rename", async (_event, id: string, name: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.quests?.renameQuestGroup(id, name);
    });

    ipcMain.handle("quests:icon:upload", async (_event, questId: string) => {
        if (!enno.db.isOpen) return {success: false};
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"]}]
        });
        if (result.canceled || result.filePaths.length === 0) return {success: false};
        const iconUrl = enno.db.quests?.importQuestIcon(questId, result.filePaths[0]);
        return {success: true, path: iconUrl};
    });

    ipcMain.handle("quests:gallery:add", async (_event, questId: string) => {
        if (!enno.db.isOpen) return {success: false};
        const result = await dialog.showOpenDialog({
            properties: ["openFile", "multiSelections"],
            filters: [{name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"]}]
        });
        if (result.canceled || result.filePaths.length === 0) return {success: false};
        const images = enno.db.quests?.importQuestGallery(questId, result.filePaths);
        return {success: true, images};
    });

    ipcMain.handle("quests:gallery:remove", async (_event, imageId: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.quests?.removeQuestGalleryImage(imageId);
    });

    ipcMain.handle("quests:structure:update", async (_event, updates: any[]) => {
        if (!enno.db.isOpen) return false;
        enno.db.quests?.updateQuestsStructure(updates);
        return true;
    });

    ipcMain.handle("quests:all-flat", async () => {
        if (!enno.db.isOpen) return [];
        return enno.db.quests?.getAllQuestsFlat();
    });
}
