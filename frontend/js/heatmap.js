/**
 * heatmap.js - Region-based grid overlay for detections
 * Uses 3x3 grid regions instead of precise bounding boxes
 */

/**
 * Region mapping to grid coordinates (3x3 grid)
 * Each region maps to {col, row} where col/row are 0-2
 */
const REGION_MAP = {
    'top-left': { col: 0, row: 0 },
    'top-center': { col: 1, row: 0 },
    'top-right': { col: 2, row: 0 },
    'center-left': { col: 0, row: 1 },
    'center': { col: 1, row: 1 },
    'center-right': { col: 2, row: 1 },
    'bottom-left': { col: 0, row: 2 },
    'bottom-center': { col: 1, row: 2 },
    'bottom-right': { col: 2, row: 2 },
    // Aliases
    'left': { col: 0, row: 1 },
    'right': { col: 2, row: 1 },
    'top': { col: 1, row: 0 },
    'bottom': { col: 1, row: 2 }
};

/**
 * Get tier color from confidence
 * @param {number} confidence - Confidence percentage
 * @returns {Object} {r, g, b} color values
 */
function getTierColor(confidence) {
    if (confidence >= 90) return { r: 239, g: 68, b: 68 };   // Critical - red
    if (confidence >= 75) return { r: 249, g: 115, b: 22 };  // High - orange
    if (confidence >= 51) return { r: 245, g: 158, b: 11 };  // Moderate - amber
    if (confidence >= 31) return { r: 34, g: 197, b: 94 };   // Low - green
    return { r: 107, g: 114, b: 128 };                        // Clear - gray
}

/**
 * Get hex color from confidence
 */
function getTierHexColor(confidence) {
    if (confidence >= 90) return '#ef4444';
    if (confidence >= 75) return '#f97316';
    if (confidence >= 51) return '#f59e0b';
    if (confidence >= 31) return '#22c55e';
    return '#6b7280';
}

/**
 * Parse region string to grid coordinates
 * @param {string} region - Region string from AI
 * @returns {Object} {col, row} or null
 */
function parseRegion(region) {
    if (!region) return null;
    const normalized = region.toLowerCase().trim();
    return REGION_MAP[normalized] || null;
}

/**
 * Get grid cell bounds
 * @param {number} col - Column (0-2)
 * @param {number} row - Row (0-2)
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} {x, y, w, h}
 */
function getGridCellBounds(col, row, width, height) {
    const cellWidth = width / 3;
    const cellHeight = height / 3;
    return {
        x: col * cellWidth,
        y: row * cellHeight,
        w: cellWidth,
        h: cellHeight
    };
}

/**
 * Draw a Gaussian radial blob on canvas
 */
