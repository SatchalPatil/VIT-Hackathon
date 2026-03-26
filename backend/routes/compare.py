from fastapi import APIRouter, UploadFile, File, HTTPException
from services.gemini import compare_images

router = APIRouter()

@router.post("/compare")
async def compare_scans(
    image1: UploadFile = File(...),
    image2: UploadFile = File(...)
):
    """
    Compare two cargo X-ray images using Gemini AI.

    - **image1**: Reference scan (known-good baseline)
    - **image2**: Current scan (today's shipment)
    """
    # Validate file types
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]

    if image1.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type for image1. Allowed: {', '.join(allowed_types)}"
        )

    if image2.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type for image2. Allowed: {', '.join(allowed_types)}"
        )

    # Read image bytes
    img1_bytes = await image1.read()
    img2_bytes = await image2.read()

    # Compare with Gemini
    result = await compare_images(img1_bytes, img2_bytes)

    # Add metadata
    result["metadata"] = {
        "reference_file": image1.filename,
        "current_file": image2.filename
    }

    return result
