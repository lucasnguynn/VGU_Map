/**
 * js/store.js - Simple State Management for VGUMap
 * Manages: currentBuilding, currentFloor, currentRoom, searchQuery
 */

export class Store {
  constructor() {
    this.state = {
      currentBuilding: '',
      currentFloor: '',
      currentRoom: '',
      searchQuery: ''
    };
    this.listeners = new Set();
  }

  getState() {
    return { ...this.state };
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(callback => callback(this.getState()));
  }
}

// Create singleton instance
export const store = new Store();
