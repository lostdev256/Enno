const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const iconPath = path.join(__dirname, '../../res/icons/icon.png');

    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, '../bridge/bridge.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (process.platform === 'darwin') {
        app.dock.setIcon(iconPath);
    }

    win.loadFile(path.join(__dirname, '../ui/index.html'));
    // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
