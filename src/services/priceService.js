const cron = require('node-cron');
const { getDatabase } = require('../config/database');
const binanceService = require('./binanceService');

class PriceService {
  constructor() {
    this.isRunning = false;
    this.updateInterval = parseInt(process.env.PRICE_UPDATE_INTERVAL) || 30; // seconds
  }

  startPriceUpdates() {
    if (this.isRunning) {
      console.log('⚠️ Price service is already running');
      return;
    }

    console.log(`🔄 Starting price updates every ${this.updateInterval} seconds`);
    this.isRunning = true;

    // Run immediately on start
    this.updateAllTokenPrices();

    // Schedule regular updates
    cron.schedule(`*/${this.updateInterval} * * * * *`, () => {
      this.updateAllTokenPrices();
    });
  }

  stopPriceUpdates() {
    this.isRunning = false;
    console.log('⏹️ Price service stopped');
  }

  async updateAllTokenPrices() {
    try {
      const database = getDatabase();
      
      // Get all active alpha tokens
      const alphaTokens = await this.getActiveAlphaTokens(database);
      
      if (alphaTokens.length === 0) {
        console.log('ℹ️ No active alpha tokens found');
        return;
      }

      console.log(`📊 Updating prices for ${alphaTokens.length} tokens...`);
      
      const updatePromises = alphaTokens.map(token => this.updateTokenPrice(token.symbol, database));
      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Price update completed: ${successful} successful, ${failed} failed`);
      
    } catch (error) {
      console.error('❌ Error in price update cycle:', error.message);
    }
  }

  async updateTokenPrice(symbol, database) {
    try {
      const tokenData = await binanceService.getTokenData(symbol);
      
      if (!tokenData) {
        console.log(`⚠️ No data received for ${symbol}`);
        return;
      }

      // Update or insert token data
      await this.upsertTokenData(symbol, tokenData, database);
      
      // Add to price history
      await this.addPriceHistory(symbol, tokenData, database);

      // Add futures data if available
      if (tokenData.isFuturesListed) {
        await this.addFuturesData(symbol, database);
      }
      
      console.log(`✅ Updated ${symbol}: $${tokenData.price.toFixed(6)}`);
      
    } catch (error) {
      console.error(`❌ Error updating price for ${symbol}:`, error.message);
    }
  }

  async upsertTokenData(symbol, tokenData, database) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO tokens (
          symbol, price_usdt, volume_24h, price_change_24h, price_change_percent_24h,
          market_cap, fdv, is_futures_listed, futures_listing_date, futures_contract_type,
          futures_base_asset, futures_quote_asset, futures_price_precision, futures_quantity_precision, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(symbol) DO UPDATE SET
          price_usdt = excluded.price_usdt,
          volume_24h = excluded.volume_24h,
          price_change_24h = excluded.price_change_24h,
          price_change_percent_24h = excluded.price_change_percent_24h,
          market_cap = excluded.market_cap,
          fdv = excluded.fdv,
          is_futures_listed = excluded.is_futures_listed,
          futures_listing_date = excluded.futures_listing_date,
          futures_contract_type = excluded.futures_contract_type,
          futures_base_asset = excluded.futures_base_asset,
          futures_quote_asset = excluded.futures_quote_asset,
          futures_price_precision = excluded.futures_price_precision,
          futures_quantity_precision = excluded.futures_quantity_precision,
          updated_at = excluded.updated_at
      `;

      const values = [
        symbol,
        tokenData.price,
        tokenData.volume24h,
        tokenData.priceChange24h,
        tokenData.priceChangePercent24h,
        tokenData.marketCap,
        tokenData.fdv,
        tokenData.isFuturesListed,
        tokenData.futuresInfo?.listingDate || null,
        tokenData.futuresInfo?.contractType || null,
        tokenData.futuresInfo?.baseAsset || null,
        tokenData.futuresInfo?.quoteAsset || null,
        tokenData.futuresInfo?.pricePrecision || null,
        tokenData.futuresInfo?.quantityPrecision || null,
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

  async addPriceHistory(symbol, tokenData, database) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO price_history (token_symbol, price_usdt, volume_24h, timestamp)
        VALUES (?, ?, ?, ?)
      `;

      const values = [
        symbol,
        tokenData.price,
        tokenData.volume24h,
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

  async addFuturesData(symbol, database) {
    try {
      const [fundingRate, openInterest] = await Promise.all([
        binanceService.getFuturesFundingRate(symbol),
        binanceService.getFuturesOpenInterest(symbol)
      ]);

      if (fundingRate || openInterest) {
        return new Promise((resolve, reject) => {
          const query = `
            INSERT INTO futures_data (token_symbol, funding_rate, open_interest, open_interest_value, timestamp)
            VALUES (?, ?, ?, ?, ?)
          `;

          const values = [
            symbol,
            fundingRate?.fundingRate || null,
            openInterest?.openInterest || null,
            openInterest?.openInterestValue || null,
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
    } catch (error) {
      console.error(`❌ Error adding futures data for ${symbol}:`, error.message);
    }
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

  // Manual price update for a specific token
  async updateSpecificToken(symbol) {
    try {
      console.log(`🔄 Manually updating price for ${symbol}...`);
      const database = getDatabase();
      await this.updateTokenPrice(symbol, database);
      console.log(`✅ Manual update completed for ${symbol}`);
    } catch (error) {
      console.error(`❌ Error in manual update for ${symbol}:`, error.message);
      throw error;
    }
  }

  // Get price history for a token
  async getPriceHistory(symbol, limit = 100) {
    try {
      const database = getDatabase();
      
      return new Promise((resolve, reject) => {
        const query = `
          SELECT price_usdt, volume_24h, timestamp
          FROM price_history 
          WHERE token_symbol = ? 
          ORDER BY timestamp DESC 
          LIMIT ?
        `;

        database.all(query, [symbol, limit], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error getting price history for ${symbol}:`, error.message);
      return [];
    }
  }
}

const priceService = new PriceService();

module.exports = {
  startPriceUpdates: () => priceService.startPriceUpdates(),
  stopPriceUpdates: () => priceService.stopPriceUpdates(),
  updateSpecificToken: (symbol) => priceService.updateSpecificToken(symbol),
  getPriceHistory: (symbol, limit) => priceService.getPriceHistory(symbol, limit)
}; 