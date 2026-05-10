import {BrowserWindow, Menu} from "electron";
import {createRequire} from "node:module";
import path from "node:path";

import {VITE_DEV_SERVER_URL, CORE_DIR, RENDERER_DIR, PUBLIC_DIR} from "./global";
import {enno} from "./enno";

class Window {
    private _wnd: BrowserWindow | null = null;

    public openWindow() {
        const require = createRequire(import.meta.url);

        this._wnd = new BrowserWindow({
            icon: path.join(PUBLIC_DIR, "electron-vite.svg"),
            webPreferences: {
                preload: path.join(CORE_DIR, "preload.mjs")
            }
        });

        this._wnd.webContents.on("did-finish-load", () => {
            const lastFile = enno.store.get("lastOpenedFile") as string | null;
            if (lastFile && require("fs").existsSync(lastFile)) {
                try {
                    enno.db.open(lastFile);
                    this.notifyProjectState();
                } catch (err) {
                    console.error("[Auto-open] Failed:", err);
                    enno.store.set("lastOpenedFile", null);
                    this.notifyProjectState();
                }
            } else {
                this.notifyProjectState();
            }
        });

        if (VITE_DEV_SERVER_URL) {
            this._wnd.loadURL(VITE_DEV_SERVER_URL);
        } else {
            this._wnd.loadFile(path.join(RENDERER_DIR, "index.html"));
        }

        this.createMenu();
    }

    public notifyProjectState() {
        if (!this._wnd) return;
        this._wnd.webContents.send("project:state-changed", {
            isOpen: enno.db.isOpen,
            filePath: enno.db.projectFilePath,
            projectName: enno.db.projectName
        });
        this.updateWindowTitle();
    }

    private updateWindowTitle() {
        if (!this._wnd) return;
        if (enno.db.isOpen && enno.db.projectName) {
            this._wnd.setTitle(`Enno — ${enno.db.projectName}`);
        } else {
            this._wnd.setTitle("Enno");
        }
    }

    private createMenu() {
        const template: Electron.MenuItemConstructorOptions[] = [
            {
                label: "File",
                submenu: [
                    {
                        label: "Create",
                        accelerator: "CmdOrCtrl+N",
                        click: () => this._wnd?.webContents.send("menu:action", "file:create")
                    },
                    {
                        label: "Open",
                        accelerator: "CmdOrCtrl+O",
                        click: () => this._wnd?.webContents.send("menu:action", "file:open")
                    },
                    {type: "separator"},
                    {
                        label: "Save",
                        accelerator: "CmdOrCtrl+S",
                        click: () => this._wnd?.webContents.send("menu:action", "file:save")
                    },
                    {
                        label: "Save As",
                        accelerator: "CmdOrCtrl+Shift+S",
                        click: () => this._wnd?.webContents.send("menu:action", "file:save-as")
                    },
                    {type: "separator"},
                    {role: "quit"}
                ]
            },
            {
                label: "Characters",
                submenu: [
                    {
                        label: "Cards",
                        click: () => this._wnd?.webContents.send("menu:action", "characters:cards")
                    },
                    {
                        label: "Links",
                        click: () => this._wnd?.webContents.send("menu:action", "characters:links")
                    }
                ]
            },
            {
                label: "Scenes",
                submenu: [
                    {
                        label: "Editor",
                        click: () => this._wnd?.webContents.send("menu:action", "scenes:editor")
                    },
                    {
                        label: "Storyline",
                        click: () => this._wnd?.webContents.send("menu:action", "scenes:storyline")
                    }
                ]
            },
            {
                label: "Quests",
                submenu: [
                    {
                        label: "Cards",
                        click: () => this._wnd?.webContents.send("menu:action", "quests:cards")
                    }
                ]
            },
            {
                label: "Help",
                submenu: [
                    {
                        label: "About",
                        click: () => this._wnd?.webContents.send("menu:action", "help:about")
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }
}

export function createWindow(): Window {
    return new Window();
}
