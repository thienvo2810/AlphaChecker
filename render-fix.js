// Render Fix Configuration
// Các cài đặt để fix vấn đề futures API trên Render

const renderFixConfig = {
  // Network settings
  network: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000,
    rateLimitDelay: 100, // Minimum delay between requests
    maxConcurrentRequests: 5
  },

  // Binance API settings
  binance: {
    futuresURL: 'https://fapi.binance.com',
    userAgent: 'AlphaChecker/1.0.0 (Render)',
    acceptHeaders: 'application/json',
    // Rate limiting
    requestsPerMinute: 1200, // Binance limit
    requestsPerSecond: 20
  },

  // Error handling
  errors: {
    // Retry on these status codes
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
    // Don't retry on these status codes
    noRetryStatusCodes: [400, 401, 403, 404],
    // Wait time for rate limiting
    rateLimitWaitTime: 2000
  },

  // Logging
  logging: {
    enableDetailedLogs: true,
    logRequestTimes: true,
    logResponseSizes: true,
    logErrorDetails: true
  }
};

// Helper functions
const renderFixHelpers = {
  // Calculate delay based on rate limiting
  calculateRateLimitDelay: (lastRequestTime, minDelay = 100) => {
    if (!lastRequestTime) return 0;
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    return Math.max(0, minDelay - timeSinceLastRequest);
  },

  // Check if error is retryable
  isRetryableError: (error) => {
    if (!error.response) return true; // Network errors are retryable
    return renderFixConfig.errors.retryStatusCodes.includes(error.response.status);
  },

  // Get appropriate wait time for error
  getErrorWaitTime: (error) => {
    if (error.response && error.response.status === 429) {
      return renderFixConfig.errors.rateLimitWaitTime;
    }
    return renderFixConfig.network.retryDelay;
  },

  // Validate response structure
  validateResponse: (response, expectedFields = ['symbols']) => {
    if (!response || !response.data) return false;
    return expectedFields.every(field => response.data.hasOwnProperty(field));
  },

  // Create axios config for Render
  createAxiosConfig: () => ({
    timeout: renderFixConfig.network.timeout,
    headers: {
      'User-Agent': renderFixConfig.binance.userAgent,
      'Accept': renderFixConfig.binance.acceptHeaders,
      'Connection': 'keep-alive'
    },
    // Connection pooling
    maxRedirects: 5,
    maxContentLength: 50 * 1024 * 1024, // 50MB
    // Retry configuration
    retry: renderFixConfig.network.retryAttempts,
    retryDelay: renderFixConfig.network.retryDelay
  })
};

// Export configuration
module.exports = {
  config: renderFixConfig,
  helpers: renderFixHelpers
};

// Log configuration when loaded
console.log('🔧 Render Fix Configuration loaded:');
console.log(`   Network timeout: ${renderFixConfig.network.timeout}ms`);
console.log(`   Retry attempts: ${renderFixConfig.network.retryAttempts}`);
console.log(`   Rate limit delay: ${renderFixConfig.network.rateLimitDelay}ms`);
console.log(`   Max concurrent requests: ${renderFixConfig.network.maxConcurrentRequests}`); 