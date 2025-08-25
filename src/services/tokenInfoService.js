const cron = require('node-cron');
const { getDatabase } = require('../config/database');
const binanceService = require('./binanceService');

class TokenInfoService {
  constructor() {
    this.isRunning = false;
    this.updateInterval = parseInt(process.env.TOKEN_INFO_UPDATE_INTERVAL) || 300; // 5 minutes
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes cache timeout
  }

  startTokenInfoUpdates() {
    if (this.isRunning) {
      console.log('⚠️ Token info service is already running');
      return;
    }

    console.log(`🔄 Starting token info updates every ${this.updateInterval} seconds`);
    this.isRunning = true;

    // Run immediately on start
    this.updateAllTokenInfo();

    // Schedule regular updates
    cron.schedule(`*/${this.updateInterval} * * * * *`, () => {
      this.updateAllTokenInfo();
    });
  }

  stopTokenInfoUpdates() {
    this.isRunning = false;
    console.log('⏹️ Token info service stopped');
  }

  async updateAllTokenInfo() {
    try {
      const database = getDatabase();
      
      // Get all active alpha tokens
      const alphaTokens = await this.getActiveAlphaTokens(database);
      
      if (alphaTokens.length === 0) {
        console.log('ℹ️ No active alpha tokens found for info update');
        return;
      }

      console.log(`📋 Updating token info for ${alphaTokens.length} tokens...`);
      
      const updatePromises = alphaTokens.map(token => this.updateTokenInfo(token.symbol, database));
      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Token info update completed: ${successful} successful, ${failed} failed`);
      
    } catch (error) {
      console.error('❌ Error in token info update cycle:', error.message);
    }
  }

  async updateTokenInfo(symbol, database) {
    try {
      // Get exchange info and futures status
      const [exchangeInfo, futuresInfo] = await Promise.all([
        binanceService.getExchangeInfo(symbol),
        binanceService.checkFuturesAvailability(symbol)
      ]);

      if (!exchangeInfo) {
        console.log(`⚠️ No exchange info received for ${symbol}`);
        return;
      }

      // Update token info in database
      await this.upsertTokenInfo(symbol, exchangeInfo, futuresInfo, database);
      
      console.log(`✅ Updated info for ${symbol}`);
      
    } catch (error) {
      console.error(`❌ Error updating info for ${symbol}:`, error.message);
    }
  }

  async upsertTokenInfo(symbol, exchangeInfo, futuresInfo, database) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO tokens (
          symbol, name, is_futures_listed, futures_listing_date, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(symbol) DO UPDATE SET
          name = excluded.name,
          is_futures_listed = excluded.is_futures_listed,
          futures_listing_date = excluded.futures_listing_date,
          updated_at = excluded.updated_at
      `;

      const values = [
        symbol,
        exchangeInfo.baseAsset,
        futuresInfo.isAvailable,
        futuresInfo.listingDate,
        new Date().toISOString()
      ];

      database.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getActiveAlphaTokens(database) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT symbol FROM alpha_tokens 
        WHERE is_active = 1 
        ORDER BY priority DESC, symbol ASC
      `;

      database.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Add new alpha token
  async addAlphaToken(symbol, priority = 0, notes = '', alphaData = null) {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        let query, values;
        
        if (alphaData) {
          // Add with full Alpha API data
          query = `
            INSERT INTO alpha_tokens (symbol, alpha_id, name, chain_id, contract_address, decimals, network, priority, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          values = [
            symbol.toUpperCase(),
            alphaData.alphaId,
            alphaData.name,
            alphaData.chainId,
            alphaData.contractAddress,
            alphaData.decimals,
            alphaData.network,
            priority,
            notes
          ];
        } else {
          // Add with basic info only
          query = `
            INSERT INTO alpha_tokens (symbol, priority, notes)
            VALUES (?, ?, ?)
          `;
          values = [symbol.toUpperCase(), priority, notes];
        }

        database.run(query, values, function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error(`Token ${symbol} already exists`));
            } else {
              reject(err);
            }
          } else {
            console.log(`✅ Added new alpha token: ${symbol}`);
            resolve(this.lastID);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error adding alpha token ${symbol}:`, error.message);
      throw error;
    }
  }

  // Remove alpha token
  async removeAlphaToken(symbol) {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          UPDATE alpha_tokens 
          SET is_active = 0 
          WHERE symbol = ?
        `;

        database.run(query, [symbol.toUpperCase()], function(err) {
          if (err) {
            reject(err);
          } else {
            if (this.changes > 0) {
              console.log(`✅ Deactivated alpha token: ${symbol}`);
              resolve(this.changes);
            } else {
              reject(new Error(`Token ${symbol} not found`));
            }
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error removing alpha token ${symbol}:`, error.message);
      throw error;
    }
  }

  // Update alpha token priority
  async updateTokenPriority(symbol, priority) {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          UPDATE alpha_tokens 
          SET priority = ? 
          WHERE symbol = ?
        `;

        database.run(query, [priority, symbol.toUpperCase()], function(err) {
          if (err) {
            reject(err);
          } else {
            if (this.changes > 0) {
              console.log(`✅ Updated priority for ${symbol}: ${priority}`);
              resolve(this.changes);
            } else {
              reject(new Error(`Token ${symbol} not found`));
            }
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error updating priority for ${symbol}:`, error.message);
      throw error;
    }
  }

  // Get tracked alpha tokens from database (raw data)
  async getTrackedAlphaTokensFromDB() {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          SELECT 
            at.symbol,
            at.priority,
            at.notes,
            at.is_active,
            at.created_at,
            at.is_futures_listed,
            at.futures_check_date,
            t.price_usdt,
            t.updated_at as last_price_update
          FROM alpha_tokens at
          LEFT JOIN tokens t ON at.symbol = t.symbol
          ORDER BY at.priority DESC, at.symbol ASC
        `;

        database.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error getting tracked alpha tokens from DB:', error.message);
      return [];
    }
  }

  // Get all alpha tokens from Binance Alpha API with complete data
  async getAllAlphaTokensFromAPI() {
    try {
      console.log('🔄 Fetching alpha tokens from Binance Alpha API...');
      
      const response = await binanceService.getAlphaTokenList();
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        console.warn('⚠️ Invalid response from Alpha API');
        return [];
      }

      console.log(`✅ Fetched ${response.data.length} tokens from Alpha API`);
      
      // Transform API data to our format
      return response.data.map(token => ({
        symbol: token.symbol,
        name: token.name,
        price: parseFloat(token.price) || 0,
        price_change_percent_24h: parseFloat(token.percentChange24h) || 0,
        volume_24h: parseFloat(token.volume24h) || 0,
        market_cap: parseFloat(token.marketCap) || 0,
        fdv: parseFloat(token.fdv) || 0,
        total_supply: parseFloat(token.totalSupply) || 0,
        circulating_supply: parseFloat(token.circulatingSupply) || 0,
        liquidity: parseFloat(token.liquidity) || 0,
        holders: parseInt(token.holders) || 0,
        chain_name: token.chainName,
        contract_address: token.contractAddress,
        alpha_id: token.alphaId,
        hot_tag: token.hotTag || false,
        listing_cex: token.listingCex || false
      }));
      
    } catch (error) {
      console.error('❌ Error fetching from Alpha API:', error.message);
      return [];
    }
  }

  // Get all alpha tokens with their status
  async getAllAlphaTokens() {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          SELECT 
            at.symbol,
            at.priority,
            at.notes,
            at.is_active,
            at.created_at,
            t.price_usdt,
            t.is_futures_listed,
            t.updated_at as last_price_update
          FROM alpha_tokens at
          LEFT JOIN tokens t ON at.symbol = t.symbol
          ORDER BY at.priority DESC, at.symbol ASC
        `;

        database.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Add missing fields for frontend compatibility
            const enhancedRows = rows.map(row => ({
              ...row,
              is_tracked: row.is_active === 1, // Only active tokens are tracked
              name: row.symbol, // Use symbol as name if not available
              price_change_percent_24h: null, // Will be filled by price service
              volume_24h: null, // Will be filled by price service
              market_cap: null // Will be filled by price service
            }));
            resolve(enhancedRows);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error getting all alpha tokens:', error.message);
      return [];
    }
  }

  // Get all available Alpha tokens from Binance Alpha API
  async getAllAvailableAlphaTokens() {
    try {
      const response = await fetch('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list');
      const result = await response.json();
      
      if (result.code === '000000') {
        return result.data.map(token => ({
          alphaId: token.alphaId,
          symbol: token.symbol,
          name: token.name,
          chainId: token.chainId,
          contractAddress: token.contractAddress,
          decimals: token.decimals,
          network: token.network,
          is_tracked: false, // Will be updated based on database
          priority: 0,
          notes: ''
        }));
      } else {
        console.error('❌ Alpha API error:', result.message);
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching available Alpha tokens:', error.message);
      return [];
    }
  }

  // Get all available Alpha tokens with SMART CACHE (only check new/unchanged tokens)
  async getAllAlphaTokensWithStatus() {
    try {
      console.log('🔄 Fetching Alpha tokens with smart cache...');
      
      // Get all available tokens from Binance Alpha API with complete data
      const availableTokens = await this.getAllAlphaTokensFromAPI();
      console.log(`📊 Found ${availableTokens.length} Alpha tokens with complete data`);
      
      // Get tracked tokens from database (with cached futures data)
      const trackedTokens = await this.getTrackedAlphaTokensFromDB();
      
      // Create a map of tracked tokens
      const trackedMap = new Map();
      trackedTokens.forEach(token => {
        trackedMap.set(token.symbol, token);
      });
      
      // Merge data with SMART CACHE logic
      const mergedTokens = [];
      
      // Process tracked tokens first (use cached data)
      for (const token of availableTokens) {
        const tracked = trackedMap.get(token.symbol);
        if (tracked && tracked.is_active === 1) { // Only active tokens are tracked
          mergedTokens.push({
            ...token,
            is_tracked: true,
            priority: tracked.priority || 0,
            notes: tracked.notes || '',
            price_usdt: token.price,
            price_change_percent_24h: token.price_change_percent_24h,
            volume_24h: token.volume_24h,
            market_cap: token.market_cap,
            fdv: token.fdv,
            total_supply: token.total_supply,
            circulating_supply: token.circulating_supply,
            liquidity: token.liquidity,
            holders: token.holders,
            is_futures_listed: tracked.is_futures_listed, // Use cached data
            last_price_update: tracked.last_price_update
          });
        }
      }
      
      // Process untracked tokens with SMART CACHE
      const untrackedTokens = availableTokens.filter(token => {
        const tracked = trackedMap.get(token.symbol);
        return !tracked || tracked.is_active !== 1; // Not active (not tracked)
      });
      console.log(`🔍 Processing ${untrackedTokens.length} untracked tokens...`);
      
      // Check if we need to update existing futures data (older than 24 hours)
      const tokensToCheck = [];
      const tokensToUseCache = [];
      
      for (const token of untrackedTokens) {
        const existing = trackedMap.get(token.symbol);
        if (existing && existing.is_futures_listed !== null && existing.futures_check_date) {
          // Check if data is fresh (less than 24 hours old)
          const checkDate = new Date(existing.futures_check_date);
          const now = new Date();
          const hoursDiff = (now - checkDate) / (1000 * 60 * 60);
          
          if (hoursDiff < 24) {
            // Use cached data (less than 24 hours old)
            tokensToUseCache.push({
              ...token,
              is_tracked: false,
              priority: 0,
              notes: '',
              price_usdt: token.price,
              price_change_percent_24h: token.price_change_percent_24h,
              volume_24h: token.volume_24h,
              market_cap: token.market_cap,
              fdv: token.fdv,
              total_supply: token.total_supply,
              circulating_supply: token.circulating_supply,
              liquidity: token.liquidity,
              holders: token.holders,
              is_futures_listed: existing.is_futures_listed, // Use cache
              last_price_update: null
            });
            console.log(`💾 Using cached futures data for ${token.symbol}`);
          } else {
            // Data is old, need to check again
            tokensToCheck.push(token);
          }
        } else {
          // New token or no cached data, need to check
          tokensToCheck.push(token);
        }
      }
      
      // Add tokens using cache
      mergedTokens.push(...tokensToUseCache);
      
      // Check futures status for tokens that need updating
      if (tokensToCheck.length > 0) {
        console.log(`🔄 Checking futures status for ${tokensToCheck.length} tokens (new or outdated)...`);
        
        // Process in smaller batches for better performance
        const batchSize = 5;
        for (let i = 0; i < tokensToCheck.length; i += batchSize) {
          const batch = tokensToCheck.slice(i, i + batchSize);
          
          // Process batch concurrently
          const batchPromises = batch.map(async (token) => {
            try {
              // Check futures status with double verification if name is available
              let futuresData;
              if (token.name) {
                console.log(`🔍 Using enhanced verification for ${token.symbol} (${token.name})`);
                futuresData = await this.checkFuturesStatusWithVerification(token.symbol, token.name);
              } else {
                console.log(`⚠️ No name available for ${token.symbol}, using basic check`);
                futuresData = await this.checkBasicFuturesStatus(token.symbol);
              }
              
              // Save to database for future cache
              if (futuresData.verificationStatus) {
                // Enhanced verification result
                await this.saveFuturesStatusWithVerification(token.symbol, futuresData.isAvailable, futuresData.verificationDetails);
              } else {
                // Basic check result
                await this.saveFuturesStatus(token.symbol, futuresData.isAvailable);
              }
              
              return {
                ...token,
                is_tracked: false,
                priority: 0,
                notes: '',
                price_usdt: token.price,
                price_change_percent_24h: token.price_change_percent_24h,
                volume_24h: token.volume_24h,
                market_cap: token.market_cap,
                fdv: token.fdv,
                total_supply: token.total_supply,
                circulating_supply: token.circulating_supply,
                liquidity: token.liquidity,
                holders: token.holders,
                is_futures_listed: futuresData.isAvailable,
                last_price_update: null
              };
            } catch (error) {
              console.warn(`⚠️ Failed to check futures for ${token.symbol}:`, error.message);
              return {
                ...token,
                is_tracked: false,
                priority: 0,
                notes: '',
                price_usdt: token.price,
                price_change_percent_24h: token.price_change_percent_24h,
                volume_24h: token.volume_24h,
                market_cap: token.market_cap,
                fdv: token.fdv,
                total_supply: token.total_supply,
                circulating_supply: token.circulating_supply,
                liquidity: token.liquidity,
                holders: token.holders,
                is_futures_listed: null,
                last_price_update: null
              };
            }
          });
          
          // Wait for batch to complete
          const batchResults = await Promise.allSettled(batchPromises);
          batchResults.forEach(result => {
            if (result.status === 'fulfilled') {
              mergedTokens.push(result.value);
            }
          });
          
          // Small delay between batches
          if (i + batchSize < tokensToCheck.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tokensToCheck.length/batchSize)}`);
        }
      }
      
      // Sort by tracked status first, then by symbol
      const sortedTokens = mergedTokens.sort((a, b) => {
        if (a.is_tracked !== b.is_tracked) {
          return b.is_tracked ? 1 : -1;
        }
        return a.symbol.localeCompare(b.symbol);
      });
      
      console.log(`🎯 Smart cache completed: ${tokensToUseCache.length} cached, ${tokensToCheck.length} checked, total: ${sortedTokens.length}`);
      return sortedTokens;
      
    } catch (error) {
      console.error('❌ Error getting Alpha tokens with status:', error.message);
      return [];
    }
  }

