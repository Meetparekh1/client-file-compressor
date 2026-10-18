"""
Backend tests for DocuKit Converter Service.
Tests /health, validation, error handling, and conversion pipeline with Adobe PDF Services API.
"""

import io
import os
import zipfile
from fastapi.testclient import TestClient

from main import app
import adobe_service

client = TestClient(app)

def test_health_endpoint():
    """Verify health endpoint returns valid status, adobe engine, and capabilities dictionary."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "docukit-converter"
    assert data["engine"] == "adobe_pdf_services"
    assert "adobe_configured" in data
    assert "capabilities" in data
    assert "pdf_to_docx" in data["capabilities"]
    assert "docx_to_pdf" in data["capabilities"]

def test_convert_pdf_rejects_non_pdf():
    """Verify endpoint rejects invalid file types (e.g. .txt)."""
    files = {"file": ("test.txt", b"plain text", "text/plain")}
    response = client.post("/convert/pdf-to-docx", files=files)
    assert response.status_code == 400
    assert "Invalid file format" in response.json()["detail"]

def test_convert_pdf_rejects_empty_file():
    """Verify endpoint rejects 0-byte uploads."""
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    response = client.post("/convert/pdf-to-docx", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()

def test_convert_pdf_rejects_non_pdf_content():
    """Verify endpoint rejects files named .pdf but containing non-PDF headers."""
    files = {"file": ("fake.pdf", b"Not a real PDF", "application/pdf")}
    response = client.post("/convert/pdf-to-docx", files=files)
    assert response.status_code == 400
    assert "not a valid PDF" in response.json()["detail"]

def test_convert_docx_rejects_non_word():
    """Verify docx-to-pdf rejects non-Word formats."""
    files = {"file": ("test.png", b"image", "image/png")}
    response = client.post("/convert/docx-to-pdf", files=files)
    assert response.status_code == 400
    assert "Invalid file format" in response.json()["detail"]

def test_adobe_live_conversion_roundtrip():
    """
    Tests live Adobe PDF Services API conversion if configured:
    1. Sample PDF -> DOCX via /convert/pdf-to-docx
    2. Resulting DOCX -> PDF via /convert/docx-to-pdf
    """
    if not adobe_service.is_adobe_configured():
        print("Skipping live conversion roundtrip: Adobe credentials not configured.")
        return

    from pypdf import PdfWriter

    # Build a minimal valid PDF with 1 page containing text
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    pdf_bytes_io = io.BytesIO()
    writer.write(pdf_bytes_io)
    pdf_data = pdf_bytes_io.getvalue()

    # Step 1: PDF -> DOCX
    files = {"file": ("test_doc.pdf", pdf_data, "application/pdf")}
    response = client.post("/convert/pdf-to-docx", files=files)
    assert response.status_code == 200
    assert "wordprocessingml" in response.headers["content-type"]

    docx_bytes = response.content
    assert len(docx_bytes) > 500

    # Verify DOCX zip package
    docx_zip = zipfile.ZipFile(io.BytesIO(docx_bytes))
    namelist = docx_zip.namelist()
    assert "word/document.xml" in namelist
    assert "[Content_Types].xml" in namelist

    # Step 2: DOCX -> PDF
    files_docx = {"file": ("test_doc.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    response_pdf = client.post("/convert/docx-to-pdf", files=files_docx)
    assert response_pdf.status_code == 200
    assert "application/pdf" in response_pdf.headers["content-type"]
    assert response_pdf.content.startswith(b"%PDF")
    print("Live Adobe PDF Services roundtrip conversion test succeeded!")

def test_conversion_cache():
    """Verify in-memory content-addressable cache stores and retrieves identical files."""
    dummy_input = b"%PDF-1.4 sample content for cache test"
    dummy_output = b"PK\x03\x04 dummy docx bytes"
    
    # Cache miss initially
    assert adobe_service.get_cached_conversion(dummy_input, "docx") is None
    
    # Store in cache
    adobe_service.store_cached_conversion(dummy_input, "docx", dummy_output)
    
    # Cache hit
    cached = adobe_service.get_cached_conversion(dummy_input, "docx")
    assert cached == dummy_output
    
    # Different format should miss
    assert adobe_service.get_cached_conversion(dummy_input, "pdf") is None

if __name__ == "__main__":
    test_health_endpoint()
    test_convert_pdf_rejects_non_pdf()
    test_convert_pdf_rejects_empty_file()
    test_convert_pdf_rejects_non_pdf_content()
    test_convert_docx_rejects_non_word()
    test_conversion_cache()
    test_adobe_live_conversion_roundtrip()
    print("All backend converter service tests passed successfully!")
