"""Fetch and verify the local speech model without sending any recording."""

import hashlib
import shutil
import tarfile
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen

MODEL = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17"
RELEASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/"
FILES = ("model.int8.onnx", "tokens.txt", "silero_vad.onnx", "LICENSE")


def download(url, destination, sha256, limit):
    digest = hashlib.sha256()
    size = 0
    with urlopen(url, timeout=30) as source, destination.open("wb") as output:
        while chunk := source.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                raise ValueError("Download exceeded the expected size")
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != sha256:
        raise ValueError("Download failed SHA-256 verification")


def prepare_model(cache_path):
    cache = Path(cache_path)
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / MODEL

    def ready():
        return all((target / name).is_file() for name in FILES)

    if ready():
        return str(target)
    with TemporaryDirectory(dir=cache) as scratch:
        work = Path(scratch)
        archive = work / "model.tar.bz2"
        output = work / MODEL
        output.mkdir()
        download(RELEASE + f"asr-models/{MODEL}.tar.bz2", archive,
                 "7d1efa2138a65b0b488df37f8b89e3d91a60676e416f515b952358d83dfd347e", 175_000_000)
        with tarfile.open(archive, "r:bz2") as package:
            for name in ("model.int8.onnx", "tokens.txt", "LICENSE"):
                with package.extractfile(f"{MODEL}/{name}") as source, (output / name).open("wb") as dest:
                    shutil.copyfileobj(source, dest)
        download(RELEASE + "asr-models/silero_vad.onnx", output / "silero_vad.onnx",
                 "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6", 1_000_000)
        try:
            output.rename(target)
        except OSError:
            if not ready():
                raise
    return str(target)
