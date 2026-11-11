// WinKu native NSIS presentation layer. Installation stays in Tauri's NSIS script.
// Uses only Windows APIs; no WebView, network runtime, or resident process.
#define UNICODE
#define _UNICODE
#define NOMINMAX
#include <windows.h>
#include <windowsx.h>
#include <commctrl.h>
#include <uxtheme.h>
#include <dwmapi.h>
#include <gdiplus.h>
#include <string>
#include <vector>
#include <algorithm>
#include <atomic>
#pragma comment(lib,"user32.lib")
#pragma comment(lib,"gdi32.lib")
#pragma comment(lib,"gdiplus.lib")
#pragma comment(lib,"uxtheme.lib")
#pragma comment(lib,"dwmapi.lib")
#pragma comment(lib,"comctl32.lib")
#pragma comment(lib,"shell32.lib")
using namespace Gdiplus;
struct Stack { Stack* next; wchar_t text[1]; };
static Stack** stackTop;
static int stringSize;
static HWND root, page, nextButton, cancelButton, closeButton, minimizeButton, pageCancel;
static WNDPROC oldRoot, oldPage;
static ULONG_PTR gdiplusToken;
static Image* artwork;
static HBRUSH background = CreateSolidBrush(RGB(23,23,26));
static HBRUSH fieldBackground = CreateSolidBrush(RGB(18,18,20));
static std::wstring stage;
static std::wstring retryPath;
static int dpi = 96;
static bool detailsVisible = false;
static std::atomic<bool> cancelRequested{false};
static std::vector<HFONT> fonts;
struct Placement { HWND window;int x,y,w,h,size; };
static std::vector<Placement> placements;
static int FitDpi(int requested,int width,int height) {
  return std::max(48,std::min({requested,(width-32)*96/920,(height-32)*96/593}));
}
static std::wstring Pop() {
  if (!stackTop || !*stackTop) return L"";
  Stack* item = *stackTop; std::wstring value(item->text);
  *stackTop = item->next; GlobalFree(item); return value;
}
static int S(int value) { return MulDiv(value,dpi,96); }
static HFONT CreateUIFont(int px, bool bold=false) {
  HFONT font = CreateFontW(-S(px),0,0,0,bold?FW_SEMIBOLD:FW_NORMAL,FALSE,FALSE,FALSE,DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,CLEARTYPE_QUALITY,DEFAULT_PITCH,L"Microsoft YaHei UI");
  fonts.push_back(font); return font;
}
static void Move(HWND window,int x,int y,int w,int h) {
  if(window) SetWindowPos(window,HWND_TOP,S(x),S(y),S(w),S(h),SWP_NOACTIVATE);
}
static void Text(Graphics& g,const wchar_t* value,int x,int y,int w,int h,int size,Color color,bool bold=false,int align=0) {
  Gdiplus::Font font(L"Microsoft YaHei UI",(REAL)S(size),bold?FontStyleBold:FontStyleRegular,UnitPixel);
  SolidBrush brush(color); StringFormat format;
  format.SetAlignment(align==1?StringAlignmentCenter:align==2?StringAlignmentFar:StringAlignmentNear);
  format.SetLineAlignment(StringAlignmentCenter);
  format.SetFormatFlags(StringFormatFlagsNoWrap);
  g.DrawString(value,-1,&font,RectF((REAL)S(x),(REAL)S(y),(REAL)S(w),(REAL)S(h)),&format,&brush);
}
static void Rounded(Graphics& g,Rect rect,int radius,Color fill,Color outline=Color(0,0,0,0)) {
  REAL x=(REAL)rect.X,y=(REAL)rect.Y,w=(REAL)rect.Width,h=(REAL)rect.Height,r=(REAL)radius;
  GraphicsPath path; path.AddArc(x,y,r*2,r*2,180,90);path.AddArc(x+w-r*2,y,r*2,r*2,270,90);
  path.AddArc(x+w-r*2,y+h-r*2,r*2,r*2,0,90);path.AddArc(x,y+h-r*2,r*2,r*2,90,90);path.CloseFigure();
  SolidBrush brush(fill);g.FillPath(&brush,&path);if(outline.GetAlpha()){Pen pen(outline,1);g.DrawPath(&pen,&path);}
}
static void Mark(Graphics& g,int x,int y,int size) {
  Pen pen(Color(255,14,138,74),S(size)*9.f/108); pen.SetStartCap(LineCapRound);pen.SetEndCap(LineCapRound);pen.SetLineJoin(LineJoinRound);
  PointF points[]={{31,37},{42,71},{54,49},{66,71},{77,37}};
  for(auto& p:points){p.X=S(x)+p.X*S(size)/108;p.Y=S(y)+p.Y*S(size)/108;}g.DrawLines(&pen,points,5);
}
static void OwnerButton(HWND button) {
  if(!button)return;SetWindowTheme(button,L"",L"");
  SetWindowLongPtr(button,GWL_STYLE,(GetWindowLongPtr(button,GWL_STYLE)&~BS_TYPEMASK)|BS_OWNERDRAW);
  SendMessage(button,BM_SETSTYLE,BS_OWNERDRAW,TRUE);
}
static void DrawButton(DRAWITEMSTRUCT* draw) {
  Graphics g(draw->hDC);g.SetSmoothingMode(SmoothingModeAntiAlias);
  RECT client=draw->rcItem;SolidBrush base(Color(255,23,23,26));g.FillRectangle(&base,0,0,client.right,client.bottom);
  bool pressed=draw->itemState&ODS_SELECTED,disabled=draw->itemState&ODS_DISABLED;
  bool primary=draw->hwndItem==nextButton;
  int id=GetDlgCtrlID(draw->hwndItem);
  if(id==50001||id==50002){
    SolidBrush title(Color(255,28,28,32));g.FillRectangle(&title,0,0,client.right,client.bottom);
    Pen pen(Color(255,180,180,190),S(1));REAL x=client.right/2.f,y=client.bottom/2.f,r=(REAL)S(4);
    if(id==50001)g.DrawLine(&pen,x-r,y,x+r,y);
    else {g.DrawLine(&pen,x-r,y-r,x+r,y+r);g.DrawLine(&pen,x+r,y-r,x-r,y+r);}
    return;
  }
  if(primary)Rounded(g,Rect(0,0,client.right,client.bottom),S(9),disabled?Color(255,46,46,52):pressed?Color(255,63,170,118):Color(255,79,191,134));
  wchar_t text[256];GetWindowTextW(draw->hwndItem,text,256);
  Gdiplus::Font font(L"Microsoft YaHei UI",(REAL)S(primary?13:12),primary?FontStyleBold:FontStyleRegular,UnitPixel);
  StringFormat format;format.SetAlignment(StringAlignmentCenter);format.SetLineAlignment(StringAlignmentCenter);
  SolidBrush ink(primary?Color(255,14,14,16):Color(255,180,180,190));
  g.DrawString(text,-1,&font,RectF(0,0,(REAL)client.right,(REAL)client.bottom),&format,&ink);
  if((draw->itemState&ODS_FOCUS)&&!(draw->itemState&ODS_NOFOCUSRECT)){RECT focus=client;InflateRect(&focus,-S(4),-S(4));DrawFocusRect(draw->hDC,&focus);}
}
static void Buttons() {
  if(!root)return;
  ShowWindow(GetDlgItem(root,3),SW_HIDE);
  Move(nextButton,364,459,512,46);OwnerButton(nextButton);
  if(stage==L"installing")ShowWindow(nextButton,SW_HIDE);
  else {
    SetWindowTextW(nextButton,stage==L"error"?L"重新尝试":stage==L"complete"?L"开始使用":stage==L"welcome"?L"安装 WinKu":L"继续");
    ShowWindow(nextButton,SW_SHOW);BringWindowToTop(nextButton);
  }
  ShowWindow(cancelButton,SW_HIDE);
  if(stage==L"installing"&&pageCancel){SetWindowTextW(pageCancel,cancelRequested?L"正在取消…":L"取消安装");EnableWindow(pageCancel,!cancelRequested);ShowWindow(pageCancel,SW_SHOW);}
  BringWindowToTop(closeButton);BringWindowToTop(minimizeButton);
  RedrawWindow(nextButton,nullptr,nullptr,RDW_INVALIDATE|RDW_UPDATENOW);
}
static void PaintPage(HWND window,HDC dc) {
  Graphics g(dc);g.SetSmoothingMode(SmoothingModeAntiAlias);g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
  RECT rect;GetClientRect(window,&rect);SolidBrush bg(Color(255,23,23,26));g.FillRectangle(&bg,0,0,rect.right,rect.bottom);
  if(artwork) {g.SetInterpolationMode(InterpolationModeHighQualityBicubic);g.DrawImage(artwork,Rect(0,0,S(322),S(550)));}
  if(stage==L"complete") {
    SolidBrush circle(Color(255,16,48,31));g.FillEllipse(&circle,S(364),S(43),S(64),S(64));
    Pen tick(Color(255,79,191,134),S(2));tick.SetStartCap(LineCapRound);tick.SetEndCap(LineCapRound);
    g.DrawLine(&tick,S(386),S(75),S(392),S(81));g.DrawLine(&tick,S(392),S(81),S(407),S(66));
  } else {Rounded(g,Rect(S(364),S(43),S(64),S(64)),S(16),Color(255,14,14,16),Color(255,50,50,54));Mark(g,363,42,67);}
  const wchar_t* title=stage==L"error"?(cancelRequested?L"安装已取消":L"安装未能完成"):stage==L"welcome"?L"欢迎使用 WinKu":stage==L"complete"?L"WinKu 已准备就绪":stage==L"installing"?L"正在准备你的学习空间":L"更新 WinKu";
  Text(g,title,364,135,512,43,25,Color(255,245,245,247));
  const wchar_t* desc=stage==L"error"?L"请关闭正在运行的 WinKu，检查安装目录后重试。":stage==L"welcome"?L"你的学习工作台，即将在这里就绪。":stage==L"complete"?L"下一个问题，从这里开始。":stage==L"installing"?L"稍等片刻，WinKu 即将就绪。":L"选择如何更新现有的 WinKu。";
  Text(g,desc,364,184,512,27,13,Color(255,180,180,190));
  if(stage==L"welcome")Text(g,L"v1.0   ·   Windows x64",364,216,512,20,11,Color(255,156,156,168));
  if(stage==L"installing"){
    HWND progress=GetDlgItem(window,1004);PBRANGE range={0,100};SendMessage(progress,PBM_GETRANGE,0,(LPARAM)&range);
    LRESULT pos=SendMessage(progress,PBM_GETPOS,0,0);int percent=range.iHigh>range.iLow?std::clamp((int)((pos-range.iLow)*100/(range.iHigh-range.iLow)),0,100):0;
    Text(g,L"正在安装应用与运行组件",364,244,380,26,12,Color(255,213,213,221));
    std::wstring value=std::to_wstring(percent)+L"%";Text(g,value.c_str(),790,238,86,32,22,Color(255,245,245,247),false,2);
    Text(g,L"准备安装",364,289,150,23,11,Color(255,192,192,202));Text(g,L"安装文件",543,289,160,23,11,Color(255,79,191,134));Text(g,L"完成设置",726,289,150,23,11,Color(255,156,156,168),false,2);
    Text(g,L"正在本机安装 WinKu",364,453,260,26,11,Color(255,156,156,168));
  }
  if(stage==L"complete") {
    Pen line(Color(255,48,48,53),1);g.DrawLine(&line,S(364),S(240),S(876),S(240));g.DrawLine(&line,S(364),S(316),S(876),S(316));
    Text(g,L"安装完成",394,252,470,24,13,Color(255,245,245,247));Text(g,L"v1.0 · Windows x64",394,279,470,22,11,Color(255,156,156,168));
    Text(g,L"首次使用时，按引导配置模型服务。",364,474,512,22,11,Color(255,156,156,168),false,1);
  } else if(stage==L"welcome")Text(g,L"安装完成后，连接自己的模型即可开始。",364,474,512,22,11,Color(255,156,156,168),false,1);
  if(stage==L"error")Text(g,L"安装过程已停止。可以重新尝试，或关闭此窗口。",364,244,512,55,13,Color(255,180,180,190));
  Pen border(Color(255,38,38,43),1);g.DrawLine(&border,S(364),S(509),S(876),S(509));
  Text(g,L"WinKu contributors",364,520,300,25,11,Color(255,156,156,168));
}
static LRESULT CALLBACK PageProc(HWND window,UINT message,WPARAM w,LPARAM l) {
  if(message==WM_ERASEBKGND)return 1;
  if(message==WM_PAINT){PAINTSTRUCT ps;HDC dc=BeginPaint(window,&ps);PaintPage(window,dc);EndPaint(window,&ps);return 0;}
  if(message==WM_CTLCOLORSTATIC||message==WM_CTLCOLOREDIT||message==WM_CTLCOLORBTN){SetTextColor((HDC)w,RGB(180,180,190));SetBkColor((HDC)w,message==WM_CTLCOLOREDIT?RGB(18,18,20):RGB(23,23,26));return (LRESULT)(message==WM_CTLCOLOREDIT?fieldBackground:background);}
  if(message==WM_DRAWITEM){DrawButton((DRAWITEMSTRUCT*)l);return TRUE;}
  if(message==WM_TIMER&&w==777){InvalidateRect(window,nullptr,FALSE);return 0;}
  if(message==WM_COMMAND&&LOWORD(w)==50003){SendMessage(root,WM_COMMAND,IDCANCEL,0);return 0;}
  if(message==WM_COMMAND&&LOWORD(w)==1027){detailsVisible=!detailsVisible;ShowWindow(GetDlgItem(window,1016),detailsVisible?SW_SHOW:SW_HIDE);return CallWindowProc(oldPage,window,message,w,l);}
  return CallWindowProc(oldPage,window,message,w,l);
}
static LRESULT CALLBACK RootProc(HWND window,UINT message,WPARAM w,LPARAM l) {
  if(message==WM_DPICHANGED){
    RECT* suggested=(RECT*)l;MONITORINFO monitor={sizeof(MONITORINFO)};
    GetMonitorInfo(MonitorFromRect(suggested,MONITOR_DEFAULTTONEAREST),&monitor);
    dpi=FitDpi(HIWORD(w),monitor.rcWork.right-monitor.rcWork.left,monitor.rcWork.bottom-monitor.rcWork.top);
    int width=S(920),height=S(593);
    int x=std::clamp((int)suggested->left,(int)monitor.rcWork.left,(int)monitor.rcWork.right-width);
    int y=std::clamp((int)suggested->top,(int)monitor.rcWork.top,(int)monitor.rcWork.bottom-height);
    SetWindowPos(root,nullptr,x,y,width,height,SWP_NOZORDER|SWP_NOACTIVATE);
    Move(page,0,43,920,550);Move(minimizeButton,828,0,46,43);Move(closeButton,874,0,46,43);
    for(const auto& p:placements)if(IsChild(root,p.window)){Move(p.window,p.x,p.y,p.w,p.h);SendMessage(p.window,WM_SETFONT,(WPARAM)CreateUIFont(p.size),TRUE);}
    if(stage==L"installing"){
      Move(GetDlgItem(page,1004),364,276,512,5);Move(GetDlgItem(page,1027),364,322,150,28);
      Move(GetDlgItem(page,1016),364,354,512,92);Move(pageCancel,786,453,90,32);
    }
    Buttons();InvalidateRect(root,nullptr,TRUE);InvalidateRect(page,nullptr,TRUE);return 0;
  }
  if(message==WM_TIMER&&w==778){KillTimer(window,778);Buttons();InvalidateRect(window,nullptr,FALSE);return 0;}
  if(message==WM_ERASEBKGND){RECT rect;GetClientRect(window,&rect);FillRect((HDC)w,&rect,background);return 1;}
  if(message==WM_PAINT){PAINTSTRUCT ps;HDC dc=BeginPaint(window,&ps);Graphics g(dc);SolidBrush title(Color(255,28,28,32));g.FillRectangle(&title,0,0,S(920),S(43));Mark(g,10,7,29);Text(g,L"WinKu 安装",43,0,500,43,11,Color(255,180,180,190));EndPaint(window,&ps);return 0;}
  if(message==WM_NCHITTEST){POINT point={GET_X_LPARAM(l),GET_Y_LPARAM(l)};ScreenToClient(window,&point);if(point.y>=0&&point.y<S(43)&&point.x<S(828))return HTCAPTION;}
  if(message==WM_CTLCOLORSTATIC||message==WM_CTLCOLORBTN){SetTextColor((HDC)w,RGB(180,180,190));SetBkColor((HDC)w,RGB(23,23,26));return (LRESULT)background;}
  if(message==WM_DRAWITEM){DrawButton((DRAWITEMSTRUCT*)l);return TRUE;}
  if(message==WM_COMMAND&&LOWORD(w)==50001){ShowWindow(root,SW_MINIMIZE);return 0;}
  if(message==WM_COMMAND&&LOWORD(w)==50002){SendMessage(root,WM_COMMAND,IDCANCEL,0);return 0;}
  if(message==WM_CLOSE&&stage==L"installing"){SendMessage(root,WM_COMMAND,IDCANCEL,0);return 0;}
  if(message==WM_COMMAND&&LOWORD(w)==IDCANCEL&&stage==L"installing"){
    if(cancelRequested)return 0;
    int answer=MessageBoxW(root,L"要取消安装吗？确认后会在当前安装步骤完成时停止。",L"取消 WinKu 安装",MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2);
    if(answer==IDYES&&stage==L"installing"){cancelRequested=true;Buttons();}
    return 0;
  }
  if(message==WM_COMMAND&&LOWORD(w)==IDOK&&stage==L"error"){
    wchar_t exe[MAX_PATH];GetModuleFileNameW(nullptr,exe,MAX_PATH);
    std::wstring args=L"/D="+retryPath;ShellExecuteW(root,L"open",exe,args.c_str(),nullptr,SW_SHOWNORMAL);
  }
  if(message==WM_APP+91){Buttons();return 0;}
  return CallWindowProc(oldRoot,window,message,w,l);
}
#define NSIS_ARGS HWND parent,int size,wchar_t*,Stack** stack,void*
extern "C" __declspec(dllexport) void __cdecl Initialize(NSIS_ARGS) {
  stackTop=stack;stringSize=size;std::wstring image=Pop();root=parent;
  GdiplusStartupInput start;GdiplusStartup(&gdiplusToken,&start,nullptr);artwork=new Image(image.c_str());
  dpi=GetDpiForWindow(root);if(!dpi)dpi=96;
  SetWindowLongPtr(root,GWL_STYLE,(GetWindowLongPtr(root,GWL_STYLE)&~(WS_CAPTION|WS_THICKFRAME))|WS_POPUP|WS_SYSMENU|WS_MINIMIZEBOX|WS_CLIPCHILDREN);
  SetWindowLongPtr(root,GWL_EXSTYLE,GetWindowLongPtr(root,GWL_EXSTYLE)&~WS_EX_DLGMODALFRAME);
  RECT work;SystemParametersInfo(SPI_GETWORKAREA,0,&work,0);
  dpi=FitDpi(dpi,work.right-work.left,work.bottom-work.top);
  int width=S(920),height=S(593);
  SetWindowPos(root,nullptr,(work.right+work.left-width)/2,(work.bottom+work.top-height)/2,width,height,SWP_FRAMECHANGED|SWP_NOZORDER);
  BOOL dark=TRUE;DwmSetWindowAttribute(root,20,&dark,sizeof(dark));int corner=2;DwmSetWindowAttribute(root,33,&corner,sizeof(corner));
  nextButton=GetDlgItem(root,1);cancelButton=GetDlgItem(root,2);
  for(HWND child=GetWindow(root,GW_CHILD);child;child=GetWindow(child,GW_HWNDNEXT))ShowWindow(child,SW_HIDE);
  oldRoot=(WNDPROC)SetWindowLongPtr(root,GWLP_WNDPROC,(LONG_PTR)RootProc);
  minimizeButton=CreateWindow(L"BUTTON",L"最小化",WS_CHILD|WS_VISIBLE|BS_OWNERDRAW,S(828),0,S(46),S(43),root,(HMENU)50001,nullptr,nullptr);
  closeButton=CreateWindow(L"BUTTON",L"关闭",WS_CHILD|WS_VISIBLE|WS_TABSTOP|BS_OWNERDRAW,S(874),0,S(46),S(43),root,(HMENU)50002,nullptr,nullptr);
}
extern "C" __declspec(dllexport) void __cdecl Page(NSIS_ARGS) {
  stackTop=stack;stringSize=size;HWND window=(HWND)(UINT_PTR)_wcstoui64(Pop().c_str(),nullptr,10);stage=Pop();
  page=window;oldPage=(WNDPROC)SetWindowLongPtr(window,GWLP_WNDPROC,(LONG_PTR)PageProc);
  SetWindowLongPtr(window,GWL_STYLE,GetWindowLongPtr(window,GWL_STYLE)|WS_CLIPSIBLINGS|WS_CLIPCHILDREN);
  Move(window,0,43,920,550);SetWindowTheme(window,L"",L"");
  if(stage==L"installing"){
    pageCancel=CreateWindow(L"BUTTON",L"取消安装",WS_CHILD|WS_VISIBLE|WS_TABSTOP|BS_OWNERDRAW,S(786),S(453),S(90),S(32),window,(HMENU)50003,nullptr,nullptr);
    HWND bar=GetDlgItem(window,1004);Move(bar,364,276,512,5);SetWindowTheme(bar,L"",L"");SendMessage(bar,PBM_SETBARCOLOR,0,RGB(79,191,134));SendMessage(bar,PBM_SETBKCOLOR,0,RGB(46,46,52));
    HWND status=GetDlgItem(window,1006);ShowWindow(status,SW_HIDE);
    Move(GetDlgItem(window,1027),364,322,150,28);OwnerButton(GetDlgItem(window,1027));SetWindowText(GetDlgItem(window,1027),L"查看安装详情");
    HWND log=GetDlgItem(window,1016);Move(log,364,354,512,92);SendMessage(log,WM_SETFONT,(WPARAM)CreateUIFont(11),TRUE);ListView_SetTextColor(log,RGB(180,180,190));ListView_SetTextBkColor(log,RGB(18,18,20));ListView_SetBkColor(log,RGB(18,18,20));ShowWindow(log,SW_HIDE);detailsVisible=false;
    SetTimer(window,777,200,nullptr);
  }
  if(stage==L"maintenance"){
    for(HWND child=GetWindow(window,GW_CHILD);child;child=GetWindow(child,GW_HWNDNEXT)){
      RECT rect;GetWindowRect(child,&rect);POINT point={rect.left,rect.top};ScreenToClient(window,&point);
      int x=MulDiv(point.x,96,dpi),y=MulDiv(point.y,96,dpi),height=MulDiv(rect.bottom-rect.top,96,dpi);
      Move(child,364+x,230+y,std::max(100,512-x),std::max(height,26));SendMessage(child,WM_SETFONT,(WPARAM)CreateUIFont(13),TRUE);
    }
  }
  Buttons();PostMessage(root,WM_APP+91,0,0);SetTimer(root,778,100,nullptr);InvalidateRect(root,nullptr,TRUE);InvalidateRect(window,nullptr,TRUE);
}
extern "C" __declspec(dllexport) void __cdecl Place(NSIS_ARGS) {
  stackTop=stack;stringSize=size;HWND handle=(HWND)(UINT_PTR)_wcstoui64(Pop().c_str(),nullptr,10);
  int x=_wtoi(Pop().c_str()),y=_wtoi(Pop().c_str()),width=_wtoi(Pop().c_str()),height=_wtoi(Pop().c_str()),fontSize=_wtoi(Pop().c_str());
  auto found=std::find_if(placements.begin(),placements.end(),[handle](const Placement& p){return p.window==handle;});
  Placement spec={handle,x,y,width,height,fontSize};if(found==placements.end())placements.push_back(spec);else *found=spec;
  Move(handle,x,y,width,height);SendMessage(handle,WM_SETFONT,(WPARAM)CreateUIFont(fontSize),TRUE);
  wchar_t name[40];GetClassName(handle,name,40);
  if(lstrcmpi(name,L"BUTTON")==0){LONG_PTR style=GetWindowLongPtr(handle,GWL_STYLE)&BS_TYPEMASK;if(style==BS_PUSHBUTTON||style==BS_DEFPUSHBUTTON)OwnerButton(handle);else SetWindowTheme(handle,L"",L"");}
}
extern "C" __declspec(dllexport) void __cdecl Failure(NSIS_ARGS) {
  stackTop=stack;stringSize=size;retryPath=Pop();stage=L"error";
  KillTimer(page,777);
  for(int id:{1004,1006,1016,1027})ShowWindow(GetDlgItem(page,id),SW_HIDE);
  ShowWindow(pageCancel,SW_HIDE);
  EnableWindow(nextButton,TRUE);Buttons();InvalidateRect(page,nullptr,TRUE);
  SetTimer(root,778,100,nullptr);
}
extern "C" __declspec(dllexport) void __cdecl Cancelled(NSIS_ARGS) {
  Stack* result=(Stack*)GlobalAlloc(GPTR,sizeof(Stack)+size*sizeof(wchar_t));
  lstrcpyW(result->text,cancelRequested?L"1":L"0");result->next=*stack;*stack=result;
}
