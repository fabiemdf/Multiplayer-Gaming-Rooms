'use strict';

const registry = require('../games');

describe('game registry', () => {
  test('exports an object', () => {
    expect(typeof registry).toBe('object');
    expect(registry).not.toBeNull();
  });

  test('loads all 8 expected games', () => {
    const ids = Object.keys(registry).sort();
    expect(ids).toEqual([
      'checkers',
      'chess',
      'connect4',
      'gomoku',
      'password',
      'reversi',
      'tictactoe',
      'wheeloffortune',
    ]);
  });

  test('every game has required fields', () => {
    for (const [id, g] of Object.entries(registry)) {
      expect(typeof g.id).toBe('string');
      expect(typeof g.label).toBe('string');
      expect(typeof g.icon).toBe('string');
      expect(typeof g.maxPlayers).toBe('number');
      expect(typeof g.minPlayers).toBe('number');
      expect(typeof g.init).toBe('function');
      expect(typeof g.processAction).toBe('function');
    }
  });

  test('every game id matches its registry key', () => {
    for (const [key, g] of Object.entries(registry)) {
      expect(g.id).toBe(key);
    }
  });

  test('every game init() returns an object', () => {
    for (const g of Object.values(registry)) {
      const state = g.init();
      expect(typeof state).toBe('object');
      expect(state).not.toBeNull();
    }
  });

  test('minPlayers <= maxPlayers for every game', () => {
    for (const g of Object.values(registry)) {
      expect(g.minPlayers).toBeLessThanOrEqual(g.maxPlayers);
    }
  });
});
