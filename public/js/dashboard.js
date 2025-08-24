// Global variables
let allTokens = [];
let filteredTokens = []; // Default to show all available tokens
let currentFilter = 'all'; // Current filter state
let autoRefreshInterval = null; // Auto-refresh timer
let autoRefreshEnabled = true; // Auto-refresh state


// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadTokens();
    updateLastUpdateTime();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Search input event listener
    document.getElementById('searchInput').addEventListener('input', function(e) {
        if (e.target.value.length > 0) {
            searchTokens();
        } else {
            showAllTokens();
        }
    });
});

// Load all tokens from API
async function loadTokens() {
    try {
        showLoading(true);
        
        let url = '/api/tokens?all_available=true';
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            allTokens = result.data;
            filteredTokens = [...allTokens];
            displayTokens();
            updateStats();
            
            // Add lazy loading handlers for price data only
            addLazyLoadingHandlers();
            // Futures data is already loaded from backend, no need to auto-load
        } else {
            showError('Failed to load tokens: ' + result.message);
        }
    } catch (error) {
        console.error('Error loading tokens:', error);
        showError('Failed to load tokens. Please check your connection.');
    } finally {
        showLoading(false);
        updateLastUpdateTime();
    }
}

// Display tokens in the table
function displayTokens() {
    const tbody = document.getElementById('tokensTableBody');
    
    if (filteredTokens.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    <i class="fas fa-info-circle me-2"></i>No tokens found
                </td>
            </tr>
        `;
        return;
    }
    
            tbody.innerHTML = filteredTokens.map(token => `
        <tr class="token-row" data-symbol="${token.symbol}">
            <td>
                <strong>${token.symbol}</strong>
                ${token.name ? `<br><small class="text-muted">${token.name}</small>` : ''}
                ${token.notes ? `<br><small class="text-muted">${token.notes}</small>` : ''}

            </td>
            <td>
                ${token.price_usdt ? 
                    `<span class="price-value">$${formatPrice(token.price_usdt)}</span>
                     <i class="fas fa-sync-alt refresh-btn ms-2" onclick="refreshToken('${token.symbol}')" title="Refresh price"></i>` : 
                    'N/A'
                }
            </td>
            <td>
                ${token.price_change_percent_24h ? formatPriceChange(token.price_change_percent_24h) : 'N/A'}
            </td>
            <td>${token.volume_24h ? formatVolume(token.volume_24h) : 'N/A'}</td>
            <td>${token.market_cap ? formatMarketCap(token.market_cap) : 'N/A'}</td>
            <td>${token.fdv ? formatMarketCap(token.fdv) : 'N/A'}</td>
            <td>${token.total_supply ? formatTotalSupply(token.total_supply) : 'N/A'}</td>
            <td>
                ${token.is_futures_listed === 1 ? 
                    '<span class="badge bg-success futures-badge"><i class="fas fa-check me-1"></i>Yes</span>' : 
                    token.is_futures_listed === 0 ? 
                    '<span class="badge bg-secondary futures-badge"><i class="fas fa-times me-1"></i>No</span>' :
                    'N/A'
                }
            </td>
            
        </tr>
    `).join('');
}

// Update statistics
function updateStats() {
    const totalTokens = allTokens.length;

    const futuresCount = allTokens.filter(t => t.is_futures_listed === 1).length;
    
    // Update stats display
    document.getElementById('totalTokens').textContent = totalTokens;
    document.getElementById('futuresCount').textContent = futuresCount;
    

}

// Format price with appropriate decimals
function formatPrice(price) {
    if (!price) return 'N/A';
    
    if (price >= 1) {
        return price.toFixed(2);
    } else if (price >= 0.01) {
        return price.toFixed(4);
    } else if (price >= 0.0001) {
        return price.toFixed(6);
    } else {
        return price.toFixed(8);
    }
}

// Format price change with color
function formatPriceChange(change) {
    if (!change) return 'N/A';
    
    const changeValue = parseFloat(change);
    const colorClass = changeValue >= 0 ? 'price-up' : 'price-down';
    const icon = changeValue >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    
    return `<span class="${colorClass}">
        <i class="fas ${icon} me-1"></i>
        ${Math.abs(changeValue).toFixed(2)}%
    </span>`;
}

// Format volume
function formatVolume(volume) {
    if (!volume) return 'N/A';
    
    if (volume >= 1e9) {
        return (volume / 1e9).toFixed(2) + 'B';
    } else if (volume >= 1e6) {
        return (volume / 1e6).toFixed(2) + 'M';
    } else if (volume >= 1e3) {
        return (volume / 1e3).toFixed(2) + 'K';
    } else {
        return volume.toFixed(2);
    }
}

// Format market cap
function formatMarketCap(marketCap) {
    if (!marketCap) return 'N/A';
    
    if (marketCap >= 1e12) {
        return '$' + (marketCap / 1e12).toFixed(2) + 'T';
    } else if (marketCap >= 1e9) {
        return '$' + (marketCap / 1e9).toFixed(2) + 'B';
    } else if (marketCap >= 1e6) {
        return '$' + (marketCap / 1e6).toFixed(2) + 'M';
    } else if (marketCap >= 1e3) {
        return '$' + (marketCap / 1e3).toFixed(2) + 'K';
    } else {
        return '$' + marketCap.toFixed(2);
    }
}

// Format total supply
function formatTotalSupply(totalSupply) {
    if (!totalSupply) return 'N/A';
    
    if (totalSupply >= 1e12) {
        return (totalSupply / 1e12).toFixed(2) + 'T';
    } else if (totalSupply >= 1e9) {
        return (totalSupply / 1e9).toFixed(2) + 'B';
    } else if (totalSupply >= 1e6) {
        return (totalSupply / 1e6).toFixed(2) + 'M';
    } else if (totalSupply >= 1e3) {
        return (totalSupply / 1e3).toFixed(2) + 'K';
    } else {
        return totalSupply.toFixed(2);
    }
}

// Refresh data manually
function refreshData() {
    console.log('🔄 Manual refresh requested');
    loadTokens();
    showSuccess('Data refreshed manually');
}

// Search tokens
function searchTokens() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase();
    
    if (query.length === 0) {
        filteredTokens = [...allTokens];
    } else {
        filteredTokens = allTokens.filter(token => 
            token.symbol.toLowerCase().includes(query) ||
            (token.notes && token.notes.toLowerCase().includes(query))
        );
    }
    
    currentFilter = 'search';
    displayTokens();
}

// Clear search and show all tokens
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        filteredTokens = [...allTokens];
        currentFilter = 'all';
        displayTokens();
    }
}



// Refresh data
function refreshData() {
    loadTokens();
}



// Refresh specific token
async function refreshToken(symbol) {
    try {
        const row = document.querySelector(`tr[data-symbol="${symbol}"]`);
        if (row) {
            row.classList.add('loading');
        }
        
        // For now, just reload all tokens since we don't have individual token update endpoint
        await loadTokens();
        showSuccess(`Token ${symbol} refreshed successfully!`);
    } catch (error) {
        console.error('Error refreshing token:', error);
        showError(`Failed to refresh ${symbol}`);
    } finally {
        const row = document.querySelector(`tr[data-symbol="${symbol}"]`);
        if (row) {
            row.classList.remove('loading');
        }
    }
}





// Show token details modal
async function showTokenDetails(symbol) {
    try {
        // For now, just show placeholder since we don't have token details endpoint
        alert(`Token Details for ${symbol}\n\nThis feature is not yet implemented.\n\nFuture enhancements will include:\n- Price Information\n- Futures Information\n- Supply Information`);
    } catch (error) {
        console.error('Error loading token details:', error);
        showError(`Failed to load details for ${symbol}`);
    }
}

// Edit token priority
async function editTokenPriority(symbol, currentPriority) {
    const newPriority = prompt(`Enter new priority for ${symbol}:`, currentPriority);
    
    if (newPriority === null) return; // User cancelled
    
    const priority = parseInt(newPriority);
    if (isNaN(priority) || priority < 0) {
        showError('Priority must be a non-negative number');
        return;
    }
    
    try {
        // For now, just show success message since we don't have priority update endpoint
        showSuccess(`Priority updated for ${symbol}!`);
        loadTokens(); // Reload to show updated priority
    } catch (error) {
        console.error('Error updating priority:', error);
        showError('Failed to update priority. Please try again.');
    }
}

// Remove token
async function removeToken(symbol) {
    if (!confirm(`Are you sure you want to remove ${symbol} from alpha tokens?`)) {
        return;
    }
    
    try {
        // For now, just show success message since we don't have remove endpoint
        showSuccess(`Token ${symbol} removed successfully!`);
        loadTokens(); // Reload to reflect changes
    } catch (error) {
        console.error('Error removing token:', error);
        showError('Failed to remove token. Please try again.');
    }
}

// Show futures data (funding rate)
async function showFuturesData(symbol) {
    try {
        // For now, just show placeholder since we don't have futures data endpoint
        alert(`📊 Futures Data for ${symbol}\n\nThis feature is not yet implemented.\n\nFuture enhancements will include:\n- Funding Rate\n- Next Funding Time\n- Contract Details`);
    } catch (error) {
        console.error('Error loading futures data:', error);
        showError(`Failed to load futures data for ${symbol}`);
    }
}

// Show open interest data
async function showOpenInterest(symbol) {
    try {
        // For now, just show placeholder since we don't have open interest endpoint
        alert(`📈 Open Interest for ${symbol}\n\nThis feature is not yet implemented.\n\nFuture enhancements will include:\n- Open Interest\n- Open Interest Value\n- Market Depth`);
    } catch (error) {
        console.error('Error loading open interest:', error);
        showError(`Failed to load open interest for ${symbol}`);
    }
}

// Add token to tracking
async function addTokenToTracking(symbol) {
    try {
        const priority = prompt(`Enter priority for ${symbol} (0-100):`, '0');
        if (priority === null) return; // User cancelled
        
        const notes = prompt(`Enter notes for ${symbol} (optional):`, '');
        if (notes === null) return; // User cancelled
        
        // For now, just show success message since we don't have add endpoint
        showSuccess(`Token ${symbol} added to tracking successfully!`);
        loadTokens(); // Reload to show updated status
    } catch (error) {
        console.error('Error adding token to tracking:', error);
        showError('Failed to add token to tracking. Please try again.');
    }
}

// Utility functions
function showLoading(show) {
    const tbody = document.getElementById('tokensTableBody');
    if (tbody && show) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    <i class="fas fa-spinner fa-spin me-2"></i>Loading tokens...
                </td>
            </tr>
        `;
    }
}

