const express = require('express');
const router = express.Router();
const tokenInfoService = require('../services/tokenInfoService');
const priceService = require('../services/priceService');
const binanceService = require('../services/binanceService');

// Get all alpha tokens with their current data
router.get('/', async (req, res) => {
  try {
    const { futures_only, all_available } = req.query;
    
    let tokens;
    if (futures_only === 'true') {
      tokens = await tokenInfoService.getFuturesListedAlphaTokens();
    } else if (all_available === 'true') {
      tokens = await tokenInfoService.getAllAlphaTokensWithStatus();
    } else {
      tokens = await tokenInfoService.getAllAlphaTokens();
    }
    
    res.json({
      success: true,
      data: tokens,
      count: tokens.length,
      futures_only: futures_only === 'true',
      all_available: all_available === 'true',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting alpha tokens:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alpha tokens',
      message: error.message
    });
  }
});

// Get specific token details
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const token = await tokenInfoService.getTokenDetails(symbol);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        message: `Token ${symbol} not found in database`
      });
    }

    res.json({
      success: true,
      data: token,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error getting token ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token details',
      message: error.message
    });
  }
});

// Get current price for a token
router.get('/:symbol/price', async (req, res) => {
  try {
    const { symbol } = req.params;
    const priceData = await binanceService.getCurrentPrice(symbol);
    
    if (!priceData) {
      return res.status(404).json({
        success: false,
        error: 'Price not found',
        message: `Could not fetch price for ${symbol}`
      });
    }

    res.json({
      success: true,
      data: priceData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error getting price for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price',
      message: error.message
    });
  }
});

// Get futures status for a token
router.get('/:symbol/futures', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { name } = req.query; // Get token name from query parameter
    
    console.log(`🚀 Enhanced Futures API called for symbol: ${symbol}, name: ${name}`);
    
    if (!name) {
      console.log(`⚠️ No token name provided for ${symbol}, using basic futures check`);
      const futuresData = await binanceService.checkFuturesAvailability(symbol);
      
      console.log(`📊 Basic futures data received for ${symbol}:`, futuresData);
      
      res.json({
        success: true,
        data: futuresData,
        timestamp: new Date().toISOString(),
        note: 'Basic check - no name verification performed'
      });
      return;
    }
    
    console.log(`🔍 Calling enhanced futures check with verification for ${symbol} (${name})...`);
    const futuresData = await tokenInfoService.checkFuturesStatusWithVerification(symbol, name);
    
    console.log(`📊 Enhanced futures data received for ${symbol}:`, futuresData);
    
    res.json({
      success: true,
        data: futuresData,
        timestamp: new Date().toISOString(),
        verification: futuresData.verificationStatus
    });
  } catch (error) {
    console.error(`❌ Error checking futures for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check futures status',
      message: error.message
    });
  }
});

// Get futures funding rate for a token
router.get('/:symbol/futures/funding-rate', async (req, res) => {
  try {
    const { symbol } = req.params;
    const fundingRate = await binanceService.getFuturesFundingRate(symbol);
    
    if (!fundingRate) {
      return res.status(404).json({
        success: false,
        error: 'Funding rate not found',
        message: `Could not fetch funding rate for ${symbol}`
      });
    }

    res.json({
      success: true,
      data: fundingRate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error fetching funding rate for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funding rate',
      message: error.message
    });
  }
});

// Get futures open interest for a token
router.get('/:symbol/futures/open-interest', async (req, res) => {
  try {
    const { symbol } = req.params;
    const openInterest = await binanceService.getFuturesOpenInterest(symbol);
    
    if (!openInterest) {
      return res.status(404).json({
        success: false,
        error: 'Open interest not found',
        message: `Could not fetch open interest for ${symbol}`
      });
    }

    res.json({
      success: true,
      data: openInterest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error fetching open interest for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch open interest',
      message: error.message
    });
  }
});

// Get futures account positions (requires authentication)
router.get('/futures/positions', async (req, res) => {
  try {
    const { symbol } = req.query;
    const positions = await binanceService.getFuturesPositions(symbol);
    
    if (!positions) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'API key and secret required for futures position data'
      });
    }

    res.json({
      success: true,
      data: positions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching futures positions:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch futures positions',
      message: error.message
    });
  }
});

// Get futures account info (requires authentication)
router.get('/futures/account', async (req, res) => {
  try {
    const accountInfo = await binanceService.getFuturesAccountInfo();
    
    if (!accountInfo) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'API key and secret required for futures account data'
      });
    }

    res.json({
      success: true,
      data: accountInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching futures account info:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch futures account info',
      message: error.message
    });
  }
});

// Get comprehensive token data
router.get('/:symbol/data', async (req, res) => {
  try {
    const { symbol } = req.params;
    const tokenData = await binanceService.getTokenData(symbol);
    
    if (!tokenData) {
      return res.status(404).json({
        success: false,
        error: 'Token data not found',
        message: `Could not fetch data for ${symbol}`
      });
    }

    res.json({
      success: true,
      data: tokenData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error getting data for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token data',
      message: error.message
    });
  }
});

// Get price history for a token
router.get('/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100 } = req.query;
    
    const history = await priceService.getPriceHistory(symbol, parseInt(limit));
    
    res.json({
      success: true,
      data: history,
      count: history.length,
      symbol,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error getting history for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price history',
      message: error.message
    });
  }
});

// Add new alpha token
router.post('/', async (req, res) => {
  try {
    const { symbol, priority = 0, notes = '', useAlphaAPI = false } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field',
        message: 'Symbol is required'
      });
    }

    let tokenId;
    let alphaData = null;

    // If useAlphaAPI is true, try to fetch data from Binance Alpha API
    if (useAlphaAPI) {
      try {
        const alphaTokens = await binanceService.getAllAlphaTokens();
        alphaData = alphaTokens.find(token => 
          token.symbol.toUpperCase() === symbol.toUpperCase()
        );
        
        if (alphaData) {
          console.log(`📊 Found Alpha API data for ${symbol}:`, alphaData);
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch Alpha API data for ${symbol}:`, error.message);
      }
    }

    tokenId = await tokenInfoService.addAlphaToken(symbol, priority, notes, alphaData);
    
    res.status(201).json({
      success: true,
      message: `Token ${symbol} added successfully`,
      data: { 
        id: tokenId, 
        symbol, 
        priority, 
        notes,
        alphaData: alphaData ? {
          alphaId: alphaData.alphaId,
          name: alphaData.name,
          chainId: alphaData.chainId,
          network: alphaData.network
        } : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error adding alpha token:', error.message);
    res.status(400).json({
      success: false,
      error: 'Failed to add alpha token',
      message: error.message
    });
  }
});

