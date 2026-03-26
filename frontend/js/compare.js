/**
 * compare.js - Pixel diff algorithm for image comparison
 */

/**
 * Compute pixel difference between two images
 * @param {HTMLCanvasElement} canvas1 - First image canvas
 * @param {HTMLCanvasElement} canvas2 - Second image canvas
 * @param {number} threshold - Sensitivity threshold (0-255, default 25)
 * @param {number} opacity - Diff overlay opacity (0-100, default 80)
 * @returns {Object} {diffCanvas, stats, quadrantScores}
 */
function computePixelDiff(canvas1, canvas2, threshold = 25, opacity = 80) {
    // Normalize size for comparison
    const width = 640;
    const height = 480;

    // Create temp canvases at normalized size
    const tempCanvas1 = document.createElement('canvas');
    const tempCanvas2 = document.createElement('canvas');
    const diffCanvas = document.createElement('canvas');

    tempCanvas1.width = tempCanvas2.width = diffCanvas.width = width;
    tempCanvas1.height = tempCanvas2.height = diffCanvas.height = height;

    const ctx1 = tempCanvas1.getContext('2d');
    const ctx2 = tempCanvas2.getContext('2d');
    const diffCtx = diffCanvas.getContext('2d');

    // Draw source images to temp canvases
    ctx1.drawImage(canvas1, 0, 0, width, height);
    ctx2.drawImage(canvas2, 0, 0, width, height);

    // Get pixel data
    const data1 = ctx1.getImageData(0, 0, width, height);
    const data2 = ctx2.getImageData(0, 0, width, height);
    const diffData = diffCtx.createImageData(width, height);

    // Quadrant tracking
    const quadrants = {
        topLeft: { deltaSum: 0, pixelCount: 0 },
        topRight: { deltaSum: 0, pixelCount: 0 },
        bottomLeft: { deltaSum: 0, pixelCount: 0 },
        bottomRight: { deltaSum: 0, pixelCount: 0 }
    };

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Statistics
    let changedPixels = 0;
    let totalDelta = 0;
    const totalPixels = width * height;

    // Opacity as 0-255 value
    const alphaValue = Math.round((opacity / 100) * 255);

    // Loop through pixels
    for (let i = 0; i < data1.data.length; i += 4) {
        const r1 = data1.data[i];
        const g1 = data1.data[i + 1];
        const b1 = data1.data[i + 2];

        const r2 = data2.data[i];
        const g2 = data2.data[i + 1];
        const b2 = data2.data[i + 2];

        // Calculate average delta
        const delta = (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)) / 3;

        // Get pixel coordinates
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);

        // Determine quadrant
        let quadrant;
        if (x < halfWidth && y < halfHeight) {
            quadrant = quadrants.topLeft;
        } else if (x >= halfWidth && y < halfHeight) {
            quadrant = quadrants.topRight;
        } else if (x < halfWidth && y >= halfHeight) {
            quadrant = quadrants.bottomLeft;
        } else {
            quadrant = quadrants.bottomRight;
        }

        quadrant.deltaSum += delta;
        quadrant.pixelCount++;

        totalDelta += delta;

        if (delta > threshold) {
            changedPixels++;

            // Color based on delta intensity
            if (delta > threshold * 2.5) {
                // High difference - red
                diffData.data[i] = 239;     // R
                diffData.data[i + 1] = 68;  // G
                diffData.data[i + 2] = 68;  // B
            } else {
                // Moderate difference - amber
                diffData.data[i] = 245;     // R
                diffData.data[i + 1] = 158; // G
                diffData.data[i + 2] = 11;  // B
            }
            diffData.data[i + 3] = alphaValue;
        } else {
            // No significant difference - transparent
            diffData.data[i] = 0;
            diffData.data[i + 1] = 0;
            diffData.data[i + 2] = 0;
            diffData.data[i + 3] = 0;
        }
    }

    // Put diff data to canvas
    diffCtx.putImageData(diffData, 0, 0);

    // Calculate quadrant scores (0-100)
    const quadrantScores = {};
    Object.keys(quadrants).forEach(key => {
        const q = quadrants[key];
        const avgDelta = q.pixelCount > 0 ? q.deltaSum / q.pixelCount : 0;
        quadrantScores[key] = Math.min(100, Math.round((avgDelta / 255) * 100 * 4));
    });

    // Draw quadrant overlays and labels
    drawQuadrantOverlays(diffCtx, width, height, quadrantScores);

    // Calculate stats
    const changedPercent = (changedPixels / totalPixels) * 100;
    const avgDelta = totalDelta / totalPixels;

    let riskLevel = 'LOW';
    if (changedPercent > 15) riskLevel = 'HIGH';
    else if (changedPercent > 5) riskLevel = 'MEDIUM';

    return {
        diffCanvas,
        stats: {
            changedPixels,
            changedPercent: Math.round(changedPercent * 10) / 10,
            avgDelta: Math.round(avgDelta * 10) / 10,
            threshold,
            riskLevel
        },
        quadrantScores
    };
}

/**
 * Draw quadrant overlays and labels
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} scores - Quadrant scores
 */
function drawQuadrantOverlays(ctx, width, height, scores) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const quadrantPositions = {
        topLeft: { x: 0, y: 0, label: 'TL' },
        topRight: { x: halfWidth, y: 0, label: 'TR' },
        bottomLeft: { x: 0, y: halfHeight, label: 'BL' },
        bottomRight: { x: halfWidth, y: halfHeight, label: 'BR' }
    };

    Object.keys(quadrantPositions).forEach(key => {
        const pos = quadrantPositions[key];
        const score = scores[key];

        // Get color based on score
        let color;
        if (score > 50) {
            color = 'rgba(239, 68, 68, 0.2)';  // Red
        } else if (score > 20) {
            color = 'rgba(245, 158, 11, 0.2)'; // Amber
        } else {
            color = 'rgba(34, 197, 94, 0.15)'; // Green
        }

        // Draw semi-transparent overlay
        ctx.fillStyle = color;
        ctx.fillRect(pos.x, pos.y, halfWidth, halfHeight);

        // Draw label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add shadow for readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;

        const labelX = pos.x + halfWidth / 2;
        const labelY = pos.y + halfHeight / 2;
        ctx.fillText(`${pos.label}: ${score}`, labelX, labelY);

        ctx.shadowBlur = 0;
    });

    // Draw dashed grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, height);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, halfHeight);
    ctx.lineTo(width, halfHeight);
    ctx.stroke();

    ctx.setLineDash([]);
}

/**
 * Get risk level color
 * @param {string} level - Risk level (LOW/MEDIUM/HIGH)
 * @returns {string} Hex color
 */
function getRiskLevelColor(level) {
    switch (level) {
        case 'HIGH': return '#ef4444';
        case 'MEDIUM': return '#f59e0b';
        default: return '#22c55e';
    }
}

// Export for use in other modules
window.Compare = {
    computePixelDiff,
    getRiskLevelColor
};
