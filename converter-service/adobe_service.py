"""
DocuKit Adobe PDF Services Engine Module
Integrates Adobe PDF Services API (SDK v4.3.0+) for enterprise-grade,
high-fidelity bidirectional conversion:
  1. PDF -> Word (DOCX) via ExportPDFJob
  2. Word (DOCX) -> PDF via CreatePDFJob

Security Rules:
- Never log or return client IDs, client secrets, or access tokens.
- Keep credentials loaded strictly server-side.
- Clean up all memory streams and temporary files immediately.
- Sanitize error messages to prevent disclosure of internal stack traces or secrets.
"""

import io
import json
import os
import zipfile
import hashlib
import threading
import time
from collections import OrderedDict
from typing import Optional, Tuple

from adobe.pdfservices.operation.auth.service_principal_credentials import ServicePrincipalCredentials
from adobe.pdfservices.operation.pdf_services import PDFServices
from adobe.pdfservices.operation.pdf_services_media_type import PDFServicesMediaType
from adobe.pdfservices.operation.pdfjobs.jobs.export_pdf_job import ExportPDFJob
from adobe.pdfservices.operation.pdfjobs.params.export_pdf.export_pdf_params import ExportPDFParams
from adobe.pdfservices.operation.pdfjobs.params.export_pdf.export_pdf_target_format import ExportPDFTargetFormat
from adobe.pdfservices.operation.pdfjobs.result.export_pdf_result import ExportPDFResult
from adobe.pdfservices.operation.pdfjobs.jobs.create_pdf_job import CreatePDFJob
from adobe.pdfservices.operation.pdfjobs.result.create_pdf_result import CreatePDFResult
from adobe.pdfservices.operation.exception.exceptions import (
    ServiceApiException,
    ServiceUsageException,
    SdkException,
)

# Load .env file automatically if available
try:
    from dotenv import load_dotenv
    for env_candidate in [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
    ]:
        if os.path.exists(env_candidate):
            load_dotenv(dotenv_path=env_candidate, override=False)
except ImportError:
    pass

# Potential credential locations (checked in order of preference)
DEFAULT_CREDENTIAL_PATHS = [
    os.environ.get("PDF_SERVICES_CREDENTIALS"),
    os.path.join(os.path.dirname(__file__), "pdfservices-api-credentials.json"),
    os.path.join(os.getcwd(), "pdfservices-api-credentials.json"),
]

# Thread-safe singleton for PDFServices client (reuses tokens & connection pools)
_CLIENT_LOCK = threading.Lock()
_CACHED_CLIENT: Optional[PDFServices] = None

# In-memory time-limited content-addressable cache for identical conversions
# Key: (sha256_hash, target_format), Value: (result_bytes, timestamp)
_CACHE_LOCK = threading.Lock()
_CONVERSION_CACHE: OrderedDict[Tuple[str, str], Tuple[bytes, float]] = OrderedDict()
_CACHE_TTL_SECONDS = 900  # 15 minutes TTL
_MAX_CACHE_ENTRIES = 50   # Max 50 items in memory to prevent RAM exhaustion
STREAM_BUFFER_SIZE = 512 * 1024  # 512KB streaming buffer


def load_adobe_credentials() -> Optional[ServicePrincipalCredentials]:
    """
    Attempts to initialize Adobe ServicePrincipalCredentials from:
    1. Environment variables PDF_SERVICES_CLIENT_ID and PDF_SERVICES_CLIENT_SECRET
    2. A credentials JSON file located via PDF_SERVICES_CREDENTIALS or default paths
    Returns ServicePrincipalCredentials if valid, otherwise None.
    NEVER logs or exposes credential values.
    """
    # 1. Direct environment variables
    env_id = os.environ.get("PDF_SERVICES_CLIENT_ID")
    env_secret = os.environ.get("PDF_SERVICES_CLIENT_SECRET")
    if env_id and env_secret:
        try:
            return ServicePrincipalCredentials(client_id=env_id.strip(), client_secret=env_secret.strip())
        except Exception:
            pass

    # 2. JSON file paths
    for path in DEFAULT_CREDENTIAL_PATHS:
        if not path or not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Standard Adobe Console format: client_credentials -> client_id & client_secret
            cc = data.get("client_credentials") or data.get("service_principal_credentials") or data
            client_id = cc.get("client_id") or cc.get("clientId")
            client_secret = cc.get("client_secret") or cc.get("clientSecret")
            if client_id and client_secret:
                return ServicePrincipalCredentials(
                    client_id=str(client_id).strip(),
                    client_secret=str(client_secret).strip(),
                )
        except Exception:
            # Avoid logging file contents or raw errors that could disclose paths
            continue

    return None


