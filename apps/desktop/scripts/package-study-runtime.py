"""Prepare the Windows x64 Python runtime shipped with the desktop installer."""

import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile

desktop = Path(__file__).resolve().parents[1]
android = desktop.parent / "android"
sys.path.insert(0, str(android / "app/src/main/python"))
from winku_speech_assets import download

if sys.version_info[:2] != (3, 12) or sys.platform != "win32" or sys.maxsize <= 2**32:
    raise SystemExit("Windows x64 Python 3.12 is required to prepare the installer")

runtime = desktop / "runtime"
runtime.mkdir(exist_ok=True)
target = runtime / "python"
if not (target / ".ready-v1").is_file():
    with TemporaryDirectory(dir=runtime) as scratch:
        work = Path(scratch)
        package = work / "python.zip"
        download("https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip", package,
                 "4acbed6dd1c744b0376e3b1cf57ce906f9dc9e95e68824584c8099a63025a3c3", 13_000_000)
        with ZipFile(package) as archive:
            archive.extractall(target)
    (target / "python312._pth").write_text("python312.zip\n.\nLib/site-packages\n../../engine\n", encoding="utf-8")
    subprocess.run([sys.executable, "-m", "pip", "install", "--only-binary=:all:", "--upgrade",
                    "--target", str(target / "Lib/site-packages"), "av==19.0.2", "numpy==2.3.5",
                    "sherpa-onnx==2.0.1", "sherpa-onnx-core==2.0.1", "opencc-python-reimplemented==0.1.7",
                    "python-pptx==1.0.2", "lxml==5.3.0", "Pillow==11.0.0", "typing-extensions==4.15.0",
                    "XlsxWriter==3.2.9"], check=True)
    subprocess.run([str(target / "python.exe"), "-c", "import av, numpy, sherpa_onnx, opencc, pptx, winku_ppt_master"], check=True)
    (target / ".ready-v1").touch()
subprocess.run([sys.executable, str(android / "tools/package-ppt-master.py"), str(runtime)], check=True)
