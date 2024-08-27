const { ipcRenderer } = require('electron');
const path = require('path');

let vaultData;
let masterPassword;

// Cargar los datos del vault
async function loadVaultData() {
    masterPassword = localStorage.getItem('masterPassword');
    if (!masterPassword) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const userDataPath = await ipcRenderer.invoke('get-user-data-path');
        const vaultPath = path.join(userDataPath, 'passwords.json');
        const encryptedData = await ipcRenderer.invoke('read-file', vaultPath);
        const decryptedData = await ipcRenderer.invoke('decrypt-data', encryptedData, masterPassword);
        vaultData = JSON.parse(decryptedData);
        displayPasswords();
    } catch (error) {
        console.error('Error al cargar el vault:', error);
        alert('Error al cargar los datos del vault.');
        window.location.href = 'login.html';
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
    const website = document.getElementById('website').value;
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const twoFactorSecret = document.getElementById('twoFactorSecret').value;

    const encryptedPassword = await ipcRenderer.invoke('encrypt-data', password, masterPassword);
    const encryptedTwoFactorSecret = await ipcRenderer.invoke('encrypt-data', twoFactorSecret, masterPassword);
    
    vaultData.passwords.push({ 
        siteName, 
        website,
        username, 
        email, 
        password: encryptedPassword, 
        twoFactorSecret: encryptedTwoFactorSecret 
    });
    
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
        const decryptedTwoFactorSecret = item.twoFactorSecret ? await ipcRenderer.invoke('decrypt-data', item.twoFactorSecret, masterPassword) : '';
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>${item.siteName} - ${item.username}</span>
            <div>
                <button class="btn btn-secondary btn-sm show-details-btn" data-password="${decryptedPassword}" data-email="${item.email}" data-twofactor="${decryptedTwoFactorSecret}">Detalles</button>
                <button class="btn btn-danger btn-sm delete-btn" data-index="${passwords.indexOf(item)}">Borrar</button>
            </div>
        `;
        resultsContainer.appendChild(li);
    }
}

// Mostrar detalles
document.getElementById('searchResults').addEventListener('click', (e) => {
    if (e.target.classList.contains('show-details-btn')) {
        const password = e.target.getAttribute('data-password');
        const email = e.target.getAttribute('data-email');
        const twoFactor = e.target.getAttribute('data-twofactor');
        
        alert(`Contraseña: ${password}\nEmail: ${email || 'No disponible'}\nVerificación de dos pasos: ${twoFactor || 'No disponible'}`);
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
document.addEventListener('DOMContentLoaded', loadVaultData);