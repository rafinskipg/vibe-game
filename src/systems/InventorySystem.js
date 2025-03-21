export class InventorySystem {
  constructor() {
    this.inventory = {
      wood: 0,
      stone: 0
    };
    
    this.uiElements = {
      woodCount: null,
      stoneCount: null
    };
  }
  
  initUI() {
    // Get UI elements
    this.uiElements.woodCount = document.getElementById('wood-count');
    this.uiElements.stoneCount = document.getElementById('stone-count');
    
    // Update UI
    this.updateUI();
  }
  
  addItem(type, amount) {
    // Check if this type of item is supported
    if (this.inventory.hasOwnProperty(type)) {
      this.inventory[type] += amount;
      
      // Show brief animation to indicate item added
      this.showAddedAnimation(type, amount);
      
      // Update UI
      this.updateUI();
      
      return true;
    }
    
    return false;
  }
  
  removeItem(type, amount) {
    // Check if this type of item is supported and if we have enough
    if (this.inventory.hasOwnProperty(type) && this.inventory[type] >= amount) {
      this.inventory[type] -= amount;
      
      // Update UI
      this.updateUI();
      
      return true;
    }
    
    return false;
  }
  
  getItemCount(type) {
    if (this.inventory.hasOwnProperty(type)) {
      return this.inventory[type];
    }
    
    return 0;
  }
  
  updateUI() {
    // Update UI elements with current inventory counts
    if (this.uiElements.woodCount) {
      this.uiElements.woodCount.textContent = this.inventory.wood;
    }
    
    if (this.uiElements.stoneCount) {
      this.uiElements.stoneCount.textContent = this.inventory.stone;
    }
  }
  
  showAddedAnimation(type, amount) {
    // Create a temporary element to show an animation
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = '20px';
    element.style.left = '50%';
    element.style.transform = 'translateX(-50%)';
    element.style.color = 'white';
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    element.style.padding = '5px 10px';
    element.style.borderRadius = '3px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.pointerEvents = 'none';
    element.style.transition = 'opacity 1s, transform 1s';
    element.style.opacity = '1';
    
    // Set content
    element.textContent = `+${amount} ${type}`;
    
    // Add to document
    document.body.appendChild(element);
    
    // Start animation
    setTimeout(() => {
      element.style.opacity = '0';
      element.style.transform = 'translateX(-50%) translateY(-20px)';
    }, 100);
    
    // Remove element after animation
    setTimeout(() => {
      document.body.removeChild(element);
    }, 1100);
  }
} 