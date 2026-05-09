import {ipcRenderer} from "electron";

export const locationsApi = {
    getLocationsTree() {
        return ipcRenderer.invoke("locations:get-tree");
    },
    getLocation(id: string) {
        return ipcRenderer.invoke("locations:get", id);
    },
    createLocation(parentId: string | null) {
        return ipcRenderer.invoke("locations:create", parentId);
    },
    updateLocation(id: string, field: string, value: any) {
        return ipcRenderer.invoke("locations:update", id, field, value);
    },
    deleteLocation(id: string) {
        return ipcRenderer.invoke("locations:delete", id);
    },
    updateLocationsStructure(updates: any[]) {
        return ipcRenderer.invoke("locations:structure:update", updates);
    },
    uploadLocationMapImage(id: string) {
        return ipcRenderer.invoke("locations:map:upload", id);
    },
    updateLocationMapCoords(id: string, x: number, y: number) {
        return ipcRenderer.invoke("locations:map:update-coords", id, x, y);
    }
};
