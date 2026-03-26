Build "CargoScan AI" — a cargo X-ray analysis prototype for customs and border 
security. Use plain HTML + Tailwind CSS CDN + Vanilla JS frontend, FastAPI 
Python backend. No React, no npm, no build step.

═══════════════════════════════════════════════════════
STACK
═══════════════════════════════════════════════════════

Frontend: HTML files + Tailwind CDN + Vanilla JS + jsPDF CDN
Backend: FastAPI + google-generativeai (Gemini 2.5 Flash) + reportlab + Pillow
Storage: localStorage only — no database
Run: Live Server on frontend, uvicorn on port 8000

═══════════════════════════════════════════════════════
FILE STRUCTURE — two lines each
═══════════════════════════════════════════════════════

frontend/
  index.html       — Scan page. Upload image, run Gemini analysis, show all results.
  compare.html     — Compare two scans. Pixel diff + Gemini semantic diff side by side.
  audit.html       — Full audit trail table. Every scan, action, and outcome logged.
  shipper.html     — Shipper risk profiles. Score each shipper from their scan history.
  feedback.html    — Analyst feedback dashboard. Dummy self-learning feature UI.
  report.html      — PDF report generator. Pull any audit entry and export as PDF.

  js/
  api.js           — All fetch() calls to FastAPI. One function per route.
  audit.js         — localStorage CRUD for audit entries. Save, update, read, export.
  heatmap.js       — Canvas Gaussian blob overlay. Draws heat regions on the image.
  compare.js       — Pixel diff algorithm. Loops ImageData, paints diff, scores quadrants.
  shipper.js       — Shipper profile scoring. Weighted risk history + sparkline SVG.
  feedback.js      — Feedback storage + accuracy calculation. Thumbs up/down per detection.
  report.js        — jsPDF builder. Assembles one-page PDF from audit entry data.
  confidence.js    — Gauge SVG renderer + tier logic. Maps confidence % to label + color.

backend/
  main.py          — FastAPI app. CORS, router registration, env loading.
  routes/analyze.py — POST /analyze. Accepts image + manifest, calls Gemini, returns JSON.
  routes/compare.py — POST /compare. Accepts two images, calls Gemini compare, returns JSON.
  routes/report.py  — POST /report. Accepts scan data, generates PDF, returns file stream.
  services/gemini.py — Three Gemini functions: analyze_image, compare_images, whatif_query.
  services/pdf_gen.py — reportlab PDF builder. Styled A4 with table, thumbnail, header.
  .env             — GEMINI_API_KEY only.
  requirements.txt — fastapi uvicorn google-generativeai reportlab python-multipart python-dotenv Pillow

═══════════════════════════════════════════════════════
SHARED ACROSS ALL PAGES
═══════════════════════════════════════════════════════

Every HTML page has:
- Dark theme: bg-gray-950 body, bg-gray-900 cards, bg-gray-800 inputs
- Left sidebar (w-56, bg-gray-900) with nav links to all 6 pages
- Current page link highlighted (bg-gray-800 text-white)
- Sidebar footer: "Powered by Gemini 1.5 Flash · For official use only"
- Toast notification function for success/error feedback

Risk tier color system used everywhere:
- CRITICAL (90-100%): #ef4444 red
- HIGH (75-89%): #f97316 orange
- MODERATE (51-74%): #f59e0b amber
- LOW (31-50%): #22c55e green
- CLEAR (0-30%): #6b7280 gray

═══════════════════════════════════════════════════════
GEMINI PROMPTS — exact wording matters
═══════════════════════════════════════════════════════

