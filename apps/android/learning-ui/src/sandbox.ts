// This document has an opaque sandbox origin and no native message channel.
const receive=(event:MessageEvent)=>{
  if(event.source!==parent||event.data?.type!=='dsh-html'||typeof event.data.html!=='string'||event.data.html.length>100000)return;
  const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
  const scheme=event.data.dark?'dark':'light';
  // Replacing the document is intentional: parsing executes its inline scripts only in this iframe.
  // The frame keeps its sandbox flags and URL; it never inherits host privileges.
  document.open();
  document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>:root{color-scheme:${scheme}}body{margin:16px;font:16px/1.6 system-ui;color:CanvasText;background:Canvas}</style></head><body>${event.data.html}</body></html>`);
  document.close();
  window.addEventListener('message',receive);
};
window.addEventListener('message',receive);
