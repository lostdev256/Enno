import {ipcMain, dialog} from "electron";

import {enno} from "./../enno";

export function registerCharactersIpcHandlers() {
    ipcMain.handle("characters:list", async () => {
        console.log("[IPC] characters:list");
        if (!enno.db.isOpen) return {groups: [], ungrouped: []};
        return enno.db.characters?.getCharactersList();
    });

    ipcMain.handle("characters:get", async (_event, id: string) => {
        console.log(`[IPC] characters:get — ${id}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        const character = enno.db.characters?.getCharacter(id);
        if (!character) return {success: false, error: "Character not found"};
        return {success: true, character};
    });

    ipcMain.handle("characters:create", async () => {
        console.log("[IPC] characters:create");
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        const character = enno.db.characters?.createCharacter();
        return {success: true, character};
    });

    ipcMain.handle("characters:update", async (_event, id: string, field: string, value: string) => {
        console.log(`[IPC] characters:update — ${id}.${field}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        const ok = enno.db.characters?.updateCharacter(id, field, value);
        return {success: ok};
    });

    ipcMain.handle("characters:delete", async (_event, id: string) => {
        console.log(`[IPC] characters:delete — ${id}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        const ok = enno.db.characters?.deleteCharacter(id);
        return {success: ok};
    });

    ipcMain.handle("characters:reorder", async (_event, order) => {
        console.log("[IPC] characters:reorder");
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        enno.db.characters?.reorderCharacters(order);
        return {success: true};
    });

    ipcMain.handle("characters:group:create", async (_event, name: string) => {
        console.log(`[IPC] characters:group:create — ${name}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        const group = enno.db.characters?.createGroup(name);
        return {success: true, group: {...group, expanded: true, characters: []}};
    });

    ipcMain.handle("characters:group:delete", async (_event, groupId: string) => {
        console.log(`[IPC] characters:group:delete — ${groupId}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        const ok = enno.db.characters?.deleteGroup(groupId);
        return {success: ok};
    });

    ipcMain.handle("characters:group:rename", async (_event, groupId: string, newName: string) => {
        console.log(`[IPC] characters:group:rename — ${groupId} → ${newName}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};
        const ok = enno.db.characters?.renameGroup(groupId, newName);
        return {success: ok};
    });

    ipcMain.handle("characters:avatar:upload", async (_event, characterId: string) => {
        console.log(`[IPC] characters:avatar:upload — ${characterId}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};

        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"]}]
        });
        if (result.canceled || result.filePaths.length === 0) return {success: false, cancelled: true};

        const avatarUrl = enno.db.characters?.importAvatar(characterId, result.filePaths[0]);
        return {success: true, path: avatarUrl};
    });

    ipcMain.handle("characters:gallery:add", async (_event, characterId: string) => {
        console.log(`[IPC] characters:gallery:add — ${characterId}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};

        const result = await dialog.showOpenDialog({
            properties: ["openFile", "multiSelections"],
            filters: [{name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"]}]
        });
        if (result.canceled || result.filePaths.length === 0) return {success: false, cancelled: true};

        const images = enno.db.characters?.importGalleryImages(characterId, result.filePaths);
        return {success: true, images};
    });

    ipcMain.handle("characters:gallery:remove", async (_event, _characterId: string, imageId: string) => {
        console.log(`[IPC] characters:gallery:remove — ${imageId}`);
        if (!enno.db.isOpen) return {success: false, error: "No project open"};

        const ok = enno.db.characters?.removeGalleryImage(imageId);
        return {success: ok};
    });

    ipcMain.handle("characters:board:get", async () => {
        if (!enno.db.isOpen) return null;
        return enno.db.characters?.getBoardData();
    });

    ipcMain.handle("characters:board:addNode", async (_event, characterId: string, x: number, y: number) => {
        if (!enno.db.isOpen) return false;
        return enno.db.characters?.addBoardNode(characterId, x, y);
    });

    ipcMain.handle("characters:board:updateNodePosition", async (_event, characterId: string, x: number, y: number) => {
        if (!enno.db.isOpen) return false;
        return enno.db.characters?.updateBoardNode(characterId, x, y);
    });

    ipcMain.handle("characters:board:removeNode", async (_event, characterId: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.characters?.removeBoardNode(characterId);
    });

    ipcMain.handle("characters:linkModes:create", async (_event, name: string, maxLinks: number, dataType: "text" | "enum", settings: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.characters?.createLinkMode(name, maxLinks, dataType, settings);
    });

    ipcMain.handle("characters:linkModes:update", async (_event, id: string, name: string, maxLinks: number, dataType: "text" | "enum", settings: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.characters?.updateLinkMode(id, name, maxLinks, dataType, settings);
    });

    ipcMain.handle("characters:linkModes:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.characters?.deleteLinkMode(id);
    });

    ipcMain.handle("characters:linkModes:reorder", async (_event, modeIds: string[]) => {
        if (!enno.db.isOpen) return false;
        enno.db.characters?.reorderLinkModes(modeIds);
        return true;
    });

    ipcMain.handle("characters:links:create", async (_event, modeId: string, sourceId: string, targetId: string, value: string) => {
        if (!enno.db.isOpen) return null;
        return enno.db.characters?.createLink(modeId, sourceId, targetId, value);
    });

    ipcMain.handle("characters:links:update", async (_event, id: string, value: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.characters?.updateLink(id, value);
    });

    ipcMain.handle("characters:links:delete", async (_event, id: string) => {
        if (!enno.db.isOpen) return false;
        return enno.db.characters?.deleteLink(id);
    });
}
