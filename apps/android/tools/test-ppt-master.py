"""Exercise the packaged renderer with Chinese editable text, notes and an attachment."""

import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile

from PIL import Image
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

from winku_ppt_master import export_deck


def main(archive):
    with TemporaryDirectory() as temp:
        root = Path(temp)
        renderer = root / "renderer"
        with ZipFile(archive) as packaged:
            packaged.extractall(renderer)
        slides, attachments = root / "slides", root / "attachments"
        slides.mkdir()
        attachments.mkdir()
        Image.new("RGB", (80, 50), "#182431").save(attachments / "example.png")
        prefix = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">'
        (slides / "01.svg").write_text(
            prefix + '<text x="80" y="140" font-size="48">课程汇报</text>'
            '<image href="attachment:example.png" x="80" y="200" width="320" height="200"/></svg>',
            encoding="utf-8",
        )
        (slides / "01.md").write_text("备注：按材料讲解", encoding="utf-8")
        (slides / "02.svg").write_text(prefix + '<text x="80" y="140" font-size="48">结果</text></svg>', encoding="utf-8")
        output = root / "deck.tmp"
        assert export_deck(renderer, slides, attachments, output, "zh-CN") == 2
        deck = Presentation(str(output))
        assert len(deck.slides) == 2
        assert any(shape.has_text_frame and shape.text == "课程汇报" for shape in deck.slides[0].shapes)
        assert any(shape.shape_type == MSO_SHAPE_TYPE.PICTURE for shape in deck.slides[0].shapes)
        assert "按材料讲解" in deck.slides[0].notes_slide.notes_text_frame.text

        (slides / "02.svg").write_text(prefix + '<image href="attachment:../../private.png"/></svg>', encoding="utf-8")
        try:
            export_deck(renderer, slides, attachments, root / "invalid.tmp", "zh-CN")
        except ValueError as error:
            assert "uploaded JPEG or PNG" in str(error)
        else:
            raise AssertionError("Escaped attachment path was accepted")
        assert not (root / "invalid.tmp").exists()
        print("Verified editable slides, embedded attachment, speaker notes and path containment.")


if __name__ == "__main__":
    main(sys.argv[1])
