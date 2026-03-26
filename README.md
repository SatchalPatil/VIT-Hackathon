# CargoScan AI - The Evolving Customs Interface

> **"Static models are not the solution for a dynamic world."**

**CargoScan AI** is a professional cargo X-ray analysis platform designed for modern customs and border security. Unlike traditional systems that are "frozen in time," CargoScan is built with a continuous learning loop that evolves alongside real-world threats.

---

## 🚀 The Philosophy: Continuous Learning (RLHF)
In customs security, training an AI model once is not enough. Criminals adapt, and new concealment methods emerge every day. CargoScan AI uses **Reinforcement Learning from Human Feedback (RLHF)** to bridge the gap between pre-training and reality. 

When an officer identifies a missed threat, they can manually draw and label it—instantly feeding expert knowledge back into the system’s learning pipeline.

---

## 🧠 The Intelligence Stack

- **RF-DETR (Object Detection):** State-of-the-art transformer-based detection pre-trained on the **CargoX-Ray dataset**. It identifies prohibited items (weapons, drugs, currency) in milliseconds with high density.
- **Qwen3 VLM (Vision reasoning):** A Vision-Language Model used for **Semantic Comparison**. While detection models find physical changes, Qwen3 understands and explains *what* changed and *why* it constitutes a risk.
- **Human-in-the-Loop:** A robust "Draw Box" annotation tool that allows officers to provide ground-truth feedback on missed detections.

---

## ✨ Key Features

- **🔍 X-Ray Scanner:** Automated detection of contraband with automated risk tiering (Critical to Low).
- **⚖️ Intelligent Comparison:** Side-by-side shipment analysis where RF-DETR spots differences and Qwen3 VLM provides the explanation.
- **✏️ Manual Annotation (RLHF):** Officers can manually highlight missed objects to train the system in real-time.
- **📊 Learning Dashboard:** A live log of all human-provided feedback, tracking system accuracy and retraining thresholds.
- **🚢 Company Records:** Shipper-specific risk profiles and historical fraud detection.
- **📄 Official Reporting:** Single-click PDF report generation for official documentation and auditing.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, Vanilla JavaScript, **Customs Intelligence Flat Design (CSS)**, jsPDF.
- **Backend:** FastAPI (Python), Roboflow Inference SDK, Qwen VLM Integration.
- **Logic:** Browser `localStorage` for decentralized feedback & audit persistence.
- **Aesthetics:** Premium "Navy & Slate" palette, **Inter** typography, and high-contrast accessibility tools.

---

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
1. Open the `/frontend` folder in VS Code.
2. Launch `index.html` using **Live Server**.
3. Default port: `http://127.0.0.1:5501`

---

## 📋 API Overview

- `POST /analyze`: Full X-ray image analysis using RF-DETR.
- `POST /compare`: Visual and semantic comparison between baseline and current shipment.
- `POST /report`: Generates official customs documentation.

---

**Developed for the VIT Hackathon.**  
*Official Use Only — Customs Intelligence & Border Protection.*
