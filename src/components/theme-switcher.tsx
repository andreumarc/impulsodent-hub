"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: "system", label: "Auto", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];
  const CurrentIcon = current.Icon;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
        aria-label="Tema"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Tema"
      >
        <CurrentIcon className="w-4 h-4" />
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-40 rounded-lg bg-white border border-gray-200 shadow-lg z-50 py-1 dark:bg-[hsl(222,47%,9%)] dark:border-white/10"
          role="listbox"
        >
          {OPTIONS.map(({ value, label, Icon }) => {
            const isActive = value === theme;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors dark:hover:bg-white/5"
                style={{ color: isActive ? "#00A99D" : undefined }}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{label}</span>
                </span>
                {isActive && <Check className="w-4 h-4" style={{ color: "#00A99D" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
