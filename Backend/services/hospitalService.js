const fs = require('fs');
const csv = require('csv-parser');
const Fuse = require('fuse.js');

let hospitals = [];
let fuse;

const loadData = () => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream('hospitals.csv')
            .pipe(csv())
            .on('data', (data) => {
                // Keep this TRICK: It cleans invisible characters from headers
                const cleanData = {};
                Object.keys(data).forEach(key => {
                    const cleanKey = key.trim().replace(/^\ufeff/, ''); 
                    cleanData[cleanKey] = data[key];
                });
                results.push(cleanData);
            })
            .on('end', () => {
                hospitals = results;
                
                // Configure Search for YOUR specific headers
                const options = {
                    keys: ['HOSPITAL NAME', 'CITY', 'Address'], 
                    threshold: 0.3
                };
                fuse = new Fuse(hospitals, options);
                console.log(`Loaded ${hospitals.length} hospitals.`);
                resolve();
            });
    });
};

const searchHospitals = (query, location) => {
    // 1. Filter by Location
    let searchSpace = hospitals;
    if (location) {
        const locLower = location.toLowerCase();
        searchSpace = hospitals.filter(h => {
            const city = h['CITY'] || "";
            const address = h['Address'] || "";
            return city.toLowerCase().includes(locLower) || address.toLowerCase().includes(locLower);
        });
    }

    // 2. Search Logic
    let results = [];
    if (!query) {
        // If no hospital name mentioned, show top 3 near location
        results = searchSpace.slice(0, 3).map(item => ({ item }));
    } else {
        // Search specific hospital name
        const localFuse = new Fuse(searchSpace, {
            keys: ['HOSPITAL NAME'], 
            threshold: 0.3
        });
        results = localFuse.search(query).slice(0, 3);
    }

    // 3. Output Formatting
    return results.map(r => {
        const h = r.item;
        // EXACT HEADERS - No more "Unknown"
        const name = h['HOSPITAL NAME'] || "Unknown Hospital";
        const city = h['CITY'] || "Unknown City";
        const address = h['Address'] || "";
        
        return `${name} in ${city}, ${address}`;
    });
};

module.exports = { loadData, searchHospitals };