import * as THREE from 'three';
import { EnemyUnit } from '../components/units/EnemyUnit.js';

export class EnemySystem {
  constructor(context, scene, player, world, inventorySystem) {
    this.context = context;
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.inventorySystem = inventorySystem;
    
    // Container for enemy instances
    this.enemies = [];
    
    // Register this collection with the context
    this.context.registerEnemies(this.enemies);
    
    // Wave management
    this.waveNumber = 0;
    this.enemiesRemaining = 0;
    this.waveInProgress = false;
    this.timeUntilNextWave = 5; // seconds until first wave - reduced for faster testing
    
    // Tower position (to be set in createTower)
    this.towerPosition = null;
    this.spawnRadius = 5; // spawn enemies within this radius of tower
    
    // Enemy types with attributes
    this.enemyTypes = {
      goblin: {
        name: 'Goblin',
        attributes: {
          health: 50,
          damage: 5,
          speed: 4, // Reduced speed (was 8)
          vision: 100, // Greatly increased vision range to ensure player is always visible
          color: 0x00FF00
        }
      },
      orc: {
        name: 'Orc',
        attributes: {
          health: 100,
          damage: 10,
          speed: 3, // Reduced speed (was 6)
          vision: 100, // Increased vision
          color: 0x669900
        }
      },
      troll: {
        name: 'Troll',
        attributes: {
          health: 200,
          damage: 15,
          speed: 2, // Reduced speed (was 4)
          vision: 100, // Increased vision
          color: 0x006600
        }
      },
      demon: {
        name: 'Demon',
        attributes: {
          health: 150,
          damage: 20,
          speed: 4, // Reduced speed (was 8)
          vision: 100, // Increased vision
          color: 0xFF0000
        }
      },
      warlock: {
        name: 'Warlock',
        attributes: {
          health: 80,
          damage: 25,
          speed: 2.5, // Reduced speed (was 5)
          vision: 100, // Increased vision
          color: 0x9900FF
        }
      }
    };
    
    // Variation types for enemies (used for creating larger/special units)
    this.enemyVariations = {
      normal: {
        scale: 1.0,
        healthMod: 1.0,
        damageMod: 1.0,
        speedMod: 1.0
      },
      large: {
        scale: 1.5,
        healthMod: 2.0,
        damageMod: 1.5,
        speedMod: 0.8 // Slower but stronger
      },
      huge: {
        scale: 2.0,
        healthMod: 3.0,
        damageMod: 2.0,
        speedMod: 0.7 // Even slower but very strong
      },
      quick: {
        scale: 0.8,
        healthMod: 0.7,
        damageMod: 0.8, 
        speedMod: 1.3 // Faster but weaker
      }
    };
    
    // Set objective as the target
    this.objective = this.context.objective || this.player;
    console.log("Setting objective as target:", this.objective);
    
    // Initialize global references for enemies for backward compatibility
    window.enemies = this.enemies;
    
    // Create UI for wave status
    this.createWaveStatusUI();
    
    // Create tower where enemies will spawn from
    this.createTower();
    
    // Subscribe to events
    this.context.events.on('objectiveCreated', (objective) => {
      this.objective = objective;
      console.log("Updated objective target:", this.objective);
    });
    
    console.log("Enemy system initialized with objective:", this.objective);
  }
  
  createTower() {
    // Choose a position not too close to the player
    let position;
    do {
      position = new THREE.Vector3(
        (Math.random() - 0.5) * 80, // X between -40 and 40
        0,
        (Math.random() - 0.5) * 80  // Z between -40 and 40
      );
    } while (position.distanceTo(this.player.getPosition()) < 40); // At least 40 units away
    
    // Adjust Y position to terrain height
    position.y = this.world.getHeightAt(position.x, position.z);
    this.towerPosition = position.clone();
    
    // Create tower geometry
    const baseGeometry = new THREE.CylinderGeometry(3, 4, 2, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x555555, 
      roughness: 0.8,
      metalness: 0.2
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.copy(position);
    base.position.y += 1;
    base.castShadow = true;
    base.receiveShadow = true;
    
    // Create tower middle section
    const middleGeometry = new THREE.CylinderGeometry(2, 3, 6, 8);
    const middleMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x666666, 
      roughness: 0.7,
      metalness: 0.3
    });
    const middle = new THREE.Mesh(middleGeometry, middleMaterial);
    middle.position.copy(position);
    middle.position.y += 5;
    middle.castShadow = true;
    middle.receiveShadow = true;
    
