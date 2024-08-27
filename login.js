const { ipcRenderer } = require('electron');
const crypto = require('crypto');
const path = require('path');

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const masterPassword = document.getElementById('masterPassword').value;

    try {
        const userDataPath = await ipcRenderer.invoke('get-user-data-path');
        const vaultPath = path.join(userDataPath, 'passwords.json');
        const encryptedData = await ipcRenderer.invoke('read-file', vaultPath);
        
        if (encryptedData === null) {
            alert('No se encontró un vault. Por favor, crea una cuenta primero.');
            return;
        }

        const decryptedData = decryptData(encryptedData, masterPassword);
        const userData = JSON.parse(decryptedData);

        const hash = crypto.pbkdf2Sync(masterPassword, userData.salt, 1000, 64, 'sha512').toString('hex');

        if (hash === userData.hash) {
            ipcRenderer.send('login-successful', masterPassword);
            ipcRenderer.send('close-auth-window');
        } else {
            alert('Contraseña incorrecta');
        }
    } catch (error) {
        console.error('Error al leer o descifrar el vault:', error);
        alert('Error al acceder al vault. Asegúrate de que la contraseña es correcta y que el archivo existe.');
    }
});

function decryptData(encryptedData, password) {
    const algorithm = 'aes-256-cbc';
    const [ivHex, encryptedHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(password, 'salt', 32);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}