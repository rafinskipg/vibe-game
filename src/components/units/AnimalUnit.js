import * as THREE from 'three';

export class AnimalUnit {
  constructor(scene, player, world, type, position, attributes) {
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.type = type;
    this.position = position.clone();
    
    // Make sure attributes is defined
    this.attributes = attributes || {};
    
    // Set default values for missing attributes
    const defaultAttributes = {
      health: 100,
      damage: 10,
      speed: 5,
      vision: 20,
      color: 0x888888,
      attackRange: 2
    };
    
    // Copy attributes from provided or use defaults
    this.health = this.attributes.health || defaultAttributes.health;
    this.maxHealth = this.health;
    this.damage = this.attributes.damage || defaultAttributes.damage;
    this.speed = this.attributes.speed || defaultAttributes.speed;
    this.vision = this.attributes.vision || defaultAttributes.vision;
    this.color = this.attributes.color || defaultAttributes.color;
    this.attackRange = this.attributes.attackRange || defaultAttributes.attackRange;
    
    console.log(`Created ${type} unit with health=${this.health}, speed=${this.speed}`);
    
    // Movement and behavior
    this.velocity = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0);
    this.state = 'wandering'; // Start with wandering instead of seeking
    this.target = null;
    this.pathfindingTimer = 0;
    this.pathfindingInterval = 1; // seconds between pathfinding updates
    this.wanderTimer = 0;
    this.wanderDuration = 5; // seconds to wander before changing direction
    this.wanderPoint = null;
    this.wanderRadius = 30; // distance to wander (increased from 15)
    this.stuckCheckTimer = 0;
    this.lastPosition = position.clone();
    this.stuckThreshold = 3; // seconds to consider unit stuck
    
