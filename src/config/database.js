const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database/alphachecker.db');

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error opening database:', err.message);
      } else {
        console.log('📊 Connected to SQLite database');
      }
    });
  }
  return db;
}

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    // Create tokens table
    const createTokensTable = `
      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        name TEXT,
        total_supply REAL,
        circulating_supply REAL,
        price_usdt REAL,
        price_btc REAL,
        market_cap REAL,
        fdv REAL,
        volume_24h REAL,
        price_change_24h REAL,
        price_change_percent_24h REAL,
        is_futures_listed BOOLEAN DEFAULT FALSE,
        futures_listing_date TEXT,
        futures_contract_type TEXT,
        futures_base_asset TEXT,
        futures_quote_asset TEXT,
        futures_price_precision INTEGER,
        futures_quantity_precision INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create price_history table
    const createPriceHistoryTable = `
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_symbol TEXT NOT NULL,
        price_usdt REAL NOT NULL,
        price_btc REAL,
        volume_24h REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (token_symbol) REFERENCES tokens (symbol)
      )
    `;

    // Create futures_data table
    const createFuturesDataTable = `
      CREATE TABLE IF NOT EXISTS futures_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_symbol TEXT NOT NULL,
        funding_rate REAL,
        open_interest REAL,
        open_interest_value REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (token_symbol) REFERENCES tokens (symbol)
      )
    `;

    // Create alpha_tokens table for tracking alpha tokens
    const createAlphaTokensTable = `
      CREATE TABLE IF NOT EXISTS alpha_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        alpha_id TEXT,
        name TEXT,
        chain_id TEXT,
        contract_address TEXT,
        decimals INTEGER,
        network TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        notes TEXT,
        is_futures_listed BOOLEAN,
        futures_check_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    database.serialize(() => {
      database.run(createTokensTable, (err) => {
        if (err) {
          console.error('❌ Error creating tokens table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Tokens table created/verified');
      });

      database.run(createPriceHistoryTable, (err) => {
        if (err) {
          console.error('❌ Error creating price_history table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Price history table created/verified');
      });

      database.run(createFuturesDataTable, (err) => {
        if (err) {
          console.error('❌ Error creating futures_data table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Futures data table created/verified');
      });

      database.run(createAlphaTokensTable, (err) => {
        if (err) {
          console.error('❌ Error creating alpha_tokens table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Alpha tokens table created/verified');
        
        // Insert some default alpha tokens - DISABLED to focus on Alpha tokens only
        // insertDefaultAlphaTokens(database);
      });

      database.run('PRAGMA foreign_keys = ON');
      
      resolve();
    });
  });
}

function insertDefaultAlphaTokens(database) {
  const defaultTokens = [
    { symbol: 'BTC', priority: 1, notes: 'Bitcoin - Primary alpha token' },
    { symbol: 'ETH', priority: 2, notes: 'Ethereum - Secondary alpha token' },
    { symbol: 'BNB', priority: 3, notes: 'Binance Coin - Exchange token' }
  ];

  defaultTokens.forEach(token => {
    database.run(
      'INSERT OR IGNORE INTO alpha_tokens (symbol, priority, notes) VALUES (?, ?, ?)',
      [token.symbol, token.priority, token.notes],
      (err) => {
        if (err) {
          console.error(`❌ Error inserting default token ${token.symbol}:`, err.message);
        }
      }
    );
  });
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('📊 Database connection closed');
      }
    });
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase
}; 