import {fileURLToPath} from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const APP_ROOT_DIR = path.join(__dirname, "..");
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const CORE_DIR = path.join(APP_ROOT_DIR, "dist-electron");
export const RENDERER_DIR = path.join(APP_ROOT_DIR, "dist");
export const PUBLIC_DIR = VITE_DEV_SERVER_URL ? path.join(APP_ROOT_DIR, "public") : RENDERER_DIR;
