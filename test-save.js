const fs = require('fs').promises;
const path = require('path');

async function testSave() {
  try {
    const testData = {
      "id": "test-location",
      "name": "Test Location",
      "test": "This is a test save"
    };
    
    const filePath = path.join(__dirname, 'src', 'renderer', 'components', 'game', 'locations', 'test-location.json');
    console.log('Saving to:', filePath);
    
    await fs.writeFile(filePath, JSON.stringify(testData, null, 2), 'utf-8');
    console.log('File saved successfully');
    
    // Read it back to verify
    const savedData = await fs.readFile(filePath, 'utf-8');
    console.log('Saved data:', savedData);
  } catch (error) {
    console.error('Error:', error);
  }
}

testSave();