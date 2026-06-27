#!/usr/bin/env bash
# Build narration (Kokoro TTS) + render a HyperFrames video in each voice.
# Usage: bash videos/lib/make.sh <projectDir> <outBaseName> [voice ...]
# Produces <projectDir>/out/<outBaseName>__<voiceKey>.mp4 per voice.
set -euo pipefail

DIR="$1"
NAME="$2"
shift 2
cd "$DIR"
mkdir -p out

# Kokoro voiceKey:voiceId (prefix → language: a=en-US, b=en-GB, e=es, j=ja, z=zh)
VOICES=("$@")
if [ ${#VOICES[@]} -eq 0 ]; then
  VOICES=("heart:af_heart" "michael:am_michael")
fi

for entry in "${VOICES[@]}"; do
  key="${entry%%:*}"
  voice="${entry##*:}"
  echo "=== building $NAME [$key / $voice] ==="
  node ../lib/build.mjs . "$voice"
  npx -y hyperframes@0.6.112 render --output "out/${NAME}__${key}.mp4" --quiet
  echo "=== rendered out/${NAME}__${key}.mp4 ==="
done
echo "ALL DONE: $NAME"
ls -la out/
