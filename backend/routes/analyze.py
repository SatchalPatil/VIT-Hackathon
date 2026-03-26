from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.gemini import analyze_image, whatif_query

router = APIRouter()

@router.post("/analyze")
async def analyze_cargo(
    image: UploadFile = File(...),
    manifest: str = Form(...),
    shipper: str = Form(""),
    route: str = Form("")
):
    """
    Analyze a cargo X-ray image using Gemini AI.

    - **image**: X-ray image file (JPEG, PNG)
    - **manifest**: Declared cargo manifest
    - **shipper**: Shipper name (optional)
    - **route**: Shipping route (optional)
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    # Read image bytes
    image_bytes = await image.read()

    # Analyze with Gemini
    result = await analyze_image(image_bytes, manifest)

    # Add metadata to result
    result["metadata"] = {
        "filename": image.filename,
        "shipper": shipper,
        "route": route,
        "manifest": manifest
    }

    return result

@router.post("/whatif")
async def whatif(
    context: dict,
    question: str
):
    """
    Ask a follow-up question about a scan.

    - **context**: The scan result context
    - **question**: Officer's question
    """
    result = await whatif_query(context, question)
    return result
