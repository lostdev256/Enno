import Store from 'electron-store'

export interface StoreSchema {
    lastOpenedFile: string | null;
}

export function createStore(): Store<StoreSchema> {
    return new Store<StoreSchema>({
        defaults: {
            lastOpenedFile: null,
        },
    })
}
