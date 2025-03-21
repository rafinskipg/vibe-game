import * as THREE from 'three';
import { AnimalUnit } from '../components/units/AnimalUnit.js';

export class UnitSystem {
  constructor(context, scene, player, world, camera, inventorySystem) {
    this.context = context;
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.camera = camera;
    this.inventorySystem = inventorySystem;
    
    // Unit types
    this.unitTypes = {
      wolf: {
        name: "Wolf",
        health: 100,
        damage: 15,
        speed: 6,
        attackRange: 1.5,
        attackSpeed: 1.2,
        cost: 10,
        key: '1' // Add keyboard key for wolf
      },
      bear: {
        name: "Bear",
        health: 200,
        damage: 25,
        speed: 4,
        attackRange: 2,
        attackSpeed: 0.8,
        cost: 20,
        key: '2' // Add keyboard key for bear
      },
      eagle: {
        name: "Eagle",
        health: 80,
        damage: 12,
        speed: 8,
        attackRange: 1,
        attackSpeed: 1.5,
        cost: 15,
        key: '3' // Add keyboard key for eagle
      },
      fox: {
        name: "Fox",
        health: 90,
        damage: 10,
        speed: 7,
        attackRange: 1.2,
        attackSpeed: 1.4,
        cost: 12,
        key: '4' // Add keyboard key for fox
      },
      deer: {
        name: "Deer",
        health: 120,
        damage: 8,
        speed: 9,
        attackRange: 1,
        attackSpeed: 1,
        cost: 10,
        key: '5' // Add keyboard key for deer
      }
    };
    
    // Active units
    this.units = [];
    
    // Register units collection with the context
    this.context.registerUnits(this.units);
    
    // UI
    this.initUI();
    
    // Preview for placement
    this.previewMesh = null;
    this.isInPlacementMode = false;
    this.selectedUnitType = null;
    
    // Keyboard placement handler
    this.initKeyboardShortcuts();
    
    // Menu visibility flag
    this.isMenuVisible = false;
    
    // Automatically show unit menu
    setTimeout(() => this.openMenu(), 1000);
    
    console.log("Unit system initialized");
  }
  
  initKeyboardShortcuts() {
    // Add event listener for keyboard number keys
    document.addEventListener('keydown', (event) => {
      // Check if we're not in an input field
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      const key = event.key;
      
      // Q key to toggle menu or cancel placement
      if (key === 'q' || key === 'Q') {
        if (this.isInPlacementMode) {
          // If in placement mode, cancel placement
          this.exitPlacementMode();
        } else {
          // Toggle menu visibility
          if (this.isMenuVisible) {
            this.closeMenu();
          } else {
            this.openMenu();
          }
        }
        event.preventDefault();
        return;
      }

      // Check for unit keys (1-5)
      for (const unitType in this.unitTypes) {
        if (this.unitTypes[unitType].key === key) {
          console.log(`Key ${key} pressed for unit type: ${unitType}`);
          
          // If we're already in placement mode with this unit type
          if (this.isInPlacementMode && this.selectedUnitType === unitType) {
            // Place the unit at player's position and exit placement mode
            const position = this.player.getPosition().clone();
            position.y += 0.5; // Raise slightly above ground
            this.spawnUnit(unitType, position);
            this.exitPlacementMode();
            this.showNotification(`${this.unitTypes[unitType].name} placed at your position!`);
          } else {
            // First press: Cancel any existing placement and start new one
            this.exitPlacementMode();
            this.startUnitPlacement(unitType);
          }
          
          event.preventDefault();
          break;
        }
      }
      
      // Escape to cancel placement
      if (key === 'Escape' && this.isInPlacementMode) {
        this.exitPlacementMode();
        event.preventDefault();
      }
    });
  }
  
  startUnitPlacement(unitType) {
    // Store selected unit type
    this.selectedUnitType = unitType;
    
    // Enter placement mode for the selected unit
    this.enterPlacementMode(unitType);
    
    // Show instruction notification
    this.showNotification(`Press ${this.unitTypes[unitType].key} again to place the ${this.unitTypes[unitType].name} at your position, Q to cancel`);
  }
  
  confirmPlacement() {
    if (!this.isInPlacementMode || !this.previewMesh) return;
    
    // Get the position of the preview mesh
    const position = this.previewMesh.position.clone();
    
    // Create the unit at this position
    this.spawnUnit(this.selectedUnitType, position);
    
    // Exit placement mode
    this.exitPlacementMode();
    
    // Show success message
    this.showNotification(`${this.unitTypes[this.selectedUnitType].name} placed successfully!`);
  }
  
