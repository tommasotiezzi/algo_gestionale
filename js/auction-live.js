// =====================================
// AUCTION LIVE MANAGER
// =====================================

class AuctionLiveManager {
    constructor() {
        this.auctionId = null;
        this.auction = null;
        this.teams = [];
        this.players = [];
        this.filteredPlayers = [];
        this.calledPlayers = new Set();
        this.currentPlayer = null;
        this.currentBid = null;
        this.myTeam = null;
        this.isMyTurn = false;
        this.timerInterval = null;
        this.timeRemaining = 0;
        this.currentFilter = 'all';
        this.currentView = 'grid';
        this.searchQuery = '';
        this.realtimeChannel = null;
    }
    
    async init() {
        console.log('Initializing Auction Live...');
        
        // Get auction ID
        this.auctionId = Utils.storage.get(CONFIG.STORAGE_KEYS.CURRENT_AUCTION);
        if (!this.auctionId) {
            Utils.toast('Nessuna asta selezionata', 'error');
            window.router.navigate('dashboard');
            return;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadAuction();
        await this.loadPlayers();
        
        // Setup realtime
        this.setupRealtimeSubscription();
        
        // Start timer if needed
        if (this.auction?.timer_enabled && this.currentBid) {
            this.startTimer(this.auction.timer_seconds);
        }
    }
    
    setupEventListeners() {
        // Pause button
        document.getElementById('pause-btn')?.addEventListener('click', () => this.pauseAuction());
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterPlayers(e.target.dataset.role);
            });
        });
        
        // Search input
        const searchInput = document.getElementById('player-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchPlayers(e.target.value);
            }, 300));
        }
        
        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggleView(e.target.dataset.view);
            });
        });
        
        // Bid controls
        document.getElementById('bid-minus')?.addEventListener('click', () => this.adjustBid(-1));
        document.getElementById('bid-plus')?.addEventListener('click', () => this.adjustBid(1));
        document.getElementById('bid-btn')?.addEventListener('click', () => this.placeBid());
        document.getElementById('pass-btn')?.addEventListener('click', () => this.passTurn());
        
        // Bid input validation
        const bidInput = document.getElementById('bid-input');
        if (bidInput) {
            bidInput.addEventListener('change', (e) => {
                const minBid = (this.currentBid?.amount || 0) + 1;
                if (parseInt(e.target.value) < minBid) {
                    e.target.value = minBid;
                }
            });
        }
    }
    
    async loadAuction() {
        try {
            const result = await supabaseManager.getAuction(this.auctionId);
            
            if (!result.success || !result.data) {
                throw new Error('Asta non trovata');
            }
            
            this.auction = result.data;
            this.teams = result.data.teams || [];
            this.currentBid = result.data.current_bids?.[0] || null;
            
            // Find my team
            const userId = supabaseManager.currentUser?.id;
            this.myTeam = this.teams.find(t => t.user_id === userId);
            
            // Check if it's my turn
            this.checkTurn();
            
            // Update UI
            this.updateAuctionUI();
            this.updateTeamsDisplay();
            
            // Load called players
            await this.loadCalledPlayers();
            
        } catch (error) {
            console.error('Error loading auction:', error);
            Utils.toast('Errore nel caricamento dell\'asta', 'error');
        }
    }
    
    async loadPlayers() {
        try {
            // Show loading
            const container = document.getElementById('players-container');
            if (container) {
                container.innerHTML = `
                    <div class="players-loading">
                        <div class="loading"></div>
                        <p>Caricamento giocatori...</p>
                    </div>
                `;
            }
            
            const result = await supabaseManager.getPlayers({
                auctionId: this.auctionId
            });
            
            if (result.success) {
                this.players = result.data || [];
                
                // Get dynamic column suffix based on auction settings
                const suffix = `_${this.auction.num_partecipanti}_${this.myTeam?.has_modifier ? 'mod' : 'nomod'}`;
                
                // Add calculated fields to players
                this.players = this.players.map(player => ({
                    ...player,
                    ia_value: player[`IA${suffix}`] || 0,
                    slot_value: player[`Slot${suffix}`] || null,
                    budget_max: player[`Budget MAX${suffix}`] || 0
                }));
                
                // Sort by slot then IA
                this.players = Utils.sortPlayersBySlotAndIA(
                    this.players, 
                    this.auction.num_partecipanti, 
                    this.myTeam?.has_modifier || false
                );
                
                this.filterPlayers(this.currentFilter);
            }
            
        } catch (error) {
            console.error('Error loading players:', error);
            Utils.toast('Errore nel caricamento dei giocatori', 'error');
        }
    }
    
    async loadCalledPlayers() {
        try {
            const { data } = await supabaseManager.client
                .from('called_players')
                .select('player_id')
                .eq('auction_id', this.auctionId);
            
            this.calledPlayers = new Set(data?.map(cp => cp.player_id) || []);
            
            // Also load rosters to mark bought players
            const { data: rosters } = await supabaseManager.client
                .from('rosters')
                .select('player_id, team:teams(name)')
                .eq('auction_id', this.auctionId);
            
            // Store bought players info
            this.boughtPlayers = {};
            rosters?.forEach(roster => {
                this.boughtPlayers[roster.player_id] = roster.team?.name || 'Acquistato';
            });
            
        } catch (error) {
            console.error('Error loading called players:', error);
        }
    }
    
    checkTurn() {
        if (!this.auction || !this.myTeam) {
            this.isMyTurn = false;
            return;
        }
        
        // Check based on auction type
        if (this.auction.auction_type === 'turn') {
            this.isMyTurn = this.auction.current_turn_team_id === this.myTeam.id;
        } else if (this.auction.bid_mode === 'fixed_turns') {
            this.isMyTurn = this.auction.current_turn_team_id === this.myTeam.id;
        } else {
            // Free bidding
            this.isMyTurn = true;
        }
        
        this.updateBidControls();
    }
    
    updateAuctionUI() {
        // Update header
        document.getElementById('live-auction-name').textContent = this.auction.name;
        
        // Update current player if any
        if (this.auction.current_player_id) {
            this.loadCurrentPlayer(this.auction.current_player_id);
        } else {
            this.clearCurrentPlayer();
        }
        
        // Update bid display
        if (this.currentBid) {
            document.getElementById('current-bid-amount').textContent = `${this.currentBid.amount} €`;
            document.getElementById('current-bid-team').textContent = 
                this.currentBid.team?.name || '---';
        }
    }
    
    async loadCurrentPlayer(playerId) {
        const player = this.players.find(p => p.Id === playerId);
        if (!player) return;
        
        this.currentPlayer = player;
        
        // Show player display
        document.getElementById('player-display').classList.remove('hidden');
        document.getElementById('no-player-display').classList.add('hidden');
        
        // Update player info
        const roleEl = document.getElementById('player-role');
        roleEl.textContent = player.R;
        roleEl.setAttribute('data-role', player.R);
        
        document.getElementById('player-name').textContent = player.Nome;
        document.getElementById('player-team').textContent = player.Squadra;
        document.getElementById('player-qt').textContent = player.qt_a || '1';
        document.getElementById('player-ia').textContent = player.ia_value || '-';
        document.getElementById('player-slot').textContent = player.slot_value || '-';
        
        // Update bid input minimum
        const minBid = (this.currentBid?.amount || 0) + 1;
        const bidInput = document.getElementById('bid-input');
        if (bidInput) {
            bidInput.min = minBid;
            bidInput.value = minBid;
        }
    }
    
    clearCurrentPlayer() {
        this.currentPlayer = null;
        document.getElementById('player-display').classList.add('hidden');
        document.getElementById('no-player-display').classList.remove('hidden');
        document.getElementById('player-status-text').textContent = 'In attesa del prossimo giocatore...';
    }
    
    updateTeamsDisplay() {
        const container = document.getElementById('teams-grid');
        if (!container) return;
        
        container.innerHTML = this.teams.map(team => {
            const isActive = team.id === this.auction.current_turn_team_id;
            const isBidding = team.id === this.currentBid?.team_id;
            const rosterInfo = this.getTeamRosterInfo(team.id);
            
            return `
                <div class="team-card ${isActive ? 'active' : ''} ${isBidding ? 'current-bidder' : ''}">
                    <div class="team-name">${team.name}</div>
                    <div class="team-budget">${team.budget_remaining} €</div>
                    <div class="team-roster-count">
                        <span class="roster-count-item">P: ${rosterInfo.P}</span>
                        <span class="roster-count-item">D: ${rosterInfo.D}</span>
                        <span class="roster-count-item">C: ${rosterInfo.C}</span>
                        <span class="roster-count-item">A: ${rosterInfo.A}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    getTeamRosterInfo(teamId) {
        // This would need to be loaded from rosters table
        // For now return empty counts
        return { P: 0, D: 0, C: 0, A: 0 };
    }
    
    filterPlayers(role) {
        this.currentFilter = role;
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });
        
        // Filter players
        if (role === 'all') {
            this.filteredPlayers = this.players;
        } else {
            this.filteredPlayers = this.players.filter(p => p.R === role);
        }
        
        // Apply search if any
        if (this.searchQuery) {
            this.searchPlayers(this.searchQuery, false);
        } else {
            this.renderPlayers();
        }
    }
    
    searchPlayers(query, render = true) {
        this.searchQuery = query.toLowerCase();
        
        if (this.searchQuery) {
            this.filteredPlayers = (this.currentFilter === 'all' ? this.players : this.filteredPlayers)
                .filter(p => 
                    p.Nome.toLowerCase().includes(this.searchQuery) ||
                    p.Squadra.toLowerCase().includes(this.searchQuery)
                );
        } else if (this.currentFilter !== 'all') {
            this.filteredPlayers = this.players.filter(p => p.R === this.currentFilter);
        } else {
            this.filteredPlayers = this.players;
        }
        
        if (render) this.renderPlayers();
    }
    
    toggleView(view) {
        this.currentView = view;
        
        // Update buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        this.renderPlayers();
    }
    
    renderPlayers() {
        const container = document.getElementById('players-container');
        if (!container) return;
        
        if (this.filteredPlayers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Nessun giocatore trovato</p>
                </div>
            `;
            return;
        }
        
        if (this.currentView === 'grid') {
            this.renderPlayersGrid(container);
        } else {
            this.renderPlayersList(container);
        }
    }
    
    renderPlayersGrid(container) {
        container.innerHTML = `
            <div class="players-grid">
                ${this.filteredPlayers.map(player => this.createPlayerCard(player)).join('')}
            </div>
        `;
        
        // Add click listeners
        container.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('click', () => {
                const playerId = parseInt(card.dataset.playerId);
                this.selectPlayer(playerId);
            });
        });
    }
    
    renderPlayersList(container) {
        container.innerHTML = `
            <div class="players-list">
                ${this.filteredPlayers.map(player => this.createPlayerListItem(player)).join('')}
            </div>
        `;
        
        // Add click listeners
        container.querySelectorAll('.player-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const playerId = parseInt(item.dataset.playerId);
                this.selectPlayer(playerId);
            });
        });
    }
    
    createPlayerCard(player) {
        const isBought = this.boughtPlayers[player.Id];
        const isSelected = this.currentPlayer?.Id === player.Id;
        const roleColor = Utils.getRoleColor(player.R);
        
        return `
            <div class="player-card ${isBought ? 'bought' : ''} ${isSelected ? 'selected' : ''}" 
                 data-player-id="${player.Id}">
                <div class="player-card-role" style="color: ${roleColor}">${player.R}</div>
                <div class="player-card-name">${player.Nome}</div>
                <div class="player-card-team">${player.Squadra}</div>
                <div class="player-card-stats">
                    <div class="player-card-stat">
                        <span class="player-card-stat-label">IA</span>
                        <span class="player-card-stat-value">${player.ia_value || '-'}</span>
                    </div>
                    <div class="player-card-stat">
                        <span class="player-card-stat-label">Slot</span>
                        <span class="player-card-stat-value">${player.slot_value || '-'}</span>
                    </div>
                </div>
                ${isBought ? `<div class="player-owner">${isBought}</div>` : ''}
            </div>
        `;
    }
    
    createPlayerListItem(player) {
        const isBought = this.boughtPlayers[player.Id];
        const roleColor = Utils.getRoleColor(player.R);
        
        return `
            <div class="player-list-item ${isBought ? 'bought' : ''}" 
                 data-player-id="${player.Id}">
                <div class="player-list-role" style="color: ${roleColor}">${player.R}</div>
                <div class="player-list-info">
                    <div class="player-list-name">${player.Nome}</div>
                    <div class="player-list-team">${player.Squadra}</div>
                </div>
                <div class="player-list-stats">
                    <span class="stat">IA: ${player.ia_value || '-'}</span>
                    <span class="stat">Slot: ${player.slot_value || '-'}</span>
                </div>
            </div>
        `;
    }
    
    async selectPlayer(playerId) {
        if (!this.isMyTurn) {
            Utils.toast('Non è il tuo turno', 'warning');
            return;
        }
        
        if (this.boughtPlayers[playerId]) {
            Utils.toast('Giocatore già acquistato', 'error');
            return;
        }
        
        // Set as current player
        await this.callPlayer(playerId);
    }
    
    async callPlayer(playerId) {
        try {
            // Update auction with new current player
            const { error } = await supabaseManager.client
                .from('auctions')
                .update({ current_player_id: playerId })
                .eq('id', this.auctionId);
            
            if (error) throw error;
            
            // Add to called players
            await supabaseManager.client
                .from('called_players')
                .insert({ 
                    auction_id: this.auctionId,
                    player_id: playerId
                });
            
            // Load the player
            await this.loadCurrentPlayer(playerId);
            
            // Start bidding at base price
            const basePrice = this.auction.starting_price_type === 'qt_a' ? 
                (this.currentPlayer.qt_a || 1) : 1;
            
            await this.placeBidAmount(basePrice);
            
        } catch (error) {
            console.error('Error calling player:', error);
            Utils.toast('Errore nella chiamata del giocatore', 'error');
        }
    }
    
    adjustBid(delta) {
        const input = document.getElementById('bid-input');
        if (!input) return;
        
        const currentValue = parseInt(input.value) || 1;
        const minBid = (this.currentBid?.amount || 0) + 1;
        const newValue = Math.max(minBid, currentValue + delta);
        
        input.value = newValue;
    }
    
    async placeBid() {
        if (!this.isMyTurn) {
            Utils.toast('Non è il tuo turno', 'warning');
            return;
        }
        
        if (!this.currentPlayer) {
            Utils.toast('Seleziona un giocatore', 'warning');
            return;
        }
        
        const amount = parseInt(document.getElementById('bid-input').value);
        
        // Show confirmation
        this.showBidConfirmation(amount);
    }
    
    showBidConfirmation(amount) {
        const modal = document.getElementById('bid-confirmation-modal');
        if (!modal) return;
        
        document.getElementById('confirm-amount').textContent = `${amount} €`;
        document.getElementById('confirm-player').textContent = this.currentPlayer.Nome;
        document.getElementById('remaining-budget').textContent = 
            `${this.myTeam.budget_remaining - amount} €`;
        
        modal.classList.remove('hidden');
        
        // Set up confirm button
        const confirmBtn = document.getElementById('confirm-bid-btn');
        confirmBtn.onclick = async () => {
            modal.classList.add('hidden');
            await this.placeBidAmount(amount);
        };
    }
    
    async placeBidAmount(amount) {
        try {
            const result = await supabaseManager.placeBid(
                this.auctionId,
                this.currentPlayer.Id,
                this.myTeam.id,
                amount
            );
            
            if (result.success) {
                // Reset timer if enabled
                if (this.auction.timer_enabled) {
                    this.startTimer(this.auction.timer_seconds);
                }
                
                // Reload auction to get updated state
                await this.loadAuction();
            } else {
                Utils.toast(result.error || 'Errore nell\'offerta', 'error');
            }
            
        } catch (error) {
            console.error('Error placing bid:', error);
            Utils.toast('Errore nell\'offerta', 'error');
        }
    }
    
    async passTurn() {
        // Logic for passing depends on auction rules
        Utils.toast('Hai passato', 'info');
        
        // If timer is running and everyone passed, assign player
        // This needs more complex logic based on auction rules
    }
    
    async pauseAuction() {
        if (confirm('Vuoi mettere in pausa l\'asta?')) {
            try {
                await supabaseManager.updateAuctionStatus(this.auctionId, 'paused');
                Utils.toast('Asta in pausa', 'info');
                this.stopTimer();
            } catch (error) {
                Utils.toast('Errore nella pausa', 'error');
            }
        }
    }
    
    updateBidControls() {
        const bidBtn = document.getElementById('bid-btn');
        const passBtn = document.getElementById('pass-btn');
        const bidInput = document.getElementById('bid-input');
        const adjustBtns = [document.getElementById('bid-minus'), document.getElementById('bid-plus')];
        
        const isEnabled = this.isMyTurn && this.currentPlayer;
        
        if (bidBtn) bidBtn.disabled = !isEnabled;
        if (passBtn) passBtn.disabled = !isEnabled;
        if (bidInput) bidInput.disabled = !isEnabled;
        adjustBtns.forEach(btn => { if (btn) btn.disabled = !isEnabled; });
    }
    
    startTimer(seconds) {
        this.stopTimer();
        this.timeRemaining = seconds;
        
        const timerEl = document.querySelector('.timer-value');
        if (!timerEl) return;
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            
            timerEl.textContent = this.timeRemaining;
            
            if (this.timeRemaining <= 5) {
                timerEl.classList.add('danger');
            } else if (this.timeRemaining <= 10) {
                timerEl.classList.add('warning');
            }
            
            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.onTimerExpired();
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        const timerEl = document.querySelector('.timer-value');
        if (timerEl) {
            timerEl.textContent = '--';
            timerEl.classList.remove('warning', 'danger');
        }
    }
    
    async onTimerExpired() {
        // Assign player to current bidder
        if (this.currentBid && this.currentPlayer) {
            await this.assignPlayer();
        }
    }
    
    async assignPlayer() {
        try {
            const result = await supabaseManager.assignPlayer(
                this.auctionId,
                this.currentPlayer.Id,
                this.currentBid.team_id,
                this.currentBid.amount
            );
            
            if (result.success) {
                this.showWinnerModal();
                
                // Clear current player after delay
                setTimeout(() => {
                    this.clearCurrentPlayer();
                    this.loadAuction();
                    this.loadCalledPlayers();
                }, 3000);
            }
            
        } catch (error) {
            console.error('Error assigning player:', error);
            Utils.toast('Errore nell\'assegnazione', 'error');
        }
    }
    
    showWinnerModal() {
        const modal = document.getElementById('winner-modal');
        if (!modal) return;
        
        const winner = this.teams.find(t => t.id === this.currentBid.team_id);
        
        document.getElementById('winner-role').textContent = this.currentPlayer.R;
        document.getElementById('winner-role').style.color = Utils.getRoleColor(this.currentPlayer.R);
        document.getElementById('winner-player-name').textContent = this.currentPlayer.Nome;
        document.getElementById('winner-team-name').textContent = winner?.name || '---';
        document.getElementById('winner-price').textContent = `${this.currentBid.amount} €`;
        
        modal.classList.remove('hidden');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 5000);
    }
    
    setupRealtimeSubscription() {
        this.realtimeChannel = supabaseManager.subscribeToAuction(this.auctionId, {
            onAuctionUpdate: () => this.loadAuction(),
            onBidUpdate: () => this.loadAuction(),
            onRosterUpdate: () => {
                this.loadCalledPlayers();
                this.renderPlayers();
            }
        });
    }
    
    destroy() {
        this.stopTimer();
        if (this.realtimeChannel) {
            supabaseManager.unsubscribe(this.realtimeChannel);
        }
    }
}

// Create global instance
window.auctionLiveManager = new AuctionLiveManager();