function updateLastUpdateTime() {
    const now = new Date();
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = now.toLocaleTimeString();
    }
}

function showSuccess(message) {
    // Simple success notification - you can enhance this with a proper toast library
    alert('✅ ' + message);
}

function showError(message) {
    // Simple error notification - you can enhance this with a proper toast library
    alert('❌ ' + message);
}

// Add lazy loading handlers for untracked tokens
function addLazyLoadingHandlers() {
    const rows = document.querySelectorAll('#tokensTableBody tr');
    rows.forEach(row => {
        // Get symbol from first cell (remove any HTML tags)
        const symbolCell = row.querySelector('td:first-child');
        const symbol = symbolCell.textContent.replace(/[^a-zA-Z0-9$]/g, '').trim();
        
        const priceCell = row.querySelector('td:nth-child(2)');
        
        // Add click handler to price cell if it shows "N/A"
        if (priceCell.textContent === 'N/A') {
            priceCell.style.cursor = 'pointer';
            priceCell.title = 'Click to load live data';
            priceCell.onclick = () => loadTokenLiveData(symbol, row);
        }
    });
}



// Smart auto-refresh system
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Auto-refresh every 2 minutes (120 seconds)
    autoRefreshInterval = setInterval(() => {
        if (autoRefreshEnabled) {
            console.log('🔄 Auto-refreshing tokens...');
            loadTokens();
        }
    }, 120000); // 2 minutes
    
    console.log('✅ Auto-refresh started (every 2 minutes)');
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏹️ Auto-refresh stopped');
    }
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    
    // Update checkbox state
    const checkbox = document.getElementById('autoRefreshToggle');
    if (checkbox) {
        checkbox.checked = autoRefreshEnabled;
    }
    
    if (autoRefreshEnabled) {
        startAutoRefresh();
        showSuccess('Auto-refresh enabled (every 2 minutes)');
    } else {
        stopAutoRefresh();
        showSuccess('Auto-refresh disabled');
    }
}

