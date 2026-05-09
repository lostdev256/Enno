import {ipcRenderer} from 'electron'

export const questsApi = {
    getQuestsList() {
        return ipcRenderer.invoke('quests:list')
    },
    createQuest(parentId?: string, groupId?: string) {
        return ipcRenderer.invoke('quests:create', parentId, groupId)
    },
    getQuest(id: string) {
        return ipcRenderer.invoke('quests:get', id)
    },
    updateQuest(id: string, field: string, value: string) {
        return ipcRenderer.invoke('quests:update', id, field, value)
    },
    deleteQuest(id: string) {
        return ipcRenderer.invoke('quests:delete', id)
    },
    reorderQuests(order: any) {
        return ipcRenderer.invoke('quests:reorder', order)
    },
    createQuestGroup(name: string) {
        return ipcRenderer.invoke('quests:group:create', name)
    },
    deleteQuestGroup(id: string) {
        return ipcRenderer.invoke('quests:group:delete', id)
    },
    renameQuestGroup(id: string, name: string) {
        return ipcRenderer.invoke('quests:group:rename', id, name)
    },
    uploadQuestIcon(questId: string) {
        return ipcRenderer.invoke('quests:icon:upload', questId)
    },
    addQuestGallery(questId: string) {
        return ipcRenderer.invoke('quests:gallery:add', questId)
    },
    removeQuestGallery(imageId: string) {
        return ipcRenderer.invoke('quests:gallery:remove', imageId)
    },
    updateQuestsStructure(updates: any[]) {
        return ipcRenderer.invoke('quests:structure:update', updates)
    },
    getAllQuestsFlat() {
        return ipcRenderer.invoke('quests:all-flat')
    },
}
