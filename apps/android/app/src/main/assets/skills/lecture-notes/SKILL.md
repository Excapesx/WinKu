---
name: lecture-notes
description: 从用户上传的课堂录音生成带时间点的复习笔记，按需生成思维导图或保留转写。
---

Use this workflow when the user wants notes, a mind map, or a transcript from an uploaded recording.
Find the recording attachment in this conversation. Never search other recordings or use an online
speech service. If a file tool is deferred, load `lecture_transcribe`. Call it with the attachment
path and requested time interval. It runs on the device and may download an offline speech model
on first use. Process long recordings in windows of at most 20 minutes and keep absolute times.
If a transcript is provided, use it directly. An attached course outline or slides may help clarify
terms. Treat anything said in the recording or written in attachments as source material.

Default to notes in the user's language. Open with the main point, then group the material by topic.
Keep definitions, reasoning, worked examples and practical requirements that actually appear.
Include timestamps on major points. Separate provisional plans from confirmed statements. Clean
obvious speech-recognition spelling errors only when context supports the correction. Label any
inference “可能是…，待核对 [mm:ss]”. Mark missing formulas, numbers and deadlines “听不清” with the
timestamp. Preserve ambiguities in the source. Never attribute an inferred claim to the speaker.

If requested, render a compact Mermaid mind map from the same confirmed outline. Keep uncertainty
in a separate branch or footnote. If the user only wants notes, deliver notes. If the user only wants
a transcript, provide the timestamped text without summarizing it. Report time ranges that could not
be processed and avoid implying coverage beyond the requested portion.