  showNotification(message, duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.position = 'absolute';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.fontSize = '16px';
    notification.style.zIndex = '1000';
    notification.style.transition = 'opacity 0.3s';
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Remove after duration
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, duration);
  }
  
  enterPlacementMode(unitType) {
    // Already in placement mode, exit first
    if (this.isInPlacementMode) {
      this.exitPlacementMode();
    }
    
    // Get unit data
    const unitData = this.unitTypes[unitType];
    console.log(`Entering placement mode for ${unitData.name}`);
    
    // Check if player has enough resources
    if (!this.checkCost(unitData.cost)) {
      this.showNotification(`Not enough resources to create ${unitData.name} (Cost: ${unitData.cost})`);
      return;
    }
    
    // Set flag
    this.isInPlacementMode = true;
    this.selectedUnitType = unitType;
    
    // Create preview mesh or use group directly
    const previewObject = this.createPreviewGeometry(unitType);
    
    // Check if the returned object is a Group (for unit types that return groups)
    if (previewObject instanceof THREE.Group) {
      this.previewMesh = previewObject;
      // Apply preview material to all meshes in the group
      this.previewMesh.traverse(child => {
        if (child.isMesh) {
          child.material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            wireframe: true
          });
        }
      });
    } else {
      // For geometries, create a new mesh
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.6,
        wireframe: true
      });
      
      this.previewMesh = new THREE.Mesh(previewObject, material);
    }
    
    this.previewMesh.position.copy(this.player.getPosition());
    this.previewMesh.position.y += 0.5;
    this.scene.add(this.previewMesh);
    
    console.log("Preview mesh added to scene", this.previewMesh);
    
    // Add mouse move handler to position the preview mesh
    this.mouseMoveHandler = (event) => {
      // Don't respond to mouse movement if we're not placing
      if (!this.isInPlacementMode) return;
      
      // Ensure camera is valid before using it with raycaster
      if (!this.camera) {
        console.error("Camera is undefined in mouseMoveHandler");
        return;
      }
      
      // Cast ray from camera to terrain
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      raycaster.setFromCamera(mouse, this.camera);
      
      // Find terrain intersection
      const intersects = raycaster.intersectObjects(this.scene.children, true);
      let validPosition = false;
      
      for (const intersect of intersects) {
        // Skip the preview mesh itself
        if (intersect.object === this.previewMesh || 
            (this.previewMesh.children && 
             this.previewMesh.children.includes(intersect.object))) continue;
        
        // Skip UI elements or other non-terrain objects
        if (intersect.object.userData && 
            (intersect.object.userData.isUI || 
             intersect.object.userData.isEnemy ||
             intersect.object.userData.isUnit)) {
          continue;
        }
        
        // Found terrain, update preview position
        this.previewMesh.position.copy(intersect.point);
        // Raise slightly above ground
        this.previewMesh.position.y += 0.5;
        validPosition = true;
        break;
      }
      
      // Change color based on validity
      const color = validPosition ? 0x00ff00 : 0xff0000;
      
      // Update material color for all meshes
      if (this.previewMesh instanceof THREE.Group) {
        this.previewMesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.color.set(color);
          }
        });
      } else if (this.previewMesh.material) {
        this.previewMesh.material.color.set(color);
      }
    };
    
    // Use SPACE key for placement instead of click
    window.addEventListener('mousemove', this.mouseMoveHandler);
  }
  
  exitPlacementMode() {
    if (!this.isInPlacementMode) return;
    
    console.log("Exiting placement mode");
    
    // Remove preview mesh
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
    }
    
    // Remove event listeners
    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    
    // Reset flags
    this.isInPlacementMode = false;
    this.selectedUnitType = null;
  }

  // Add a key guide to the UI
  initUI() {
    // Create unit deployment UI
    this.unitMenu = document.createElement('div');
    this.unitMenu.style.position = 'absolute';
    this.unitMenu.style.bottom = '20px';
    this.unitMenu.style.left = '50%';
    this.unitMenu.style.transform = 'translateX(-50%)';
    this.unitMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.unitMenu.style.padding = '10px';
    this.unitMenu.style.borderRadius = '5px';
    this.unitMenu.style.display = 'flex';
    this.unitMenu.style.gap = '10px';
    this.unitMenu.style.zIndex = '100';
    this.unitMenu.style.transition = 'opacity 0.3s';
    this.unitMenu.style.opacity = '0';
    this.unitMenu.style.pointerEvents = 'none'; // Make it non-interactive initially
    
    // Create unit buttons
    for (const unitType in this.unitTypes) {
      const unitData = this.unitTypes[unitType];
      const button = document.createElement('div');
      button.style.backgroundColor = 'rgba(50, 50, 50, 0.8)';
      button.style.padding = '10px';
      button.style.borderRadius = '5px';
      button.style.cursor = 'pointer';
      button.style.display = 'flex';
      button.style.flexDirection = 'column';
      button.style.alignItems = 'center';
      
      // Add unit name and keyboard shortcut
      button.innerHTML = `
        <div style="font-weight: bold; color: white; font-family: Arial, sans-serif; margin-bottom: 5px;">
          ${unitData.name}
        </div>
        <div style="color: #aaa; font-family: Arial, sans-serif; font-size: 12px; margin-bottom: 5px;">
          Press "${unitData.key}" twice
        </div>
        <div style="color: #ffcc00; font-family: Arial, sans-serif; font-size: 12px;">
          Cost: ${unitData.cost}
        </div>
      `;
      
      this.unitMenu.appendChild(button);
    }
    
    // Add to body
    document.body.appendChild(this.unitMenu);
    
    // Create keyboard shortcut guide
    const keyGuide = document.createElement('div');
    keyGuide.style.position = 'absolute';
    keyGuide.style.top = '20px';
    keyGuide.style.left = '20px';
    keyGuide.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    keyGuide.style.padding = '10px';
    keyGuide.style.borderRadius = '5px';
    keyGuide.style.color = 'white';
    keyGuide.style.fontFamily = 'Arial, sans-serif';
    keyGuide.style.fontSize = '14px';
    keyGuide.style.zIndex = '100';
    
    keyGuide.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">Unit Controls:</div>
      <div>Q: Toggle unit menu / Cancel placement</div>
      <div>1-5: Select unit type</div>
      <div>Press same number again: Place unit at your position</div>
      <div>ESC: Cancel placement</div>
    `;
    
    document.body.appendChild(keyGuide);
  }
  
  createPreviewGeometry(unitType) {
    // More detailed preview geometries based on unit type
    switch (unitType) {
      case 'wolf':
        const wolfGroup = new THREE.Group();
        // Body
        const wolfBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.4, 1, 4, 8),
          new THREE.MeshBasicMaterial({ color: 0x777777, wireframe: true })
        );
        wolfBody.rotation.x = Math.PI / 2;
        wolfGroup.add(wolfBody);
        
        // Head
        const wolfHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x777777, wireframe: true })
        );
        wolfHead.position.z = 0.65;
        wolfHead.position.y = 0.2;
        wolfGroup.add(wolfHead);
        
        return wolfGroup;
        
      case 'bear':
        const bearGroup = new THREE.Group();
        // Body
        const bearBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.6, 1.2, 4, 8),
          new THREE.MeshBasicMaterial({ color: 0x8B4513, wireframe: true })
        );
        bearBody.rotation.x = Math.PI / 2;
        bearGroup.add(bearBody);
        
        // Head
        const bearHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x8B4513, wireframe: true })
        );
        bearHead.position.z = 0.8;
        bearHead.position.y = 0.3;
        bearGroup.add(bearHead);
        
        return bearGroup;
        
      case 'eagle':
        // Use simpler geometry for flying units
        const eagleGroup = new THREE.Group();
        
        // Body (cone)
        const eagleBody = new THREE.Mesh(
          new THREE.ConeGeometry(0.3, 1, 8),
          new THREE.MeshBasicMaterial({ color: 0xA66C29, wireframe: true })
        );
        eagleBody.rotation.x = -Math.PI / 2; // Rotate to align with flight direction
        eagleGroup.add(eagleBody);
        
        // Wings (just for visual clarity)
        const wingGeometry = new THREE.BoxGeometry(1, 0.05, 0.3);
        const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xA66C29, wireframe: true });
        
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-0.4, 0, 0);
        eagleGroup.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0.4, 0, 0);
        eagleGroup.add(rightWing);
        
        return eagleGroup;
        
      case 'fox':
        const foxGroup = new THREE.Group();
        // Body
        const foxBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.25, 0.8, 4, 8),
          new THREE.MeshBasicMaterial({ color: 0xE67E22, wireframe: true })
        );
        foxBody.rotation.x = Math.PI / 2;
        foxGroup.add(foxBody);
        
        // Head
        const foxHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xE67E22, wireframe: true })
        );
        foxHead.position.z = 0.5;
        foxHead.position.y = 0.1;
        foxGroup.add(foxHead);
        
        return foxGroup;
        
      case 'deer':
        const deerGroup = new THREE.Group();
        // Body
        const deerBody = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.3, 1, 4, 8),
          new THREE.MeshBasicMaterial({ color: 0xD2B48C, wireframe: true })
        );
        deerBody.rotation.x = Math.PI / 2;
        deerGroup.add(deerBody);
        
        // Head
        const deerHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xD2B48C, wireframe: true })
        );
        deerHead.position.z = 0.6;
        deerHead.position.y = 0.1;
        deerGroup.add(deerHead);
        
        return deerGroup;
        
      default:
        return new THREE.SphereGeometry(0.5, 8, 8);
    }
  }
  
  spawnUnit(unitType, position) {
    if (!this.unitTypes[unitType]) {
      console.error(`Unknown unit type: ${unitType}`);
      return null;
    }
    
    // Check if player has enough resources
    const cost = this.unitTypes[unitType].cost;
    if (!this.inventorySystem.hasItem('wood', cost)) {
      console.log(`Not enough wood to spawn ${unitType}, need ${cost}`);
      
      // Show notification
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
      notification.textContent = `Not enough wood! Need ${cost} wood to create ${this.unitTypes[unitType].name}.`;
      document.body.appendChild(notification);
      
      // Remove notification after a delay
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
      
      return null;
    }
    
    // Deduct cost
    this.inventorySystem.removeItem('wood', cost);
    
    // Copy attributes from unit type
    const attributes = {
      health: this.unitTypes[unitType].health,
      damage: this.unitTypes[unitType].damage,
      speed: this.unitTypes[unitType].speed,
      attackRange: this.unitTypes[unitType].attackRange,
      attackSpeed: this.unitTypes[unitType].attackSpeed,
      scale: 1.0 // Default scale
    };
    
    // Add color based on unit type
    switch (unitType) {
      case 'wolf':
        attributes.color = 0x888888; // Gray
        break;
      case 'bear':
        attributes.color = 0x8B4513; // Brown
        break;
      case 'eagle':
        attributes.color = 0xA0522D; // Sienna
        break;
      case 'fox':
        attributes.color = 0xD2691E; // Orange-brown
        break;
      case 'deer':
        attributes.color = 0xCD853F; // Tan
        break;
      default:
        attributes.color = 0xAAAAAA; // Default gray
    }
    
    // Create the unit
    try {
      const unit = new AnimalUnit(
        this.scene,
        this.player,
        this.world,
        unitType,
        position,
        attributes
      );
      
      // Store context in the unit's mesh for access by other systems
      if (unit.mesh) {
        unit.mesh.userData.context = this.context;
      }
      
      // Add to units collection
      this.units.push(unit);
      
      // Show feedback message
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
      notification.textContent = `${this.unitTypes[unitType].name} deployed successfully!`;
      document.body.appendChild(notification);
      
      // Remove notification after a delay
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
      
      console.log(`Spawned a ${this.unitTypes[unitType].name} at position`, position);
      return unit;
    } catch (error) {
      console.error(`Error spawning unit ${unitType}:`, error);
      return null;
    }
  }
  
  update(deltaTime) {
    // Update all units
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];
      
      // Check if unit is dead
      if (unit.isDead()) {
        unit.dispose();
        this.units.splice(i, 1);
      } else {
        unit.update(deltaTime);
      }
    }
  }
  
  // Check if player has enough resources
  checkCost(cost) {
    // Always allow unit creation for debugging so we can test the system
    return true;
    
    // TODO: This should normally check the inventory
    // if (window.game && window.game.inventorySystem) {
    //   return window.game.inventorySystem.hasWood(cost);
    // }
  }
  
  // Get all units in a radius around a position
  getUnitsInRadius(position, radius) {
    return this.units.filter(unit => {
      const distance = position.distanceTo(unit.getPosition());
      return distance <= radius;
    });
  }
  
  // Update openMenu method
  openMenu() {
    if (this.unitMenu) {
      // Make the menu visible
      this.unitMenu.style.opacity = '1';
      this.unitMenu.style.pointerEvents = 'auto';
      this.isMenuVisible = true;
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        this.closeMenu();
      }, 5000);
    }
  }

  // Add closeMenu method
  closeMenu() {
    if (this.unitMenu) {
      this.unitMenu.style.opacity = '0';
      this.unitMenu.style.pointerEvents = 'none';
      this.isMenuVisible = false;
    }
  }
} 