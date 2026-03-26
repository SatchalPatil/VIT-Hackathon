/**
 * shipper.js - Shipper profile scoring and management
 */

const SHIPPER_KEY = 'ciibs_shippers';

/**
 * Risk level to numeric score conversion
 */
const RISK_SCORES = {
    'low': 25,
    'medium': 55,
    'high': 80,
    'critical': 95
};

/**
 * Get all shipper profiles
 * @returns {Object} Shipper profiles keyed by name
 */
function getAllShippers() {
    const data = localStorage.getItem(SHIPPER_KEY);
    return data ? JSON.parse(data) : {};
}

/**
 * Save shipper profiles
 * @param {Object} shippers - Shipper profiles
 */
function saveShippers(shippers) {
    localStorage.setItem(SHIPPER_KEY, JSON.stringify(shippers));
}

/**
 * Get a single shipper profile
 * @param {string} name - Shipper name
 * @returns {Object|null} Shipper profile or null
 */
function getShipperProfile(name) {
    const shippers = getAllShippers();
    return shippers[name] || null;
}

/**
 * Calculate composite risk score
 * @param {Object} profile - Shipper profile
 * @returns {number} Composite risk score (0-100)
 */
function calculateCompositeRisk(profile) {
    const history = profile.riskHistory || [];

    if (history.length === 0) return 0;

    // Weighted average: newer entries have higher weight
    let weightedSum = 0;
    let weightSum = 0;

    history.forEach((score, index) => {
        const weight = index + 1; // Index 0 gets weight 1, last gets weight = length
        weightedSum += score * weight;
        weightSum += weight;
    });

    const weightedAverage = weightedSum / weightSum;

    // Flag penalty: (flagged / totalScans) * 30
    const flagPenalty = profile.totalScans > 0
        ? (profile.flagged / profile.totalScans) * 30
        : 0;

    return Math.min(100, Math.round(weightedAverage + flagPenalty));
}

/**
 * Update or create shipper profile after scan
 * @param {Object} scanResult - Scan result from AI
 * @param {string} shipperName - Shipper name
 * @param {string} officerAction - Officer action (flagged/cleared/escalated)
 * @param {string} route - Shipping route
 * @returns {Object} Updated profile
 */
function updateShipperProfile(scanResult, shipperName, officerAction, route) {
    if (!shipperName || shipperName.trim() === '') return null;

    const shippers = getAllShippers();
    const now = new Date().toISOString();

    // Get or create profile
    let profile = shippers[shipperName] || {
        name: shipperName,
        totalScans: 0,
        flagged: 0,
        cleared: 0,
        confirmed: 0,
        highRisk: 0,
        riskHistory: [],
        compositeRisk: 0,
        firstSeen: now,
        lastSeen: now,
        routes: []
    };

    // Update scan count
    profile.totalScans++;
    profile.lastSeen = now;

    // Convert risk level to numeric and add to history
    const riskLevel = scanResult.overall_risk || 'low';
    const riskScore = RISK_SCORES[riskLevel] || 25;
    profile.riskHistory.push(riskScore);

    // Keep only last 10 entries
    if (profile.riskHistory.length > 10) {
        profile.riskHistory = profile.riskHistory.slice(-10);
    }

    // Track high risk scans
    if (riskLevel === 'high' || riskLevel === 'critical') {
        profile.highRisk++;
    }

    // Update action counts
    if (officerAction === 'flagged' || officerAction === 'escalated') {
        profile.flagged++;
    } else if (officerAction === 'cleared') {
        profile.cleared++;
    }

    // Add route if new
    if (route && !profile.routes.includes(route)) {
        profile.routes.push(route);
    }

    // Recalculate composite risk
    profile.compositeRisk = calculateCompositeRisk(profile);

    // Save
    shippers[shipperName] = profile;
    saveShippers(shippers);

    return profile;
}

/**
 * Update confirmed count when physical outcome recorded
 * @param {string} shipperName - Shipper name
 * @param {string} outcome - Physical outcome (confirmed/false_positive/partial)
 */
function updatePhysicalOutcome(shipperName, outcome) {
    const shippers = getAllShippers();
    const profile = shippers[shipperName];

    if (!profile) return;

    if (outcome === 'confirmed') {
        profile.confirmed++;
    }

    // Recalculate composite risk
    profile.compositeRisk = calculateCompositeRisk(profile);

    shippers[shipperName] = profile;
    saveShippers(shippers);
}

/**
 * Get risk tier from composite score
 * @param {number} score - Composite risk score
 * @returns {Object} Tier info {label, color, bgColor}
 */
function getRiskTier(score) {
    if (score >= 90) return { label: 'CRITICAL', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' };
    if (score >= 75) return { label: 'HIGH', color: '#f97316', bgColor: 'rgba(249,115,22,0.1)' };
    if (score >= 51) return { label: 'MODERATE', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' };
    if (score >= 31) return { label: 'LOW', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
    return { label: 'CLEAR', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
}

/**
 * Get all shippers as sorted array
 * @param {string} sortBy - Sort field (risk/scans/lastSeen)
 * @param {string} filter - Filter (all/high/watchlist)
 * @returns {Array} Sorted shipper array
 */
function getShipperList(sortBy = 'risk', filter = 'all') {
    const shippers = getAllShippers();
    let list = Object.values(shippers);

    // Apply filter
    if (filter === 'high') {
        list = list.filter(s => s.compositeRisk >= 70);
    } else if (filter === 'watchlist') {
        list = list.filter(s => s.compositeRisk >= 70 || s.flagged >= 3);
    }

    // Apply sort
    if (sortBy === 'risk') {
        list.sort((a, b) => b.compositeRisk - a.compositeRisk);
    } else if (sortBy === 'scans') {
        list.sort((a, b) => b.totalScans - a.totalScans);
    } else if (sortBy === 'lastSeen') {
        list.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    }

    return list;
}

/**
 * Generate sparkline SVG path for risk history
 * @param {Array} history - Risk history array
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {string} SVG path d attribute
 */
function generateSparklinePath(history, width = 300, height = 32) {
    if (history.length < 2) return '';

    const padding = 4;
    const graphWidth = width - (padding * 2);
    const graphHeight = height - (padding * 2);

    const points = history.map((value, index) => {
        const x = padding + (index / (history.length - 1)) * graphWidth;
        const y = padding + graphHeight - (value / 100) * graphHeight;
        return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
}

/**
 * Clear all shipper data
 */
function clearAll() {
    localStorage.removeItem(SHIPPER_KEY);
}

// Export for use in other modules
window.Shipper = {
    getAllShippers,
    getShipperProfile,
    updateShipperProfile,
    updatePhysicalOutcome,
    getRiskTier,
    getShipperList,
    generateSparklinePath,
    calculateCompositeRisk,
    clearAll
};
