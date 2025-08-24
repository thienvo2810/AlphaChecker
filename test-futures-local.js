const axios = require('axios');

// Test futures API locally
async function testFuturesAPI() {
  console.log('🧪 Testing Futures API locally...\n');
  
  const futuresURL = 'https://fapi.binance.com';
  const testSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'LINK', 'UNI', 'AVAX'];
  
  try {
    // Test 1: Get futures exchange info
    console.log('📊 Test 1: Getting futures exchange info...');
    const exchangeInfoResponse = await axios.get(`${futuresURL}/fapi/v1/exchangeInfo`);
    console.log(`✅ Successfully fetched futures exchange info`);
    console.log(`📈 Total symbols: ${exchangeInfoResponse.data.symbols.length}`);
    
    // Test 2: Check specific symbols
    console.log('\n🔍 Test 2: Checking specific symbols...');
    for (const symbol of testSymbols) {
      const symbolInfo = exchangeInfoResponse.data.symbols.find(s => s.symbol === symbol + 'USDT');
      if (symbolInfo) {
        console.log(`✅ ${symbol}USDT: ${symbolInfo.status} | Contract: ${symbolInfo.contractType} | Listed: ${symbolInfo.onboardDate}`);
      } else {
        console.log(`❌ ${symbol}USDT: NOT_FOUND`);
      }
    }
    
    // Test 3: Check some random alpha tokens
    console.log('\n🎯 Test 3: Checking random alpha tokens...');
    const alphaTokens = ['PEPE', 'SHIB', 'DOGE', 'FLOKI', 'BONK', 'WIF', 'MYRO', 'POPCAT', 'BOOK', 'TURBO'];
    
    for (const token of alphaTokens) {
      const symbolInfo = exchangeInfoResponse.data.symbols.find(s => s.symbol === token + 'USDT');
      if (symbolInfo) {
        console.log(`✅ ${token}USDT: ${symbolInfo.status} | Contract: ${symbolInfo.contractType} | Listed: ${symbolInfo.onboardDate}`);
      } else {
        console.log(`❌ ${token}USDT: NOT_FOUND`);
      }
    }
    
    // Test 4: Check API response structure
    console.log('\n📋 Test 4: Checking API response structure...');
    const firstSymbol = exchangeInfoResponse.data.symbols[0];
    console.log('First symbol structure:');
    console.log(`- Symbol: ${firstSymbol.symbol}`);
    console.log(`- Status: ${firstSymbol.status}`);
    console.log(`- Contract Type: ${firstSymbol.contractType}`);
    console.log(`- Onboard Date: ${firstSymbol.onboardDate}`);
    console.log(`- Base Asset: ${firstSymbol.baseAsset}`);
    console.log(`- Quote Asset: ${firstSymbol.quoteAsset}`);
    
    // Test 5: Check for any symbols with status !== 'TRADING'
    console.log('\n⚠️ Test 5: Checking symbols with non-TRADING status...');
    const nonTradingSymbols = exchangeInfoResponse.data.symbols.filter(s => s.status !== 'TRADING');
    console.log(`Found ${nonTradingSymbols.length} symbols with non-TRADING status`);
    
    if (nonTradingSymbols.length > 0) {
      const sampleNonTrading = nonTradingSymbols.slice(0, 5);
      sampleNonTrading.forEach(s => {
        console.log(`- ${s.symbol}: ${s.status}`);
      });
    }
    
    // Test 6: Check for any symbols without onboardDate
    console.log('\n📅 Test 6: Checking symbols without onboardDate...');
    const symbolsWithoutDate = exchangeInfoResponse.data.symbols.filter(s => !s.onboardDate);
    console.log(`Found ${symbolsWithoutDate.length} symbols without onboardDate`);
    
    if (symbolsWithoutDate.length > 0) {
      const sampleWithoutDate = symbolsWithoutDate.slice(0, 5);
      sampleWithoutDate.forEach(s => {
        console.log(`- ${s.symbol}: ${s.status} | Date: ${s.onboardDate || 'MISSING'}`);
      });
    }
    
    console.log('\n🎉 Futures API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing futures API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Test specific token futures check
async function testSpecificTokenFutures(symbol) {
  console.log(`\n🔍 Testing futures for specific token: ${symbol}`);
  
  try {
    const futuresURL = 'https://fapi.binance.com';
    const response = await axios.get(`${futuresURL}/fapi/v1/exchangeInfo`);
    const symbolInfo = response.data.symbols.find(s => s.symbol === symbol + 'USDT');
    
    if (symbolInfo) {
      console.log(`✅ ${symbol}USDT found in futures:`);
      console.log(`   Status: ${symbolInfo.status}`);
      console.log(`   Contract Type: ${symbolInfo.contractType}`);
      console.log(`   Onboard Date: ${symbolInfo.onboardDate}`);
      console.log(`   Base Asset: ${symbolInfo.baseAsset}`);
      console.log(`   Quote Asset: ${symbolInfo.quoteAsset}`);
      console.log(`   Price Precision: ${symbolInfo.pricePrecision}`);
      console.log(`   Quantity Precision: ${symbolInfo.quantityPrecision}`);
    } else {
      console.log(`❌ ${symbol}USDT NOT found in futures`);
    }
  } catch (error) {
    console.error(`❌ Error checking ${symbol}:`, error.message);
  }
}

// Run tests
async function runAllTests() {
  await testFuturesAPI();
  
  // Test some specific tokens
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING SPECIFIC TOKENS');
  console.log('='.repeat(60));
  
  const testTokens = ['PEPE', 'SHIB', 'DOGE', 'FLOKI', 'BONK', 'WIF'];
  for (const token of testTokens) {
    await testSpecificTokenFutures(token);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testFuturesAPI, testSpecificTokenFutures }; 