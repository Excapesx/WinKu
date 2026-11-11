import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import ts from "typescript";
import { readFileSync } from "node:fs";
test("system, Chinese and English selection; interface catalog coverage and preservation of user content", async () => {
  const result = await build({
    entryPoints: ["src/i18n.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const { t, setUILanguage, resolveLanguage } = await import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].contents).toString("base64")
  );
  assert.equal(resolveLanguage("system", "zh-CN"), "zh");
  assert.equal(resolveLanguage("system", "en-US"), "en");
  assert.equal(resolveLanguage("zh", "en-US"), "zh");
  setUILanguage("en", "zh-CN");
  assert.equal(t("设置"), "Settings");
  assert.equal(
    t("请输入问题或添加附件。"),
    "Enter a question or add an attachment.",
  );
  assert.equal(t("用户自己的学习笔记"), "用户自己的学习笔记");
  const catalogCode = ts.transpileModule(
    readFileSync("src/locales/en.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.ESNext } },
  ).outputText;
  const { english } = await import(
    "data:text/javascript;base64," + Buffer.from(catalogCode).toString("base64")
  );
  for (const file of [
    "main.tsx",
    "MobilePages.tsx",
    "MobileUI.tsx",
    "ExtensionsPage.tsx",
    "Teaching.tsx",
    "attachments.ts",
    "Updates.tsx",
  ]) {
    const sf = ts.createSourceFile(
      file,
      readFileSync("src/" + file, "utf8"),
      99,
      true,
      4,
    );
    const visit = (n) => {
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(sf) === "t" &&
        ts.isStringLiteralLike(n.arguments[0]) &&
        /[\u4e00-\u9fff]/.test(n.arguments[0].text)
      )
        assert.ok(
          english[n.arguments[0].text],
          file + ": " + n.arguments[0].text,
        );
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  setUILanguage("zh", "en-US");
  assert.equal(t("设置"), "设置");
});
