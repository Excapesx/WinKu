import type { Attachment } from "./api";
const textExtensions =
  /\.(txt|md|csv|json|js|jsx|ts|tsx|py|java|kt|kts|c|cpp|h|hpp|rs|go|html|css|yml|yaml|xml|log)$/i;
export async function readAttachment(file: File): Promise<Attachment> {
  if (file.size > 20 * 1024 * 1024)
    throw Error(file.name + " 超过 20 MB，请先拆分文件。");
  if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    if (file.size > 8 * 1024 * 1024) throw Error("图片不能超过 8 MB。");
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(Error("图片读取失败"));
      reader.readAsDataURL(file);
    });
    return { name: file.name, kind: "image", mimeType: file.type, data };
  }
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "/pdf.worker.min.mjs",
      location.href,
    ).href;
    const pdf = await pdfjs.getDocument({
      data: await file.arrayBuffer(),
      useSystemFonts: true,
    }).promise;
    try {
      if (pdf.numPages > 60) throw Error("PDF 超过 60 页，请先拆分章节。");
      let text = "";
      for (let page = 1; page <= pdf.numPages; page++) {
        const p = await pdf.getPage(page),
          content = await p.getTextContent();
        text +=
          "\n--- 第 " +
          page +
          " 页 ---\n" +
          content.items
            .map((x: any) =>
              "str" in x ? x.str + (x.hasEOL ? "\n" : " ") : "",
            )
            .join("");
        p.cleanup();
        if (text.length > 120000) throw Error("PDF 文字过长，请先拆分章节。");
      }
      if (text.replace(/--- 第 \d+ 页 ---/g, "").trim().length < 10)
        throw Error(
          "这是扫描版 PDF，暂时无法提取文字。请把题目截图作为图片发送给支持视觉的模型。",
        );
      return { name: file.name, kind: "document", text };
    } finally {
      await pdf.destroy();
    }
  }
  if (!textExtensions.test(file.name))
    throw Error(
      "暂不支持这个文件类型。可添加 PDF、文本、代码或 PNG/JPG/WebP 图片。",
    );
  const text = await file.text();
  if (text.length > 120000) throw Error("文字超过 12 万字符，请先拆分文件。");
  return { name: file.name, kind: "document", text };
}