  // Save futures status to database for caching
  async saveFuturesStatus(symbol, isFuturesListed) {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          INSERT OR REPLACE INTO alpha_tokens 
          (symbol, is_futures_listed, futures_check_date) 
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `;
        
        database.run(query, [symbol, isFuturesListed], function(err) {
          if (err) {
            console.warn(`⚠️ Failed to save futures status for ${symbol}:`, err.message);
            reject(err);
          } else {
            console.log(`💾 Saved futures status for ${symbol}: ${isFuturesListed}`);
            resolve(this.changes);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error saving futures status for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get live data for a specific token (on-demand)
  async getTokenLiveData(symbol) {
    try {
      const [priceData, futuresData] = await Promise.allSettled([
        this.getBasicTokenData(symbol),
        this.checkBasicFuturesStatus(symbol)
      ]);
      
      return {
        price_usdt: priceData.status === 'fulfilled' ? priceData.value?.price : null,
        price_change_percent_24h: priceData.status === 'fulfilled' ? priceData.value?.priceChangePercent24h : null,
        volume_24h: priceData.status === 'fulfilled' ? priceData.value?.volume24h : null,
        is_futures_listed: futuresData.status === 'fulfilled' ? futuresData.value?.isAvailable : false
      };
    } catch (error) {
      console.warn(`⚠️ Could not fetch live data for ${symbol}:`, error.message);
      return {
        price_usdt: null,
        price_change_percent_24h: null,
        volume_24h: null,
        is_futures_listed: false
      };
    }
  }

  // Get basic token data (price, volume, 24h change)
  async getBasicTokenData(symbol) {
    try {
      // Check cache first
      const cacheKey = `price_${symbol}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Clean symbol for Binance API (remove special characters)
      const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '');
      
