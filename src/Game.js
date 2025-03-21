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
    this.isPaused = false;
    this.helpVisible = false;
    this.minimapVisible = true;
    
    // UI elements
    this.pauseOverlay = null;
    this.helpOverlay = null;
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
    this.context.world = new World(this.context.scene, this.context);
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
    
    // Setup input listeners
    this.setupInputListeners();
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
    // Get current timestamp in seconds
    const currentTime = performance.now() / 1000;
    
    // Calculate elapsed time since last frame
    const deltaTime = Math.min(0.1, currentTime - this.previousTime);
    this.previousTime = currentTime;
    
    // Skip updates if game is paused, but keep the loop running
    if (this.isPaused) {
      requestAnimationFrame(() => this.gameLoop());
      return;
    }
    
    // Update physics first (if it exists)
    if (this.context.systems.physics) {
      this.context.systems.physics.update(deltaTime);
    }
    
    // Update input controller
    if (this.context.inputController) {
      this.context.inputController.update(deltaTime);
      
      // Apply camera zoom from mouse wheel
      const zoomDelta = this.context.inputController.getMouseWheelDelta();
      if (zoomDelta && this.context.camera && this.context.camera.setZoomDelta) {
        this.context.camera.setZoomDelta(zoomDelta);
      }
    }
    
    // Update camera - Note: Camera needs to get mouse movement before player
    if (this.context.camera) {
      if (this.context.inputController) {
        const mouseMovement = this.context.inputController.getMouseMovement();
        if (mouseMovement && this.context.camera.onMouseMove) {
          this.context.camera.onMouseMove(mouseMovement.x, mouseMovement.y);
        }
      }
      this.context.camera.update(deltaTime);
    }

    // Update player
    if (this.context.player) {
      this.context.player.update(deltaTime);
    }
    
    // Reset mouse movement after camera and player updates
    if (this.context.inputController) {
      this.context.inputController.resetMouseMovement();
    }
    
    // Update world
    if (this.context.world) {
      this.context.world.update(deltaTime);
    }
    
    // Update units
    try {
      if (this.context.systems.units) {
        this.context.systems.units.update(deltaTime);
      }
    } catch (error) {
      console.error("Error updating units:", error);
    }
    
    // Update enemies
    try {
      if (this.context.systems.enemy) {
        this.context.systems.enemy.update(deltaTime);
      }
    } catch (error) {
      console.error("Error updating enemies:", error);
    }
    
    // Check for interactions
    this.checkInteractions();
    
    // Render the scene
    if (this.context.renderer && this.context.scene && this.context.camera) {
      this.context.renderer.render(this.context.scene, this.context.camera.camera);
    }
    
    // Render minimap
    if (this.context.minimap && this.minimapVisible) {
      this.context.minimap.update();
    }
    
    // Continue the loop
    requestAnimationFrame(() => this.gameLoop());
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

  setupInputListeners() {
    document.addEventListener('keydown', (event) => {
      // Pass event to input controller
      if (this.context.inputController) {
        this.context.inputController.handleKeyDown(event);
      }
      
      // Specific game controls
      switch (event.key) {
        case 'p':
          this.togglePause();
          break;
        case 'o':
          // Toggle physics debug mode
          if (this.context.systems && this.context.systems.physics) {
            const isDebugOn = this.context.systems.physics.toggleDebug();
            console.log(`Physics debug mode: ${isDebugOn ? 'ON' : 'OFF'}`);
          }
          break;
        case 'm':
          this.toggleMinimap();
          break;
        case 'h':
          this.toggleHelp();
          break;
        case 'u':
          // Toggle unit menu 
          if (this.context.systems && this.context.systems.units) {
            this.context.systems.units.toggleMenu();
          }
          break;
        // Add other game-specific shortcuts here
      }
    });
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    
    // Create or remove pause screen
    if (this.isPaused) {
      // Create pause overlay if it doesn't exist
      if (!this.pauseOverlay) {
        this.pauseOverlay = document.createElement('div');
        this.pauseOverlay.style.position = 'absolute';
        this.pauseOverlay.style.top = '0';
        this.pauseOverlay.style.left = '0';
        this.pauseOverlay.style.width = '100%';
        this.pauseOverlay.style.height = '100%';
        this.pauseOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.pauseOverlay.style.color = 'white';
        this.pauseOverlay.style.display = 'flex';
        this.pauseOverlay.style.flexDirection = 'column';
        this.pauseOverlay.style.justifyContent = 'center';
        this.pauseOverlay.style.alignItems = 'center';
        this.pauseOverlay.style.zIndex = '1000';
        this.pauseOverlay.style.fontFamily = 'Arial, sans-serif';
        
        const title = document.createElement('h1');
        title.textContent = 'PAUSED';
        title.style.marginBottom = '20px';
        
        const instructions = document.createElement('p');
        instructions.textContent = 'Press P to resume';
        
        this.pauseOverlay.appendChild(title);
        this.pauseOverlay.appendChild(instructions);
      }
      
      document.body.appendChild(this.pauseOverlay);
    } else {
      // Remove pause overlay
      if (this.pauseOverlay && this.pauseOverlay.parentNode) {
        this.pauseOverlay.parentNode.removeChild(this.pauseOverlay);
      }
    }
    
    console.log(`Game ${this.isPaused ? 'paused' : 'resumed'}`);
  }
  
  toggleMinimap() {
    if (!this.context.minimap) return;
    
    this.minimapVisible = !this.minimapVisible;
    
    // Toggle minimap visibility
    if (this.context.minimap.domElement) {
      this.context.minimap.domElement.style.display = 
        this.minimapVisible ? 'block' : 'none';
    }
    
    console.log(`Minimap ${this.minimapVisible ? 'shown' : 'hidden'}`);
  }
  
  toggleHelp() {
    this.helpVisible = !this.helpVisible;
    
    // Create or remove help screen
    if (this.helpVisible) {
      // Create help overlay if it doesn't exist
      if (!this.helpOverlay) {
        this.helpOverlay = document.createElement('div');
        this.helpOverlay.style.position = 'absolute';
        this.helpOverlay.style.top = '50%';
        this.helpOverlay.style.left = '50%';
        this.helpOverlay.style.transform = 'translate(-50%, -50%)';
        this.helpOverlay.style.width = '600px';
        this.helpOverlay.style.padding = '20px';
        this.helpOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.helpOverlay.style.color = 'white';
        this.helpOverlay.style.borderRadius = '10px';
        this.helpOverlay.style.zIndex = '1000';
        this.helpOverlay.style.fontFamily = 'Arial, sans-serif';
        
        const title = document.createElement('h2');
        title.textContent = 'Help & Controls';
        title.style.marginBottom = '15px';
        title.style.borderBottom = '1px solid white';
        title.style.paddingBottom = '10px';
        this.helpOverlay.appendChild(title);
        
        // Add control information
        const controlsList = [
          { key: 'WASD', desc: 'Move character' },
          { key: 'Mouse', desc: 'Look around' },
          { key: 'Click', desc: 'Attack / Interact' },
          { key: 'E', desc: 'Interact with objects' },
          { key: 'Space', desc: 'Jump' },
          { key: 'Shift', desc: 'Sprint' },
          { key: 'U', desc: 'Toggle unit menu' },
          { key: 'M', desc: 'Toggle minimap' },
          { key: 'P', desc: 'Pause game' },
          { key: 'O', desc: 'Toggle physics debug view' },
          { key: 'H', desc: 'Toggle this help screen' },
          { key: '1-5', desc: 'Select different animal units' }
        ];
        
        // Create controls table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        
        // Add controls to table
        controlsList.forEach(control => {
          const row = document.createElement('tr');
          
          const keyCell = document.createElement('td');
          keyCell.style.padding = '8px';
          keyCell.style.fontWeight = 'bold';
          keyCell.style.width = '80px';
          keyCell.textContent = control.key;
          
          const descCell = document.createElement('td');
          descCell.style.padding = '8px';
          descCell.textContent = control.desc;
          
          row.appendChild(keyCell);
          row.appendChild(descCell);
          table.appendChild(row);
        });
        
        this.helpOverlay.appendChild(table);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.marginTop = '20px';
        closeBtn.style.padding = '8px 16px';
        closeBtn.style.backgroundColor = '#444';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => this.toggleHelp();
        
        this.helpOverlay.appendChild(closeBtn);
      }
      
      document.body.appendChild(this.helpOverlay);
    } else {
      // Remove help overlay
      if (this.helpOverlay && this.helpOverlay.parentNode) {
        this.helpOverlay.parentNode.removeChild(this.helpOverlay);
      }
    }
    
    console.log(`Help screen ${this.helpVisible ? 'shown' : 'hidden'}`);
  }

  checkInteractions() {
    // Check if player is trying to interact with something
    if (this.context.inputController && 
        this.context.inputController.isActionPressed &&
        this.context.inputController.isActionPressed() &&
        this.context.player &&
        this.context.world) {
      
      // Get player position and check for nearby interactive objects
      const playerPos = this.context.player.getPosition();
      const interactionRange = 2.5; // How far the player can interact
      
      const interactiveObject = this.context.world.checkInteraction(
        playerPos, 
        interactionRange
      );
      
      // Handle interaction if an object was found
      if (interactiveObject) {
        try {
          // Trigger the interaction
          const reward = interactiveObject.interact();
          
          // Add rewards to inventory if applicable
          if (reward && this.context.systems.inventory) {
            this.context.systems.inventory.addItem(reward.type, reward.amount);
            
            // Show feedback to the player
            console.log(`Received ${reward.amount} ${reward.type}`);
            this.showNotification(`Received ${reward.amount} ${reward.type}!`);
          }
        } catch (error) {
          console.error("Error during interaction:", error);
        }
      }
    }
  }
  
  showNotification(message, duration = 2000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.position = 'absolute';
    notification.style.bottom = '50px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.zIndex = '1000';
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after specified duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }
} 