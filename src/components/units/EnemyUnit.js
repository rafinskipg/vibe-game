import * as THREE from 'three';

export class EnemyUnit {
  constructor(scene, player, world, type, position, attributes) {
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.type = type;
    this.position = position.clone();
    this.attributes = attributes;
    
    // Combat stats
    this.health = attributes.health;
    this.maxHealth = attributes.health;
    this.damage = attributes.damage;
    this.lastAttackTime = 0;
    this.attackCooldown = 1.0; // Attack once per second
    
    // State
    this.isAlive = true;
    this.state = 'chase'; // chase, attack, wander, die
    this.target = this.player; // Default target is the player
    
    // Movement
    this.velocity = new THREE.Vector3();
    this.speed = attributes.speed;
    this.visionRange = attributes.vision;
    
    // Visuals
    this.createMesh();
    this.createHealthBar();
  }
  
  createMesh() {
    // Create enemy body
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshStandardMaterial({ 
      color: this.attributes.color || 0xFF0000,
      roughness: 0.7,
      metalness: 0.3 
    });
    
    // Create group first
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    
    // Apply scale if specified
    const scale = this.attributes.scale || 1.0;
    this.group.scale.set(scale, scale, scale);
    
    // Apply a different emissive color for special variations
    if (this.attributes.variation && this.attributes.variation !== 'normal') {
      material.emissive = new THREE.Color(0x222222);
      
      // Add special colors for different variations
      if (this.attributes.variation === 'large') {
        material.emissive = new THREE.Color(0x001122); // Blue tint
      } else if (this.attributes.variation === 'huge') {
        material.emissive = new THREE.Color(0x220011); // Purple tint
        // Add glowing eyes for huge enemies
        this.createGlowingEyes();
      } else if (this.attributes.variation === 'quick') {
        material.emissive = new THREE.Color(0x112200); // Green tint
      }
    }
    
    this.scene.add(this.group);
    
    // Critical: Tag this group for detection by systems
    this.group.userData = {
      type: 'enemy',
      isEnemy: true,
      enemyRef: this,
      unit: this
    };
    
    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 1; // Position relative to group
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Tag the mesh for attack detection and minimap
    this.mesh.userData = {
      isEnemy: true,
      enemyRef: this,
      unit: this
    };
    
    // Add eyes for direction indication
    const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    
    // Left eye
    this.leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    this.leftEye.position.set(-0.25, 1.5, 0.5);
    
    // Right eye
    this.rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    this.rightEye.position.set(0.25, 1.5, 0.5);
    
    // Add glowing effect for better visibility at night
    const glowGeometry = new THREE.SphereGeometry(0.6, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: this.attributes.color || 0xFF0000,
      transparent: true,
      opacity: 0.3
    });
    this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.glow.position.y = 1;
    
    // Add all parts to the group
    this.group.add(this.mesh);
    this.group.add(this.leftEye);
    this.group.add(this.rightEye);
    this.group.add(this.glow);
    
    // Also tag each child object for robust detection
    this.leftEye.userData = { isEnemy: true, enemyRef: this };
    this.rightEye.userData = { isEnemy: true, enemyRef: this };
    this.glow.userData = { isEnemy: true, enemyRef: this };
    
    // Try to find context from scene userData or window.gameContext
    let context = null;
    if (this.scene.userData && this.scene.userData.context) {
      context = this.scene.userData.context;
    } else if (window.gameContext) {
      context = window.gameContext;
    }
    
    // Register enemy with context if available
    if (context) {
      context.registerEnemy(this);
      console.log("Enemy registered with context system");
    } 
    // Fallback to window.game for backward compatibility
    else if (window.game) {
      window.game.enemies = window.game.enemies || [];
      window.game.enemies.push(this);
      console.log("Enemy registered with window.game (legacy)");
    } else {
      console.warn("No context or window.game found to register enemy");
    }
    