analyze_image prompt:
"""
You are an expert customs X-ray analyst. Analyze this cargo X-ray image.

X-RAY PHYSICS: Dense/metallic objects appear very DARK or BLACK. Organic 
materials appear LIGHT GREY. Plastics are MEDIUM GREY. Hollow spaces are WHITE.
This is NOT a normal photograph.

DECLARED MANIFEST: {manifest}

Look for: objects inconsistent with the manifest, unusual density patterns, 
weapon shapes (elongated dark objects with handles), concealed organic masses, 
dense rectangles suggesting undeclared electronics, any region that does not 
match expected cargo.

Return ONLY valid JSON, no markdown:
{
  "detections": [{
    "label": "descriptive name",
    "category": "weapon-like shape | organic concealment | dense metallic anomaly | undeclared electronics | normal cargo",
    "confidence_pct": 0-100,
    "reason": "specific 1-2 sentence explanation referencing shape, density, position",
    "region": "top-left | top-center | top-right | center | bottom-left | bottom-center | bottom-right",
    "bbox": {"x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1}
  }],
  "overall_risk": "low | medium | high | critical",
  "risk_explanation": "one sentence for the officer",
  "declared_mismatch": true | false,
  "mismatch_detail": "specific mismatch or null",
  "officer_summary": "single actionable sentence"
}
"""

compare_images prompt:
"""
You are comparing two cargo X-ray scans. Image 1 = REFERENCE (cleared baseline).
Image 2 = CURRENT (today's scan, same route). Dark = dense, light = organic.

Return ONLY valid JSON:
{
  "differences": [{"location": "area", "description": "what changed", "severity": "HIGH|MEDIUM|LOW"}],
  "severity": "HIGH|MEDIUM|LOW",
  "summary": "one sentence for officer",
  "recommendation": "specific action"
}
"""

whatif_query prompt:
"""
You are a customs AI analyst. This scan returned: {scan_context}
Officer asks: "{question}"
Answer in 2-4 sentences specific to THIS scan. If asking about clearing: 
explain exactly what evidence would resolve the concern.
Return JSON: {"answer": "your response"}
"""

