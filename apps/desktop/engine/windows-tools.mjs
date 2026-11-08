import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export function powershell(script, args = {}, signal) {
  const payload = Buffer.from(JSON.stringify(args)).toString("base64");
  const source = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $winkuArgs=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))); ${script}`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(source, "utf16le").toString("base64"),
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], signal },
    );
    let out = "",
      error = "";
    const timer = setTimeout(() => child.kill(), 20000);
    child.stdout.on("data", (x) => {
      out += x.toString();
      if (out.length > 300000) child.kill();
    });
    child.stderr.on("data", (x) => (error = (error + x).slice(-4000)));
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(out.trim())
        : reject(Error(error || "Windows 操作未完成。"));
    });
  });
}
const user32 = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinKuNative { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }';`;
export function registerWindowsTools(ctx, config) {
  const prefs = config.preferences ?? {},
    tools = prefs.tools ?? {},
    readOnly = prefs.access === "read-only";
  const mutation = new Set([
    "windows_input",
    "windows_open_settings",
    "windows_notify",
    "write",
    "edit",
    "pwsh",
    "ppt_export",
  ]);
  ctx.on("tools/pre-execute", async (exec, next) => {
    if (!mutation.has(exec.name) && !exec.name.startsWith("mcp__"))
      return next();
    if (readOnly)
      return {
        kind: "deny",
        reason: "当前为只读模式，请让用户在权限设置中开启电脑操作。",
      };
    if (prefs.access === "ask")
      return {
        kind: "ask",
        reason:
          "WinKu 请求执行工具操作：" +
          exec.name +
          "\n" +
          JSON.stringify(exec.arguments ?? {}).slice(0, 8000),
      };
    return next();
  });
  const add = (name, description, properties, required, execute) =>
    ctx.tools.register({
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
      output: {
        schema: {},
        render: (_args, value) => [
          { type: "text", text: JSON.stringify(value) },
        ],
      },
      execute: async (args, exec) => execute(args, exec.signal),
    });
  if (tools.screen) {
    add(
      "windows_screen_tree",
      "读取 Windows 窗口的无障碍控件树。可限定 processId；只返回文字、控件类型与边界，不点击。",
      { processId: { type: "integer" } },
      [],
      async ({ processId }, signal) => {
        const raw = await powershell(
          `Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; $root=[Windows.Automation.AutomationElement]::RootElement; if($winkuArgs.processId){$condition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty,[int]$winkuArgs.processId);$root=$root.FindFirst([Windows.Automation.TreeScope]::Children,$condition);if(!$root){throw 'Window not found'}}; $nodes=$root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition);$result=@(); for($i=0;$i -lt [Math]::Min(400,$nodes.Count);$i++){try{$n=$nodes.Item($i).Current;if($n.Name -or $n.AutomationId){$result+=@{name=$n.Name;id=$n.AutomationId;type=$n.ControlType.ProgrammaticName;enabled=$n.IsEnabled;rect=$n.BoundingRectangle.ToString()}}}catch{}};ConvertTo-Json -InputObject $result -Depth 4 -Compress`,
          { processId },
          signal,
        );
        return { controls: JSON.parse(raw || "[]") };
      },
    );
    add(
      "windows_capture_screen",
      "截取当前 Windows 主屏幕，返回本机 PNG 路径，可用 read_image 继续读取。",
      {},
      [],
      async (_args, signal) => {
        const dir = join(config.workspace, "captures");
        mkdirSync(dir, { recursive: true });
        const path = join(dir, randomUUID() + ".png");
        await powershell(
          `Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$r=[Windows.Forms.Screen]::PrimaryScreen.Bounds;$bitmap=New-Object Drawing.Bitmap($r.Width,$r.Height);$g=[Drawing.Graphics]::FromImage($bitmap);try{$g.CopyFromScreen($r.Location,[Drawing.Point]::Empty,$r.Size);$bitmap.Save($winkuArgs.path,[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bitmap.Dispose()}`,
          { path },
          signal,
        );
        return { path };
      },
    );
  }
  if (tools.input && !readOnly)
    add(
      "windows_input",
      "对当前 Windows 桌面点击、输入文字或按键。先读屏确认目标，操作前遵守当前用户授权。",
      {
        action: { type: "string", enum: ["click", "type", "key"] },
        x: { type: "integer" },
        y: { type: "integer" },
        text: { type: "string" },
        key: {
          type: "string",
          enum: [
            "ENTER",
            "TAB",
            "ESC",
            "BACKSPACE",
            "CTRL+A",
            "CTRL+C",
            "CTRL+V",
            "CTRL+S",
            "ALT+TAB",
          ],
        },
      },
      ["action"],
      async (args, signal) => {
        if (args.action === "click") {
          if (
            !Number.isInteger(args.x) ||
            !Number.isInteger(args.y) ||
            Math.abs(args.x) > 16384 ||
            Math.abs(args.y) > 16384
          )
            throw Error("点击坐标无效。");
          await powershell(
            user32 +
              `[WinKuNative]::SetCursorPos($winkuArgs.x,$winkuArgs.y)|Out-Null;[WinKuNative]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[WinKuNative]::mouse_event(4,0,0,0,[UIntPtr]::Zero)`,
            args,
            signal,
          );
        } else {
          const keys = {
            ENTER: "{ENTER}",
            TAB: "{TAB}",
            ESC: "{ESC}",
            BACKSPACE: "{BACKSPACE}",
            "CTRL+A": "^a",
            "CTRL+C": "^c",
            "CTRL+V": "^v",
            "CTRL+S": "^s",
            "ALT+TAB": "%{TAB}",
          };
          let text;
          if (args.action === "key") {
            text = keys[args.key];
            if (!text) throw Error("按键无效。");
          } else {
            if (typeof args.text !== "string" || args.text.length > 8000)
              throw Error("输入文字无效。");
            text = args.text.replace(/[+^%~(){}[\]]/g, (c) => "{" + c + "}");
          }
          await powershell(
            `Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.SendKeys]::SendWait($winkuArgs.text)`,
            { text },
            signal,
          );
        }
        return { done: true };
      },
    );
  if (tools.input && !readOnly)
    add(
      "windows_open_settings",
      "打开 Windows 设置的指定页面。",
      {
        page: {
          type: "string",
          enum: [
            "display",
            "privacy",
            "notifications",
            "apps",
            "accessibility",
          ],
        },
      },
      ["page"],
      async ({ page }, signal) => {
        const uri = {
          display: "display",
          privacy: "privacy",
          notifications: "notifications",
          apps: "appsfeatures",
          accessibility: "easeofaccess",
        }[page];
        if (!uri) throw Error("设置页无效。");
        await powershell(
          `Start-Process -FilePath ('ms-settings:'+$winkuArgs.page)`,
          { page: uri },
          signal,
        );
        return { opened: page };
      },
    );
  if (tools.notifications && !readOnly)
    add(
      "windows_notify",
      "发送一条 Windows 桌面气泡通知。",
      { text: { type: "string" } },
      ["text"],
      async ({ text }, signal) => {
        if (typeof text !== "string" || text.length > 1000)
          throw Error("通知内容无效。");
        await powershell(
          `Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing;$n=New-Object Windows.Forms.NotifyIcon;$n.Icon=[Drawing.SystemIcons]::Information;$n.Visible=$true;try{$n.ShowBalloonTip(5000,'WinKu',$winkuArgs.text,[Windows.Forms.ToolTipIcon]::Info);Start-Sleep -Seconds 6}finally{$n.Dispose()}`,
          { text },
          signal,
        );
        return { shown: true };
      },
    );
}
