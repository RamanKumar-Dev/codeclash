"use client";

import { loadLanguage } from "@uiw/codemirror-extensions-langs";
import { dracula } from "@uiw/codemirror-theme-dracula";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// Dynamically import CodeMirror with no SSR
const CodeMirrorNoSSR = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  height?: string;
  theme?: "dracula" | "light";
  readOnly?: boolean;
  placeholder?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language,
  height = "400px",
  theme = "dracula",
  readOnly = false,
  placeholder,
}: CodeEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div 
        className="w-full h-full bg-gray-900 border border-gray-700 rounded-lg p-4"
        style={{ height }}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <CodeMirrorNoSSR
        value={value}
        onChange={onChange}
        theme={theme === "dracula" ? dracula : undefined}
        extensions={[
          loadLanguage(language as any),
        ]}
        height={height}
        editable={!readOnly}
        placeholder={placeholder}
        className="text-sm font-mono"
      />
    </div>
  );
}

// Language mapping for CodeMirror
export const LANGUAGE_MAPPING = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  cpp: "cpp",
  c: "c",
  rust: "rust",
  go: "go",
  csharp: "csharp",
} as const;

export type SupportedLanguage = keyof typeof LANGUAGE_MAPPING;
