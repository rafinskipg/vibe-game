export class InputController {
  constructor() {
    // Input states
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      action: false,
    };
    
    // Mouse movement
    this.mouseMovement = {
      x: 0,
      y: 0
    };
    
    // Mouse state
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.pointerLocked = false;
    this.wheelDelta = 0;
    
    // Settings
    this.mouseSensitivity = 0.002; // REDUCED from 0.01 to 0.002 for much gentler camera movement
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Keyboard events
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    
    // Mouse events
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));
    document.addEventListener('wheel', (e) => this.onWheel(e));
    document.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent context menu on right-click
    
    // Handle pointer lock for first-person controls
    document.addEventListener('click', (e) => {
      // Only lock pointer on left click
      if (e.button === 0) {
        this.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    
    // Camera control toggles
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC') {
        // Toggle camera mode on C key press
        if (this.cameraModeToggleCallback) {
          this.cameraModeToggleCallback();
        }
      } else if (e.code === 'KeyR') {
        // Toggle always-rotate with mouse on R key press
        if (this.cameraRotationToggleCallback) {
          this.cameraRotationToggleCallback();
        }
      }
    });
  }
  
  onKeyDown(event) {
    switch(event.code) {
      case 'KeyW':
        this.keys.forward = true;
        break;
      case 'KeyS':
        this.keys.backward = true;
        break;
      case 'KeyA':
        this.keys.left = true;
        break;
      case 'KeyD':
        this.keys.right = true;
        break;
      case 'Space':
        this.keys.jump = true;
        break;
      case 'KeyE':
        this.keys.action = true;
        break;
    }
  }
  
  onKeyUp(event) {
    switch(event.code) {
      case 'KeyW':
        this.keys.forward = false;
        break;
      case 'KeyS':
        this.keys.backward = false;
        break;
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'KeyD':
        this.keys.right = false;
        break;
      case 'Space':
        this.keys.jump = false;
        break;
      case 'KeyE':
        this.keys.action = false;
        break;
    }
  }
  
  onMouseDown(event) {
    if (event.button === 0) {
      // Left mouse button
      this.mouseDown = true;
    } else if (event.button === 2) {
      // Right mouse button
      this.rightMouseDown = true;
    }
  }
  
  onMouseUp(event) {
    if (event.button === 0) {
      // Left mouse button
      this.mouseDown = false;
    } else if (event.button === 2) {
      // Right mouse button
      this.rightMouseDown = false;
    }
  }
  
  onMouseMove(event) {
    // Always capture mouse movement for camera rotation, with higher sensitivity
    this.mouseMovement.x = event.movementX * this.mouseSensitivity;
    this.mouseMovement.y = event.movementY * this.mouseSensitivity;
    
    // If no movement is detected directly (can happen without pointer lock),
    // use the difference in screen coordinates as a fallback
    if (Math.abs(this.mouseMovement.x) < 0.0001 && Math.abs(this.mouseMovement.y) < 0.0001) {
      // We need to track previous position for this to work
      if (this.prevMouseX !== undefined && this.prevMouseY !== undefined) {
        this.mouseMovement.x = (event.clientX - this.prevMouseX) * this.mouseSensitivity;
        this.mouseMovement.y = (event.clientY - this.prevMouseY) * this.mouseSensitivity;
      }
    }
    
    // Store current position for next frame
    this.prevMouseX = event.clientX;
    this.prevMouseY = event.clientY;
  }
  
  onWheel(event) {
    // Capture mouse wheel for camera zooming
    // Normalize wheel delta across browsers
    this.wheelDelta = Math.sign(event.deltaY) * 0.5;
  }
  
  resetMouseMovement() {
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }
  
  resetWheelDelta() {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }
  
  requestPointerLock() {
    if (!this.pointerLocked) {
      document.body.requestPointerLock();
    }
  }
  
  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === document.body;
  }
  
  isActionPressed() {
    const result = this.keys.action;
    // Reset the action key to prevent multiple interactions
    this.keys.action = false;
    return result;
  }
  
  update(deltaTime) {
    // No continuous updates needed for this controller
  }
  
  getMouseMovement() {
    return {
      x: this.mouseMovement.x,
      y: this.mouseMovement.y
    };
  }
  
  // Register callback for camera mode toggle
  onCameraModeToggle(callback) {
    this.cameraModeToggleCallback = callback;
  }
  
  // Register callback for camera rotation toggle
  onCameraRotationToggle(callback) {
    this.cameraRotationToggleCallback = callback;
  }
  
  // Adjust mouse sensitivity
  setMouseSensitivity(value) {
    this.mouseSensitivity = value;
  }
} 