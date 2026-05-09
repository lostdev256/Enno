import {ipcRenderer} from "electron";

export const commonApi = {
    onMenuAction(callback: (action: string) => void) {
        ipcRenderer.on("menu:action", (_event, action: string) => callback(action));
    },
    invokeMenuAction(action: string) {
        return ipcRenderer.invoke(action);
    }
};
