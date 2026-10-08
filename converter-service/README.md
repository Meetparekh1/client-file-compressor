# High-Fidelity PDF ⟷ Word DOCX Converter Microservice

A 100% free, self-hosted REST API built with **FastAPI**, **`pdf2docx`**, and **Headless LibreOffice** for bidirectional, layout-preserving conversion between PDF and Microsoft Word (.docx).

---

## Architecture & Fidelity

| Direction | Technology | Key Features |
| :--- | :--- | :--- |
| **PDF ➔ DOCX** | `pdf2docx` + `PyMuPDF` | Extracts and reconstructs tables, paragraph flows, inline styling, images, shapes, and font metrics. |
| **DOCX ➔ PDF** | Headless LibreOffice (`soffice`) | True binary DOCX parser using Linux metric-compatible Microsoft fonts (`Carlito` for Calibri, `Caladea` for Cambria, `Liberation` for Arial/Times). |

---

## 1. Zero-Cost Free Deployment Guide

### Option A: Hugging Face Spaces (Recommended — Best Free Tier)
> **Why HF Spaces?** Hugging Face provides **2 vCPUs and 16 GB of RAM** completely free with **no credit card required** and persistent HTTPS. LibreOffice requires memory for rendering pages; 16 GB ensures conversions never run out of memory.

1. Create a free account at [huggingface.co](https://huggingface.co).
2. Click **New Space** (`https://huggingface.co/new-space`).
3. Set your Space settings:
   - **Space Name**: e.g., `doc-converter-api`
   - **License**: MIT or Apache 2.0
   - **Space SDK**: Select **Docker** ➔ **Blank**
   - **Space Hardware**: **CPU basic (Free, 2 vCPU, 16GB RAM)**
4. Clone your new Space repo to your machine, or upload these files via the web UI:
   - `Dockerfile`
   - `main.py`
   - `requirements.txt`
   - `.dockerignore`
5. Commit and push. Hugging Face will automatically build your Docker container.
6. Once built, click the **Direct URL** or open settings. Your public HTTPS endpoint will be:
   ```
   https://<your-username>-doc-converter-api.hf.space
   ```
   *(Port 7860 is mapped automatically).*

---

### Option B: Render.com Free Tier
1. Create a free account at [render.com](https://render.com).
2. Push the `converter-service` directory to a GitHub repository.
3. In Render Dashboard, click **New +** ➔ **Web Service**.
4. Connect your GitHub repository.
5. Select **Docker** environment.
6. Set the Environment Variables:
   - `PORT`: `10000`
   - `ALLOWED_ORIGINS`: `*` (or your frontend domain)
7. Select the **Free** instance type.
8. Click **Deploy Web Service**. You will receive an `https://<service-name>.onrender.com` URL with free SSL.

---

### Option C: Koyeb Free Tier
1. Create a free account at [koyeb.com](https://koyeb.com).
2. Click **Create App** ➔ **GitHub**.
3. Select your repository, specify the `converter-service` path, and pick the **Nano Free** worker.
4. Set port to `7860` and deploy.

---

## 2. Local Development & Docker Testing

### Run locally with Python (Requires LibreOffice installed on host)
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
Service runs at `http://localhost:7860`.

### Run locally with Docker
```bash
# Build the container
docker build -t converter-service .

# Run the container
docker run -p 7860:7860 -e ALLOWED_ORIGINS="*" converter-service
```
Test health check:
```bash
curl http://localhost:7860/health
```

---

## 3. API Endpoints

### 1. PDF to DOCX
- **Method**: `POST /convert/pdf-to-docx`
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (PDF file)
- **Response**: Binary stream of the converted `.docx` file.

### 2. DOCX to PDF
- **Method**: `POST /convert/docx-to-pdf`
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (DOCX or DOC file)
- **Response**: Binary stream of the converted `.pdf` file.
