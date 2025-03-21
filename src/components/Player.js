import * as THREE from 'three';

export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    
    // Player properties
    this.moveSpeed = 5;
    this.turnSpeed = 2;
    this.gravity = -9.8;
    this.jumpForce = 5;
    this.verticalVelocity = 0;
    this.isOnGround = true;
    
    // Combat properties
    this.health = 100;
    this.maxHealth = 100;
    this.damage = 15;
    this.isAttacking = false;
    this.attackCooldown = 0.5; // Time between attacks in seconds
    this.lastAttackTime = 0;
    this.isInvulnerable = false;
    this.invulnerabilityTime = 0.5; // Time in seconds after taking damage that player is invulnerable
    this.lastDamageTime = 0;
    
    // Player state
    this.position = new THREE.Vector3(0, 1, 0);
    this.rotation = new THREE.Euler(0, 0, 0);
    
    this.init();
  }
  
  init() {
    // Create player mesh
    const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x3498db,
      roughness: 0.7,
      metalness: 0.1
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
    
    this.scene.add(this.mesh);
    
    // Add a directional arrow to show which way player is facing
    const arrowGeo = new THREE.ConeGeometry(0.25, 0.7, 8);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.arrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.arrow.position.set(0, 0, 0.8);
    this.arrow.rotation.x = Math.PI / 2;
    this.mesh.add(this.arrow);
  }
  
  update(deltaTime, inputController) {
    // Handle rotation only when not in orbital camera mode
    // Let the camera handle rotation in orbital mode
    // if (inputController.mouseMovement.x !== 0) {
    //   this.rotation.y -= inputController.mouseMovement.x * this.turnSpeed * deltaTime;
    // }
    
    // Reset mouse movement after using it
    // inputController.resetMouseMovement();
    
    // Attack handling
    if (inputController.keys.action) {
      this.startAttack();
    }
    
    // Update attack state
    this.updateAttack(deltaTime);
    
    // Update invulnerability
    this.updateInvulnerability(deltaTime);
    
    // Create a movement direction vector based on input
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (inputController.keys.forward) moveDirection.z -= 1;
    if (inputController.keys.backward) moveDirection.z += 1;
    if (inputController.keys.left) moveDirection.x -= 1;
    if (inputController.keys.right) moveDirection.x += 1;
    
    // Normalize movement vector to prevent faster diagonal movement
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
    }
    
    // Apply rotation to movement direction
    moveDirection.applyEuler(new THREE.Euler(0, this.rotation.y, 0));
    
    // Handle jumping
    if (inputController.keys.jump && this.isOnGround) {
      this.verticalVelocity = this.jumpForce;
      this.isOnGround = false;
    }
    
    // Apply gravity
    this.verticalVelocity += this.gravity * deltaTime;
    
    // Calculate new position
    const newPositionX = this.position.x + moveDirection.x * this.moveSpeed * deltaTime;
    const newPositionZ = this.position.z + moveDirection.z * this.moveSpeed * deltaTime;
    
    // Check terrain height at new position before moving
    const groundHeightAtNewPos = this.world.getHeightAt(newPositionX, newPositionZ);
    const currentGroundHeight = this.world.getHeightAt(this.position.x, this.position.z);
    
    // Only allow movement if the slope isn't too steep (prevent climbing vertical walls)
    const heightDifference = Math.abs(groundHeightAtNewPos - currentGroundHeight);
    const maxClimbableSlope = 2.0; // Maximum height difference the player can climb in one step
    
    if (heightDifference <= maxClimbableSlope || groundHeightAtNewPos < currentGroundHeight) {
      // Update horizontal position
      this.position.x = newPositionX;
      this.position.z = newPositionZ;
    }
    
    // Update position based on vertical velocity
    this.position.y += this.verticalVelocity * deltaTime;
    
    // Ground check
    const groundHeight = this.world.getHeightAt(this.position.x, this.position.z);
    if (this.position.y < groundHeight + 1) {
      this.position.y = groundHeight + 1;
      this.verticalVelocity = 0;
      this.isOnGround = true;
    }
    
    // Update mesh position and rotation
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation.y;
  }
  
  getPosition() {
    return this.position.clone();
  }
  
  getRotation() {
    return this.rotation.clone();
  }
  
  getForwardVector() {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(this.rotation);
    return forward;
  }
  
  setRotation(newRotation) {
    this.rotation.copy(newRotation);
  }
  
  startAttack() {
    if (this.isAttacking || (performance.now() / 1000) - this.lastAttackTime < this.attackCooldown) {
      return; // Still on cooldown
    }
    
    this.isAttacking = true;
    this.lastAttackTime = performance.now() / 1000;
    
    // Play attack animation (swinging motion)
    this.playAttackAnimation();
    
    // Attack nearby enemies
    this.attackNearbyEnemies();
    
    // Reset attack state after animation
    setTimeout(() => {
      this.isAttacking = false;
    }, 300); // Attack animation duration
  }
  
  playAttackAnimation() {
    // Create a weapon swing effect
    const swingGeometry = new THREE.BoxGeometry(0.3, 0.3, 2);
    const swingMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0f0a0,
      transparent: true,
      opacity: 0.7
    });
    
    const swingMesh = new THREE.Mesh(swingGeometry, swingMaterial);
    swingMesh.position.set(0, 0.5, 1);
    this.mesh.add(swingMesh);
    
    // Animate the swing
    let angle = -Math.PI / 4;
    const animateSwing = () => {
      if (angle > Math.PI / 2) {
        this.mesh.remove(swingMesh);
        return;
      }
      
      swingMesh.rotation.y = angle;
      angle += 0.2;
      
      requestAnimationFrame(animateSwing);
    };
    
    animateSwing();
  }
  
  attackNearbyEnemies() {
    // Increased attack range for better gameplay
    const attackRange = 2.5; // Increased from 2.0
    
    // Find all enemies through gameContext
    const enemies = [];
    
    // First try to find enemies from the mesh traversal
    this.scene.traverse(obj => {
      // Check if the object or parent is tagged as an enemy
      if (obj.userData && obj.userData.isEnemy) {
        // If the object has a unit reference, use that
        if (obj.userData.unit) {
          if (!enemies.includes(obj.userData.unit)) {
            enemies.push(obj.userData.unit);
          }
        } else {
          // Otherwise use the object itself if it has the necessary methods
          if (obj.getPosition && typeof obj.takeDamage === 'function') {
            if (!enemies.includes(obj)) {
              enemies.push(obj);
            }
          }
        }
      }
    });
    
    // If we still don't have enemies, try to get them from the game context
    if (enemies.length === 0) {
      // Find a reference to the game context
      let context = null;
      
      // Method 1: Try to find context from the scene's userData
      if (this.scene.userData && this.scene.userData.context) {
        context = this.scene.userData.context;
      }
      
      // Method 2: Check if window.gameContext exists (our global minimal reference)
      if (!context && window.gameContext) {
        context = window.gameContext;
      }
      
      if (context) {
        // Get enemies from context
        const contextEnemies = context.getEnemies();
        if (contextEnemies && contextEnemies.length > 0) {
          console.log("Using enemies from context:", contextEnemies.length);
          enemies.push(...contextEnemies);
        }
      }
    }
    
    console.log(`Found ${enemies.length} potential enemies to attack`);
    
    // Check for enemies within range
    let hitAny = false;
    
    if (enemies.length > 0) {
      enemies.forEach(enemy => {
        // Skip if enemy has no valid position or takeDamage method
        if (!enemy || !enemy.getPosition || typeof enemy.takeDamage !== 'function') {
          console.log("Skipping invalid enemy:", enemy);
          return;
        }
        
        const enemyPosition = enemy.getPosition();
        if (!enemyPosition) {
          console.log("Enemy has invalid position:", enemy);
          return;
        }
        
        const distance = this.position.distanceTo(enemyPosition);
        
        if (distance <= attackRange) {
          // Apply damage with a bit of randomness
          const baseDamage = this.damage;
          const actualDamage = Math.floor(baseDamage * (0.9 + Math.random() * 0.3));
          
          console.log(`Attacking enemy at distance ${distance.toFixed(2)}, dealing ${actualDamage} damage`);
          
          enemy.takeDamage(actualDamage);
          
          // Apply knockback effect
          this.applyKnockback(enemy);
          
          // Show hit effect
          this.showHitEffect(enemyPosition);
          
          hitAny = true;
        }
      });
    } else {
      console.error("No enemies found to attack!", this.scene);
    }
    
    // Provide feedback if hit any enemies
    if (hitAny) {
      // Add screen shake or other feedback here
      console.log("Hit enemies with attack!");
    }
  }
  
  applyKnockback(enemy) {
    if (!enemy || !enemy.velocity) return;
    
    // Calculate direction from player to enemy
    const direction = new THREE.Vector3()
      .subVectors(enemy.getPosition(), this.position)
      .normalize();
    
    // Apply knockback force
    const knockbackForce = 5;
    enemy.velocity.x += direction.x * knockbackForce;
    enemy.velocity.z += direction.z * knockbackForce;
  }
  
  showHitEffect(position) {
    // Create a yellow sphere that expands and fades
    const hitGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const hitMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.7
    });
    
    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
    hitMesh.position.copy(position);
    this.scene.add(hitMesh);
    
    // Animate expansion and fade
    const startTime = performance.now();
    const duration = 500; // milliseconds
    
    const animateHit = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      hitMesh.scale.set(1 + progress * 3, 1 + progress * 3, 1 + progress * 3);
      hitMesh.material.opacity = 0.7 * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(animateHit);
      } else {
        this.scene.remove(hitMesh);
        hitMesh.geometry.dispose();
        hitMesh.material.dispose();
      }
    };
    
    animateHit();
  }
  
  updateAttack(deltaTime) {
    // Nothing needed here for now, attack state is handled with a timer
  }
  
  updateInvulnerability(deltaTime) {
    if (this.isInvulnerable) {
      const now = performance.now() / 1000;
      if (now - this.lastDamageTime > this.invulnerabilityTime) {
        this.isInvulnerable = false;
        
        // Reset mesh to normal appearance
        if (this.mesh.material) {
          this.mesh.material.transparent = false;
          this.mesh.material.opacity = 1.0;
        }
      }
    }
  }
  
  takeDamage(amount) {
    // Check if player is invulnerable
    if (this.isInvulnerable) return;
    
    // Apply damage
    this.health -= amount;
    this.health = Math.max(0, this.health);
    
    // Make player invulnerable briefly
    this.isInvulnerable = true;
    this.lastDamageTime = performance.now() / 1000;
    
    // Visual feedback for taking damage
    if (this.mesh.material) {
      this.mesh.material.transparent = true;
      this.mesh.material.opacity = 0.7;
    }
    
    // Show damage indicator
    this.showDamageIndicator(amount);
    
    // Check if dead
    if (this.health <= 0) {
      this.die();
    }
    
    return this.health;
  }
  
  showDamageIndicator(amount) {
    // Create a floating damage number
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.color = '#FF3030';
    element.style.fontSize = '20px';
    element.style.fontWeight = 'bold';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.textShadow = '2px 2px 4px black';
    element.style.pointerEvents = 'none';
    element.style.transition = 'transform 1s, opacity 1s';
    element.style.opacity = '1';
    element.textContent = `-${amount}`;
    
    // Add to body
    document.body.appendChild(element);
    
    // Position in center of screen (simpler than world-to-screen projection)
    element.style.left = `${window.innerWidth / 2}px`;
    element.style.top = `${window.innerHeight / 2 - 50}px`;
    
    // Add red vignette effect for damage
    const vignette = document.createElement('div');
    vignette.style.position = 'absolute';
    vignette.style.top = '0';
    vignette.style.left = '0';
    vignette.style.width = '100%';
    vignette.style.height = '100%';
    vignette.style.pointerEvents = 'none';
    vignette.style.boxShadow = 'inset 0 0 100px rgba(255, 0, 0, 0.5)';
    vignette.style.transition = 'opacity 0.5s';
    vignette.style.opacity = '0.7';
    vignette.style.zIndex = '1000';
    
    document.body.appendChild(vignette);
    
    // Animate
    setTimeout(() => {
      element.style.transform = 'translateY(-50px)';
      element.style.opacity = '0';
      vignette.style.opacity = '0';
    }, 50);
    
    // Remove after animation
    setTimeout(() => {
      document.body.removeChild(element);
      document.body.removeChild(vignette);
    }, 1050);
  }
  
  die() {
    console.log("Player died!");
    // TODO: Implement death animation and respawn
    
    // For now, just reset health
    setTimeout(() => {
      this.health = this.maxHealth;
      
      // Reset position to a safe spot
      this.position.set(0, 5, 0);
      this.verticalVelocity = 0;
    }, 1000);
  }
  
  heal(amount) {
    this.health += amount;
    this.health = Math.min(this.health, this.maxHealth);
    
    // Show healing indicator
    this.showHealingIndicator(amount);
    
    return this.health;
  }
  
  showHealingIndicator(amount) {
    // Create a floating healing number
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.color = '#30FF30';
    element.style.fontSize = '20px';
    element.style.fontWeight = 'bold';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.textShadow = '2px 2px 4px black';
    element.style.pointerEvents = 'none';
    element.style.transition = 'transform 1s, opacity 1s';
    element.style.opacity = '1';
    element.textContent = `+${amount}`;
    
    // Add to body
    document.body.appendChild(element);
    
    // Position in center of screen
    element.style.left = `${window.innerWidth / 2}px`;
    element.style.top = `${window.innerHeight / 2 - 50}px`;
    
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
} 