// =====================================
// AUCTION SETUP MANAGER
// =====================================

class AuctionSetupManager {
    constructor() {
        this.auctionId = null;
        this.auction = null;
        this.teams = [];
        this.currentUserId = null;
        this.myTeam = null;
        this.isCreator = false;
        this.refreshInterval = null;
        this.realtimeChannel = null;
    }
    
    async init() {
        console.log('Initializing Auction Setup...');
        
        // Get auction ID from storage
        this.auctionId = Utils.storage.get(CONFIG.STORAGE_KEYS.CURRENT_AUCTION);
        if (!this.auctionId) {
            Utils.toast('Nessuna asta selezionata', 'error');
            window.router.navigate('dashboard');
            return;
        }
        
        // Get current user
        this.currentUserId = supabaseManager.currentUser?.id;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load auction data
        await this.loadAuction();
        
        // Setup realtime subscription
        this.setupRealtimeSubscription();
        
        // Start refresh interval
        this.startRefreshInterval();
    }
    
    setupEventListeners() {
        // Start auction button
        const startBtn = document.getElementById('start-auction-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startAuction());
        }
        
        // Edit settings button
        const editBtn = document.getElementById('edit-settings-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.showEditSettingsModal());
        }
        
        // Edit settings form
        const editForm = document.getElementById('edit-settings-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditSettings(e));
        }
        
        // Ready toggle
        const readyToggle = document.getElementById('my-ready-status');
        if (readyToggle) {
            readyToggle.addEventListener('change', (e) => this.toggleReady(e.target.checked));
        }
        
        // Timer toggle in edit modal
        const timerToggle = document.getElementById('edit-timer-enabled');
        if (timerToggle) {
            timerToggle.addEventListener('change', (e) => {
                document.getElementById('edit-timer-seconds').disabled = !e.target.checked;
            });
        }
        
        // Modal close
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
    }
    
    async loadAuction() {
        try {
            const result = await supabaseManager.getAuction(this.auctionId);
            
            if (!result.success || !result.data) {
                throw new Error('Asta non trovata');
            }
            
            this.auction = result.data;
            this.teams = result.data.teams || [];
            this.isCreator = this.auction.created_by === this.currentUserId;
            this.myTeam = this.teams.find(t => t.user_id === this.currentUserId);
            
            // Update UI
            this.updateUI();
            
        } catch (error) {
            console.error('Error loading auction:', error);
            Utils.toast('Errore nel caricamento dell\'asta', 'error');
            window.router.navigate('dashboard');
        }
    }
    
    updateUI() {
        // Update header
        document.getElementById('setup-auction-name').textContent = this.auction.name;
        document.getElementById('setup-auction-code').textContent = this.auction.code;
        document.getElementById('invite-code').textContent = this.auction.code;
        
        // Update settings
        this.updateSettingsDisplay();
        
        // Update participants
        this.updateParticipantsDisplay();
        
        // Update progress
        this.updateProgress();
        
        // Update ready status
        this.updateReadyStatus();
        
        // Update start button
        this.updateStartButton();
        
        // Show/hide edit button for creator
        const editBtn = document.getElementById('edit-settings-btn');
        if (editBtn) {
            editBtn.style.display = this.isCreator ? 'block' : 'none';
        }
    }
    
    updateSettingsDisplay() {
        // Basic settings
        document.getElementById('setting-budget').textContent = `${this.auction.budget} €`;
        document.getElementById('setting-participants').textContent = 
            `${this.teams.length}/${this.auction.num_partecipanti}`;
        
        // Auction type labels
        const typeLabels = {
            'turn': 'Chiamata a Turno',
            'alphabetic': 'Ordine Alfabetico',
            'random': 'Chiamata Random'
        };
        document.getElementById('setting-type').textContent = 
            typeLabels[this.auction.auction_type] || this.auction.auction_type;
        
        // Bid mode
        const bidLabels = {
            'free': 'Rilanci Liberi',
            'fixed_turns': 'Turni Fissi'
        };
        document.getElementById('setting-bid-mode').textContent = 
            bidLabels[this.auction.bid_mode] || this.auction.bid_mode;
        
        // Starting price
        const priceLabels = {
            '1': 'Sempre 1€',
            'qt_a': 'Quotazione'
        };
        document.getElementById('setting-start-price').textContent = 
            priceLabels[this.auction.starting_price_type] || this.auction.starting_price_type;
        
        // Timer
        document.getElementById('setting-timer').textContent = 
            this.auction.timer_enabled ? `${this.auction.timer_seconds}s` : 'Disabilitato';
        
        // Roster composition
        document.getElementById('roster-p').textContent = `Max ${this.auction.max_portieri}`;
        document.getElementById('roster-d').textContent = `Max ${this.auction.max_difensori}`;
        document.getElementById('roster-c').textContent = `Max ${this.auction.max_centrocampisti}`;
        document.getElementById('roster-a').textContent = `Max ${this.auction.max_attaccanti}`;
    }
    
