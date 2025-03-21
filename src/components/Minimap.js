import * as THREE from 'three';

export class Minimap {
  constructor(context, options = {}) {
    this.context = context;
    this.player = context.player;
    this.world = context.world;
    
    // Minimap options
    this.size = options.size || 200;
    this.position = options.position || { x: 20, y: 20 };
    this.viewRadius = options.viewRadius || 50;
    this.bgColor = options.bgColor || 'rgba(0, 0, 0, 0.5)';
    this.playerColor = options.playerColor || '#ff0000';
    this.treeColor = options.treeColor || '#00aa00';
    this.rockColor = options.rockColor || '#aaaaaa';
    this.borderColor = options.borderColor || '#ffffff';
    this.enemyColor = options.enemyColor || '#ff3333';
    this.allyColor = options.allyColor || '#33ff33';
    this.objectiveColor = options.objectiveColor || '#ffaa33';
    
    // Create minimap canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = `${this.position.y}px`;
    this.canvas.style.left = `${this.position.x}px`;
    this.canvas.style.borderRadius = '50%';
    this.canvas.style.border = `2px solid ${this.borderColor}`;
    this.canvas.style.zIndex = '100';
    this.canvas.style.pointerEvents = 'none';
    
    // Get drawing context
    this.ctx = this.canvas.getContext('2d');
    
    // Add to DOM
    document.body.appendChild(this.canvas);
    
    // Add minimap legend
    this.createLegend();
    
    // Set up event listeners for enemies
    this.context.events.on('enemySpawned', () => {
      // Don't need to do anything here, just ensuring the update method will have access to all enemies
    });
  }
  
