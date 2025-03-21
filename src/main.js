import { Game } from './Game.js';

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
  game.start();
}); 