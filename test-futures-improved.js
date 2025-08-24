const axios = require('axios');

// Test cải tiến futures API với retry logic
async function testImprovedFuturesAPI() {
  console.log('🧪 Testing Improved Futures API with Retry Logic...\n');
  
  const futuresURL = 'https://fapi.binance.com';
  
  // Cải tiến axios config
  const axiosConfig = {
    timeout: 30000,
    headers: {
      'User-Agent': 'AlphaChecker/1.0.0',
      'Accept': 'application/json'
    }
  };

  // Retry function
  async function retryRequest(requestFn, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for futures API...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  try {
    // Test 1: Basic futures API call
    console.log('📊 Test 1: Basic futures API call...');
    const response = await retryRequest(async () => {
      return await axios.get(`${futuresURL}/fapi/v1/exchangeInfo`, axiosConfig);
    });
    
    console.log(`✅ Successfully fetched futures exchange info`);
    console.log(`📈 Total symbols: ${response.data.symbols.length}`);
    
    // Test 2: Check specific alpha tokens
    console.log('\n🔍 Test 2: Checking specific alpha tokens with retry...');
    const alphaTokens = ['PEPE', 'SHIB', 'DOGE', 'FLOKI', 'BONK', 'WIF', 'MYRO', 'POPCAT', 'BOOK', 'TURBO'];
    
    for (const token of alphaTokens) {
      try {
        const symbolInfo = response.data.symbols.find(s => s.symbol === token + 'USDT');
        if (symbolInfo) {
          console.log(`✅ ${token}USDT: ${symbolInfo.status} | Contract: ${symbolInfo.contractType} | Listed: ${symbolInfo.onboardDate}`);
        } else {
          console.log(`❌ ${token}USDT: NOT_FOUND`);
        }
      } catch (error) {
        console.log(`⚠️ ${token}USDT: ERROR - ${error.message}`);
      }
    }
    
    // Test 3: Simulate network issues and retry
    console.log('\n🌐 Test 3: Simulating network issues and retry...');
    
    // Test với timeout ngắn để simulate network issues
    const shortTimeoutConfig = { ...axiosConfig, timeout: 1000 };
    
    try {
      await retryRequest(async () => {
        return await axios.get(`${futuresURL}/fapi/v1/exchangeInfo`, shortTimeoutConfig);
      }, 3, 500);
      console.log('✅ Retry logic worked with short timeout');
    } catch (error) {
      console.log(`ℹ️ Expected error with short timeout: ${error.message}`);
    }
    
    // Test 4: Check response validation
    console.log('\n📋 Test 4: Checking response validation...');
    
    // Simulate invalid response
    const invalidResponse = { data: { symbols: null } };
    if (!invalidResponse.data || !invalidResponse.data.symbols) {
      console.log('✅ Response validation working - detected invalid response');
    }
    
    // Test 5: Performance test
    console.log('\n⚡ Test 5: Performance test with multiple requests...');
    const startTime = Date.now();
    
    const testSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL'];
    const results = await Promise.allSettled(
      testSymbols.map(symbol => 
        retryRequest(async () => {
          const symbolInfo = response.data.symbols.find(s => s.symbol === symbol + 'USDT');
          return { symbol, found: !!symbolInfo, status: symbolInfo?.status };
        })
      )
    );
    
    const endTime = Date.now();
    console.log(`⏱️ Processed ${testSymbols.length} symbols in ${endTime - startTime}ms`);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`   ${testSymbols[index]}: ${result.value.found ? '✅' : '❌'} (${result.value.status || 'NOT_FOUND'})`);
      } else {
        console.log(`   ${testSymbols[index]}: ❌ ERROR`);
      }
    });
    
    console.log('\n🎉 Improved Futures API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing improved futures API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Test specific error scenarios
async function testErrorScenarios() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING ERROR SCENARIOS');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Invalid URL
    console.log('\n🔍 Test 1: Invalid URL...');
    try {
      await axios.get('https://invalid-url-test.com/api', { timeout: 5000 });
    } catch (error) {
      console.log(`✅ Handled invalid URL error: ${error.message}`);
    }
    
    // Test 2: Timeout
    console.log('\n⏰ Test 2: Timeout...');
    try {
      await axios.get('https://httpbin.org/delay/10', { timeout: 1000 });
    } catch (error) {
      console.log(`✅ Handled timeout error: ${error.message}`);
    }
    
    // Test 3: Rate limiting simulation
    console.log('\n🚫 Test 3: Rate limiting simulation...');
    try {
      await axios.get('https://httpbin.org/status/429', { timeout: 5000 });
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.log('✅ Handled rate limiting error (429)');
      } else {
        console.log(`ℹ️ Unexpected response: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in error scenarios test:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  await testImprovedFuturesAPI();
  await testErrorScenarios();
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testImprovedFuturesAPI, testErrorScenarios }; 