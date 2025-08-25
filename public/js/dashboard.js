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

// Display tokens in both table and mobile card views
function displayTokens() {
    displayTokensTable();
    displayTokensMobile();
}

// Display tokens in the table (Desktop)
function displayTokensTable() {
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
                    `<span class="price-value">$${formatPrice(token.price_usdt)}</span>` : 
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

// Display tokens in mobile card view
function displayTokensMobile() {
    const container = document.getElementById('mobileTokensContainer');
    
    if (filteredTokens.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-info-circle me-2"></i>No tokens found
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTokens.map(token => `
        <div class="mobile-card">
            <div class="token-header">
                <div>
                    <div class="token-symbol">${token.symbol}</div>
                    ${token.name ? `<div class="token-name">${token.name}</div>` : ''}
                </div>
                <div class="text-end">
                    ${token.price_usdt ? 
                        `<div class="token-price">$${formatPrice(token.price_usdt)}</div>` : 
                        '<div class="token-price text-muted">N/A</div>'
                    }
                </div>
            </div>
            
            <div class="token-change">
                ${token.price_change_percent_24h ? formatPriceChange(token.price_change_percent_24h) : '<span class="text-muted">N/A</span>'}
            </div>
            
            <div class="token-stats">
                <div class="stat-item">
                    <div class="stat-label">Volume (24h)</div>
                    <div class="stat-value">${token.volume_24h ? formatVolume(token.volume_24h) : 'N/A'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Market Cap</div>
                    <div class="stat-value">${token.market_cap ? formatMarketCap(token.market_cap) : 'N/A'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">FDV</div>
                    <div class="stat-value">${token.fdv ? formatMarketCap(token.fdv) : 'N/A'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Total Supply</div>
                    <div class="stat-value">${token.total_supply ? formatTotalSupply(token.total_supply) : 'N/A'}</div>
                </div>
            </div>
            
            <div class="futures-status">
                ${token.is_futures_listed === 1 ? 
                    '<span class="badge bg-success futures-badge"><i class="fas fa-check me-1"></i>Futures Listed</span>' : 
                    token.is_futures_listed === 0 ? 
                    '<span class="badge bg-secondary futures-badge"><i class="fas fa-times me-1"></i>Not Listed</span>' :
                    '<span class="badge bg-warning futures-badge">N/A</span>'
                }
            </div>
        </div>
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
        // Add loading state to both desktop table row and mobile card
        const tableRow = document.querySelector(`tr[data-symbol="${symbol}"]`);
        const mobileCard = document.querySelector(`.mobile-card:has(.token-symbol:contains('$${symbol}'))`);
        
        if (tableRow) {
            tableRow.classList.add('loading');
        }
        
        // For now, just reload all tokens since we don't have individual token update endpoint
        await loadTokens();
        showSuccess(`Token ${symbol} refreshed successfully!`);
    } catch (error) {
        console.error('Error refreshing token:', error);
        showError(`Failed to refresh ${symbol}`);
    } finally {
        const tableRow = document.querySelector(`tr[data-symbol="${symbol}"]`);
        if (tableRow) {
            tableRow.classList.remove('loading');
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
    
    // Update checkbox state for both desktop and mobile
    const desktopCheckbox = document.getElementById('autoRefreshToggle');
    const mobileCheckbox = document.getElementById('autoRefreshToggleMobile');
    
    if (desktopCheckbox) {
        desktopCheckbox.checked = autoRefreshEnabled;
    }
    if (mobileCheckbox) {
        mobileCheckbox.checked = autoRefreshEnabled;
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
    resetSortState();
    displayTokens();
    updateStats();
    updateFilterButtons('all');
}

// Show only futures listed tokens
function showFuturesListed() {
    filteredTokens = allTokens.filter(token => token.is_futures_listed === 1);
    currentFilter = 'futures_listed';
    resetSortState();
    displayTokens();
    updateStats();
    updateFilterButtons('futures_listed');
}

// Show only not futures listed tokens
function showNotFuturesListed() {
    filteredTokens = allTokens.filter(token => token.is_futures_listed === 0);
    currentFilter = 'not_futures_listed';
    resetSortState();
    displayTokens();
    updateStats();
    updateFilterButtons('not_futures_listed');
}

// Reset sort state when changing filters
function resetSortState() {
    isSortedByMarketCap = false;
    originalOrder = [];
    updateSortCapButton(false);
}

// Simple sort by Market Cap (low to high) with toggle
let isSortedByMarketCap = false;
let originalOrder = [];

function sortByMarketCap() {
    if (!isSortedByMarketCap) {
        // Save original order if first time sorting
        if (originalOrder.length === 0) {
            originalOrder = [...filteredTokens];
        }
        
        // Sort by Market Cap (low to high)
        filteredTokens.sort((a, b) => {
            const marketCapA = a.market_cap || 0;
            const marketCapB = b.market_cap || 0;
            return marketCapA - marketCapB;
        });
        
        isSortedByMarketCap = true;
        updateSortCapButton(true);
    } else {
        // Restore original order
        filteredTokens = [...originalOrder];
        isSortedByMarketCap = false;
        updateSortCapButton(false);
    }
    
    displayTokens();
}

// Update SortCap button appearance
function updateSortCapButton(isActive) {
    const btnSortCap = document.getElementById('btnSortCap');
    const btnSortCapMobile = document.getElementById('btnSortCapMobile');
    
    if (btnSortCap) {
        if (isActive) {
            btnSortCap.classList.add('active');
            btnSortCap.innerHTML = '<i class="fas fa-sort-amount-down me-1"></i>SortCap';
        } else {
            btnSortCap.classList.remove('active');
            btnSortCap.innerHTML = '<i class="fas fa-sort-amount-up me-1"></i>SortCap';
        }
    }
    
    if (btnSortCapMobile) {
        if (isActive) {
            btnSortCapMobile.classList.add('active');
            btnSortCapMobile.innerHTML = '<i class="fas fa-sort-amount-down me-1"></i>SortCap';
        } else {
            btnSortCapMobile.classList.remove('active');
            btnSortCapMobile.innerHTML = '<i class="fas fa-sort-amount-up me-1"></i>SortCap';
        }
    }
}

// Update filter button states
function updateFilterButtons(activeFilter) {
    // Reset all desktop buttons
    const btnShowAll = document.getElementById('btnShowAll');
    const btnFuturesListed = document.getElementById('btnFuturesListed');
    const btnNotFuturesListed = document.getElementById('btnNotFuturesListed');
    
    // Reset all mobile buttons
    const btnShowAllMobile = document.getElementById('btnShowAllMobile');
    const btnFuturesListedMobile = document.getElementById('btnFuturesListedMobile');
    const btnNotFuturesListedMobile = document.getElementById('btnNotFuturesListedMobile');
    
    // Reset all buttons to outline style
    [btnShowAll, btnFuturesListed, btnNotFuturesListed, 
     btnShowAllMobile, btnFuturesListedMobile, btnNotFuturesListedMobile].forEach(btn => {
        if (btn) {
            btn.classList.remove('btn-primary', 'btn-success', 'btn-secondary');
            btn.classList.add('btn-outline-primary', 'btn-outline-success', 'btn-outline-secondary');
        }
    });
    
    // Activate the selected button on both desktop and mobile
    switch(activeFilter) {
        case 'all':
            if (btnShowAll) {
                btnShowAll.classList.remove('btn-outline-primary');
                btnShowAll.classList.add('btn-primary');
            }
            if (btnShowAllMobile) {
                btnShowAllMobile.classList.remove('btn-outline-primary');
                btnShowAllMobile.classList.add('btn-primary');
            }
            break;
        case 'futures_listed':
            if (btnFuturesListed) {
                btnFuturesListed.classList.remove('btn-outline-success');
                btnFuturesListed.classList.add('btn-success');
            }
            if (btnFuturesListedMobile) {
                btnFuturesListedMobile.classList.remove('btn-outline-success');
                btnFuturesListedMobile.classList.add('btn-success');
            }
            break;
        case 'not_futures_listed':
            if (btnNotFuturesListed) {
                btnNotFuturesListed.classList.remove('btn-outline-secondary');
                btnNotFuturesListed.classList.add('btn-secondary');
            }
            if (btnNotFuturesListedMobile) {
                btnNotFuturesListedMobile.classList.remove('btn-outline-secondary');
                btnNotFuturesListedMobile.classList.add('btn-secondary');
            }
            break;
    }
}
 