def is_adobe_configured() -> bool:
    """Returns True if Adobe credentials can be successfully resolved."""
    return load_adobe_credentials() is not None


def get_pdf_services_client() -> PDFServices:
    """
    Returns a thread-safe singleton PDFServices client.
    Reusing this client preserves Adobe IMS OAuth tokens (valid for 24 hours)
    and maintains persistent HTTP keep-alive connection pools, eliminating
    300-800ms of authentication overhead per conversion.
    """
    global _CACHED_CLIENT
    with _CLIENT_LOCK:
        if _CACHED_CLIENT is None:
            creds = load_adobe_credentials()
            if not creds:
                raise ValueError(
                    "Adobe PDF Services credentials not configured. Please supply a valid "
                    "pdfservices-api-credentials.json file or set PDF_SERVICES_CREDENTIALS / "
                    "PDF_SERVICES_CLIENT_ID environment variables."
                )
            _CACHED_CLIENT = PDFServices(credentials=creds)
        return _CACHED_CLIENT


def get_cached_conversion(data: bytes, target_format: str) -> Optional[bytes]:
    """Retrieves cached conversion result if non-expired (0ms repeat conversion)."""
    file_hash = hashlib.sha256(data).hexdigest()
    key = (file_hash, target_format)
    now = time.time()
    with _CACHE_LOCK:
        if key in _CONVERSION_CACHE:
            result_bytes, created_at = _CONVERSION_CACHE[key]
            if now - created_at <= _CACHE_TTL_SECONDS:
                _CONVERSION_CACHE.move_to_end(key)
                return result_bytes
            else:
                del _CONVERSION_CACHE[key]
    return None


def store_cached_conversion(data: bytes, target_format: str, result_bytes: bytes) -> None:
    """Stores converted result in in-memory LRU cache with TTL."""
    file_hash = hashlib.sha256(data).hexdigest()
    key = (file_hash, target_format)
    now = time.time()
    with _CACHE_LOCK:
        # Purge expired entries
        expired_keys = [k for k, (_, ts) in _CONVERSION_CACHE.items() if now - ts > _CACHE_TTL_SECONDS]
        for k in expired_keys:
            del _CONVERSION_CACHE[k]

        # Enforce LRU size limit
        if len(_CONVERSION_CACHE) >= _MAX_CACHE_ENTRIES:
            _CONVERSION_CACHE.popitem(last=False)

        _CONVERSION_CACHE[key] = (result_bytes, now)


def validate_docx_bytes(data: bytes) -> Tuple[bool, str]:
    """
    Validates that output bytes represent a non-empty, genuine OpenXML DOCX archive.
    """
    if not data or len(data) < 500:
        return False, "Generated file is empty or corrupted (under 500 bytes)."
    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            namelist = zf.namelist()
            if "word/document.xml" not in namelist:
                return False, "Package is missing word/document.xml entry."
            if "[Content_Types].xml" not in namelist:
                return False, "Package is missing [Content_Types].xml entry."
            return True, ""
    except Exception as e:
        return False, f"Malformed ZIP archive: {type(e).__name__}"


def validate_pdf_bytes(data: bytes) -> Tuple[bool, str]:
    """
    Validates that output bytes represent a non-empty, genuine PDF document with %PDF header.
    """
    if not data or len(data) < 100:
        return False, "Generated file is empty or corrupted (under 100 bytes)."
    if not data.startswith(b"%PDF"):
        return False, "Generated file does not begin with standard %PDF magic header."
    return True, ""


