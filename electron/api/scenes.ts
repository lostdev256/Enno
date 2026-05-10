import {ipcRenderer} from "electron";

export const scenesApi = {
    getScenesList() {
        return ipcRenderer.invoke("scenes:list");
    },
    createScene() {
        return ipcRenderer.invoke("scenes:create");
    },
    getScene(id: string) {
        return ipcRenderer.invoke("scenes:get", id);
    },
    updateScene(id: string, field: string, value: string) {
        return ipcRenderer.invoke("scenes:update", id, field, value);
    },
    deleteScene(id: string) {
        return ipcRenderer.invoke("scenes:delete", id);
    },
    reorderScenes(order: any) {
        return ipcRenderer.invoke("scenes:reorder", order);
    },
    createSceneGroup(name: string) {
        return ipcRenderer.invoke("scenes:group:create", name);
    },
    deleteSceneGroup(id: string) {
        return ipcRenderer.invoke("scenes:group:delete", id);
    },
    renameSceneGroup(id: string, name: string) {
        return ipcRenderer.invoke("scenes:group:rename", id, name);
    },
    addSceneCharacter(sceneId: string, characterId: string) {
        return ipcRenderer.invoke("scenes:characters:add", sceneId, characterId);
    },
    removeSceneCharacter(sceneId: string, characterId: string) {
        return ipcRenderer.invoke("scenes:characters:remove", sceneId, characterId);
    },
    createSceneAction(sceneId: string, actionType: string, x: number, y: number) {
        return ipcRenderer.invoke("scenes:actions:create", sceneId, actionType, x, y);
    },
    updateSceneAction(id: string, data: string) {
        return ipcRenderer.invoke("scenes:actions:update", id, data);
    },
    moveSceneAction(id: string, x: number, y: number) {
        return ipcRenderer.invoke("scenes:actions:move", id, x, y);
    },
    deleteSceneAction(id: string) {
        return ipcRenderer.invoke("scenes:actions:delete", id);
    },
    addSceneActionGallery(actionId: string) {
        return ipcRenderer.invoke("scenes:actions:gallery:add", actionId);
    },
    removeSceneActionGallery(imageId: string) {
        return ipcRenderer.invoke("scenes:actions:gallery:remove", imageId);
    },
    createSceneConnection(sceneId: string, sourceActionId: string, sourcePin: string, targetActionId: string, targetPin: string) {
        return ipcRenderer.invoke("scenes:connections:create", sceneId, sourceActionId, sourcePin, targetActionId, targetPin);
    },
    deleteSceneConnection(id: string) {
        return ipcRenderer.invoke("scenes:connections:delete", id);
    }
};