In all Gemini calls: strip ```json fences from response.text before JSON.parse.

═══════════════════════════════════════════════════════
FEATURE 1 — SCAN PAGE (index.html) — full detail
═══════════════════════════════════════════════════════

The scan page is the core of the app. It has two columns.

LEFT COLUMN — inputs:
A drag-and-drop upload zone previews the image on a canvas element when a file 
is selected. Below the canvas show filename and pixel dimensions. Four text 
inputs: declared manifest (what the shipper says is inside), shipper name 
(saved to shipper profiles), route/origin (e.g. "Mumbai → Delhi"), and officer 
name (pre-fills the action panel). A large "Scan image" button triggers the 
analysis. While loading show a spinner overlay on the canvas.

RIGHT COLUMN — results (hidden until scan completes, then revealed):

SHIPMENT SUMMARY BAR:
The most prominent element at the top of results. A wide colored card showing 
the overall risk level in large bold text (CRITICAL / HIGH / MODERATE / LOW), 
the highest detection confidence, a "Recommended action" sentence derived from 
the tier, and the AI accuracy % pulled from feedback localStorage. The card 
border and background tint match the risk tier color.

CANVAS VIEW WITH THREE MODES:
Toggle buttons switch between Original, Annotated, and Heatmap views.

Annotated mode draws on the canvas using Gemini's bbox coordinates (multiply 
normalized 0-1 values by canvas width/height). For each detection draw: a 
colored rectangle outline, L-shaped corner markers instead of full rect borders 
(customs-scanner aesthetic), a label pill above the box showing "LABEL  87%  
[HIGH]", and a small crosshair dot at the center.

Heatmap mode (from heatmap.js): draw the original image at 60% opacity, then 
for each detection paint a Gaussian radial blob using canvas createRadialGradient 
centered on the bbox center. Blob radius = max(bbox.w, bbox.h) × canvas_size / 2. 
Color the center by tier (red/orange/amber/green), fade to transparent at edge. 
Multiple blobs stack using 'screen' composite mode.

DETECTION CARDS:
One card per detection returned by Gemini, sorted by confidence descending.
Each card has:
- A 4px left border colored by tier
- Object label as heading, category as a gray pill badge
- An arc gauge SVG (270° sweep): gray track, colored fill animated from 0 to 
  confidence_pct on load. Center shows the percentage. Below it the tier label 
  ("Moderate — review recommended"). The gauge is drawn in confidence.js.
- A "Why flagged" box with dark background showing Gemini's reason text
- A small calibration note: contextual sentence explaining what this confidence 
  level means ("Model is uncertain. Human judgment should override if manifest 
  checks out.")
- Region location as a small badge
- Two feedback buttons: "Correct detection" and "False positive". Clicking either 
  saves to ciibs_feedback via feedback.js and shows inline confirmation.
- "Mark for inspection" button right-aligned

OFFICER ACTION PANEL:
Below all cards. Officer name input (pre-filled from scan input), notes textarea, 
three buttons: "Flag for inspection" / "Clear — acceptable" / "Escalate to 
supervisor". Clicking any button saves the full audit entry to ciibs_audit via 
audit.js, updates the shipper profile via shipper.js, and shows a toast.

WHAT-IF PANEL:
Collapsible panel at the bottom. Title "Ask about this scan". Four quick-chip 
buttons: "What would clear this?" / "Where to inspect first?" / "What contraband 
type?" / "Why uncertain?". A chat thread div (scrollable, max height) shows 
officer messages on the right (blue bubbles) and AI responses on the left (gray 
bubbles). A text input + Ask button. Each question POSTs to /whatif with the 
current scan context. AI responses have risk words colored (HIGH/CRITICAL in red, 
clear/safe in green).

WIRING ON SCAN:
1. POST to /analyze with FormData (image, manifest, shipper, route)
2. Immediately create audit entry with pending_review status, save thumbnail
3. Update entry with AI result
4. Call updateShipperProfile() with scan result
5. Render all result panels
6. Officer action → updateEntry() + updateShipperProfile() with action

═══════════════════════════════════════════════════════
FEATURE 2 — IMAGE COMPARISON (compare.html) — full detail
═══════════════════════════════════════════════════════

Two upload zones side by side. Left = "Reference scan — known-good baseline" 
with blue hover border. Right = "Current scan — today's shipment" with orange 
hover border. Each previews on its own small canvas.

Controls bar between upload and results: sensitivity slider (5-80, default 25) 
with live value label, overlay opacity slider (0-100), and "Run comparison" 
button disabled until both images are loaded.

When comparison runs, three panels appear side by side:
Panel 1: Reference image drawn at full opacity.
Panel 2: Current image drawn at full opacity.
Panel 3: Difference map — built by compare.js.

The pixel diff algorithm in compare.js:
Draw both images to hidden canvases at 640×480 (normalize size so diff is valid).
Loop every pixel: compute delta = average of absolute differences in R, G, B 
channels. If delta > threshold: paint that pixel red (if delta > 2.5× threshold) 
or amber (otherwise) with opacity from the opacity slider. Track delta per 
quadrant (top-left, top-right, bottom-left, bottom-right) by accumulating delta 
and pixel count separately for each. After the loop: normalize each quadrant's 
accumulated delta to a 0-100 score. Draw a semi-transparent colored rectangle 
over each quadrant (red/amber/green based on score) plus a text label showing 
"TL: 73" in white. Draw dashed grid lines between quadrants.

Four stat cards below the panels: changed pixels %, average delta value, current 
sensitivity value, and pixel risk level (HIGH if >15% changed, MEDIUM if >5%, 
LOW otherwise).

Gemini semantic analysis section: shows a spinner while the /compare API call 
runs in parallel with the pixel diff. When complete, show the summary sentence, 
severity badge, and recommendation. Then show difference cards (one per 
differences array item) with colored severity dot, location label, and description.

Officer action section at the bottom (same pattern as scan page) saves a 
comparison-type audit entry with type:"comparison".

═══════════════════════════════════════════════════════
FEATURE 3 — AUDIT TRAIL (audit.html) — full detail
═══════════════════════════════════════════════════════

The audit trail stores every scan and comparison event with its full lifecycle 
from AI result through officer action through physical inspection outcome.

Audit entry shape in ciibs_audit localStorage array:
entryId (uuid), scanId ("SHP-"+timestamp), type ("scan"|"comparison"), 
timestamp (ISO), filename, declaredGoods, shipperName, route, imageThumb 
(100px base64), aiDetections (full array), aiRisk, aiExplanation, 
aiMismatch, officerName, officerAction ("flagged"|"cleared"|"escalated"|null), 
officerNote, actionTime, physicalOutcome ("confirmed"|"false_positive"|"partial"|null), 
feedbackNote, closedAt, status ("pending_review"|"flagged"|"cleared"|"closed").

Stats bar at the top: five metric cards showing total scans, pending count, 
flagged count, cleared count, and AI accuracy % (confirmed / total closed × 100).

Filter row: buttons for All / Pending / Flagged / Cleared / Closed / Comparisons. 
A search input filters rows in real time by shipper name or scan ID.

Table with columns: thumbnail image, scan ID, relative timestamp ("2h ago"), 
declared goods, shipper name, AI risk pill, officer action text, status badge, 
expand arrow. Clicking the expand arrow reveals an inline sub-row showing the 
full AI detections as a mini table (label, confidence %, tier badge), officer 
name and note, and if physicalOutcome is null and status is flagged: three outcome 
buttons "Confirmed" / "False positive" / "Partial" that call updateEntry() and 
change status to "closed". This is the critical step that closes the feedback 
loop — recording what was actually found in the physical inspection.

Footer: Export CSV button that builds a CSV string from all entries and triggers 
a browser download. Clear all button with a confirm dialog.

═══════════════════════════════════════════════════════
FEATURE 4 — ANALYST FEEDBACK + SELF-LEARNING (feedback.html) — full detail
═══════════════════════════════════════════════════════

This is intentionally a dummy feature — it does not retrain any model. It 
demonstrates the concept of active learning readiness using real data from 
localStorage feedback clicks on the scan page.

Feedback entry shape in ciibs_feedback:
feedbackId (uuid), timestamp, entryId, scanId, detectionLabel, detectionTier, 
isCorrect (boolean), officerComment.

Stats row: four metric cards — total feedback given, correct detections count, 
false positives count, overall accuracy %.

Accuracy trend chart: a vanilla SVG line chart (no library, build with SVG path 
and circle elements) showing the running accuracy % across the last 20 feedback 
entries. X axis = feedback index 1-20, Y axis = 0-100%. Draw a green polyline, 
dots at each point, a dashed red reference line at 80%, and axis labels. 
Recompute by taking each feedback entry in chronological order and calculating 
correct_so_far / total_so_far at each point.

Feedback log table: Time, Detection label, Tier badge, Feedback (green 
"Correct" or red "False positive"), Scan ID.

Self-learning explanation card (blue-tinted border): explains that each 
correction feeds into future model improvements, that false positives on a 
category will raise its threshold in the next training cycle. Shows a progress 
bar: X corrections out of 50 needed to trigger a retraining cycle. When X 
reaches 50 (or any multiple of 50), show "Retraining cycle triggered — model 
update scheduled" in the card.

Category breakdown section: for each unique detectionLabel that has feedback, 
show a row with: category name, a green bar for correct count, a red bar for 
false positive count (both as percentage bars within a fixed width), and the 
accuracy % for that specific category. This shows officers which detection 
types they trust and which they don't.

═══════════════════════════════════════════════════════
FEATURE 5 — SHIPPER RISK PROFILING (shipper.html) — full detail
═══════════════════════════════════════════════════════

Every time a scan completes and an officer takes action, updateShipperProfile() 
in shipper.js writes to ciibs_shippers localStorage. This builds a persistent 
risk profile for every shipper across multiple sessions.

Shipper profile shape in ciibs_shippers (object keyed by shipper name):
name, totalScans, flagged, cleared, confirmed (physical inspections that 
confirmed AI flag), highRisk (scans where aiRisk was high/critical), 
riskHistory (array of last 10 overall_risk scores as 0-100 numbers), 
compositeRisk (0-100 computed score), firstSeen (ISO), lastSeen (ISO), 
routes (array of unique route strings).

Composite risk score formula in shipper.js:
Take riskHistory array. Assign weights: index 0 (oldest) gets weight 1, 
last entry gets weight = length. Weighted average = sum(score × weight) / 
sum(weights). Flag penalty = (flagged / totalScans) × 30. 
compositeRisk = min(100, round(weighted_average + flag_penalty)).

Page layout: search input + sort dropdown (by risk score / scan count / 
last seen) + filter buttons (All / High risk ≥70 / Watchlist).

Shipper cards in a 2-column grid. Each card shows:
Shipper name as heading. "First seen X days ago · Last scan X hours ago" in 
small gray text. The composite risk score as a large bold number colored by 
tier. Four small stat boxes: total scans, flagged (red), cleared (green), 
flag rate % (colored). A risk trend sparkline — a small inline SVG (300×32px) 
with a polyline connecting the last 10 riskHistory values as dots on a 
0-100 Y axis, colored by the composite score. Routes shown as small gray pill 
badges. If compositeRisk ≥ 70: a red warning banner "On high-risk watchlist — 
all shipments require supervisor approval before clearance". A "View history" 
button that links to audit.html with the shipper name pre-filled in the search.

updateShipperProfile() in shipper.js:
Called from index.html after scan + officer action. Creates profile if new 
shipper. Increments totalScans. Pushes the numerical risk score (convert 
"low"→25, "medium"→55, "high"→80, "critical"→95) to riskHistory (keep last 10). 
Increments flagged or cleared based on officerAction. Recomputes compositeRisk. 
Updates lastSeen. Saves back to localStorage.

═══════════════════════════════════════════════════════
FEATURE 6 — AUDIT TRAIL + REPORT GENERATION (report.html) — full detail
═══════════════════════════════════════════════════════

Report page has two sections: scan selector and PDF preview/download.

Scan selector: a dropdown populated from ciibs_audit localStorage showing 
recent entries as "SHP-xxx · [shipper name] · [risk tier] · [timestamp]". 
A "Use latest scan" button auto-selects the most recent entry. Officer name 
input and notes textarea for any additional comments. Include heatmap toggle.

When Generate PDF is clicked, report.js builds the PDF using jsPDF (loaded 
from CDN as window.jsPDF):
- A4 format (210×297mm)
- Dark navy rectangle header (full width, 25mm tall): white bold title 
  "CUSTOMS CARGO SCAN REPORT", gray sub-text "OFFICIAL DOCUMENT"
- Scan metadata section: Scan ID, date/time, officer name, route, 
  declared goods in two columns
- Overall risk level as large colored text with the risk_explanation
- Detections table: columns Label / Category / Confidence / Risk Tier, 
  alternating white and light gray rows, header row in navy
- If declaredMismatch true: a highlighted box with mismatch_detail
- Officer action and notes section
- If imageThumb exists in the audit entry: add it as a small image 
  (50mm wide) in the top right of the metadata section
- Footer line: "Generated by CargoScan AI · [ISO timestamp] · For Official Use Only"
- Trigger download as cargo-report-[scanId].pdf

The /report FastAPI route is a backup server-side generator using reportlab 
in case jsPDF is insufficient. The frontend jsPDF version is primary.

═══════════════════════════════════════════════════════
BUILD ORDER
═══════════════════════════════════════════════════════

1. Backend: main.py → gemini.py → analyze.py → compare.py → pdf_gen.py → report.py
2. Test backend with curl before touching frontend
3. Frontend JS: api.js → audit.js → feedback.js → shipper.js → confidence.js → heatmap.js → compare.js → report.js
4. Frontend HTML: index.html → audit.html → compare.html → shipper.html → feedback.html → report.html

Test after each backend route: 
curl -X POST http://localhost:8000/analyze -F "image=@test.jpg" -F "manifest=test cargo" -F "shipper=TestCo" -F "route=test"

Now build the complete project.