    // Log creation
    console.log(`Enemy created at position (${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(1)})`);
  }
  
  createHealthBar() {
    // Create container
    this.healthBarContainer = new THREE.Group();
    this.healthBarContainer.position.y = 2.5;
    
    // Create background bar
    const backgroundGeometry = new THREE.PlaneGeometry(1.2, 0.2);
    const backgroundMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x333333,
      side: THREE.DoubleSide 
    });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    this.healthBarContainer.add(background);
    
    // Create health bar
    const healthGeometry = new THREE.PlaneGeometry(1, 0.15);
    const healthMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff3030, 
      side: THREE.DoubleSide 
    });
    this.healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
    this.healthBar.position.z = 0.01;
    this.healthBarContainer.add(this.healthBar);
    
    // Add to scene through main mesh
    if (this.mesh) {
      this.mesh.add(this.healthBarContainer);
    } else {
      console.error("Cannot add health bar - mesh is undefined");
      return;
    }
    
    // Try to make health bar face camera if camera exists
    try {
      const camera = this.scene.getObjectByName('camera');
      if (camera && camera.position) {
        this.healthBarContainer.lookAt(camera.position);
      } else {
        // If no camera found, just make the health bar face a fixed direction
        this.healthBarContainer.rotation.x = Math.PI; // Face forward
        console.warn("No camera found for health bar orientation, using default orientation");
      }
    } catch (error) {
      console.warn("Error setting health bar orientation:", error);
      // Set a default orientation
      this.healthBarContainer.rotation.x = Math.PI;
    }
  }
  
  update(deltaTime) {
    if (!this.isAlive) return;
    
    // Always update health bar to face camera
    try {
      const camera = this.scene.getObjectByName('camera');
      if (camera && camera.position && this.healthBarContainer) {
        this.healthBarContainer.lookAt(camera.position);
      }
    } catch (error) {
      // Silently fail - no need to spam console with this error
    }
    
    // UPDATED: Get objective from context or fall back to window.game
    let objective = null;
    
    // Try to get context from scene userData
    let context = null;
    if (this.scene.userData && this.scene.userData.context) {
      context = this.scene.userData.context;
    } else if (window.gameContext) {
      context = window.gameContext;
    }
    
    // Try to get objective from context
    if (context && context.objective) {
      objective = context.objective;
    } 
    // Fallback to window.game for backward compatibility
    else if (window.game && window.game.objective) {
      objective = window.game.objective;
    }
    
    // Set target to objective if available, otherwise fall back to player
    this.target = objective || this.player;
    this.state = 'chase';
    
    // Get objective position
    const targetPos = this.target.getPosition ? this.target.getPosition() : this.target.position;
    
    // Calculate distance to target
    const distanceToTarget = this.position.distanceTo(targetPos);
    
    // Switch to attack only if very close
    if (distanceToTarget <= 2) {
      this.state = 'attack';
    }
    
    // Handle different states
    switch (this.state) {
      case 'chase':
        this.chaseTarget(this.target, deltaTime);
        break;
      case 'attack':
        this.attackTarget(this.target, deltaTime);
        break;
      case 'wander':
        this.wander(deltaTime);
        break;
      case 'die':
        // Nothing to do, handled in takeDamage
        break;
    }
    
    // FIXED: ALWAYS apply movement directly toward target
    const direction = new THREE.Vector3()
      .subVectors(targetPos, this.position)
      .normalize();
    
    // Set a minimum velocity to ensure enemies always move
    const minSpeed = this.speed * 0.75;
    
    // Direct movement toward target - SIMPLIFIED AND MORE RELIABLE
    this.velocity.x = direction.x * this.speed;
    this.velocity.z = direction.z * this.speed;
    
    // Update position with velocity
    const movement = this.velocity.clone().multiplyScalar(deltaTime);
    this.position.add(movement);
    
    // Set Y position based on terrain height
    const terrainHeight = this.world.getHeightAt(this.position.x, this.position.z);
    this.position.y = terrainHeight;
    
    // CRITICAL FIX: Update group position properly
    if (this.group) {
      this.group.position.copy(this.position);
    }
    
    // Face toward movement direction
    if (this.velocity.length() > 0.1) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      if (this.mesh) {
        this.mesh.rotation.y = targetAngle;
      }
    }
    
    // Add debug visual for velocity
    this.showVelocityVector();
    
    // Check if enemy is stuck
    this.checkStuckStatus(targetPos);
    
    // Log movement info occasionally
    if (Math.random() < 0.01) {
      console.log(`Enemy position: (${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(1)})`);
      console.log(`Velocity: ${this.velocity.length().toFixed(2)}, Direction: (${direction.x.toFixed(2)}, ${direction.z.toFixed(2)})`);
      console.log(`Distance to target: ${distanceToTarget.toFixed(2)}`);
    }
  }
  
  showVelocityVector() {  
    // Remove previous debug arrow if it exists
    if (this._debugArrow) {
      this.group.remove(this._debugArrow);
    }
    
    // Create a new arrow to visualize velocity
    const arrowLength = this.velocity.length() * 0.5;
    if (arrowLength > 0.1) {
      const arrowDirection = this.velocity.clone().normalize();
      const arrowHelper = new THREE.ArrowHelper(
        arrowDirection,
        new THREE.Vector3(0, 1.5, 0),
        arrowLength,
        0xff0000,
        0.3,
        0.2
      );
      this.group.add(arrowHelper);
      this._debugArrow = arrowHelper;
    }
  }
  
  checkStuckStatus(targetPos) {
    // Initialize last position tracking if needed
    if (!this._lastPosition) {
      this._lastPosition = this.position.clone();
      this._lastMoveTime = performance.now();
      return;
    }
    
    const distanceMoved = this.position.distanceTo(this._lastPosition);
    const timePassedMs = performance.now() - this._lastMoveTime;
    const timePassed = timePassedMs / 1000;
    
    // If we've been stuck for a short time (1 second)
    if (distanceMoved < 0.5 && timePassed > 1) {
      console.log("Enemy appears stuck - boosting speed");
      
      // Calculate direction to target
      const direction = new THREE.Vector3()
        .subVectors(targetPos, this.position)
        .normalize();
      
      // Boost speed
      const boostMultiplier = 1 + Math.min(3, timePassed);
      this.velocity.x = direction.x * this.speed * boostMultiplier;
      this.velocity.z = direction.z * this.speed * boostMultiplier;
      
      // If we've been stuck for too long (3+ seconds), teleport forward
      if (timePassed > 3) {
        // Move forward in the direction we're trying to go
        const jumpDistance = 3 + (timePassed - 3); // Increase jump distance the longer we're stuck
        const jumpPosition = this.position.clone().add(
          direction.multiplyScalar(jumpDistance)
        );
        
        // Set Y position based on terrain
        jumpPosition.y = this.world.getHeightAt(jumpPosition.x, jumpPosition.z);
        
        // Update positions
        this.position.copy(jumpPosition);
        this.group.position.copy(jumpPosition);
        
        console.log(`Emergency unstuck: Jumped ${jumpDistance.toFixed(1)} units`);
        
        // Reset tracking
        this._lastPosition.copy(this.position);
        this._lastMoveTime = performance.now();
      }
    }
    // If we're moving properly, update tracking
    else if (distanceMoved > 0.2) {
      this._lastPosition.copy(this.position);
      this._lastMoveTime = performance.now();
    }
  }
  
  chaseTarget(target, deltaTime) {
    if (!target) {
      console.error("No target to chase");
      return;
    }
    
    // Get target position - handle both objects with getPosition() method and those with a position property
    const targetPosition = target.getPosition ? target.getPosition() : target.position;
    if (!targetPosition) {
      console.error("Target has no valid position:", target);
      return;
    }
    
    // Calculate direction to target
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, this.position)
      .normalize();
    
    // Set velocity directly (movement is handled in update)
    this.velocity.x = direction.x * this.speed;
    this.velocity.z = direction.z * this.speed;
    
    // If close enough to target, switch to attack mode
    const distance = this.position.distanceTo(targetPosition);
    if (distance <= 2) {
      this.state = 'attack';
    }
  }
  
  attackTarget(target, deltaTime) {
    // Face target
    const targetPosition = target.getPosition ? target.getPosition() : target.position;
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, this.position)
      .normalize();
    
    // Look at target
    const targetAngle = Math.atan2(direction.x, direction.z);
    this.mesh.rotation.y = targetAngle;
    
    // Attack on cooldown
    const now = performance.now() / 1000;
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.lastAttackTime = now;
      
      // Deal damage to target
      if (typeof target.takeDamage === 'function') {
        target.takeDamage(this.damage);
        
        // Show damage indicator
        this.showDamageIndicator(targetPosition, this.damage);
      }
    }
  }
  
  wander(deltaTime) {
    // Randomly change direction occasionally
    if (Math.random() < 0.01) {
      const angle = Math.random() * Math.PI * 2;
      const wanderStrength = this.speed * 0.3;
      
      this.velocity.x += Math.sin(angle) * wanderStrength;
      this.velocity.z += Math.cos(angle) * wanderStrength;
    }
    
    // Face toward movement direction
    if (this.velocity.length() > 0.1) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = targetAngle;
    }
  }
  
  takeDamage(amount) {
    if (!this.isAlive) return 0;
    
    // Apply damage
    this.health -= amount;
    
    // Update health bar if we have one
    if (this.mesh && this.healthBar) {
      this.updateHealthBar();
    }
    
    // Show damage indicator
    this.showDamageIndicator(amount);
    
    console.log(`Enemy took ${amount} damage, health: ${this.health}/${this.maxHealth}`);
    
    // Check if dead
    if (this.health <= 0) {
      this.isAlive = false;
      this.state = 'die';
      console.log("Enemy killed!");
      
      // If the enemy died, call die method to handle cleanup
      this.die();
    }
    
    return amount;  // Return damage dealt
  }
  
  updateHealthBar() {
    // Add null check to prevent errors
    if (!this.healthBar) {
      console.warn("Health bar is undefined, cannot update");
      return;
    }
    
    // Update health bar scale based on current health
    const healthPercent = Math.max(0, this.health / this.maxHealth);
    this.healthBar.scale.x = healthPercent;
    
    // Position the health bar so it scales from the left
    this.healthBar.position.x = (healthPercent - 1) * 0.5;
  }
  
  showDamageIndicator(position, amount) {
    // Guard against invalid inputs
    if (!amount) {
      amount = position; // If only one parameter, assume it's the amount
      position = this.position ? this.position.clone().add(new THREE.Vector3(0, 2, 0)) : null;
    }
    
    // If we don't have a valid position, we can't show the indicator
    if (!position) {
      console.warn("Cannot show damage indicator: no valid position");
      return;
    }
    
    // Create a floating damage number
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.color = 'red';
    element.style.fontSize = '16px';
    element.style.fontWeight = 'bold';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.textShadow = '1px 1px 2px black';
    element.style.pointerEvents = 'none';
    element.style.transition = 'transform 1s, opacity 1s';
    element.style.opacity = '1';
    element.textContent = amount.toString();
    
    // Add to body
    document.body.appendChild(element);
    
    // Get screen position for the damage indicator
    const screenPosition = this.worldToScreen(position);
    if (!screenPosition) {
      document.body.removeChild(element);
      return;
    }
    
    element.style.left = `${screenPosition.x}px`;
    element.style.top = `${screenPosition.y}px`;
    
    // Animate
    setTimeout(() => {
      element.style.transform = 'translateY(-50px)';
      element.style.opacity = '0';
    }, 50);
    
    // Remove after animation
    setTimeout(() => {
      document.body.removeChild(element);
    }, 1050);
  }
  
  worldToScreen(worldPosition) {
    // Check for valid position
    if (!worldPosition) return null;
    
    // Projects 3D position to 2D screen coordinates
    const camera = this.scene.getObjectByName('camera');
    if (!camera) return null;
    
    try {
      const vector = worldPosition.project(camera);
      
      return {
        x: (vector.x * 0.5 + 0.5) * window.innerWidth,
        y: (-vector.y * 0.5 + 0.5) * window.innerHeight
      };
    } catch (error) {
      console.warn("Error projecting position to screen:", error);
      return null;
    }
  }
  
  die() {
    if (!this.isAlive) return; // Prevent double calls
    
    this.isAlive = false;
    this.state = 'die';
    
    // Death animation
    const deathDuration = 1.0;
    const startTime = performance.now() / 1000;
    
    // Remove health bar if it exists
    if (this.mesh && this.healthBarContainer) {
      this.mesh.remove(this.healthBarContainer);
    }
    
    const animateDeath = () => {
      const now = performance.now() / 1000;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / deathDuration);
      
      // Only animate if mesh still exists
      if (this.mesh) {
        // Sink into ground and fade
        this.mesh.position.y = this.position.y + 1 - progress;
        this.mesh.scale.y = 1 - progress;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animateDeath);
      } else {
        // Complete cleanup
        this.dispose();
      }
    };
    
    animateDeath();
    
    // Also notify context if available
    this.notifyDeath();
    
    // Return loot/rewards
    return {
      experience: this.attributes.experience || 10,
      resources: {
        type: Math.random() < 0.6 ? 'wood' : 'stone',
        amount: Math.floor(Math.random() * 3) + 1
      }
    };
  }
  
  notifyDeath() {
    // Try to find context from scene userData or window.gameContext
    let context = null;
    if (this.scene.userData && this.scene.userData.context) {
      context = this.scene.userData.context;
    } else if (window.gameContext) {
      context = window.gameContext;
    }
    
    // Notify context if found
    if (context) {
      console.log("Notifying context of enemy death");
      context.events.emit('enemyRemoved', this);
      
      // Also try to directly remove from enemies array if accessible
      if (Array.isArray(context.enemies)) {
        const index = context.enemies.indexOf(this);
        if (index !== -1) {
          context.enemies.splice(index, 1);
          console.log("Directly removed enemy from context.enemies array");
        }
      }
      
      // Check if there's an enemy system with an enemies array
      if (context.systems && context.systems.enemy && Array.isArray(context.systems.enemy.enemies)) {
        const index = context.systems.enemy.enemies.indexOf(this);
        if (index !== -1) {
          context.systems.enemy.enemies.splice(index, 1);
          console.log("Directly removed enemy from enemySystem.enemies array");
        }
      }
    }
    
    // Fallback for legacy window.game support
    if (window.game && Array.isArray(window.game.enemies)) {
      const index = window.game.enemies.indexOf(this);
      if (index !== -1) {
        window.game.enemies.splice(index, 1);
        console.log("Removed enemy from window.game.enemies array (legacy)");
      }
    }
    
    // Update global enemies reference for backward compatibility
    if (Array.isArray(window.enemies)) {
      const index = window.enemies.indexOf(this);
      if (index !== -1) {
        window.enemies.splice(index, 1);
        console.log("Removed enemy from window.enemies global array");
      }
    }
  }
  
  dispose() {
    // Remove from scene
    if (this.group) {
      this.scene.remove(this.group);
    }
    
    // Remove references for garbage collection
    this.mesh = null;
    this.group = null;
    this.healthBar = null;
    this.healthBarContainer = null;
  }
  
  getPosition() {
    return this.position.clone();
  }
  
  // New method to create glowing eyes for huge enemies
  createGlowingEyes() {
    // Create point lights for the eyes
    const leftEyeLight = new THREE.PointLight(0xff0000, 0.5, 3);
    leftEyeLight.position.set(-0.25, 1.5, 0.5);
    
    const rightEyeLight = new THREE.PointLight(0xff0000, 0.5, 3);
    rightEyeLight.position.set(0.25, 1.5, 0.5);
    
    this.group.add(leftEyeLight);
    this.group.add(rightEyeLight);
  }
} 