document.addEventListener('DOMContentLoaded', () => {
    // --- UTILITIES ---
    function calculateDaysRemaining(targetDateStr) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const target = new Date(targetDateStr);
        target.setHours(0,0,0,0);
        const diffTime = target - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // --- INDEXED DB FOR IMAGES ---
    let db;
    const request = indexedDB.open('MiAppDB', 1);

    request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.errorCode);
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        renderGallery();
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('images')) {
            db.createObjectStore('images', { keyPath: 'id' });
        }
    };

    // --- STATE MANAGEMENT ---
    let records = JSON.parse(localStorage.getItem('mantenimiento_records')) || [];
    let appointments = JSON.parse(localStorage.getItem('agenda_appointments')) || [];

    function saveData() {
        localStorage.setItem('mantenimiento_records', JSON.stringify(records));
        localStorage.setItem('agenda_appointments', JSON.stringify(appointments));
    }


    // --- NAVIGATION LOGIC ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.page-section');
    const headerTitle = document.getElementById('header-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items and sections
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));

            // Add active class to clicked item
            item.classList.add('active');

            // Show target section
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            // Update Header Title based on the label of the active nav item
            const label = item.querySelector('.label').textContent;
            headerTitle.textContent = label;
        });
    });

    // Initial title setup
    const initialActive = document.querySelector('.nav-item.active .label');
    if (initialActive) {
        headerTitle.textContent = initialActive.textContent;
    }

    // --- MANTENIMIENTO LOGIC ---
    const mantForm = document.getElementById('mantenimiento-form');
    const mantList = document.getElementById('mantenimiento-list');

    mantForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const category = document.getElementById('mant-category').value;
        const name = document.getElementById('mant-name').value;
        const date = document.getElementById('mant-date').value;

        records.push({ id: generateId(), category, name, date });
        saveData();
        renderRecords();
        mantForm.reset();
    });

    function renderRecords() {
        mantList.innerHTML = '';
        if (records.length === 0) {
            mantList.innerHTML = '<p class="empty-msg">No hay registros guardados.</p>';
            return;
        }

        // Sort by closest date
        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        records.forEach(record => {
            const days = calculateDaysRemaining(record.date);
            const isUrgent = days <= 7;
            const daysText = days < 0 ? `Caducado hace ${Math.abs(days)} días` :
                             days === 0 ? '¡Es hoy!' : `Faltan ${days} días`;

            const card = document.createElement('div');
            card.className = 'record-card';
            card.innerHTML = `
                <div class="record-info">
                    <h4>${record.name} (${record.category})</h4>
                    <p>Fecha: ${new Date(record.date).toLocaleDateString()}</p>
                    <span class="record-days ${isUrgent ? 'urgent' : ''}">${daysText}</span>
                </div>
                <button class="btn-delete" data-id="${record.id}" aria-label="Eliminar registro">✕</button>
            `;

            card.querySelector('.btn-delete').addEventListener('click', () => {
                records = records.filter(r => r.id !== record.id);
                saveData();
                renderRecords();
                renderNotifications();
            });

            mantList.appendChild(card);
        });
        renderNotifications();
    }


    // --- AGENDA LOGIC ---
    const agendaForm = document.getElementById('agenda-form');
    const agendaList = document.getElementById('agenda-list');

    agendaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('agenda-title').value;
        const date = document.getElementById('agenda-date').value;
        const time = document.getElementById('agenda-time').value;

        appointments.push({ id: generateId(), title, date, time });
        saveData();
        renderAgenda();
        agendaForm.reset();
    });

    function renderAgenda() {
        agendaList.innerHTML = '';
        if (appointments.length === 0) {
            agendaList.innerHTML = '<p class="empty-msg">No hay citas pendientes.</p>';
            return;
        }

        // Sort by closest date/time
        appointments.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

        appointments.forEach(appt => {
            const days = calculateDaysRemaining(appt.date);
            const isUrgent = days <= 2;
            const daysText = days < 0 ? `Pasada hace ${Math.abs(days)} días` :
                             days === 0 ? '¡Es hoy!' : `En ${days} días`;

            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <div class="task-info">
                    <h4>${appt.title}</h4>
                    <p>${new Date(appt.date).toLocaleDateString()} a las ${appt.time}</p>
                    <span class="record-days ${isUrgent ? 'urgent' : ''}">${daysText}</span>
                </div>
                <button class="btn-delete" data-id="${appt.id}" aria-label="Eliminar cita">✕</button>
            `;

            card.querySelector('.btn-delete').addEventListener('click', () => {
                appointments = appointments.filter(a => a.id !== appt.id);
                saveData();
                renderAgenda();
                renderNotifications();
            });

            agendaList.appendChild(card);
        });
        renderNotifications();
    }

    // --- SALUD LOGIC (INDEXED DB) ---
    const saludUpload = document.getElementById('salud-upload');
    const saludGallery = document.getElementById('salud-gallery');

    saludUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            const id = generateId();

            if (!db) {
                console.error("Database not initialized yet.");
                return;
            }

            const transaction = db.transaction(['images'], 'readwrite');
            const objectStore = transaction.objectStore('images');

            const addRequest = objectStore.add({ id, dataUrl });

            addRequest.onsuccess = () => {
                renderGallery();
            };

            addRequest.onerror = (err) => {
                console.error("Error adding image to IndexedDB", err);
            };
        };
        reader.readAsDataURL(file);
    });

    function renderGallery() {
        if (!db) return;
        saludGallery.innerHTML = '';

        const transaction = db.transaction(['images'], 'readonly');
        const objectStore = transaction.objectStore('images');
        const request = objectStore.getAll();

        request.onsuccess = (event) => {
            const images = event.target.result;

            if (images.length === 0) {
                saludGallery.innerHTML = '<p class="empty-msg" style="grid-column: 1 / -1;">No hay documentos guardados.</p>';
                return;
            }

            images.forEach(img => {
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `
                    <img src="${img.dataUrl}" alt="Documento de salud">
                    <button class="btn-delete-img" data-id="${img.id}">✕</button>
                `;

                item.querySelector('.btn-delete-img').addEventListener('click', () => {
                    deleteImage(img.id);
                });

                saludGallery.appendChild(item);
            });
        };
    }

    function deleteImage(id) {
        if (!db) return;
        const transaction = db.transaction(['images'], 'readwrite');
        const objectStore = transaction.objectStore('images');
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            renderGallery();
        };
    }

    // --- NOTIFICACIONES LOGIC ---
    const notificacionesList = document.getElementById('notificaciones-list');

    function renderNotifications() {
        notificacionesList.innerHTML = '';
        const allUpcoming = [];

        // Add upcoming maintenance records (<= 7 days)
        records.forEach(r => {
            const days = calculateDaysRemaining(r.date);
            if (days <= 7) {
                allUpcoming.push({ ...r, type: 'mantenimiento', days });
            }
        });

        // Add upcoming agenda appointments (<= 2 days)
        appointments.forEach(a => {
            const days = calculateDaysRemaining(a.date);
            if (days <= 2) {
                allUpcoming.push({ ...a, type: 'agenda', days });
            }
        });

        // Sort by closest date
        allUpcoming.sort((a, b) => a.days - b.days);

        if (allUpcoming.length === 0) {
            notificacionesList.innerHTML = '<p class="empty-msg">No hay notificaciones recientes.</p>';
            return;
        }

        allUpcoming.forEach(item => {
            const isUrgent = item.days <= 0;
            const daysText = item.days < 0 ? `Atrasado` :
                             item.days === 0 ? '¡Es hoy!' : `Próximamente`;

            let title = item.type === 'mantenimiento' ? item.name : item.title;
            let icon = item.type === 'mantenimiento' ? '🛠️' : '📅';

            const card = document.createElement('div');
            card.className = 'notification-card';
            card.innerHTML = `
                <div class="notification-info">
                    <h4>${icon} ${title}</h4>
                    <p>Faltan ${Math.max(0, item.days)} días</p>
                    <span class="record-days ${isUrgent ? 'urgent' : ''}">${daysText}</span>
                </div>
            `;
            notificacionesList.appendChild(card);
        });
    }

    // Initial render
    renderRecords();
    renderAgenda();
    // renderGallery() is called inside IndexedDB onsuccess
    // renderNotifications() is called inside renderRecords/renderAgenda

    // --- Settings Section Functionality ---

    // 1. Profile & Account
    const profileNameInput = document.getElementById('profile-name');
    const profilePhoneInput = document.getElementById('profile-phone');
    const profileNotesInput = document.getElementById('profile-notes');
    const saveProfileBtn = document.getElementById('save-profile');

    // Load profile from localStorage
    const loadProfile = () => {
        const profile = JSON.parse(localStorage.getItem('miapp_profile')) || {};
        profileNameInput.value = profile.name || '';
        profilePhoneInput.value = profile.phone || '';
        profileNotesInput.value = profile.notes || '';
    };

    saveProfileBtn.addEventListener('click', () => {
        const profile = {
            name: profileNameInput.value,
            phone: profilePhoneInput.value,
            notes: profileNotesInput.value
        };
        localStorage.setItem('miapp_profile', JSON.stringify(profile));
        alert('Perfil guardado correctamente.');
    });

    loadProfile();

    // 2. Security and Face ID (WebAuthn for Biometrics)
    const biometricToggle = document.getElementById('biometric-toggle');
    const accessBtn = document.getElementById('access-sensitive-data');
    const authStatus = document.getElementById('auth-status');

    // Check if biometric is enabled in localStorage
    biometricToggle.checked = localStorage.getItem('miapp_biometric_enabled') === 'true';

    biometricToggle.addEventListener('change', async (e) => {
        const isEnabled = e.target.checked;
        if (isEnabled) {
            try {
                // Try to create a credential to verify biometrics are available
                const publicKey = {
                    challenge: new Uint8Array(32),
                    rp: { name: "Mi App PWA" },
                    user: {
                        id: new Uint8Array(16),
                        name: "usuario@miapp.local",
                        displayName: "Usuario PWA"
                    },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform", // Request FaceID/TouchID/Windows Hello
                        userVerification: "required"
                    },
                    timeout: 60000
                };

                // Request credential creation to setup biometric
                await navigator.credentials.create({ publicKey });

                localStorage.setItem('miapp_biometric_enabled', 'true');
                authStatus.textContent = "Biometría activada.";
                authStatus.style.color = "green";
            } catch (err) {
                console.error("Biometric setup failed:", err);
                biometricToggle.checked = false;
                localStorage.setItem('miapp_biometric_enabled', 'false');
                authStatus.textContent = "Error o biometría no disponible.";
                authStatus.style.color = "red";
                alert('No se pudo activar la biometría: ' + err.message);
            }
        } else {
            localStorage.setItem('miapp_biometric_enabled', 'false');
            authStatus.textContent = "Biometría desactivada.";
            authStatus.style.color = "var(--text-muted)";
        }
    });

    accessBtn.addEventListener('click', async () => {
        const isBiometricEnabled = localStorage.getItem('miapp_biometric_enabled') === 'true';

        if (!isBiometricEnabled) {
            alert('Acceso concedido a documentos (sin seguridad biométrica).');
            return;
        }

        try {
            // Request authentication via get()
            const publicKey = {
                challenge: new Uint8Array(32),
                userVerification: "required"
            };

            authStatus.textContent = "Autenticando...";
            await navigator.credentials.get({ publicKey });

            authStatus.textContent = "Acceso concedido.";
            authStatus.style.color = "green";
            alert('Face ID / Biometría validada. Acceso concedido a documentos.');
        } catch (err) {
            console.error("Authentication failed:", err);
            authStatus.textContent = "Autenticación fallida.";
            authStatus.style.color = "red";
            alert('Acceso denegado.');
        }
    });

    // 3. Data Management
    const exportBtn = document.getElementById('export-data');
    const importInput = document.getElementById('import-data');
    const deleteBtn = document.getElementById('delete-data');

    // Export Data to JSON
    exportBtn.addEventListener('click', () => {
        const data = {
            profile: JSON.parse(localStorage.getItem('miapp_profile')) || {},
            biometric_enabled: localStorage.getItem('miapp_biometric_enabled') === 'true',
            vehicles: JSON.parse(localStorage.getItem('miapp_records')) || [],
            agenda: JSON.parse(localStorage.getItem('miapp_appointments')) || []
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Import Data from JSON
    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                if (data.profile) {
                    localStorage.setItem('miapp_profile', JSON.stringify(data.profile));
                }
                if (data.hasOwnProperty('biometric_enabled')) {
                    localStorage.setItem('miapp_biometric_enabled', data.biometric_enabled);
                    biometricToggle.checked = data.biometric_enabled;
                }
                if (data.vehicles) {
                    localStorage.setItem('miapp_records', JSON.stringify(data.vehicles));
                    records = data.vehicles;
                }
                if (data.agenda) {
                    localStorage.setItem('miapp_appointments', JSON.stringify(data.agenda));
                    appointments = data.agenda;
                }

                loadProfile();
                renderRecords();
                renderAgenda();
                alert('Datos restaurados correctamente.');
            } catch (err) {
                console.error("Import failed:", err);
                alert('Error al importar el archivo. Asegúrate de que sea un backup.json válido.');
            }
            // Reset input
            importInput.value = '';
        };
        reader.readAsText(file);
    });

    // Delete All Data
    deleteBtn.addEventListener('click', () => {
        const confirmDelete = confirm('⚠️ ADVERTENCIA ⚠️\n\n¿Estás seguro de que deseas borrar TODOS los datos locales? Esta acción no se puede deshacer.');
        if (confirmDelete) {
            localStorage.clear();

            // clear indexedDB as well
            if (db) {
                const transaction = db.transaction(['images'], 'readwrite');
                const objectStore = transaction.objectStore('images');
                objectStore.clear().onsuccess = () => {
                    renderGallery();
                };
            }

            records = [];
            appointments = [];

            loadProfile(); // will reset fields
            renderRecords();
            renderAgenda();
            biometricToggle.checked = false;
            alert('Todos los datos han sido borrados.');
        }
    });

    // Service Worker Registration for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }
});
