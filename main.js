const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { fork } = require('child_process');

let mainWindow;
let dashboardWindow;
let cryptWorker;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

function createAuthWindow(type) {
  const authWindow = new BrowserWindow({
    width: 400,
    height: 300,
    parent: mainWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  authWindow.loadFile(`${type}.html`);
}

function createDashboardWindow(masterPassword) {
  dashboardWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  dashboardWindow.loadFile('dashboard.html', { query: { masterPassword: masterPassword } });
  mainWindow.close();
}

app.whenReady().then(() => {
  createWindow();
  cryptWorker = fork(path.join(__dirname, 'cryptWorker.js'));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('open-login', () => {
  createAuthWindow('login');
});

ipcMain.on('open-register', () => {
  createAuthWindow('register');
});

ipcMain.on('login-successful', (event, masterPassword) => {
  createDashboardWindow(masterPassword);
});

ipcMain.on('close-auth-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.close();
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // El archivo no existe, devolvemos null
      return null;
    }
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    await fs.writeFile(filePath, data);
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('encrypt-data', (event, data, password) => {
  return new Promise((resolve, reject) => {
    cryptWorker.send({ type: 'encrypt', data, password });
    cryptWorker.once('message', (message) => {
      if (message.type === 'encryptResult') {
        resolve(message.data);
      } else {
        reject(new Error('Unexpected message type'));
      }
    });
  });
});

ipcMain.handle('decrypt-data', (event, data, password) => {
  return new Promise((resolve, reject) => {
    cryptWorker.send({ type: 'decrypt', data, password });
    cryptWorker.once('message', (message) => {
      if (message.type === 'decryptResult') {
        resolve(message.data);
      } else {
        reject(new Error('Unexpected message type'));
      }
    });
  });
});
