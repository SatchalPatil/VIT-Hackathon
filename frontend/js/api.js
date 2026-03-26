/**
 * api.js - All fetch() calls to FastAPI backend
 */

const API_BASE = 'http://localhost:8000';

/**
 * Analyze a cargo X-ray image
 * @param {FormData} formData - Contains image, manifest, shipper, route
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeImage(formData) {
    const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Analysis failed');
    }

    return response.json();
}

/**
 * Compare two cargo X-ray images
 * @param {FormData} formData - Contains image1, image2
 * @returns {Promise<Object>} Comparison result
 */
async function compareImages(formData) {
    const response = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Comparison failed');
    }

    return response.json();
}

/**
 * Ask a what-if question about a scan
 * @param {Object} context - Scan result context
 * @param {string} question - Officer's question
 * @returns {Promise<Object>} AI answer
 */
async function whatifQuery(context, question) {
    const response = await fetch(`${API_BASE}/whatif`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ context, question })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Query failed');
    }

    return response.json();
}

/**
 * Generate a PDF report (server-side)
 * @param {Object} scanData - Scan data for report
 * @returns {Promise<Blob>} PDF blob
 */
async function generateReportPDF(scanData) {
    const response = await fetch(`${API_BASE}/report`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(scanData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Report generation failed');
    }

    return response.blob();
}

/**
 * Check API health
 * @returns {Promise<Object>} Health status
 */
async function checkHealth() {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
}

// Export functions for use in other modules
window.API = {
    analyzeImage,
    compareImages,
    whatifQuery,
    generateReportPDF,
    checkHealth
};