    // Create tower top
    const topGeometry = new THREE.CylinderGeometry(1.5, 2, 3, 8);
    const topMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x777777, 
      roughness: 0.6,
      metalness: 0.4
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.copy(position);
    top.position.y += 9.5;
    top.castShadow = true;
    top.receiveShadow = true;
    
    // Create spire
    const spireGeometry = new THREE.ConeGeometry(1, 4, 8);
    const spireMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x880000, 
      roughness: 0.5,
      metalness: 0.5,
      emissive: 0x330000
    });
    const spire = new THREE.Mesh(spireGeometry, spireMaterial);
    spire.position.copy(position);
    spire.position.y += 13;
    spire.castShadow = true;
    spire.receiveShadow = true;
    
    // Add glow/light at the top
    const pointLight = new THREE.PointLight(0xff0000, 1, 20);
    pointLight.position.copy(position);
    pointLight.position.y += 13;
    
    // Pulse animation for the light
    this.pulseLight = pointLight;
    this.pulseTime = 0;
    
    // Group all tower parts
    this.tower = new THREE.Group();
    this.tower.name = 'EnemyTower';
    this.tower.add(base);
    this.tower.add(middle);
    this.tower.add(top);
    this.tower.add(spire);
    this.tower.add(pointLight);
    
    // Add to scene
    this.scene.add(this.tower);
    
    // Start first wave sooner
    this.timeUntilNextWave = 5; // First wave starts at 5 seconds
    
    console.log("Enemy tower created at:", position);
    
    // Create a special marking on the ground to show spawn area
    this.createSpawnAreaMarker();
  }
  
  createSpawnAreaMarker() {
    // Create a circular marker to indicate where enemies spawn
    const markerGeometry = new THREE.RingGeometry(this.spawnRadius - 0.2, this.spawnRadius + 0.2, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.rotation.x = Math.PI / 2; // Lay flat on the ground
    marker.position.copy(this.towerPosition);
    marker.position.y += 0.1; // Slightly above the ground
    
    this.scene.add(marker);
    
    // Add a pulse animation
    const animate = () => {
      marker.material.opacity = 0.3 + Math.sin(Date.now() / 500) * 0.3;
      requestAnimationFrame(animate);
    };
    
    animate();
  }
  
  createWaveStatusUI() {
    // Create wave status display in top-right
    this.waveStatusElement = document.createElement('div');
    this.waveStatusElement.style.position = 'absolute';
    this.waveStatusElement.style.top = '20px';
    this.waveStatusElement.style.right = '20px';
    this.waveStatusElement.style.color = 'white';
    this.waveStatusElement.style.fontSize = '16px';
    this.waveStatusElement.style.fontFamily = 'Arial, sans-serif';
    this.waveStatusElement.style.background = 'rgba(0, 0, 0, 0.7)';
    this.waveStatusElement.style.padding = '10px';
    this.waveStatusElement.style.borderRadius = '5px';
    this.waveStatusElement.style.zIndex = '100';
    this.waveStatusElement.style.minWidth = '250px';
    this.waveStatusElement.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
    this.waveStatusElement.style.borderLeft = '4px solid #ff0000';
    this.waveStatusElement.style.cursor = 'help';
    
    // Create countdown display below wave status
    this.countdownElement = document.createElement('div');
    this.countdownElement.style.position = 'absolute';
    this.countdownElement.style.top = '100px';
    this.countdownElement.style.right = '20px';
    this.countdownElement.style.color = '#ff9900';
    this.countdownElement.style.fontSize = '16px';
    this.countdownElement.style.fontFamily = 'Arial, sans-serif';
    this.countdownElement.style.background = 'rgba(0, 0, 0, 0.7)';
    this.countdownElement.style.padding = '10px';
    this.countdownElement.style.borderRadius = '5px';
    this.countdownElement.style.zIndex = '100';
    this.countdownElement.style.minWidth = '250px';
    this.countdownElement.style.boxShadow = '0 0 10px rgba(255, 153, 0, 0.5)';
    this.countdownElement.style.borderLeft = '4px solid #ff9900';
    
    document.body.appendChild(this.waveStatusElement);
    document.body.appendChild(this.countdownElement);
    
    // Create a help tooltip that appears on hover
    const tooltipElement = document.createElement('div');
    tooltipElement.style.position = 'absolute';
    tooltipElement.style.top = '20px';
    tooltipElement.style.right = '280px';
    tooltipElement.style.color = 'white';
    tooltipElement.style.fontSize = '14px';
    tooltipElement.style.fontFamily = 'Arial, sans-serif';
    tooltipElement.style.background = 'rgba(0, 0, 0, 0.8)';
    tooltipElement.style.padding = '10px';
    tooltipElement.style.borderRadius = '5px';
    tooltipElement.style.zIndex = '100';
    tooltipElement.style.maxWidth = '300px';
    tooltipElement.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3)';
    tooltipElement.style.opacity = '0';
    tooltipElement.style.pointerEvents = 'none';
    tooltipElement.style.transition = 'opacity 0.3s';
    tooltipElement.innerHTML = `
      <strong>How Waves Work:</strong><br>
      - Each wave spawns enemies in smaller groups<br>
      - Some enemies spawn immediately, others spawn later<br>
      - Kill all enemies to complete the wave<br>
      - The next wave will start automatically after a delay
    `;
    document.body.appendChild(tooltipElement);
    
    // Show tooltip on wave status hover
    this.waveStatusElement.addEventListener('mouseenter', () => {
      tooltipElement.style.opacity = '1';
    });
    
    this.waveStatusElement.addEventListener('mouseleave', () => {
      tooltipElement.style.opacity = '0';
    });
    
    // Initialize with first wave status
    this.updateWaveStatus();
    this.updateCountdown();
  }
  
  update(deltaTime) {
    // Log complete enemy details for debugging
    if (Math.random() < 0.02) { // Log occasionally to avoid spam
      console.log(`DEBUG: Total enemies in tracking: ${this.enemies.length}`);
      console.log(`DEBUG: Enemies remaining to spawn: ${this.enemiesRemaining}`);
      
      // Check for invalid enemies in the array
      let invalidCount = 0;
      for (const enemy of this.enemies) {
        if (!enemy || !enemy.isAlive) {
          invalidCount++;
        }
      }
      if (invalidCount > 0) {
        console.log(`WARNING: Found ${invalidCount} invalid enemies in tracking array`);
      }
    }

    // Special check: if a wave has been going for over 60 seconds, ensure it progresses
    if (this.waveInProgress && this._waveStartTime) {
      const waveElapsedTime = (performance.now() / 1000) - this._waveStartTime;
      if (waveElapsedTime > 60 && this.enemies.length === 0) {
        console.warn(`Wave ${this.waveNumber} has been active for ${Math.floor(waveElapsedTime)} seconds with no enemies alive. Forcing completion.`);
        this.enemiesRemaining = 0; // Force wave to complete
      }
    }

    // Handle wave mechanics
    if (this.waveInProgress) {
      // Check if all enemies are defeated
      if (this.enemies.length === 0 && this.enemiesRemaining === 0) {
        this.completeWave();
      }
    } else {
      // Count down to next wave
      this.timeUntilNextWave -= deltaTime;
      this.updateCountdown();
      
      if (this.timeUntilNextWave <= 0) {
        // Even if the previous wave isn't fully defeated, start the next wave
        // when the timer reaches zero
        this.startNextWave();
      }
    }
    
    // Special handling for stuck waves - if countdown is at 0 but we're not progressing
    if (this.timeUntilNextWave <= 0 && !this.waveInProgress) {
      console.warn("Wave countdown reached 0 but wave hasn't started. Forcing next wave.");
      this.startNextWave();
    }
    
    // Cancel any excessively delayed spawns (over 30 seconds old)
    if (this.waveInProgress && this.nextSpawnTimeout && this._lastSpawnTime) {
      const timeSinceLastSpawn = (performance.now() / 1000) - this._lastSpawnTime;
      if (timeSinceLastSpawn > 30) {
        console.warn(`No spawn for ${Math.floor(timeSinceLastSpawn)} seconds. Cancelling stuck spawn timeout.`);
        clearTimeout(this.nextSpawnTimeout);
        this.nextSpawnTimeout = null;
        
        // Force spawn any remaining enemies or complete wave
        if (this.enemiesRemaining > 0) {
          console.log("Forcing immediate spawn of remaining enemies");
          this.spawnWaveEnemies(this.enemiesRemaining);
        } else if (this.enemies.length === 0) {
          this.completeWave();
        }
      }
    }
    
    // Pulse the tower light
    if (this.pulseLight) {
      this.pulseTime += deltaTime;
      // Pulsating intensity
      this.pulseLight.intensity = 0.8 + Math.sin(this.pulseTime * 2) * 0.5;
      
      // Color shifts if wave is in progress
      if (this.waveInProgress) {
        // More intense red during wave
        const hue = (this.pulseTime * 0.1) % 0.1; // Keep in red range
        this.pulseLight.color.setHSL(hue, 1, 0.5);
      } else {
        // Ominous glow between waves
        const hue = 0.05 + Math.sin(this.pulseTime * 0.5) * 0.05; // Shift between red-orange
        this.pulseLight.color.setHSL(hue, 0.8, 0.5);
      }
    }
    
    // Clean up any invalid enemies first
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i] || (typeof this.enemies[i].isAlive !== 'undefined' && !this.enemies[i].isAlive)) {
        console.log(`Removing invalid/dead enemy at index ${i}`);
        // Try to properly dispose if method exists
        if (this.enemies[i] && typeof this.enemies[i].dispose === 'function') {
          this.enemies[i].dispose();
        }
        this.enemies.splice(i, 1);
        // Update UI since we removed an enemy
        this.updateWaveStatus();
      }
    }
    
    // Update all enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      
      // Skip null or undefined enemies
      if (!enemy) {
        console.warn(`Found null enemy at index ${i}, removing`);
        this.enemies.splice(i, 1);
        continue;
      }
      
      // Skip dead enemies
      if (!enemy.isAlive) {
        // Get loot from enemy
        try {
          const loot = enemy.die();
          if (loot && this.inventorySystem) {
            // Add resources to player inventory
            this.inventorySystem.addResource(loot.resources.type, loot.resources.amount);
          }
        } catch (error) {
          console.error("Error getting loot from enemy:", error);
        }
        
        // Remove from list
        this.enemies.splice(i, 1);
        console.log(`Enemy removed, ${this.enemies.length} enemies left, ${this.enemiesRemaining} more to spawn`);
        
        // Emit event for enemy removed
        this.context.events.emit('enemyRemoved', enemy);
        
        // Update wave status display
        this.updateWaveStatus();
        
        continue;
      }
      
      // Ensure target is always the objective
      enemy.target = this.objective;
      
      // Force chase state for testing
      if (enemy.state !== 'attack') {
        enemy.state = 'chase';
      }
      
      // Update enemy
      try {
        enemy.update(deltaTime);
      } catch (error) {
        console.error(`Error updating enemy ${i}:`, error);
      }
      
      // Verify enemy is moving - log every 30 frames
      if (Math.random() < 0.03) {
        const distanceToObjective = enemy.position.distanceTo(this.objective.position);
        console.log(`Enemy ${i} - Distance to objective: ${distanceToObjective.toFixed(2)}, Velocity: ${enemy.velocity.length().toFixed(2)}`);
      }
      
      // If enemy appears stuck, give it a boost
      if (enemy.velocity.length() < 0.5) {
        const objectivePos = this.objective.position;
        const direction = new THREE.Vector3()
          .subVectors(objectivePos, enemy.position)
          .normalize();
        
        enemy.velocity.x = direction.x * enemy.speed;
        enemy.velocity.z = direction.z * enemy.speed;
        
        console.log("Boosting stuck enemy:", enemy.velocity);
      }
    }
  }
  
  startNextWave() {
    // Check if there are still enemies from previous wave
    if (this.enemies.length > 0) {
      console.log(`Starting wave ${this.waveNumber + 1} with ${this.enemies.length} enemies still alive from previous wave!`);
      
      // Create a warning message for the player
      this.showWaveWarning(`${this.enemies.length} enemies from previous wave still alive!`);
    }
    
    this.waveNumber++;
    this.waveInProgress = true;
    
    // Store the time we started the wave for timeout detection
    this._waveStartTime = performance.now() / 1000;
    this._lastSpawnTime = this._waveStartTime;
    
    // Calculate enemies for this wave (7 enemies for wave 1)
    this.enemiesRemaining = Math.min(5 + this.waveNumber * 2, 30); // More enemies each wave, max 30
    
    // Announce the wave
    this.showWaveAnnouncement();
    
    // Update UI
    this.updateWaveStatus();
    
    // Spawn initial enemies (3 enemies for wave 1)
    const initialSpawns = Math.min(3 + Math.floor(this.waveNumber / 2), 10); // Start with more enemies each wave
    
    console.log(`Starting wave ${this.waveNumber} with ${this.enemiesRemaining} total enemies to spawn`);
    console.log(`Total enemies on field: ${this.enemies.length}, spawning initial batch of ${initialSpawns} more enemies now`);
    
    for (let i = 0; i < initialSpawns; i++) {
      if (this.enemiesRemaining > 0) {
        setTimeout(() => {
          this.spawnWaveEnemies(1);
        }, i * 500); // Stagger spawns for effect
      }
    }
  }
  
  spawnWaveEnemies(count) {
    // Update last spawn time
    this._lastSpawnTime = performance.now() / 1000;
    
    const actualCount = Math.min(count, this.enemiesRemaining);
    console.log(`Spawning ${actualCount} enemies (requested: ${count}, remaining: ${this.enemiesRemaining})`);
    
    // Track successfully spawned enemies
    let successfulSpawns = 0;
    
    for (let i = 0; i < actualCount; i++) {
      if (this.enemiesRemaining > 0) {
        // Stagger spawn times for more natural appearance
        setTimeout(() => {
          try {
            const enemy = this.spawnEnemy();
            if (enemy) {
              // Only count successful spawns
              successfulSpawns++;
              console.log(`Successfully spawned enemy ${i+1} of ${actualCount}`);
            } else {
              console.warn(`Failed to spawn enemy ${i+1} of ${actualCount} (returned null)`);
            }
          } catch (error) {
            console.error(`Error spawning enemy ${i+1} of ${actualCount}:`, error);
          }
          
          // Always decrement count even if spawn failed - treat it as if it died immediately
          this.enemiesRemaining--;
          
          // Update UI
          this.updateWaveStatus();
        }, i * 800); // Spawn one every 0.8 seconds instead of all at once
      }
    }
    
    // Schedule next spawns if more enemies remain
    if (this.enemiesRemaining > 0) {
      console.log(`Scheduling next ${Math.min(3, this.enemiesRemaining)} enemies to spawn in 4-8 seconds, ${this.enemiesRemaining} total remaining`);
      
      // Clear any existing timeout before creating a new one
      if (this.nextSpawnTimeout) {
        clearTimeout(this.nextSpawnTimeout);
      }
      
      // Store the timeout ID so it can be canceled if needed
      this.nextSpawnTimeout = setTimeout(() => {
        // Track that we're executing the callback
        console.log("Spawn timeout callback executing");
        this.nextSpawnTimeout = null;
        
        // Spawn 1-3 enemies at a time, depending on wave number
        const spawnCount = Math.min(
          1 + Math.floor(this.waveNumber / 3), 
          this.enemiesRemaining,
          3
        );
        console.log(`Now spawning next batch of ${spawnCount} enemies`);
        this.spawnWaveEnemies(spawnCount);
      }, 4000 + Math.random() * 4000); // Longer delay between batches (4-8 seconds)
    } else {
      console.log("All enemies for this wave have been spawned or scheduled");
    }
  }
  
  spawnEnemy() {
    try {
      // Choose enemy type based on wave number
      let enemyTypes = Object.keys(this.enemyTypes);
      let availableTypes = [];
      
      // Unlock enemy types progressively
      if (this.waveNumber >= 1) availableTypes.push('goblin');
      if (this.waveNumber >= 3) availableTypes.push('orc');
      if (this.waveNumber >= 5) availableTypes.push('troll');
      if (this.waveNumber >= 7) availableTypes.push('demon');
      if (this.waveNumber >= 9) availableTypes.push('warlock');
      
      // Default to goblin if no types are available (shouldn't happen)
      if (availableTypes.length === 0) availableTypes.push('goblin');
      
      // Choose random type from available types (no longer force goblin)
      const enemyType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      
      // Determine if this will be a special unit
      let variation = 'normal';
      const specialChance = 0.15; // 15% chance for a special unit
      
      if (Math.random() < specialChance) {
        // Choose a random variation (excluding normal)
        const variationTypes = Object.keys(this.enemyVariations).filter(v => v !== 'normal');
        variation = variationTypes[Math.floor(Math.random() * variationTypes.length)];
        console.log(`Spawning special ${variation} ${enemyType}!`);
      }
      
      // Get spawn position around the tower
      const angle = Math.random() * Math.PI * 2;
      const distance = this.spawnRadius;
      
      const spawnX = this.towerPosition.x + Math.sin(angle) * distance;
      const spawnZ = this.towerPosition.z + Math.cos(angle) * distance;
      const spawnY = this.world.getHeightAt(spawnX, spawnZ);
      
      const spawnPosition = new THREE.Vector3(spawnX, spawnY, spawnZ);
      
      // Scale enemy attributes based on wave number
      const attributes = {...this.enemyTypes[enemyType].attributes};
      
      // Enhance enemies as waves progress
      const waveScaling = 1 + (this.waveNumber - 1) * 0.1; // 10% increase per wave
      
      // Apply variation modifiers
      const variationSettings = this.enemyVariations[variation];
      attributes.health = Math.floor(attributes.health * waveScaling * variationSettings.healthMod);
      attributes.damage = Math.floor(attributes.damage * waveScaling * variationSettings.damageMod);
      attributes.speed = attributes.speed * variationSettings.speedMod; // Apply speed modifier but don't double it
      
      // Store variation for visual scaling
      attributes.variation = variation;
      attributes.scale = variationSettings.scale;
      
      console.log(`Creating ${variation} ${enemyType} with attributes:`, attributes);
      
      // Create the enemy
      const enemy = new EnemyUnit(
        this.scene,
        this.player,
        this.world,
        enemyType,
        spawnPosition,
        attributes
      );
      
      // Force the state to 'chase' and set target to objective directly
      enemy.target = this.objective;
      enemy.state = 'chase';
      
      // Give an initial velocity boost toward the objective
      const objectivePos = this.objective.position;
      const direction = new THREE.Vector3()
        .subVectors(objectivePos, spawnPosition)
        .normalize();
      
      enemy.velocity.x = direction.x * attributes.speed;
      enemy.velocity.z = direction.z * attributes.speed;
      
      console.log(`Enemy spawned targeting objective at distance: ${spawnPosition.distanceTo(objectivePos).toFixed(2)}`);
      console.log(`Initial velocity: ${enemy.velocity.length().toFixed(2)}, direction: (${direction.x.toFixed(2)}, ${direction.z.toFixed(2)})`);
      
      // Store context in the enemy's mesh for access by other systems
      if (enemy.mesh) {
        enemy.mesh.userData.context = this.context;
      }
      
      // Add to enemies array
      this.enemies.push(enemy);
      console.log(`Added enemy to tracking. Total: ${this.enemies.length}, remaining to spawn: ${this.enemiesRemaining}`);
      
      // Notify via event system
      this.context.events.emit('enemySpawned', enemy);
      
      // Store in window for debugging
      window.enemies = this.enemies;
      
      // Show spawn effect
      this.showSpawnEffect(spawnPosition);
      
      return enemy;
    } catch (error) {
      console.error("Failed to spawn enemy:", error);
      return null; // Return null to indicate failure
    }
  }
  
  showSpawnEffect(position) {
    // Create a simple particle effect at spawn location
    const particles = new THREE.Group();
    particles.position.copy(position);
    particles.position.y += 1;
    
    // Add several small particles
    for (let i = 0; i < 10; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const particle = new THREE.Mesh(geometry, material);
      
      // Random offset
      particle.position.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      
      particles.add(particle);
    }
    
    this.scene.add(particles);
    
    // Animate and remove
    const startTime = performance.now() / 1000;
    const duration = 1.0;
    
    const animateSpawn = () => {
      const now = performance.now() / 1000;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Scale up and fade out
      particles.scale.set(
        1 + progress * 2,
        1 + progress * 2,
        1 + progress * 2
      );
      
      particles.children.forEach(p => {
        p.material.opacity = 1 - progress;
        p.material.transparent = true;
      });
      
      if (progress < 1) {
        requestAnimationFrame(animateSpawn);
      } else {
        // Remove particles
        this.scene.remove(particles);
      }
    };
    
    animateSpawn();
  }
  
  completeWave() {
    console.log(`Completing wave ${this.waveNumber}. Enemies left: ${this.enemies.length}, remaining to spawn: ${this.enemiesRemaining}`);
    
    // Cancel any pending spawn timeouts
    if (this.nextSpawnTimeout) {
      clearTimeout(this.nextSpawnTimeout);
      this.nextSpawnTimeout = null;
    }
    
    // Double-check if any enemies are still alive
    if (this.enemies.length > 0) {
      console.warn("Completing wave with enemies still alive! Cleaning up...");
      // Force dispose all remaining enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        try {
          const enemy = this.enemies[i];
          if (enemy && typeof enemy.dispose === 'function') {
            enemy.dispose();
          }
          // Remove from array safely
          this.enemies.splice(i, 1);
        } catch (error) {
          console.error("Error disposing enemy:", error);
          // Remove it anyway
          this.enemies.splice(i, 1);
        }
      }
      // Verify array is empty
      if (this.enemies.length > 0) {
        console.warn("Force clearing enemies array after cleanup attempts");
        this.enemies.length = 0;
      }
    }
    
    // Calculate rewards based on enemies and wave number
    const woodReward = this.waveNumber * 3 + this.enemiesRemaining * 2;
    const stoneReward = this.waveNumber + this.enemiesRemaining;
    
    // Add resources to player inventory
    if (this.inventorySystem) {
      try {
        console.log(`Adding rewards to player: ${woodReward} wood, ${stoneReward} stone`);
        this.inventorySystem.addItem('wood', woodReward);
        this.inventorySystem.addItem('stone', stoneReward);
      } catch (error) {
        console.error("Error giving rewards:", error);
      }
    } else {
      console.warn("No inventory system available to give rewards");
    }
    
    // Reset wave state
    this.waveInProgress = false;
    this.timeUntilNextWave = 20 + this.waveNumber * 2; // Longer time between waves as you progress
    this.enemiesRemaining = 0;
    
    // Show wave completed message with adjusted rewards
    this.showWaveCompleted(woodReward, stoneReward);
    
    // Ensure UI is updated
    this.updateWaveStatus();
    this.updateCountdown();
    
    console.log(`Wave ${this.waveNumber} completed! Next wave in ${this.timeUntilNextWave} seconds`);
  }
  
  updateWaveStatus() {
    if (this.waveStatusElement) {
      if (this.waveInProgress) {
        const totalEnemies = this.enemies.length + this.enemiesRemaining;
        
        // Create a formatted status with color-coding and better organization
        let statusHTML = `<div style="font-weight: bold; margin-bottom: 5px; color: #ff5555;">Wave ${this.waveNumber}</div>`;
        
        statusHTML += `<div>Total: <span style="font-weight: bold;">${totalEnemies} enemies</span></div>`;
        
        // Show active enemies with green color
        if (this.enemies.length > 0) {
          statusHTML += `<div style="margin-top: 3px; color: #55ff55;">Active: ${this.enemies.length} on field</div>`;
        }
        
        // Show enemies remaining to spawn with yellow color
        if (this.enemiesRemaining > 0) {
          statusHTML += `<div style="margin-top: 3px; color: #ffff55;">Coming: ${this.enemiesRemaining} will spawn soon</div>`;
        }
        
        this.waveStatusElement.innerHTML = statusHTML;
      } else {
        this.waveStatusElement.innerHTML = `<div style="font-weight: bold; color: #55ff55;">Wave ${this.waveNumber} completed!</div>`;
      }
    }
  }
  
  updateCountdown() {
    if (this.countdownElement) {
      if (!this.waveInProgress) {
        const seconds = Math.ceil(this.timeUntilNextWave);
        this.countdownElement.textContent = `Next wave in: ${seconds}s`;
        this.countdownElement.style.display = 'block';
      } else {
        this.countdownElement.style.display = 'none';
      }
    }
  }
  
  showWaveAnnouncement() {
    // Create wave announcement element
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = '50%';
    element.style.left = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    element.style.color = '#FF0000';
    element.style.padding = '20px';
    element.style.borderRadius = '10px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.fontSize = '32px';
    element.style.fontWeight = 'bold';
    element.style.textAlign = 'center';
    element.style.zIndex = '1000';
    element.style.pointerEvents = 'none';
    element.style.transition = 'opacity 0.5s';
    element.style.opacity = '0';
    
    element.textContent = `WAVE ${this.waveNumber}`;
    
    document.body.appendChild(element);
    
    // Animate in
    setTimeout(() => {
      element.style.opacity = '1';
    }, 50);
    
    // Animate out and remove
    setTimeout(() => {
      element.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(element);
      }, 500);
    }, 2000);
  }
  
  showWaveCompleted(woodReward, stoneReward) {
    // Create wave completed element
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = '50%';
    element.style.left = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    element.style.color = '#00FF00';
    element.style.padding = '20px';
    element.style.borderRadius = '10px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.fontSize = '28px';
    element.style.fontWeight = 'bold';
    element.style.textAlign = 'center';
    element.style.zIndex = '1000';
    element.style.pointerEvents = 'none';
    element.style.transition = 'opacity 0.5s';
    element.style.opacity = '0';
    
    element.innerHTML = `WAVE ${this.waveNumber} COMPLETED!<br>
                        <span style="font-size: 22px; color: #AAAAAA">Rewards:<br>
                        +${woodReward} Wood<br>
                        +${stoneReward} Stone</span>`;
    
    document.body.appendChild(element);
    
    // Animate in
    setTimeout(() => {
      element.style.opacity = '1';
    }, 50);
    
    // Animate out and remove
    setTimeout(() => {
      element.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(element);
      }, 500);
    }, 3000);
  }
  
  showWaveWarning(message) {
    // Create wave warning element
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = '40%';
    element.style.left = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    element.style.color = '#FFAA00'; // Warning orange color
    element.style.padding = '15px';
    element.style.borderRadius = '10px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.fontSize = '20px';
    element.style.fontWeight = 'bold';
    element.style.textAlign = 'center';
    element.style.zIndex = '1000';
    element.style.pointerEvents = 'none';
    element.style.transition = 'opacity 0.5s';
    element.style.opacity = '0';
    element.style.borderLeft = '4px solid #FFAA00';
    
    element.innerHTML = `⚠️ WARNING: ${message}`;
    
    document.body.appendChild(element);
    
    // Animate in
    setTimeout(() => {
      element.style.opacity = '1';
    }, 50);
    
    // Animate out and remove
    setTimeout(() => {
      element.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(element);
      }, 500);
    }, 2500);
  }
  
  // Clean up everything
  dispose() {
    // Remove all enemies
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    
    // Remove tower
    if (this.tower) {
      this.scene.remove(this.tower);
    }
    
    // Remove UI elements
    if (this.waveStatusElement) {
      document.body.removeChild(this.waveStatusElement);
    }
    
    if (this.countdownElement) {
      document.body.removeChild(this.countdownElement);
    }
  }
} 