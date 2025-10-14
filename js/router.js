// =====================================
// ROUTER - GESTIONE NAVIGAZIONE E CARICAMENTO PAGINE
// =====================================

class Router {
    constructor() {
        this.currentRoute = null;
        this.routes = {
            'auth': {
                section: 'auth-section',
                htmlFile: 'pages/auth.html',
                requiresAuth: false,
                hideHeader: true
            },
            'dashboard': {
                section: 'dashboard-section',
                htmlFile: 'pages/dashboard.html',
                requiresAuth: true,
                hideHeader: false
            },
            'auction-setup': {
                section: 'auction-setup-section',
                htmlFile: 'pages/auction-setup.html',
                requiresAuth: true,
                hideHeader: false
            },
            'auction-live': {
                section: 'auction-live-section',
                htmlFile: 'pages/auction-live.html',
                requiresAuth: true,
                hideHeader: false
            },
            'teams': {
                section: 'teams-section',
                htmlFile: 'pages/teams.html',
                requiresAuth: true,
                hideHeader: false
            }
        };
        
        this.loadedPages = new Set();
        this.init();
    }
    
    init() {
        // Setup navigation event listeners
        this.setupNavigation();
        
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.route) {
                this.loadRoute(e.state.route, false);
            }
        });
        
        // Listen for auth state changes
        window.addEventListener('authStateChanged', (e) => {
            this.handleAuthChange(e.detail);
        });
    }
    
    setupNavigation() {
        // Navigation links
        document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('dashboard');
        });
        
        document.getElementById('nav-auction')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('auction-live');
        });
        
        document.getElementById('nav-teams')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('teams');
        });
        
        // Logo click
        document.querySelector('.logo')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigate('dashboard');
        });
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleLogout();
        });
    }
    
    async navigate(route, pushState = true) {
        // Check if route exists
        if (!this.routes[route]) {
            console.error(`Route ${route} not found`);
            return;
        }
        
        const routeConfig = this.routes[route];
        
        // Check authentication
        if (routeConfig.requiresAuth) {
            const isAuthenticated = await this.checkAuth();
            if (!isAuthenticated) {
                this.navigate('auth');
                return;
            }
        }
        
        // Load and show route
        await this.loadRoute(route, pushState);
    }
    
    async loadRoute(route, pushState = true) {
        const routeConfig = this.routes[route];
        if (!routeConfig) return;
        
        // Hide all sections
        this.hideAllSections();
        
        // Show/hide header
        const header = document.getElementById('main-header');
        if (header) {
            header.style.display = routeConfig.hideHeader ? 'none' : 'block';
        }
        
        // Load HTML content if not already loaded
        const section = document.getElementById(routeConfig.section);
        if (section && !this.loadedPages.has(route)) {
            await this.loadHTMLContent(route, section, routeConfig.htmlFile);
            this.loadedPages.add(route);
        }
        
        // Show the section
        if (section) {
            section.classList.remove('hidden');
        }
        
        // Update current route
        this.currentRoute = route;
        
        // Update browser history
        if (pushState) {
            window.history.pushState({ route }, '', `#${route}`);
        }
        
        // Update active nav
        this.updateActiveNav(route);
        
        // Call route-specific initialization
        this.initializeRoute(route);
    }
    
    async loadHTMLContent(route, section, htmlFile) {
        try {
            // Show loading state
            section.innerHTML = '<div class="loading-container"><div class="loading"></div></div>';
            
            // Fetch HTML content
            const response = await fetch(htmlFile);
            if (!response.ok) {
                throw new Error(`Failed to load ${htmlFile}`);
            }
            
            const html = await response.text();
            
            // Insert content
            section.innerHTML = html;
            
            // Re-initialize event listeners for the loaded content
            this.reinitializeEventListeners(route);
            
        } catch (error) {
            console.error(`Error loading ${route}:`, error);
            section.innerHTML = `
                <div class="error-container">
                    <h2>Errore caricamento pagina</h2>
                    <p>Impossibile caricare la pagina richiesta.</p>
                    <button class="btn btn-primary" onclick="location.reload()">Ricarica</button>
                </div>
            `;
        }
    }
    
    reinitializeEventListeners(route) {
        // Re-initialize specific managers based on route
        switch(route) {
            case 'auth':
                if (window.authManager) {
                    window.authManager.setupEventListeners();
                }
                break;
            case 'dashboard':
                if (window.dashboardManager) {
                    window.dashboardManager.init();
                }
                break;
            case 'auction-setup':
                if (window.auctionSetupManager) {
                    window.auctionSetupManager.init();
                }
                break;
            case 'auction-live':
                if (window.auctionLiveManager) {
                    window.auctionLiveManager.init();
                }
                break;
            case 'teams':
                if (window.teamsManager) {
                    window.teamsManager.init();
                }
                break;
        }
    }
    
    initializeRoute(route) {
        // Call route-specific initialization functions
        switch(route) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'auction-live':
                this.loadAuctionData();
                break;
            case 'teams':
                this.loadTeamsData();
                break;
        }
    }
    
    hideAllSections() {
        // Hide all route sections
        Object.values(this.routes).forEach(route => {
            const section = document.getElementById(route.section);
            if (section) {
                section.classList.add('hidden');
            }
        });
    }
    
    updateActiveNav(route) {
        // Remove all active classes
        document.querySelectorAll('#main-nav a').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to current route
        const navMap = {
            'dashboard': 'nav-dashboard',
            'auction-live': 'nav-auction',
            'teams': 'nav-teams'
        };
        
        const navId = navMap[route];
        if (navId) {
            document.getElementById(navId)?.classList.add('active');
        }
    }
    
    async checkAuth() {
        // Check if user is authenticated
        const session = await supabaseManager.checkSession();
        return !!session;
    }
    
    async handleAuthChange(detail) {
        const { user } = detail;
        
        if (user) {
            // User logged in
            await this.updateUserDisplay(user);
            
            // If on auth page, redirect to dashboard
            if (this.currentRoute === 'auth') {
                this.navigate('dashboard');
            }
        } else {
            // User logged out
            this.navigate('auth');
        }
    }
    
    async updateUserDisplay(user) {
        // Get user profile
        const { data: profile } = await supabaseManager.getProfile(user.id);
        
        // Update username display
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay && profile) {
            usernameDisplay.textContent = profile.username || user.email.split('@')[0];
        }
    }
    
    async handleLogout() {
        if (confirm('Sei sicuro di voler uscire?')) {
            await supabaseManager.signOut();
            // Clear storage
            Utils.storage.clear();
            Utils.session.clear();
            // Navigate to auth
            this.navigate('auth');
        }
    }
    
    // Data loading functions
    async loadDashboardData() {
        if (window.dashboardManager) {
            await window.dashboardManager.loadAuctions();
        }
    }
    
    async loadAuctionData() {
        const auctionId = Utils.storage.get(CONFIG.STORAGE_KEYS.CURRENT_AUCTION);
        if (auctionId && window.auctionLiveManager) {
            await window.auctionLiveManager.loadAuction(auctionId);
        }
    }
    
    async loadTeamsData() {
        const auctionId = Utils.storage.get(CONFIG.STORAGE_KEYS.CURRENT_AUCTION);
        if (auctionId && window.teamsManager) {
            await window.teamsManager.loadTeams(auctionId);
        }
    }
    
    // Initialize on first load
    async start() {
        // Check initial route from URL hash
        const hash = window.location.hash.slice(1);
        const initialRoute = hash || 'auth';
        
        // Check if user is authenticated
        const isAuthenticated = await this.checkAuth();
        
        if (isAuthenticated && initialRoute === 'auth') {
            // User is logged in, go to dashboard
            this.navigate('dashboard');
        } else if (!isAuthenticated && this.routes[initialRoute]?.requiresAuth) {
            // User is not logged in but trying to access protected route
            this.navigate('auth');
        } else {
            // Navigate to initial route
            this.navigate(initialRoute);
        }
    }
}

// Create global router instance
window.router = new Router();