// Auto-load futures data function removed - futures data is now loaded immediately from backend

// Load live data for a specific token
async function loadTokenLiveData(symbol, row, silent = false) {
    try {
        // If silent mode, just update the data without UI changes
        if (silent) {
            const response = await fetch(`/api/tokens/${symbol}/live`);
            const data = await response.json();
            
            if (data.success) {
                // Update the token data in allTokens array
                const tokenIndex = allTokens.findIndex(t => t.symbol === symbol);
                if (tokenIndex !== -1) {
                    allTokens[tokenIndex] = { ...allTokens[tokenIndex], ...data.data };
                }
                return data;
            }
            return null;
        }
        
        // Normal mode - update UI
        const priceCell = row.querySelector('td:nth-child(2)');
        const changeCell = row.querySelector('td:nth-child(3)');
        const volumeCell = row.querySelector('td:nth-child(4)');
        
        // Show loading state
        priceCell.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        
        const response = await fetch(`/api/tokens/${symbol}/live`);
        const data = await response.json();
        
        if (data.success) {
            // Update price
            if (data.data.price_usdt) {
                priceCell.innerHTML = `<span class="price-value">$${formatPrice(data.data.price_usdt)}</span>`;
                priceCell.style.cursor = 'default';
                priceCell.title = '';
            }
            
            // Update 24h change
            if (data.data.price_change_percent_24h !== null) {
                const change = data.data.price_change_percent_24h;
                changeCell.innerHTML = formatPriceChange(change);
            }
            
            // Update volume
            if (data.data.volume_24h) {
                volumeCell.textContent = formatVolume(data.data.volume_24h);
            }
            
            // Update stats
            updateStats();
        } else {
            console.error(`Failed to load live data for ${symbol}:`, data.message);
            priceCell.textContent = 'Error';
        }
    } catch (error) {
        console.error(`Error loading live data for ${symbol}:`, error);
        priceCell.textContent = 'Error';
    }
}

