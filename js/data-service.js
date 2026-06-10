/**
 * js/data-service.js - Data fetching service for VGUMap
 */

export async function fetchBoundaries() {
  try {
    const response = await fetch('data/boundaries.csv');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    return csvText;
  } catch (error) {
    console.error('Failed to fetch boundaries CSV:', error);
    throw error;
  }
}
