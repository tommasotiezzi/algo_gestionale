// =====================================
// AUCTION LIVE MANAGER - NEW VERSION
// =====================================

class AuctionLiveManager {
    constructor() {
        this.auctionId = null;
        this.auction = null;
        this.teams = [];
        this.players = [];
        this.filteredPlayers = [];
        this.calledPlayers = new Set();
        this.boughtPlayers = {};
        this.rosters = {};
        this.currentPlayer = null;
        this.currentBid = null;
        this.myTeam = null;
        this.isMyTurn = false;
        this.timerInterval = null;
        this.timeRemaining = 0;
        this.realtimeChannel = null;
        
        // Filter states
        this.dropdownFilter = 'all'; // all, P, D, C, A
        this.showOnlyAvailable = true;
        this.useModifier = false; // mod/nomod toggle
        this.selectedPlayerId = null;
        
        // Sidebar states
        this.sidebarOpen = false;
        this.sidebarFilter = 'all';
        this.sidebarSearch = '';
        this.sidebarView = 'grid';
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
        await this.loadRosters();
        
        // Setup realtime
        this.setupRealtimeSubscription();
        
        // Initial render
        this.renderAll();
        
        // Start timer if needed
        if (this.auction?.timer_enabled && this.currentBid) {
            this.startTimer(this.auction.timer_seconds);
        }
    }
    
    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('toggle-players-sidebar')?.addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        document.getElementById('close-sidebar')?.addEventListener('click', () => {
            this.closeSidebar();
        });
        
        // Pause button
        document.getElementById('pause-btn')?.addEventListener('click', () => this.pauseAuction());
        
        // Battitore controls
        document.getElementById('player-selector')?.addEventListener('change', (e) => {
            this.selectedPlayerId = e.target.value ? parseInt(e.target.value) : null;
            this.updateCallButton();
        });
        
