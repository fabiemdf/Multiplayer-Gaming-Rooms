'use strict';
/**
 * Server-side Game Registry
 *
 * Auto-loads every *.js file in this directory (except index.js).
 * Each module must export an object with at least:
 *   { id, label, icon, maxPlayers, minPlayers, init(), processAction() }
 *
 * To add a new game: drop a new file here. No other files need changing.
 */

const fs   = require('fs');
const path = require('path');

const registry = {};

fs.readdirSync(__dirname)
  .filter(f => f !== 'index.js' && f.endsWith('.js'))
  .sort()
  .forEach(f => {
    try {
      const game = require(path.join(__dirname, f));
      if (!game.id) throw new Error('missing required field: id');
      registry[game.id] = game;
      console.log(`  ✔ game loaded: ${game.id} (${game.label})`);
    } catch (err) {
      console.error(`  ✖ failed to load game "${f}":`, err.message);
    }
  });

module.exports = registry;
