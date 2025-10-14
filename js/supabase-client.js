// =====================================
// SUPABASE CLIENT & DATABASE MANAGER
// =====================================

class SupabaseManager {
    constructor() {
        this.client = null;
        this.session = null;
        this.currentUser = null;
        this.init();
    }
    
    // Initialize Supabase client
    init() {
        if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
            console.error('Supabase configuration missing!');
            return;
        }
        
        this.client = supabase.createClient(
            CONFIG.SUPABASE_URL,
            CONFIG.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true
                }
            }
        );
        
        // Listen for auth changes
        this.client.auth.onAuthStateChange((event, session) => {
            this.handleAuthChange(event, session);
        });
        
        // Check initial session
        this.checkSession();
    }
    
    // Handle auth state changes
    handleAuthChange(event, session) {
        this.session = session;
        this.currentUser = session?.user || null;
        
        if (CONFIG.DEBUG) {
            console.log('Auth state changed:', event, this.currentUser);
        }
        
        // Emit custom event
        window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { event, session, user: this.currentUser }
        }));
    }
    
    // Check current session
    async checkSession() {
        try {
            const { data: { session }, error } = await this.client.auth.getSession();
            if (error) throw error;
            
            this.session = session;
            this.currentUser = session?.user || null;
            return session;
        } catch (error) {
            console.error('Error checking session:', error);
            return null;
        }
    }
    
    // =====================================
    // AUTH METHODS
    // =====================================
    
    async signUp(email, password, username) {
        try {
            // Sign up user
            const { data, error } = await this.client.auth.signUp({
                email,
                password
            });
            
            if (error) throw error;
            
            // Create profile
            if (data.user) {
                await this.createProfile(data.user.id, username, email);
            }
            
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async signIn(email, password) {
        try {
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async signOut() {
        try {
            const { error } = await this.client.auth.signOut();
            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // =====================================
    // PROFILE METHODS
    // =====================================
    
    async createProfile(userId, username, email) {
        try {
            const { data, error } = await this.client
                .from('profiles')
                .insert({
                    id: userId,
                    username,
                    email
                });
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async getProfile(userId = null) {
        try {
            const id = userId || this.currentUser?.id;
            if (!id) throw new Error('User ID required');
            
            const { data, error } = await this.client
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // =====================================
    // AUCTION METHODS
    // =====================================
    
    async createAuction(auctionData) {
        try {
            const code = await this.generateAuctionCode();
            
            const { data, error } = await this.client
                .from('auctions')
                .insert({
                    ...auctionData,
                    code,
                    created_by: this.currentUser.id
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // Auto-join creator to auction
            await this.joinAuction(data.id, auctionData.creatorTeamName || 'Team Admin');
            
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async generateAuctionCode() {
        let code, exists;
        do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { data } = await this.client
                .from('auctions')
                .select('code')
                .eq('code', code)
                .single();
            exists = !!data;
        } while (exists);
        
        return code;
    }
    
    async joinAuction(auctionId, teamName) {
        try {
            // Get auction settings
            const { data: auction, error: auctionError } = await this.client
                .from('auctions')
                .select('budget, num_partecipanti')
                .eq('id', auctionId)
                .single();
            
            if (auctionError) throw auctionError;
            
            // Check if already in auction
            const { data: existingTeam } = await this.client
                .from('teams')
                .select('id')
                .eq('auction_id', auctionId)
                .eq('user_id', this.currentUser.id)
                .single();
            
            if (existingTeam) {
                return { success: false, error: 'Sei già in questa asta' };
            }
            
            // Get current team count
            const { count } = await this.client
                .from('teams')
                .select('*', { count: 'exact', head: true })
                .eq('auction_id', auctionId);
            
            if (count >= auction.num_partecipanti) {
                return { success: false, error: 'Asta piena' };
            }
            
            // Create team
            const { data, error } = await this.client
                .from('teams')
                .insert({
                    auction_id: auctionId,
                    user_id: this.currentUser.id,
                    name: teamName,
                    budget_remaining: auction.budget,
                    turn_order: count + 1
                })
                .select()
                .single();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async getAuctionByCode(code) {
        try {
            const { data, error } = await this.client
                .from('auctions')
                .select(`
                    *,
                    created_by_profile:profiles!created_by(username),
                    teams(*)
                `)
                .eq('code', code.toUpperCase())
                .single();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async getAuction(auctionId) {
        try {
            const { data, error } = await this.client
                .from('auctions')
                .select(`
                    *,
                    teams(
                        *,
                        profile:profiles(username)
                    ),
                    current_bids(
                        *,
                        team:teams(name)
                    )
                `)
                .eq('id', auctionId)
                .single();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async getUserAuctions() {
        try {
            const { data, error } = await this.client
                .from('auctions')
                .select(`
                    *,
                    teams!inner(user_id)
                `)
                .or(`created_by.eq.${this.currentUser.id},teams.user_id.eq.${this.currentUser.id}`);
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async updateAuctionStatus(auctionId, status) {
        try {
            const { data, error } = await this.client
                .from('auctions')
                .update({ status })
                .eq('id', auctionId)
                .select()
                .single();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // =====================================
    // BID METHODS
    // =====================================
    
    async placeBid(auctionId, playerId, teamId, amount) {
        try {
            const { data, error } = await this.client
                .rpc('place_bid', {
                    p_auction_id: auctionId,
                    p_player_id: playerId,
                    p_team_id: teamId,
                    p_amount: amount
                });
            
            if (error) throw error;
            
            if (!data.success) {
                return { success: false, error: data.error };
            }
            
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async assignPlayer(auctionId, playerId, teamId, amount) {
        try {
            const { data, error } = await this.client
                .rpc('assign_player', {
                    p_auction_id: auctionId,
                    p_player_id: playerId,
                    p_team_id: teamId,
                    p_amount: amount
                });
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // =====================================
    // PLAYER METHODS
    // =====================================
    
    async getPlayers(filters = {}) {
        try {
            let query = this.client.from('players').select('*');
            
            // Apply filters
            if (filters.role) {
                query = query.eq('R', filters.role);
            }
            if (filters.search) {
                query = query.or(`Nome.ilike.%${filters.search}%,Squadra.ilike.%${filters.search}%`);
            }
            if (filters.auctionId) {
                // Get called players
                const { data: calledPlayers } = await this.client
                    .from('called_players')
                    .select('player_id')
                    .eq('auction_id', filters.auctionId);
                
                const calledIds = calledPlayers?.map(p => p.player_id) || [];
                if (calledIds.length > 0) {
                    query = query.not('Id', 'in', `(${calledIds.join(',')})`);
                }
            }
            
            // Execute query
            const { data, error } = await query;
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async getPlayer(playerId) {
        try {
            const { data, error } = await this.client
                .from('players')
                .select('*')
                .eq('Id', playerId)
                .single();
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // =====================================
    // ROSTER METHODS
    // =====================================
    
    async getTeamRoster(teamId) {
        try {
            const { data, error } = await this.client
                .from('rosters')
                .select(`
                    *,
                    player:players(*)
                `)
                .eq('team_id', teamId)
                .order('purchase_price', { ascending: false });
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async getAuctionRosters(auctionId) {
        try {
            const { data, error } = await this.client
                .from('rosters')
                .select(`
                    *,
                    player:players(*),
                    team:teams(name)
                `)
                .eq('auction_id', auctionId);
            
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // =====================================
    // REALTIME SUBSCRIPTIONS
    // =====================================
    
    subscribeToAuction(auctionId, callbacks) {
        const channel = this.client
            .channel(`auction-${auctionId}`)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` },
                callbacks.onAuctionUpdate || (() => {})
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'current_bids', filter: `auction_id=eq.${auctionId}` },
                callbacks.onBidUpdate || (() => {})
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'rosters', filter: `auction_id=eq.${auctionId}` },
                callbacks.onRosterUpdate || (() => {})
            )
            .subscribe();
        
        return channel;
    }
    
    unsubscribe(channel) {
        this.client.removeChannel(channel);
    }
}

// Create global instance
const supabaseManager = new SupabaseManager();