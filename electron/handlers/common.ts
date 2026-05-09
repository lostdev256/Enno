import {ipcMain} from "electron";

export function registerCommonIpcHandlers() {
    ipcMain.handle("help:about", async () => {
        console.log("[IPC] help:about");
        return {name: "Enno", version: "0.1.0"};
    });
}
