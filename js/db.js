// Database configuration
const DB_NAME = 'CKD_Prediction_DB';
const DB_VERSION = 1;
const STORE_NAME = 'assessments';

let db;

// Open or create the database
export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject('Database error: ' + event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create the assessments object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                
                // Create indexes for efficient querying
                store.createIndex('by_date', 'timestamp', { unique: false });
                store.createIndex('by_risk', 'riskScore', { unique: false });
                
                console.log('Database store created');
            }
        };
    });
}

// Save an assessment to the database
export function saveAssessment(assessmentData) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Add timestamp to the assessment
        const completeData = {
            ...assessmentData,
            timestamp: new Date().getTime()
        };

        const request = store.add(completeData);

        request.onsuccess = () => {
            console.log('Assessment saved with ID:', request.result);
            resolve(request.result);
        };

        request.onerror = (event) => {
            console.error('Error saving assessment:', event.target.error);
            reject('Error saving assessment: ' + event.target.error);
        };
    });
}

// Get all assessments from the database
export function getAllAssessments() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('by_date');
        const request = index.getAll();

        request.onsuccess = () => {
            // Sort by date (newest first)
            const assessments = request.result.sort((a, b) => b.timestamp - a.timestamp);
            console.log('Retrieved assessments:', assessments.length);
            resolve(assessments);
        };

        request.onerror = (event) => {
            console.error('Error retrieving assessments:', event.target.error);
            reject('Error retrieving assessments: ' + event.target.error);
        };
    });
}

// Get a specific assessment by ID
export function getAssessmentById(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            if (request.result) {
                console.log('Retrieved assessment:', request.result.id);
                resolve(request.result);
            } else {
                reject('Assessment not found');
            }
        };

        request.onerror = (event) => {
            console.error('Error retrieving assessment:', event.target.error);
            reject('Error retrieving assessment: ' + event.target.error);
        };
    });
}

// Delete an assessment from the database
export function deleteAssessment(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject('Database not initialized');
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log('Assessment deleted:', id);
            resolve(true);
        };

        request.onerror = (event) => {
            console.error('Error deleting assessment:', event.target.error);
            reject('Error deleting assessment: ' + event.target.error);
        };
    });
}
