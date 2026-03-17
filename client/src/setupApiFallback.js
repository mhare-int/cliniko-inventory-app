// Lightweight dev fallback for window.api when not running under Electron.
// It proxies to a REST API if window.API_BASE_URL is set, otherwise returns a rejected promise
// with an explanatory message. This keeps the dev server from crashing when Electron preload is absent.

function makeProxy(method, path, opts = {}) {
  return async function(...args) {
    const base = window.API_BASE_URL || '';
    // If no base URL and we're in development, allow methods to be proxied to a dev mock where sensible
    const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') || window.location.hostname === 'localhost';
    if (!base && !isDev) {
      return Promise.reject(new Error(`window.api.${method} is not available in this environment. Run under Electron or set window.API_BASE_URL to a backend URL.`));
    }
    try {
      if (!base) {
        // Dev mock route: reject unless specific methods are handled elsewhere
        return Promise.reject(new Error(`No API base configured for proxy call to ${path}`));
      }
      const url = `${base.replace(/\/$/, '')}/api/${path}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`API proxy failed: ${resp.status} ${txt}`);
      }
      return await resp.json();
    } catch (e) {
      return Promise.reject(e);
    }
  };
}

export default function setupApiFallback() {
  if (typeof window === 'undefined') return;
  if (window.api) return; // Electron already installed it

  const informative = (name) => () => Promise.reject(new Error(`${name} not available: run under Electron or set window.API_BASE_URL`));

  window.api = {
  login: makeProxy('login', 'login'),
  getCurrentUser: makeProxy('getCurrentUser', 'getCurrentUser'),
    getAllProducts: makeProxy('getAllProducts', 'getAllProducts'),
    getSuppliersWithLeadTime: makeProxy('getSuppliersWithLeadTime', 'getSuppliersWithLeadTime'),
    getReorderSuggestion: makeProxy('getReorderSuggestion', 'getReorderSuggestion'),
    getVendorConsolidation: makeProxy('getVendorConsolidation', 'getVendorConsolidation'),
    getAllSuppliers: makeProxy('getAllSuppliers', 'getAllSuppliers'),
    // Generic fallback for other calls used by the app — they will reject with a helpful message
    // Components can still detect and show informative UI.
    // Provide a safe default for missing functions so code doesn't error immediately.
    isFirstTimeSetup: informative('isFirstTimeSetup'),
    createFirstAdminUser: informative('createFirstAdminUser'),
    getProductOptions: informative('getProductOptions'),
    getProductSales: informative('getProductSales'),
    getSalesInsights: informative('getSalesInsights'),
    getSalesInsightsWithCustomRanges: informative('getSalesInsightsWithCustomRanges'),
    getAllUsers: informative('getAllUsers'),
    // add more no-op informative stubs as needed
  };

  // Install small, safe dev-mode mocks for login/getCurrentUser when running the React dev server
  try {
    const base = window.API_BASE_URL || '';
    const isDevEnv = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') || window.location.hostname === 'localhost';
    if (isDevEnv && (!base || base === '')) {
      if (!window.api._devMocksInstalled) {
        window.api._devMocksInstalled = true;
        window.api.login = async (username, password) => {
          console.warn('[setupApiFallback] Using dev-mode mock login for', username);
          return { token: 'dev-token', user: { id: 1, username: username || 'dev', is_admin: true } };
        };
        window.api.getCurrentUser = async (token) => {
          if (!token || token === 'dev-token') return { id: 1, username: 'dev', is_admin: true };
          return { id: 1, username: 'dev', is_admin: true };
        };
      }
    }
  } catch (e) {
    // swallow
  }
}
