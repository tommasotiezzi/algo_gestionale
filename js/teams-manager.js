// =====================================
// TEAMS MANAGER
// =====================================

class TeamsManager {
    constructor() {
        this.auctionId = null;
        this.auction = null;
        this.teams = [];
        this.rosters = [];
        this.players = {};
        this.currentView = 'grid';
        this.selectedTeamId = null;
        this.compareTeam1 = null;
        this.compareTeam2 = null;
    }
    
    async init() {
        console.log('Initializing Teams Manager...');
        
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
        await this.loadTeams();
    }
    
    setupEventListeners() {
        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchView(e.target.closest('.view-tab').dataset.view);
            });
        });
        
        // Export button
        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.showExportModal();
        });
        
        // Team filter
        document.getElementById('team-filter')?.addEventListener('change', (e) => {
            this.filterTeams(e.target.value);
        });
        
        // Compare selectors
        document.getElementById('compare-team-1')?.addEventListener('change', (e) => {
            this.compareTeam1 = e.target.value;
            this.updateCompareView();
        });
        
        document.getElementById('compare-team-2')?.addEventListener('change', (e) => {
            this.compareTeam2 = e.target.value;
            this.updateCompareView();
        });
        
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
            
            // Update header
            document.getElementById('teams-auction-name').textContent = this.auction.name;
            
            const statusBadge = document.getElementById('teams-auction-status');
            statusBadge.textContent = this.auction.status === 'completed' ? 'Completata' : 'In Corso';
            statusBadge.className = `auction-badge ${this.auction.status}`;
            
        } catch (error) {
            console.error('Error loading auction:', error);
            Utils.toast('Errore nel caricamento dell\'asta', 'error');
        }
    }
    
    async loadTeams() {
        try {
            // Show loading
            this.showLoading();
            
            // Load all teams with their rosters
            const { data: teams, error: teamsError } = await supabaseManager.client
                .from('teams')
                .select(`
                    *,
                    profile:profiles(username)
                `)
                .eq('auction_id', this.auctionId);
            
            if (teamsError) throw teamsError;
            
            this.teams = teams || [];
            
            // Load all rosters
            const { data: rosters, error: rostersError } = await supabaseManager.client
                .from('rosters')
                .select(`
                    *,
                    player_id
                `)
                .eq('auction_id', this.auctionId);
            
            if (rostersError) throw rostersError;
            
            this.rosters = rosters || [];
            
            // Load players data
            await this.loadPlayersData();
            
            // Update UI
            this.updateStats();
            this.populateFilters();
            this.renderView();
            
        } catch (error) {
            console.error('Error loading teams:', error);
            Utils.toast('Errore nel caricamento delle rose', 'error');
            this.showEmptyState();
        }
    }
    
    async loadPlayersData() {
        // Get unique player IDs
        const playerIds = [...new Set(this.rosters.map(r => r.player_id))];
        
        if (playerIds.length === 0) return;
        
        // Load players
        const { data: players } = await supabaseManager.client
            .from('players')
            .select('*')
            .in('Id', playerIds);
        
        // Create lookup map
        this.players = {};
        players?.forEach(player => {
            // Add dynamic fields based on auction settings
            const suffix = `_${this.auction.num_partecipanti}_nomod`; // Default no modifier
            player.ia_value = player[`IA${suffix}`] || 0;
            player.slot_value = player[`Slot${suffix}`] || null;
            this.players[player.Id] = player;
        });
    }
    
    updateStats() {
        const totalPlayers = this.rosters.length;
        const totalSpent = this.rosters.reduce((sum, r) => sum + r.purchase_price, 0);
        const avgPrice = totalPlayers > 0 ? Math.round(totalSpent / totalPlayers) : 0;
        
        document.getElementById('total-teams').textContent = this.teams.length;
        document.getElementById('total-players').textContent = totalPlayers;
        document.getElementById('total-spent').textContent = `${totalSpent} €`;
        document.getElementById('avg-price').textContent = `${avgPrice} €`;
    }
    
    populateFilters() {
        const teamFilter = document.getElementById('team-filter');
        const compare1 = document.getElementById('compare-team-1');
        const compare2 = document.getElementById('compare-team-2');
        
        const teamOptions = this.teams.map(team => 
            `<option value="${team.id}">${team.name}</option>`
        ).join('');
        
        if (teamFilter) {
            teamFilter.innerHTML = `
                <option value="all">Tutti i Team</option>
                ${teamOptions}
            `;
        }
        
        if (compare1) {
            compare1.innerHTML = `
                <option value="">Seleziona Team 1</option>
                ${teamOptions}
            `;
        }
        
        if (compare2) {
            compare2.innerHTML = `
                <option value="">Seleziona Team 2</option>
                ${teamOptions}
            `;
        }
    }
    
    switchView(view) {
        this.currentView = view;
        
        // Update tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
        
        // Hide all containers
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });
        
        // Show selected container
        document.getElementById(`${view}-view`)?.classList.add('active');
        
        // Render appropriate view
        this.renderView();
    }
    
    renderView() {
        switch (this.currentView) {
            case 'grid':
                this.renderGridView();
                break;
            case 'compare':
                this.updateCompareView();
                break;
            case 'stats':
                this.renderStatsView();
                break;
        }
    }
    
    renderGridView() {
        const container = document.getElementById('teams-grid');
        if (!container) return;
        
        if (this.teams.length === 0) {
            this.showEmptyState();
            return;
        }
        
        container.innerHTML = this.teams.map(team => this.createTeamCard(team)).join('');
        
        // Add click listeners
        container.querySelectorAll('.team-card').forEach(card => {
            card.addEventListener('click', () => {
                const teamId = card.dataset.teamId;
                this.showTeamDetail(teamId);
            });
        });
    }
    
    createTeamCard(team) {
        const teamRosters = this.rosters.filter(r => r.team_id === team.id);
        const budgetSpent = teamRosters.reduce((sum, r) => sum + r.purchase_price, 0);
        const budgetRemaining = team.budget_remaining || 0;
        
        // Count by role
        const roleCount = { P: 0, D: 0, C: 0, A: 0 };
        teamRosters.forEach(roster => {
            const player = this.players[roster.player_id];
            if (player) {
                roleCount[player.R] = (roleCount[player.R] || 0) + 1;
            }
        });
        
        return `
            <div class="team-card" data-team-id="${team.id}">
                <div class="team-card-header">
                    <div>
                        <div class="team-card-name">${team.name}</div>
                        <div class="team-card-owner">${team.profile?.username || 'Utente'}</div>
                    </div>
                </div>
                
                <div class="team-card-stats">
                    <div class="team-stat">
                        <span class="team-stat-label">Speso</span>
                        <span class="team-stat-value">${budgetSpent} €</span>
                    </div>
                    <div class="team-stat">
                        <span class="team-stat-label">Rimanente</span>
                        <span class="team-stat-value">${budgetRemaining} €</span>
                    </div>
                    <div class="team-stat">
                        <span class="team-stat-label">Giocatori</span>
                        <span class="team-stat-value">${teamRosters.length}</span>
                    </div>
                    <div class="team-stat">
                        <span class="team-stat-label">Media</span>
                        <span class="team-stat-value">
                            ${teamRosters.length > 0 ? Math.round(budgetSpent / teamRosters.length) : 0} €
                        </span>
                    </div>
                </div>
                
                <div class="team-card-roster">
                    <div class="roster-role">
                        <span class="roster-role-icon" style="color: var(--role-p)">P</span>
                        <span class="roster-role-count">${roleCount.P}</span>
                    </div>
                    <div class="roster-role">
                        <span class="roster-role-icon" style="color: var(--role-d)">D</span>
                        <span class="roster-role-count">${roleCount.D}</span>
                    </div>
                    <div class="roster-role">
                        <span class="roster-role-icon" style="color: var(--role-c)">C</span>
                        <span class="roster-role-count">${roleCount.C}</span>
                    </div>
                    <div class="roster-role">
                        <span class="roster-role-icon" style="color: var(--role-a)">A</span>
                        <span class="roster-role-count">${roleCount.A}</span>
                    </div>
                </div>
                
                <div class="team-card-footer">
                    <button class="team-action-btn" onclick="event.stopPropagation(); teamsManager.showTeamDetail('${team.id}')">
                        Visualizza Rosa
                    </button>
                </div>
            </div>
        `;
    }
    
    showTeamDetail(teamId) {
        const team = this.teams.find(t => t.id === teamId);
        if (!team) return;
        
        this.selectedTeamId = teamId;
        
        const teamRosters = this.rosters.filter(r => r.team_id === teamId);
        const budgetSpent = teamRosters.reduce((sum, r) => sum + r.purchase_price, 0);
        
        // Calculate average IA
        let totalIA = 0;
        let iaCount = 0;
        teamRosters.forEach(roster => {
            const player = this.players[roster.player_id];
            if (player && player.ia_value) {
                totalIA += player.ia_value;
                iaCount++;
            }
        });
        const avgIA = iaCount > 0 ? (totalIA / iaCount).toFixed(1) : 0;
        
        // Update modal header
        document.getElementById('modal-team-name').textContent = team.name;
        
        // Update summary
        document.getElementById('modal-budget-spent').textContent = `${budgetSpent} €`;
        document.getElementById('modal-budget-remaining').textContent = `${team.budget_remaining || 0} €`;
        document.getElementById('modal-players-count').textContent = teamRosters.length;
        document.getElementById('modal-avg-ia').textContent = avgIA;
        
        // Group players by role
        const playersByRole = { P: [], D: [], C: [], A: [] };
        teamRosters.forEach(roster => {
            const player = this.players[roster.player_id];
            if (player) {
                playersByRole[player.R]?.push({ player, price: roster.purchase_price });
            }
        });
        
        // Render players by role
        this.renderRolePlayers('modal-portieri', playersByRole.P);
        this.renderRolePlayers('modal-difensori', playersByRole.D);
        this.renderRolePlayers('modal-centrocampisti', playersByRole.C);
        this.renderRolePlayers('modal-attaccanti', playersByRole.A);
        
        // Show modal
        document.getElementById('team-detail-modal').classList.remove('hidden');
    }
    
    renderRolePlayers(containerId, players) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (players.length === 0) {
            container.innerHTML = '<p class="text-muted">Nessun giocatore</p>';
            return;
        }
        
        // Sort by price descending
        players.sort((a, b) => b.price - a.price);
        
        container.innerHTML = players.map(({ player, price }) => `
            <div class="roster-player">
                <div class="roster-player-info">
                    <div class="roster-player-name">${player.Nome}</div>
                    <div class="roster-player-team">${player.Squadra}</div>
                </div>
                <div class="roster-player-price">${price} €</div>
            </div>
        `).join('');
    }
    
    updateCompareView() {
        const container = document.getElementById('compare-content');
        if (!container) return;
        
        if (!this.compareTeam1 || !this.compareTeam2) {
            container.innerHTML = `
                <div class="compare-empty">
                    <p>Seleziona due team da confrontare</p>
                </div>
            `;
            return;
        }
        
        const team1 = this.teams.find(t => t.id === this.compareTeam1);
        const team2 = this.teams.find(t => t.id === this.compareTeam2);
        
        if (!team1 || !team2) return;
        
        const stats1 = this.getTeamStats(team1.id);
        const stats2 = this.getTeamStats(team2.id);
        
        container.innerHTML = `
            <div class="compare-team">
                <div class="compare-team-header">
                    <div class="compare-team-name">${team1.name}</div>
                </div>
                <div class="compare-stats">
                    ${this.createCompareRow('Budget Speso', stats1.spent, stats2.spent, '€')}
                    ${this.createCompareRow('Giocatori', stats1.players, stats2.players)}
                    ${this.createCompareRow('Media Prezzo', stats1.avgPrice, stats2.avgPrice, '€')}
                    ${this.createCompareRow('Media IA', stats1.avgIA, stats2.avgIA)}
                    ${this.createCompareRow('Portieri', stats1.roleCount.P, stats2.roleCount.P)}
                    ${this.createCompareRow('Difensori', stats1.roleCount.D, stats2.roleCount.D)}
                    ${this.createCompareRow('Centrocampisti', stats1.roleCount.C, stats2.roleCount.C)}
                    ${this.createCompareRow('Attaccanti', stats1.roleCount.A, stats2.roleCount.A)}
                </div>
            </div>
            
            <div class="compare-divider">VS</div>
            
            <div class="compare-team">
                <div class="compare-team-header">
                    <div class="compare-team-name">${team2.name}</div>
                </div>
                <div class="compare-stats">
                    ${this.createCompareRow('Budget Speso', stats2.spent, stats1.spent, '€')}
                    ${this.createCompareRow('Giocatori', stats2.players, stats1.players)}
                    ${this.createCompareRow('Media Prezzo', stats2.avgPrice, stats1.avgPrice, '€')}
                    ${this.createCompareRow('Media IA', stats2.avgIA, stats1.avgIA)}
                    ${this.createCompareRow('Portieri', stats2.roleCount.P, stats1.roleCount.P)}
                    ${this.createCompareRow('Difensori', stats2.roleCount.D, stats1.roleCount.D)}
                    ${this.createCompareRow('Centrocampisti', stats2.roleCount.C, stats1.roleCount.C)}
                    ${this.createCompareRow('Attaccanti', stats2.roleCount.A, stats1.roleCount.A)}
                </div>
            </div>
        `;
    }
    
    createCompareRow(label, value1, value2, suffix = '') {
        const isBetter = value1 > value2;
        const isWorse = value1 < value2;
        const className = isBetter ? 'better' : isWorse ? 'worse' : '';
        
        return `
            <div class="compare-stat">
                <span class="compare-stat-label">${label}</span>
                <span class="compare-stat-value ${className}">${value1}${suffix}</span>
            </div>
        `;
    }
    
    getTeamStats(teamId) {
        const teamRosters = this.rosters.filter(r => r.team_id === teamId);
        const spent = teamRosters.reduce((sum, r) => sum + r.purchase_price, 0);
        const players = teamRosters.length;
        const avgPrice = players > 0 ? Math.round(spent / players) : 0;
        
        // Calculate average IA
        let totalIA = 0;
        let iaCount = 0;
        const roleCount = { P: 0, D: 0, C: 0, A: 0 };
        
        teamRosters.forEach(roster => {
            const player = this.players[roster.player_id];
            if (player) {
                roleCount[player.R] = (roleCount[player.R] || 0) + 1;
                if (player.ia_value) {
                    totalIA += player.ia_value;
                    iaCount++;
                }
            }
        });
        
        const avgIA = iaCount > 0 ? (totalIA / iaCount).toFixed(1) : 0;
        
        return { spent, players, avgPrice, avgIA, roleCount };
    }
    
    renderStatsView() {
        // Top purchases
        this.renderTopPurchases();
        
        // Best deals
        this.renderBestDeals();
        
        // Team rankings
        this.renderTeamRankings();
    }
    
    renderTopPurchases() {
        const container = document.getElementById('top-purchases');
        if (!container) return;
        
        // Get all purchases sorted by price
        const purchases = this.rosters.map(r => ({
            player: this.players[r.player_id],
            price: r.purchase_price,
            team: this.teams.find(t => t.id === r.team_id)
        })).filter(p => p.player).sort((a, b) => b.price - a.price).slice(0, 5);
        
        container.innerHTML = purchases.map((purchase, index) => `
            <div class="stat-item">
                <div class="stat-item-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">
                    ${index + 1}
                </div>
                <div class="stat-item-info">
                    <div class="stat-item-name">${purchase.player.Nome}</div>
                    <div class="stat-item-detail">${purchase.team?.name || 'Team'}</div>
                </div>
                <div class="stat-item-value">${purchase.price} €</div>
            </div>
        `).join('');
    }
    
    renderBestDeals() {
        const container = document.getElementById('best-deals');
        if (!container) return;
        
        // Calculate value (IA/price ratio)
        const deals = this.rosters.map(r => {
            const player = this.players[r.player_id];
            const team = this.teams.find(t => t.id === r.team_id);
            const value = player && player.ia_value ? player.ia_value / r.purchase_price : 0;
            
            return { player, price: r.purchase_price, team, value };
        }).filter(d => d.player && d.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        
        container.innerHTML = deals.map((deal, index) => `
            <div class="stat-item">
                <div class="stat-item-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">
                    ${index + 1}
                </div>
                <div class="stat-item-info">
                    <div class="stat-item-name">${deal.player.Nome}</div>
                    <div class="stat-item-detail">${deal.team?.name || 'Team'} - IA: ${deal.player.ia_value}</div>
                </div>
                <div class="stat-item-value">${deal.price} €</div>
            </div>
        `).join('');
    }
    
    renderTeamRankings() {
        const container = document.getElementById('team-rankings');
        if (!container) return;
        
        // Calculate team scores
        const rankings = this.teams.map(team => {
            const stats = this.getTeamStats(team.id);
            return { team, stats, score: parseFloat(stats.avgIA) };
        }).sort((a, b) => b.score - a.score);
        
        container.innerHTML = rankings.map((ranking, index) => `
            <div class="stat-item">
                <div class="stat-item-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">
                    ${index + 1}
                </div>
                <div class="stat-item-info">
                    <div class="stat-item-name">${ranking.team.name}</div>
                    <div class="stat-item-detail">${ranking.stats.players} giocatori</div>
                </div>
                <div class="stat-item-value">IA: ${ranking.score.toFixed(1)}</div>
            </div>
        `).join('');
    }
    
    filterTeams(teamId) {
        if (teamId === 'all') {
            this.renderGridView();
        } else {
            this.showTeamDetail(teamId);
        }
    }
    
    showExportModal() {
        document.getElementById('export-modal').classList.remove('hidden');
    }
    
    async performExport() {
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'csv';
        const includePrices = document.getElementById('export-prices').checked;
        const includeStats = document.getElementById('export-stats').checked;
        
        // Prepare data
        const exportData = this.prepareExportData(includePrices, includeStats);
        
        switch (format) {
            case 'csv':
                Utils.exportToCSV(exportData, `asta_${this.auction.name}_rose.csv`);
                break;
            case 'json':
                Utils.exportToJSON(exportData, `asta_${this.auction.name}_rose.json`);
                break;
            case 'pdf':
                this.exportToPDF(exportData);
                break;
        }
        
        // Close modal
        document.getElementById('export-modal').classList.add('hidden');
        Utils.toast('Export completato!', 'success');
    }
    
    prepareExportData(includePrices, includeStats) {
        const data = [];
        
        this.teams.forEach(team => {
            const teamRosters = this.rosters.filter(r => r.team_id === team.id);
            
            teamRosters.forEach(roster => {
                const player = this.players[roster.player_id];
                if (!player) return;
                
                const row = {
                    Team: team.name,
                    Ruolo: player.R,
                    Giocatore: player.Nome,
                    Squadra: player.Squadra
                };
                
                if (includePrices) {
                    row.Prezzo = roster.purchase_price;
                }
                
                if (includeStats) {
                    row.IA = player.ia_value || '-';
                    row.Slot = player.slot_value || '-';
                }
                
                data.push(row);
            });
        });
        
        return data;
    }
    
    exportToPDF(data) {
        // For PDF, we'll open a print-friendly window
        const printWindow = window.open('', '_blank');
        const html = this.generatePrintHTML(data);
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    }
    
    generatePrintHTML(data) {
        // Group by team
        const teamGroups = {};
        data.forEach(row => {
            if (!teamGroups[row.Team]) {
                teamGroups[row.Team] = [];
            }
            teamGroups[row.Team].push(row);
        });
        
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Rose Asta ${this.auction.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    h1 { text-align: center; }
                    .team { page-break-inside: avoid; margin-bottom: 30px; }
                    .team h2 { border-bottom: 2px solid #333; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background: #f5f5f5; }
                </style>
            </head>
            <body>
                <h1>Rose Asta: ${this.auction.name}</h1>
        `;
        
        Object.entries(teamGroups).forEach(([teamName, players]) => {
            html += `
                <div class="team">
                    <h2>${teamName}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Ruolo</th>
                                <th>Giocatore</th>
                                <th>Squadra</th>
                                ${data[0].Prezzo !== undefined ? '<th>Prezzo</th>' : ''}
                                ${data[0].IA !== undefined ? '<th>IA</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            players.forEach(player => {
                html += `
                    <tr>
                        <td>${player.Ruolo}</td>
                        <td>${player.Giocatore}</td>
                        <td>${player.Squadra}</td>
                        ${player.Prezzo !== undefined ? `<td>${player.Prezzo} €</td>` : ''}
                        ${player.IA !== undefined ? `<td>${player.IA}</td>` : ''}
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        html += '</body></html>';
        return html;
    }
    
    exportTeam() {
        if (!this.selectedTeamId) return;
        
        const team = this.teams.find(t => t.id === this.selectedTeamId);
        if (!team) return;
        
        const teamRosters = this.rosters.filter(r => r.team_id === this.selectedTeamId);
        const data = teamRosters.map(roster => {
            const player = this.players[roster.player_id];
            return {
                Ruolo: player?.R || '-',
                Giocatore: player?.Nome || '-',
                Squadra: player?.Squadra || '-',
                Prezzo: roster.purchase_price,
                IA: player?.ia_value || '-',
                Slot: player?.slot_value || '-'
            };
        });
        
        Utils.exportToCSV(data, `rosa_${team.name}.csv`);
        Utils.toast('Rosa esportata!', 'success');
    }
    
    showLoading() {
        const container = document.getElementById('teams-grid');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading"></div>
                    <p>Caricamento rose...</p>
                </div>
            `;
        }
    }
    
    showEmptyState() {
        const container = document.getElementById('teams-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Nessuna rosa disponibile</p>
                    <p>L'asta deve essere completata per visualizzare le rose</p>
                </div>
            `;
        }
    }
}

// Create global instance
window.teamsManager = new TeamsManager();