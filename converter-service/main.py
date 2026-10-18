"""
DocuKit Document Converter Service
Enterprise-grade bidirectional PDF <-> Word conversion microservice
powered exclusively by Adobe PDF Services API.
"""

import os
import io
import re
from typing import Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from adobe_service import (
    is_adobe_configured,
    convert_pdf_to_docx_adobe,
    convert_docx_to_pdf_adobe,
    validate_docx_bytes,
    validate_pdf_bytes,
)

# Max upload limit: 50 MB
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

app = FastAPI(
    title="DocuKit Adobe Document Converter Service",
    version="2.0.0",
    description="Enterprise-grade microservice providing PDF to Word (.docx) and Word to PDF conversion powered by Adobe PDF Services .",
)

# Configure CORS for local development and authorized web clients
ALLOWED_ORIGINS = os.environ.get(
    "CONVERTER_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://github.io",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()] or ["http://localhost:5173"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$|^https://[\w\-]+\.github\.io$|^https://[\w\-]+\.netlify\.app$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def sanitize_filename(filename: str, target_ext: str) -> str:
    """Safely sanitizes filename removing path traversal and forbidden characters."""
    base = os.path.splitext(os.path.basename(filename or "document"))[0]
    safe_base = re.sub(r"[^a-zA-Z0-9_\-\. ]", "", base).strip() or "document"
    return f"{safe_base}.{target_ext.lstrip('.')}"


@app.get("/health")
def health_check() -> Dict[str, Any]:
    """Health check endpoint reporting service status, active engine, and credentials status."""
    configured = is_adobe_configured()
    return {
        "status": "healthy",
        "service": "docukit-converter",
        "engine": "adobe_pdf_services",
        "adobe_configured": configured,
        "capabilities": {
            "pdf_to_docx": configured,
            "docx_to_pdf": configured,
        },
    }


@app.post("/convert/pdf-to-docx")
async def convert_pdf_to_docx(file: UploadFile = File(...)):
    """
    Converts uploaded PDF document to an editable Microsoft Word (.docx) document
    using the Adobe PDF Services (ExportPDFJob).
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a PDF document (.pdf).",
        )

    try:
        # Stream and validate upload size with optimized 512KB chunks
        file_size = 0
        chunks = []
        CHUNK_SIZE = 512 * 1024
        while chunk := await file.read(CHUNK_SIZE):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum size limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
                )
            chunks.append(chunk)

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        pdf_bytes = b"".join(chunks)

        # Validate that the file is indeed a PDF
        if not pdf_bytes.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is not a valid PDF document header.",
            )

        if not is_adobe_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Adobe PDF Services API credentials are not configured on this server.",
            )

        # Execute conversion via Adobe PDF Services API
        try:
            docx_bytes = convert_pdf_to_docx_adobe(pdf_bytes)
        except Exception as e:
            # Clean sanitization to avoid leaking credentials or internal paths
            err_msg = str(e)
            if "quota" in err_msg.lower() or "limit" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Adobe PDF Services API transaction allowance or rate limit reached. Please try again later.",
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Adobe conversion engine failed: {err_msg}",
            )

        # Validate DOCX output package
        is_valid, validation_err = validate_docx_bytes(docx_bytes)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Conversion generated an invalid Word package: {validation_err}",
            )

        download_filename = sanitize_filename(file.filename, "docx")
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{download_filename}"'},
        )

    finally:
        await file.close()


@app.post("/convert/docx-to-pdf")
async def convert_docx_to_pdf(file: UploadFile = File(...)):
    """
    Converts uploaded Microsoft Word document (.docx/.doc) to PDF
    using the Adobe PDF Services API (CreatePDFJob).
    """
    valid_exts = (".docx", ".doc")
    if not file.filename or not any(file.filename.lower().endswith(ext) for ext in valid_exts):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a Word document (.docx or .doc).",
        )

    try:
        file_size = 0
        chunks = []
        CHUNK_SIZE = 512 * 1024
        while chunk := await file.read(CHUNK_SIZE):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum size limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
                )
            chunks.append(chunk)

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        if not is_adobe_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Adobe PDF Services API credentials are not configured on this server.",
            )

        docx_bytes = b"".join(chunks)

        # Execute conversion via Adobe PDF Services API
        try:
            pdf_bytes = convert_docx_to_pdf_adobe(docx_bytes)
        except Exception as e:
            err_msg = str(e)
            if "quota" in err_msg.lower() or "limit" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Adobe PDF Services API transaction allowance or rate limit reached. Please try again later.",
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Adobe conversion engine failed: {err_msg}",
            )

        # Validate PDF output
        is_valid, validation_err = validate_pdf_bytes(pdf_bytes)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Conversion generated an invalid PDF document: {validation_err}",
            )

        download_filename = sanitize_filename(file.filename, "pdf")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{download_filename}"'},
        )

    finally:
        await file.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=7860, reload=True)
