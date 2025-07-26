const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        icon: path.join(__dirname, 'public', 'icon.png'), // Optional: add an icon
        title: 'Diet App'
    });

    // Load the app
    mainWindow.loadURL('http://localhost:3000');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['index.js'], {
            stdio: 'pipe'
        });

        serverProcess.stdout.on('data', (data) => {
            console.log(`Server: ${data}`);
            if (data.toString().includes('Server running on http://localhost:3000')) {
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`Server Error: ${data}`);
        });

        serverProcess.on('error', (error) => {
            console.error('Failed to start server:', error);
            reject(error);
        });

        serverProcess.on('close', (code) => {
            console.log(`Server process exited with code ${code}`);
        });
    });
}

app.whenReady().then(async () => {
    try {
        await startServer();
        createWindow();
    } catch (error) {
        console.error('Failed to start app:', error);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (serverProcess) {
            serverProcess.kill();
        }
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (serverProcess) {
        serverProcess.kill();
    }
    app.quit();
}); 