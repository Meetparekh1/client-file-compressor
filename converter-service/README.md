# DocuKit Document Converter Service

Enterprise-grade bidirectional PDF ⟷ Word (.docx/.doc) conversion microservice powered exclusively by **FastAPI** and the **Adobe PDF Services API (SDK v4.3.0+)**.

---

## 1. Architecture & Endpoints

| Endpoint | Method | Input | Description |
|---|---|---|---|
| `/health` | GET | None | Reports service status, active engine (`adobe_pdf_services`), credential configuration status, and capabilities. |
| `/convert/pdf-to-docx` | POST | Multipart Form (`file: PDF`) | Converts PDF to Word (.docx) using Adobe PDF Services `ExportPDFJob`. Validates output OOXML ZIP package before delivery. |
| `/convert/docx-to-pdf` | POST | Multipart Form (`file: DOCX/DOC`) | Converts Word document (.docx/.doc) to PDF using Adobe PDF Services `CreatePDFJob`. Validates `%PDF` output structure before delivery. |

---

## 2. Secure Credential Configuration

Adobe credentials must **never** be checked into Git, exposed in frontend bundles, or returned over public endpoints.

### Option A: Credentials File (Recommended for Local Dev & Docker Mounts)

Download `pdfservices-api-credentials.json` from the [Adobe Developer Console](https://developer.adobe.com/console).

Set the environment variable pointing to the private path:
```bash
# Windows PowerShell
$env:PDF_SERVICES_CREDENTIALS="C:\path\to\pdfservices-api-credentials.json"

# Linux / macOS
export PDF_SERVICES_CREDENTIALS="/private/path/pdfservices-api-credentials.json"
```

If the file is placed directly inside `converter-service/pdfservices-api-credentials.json`, `.gitignore` automatically prevents it from being tracked or committed.

### Option B: Environment Variables (Recommended for Production / Cloud PaaS)

On hosting platforms (Render, Railway, AWS ECS, GCP Cloud Run), inject credentials as secure environment variables:

```bash
PDF_SERVICES_CLIENT_ID="<your_adobe_client_id>"
PDF_SERVICES_CLIENT_SECRET="<your_adobe_client_secret>"
```

The service will automatically detect and authenticate using these environment variables.

---

## 3. Local Development

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run test suite
python test_service.py

# 3. Start the FastAPI development server
uvicorn main:app --host 0.0.0.0 --port 7860 --reload
```

Verify service status:
```bash
curl http://localhost:7860/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "docukit-converter",
  "engine": "adobe_pdf_services",
  "adobe_configured": true,
  "capabilities": {
    "pdf_to_docx": true,
    "docx_to_pdf": true
  }
}
```

---

## 4. Docker Deployment

Build and run the container:

```bash
docker build -t docukit-converter .

# Run with environment variables
docker run -d -p 7860:7860 \
  -e PDF_SERVICES_CLIENT_ID="<your_client_id>" \
  -e PDF_SERVICES_CLIENT_SECRET="<your_client_secret>" \
  --name docukit-converter docukit-converter

# Or mount the credentials file securely as a read-only volume:
docker run -d -p 7860:7860 \
  -v /private/path/pdfservices-api-credentials.json:/app/pdfservices-api-credentials.json:ro \
  --name docukit-converter docukit-converter
```

---

## 5. Connecting the React Frontend

In the DocuKit web application:
1. Click **API Settings** in the top navigation or settings drawer.
2. Ensure the URL points to your service: `http://localhost:7860` (or your cloud URL, e.g. `https://my-docukit-converter.onrender.com`).
3. Click **Ping** to test connectivity. The status indicator will verify: `Connected! Adobe PDF Services Engine is active.`

---

## 6. API Limits, Quotas & Considerations

- **Maximum file size:** 50 MB per request (enforced on both client and server).
- **Timeouts:** 60-second execution timeout with automatic cleanup in `finally` blocks.
- **Allowed Formats:**
  - PDF → DOCX accepts `.pdf`.
  - DOCX → PDF accepts `.docx` and legacy `.doc`.
- **Transactions & Rate Limits:** Adobe PDF Services Free Tier provides 500 document transactions per month. HTTP 429 is cleanly returned if monthly allowances are exhausted.
