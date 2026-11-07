"""Build an editable deck with the official PPT Master exporter."""

import re
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET


SVG = "http://www.w3.org/2000/svg"
XLINK_HREF = "{http://www.w3.org/1999/xlink}href"
TAGS = set("svg g rect circle ellipse line polyline polygon path text tspan image defs linearGradient radialGradient stop clipPath title desc".split())
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def bounded_read(path, limit):
    with path.open("rb") as source:
        data = source.read(limit + 1)
    if len(data) > limit:
        raise ValueError(f"{path.name} is larger than {limit // 1024} KiB")
    return data


def clean_slide(path, attachments, images_dir, image_cache):
    raw = bounded_read(path, 64 * 1024)
    if re.search(rb"<!\s*(DOCTYPE|ENTITY)", raw, re.I):
        raise ValueError(f"{path.name}: SVG declarations are unsupported")
    root = ET.fromstring(raw.decode("utf-8"))
    if root.tag != f"{{{SVG}}}svg" or root.get("viewBox") != "0 0 1280 720":
        raise ValueError(f"{path.name}: use an SVG root with viewBox=\"0 0 1280 720\"")
    root.set("width", "1280")
    root.set("height", "720")
    for count, node in enumerate(root.iter(), 1):
        tag = node.tag.removeprefix(f"{{{SVG}}}")
        if count > 700 or node.tag != f"{{{SVG}}}{tag}" or tag not in TAGS:
            raise ValueError(f"{path.name}: unsupported SVG element or too many elements ({tag})")
        for key, value in list(node.attrib.items()):
            if key in ("href", XLINK_HREF) and tag == "image":
                node.set(key, copy_image(value, attachments, images_dir, image_cache))
                continue
            if (key in ("href", XLINK_HREF, "src", "poster") or key.startswith(("data-", "on"))
                    or (key.startswith("{") and key != "{http://www.w3.org/XML/1998/namespace}lang")
                    or re.search(r"url\s*\(\s*(?!#[\w.-]+\s*\))", value, re.I)):
                raise ValueError(f"{path.name}: unsupported SVG attribute or external resource ({key})")
    return ET.tostring(root, encoding="utf-8")


def copy_image(ref, attachments, images_dir, cache):
    from io import BytesIO
    from PIL import Image

    name = ref.removeprefix("attachment:")
    if ref == name or not name or any(char in name for char in "/\\\x00"):
        raise ValueError("Use attachment:<filename> for an uploaded JPEG or PNG")
    image_path = (attachments / name).resolve()
    if image_path.parent != attachments or image_path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
        raise ValueError("Image must be an uploaded JPEG or PNG")
    if name not in cache:
        if len(cache) >= 8:
            raise ValueError("Use at most eight distinct uploaded photos in one deck")
        data = bounded_read(image_path, 5 * 1024 * 1024)
        with Image.open(BytesIO(data), formats=["JPEG", "PNG"]) as image:
            if image.width * image.height > 18_000_000:
                raise ValueError(f"{name}: image is too large; resize it before uploading")
            image.verify()
            extension = {"JPEG": "jpg", "PNG": "png"}[image.format]
        dest = images_dir / f"image-{len(cache) + 1}.{extension}"
        dest.write_bytes(data)
        cache[name] = f"images/{dest.name}"
    return cache[name]


def export_deck(renderer_dir, slides_dir, attachments_dir, output_path, language):
    scripts = str(Path(renderer_dir) / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    from attribution_guard import require_skill_integrity
    from svg_to_pptx import create_pptx_with_native_svg

    require_skill_integrity()
    source = Path(slides_dir).resolve()
    attachments = Path(attachments_dir).resolve()
    slides = sorted(source.glob("*.svg"))
    if not 1 <= len(slides) <= 24 or any(
        p.name != f"{i:02d}.svg" for i, p in enumerate(slides, 1)
    ):
        raise ValueError("Use one to 24 consecutive files named 01.svg, 02.svg, …")

    output = Path(output_path)
    with TemporaryDirectory(prefix="ppt-master-", dir=output.parent) as work:
        project = Path(work)
        images = project / "images"
        images.mkdir()
        slide_paths, notes, image_cache = [], {}, {}
        for slide in slides:
            if slide.is_symlink() or not slide.is_file():
                raise ValueError(f"{slide.name}: expected a regular file")
            clean = project / slide.name
            clean.write_bytes(clean_slide(slide, attachments, images, image_cache))
            slide_paths.append(clean)
            note = slide.with_suffix(".md")
            if note.is_symlink():
                raise ValueError(f"{note.name}: expected a regular file")
            if note.is_file():
                notes[slide.stem] = bounded_read(note, 8 * 1024).decode("utf-8").strip()
        if not create_pptx_with_native_svg(
            slide_paths, output, resource_root=project, canvas_format="ppt169",
            transition=None, notes=notes, verbose=False, workers=1,
            pptx_structure="flat", primary_language=language,
        ):
            raise ValueError("PPT Master could not export these slides. Check the SVG and retry.")
    return len(slides)
