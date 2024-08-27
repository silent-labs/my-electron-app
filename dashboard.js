const { ipcRenderer } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

let vaultData;
const vaultPath = path.join(require('electron').remote.app.getPath('userData'), 'passwords.json');

// Cargar los datos del vault
async function loadVaultData() {
    try {
        const encryptedData = await fs.readFile(vaultPath, 'utf-8');
        const decryptedData = decryptData(encryptedData, localStorage.getItem('masterPassword'));
        vaultData = JSON.parse(decryptedData);
    } catch (error) {
        console.error('Error al cargar el vault:', error);
        alert('Error al cargar los datos del vault.');
    }
}

// Guardar los datos del vault
async function saveVaultData() {
    try {
        const encryptedData = encryptData(JSON.stringify(vaultData), localStorage.getItem('masterPassword'));
        await fs.writeFile(vaultPath, encryptedData);
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

    vaultData.passwords.push({ siteName, username, password });
    await saveVaultData();
    alert('Contraseña añadida con éxito.');
    e.target.reset();
});

// Buscar contraseñas
document.getElementById('searchBtn').addEventListener('click', () => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const results = vaultData.passwords.filter(item => 
        item.siteName.toLowerCase().includes(searchTerm) || 
        item.username.toLowerCase().includes(searchTerm)
    );
    displaySearchResults(results);
});

// Mostrar resultados de búsqueda
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    results.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `
            <span>${item.siteName} - ${item.username}</span>
            <button class="btn btn-danger btn-sm delete-btn" data-index="${index}">Borrar</button>
        `;
        resultsContainer.appendChild(li);
    });
}

// Borrar contraseña
document.getElementById('searchResults').addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const index = e.target.getAttribute('data-index');
        vaultData.passwords.splice(index, 1);
        await saveVaultData();
        alert('Contraseña eliminada con éxito.');
        document.getElementById('searchBtn').click(); // Actualizar resultados
    }
});

// Funciones de encriptación y desencriptación (las mismas que en login.js)
function encryptData(data, password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

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

// Cargar los datos del vault al iniciar
loadVaultData();