// =====================================
// AUTH MANAGER - CORRECTED VERSION
// =====================================

class AuthManager {
    constructor() {
        this.currentTab = 'login';
        this.isLoading = false;
        // DO NOT call init() here - the router will call it after loading HTML
    }
    
    init() {
        console.log('AuthManager.init() called');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        console.log('Setting up auth event listeners...');
        
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Form submissions
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        
        // Password strength indicator
        const passwordInput = document.getElementById('register-password');
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => this.checkPasswordStrength(e.target.value));
        }
        
        // Password confirmation
        const confirmInput = document.getElementById('register-password-confirm');
        if (confirmInput) {
            confirmInput.addEventListener('input', () => this.checkPasswordMatch());
        }
        
        // Demo login
        const demoBtn = document.getElementById('demo-login-btn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => this.handleDemoLogin());
        }
        
        // Forgot password
        const forgotLink = document.getElementById('forgot-password-link');
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showForgotPasswordModal();
            });
        }
        
        // Reset password email
        const resetBtn = document.getElementById('send-reset-email');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handlePasswordReset());
        }
        
        // Modal close
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
        
        // Modal backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
    }
    
    // Tab switching
    switchTab(tab) {
        if (this.isLoading) return;
        
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        // Update forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tab}-form`);
        });
        
        // Clear messages
        this.hideMessage();
    }
    
    // Login handler
    async handleLogin(e) {
        e.preventDefault();
        if (this.isLoading) return;
        
        const form = e.target;
        const email = form.querySelector('#login-email').value.trim();
        const password = form.querySelector('#login-password').value;
        
        // Validate
        if (!this.validateEmail(email)) {
            this.showMessage('Email non valida', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showMessage('Password deve essere almeno 6 caratteri', 'error');
            return;
        }
        
        // Start loading
        this.setLoading(form, true);
        
        try {
            // Call Supabase
            const result = await supabaseManager.signIn(email, password);
            
            if (result.success) {
                this.showMessage('Login effettuato con successo!', 'success');
                
                // Store remember me preference
                const rememberMe = form.querySelector('#remember-me').checked;
                if (rememberMe) {
                    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, 'remembered');
                }
                
                // Redirect to dashboard after short delay
                setTimeout(() => {
                    window.router?.navigate('dashboard');
                }, 1000);
            } else {
                this.showMessage(result.error || 'Credenziali non valide', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Errore durante il login. Riprova.', 'error');
        } finally {
            this.setLoading(form, false);
        }
    }
    
    // Register handler
    async handleRegister(e) {
        e.preventDefault();
        if (this.isLoading) return;
        
        const form = e.target;
        const username = form.querySelector('#register-username').value.trim();
        const email = form.querySelector('#register-email').value.trim();
        const password = form.querySelector('#register-password').value;
        const passwordConfirm = form.querySelector('#register-password-confirm').value;
        const acceptTerms = form.querySelector('#accept-terms').checked;
        
        // Validate
        if (username.length < CONFIG.VALIDATION.USERNAME_MIN || 
            username.length > CONFIG.VALIDATION.USERNAME_MAX) {
            this.showMessage(`Username deve essere tra ${CONFIG.VALIDATION.USERNAME_MIN} e ${CONFIG.VALIDATION.USERNAME_MAX} caratteri`, 'error');
            return;
        }
        
        if (!this.validateEmail(email)) {
            this.showMessage('Email non valida', 'error');
            return;
        }
        
        if (password.length < CONFIG.VALIDATION.PASSWORD_MIN) {
            this.showMessage(`Password deve essere almeno ${CONFIG.VALIDATION.PASSWORD_MIN} caratteri`, 'error');
            return;
        }
        
        if (password !== passwordConfirm) {
            this.showMessage('Le password non corrispondono', 'error');
            return;
        }
        
        if (!acceptTerms) {
            this.showMessage('Devi accettare i termini e condizioni', 'error');
            return;
        }
        
        // Start loading
        this.setLoading(form, true);
        
        try {
            // Call Supabase
            const result = await supabaseManager.signUp(email, password, username);
            
            if (result.success) {
                this.showMessage('Registrazione completata! Controlla la tua email per confermare.', 'success');
                
                // Clear form
                form.reset();
                
                // Switch to login tab after delay
                setTimeout(() => {
                    this.switchTab('login');
                }, 3000);
            } else {
                this.showMessage(result.error || 'Errore durante la registrazione', 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showMessage('Errore durante la registrazione. Riprova.', 'error');
        } finally {
            this.setLoading(form, false);
        }
    }
    
    // Demo login
    async handleDemoLogin() {
        if (this.isLoading) return;
        
        const form = document.getElementById('login-form');
        this.setLoading(form, true);
        
        try {
            // Use demo credentials
            const result = await supabaseManager.signIn('demo@fantasta.app', 'demo123456');
            
            if (result.success) {
                this.showMessage('Accesso demo effettuato!', 'success');
                setTimeout(() => {
                    window.router?.navigate('dashboard');
                }, 1000);
            } else {
                this.showMessage('Account demo non disponibile', 'error');
            }
        } catch (error) {
            console.error('Demo login error:', error);
            this.showMessage('Errore durante l\'accesso demo', 'error');
        } finally {
            this.setLoading(form, false);
        }
    }
    
    // Password reset
    showForgotPasswordModal() {
        const modal = document.getElementById('forgot-password-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    async handlePasswordReset() {
        const emailInput = document.getElementById('reset-email');
        const email = emailInput?.value.trim();
        
        if (!email || !this.validateEmail(email)) {
            this.showMessage('Inserisci un\'email valida', 'error');
            return;
        }
        
        const button = document.getElementById('send-reset-email');
        const originalText = button.textContent;
        button.textContent = 'Invio...';
        button.disabled = true;
        
        try {
            const { error } = await supabaseManager.client.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });
            
            if (error) throw error;
            
            // Close modal
            document.getElementById('forgot-password-modal').classList.add('hidden');
            
            // Show success message
            this.showMessage('Email di recupero inviata! Controlla la tua casella.', 'success');
            
            // Clear input
            emailInput.value = '';
        } catch (error) {
            console.error('Password reset error:', error);
            this.showMessage('Errore durante l\'invio. Riprova.', 'error');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }
    
    // Password strength checker
    checkPasswordStrength(password) {
        const strengthBar = document.querySelector('.password-strength-bar');
        if (!strengthBar) return;
        
        let strength = 0;
        
        // Length
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        
        // Character types
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        
        // Update UI
        strengthBar.className = 'password-strength-bar';
        
        if (strength <= 2) {
            strengthBar.classList.add('weak');
        } else if (strength <= 4) {
            strengthBar.classList.add('medium');
        } else {
            strengthBar.classList.add('strong');
        }
    }
    
    // Password match checker
    checkPasswordMatch() {
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-password-confirm').value;
        const confirmInput = document.getElementById('register-password-confirm');
        
        if (confirm && password !== confirm) {
            confirmInput.setCustomValidity('Le password non corrispondono');
        } else {
            confirmInput.setCustomValidity('');
        }
    }
    
    // Utility functions
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    setLoading(form, isLoading) {
        this.isLoading = isLoading;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = isLoading;
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoader = submitBtn.querySelector('.btn-loader');
            
            if (btnText && btnLoader) {
                btnText.classList.toggle('hidden', isLoading);
                btnLoader.classList.toggle('hidden', !isLoading);
            }
        }
        
        // Disable all inputs
        form.querySelectorAll('input').forEach(input => {
            input.disabled = isLoading;
        });
    }
    
    showMessage(text, type = 'info') {
        const messageEl = document.getElementById('auth-message');
        if (!messageEl) return;
        
        const textEl = messageEl.querySelector('.auth-message-text');
        if (textEl) {
            textEl.textContent = text;
        }
        
        messageEl.className = `auth-message ${type}`;
        messageEl.classList.remove('hidden');
        
        // Auto hide after delay
        setTimeout(() => {
            this.hideMessage();
        }, 5000);
    }
    
    hideMessage() {
        const messageEl = document.getElementById('auth-message');
        if (messageEl) {
            messageEl.classList.add('hidden');
        }
    }
}

// Create global instance - DO NOT call init()
window.authManager = new AuthManager();