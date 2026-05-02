const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const versionInfo = document.getElementById('version-info');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 40;

versionInfo.innerText = `Electron v${window.api.appVersion}`;

// Example
document.getElementById('drawRect').addEventListener('click', () => {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(50, 50, 150, 100);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(50, 50, 150, 100);

    console.log("Done!");
});
