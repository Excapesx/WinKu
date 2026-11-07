import { t } from "./i18n";
import { request, type Attachment } from "./api";
const textExtensions =
  /\.(txt|md|csv|json|js|jsx|ts|tsx|py|java|kt|kts|c|cpp|h|hpp|rs|go|html|css|yml|yaml|xml|log)$/i;
export async function readAttachment(file: File): Promise<Attachment> {
  const recording = /\.(m4a|mp3|wav|aac|flac|ogg|opus)$/i.test(file.name);
  const office = /\.(docx|xlsx|pptx)$/i.test(file.name);
  if (recording || office) {
    if (file.size > (recording ? 192 : 20) * 1024 * 1024)
      throw Error(file.name + t(" 文件过大，请先拆分。"));
    return { name: file.name, kind: "file", fileKey: await stageFile(file, file.name) };
  }
  if (file.size > 20 * 1024 * 1024)
    throw Error(file.name + t(" 超过 20 MB，请先拆分文件。"));
  if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    if (file.size > 8 * 1024 * 1024) throw Error(t("图片不能超过 8 MB。"));
    const data = await encode(file);
    const extension = file.type === "image/png" ? ".png" : ".jpg";
    const fileKey = file.type === "image/webp" ? undefined : await stageFile(file, "image" + extension);
    return { name: file.name, kind: "image", mimeType: file.type, data, fileKey };
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
      if (pdf.numPages > 60) throw Error(t("PDF 超过 60 页，请先拆分章节。"));
      let text = "";
      for (let page = 1; page <= pdf.numPages; page++) {
        const p = await pdf.getPage(page),
          content = await p.getTextContent();
        text +=
          t("\n--- 第 ") +
          page +
          t(" 页 ---\n") +
          content.items
            .map((x: any) =>
              "str" in x ? x.str + (x.hasEOL ? "\n" : " ") : "",
            )
            .join("");
        p.cleanup();
        if (text.length > 120000)
          throw Error(t("PDF 文字过长，请先拆分章节。"));
      }
      if (text.replace(/--- 第 \d+ 页 ---/g, "").trim().length < 10)
        throw Error(
          t(
            "这是扫描版 PDF，暂时无法提取文字。请把题目截图作为图片发送给支持视觉的模型。",
          ),
        );
      return { name: file.name, kind: "document", text };
    } finally {
      await pdf.destroy();
    }
  }
  if (!textExtensions.test(file.name))
    throw Error(
      t("暂不支持这个文件类型。可添加 PDF、文本、代码或 PNG/JPG/WebP 图片。"),
    );
  const text = await file.text();
  if (text.length > 120000)
    throw Error(t("文字超过 12 万字符，请先拆分文件。"));
  return { name: file.name, kind: "document", text };
}

function encode(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(Error(t("附件读取失败")));
    reader.readAsDataURL(blob);
  });
}

async function stageFile(file: File, name: string) {
  if (!file.size) throw Error(t("附件为空。"));
  const key = crypto.randomUUID() + name.slice(name.lastIndexOf(".")).toLowerCase();
  try {
    const chunk = 256 * 1024;
    for (let offset = 0; offset < file.size; offset += chunk) {
      const data = await encode(file.slice(offset, offset + chunk));
      await request("attachment.stage", { key, name, size: file.size, offset, data });
    }
    return key;
  } catch (error) {
    await request("attachment.stage", { key, name, cancel: true }).catch(() => {});
    throw error;
  }
}
