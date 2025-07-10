import { 
    openDB, 
    saveAssessment, 
    getAllAssessments, 
    getAssessmentById, 
    deleteAssessment 
} from './db.js';

// App state
let currentAssessment = null;
let riskCharts = {};
let watchConnected = false;
let encryptionKey = null;
let bluetoothDevice = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize database
        await openDB();
        
        // Load any previous assessments
        await loadPreviousAssessments();
        
        // Set up UI event listeners
        setupEventListeners();
        
        // Initialize service worker for PWA
        initServiceWorker();
        
        // Set up install prompt
        setupInstallPrompt();
        
        console.log('Application initialized');
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application. Please refresh the page.');
    }
});

// Set up all event listeners
function setupEventListeners() {
    // Start assessment button
    document.getElementById('start-assessment-btn').addEventListener('click', () => {
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('assessment-form').classList.remove('hidden');
    });
    
    // Diabetes duration field control
    document.getElementById('diabetes').addEventListener('change', function() {
        const durationField = document.getElementById('duration');
        if (this.value === 'type1' || this.value === 'type2') {
            durationField.disabled = false;
            durationField.required = true;
        } else {
            durationField.disabled = true;
            durationField.required = false;
            durationField.value = '0';
        }
    });
    
    // Family diseases container control
    document.getElementById('family_history').addEventListener('change', function() {
        const container = document.getElementById('family-diseases-container');
        if (this.value !== 'no') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            document.querySelectorAll('input[name="family_diseases"]').forEach(el => el.checked = false);
        }
    });
    
    // Form submission
    document.getElementById('ckd-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await calculateRisk();
    });
    
    // Reset button
    document.getElementById('reset-btn').addEventListener('click', function() {
        resetForm();
    });
    
    // Download buttons
    document.getElementById('download-image').addEventListener('click', downloadAsImage);
    document.getElementById('download-text').addEventListener('click', downloadTextReport);
    document.getElementById('share-results-btn').addEventListener('click', shareResults);
    
    // Chatbot toggle
    document.getElementById('chatbot-toggle').addEventListener('click', function() {
        document.getElementById('chatbot-container').classList.toggle('chatbot-visible');
    });
    
    // Privacy policy links
    document.getElementById('privacy-policy-btn').addEventListener('click', showPrivacyModal);
    document.getElementById('footer-privacy-link').addEventListener('click', showPrivacyModal);
    
    // Close modal buttons
    document.getElementById('close-privacy-modal').addEventListener('click', hidePrivacyModal);
    document.getElementById('close-privacy-modal-bottom').addEventListener('click', hidePrivacyModal);
    
    // Data management buttons
    document.getElementById('view-data-btn').addEventListener('click', viewStoredData);
    document.getElementById('delete-data-btn').addEventListener('click', deleteStoredData);
    
    // Smartwatch connection
    document.getElementById('connect-watch-btn').addEventListener('click', toggleSmartwatchConnection);
    
    // Encryption toggle
    document.getElementById('enable-encryption').addEventListener('change', updateEncryptionStatus);
    
    // Bluetooth toggle
    document.getElementById('enable-bluetooth').addEventListener('change', function() {
        if (!this.checked && watchConnected) {
            disconnectSmartwatch();
        }
    });
    
    // History navigation
    document.getElementById('view-history-btn').addEventListener('click', showHistoryView);
    document.getElementById('back-to-results-btn').addEventListener('click', showResultsView);
    
    // Initialize encryption status
    updateEncryptionStatus();
}

// Initialize Service Worker
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope:', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed:', err);
            });
    }
}

// Set up install prompt
function setupInstallPrompt() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.style.display = 'block';
            installButton.addEventListener('click', () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted install prompt');
                    }
                    deferredPrompt = null;
                });
            });
        }
    });
}

// Load previous assessments from database
async function loadPreviousAssessments() {
    try {
        const assessments = await getAllAssessments();
        if (assessments.length > 0) {
            // Update history button to show count
            const historyBtn = document.getElementById('view-history-btn');
            historyBtn.innerHTML += ` <span class="badge">${assessments.length}</span>`;
        }
    } catch (error) {
        console.error('Error loading previous assessments:', error);
    }
}

// Show history view
async function showHistoryView() {
    try {
        const assessments = await getAllAssessments();
        
        const historyContainer = document.getElementById('history-container');
        historyContainer.innerHTML = '';
        
        if (assessments.length === 0) {
            historyContainer.innerHTML = '<p class="no-history">No previous assessments found.</p>';
        } else {
            assessments.forEach(assessment => {
                const date = new Date(assessment.timestamp);
                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <div class="history-card-header">
                        <h4>${date.toLocaleDateString()}</h4>
                        <span class="risk-badge risk-${assessment.riskLevel || 'unknown'}">
                            ${assessment.riskLevel ? assessment.riskLevel.toUpperCase() : 'N/A'}
                        </span>
                    </div>
                    <p>Age: ${assessment.age}, ${assessment.sex === 'male' ? 'Male' : 'Female'}</p>
                    <p>Score: ${assessment.riskScore || 'N/A'}/20</p>
                    <div class="history-card-actions">
                        <button class="view-assessment-btn" data-id="${assessment.id}">View</button>
                        <button class="delete-assessment-btn" data-id="${assessment.id}">Delete</button>
                    </div>
                `;
                historyContainer.appendChild(card);
            });
            
            // Add event listeners to the buttons
            document.querySelectorAll('.view-assessment-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id);
                    await loadAssessment(id);
                    showResultsView();
                });
            });
            
            document.querySelectorAll('.delete-assessment-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = parseInt(e.target.dataset.id);
                    if (confirm('Are you sure you want to delete this assessment?')) {
                        await deleteAssessment(id);
                        await loadPreviousAssessments();
                        showHistoryView();
                    }
                });
            });
        }
        
        // Switch views
        document.getElementById('result').classList.add('hidden');
        document.getElementById('visualizations').classList.add('hidden');
        document.getElementById('history-view').classList.remove('hidden');
    } catch (error) {
        console.error('Error showing history view:', error);
        showError('Failed to load assessment history.');
    }
}

// Load a specific assessment from history
async function loadAssessment(id) {
    try {
        const assessment = await getAssessmentById(id);
        currentAssessment = assessment;
        
        // Display the assessment results
        displayResults();
        createVisualizations();
        
        // Show results sections
        document.getElementById('result').classList.remove('hidden');
        document.getElementById('visualizations').classList.remove('hidden');
        
        return true;
    } catch (error) {
        console.error('Error loading assessment:', error);
        showError('Failed to load assessment.');
        return false;
    }
}

// Show results view (from history)
function showResultsView() {
    document.getElementById('history-view').classList.add('hidden');
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('visualizations').classList.remove('hidden');
}

// ... [Rest of your existing functions like calculateRisk, displayResults, 
// createVisualizations, etc. remain the same, just make sure to use currentAssessment 
// instead of userRiskData and add await saveAssessment() where appropriate]

// Helper function to show error messages
function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    } else {
        alert(message);
    }
}

// Initialize the app when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