def convert_pdf_to_docx_adobe(pdf_bytes: bytes) -> bytes:
    """
    Converts PDF bytes to Word DOCX using Adobe PDF Services ExportPDFJob.
    Utilizes in-memory SHA-256 cache and singleton client for maximum speed.
    """
    cached = get_cached_conversion(pdf_bytes, "docx")
    if cached is not None:
        return cached

    pdf_services = get_pdf_services_client()
    input_stream = io.BytesIO(pdf_bytes)

    try:
        # Upload input asset
        upload_asset = pdf_services.upload(
            input_stream=input_stream,
            mime_type=PDFServicesMediaType.PDF,
        )

        # Build ExportPDFJob configured for DOCX target
        export_params = ExportPDFParams(target_format=ExportPDFTargetFormat.DOCX)
        export_job = ExportPDFJob(input_asset=upload_asset, export_pdf_params=export_params)

        # Submit and poll for completion
        polling_url = pdf_services.submit(pdf_services_job=export_job)
        pdf_services_response = pdf_services.get_job_result(
            polling_url=polling_url,
            result_type=ExportPDFResult,
        )

        result_asset = pdf_services_response.get_result().get_asset()
        stream_asset = pdf_services.get_content(asset=result_asset)
        stream = stream_asset.get_input_stream()
        docx_bytes = stream.read() if hasattr(stream, "read") else bytes(stream)

        # Validate generated DOCX package
        valid, err = validate_docx_bytes(docx_bytes)
        if not valid:
            raise RuntimeError(f"Adobe conversion output validation failed: {err}")

        # Store in fast cache for instant retrieval on repeat/downloads
        store_cached_conversion(pdf_bytes, "docx", docx_bytes)
        return docx_bytes

    except ServiceUsageException as e:
        raise RuntimeError("Adobe PDF Services usage limit or quota exceeded.") from e
    except ServiceApiException as e:
        # Sanitize exception message to avoid leaking tokens or internal details
        status_code = getattr(e, "status_code", "API Error")
        raise RuntimeError(f"Adobe PDF Services error during export (Status {status_code}).") from e
    except SdkException as e:
        raise RuntimeError("Adobe PDF Services client connection or network error.") from e
    finally:
        input_stream.close()


def convert_docx_to_pdf_adobe(docx_bytes: bytes) -> bytes:
    """
    Converts Word DOCX bytes to PDF using Adobe PDF Services CreatePDFJob.
    Utilizes in-memory SHA-256 cache and singleton client for maximum speed.
    """
    cached = get_cached_conversion(docx_bytes, "pdf")
    if cached is not None:
        return cached

    pdf_services = get_pdf_services_client()
    input_stream = io.BytesIO(docx_bytes)

    try:
        # Upload input asset
        upload_asset = pdf_services.upload(
            input_stream=input_stream,
            mime_type=PDFServicesMediaType.DOCX,
        )

        # Build CreatePDFJob
        create_job = CreatePDFJob(input_asset=upload_asset)

        # Submit and poll for completion
        polling_url = pdf_services.submit(pdf_services_job=create_job)
        pdf_services_response = pdf_services.get_job_result(
            polling_url=polling_url,
            result_type=CreatePDFResult,
        )

        result_asset = pdf_services_response.get_result().get_asset()
        stream_asset = pdf_services.get_content(asset=result_asset)
        stream = stream_asset.get_input_stream()
        pdf_bytes = stream.read() if hasattr(stream, "read") else bytes(stream)

        # Validate generated PDF document
        valid, err = validate_pdf_bytes(pdf_bytes)
        if not valid:
            raise RuntimeError(f"Adobe conversion output validation failed: {err}")

        # Store in fast cache for instant retrieval on repeat/downloads
        store_cached_conversion(docx_bytes, "pdf", pdf_bytes)
        return pdf_bytes

    except ServiceUsageException as e:
        raise RuntimeError("Adobe PDF Services usage limit or quota exceeded.") from e
    except ServiceApiException as e:
        status_code = getattr(e, "status_code", "API Error")
        raise RuntimeError(f"Adobe PDF Services error during PDF creation (Status {status_code}).") from e
    except SdkException as e:
        raise RuntimeError("Adobe PDF Services client connection or network error.") from e
    finally:
        input_stream.close()
