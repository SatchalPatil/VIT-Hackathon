/**
 * confidence.js - Gauge SVG renderer + tier logic
 */

/**
 * Risk tier thresholds and colors
 */
const TIERS = {
    CRITICAL: { min: 90, max: 100, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', label: 'CRITICAL' },
    HIGH: { min: 75, max: 89, color: '#f97316', bgColor: 'rgba(249,115,22,0.1)', label: 'HIGH' },
    MODERATE: { min: 51, max: 74, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', label: 'MODERATE' },
    LOW: { min: 31, max: 50, color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)', label: 'LOW' },
    CLEAR: { min: 0, max: 30, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)', label: 'CLEAR' }
};

/**
 * Get tier info from confidence percentage
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {Object} Tier info
 */
function getTier(confidence) {
    if (confidence >= 90) return TIERS.CRITICAL;
    if (confidence >= 75) return TIERS.HIGH;
    if (confidence >= 51) return TIERS.MODERATE;
    if (confidence >= 31) return TIERS.LOW;
    return TIERS.CLEAR;
}

/**
 * Get tier from risk level string
 * @param {string} riskLevel - Risk level (low/medium/high/critical)
 * @returns {Object} Tier info
 */
function getTierFromRisk(riskLevel) {
    const level = (riskLevel || 'low').toLowerCase();
    switch (level) {
        case 'critical': return TIERS.CRITICAL;
        case 'high': return TIERS.HIGH;
        case 'medium':
        case 'moderate': return TIERS.MODERATE;
        case 'low': return TIERS.LOW;
        default: return TIERS.CLEAR;
    }
}

/**
 * Get recommended action based on tier
 * @param {Object} tier - Tier object
 * @returns {string} Recommended action text
 */
function getRecommendedAction(tier) {
    switch (tier.label) {
        case 'CRITICAL':
            return 'Immediate physical inspection required. Supervisor approval needed before clearance.';
        case 'HIGH':
            return 'Flag for physical inspection. Document all findings.';
        case 'MODERATE':
            return 'Review recommended. Compare with manifest and shipper history.';
        case 'LOW':
            return 'Standard processing. Spot check if time permits.';
        default:
            return 'Clear for processing. Normal risk level.';
    }
}

/**
 * Get calibration note based on confidence
 * @param {number} confidence - Confidence percentage
 * @returns {string} Calibration note
 */
function getCalibrationNote(confidence) {
    if (confidence >= 90) {
        return 'High model confidence. Strong visual evidence supports this detection.';
    } else if (confidence >= 75) {
        return 'Moderate-high confidence. Detection is likely accurate but verify against manifest.';
    } else if (confidence >= 51) {
        return 'Moderate confidence. Human judgment should weigh manifest details.';
    } else if (confidence >= 31) {
        return 'Low confidence. Model is uncertain. Human judgment should override if manifest checks out.';
    } else {
        return 'Very low confidence. Likely normal cargo. Review only if other indicators present.';
    }
}

/**
 * Create an arc gauge SVG
 * @param {number} percentage - Value (0-100)
 * @param {number} size - SVG size in pixels (default 120)
 * @returns {string} SVG markup
 */
function createGaugeSVG(percentage, size = 120) {
    const tier = getTier(percentage);
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;

    // Arc parameters (270 degree sweep, starting from bottom-left)
    const startAngle = 135; // degrees
    const endAngle = 405; // degrees (135 + 270)
    const sweepAngle = 270;

    // Calculate the arc path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Start and end points for full arc
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    // Calculate filled arc end point
    const fillAngle = startAngle + (sweepAngle * percentage) / 100;
    const fillRad = (fillAngle * Math.PI) / 180;
    const x3 = center + radius * Math.cos(fillRad);
    const y3 = center + radius * Math.sin(fillRad);

    // Large arc flag
    const largeArcFull = 1;
    const largeArcFill = percentage > 50 ? 1 : 0;

    // Background track path
    const trackPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFull} 1 ${x2} ${y2}`;

    // Filled arc path
    const fillPath = percentage > 0
        ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFill} 1 ${x3} ${y3}`
        : '';

    return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <!-- Background track -->
            <path
                d="${trackPath}"
                fill="none"
                stroke="#374151"
                stroke-width="${strokeWidth}"
                stroke-linecap="round"
            />
            <!-- Filled arc -->
            ${fillPath ? `
            <path
                d="${fillPath}"
                fill="none"
                stroke="${tier.color}"
                stroke-width="${strokeWidth}"
                stroke-linecap="round"
                class="gauge-fill"
            />` : ''}
            <!-- Center text -->
            <text
                x="${center}"
                y="${center}"
                text-anchor="middle"
                dominant-baseline="middle"
                fill="${tier.color}"
                font-size="${size * 0.25}px"
                font-weight="bold"
            >${Math.round(percentage)}%</text>
        </svg>
    `;
}

/**
 * Render a gauge into a target element
 * @param {HTMLElement} element - Target element
 * @param {number} percentage - Value (0-100)
 * @param {Object} options - Options {size, showLabel, animate}
 */
function renderGauge(element, percentage, options = {}) {
    const size = options.size || 120;
    const showLabel = options.showLabel !== false;
    const tier = getTier(percentage);

    let html = createGaugeSVG(percentage, size);

    if (showLabel) {
        html += `
            <div class="text-center mt-2">
                <span class="text-sm font-medium" style="color: ${tier.color}">
                    ${tier.label}
                </span>
            </div>
        `;
    }

    element.innerHTML = html;

    // Animate if requested
    if (options.animate) {
        animateGauge(element, percentage, size);
    }
}

/**
 * Animate gauge from 0 to target value
 * @param {HTMLElement} element - Target element
 * @param {number} targetValue - Target percentage
 * @param {number} size - SVG size
 */
function animateGauge(element, targetValue, size) {
    let current = 0;
    const step = targetValue / 30; // 30 frames
    const interval = setInterval(() => {
        current += step;
        if (current >= targetValue) {
            current = targetValue;
            clearInterval(interval);
        }
        element.querySelector('svg').outerHTML = createGaugeSVG(current, size);
    }, 16); // ~60fps
}

/**
 * Create a risk badge HTML
 * @param {string} riskLevel - Risk level string
 * @returns {string} HTML markup
 */
function createRiskBadge(riskLevel) {
    const tier = getTierFromRisk(riskLevel);
    return `
        <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
              style="background-color: ${tier.bgColor}; color: ${tier.color}">
            ${tier.label}
        </span>
    `;
}

// Export for use in other modules
window.Confidence = {
    TIERS,
    getTier,
    getTierFromRisk,
    getRecommendedAction,
    getCalibrationNote,
    createGaugeSVG,
    renderGauge,
    createRiskBadge
};
