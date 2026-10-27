# STT-001 — whisper.cpp server image
# WHISPER_MODEL: base (default) | small | small.en | tiny | medium …
FROM ubuntu:24.04 AS build

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git /src/whisper
RUN cmake -S /src/whisper -B /src/whisper/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /src/whisper/build -j"$(nproc)" --target whisper-server \
    # Stage binary + every shared lib it links (libwhisper, libggml, …)
    && mkdir -p /staging/bin /staging/lib \
    && cp /src/whisper/build/bin/whisper-server /staging/bin/ \
    && find /src/whisper/build -name '*.so*' -exec cp -a {} /staging/lib/ \; \
    && echo "staged libs:" && ls -la /staging/lib

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /staging/bin/whisper-server /usr/local/bin/whisper-server
COPY --from=build /staging/lib/ /usr/local/lib/
RUN ldconfig
COPY entrypoint.sh /entrypoint.sh
# Guard against CRLF from any build context (shebang must be LF).
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV WHISPER_MODEL=base \
    WHISPER_THREADS=4 \
    WHISPER_PORT=8080 \
    WHISPER_MODELS_DIR=/models

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
