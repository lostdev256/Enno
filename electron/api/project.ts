import {ipcRenderer} from "electron";

export const projectApi = {
    onProjectStateChange(callback: (state: {
        isOpen: boolean,
        filePath: string | null,
        projectName: string | null
    }) => void) {
        ipcRenderer.on("project:state-changed", (_event, state) => callback(state));
    },
    offProjectStateChange() {
        ipcRenderer.removeAllListeners("project:state-changed");
    },

    createProject() {
        return ipcRenderer.invoke("file:create");
    },
    openProject() {
        return ipcRenderer.invoke("file:open");
    },
    saveProject() {
        return ipcRenderer.invoke("file:save");
    },
    saveProjectAs() {
        return ipcRenderer.invoke("file:save-as");
    }
};
