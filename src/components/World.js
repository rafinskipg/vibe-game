import * as THREE from 'three';
import { Tree } from './objects/Tree.js';
import { Rock } from './objects/Rock.js';
import { Cloud } from './objects/Cloud.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export class World {
  constructor(scene, context) {
    this.scene = scene;
    this.context = context;
    
    // World properties
    this.worldSize = 100;
    this.chunks = new Map(); // Store chunks using coordinates as keys
    this.chunkSize = 50; // Size of each terrain chunk
    this.viewDistance = 2; // Number of chunks visible in each direction
    this.lastPlayerChunkCoords = null;
    
    // Interactive objects
    this.objects = [];
    
    // Terrain generation properties
    this.heightScale = 5;
    this.simplex = new SimplexNoise();
    
    // Physics
    this.physicsEnabled = false;
    this.terrainBodies = new Map(); // Store physics bodies for terrain chunks
  }
  
  generate() {
    // Add lighting
    this.addLighting();
    
    // Generate clouds
    this.generateClouds(15);
    
    // Initial terrain will be generated when the player position is first updated
  }
  
  update(deltaTime, player) {
    // Update player's current chunk
    const playerPosition = player.getPosition();
    const currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
    const currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);
    const currentChunkCoords = `${currentChunkX},${currentChunkZ}`;
    
    // Check if player moved to a new chunk
    if (this.lastPlayerChunkCoords !== currentChunkCoords) {
      // Update last chunk coordinates
      this.lastPlayerChunkCoords = currentChunkCoords;
      
      // Generate or update chunks based on new player position
      this.updateChunksAroundPlayer(currentChunkX, currentChunkZ);
    }
    
    // Update interactive objects
    for (const object of this.objects) {
      object.update(deltaTime, player);
    }
    
    // Update cloud positions
    this.updateClouds(deltaTime);
  }
  
  updateChunksAroundPlayer(playerChunkX, playerChunkZ) {
    // Track which chunks should be active
    const activeChunks = new Set();
    
    // Generate/maintain chunks within view distance
    for (let x = playerChunkX - this.viewDistance; x <= playerChunkX + this.viewDistance; x++) {
      for (let z = playerChunkZ - this.viewDistance; z <= playerChunkZ + this.viewDistance; z++) {
        const chunkKey = `${x},${z}`;
        activeChunks.add(chunkKey);
        
        // If chunk doesn't exist, create it
        if (!this.chunks.has(chunkKey)) {
          this.generateChunk(x, z);
        }
      }
    }
    
    // Remove chunks that are too far away
    for (const chunkKey of this.chunks.keys()) {
      if (!activeChunks.has(chunkKey)) {
        this.removeChunk(chunkKey);
      }
    }
  }
  
  generateChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Create chunk container
    const chunk = {
      terrain: null,
      objects: [],
      heightMap: null,
      x: chunkX,
      z: chunkZ
    };
    
    // Generate terrain for this chunk
    this.generateTerrainForChunk(chunk);
    
    // Add objects to the chunk (trees, rocks)
    this.populateChunk(chunk);
    
    // Store chunk
    this.chunks.set(chunkKey, chunk);
    
    return chunk;
  }
  
  removeChunk(chunkKey) {
    const chunk = this.chunks.get(chunkKey);
    
    if (chunk) {
      // Remove terrain from scene
      if (chunk.terrain) {
        this.scene.remove(chunk.terrain);
        
        // Clean up geometry and material
        chunk.terrain.geometry.dispose();
        chunk.terrain.material.dispose();
      }
      
      // Remove objects from scene
      if (chunk.objects) {
        for (const object of chunk.objects) {
          if (object && typeof object.dispose === 'function') {
            object.dispose();
          }
        }
      }
      
      // Remove physics body if it exists
      if (this.physicsEnabled && this.terrainBodies.has(chunkKey)) {
        const body = this.terrainBodies.get(chunkKey);
        this.context.systems.physics.removeBody(body);
        this.terrainBodies.delete(chunkKey);
      }
      
      // Remove from map
      this.chunks.delete(chunkKey);
    }
  }
  
  generateTerrainForChunk(chunk) {
    // Size of the chunk in world units
    const sizeX = chunk.sizeX = this.chunkSize;
    const sizeZ = chunk.sizeZ = this.chunkSize;
    
    // Resolution of the terrain grid (vertices per side)
    const resolution = 32;
    
    // Calculate the actual position of the chunk in world space
    const offsetX = chunk.x * this.chunkSize;
    const offsetZ = chunk.z * this.chunkSize;
    
    // Create geometry
    const geometry = new THREE.PlaneGeometry(
      sizeX, sizeZ, 
      resolution, resolution
    );
    geometry.rotateX(-Math.PI / 2); // Rotate to be horizontal
    
    // Store vertices and indices for physics
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;
    
    // Apply height map to vertices
    const heightMap = [];
    
    for (let i = 0, l = vertices.length; i < l; i += 3) {
      // Get the vertex coordinates
      const x = vertices[i] + offsetX;
      const z = vertices[i + 2] + offsetZ;
      
      // Calculate height using simplex noise
      const height = this.getNoiseHeight(x, z);
      
      // Update vertex Y position
      vertices[i + 1] = height;
      
      // Store height for later use
      heightMap.push(height);
    }
    
    // Update normals
    geometry.computeVertexNormals();
    
    // Create material
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x556B2F,  // Dark olive green
      flatShading: false,
      roughness: 0.9,
      metalness: 0.1,
    });
    
    // Create mesh
    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    terrainMesh.position.set(offsetX, 0, offsetZ);
    
    // Add ground texture
    this.applyGroundTexture(terrainMesh);
    
    // Add to scene
    this.scene.add(terrainMesh);
    
    // Store mesh in chunk
    chunk.terrain = terrainMesh;
    
    // Add physics body for terrain if physics is enabled
    if (this.context && this.context.systems && this.context.systems.physics) {
      this.physicsEnabled = true;
      
      // Create a physics body for the terrain
      // When creating terrain physics, we need to adjust vertices to be in chunk local space
      const physicsVertices = new Float32Array(vertices.length);
      
      // Copy and adjust vertices for physics (local space)
      for (let i = 0; i < vertices.length; i += 3) {
        physicsVertices[i] = vertices[i]; // X
        physicsVertices[i + 1] = vertices[i + 1]; // Y (height)
        physicsVertices[i + 2] = vertices[i + 2]; // Z
      }
      
      const terrainBody = this.context.systems.physics.createTerrainBody(
        terrainMesh,
        physicsVertices,
        indices
      );
      
      // Store the physics body reference
      this.terrainBodies.set(chunk.key, terrainBody);
    }
    
    // Return the terrain mesh
    return terrainMesh;
  }
  
  populateChunk(chunk) {
    // Determine how many trees and rocks to add based on chunk size
    const treeCount = 5 + Math.floor(Math.random() * 5);
    const rockCount = 3 + Math.floor(Math.random() * 3);
    
    // World-space coordinates of chunk's corner
    const worldX = chunk.x * this.chunkSize;
    const worldZ = chunk.z * this.chunkSize;
    
    // Add trees
    for (let i = 0; i < treeCount; i++) {
      // Random position within chunk
      const x = worldX + Math.random() * this.chunkSize;
      const z = worldZ + Math.random() * this.chunkSize;
      
      // Get height at this position
      const y = this.getHeightAt(x, z);
      
      // Create tree with a small offset to ensure it sits properly on the terrain
      const tree = new Tree(this.scene, new THREE.Vector3(x, y, z));
      
      // Add to object lists
      this.objects.push(tree);
      chunk.objects.push(tree);
    }
    
    // Add rocks
    for (let i = 0; i < rockCount; i++) {
      // Random position within chunk
      const x = worldX + Math.random() * this.chunkSize;
      const z = worldZ + Math.random() * this.chunkSize;
      
      // Get height at this position
      const y = this.getHeightAt(x, z);
      
      // Create rock with a small offset to ensure it sits properly on the terrain
      const rock = new Rock(this.scene, new THREE.Vector3(x, y, z));
      
      // Add to object lists
      this.objects.push(rock);
      chunk.objects.push(rock);
    }
  }
  
  addLighting() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    
    // Increase shadow map size for better quality
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    
    // Adjust shadow camera to fit scene
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    
    this.scene.add(directionalLight);
  }
  
  generateClouds(count) {
    this.clouds = [];
    
    for (let i = 0; i < count; i++) {
      // Random position high in the sky
      const x = (Math.random() - 0.5) * this.worldSize * 1.5;
      const y = 20 + Math.random() * 10; // Height between 20-30 units
      const z = (Math.random() - 0.5) * this.worldSize * 1.5;
      
      // Create cloud
      const cloud = new Cloud(this.scene, new THREE.Vector3(x, y, z));
      this.clouds.push(cloud);
    }
  }
  
  updateClouds(deltaTime) {
    // Update clouds
    for (const cloud of this.clouds) {
      cloud.update(deltaTime);
    }
  }
  
  getHeightAt(x, z) {
    // Find the chunk that contains this position
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    const chunk = this.chunks.get(chunkKey);
    if (!chunk || !chunk.heightMap) return 0;
    
    // Local coordinates within the chunk
    const localX = x - chunkX * this.chunkSize;
    const localZ = z - chunkZ * this.chunkSize;
    
    // Convert to heightmap coordinates (as float, not just indices)
    const terrainResolution = 32; // Must match the value in generateTerrainForChunk
    const gridX = (localX / this.chunkSize) * terrainResolution;
    const gridZ = (localZ / this.chunkSize) * terrainResolution;
    
    // Get the grid cell indices
    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, terrainResolution - 1);
    const z1 = Math.min(z0 + 1, terrainResolution - 1);
    
    // Check bounds
    if (x0 < 0 || x0 >= terrainResolution || z0 < 0 || z0 >= terrainResolution) {
      return 0;
    }
    
    // Get fractional part for interpolation
    const fracX = gridX - x0;
    const fracZ = gridZ - z0;
    
    // Get height values at the four corners of the grid cell
    const h00 = chunk.heightMap[x0 + z0 * terrainResolution];
    const h10 = chunk.heightMap[x1 + z0 * terrainResolution];
    const h01 = chunk.heightMap[x0 + z1 * terrainResolution];
    const h11 = chunk.heightMap[x1 + z1 * terrainResolution];
    
    // Bilinear interpolation
    const hx0 = h00 * (1 - fracX) + h10 * fracX;
    const hx1 = h01 * (1 - fracX) + h11 * fracX;
    const finalHeight = hx0 * (1 - fracZ) + hx1 * fracZ;
    
    return finalHeight;
  }
  
  checkInteraction(position, radius) {
    // Check for nearby interactive objects
    for (const object of this.objects) {
      const distance = position.distanceTo(object.getPosition());
      
      if (distance < radius && object.canInteract()) {
        return object;
      }
    }
    
    return null;
  }
  
  // Method to get all objects near a position (used for minimap)
  getObjectsNear(position, radius) {
    return this.objects.filter(obj => {
      const distance = position.distanceTo(obj.getPosition());
      return distance < radius;
    });
  }
  
  getNoiseHeight(x, z) {
    // Scale down coordinates for more natural looking terrain
    const scaledX = x * 0.05;
    const scaledZ = z * 0.05;
    
    // Generate multi-octave noise
    const largeScale = this.simplex.noise(scaledX * 0.2, scaledZ * 0.2) * 0.8;
    const mediumScale = this.simplex.noise(scaledX * 0.4, scaledZ * 0.4) * 0.3;
    const smallScale = this.simplex.noise(scaledX * 1.0, scaledZ * 1.0) * 0.1;
    
    // Combine noise values and apply height scale
    return (largeScale + mediumScale + smallScale) * this.heightScale;
  }
  
  applyGroundTexture(terrainMesh) {
    // We'll keep this simple for now - could add actual textures later
    // Create simple grass-like coloring with subtle variation
    const geometry = terrainMesh.geometry;
    const positionAttribute = geometry.getAttribute('position');
    const colors = [];
    
    // Get bounding box to determine height range
    geometry.computeBoundingBox();
    const minY = geometry.boundingBox.min.y;
    const maxY = geometry.boundingBox.max.y;
    const heightRange = maxY - minY;
    
    // Add color variations based on height and subtle noise
    for (let i = 0; i < positionAttribute.count; i++) {
      const y = positionAttribute.getY(i);
      
      // Normalize height (0 to 1 range)
      const normalizedHeight = (y - minY) / heightRange;
      
      // Generate a slight random variation
      const noise = Math.random() * 0.1;
      
      // Create color based on height:
      // - Lower areas: darker green (grass)
      // - Higher areas: more brownish (dirt/stone)
      const r = 0.2 + normalizedHeight * 0.3 + noise;
      const g = 0.5 - normalizedHeight * 0.2 + noise;
      const b = 0.1 + noise * 0.1;
      
      colors.push(r, g, b);
    }
    
    // Add colors to geometry
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Update material to use vertex colors
    terrainMesh.material.vertexColors = true;
  }
} 