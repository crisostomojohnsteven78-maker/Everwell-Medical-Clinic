// server.js
// Render needs a persistent Express server (not standalone serverless
// functions like Vercel uses). This file auto-discovers every handler
// in /api and mounts it as a route, WITHOUT modifying any of the
// existing handler files.
//
// - Flat files, e.g. api/appointments.js -> GET/POST/etc /api/appointments
// - Dynamic subfolders, e.g. api/appointments/[id].js -> /api/appointments/:id
//   (Express gives us req.params.id; we copy it into req.query.id so the
//   existing handlers, written for Vercel's req.query.id, keep working
//   unchanged.)

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic CORS so your frontend (served separately, or from another origin)
// can call this API. Adjust the origin below once you know your deployed
// frontend URL, or leave as-is to allow all origins.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Block direct access to backend source/config files before static
// serving kicks in — we don't want visitors reading server.js,
// package.json, or peeking into lib/ or api/ as raw files.
const blockedPaths = ['/server.js', '/package.json', '/package-lock.json'];
app.use((req, res, next) => {
  if (
    blockedPaths.includes(req.path) ||
    req.path.startsWith('/lib/') ||
    req.path.startsWith('/node_modules/')
  ) {
    return res.status(404).send('Not found');
  }
  next();
});

const apiDir = path.join(__dirname, 'api');

if (fs.existsSync(apiDir)) {
  fs.readdirSync(apiDir).forEach((entry) => {
    const fullPath = path.join(apiDir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && entry.endsWith('.js')) {
      // api/appointments.js -> /api/appointments
      const routeName = '/api/' + entry.replace(/\.js$/, '');
      const handler = require(fullPath);
      app.all(routeName, handler);
      console.log(`Mounted ${routeName}`);
    } else if (stat.isDirectory()) {
      // api/appointments/[id].js -> /api/appointments/:id
      const dynFile = fs.readdirSync(fullPath).find(
        (f) => f.startsWith('[') && f.endsWith('].js')
      );
      if (dynFile) {
        const routeName = `/api/${entry}/:id`;
        const handler = require(path.join(fullPath, dynFile));
        app.all(routeName, (req, res) => {
          req.query.id = req.params.id; // shim: Vercel-style handlers read req.query.id
          return handler(req, res);
        });
        console.log(`Mounted ${routeName}`);
      }
    }
  });
}

// Serve your HTML/CSS/JS frontend files (homepage.html, login.html, etc.)
// This also automatically serves index.html at the root URL "/".
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
