#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    os::windows::{io::AsRawHandle, process::CommandExt},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicIsize, AtomicU64, Ordering},
        mpsc, Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Emitter, Manager};
use windows_sys::Win32::{
    Foundation::CloseHandle,
    System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    },
};

struct Backend {
    input: Mutex<ChildStdin>,
    child: Mutex<Child>,
    pending: Mutex<HashMap<u64, mpsc::Sender<Result<Value, String>>>>,
    next: AtomicU64,
    job: AtomicIsize,
}
impl Backend {
    fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "引擎状态异常")?
            .insert(id, tx);
        let packet = json!({"id":id,"method":method,"params":params}).to_string() + "\n";
        if let Err(e) = self
            .input
            .lock()
            .map_err(|_| "引擎输入异常")?
            .write_all(packet.as_bytes())
        {
            self.pending.lock().unwrap().remove(&id);
            return Err(format!("无法连接引擎：{e}"));
        }
        let result = rx
            .recv_timeout(Duration::from_secs(if method == "shutdown" {
                5
            } else if method.starts_with("plugins.") {
                240
            } else {
                65
            }))
            .map_err(|_| "引擎未响应，请重新打开 WinKu。".to_string());
        self.pending.lock().unwrap().remove(&id);
        result?
    }
    fn end_processes(&self) {
        let job = self.job.swap(0, Ordering::SeqCst);
        unsafe {
            if job != 0 {
                CloseHandle(job as _);
            }
        }
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
impl Drop for Backend {
    fn drop(&mut self) {
        self.end_processes();
    }
}
fn credential(id: &str) -> Result<keyring::Entry, String> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|x| x.is_ascii_lowercase() || x.is_ascii_digit() || x == b'-')
    {
        return Err("无效的服务商 ID".into());
    }
    keyring::Entry::new("WinKu Desktop", id).map_err(|e| format!("Windows 凭据管理器不可用：{e}"))
}
#[tauri::command]
async fn desktop_request(
    backend: tauri::State<'_, Arc<Backend>>,
    method: String,
    mut params: Value,
) -> Result<Value, String> {
    let backend = backend.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        match method.as_str() {
            "state" | "provider.select" | "session.delete" | "artifact.save" | "stop"
            | "question.answer" | "prompt.polish.cancel" | "preferences.save" | "session.update" | "queue.remove"
            | "mode.save" | "mode.delete" | "extension.toggle"
            | "plugins.list" | "plugins.inspect" | "plugins.install" | "plugins.toggle" | "plugins.delete"
            | "market.save" | "market.read" | "skill.preview" | "skill.import"
            | "automation.save" | "automation.toggle" | "automation.delete" | "automation.failure" => {}
            "extension.save" | "mcp.test" => {
                let mut secret=params.as_object_mut().ok_or("参数错误")?.remove("secrets");
                let confirm=params.get("confirmLaunch").cloned();
                params=backend.call("extension.validate",params)?;
                let id=params.get("id").and_then(Value::as_str).ok_or("扩展 ID 无效")?.to_string();
                let slot=credential(&format!("mcp-{id}"))?;
                if let Some(update)=secret.take() {
                    if !update.is_object(){return Err("认证配置应为 JSON 对象".into());}
                    let mut merged=slot.get_password().ok().and_then(|s|serde_json::from_str::<Value>(&s).ok()).unwrap_or(json!({"headers":{},"env":{}}));
                    for group in ["headers","env"] {if let Some(value)=update.get(group) {merged.as_object_mut().ok_or("认证配置无效")?.insert(group.into(),value.clone());}}
                    secret=Some(merged);
                }
                if let Some(ref value)=secret {
                    if value.to_string().len()>32000 {return Err("认证配置过长".into());}
                    for group in ["headers","env"] {
                        let map=value.get(group).and_then(Value::as_object).ok_or("认证配置应为 JSON 对象")?;
                        for (name,v) in map {
                            let text=v.as_str().ok_or("认证值必须是字符串")?;
                            if name.is_empty()||name.len()>200||!name.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_')||text.contains(['\r','\n']) {return Err("认证字段无效".into());}
                        }
                    }
                }
                if method=="extension.save" {
                    if let Some(value)=secret {
                        let has=value.get("headers").and_then(Value::as_object).is_some_and(|m|!m.is_empty())||value.get("env").and_then(Value::as_object).is_some_and(|m|!m.is_empty());
                        if has {slot.set_password(&value.to_string()).map_err(|e|format!("认证保存失败：{e}"))?;} else {let _=slot.delete_credential();}
                        params.as_object_mut().unwrap().insert("hasSecrets".into(),json!(has));
                    }
                } else {
                    let value=secret.or_else(||slot.get_password().ok().and_then(|s|serde_json::from_str(&s).ok())).unwrap_or(json!({}));
                    params.as_object_mut().unwrap().insert("_secrets".into(),value);
                    if let Some(confirm)=confirm {params.as_object_mut().unwrap().insert("confirmLaunch".into(),confirm);}
                }
            }
            "extension.delete" => {
                let id=params.get("id").and_then(Value::as_str).ok_or("缺少扩展 ID")?.to_string();
                let result=backend.call("extension.delete",params)?;
                let _=credential(&format!("mcp-{id}"))?.delete_credential();
                return Ok(result);
            }
            "provider.save" => {
                let key = params
                    .get("apiKey")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                let id = params
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or("缺少服务商 ID")?;
                let id = id.to_string();
                params.as_object_mut().ok_or("参数错误")?.remove("apiKey");
                params = backend.call("provider.validate", params)?;
                if !key.is_empty() {
                    credential(&id)?
                        .set_password(&key)
                        .map_err(|e| format!("API Key 保存失败：{e}"))?;
                }
            }
            "send" | "queue.send" | "regenerate" | "prompt.polish" | "provider.test" | "provider.models" | "automation.run" => {
                let snapshot = backend.call("state", json!({}))?;
                let task_provider = if method=="automation.run" { snapshot.get("automations").and_then(Value::as_array).and_then(|items| items.iter().find(|task|task.get("id")==params.get("id"))).and_then(|task|task.get("providerId")).and_then(Value::as_str) } else { None };
                let id = task_provider.or_else(||params
                    .get("providerId")
                    .and_then(Value::as_str)
                    .filter(|x| !x.is_empty()))
                    .or_else(|| snapshot.get("selectedProvider").and_then(Value::as_str))
                    .ok_or("请先配置模型")?;
                let key = credential(id)?
                    .get_password()
                    .map_err(|_| "请在模型设置中填写 API Key。")?;
                params
                    .as_object_mut()
                    .ok_or("参数错误")?
                    .insert("_key".into(), json!(key));
                let mut secrets=serde_json::Map::new();
                if let Some(items)=snapshot.get("extensions").and_then(Value::as_array) {
                    for item in items {
                        if item.get("type").and_then(Value::as_str)!=Some("mcp") {continue;}
                        if let Some(id)=item.get("id").and_then(Value::as_str) {
                            if let Ok(value)=credential(&format!("mcp-{id}"))?.get_password() {
                                if let Ok(parsed)=serde_json::from_str::<Value>(&value) {secrets.insert(id.into(),parsed);}
                            }
                        }
                    }
                }
                params.as_object_mut().unwrap().insert("_mcpSecrets".into(),Value::Object(secrets));
            }
            "provider.delete" => {
                let id=params.get("id").and_then(Value::as_str).ok_or("缺少服务商 ID")?;
                let result=backend.call("provider.delete",params.clone())?;
                let _=credential(id)?.delete_credential();
                return Ok(result);
            }
            "windows.voice" => {
                let script="Start-Sleep -Milliseconds 250; Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class WinKuVoice{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e);}'; [WinKuVoice]::keybd_event(0x5B,0,0,[UIntPtr]::Zero);[WinKuVoice]::keybd_event(0x48,0,0,[UIntPtr]::Zero);[WinKuVoice]::keybd_event(0x48,0,2,[UIntPtr]::Zero);[WinKuVoice]::keybd_event(0x5B,0,2,[UIntPtr]::Zero)";
                let status=Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-Command",script]).creation_flags(0x08000000).status().map_err(|e|e.to_string())?;
                if !status.success(){return Err("无法打开 Windows 语音输入，请在输入框按 Win + H。".into());}
                return Ok(json!({"ok":true}));
            }
            "windows.settings" => {
                let page=match params.get("page").and_then(Value::as_str){Some("accessibility")=>"ms-settings:easeofaccess",Some("notifications")=>"ms-settings:notifications",Some("microphone")=>"ms-settings:privacy-microphone",_=>return Err("不支持的系统设置页面".into())};
                open::that_detached(page).map_err(|e|e.to_string())?;
                return Ok(json!({"ok":true}));
            }
            _ => return Err("不支持的命令".into()),
        }
        backend.call(&method, params)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "链接格式错误")?;
    if !["https", "http"].contains(&parsed.scheme())
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("只支持网页链接".into());
    }
    open::that_detached(parsed.as_str()).map_err(|e| e.to_string())
}
fn main() {
    tauri::Builder::default()
      .invoke_handler(tauri::generate_handler![desktop_request, open_external])
      .setup(|app| {
        let resources = app.path().resource_dir()?;
        let root = if cfg!(debug_assertions) { std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf() } else { resources };
        let data = std::env::var_os("WINKU_TEST_DATA_DIR").filter(|_| cfg!(debug_assertions)).map(std::path::PathBuf::from).unwrap_or(app.path().app_local_data_dir()?);
        std::fs::create_dir_all(&data)?;
        let mut child = Command::new(root.join("runtime/node.exe")).arg(root.join("engine/host.mjs"))
            .env("WINKU_DATA_DIR", &data).creation_flags(0x08000000)
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
        // A Windows job owns every descendant, including the lazy dsh process.
        // Closing the app (or crashing) closes the job and ends them together.
        let job = unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {return Err(std::io::Error::last_os_error().into());}
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(job, JobObjectExtendedLimitInformation, &info as *const _ as _, std::mem::size_of_val(&info) as u32)==0
                || AssignProcessToJobObject(job, child.as_raw_handle() as _)==0 {CloseHandle(job);let _=child.kill();return Err(std::io::Error::last_os_error().into());}
            job as isize
        };
        let input = child.stdin.take().unwrap(); let output = child.stdout.take().unwrap(); let errors = child.stderr.take().unwrap();
        let backend = Arc::new(Backend {input:Mutex::new(input),child:Mutex::new(child),pending:Mutex::new(HashMap::new()),next:AtomicU64::new(1),job:AtomicIsize::new(job)});
        let reader = Arc::downgrade(&backend); let handle = app.handle().clone();
        std::thread::spawn(move || {
            for line in BufReader::new(output).lines().map_while(Result::ok) {
                let Ok(value) = serde_json::from_str::<Value>(&line) else {continue};
                if let Some(event)=value.get("event").and_then(Value::as_str) {let _=handle.emit("winku-event",json!({"event":event,"data":value["data"]}));}
                else if let Some(id)=value.get("id").and_then(Value::as_u64) {
                    if let Some(backend)=reader.upgrade() {if let Some(tx)=backend.pending.lock().unwrap().remove(&id) {
                        let _=tx.send(if let Some(error)=value.get("error").and_then(Value::as_str) {Err(error.into())} else {Ok(value["result"].clone())});
                    }}
                }
            }
            if let Some(backend)=reader.upgrade() {for (_,tx) in backend.pending.lock().unwrap().drain() {let _=tx.send(Err("引擎已退出，请重新打开 WinKu。".into()));}}
        });
        std::thread::spawn(move || {for _ in BufReader::new(errors).lines().map_while(Result::ok) {}});
        app.manage(backend);
        let mut window=tauri::WebviewWindowBuilder::from_config(app,&app.config().app.windows[0])?;
        if cfg!(debug_assertions) {
            if let Ok(port)=std::env::var("WINKU_DEBUG_PORT") {
                let port: u16=port.parse()?;
                window=window.additional_browser_args(&format!("--remote-debugging-port={port} --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"));
            }
            window=window.data_directory(data.join("webview"));
            if std::env::var_os("WINKU_TEST_HIDDEN").is_some(){window=window.visible(false);}
        }
        window.build()?;
        Ok(())
      }).build(tauri::generate_context!()).expect("WinKu could not start")
      .run(|app,event| {if matches!(event,tauri::RunEvent::Exit) {if let Some(backend)=app.try_state::<Arc<Backend>>() {let _=backend.call("shutdown",json!({}));backend.end_processes();}}});
}