  createLegend() {
    // Create legend container
    const legend = document.createElement('div');
    legend.style.position = 'absolute';
    legend.style.top = `${this.position.y + this.size + 10}px`;
    legend.style.left = `${this.position.x}px`;
    legend.style.backgroundColor = this.bgColor;
    legend.style.padding = '5px';
    legend.style.borderRadius = '5px';
    legend.style.color = 'white';
    legend.style.fontFamily = 'Arial, sans-serif';
    legend.style.fontSize = '12px';
    legend.style.zIndex = '100';
    legend.style.pointerEvents = 'none';
    
    // Create legend content
    legend.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 3px;">
        <div style="width: 10px; height: 10px; background-color: ${this.playerColor}; margin-right: 5px;"></div>
        <span>Player</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 3px;">
        <div style="width: 10px; height: 10px; background-color: ${this.enemyColor}; margin-right: 5px;"></div>
        <span>Enemy</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 3px;">
        <div style="width: 10px; height: 10px; background-color: ${this.allyColor}; margin-right: 5px;"></div>
        <span>Ally</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 3px;">
        <div style="width: 10px; height: 10px; background-color: ${this.treeColor}; margin-right: 5px;"></div>
        <span>Tree</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 3px;">
        <div style="width: 10px; height: 10px; background-color: ${this.rockColor}; margin-right: 5px;"></div>
        <span>Rock</span>
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 3px;">
        <div style="width: 10px; height: 10px; background-color: ${this.objectiveColor}; margin-right: 5px;"></div>
        <span>Objective</span>
      </div>
      <div style="display: flex; align-items: center;">
        <div style="width: 10px; height: 10px; background-color: #aa0000; margin-right: 5px; border: 1px solid black;"></div>
        <span>Enemy Tower</span>
      </div>
    `;
    
    // Add to DOM
    document.body.appendChild(legend);
    this.legend = legend;
  }
  
  update() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.size, this.size);
    
    // Draw background
    this.ctx.fillStyle = this.bgColor;
    this.ctx.beginPath();
    this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Get player position
    const playerPos = this.player.getPosition();
    
    // Get all objects near the player
    const nearbyObjects = this.world.getObjectsNear(playerPos, this.viewRadius);
    
    // Draw objects
    for (const obj of nearbyObjects) {
      const objPos = obj.getPosition();
      
      // Calculate relative position to player
      const relX = objPos.x - playerPos.x;
      const relZ = objPos.z - playerPos.z;
      
      // Skip if outside view radius
      const distance = Math.sqrt(relX * relX + relZ * relZ);
      if (distance > this.viewRadius) continue;
      
      // Convert to minimap coordinates
      const mapX = this.size / 2 + (relX / this.viewRadius) * (this.size / 2);
      const mapY = this.size / 2 + (relZ / this.viewRadius) * (this.size / 2);
      
      // Determine object type and color
      let color;
      let size;
      
      if (obj.constructor.name === 'Tree') {
        color = this.treeColor;
        size = 4;
      } else if (obj.constructor.name === 'Rock') {
        color = this.rockColor;
        size = 3;
      } else {
        // Unknown object type
        color = '#ffffff';
        size = 2;
      }
      
      // Draw object dot
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(mapX, mapY, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // ---- ENEMY TRACKING - THREE METHODS ----
    // 1. Try context.getEnemies()
    // 2. Try context.systems.enemy.enemies
    // 3. Try scanning the scene for entities with userData.isEnemy
    
    let enemies = [];
    let enemySource = "none";
    
    // Method 1: Get enemies from the context directly
    if (this.context.getEnemies && Array.isArray(this.context.getEnemies())) {
      enemies = this.context.getEnemies();
      if (enemies.length > 0) {
        enemySource = "context.getEnemies()";
      }
    }
    
    // Method 2: Get enemies from the enemy system if method 1 got no results
    if (enemies.length === 0 && this.context.systems && this.context.systems.enemy && Array.isArray(this.context.systems.enemy.enemies)) {
      enemies = this.context.systems.enemy.enemies;
      if (enemies.length > 0) {
        enemySource = "context.systems.enemy.enemies";
      }
    }
    
    // Method 3: Scan scene for entities with userData.isEnemy if the above failed
    if (enemies.length === 0 && this.context.scene) {
      const foundEnemies = [];
      this.context.scene.traverse(object => {
        if (object.userData && object.userData.isEnemy) {
          const enemy = object.userData.enemyRef;
          if (enemy) {
            foundEnemies.push(enemy);
          }
        }
      });
      
      if (foundEnemies.length > 0) {
        enemies = foundEnemies;
        enemySource = "scene.traverse";
      }
    }
    
    // Draw enemy units if we found any
    if (enemies.length > 0) {
      console.log(`Drawing ${enemies.length} enemies on minimap (source: ${enemySource})`);
      
      for (const enemy of enemies) {
        if (!enemy) continue;
        
        // Skip dead enemies
        if (enemy.isAlive === false) continue;
        
        // Get enemy position safely
        let objPos = null;
        
        // Try different ways to get position
        if (typeof enemy.getPosition === 'function') {
          objPos = enemy.getPosition();
        } else if (enemy.position instanceof THREE.Vector3) {
          objPos = enemy.position.clone();
        } else if (enemy.mesh && enemy.mesh.position instanceof THREE.Vector3) {
          objPos = enemy.mesh.position.clone();
        }
        
        if (!objPos) {
          console.warn("Enemy missing position:", enemy);
          continue;
        }
        
        // Calculate relative position to player
        const relX = objPos.x - playerPos.x;
        const relZ = objPos.z - playerPos.z;
        
        // Skip if outside view radius
        const distance = Math.sqrt(relX * relX + relZ * relZ);
        if (distance > this.viewRadius * 1.5) continue; // Show enemies even slightly outside normal view
        
        // Convert to minimap coordinates
        const mapX = this.size / 2 + (relX / this.viewRadius) * (this.size / 2);
        const mapY = this.size / 2 + (relZ / this.viewRadius) * (this.size / 2);
        
        // Draw enemy dot with pulsing effect
        const pulseSize = 4 + Math.sin(Date.now() / 300) * 1;
        
        // Draw enemy dot (red with black border)
        this.ctx.fillStyle = this.enemyColor;
        this.ctx.beginPath();
        this.ctx.arc(mapX, mapY, pulseSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(mapX, mapY, pulseSize, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    } else {
      console.log("No enemies found to draw on minimap after all methods");
    }
    
    // Draw ally units
    const units = this.context.getUnits && typeof this.context.getUnits === 'function' 
      ? this.context.getUnits() 
      : (this.context.systems && this.context.systems.unit ? this.context.systems.unit.units : []);
      
    if (units && units.length > 0) {
      for (const unit of units) {
        if (!unit || typeof unit.getPosition !== 'function') continue;
        
        const objPos = unit.getPosition();
        
        // Calculate relative position to player
        const relX = objPos.x - playerPos.x;
        const relZ = objPos.z - playerPos.z;
        
        // Skip if outside view radius
        const distance = Math.sqrt(relX * relX + relZ * relZ);
        if (distance > this.viewRadius) continue;
        
        // Convert to minimap coordinates
        const mapX = this.size / 2 + (relX / this.viewRadius) * (this.size / 2);
        const mapY = this.size / 2 + (relZ / this.viewRadius) * (this.size / 2);
        
        // Draw ally dot
        this.ctx.fillStyle = this.allyColor;
        this.ctx.beginPath();
        this.ctx.arc(mapX, mapY, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // Draw player (always in center)
    this.ctx.fillStyle = this.playerColor;
    this.ctx.beginPath();
    this.ctx.arc(this.size / 2, this.size / 2, 5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw player direction indicator
    const forwardVec = this.player.getForwardVector();
    const dirX = this.size / 2 + forwardVec.x * 10;
    const dirY = this.size / 2 + forwardVec.z * 10;
    
    this.ctx.strokeStyle = this.playerColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.size / 2, this.size / 2);
    this.ctx.lineTo(dirX, dirY);
    this.ctx.stroke();
    
    // Draw objective marker (if exists)
    if (this.context.objective) {
      const objPos = this.context.objective.position;
      
      // Calculate relative position to player
      const relX = objPos.x - playerPos.x;
      const relZ = objPos.z - playerPos.z;
      
      // Check if in view radius
      const distance = Math.sqrt(relX * relX + relZ * relZ);
      if (distance <= this.viewRadius * 1.5) { // Show objective even if a bit outside normal view
        // Convert to minimap coordinates
        const mapX = this.size / 2 + (relX / this.viewRadius) * (this.size / 2);
        const mapY = this.size / 2 + (relZ / this.viewRadius) * (this.size / 2);
        
        // Draw objective marker
        this.ctx.fillStyle = this.objectiveColor;
        this.ctx.beginPath();
        this.ctx.arc(mapX, mapY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Add a pulsing effect
        this.ctx.strokeStyle = this.objectiveColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(mapX, mapY, 6 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
    
    // Draw enemy tower (if exists in enemy system)
    if (this.context.systems && this.context.systems.enemy && this.context.systems.enemy.towerPosition) {
      const towerPos = this.context.systems.enemy.towerPosition;
      
      // Calculate relative position to player
      const relX = towerPos.x - playerPos.x;
      const relZ = towerPos.z - playerPos.z;
      
      // Check if in view radius (always draw tower with 3x normal radius to ensure visibility)
      const distance = Math.sqrt(relX * relX + relZ * relZ);
      // Extended view radius for the tower - always make it visible
      if (distance <= this.viewRadius * 3) {
        // Convert to minimap coordinates
        const mapX = this.size / 2 + (relX / this.viewRadius) * (this.size / 2);
        const mapY = this.size / 2 + (relZ / this.viewRadius) * (this.size / 2);
        
        // Draw tower marker (distinctive red square with black outline)
        const markerSize = 7;
        
        // Draw filled square
        this.ctx.fillStyle = '#aa0000'; // Dark red
        this.ctx.fillRect(mapX - markerSize/2, mapY - markerSize/2, markerSize, markerSize);
        
        // Draw border
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(mapX - markerSize/2, mapY - markerSize/2, markerSize, markerSize);
        
        // Add pulsing effect
        const pulseSize = markerSize + Math.sin(Date.now() / 300) * 2;
        this.ctx.strokeStyle = '#ff0000'; // Bright red
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(mapX - pulseSize/2, mapY - pulseSize/2, pulseSize, pulseSize);
        
        // Add "TOWER" label below
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TOWER', mapX, mapY + markerSize + 8);
      }
    }
    
    // Draw cardinal directions
    this.drawCardinalDirections();
  }
  
  drawCardinalDirections() {
    const radius = this.size / 2 - 10;
    const center = this.size / 2;
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // North
    this.ctx.fillText('N', center, center - radius);
    
    // East
    this.ctx.fillText('E', center + radius, center);
    
    // South
    this.ctx.fillText('S', center, center + radius);
    
    // West
    this.ctx.fillText('W', center - radius, center);
  }
  
  resize(size) {
    this.size = size;
    this.canvas.width = size;
    this.canvas.height = size;
    
    // Update legend position
    this.legend.style.top = `${this.position.y + this.size + 10}px`;
  }
  
  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.left = `${x}px`;
    
    // Update legend position
    this.legend.style.top = `${y + this.size + 10}px`;
    this.legend.style.left = `${x}px`;
  }
} 