import * as THREE from 'three';
import { InteractiveObject } from './InteractiveObject.js';

export class Tree extends InteractiveObject {
  constructor(scene, position) {
    super(scene, position);
    
    // Tree properties
    this.health = 100;
    this.resourceType = 'wood';
    this.resourceAmount = 3;
    this.respawnTime = 30; // seconds
    
    this.init();
  }
  
  init() {
    // Create tree group
    this.object = new THREE.Group();
    this.object.position.copy(this.position);
    
    // Create trunk (cylinder)
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513, // Brown
      roughness: 0.9,
      metalness: 0.1
    });
    
    this.trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    this.trunk.position.y = 1.5;
    this.trunk.castShadow = true;
    this.trunk.receiveShadow = true;
    
    // Create foliage (cone)
    const foliageGeometry = new THREE.ConeGeometry(2, 4, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x2D882D, // Forest green
      roughness: 0.8,
      metalness: 0
    });
    
    this.foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    this.foliage.position.y = 4.5;
    this.foliage.castShadow = true;
    this.foliage.receiveShadow = true;
    
    // Add meshes to group
    this.object.add(this.trunk);
    this.object.add(this.foliage);
    
    // Add group to scene
    this.scene.add(this.object);
    
    // Randomly rotate the tree
    this.object.rotation.y = Math.random() * Math.PI * 2;
  }
  
  interact() {
    if (!this.canInteract()) {
      return null;
    }
    
    // Reduce health
    this.health -= 25;
    
    // Visual feedback
    this.object.scale.set(0.95, 0.95, 0.95);
    
    // When health reaches 0, "harvest" the tree
    if (this.health <= 0) {
      // Hide the tree (it's harvested)
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
    this.health = 100;
    
    // Reset scale
    this.object.scale.set(1, 1, 1);
    
    // Make visible again
    this.object.visible = true;
    this.interactionEnabled = true;
  }
  
  update(deltaTime, player) {
    // If not fully grown but respawning, scale up gradually
    if (this.object.visible && this.object.scale.x < 1) {
      const growFactor = Math.min(deltaTime * 0.5, 0.05);
      this.object.scale.x += growFactor;
      this.object.scale.y += growFactor;
      this.object.scale.z += growFactor;
      
      if (this.object.scale.x >= 1) {
        this.object.scale.set(1, 1, 1);
      }
    }
  }
} 