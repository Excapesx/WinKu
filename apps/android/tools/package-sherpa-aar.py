"""Download the pinned official Android speech runtime."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app/src/main/python"))
from winku_speech_assets import RELEASE, download

target = Path(sys.argv[1])
target.parent.mkdir(parents=True, exist_ok=True)
temporary = target.with_suffix(".tmp")
try:
    download(RELEASE + "v2.0.1/sherpa-onnx-2.0.1.aar", temporary,
             "a8d09d1d32f3eb8520482c6d3d43fae674681c5b050385967c70a3c2c9bf0ee7", 52_000_000)
    temporary.replace(target)
finally:
    temporary.unlink(missing_ok=True)
