import * as THREE from 'three';

export class Cloud {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    
    // Cloud properties
    this.moveSpeed = 0.5 + Math.random() * 0.5; // Random speed
    this.moveDirection = new THREE.Vector3(1, 0, 0); // Move in x direction
    
    this.init();
  }
  
  init() {
    // Create cloud group
    this.object = new THREE.Group();
    this.object.position.copy(this.position);
    
    // Cloud material
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8
    });
    
    // Create multiple spheres to form a cloud
    const sizes = [1.5, 1.2, 1.7, 1.3, 1.0];
    const positions = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1.3, 0.4, 0.2),
      new THREE.Vector3(-1.1, 0, 0.3),
      new THREE.Vector3(0.7, -0.2, -0.5),
      new THREE.Vector3(-0.8, 0.3, -0.4)
    ];
    
    // Add cloud puffs
    for (let i = 0; i < sizes.length; i++) {
      const geometry = new THREE.SphereGeometry(sizes[i], 8, 8);
      const puff = new THREE.Mesh(geometry, cloudMaterial);
      puff.position.copy(positions[i]);
      this.object.add(puff);
    }
    
    // Scale the entire cloud
    const scale = 1 + Math.random() * 1.5;
    this.object.scale.set(scale, scale * 0.6, scale);
    
    // Add to scene
    this.scene.add(this.object);
    
    // Random rotation
    this.object.rotation.y = Math.random() * Math.PI * 2;
  }
  
  update(deltaTime) {
    // Move cloud slowly
    const movement = this.moveDirection.clone().multiplyScalar(this.moveSpeed * deltaTime);
    this.object.position.add(movement);
    
    // If cloud moves too far, reset to the other side (creates a loop)
    if (this.object.position.x > 100) {
      this.object.position.x = -100;
    }
  }
} 