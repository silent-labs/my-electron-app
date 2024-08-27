const { ipcRenderer } = require('electron');
const crypto = require('crypto');
const path = require('path');

let vaultData;
let masterPassword;

// Cargar los datos del vault
async function loadVaultData() {
    try {
        const userDataPath = await ipcRenderer.invoke('get-user-data-path');
        const vaultPath = path.join(userDataPath, 'passwords.json');
        const encryptedData = await ipcRenderer.invoke('read-file', vaultPath);
        masterPassword = localStorage.getItem('masterPassword');
        const decryptedData = await ipcRenderer.invoke('decrypt-data', encryptedData, masterPassword);
        vaultData = JSON.parse(decryptedData);
        displayPasswords();
    } catch (error) {
        console.error('Error al cargar el vault:', error);
        alert('Error al cargar los datos del vault.');
    }
}

// Guardar los datos del vault
async function saveVaultData() {
    try {
        const userDataPath = await ipcRenderer.invoke('get-user-data-path');
        const vaultPath = path.join(userDataPath, 'passwords.json');
        const encryptedData = await ipcRenderer.invoke('encrypt-data', JSON.stringify(vaultData), masterPassword);
        await ipcRenderer.invoke('write-file', vaultPath, encryptedData);
    } catch (error) {
        console.error('Error al guardar el vault:', error);
        alert('Error al guardar los datos del vault.');
    }
}

// Añadir nueva contraseña
document.getElementById('addPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const siteName = document.getElementById('siteName').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const encryptedPassword = await ipcRenderer.invoke('encrypt-data', password, masterPassword);
    vaultData.passwords.push({ siteName, username, password: encryptedPassword });
    
    const loadingMessage = document.createElement('div');
    loadingMessage.textContent = 'Guardando...';
    loadingMessage.className = 'alert alert-info';
    document.getElementById('addPasswordForm').appendChild(loadingMessage);

    try {
        await saveVaultData();
        alert('Contraseña añadida con éxito.');
        e.target.reset();
        displayPasswords();
    } catch (error) {
        console.error('Error al guardar la contraseña:', error);
        alert('Error al guardar la contraseña.');
    } finally {
        loadingMessage.remove();
    }
});

// Buscar contraseñas
document.getElementById('searchBtn').addEventListener('click', () => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const results = vaultData.passwords.filter(item => 
        item.siteName.toLowerCase().includes(searchTerm) || 
        item.username.toLowerCase().includes(searchTerm)
    );
    displayPasswords(results);
});

// Mostrar contraseñas
async function displayPasswords(passwords = vaultData.passwords) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    for (const item of passwords) {
        const decryptedPassword = await ipcRenderer.invoke('decrypt-data', item.password, masterPassword);
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>${item.siteName} - ${item.username}</span>
            <div>
                <button class="btn btn-secondary btn-sm show-password-btn" data-password="${decryptedPassword}">Mostrar</button>
                <button class="btn btn-danger btn-sm delete-btn" data-index="${passwords.indexOf(item)}">Borrar</button>
            </div>
        `;
        resultsContainer.appendChild(li);
    }
}

// Mostrar contraseña
document.getElementById('searchResults').addEventListener('click', (e) => {
    if (e.target.classList.contains('show-password-btn')) {
        const password = e.target.getAttribute('data-password');
        alert(`Contraseña: ${password}`);
    }
});

// Borrar contraseña
document.getElementById('searchResults').addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const index = e.target.getAttribute('data-index');
        vaultData.passwords.splice(index, 1);
        
        const loadingMessage = document.createElement('div');
        loadingMessage.textContent = 'Borrando...';
        loadingMessage.className = 'alert alert-info';
        e.target.parentNode.appendChild(loadingMessage);

        try {
            await saveVaultData();
            alert('Contraseña eliminada con éxito.');
            displayPasswords();
        } catch (error) {
            console.error('Error al eliminar la contraseña:', error);
            alert('Error al eliminar la contraseña.');
        } finally {
            loadingMessage.remove();
        }
    }
});

// Cargar los datos del vault al iniciar
loadVaultData();