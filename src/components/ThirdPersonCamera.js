import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(player, renderer, options = {}) {
    this.player = player;
    this.renderer = renderer;
    
    // Camera options
    this.distance = options.distance || 10;
    this.height = options.height || 5;
    this.smoothing = options.smoothing || 0.25;
    
    // Orbital camera parameters
    this.angle = 0; // Horizontal angle around player (in radians)
    this.verticalAngle = 0.3; // Vertical angle (in radians) - further reduced for a better starting position
    this.verticalMin = -0.15; // Minimum vertical angle - reduced to prevent looking too far down
    this.verticalMax = 0.5; // Maximum vertical angle - significantly reduced to prevent top-down view
    
    // Horizontal rotation limits (in radians)
    this.horizontalMin = -Math.PI / 2; // 90 degrees left
    this.horizontalMax = Math.PI / 2;  // 90 degrees right
    this.defaultAngle = 0;             // Default forward-facing angle
    
    this.rotationSpeed = 2.5; // Horizontal rotation speed REDUCED from 5 to 2.5
    this.verticalRotationSpeed = 1.5; // Vertical rotation speed - REDUCED from 2 to 1.5
    this.isOrbitalMode = true; // Whether camera is in orbital mode or following player rotation
    this.alwaysRotateWithMouse = true; // Always rotate with mouse movement
    this.alignPlayerWithCamera = true; // Whether player should align with camera direction
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    
    // Set initial position
    this.updatePosition();
  }
  
  update(deltaTime, inputController = null) {
    // Handle rotation if we have input controller
    if (inputController) {
      if (this.isOrbitalMode) {
        if (this.alwaysRotateWithMouse || inputController.rightMouseDown) {
          // Save previous angle for player rotation
          const prevAngle = this.angle;
          
          // Apply movement dampening factor to make camera feel more stable
          const dampingFactor = 0.7; // Reduces effective mouse movement
          
          // Horizontal rotation (with limits)
          this.angle -= inputController.mouseMovement.x * this.rotationSpeed * dampingFactor;
          
          // Apply horizontal limits - relative to player's forward direction
          this.angle = Math.max(this.defaultAngle + this.horizontalMin, 
                               Math.min(this.defaultAngle + this.horizontalMax, this.angle));
          
          // Vertical rotation (limited by min/max angles) - using the slower vertical rotation speed
          this.verticalAngle -= inputController.mouseMovement.y * this.verticalRotationSpeed * dampingFactor;
          this.verticalAngle = Math.max(this.verticalMin, Math.min(this.verticalMax, this.verticalAngle));
          
          // Update player orientation if enabled
          if (this.alignPlayerWithCamera && Math.abs(prevAngle - this.angle) > 0.01) {
            this.alignPlayerToCamera();
          }
        }
      } else {
        // In follow mode, update player's rotation instead
        // This allows the player to follow the camera's view direction
        if (inputController.mouseMovement.x !== 0) {
          const playerRotation = this.player.getRotation();
          playerRotation.y -= inputController.mouseMovement.x * this.rotationSpeed;
          this.player.setRotation(playerRotation);
        }
      }
    }
    
    // Get target position based on player's position and orbital angle
    const targetPosition = this.calculateIdealPosition();
    
    // Smoothly interpolate current camera position toward target position
    this.camera.position.lerp(targetPosition, this.smoothing);
    
    // Always look at the player
    this.camera.lookAt(
      this.player.getPosition().x,
      this.player.getPosition().y + 1, // Look at player's head, not feet
      this.player.getPosition().z
    );
  }
  
  calculateIdealPosition() {
    // Get player's position
    const playerPosition = this.player.getPosition();
    
    let idealPosition;
    
    if (this.isOrbitalMode) {
      // In orbital mode, position is based on camera angle around player
      idealPosition = new THREE.Vector3(
        Math.sin(this.angle) * this.distance * Math.cos(this.verticalAngle),
        this.distance * Math.sin(this.verticalAngle) + this.height,
        Math.cos(this.angle) * this.distance * Math.cos(this.verticalAngle)
      );
      
      // Add to player position
      idealPosition.add(playerPosition);
    } else {
      // In follow mode, position is based on player's rotation
      const playerRotation = this.player.getRotation();
      
      // Calculate position behind the player based on camera distance
      idealPosition = new THREE.Vector3(0, 0, this.distance);
      idealPosition.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerRotation.y);
      
      // Add player position and camera height
      idealPosition.add(playerPosition);
      idealPosition.y += this.height;
    }
    
    return idealPosition;
  }
  
  updatePosition() {
    const idealPosition = this.calculateIdealPosition();
    this.camera.position.copy(idealPosition);
    
    // Look at the player
    this.camera.lookAt(
      this.player.getPosition().x,
      this.player.getPosition().y + 1,
      this.player.getPosition().z
    );
  }
  
  getCamera() {
    return this.camera;
  }
  
  // Toggle between orbital and follow modes
  toggleMode() {
    this.isOrbitalMode = !this.isOrbitalMode;
    
    // If switching to follow mode, align camera with player rotation
    if (!this.isOrbitalMode) {
      this.angle = this.player.getRotation().y;
    }
  }
  
  // Set camera modes
  setOrbitalMode(enabled) {
    this.isOrbitalMode = enabled;
    
    // If switching to follow mode, align camera with player rotation
    if (!this.isOrbitalMode) {
      this.angle = this.player.getRotation().y;
    }
  }
  
  // Toggle whether mouse always rotates camera
  toggleAlwaysRotateWithMouse() {
    this.alwaysRotateWithMouse = !this.alwaysRotateWithMouse;
  }
  
  // Zoom in/out (adjust distance)
  zoom(delta) {
    this.distance += delta;
    this.distance = Math.max(3, Math.min(20, this.distance)); // Clamp between 3 and 20
  }
  
  // Align player rotation with camera direction
  alignPlayerToCamera() {
    // Calculate the direction the camera is looking
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    
    // Transform to world space based on camera angle
    // Create a rotation matrix from our orbital angle
    const rotationMatrix = new THREE.Matrix4().makeRotationY(this.angle);
    cameraDirection.applyMatrix4(rotationMatrix);
    
    // Calculate the angle in the XZ plane
    // Flip the direction (add PI) to make the player face away from the camera
    // rather than toward it, correcting the orientation
    const targetAngle = Math.atan2(cameraDirection.x, cameraDirection.z) + Math.PI;
    
    // Update player rotation to face the same direction as the camera
    const playerRotation = this.player.getRotation();
    playerRotation.y = targetAngle;
    this.player.setRotation(playerRotation);
    
    // Update the default angle to match the new player orientation
    this.defaultAngle = this.angle;
  }
  
  // Toggle player alignment with camera
  togglePlayerAlignment() {
    this.alignPlayerWithCamera = !this.alignPlayerWithCamera;
  }
} 