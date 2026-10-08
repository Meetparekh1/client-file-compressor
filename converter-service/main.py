from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import tempfile
import os
import shutil
import subprocess
import logging
from pdf2docx import Converter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("converter")

app = FastAPI(
    title="Local File Engine - High-Fidelity Document Converter API",
    description="Zero-cost, self-hosted API for bidirectional conversion between PDF and Word DOCX.",
    version="1.0.0"
)

# Configure CORS so any frontend (e.g. localhost, GitHub Pages, or custom domains) can connect
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if "*" not in ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

def cleanup_dir(path: str):
    """Safely removes temporary working directory after streaming response."""
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception as e:
        logger.error(f"Error removing temp directory {path}: {e}")

@app.get("/")
def root():
    return {
        "service": "Document Converter API",
        "status": "healthy",
        "endpoints": [
            "POST /convert/pdf-to-docx",
            "POST /convert/docx-to-pdf"
        ]
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/convert/pdf-to-docx")
async def convert_pdf_to_docx(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Converts PDF to Word (.docx) using pdf2docx preserving layout, tables, fonts, and images.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .pdf")

    temp_dir = tempfile.mkdtemp(prefix="pdf2docx_")
    background_tasks.add_task(cleanup_dir, temp_dir)

    base_name = os.path.splitext(file.filename)[0]
    input_path = os.path.join(temp_dir, "input.pdf")
    output_path = os.path.join(temp_dir, f"{base_name}.docx")

    try:
        # Save uploaded PDF to temp file
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"Converting PDF to DOCX: {file.filename}")
        cv = Converter(input_path)
        cv.convert(output_path, start=0, end=None)
        cv.close()

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Conversion completed without generating output file.")

        return FileResponse(
            path=output_path,
            filename=f"{base_name}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        logger.error(f"PDF to DOCX conversion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")

@app.post("/convert/docx-to-pdf")
async def convert_docx_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Converts Word (.docx) to PDF using headless LibreOffice with complete font and layout fidelity.
    """
    if not (file.filename.lower().endswith(".docx") or file.filename.lower().endswith(".doc")):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .docx or .doc file")

    temp_dir = tempfile.mkdtemp(prefix="docx2pdf_")
    background_tasks.add_task(cleanup_dir, temp_dir)

    base_name = os.path.splitext(file.filename)[0]
    ext = os.path.splitext(file.filename)[1]
    input_path = os.path.join(temp_dir, f"input{ext}")
    expected_output = os.path.join(temp_dir, "input.pdf")
    final_output = os.path.join(temp_dir, f"{base_name}.pdf")

    try:
        # Save uploaded DOCX to temp file
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"Converting DOCX to PDF: {file.filename}")
        
        # Execute headless LibreOffice conversion
        cmd = [
            "soffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            temp_dir,
            input_path
        ]

        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        
        if result.returncode != 0:
            logger.error(f"LibreOffice failed: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"LibreOffice conversion failed: {result.stderr}")

        if not os.path.exists(expected_output):
            raise HTTPException(status_code=500, detail="LibreOffice did not generate PDF file.")

        os.rename(expected_output, final_output)

        return FileResponse(
            path=final_output,
            filename=f"{base_name}.pdf",
            media_type="application/pdf"
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Conversion timed out.")
    except Exception as e:
        logger.error(f"DOCX to PDF conversion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
