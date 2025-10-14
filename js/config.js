// =====================================
// CONFIGURAZIONE GLOBALE
// =====================================

const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://cufjozdxraumhotnkclu.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZmpvemR4cmF1bWhvdG5rY2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0Mjg0ODQsImV4cCI6MjA3NjAwNDQ4NH0.mdmDsxDGoFVO1taoHX07gfMQ7CiYvInmFZ6VvvNjT5w',
    
    // App Settings
    APP_NAME: 'Fantasta',
    APP_VERSION: '1.0.0',
    
    // Auction Settings Defaults
    AUCTION_DEFAULTS: {
        budget: 500,
        numPartecipanti: 8,
        maxPortieri: 3,
        maxDifensori: 8,
        maxCentrocampisti: 8,
        maxAttaccanti: 6,
        auctionType: 'turn',
        bidMode: 'free',
        startingPriceType: '1',
        timerEnabled: false,
        timerSeconds: 10
    },
    
    // Role Colors (matching CSS variables)
    ROLE_COLORS: {
        P: '#FFD700',
        D: '#4CAF50',
        C: '#03A9F4',
        A: '#F44336'
    },
    
    // Role Names
    ROLE_NAMES: {
        P: 'Portiere',
        D: 'Difensore',
        C: 'Centrocampista',
        A: 'Attaccante'
    },
    
    // Allowed participant counts
    ALLOWED_PARTICIPANTS: [8, 10, 12],
    
    // Timer settings
    TIMER_OPTIONS: [5, 10, 15, 20, 30, 60],
    
    // Pagination
    PLAYERS_PER_PAGE: 50,
    
    // Realtime subscriptions
    REALTIME_CHANNELS: {
        AUCTION: 'auction-updates',
        BIDS: 'bid-updates',
        TEAMS: 'team-updates'
    },
    
    // Local storage keys
    STORAGE_KEYS: {
        AUTH_TOKEN: 'fantasta_auth_token',
        CURRENT_AUCTION: 'fantasta_current_auction',
        USER_PREFERENCES: 'fantasta_user_prefs',
        PLAYERS_CACHE: 'fantasta_players_cache'
    },
    
    // API Endpoints (custom if needed)
    API_ENDPOINTS: {
        PLAYERS_IMPORT: '/api/players/import',
        AUCTION_EXPORT: '/api/auction/export'
    },
    
    // Cache settings (in milliseconds)
    CACHE_DURATION: {
        PLAYERS: 60 * 60 * 1000, // 1 hour
        AUCTION: 5 * 60 * 1000,   // 5 minutes
        TEAMS: 5 * 60 * 1000      // 5 minutes
    },
    
    // Validation rules
    VALIDATION: {
        USERNAME_MIN: 3,
        USERNAME_MAX: 20,
        TEAM_NAME_MIN: 3,
        TEAM_NAME_MAX: 30,
        PASSWORD_MIN: 6,
        AUCTION_CODE_LENGTH: 6,
        MIN_BID_INCREMENT: 1
    },
    
    // UI Settings
    UI: {
        ANIMATION_DURATION: 250,
        TOAST_DURATION: 3000,
        MODAL_BACKDROP_OPACITY: 0.5,
        DEBOUNCE_DELAY: 300,
        SCROLL_OFFSET: 80 // Header height
    },
    
    // Error Messages
    ERRORS: {
        GENERIC: 'Si è verificato un errore. Riprova più tardi.',
        NETWORK: 'Errore di connessione. Controlla la tua connessione internet.',
        AUTH_REQUIRED: 'Devi effettuare il login per continuare.',
        AUCTION_NOT_FOUND: 'Asta non trovata.',
        INVALID_CODE: 'Codice asta non valido.',
        INSUFFICIENT_BUDGET: 'Budget insufficiente per questa offerta.',
        NOT_YOUR_TURN: 'Non è il tuo turno per fare un\'offerta.',
        PLAYER_ALREADY_BOUGHT: 'Giocatore già acquistato.',
        ROSTER_FULL: 'Hai raggiunto il limite per questo ruolo.'
    },
    
    // Success Messages
    SUCCESS: {
        LOGIN: 'Login effettuato con successo!',
        REGISTER: 'Registrazione completata!',
        AUCTION_CREATED: 'Asta creata con successo!',
        AUCTION_JOINED: 'Sei entrato nell\'asta!',
        BID_PLACED: 'Offerta piazzata!',
        PLAYER_WON: 'Hai vinto il giocatore!',
        SETTINGS_SAVED: 'Impostazioni salvate!',
        ROSTER_EXPORTED: 'Rosa esportata con successo!'
    },
    
    // Debug mode
    DEBUG: true,
    
    // Feature flags
    FEATURES: {
        ENABLE_CHAT: false,
        ENABLE_VOICE: false,
        ENABLE_NOTIFICATIONS: true,
        ENABLE_OFFLINE_MODE: false,
        ENABLE_PLAYER_STATS: true,
        ENABLE_TRADE: false
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}