// Update token priority
router.put('/:symbol/priority', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { priority } = req.body;
    
    if (priority === undefined || priority < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority',
        message: 'Priority must be a non-negative number'
      });
    }

    const changes = await tokenInfoService.updateTokenPriority(symbol, priority);
    
    res.json({
      success: true,
      message: `Priority updated for ${symbol}`,
      data: { symbol, priority, changes },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error updating priority for ${req.params.symbol}:`, error.message);
    res.status(400).json({
      success: false,
      error: 'Failed to update priority',
      message: error.message
    });
  }
});

// Remove alpha token
router.delete('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const changes = await tokenInfoService.removeAlphaToken(symbol);
    
    res.json({
      success: true,
      message: `Token ${symbol} deactivated successfully`,
      data: { symbol, changes },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error removing alpha token ${req.params.symbol}:`, error.message);
    res.status(400).json({
      success: false,
      error: 'Failed to remove alpha token',
      message: error.message
    });
  }
});

// Search tokens
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20 } = req.query;
    
    const results = await tokenInfoService.searchTokens(query, parseInt(limit));
    
    res.json({
      success: true,
      data: results,
      count: results.length,
      query,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error searching tokens:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to search tokens',
      message: error.message
    });
  }
});

// Manual price update for a token
router.post('/:symbol/update', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    await priceService.updateSpecificToken(symbol);
    
    res.json({
      success: true,
      message: `Price updated for ${symbol}`,
      data: { symbol },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error manually updating ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update price',
      message: error.message
    });
  }
});

// Get all available USDT pairs from Binance
router.get('/pairs/usdt', async (req, res) => {
  try {
    const pairs = await binanceService.getAllUSDTPairs();
    
    res.json({
      success: true,
      data: pairs,
      count: pairs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching USDT pairs:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch USDT pairs',
      message: error.message
    });
  }
});

// Get all Alpha tokens from Binance Alpha API
router.get('/alpha/list', async (req, res) => {
  try {
    const alphaTokens = await binanceService.getAllAlphaTokens();
    
    res.json({
      success: true,
      data: alphaTokens,
      count: alphaTokens.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching Alpha tokens:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Alpha tokens',
      message: error.message
    });
  }
});

// Get live data for a specific token (on-demand)
router.get('/:symbol/live', async (req, res) => {
  try {
    const { symbol } = req.params;
    const liveData = await tokenInfoService.getTokenLiveData(symbol);
    
    res.json({
      success: true,
      symbol,
      data: liveData
    });
  } catch (error) {
    console.error(`❌ Error getting live data for ${req.params.symbol}:`, error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get live data',
      message: error.message 
    });
  }
});

module.exports = router; 