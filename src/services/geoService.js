const config = require('../config');

// Helper to check if IP is private/local
function isPrivateIp(ip) {
  if (!ip || ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
}

class GeoService {
  async fetchWithTimeout(url, timeoutMs = config.GEO_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // Provider A: ip-api.com
  async lookupProviderA(ip) {
    const data = await this.fetchWithTimeout(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    if (data && data.status === 'success') {
      return {
        country: data.country || null,
        city: data.city || null,
        provider: 'ip-api.com'
      };
    }
    throw new Error('Provider A returned failure status');
  }

  // Provider B (Fallback): ipapi.co
  async lookupProviderB(ip) {
    const data = await this.fetchWithTimeout(`https://ipapi.co/${ip}/json/`);
    if (data && !data.error) {
      return {
        country: data.country_name || null,
        city: data.city || null,
        provider: 'ipapi.co'
      };
    }
    throw new Error('Provider B returned error');
  }

  // Primary method with deterministic fallback chain & graceful degradation
  async enrichIp(ip, testMockMode = null) {
    const mockMode = testMockMode || config.GEO_MOCK_MODE;

    // Handle test / mock modes
    if (mockMode === 'mock_success') {
      return { country: 'United States', city: 'San Francisco', provider: 'mock' };
    }
    if (mockMode === 'fail_both') {
      console.warn(`[GeoService] Geo mock mode: 'fail_both'. Gracefully returning null location.`);
      return { country: null, city: null, provider: 'none' };
    }

    if (isPrivateIp(ip)) {
      return { country: 'Localhost', city: 'Local Network', provider: 'local' };
    }

    // Try Provider A
    if (mockMode !== 'fail_a') {
      try {
        const result = await this.lookupProviderA(ip);
        return result;
      } catch (errA) {
        console.warn(`[GeoService] Provider A (ip-api.com) failed: ${errA.message}. Falling back to Provider B...`);
      }
    } else {
      console.warn(`[GeoService] Simulated Provider A failure. Falling back to Provider B...`);
    }

    // Fallback to Provider B
    try {
      const result = await this.lookupProviderB(ip);
      return result;
    } catch (errB) {
      console.warn(`[GeoService] Provider B (ipapi.co) failed: ${errB.message}. Gracefully continuing without geo data.`);
    }

    // Graceful degradation: both failed
    return { country: null, city: null, provider: 'none' };
  }
}

module.exports = new GeoService();