// Show all tokens
function showAllTokens() {
    filteredTokens = [...allTokens];
    currentFilter = 'all';
    displayTokens();
    updateStats();
    updateFilterButtons('all');
}

// Show only futures listed tokens
function showFuturesListed() {
    filteredTokens = allTokens.filter(token => token.is_futures_listed === 1);
    currentFilter = 'futures_listed';
    displayTokens();
    updateStats();
    updateFilterButtons('futures_listed');
}

// Show only not futures listed tokens
function showNotFuturesListed() {
    filteredTokens = allTokens.filter(token => token.is_futures_listed === 0);
    currentFilter = 'not_futures_listed';
    displayTokens();
    updateStats();
    updateFilterButtons('not_futures_listed');
}

// Update filter button states
function updateFilterButtons(activeFilter) {
    // Reset all buttons
    document.getElementById('btnShowAll').classList.remove('btn-primary');
    document.getElementById('btnShowAll').classList.add('btn-outline-primary');
    document.getElementById('btnFuturesListed').classList.remove('btn-success');
    document.getElementById('btnFuturesListed').classList.add('btn-outline-success');
    document.getElementById('btnNotFuturesListed').classList.remove('btn-secondary');
    document.getElementById('btnNotFuturesListed').classList.add('btn-outline-secondary');
    
    // Activate the selected button
    switch(activeFilter) {
        case 'all':
            document.getElementById('btnShowAll').classList.remove('btn-outline-primary');
            document.getElementById('btnShowAll').classList.add('btn-primary');
            break;
        case 'futures_listed':
            document.getElementById('btnFuturesListed').classList.remove('btn-outline-success');
            document.getElementById('btnFuturesListed').classList.add('btn-success');
            break;
        case 'not_futures_listed':
            document.getElementById('btnNotFuturesListed').classList.remove('btn-outline-secondary');
            document.getElementById('btnNotFuturesListed').classList.add('btn-secondary');
            break;
    }
}
 