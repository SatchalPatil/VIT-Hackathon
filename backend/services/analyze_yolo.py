import base64
import json
import logging
import time
from ultralytics import YOLO
from PIL import Image
import io
import os
import numpy as np
import torch
import cv2
from datetime import datetime
import supervision as sv
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global logs list for this session
process_logs = []

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "Output"


def log_process(message: str, level: str = "info"):
    """Add a timestamped log message."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    log_entry = {"timestamp": timestamp, "level": level, "message": message}
    process_logs.append(log_entry)
    logger.info(f"[{timestamp}] [{level.upper()}] {message}")
    print(f"[{timestamp}] [{level.upper()}] {message}")
    return log_entry


def save_roboflow_output(payload: dict) -> str:
    """Persist raw Roboflow API output to Output/ and return saved file path."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"roboflow_output_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.json"
    file_path = OUTPUT_DIR / filename
    with file_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return str(file_path)


def save_annotated_image(annotated_bgr: np.ndarray) -> str:
    """Save annotated image (BGR numpy array) to Output/ and return file path."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"annotated_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
    file_path = OUTPUT_DIR / filename
    cv2.imwrite(str(file_path), annotated_bgr)
    return str(file_path)


def numpy_to_base64(image_bgr: np.ndarray) -> str:
    """Encode a BGR numpy array as a base64 JPEG string for frontend use."""
    _, buffer = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(buffer).decode("utf-8")


def build_annotated_image(
    image_array: np.ndarray,
    sv_detections: sv.Detections,
    pred_list: list,
) -> np.ndarray:
    """
    Draw bounding boxes + confidence labels on the image using supervision.
    Returns a BGR numpy array ready for cv2.imwrite / base64 encoding.
    """
    # supervision expects BGR; PIL gives RGB — convert once here
    image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)

    # Build human-readable labels: "knife 87%"
    labels = [
        f"{p.get('class', 'Unknown')} {int(p.get('confidence', 0) * 100)}%"
        for p in pred_list
    ]

    box_annotator = sv.BoxAnnotator(thickness=6)
    label_annotator = sv.LabelAnnotator(text_scale=0.6, text_thickness=1)

    annotated = box_annotator.annotate(scene=image_bgr.copy(), detections=sv_detections)
    annotated = label_annotator.annotate(
        scene=annotated, detections=sv_detections, labels=labels
    )
    return annotated


def extract_full_prediction(pred: dict, img_width: int, img_height: int) -> dict:
    """
    Extract every field Roboflow returns for a single prediction, plus derived fields.
    Roboflow returns center-based coordinates (x, y, width, height).
    """
    x      = pred.get("x", 0)          # bbox center-x (pixels)
    y      = pred.get("y", 0)          # bbox center-y (pixels)
    w      = pred.get("width", 0)      # bbox width   (pixels)
    h      = pred.get("height", 0)     # bbox height  (pixels)
    conf   = pred.get("confidence", 0)
    label  = pred.get("class", "Unknown")

    # Derived corner coordinates (xyxy format)
    x1 = x - w / 2
    y1 = y - h / 2
    x2 = x + w / 2
    y2 = y + h / 2

    # Relative coordinates (0-1 range) for frontend overlays
    rel_x1 = x1 / img_width  if img_width  else 0
    rel_y1 = y1 / img_height if img_height else 0
    rel_x2 = x2 / img_width  if img_width  else 0
    rel_y2 = y2 / img_height if img_height else 0

    # Bounding box area as % of image
    bbox_area_pct = round((w * h) / (img_width * img_height) * 100, 2) if (img_width * img_height) else 0

    return {
        # ── Core Roboflow fields ──────────────────────────────────────────
        "label":          label,
        "class_id":       pred.get("class_id"),
        "detection_id":   pred.get("detection_id"),       # UUID assigned by Roboflow
        "confidence":     round(float(conf), 4),
        "confidence_pct": int(float(conf) * 100) if conf <= 1 else int(conf),

        # ── Bounding box — center format (as returned by API) ─────────────
        "bbox_center": {"x": x, "y": y},
        "bbox_size":   {"width": w, "height": h},

        # ── Bounding box — corner format (xyxy, easier for drawing) ───────
        "bbox_xyxy": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},

        # ── Relative coordinates (0–1, useful for responsive frontends) ───
        "bbox_relative": {
            "x1": round(rel_x1, 4),
            "y1": round(rel_y1, 4),
            "x2": round(rel_x2, 4),
            "y2": round(rel_y2, 4),
        },

        # ── Derived metadata ──────────────────────────────────────────────
        "bbox_area_pct": bbox_area_pct,
        "region":        grid_to_region(x, y, img_width, img_height),
    }


# ── Roboflow Inference SDK setup ──────────────────────────────────────────────
roboflow_client = None
roboflow_model_id = "x-ray-airport-prohibited-items/1"
roboflow_available = False
try:
    log_process("Initializing Roboflow Inference SDK...")
    from inference_sdk import InferenceHTTPClient

    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        log_process("⚠️ ROBOFLOW_API_KEY not set in environment", "warning")
    else:
        log_process("✓ Found ROBOFLOW_API_KEY")
        roboflow_client = InferenceHTTPClient(
            api_url="https://serverless.roboflow.com",
            api_key=api_key,
        )
        log_process("✓ Roboflow Inference SDK initialized")
        log_process(f"✓ Using model: {roboflow_model_id}")
        roboflow_available = True
except Exception as e:
    log_process(f"❌ Roboflow SDK initialization failed: {str(e)}", "error")
    roboflow_available = False

# ── Local YOLO fallback (loaded ONCE at module level) ─────────────────────────
yolo_model = None
try:
    log_process("Checking for local YOLO model (best.pt)...")
    model_path = "best.pt"
    if os.path.exists(model_path):
        yolo_model = YOLO(model_path)
        log_process(f"✓ Loaded local YOLO model from {model_path}")
    else:
        log_process(f"⚠️ Local model not found at {model_path}", "warning")
except Exception as e:
    log_process(f"⚠️ Local YOLO model load skipped: {str(e)}", "warning")


def grid_to_region(x_center, y_center, width, height):
    """Convert bounding box center to 3x3 grid region."""
    x_ratio = x_center / width  if width  > 0 else 0
    y_ratio = y_center / height if height > 0 else 0
    regions = [
        ["top-left",    "top-center",    "top-right"],
        ["center-left", "center",        "center-right"],
        ["bottom-left", "bottom-center", "bottom-right"],
    ]
    x_idx = 0 if x_ratio < 0.33 else (1 if x_ratio < 0.67 else 2)
    y_idx = 0 if y_ratio < 0.33 else (1 if y_ratio < 0.67 else 2)
    return regions[y_idx][x_idx]


async def analyze_image(image_bytes: bytes, manifest: str) -> dict:
    """
    Analyze X-ray image using Roboflow YOLO model (prohibited items detector).
    Falls back to local YOLOv8 model if Roboflow is unavailable.

    Returns full prediction data + annotated image as base64 + saved file paths.
    """
    global process_logs
    process_logs = []

    start_time = time.time()
    log_process("🎬 Starting X-ray image analysis...")

    try:
        # ── Load image ────────────────────────────────────────────────────────
        log_process("📦 Loading image from bytes...")
        image = Image.open(io.BytesIO(image_bytes))
        image_format = image.format or "UNKNOWN"
        image_mode   = image.mode
        image_array  = np.array(image)
        height, width = image_array.shape[:2]
        channels      = image_array.shape[2] if len(image_array.shape) == 3 else 1
        log_process(f"✓ Image loaded: {width}×{height}px | mode={image_mode} | format={image_format}")

        image_metadata = {
            "width": width, "height": height,
            "channels": channels,
            "format": image_format,
            "mode": image_mode,
        }

        detections           = []
        model_used           = "none"
        roboflow_raw_output  = None
        roboflow_output_file = None
        annotated_image_b64  = None
        annotated_image_file = None

        risk_categories = {
            "weapon":      "weapon-like shape",
            "gun":         "weapon-like shape",
            "knife":       "weapon-like shape",
            "explosive":   "dense metallic anomaly",
            "drug":        "organic concealment",
            "electronics": "undeclared electronics",
        }

        # ── Roboflow inference ────────────────────────────────────────────────
        if roboflow_available and roboflow_client:
            log_process("🤖 Roboflow model available — starting inference...")
            inference_start = time.time()
            try:
                log_process("📤 Sending image to Roboflow API...")

                # .infer() accepts numpy arrays, PIL images, file paths, or URLs
                result = roboflow_client.infer(image_array, model_id=roboflow_model_id)
                roboflow_raw_output  = result
                roboflow_output_file = save_roboflow_output(result)
                log_process(f"✓ Saved raw Roboflow output → {roboflow_output_file}")

                inference_time = time.time() - inference_start
                log_process(f"✓ Roboflow response received ({inference_time:.2f}s)")

                pred_list = result.get("predictions", [])

                if pred_list:
                    log_process(f"🎯 Roboflow detected {len(pred_list)} object(s)")
                    model_used = "roboflow"

                    # Convert to supervision Detections
                    sv_detections = sv.Detections.from_inference(result)

                    # ── Build annotated image ─────────────────────────────
                    log_process("🖼️ Generating annotated image with bounding boxes...")
                    annotated_bgr        = build_annotated_image(image_array, sv_detections, pred_list)
                    annotated_image_b64  = numpy_to_base64(annotated_bgr)
                    annotated_image_file = save_annotated_image(annotated_bgr)
                    log_process(f"✓ Annotated image saved → {annotated_image_file}")

                    # ── Extract all fields per detection ──────────────────
                    for i, pred in enumerate(pred_list):
                        full_pred = extract_full_prediction(pred, width, height)
                        category  = next(
                            (v for k, v in risk_categories.items()
                             if k.lower() in full_pred["label"].lower()),
                            "normal cargo"
                        )
                        log_process(
                            f"  [{i+1}] {full_pred['label']} "
                            f"{full_pred['confidence_pct']}% | "
                            f"bbox=({full_pred['bbox_xyxy']['x1']:.0f},{full_pred['bbox_xyxy']['y1']:.0f},"
                            f"{full_pred['bbox_xyxy']['x2']:.0f},{full_pred['bbox_xyxy']['y2']:.0f}) | "
                            f"region={full_pred['region']}"
                        )
                        detections.append({
                            **full_pred,
                            "category": category,
                            "reason": (
                                f"Detected prohibited item '{full_pred['label']}' "
                                f"in cargo during X-ray scan"
                            ),
                        })
                else:
                    log_process("✓ Roboflow: No prohibited items detected")
                    model_used = "roboflow"

                    # Still generate a clean (unannotated) image for consistency
                    annotated_bgr        = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
                    annotated_image_b64  = numpy_to_base64(annotated_bgr)
                    annotated_image_file = save_annotated_image(annotated_bgr)

            except Exception as e:
                log_process(f"⚠️ Roboflow API error: {str(e)}", "error")
                log_process("🔄 Falling back to local YOLO model...")

        # ── Local YOLO fallback ───────────────────────────────────────────────
        if model_used == "none" and yolo_model:
            log_process("🤖 Using local YOLOv8 model for inference...")
            inference_start = time.time()
            try:
                results        = yolo_model.predict(image_array, conf=0.5)
                inference_time = time.time() - inference_start
                log_process(f"✓ YOLOv8 inference completed ({inference_time:.2f}s)")
                model_used = "yolov8-local"

                if results and len(results) > 0:
                    boxes = results[0].boxes
                    log_process(f"🎯 YOLOv8 detected {len(boxes)} object(s)")

                    # Build supervision detections for annotation
                    sv_detections = sv.Detections.from_ultralytics(results[0])
                    yolo_pred_list = []

                    for i, box in enumerate(boxes):
                        conf     = float(box.conf[0])
                        cls_id   = int(box.cls[0])
                        x1_, y1_, x2_, y2_ = (float(v) for v in box.xyxy[0])
                        x_center = (x1_ + x2_) / 2
                        y_center = (y1_ + y2_) / 2
                        bw       = x2_ - x1_
                        bh       = y2_ - y1_

                        class_name = results[0].names.get(cls_id, f"Object {cls_id}")
                        region     = grid_to_region(x_center, y_center, width, height)
                        category   = next(
                            (v for k, v in risk_categories.items()
                             if k.lower() in class_name.lower()),
                            "normal cargo"
                        )

                        yolo_pred_list.append({"class": class_name, "confidence": conf})
                        log_process(f"  [{i+1}] {class_name}: {conf*100:.1f}% | region={region}")

                        detections.append({
                            "label":          class_name,
                            "class_id":       cls_id,
                            "detection_id":   None,
                            "confidence":     round(conf, 4),
                            "confidence_pct": int(conf * 100),
                            "bbox_center":    {"x": x_center, "y": y_center},
                            "bbox_size":      {"width": bw, "height": bh},
                            "bbox_xyxy":      {"x1": x1_, "y1": y1_, "x2": x2_, "y2": y2_},
                            "bbox_relative":  {
                                "x1": round(x1_ / width,  4),
                                "y1": round(y1_ / height, 4),
                                "x2": round(x2_ / width,  4),
                                "y2": round(y2_ / height, 4),
                            },
                            "bbox_area_pct":  round((bw * bh) / (width * height) * 100, 2),
                            "region":         region,
                            "category":       category,
                            "reason":         f"YOLOv8 detected '{class_name}' in image",
                        })

                    # Annotate with supervision
                    log_process("🖼️ Generating annotated image (YOLOv8)...")
                    annotated_bgr        = build_annotated_image(image_array, sv_detections, yolo_pred_list)
                    annotated_image_b64  = numpy_to_base64(annotated_bgr)
                    annotated_image_file = save_annotated_image(annotated_bgr)
                    log_process(f"✓ Annotated image saved → {annotated_image_file}")

            except Exception as e:
                log_process(f"❌ YOLOv8 inference failed: {str(e)}", "error")
                raise

        elif model_used == "none":
            log_process("❌ No suitable model available", "error")
            return {
                "error":             "No model available",
                "detections":        [],
                "overall_risk":      "medium",
                "risk_explanation":  "Model loading failed - cannot analyze",
                "declared_mismatch": False,
                "mismatch_detail":   None,
                "officer_summary":   "System error - manual review required",
                "model_used":        "none",
                "image_metadata":    image_metadata,
                "annotated_image_b64":  None,
                "annotated_image_file": None,
                "raw_output":        None,
                "raw_output_file":   None,
                "logs":              process_logs,
            }

        # ── Risk assessment ───────────────────────────────────────────────────
        log_process("📊 Calculating risk assessment...")
        if not detections:
            overall_risk     = "low"
            risk_explanation = "No prohibited items detected in scan"
        else:
            avg_confidence  = sum(d["confidence_pct"] for d in detections) / len(detections)
            detection_count = len(detections)
            if detection_count >= 3 or avg_confidence > 80:
                overall_risk = "critical"
            elif detection_count >= 2 or avg_confidence > 60:
                overall_risk = "high"
            else:
                overall_risk = "medium"
            risk_explanation = (
                f"Detected {detection_count} item(s) with avg confidence {avg_confidence:.0f}%"
            )

        log_process(f"✓ Risk Assessment: {overall_risk.upper()}")
        elapsed = time.time() - start_time
        log_process(f"✅ Analysis complete in {elapsed:.2f}s")

        return {
            "detections":           detections,
            "overall_risk":         overall_risk,
            "risk_explanation":     risk_explanation,
            "declared_mismatch":    len(detections) > 0,
            "mismatch_detail":      f"Found {len(detections)} items" if detections else None,
            "officer_summary": (
                f"{len(detections)} item(s) detected — "
                f"{'review recommended' if detections else 'cargo clear'}"
            ),
            "model_used":           model_used,
            "image_metadata":       image_metadata,
            # ── Annotated image ───────────────────────────────────────────────
            "annotated_image_b64":  annotated_image_b64,   # base64 JPEG — use in <img src="data:image/jpeg;base64,...">
            "annotated_image_file": annotated_image_file,  # absolute path on disk
            # ── Raw API output ────────────────────────────────────────────────
            "raw_output":           roboflow_raw_output,
            "raw_output_file":      roboflow_output_file,
            "logs":                 process_logs,
        }

    except Exception as e:
        log_process(f"❌ Analysis failed: {str(e)}", "error")
        elapsed = time.time() - start_time
        log_process(f"⏱️ Failed after {elapsed:.2f}s")
        return {
            "error":                str(e),
            "detections":           [],
            "overall_risk":         "medium",
            "risk_explanation":     "Analysis failed - manual review required",
            "declared_mismatch":    False,
            "mismatch_detail":      None,
            "officer_summary":      "System error - please review manually",
            "model_used":           "error",
            "image_metadata":       None,
            "annotated_image_b64":  None,
            "annotated_image_file": None,
            "raw_output":           None,
            "raw_output_file":      None,
            "logs":                 process_logs,
        }


async def compare_images(img1_bytes: bytes, img2_bytes: bytes) -> dict:
    """Compare two X-ray scans - basic implementation."""
    try:
        image1 = Image.open(io.BytesIO(img1_bytes))
        image2 = Image.open(io.BytesIO(img2_bytes))
        img1_array = np.array(image1)
        img2_array = np.array(image2)

        if img1_array.shape == img2_array.shape:
            diff = np.abs(img1_array.astype(float) - img2_array.astype(float)).mean()
            if diff < 5:
                severity, summary = "LOW",    "Images are nearly identical"
            elif diff < 20:
                severity, summary = "MEDIUM", "Moderate differences detected"
            else:
                severity, summary = "HIGH",   "Significant differences detected"
        else:
            severity, summary = "MEDIUM", "Image dimensions differ — cannot compare directly"

        return {
            "differences":    [{"location": "overall", "description": summary, "severity": severity}],
            "severity":       severity,
            "summary":        summary,
            "recommendation": "Manual inspection recommended" if severity == "HIGH" else "Regular processing",
        }

    except Exception as e:
        return {
            "error":          str(e),
            "differences":    [],
            "severity":       "MEDIUM",
            "summary":        "Comparison failed",
            "recommendation": "Manual inspection recommended",
        }