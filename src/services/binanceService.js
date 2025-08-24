const axios = require('axios');

class BinanceService {
  constructor() {
    this.baseURL = 'https://api.binance.com';
    this.futuresURL = 'https://fapi.binance.com';
    this.alphaURL = 'https://www.binance.com';
    this.apiKey = process.env.BINANCE_API_KEY;
    this.secretKey = process.env.BINANCE_SECRET_KEY;
    
    // Cải tiến axios configuration cho production
    this.axiosConfig = {
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'AlphaChecker/1.0.0',
        'Accept': 'application/json'
      },
      // Retry configuration
      retry: 3,
      retryDelay: 1000
    };
  }

  // Helper function để retry requests
  async retryRequest(requestFn, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Log retry attempt
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for futures API...`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  // Get 24hr ticker for a symbol
  async get24hrTicker(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/ticker/24hr`, {
        params: { symbol: symbol + 'USDT' },
        ...this.axiosConfig
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching 24hr ticker for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get current price for a symbol
  async getCurrentPrice(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/ticker/price`, {
        params: { symbol: symbol + 'USDT' },
        ...this.axiosConfig
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching current price for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get exchange info for a symbol
  async getExchangeInfo(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/exchangeInfo`, this.axiosConfig);
      const symbolInfo = response.data.symbols.find(s => s.symbol === symbol + 'USDT');
      return symbolInfo;
    } catch (error) {
      console.error(`❌ Error fetching exchange info for ${symbol}:`, error.message);
      return null;
    }
  }

  // Check if futures are available for a symbol - CẢI TIẾN VỚI RETRY LOGIC
  async checkFuturesAvailability(symbol) {
    try {
      // Rate limiting protection - delay giữa các requests
      if (this.lastRequestTime) {
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < 100) { // Minimum 100ms between requests
          await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
        }
      }
      this.lastRequestTime = Date.now();

      // Sử dụng retry logic
      const response = await this.retryRequest(async () => {
        console.log(`🔍 Checking futures for ${symbol}...`);
        return await axios.get(`${this.futuresURL}/fapi/v1/exchangeInfo`, this.axiosConfig);
      });

      // Validate response
      if (!response || !response.data || !response.data.symbols) {
        console.error(`❌ Invalid response structure for ${symbol} futures check`);
        return this.getDefaultFuturesResponse(symbol, 'INVALID_RESPONSE');
      }

      const symbolInfo = response.data.symbols.find(s => s.symbol === symbol + 'USDT');
      
      if (symbolInfo) {
        console.log(`✅ ${symbol} futures found: ${symbolInfo.status}`);
      } else {
        console.log(`ℹ️ ${symbol} futures not found`);
      }

      return {
        isAvailable: !!symbolInfo,
        symbol: symbol + 'USDT',
        status: symbolInfo ? symbolInfo.status : 'NOT_FOUND',
        contractType: symbolInfo ? symbolInfo.contractType : null,
        listingDate: symbolInfo ? symbolInfo.onboardDate : null,
        baseAsset: symbolInfo ? symbolInfo.baseAsset : null,
        quoteAsset: symbolInfo ? symbolInfo.quoteAsset : null,
        pricePrecision: symbolInfo ? symbolInfo.pricePrecision : null,
        quantityPrecision: symbolInfo ? symbolInfo.quantityPrecision : null
      };

    } catch (error) {
      console.error(`❌ Error checking futures availability for ${symbol}:`, error.message);
      
      // Log detailed error info
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
        
        // Handle specific error codes
        if (error.response.status === 429) {
          console.log(`   ⚠️ Rate limited - waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
      } else if (error.request) {
        console.error(`   Request made but no response received`);
      } else {
        console.error(`   Error setting up request:`, error.message);
      }

      return this.getDefaultFuturesResponse(symbol, 'ERROR');
    }
  }

  // Helper function để tạo default response
  getDefaultFuturesResponse(symbol, status) {
    return {
      isAvailable: false,
      symbol: symbol + 'USDT',
      status: status,
      contractType: null,
      listingDate: null,
      baseAsset: null,
      quoteAsset: null,
      pricePrecision: null,
      quantityPrecision: null
    };
  }

  // Get futures account trade list (requires authentication)
  async getFuturesTradeList(symbol, options = {}) {
    try {
      if (!this.apiKey || !this.secretKey) {
        throw new Error('API key and secret required for futures trading data');
      }

      const params = {
        symbol: symbol + 'USDT',
        timestamp: Date.now(),
        ...options
      };

      // Add signature for authenticated requests
      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      const signature = this.generateSignature(queryString);
      params.signature = signature;

      const response = await axios.get(`${this.futuresURL}/fapi/v1/userTrades`, {
        params,
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching futures trade list for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get futures position information
  async getFuturesPositions(symbol = null) {
    try {
      if (!this.apiKey || !this.secretKey) {
        throw new Error('API key and secret required for futures position data');
      }

      const params = {
        timestamp: Date.now()
      };

      if (symbol) {
        params.symbol = symbol + 'USDT';
      }

      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      const signature = this.generateSignature(queryString);
      params.signature = signature;

      const response = await axios.get(`${this.futuresURL}/fapi/v2/positionRisk`, {
        params,
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error fetching futures positions:', error.message);
      return null;
    }
  }

  // Get futures account information
  async getFuturesAccountInfo() {
    try {
      if (!this.apiKey || !this.secretKey) {
        throw new Error('API key and secret required for futures account data');
      }

      const params = {
        timestamp: Date.now()
      };

      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      const signature = this.generateSignature(queryString);
      params.signature = signature;

      const response = await axios.get(`${this.futuresURL}/fapi/v2/account`, {
        params,
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error fetching futures account info:', error.message);
      return null;
    }
  }

  // Get futures funding rate
  async getFuturesFundingRate(symbol) {
    try {
      const response = await axios.get(`${this.futuresURL}/fapi/v1/fundingRate`, {
        params: { 
          symbol: symbol + 'USDT',
          limit: 1
        }
      });
      return response.data[0];
    } catch (error) {
      console.error(`❌ Error fetching funding rate for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get futures open interest
  async getFuturesOpenInterest(symbol) {
    try {
      const response = await axios.get(`${this.futuresURL}/fapi/v1/openInterest`, {
        params: { symbol: symbol + 'USDT' }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching open interest for ${symbol}:`, error.message);
      return null;
    }
  }

  // Generate HMAC SHA256 signature for authenticated requests
  generateSignature(queryString) {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', this.secretKey).update(queryString).digest('hex');
  }

  // Get all Alpha tokens from Binance Alpha API
  async getAllAlphaTokens() {
    try {
      const response = await axios.get(`${this.alphaURL}/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list`);
      
      if (response.data.code === '000000') {
        return response.data.data.map(token => ({
          alphaId: token.alphaId,
          symbol: token.symbol,
          name: token.name,
          chainId: token.chainId,
          contractAddress: token.contractAddress,
          decimals: token.decimals,
          network: token.network
        }));
      } else {
        console.error('❌ Alpha API error:', response.data.message);
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching Alpha tokens:', error.message);
      return [];
    }
  }

  // Get all USDT trading pairs
  async getAllUSDTPairs() {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/exchangeInfo`);
      const usdtPairs = response.data.symbols
        .filter(symbol => symbol.symbol.endsWith('USDT') && symbol.status === 'TRADING')
        .map(symbol => ({
          symbol: symbol.symbol.replace('USDT', ''),
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          status: symbol.status,
          permissions: symbol.permissions
        }));
      return usdtPairs;
    } catch (error) {
      console.error('❌ Error fetching all USDT pairs:', error.message);
      return [];
    }
  }

  // Get order book for a symbol
  async getOrderBook(symbol, limit = 10) {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/depth`, {
        params: { symbol: symbol + 'USDT', limit }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching order book for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get recent trades for a symbol
  async getRecentTrades(symbol, limit = 100) {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/trades`, {
        params: { symbol: symbol + 'USDT', limit }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching recent trades for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get kline/candlestick data
  async getKlines(symbol, interval = '1h', limit = 100) {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/klines`, {
        params: { symbol: symbol + 'USDT', interval, limit }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching klines for ${symbol}:`, error.message);
      return null;
    }
  }

  // Calculate market cap (approximate)
  calculateMarketCap(price, circulatingSupply) {
    if (!price || !circulatingSupply) return null;
    return price * circulatingSupply;
  }

  // Calculate FDV (Fully Diluted Valuation)
  calculateFDV(price, totalSupply) {
    if (!price || !totalSupply) return null;
    return price * totalSupply;
  }

  // Get comprehensive token data
  async getTokenData(symbol) {
    try {
      const [ticker24hr, exchangeInfo, futuresInfo] = await Promise.all([
        this.get24hrTicker(symbol),
        this.getExchangeInfo(symbol),
        this.checkFuturesAvailability(symbol)
      ]);

      if (!ticker24hr) {
        return null;
      }

      const price = parseFloat(ticker24hr.lastPrice);
      const volume24h = parseFloat(ticker24hr.volume);
      const priceChange24h = parseFloat(ticker24hr.priceChange);
      const priceChangePercent24h = parseFloat(ticker24hr.priceChangePercent);

      // Note: Binance API doesn't provide total supply directly
      // This would need to be fetched from other sources or blockchain
      const totalSupply = null;
      const circulatingSupply = null;

      return {
        symbol,
        price,
        volume24h,
        priceChange24h,
        priceChangePercent24h,
        totalSupply,
        circulatingSupply,
        marketCap: this.calculateMarketCap(price, circulatingSupply),
        fdv: this.calculateFDV(price, totalSupply),
        isFuturesListed: futuresInfo.isAvailable,
        futuresInfo,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error getting comprehensive token data for ${symbol}:`, error.message);
      return null;
    }
  }

  // Get all alpha tokens from Binance Alpha API
  async getAlphaTokenList() {
    try {
      console.log('🔄 Fetching alpha tokens from Binance Alpha API...');
      
      const response = await axios.get(`${this.alphaURL}/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list`, {
        timeout: 30000 // 30 seconds timeout
      });
      
      if (response.data && response.data.success === true && response.data.code === '000000') {
        console.log(`✅ Successfully fetched ${response.data.data.length} alpha tokens`);
        return response.data;
      } else {
        console.warn('⚠️ Alpha API response indicates failure:', response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching from Alpha API:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }
}

module.exports = new BinanceService(); 