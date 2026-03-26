/**
 * report.js - jsPDF PDF builder for audit reports
 */

/**
 * Risk tier colors
 */
const TIER_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    moderate: '#f59e0b',
    medium: '#f59e0b',
    low: '#22c55e',
    clear: '#6b7280'
};

/**
 * Get tier from confidence
 * @param {number} confidence - Confidence percentage
 * @returns {string} Tier label
 */
function getTierLabel(confidence) {
    if (confidence >= 90) return 'CRITICAL';
    if (confidence >= 75) return 'HIGH';
    if (confidence >= 51) return 'MODERATE';
    if (confidence >= 31) return 'LOW';
    return 'CLEAR';
}

/**
 * Generate PDF report from audit entry
 * @param {Object} entry - Audit entry data
 * @param {Object} options - Options {includeHeatmap}
 */
function generatePDFReport(entry, options = {}) {
    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF not loaded');
        alert('PDF library not loaded. Please refresh the page.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    // Colors
    const navy = [30, 58, 95];
    const white = [255, 255, 255];
    const gray = [107, 114, 128];
    const lightGray = [243, 244, 246];

    // ===== HEADER =====
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMS CARGO SCAN REPORT', pageWidth / 2, 12, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(156, 163, 175);
    doc.text('OFFICIAL DOCUMENT', pageWidth / 2, 22, { align: 'center' });

    y = 40;

    // ===== SCAN METADATA =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Scan Information', margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const metadata = [
        ['Scan ID:', entry.scanId || 'N/A', 'Date/Time:', (entry.timestamp || '').substring(0, 19)],
        ['Officer:', entry.officerName || 'N/A', 'Route:', entry.route || 'N/A'],
        ['Shipper:', entry.shipperName || 'N/A', 'Declared:', (entry.declaredGoods || '').substring(0, 40)]
    ];

    metadata.forEach(row => {
        doc.setTextColor(...gray);
        doc.text(row[0], margin, y);
        doc.setTextColor(0, 0, 0);
        doc.text(row[1], margin + 22, y);

        doc.setTextColor(...gray);
        doc.text(row[2], margin + 85, y);
        doc.setTextColor(0, 0, 0);
        doc.text(row[3], margin + 107, y);

        y += 6;
    });

    y += 5;

    // ===== RISK ASSESSMENT =====
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Risk Assessment', margin, y);
    y += 8;

    const riskLevel = (entry.aiRisk || 'unknown').toUpperCase();
    const riskColor = TIER_COLORS[(entry.aiRisk || 'clear').toLowerCase()] || '#6b7280';

    // Parse hex color to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [107, 114, 128];
    };

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(riskColor));
    doc.text(`Overall Risk: ${riskLevel}`, margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(entry.aiExplanation || 'No explanation provided', margin, y, { maxWidth: contentWidth });
    y += 10;

    // ===== DETECTIONS TABLE =====
    const detections = entry.aiDetections || [];
    if (detections.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detections', margin, y);
        y += 8;

        // Table header
        doc.setFillColor(...navy);
        doc.rect(margin, y - 5, contentWidth, 8, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        doc.text('Label', margin + 2, y);
        doc.text('Category', margin + 50, y);
        doc.text('Confidence', margin + 110, y);
        doc.text('Tier', margin + 140, y);
        y += 6;

        // Table rows
        let rowLight = true;
        detections.forEach((det, i) => {
            if (rowLight) {
                doc.setFillColor(...lightGray);
                doc.rect(margin, y - 4, contentWidth, 7, 'F');
            }
            rowLight = !rowLight;

            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');

            const label = (det.label || 'Unknown').substring(0, 25);
            const category = (det.category || 'N/A').substring(0, 25);
            const confidence = det.confidence_pct || 0;
            const tier = getTierLabel(confidence);

            doc.text(label, margin + 2, y);
            doc.text(category, margin + 50, y);
            doc.text(`${confidence}%`, margin + 115, y);
            doc.text(tier, margin + 140, y);

            y += 7;
        });

        y += 5;
    }

    // ===== MISMATCH WARNING =====
    if (entry.aiMismatch) {
        doc.setFillColor(254, 242, 242);
        doc.rect(margin, y - 4, contentWidth, 10, 'F');

        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`⚠ DECLARED MISMATCH: ${entry.mismatchDetail || 'Mismatch detected'}`, margin + 2, y + 2);
        y += 12;
    }

    // ===== OFFICER ACTION =====
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Officer Action', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Action: ${(entry.officerAction || 'PENDING').toUpperCase()}`, margin, y);
    y += 6;

    if (entry.officerNote) {
        doc.text(`Notes: ${entry.officerNote}`, margin, y, { maxWidth: contentWidth });
        y += 10;
    }

    // ===== FOOTER =====
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');

    const footerText = `Generated by CargoScan AI · ${new Date().toISOString().substring(0, 19)} · For Official Use Only`;
    doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });

    // Save the PDF
    doc.save(`cargo-report-${entry.scanId || 'scan'}.pdf`);
}

/**
 * Quick export - use latest scan
 */
function exportLatestScan() {
    const entries = window.Audit ? window.Audit.getAllEntries() : [];
    if (entries.length === 0) {
        alert('No scans available to export');
        return;
    }
    generatePDFReport(entries[0]);
}

// Export for use in other modules
window.Report = {
    generatePDFReport,
    exportLatestScan
};
