import { EventBus } from './EventBus.js';

/**
 * GameContext serves as a central repository for game state and references.
 * It replaces the global window.game with a more structured approach.
 */
export class GameContext {
  constructor() {
    // Core components
    this.scene = null;
    this.player = null;
    this.world = null;
    this.camera = null;
    this.objective = null;
    this.renderer = null;
    this.clock = null;
    this.minimap = null;
    
    // Systems
    this.systems = {
      enemy: null,
      unit: null,
      inventory: null,
      input: null
    };
    
    // Events system for pub/sub pattern
    this.events = new EventBus();
    
    // Collections
    this.enemies = null;
    this.units = null;
    
    // For debugging - minimal global footprint
    if (typeof window !== 'undefined') {
      window.gameContext = this;
    }
  }
  
  /**
   * Register a system with the context
   * @param {string} name - System name
   * @param {object} system - System instance
   * @returns {object} The registered system
   */
  registerSystem(name, system) {
    this.systems[name] = system;
    console.log(`Registered system: ${name}`);
    return system;
  }
  
  /**
   * Get a system by name
   * @param {string} name - System name
   * @returns {object} The requested system
   */
  getSystem(name) {
    return this.systems[name];
  }
  
  /**
   * Register enemies collection
   * @param {Array} enemiesCollection - Collection of enemies
   */
  registerEnemies(enemiesCollection) {
    this.enemies = enemiesCollection;
    console.log('Registered enemies collection');
  }
  
  /**
   * Register a single enemy
   * @param {object} enemy - The enemy instance to register
   */
  registerEnemy(enemy) {
    // Initialize enemies array if needed
    if (!this.enemies) {
      this.enemies = [];
    }
    
    // Add enemy to collection
    if (this.enemies.indexOf(enemy) === -1) {
      this.enemies.push(enemy);
      console.log('Enemy registered with context');
      
      // Emit event
      this.events.emit('enemySpawned', enemy);
    }
  }
  
  /**
   * Get all enemies in the game
   * @returns {Array} List of enemies
   */
  getEnemies() {
    return this.enemies || [];
  }
  
  /**
   * Register units collection
   * @param {Array} unitsCollection - Collection of units
   */
  registerUnits(unitsCollection) {
    this.units = unitsCollection;
    console.log('Registered units collection');
  }
  
  /**
   * Get all units (allies) in the game
   * @returns {Array} List of units
   */
  getUnits() {
    return this.units || [];
  }
  
  /**
   * Handle when an enemy is spawned
   * @param {object} enemy - The spawned enemy
   */
  onEnemySpawned(enemy) {
    this.events.emit('enemySpawned', enemy);
  }
  
  /**
   * Handle when an enemy is removed
   * @param {object} enemy - The removed enemy
   */
  onEnemyRemoved(enemy) {
    this.events.emit('enemyRemoved', enemy);
  }
} 