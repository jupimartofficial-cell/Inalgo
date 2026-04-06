import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { spawn } from 'child_process';

let backendProcess: ReturnType<typeof spawn> | null = null;

const startBackend = (): void => {
  if (backendProcess) return;

  backendProcess = spawn('java', ['-jar', '../backend/target/trade-backend-0.0.1-SNAPSHOT.jar'], {
    cwd: app.getAppPath(),
    stdio: 'inherit'
  });
};

const createWindow = (): void => {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
    }
  });

  const devServerUrl = 'http://127.0.0.1:5173';
  window.loadURL(devServerUrl).catch(() => {
    window.loadFile(join(__dirname, '../../renderer/index.html'));
  });
};

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
