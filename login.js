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
            // Guardar la contraseña maestra en el almacenamiento local
            localStorage.setItem('masterPassword', masterPassword);
            
            // Redirigir al usuario a dashboard.html
            window.location.href = 'dashboard.html';
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

async function displaySavedItems(passwords, masterPassword) {
    const loginForm = document.getElementById('loginForm');
    const savedItemsContainer = document.getElementById('savedItemsContainer');
    const savedItemsList = document.getElementById('savedItemsList');

    // Ocultar el formulario de inicio de sesión
    loginForm.style.display = 'none';

    // Limpiar la lista de elementos guardados
    savedItemsList.innerHTML = '';

    // Agregar cada elemento guardado a la lista
    for (const item of passwords) {
        const decryptedPassword = await decryptPassword(item.password, masterPassword);
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        listItem.innerHTML = `
            <div>
                <h5 class="mb-1">${item.siteName}</h5>
                <p class="mb-1">Usuario: ${item.username}</p>
            </div>
            <button class="btn btn-outline-secondary btn-sm" onclick="copyPassword('${decryptedPassword}')">Copiar Contraseña</button>
        `;
        savedItemsList.appendChild(listItem);
    }

    // Mostrar el contenedor de elementos guardados
    savedItemsContainer.style.display = 'block';
}

async function decryptPassword(encryptedPassword, masterPassword) {
    try {
        return await ipcRenderer.invoke('decrypt-data', encryptedPassword, masterPassword);
    } catch (error) {
        console.error('Error al desencriptar la contraseña:', error);
        return 'Error al desencriptar';
    }
}

function copyPassword(password) {
    navigator.clipboard.writeText(password).then(() => {
        alert('Contraseña copiada al portapapeles');
    }).catch(err => {
        console.error('Error al copiar la contraseña: ', err);
    });
}