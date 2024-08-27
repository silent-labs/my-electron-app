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
    loadingMessage.className = 'notification is-info is-light';
    document.getElementById('addPasswordForm').appendChild(loadingMessage);

    try {
        await saveVaultData();
        const successMessage = document.createElement('div');
        successMessage.textContent = 'Contraseña añadida con éxito.';
        successMessage.className = 'notification is-success is-light';
        document.getElementById('addPasswordForm').appendChild(successMessage);
        setTimeout(() => successMessage.remove(), 3000);
        e.target.reset();
        displayPasswords();
    } catch (error) {
        console.error('Error al guardar la contraseña:', error);
        const errorMessage = document.createElement('div');
        errorMessage.textContent = 'Error al guardar la contraseña.';
        errorMessage.className = 'notification is-danger is-light';
        document.getElementById('addPasswordForm').appendChild(errorMessage);
        setTimeout(() => errorMessage.remove(), 3000);
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
    
    if (passwords.length === 0) {
        resultsContainer.innerHTML = '<p class="has-text-centered">No se encontraron resultados.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'password-list';

    for (const item of passwords) {
        const decryptedPassword = await ipcRenderer.invoke('decrypt-data', item.password, masterPassword);
        const decryptedTwoFactorSecret = item.twoFactorSecret ? await ipcRenderer.invoke('decrypt-data', item.twoFactorSecret, masterPassword) : '';
        
        const li = document.createElement('li');
        li.className = 'password-item box mb-4';
        li.innerHTML = `
            <article class="media">
                <div class="media-content">
                    <div class="content">
                        <p>
                            <strong class="is-size-4">${item.siteName}</strong>
                            ${item.website ? `<small><a href="${item.website}" target="_blank">${item.website}</a></small>` : ''}
                            <br>
                            <span class="tag is-info is-light">${item.username}</span>
                            ${item.email ? `<span class="tag is-success is-light">${item.email}</span>` : ''}
                        </p>
                    </div>
                    <nav class="level is-mobile">
                        <div class="level-left">
                            <a class="level-item button is-small is-info show-details-btn" data-password="${decryptedPassword}" data-email="${item.email || 'No disponible'}" data-twofactor="${decryptedTwoFactorSecret}">
                                <span class="icon"><i class="fas fa-info-circle"></i></span>
                                <span>Detalles</span>
                            </a>
                            <a class="level-item button is-small is-warning edit-btn" data-index="${passwords.indexOf(item)}">
                                <span class="icon"><i class="fas fa-edit"></i></span>
                                <span>Editar</span>
                            </a>
                        </div>
                        <div class="level-right">
                            <a class="level-item button is-small is-danger delete-btn" data-index="${passwords.indexOf(item)}">
                                <span class="icon"><i class="fas fa-trash-alt"></i></span>
                                <span>Borrar</span>
                            </a>
                        </div>
                    </nav>
                </div>
            </article>
        `;
        ul.appendChild(li);
    }
    resultsContainer.appendChild(ul);
}

// Mostrar detalles
document.getElementById('searchResults').addEventListener('click', (e) => {
    if (e.target.closest('.show-details-btn')) {
        const button = e.target.closest('.show-details-btn');
        const password = button.getAttribute('data-password');
        const email = button.getAttribute('data-email');
        const twoFactor = button.getAttribute('data-twofactor');
        
        const modal = document.createElement('div');
        modal.className = 'modal is-active';
        modal.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">Detalles de la contraseña</p>
                    <button class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body">
                    <div class="content">
                        <div class="field">
                            <label class="label">Contraseña:</label>
                            <div class="control">
                                <div class="field has-addons">
                                    <div class="control is-expanded">
                                        <input class="input" type="password" value="${password}" readonly id="passwordInput">
                                    </div>
                                    <div class="control">
                                        <button class="button is-info toggle-password-btn">
                                            <span class="icon">
                                                <i class="fas fa-eye"></i>
                                            </span>
                                        </button>
                                    </div>
                                    <div class="control">
                                        <button class="button is-info copy-btn" data-clipboard-text="${password}">
                                            <span class="icon">
                                                <i class="fas fa-copy"></i>
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Email:</label>
                            <div class="control">
                                <div class="field has-addons">
                                    <div class="control is-expanded">
                                        <input class="input" type="text" value="${email || 'No disponible'}" readonly>
                                    </div>
                                    ${email ? `
                                        <div class="control">
                                            <button class="button is-info copy-btn" data-clipboard-text="${email}">
                                                <span class="icon">
                                                    <i class="fas fa-copy"></i>
                                                </span>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Verificación de dos pasos:</label>
                            <div class="control">
                                <div class="field has-addons">
                                    <div class="control is-expanded">
                                        <input class="input" type="text" value="${twoFactor || 'No disponible'}" readonly>
                                    </div>
                                    ${twoFactor ? `
                                        <div class="control">
                                            <button class="button is-info copy-btn" data-clipboard-text="${twoFactor}">
                                                <span class="icon">
                                                    <i class="fas fa-copy"></i>
                                                </span>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.delete').addEventListener('click', () => {
            modal.remove();
        });

        // Agregar funcionalidad de copiado
        modal.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation(); // Evita que el evento se propague
                const textToCopy = btn.getAttribute('data-clipboard-text');
                navigator.clipboard.writeText(textToCopy).then(() => {
                    // Cambiar el icono temporalmente para indicar que se copió
                    const icon = btn.querySelector('i');
                    icon.classList.remove('fa-copy');
                    icon.classList.add('fa-check');
                    setTimeout(() => {
                        icon.classList.remove('fa-check');
                        icon.classList.add('fa-copy');
                    }, 1000);
                }).catch(err => {
                    console.error('Error al copiar el texto: ', err);
                });
            });
        });

        // Agregar funcionalidad de mostrar/ocultar contraseña
        const togglePasswordBtn = modal.querySelector('.toggle-password-btn');
        const passwordInput = modal.querySelector('#passwordInput');
        togglePasswordBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                togglePasswordBtn.querySelector('i').classList.remove('fa-eye');
                togglePasswordBtn.querySelector('i').classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                togglePasswordBtn.querySelector('i').classList.remove('fa-eye-slash');
                togglePasswordBtn.querySelector('i').classList.add('fa-eye');
            }
        });
    }
});

