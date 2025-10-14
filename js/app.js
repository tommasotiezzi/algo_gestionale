// =====================================
// APP INITIALIZATION
// =====================================

class App {
    constructor() {
        this.initialized = false;
        this.managers = {};
    }
    
    async init() {
        if (this.initialized) return;
        
        console.log('🚀 Initializing Fantasta App...');
        
        try {
            // Show loading state
            this.showInitialLoading();
            
            // Check configuration
            if (!this.checkConfig()) {
                throw new Error('Configuration missing. Please check config.js');
            }
            
            // Initialize managers (they're already created as global instances)
            this.managers = {
                supabase: window.supabaseManager,
                router: window.router,
                auth: window.authManager
            };
            
            // Setup global error handler
            this.setupErrorHandler();
            
            // Setup service worker (if needed for offline support)
            if (CONFIG.FEATURES.ENABLE_OFFLINE_MODE) {
                this.registerServiceWorker();
            }
            
            // Initialize router and start navigation
            await this.startRouter();
            
            // Hide loading
            this.hideInitialLoading();
            
            this.initialized = true;
            console.log('✅ App initialized successfully');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.showInitError(error);
        }
    }
    
    checkConfig() {
        // Check if required configuration is present
        if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
            console.error('Supabase URL not configured');
            return false;
        }
        
        if (!CONFIG.SUPABASE_ANON_KEY || CONFIG.SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
            console.error('Supabase Anon Key not configured');
            return false;
        }
        
        return true;
    }
    
    setupErrorHandler() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            
            if (CONFIG.DEBUG) {
                Utils.toast(`Errore: ${event.error.message}`, 'error');
            }
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            
            if (CONFIG.DEBUG) {
                Utils.toast(`Errore: ${event.reason}`, 'error');
            }
        });
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    async startRouter() {
        if (window.router) {
            await window.router.start();
        }
    }
    
    showInitialLoading() {
        // Create loading overlay if doesn't exist
        if (!document.getElementById('app-loading')) {
            const loading = document.createElement('div');
            loading.id = 'app-loading';
            loading.innerHTML = `
                <style>
                    #app-loading {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(135deg, #101828 0%, #141b2b 50%, #172130 100%);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                    }
                    #app-loading .logo-loader {
                        font-size: 4rem;
                        margin-bottom: 2rem;
                        animation: bounce 2s infinite;
                    }
                    #app-loading h1 {
                        font-family: 'Anton', sans-serif;
                        color: white;
                        font-size: 3rem;
                        margin-bottom: 1rem;
                    }
                    #app-loading .spinner {
                        width: 40px;
                        height: 40px;
                        border: 4px solid rgba(255, 255, 255, 0.3);
                        border-top-color: white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes bounce {
                        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                        40% { transform: translateY(-20px); }
                        60% { transform: translateY(-10px); }
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
                <div class="logo-loader">⚽</div>
                <h1>FANTASTA</h1>
                <div class="spinner"></div>
            `;
            document.body.appendChild(loading);
        }
    }
    
    hideInitialLoading() {
        const loading = document.getElementById('app-loading');
        if (loading) {
            loading.style.opacity = '0';
            loading.style.transition = 'opacity 0.3s ease';
            setTimeout(() => loading.remove(), 300);
        }
    }
    
    showInitError(error) {
        const container = document.getElementById('app-container');
        if (container) {
            container.innerHTML = `
                <div class="error-page">
                    <style>
                        .error-page {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            padding: 2rem;
                            text-align: center;
                            color: white;
                        }
                        .error-page h1 {
                            font-size: 3rem;
                            margin-bottom: 1rem;
                            color: #ef4444;
                        }
                        .error-page p {
                            font-size: 1.25rem;
                            margin-bottom: 2rem;
                            color: rgba(255, 255, 255, 0.8);
                        }
                        .error-page .error-details {
                            background: rgba(255, 255, 255, 0.1);
                            padding: 1rem;
                            border-radius: 0.5rem;
                            margin-bottom: 2rem;
                            max-width: 600px;
                            font-family: monospace;
                            font-size: 0.875rem;
                            color: rgba(255, 255, 255, 0.7);
                        }
                        .error-page button {
                            padding: 0.75rem 2rem;
                            background: #101828;
                            color: white;
                            border: 2px solid #101828;
                            border-radius: 0.5rem;
                            font-size: 1rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        }
                        .error-page button:hover {
                            background: #0f1419;
                            border-color: #0f1419;
                            transform: translateY(-2px);
                        }
                    </style>
                    <h1>⚠️ Errore di Inizializzazione</h1>
                    <p>Impossibile avviare l'applicazione</p>
                    <div class="error-details">${error.message}</div>
                    <button onclick="location.reload()">Riprova</button>
                </div>
            `;
        }
    }
}

// Create and start app when DOM is ready
const app = new App();

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}