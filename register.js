const { ipcRenderer } = require('electron');
const crypto = require('crypto');
const path = require('path');

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const masterPassword = document.getElementById('masterPassword').value;
    const confirmMasterPassword = document.getElementById('confirmMasterPassword').value;

    if (masterPassword !== confirmMasterPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(masterPassword, salt, 1000, 64, 'sha512').toString('hex');

    const userData = {
        salt: salt,
        hash: hash,
        passwords: []
    };

    const encryptedData = await ipcRenderer.invoke('encrypt-data', JSON.stringify(userData), masterPassword);

    try {
        const userDataPath = await ipcRenderer.invoke('get-user-data-path');
        const vaultPath = path.join(userDataPath, 'passwords.json');
        await ipcRenderer.invoke('write-file', vaultPath, encryptedData);
        alert('Cuenta creada con éxito');
        
        // Guardar la contraseña maestra en el almacenamiento local
        localStorage.setItem('masterPassword', masterPassword);
        
        // Redirigir al usuario a dashboard.html
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Error al crear la cuenta:', error);
        alert('Error al crear la cuenta');
    }
});

function encryptData(data, password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
}