        // Role filter buttons
        document.querySelectorAll('.role-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dropdownFilter = e.target.dataset.role;
                document.querySelectorAll('.role-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.populatePlayerDropdown();
            });
        });
        
        // Available filter checkbox
        document.getElementById('show-only-available')?.addEventListener('change', (e) => {
            this.showOnlyAvailable = e.target.checked;
            this.populatePlayerDropdown();
        });
        
        // Mod/NoMod toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.useModifier = (mode === 'mod');
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Re-sort and render sidebar players
                this.sortPlayers();
                this.renderSidebarPlayers();
            });
        });
        
        // Call player button
        document.getElementById('call-player-btn')?.addEventListener('click', () => {
            this.callPlayer();
        });
        
        // Bid controls
        document.getElementById('bid-minus')?.addEventListener('click', () => this.adjustBid(-1));
        document.getElementById('bid-plus')?.addEventListener('click', () => this.adjustBid(1));
        document.getElementById('bid-btn')?.addEventListener('click', () => this.placeBid());
        document.getElementById('assign-btn')?.addEventListener('click', () => this.showAssignmentModal());
        
        // Bid input validation
        const bidInput = document.getElementById('bid-input');
        if (bidInput) {
            bidInput.addEventListener('change', (e) => {
                const minBid = this.getMinBid();
                if (parseInt(e.target.value) < minBid) {
                    e.target.value = minBid;
                }
            });
        }
        
        // Sidebar filters
        document.querySelectorAll('.sidebar-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.sidebarFilter = e.target.dataset.role;
                document.querySelectorAll('.sidebar-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderSidebarPlayers();
            });
        });
        
        // Sidebar search
        const sidebarSearch = document.getElementById('sidebar-player-search');
        if (sidebarSearch) {
            sidebarSearch.addEventListener('input', Utils.debounce((e) => {
                this.sidebarSearch = e.target.value.toLowerCase();
                this.renderSidebarPlayers();
            }, 300));
        }
        
        // Sidebar view toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.sidebarView = e.target.dataset.view;
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderSidebarPlayers();
            });
        });
        
        // Confirm assignment modal
        document.getElementById('confirm-assignment-btn')?.addEventListener('click', () => {
            this.confirmAssignment();
        });
    }
    
    // ===================================
    // DATA LOADING
    // ===================================
    
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
            
            // Update header
            document.getElementById('live-auction-name').textContent = this.auction.name;
            
        } catch (error) {
            console.error('Error loading auction:', error);
            Utils.toast('Errore nel caricamento dell\'asta', 'error');
        }
    }
    
    async loadPlayers() {
        try {
            const result = await supabaseManager.getPlayers({
                auctionId: this.auctionId
            });
            
            if (result.success) {
                this.players = result.data || [];
                
                // Add calculated fields for both mod and nomod
                const suffix = `_${this.auction.num_partecipanti}`;
                this.players = this.players.map(player => ({
                    ...player,
                    ia_mod: player[`IA${suffix}_mod`] || 0,
                    ia_nomod: player[`IA${suffix}_nomod`] || 0,
                    slot_mod: player[`Slot${suffix}_mod`] || null,
                    slot_nomod: player[`Slot${suffix}_nomod`] || null,
                    budget_max_mod: player[`Budget MAX${suffix}_mod`] || 0,
                    budget_max_nomod: player[`Budget MAX${suffix}_nomod`] || 0
                }));
                
                // Sort players
                this.sortPlayers();
            }
            
        } catch (error) {
            console.error('Error loading players:', error);
            Utils.toast('Errore nel caricamento dei giocatori', 'error');
        }
    }
    
    async loadRosters() {
        try {
            // Load all rosters for this auction
            const { data: rosters } = await supabaseManager.client
                .from('rosters')
                .select('*')
                .eq('auction_id', this.auctionId);
            
            // Organize by team
            this.rosters = {};
            this.teams.forEach(team => {
                this.rosters[team.id] = {
                    P: [],
                    D: [],
                    C: [],
                    A: []
                };
            });
            
            // Fill rosters
            rosters?.forEach(roster => {
                const player = this.players.find(p => p.Id === roster.player_id);
                if (player && this.rosters[roster.team_id]) {
                    this.rosters[roster.team_id][player.R].push({
                        ...player,
                        purchase_price: roster.purchase_price
                    });
                    
                    // Mark as bought
                    this.boughtPlayers[roster.player_id] = {
                        team_id: roster.team_id,
                        team_name: this.teams.find(t => t.id === roster.team_id)?.name || '---'
                    };
                }
            });
            
            // Load called players
            const { data: called } = await supabaseManager.client
                .from('called_players')
                .select('player_id')
                .eq('auction_id', this.auctionId);
            
            this.calledPlayers = new Set(called?.map(cp => cp.player_id) || []);
            
        } catch (error) {
            console.error('Error loading rosters:', error);
        }
    }
    
    // ===================================
    // PLAYER SORTING
    // ===================================
    
    sortPlayers() {
        const suffix = this.useModifier ? '_mod' : '_nomod';
        
        this.players.sort((a, b) => {
            const slotA = a[`slot${suffix}`] || 999;
            const slotB = b[`slot${suffix}`] || 999;
            
            if (slotA !== slotB) {
                return slotA - slotB;
            }
            
            const iaA = a[`ia${suffix}`] || 0;
            const iaB = b[`ia${suffix}`] || 0;
            
            return iaB - iaA; // Higher IA first
        });
    }
    
    // ===================================
    // RENDERING
    // ===================================
    
    renderAll() {
        this.populatePlayerDropdown();
        this.renderTeamsGrid();
        this.renderSidebarPlayers();
        this.updateBidControls();
    }
    
    populatePlayerDropdown() {
        const dropdown = document.getElementById('player-selector');
        if (!dropdown) return;
        
        // Filter players
        let filtered = this.players;
        
        // Role filter
        if (this.dropdownFilter !== 'all') {
            filtered = filtered.filter(p => p.R === this.dropdownFilter);
        }
        
        // Available filter
        if (this.showOnlyAvailable) {
            filtered = filtered.filter(p => !this.boughtPlayers[p.Id]);
        }
        
        // Clear and populate
        dropdown.innerHTML = '<option value="">-- Scegli un giocatore --</option>';
        
        const suffix = this.useModifier ? '_mod' : '_nomod';
        
        filtered.forEach(player => {
            const isBought = this.boughtPlayers[player.Id];
            const option = document.createElement('option');
            option.value = player.Id;
            option.textContent = `${player.R} - ${player.Nome} (${player.Squadra}) - Slot: ${player[`slot${suffix}`] || '-'} - IA: ${player[`ia${suffix}`] || '-'}`;
            
            if (isBought) {
                option.textContent += ` [${isBought.team_name}]`;
                option.disabled = true;
            }
            
            dropdown.appendChild(option);
        });
        
        // Reset selection
        this.selectedPlayerId = null;
        this.updateCallButton();
    }
    
    renderTeamsGrid() {
        const container = document.getElementById('rose-grid');
        if (!container) return;
        
        container.innerHTML = this.teams.map(team => {
            const roster = this.rosters[team.id] || { P: [], D: [], C: [], A: [] };
            const maxP = this.auction.max_portieri || 3;
            const maxD = this.auction.max_difensori || 8;
            const maxC = this.auction.max_centrocampisti || 8;
            const maxA = this.auction.max_attaccanti || 6;
            
            const totalPlayers = roster.P.length + roster.D.length + roster.C.length + roster.A.length;
            const maxPlayers = maxP + maxD + maxC + maxA;
            const progressPercent = (totalPlayers / maxPlayers) * 100;
            
            const isCurrentTurn = this.auction.current_turn_team_id === team.id;
            const isCurrentBidder = this.currentBid?.team_id === team.id;
            
            let classes = ['team-column'];
            if (isCurrentTurn) classes.push('has-turn');
            if (isCurrentBidder) classes.push('current-bidder');
            
            return `
                <div class="${classes.join(' ')}">
                    <div class="team-column-header">
                        ${isCurrentTurn ? '<div class="turn-indicator">👤</div>' : ''}
                        <div class="team-name">${team.name}</div>
                        <div class="team-budget">${team.budget_remaining} €</div>
                    </div>
                    <div class="team-roster">
                        <div class="roster-item">
                            <span style="color: var(--role-p)">P:</span>
                            <span>${roster.P.length} / ${maxP}</span>
                        </div>
                        <div class="roster-item">
                            <span style="color: var(--role-d)">D:</span>
                            <span>${roster.D.length} / ${maxD}</span>
                        </div>
                        <div class="roster-item">
                            <span style="color: var(--role-c)">C:</span>
                            <span>${roster.C.length} / ${maxC}</span>
                        </div>
                        <div class="roster-item">
                            <span style="color: var(--role-a)">A:</span>
                            <span>${roster.A.length} / ${maxA}</span>
                        </div>
                    </div>
                    <div class="team-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderSidebarPlayers() {
        const container = document.getElementById('sidebar-players-container');
        if (!container) return;
        
        // Filter players
        let filtered = this.players;
        
        // Role filter
        if (this.sidebarFilter !== 'all') {
            filtered = filtered.filter(p => p.R === this.sidebarFilter);
        }
        
        // Search filter
        if (this.sidebarSearch) {
            filtered = filtered.filter(p => 
                p.Nome.toLowerCase().includes(this.sidebarSearch) ||
                p.Squadra.toLowerCase().includes(this.sidebarSearch)
            );
        }
        
        const suffix = this.useModifier ? '_mod' : '_nomod';
        const gridClass = this.sidebarView === 'grid' ? 'sidebar-players-grid' : 'sidebar-players-grid list-view';
        
        container.innerHTML = `
            <div class="${gridClass}">
                ${filtered.map(player => {
                    const isBought = this.boughtPlayers[player.Id];
                    const isSelected = this.selectedPlayerId === player.Id;
                    const roleColor = Utils.getRoleColor(player.R);
                    
                    return `
                        <div class="sidebar-player-card ${isBought ? 'bought' : ''} ${isSelected ? 'selected' : ''}"
                             data-player-id="${player.Id}"
                             onclick="window.auctionLiveManager.selectPlayerFromSidebar(${player.Id})">
                            ${isBought ? `<div class="player-owner-badge">${isBought.team_name}</div>` : ''}
                            <div class="sidebar-player-role" style="color: ${roleColor}">${player.R}</div>
                            <div class="sidebar-player-name">${player.Nome}</div>
                            <div class="sidebar-player-team">${player.Squadra}</div>
                            <div class="sidebar-player-stats">
                                <span>IA: ${player[`ia${suffix}`] || '-'}</span>
                                <span>Slot: ${player[`slot${suffix}`] || '-'}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // ===================================
    // PLAYER ACTIONS
    // ===================================
    
    selectPlayerFromSidebar(playerId) {
        // Don't allow selecting bought players
        if (this.boughtPlayers[playerId]) {
            Utils.toast('Giocatore già acquistato', 'warning');
            return;
        }
        
        this.selectedPlayerId = playerId;
        
        // Update dropdown to match
        const dropdown = document.getElementById('player-selector');
        if (dropdown) {
            dropdown.value = playerId;
        }
        
        // Update UI
        this.updateCallButton();
        this.renderSidebarPlayers();
    }
    
    async callPlayer() {
        if (!this.selectedPlayerId) {
            Utils.toast('Seleziona un giocatore prima', 'warning');
            return;
        }
        
        const player = this.players.find(p => p.Id === this.selectedPlayerId);
        if (!player) return;
        
        try {
            // Mark player as called
            const { error: calledError } = await supabaseManager.client
                .from('called_players')
                .insert({
                    auction_id: this.auctionId,
                    player_id: player.Id
                });
            
            if (calledError) throw calledError;
            
            // Set as current player in auction
            const { error: auctionError } = await supabaseManager.client
                .from('auctions')
                .update({ current_player_id: player.Id })
                .eq('id', this.auctionId);
            
            if (auctionError) throw auctionError;
            
            // Get starting price
            const startPrice = this.auction.starting_price_type === 'qt_a' 
                ? (player.qt_a || 1) 
                : 1;
            
            // Create initial bid
            const { error: bidError } = await supabaseManager.client
                .from('current_bids')
                .insert({
                    auction_id: this.auctionId,
                    player_id: player.Id,
                    team_id: this.myTeam?.id || this.teams[0].id,
                    amount: startPrice
                });
            
            if (bidError) throw bidError;
            
            Utils.toast(`Giocatore ${player.Nome} chiamato!`, 'success');
            
            // Reload data
            await this.loadAuction();
            this.displayCalledPlayer(player);
            
        } catch (error) {
            console.error('Error calling player:', error);
            Utils.toast('Errore nella chiamata del giocatore', 'error');
        }
    }
    
    displayCalledPlayer(player) {
        this.currentPlayer = player;
        
        // Hide no-player state
        document.getElementById('no-player-state')?.classList.add('hidden');
        
        // Show player display
        const display = document.getElementById('called-player-display');
        if (display) {
            display.classList.remove('hidden');
            
            // Set role badge
            const roleEl = document.getElementById('player-role-large');
            if (roleEl) {
                roleEl.textContent = player.R;
                roleEl.style.color = Utils.getRoleColor(player.R);
            }
            
            // Set player info
            document.getElementById('player-name-large').textContent = player.Nome;
            document.getElementById('player-team-large').textContent = player.Squadra;
            
            // Set stats based on current modifier
            const suffix = this.useModifier ? '_mod' : '_nomod';
            document.getElementById('player-qt').textContent = player.qt_a || '-';
            document.getElementById('player-ia').textContent = player[`ia${suffix}`] || '-';
            document.getElementById('player-slot').textContent = player[`slot${suffix}`] || '-';
            document.getElementById('player-budget-max').textContent = player[`budget_max${suffix}`] || '-';
            document.getElementById('player-titolarita').textContent = player.Titolarità || '-';
            document.getElementById('player-mv').textContent = player.mv_all_time || '-';
            document.getElementById('player-fm').textContent = player.fantamedia_all_time || '-';
            document.getElementById('player-pma').textContent = player.PMA || '-';
        }
        
        // Update bid display
        this.updateBidDisplay();
        this.updateBidControls();
    }
    
    updateBidDisplay() {
        if (!this.currentBid) return;
        
        const team = this.teams.find(t => t.id === this.currentBid.team_id);
        
        document.getElementById('current-bid-amount').textContent = `${this.currentBid.amount} €`;
        document.getElementById('current-bid-team').textContent = team?.name || '---';
        
        // Update bid input
        const minBid = this.getMinBid();
        const bidInput = document.getElementById('bid-input');
        if (bidInput) {
            bidInput.min = minBid;
            bidInput.value = minBid;
        }
    }
    
    getMinBid() {
        return (this.currentBid?.amount || 0) + 1;
    }
    
    adjustBid(delta) {
        const input = document.getElementById('bid-input');
        if (!input) return;
        
        const currentValue = parseInt(input.value) || this.getMinBid();
        const newValue = currentValue + delta;
        const minBid = this.getMinBid();
        
        if (newValue >= minBid) {
            input.value = newValue;
        }
    }
    
    async placeBid() {
        if (!this.currentPlayer || !this.myTeam) return;
        
        const bidAmount = parseInt(document.getElementById('bid-input')?.value);
        const minBid = this.getMinBid();
        
        if (bidAmount < minBid) {
            Utils.toast(`Offerta minima: ${minBid} €`, 'warning');
            return;
        }
        
        if (bidAmount > this.myTeam.budget_remaining) {
            Utils.toast('Budget insufficiente', 'error');
            return;
        }
        
        try {
            // Update current bid
            const { error } = await supabaseManager.client
                .from('current_bids')
                .update({
                    team_id: this.myTeam.id,
                    amount: bidAmount
                })
                .eq('auction_id', this.auctionId)
                .eq('player_id', this.currentPlayer.Id);
            
            if (error) throw error;
            
            Utils.toast('Offerta effettuata!', 'success');
            
            // Reload auction data
            await this.loadAuction();
            this.updateBidDisplay();
            this.renderTeamsGrid();
            
            // Restart timer if enabled
            if (this.auction.timer_enabled) {
                this.startTimer(this.auction.timer_seconds);
            }
            
        } catch (error) {
            console.error('Error placing bid:', error);
            Utils.toast('Errore nel rilancio', 'error');
        }
    }
    
    showAssignmentModal() {
        if (!this.currentPlayer || !this.currentBid) return;
        
        const team = this.teams.find(t => t.id === this.currentBid.team_id);
        if (!team) return;
        
        // Check budget
        const budgetWarning = document.getElementById('confirm-budget-warning');
        if (this.currentBid.amount > team.budget_remaining) {
            budgetWarning.textContent = '⚠️ Attenzione: budget insufficiente!';
            budgetWarning.style.display = 'block';
        } else {
            budgetWarning.style.display = 'none';
        }
        
        // Set modal content
        document.getElementById('confirm-player-name').textContent = this.currentPlayer.Nome;
        document.getElementById('confirm-team-name').textContent = team.name;
        document.getElementById('confirm-amount').textContent = `${this.currentBid.amount} €`;
        
        // Show modal
        document.getElementById('confirm-assignment-modal')?.classList.remove('hidden');
    }
    
    async confirmAssignment() {
        if (!this.currentPlayer || !this.currentBid) return;
        
        const team = this.teams.find(t => t.id === this.currentBid.team_id);
        if (!team) return;
        
        try {
            // Add to roster
            const { error: rosterError } = await supabaseManager.client
                .from('rosters')
                .insert({
                    auction_id: this.auctionId,
                    team_id: team.id,
                    player_id: this.currentPlayer.Id,
                    purchase_price: this.currentBid.amount
                });
            
            if (rosterError) throw rosterError;
            
            // Update team budget
            const newBudget = team.budget_remaining - this.currentBid.amount;
            const { error: budgetError } = await supabaseManager.client
                .from('teams')
                .update({ budget_remaining: newBudget })
                .eq('id', team.id);
            
            if (budgetError) throw budgetError;
            
            // Clear current bid
            const { error: bidDeleteError } = await supabaseManager.client
                .from('current_bids')
                .delete()
                .eq('auction_id', this.auctionId)
                .eq('player_id', this.currentPlayer.Id);
            
            if (bidDeleteError) throw bidDeleteError;
            
            // Clear current player from auction
            const { error: clearPlayerError } = await supabaseManager.client
                .from('auctions')
                .update({ current_player_id: null })
                .eq('id', this.auctionId);
            
            if (clearPlayerError) throw clearPlayerError;
            
            // Advance turn if needed
            if (this.auction.auction_type === 'turn' || this.auction.bid_mode === 'fixed_turns') {
                await this.advanceTurn();
            }
            
            // Hide confirm modal
            document.getElementById('confirm-assignment-modal')?.classList.add('hidden');
            
            // Show winner modal
            this.showWinnerModal(team);
            
            // Reload data
            await this.loadAuction();
            await this.loadRosters();
            
            // Reset UI
            this.resetPlayerDisplay();
            this.renderAll();
            
        } catch (error) {
            console.error('Error assigning player:', error);
            Utils.toast('Errore nell\'assegnazione', 'error');
        }
    }
    
    showWinnerModal(team) {
        const modal = document.getElementById('winner-modal');
        if (!modal) return;
        
        document.getElementById('winner-role').textContent = this.currentPlayer.R;
        document.getElementById('winner-role').style.color = Utils.getRoleColor(this.currentPlayer.R);
        document.getElementById('winner-player-name').textContent = this.currentPlayer.Nome;
        document.getElementById('winner-team-name').textContent = team.name;
        document.getElementById('winner-price').textContent = `${this.currentBid.amount} €`;
        
        modal.classList.remove('hidden');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 3000);
    }
    
    resetPlayerDisplay() {
        this.currentPlayer = null;
        this.selectedPlayerId = null;
        
        document.getElementById('called-player-display')?.classList.add('hidden');
        document.getElementById('no-player-state')?.classList.remove('hidden');
        
        const dropdown = document.getElementById('player-selector');
        if (dropdown) dropdown.value = '';
        
        this.updateCallButton();
    }
    
    async advanceTurn() {
        // Find next team in order
        const currentIndex = this.teams.findIndex(t => t.id === this.auction.current_turn_team_id);
        const nextIndex = (currentIndex + 1) % this.teams.length;
        const nextTeam = this.teams[nextIndex];
        
        await supabaseManager.client
            .from('auctions')
            .update({ current_turn_team_id: nextTeam.id })
            .eq('id', this.auctionId);
    }
    
    // ===================================
    // UI UPDATES
    // ===================================
    
    updateCallButton() {
        const btn = document.getElementById('call-player-btn');
        if (!btn) return;
        
        btn.disabled = !this.selectedPlayerId || !!this.currentPlayer;
    }
    
    updateBidControls() {
        const bidBtn = document.getElementById('bid-btn');
        const assignBtn = document.getElementById('assign-btn');
        
        const hasCurrentPlayer = !!this.currentPlayer;
        const canBid = hasCurrentPlayer && this.myTeam && !this.isMyTurn;
        const canAssign = hasCurrentPlayer && (this.isMyTurn || this.auction.auction_type === 'random');
        
        if (bidBtn) bidBtn.disabled = !canBid;
        if (assignBtn) assignBtn.disabled = !canAssign;
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
            // Free bidding - everyone can bid
            this.isMyTurn = false;
        }
        
        this.updateBidControls();
    }
    
    // ===================================
    // SIDEBAR
    // ===================================
    
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('players-sidebar');
        const mainContent = document.querySelector('.live-main-content');
        
        if (this.sidebarOpen) {
            sidebar?.classList.add('open');
            mainContent?.classList.add('sidebar-open');
        } else {
            sidebar?.classList.remove('open');
            mainContent?.classList.remove('sidebar-open');
        }
    }
    
    closeSidebar() {
        this.sidebarOpen = false;
        document.getElementById('players-sidebar')?.classList.remove('open');
        document.querySelector('.live-main-content')?.classList.remove('sidebar-open');
    }
    
    // ===================================
    // TIMER
    // ===================================
    
    startTimer(seconds) {
        this.stopTimer();
        this.timeRemaining = seconds;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.stopTimer();
                // Auto-assign if timer expires
                if (this.currentPlayer && this.currentBid) {
                    this.confirmAssignment();
                }
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateTimerDisplay() {
        const timerValue = document.querySelector('.timer-value');
        if (!timerValue) return;
        
        timerValue.textContent = this.timeRemaining;
        
        timerValue.classList.remove('warning', 'danger');
        if (this.timeRemaining <= 5 && this.timeRemaining > 3) {
            timerValue.classList.add('warning');
        } else if (this.timeRemaining <= 3) {
            timerValue.classList.add('danger');
        }
    }
    
    // ===================================
    // REALTIME
    // ===================================
    
    setupRealtimeSubscription() {
        this.realtimeChannel = supabaseManager.subscribeToAuction(this.auctionId, {
            onAuctionUpdate: async () => {
                await this.loadAuction();
                this.renderAll();
            },
            onBidUpdate: async () => {
                await this.loadAuction();
                this.updateBidDisplay();
                this.renderTeamsGrid();
            },
            onRosterUpdate: async () => {
                await this.loadRosters();
                this.renderAll();
            }
        });
    }
    
    // ===================================
    // PAUSE
    // ===================================
    
    pauseAuction() {
        document.getElementById('pause-modal')?.classList.remove('hidden');
        this.stopTimer();
    }
    
    // ===================================
    // CLEANUP
    // ===================================
    
    destroy() {
        this.stopTimer();
        if (this.realtimeChannel) {
            supabaseManager.unsubscribe(this.realtimeChannel);
        }
    }
}

// Create global instance
window.auctionLiveManager = new AuctionLiveManager();
