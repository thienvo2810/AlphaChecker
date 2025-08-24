const axios = require('axios');

// Debug script để test futures API trên Railway
async function debugFuturesOnRailway() {
  console.log('🔍 Debugging Futures API on Railway...\n');
  
  const railwayURL = 'https://alphachecker-production.up.railway.app';
  const testSymbols = ['BTC', 'ETH', 'DOGE', 'WIF'];
  
  try {
    // Test 1: Check server status
    console.log('📊 Test 1: Checking server status...');
    const statusResponse = await axios.get(railwayURL);
    console.log(`✅ Server status: ${statusResponse.status}`);
    
    // Test 2: Check API endpoints
    console.log('\n🔍 Test 2: Checking API endpoints...');
    
    try {
      const tokensResponse = await axios.get(`${railwayURL}/api/tokens`);
      console.log(`✅ /api/tokens: ${tokensResponse.status} - ${tokensResponse.data.length || 'No data'} tokens`);
    } catch (error) {
      console.log(`❌ /api/tokens: ${error.response?.status || error.message}`);
    }
    
    // Test 3: Test futures API for specific symbols
    console.log('\n🎯 Test 3: Testing futures API for specific symbols...');
    
    for (const symbol of testSymbols) {
      try {
        console.log(`\n🔍 Testing ${symbol}...`);
        
        // Test futures endpoint
        const futuresResponse = await axios.get(`${railwayURL}/api/tokens/futures/${symbol}`);
        console.log(`✅ ${symbol} futures API:`, {
          status: futuresResponse.status,
          data: futuresResponse.data
        });
        
        // Check if futures data is correct
        if (futuresResponse.data && futuresResponse.data.isAvailable !== undefined) {
          console.log(`📊 ${symbol} futures status: ${futuresResponse.data.isAvailable}`);
          if (futuresResponse.data.isAvailable) {
            console.log(`   Contract: ${futuresResponse.data.contractType}`);
            console.log(`   Listed: ${futuresResponse.data.listingDate}`);
          }
        } else {
          console.log(`⚠️ ${symbol} futures data structure:`, futuresResponse.data);
        }
        
      } catch (error) {
        console.log(`❌ ${symbol} futures API error:`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
      }
    }
    
    // Test 4: Check database directly
    console.log('\n🗄️ Test 4: Checking database data...');
    
    try {
      const dbResponse = await axios.get(`${railwayURL}/api/tokens/db-status`);
      console.log(`✅ Database status:`, dbResponse.data);
    } catch (error) {
      console.log(`ℹ️ Database endpoint not available: ${error.message}`);
    }
    
    console.log('\n🎉 Debug completed!');
    
  } catch (error) {
    console.error('❌ Error in debug:', error.message);
    if (error.response) {
      console.error('Response details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
  }
}

// Test specific error scenarios
async function testErrorScenarios() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING ERROR SCENARIOS');
  console.log('='.repeat(60));
  
  const railwayURL = 'https://alphachecker-production.up.railway.app';
  
  try {
    // Test 1: Invalid symbol
    console.log('\n🔍 Test 1: Invalid symbol...');
    try {
      await axios.get(`${railwayURL}/api/tokens/futures/INVALID_SYMBOL`);
    } catch (error) {
      console.log(`✅ Invalid symbol handled: ${error.response?.status || error.message}`);
    }
    
    // Test 2: Non-existent endpoint
    console.log('\n🔍 Test 2: Non-existent endpoint...');
    try {
      await axios.get(`${railwayURL}/api/non-existent`);
    } catch (error) {
      console.log(`✅ Non-existent endpoint handled: ${error.response?.status || error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error in error scenarios:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  await debugFuturesOnRailway();
  await testErrorScenarios();
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { debugFuturesOnRailway, testErrorScenarios }; 