      // Try different symbol formats
      const symbolFormats = [
        `${cleanSymbol}USDT`,
        `${symbol}USDT`,
        `${cleanSymbol}USDC`,
        `${symbol}USDC`
      ];
      
      for (const format of symbolFormats) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
          
          const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${format}`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            const result = {
              price: parseFloat(data.lastPrice),
              priceChangePercent24h: parseFloat(data.priceChangePercent),
              volume24h: parseFloat(data.volume)
            };
            
            // Cache the result
            this.cache.set(cacheKey, {
              data: result,
              timestamp: Date.now()
            });
            
            return result;
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log(`⏰ Timeout for ${symbol} ${format}`);
          }
          continue; // Try next format
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  // Check basic futures status
  async checkBasicFuturesStatus(symbol) {
    try {
      // Check cache first
      const cacheKey = `futures_${symbol}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Clean symbol for Binance API (remove special characters)
      const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '');
      
      // Try different symbol formats
      const symbolFormats = [
        `${cleanSymbol}USDT`,
        `${symbol}USDT`,
        `${cleanSymbol}USDC`,
        `${symbol}USDC`
      ];
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for futures
      
      const response = await fetch(`https://fapi.binance.com/fapi/v1/exchangeInfo`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        for (const format of symbolFormats) {
          const symbolInfo = data.symbols.find(s => s.symbol === format);
          if (symbolInfo && symbolInfo.status === 'TRADING') {
            const result = { isAvailable: true };
            
            // Cache the result
            this.cache.set(cacheKey, {
              data: result,
              timestamp: Date.now()
            });
            
            return result;
          }
        }
      }
      
      const result = { isAvailable: false };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏰ Futures timeout for ${symbol}`);
      }
      return { isAvailable: false };
    }
  }

  // Get only alpha tokens that have futures listed
  async getFuturesListedAlphaTokens() {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          SELECT 
            at.symbol,
            at.priority,
            at.notes,
            at.is_active,
            at.created_at,
            t.price_usdt,
            t.price_change_percent_24h,
            t.volume_24h,
            t.market_cap,
            t.fdv,
            t.is_futures_listed,
            t.futures_listing_date,
            t.futures_contract_type,
            t.updated_at as last_price_update
          FROM alpha_tokens at
          INNER JOIN tokens t ON at.symbol = t.symbol
          WHERE at.is_active = 1 AND t.is_futures_listed = 1
          ORDER BY at.priority DESC, at.symbol ASC
        `;

        database.all(query, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Add missing fields for frontend compatibility
            const enhancedRows = rows.map(row => ({
              ...row,
              is_tracked: true, // These are tracked tokens from database
              name: row.symbol, // Use symbol as name if not available
              fdv: row.fdv || null
            }));
            resolve(enhancedRows);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error getting futures listed alpha tokens:', error.message);
      return [];
    }
  }

  // Get token details
  async getTokenDetails(symbol) {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          SELECT 
            t.*,
            at.priority,
            at.notes,
            at.is_active as is_alpha_token
          FROM tokens t
          LEFT JOIN alpha_tokens at ON t.symbol = at.symbol
          WHERE t.symbol = ?
        `;

        database.get(query, [symbol.toUpperCase()], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error getting token details for ${symbol}:`, error.message);
      return null;
    }
  }

  // Search tokens
  async searchTokens(query, limit = 20) {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const searchQuery = `
          SELECT 
            t.symbol,
            t.name,
            t.price_usdt,
            t.is_futures_listed,
            at.is_active as is_alpha_token
          FROM tokens t
          LEFT JOIN alpha_tokens at ON t.symbol = at.symbol
          WHERE t.symbol LIKE ? OR t.name LIKE ?
          ORDER BY at.is_active DESC, t.symbol ASC
          LIMIT ?
        `;

        const searchTerm = `%${query.toUpperCase()}%`;
        database.all(searchQuery, [searchTerm, searchTerm, limit], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error searching tokens:`, error.message);
      return [];
    }
  }

  // Enhanced futures checking with double verification
  async checkFuturesStatusWithVerification(symbol, name) {
    try {
      console.log(`🔍 Starting enhanced futures check for ${symbol} (${name})...`);
      
      // Clean symbol by removing $ prefix if present
      const cleanSymbol = symbol.replace(/^\$/, '');
      console.log(`🧹 Cleaned symbol: ${symbol} -> ${cleanSymbol}`);
      
      // Get alpha token from database (try both with and without $)
      let alphaToken = await this.getAlphaTokenFromDB(cleanSymbol);
      if (!alphaToken && symbol !== cleanSymbol) {
        alphaToken = await this.getAlphaTokenFromDB(symbol);
      }
      
      if (!alphaToken) {
        console.log(`❌ Alpha token not found for ${symbol} or ${cleanSymbol}`);
        return {
          isAvailable: false,
          verificationStatus: 'NO_ALPHA_TOKEN',
          reason: 'Token not found in alpha_tokens table',
          attemptedSymbols: [symbol, cleanSymbol]
        };
      }
      
      console.log(`✅ Found alpha token: ${alphaToken.symbol} | ${alphaToken.name}`);
      
      // Check Binance Futures API with cleaned symbol
      const futuresData = await binanceService.checkFuturesAvailability(cleanSymbol);
      
      // Double verification logic
      const symbolMatch = alphaToken.symbol === cleanSymbol || alphaToken.symbol === symbol;
      const nameMatch = alphaToken.name && 
                       alphaToken.name.toLowerCase() === name.toLowerCase();
      
      console.log(`🔍 Verification results for ${symbol}:`);
      console.log(`  - Alpha token: ${alphaToken.symbol} | ${alphaToken.name}`);
      console.log(`  - Requested: ${symbol} | ${name}`);
      console.log(`  - Cleaned symbol: ${cleanSymbol}`);
      console.log(`  - Symbol match: ${symbolMatch}`);
      console.log(`  - Name match: ${nameMatch}`);
      console.log(`  - Futures API: ${futuresData.isAvailable}`);
      
      // Enhanced verification: Check if this is likely the same token
      let isLikelySameToken = symbolMatch;
      
      // If name doesn't match but symbol does, this might be a different token with same symbol
      if (symbolMatch && !nameMatch) {
        console.log(`⚠️ Symbol matches but name doesn't - potential different token`);
        console.log(`   Alpha: ${alphaToken.name} vs Requested: ${name}`);
        
        // Additional check: if futures is available, this might be a different RIF token
        if (futuresData.isAvailable) {
          console.log(`⚠️ WARNING: Futures available but name mismatch - likely different token!`);
          isLikelySameToken = false;
        }
      }
      
      // Adjusted verification logic: 
      // 1. If name is available, require both symbol and name match
      // 2. If name is not available, only require symbol match
      // 3. Always require futures API to confirm availability
      let verificationPassed = false;
      
      if (name && alphaToken.name) {
        // Both names available - require strict matching
        verificationPassed = symbolMatch && nameMatch && futuresData.isAvailable;
        console.log(`🔍 Strict verification: Symbol(${symbolMatch}) + Name(${nameMatch}) + Futures(${futuresData.isAvailable}) = ${verificationPassed}`);
      } else {
        // Name not available - only require symbol match
        verificationPassed = symbolMatch && futuresData.isAvailable;
        console.log(`🔍 Relaxed verification: Symbol(${symbolMatch}) + Futures(${futuresData.isAvailable}) = ${verificationPassed}`);
        console.log(`   Note: Name verification skipped (Alpha: ${!!alphaToken.name}, Requested: ${!!name})`);
      }
      
      // Only confirm if verification passed
      if (verificationPassed) {
        console.log(`✅ Double verification PASSED for ${symbol}`);
        
        // Save verified futures status
        await this.saveFuturesStatusWithVerification(cleanSymbol, true, {
          symbolMatch,
          nameMatch,
          alphaTokenSymbol: alphaToken.symbol,
          alphaTokenName: alphaToken.name,
          originalSymbol: symbol,
          cleanedSymbol: cleanSymbol,
          isLikelySameToken,
          verificationMode: name && alphaToken.name ? 'STRICT' : 'RELAXED'
        });
        
        return {
          isAvailable: true,
          verificationStatus: 'VERIFIED',
          alphaTokenName: alphaToken.name,
          futuresApiStatus: futuresData.isAvailable,
          verificationDetails: {
            symbolMatch,
            nameMatch,
            alphaTokenSymbol: alphaToken.symbol,
            alphaTokenName: alphaToken.name,
            originalSymbol: symbol,
            cleanedSymbol: cleanSymbol,
            isLikelySameToken,
            verificationMode: name && alphaToken.name ? 'STRICT' : 'RELAXED'
          }
        };
      } else {
        console.log(`❌ Double verification FAILED for ${symbol}`);
        
        // Save failed verification status
        await this.saveFuturesStatusWithVerification(cleanSymbol, false, {
          symbolMatch,
          nameMatch,
          alphaTokenSymbol: alphaToken.symbol,
          alphaTokenName: alphaToken.name,
          originalSymbol: symbol,
          cleanedSymbol: cleanSymbol,
          isLikelySameToken,
          reason: `Verification failed - Symbol: ${symbolMatch}, Name: ${nameMatch}, Futures: ${futuresData.isAvailable}, Same token: ${isLikelySameToken}`,
          verificationMode: name && alphaToken.name ? 'STRICT' : 'RELAXED'
        });
        
        return {
          isAvailable: false,
          verificationStatus: 'FAILED',
          reason: `Verification failed - Symbol: ${symbolMatch}, Name: ${nameMatch}, Futures: ${futuresData.isAvailable}, Same token: ${isLikelySameToken}`,
          alphaTokenName: alphaToken.name,
          futuresApiStatus: futuresData.isAvailable,
          verificationDetails: {
            symbolMatch,
            nameMatch,
            alphaTokenSymbol: alphaToken.symbol,
            alphaTokenName: alphaToken.name,
            originalSymbol: symbol,
            cleanedSymbol: cleanSymbol,
            isLikelySameToken,
            verificationMode: name && alphaToken.name ? 'STRICT' : 'RELAXED'
          }
        };
      }
      
    } catch (error) {
      console.error(`❌ Error in enhanced futures check for ${symbol}:`, error.message);
      return {
        isAvailable: false,
        verificationStatus: 'ERROR',
        reason: error.message
      };
    }
  }

  // Enhanced save futures status with verification details
  async saveFuturesStatusWithVerification(symbol, isFuturesListed, verificationDetails = {}) {
    try {
      const database = getDatabase();
      const query = `
        INSERT OR REPLACE INTO alpha_tokens 
        (symbol, is_futures_listed, futures_check_date, updated_at)
        VALUES (?, ?, ?, ?)
      `;
      
      const now = new Date().toISOString();
      
      database.run(query, [symbol, isFuturesListed, now, now], function(err) {
        if (err) {
          console.warn(`⚠️ Failed to save futures status for ${symbol}:`, err.message);
        } else {
          console.log(`✅ Saved enhanced futures status for ${symbol}: ${isFuturesListed}`);
          console.log(`📊 Verification details:`, verificationDetails);
        }
      });
      
    } catch (error) {
      console.error(`❌ Error saving enhanced futures status for ${symbol}:`, error.message);
    }
  }

  // Enhanced function to get alpha token from database
  async getAlphaTokenFromDB(symbol) {
    return new Promise((resolve, reject) => {
      const database = getDatabase();
      
      // Try multiple search strategies
      const queries = [
        // Exact match
        `SELECT symbol, name, is_futures_listed, futures_check_date, created_at
         FROM alpha_tokens 
         WHERE symbol = ? AND is_active = 1`,
        
        // Case insensitive match
        `SELECT symbol, name, is_futures_listed, futures_check_date, created_at
         FROM alpha_tokens 
         WHERE UPPER(symbol) = UPPER(?) AND is_active = 1`,
        
        // Partial match (for cases where symbol might be truncated)
        `SELECT symbol, name, is_futures_listed, futures_check_date, created_at
         FROM alpha_tokens 
         WHERE symbol LIKE ? AND is_active = 1`
      ];
      
      const searchTerms = [symbol, symbol, `%${symbol}%`];
      
      // Try each query strategy
      const tryQuery = (index) => {
        if (index >= queries.length) {
          console.log(`❌ Alpha token not found after trying all strategies: ${symbol}`);
          resolve(null);
          return;
        }
        
        database.get(queries[index], [searchTerms[index]], (err, row) => {
          if (err) {
            console.error(`❌ Database error with query ${index + 1} for ${symbol}:`, err.message);
            // Try next strategy
            tryQuery(index + 1);
            return;
          }
          
          if (row) {
            console.log(`✅ Found alpha token with strategy ${index + 1}: ${row.symbol} | ${row.name}`);
            resolve(row);
          } else {
            // Try next strategy
            tryQuery(index + 1);
          }
        });
      };
      
      // Start with first strategy
      tryQuery(0);
    });
  }
}

