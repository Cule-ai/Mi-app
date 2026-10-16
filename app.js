document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
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
            // Add placeholders for future features
            vehicles: [],
            pets: [],
            agenda: [],
            documents: []
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

                loadProfile();
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
            loadProfile(); // will reset fields
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
