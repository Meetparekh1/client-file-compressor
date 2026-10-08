FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=7860 \
    HOME=/home/user

# Install system dependencies:
# - libreoffice-writer & libreoffice-calc: headless document rendering & PDF generation
# - poppler-utils: PDF manipulation utilities
# - fonts-liberation: Metrically identical replacements for Times New Roman, Arial, Courier New
# - fonts-crosextra-carlito & caladea: Metrically identical replacements for Calibri & Cambria (MS Office defaults)
# - fonts-dejavu & fonts-noto: Comprehensive Unicode, multilingual & symbol support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    poppler-utils \
    fonts-liberation \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-dejavu-core \
    fonts-noto-core \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (compatible with Hugging Face Spaces and secure production environments)
RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app

# Set PATH for user-installed pip binaries
ENV PATH="/home/user/.local/bin:$PATH"

# Copy dependencies first for Docker caching
COPY --chown=user:user requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy application source code
COPY --chown=user:user . .

# Expose port (7860 is default for Hugging Face Spaces; configurable via PORT env var)
EXPOSE 7860

# Launch FastAPI app with Uvicorn
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1"]
