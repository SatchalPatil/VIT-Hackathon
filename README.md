# CargoScan AI

CargoScan AI is a prototype cargo X-ray analysis platform for customs and border security workflows.
It combines:
- A FastAPI backend for AI analysis, scan comparison, what-if Q&A, and PDF report generation
- A multi-page HTML + Tailwind + vanilla JS frontend for scan operations and audit workflows

## Tech Stack

- Frontend: HTML, Tailwind CSS (CDN), vanilla JavaScript, jsPDF (CDN)
- Backend: FastAPI, google-generativeai, Pillow, reportlab
- Storage: Browser localStorage (no database)
- AI Model: Gemini 2.5 Flash

## Project Structure

```text
backend/
  main.py
  requirements.txt
  routes/
  services/
frontend/
  index.html
  compare.html
  audit.html
  shipper.html
  feedback.html
  report.html
  js/
```

## Prerequisites

- Python 3.10+
- A Gemini API key
- VS Code Live Server extension (or any local static server)

## Environment Setup

Create `backend/.env`:

```env
GEMINI_API_KEY=your_api_key_here
```

## Run Backend

From the workspace root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend will be available at:
- API root: http://localhost:8000/
- Health check: http://localhost:8000/health
- Swagger docs: http://localhost:8000/docs

## Run Frontend

Because this project uses static HTML pages and browser `fetch`, run the frontend through a local web server:

1. Open the `frontend` folder in VS Code.
2. Open `index.html` with Live Server.
3. Keep backend running on `http://localhost:8000`.

The frontend API base URL is configured in `frontend/js/api.js`.

## Main Features

- Scan page (`index.html`): Upload X-ray, AI detection, heatmap/annotated view, officer actions, what-if Q&A
- Compare page (`compare.html`): Pixel-level + AI semantic comparison between baseline/current scans
- Audit trail (`audit.html`): Full action history and review tracking
- Shipper profiles (`shipper.html`): Risk trend overview by shipper
- Feedback (`feedback.html`): Analyst correctness feedback loop
- Reports (`report.html`): Export scan/audit data to PDF

## API Endpoints

- `POST /analyze`
  - multipart form fields: `image`, `manifest`, optional `shipper`, optional `route`
- `POST /compare`
  - multipart form fields: `image1`, `image2`
- `POST /whatif`
  - JSON body: `{ "context": {...}, "question": "..." }`
- `POST /report`
  - JSON body with scan/report payload, returns PDF stream
- `GET /health`
  - returns service status

## Notes

- CORS is open for development in `backend/main.py`.
- Audit, feedback, and some workflow data are stored in browser localStorage.
- If Gemini returns malformed JSON, backend route handlers include fallback behavior to keep UI flow running.
