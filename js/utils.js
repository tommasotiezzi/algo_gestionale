// =====================================
// UTILITY FUNCTIONS
// =====================================

const Utils = {
    
    // =====================================
    // DOM UTILITIES
    // =====================================
    
    // Query selector shortcuts
    $(selector, context = document) {
        return context.querySelector(selector);
    },
    
    $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    },
    
    // Create element with attributes
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'class') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('data-')) {
                element.dataset[key.slice(5)] = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    },
    
    // Show/hide elements
    show(element) {
        if (element) element.classList.remove('hidden');
    },
    
    hide(element) {
        if (element) element.classList.add('hidden');
    },
    
    toggle(element, condition) {
        if (element) {
            element.classList.toggle('hidden', !condition);
        }
    },
    
    // =====================================
    // FORMATTING UTILITIES
    // =====================================
    
    // Format currency
    formatCurrency(value, symbol = '€') {
        return `${value} ${symbol}`;
    },
    
    // Format number with separator
    formatNumber(value) {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },
    
    // Format date
    formatDate(date, format = 'short') {
        const d = new Date(date);
        const options = {
            short: { day: '2-digit', month: '2-digit', year: 'numeric' },
            long: { day: 'numeric', month: 'long', year: 'numeric' },
            time: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        };
        
        return d.toLocaleDateString('it-IT', options[format] || options.short);
    },
    
    // Format time ago
    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        const intervals = {
            anno: 31536000,
            mese: 2592000,
            settimana: 604800,
            giorno: 86400,
            ora: 3600,
            minuto: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                const plural = interval === 1 ? unit : 
                    unit === 'mese' ? 'mesi' : 
                    unit.endsWith('a') ? unit.slice(0, -1) + 'e' : 
                    unit.endsWith('o') ? unit.slice(0, -1) + 'i' : unit + 'i';
                return `${interval} ${plural} fa`;
            }
        }
        
        return 'Adesso';
    },
    
    // Truncate text
    truncate(text, length = 50, suffix = '...') {
        if (text.length <= length) return text;
        return text.substring(0, length - suffix.length) + suffix;
    },
    
    // Capitalize first letter
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    // =====================================
    // PLAYER UTILITIES
    // =====================================
    
    // Get role color
    getRoleColor(role) {
        return CONFIG.ROLE_COLORS[role] || '#666';
    },
    
    // Get role name
    getRoleName(role) {
        return CONFIG.ROLE_NAMES[role] || 'Sconosciuto';
    },
    
    // Get role icon
    getRoleIcon(role) {
        const icons = {
            P: '🧤',
            D: '🛡️',
            C: '⚡',
            A: '⚽'
        };
        return icons[role] || '👤';
    },
    
    // Format player name
    formatPlayerName(nome, squadra = null) {
        const nameParts = nome.split(' ');
        const shortName = nameParts.length > 2 
            ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` 
            : nome;
        
        return squadra ? `${shortName} (${squadra})` : shortName;
    },
    
    // Get player column value based on settings
    getPlayerColumnValue(player, columnBase, numPartecipanti, hasModifier) {
        const suffix = `_${numPartecipanti}_${hasModifier ? 'mod' : 'nomod'}`;
        const columnName = `${columnBase}${suffix}`;
        return player[columnName];
    },
    
    // Sort players by slot and IA
    sortPlayersBySlotAndIA(players, numPartecipanti, hasModifier) {
        const suffix = `_${numPartecipanti}_${hasModifier ? 'mod' : 'nomod'}`;
        
        return players.sort((a, b) => {
            const slotA = a[`Slot${suffix}`] || 999;
            const slotB = b[`Slot${suffix}`] || 999;
            
            if (slotA !== slotB) {
                return slotA - slotB;
            }
            
            const iaA = a[`IA${suffix}`] || 0;
            const iaB = b[`IA${suffix}`] || 0;
            
            return iaB - iaA; // Higher IA first
        });
    },
    
    // =====================================
    // STORAGE UTILITIES
    // =====================================
    
    // Local storage with JSON
    storage: {
        get(key) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                console.error('Storage get error:', e);
                return null;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage set error:', e);
                return false;
            }
        },
        
        remove(key) {
            localStorage.removeItem(key);
        },
        
        clear() {
            localStorage.clear();
        }
    },
    
    // Session storage
    session: {
        get(key) {
            try {
                const item = sessionStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                console.error('Session get error:', e);
                return null;
            }
        },
        
        set(key, value) {
            try {
                sessionStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Session set error:', e);
                return false;
            }
        },
        
        remove(key) {
            sessionStorage.removeItem(key);
        }
    },
    
    // =====================================
    // ASYNC UTILITIES
    // =====================================
    
    // Debounce function
    debounce(func, wait = CONFIG.UI.DEBOUNCE_DELAY) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function
    throttle(func, limit = 100) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Retry function
    async retry(fn, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                await this.sleep(delay * Math.pow(2, i)); // Exponential backoff
            }
        }
    },
    
    // =====================================
    // TOAST NOTIFICATIONS
    // =====================================
    
    toast(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = this.createElement('div', {
            class: `toast ${type}`
        }, [message]);
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.animation = 'slideIn 0.3s ease';
        });
        
        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    // =====================================
    // VALIDATION UTILITIES
    // =====================================
    
    validate: {
        email(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        
        username(username) {
            return username.length >= CONFIG.VALIDATION.USERNAME_MIN &&
                   username.length <= CONFIG.VALIDATION.USERNAME_MAX &&
                   /^[a-zA-Z0-9_]+$/.test(username);
        },
        
        password(password) {
            return password.length >= CONFIG.VALIDATION.PASSWORD_MIN;
        },
        
        auctionCode(code) {
            return code.length === CONFIG.VALIDATION.AUCTION_CODE_LENGTH &&
                   /^[A-Z0-9]+$/.test(code.toUpperCase());
        },
        
        teamName(name) {
            return name.length >= CONFIG.VALIDATION.TEAM_NAME_MIN &&
                   name.length <= CONFIG.VALIDATION.TEAM_NAME_MAX;
        }
    },
    
    // =====================================
    // EXPORT UTILITIES
    // =====================================
    
    // Export to CSV
    exportToCSV(data, filename = 'export.csv') {
        const csv = this.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = this.createElement('a', {
            href: url,
            download: filename
        });
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
    
    convertToCSV(data) {
        if (!data.length) return '';
        
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        
        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') 
                    ? `"${value}"` 
                    : value;
            }).join(',');
        });
        
        return [csvHeaders, ...csvRows].join('\n');
    },
    
    // Export to JSON
    exportToJSON(data, filename = 'export.json') {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = this.createElement('a', {
            href: url,
            download: filename
        });
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
    
    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.toast('Copiato negli appunti!', 'success');
            return true;
        } catch (err) {
            console.error('Clipboard error:', err);
            this.toast('Errore copia negli appunti', 'error');
            return false;
        }
    },
    
    // =====================================
    // MISC UTILITIES
    // =====================================
    
    // Generate random ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    },
    
    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    // Check if mobile
    isMobile() {
        return window.innerWidth <= 768;
    },
    
    // Get URL params
    getUrlParams() {
        const params = {};
        new URLSearchParams(window.location.search).forEach((value, key) => {
            params[key] = value;
        });
        return params;
    },
    
    // Smooth scroll
    smoothScroll(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}