const tokenInfoService = new TokenInfoService();

module.exports = {
  startTokenInfoUpdates: () => tokenInfoService.startTokenInfoUpdates(),
  stopTokenInfoUpdates: () => tokenInfoService.stopTokenInfoUpdates(),
  addAlphaToken: (symbol, priority, notes) => tokenInfoService.addAlphaToken(symbol, priority, notes),
  removeAlphaToken: (symbol) => tokenInfoService.removeAlphaToken(symbol),
  updateTokenPriority: (symbol, priority) => tokenInfoService.updateTokenPriority(symbol, priority),
  getAllAlphaTokens: () => tokenInfoService.getAllAlphaTokens(),
  getAllAvailableAlphaTokens: () => tokenInfoService.getAllAvailableAlphaTokens(),
  getAllAlphaTokensWithStatus: () => tokenInfoService.getAllAlphaTokensWithStatus(),
  getFuturesListedAlphaTokens: () => tokenInfoService.getFuturesListedAlphaTokens(),
  getTokenDetails: (symbol) => tokenInfoService.getTokenDetails(symbol),
  searchTokens: (query, limit) => tokenInfoService.searchTokens(query, limit),
  getTokenLiveData: (symbol) => tokenInfoService.getTokenLiveData(symbol),
  saveFuturesStatus: (symbol, isFuturesListed) => tokenInfoService.saveFuturesStatus(symbol, isFuturesListed),
  saveFuturesStatusWithVerification: (symbol, isFuturesListed, verificationDetails) => tokenInfoService.saveFuturesStatusWithVerification(symbol, isFuturesListed, verificationDetails),
  checkFuturesStatusWithVerification: (symbol, name) => tokenInfoService.checkFuturesStatusWithVerification(symbol, name)
}; 