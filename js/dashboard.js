// =====================================
// DASHBOARD MANAGER
// =====================================

class DashboardManager {
    constructor() {
        this.auctions = [];
        this.filteredAuctions = [];
        this.currentFilter = 'all';
        this.currentAuctionForJoin = null;
        this.isLoading = false;
    }
    
    async init() {async loadAuctions() {
    try {
        // Use supabaseManager instead of supabase directly
        const user = supabaseManager.currentUser;
        
        if (!user) {
            console.warn('User not authenticated');
            this.auctions = [];
            this.renderAuctions();
            return;
        }

        console.log('Loading auctions for user:', user.id);

        // Get auctions using the manager's client
        const { data: auctions, error } = await supabaseManager.client
            .from('auctions')
            .select(`
                *,
                teams!inner(
                    id,
                    name,
                    user_id,
                    budget_remaining,
                    is_ready
                ),
                profiles!auctions_created_by_fkey(
                    username
                )
            `)
            .eq('teams.user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading auctions:', error);
            throw error;
        }
        
        console.log('Loaded auctions:', auctions);
        this.auctions = auctions || [];
        this.renderAuctions();
        
    } catch (error) {
        console.error('Error in loadAuctions:', error);
        Utils.toast('Errore nel caricamento delle aste', 'error');
        this.auctions = [];
        this.renderAuctions();
    }
}
        console.log('Initializing Dashboard...');
        this.setupEventListeners();
        await this.loadAuctions();
    }
    
    setupEventListeners() {
        // Create auction button
        const createBtn = document.getElementById('create-auction-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateModal());
        }
        
        // Join auction button
        const joinBtn = document.getElementById('join-auction-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.showJoinModal());
        }
        
        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.filterAuctions(e.target.dataset.filter));
        });
        
        // Create auction form
        const createForm = document.getElementById('create-auction-form');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreateAuction(e));
        }
        
        // Join auction form
        const joinForm = document.getElementById('join-auction-form');
        if (joinForm) {
            joinForm.addEventListener('submit', (e) => this.handleJoinAuction(e));
        }
        
        // Verify code button
        const verifyBtn = document.getElementById('verify-code-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => this.verifyAuctionCode());
        }
        
        // Timer checkbox
        const timerCheckbox = document.getElementById('timer-enabled');
        if (timerCheckbox) {
            timerCheckbox.addEventListener('change', (e) => {
                document.getElementById('timer-seconds').disabled = !e.target.checked;
            });
        }
        
        // Modal close buttons
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
        
        // Join code input - auto uppercase
        const joinCodeInput = document.getElementById('join-code');
        if (joinCodeInput) {
            joinCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    }
    
   // In dashboard.js, around line 15
// In dashboard.js - Replace the loadAuctions method (around line 90)

