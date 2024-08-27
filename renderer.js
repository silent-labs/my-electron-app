const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const importVault = document.getElementById('importVault');

    loginBtn.addEventListener('click', () => {
        ipcRenderer.send('open-login');
    });

    registerBtn.addEventListener('click', () => {
        ipcRenderer.send('open-register');
    });

    importVault.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new fs.createReadStream(file.path);
            let data = '';

            reader.on('data', (chunk) => {
                data += chunk;
            });

            reader.on('end', () => {
                try {
                    JSON.parse(data); // Verificar si es un JSON válido
                    const destPath = path.join(app.getPath('userData'), 'passwords.json');
                    fs.copyFileSync(file.path, destPath);
                    alert('Vault importado con éxito');
                } catch (error) {
                    alert('Error al importar el vault. Asegúrate de que es un archivo JSON válido.');
                }
            });
        }
    });
});