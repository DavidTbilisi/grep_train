/**
 * JavaScript example file for grep practice
 */

const fs = require("fs");
const path = require("path");

// Configuration constants
const CONFIG = {
  API_URL: "https://api.example.com",
  TIMEOUT: 5000,
  MAX_RETRIES: 3,
  DEBUG: true,
};

class ApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || CONFIG.TIMEOUT;
    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": "MyApp/1.0.0",
    };
  }

  async get(endpoint) {
    try {
      console.log(`INFO: Making GET request to ${endpoint}`);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "GET",
        headers: this.headers,
        timeout: this.timeout,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`ERROR: Failed to fetch ${endpoint}:`, error.message);
      throw error;
    }
  }

  async post(endpoint, data) {
    try {
      console.log(`INFO: Making POST request to ${endpoint}`);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(data),
        timeout: this.timeout,
      });

      if (!response.ok) {
        console.warn(`WARNING: POST request returned ${response.status}`);
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`ERROR: Failed to post to ${endpoint}:`, error.message);
      throw error;
    }
  }
}

// Utility functions
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Main execution
async function main() {
  const client = new ApiClient(CONFIG.API_URL);

  try {
    const users = await client.get("/users");
    console.log(`INFO: Retrieved ${users.length} users`);

    // TODO: Implement user caching
    // FIXME: Add proper error boundaries

    for (const user of users) {
      if (!validateEmail(user.email)) {
        console.warn(
          `WARNING: Invalid email for user ${user.id}: ${user.email}`
        );
      }
    }
  } catch (error) {
    console.error("ERROR: Application failed:", error.message);
    process.exit(1);
  }
}

module.exports = { ApiClient, validateEmail, formatDate };

if (require.main === module) {
  main();
}
