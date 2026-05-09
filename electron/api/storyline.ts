import {ipcRenderer} from 'electron'

export const storylineApi = {
    getStorylineData() {
        return ipcRenderer.invoke('storyline:get')
    },
    addStorylineNode(nodeType: string, refId: string | null, groupId: string | null, x: number, y: number, data?: string) {
        return ipcRenderer.invoke('storyline:node:add', nodeType, refId, groupId, x, y, data)
    },
    updateStorylineNode(id: string, x: number, y: number, groupId?: string | null) {
        return ipcRenderer.invoke('storyline:node:update', id, x, y, groupId)
    },
    updateStorylineNodeData(id: string, data: string) {
        return ipcRenderer.invoke('storyline:node:update-data', id, data)
    },
    deleteStorylineNode(id: string) {
        return ipcRenderer.invoke('storyline:node:delete', id)
    },
    createStorylineConnection(sourceNodeId: string, sourcePin: string, targetNodeId: string, targetPin: string) {
        return ipcRenderer.invoke('storyline:connection:create', sourceNodeId, sourcePin, targetNodeId, targetPin)
    },
    deleteStorylineConnection(id: string) {
        return ipcRenderer.invoke('storyline:connection:delete', id)
    },
    updateStorylineGroupPosition(groupId: string, x: number, y: number, width: number, height: number) {
        return ipcRenderer.invoke('storyline:group-position:update', groupId, x, y, width, height)
    },
}
