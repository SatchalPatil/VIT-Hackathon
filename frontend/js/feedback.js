/**
 * feedback.js - Feedback storage + accuracy calculation
 */

const FEEDBACK_KEY = 'ciibs_feedback';

/**
 * Generate a unique ID
 */
function generateId() {
    return 'fb-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get all feedback entries
 * @returns {Array} All feedback entries
 */
function getAllFeedback() {
    const data = localStorage.getItem(FEEDBACK_KEY);
    return data ? JSON.parse(data) : [];
}

/**
 * Save feedback entries
 * @param {Array} entries - Feedback entries
 */
function saveFeedback(entries) {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries));
}

/**
 * Add new feedback
 * @param {Object} data - Feedback data
 * @returns {Object} Created feedback entry
 */
function addFeedback(data) {
    const entries = getAllFeedback();

    const feedback = {
        feedbackId: generateId(),
        timestamp: new Date().toISOString(),
        entryId: data.entryId,
        scanId: data.scanId,
        detectionLabel: data.detectionLabel,
        detectionTier: data.detectionTier,
        isCorrect: data.isCorrect,
        officerComment: data.officerComment || ''
    };

    entries.push(feedback);
    saveFeedback(entries);

    return feedback;
}

/**
 * Calculate overall accuracy
 * @returns {number} Accuracy percentage (0-100)
 */
function calculateAccuracy() {
    const entries = getAllFeedback();

    if (entries.length === 0) return 0;

    const correct = entries.filter(f => f.isCorrect).length;
    return Math.round((correct / entries.length) * 100);
}

/**
 * Get feedback statistics
 * @returns {Object} Statistics
 */
function getStats() {
    const entries = getAllFeedback();

    return {
        total: entries.length,
        correct: entries.filter(f => f.isCorrect).length,
        falsePositives: entries.filter(f => !f.isCorrect).length,
        accuracy: calculateAccuracy()
    };
}

/**
 * Get accuracy trend (last N entries)
 * @param {number} count - Number of entries to include
 * @returns {Array} Array of {index, accuracy} objects
 */
function getAccuracyTrend(count = 20) {
    const entries = getAllFeedback();
    const trend = [];

    let correctSoFar = 0;
    const startIdx = Math.max(0, entries.length - count);

    for (let i = startIdx; i < entries.length; i++) {
        if (entries[i].isCorrect) correctSoFar++;
        const totalSoFar = i - startIdx + 1;
        trend.push({
            index: trend.length + 1,
            accuracy: Math.round((correctSoFar / totalSoFar) * 100)
        });
    }

    return trend;
}

/**
 * Get category breakdown
 * @returns {Object} Category stats keyed by label
 */
function getCategoryBreakdown() {
    const entries = getAllFeedback();
    const categories = {};

    entries.forEach(f => {
        const label = f.detectionLabel || 'Unknown';

        if (!categories[label]) {
            categories[label] = { correct: 0, falsePositive: 0, total: 0 };
        }

        categories[label].total++;
        if (f.isCorrect) {
            categories[label].correct++;
        } else {
            categories[label].falsePositive++;
        }
    });

    // Calculate accuracy for each category
    Object.keys(categories).forEach(label => {
        const cat = categories[label];
        cat.accuracy = cat.total > 0
            ? Math.round((cat.correct / cat.total) * 100)
            : 0;
    });

    return categories;
}

/**
 * Get feedback for a specific scan
 * @param {string} scanId - Scan ID
 * @returns {Array} Feedback entries for scan
 */
function getFeedbackForScan(scanId) {
    const entries = getAllFeedback();
    return entries.filter(f => f.scanId === scanId);
}

/**
 * Check if retraining threshold reached
 * @param {number} threshold - Entries needed for retraining (default 50)
 * @returns {Object} {reached, count, threshold}
 */
function checkRetrainingThreshold(threshold = 50) {
    const count = getAllFeedback().length;
    return {
        reached: count > 0 && count % threshold === 0,
        count: count,
        threshold: threshold,
        cyclesCompleted: Math.floor(count / threshold)
    };
}

/**
 * Clear all feedback
 */
function clearAll() {
    localStorage.removeItem(FEEDBACK_KEY);
}

// Export for use in other modules
window.Feedback = {
    getAllFeedback,
    addFeedback,
    calculateAccuracy,
    getStats,
    getAccuracyTrend,
    getCategoryBreakdown,
    getFeedbackForScan,
    checkRetrainingThreshold,
    clearAll
};
