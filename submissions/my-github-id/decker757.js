/**
 * Modern Banking Client - Julius Baer Side Quest
 * Modernized from legacy ES5 code to ES6+ with best practices
 */

import axios from 'axios';

// Configuration Management
const config = {
  baseUrl: process.env.BANKING_API_URL || 'http://localhost:8123',
  timeout: 5000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * Modern Banking Client Class
 * Implements clean architecture and SOLID principles
 */
class BankingClient {
  constructor(baseUrl = config.baseUrl) {
    this.baseUrl = baseUrl;
    this.authToken = null;

    // Modern axios instance with configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout,
      headers: { 'Content-Type': 'application/json' }
    });

    // Request interceptor for JWT authentication
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      }
    );
  }

  /**
   * Input Validation - Account ID
   */
  validateAccountId(accountId) {
    if (!accountId || typeof accountId !== 'string') {
      throw new Error('Account ID must be a non-empty string');
    }

    const accountPattern = /^ACC\d{4}$/;
    if (!accountPattern.test(accountId)) {
      throw new Error(`Invalid account ID format: ${accountId}. Expected: ACC#### (e.g., ACC1000)`);
    }

    return true;
  }

  /**
   * Input Validation - Amount
   */
  validateAmount(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Amount must be a valid number');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum transfer limit');
    }

    return Math.round(amount * 100) / 100;
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryWithBackoff(fn, retries = config.retryAttempts) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;

        const delay = config.retryDelay * Math.pow(2, i);
        console.log(`⚠️  Retry attempt ${i + 1}/${retries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Authenticate and get JWT token
   */
  async authenticate(username, password) {
    try {
      console.log(`🔐 Authenticating user: ${username}...`);

      const response = await this.client.post('/authToken', {
        username,
        password
      });

      this.authToken = response.data.token;
      console.log('✅ Authentication successful');

      return this.authToken;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`❌ Authentication failed: ${errorMsg}`);
      throw new Error(`Authentication failed: ${errorMsg}`);
    }
  }

  /**
   * Validate account exists
   */
  async validateAccount(accountId) {
    try {
      this.validateAccountId(accountId);

      const response = await this.client.get(`/accounts/validate/${accountId}`);
      return response.data.valid === true;
    } catch (error) {
      console.error(`❌ Account validation failed for ${accountId}:`, error.message);
      return false;
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId) {
    try {
      this.validateAccountId(accountId);

      const response = await this.client.get(`/accounts/balance/${accountId}`);
      return response.data.balance;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`❌ Failed to fetch balance for ${accountId}:`, errorMsg);
      throw error;
    }
  }

  /**
   * Transfer money - FIXED: changed 'money' to 'amount'
   */
  async transferMoney(fromAccount, toAccount, amount) {
    try {
      // Input validation and sanitization
      this.validateAccountId(fromAccount);
      this.validateAccountId(toAccount);
      const validatedAmount = this.validateAmount(amount);

      // Prevent self-transfer
      if (fromAccount === toAccount) {
        throw new Error('Cannot transfer to the same account');
      }

      console.log(`💸 Initiating transfer: ${fromAccount} → ${toAccount} ($${validatedAmount})`);

      // Pre-validate accounts (optional but recommended)
      const [fromValid, toValid] = await Promise.all([
        this.validateAccount(fromAccount),
        this.validateAccount(toAccount)
      ]);

      if (!fromValid) {
        throw new Error(`Source account ${fromAccount} is invalid`);
      }

      if (!toValid) {
        throw new Error(`Destination account ${toAccount} is invalid`);
      }

      // Perform transfer with retry logic
      const response = await this.retryWithBackoff(async () => {
        return await this.client.post('/transfer', {
          fromAccount,
          toAccount,
          amount: validatedAmount
        });
      });

      console.log('✅ Transfer successful!');
      console.log(`   Transaction ID: ${response.data.transactionId}`);
      console.log(`   Status: ${response.data.status}`);

      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`❌ Transfer failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(accountId = null) {
    try {
      const url = accountId ? `/transactions/history?accountId=${accountId}` : '/transactions/history';
      const response = await this.client.get(url);

      return response.data.transactions || [];
    } catch (error) {
      console.error('❌ Failed to fetch transaction history:', error.message);
      throw error;
    }
  }

  /**
   * List all accounts
   */
  async listAccounts() {
    try {
      const response = await this.client.get('/accounts');
      return response.data.accounts || [];
    } catch (error) {
      console.error('❌ Failed to fetch accounts:', error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const client = new BankingClient();

  try {
    console.log('\n=== Modern Banking Client Demo ===\n');

    // Example 1: Basic transfer (no auth)
    console.log('📋 Test 1: Basic Transfer');
    const result = await client.transferMoney('ACC1000', 'ACC1001', 100.00);
    console.log('');

    // Example 2: With authentication
    console.log('📋 Test 2: Authenticated Transfer');
    await client.authenticate('user', 'password');
    const authResult = await client.transferMoney('ACC1000', 'ACC1002', 50.00);
    console.log('');

    // Example 3: List accounts
    console.log('📋 Test 3: List All Accounts');
    const accounts = await client.listAccounts();
    console.log(`✅ Found ${accounts.length} accounts\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Export for module usage
export default BankingClient;

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
