from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
from pathlib import Path

# Load environment variables
load_dotenv()

# Import routers
from routes.analyze import router as analyze_router
from routes.compare import router as compare_router
from routes.report import router as report_router

app = FastAPI(
    title="CargoScan AI",
    description="Cargo X-ray analysis API for customs and border security",
    version="1.0.0"
)

output_dir = Path(__file__).resolve().parents[1] / "Output"
output_dir.mkdir(parents=True, exist_ok=True)
app.mount("/output", StaticFiles(directory=str(output_dir)), name="output")

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(analyze_router, tags=["Analysis"])
app.include_router(compare_router, tags=["Comparison"])
app.include_router(report_router, tags=["Reports"])

@app.get("/")
async def root():
    return {"message": "CargoScan AI API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
