import * as THREE from 'three';
import { InteractiveObject } from './InteractiveObject.js';

export class Rock extends InteractiveObject {
  constructor(scene, position) {
    super(scene, position);
    
    // Rock properties
    this.health = 150;
    this.resourceType = 'stone';
    this.resourceAmount = 5;
    this.respawnTime = 45; // seconds
    
    this.init();
  }
  
  init() {
    // Create rock geometry (multiple merged spheres for natural look)
    this.object = new THREE.Group();
    this.object.position.copy(this.position);
    
    // Base rock
    const baseGeometry = new THREE.DodecahedronGeometry(1, 0);
    const baseRock = new THREE.Mesh(
      baseGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x7b7b7b,
        roughness: 0.7,
        metalness: 0.2
      })
    );
    baseRock.position.y = 0.5;
    baseRock.scale.set(1, 0.8, 1);
    baseRock.castShadow = true;
    baseRock.receiveShadow = true;
    
    // Create detail rocks and add them to the group
    const detail1 = baseRock.clone();
    detail1.scale.set(0.6, 0.4, 0.5);
    detail1.position.set(0.5, 0.3, 0.3);
    detail1.rotation.set(0.5, 0.3, 0.2);
    
    const detail2 = baseRock.clone();
    detail2.scale.set(0.4, 0.3, 0.6);
    detail2.position.set(-0.4, 0.3, 0.2);
    detail2.rotation.set(0.2, -0.3, 0.5);
    
    const detail3 = baseRock.clone();
    detail3.scale.set(0.3, 0.3, 0.3);
    detail3.position.set(0.1, 0.6, -0.4);
    detail3.rotation.set(-0.3, 0.4, 0.1);
    
    // Add meshes to group
    this.object.add(baseRock);
    this.object.add(detail1);
    this.object.add(detail2);
    this.object.add(detail3);
    
    // Add group to scene
    this.scene.add(this.object);
    
    // Randomly rotate the rock
    this.object.rotation.y = Math.random() * Math.PI * 2;
  }
  
  interact() {
    if (!this.canInteract()) {
      return null;
    }
    
    // Reduce health
    this.health -= 25;
    
    // Visual feedback - slight scale reduction
    this.object.scale.set(0.95, 0.95, 0.95);
    
    // When health reaches 0, "harvest" the rock
    if (this.health <= 0) {
      // Hide the rock (it's harvested)
      this.object.visible = false;
      this.interactionEnabled = false;
      
      // Set up respawn timer
      setTimeout(() => this.respawn(), this.respawnTime * 1000);
      
      // Return resource
      return { type: this.resourceType, amount: this.resourceAmount };
    }
    
    // Return partial resource while damaging
    return { type: this.resourceType, amount: 1 };
  }
  
  respawn() {
    // Reset health
    this.health = 150;
    
    // Reset scale
    this.object.scale.set(1, 1, 1);
    
    // Make visible again
    this.object.visible = true;
    this.interactionEnabled = true;
  }
  
  update(deltaTime, player) {
    // If not fully grown but respawning, scale up gradually
    if (this.object.visible && this.object.scale.x < 1) {
      const growFactor = Math.min(deltaTime * 0.3, 0.03);
      this.object.scale.x += growFactor;
      this.object.scale.y += growFactor;
      this.object.scale.z += growFactor;
      
      if (this.object.scale.x >= 1) {
        this.object.scale.set(1, 1, 1);
      }
    }
  }
} 