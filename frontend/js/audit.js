/**
 * audit.js - localStorage CRUD for audit entries
 */

const AUDIT_KEY = 'ciibs_audit';

/**
 * Generate a unique ID
 */
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Generate a scan ID
 */
function generateScanId() {
    return 'SHP-' + Date.now();
}

/**
 * Get all audit entries
 * @returns {Array} All audit entries
 */
function getAllEntries() {
    const data = localStorage.getItem(AUDIT_KEY);
    return data ? JSON.parse(data) : [];
}

/**
 * Save entries to localStorage
 * @param {Array} entries - Entries to save
 */
function saveEntries(entries) {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
}

/**
 * Get a single entry by ID
 * @param {string} entryId - Entry ID
 * @returns {Object|null} Entry or null
 */
function getEntry(entryId) {
    const entries = getAllEntries();
    return entries.find(e => e.entryId === entryId) || null;
}

/**
 * Get entry by scan ID
 * @param {string} scanId - Scan ID
 * @returns {Object|null} Entry or null
 */
function getEntryByScanId(scanId) {
    const entries = getAllEntries();
    return entries.find(e => e.scanId === scanId) || null;
}

/**
 * Create a new audit entry
 * @param {Object} data - Entry data
 * @returns {Object} Created entry
 */
function createEntry(data) {
    const entries = getAllEntries();

    const entry = {
        entryId: generateId(),
        scanId: data.scanId || generateScanId(),
        type: data.type || 'scan',
        timestamp: new Date().toISOString(),
        filename: data.filename || '',
        declaredGoods: data.declaredGoods || '',
        shipperName: data.shipperName || '',
        route: data.route || '',
        imageThumb: data.imageThumb || null,
        aiDetections: data.aiDetections || [],
        aiRisk: data.aiRisk || null,
        aiExplanation: data.aiExplanation || '',
        aiMismatch: data.aiMismatch || false,
        mismatchDetail: data.mismatchDetail || null,
        officerName: data.officerName || null,
        officerAction: data.officerAction || null,
        officerNote: data.officerNote || '',
        actionTime: null,
        physicalOutcome: null,
        feedbackNote: '',
        closedAt: null,
        status: data.status || 'pending_review'
    };

    entries.unshift(entry); // Add to beginning
    saveEntries(entries);

    return entry;
}

/**
 * Update an existing entry
 * @param {string} entryId - Entry ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated entry or null
 */
function updateEntry(entryId, updates) {
    const entries = getAllEntries();
    const index = entries.findIndex(e => e.entryId === entryId);

    if (index === -1) return null;

    // Apply updates
    entries[index] = { ...entries[index], ...updates };

    // Set action time if action was taken
    if (updates.officerAction && !entries[index].actionTime) {
        entries[index].actionTime = new Date().toISOString();
    }

    // Set closed time if outcome recorded
    if (updates.physicalOutcome && !entries[index].closedAt) {
        entries[index].closedAt = new Date().toISOString();
        entries[index].status = 'closed';
    }

    saveEntries(entries);
    return entries[index];
}

/**
 * Delete an entry
 * @param {string} entryId - Entry ID
 * @returns {boolean} Success
 */
function deleteEntry(entryId) {
    const entries = getAllEntries();
    const filtered = entries.filter(e => e.entryId !== entryId);

    if (filtered.length === entries.length) return false;

    saveEntries(filtered);
    return true;
}

/**
 * Get filtered entries
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered entries
 */
function getFilteredEntries(filters = {}) {
    let entries = getAllEntries();

    if (filters.status) {
        entries = entries.filter(e => e.status === filters.status);
    }

    if (filters.type) {
        entries = entries.filter(e => e.type === filters.type);
    }

    if (filters.shipperName) {
        entries = entries.filter(e =>
            e.shipperName.toLowerCase().includes(filters.shipperName.toLowerCase())
        );
    }

    if (filters.search) {
        const search = filters.search.toLowerCase();
        entries = entries.filter(e =>
            e.shipperName.toLowerCase().includes(search) ||
            e.scanId.toLowerCase().includes(search) ||
            e.declaredGoods.toLowerCase().includes(search)
        );
    }

    return entries;
}

/**
 * Get audit statistics
 * @returns {Object} Statistics
 */
function getStats() {
    const entries = getAllEntries();

    const stats = {
        total: entries.length,
        pending: entries.filter(e => e.status === 'pending_review').length,
        flagged: entries.filter(e => e.status === 'flagged' || e.officerAction === 'flagged').length,
        cleared: entries.filter(e => e.status === 'cleared' || e.officerAction === 'cleared').length,
        closed: entries.filter(e => e.status === 'closed').length,
        comparisons: entries.filter(e => e.type === 'comparison').length
    };

    // Calculate AI accuracy from closed entries
    const closedWithOutcome = entries.filter(e => e.physicalOutcome);
    const confirmed = closedWithOutcome.filter(e => e.physicalOutcome === 'confirmed').length;
    stats.accuracy = closedWithOutcome.length > 0
        ? Math.round((confirmed / closedWithOutcome.length) * 100)
        : 0;

    return stats;
}

/**
 * Export entries to CSV
 * @returns {string} CSV string
 */
function exportToCSV() {
    const entries = getAllEntries();

    if (entries.length === 0) return '';

    const headers = [
        'Scan ID', 'Type', 'Timestamp', 'Filename', 'Declared Goods',
        'Shipper', 'Route', 'AI Risk', 'Officer', 'Action', 'Status', 'Outcome'
    ];

    const rows = entries.map(e => [
        e.scanId,
        e.type,
        e.timestamp,
        e.filename,
        `"${(e.declaredGoods || '').replace(/"/g, '""')}"`,
        e.shipperName,
        e.route,
        e.aiRisk,
        e.officerName,
        e.officerAction,
        e.status,
        e.physicalOutcome
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Clear all entries
 */
function clearAll() {
    localStorage.removeItem(AUDIT_KEY);
}

// Export for use in other modules
window.Audit = {
    generateId,
    generateScanId,
    getAllEntries,
    getEntry,
    getEntryByScanId,
    createEntry,
    updateEntry,
    deleteEntry,
    getFilteredEntries,
    getStats,
    exportToCSV,
    clearAll
};
