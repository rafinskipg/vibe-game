import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsSystem {
  constructor() {
    // Physics world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0) // Earth gravity
    });
    
    // Configure physics world
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.3;
    
    // Track bodies and their corresponding meshes
    this.bodies = [];
    this.meshMap = new Map(); // Maps cannon bodies to three.js meshes
    this.bodyMap = new Map(); // Maps three.js meshes to cannon bodies
    
    // Debugging
    this.debug = false;
    this.debugBodies = [];
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
          mesh.quaternion.copy(this.cannonQuaternionToThree(body.quaternion));
        }
      }
    });
    
    // Update debug visuals if needed
    if (this.debug) {
      this.updateDebugBodies();
    }
  }
  
  addBody(body, mesh, options = {}) {
    // Add the body to the physics world
    this.world.addBody(body);
    this.bodies.push(body);
    
    // Map the body to its visual mesh
    if (mesh) {
      this.meshMap.set(body, mesh);
      this.bodyMap.set(mesh, body);
      
      // Initial sync of position and rotation
      body.position.copy(this.threeVec3ToCannon(mesh.position));
      
      if (!options.fixedRotation && mesh.quaternion) {
        body.quaternion.copy(this.threeQuaternionToCannon(mesh.quaternion));
      }
    }
    
    // Create debug visualization if debug mode is on
    if (this.debug) {
      this.createDebugBody(body);
    }
    
    return body;
  }
  
  removeBody(body) {
    // Remove from physics world
    this.world.removeBody(body);
    
    // Remove from tracking arrays
    const index = this.bodies.indexOf(body);
    if (index !== -1) {
      this.bodies.splice(index, 1);
    }
    
    // Remove from maps
    const mesh = this.meshMap.get(body);
    if (mesh) {
      this.bodyMap.delete(mesh);
      this.meshMap.delete(body);
    }
    
    // Remove debug body if exists
    if (this.debug) {
      this.removeDebugBody(body);
    }
  }
  
  createPlayerBody(playerMesh, radius = 0.5, height = 1.8) {
    // Create a capsule body for the player
    const shape = new CANNON.Cylinder(radius, radius, height, 8);
    const body = new CANNON.Body({
      mass: 80, // kg
      shape: shape,
      fixedRotation: true, // Don't let the body rotate
      position: this.threeVec3ToCannon(playerMesh.position),
      material: new CANNON.Material({ friction: 0.1, restitution: 0.0 })
    });
    
    // Set linear damping to simulate air/ground friction
    body.linearDamping = 0.9;
    
    // Add body to physics world
    this.addBody(body, playerMesh, { fixedRotation: true });
    
    return body;
  }
  
  createEnemyBody(enemyMesh, radius = 0.5, height = 2.0, mass = 60) {
    // Create a capsule body for enemies
    const shape = new CANNON.Cylinder(radius, radius, height, 8);
    const body = new CANNON.Body({
      mass: mass,
      shape: shape,
      fixedRotation: true, // Enemies should have controlled rotation
      position: this.threeVec3ToCannon(enemyMesh.position),
      material: new CANNON.Material({ friction: 0.1, restitution: 0.0 })
    });
    
    // Set linear damping to simulate air/ground friction
    body.linearDamping = 0.5;
    
    // Add body to physics world
    this.addBody(body, enemyMesh, { fixedRotation: true });
    
    return body;
  }
  
  createTerrainBody(terrainMesh, vertices, indices, scale = 1) {
    // Create a heightfield shape from terrain data
    if (!vertices || !indices) {
      console.error("Missing vertices or indices for terrain body");
      return null;
    }
    
    // Create trimesh from terrain geometry
    const shape = new CANNON.Trimesh(
      vertices, // Vertices array
      indices   // Indices array
    );
    
    // Create static terrain body
    const body = new CANNON.Body({
      mass: 0, // Static body
      shape: shape,
      material: new CANNON.Material({ friction: 0.5, restitution: 0.3 })
    });
    
    // Add body to physics world without a mesh (terrain mesh is already in scene)
    this.addBody(body, terrainMesh);
    
    return body;
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
  
  cannonQuaternionToThree(cannonQuat) {
    return new THREE.Quaternion(cannonQuat.x, cannonQuat.y, cannonQuat.z, cannonQuat.w);
  }
  
  threeQuaternionToCannon(threeQuat) {
    return new CANNON.Quaternion(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w);
  }
  
  // Debug methods
  setDebug(enabled) {
    this.debug = enabled;
    
    if (enabled) {
      // Create debug visuals for all existing bodies
      this.bodies.forEach(body => {
        this.createDebugBody(body);
      });
    } else {
      // Remove all debug visuals
      this.debugBodies.forEach(debug => {
        if (debug.mesh && debug.mesh.parent) {
          debug.mesh.parent.remove(debug.mesh);
        }
      });
      this.debugBodies = [];
    }
  }
  
  createDebugBody(body) {
    // Do nothing if not in debug mode
    if (!this.debug) return;
    
    // For now, only simple shapes are supported
    let geometry;
    let shape = body.shapes[0]; // Just use the first shape
    
    if (shape instanceof CANNON.Box) {
      geometry = new THREE.BoxGeometry(
        shape.halfExtents.x * 2,
        shape.halfExtents.y * 2,
        shape.halfExtents.z * 2
      );
    } else if (shape instanceof CANNON.Sphere) {
      geometry = new THREE.SphereGeometry(shape.radius, 16, 16);
    } else if (shape instanceof CANNON.Cylinder) {
      geometry = new THREE.CylinderGeometry(
        shape.radiusTop,
        shape.radiusBottom,
        shape.height,
        16
      );
    } else {
      // Unsupported shape, create a simple sphere
      geometry = new THREE.SphereGeometry(0.5, 8, 8);
    }
    
    // Create a wireframe material
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      opacity: 0.5,
      transparent: true
    });
    
    // Create the mesh
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add to scene
    const targetMesh = this.meshMap.get(body);
    if (targetMesh && targetMesh.parent) {
      targetMesh.parent.add(mesh);
    }
    
    // Add to debug bodies list
    this.debugBodies.push({
      body: body,
      mesh: mesh
    });
  }
  
  updateDebugBodies() {
    this.debugBodies.forEach(debug => {
      if (debug.mesh && debug.body) {
        debug.mesh.position.copy(this.cannonVec3ToThree(debug.body.position));
        debug.mesh.quaternion.copy(this.cannonQuaternionToThree(debug.body.quaternion));
      }
    });
  }
  
  removeDebugBody(body) {
    const index = this.debugBodies.findIndex(debug => debug.body === body);
    if (index !== -1) {
      const debug = this.debugBodies[index];
      if (debug.mesh && debug.mesh.parent) {
        debug.mesh.parent.remove(debug.mesh);
      }
      this.debugBodies.splice(index, 1);
    }
  }
} 