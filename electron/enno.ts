import {createStore} from "./store";
import {createDB} from "./database";
import {createWindow} from "./window";
import {registerIpcHandlers} from "./handlers";

import {app, protocol, net} from 'electron'
import {pathToFileURL} from "node:url";

class Enno {
    public readonly store = createStore();
    public readonly db = createDB();
    public readonly wnd = createWindow();

    public runApp() {
        this.initApp();
        app.whenReady().then(() => this.processApp());
    }

    private initApp() {
        app.on('before-quit', () => this.deinitApp());
        app.on('window-all-closed', () => this.shutdownApp());

        if (!app.isPackaged) {
            app.commandLine.appendSwitch('remote-debugging-port', '9222');
        }

        registerIpcHandlers()
    }

    private deinitApp() {
        this.db.close();
    }

    private processApp() {
        protocol.handle('enno', (request) => {
            const filePath = decodeURIComponent(request.url.replace('enno://', ''))
            return net.fetch(pathToFileURL(filePath).href)
        });

        this.wnd.openWindow();
    }

    private shutdownApp() {
        app.quit();
    }
}

export const enno = new Enno();
