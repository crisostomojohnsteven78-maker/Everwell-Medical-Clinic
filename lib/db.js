// lib/db.js
// Shared database connection, used by every API endpoint.
//
// Switched from `pg` to `@neondatabase/serverless`. The old `pg`
// driver holds a raw, long-lived TCP connection open, which is
// exactly the kind of connection a mobile hotspot silently kills
// mid-request (that's what caused the "Connection terminated
// unexpectedly" errors). This driver instead talks to Neon over
// HTTP/WebSocket, so it survives a flaky connection much better.

const { Pool, neonConfig } = require('@neondatabase/serverless');

// Node's built-in WebSocket support only arrived in Node 22. To work
// on earlier Node versions (and reliably under `vercel dev` locally),
// point the driver at the `ws` package instead. If you're on Node 22+
// this isn't even needed, but it's safe either way.
try {
  neonConfig.webSocketConstructor = require('ws');
} catch (e) {
  // No `ws` package found — fine if you're on Node 22+, which has
  // native WebSocket support built in.
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Without this, an unexpected connection error can crash the whole
// process instead of just failing the one request that hit it.
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

module.exports = pool;