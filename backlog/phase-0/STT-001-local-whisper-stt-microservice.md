# STT-001 — Local Whisper STT Microservice

- **Phase:** 0 — Contracts, Infra & Skeleton (Week 1)
- **Track / Agent:** Agent A — Backend / AI (ML)
- **Priority:** P0
- **Status:** ready
- **Depends on:** INFR-001
- **Parallel with:** CONTRACT-001, INFR-002
- **Critical path:** No (needed for G1, not for parser development — parser runs on mock text)
- **Milestone gates:** G1

## Objective

Provide local speech-to-text as a Docker microservice so audio from the extension popup and Android overlay can be transcribed without a cloud dependency by default.

## Specification

- Docker image running `whisper.cpp` server (wired as `stt-whisper` service in `docker-compose.yml`).
- Endpoint: `POST /stt/transcribe` — `multipart/form-data` with `audio` file field (accept `audio/webm` and `wav`). Alias `POST /transcribe` kept for the original spec wording.
- Config: `WHISPER_MODEL=base` default; swap to `small.en` for MVP accuracy.
- Fallback env: `STT_FALLBACK=openai_whisper_api` — when set, forwards audio to OpenAI Whisper API instead of local model.
- Response JSON:

```json
{
  "transcript": "string",
  "language": "string",
  "confidence": 0.0,
  "duration_sec": 0.0
}
```

- `language=auto` must be handled (detect and report back).

## Files & deliverables

- `/docker-compose.yml` service `stt-whisper` (coordinated with INFR-001)
- STT server Dockerfile / config under `core/` or `infra/stt/` (whichever INFR-001 scaffolds)
- Contract: `/contracts/v1/stt-response.schema.json` (coordinate with CONTRACT-001)

## Acceptance criteria

- [ ] Sub-3s latency for 10s audio on local GPU; <8s on CPU.
- [ ] Handles `language=auto` and returns detected language.
- [ ] `STT_FALLBACK=openai_whisper_api` switches to cloud fallback cleanly.
- [ ] Extension `TRANSCRIBE` message (EXT-006) and Android `VoiceClient` (AND-004) can consume the response shape as-is.

## Handoffs

- **Output →** EXT-006 background bridge uploads blobs here; AND-004 posts recorded audio here; CORE-001 integration tests feed returned transcript into `/api/v1/parse`.
- **Note:** Parser (CORE-001) must be developable with mock text — do not block on this item.