function drawGaussianBlob(ctx, cx, cy, radius, color, intensity = 0.7) {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity})`);
    gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.5})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Draw 3x3 grid lines on canvas
 */
function drawGrid(ctx, width, height, color = 'rgba(255,255,255,0.15)') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Vertical lines
    for (let i = 1; i < 3; i++) {
        const x = (width / 3) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let i = 1; i < 3; i++) {
        const y = (height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.setLineDash([]);
}

/**
 * Draw heatmap overlay using region-based highlighting
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {HTMLImageElement} image - Original image
 * @param {Array} detections - Array of detection objects with region field
 * @param {Object} options - {opacity, showImage, showGrid}
 */
function drawHeatmap(canvas, image, detections, options = {}) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageOpacity = options.opacity !== undefined ? options.opacity : 0.6;
    const showImage = options.showImage !== false;
    const showGrid = options.showGrid !== false;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw original image at reduced opacity
    if (showImage && image) {
        ctx.globalAlpha = imageOpacity;
        ctx.drawImage(image, 0, 0, width, height);
        ctx.globalAlpha = 1;
    }

    // Draw grid lines
    if (showGrid) {
        drawGrid(ctx, width, height);
    }

    // Set composite mode for stacking blobs
    ctx.globalCompositeOperation = 'screen';

    // Draw each detection as a Gaussian blob in its region
    detections.forEach(detection => {
        const regionCoords = parseRegion(detection.region);
        if (!regionCoords) return;

        const bounds = getGridCellBounds(regionCoords.col, regionCoords.row, width, height);

        // Center of the region cell
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;

        // Radius covers most of the cell
        const radius = Math.min(bounds.w, bounds.h) * 0.6;

        // Get color based on confidence
        const confidence = detection.confidence_pct || 50;
        const color = getTierColor(confidence);

        // Intensity based on confidence
        const intensity = 0.4 + (confidence / 100) * 0.4;

        drawGaussianBlob(ctx, cx, cy, radius, color, intensity);
    });

    // Reset composite mode
    ctx.globalCompositeOperation = 'source-over';
}

/**
 * Draw annotated view with region highlights
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {HTMLImageElement} image - Original image
 * @param {Array} detections - Array of detection objects
 */
function drawAnnotated(canvas, image, detections) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear and draw original image
    ctx.clearRect(0, 0, width, height);
    if (image) {
        ctx.drawImage(image, 0, 0, width, height);
    }

    // Draw subtle grid
    drawGrid(ctx, width, height, 'rgba(255,255,255,0.1)');

    // Draw each detection's region
    detections.forEach(detection => {
        const regionCoords = parseRegion(detection.region);
        if (!regionCoords) return;

        const bounds = getGridCellBounds(regionCoords.col, regionCoords.row, width, height);
        const confidence = detection.confidence_pct || 50;
        const color = getTierHexColor(confidence);
        const tier = window.Confidence ? window.Confidence.getTier(confidence) : { label: 'MODERATE' };

        // Draw region highlight with semi-transparent fill
        ctx.fillStyle = color + '30'; // 30 = ~19% opacity in hex
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

        // Draw border
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(bounds.x + 1.5, bounds.y + 1.5, bounds.w - 3, bounds.h - 3);

        // Draw L-shaped corner markers (scanner aesthetic)
        const cornerLength = Math.min(bounds.w, bounds.h) * 0.15;
        ctx.lineWidth = 4;
        ctx.lineCap = 'square';

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(bounds.x, bounds.y + cornerLength);
        ctx.lineTo(bounds.x, bounds.y);
        ctx.lineTo(bounds.x + cornerLength, bounds.y);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(bounds.x + bounds.w - cornerLength, bounds.y);
        ctx.lineTo(bounds.x + bounds.w, bounds.y);
        ctx.lineTo(bounds.x + bounds.w, bounds.y + cornerLength);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(bounds.x, bounds.y + bounds.h - cornerLength);
        ctx.lineTo(bounds.x, bounds.y + bounds.h);
        ctx.lineTo(bounds.x + cornerLength, bounds.y + bounds.h);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(bounds.x + bounds.w - cornerLength, bounds.y + bounds.h);
        ctx.lineTo(bounds.x + bounds.w, bounds.y + bounds.h);
        ctx.lineTo(bounds.x + bounds.w, bounds.y + bounds.h - cornerLength);
        ctx.stroke();

        // Draw crosshair in center
        const centerX = bounds.x + bounds.w / 2;
        const centerY = bounds.y + bounds.h / 2;
        const crossSize = 8;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(centerX - crossSize, centerY);
        ctx.lineTo(centerX + crossSize, centerY);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - crossSize);
        ctx.lineTo(centerX, centerY + crossSize);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw label pill at top of region
        const label = detection.label || 'Unknown';
        const tierLabel = tier.label || 'MODERATE';
        const labelText = `${label}  ${confidence}%  [${tierLabel}]`;

        ctx.font = 'bold 11px sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const padding = 6;
        const pillWidth = Math.min(textMetrics.width + padding * 2, bounds.w - 10);
        const pillHeight = 20;
        const pillX = bounds.x + (bounds.w - pillWidth) / 2;
        const pillY = bounds.y + 8;

        // Pill background with shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Pill text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText.length > 25 ? labelText.substring(0, 25) + '...' : labelText,
                     pillX + pillWidth / 2, pillY + pillHeight / 2);
        ctx.textAlign = 'left';
    });
}

/**
 * Draw original image without overlays
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {HTMLImageElement} image - Original image
 */
function drawOriginal(canvas, image) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
}

/**
 * Get region label for display
 * @param {string} region - Region string
 * @returns {string} Formatted label
 */
function getRegionLabel(region) {
    if (!region) return 'Unknown';
    return region.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Export for use in other modules
window.Heatmap = {
    drawHeatmap,
    drawAnnotated,
    drawOriginal,
    drawGaussianBlob,
    getTierColor,
    getTierHexColor,
    parseRegion,
    getRegionLabel,
    REGION_MAP
};