// Borrar contraseña
document.getElementById('searchResults').addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const index = e.target.getAttribute('data-index');
        
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal is-active';
        confirmModal.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">Confirmar eliminación</p>
                    <button class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body">
                    <p>¿Estás seguro de que quieres eliminar esta contraseña?</p>
                </section>
                <footer class="modal-card-foot">
                    <button class="button is-danger confirm-delete">Eliminar</button>
                    <button class="button cancel-delete">Cancelar</button>
                </footer>
            </div>
        `;
        document.body.appendChild(confirmModal);
        
        confirmModal.querySelector('.delete').addEventListener('click', () => {
            confirmModal.remove();
        });
        
        confirmModal.querySelector('.cancel-delete').addEventListener('click', () => {
            confirmModal.remove();
        });
        
        confirmModal.querySelector('.confirm-delete').addEventListener('click', async () => {
            confirmModal.remove();
            
            vaultData.passwords.splice(index, 1);
            
            const loadingMessage = document.createElement('div');
            loadingMessage.textContent = 'Borrando...';
            loadingMessage.className = 'notification is-info is-light';
            document.getElementById('searchResults').appendChild(loadingMessage);

            try {
                await saveVaultData();
                const successMessage = document.createElement('div');
                successMessage.textContent = 'Contraseña eliminada con éxito.';
                successMessage.className = 'notification is-success is-light';
                document.getElementById('searchResults').appendChild(successMessage);
                setTimeout(() => successMessage.remove(), 3000);
                displayPasswords();
            } catch (error) {
                console.error('Error al eliminar la contraseña:', error);
                const errorMessage = document.createElement('div');
                errorMessage.textContent = 'Error al eliminar la contraseña.';
                errorMessage.className = 'notification is-danger is-light';
                document.getElementById('searchResults').appendChild(errorMessage);
                setTimeout(() => errorMessage.remove(), 3000);
            } finally {
                loadingMessage.remove();
            }
        });
    }
});

// Editar contraseña
document.getElementById('searchResults').addEventListener('click', async (e) => {
    if (e.target.closest('.edit-btn')) {
        const button = e.target.closest('.edit-btn');
        const index = button.getAttribute('data-index');
        const item = vaultData.passwords[index];

        const modal = document.createElement('div');
        modal.className = 'modal is-active';
        modal.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">Editar contraseña</p>
                    <button class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body">
                    <form id="editPasswordForm">
                        <div class="field">
                            <label class="label">Nombre del sitio</label>
                            <div class="control">
                                <input class="input" type="text" id="editSiteName" value="${item.siteName}" required>
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Sitio web</label>
                            <div class="control">
                                <input class="input" type="text" id="editWebsite" value="${item.website || ''}">
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Nombre de usuario</label>
                            <div class="control">
                                <input class="input" type="text" id="editUsername" value="${item.username}" required>
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Email</label>
                            <div class="control">
                                <input class="input" type="email" id="editEmail" value="${item.email || ''}">
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Contraseña</label>
                            <div class="control">
                                <input class="input" type="password" id="editPassword" placeholder="Dejar en blanco para no cambiar">
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Secreto de dos factores</label>
                            <div class="control">
                                <input class="input" type="text" id="editTwoFactorSecret" value="${item.twoFactorSecret || ''}">
                            </div>
                        </div>
                    </form>
                </section>
                <footer class="modal-card-foot">
                    <button class="button is-success" id="saveEditBtn">Guardar cambios</button>
                    <button class="button cancel-edit">Cancelar</button>
                </footer>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.delete').addEventListener('click', () => modal.remove());
        modal.querySelector('.cancel-edit').addEventListener('click', () => modal.remove());

        modal.querySelector('#saveEditBtn').addEventListener('click', async () => {
            const editedItem = {
                siteName: document.getElementById('editSiteName').value,
                website: document.getElementById('editWebsite').value,
                username: document.getElementById('editUsername').value,
                email: document.getElementById('editEmail').value,
                password: document.getElementById('editPassword').value,
                twoFactorSecret: document.getElementById('editTwoFactorSecret').value
            };

            if (editedItem.password) {
                editedItem.password = await ipcRenderer.invoke('encrypt-data', editedItem.password, masterPassword);
            } else {
                editedItem.password = item.password; // Mantener la contraseña existente si no se cambió
            }

            if (editedItem.twoFactorSecret) {
                editedItem.twoFactorSecret = await ipcRenderer.invoke('encrypt-data', editedItem.twoFactorSecret, masterPassword);
            }

            vaultData.passwords[index] = { ...item, ...editedItem };

            try {
                await saveVaultData();
                modal.remove();
                displayPasswords();
                showNotification('Contraseña actualizada con éxito', 'is-success');
            } catch (error) {
                console.error('Error al guardar los cambios:', error);
                showNotification('Error al guardar los cambios', 'is-danger');
            }
        });
    }
});

// Función para mostrar notificaciones
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <button class="delete"></button>
        ${message}
    `;
    document.body.appendChild(notification);
    notification.querySelector('.delete').addEventListener('click', () => notification.remove());
    setTimeout(() => notification.remove(), 3000);
}

// Cargar los datos del vault al iniciar
document.addEventListener('DOMContentLoaded', loadVaultData);