    updateParticipantsDisplay() {
        const container = document.getElementById('participants-list');
        if (!container) return;
        
        // Update count
        document.getElementById('participants-count').textContent = this.teams.length;
        document.getElementById('participants-max').textContent = this.auction.num_partecipanti;
        
        if (this.teams.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Nessun partecipante ancora</p>
                </div>
            `;
            return;
        }
        
        // Sort teams by creator first, then by name
        const sortedTeams = [...this.teams].sort((a, b) => {
            if (a.user_id === this.auction.created_by) return -1;
            if (b.user_id === this.auction.created_by) return 1;
            return a.name.localeCompare(b.name);
        });
        
        container.innerHTML = sortedTeams.map(team => this.createParticipantItem(team)).join('');
    }
    
    createParticipantItem(team) {
        const isCreator = team.user_id === this.auction.created_by;
        const isMe = team.user_id === this.currentUserId;
        const profile = team.profile || {};
        const username = profile.username || 'Utente';
        const initials = username.substring(0, 2).toUpperCase();
        
        return `
            <div class="participant-item ${isMe ? 'is-me' : ''}">
                <div class="participant-info">
                    <div class="participant-avatar">${initials}</div>
                    <div class="participant-details">
                        <div class="participant-name">
                            ${username} ${isMe ? '(Tu)' : ''}
                        </div>
                        <div class="participant-team">${team.name}</div>
                    </div>
                </div>
                <div class="participant-status">
                    ${isCreator ? '<span class="status-badge creator">Admin</span>' : ''}
                    <span class="status-badge ${team.is_ready ? 'ready' : 'not-ready'}">
                        ${team.is_ready ? 'Pronto' : 'Non pronto'}
                    </span>
                </div>
            </div>
        `;
    }
    
    updateProgress() {
        const participantsStep = document.getElementById('progress-participants');
        const readyStep = document.getElementById('progress-ready');
        
        // Check participants
        const hasEnoughParticipants = this.teams.length >= 2;
        if (participantsStep) {
            participantsStep.classList.toggle('completed', hasEnoughParticipants);
            participantsStep.classList.toggle('active', 
                !hasEnoughParticipants && this.teams.length > 0);
        }
        
        // Check ready status
        const allReady = this.teams.length > 0 && 
                        this.teams.every(t => t.is_ready);
        if (readyStep) {
            readyStep.classList.toggle('completed', allReady);
            readyStep.classList.toggle('active', 
                hasEnoughParticipants && !allReady);
        }
    }
    
    updateReadyStatus() {
        const readyCount = this.teams.filter(t => t.is_ready).length;
        const totalCount = this.teams.length;
        const percentage = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;
        
        // Update progress bar
        const readyBar = document.getElementById('ready-bar');
        if (readyBar) {
            readyBar.style.width = `${percentage}%`;
        }
        
        // Update text
        document.getElementById('ready-count').textContent = readyCount;
        document.getElementById('ready-total').textContent = totalCount;
        
        // Update my toggle
        if (this.myTeam) {
            const toggle = document.getElementById('my-ready-status');
            if (toggle) {
                toggle.checked = this.myTeam.is_ready;
            }
        }
    }
    
    updateStartButton() {
        const btn = document.getElementById('start-auction-btn');
        if (!btn) return;
        
        // Only creator can start
        if (!this.isCreator) {
            btn.style.display = 'none';
            return;
        }
        
        // Check conditions
        const hasEnoughParticipants = this.teams.length >= 2;
        const allReady = this.teams.length > 0 && 
                        this.teams.every(t => t.is_ready);
        
        btn.disabled = !hasEnoughParticipants || !allReady;
        
        if (!hasEnoughParticipants) {
            btn.innerHTML = '<span>⏳</span><span>Attendi partecipanti</span>';
        } else if (!allReady) {
            btn.innerHTML = '<span>⏳</span><span>Attendi pronti</span>';
        } else {
            btn.innerHTML = '<span>🚀</span><span>Avvia Asta</span>';
        }
    }
    
    async toggleReady(isReady) {
        if (!this.myTeam) return;
        
        try {
            const { error } = await supabaseManager.client
                .from('teams')
                .update({ is_ready: isReady })
                .eq('id', this.myTeam.id);
            
            if (error) throw error;
            
            // Update local state
            this.myTeam.is_ready = isReady;
            
            // Reload to get fresh data
            await this.loadAuction();
            
            Utils.toast(isReady ? 'Sei pronto!' : 'Non sei più pronto', 'success');
            
        } catch (error) {
            console.error('Error toggling ready:', error);
            Utils.toast('Errore nell\'aggiornamento dello stato', 'error');
            
            // Revert toggle
            const toggle = document.getElementById('my-ready-status');
            if (toggle) toggle.checked = !isReady;
        }
    }
    
    async startAuction() {
        if (!this.isCreator) return;
        
        const confirmed = confirm(
            'Sei sicuro di voler avviare l\'asta?\n' +
            'Una volta avviata, non potrai più modificare le impostazioni.'
        );
        
        if (!confirmed) return;
        
        try {
            const result = await supabaseManager.updateAuctionStatus(this.auctionId, 'active');
            
            if (result.success) {
                Utils.toast('Asta avviata con successo!', 'success');
                
                // Navigate to live auction
                setTimeout(() => {
                    window.router.navigate('auction-live');
                }, 500);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error starting auction:', error);
            Utils.toast('Errore nell\'avvio dell\'asta', 'error');
        }
    }
    
    showEditSettingsModal() {
        if (!this.isCreator) return;
        
        // Populate current values
        document.getElementById('edit-budget').value = this.auction.budget;
        document.getElementById('edit-timer-enabled').checked = this.auction.timer_enabled;
        document.getElementById('edit-timer-seconds').value = this.auction.timer_seconds || 10;
        document.getElementById('edit-timer-seconds').disabled = !this.auction.timer_enabled;
        
        // Show modal
        document.getElementById('edit-settings-modal').classList.remove('hidden');
    }
    
    async handleEditSettings(e) {
        e.preventDefault();
        
        const updates = {
            budget: parseInt(document.getElementById('edit-budget').value),
            timer_enabled: document.getElementById('edit-timer-enabled').checked,
            timer_seconds: document.getElementById('edit-timer-enabled').checked ?
                parseInt(document.getElementById('edit-timer-seconds').value) : null
        };
        
        try {
            const { error } = await supabaseManager.client
                .from('auctions')
                .update(updates)
                .eq('id', this.auctionId);
            
            if (error) throw error;
            
            // Update all teams' budgets if budget changed
            if (updates.budget !== this.auction.budget) {
                const { error: teamsError } = await supabaseManager.client
                    .from('teams')
                    .update({ budget_remaining: updates.budget })
                    .eq('auction_id', this.auctionId);
                
                if (teamsError) throw teamsError;
            }
            
            // Close modal
            document.getElementById('edit-settings-modal').classList.add('hidden');
            
            // Reload auction
            await this.loadAuction();
            
            Utils.toast('Impostazioni aggiornate', 'success');
            
        } catch (error) {
            console.error('Error updating settings:', error);
            Utils.toast('Errore nell\'aggiornamento', 'error');
        }
    }
    
    copyCode() {
        Utils.copyToClipboard(this.auction.code);
    }
    
    shareCode() {
        if (navigator.share) {
            navigator.share({
                title: 'Unisciti alla mia asta Fantasta!',
                text: `Usa il codice ${this.auction.code} per unirti all'asta "${this.auction.name}"`,
                url: window.location.origin
            }).catch(err => console.log('Share failed:', err));
        } else {
            this.copyCode();
        }
    }
    
    copyInviteLink() {
        const link = `${window.location.origin}/#join/${this.auction.code}`;
        Utils.copyToClipboard(link);
        Utils.toast('Link copiato negli appunti', 'success');
    }
    
    async refreshParticipants() {
        await this.loadAuction();
        Utils.toast('Partecipanti aggiornati', 'success');
    }
    
    setupRealtimeSubscription() {
        // Subscribe to auction changes
        this.realtimeChannel = supabaseManager.subscribeToAuction(this.auctionId, {
            onAuctionUpdate: (payload) => {
                console.log('Auction updated:', payload);
                this.loadAuction();
            },
            onTeamUpdate: (payload) => {
                console.log('Team updated:', payload);
                this.loadAuction();
            }
        });
    }
    
    startRefreshInterval() {
        // Refresh every 5 seconds
        this.refreshInterval = setInterval(() => {
            this.loadAuction();
        }, 5000);
    }
    
    destroy() {
        // Clean up when leaving the page
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        if (this.realtimeChannel) {
            supabaseManager.unsubscribe(this.realtimeChannel);
        }
    }
}

// Create global instance
window.auctionSetupManager = new AuctionSetupManager();