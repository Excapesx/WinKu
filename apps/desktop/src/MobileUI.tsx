import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { createPortal } from "react-dom";
import { androidIcons } from "./android-icons";
export type IconName = keyof typeof androidIcons;
export function AIcon({
  name,
  size = 16,
  ...props
}: { name: IconName; size?: number } & React.SVGProps<SVGSVGElement>) {
  const icon = androidIcons[name];
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
      className="android-icon"
      {...props}
    >
      {icon.paths.map((p, i) => (
        <path key={i} {...(p as any)} />
      ))}
    </svg>
  );
}
export function AButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="a-icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <AIcon name={icon} size={18} />
    </button>
  );
}
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      className={"a-switch " + (checked ? "on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
export function Segmented({
  values,
  value,
  onChange,
}: {
  values: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="a-segmented">
      {values.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-pressed={value === item.id}
          className={value === item.id ? "on" : ""}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <section className="a-settings-card">{children}</section>;
}
export function Row({
  title,
  description,
  icon,
  onClick,
  trailing,
  children,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  onClick?: () => void;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <div className={"a-row " + (children ? "stacked" : "")}>
      <Tag
        className="a-row-main"
        {...(onClick ? { type: "button", onClick } : ({} as any))}
      >
        {icon && <AIcon name={icon} size={20} />}
        <div className="a-row-label">
          <span>{title}</span>
          {description && <small>{description}</small>}
        </div>
        {trailing ??
          (onClick ? <AIcon name="chevron_right_outline" size={14} /> : null)}
      </Tag>
      {children && <div className="a-row-content">{children}</div>}
    </div>
  );
}
export function Page({
  title,
  onBack,
  actions,
  children,
}: {
  title: string;
  onBack: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="a-topbar">
        <AButton label="返回" icon="chevron_left_outline" onClick={onBack} />
        <h1>{title}</h1>
        <div className="a-topbar-actions">{actions}</div>
      </header>
      <div className="a-page" key={title}>
        <div className="a-page-inner">{children}</div>
      </div>
    </>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const items = [
            ...ref.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,select,textarea,[tabindex="0"]',
            ),
          ],
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      prior?.isConnected && prior.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="a-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="a-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function RiskDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [checked, setChecked] = useState(false),
    born = useRef(performance.now());
  return (
    <Dialog title="开启完全访问？" onClose={onClose}>
      <p>
        开启后，已启用的工具可以操作电脑、写入文件或执行命令，不再逐次询问。
      </p>
      <label className="a-risk-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        我了解风险，并信任当前任务
      </label>
      <div className="a-dialog-actions">
        <button onClick={onClose}>取消</button>
        <button
          disabled={!checked}
          onClick={() => {
            if (checked && performance.now() - born.current > 300) onConfirm();
          }}
        >
          确认开启
        </button>
      </div>
    </Dialog>
  );
}
export function Menu({
  label,
  trigger,
  children,
  className = "",
}: {
  label: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    anchor = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const r = anchor.current!.getBoundingClientRect(),
      height = panel.current?.offsetHeight ?? 200,
      width = panel.current?.offsetWidth ?? 240;
    setPosition({
      left: Math.max(8, Math.min(innerWidth - width - 8, r.left)),
      top:
        r.bottom + height + 8 < innerHeight
          ? r.bottom + 5
          : Math.max(8, r.top - height - 5),
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        !panel.current?.contains(e.target as Node) &&
        !anchor.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        anchor.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = [
            ...panel.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ],
          i = items.indexOf(document.activeElement as HTMLButtonElement);
        items[
          (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
        ]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  return (
    <>
      <button
        ref={anchor}
        className={className || "a-icon-button"}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            className="a-menu"
            role="menu"
            aria-label={label}
            ref={panel}
            style={position}
            onClick={(e) => {
              if ((e.target as Element).closest("button")) setOpen(false);
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
export function MenuItem({
  children,
  onClick,
  selected = false,
  disabled = false,
  description,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
  description?: string;
  icon?: IconName;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      {icon && <AIcon name={icon} />}
      <span>
        {children}
        {description && <small>{description}</small>}
      </span>
      {selected && <Check className="a-check" size={15} />}
    </button>
  );
}
