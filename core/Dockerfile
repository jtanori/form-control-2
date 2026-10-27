# VoiceForm core (FastAPI) — STT-001 + Phase 1 NLU + session APIs
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY core ./core
COPY contracts ./contracts

ENV CORE_HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1

EXPOSE 8020
CMD ["uvicorn", "core.main:app", "--host", "0.0.0.0", "--port", "8020"]
