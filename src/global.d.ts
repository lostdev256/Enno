import type {EnnoAPI} from "../electron/api";

export {};

declare global {
    interface Window {
        ennoAPI: EnnoAPI;
    }
}

declare module "*.sql?raw" {
    const content: string;
    export default content;
}
