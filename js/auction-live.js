// =====================================
// AUCTION LIVE - COMPLETE WITH TEAMS
// =====================================

class AuctionLiveManager {
    constructor() {
        this.auctionId = null;
        this.auction = null;
        this.players = [];
        this.teams = [];
        this.myTeam = null;
        this.currentBid = null;
        this.selectedPlayerId = null;
        this.roleFilter = 'all';
        this.timerInterval = null;
        this.timeRemaining = 0;
        this.realtimeChannel = null;
        this.expandedTeams = new Set(); // Track expanded teams
    }
    
    async init() {
        console.log('=== AUCTION LIVE INIT START ===');
        
        // Get auction ID
        this.auctionId = Utils.storage.get(CONFIG.STORAGE_KEYS.CURRENT_AUCTION);
        if (!this.auctionId) {
            Utils.toast('Nessuna asta selezionata', 'error');
            window.router.navigate('dashboard');
            return;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load data
        await this.loadAuction();
        await this.loadPlayers();
        
        // Setup UI based on auction type
        this.setupAuctionTypeUI();
        
        // Populate dropdown (only for 'turn' type)
        if (this.auction.auction_type === 'turn') {
            await this.populateDropdown();
        }
        
        // Check if there's a current player - ONLY if current_player_id exists
        if (this.auction.current_player_id) {
            console.log('Found current player, displaying:', this.auction.current_player_id);
            await this.displayCurrentPlayer();
        } else {
            console.log('No current player, showing waiting state');
            // Explicitly show waiting state
            const noPlayerState = document.getElementById('no-player-state');
            const playerDisplay = document.getElementById('player-display');
            if (noPlayerState) noPlayerState.classList.remove('hidden');
            if (playerDisplay) playerDisplay.classList.add('hidden');
        }
        
        // Setup realtime
        this.setupRealtime();
        
        // Render teams
        await this.renderTeams();
        
        console.log('=== AUCTION LIVE INIT COMPLETE ===');
    }
    
    setupEventListeners() {
        // Timer toggle
        document.getElementById('toggle-timer-btn')?.addEventListener('click', () => {
            this.toggleTimer();
        });
        
        // Role filter buttons
        document.querySelectorAll('.role-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.roleFilter = e.target.dataset.role;
                document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.populateDropdown();
            });
        });
        
        // Player selector
        document.getElementById('player-selector')?.addEventListener('change', (e) => {
            this.selectedPlayerId = e.target.value ? parseInt(e.target.value) : null;
            this.updateCallButton();
        });
        
        // Call button
        document.getElementById('call-player-btn')?.addEventListener('click', () => {
            this.callPlayer();
        });
        
        // Next player button (for auto modes)
        document.getElementById('next-player-btn')?.addEventListener('click', () => {
            this.callNextPlayer();
        });
        
        // Bid controls
        document.getElementById('bid-minus')?.addEventListener('click', () => this.adjustBid(-1));
        document.getElementById('bid-plus')?.addEventListener('click', () => this.adjustBid(1));
        document.getElementById('bid-btn')?.addEventListener('click', () => this.placeBid());
        document.getElementById('assign-btn')?.addEventListener('click', () => this.assignPlayer());
        
        // Sidebar
        document.getElementById('toggle-players-sidebar')?.addEventListener('click', () => {
            document.getElementById('players-sidebar')?.classList.toggle('open');
        });
        
        document.getElementById('close-sidebar')?.addEventListener('click', () => {
            document.getElementById('players-sidebar')?.classList.remove('open');
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
            
            // Load current bid separately
            const { data: bidData, error: bidError } = await supabaseManager.client
                .from('current_bids')
                .select('*')
                .eq('auction_id', this.auctionId);
            
            // Handle the response - expect array, take first item or null
            this.currentBid = (bidData && bidData.length > 0) ? bidData[0] : null;
            
            if (bidError) {
                console.error('Error loading bid:', bidError);
            }
            
            console.log('✅ Current bid loaded:', this.currentBid);
            
            // Find my team
            const userId = supabaseManager.currentUser?.id;
            this.myTeam = this.teams.find(t => t.user_id === userId);
            
            console.log('Auction loaded:', this.auction.name);
            console.log('Auction type:', this.auction.auction_type);
            console.log('Bid mode:', this.auction.bid_mode);
            console.log('Timer enabled:', this.auction.timer_enabled);
            console.log('Current player ID:', this.auction.current_player_id);
            
            // Update header
            const auctionNameEl = document.getElementById('live-auction-name');
            if (auctionNameEl) {
                auctionNameEl.textContent = this.auction.name;
            }
            
            // Update timer button
            const timerStatusEl = document.getElementById('timer-status-text');
            if (timerStatusEl) {
                timerStatusEl.textContent = `⏱️ Timer: ${this.auction.timer_enabled ? 'ON' : 'OFF'}`;
            }
            
            // Populate team dropdown for highest bidder
            this.populateTeamDropdown();
            
        } catch (error) {
            console.error('Error loading auction:', error);
            Utils.toast('Errore nel caricamento dell\'asta', 'error');
        }
    }
    
    populateTeamDropdown() {
        const dropdown = document.getElementById('highest-bidder-team');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">---</option>';
        this.teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            dropdown.appendChild(option);
        });
    }
    
    async loadPlayers() {
        try {
            const { data, error } = await supabaseManager.client
                .from('players')
                .select('*');
            
            if (error) throw error;
            
            this.players = data || [];
            console.log(`Loaded ${this.players.length} players`);
            
            // Add calculated fields
            const suffix = `_${this.auction.num_partecipanti}_nomod`; // Default nomod
            this.players = this.players.map(player => ({
                ...player,
                ia_value: player[`IA${suffix}`] || 0,
                slot_value: player[`Slot${suffix}`] || null,
                budget_max_value: player[`Budget MAX${suffix}`] || 0
            }));
            
        } catch (error) {
            console.error('Error loading players:', error);
            Utils.toast('Errore nel caricamento dei giocatori', 'error');
        }
    }
    
    setupAuctionTypeUI() {
        const manualSection = document.getElementById('manual-call-section');
        const autoSection = document.getElementById('auto-call-section');
        
        if (this.auction.auction_type === 'turn') {
            // Manual calling - show dropdown
            if (manualSection) manualSection.classList.remove('hidden');
            if (autoSection) autoSection.classList.add('hidden');
        } else {
            // Auto calling - hide dropdown
            if (manualSection) manualSection.classList.add('hidden');
            if (autoSection) autoSection.classList.remove('hidden');
            
            const autoText = document.getElementById('auto-call-text');
            if (autoText) {
                if (this.auction.auction_type === 'alphabetic') {
                    autoText.textContent = 'Sistema chiamerà giocatori in ordine alfabetico';
                } else {
                    autoText.textContent = 'Sistema chiamerà giocatori in modo casuale';
                }
            }
        }
    }
    
    async populateDropdown() {
        const dropdown = document.getElementById('player-selector');
        if (!dropdown) return;
        
        // Load assigned players (rosters)
        const { data: rosters } = await supabaseManager.client
            .from('rosters')
            .select('player_id')
            .eq('auction_id', this.auctionId);
        
        const assignedPlayerIds = new Set(rosters?.map(r => r.player_id) || []);
        
        // Filter by role
        let filtered = this.players;
        if (this.roleFilter !== 'all') {
            filtered = filtered.filter(p => p.R === this.roleFilter);
        }
        
        // Filter out assigned players
        filtered = filtered.filter(p => !assignedPlayerIds.has(p.Id));
        
        // Sort by name
        filtered.sort((a, b) => a.Nome.localeCompare(b.Nome));
        
        // Populate
        dropdown.innerHTML = '<option value="">-- Scegli un giocatore --</option>';
        filtered.forEach(player => {
            const option = document.createElement('option');
            option.value = player.Id;
            option.textContent = `${player.Nome} (${player.Squadra})`;
            dropdown.appendChild(option);
        });
        
        console.log(`Dropdown populated with ${filtered.length} available players`);
    }
    
    updateCallButton() {
        const btn = document.getElementById('call-player-btn');
        if (!btn) return;
        
        const hasSelection = !!this.selectedPlayerId;
        const noCurrentPlayer = !this.auction.current_player_id;
        const isMyTurn = this.auction.bid_mode === 'free' || 
                         this.auction.current_turn_team_id === this.myTeam?.id;
        
        btn.disabled = !(hasSelection && noCurrentPlayer && isMyTurn);
    }
    
    async callPlayer() {
        if (!this.selectedPlayerId) return;
        
        const player = this.players.find(p => p.Id === this.selectedPlayerId);
        if (!player) return;
        
        try {
            console.log('Calling player:', player.Nome);
            
            // Get starting price
            const startPrice = this.auction.starting_price_type === 'qt_a' 
                ? (player.qt_a || 1) 
                : 1;
            
            // Set current player in auction
            const { error: auctionError } = await supabaseManager.client
                .from('auctions')
                .update({ current_player_id: player.Id })
                .eq('id', this.auctionId);
            
            if (auctionError) throw auctionError;
            
            // Add to called_players
            await supabaseManager.client
                .from('called_players')
                .insert({
                    auction_id: this.auctionId,
                    player_id: player.Id
                });
            
            // UPSERT current bid (insert or update if exists)
            const { error: bidError } = await supabaseManager.client
                .from('current_bids')
                .upsert({
                    auction_id: this.auctionId,
                    player_id: player.Id,
                    team_id: this.myTeam.id,
                    amount: startPrice
                }, {
                    onConflict: 'auction_id'
                });
            
            if (bidError) throw bidError;
            
            Utils.toast(`Giocatore ${player.Nome} chiamato!`, 'success');
            
            // Reload auction to get updated state
            await this.loadAuction();
            await this.displayCurrentPlayer();
            
            // Start timer if enabled
            if (this.auction.timer_enabled) {
                this.startTimer();
            }
            
        } catch (error) {
            console.error('Error calling player:', error);
            Utils.toast('Errore nella chiamata del giocatore', 'error');
        }
    }
    
    async callNextPlayer() {
        // TODO: Implement auto-calling logic for alphabetic/random
        Utils.toast('Funzionalità in sviluppo', 'info');
    }
    
    async displayCurrentPlayer() {
        if (!this.auction.current_player_id) {
            // No player - show waiting state
            const noPlayerState = document.getElementById('no-player-state');
            const playerDisplay = document.getElementById('player-display');
            if (noPlayerState) noPlayerState.classList.remove('hidden');
            if (playerDisplay) playerDisplay.classList.add('hidden');
            return;
        }
        
        const player = this.players.find(p => p.Id === this.auction.current_player_id);
        if (!player) {
            console.error('Current player not found:', this.auction.current_player_id);
            return;
        }
        
        console.log('Displaying player:', player.Nome);
        
        // Hide waiting, show player
        const noPlayerState = document.getElementById('no-player-state');
        const playerDisplay = document.getElementById('player-display');
        if (noPlayerState) noPlayerState.classList.add('hidden');
        if (playerDisplay) playerDisplay.classList.remove('hidden');
        
        // Set player info
        const roleEl = document.getElementById('player-role');
        if (roleEl) {
            roleEl.textContent = player.R;
            const roleColor = Utils.getRoleColor(player.R);
            roleEl.style.color = roleColor;
            roleEl.style.borderColor = roleColor;
        }
        
        const playerNameEl = document.getElementById('player-name');
        if (playerNameEl) playerNameEl.textContent = player.Nome;
        
        const playerTeamEl = document.getElementById('player-team');
        if (playerTeamEl) playerTeamEl.textContent = player.Squadra;
        
        // Set stats
        const playerQtEl = document.getElementById('player-qt');
        if (playerQtEl) playerQtEl.textContent = player.qt_a || '-';
        
        const playerMvPrevEl = document.getElementById('player-mv-prev');
        if (playerMvPrevEl) {
            playerMvPrevEl.textContent = player.mv_previous_season ? player.mv_previous_season.toFixed(2) : '-';
        }
        
        const playerFmPrevEl = document.getElementById('player-fm-prev');
        if (playerFmPrevEl) {
            playerFmPrevEl.textContent = player.fantamedia_previous_season ? player.fantamedia_previous_season.toFixed(2) : '-';
        }
        
        const playerFmAllEl = document.getElementById('player-fm-all');
        if (playerFmAllEl) {
            playerFmAllEl.textContent = player.fantamedia_all_time ? player.fantamedia_all_time.toFixed(2) : '-';
        }
        
        // Calculate PMA: auction budget * Budget MAX column (same as Max Spesa)
        const suffix = `_${this.auction.num_partecipanti}_nomod`;
        const budgetMaxValue = player[`Budget MAX${suffix}`] || 0;
        
        const playerPmaEl = document.getElementById('player-pma');
        if (playerPmaEl) {
            const pmaValue = Math.round(this.auction.budget * budgetMaxValue);
            playerPmaEl.textContent = pmaValue > 0 ? pmaValue : '-';
        }
        
        // Calculate Max Spesa: same calculation
        const maxSpend = Math.round(this.auction.budget * budgetMaxValue);
        const playerMaxSpendEl = document.getElementById('player-max-spend');
        if (playerMaxSpendEl) {
            playerMaxSpendEl.textContent = maxSpend > 0 ? maxSpend : '-';
        }
        
        // Display highest bidder
        console.log('Current bid:', this.currentBid);
        
        if (this.currentBid) {
            const bidderTeam = this.teams.find(t => t.id === this.currentBid.team_id);
            console.log('Bidder team:', bidderTeam);
            
            const highestBidderTeamEl = document.getElementById('highest-bidder-team');
            if (highestBidderTeamEl) {
                highestBidderTeamEl.value = this.currentBid.team_id;
            }
            
            const highestBidAmountEl = document.getElementById('highest-bid-amount');
            if (highestBidAmountEl) {
                highestBidAmountEl.textContent = this.currentBid.amount;
            }
            
            // Update bid input minimum
            const bidInput = document.getElementById('bid-input');
            if (bidInput) {
                bidInput.min = this.currentBid.amount + 1;
                bidInput.value = this.currentBid.amount + 1;
            }
        } else {
            console.log('No current bid found');
            
            const highestBidderTeamEl = document.getElementById('highest-bidder-team');
            if (highestBidderTeamEl) {
                highestBidderTeamEl.value = '';
            }
            
            const highestBidAmountEl = document.getElementById('highest-bid-amount');
            if (highestBidAmountEl) {
                highestBidAmountEl.textContent = '1';
            }
            
            const bidInput = document.getElementById('bid-input');
            if (bidInput) {
                bidInput.min = 1;
                bidInput.value = 1;
            }
        }
        
        // Update button states
        this.updateBidButtons();
    }
    
    updateBidButtons() {
        const bidBtn = document.getElementById('bid-btn');
        const assignBtn = document.getElementById('assign-btn');
        
        if (!bidBtn || !assignBtn) return;
        
        // Bid button: enabled if not highest bidder and (free OR my turn)
        const isHighestBidder = this.currentBid?.team_id === this.myTeam?.id;
        const canBid = !isHighestBidder && (
            this.auction.bid_mode === 'free' || 
            this.auction.current_turn_team_id === this.myTeam?.id
        );
        bidBtn.disabled = !canBid;
        
        // Assign button: enabled if I'm highest bidder OR admin
        const isAdmin = this.auction.created_by === supabaseManager.currentUser?.id;
        assignBtn.disabled = !(isHighestBidder || isAdmin);
    }
    
    adjustBid(delta) {
        const input = document.getElementById('bid-input');
        if (!input) return;
        
        const currentValue = parseInt(input.value) || 1;
        const minValue = parseInt(input.min) || 1;
        const newValue = currentValue + delta;
        
        if (newValue >= minValue) {
            input.value = newValue;
        }
    }
    
    async placeBid() {
        const bidInput = document.getElementById('bid-input');
        if (!bidInput) return;
        
        const bidAmount = parseInt(bidInput.value);
        const minBid = (this.currentBid?.amount || 0) + 1;
        
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
                    amount: bidAmount,
                    timestamp: new Date().toISOString()
                })
                .eq('auction_id', this.auctionId);
            
            if (error) throw error;
            
            // Add to history
            await supabaseManager.client
                .from('bid_history')
                .insert({
                    auction_id: this.auctionId,
                    player_id: this.auction.current_player_id,
                    team_id: this.myTeam.id,
                    amount: bidAmount
                });
            
            Utils.toast('Offerta piazzata!', 'success');
            
            // Restart timer if enabled
            if (this.auction.timer_enabled) {
                this.startTimer();
            }
            
            // Reload to update UI
            await this.loadAuction();
            await this.displayCurrentPlayer();
            
        } catch (error) {
            console.error('Error placing bid:', error);
            Utils.toast('Errore nel rilancio', 'error');
        }
    }
    
    async assignPlayer() {
        if (!this.currentBid || !this.auction.current_player_id) return;
        
        const player = this.players.find(p => p.Id === this.auction.current_player_id);
        const team = this.teams.find(t => t.id === this.currentBid.team_id);
        
        if (!confirm(`Assegnare ${player.Nome} a ${team.name} per ${this.currentBid.amount}€?`)) {
            return;
        }
        
        try {
            // Use the assign_player function
            const { data, error } = await supabaseManager.client
                .rpc('assign_player', {
                    p_auction_id: this.auctionId,
                    p_player_id: this.auction.current_player_id,
                    p_team_id: this.currentBid.team_id,
                    p_amount: this.currentBid.amount
                });
            
            if (error) throw error;
            
            Utils.toast(`${player.Nome} assegnato a ${team.name}!`, 'success');
            
            // Stop timer
            this.stopTimer();
            
            // Clear current player from auction
            await supabaseManager.client
                .from('auctions')
                .update({ current_player_id: null })
                .eq('id', this.auctionId);
            
            // Delete current bid
            await supabaseManager.client
                .from('current_bids')
                .delete()
                .eq('auction_id', this.auctionId);
            
            // Reload
            await this.loadAuction();
            await this.loadPlayers();
            await this.populateDropdown();
            
            // Reset display to waiting state
            const noPlayerState = document.getElementById('no-player-state');
            const playerDisplay = document.getElementById('player-display');
            if (noPlayerState) noPlayerState.classList.remove('hidden');
            if (playerDisplay) playerDisplay.classList.add('hidden');
            
            // Refresh teams
            await this.renderTeams();
            
        } catch (error) {
            console.error('Error assigning player:', error);
            Utils.toast('Errore nell\'assegnazione', 'error');
        }
    }
    
    async toggleTimer() {
        try {
            const newState = !this.auction.timer_enabled;
            
            const { error } = await supabaseManager.client
                .from('auctions')
                .update({ timer_enabled: newState })
                .eq('id', this.auctionId);
            
            if (error) throw error;
            
            this.auction.timer_enabled = newState;
            const timerStatusEl = document.getElementById('timer-status-text');
            if (timerStatusEl) {
                timerStatusEl.textContent = `⏱️ Timer: ${newState ? 'ON' : 'OFF'}`;
            }
            
            if (newState && this.auction.current_player_id) {
                this.startTimer();
            } else {
                this.stopTimer();
            }
            
            Utils.toast(`Timer ${newState ? 'attivato' : 'disattivato'}`, 'success');
            
        } catch (error) {
            console.error('Error toggling timer:', error);
            Utils.toast('Errore nel cambio timer', 'error');
        }
    }
    
    startTimer() {
        this.stopTimer();
        this.timeRemaining = this.auction.timer_seconds || 10;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.assignPlayer(); // Auto-assign
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
        const display = document.getElementById('timer-countdown');
        if (!display) return;
        
        display.textContent = `${this.timeRemaining}s`;
        
        const parent = document.getElementById('timer-display');
        if (parent) {
            parent.classList.remove('warning', 'danger');
            if (this.timeRemaining <= 5 && this.timeRemaining > 3) {
                parent.classList.add('warning');
            } else if (this.timeRemaining <= 3) {
                parent.classList.add('danger');
            }
        }
    }
    
    setupRealtime() {
        this.realtimeChannel = supabaseManager.subscribeToAuction(this.auctionId, {
            onAuctionUpdate: async () => {
                await this.loadAuction();
                await this.displayCurrentPlayer();
                await this.renderTeams();
            },
            onBidUpdate: async () => {
                await this.loadAuction();
                await this.displayCurrentPlayer();
            },
            onRosterUpdate: async () => {
                await this.loadPlayers();
                await this.populateDropdown();
                await this.renderTeams();
            }
        });
    }
    
    async renderTeams() {
        const container = document.getElementById('teams-grid');
        if (!container) return;
        
        try {
            // Load rosters for all teams
            const { data: rosters, error: rostersError } = await supabaseManager.client
                .from('rosters')
                .select('*')
                .eq('auction_id', this.auctionId);
            
            if (rostersError) {
                console.error('Error loading rosters:', rostersError);
            }
            
            // Get unique player IDs from rosters
            const playerIds = [...new Set(rosters?.map(r => r.player_id) || [])];
            
            // Load player data separately if we have any
            let playersMap = {};
            if (playerIds.length > 0) {
                const { data: players } = await supabaseManager.client
                    .from('players')
                    .select('Id, Nome, R')
                    .in('Id', playerIds);
                
                players?.forEach(p => {
                    playersMap[p.Id] = p;
                });
            }
            
            const teamRosters = {};
            rosters?.forEach(roster => {
                if (!teamRosters[roster.team_id]) {
                    teamRosters[roster.team_id] = [];
                }
                teamRosters[roster.team_id].push({
                    ...roster,
                    player: playersMap[roster.player_id]
                });
            });
            
            // Sort teams by turn order
            const sortedTeams = [...this.teams].sort((a, b) => a.turn_order - b.turn_order);
            
            // Calculate card width based on number of teams
            // With 2px gap and ~12px total padding, we have more space
            const numTeams = sortedTeams.length;
            let cardWidth;
            if (numTeams <= 8) {
                cardWidth = 180;
            } else if (numTeams <= 10) {
                cardWidth = 155;
            } else {
                cardWidth = 135;
            }
            
            container.innerHTML = sortedTeams.map(team => {
                const roster = teamRosters[team.id] || [];
                const isMyTeam = team.id === this.myTeam?.id;
                
                // Calculate roster stats
                const rosterByRole = {
                    P: roster.filter(r => r.player?.R === 'P'),
                    D: roster.filter(r => r.player?.R === 'D'),
                    C: roster.filter(r => r.player?.R === 'C'),
                    A: roster.filter(r => r.player?.R === 'A')
                };
                
                const totalPlayers = roster.length;
                const totalSpent = roster.reduce((sum, r) => sum + r.purchase_price, 0);
                const budgetRemaining = team.budget_remaining || (this.auction.budget - totalSpent);
                
                // FIXED MAX SPENDING CALCULATION
                const totalSlots = this.auction.max_portieri + this.auction.max_difensori + 
                                  this.auction.max_centrocampisti + this.auction.max_attaccanti;
                const remainingSlots = totalSlots - totalPlayers;
                const maxSpending = budgetRemaining - (remainingSlots - 1);
                
                // Create slots by role for expanded view
                const slotsByRole = {
                    P: this.auction.max_portieri,
                    D: this.auction.max_difensori,
                    C: this.auction.max_centrocampisti,
                    A: this.auction.max_attaccanti
                };
                
                // Build role sections HTML - ALWAYS OPEN
                const roleSectionsHTML = ['P', 'D', 'C', 'A'].map(role => {
                    const playersInRole = rosterByRole[role];
                    const maxInRole = slotsByRole[role];
                    const emptySlots = maxInRole - playersInRole.length;
                    
                    // Sort players in role by price descending
                    const sortedPlayers = [...playersInRole].sort((a, b) => b.purchase_price - a.purchase_price);
                    
                    return `
                        <div class="role-section">
                            <div class="role-section-header">
                                <span class="roster-role-label role-${role.toLowerCase()}">${role}</span>
                                <span class="role-section-count">${playersInRole.length}/${maxInRole}</span>
                                <span class="role-section-arrow">▲</span>
                            </div>
                            <div class="role-section-content open">
                                ${sortedPlayers.map(p => `
                                    <div class="slot-item filled">
                                        <span class="slot-player-name">${p.player?.Nome || 'Unknown'}</span>
                                        <span class="slot-player-price">${p.purchase_price}</span>
                                    </div>
                                `).join('')}
                                ${Array(emptySlots).fill(0).map(() => `
                                    <div class="slot-item empty">
                                        <span class="slot-empty-text">---</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('');
                
                return `
                    <div class="team-card ${isMyTeam ? 'my-team' : ''}" 
                         style="width: ${cardWidth}px; padding: 12px;"
                         data-team-id="${team.id}">
                        
                        <div class="team-header">
                            <div class="team-avatar">${team.name.charAt(0).toUpperCase()}</div>
                            <div class="team-name" title="${team.name}">${team.name}</div>
                        </div>
                        
                        <div class="team-budget">
                            <span class="budget-icon">💰</span>
                            <span class="budget-value">${budgetRemaining}</span>
                        </div>
                        
                        <div class="team-stats">
                            <div class="team-stat-row">
                                <span>max</span>
                                <strong>${maxSpending}</strong>
                            </div>
                        </div>
                        
                        <div class="team-roster-summary">
                            ${roleSectionsHTML}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error rendering teams:', error);
        }
    }
    
    toggleTeamExpansion(teamId) {
        // REMOVED - Teams always expanded now
    }
    
    toggleRoleSection(teamId, role) {
        // REMOVED - Role sections always open now
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
