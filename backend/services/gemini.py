import google.generativeai as genai
import os
import json
import re
from PIL import Image
import io

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Use Gemini 2.5 Flash model
model = genai.GenerativeModel("gemini-2.5-flash-preview-05-20")

def strip_json_fences(text: str) -> str:
    """Remove markdown code fences from JSON response."""
    # Remove ```json and ``` fences
    text = re.sub(r'^```json\s*', '', text.strip())
    text = re.sub(r'^```\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text.strip())
    return text.strip()

async def analyze_image(image_bytes: bytes, manifest: str) -> dict:
    """
    Analyze a cargo X-ray image using Gemini.
    Returns detection results with risk assessment.
    """
    prompt = f"""You are an expert customs X-ray analyst. Analyze this cargo X-ray image.

X-RAY PHYSICS: Dense/metallic objects appear very DARK or BLACK. Organic
materials appear LIGHT GREY. Plastics are MEDIUM GREY. Hollow spaces are WHITE.
This is NOT a normal photograph.

DECLARED MANIFEST: {manifest}

Look for: objects inconsistent with the manifest, unusual density patterns,
weapon shapes (elongated dark objects with handles), concealed organic masses,
dense rectangles suggesting undeclared electronics, any region that does not
match expected cargo.

IMPORTANT: Divide the image into a 3x3 grid mentally. For each detection, specify
which grid cell it's in using the region field.

Return ONLY valid JSON, no markdown:
{{
  "detections": [{{
    "label": "descriptive name of the suspicious object",
    "category": "weapon-like shape | organic concealment | dense metallic anomaly | undeclared electronics | normal cargo",
    "confidence_pct": 0-100,
    "reason": "specific 1-2 sentence explanation referencing shape, density, position",
    "region": "MUST be one of: top-left | top-center | top-right | center-left | center | center-right | bottom-left | bottom-center | bottom-right"
  }}],
  "overall_risk": "low | medium | high | critical",
  "risk_explanation": "one sentence for the officer",
  "declared_mismatch": true | false,
  "mismatch_detail": "specific mismatch or null",
  "officer_summary": "single actionable sentence"
}}"""

    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))

        # Generate response with image
        response = model.generate_content([prompt, image])

        # Parse JSON response
        result_text = strip_json_fences(response.text)
        result = json.loads(result_text)

        return result
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse AI response: {str(e)}",
            "raw_response": response.text if 'response' in locals() else None,
            "detections": [],
            "overall_risk": "medium",
            "risk_explanation": "AI response parsing failed - manual review required",
            "declared_mismatch": False,
            "mismatch_detail": None,
            "officer_summary": "System error - please review manually"
        }
    except Exception as e:
        return {
            "error": str(e),
            "detections": [],
            "overall_risk": "medium",
            "risk_explanation": "Analysis failed - manual review required",
            "declared_mismatch": False,
            "mismatch_detail": None,
            "officer_summary": "System error - please review manually"
        }

async def compare_images(img1_bytes: bytes, img2_bytes: bytes) -> dict:
    """
    Compare two cargo X-ray scans using Gemini.
    Image 1 = reference (cleared baseline), Image 2 = current scan.
    """
    prompt = """You are comparing two cargo X-ray scans. Image 1 = REFERENCE (cleared baseline).
Image 2 = CURRENT (today's scan, same route). Dark = dense, light = organic.

IMPORTANT: Divide each image into a 3x3 grid mentally. Specify locations using:
top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right

Return ONLY valid JSON:
{
  "differences": [{"location": "region from the grid (e.g. top-left, center)", "description": "what changed", "severity": "HIGH|MEDIUM|LOW"}],
  "severity": "HIGH|MEDIUM|LOW",
  "summary": "one sentence for officer",
  "recommendation": "specific action"
}"""

    try:
        # Convert bytes to PIL Images
        image1 = Image.open(io.BytesIO(img1_bytes))
        image2 = Image.open(io.BytesIO(img2_bytes))

        # Generate response with both images
        response = model.generate_content([prompt, image1, image2])

        # Parse JSON response
        result_text = strip_json_fences(response.text)
        result = json.loads(result_text)

        return result
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse AI response: {str(e)}",
            "differences": [],
            "severity": "MEDIUM",
            "summary": "AI response parsing failed - manual review required",
            "recommendation": "Manual inspection recommended"
        }
    except Exception as e:
        return {
            "error": str(e),
            "differences": [],
            "severity": "MEDIUM",
            "summary": "Comparison failed - manual review required",
            "recommendation": "Manual inspection recommended"
        }

async def whatif_query(scan_context: dict, question: str) -> dict:
    """
    Answer officer questions about a specific scan.
    """
    prompt = f"""You are a customs AI analyst. This scan returned: {json.dumps(scan_context)}
Officer asks: "{question}"
Answer in 2-4 sentences specific to THIS scan. If asking about clearing:
explain exactly what evidence would resolve the concern.
Return JSON: {{"answer": "your response"}}"""

    try:
        response = model.generate_content(prompt)

        # Parse JSON response
        result_text = strip_json_fences(response.text)
        result = json.loads(result_text)

        return result
    except json.JSONDecodeError:
        # Try to extract answer from non-JSON response
        return {"answer": response.text if 'response' in locals() else "Unable to process question"}
    except Exception as e:
        return {"answer": f"Error processing question: {str(e)}"}
