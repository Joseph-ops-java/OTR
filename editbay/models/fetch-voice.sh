#!/usr/bin/env bash
# Downloads the Kokoro voice model (Apache-2.0) and four voices, and splits the model into pieces under 15 MB
# so claude.ai can serve it. The pieces are not kept in git (88 MB); run this before publishing or testing.
set -euo pipefail
cd "$(dirname "$0")"; H=https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main
mkdir -p kokoro/onnx kokoro/voices
for f in config.json tokenizer.json tokenizer_config.json; do [ -f kokoro/$f ] || curl -sfL --max-time 120 -o kokoro/$f $H/$f; done
for v in af_heart af_bella am_michael bm_george; do [ -f kokoro/voices/$v.bin.part0.wasm ] || curl -sfL --max-time 120 -o kokoro/voices/$v.bin.part0.wasm $H/voices/$v.bin; done
if [ ! -f kokoro/onnx/model_quantized.onnx.part0.wasm ]; then
  curl -sfL --max-time 900 -o kokoro/m.onnx $H/onnx/model_quantized.onnx
  split -b 14m -d -a 1 --additional-suffix=.wasm kokoro/m.onnx kokoro/onnx/model_quantized.onnx.part; rm kokoro/m.onnx
fi
python3 - <<'PY'
import os,json,re
man=json.load(open('manifest.json'));sp={}
for d,_,fs in os.walk('.'):
    for f in sorted(fs):
        m=re.match(r'(.+)\.part\d+\.wasm$',f)
        if m: sp.setdefault(os.path.relpath(os.path.join(d,m.group(1)),'.'),[]).append(os.path.relpath(os.path.join(d,f),'.'))
man['split']={k:sorted(v) for k,v in sorted(sp.items())}
man['voice']='onnx-community/Kokoro-82M-v1.0-ONNX (Apache-2.0), 8-bit'
json.dump(man,open('manifest.json','w'),indent=1)
PY
echo "voice model ready"
