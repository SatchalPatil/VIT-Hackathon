from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from services.pdf_gen import generate_pdf_report
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

class Detection(BaseModel):
    label: str
    category: str
    confidence_pct: int
    reason: Optional[str] = None
    region: Optional[str] = None

class ReportData(BaseModel):
    scanId: str
    timestamp: str
    officerName: Optional[str] = None
    route: Optional[str] = None
    declaredGoods: Optional[str] = None
    shipperName: Optional[str] = None
    aiRisk: Optional[str] = None
    aiExplanation: Optional[str] = None
    aiDetections: Optional[List[Detection]] = []
    aiMismatch: Optional[bool] = False
    mismatchDetail: Optional[str] = None
    officerAction: Optional[str] = None
    officerNote: Optional[str] = None

@router.post("/report")
async def generate_report(data: ReportData):
    """
    Generate a PDF report from scan data.

    Returns a downloadable PDF file.
    """
    try:
        # Convert to dict for PDF generation
        scan_data = data.model_dump()

        # Convert detections to list of dicts
        if scan_data.get('aiDetections'):
            scan_data['aiDetections'] = [
                det if isinstance(det, dict) else det
                for det in scan_data['aiDetections']
            ]

        # Generate PDF
        pdf_buffer = generate_pdf_report(scan_data)

        # Return as streaming response
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=cargo-report-{data.scanId}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
