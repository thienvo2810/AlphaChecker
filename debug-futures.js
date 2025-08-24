const axios = require('axios');

// Debug script để kiểm tra futures API
async function debugFuturesAPI() {
  console.log('🔍 Debugging Futures API...\n');
  
  const futuresURL = 'https://fapi.binance.com';
  const testSymbols = ['BTC', 'ETH', 'DOGE', 'WIF', 'PEPE', 'SHIB'];
  
  try {
    // Test 1: Basic API call
    console.log('📊 Test 1: Basic futures API call...');
    const startTime = Date.now();
    
    const response = await axios.get(`${futuresURL}/fapi/v1/exchangeInfo`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'AlphaChecker/1.0.0 (Debug)',
        'Accept': 'application/json'
      }
    });
    
    const endTime = Date.now();
    console.log(`✅ API call successful in ${endTime - startTime}ms`);
    console.log(`📈 Response status: ${response.status}`);
    console.log(`📊 Total symbols: ${response.data.symbols.length}`);
    
    // Test 2: Check specific symbols
    console.log('\n🔍 Test 2: Checking specific symbols...');
    for (const symbol of testSymbols) {
      const symbolInfo = response.data.symbols.find(s => s.symbol === symbol + 'USDT');
      if (symbolInfo) {
        console.log(`✅ ${symbol}USDT: ${symbolInfo.status} | Contract: ${symbolInfo.contractType}`);
      } else {
        console.log(`❌ ${symbol}USDT: NOT_FOUND`);
      }
    }
    
    // Test 3: Check response structure
    console.log('\n📋 Test 3: Checking response structure...');
    const firstSymbol = response.data.symbols[0];
    console.log('First symbol structure:');
    console.log(`- Symbol: ${firstSymbol.symbol}`);
    console.log(`- Status: ${firstSymbol.status}`);
    console.log(`- Contract Type: ${firstSymbol.contractType}`);
    console.log(`- Onboard Date: ${firstSymbol.onboardDate}`);
    
    // Test 4: Check for any issues
    console.log('\n⚠️ Test 4: Checking for potential issues...');
    
    // Check for symbols with null/undefined values
    const symbolsWithIssues = response.data.symbols.filter(s => 
      !s.symbol || !s.status || s.status === 'BREAK' || s.status === 'AUCTION_MATCH'
    );
    
    if (symbolsWithIssues.length > 0) {
      console.log(`Found ${symbolsWithIssues.length} symbols with potential issues:`);
      symbolsWithIssues.slice(0, 5).forEach(s => {
        console.log(`  - ${s.symbol}: ${s.status}`);
      });
    } else {
      console.log('✅ No symbols with obvious issues found');
    }
    
    // Test 5: Performance test
    console.log('\n⚡ Test 5: Performance test...');
    const searchStart = Date.now();
    
    // Search for multiple symbols
    const searchResults = testSymbols.map(symbol => {
      const found = response.data.symbols.find(s => s.symbol === symbol + 'USDT');
      return { symbol, found: !!found, status: found?.status || 'NOT_FOUND' };
    });
    
    const searchEnd = Date.now();
    console.log(`Search completed in ${searchEnd - searchStart}ms`);
    
    searchResults.forEach(result => {
      console.log(`  ${result.symbol}: ${result.found ? '✅' : '❌'} (${result.status})`);
    });
    
    console.log('\n🎉 Debug completed successfully!');
    
  } catch (error) {
    console.error('❌ Error in debug:', error.message);
    
    if (error.response) {
      console.error('Response details:');
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, error.response.data);
      console.error(`  Headers:`, error.response.headers);
    } else if (error.request) {
      console.error('Request details:');
      console.error(`  Request made but no response received`);
      console.error(`  Request config:`, error.request);
    } else {
      console.error('Error details:');
      console.error(`  Message: ${error.message}`);
      console.error(`  Stack:`, error.stack);
    }
  }
}

// Test specific error scenarios
async function testErrorScenarios() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING ERROR SCENARIOS');
  console.log('='.repeat(60));
  
  try {
    // Test timeout
    console.log('\n⏰ Test 1: Timeout scenario...');
    try {
      await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo', { timeout: 1000 });
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.log('✅ Timeout handled correctly');
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }
    
    // Test invalid URL
    console.log('\n🔍 Test 2: Invalid URL...');
    try {
      await axios.get('https://invalid-futures-url.com/api', { timeout: 5000 });
    } catch (error) {
      if (error.code === 'ENOTFOUND') {
        console.log('✅ Invalid URL handled correctly');
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in error scenarios:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  await debugFuturesAPI();
  await testErrorScenarios();
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { debugFuturesAPI, testErrorScenarios }; 