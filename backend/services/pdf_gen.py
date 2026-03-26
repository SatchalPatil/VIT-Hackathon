from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO
import base64
from datetime import datetime

# Risk tier colors
TIER_COLORS = {
    "critical": "#ef4444",
    "high": "#f97316",
    "moderate": "#f59e0b",
    "medium": "#f59e0b",
    "low": "#22c55e",
    "clear": "#6b7280"
}

def get_tier_from_confidence(confidence: int) -> str:
    """Get risk tier from confidence percentage."""
    if confidence >= 90:
        return "critical"
    elif confidence >= 75:
        return "high"
    elif confidence >= 51:
        return "moderate"
    elif confidence >= 31:
        return "low"
    else:
        return "clear"

def generate_pdf_report(scan_data: dict) -> BytesIO:
    """
    Generate a PDF report from scan data.
    Returns a BytesIO buffer containing the PDF.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15*mm,
        leftMargin=15*mm,
        topMargin=15*mm,
        bottomMargin=15*mm
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=white,
        alignment=TA_CENTER,
        spaceAfter=0
    )

    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=HexColor("#9ca3af"),
        alignment=TA_CENTER
    )

    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor("#1e3a5f"),
        spaceBefore=10,
        spaceAfter=5
    )

    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=black
    )

    elements = []

    # Header section (navy background)
    header_data = [
        [Paragraph("CUSTOMS CARGO SCAN REPORT", title_style)],
        [Paragraph("OFFICIAL DOCUMENT", subtitle_style)]
    ]
    header_table = Table(header_data, colWidths=[180*mm])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor("#1e3a5f")),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10*mm))

    # Scan metadata section
    elements.append(Paragraph("Scan Information", section_style))

    scan_id = scan_data.get('scanId', 'N/A')
    timestamp = scan_data.get('timestamp', datetime.now().isoformat())
    officer_name = scan_data.get('officerName', 'N/A')
    route = scan_data.get('route', 'N/A')
    declared_goods = scan_data.get('declaredGoods', 'N/A')
    shipper_name = scan_data.get('shipperName', 'N/A')

    metadata = [
        ['Scan ID:', scan_id, 'Date/Time:', timestamp[:19] if len(timestamp) > 19 else timestamp],
        ['Officer:', officer_name, 'Route:', route],
        ['Shipper:', shipper_name, 'Declared Goods:', declared_goods[:50] + '...' if len(declared_goods) > 50 else declared_goods],
    ]

    meta_table = Table(metadata, colWidths=[25*mm, 60*mm, 30*mm, 60*mm])
    meta_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor("#6b7280")),
        ('TEXTCOLOR', (2, 0), (2, -1), HexColor("#6b7280")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 5*mm))

    # Risk assessment section
    overall_risk = scan_data.get('aiRisk', 'unknown').upper()
    risk_color = TIER_COLORS.get(overall_risk.lower(), "#6b7280")
    risk_explanation = scan_data.get('aiExplanation', 'No explanation provided')

    elements.append(Paragraph("Risk Assessment", section_style))

    risk_style = ParagraphStyle(
        'RiskLevel',
        parent=styles['Normal'],
        fontSize=16,
        textColor=HexColor(risk_color),
        fontName='Helvetica-Bold'
    )
    elements.append(Paragraph(f"Overall Risk: {overall_risk}", risk_style))
    elements.append(Paragraph(risk_explanation, normal_style))
    elements.append(Spacer(1, 5*mm))

    # Detections table
    detections = scan_data.get('aiDetections', [])
    if detections:
        elements.append(Paragraph("Detections", section_style))

        det_header = ['Label', 'Category', 'Confidence', 'Risk Tier']
        det_data = [det_header]

        for det in detections:
            confidence = det.get('confidence_pct', 0)
            tier = get_tier_from_confidence(confidence)
            det_data.append([
                det.get('label', 'Unknown')[:30],
                det.get('category', 'N/A')[:25],
                f"{confidence}%",
                tier.upper()
            ])

        det_table = Table(det_data, colWidths=[50*mm, 55*mm, 25*mm, 25*mm])
        det_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor("#1e3a5f")),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (3, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, HexColor("#f3f4f6")]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(det_table)
        elements.append(Spacer(1, 5*mm))

    # Mismatch section
    if scan_data.get('aiMismatch'):
        mismatch_detail = scan_data.get('mismatchDetail', 'Mismatch detected')
        mismatch_style = ParagraphStyle(
            'Mismatch',
            parent=styles['Normal'],
            fontSize=10,
            textColor=HexColor("#ef4444"),
            backColor=HexColor("#fef2f2"),
            borderPadding=5
        )
        elements.append(Paragraph(f"⚠ DECLARED MISMATCH: {mismatch_detail}", mismatch_style))
        elements.append(Spacer(1, 5*mm))

    # Officer action section
    officer_action = scan_data.get('officerAction', 'No action recorded')
    officer_note = scan_data.get('officerNote', '')

    elements.append(Paragraph("Officer Action", section_style))
    elements.append(Paragraph(f"Action: {officer_action.upper() if officer_action else 'PENDING'}", normal_style))
    if officer_note:
        elements.append(Paragraph(f"Notes: {officer_note}", normal_style))

    elements.append(Spacer(1, 10*mm))

    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=HexColor("#6b7280"),
        alignment=TA_CENTER
    )
    footer_text = f"Generated by CargoScan AI · {datetime.now().isoformat()[:19]} · For Official Use Only"
    elements.append(Paragraph(footer_text, footer_style))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)

    return buffer