    // Create mesh/model
    try {
      this.createModel();
      
      // Mark as unit for identification
      if (this.mesh) {
        this.mesh.userData.isUnit = true;
        this.mesh.userData.unitRef = this;
      }
      
      // Set an initial wander point right away
      this.setRandomWanderPoint();
    } catch (error) {
      console.error(`Error creating unit ${type}:`, error);
    }
  }
  
  createModel() {
    // Create a simple animal model based on type
    let geometry;
    
    switch (this.type) {
      case 'wolf':
        geometry = new THREE.CylinderGeometry(0, 0.5, 1.5, 4);
        break;
      case 'bear':
        geometry = new THREE.BoxGeometry(1.2, 1.2, 1.8);
        break;
      case 'eagle':
        geometry = new THREE.ConeGeometry(0.3, 1, 8);
        break;
      case 'fox':
        geometry = new THREE.CylinderGeometry(0, 0.4, 1.2, 4);
        break;
      case 'deer':
        geometry = new THREE.CylinderGeometry(0, 0.4, 1.6, 4);
        break;
      default:
        geometry = new THREE.SphereGeometry(0.5, 8, 8);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.7,
      metalness: 0.1
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Add to scene
    this.scene.add(this.mesh);
    
    // Update position
    this.updatePosition();
    
    // Add a health bar
    this.createHealthBar();
  }
  
  createHealthBar() {
    // Create a health bar container
    this.healthBarContainer = new THREE.Group();
    
    // Background bar
    const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
    this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    
    // Health bar
    const barGeometry = new THREE.PlaneGeometry(1, 0.1);
    const barMaterial = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
    this.healthBar = new THREE.Mesh(barGeometry, barMaterial);
    this.healthBar.position.z = 0.01; // Slightly in front of background
    
    // Add bars to container
    this.healthBarContainer.add(this.healthBarBg);
    this.healthBarContainer.add(this.healthBar);
    
    // Position above the animal
    this.healthBarContainer.position.y = 2;
    this.healthBarContainer.rotation.x = -Math.PI / 2; // Make it face upward
    
    // Add to mesh
    this.mesh.add(this.healthBarContainer);
    
    // Update health bar
    this.updateHealthBar();
  }
  
  updateHealthBar() {
    const healthPercent = this.health / this.maxHealth;
    this.healthBar.scale.x = Math.max(0, healthPercent);
    this.healthBar.position.x = (healthPercent - 1) / 2;
    
    // Update color based on health
    if (healthPercent > 0.6) {
      this.healthBar.material.color.set(0x44ff44); // Green
    } else if (healthPercent > 0.3) {
      this.healthBar.material.color.set(0xffff44); // Yellow
    } else {
      this.healthBar.material.color.set(0xff4444); // Red
    }
  }
  
  update(deltaTime) {
    // Update stuck check timer
    this.stuckCheckTimer += deltaTime;
    if (this.stuckCheckTimer >= 1) { // Check every second
      this.checkIfStuck();
      this.stuckCheckTimer = 0;
    }

    // State machine for behavior
    switch (this.state) {
      case 'seeking':
        this.updateSeeking(deltaTime);
        break;
      case 'attacking':
        this.updateAttacking(deltaTime);
        break;
      case 'wandering':
        this.updateWandering(deltaTime);
        break;
    }
    
    // Update position
    this.updatePosition();
    
    // Look for enemies
    this.pathfindingTimer += deltaTime;
    if (this.pathfindingTimer >= this.pathfindingInterval) {
      this.pathfindingTimer = 0;
      this.findNearbyEnemies();
    }
  }
  
  checkIfStuck() {
    // If we haven't moved significantly in the last check interval, we might be stuck
    const distanceMoved = this.position.distanceTo(this.lastPosition);
    if (distanceMoved < 0.1 && this.state !== 'attacking') {
      // If stuck, pick a new random direction
      if (this.state === 'wandering') {
        this.setRandomWanderPoint();
      } else if (this.state === 'seeking') {
        // If we're stuck while seeking, try wandering for a bit
        this.state = 'wandering';
        this.setRandomWanderPoint();
      }
    }
    
    // Update last position
    this.lastPosition.copy(this.position);
  }
  
  updateSeeking(deltaTime) {
    // If we have a target, attack it
    if (this.target && !this.target.isDead()) {
      this.state = 'attacking';
      return;
    }
    
    // No target, look for one
    this.findNearbyEnemies();
    
    // If still no target, wander
    if (!this.target) {
      this.state = 'wandering';
      this.setRandomWanderPoint();
      return;
    }
  }
  
  updateWandering(deltaTime) {
    // If no wander point, set one
    if (!this.wanderPoint) {
      this.setRandomWanderPoint();
    }
    
    // Increment timer
    this.wanderTimer += deltaTime;
    
    // Change direction after wanderDuration
    if (this.wanderTimer >= this.wanderDuration) {
      this.wanderTimer = 0;
      this.setRandomWanderPoint();
    }
    
    // Move toward wander point
    const direction = new THREE.Vector3().subVectors(this.wanderPoint, this.position);
    const distance = direction.length();
    
    // If close enough to wander point, set a new one
    if (distance < 1) {
      this.wanderTimer = 0;
      this.setRandomWanderPoint();
      return;
    }
    
    // Move toward wander point - only if we have a valid direction
    if (direction.length() > 0.01) {
      direction.normalize();
      // Scale movement speed by deltaTime to ensure consistent movement regardless of frame rate
      const moveSpeed = this.speed * deltaTime;
      this.velocity.copy(direction).multiplyScalar(moveSpeed);
      this.position.add(this.velocity);
      
      // Rotate to face movement direction
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.rotation.y = targetRotation;
      
      // Adjust height based on terrain
      try {
        if (this.world && typeof this.world.getHeightAt === 'function') {
          this.position.y = this.world.getHeightAt(this.position.x, this.position.z) + 0.5;
        }
      } catch (error) {
        // Keep existing height on error
        console.error("Error adjusting height:", error);
      }
      
      // Occasional logging to monitor movement
      if (Math.random() < 0.01) { // Log only occasionally to avoid spam
        console.log(`${this.type} unit moving: pos=${this.position.x.toFixed(2)},${this.position.z.toFixed(2)} vel=${this.velocity.length().toFixed(2)}`);
      }
    }
  }
  
  updateAttacking(deltaTime) {
    // Safely check if target exists and isn't dead
    let targetIsDead = true;
    
    if (this.target) {
      try {
        if (typeof this.target.isDead === 'function') {
          targetIsDead = this.target.isDead();
        } else {
          // If there's no isDead function, assume the target is still valid
          targetIsDead = false;
        }
      } catch (error) {
        console.error("Error checking if target is dead:", error);
        // Assume dead on error
        targetIsDead = true;
      }
    }
    
    // Check if target still exists
    if (!this.target || targetIsDead) {
      this.target = null;
      this.state = 'wandering';
      this.wanderTimer = 0;
      return;
    }
    
    // Move toward target - safely get position
    let targetPosition;
    try {
      if (typeof this.target.getPosition === 'function') {
        targetPosition = this.target.getPosition();
      } else {
        // If we can't get position, switch to wandering
        this.target = null;
        this.state = 'wandering';
        this.wanderTimer = 0;
        return;
      }
    } catch (error) {
      console.error("Error getting target position:", error);
      this.target = null;
      this.state = 'wandering';
      this.wanderTimer = 0;
      return;
    }
    
    const direction = new THREE.Vector3().subVectors(targetPosition, this.position);
    const distance = direction.length();
    
    // Attack if close enough
    if (distance < 2) {
      // Do damage - safely
      try {
        if (typeof this.target.takeDamage === 'function') {
          this.target.takeDamage(this.damage * deltaTime);
        }
      } catch (error) {
        console.error("Error damaging target:", error);
      }
      
      // Face the target
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.rotation.y = targetRotation;
    } else {
      // Move toward target
      direction.normalize();
      this.velocity.copy(direction).multiplyScalar(this.speed * deltaTime);
      this.position.add(this.velocity);
      
      // Rotate to face movement direction
      if (direction.length() > 0.1) {
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.rotation.y = targetRotation;
      }
      
      // Adjust height based on terrain - safely
      try {
        if (this.world && typeof this.world.getHeightAt === 'function') {
          this.position.y = this.world.getHeightAt(this.position.x, this.position.z) + 0.5;
        }
      } catch (error) {
        // Keep existing height on error
        console.error("Error adjusting height:", error);
      }
    }
  }
  
  findNearbyEnemies() {
    console.log(`${this.type} unit looking for enemies (state: ${this.state})`);
    
    // Look for enemies in the context
    let enemies = [];
    
    // First try to get enemies from the context
    if (this.scene.userData && this.scene.userData.context) {
      enemies = this.scene.userData.context.getEnemies() || [];
    } else if (window.gameContext) {
      enemies = window.gameContext.getEnemies() || [];
    }
    
    // If no enemies found through context, try finding enemies in the scene
    if (!enemies || enemies.length === 0) {
      console.log("No enemies found via context, searching scene...");
      // Create a new array for scene enemies
      enemies = [];
      
      // Fallback to searching for enemies in the scene
      this.scene.traverse(object => {
        if (object.userData && object.userData.isEnemy) {
          const enemy = object.userData.enemyRef;
          // Only add enemy if it exists and has the required methods
          if (enemy && typeof enemy.getPosition === 'function') {
            // Check if isDead exists and is a function before adding
            if (typeof enemy.isDead === 'function') {
              if (!enemy.isDead()) {
                enemies.push(enemy);
              }
            } else {
              // If no isDead method, add it anyway and we'll handle it later
              enemies.push(enemy);
            }
          }
        }
      });
    }

    console.log(`Found ${enemies.length} potential enemies`);

    if (enemies.length > 0) {
      // Find the closest enemy
      let closestEnemy = null;
      let closestDistance = Infinity;
      
      for (const enemy of enemies) {
        if (!enemy) continue;
        
        // Safely check if the enemy is dead
        let isDead = false;
        try {
          if (typeof enemy.isDead === 'function') {
            isDead = enemy.isDead();
          }
        } catch (error) {
          console.error("Error checking if enemy is dead:", error);
          continue; // Skip this enemy
        }
        
        // Skip dead enemies
        if (isDead) continue;
        
        // Skip enemies without getPosition method
        if (typeof enemy.getPosition !== 'function') continue;
        
        try {
          const enemyPos = enemy.getPosition();
          if (!enemyPos) continue;
          
          const distance = this.position.distanceTo(enemyPos);
          
          if (distance < this.vision && distance < closestDistance) {
            closestEnemy = enemy;
            closestDistance = distance;
          }
        } catch (error) {
          console.error("Error getting enemy position:", error);
        }
      }
      
      if (closestEnemy) {
        console.log(`${this.type} unit found target at distance ${closestDistance.toFixed(2)}`);
        this.target = closestEnemy;
        this.state = 'attacking';
        return;
      }
    }
    
    // No enemies found, or all out of range
    if (this.state !== 'wandering') {
      console.log(`${this.type} unit switching to wandering`);
      this.state = 'wandering';
      this.setRandomWanderPoint();
    }
  }
  
  setRandomWanderPoint() {
    // Get a random point within wander radius
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * (this.wanderRadius - 5); // Ensure some minimum distance
    
    this.wanderPoint = new THREE.Vector3(
      this.position.x + Math.sin(angle) * radius,
      0, // Will be adjusted for terrain
      this.position.z + Math.cos(angle) * radius
    );
    
    // Adjust height based on terrain
    try {
      if (this.world && typeof this.world.getHeightAt === 'function') {
        this.wanderPoint.y = this.world.getHeightAt(this.wanderPoint.x, this.wanderPoint.z) + 0.5;
      } else {
        console.warn("World or getHeightAt function not available");
        this.wanderPoint.y = 0.5; // Default height if terrain info not available
      }
      console.log(`${this.type} unit set wander point to:`, this.wanderPoint);
    } catch (error) {
      console.error("Error setting wander point height:", error);
      this.wanderPoint.y = 0.5; // Default height on error
    }
  }
  
  updatePosition() {
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.copy(this.rotation);
    }
  }
  
  takeDamage(amount) {
    this.health -= amount;
    this.updateHealthBar();
    
    // Check if dead
    if (this.health <= 0) {
      this.health = 0;
      // We'll let the UnitSystem handle removing dead units
    }
  }
  
  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.updateHealthBar();
  }
  
  isDead() {
    return this.health <= 0;
  }
  
  getPosition() {
    return this.position.clone();
  }
  
  dispose() {
    // Remove from scene
    if (this.mesh) {
      this.scene.remove(this.mesh);
      
      // Clean up geometry and materials
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(material => material.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
    }
  }
} 