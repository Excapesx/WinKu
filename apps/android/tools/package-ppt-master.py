"""Package the pinned official PPT Master renderer for the Android APK."""

import hashlib
import io
import sys
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


VERSION = "6.8.0"
SHA256 = "2819a5b2330fa0dee9819b37395db5da33ae2b159908864225aa60481fe92bdd"
RELEASE = f"https://github.com/hugohe3/ppt-master/releases/download/v{VERSION}/ppt-master-skill-v{VERSION}.zip"
PREFIX = "ppt-master/skills/ppt-master/"
ATTRIBUTION = {"LICENSE", "SKILL.md", "SPONSORS.md", "SPONSORS_CN.md"}
BUILDER = "scripts/svg_to_pptx/pptx_package/builder.py"


def android_builder(data):
    # Android's Python runtime lacks the multiprocessing IPC required by the optional
    # parallel raster path. WinKu uses native DrawingML with one worker.
    import_line = b"from concurrent.futures import ProcessPoolExecutor, as_completed\n"
    pool_line = b"    with ProcessPoolExecutor(max_workers=workers) as pool:\n"
    if data.count(import_line) != 1 or data.count(pool_line) != 1:
        raise RuntimeError("The pinned PPT Master builder no longer matches the Android adjustment")
    return data.replace(import_line, b"").replace(pool_line, b"    " + import_line + b"\n" + pool_line)


def package(out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with urlopen(RELEASE, timeout=60) as response:
        archive = response.read(32 * 1024 * 1024)
    if hashlib.sha256(archive).hexdigest() != SHA256:
        raise RuntimeError("PPT Master release failed SHA-256 verification")

    target = out_dir / "ppt-master-renderer.zip"
    staging = target.with_suffix(".tmp")
    try:
        with ZipFile(io.BytesIO(archive)) as source, ZipFile(staging, "w") as output:
            for entry in source.infolist():
                if entry.is_dir() or not entry.filename.startswith(PREFIX):
                    continue
                name = entry.filename[len(PREFIX):]
                if name in ATTRIBUTION or (name.startswith("scripts/") and not name.startswith("scripts/tests/")):
                    data = source.read(entry)
                    if name == BUILDER:
                        data = android_builder(data)
                    output.writestr(ZipInfo(name), data, compress_type=ZIP_DEFLATED)
        staging.replace(target)
    finally:
        staging.unlink(missing_ok=True)


if __name__ == "__main__":
    package(sys.argv[1])
