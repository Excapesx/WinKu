"""Isolated desktop worker for offline speech recognition and editable PowerPoint export."""

import json
import re
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
from zipfile import ZipFile


def transcribe(file, cache, start, end):
    import av
    import numpy as np
    import sherpa_onnx
    from opencc import OpenCC
    from winku_speech_assets import prepare_model

    model = Path(prepare_model(cache))
    recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=str(model / "model.int8.onnx"), tokens=str(model / "tokens.txt"),
        num_threads=4, language="auto", use_itn=True,
    )
    rate = 16000
    config = sherpa_onnx.VadModelConfig()
    config.silero_vad.model = str(model / "silero_vad.onnx")
    config.silero_vad.threshold = 0.33
    config.silero_vad.min_silence_duration = 0.52
    config.silero_vad.max_speech_duration = 17
    config.sample_rate = rate
    vad = sherpa_onnx.VoiceActivityDetector(config, buffer_size_in_seconds=60)
    resample = av.AudioResampler(format="flt", layout="mono", rate=rate)
    simplify = OpenCC("t2s")
    lines = []
    cursor = start * rate
    end_sample = end * rate

    def feed(samples):
        window = config.silero_vad.window_size
        for offset in range(0, len(samples), window):
            vad.accept_waveform(samples[offset:offset + window])
            consume()

    def consume():
        while not vad.empty():
            speech = vad.front
            vad.pop()
            stream = recognizer.create_stream()
            stream.accept_waveform(rate, speech.samples)
            recognizer.decode_stream(stream)
            text = simplify.convert(stream.result.text.strip())
            second = start + speech.start // rate
            if text:
                lines.append(f"[{second // 60:02d}:{second % 60:02d}] {text}")

    def accept(frame):
        nonlocal cursor
        at = cursor if frame.pts is None else round(frame.pts * frame.time_base * rate) - origin
        samples = frame.to_ndarray().reshape(-1)
        last = min(at + len(samples), end_sample)
        if last <= cursor:
            return
        while at > cursor and cursor < end_sample:
            gap = min(at - cursor, end_sample - cursor, rate)
            feed(np.zeros(gap, dtype=np.float32))
            cursor += gap
        if last > cursor:
            feed(np.clip(samples[cursor - at:last - at] * 2.5, -0.99, 0.99))
            cursor = last

    with av.open(file) as container:
        source = container.streams.audio[0]
        origin = round((source.start_time or 0) * source.time_base * rate)
        if start:
            container.seek(round((start + origin / rate) / source.time_base), stream=source, backward=True)
        for decoded in container.decode(source):
            for frame in resample.resample(decoded):
                accept(frame)
            if cursor >= end_sample:
                break
        if cursor < end_sample:
            for frame in resample.resample(None):
                accept(frame)
    vad.flush()
    consume()
    if not lines:
        raise ValueError("No clear speech in the requested interval")
    return {"text": "\n".join(lines), "end": (cursor + rate - 1) // rate}


def read_office(file):
    suffix = Path(file).suffix.lower()
    with ZipFile(file) as archive:
        if sum(item.file_size for item in archive.infolist()) > 20 * 1024 * 1024:
            raise ValueError("The expanded document exceeds 20 MB")
        def parts(name):
            return ET.fromstring(archive.read(name))

        def local(node):
            return node.tag.rsplit("}", 1)[-1]

        def content(node, tags):
            return "".join(child.text or "" for child in node.iter() if local(child) in tags)

        if suffix == ".docx":
            return "\n".join(content(node, {"t"}) for node in parts("word/document.xml").iter() if local(node) == "p")
        if suffix == ".pptx":
            pattern = r"ppt/slides/slide(\d+)\.xml"
            return "\n".join(f"--- slide {index} ---\n" + "\n".join(
                content(node, {"t"}) for node in parts(name).iter() if local(node) == "p"
            ) for index, name in numbered_parts(archive, pattern))
        if suffix == ".xlsx":
            strings = []
            if "xl/sharedStrings.xml" in archive.namelist():
                strings = [content(node, {"t"}) for node in parts("xl/sharedStrings.xml")]
            rows = []
            for index, name in numbered_parts(archive, r"xl/worksheets/sheet(\d+)\.xml"):
                rows.append(f"--- sheet {index} ---")
                for row in parts(name).iter():
                    if local(row) != "row":
                        continue
                    cells = []
                    for cell in row:
                        value = content(cell, {"v", "t"})
                        if cell.get("t") == "s" and value.isdigit():
                            value = strings[int(value)]
                        if value:
                            cells.append(f"{cell.get('r', '')}: {value}")
                    if cells:
                        rows.append("\t".join(cells))
            return "\n".join(rows)
    raise ValueError("Unsupported document type")


def numbered_parts(archive, pattern):
    return sorted((int(m.group(1)), name) for name in archive.namelist() if (m := re.fullmatch(pattern, name)))


def ppt(archive, directory, attachments, output, language):
    from winku_ppt_master import export_deck

    with TemporaryDirectory() as work:
        with ZipFile(archive) as package:
            package.extractall(work)
        return export_deck(work, directory, attachments, output, language)


if __name__ == "__main__":
    operation, *args = sys.argv[1:]
    if operation == "transcribe":
        file, cache, start, end = args
        result = transcribe(file, cache, int(start), int(end))
    elif operation == "office":
        result = read_office(*args)
    elif operation == "ppt":
        result = ppt(*args)
    else:
        raise ValueError("Unknown study operation")
    print(json.dumps(result, ensure_ascii=True))
