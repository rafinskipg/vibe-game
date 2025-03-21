import * as THREE from 'three';
import { World } from './components/World.js';
import { Player } from './components/Player.js';
import { ThirdPersonCamera } from './components/ThirdPersonCamera.js';
import { InputController } from './systems/InputController.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { UnitSystem } from './systems/UnitSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { Minimap } from './components/Minimap.js';
import { GameContext } from './core/GameContext.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';

export class Game {
  constructor() {
    // Create the game context
    this.context = new GameContext();
    
    // Initialize core Three.js components
    this.context.renderer = null;
    this.context.scene = null;
    this.context.clock = null;
    
    // Game state
    this.isRunning = false;
    this.previousTime = 0;
  }
  
  init() {
    // Create renderer
    this.context.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.context.renderer.setSize(window.innerWidth, window.innerHeight);
    this.context.renderer.shadowMap.enabled = true;
    this.context.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.context.renderer.domElement);
    
    // Create scene
    this.context.scene = new THREE.Scene();
    this.context.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.context.scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);
    
    // Add a reference to the context in the scene's userData for easy access
    this.context.scene.userData.context = this.context;
    
    // Create clock for timing
    this.context.clock = new THREE.Clock();
    
    // Set up input controller
    this.context.registerSystem('input', new InputController());
    
    // Set up physics system
    this.context.registerSystem('physics', new PhysicsSystem());
    
    // Set up world
    this.context.world = new World(this.context.scene);
    this.context.world.generate();
    
    // Set up player
    this.context.player = new Player(this.context.scene, this.context.world);
    
    // Create objective - IMPORTANT to do this before initializing other systems
    this.createObjective();
    
    // Set up camera
    this.context.camera = new ThirdPersonCamera(
      this.context.player, 
      this.context.renderer,
      {
        distance: 10,
        height: 5
      }
    );
    
    // Set camera's name for raycasting
    this.context.camera.getCamera().name = 'camera';
    
    // Initialize all game systems in the correct order
    this.initSystems();
    
    // Register camera mode toggle callback
    this.context.systems.input.onCameraModeToggle(() => {
      this.context.camera.toggleMode();
    });
    
    // Register camera rotation toggle callback
    this.context.systems.input.onCameraRotationToggle(() => {
      this.context.camera.toggleAlwaysRotateWithMouse();
    });
    
    // Register a callback for toggling player alignment (adding a T key for this)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT') {
        this.context.camera.togglePlayerAlignment();
        console.log("Player alignment with camera:", this.context.camera.alignPlayerWithCamera ? "ON" : "OFF");
      }
    });
    
    // Set up minimap with context
    this.context.minimap = new Minimap(
      this.context,
      {
        size: 200,
        // Bottom right corner
        position: new THREE.Vector3(window.innerWidth - 220, window.innerHeight - 380, 0),
        viewRadius: 50
      }
    );
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(), false);
    
    // Initialize inventory UI
    this.context.systems.inventory.initUI();
    
    // Add starting resources to player inventory
    this.addStartingResources();
    
    // Connect UnitSystem to InventorySystem
    this.connectUnitSystemToInventory();
  }
  
  createObjective() {
    // Create the objective structure that enemies will target
    const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.5, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3498db,
      roughness: 0.7,
      metalness: 0.3
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    
    // Position near the player's starting point
    const position = new THREE.Vector3(5, 0, 5);
    position.y = this.context.world.getHeightAt(position.x, position.z);
    base.position.copy(position);
    base.position.y += 0.25;
    
    // Add a middle section
    const middleGeometry = new THREE.CylinderGeometry(1.5, 2, 3, 16);
    const middleMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2980b9,
      roughness: 0.6,
      metalness: 0.4
    });
    const middle = new THREE.Mesh(middleGeometry, middleMaterial);
    middle.position.y = 2;
    base.add(middle);
    
    // Add a top crystal
    const crystalGeometry = new THREE.OctahedronGeometry(1.5, 0);
    const crystalMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1abc9c,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x16a085,
      emissiveIntensity: 0.5
    });
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.y = 4;
    crystal.rotation.y = Math.PI / 4;
    base.add(crystal);
    
    // Add a point light to make it glow
    const light = new THREE.PointLight(0x1abc9c, 1, 10);
    light.position.y = 4;
    base.add(light);
    
    // Health bar for objective
    const healthBarWidth = 4;
    const healthBarGeometry = new THREE.PlaneGeometry(healthBarWidth, 0.3);
    const healthBarBgMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x333333,
      side: THREE.DoubleSide
    });
    const healthBarMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x44ff44,
      side: THREE.DoubleSide
    });
    
    const healthBarBg = new THREE.Mesh(healthBarGeometry, healthBarBgMaterial);
    healthBarBg.position.y = 6;
    base.add(healthBarBg);
    
    const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
    healthBar.position.y = 6;
    healthBar.position.z = 0.01;
    base.add(healthBar);
    
    // Add to scene
    this.context.scene.add(base);
    
    // Create objective object with properties
    this.context.objective = {
      mesh: base,
      position: position,
      health: 1000,
      maxHealth: 1000,
      healthBar: healthBar,
      healthBarWidth: healthBarWidth,
      
      takeDamage: (amount) => {
        this.context.objective.health -= amount;
        this.context.objective.health = Math.max(0, this.context.objective.health);
        
        // Update health bar
        const healthPercent = this.context.objective.health / this.context.objective.maxHealth;
        this.context.objective.healthBar.scale.x = healthPercent;
        this.context.objective.healthBar.position.x = -(this.context.objective.healthBarWidth * (1 - healthPercent)) / 2;
        
        // Update color based on health
        if (healthPercent > 0.6) {
          this.context.objective.healthBar.material.color.set(0x44ff44); // Green
        } else if (healthPercent > 0.3) {
          this.context.objective.healthBar.material.color.set(0xffff44); // Yellow
        } else {
          this.context.objective.healthBar.material.color.set(0xff4444); // Red
        }
        
        // Show damage indicator
        this.showDamageNumber(amount, this.context.objective.position.clone().add(new THREE.Vector3(0, 3, 0)));
        
        // Check if objective is destroyed
        if (this.context.objective.health <= 0) {
          this.objectiveDestroyed();
        }
        
        return this.context.objective.health;
      },
      
      getPosition: function() {
        return this.position;
      },
      
      isDestroyed: () => {
        return this.context.objective.health <= 0;
      },
      
      // Add isDead method to match expected interface
      isDead: function() {
        return this.health <= 0;
      }
    };
    
    // Emit an event that the objective was created
    this.context.events.emit('objectiveCreated', this.context.objective);
    
    // Add pulse animation
    const pulseAnimation = () => {
      if (!this.context.objective) return;
      
      const scale = 1 + Math.sin(Date.now() / 500) * 0.05;
      crystal.scale.set(scale, scale, scale);
      
      const intensity = 1 + Math.sin(Date.now() / 700) * 0.3;
      light.intensity = intensity;
      
      requestAnimationFrame(pulseAnimation);
    };
    
    pulseAnimation();
    
    console.log("Objective created:", this.context.objective);
  }
  
  showDamageNumber(amount, position) {
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
    
    // Convert 3D position to screen coordinates
    const camera = this.context.camera.getCamera();
    const vector = position.clone().project(camera);
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    
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
  
  objectiveDestroyed() {
    // Handle game over
    console.log("Objective destroyed! Game over!");
    
    // Show game over message
    const gameOver = document.createElement('div');
    gameOver.style.position = 'absolute';
    gameOver.style.top = '50%';
    gameOver.style.left = '50%';
    gameOver.style.transform = 'translate(-50%, -50%)';
    gameOver.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOver.style.color = 'red';
    gameOver.style.padding = '30px';
    gameOver.style.borderRadius = '10px';
    gameOver.style.fontFamily = 'Arial, sans-serif';
    gameOver.style.fontSize = '36px';
    gameOver.style.fontWeight = 'bold';
    gameOver.style.textAlign = 'center';
    gameOver.style.zIndex = '1000';
    gameOver.innerHTML = `GAME OVER<br><span style="font-size: 20px; color: white; margin-top: 10px; display: block;">Your objective was destroyed!</span>`;
    
    document.body.appendChild(gameOver);
  }
  
  addStartingResources() {
    // Add initial wood and stone to make the game more playable from the start
    this.context.systems.inventory.addItem('wood', 25);
    this.context.systems.inventory.addItem('stone', 15);
    
    // Show a welcome message with info about resources
    this.showWelcomeMessage();
  }
  
  showWelcomeMessage() {
    // Create welcome message element
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = '50%';
    element.style.left = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    element.style.color = 'white';
    element.style.padding = '20px';
    element.style.borderRadius = '10px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.fontSize = '18px';
    element.style.textAlign = 'center';
    element.style.zIndex = '1000';
    element.style.maxWidth = '500px';
    element.style.lineHeight = '1.5';
    element.style.pointerEvents = 'none';
    element.style.transition = 'opacity 0.5s';
    element.style.opacity = '0';
    
    element.innerHTML = `<h2 style="color: #3498db; margin-top: 0;">Welcome to Vibe Game!</h2>
                        <p>Defend yourself against waves of enemies coming from the red tower!</p>
                        <p>You've been given <span style="color: #e67e22;">25 wood</span> and <span style="color: #95a5a6;">15 stone</span> to help you get started.</p>
                        <p>Press <span style="color: #f39c12;">E</span> to attack enemies and <span style="color: #f39c12;">Q</span> to deploy animal companions to help you fight.</p>`;
    
    document.body.appendChild(element);
    
    // Animate in
    setTimeout(() => {
      element.style.opacity = '1';
    }, 500);
    
    // Animate out and remove
    setTimeout(() => {
      element.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(element);
      }, 500);
    }, 8000);
  }
  
  connectUnitSystemToInventory() {
    // Override the UnitSystem's resource check and deduction to use our inventory
    const unitSystem = this.context.systems.unit;
    const inventorySystem = this.context.systems.inventory;
    
    unitSystem.checkCost = (cost) => {
      return inventorySystem.getItemCount('wood') >= cost;
    };
    
    unitSystem.deductResources = (cost) => {
      return inventorySystem.removeItem('wood', cost);
    };
  }
  
  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.previousTime = this.context.clock.getElapsedTime();
      this.context.renderer.setAnimationLoop(() => this.gameLoop());
    }
  }
  
  stop() {
    if (this.isRunning) {
      this.isRunning = false;
      this.context.renderer.setAnimationLoop(null);
    }
  }
  
  gameLoop() {
    // Calculate delta time
    const currentTime = this.context.clock.getElapsedTime();
    const deltaTime = currentTime - this.previousTime;
    this.previousTime = currentTime;
    
    try {
      // Update physics system first
      if (this.context.systems.physics) {
        this.context.systems.physics.update(deltaTime);
      }
      
      // Update input controller
      this.context.systems.input.update(deltaTime);
      
      // Apply camera zoom from mouse wheel
      const wheelDelta = this.context.systems.input.resetWheelDelta();
      if (wheelDelta !== 0) {
        this.context.camera.zoom(wheelDelta);
      }
      
      // Update camera first to ensure it gets mouse movement before the player
      this.context.camera.update(deltaTime, this.context.systems.input);
      
      // Update game components (player after camera so camera gets first use of mouse movement)
      this.context.player.update(deltaTime, this.context.systems.input);
      
      // Reset mouse movement after both camera and player have used it
      this.context.systems.input.resetMouseMovement();
      
      this.context.world.update(deltaTime, this.context.player);
      
      // Update animal units with error handling
      try {
        if (this.context.systems.unit) {
          this.context.systems.unit.update(deltaTime);
        }
      } catch (error) {
        console.error("Error updating units:", error);
      }
      
      // Update enemy system with error handling
      try {
        if (this.context.systems.enemy) {
          this.context.systems.enemy.update(deltaTime);
        }
      } catch (error) {
        console.error("Error updating enemies:", error);
      }
      
      // Check for interactions
      if (this.context.systems.input.isActionPressed()) {
        const interactedObject = this.context.world.checkInteraction(this.context.player.getPosition(), 2);
        if (interactedObject) {
          const reward = interactedObject.interact();
          if (reward) {
            this.context.systems.inventory.addItem(reward.type, reward.amount);
          }
        }
      }
      
      // Render main scene
      this.context.renderer.render(this.context.scene, this.context.camera.getCamera());
      
      // Update and render minimap
      this.context.minimap.update();
    } catch (error) {
      console.error("Error in game loop:", error);
      // Continue with the next frame even if this one had an error
    }
  }
  
  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.context.camera.getCamera().aspect = width / height;
    this.context.camera.getCamera().updateProjectionMatrix();
    
    this.context.renderer.setSize(width, height);
  }

  initSystems() {
    // Resource system
    this.context.registerSystem('inventory', new InventorySystem(this.context.player));
    
    // Unit system
    this.context.registerSystem('unit', new UnitSystem(
      this.context,
      this.context.scene, 
      this.context.player, 
      this.context.world,
      this.context.camera,  // Pass camera for unit placement
      this.context.systems.inventory  // Pass inventory system
    ));
    
    // Enemy system - passing context
    this.context.registerSystem('enemy', new EnemySystem(
      this.context,
      this.context.scene, 
      this.context.player, 
      this.context.world,
      this.context.systems.inventory
    ));
    
    console.log("Game systems initialized with context");
  }
} 