import type { EnnoAPI } from '../electron/api'

export {}

declare global {
    interface Window {
        ennoAPI: EnnoAPI;
    }
}