async loadAuctions() {
    try {
        // Use supabaseManager instead of supabase directly
        const user = supabaseManager.currentUser;
        
        if (!user) {
            console.warn('User not authenticated');
            this.auctions = [];
            this.renderAuctions();
            return;
        }

        console.log('Loading auctions for user:', user.id);

        // Get auctions using the manager's client
        const { data: auctions, error } = await supabaseManager.client
            .from('auctions')
            .select(`
                *,
                teams!inner(
                    id,
                    name,
                    user_id,
                    budget_remaining,
                    is_ready
                ),
                profiles!auctions_created_by_fkey(
                    username
                )
            `)
            .eq('teams.user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading auctions:', error);
            throw error;
        }
        
        console.log('Loaded auctions:', auctions);
        this.auctions = auctions || [];
        this.renderAuctions();
        
    } catch (error) {
        console.error('Error in loadAuctions:', error);
        Utils.toast('Errore nel caricamento delle aste', 'error');
        this.auctions = [];
        this.renderAuctions();
    }
}
    
    updateStats() {
        const stats = {
            total: this.auctions.length,
            active: this.auctions.filter(a => a.status === 'active').length,
            completed: this.auctions.filter(a => a.status === 'completed').length,
            teams: this.auctions.reduce((sum, a) => sum + (a.teams?.length || 0), 0)
        };
        
        // Update UI
        document.getElementById('total-auctions').textContent = stats.total;
        document.getElementById('active-auctions').textContent = stats.active;
        document.getElementById('completed-auctions').textContent = stats.completed;
        document.getElementById('total-teams').textContent = stats.teams;
    }
    
    filterAuctions(filter) {
        this.currentFilter = filter;
        
        // Update tab active state
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });
        
        // Filter auctions
        if (filter === 'all') {
            this.filteredAuctions = this.auctions;
        } else {
            this.filteredAuctions = this.auctions.filter(a => a.status === filter);
        }
        
        // Render
        this.renderAuctions();
    }
    
    renderAuctions() {
        const container = document.getElementById('auction-cards-container');
        const loadingEl = document.getElementById('auctions-loading');
        const emptyEl = document.getElementById('auctions-empty');
        
        if (!container) return;
        
        // Hide loading
        if (loadingEl) loadingEl.classList.add('hidden');
        
        // Check if empty
        if (this.filteredAuctions.length === 0) {
            container.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }
        
        // Hide empty state
        if (emptyEl) emptyEl.classList.add('hidden');
        
        // Render cards
        container.innerHTML = this.filteredAuctions.map(auction => this.createAuctionCard(auction)).join('');
        
        // Add event listeners to cards
        this.attachCardEventListeners();
    }
    
    createAuctionCard(auction) {
        const isCreator = auction.created_by === supabaseManager.currentUser?.id;
        const myTeam = auction.teams?.find(t => t.user_id === supabaseManager.currentUser?.id);
        const participantsCount = auction.teams?.length || 0;
        const maxParticipants = auction.num_partecipanti || 8;
        
        // Status color and text
        const statusConfig = {
            setup: { text: 'In Preparazione', class: 'setup' },
            active: { text: 'In Corso', class: 'active' },
            paused: { text: 'In Pausa', class: 'paused' },
            completed: { text: 'Completata', class: 'completed' }
        };
        
        const status = statusConfig[auction.status] || statusConfig.setup;
        
        return `
            <div class="auction-card" data-auction-id="${auction.id}">
                <div class="auction-card-header">
                    <div class="auction-card-title">
                        <h3>${auction.name}</h3>
                        <div class="auction-code">
                            <span>Codice: ${auction.code}</span>
                            <button class="copy-code-btn" onclick="dashboardManager.copyCode('${auction.code}')">
                                📋
                            </button>
                        </div>
                    </div>
                    <span class="auction-status ${status.class}">${status.text}</span>
                </div>
                
                <div class="auction-card-info">
                    <div class="auction-info-item">
                        <span class="auction-info-icon">💰</span>
                        <span class="auction-info-text">
                            Budget: <span class="auction-info-value">${auction.budget}</span>
                        </span>
                    </div>
                    <div class="auction-info-item">
                        <span class="auction-info-icon">👥</span>
                        <span class="auction-info-text">
                            <span class="auction-info-value">${participantsCount}/${maxParticipants}</span> partecipanti
                        </span>
                    </div>
                    <div class="auction-info-item">
                        <span class="auction-info-icon">🎯</span>
                        <span class="auction-info-text">
                            Tipo: <span class="auction-info-value">${this.getAuctionTypeLabel(auction.auction_type)}</span>
                        </span>
                    </div>
                    <div class="auction-info-item">
                        <span class="auction-info-icon">⚡</span>
                        <span class="auction-info-text">
                            ${auction.timer_enabled ? `Timer: ${auction.timer_seconds}s` : 'No timer'}
                        </span>
                    </div>
                </div>
                
                <div class="auction-participants">
                    <div class="auction-participants-label">Partecipanti</div>
                    <div class="participants-avatars">
                        ${this.renderParticipantAvatars(auction.teams)}
                    </div>
                </div>
                
                <div class="auction-card-footer">
                    ${this.renderAuctionActions(auction, isCreator, myTeam)}
                </div>
            </div>
        `;
    }
    
    renderParticipantAvatars(teams) {
        if (!teams || teams.length === 0) {
            return '<span class="text-muted">Nessun partecipante</span>';
        }
        
        const maxVisible = 6;
        const visibleTeams = teams.slice(0, maxVisible);
        const remaining = teams.length - maxVisible;
        
        let html = visibleTeams.map(team => {
            const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            return `<div class="participant-avatar" title="${team.name}">${initials}</div>`;
        }).join('');
        
        if (remaining > 0) {
            html += `<div class="participant-avatar more">+${remaining}</div>`;
        }
        
        return html;
    }
    
    renderAuctionActions(auction, isCreator, myTeam) {
        if (auction.status === 'completed') {
            return `
                <button class="auction-action-btn secondary" onclick="dashboardManager.viewResults('${auction.id}')">
                    Visualizza Risultati
                </button>
            `;
        }
        
        if (auction.status === 'active') {
            return `
                <button class="auction-action-btn" onclick="dashboardManager.enterAuction('${auction.id}')">
                    Entra nell'Asta
                </button>
            `;
        }
        
        if (isCreator) {
            return `
                <button class="auction-action-btn" onclick="dashboardManager.manageAuction('${auction.id}')">
                    Gestisci
                </button>
                <button class="auction-action-btn secondary" onclick="dashboardManager.startAuction('${auction.id}')">
                    Avvia Asta
                </button>
            `;
        }
        
        if (myTeam) {
            return `
                <button class="auction-action-btn secondary" onclick="dashboardManager.viewTeam('${auction.id}')">
                    Il Mio Team
                </button>
            `;
        }
        
        return `
            <button class="auction-action-btn secondary" onclick="dashboardManager.viewDetails('${auction.id}')">
                Dettagli
            </button>
        `;
    }
    
    getAuctionTypeLabel(type) {
        const labels = {
            'turn': 'A Turno',
            'alphabetic': 'Alfabetico',
            'random': 'Random'
        };
        return labels[type] || type;
    }
    
    attachCardEventListeners() {
        // Add click listeners for cards
        document.querySelectorAll('.auction-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on button
                if (e.target.closest('button')) return;
                const auctionId = card.dataset.auctionId;
                this.viewDetails(auctionId);
            });
        });
    }
    
    // Modal Functions
    showCreateModal() {
        const modal = document.getElementById('create-auction-modal');
        if (modal) {
            modal.classList.remove('hidden');
            // Reset form
            document.getElementById('create-auction-form').reset();
        }
    }
    
    showJoinModal() {
        const modal = document.getElementById('join-auction-modal');
        if (modal) {
            modal.classList.remove('hidden');
            // Reset form
            document.getElementById('join-auction-form').reset();
            // Reset UI
            document.getElementById('auction-preview').classList.add('hidden');
            document.getElementById('team-name-input').classList.add('hidden');
            document.getElementById('verify-code-btn').classList.remove('hidden');
            document.getElementById('confirm-join-btn').classList.add('hidden');
        }
    }
    
    // Create Auction
    async handleCreateAuction(e) {
        e.preventDefault();
        if (this.isLoading) return;
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Get form data
        const auctionData = {
            name: document.getElementById('auction-name').value.trim(),
            budget: parseInt(document.getElementById('auction-budget').value),
            num_partecipanti: parseInt(document.getElementById('auction-participants').value),
            max_portieri: parseInt(document.getElementById('max-portieri').value),
            max_difensori: parseInt(document.getElementById('max-difensori').value),
            max_centrocampisti: parseInt(document.getElementById('max-centrocampisti').value),
            max_attaccanti: parseInt(document.getElementById('max-attaccanti').value),
            auction_type: document.getElementById('auction-type').value,
            bid_mode: document.getElementById('bid-mode').value,
            starting_price_type: document.getElementById('starting-price').value,
            timer_enabled: document.getElementById('timer-enabled').checked,
            timer_seconds: document.getElementById('timer-enabled').checked ? 
                parseInt(document.getElementById('timer-seconds').value) : null
        };
        
        // Validate total roster size
        const totalPlayers = auctionData.max_portieri + auctionData.max_difensori + 
                           auctionData.max_centrocampisti + auctionData.max_attaccanti;
        
        if (totalPlayers < 11) {
            Utils.toast('La rosa deve avere almeno 11 giocatori', 'error');
            return;
        }
        
        // Start loading
        this.setButtonLoading(submitBtn, true);
        
        try {
            const result = await supabaseManager.createAuction(auctionData);
            
            if (result.success) {
                Utils.toast('Asta creata con successo!', 'success');
                
                // Close modal
                document.getElementById('create-auction-modal').classList.add('hidden');
                
                // Reload auctions
                await this.loadAuctions();
                
                // Store auction ID for navigation
                Utils.storage.set(CONFIG.STORAGE_KEYS.CURRENT_AUCTION, result.data.id);
                
                // Show message to join auction with code
                Utils.toast(`Usa il codice ${result.data.code} per unirti all'asta`, 'info', 5000);
                
                // Navigate to auction setup after delay
                setTimeout(() => {
                    window.router.navigate('auction-setup');
                }, 2000);
            } else {
                Utils.toast(result.error || 'Errore nella creazione dell\'asta', 'error');
            }
        } catch (error) {
            console.error('Create auction error:', error);
            Utils.toast('Errore nella creazione dell\'asta', 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }
    
    // Join Auction
    async verifyAuctionCode() {
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        
        if (!code || code.length !== 6) {
            Utils.toast('Inserisci un codice valido di 6 caratteri', 'error');
            return;
        }
        
        const button = document.getElementById('verify-code-btn');
        button.disabled = true;
        button.textContent = 'Verifica...';
        
        try {
            const result = await supabaseManager.getAuctionByCode(code);
            
            if (result.success && result.data) {
                this.currentAuctionForJoin = result.data;
                
                // Check if already in auction
                const myTeam = result.data.teams?.find(t => t.user_id === supabaseManager.currentUser?.id);
                if (myTeam) {
                    Utils.toast('Sei già in questa asta!', 'warning');
                    button.disabled = false;
                    button.textContent = 'Verifica Codice';
                    return;
                }
                
                // Check if auction is full
                if (result.data.teams?.length >= result.data.num_partecipanti) {
                    Utils.toast('Questa asta è piena', 'error');
                    button.disabled = false;
                    button.textContent = 'Verifica Codice';
                    return;
                }
                
                // Show auction preview
                this.showAuctionPreview(result.data);
            } else {
                Utils.toast('Codice asta non trovato', 'error');
            }
        } catch (error) {
            console.error('Verify code error:', error);
            Utils.toast('Errore nella verifica del codice', 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Verifica Codice';
        }
    }
    
    showAuctionPreview(auction) {
        // Update preview
        document.getElementById('preview-name').textContent = auction.name;
        document.getElementById('preview-creator').textContent = 
            auction.created_by_profile?.username || 'Sconosciuto';
        document.getElementById('preview-participants').textContent = 
            `${auction.teams?.length || 0}/${auction.num_partecipanti}`;
        document.getElementById('preview-budget').textContent = `${auction.budget} €`;
        
        // Show preview and team name input
        document.getElementById('auction-preview').classList.remove('hidden');
        document.getElementById('team-name-input').classList.remove('hidden');
        document.getElementById('join-team-name').disabled = false;
        
        // Switch buttons
        document.getElementById('verify-code-btn').classList.add('hidden');
        document.getElementById('confirm-join-btn').classList.remove('hidden');
    }
    
    async handleJoinAuction(e) {
        e.preventDefault();
        if (!this.currentAuctionForJoin || this.isLoading) return;
        
        const teamName = document.getElementById('join-team-name').value.trim();
        if (!teamName) {
            Utils.toast('Inserisci il nome del tuo team', 'error');
            return;
        }
        
        const submitBtn = document.getElementById('confirm-join-btn');
        this.setButtonLoading(submitBtn, true);
        
        try {
            const result = await supabaseManager.joinAuction(
                this.currentAuctionForJoin.id,
                teamName
            );
            
            if (result.success) {
                Utils.toast('Sei entrato nell\'asta!', 'success');
                
                // Close modal
                document.getElementById('join-auction-modal').classList.add('hidden');
                
                // Store auction ID
                Utils.storage.set(CONFIG.STORAGE_KEYS.CURRENT_AUCTION, this.currentAuctionForJoin.id);
                
                // Reload auctions
                await this.loadAuctions();
                
                // Navigate to auction
                setTimeout(() => {
                    window.router.navigate('auction-setup');
                }, 500);
            } else {
                Utils.toast(result.error || 'Errore nell\'unirsi all\'asta', 'error');
            }
        } catch (error) {
            console.error('Join auction error:', error);
            Utils.toast('Errore nell\'unirsi all\'asta', 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
            this.currentAuctionForJoin = null;
        }
    }
    
    // Action Functions
    copyCode(code) {
        Utils.copyToClipboard(code);
    }
    
    enterAuction(auctionId) {
        Utils.storage.set(CONFIG.STORAGE_KEYS.CURRENT_AUCTION, auctionId);
        window.router.navigate('auction-live');
    }
    
    manageAuction(auctionId) {
        Utils.storage.set(CONFIG.STORAGE_KEYS.CURRENT_AUCTION, auctionId);
        window.router.navigate('auction-setup');
    }
    
    async startAuction(auctionId) {
        if (confirm('Sei sicuro di voler avviare l\'asta? Una volta avviata non potrai più modificare le impostazioni.')) {
            try {
                const result = await supabaseManager.updateAuctionStatus(auctionId, 'active');
                if (result.success) {
                    Utils.toast('Asta avviata!', 'success');
                    await this.loadAuctions();
                    this.enterAuction(auctionId);
                }
            } catch (error) {
                Utils.toast('Errore nell\'avvio dell\'asta', 'error');
            }
        }
    }
    
    viewTeam(auctionId) {
        Utils.storage.set(CONFIG.STORAGE_KEYS.CURRENT_AUCTION, auctionId);
        window.router.navigate('teams');
    }
    
    viewDetails(auctionId) {
        Utils.storage.set(CONFIG.STORAGE_KEYS.CURRENT_AUCTION, auctionId);
        window.router.navigate('auction-setup');
    }
    
    viewResults(auctionId) {
        Utils.storage.set(CONFIG.STORAGE_KEYS.CURRENT_AUCTION, auctionId);
        window.router.navigate('teams');
    }
    
    // Helper Functions
    showLoadingState() {
        const loadingEl = document.getElementById('auctions-loading');
        const emptyEl = document.getElementById('auctions-empty');
        const container = document.getElementById('auction-cards-container');
        
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (emptyEl) emptyEl.classList.add('hidden');
        if (container) container.innerHTML = '';
    }
    
    showEmptyState() {
        const loadingEl = document.getElementById('auctions-loading');
        const emptyEl = document.getElementById('auctions-empty');
        const container = document.getElementById('auction-cards-container');
        
        if (loadingEl) loadingEl.classList.add('hidden');
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (container) container.innerHTML = '';
    }
    
    setButtonLoading(button, isLoading) {
        if (!button) return;
        
        button.disabled = isLoading;
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (btnText && btnLoader) {
            btnText.classList.toggle('hidden', isLoading);
            btnLoader.classList.toggle('hidden', !isLoading);
        }
    }
}

// Create global instance
window.dashboardManager = new DashboardManager();
