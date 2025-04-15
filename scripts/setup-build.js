const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
        console.log('Created data directory');
    } else {
        console.log('Data directory already exists');
    }
} catch (error) {
    console.error('Error creating data directory:', error);
    process.exit(1);
}