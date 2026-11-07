import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
export type Provider = {
  id: string;
  name: string;
  model: string;
  baseURL: string;
  protocol: string;
  vision?: boolean;
};
export type Attachment = {
  name: string;
  kind: "image" | "document";
  mimeType?: string;
  data?: string;
  text?: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  model?: string;
  error?: string;
  interrupted?: boolean;
  attachments?: Attachment[];
};
export type Session = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  artifacts?: Record<string, any>;
};
export type Snapshot = {
  providers: Provider[];
  selectedProvider: string;
  sessions: Session[];
  busy: boolean;
  activeSession: string | null;
  pendingQuestions: any[];
};
export const empty: Snapshot = {
  providers: [],
  selectedProvider: "",
  sessions: [],
  busy: false,
  activeSession: null,
  pendingQuestions: [],
};
export const request = <T = any>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> => invoke<T>("desktop_request", { method, params });
export const subscribe = (
  callback: (event: { event: string; data: any }) => void,
) =>
  listen<{ event: string; data: any }>("winku-event", (e) =>
    callback(e.payload),
  );
export const openExternal = (url: string) => invoke("open_external", { url });
