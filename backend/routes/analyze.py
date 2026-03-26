from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.analyze_yolo import analyze_image, compare_images
from pathlib import Path

router = APIRouter()

@router.post("/analyze")
async def analyze_cargo(
    image: UploadFile = File(...),
    manifest: str = Form(...),
    shipper: str = Form(""),
    route: str = Form("")
):
    """
    Analyze a cargo X-ray image using YOLO object detection.

    - **image**: X-ray image file (JPEG, PNG)
    - **manifest**: Declared cargo manifest
    - **shipper**: Shipper name (optional)
    - **route**: Shipping route (optional)
    """
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    image_bytes = await image.read()
    result = await analyze_image(image_bytes, manifest)

    annotated_file = result.get("annotated_image_file")
    if annotated_file:
        result["annotated_image_url"] = f"/output/{Path(annotated_file).name}"

    raw_output_file = result.get("raw_output_file")
    if raw_output_file:
        result["raw_output_url"] = f"/output/{Path(raw_output_file).name}"

    result["metadata"] = {
        "filename": image.filename,
        "shipper": shipper,
        "route": route,
        "manifest": manifest
    }

    return result

@router.post("/compare")
async def compare_cargo(
    image1: UploadFile = File(...),
    image2: UploadFile = File(...)
):
    """Compare two cargo X-ray scans."""
    img1_bytes = await image1.read()
    img2_bytes = await image2.read()
    
    result = await compare_images(img1_bytes, img2_bytes)
    return result
