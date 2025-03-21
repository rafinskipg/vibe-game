import * as THREE from 'three';

export class InteractiveObject {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.object = null;
    this.interactionEnabled = true;
  }
  
  init() {
    // To be implemented by subclasses
  }
  
  update(deltaTime, player) {
    // To be implemented by subclasses
  }
  
  getPosition() {
    return this.position.clone();
  }
  
  canInteract() {
    return this.interactionEnabled;
  }
  
  interact() {
    // To be implemented by subclasses
    // Should return a resource object or null
    return null;
  }
  
  respawn() {
    // To be implemented by subclasses
  }
} 