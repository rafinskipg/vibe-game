import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsSystem {
  constructor(scene) {
    // Reference to the Three.js scene
    this.scene = scene;
    
    // Create the physics world
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 10;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;
    
    // Define collision groups
    this.COLLISION_GROUPS = {
      TERRAIN: 1,
      PLAYER: 2,
      ENEMY: 4,
      UNIT: 8,
      OBJECT: 16,
      PROJECTILE: 32
    };
    
    // Create materials
    this.groundMaterial = new CANNON.Material('ground');
    this.playerMaterial = new CANNON.Material('player');
    this.unitMaterial = new CANNON.Material('unit');
    this.objectMaterial = new CANNON.Material('object');
    
    // Set up contact materials
    const playerGroundContact = new CANNON.ContactMaterial(
      this.playerMaterial, 
      this.groundMaterial, 
      { friction: 0.5, restitution: 0.3 }
    );
    
    const unitGroundContact = new CANNON.ContactMaterial(
      this.unitMaterial, 
      this.groundMaterial, 
      { friction: 0.3, restitution: 0.2 }
    );
    
    this.world.addContactMaterial(playerGroundContact);
    this.world.addContactMaterial(unitGroundContact);
    
    // Track bodies and their meshes
    this.bodies = [];
    this.meshMap = new Map(); // Maps bodies to meshes
    this.bodyMap = new Map(); // Maps meshes to bodies
    
    // For debug visualization
    this.debug = false;
    this.debugBodies = new Map(); // Map of body -> { mesh, debugMesh }
    this.debugMeshes = new THREE.Group();
    this.debugMeshes.name = 'PhysicsDebugMeshes';
    
    // For tracking bodies to remove
    this.bodiesToRemove = [];
  }
  
  update(deltaTime) {
    // Step the physics world
    this.world.step(1/60, deltaTime, 3);
    
    // Update mesh positions to match physics bodies
    this.bodies.forEach(body => {
      const mesh = this.meshMap.get(body);
      if (mesh) {
        // Copy position
        mesh.position.copy(this.cannonVec3ToThree(body.position));
        
        // Copy rotation
        if (!body.fixedRotation) {
          mesh.quaternion.copy(this.cannonQuatToThree(body.quaternion));
        }
      }
    });
    
    // Update debug visuals if needed
    if (this.debug) {
      // Update debug meshes
      this.debugBodies.forEach((data, body) => {
        if (data.debugMesh) {
          data.debugMesh.position.copy(this.cannonVec3ToThree(body.position));
          data.debugMesh.quaternion.copy(this.cannonQuatToThree(body.quaternion));
        }
      });
    }
  }
  
  removeBody(body) {
    if (!body) return;
    
    try {
      // Remove from physics world
      this.world.removeBody(body);
      
      // Remove from bodies array
      const index = this.bodies.indexOf(body);
      if (index !== -1) {
        this.bodies.splice(index, 1);
      }
      
      // Clean up maps
      const mesh = this.meshMap.get(body);
      if (mesh) {
        this.bodyMap.delete(mesh);
      }
      this.meshMap.delete(body);
      
      // Clean up debug visualization
      if (this.debug) {
        const debugData = this.debugBodies.get(body);
        if (debugData && debugData.debugMesh) {
          this.debugMeshes.remove(debugData.debugMesh);
        }
        this.debugBodies.delete(body);
      }
    } catch (error) {
      console.error('Error removing physics body:', error);
    }
  }
  
  createPlayerBody(playerMesh, radius = 0.5, height = 1.8) {
    // Create a capsule body for the player
    const shape = new CANNON.Cylinder(radius, radius, height, 8);
    const body = new CANNON.Body({
      mass: 80, // kg
      material: this.playerMaterial,
      type: CANNON.Body.DYNAMIC,
      fixedRotation: true, // Don't let the body rotate
      collisionFilterGroup: this.COLLISION_GROUPS.PLAYER,
      collisionFilterMask: this.COLLISION_GROUPS.TERRAIN | this.COLLISION_GROUPS.ENEMY | this.COLLISION_GROUPS.OBJECT
    });
    
    body.addShape(shape);
    
    // Get initial position from mesh
    const position = new THREE.Vector3();
    if (playerMesh) {
      playerMesh.getWorldPosition(position);
      body.position.set(position.x, position.y, position.z);
    }
    
    // Set linear damping to simulate air/ground friction
    body.linearDamping = 0.9;
    
    // Add body to physics world and tracking
    this.world.addBody(body);
    this.bodies.push(body);
    
    // Map body to mesh
    if (playerMesh) {
      this.meshMap.set(body, playerMesh);
      this.bodyMap.set(playerMesh, body);
    }
    
    if (this.debug) {
      this.debugBodies.set(body, { mesh: playerMesh, debugMesh: this.createDebugMesh(shape) });
    }
    
    return body;
  }
  
  createEnemyBody(mesh, radius = 0.5, height = 2, mass = 60) {
    const shape = new CANNON.Cylinder(radius, radius, height, 8);
    const body = new CANNON.Body({
      mass: mass,
      material: this.unitMaterial,
      type: CANNON.Body.DYNAMIC,
      collisionFilterGroup: this.COLLISION_GROUPS.ENEMY,
      collisionFilterMask: this.COLLISION_GROUPS.TERRAIN | this.COLLISION_GROUPS.PLAYER | this.COLLISION_GROUPS.OBJECT
    });
    
    body.addShape(shape);
    
    // Get initial position from mesh
    const position = new THREE.Vector3();
    if (mesh) {
      mesh.getWorldPosition(position);
      body.position.set(position.x, position.y, position.z);
    }
    
    // Add body to physics world and tracking
    this.world.addBody(body);
    this.bodies.push(body);
    
    // Map body to mesh
    if (mesh) {
      this.meshMap.set(body, mesh);
      this.bodyMap.set(mesh, body);
    }
    
    if (this.debug) {
      this.debugBodies.set(body, { mesh, debugMesh: this.createDebugMesh(shape) });
    }
    
    return body;
  }
  
  createTerrainBody(terrainMesh, vertices, indices) {
    if (!vertices || !indices) {
      console.error("Missing vertices or indices for terrain body");
      return null;
    }
    
    try {
      // Create trimesh from terrain geometry
      const shape = new CANNON.Trimesh(vertices, indices);
      
      // Create static terrain body
      const body = new CANNON.Body({
        mass: 0, // Static body
        material: this.groundMaterial,
        type: CANNON.Body.STATIC,
        collisionFilterGroup: this.COLLISION_GROUPS.TERRAIN,
        collisionFilterMask: this.COLLISION_GROUPS.PLAYER | this.COLLISION_GROUPS.ENEMY | this.COLLISION_GROUPS.UNIT | this.COLLISION_GROUPS.OBJECT
      });
      
      body.addShape(shape);
      
      // Get position from mesh
      const position = new THREE.Vector3();
      if (terrainMesh) {
        terrainMesh.getWorldPosition(position);
        body.position.set(position.x, position.y, position.z);
        
        // Copy rotation
        if (terrainMesh.quaternion) {
          body.quaternion.copy(this.threeQuatToCannon(terrainMesh.quaternion));
        }
      }
      
      // Add body to physics world and tracking
      this.world.addBody(body);
      this.bodies.push(body);
      
      // Map body to mesh
      if (terrainMesh) {
        this.meshMap.set(body, terrainMesh);
        this.bodyMap.set(terrainMesh, body);
      }
      
      if (this.debug) {
        // For terrain, use a simplified debug visualization - just a box showing the bounds
        const boundingBox = new THREE.Box3().setFromObject(terrainMesh);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        const debugGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const debugMaterial = new THREE.MeshBasicMaterial({
          color: 0x888888,
          wireframe: true,
          transparent: true,
          opacity: 0.3
        });
        
        const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        debugMesh.position.copy(center);
        
        this.debugMeshes.add(debugMesh);
        this.debugBodies.set(body, { mesh: terrainMesh, debugMesh });
      }
      
      return body;
    } catch (error) {
      console.error("Error creating terrain body:", error);
      return null;
    }
  }
  
  createBoxBody(boxMesh, mass = 0) {
    if (!boxMesh.geometry.boundingBox) {
      boxMesh.geometry.computeBoundingBox();
    }
    
    const bbox = boxMesh.geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    // Apply mesh scale to size
    size.multiply(boxMesh.scale);
    
    // Create box shape
    const shape = new CANNON.Box(new CANNON.Vec3(
      size.x / 2,
      size.y / 2,
      size.z / 2
    ));
    
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      shape: shape,
      position: this.threeVec3ToCannon(boxMesh.position),
      material: new CANNON.Material({ friction: 0.5, restitution: 0.3 })
    });
    
    // Add body to physics world
    this.addBody(body, boxMesh);
    
    return body;
  }
  
  // Helper methods for converting between Cannon.js and Three.js vectors
  cannonVec3ToThree(cannonVec) {
    return new THREE.Vector3(cannonVec.x, cannonVec.y, cannonVec.z);
  }
  
  threeVec3ToCannon(threeVec) {
    return new CANNON.Vec3(threeVec.x, threeVec.y, threeVec.z);
  }
  
  cannonQuatToThree(cannonQuat) {
    return new THREE.Quaternion(cannonQuat.x, cannonQuat.y, cannonQuat.z, cannonQuat.w);
  }
  
  threeQuatToCannon(threeQuat) {
    return new CANNON.Quaternion(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w);
  }
  
  // Toggle physics debug visualization
  toggleDebug() {
    this.debug = !this.debug;
    
    if (this.debug) {
      // Add debug meshes group to scene
      this.scene.add(this.debugMeshes);
      
      // Create debug meshes for all bodies
      this.debugBodies.forEach((value, body) => {
        if (!value.debugMesh) {
          value.debugMesh = this.createDebugMeshForBody(body);
          this.debugMeshes.add(value.debugMesh);
        }
      });
    } else {
      // Remove debug meshes from scene
      this.scene.remove(this.debugMeshes);
    }
    
    return this.debug;
  }
  
  // Create debug mesh for a physics body
  createDebugMeshForBody(body) {
    const debugGroup = new THREE.Group();
    
    // Different color for different collision groups
    let color = 0x00ff00; // Default green
    
    if (body.collisionFilterGroup === this.COLLISION_GROUPS.TERRAIN) {
      color = 0x888888; // Gray for terrain
    } else if (body.collisionFilterGroup === this.COLLISION_GROUPS.PLAYER) {
      color = 0x0000ff; // Blue for player
    } else if (body.collisionFilterGroup === this.COLLISION_GROUPS.ENEMY) {
      color = 0xff0000; // Red for enemies
    } else if (body.collisionFilterGroup === this.COLLISION_GROUPS.UNIT) {
      color = 0x00ffff; // Cyan for allied units
    }
    
    // Create a mesh for each shape in the body
    body.shapes.forEach((shape, i) => {
      let mesh;
      const shapePos = body.shapeOffsets[i] || new CANNON.Vec3();
      const shapeQuat = body.shapeOrientations[i] || new CANNON.Quaternion();
      
      // Create different geometry based on shape type
      if (shape instanceof CANNON.Box) {
        const geometry = new THREE.BoxGeometry(
          shape.halfExtents.x * 2,
          shape.halfExtents.y * 2,
          shape.halfExtents.z * 2
        );
        const material = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.5
        });
        mesh = new THREE.Mesh(geometry, material);
      } else if (shape instanceof CANNON.Sphere) {
        const geometry = new THREE.SphereGeometry(shape.radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.5
        });
        mesh = new THREE.Mesh(geometry, material);
      } else if (shape instanceof CANNON.Cylinder) {
        const geometry = new THREE.CylinderGeometry(
          shape.radiusTop,
          shape.radiusBottom,
          shape.height,
          16
        );
        const material = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.5
        });
        mesh = new THREE.Mesh(geometry, material);
        // Rotate to match Cannon.js cylinder orientation
        mesh.rotation.x = Math.PI / 2;
      } else if (shape instanceof CANNON.Plane) {
        // For planes, show a large square
        const geometry = new THREE.PlaneGeometry(100, 100);
        const material = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide
        });
        mesh = new THREE.Mesh(geometry, material);
      } else {
        // Default fallback as a small box
        console.warn('Unknown physics shape', shape);
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          wireframe: true
        });
        mesh = new THREE.Mesh(geometry, material);
      }
      
      // Apply shape offset and orientation relative to body
      if (mesh) {
        mesh.position.copy(this.cannonVec3ToThree(shapePos));
        mesh.quaternion.copy(this.cannonQuatToThree(shapeQuat));
        debugGroup.add(mesh);
      }
    });
    
    return debugGroup;
  }
  
  // Create a debug mesh for a shape (used when adding bodies)
  createDebugMesh(shape) {
    if (!this.debug) return null;
    
    let mesh;
    let color = 0x00ff00; // Default green
    
    // Create different geometry based on shape type
    if (shape instanceof CANNON.Box) {
      const geometry = new THREE.BoxGeometry(
        shape.halfExtents.x * 2,
        shape.halfExtents.y * 2,
        shape.halfExtents.z * 2
      );
      const material = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      mesh = new THREE.Mesh(geometry, material);
    } else if (shape instanceof CANNON.Sphere) {
      const geometry = new THREE.SphereGeometry(shape.radius, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      mesh = new THREE.Mesh(geometry, material);
    } else if (shape instanceof CANNON.Cylinder) {
      const geometry = new THREE.CylinderGeometry(
        shape.radiusTop,
        shape.radiusBottom,
        shape.height,
        16
      );
      const material = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      mesh = new THREE.Mesh(geometry, material);
      // Rotate to match Cannon.js cylinder orientation
      mesh.rotation.x = Math.PI / 2;
    } else {
      return null;
    }
    
    if (mesh) {
      this.debugMeshes.add(mesh);
    }
    
    return mesh;
  }
  
  // Create a physics body for an animal unit
  createAnimalBody(mesh, radius = 0.4, height = 1.5, mass = 40) {
    const shape = new CANNON.Cylinder(radius, radius, height, 8);
    const body = new CANNON.Body({
      mass: mass,
      material: this.unitMaterial,
      type: CANNON.Body.DYNAMIC,
      collisionFilterGroup: this.COLLISION_GROUPS.UNIT,
      collisionFilterMask: this.COLLISION_GROUPS.TERRAIN | this.COLLISION_GROUPS.PLAYER | this.COLLISION_GROUPS.ENEMY | this.COLLISION_GROUPS.OBJECT
    });
    
    body.addShape(shape);
    
    // Get initial position from mesh
    const position = new THREE.Vector3();
    if (mesh) {
      mesh.getWorldPosition(position);
      body.position.set(position.x, position.y, position.z);
    }
    
    // Add body to physics world and tracking
    this.world.addBody(body);
    this.bodies.push(body);
    
    // Map body to mesh
    if (mesh) {
      this.meshMap.set(body, mesh);
      this.bodyMap.set(mesh, body);
    }
    
    if (this.debug) {
      this.debugBodies.set(body, { mesh, debugMesh: this.createDebugMesh(shape) });
    }
    
    return body;
  }
} 