"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import remarkGfm from "remark-gfm";

// Dynamically import ReactMarkdown with no SSR
const ReactMarkdownNoSSR = dynamic(() => import("react-markdown"), {
  ssr: false,
});

interface ProblemDisplayProps {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  timeLimit?: number;
  memoryLimit?: number;
  tags?: string[];
  lore?: string;
}

export default function ProblemDisplay({
  title,
  description,
  difficulty,
  timeLimit,
  memoryLimit,
  tags = [],
  lore,
}: ProblemDisplayProps) {
  const [mounted, setMounted] = useState(false);
  const [showLore, setShowLore] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full bg-gray-800 p-6 rounded-lg animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-700 rounded w-4/5"></div>
        </div>
      </div>
    );
  }

  const difficultyColors = {
    easy: "bg-green-600 text-green-100",
    medium: "bg-yellow-600 text-yellow-100",
    hard: "bg-red-600 text-red-100",
  };

  return (
    <div className="h-full bg-gray-800 p-6 rounded-lg overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <Badge className={difficultyColors[difficulty]}>
            {difficulty.toUpperCase()}
          </Badge>
        </div>
        
        {/* Metadata */}
        <div className="flex flex-wrap gap-2 mb-4">
          {timeLimit && (
            <Badge variant="outline" className="border-blue-500 text-blue-400">
              ⏱️ {timeLimit}s
            </Badge>
          )}
          {memoryLimit && (
            <Badge variant="outline" className="border-purple-500 text-purple-400">
              💾 {memoryLimit}MB
            </Badge>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs bg-gray-700 text-gray-300"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Lore Toggle */}
      {lore && (
        <div className="mb-4">
          <button
            onClick={() => setShowLore(!showLore)}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors mb-2"
          >
            {showLore ? "📖 Hide Lore" : "📖 Show Lore"}
          </button>
          {showLore && (
            <Card className="mb-4 bg-purple-900/20 border-purple-700">
              <div className="p-4">
                <div className="text-sm text-purple-300 italic">
                  {lore}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Problem Description */}
      <Card className="bg-gray-900 border-gray-700">
        <div className="p-6">
          <div className="prose prose-invert max-w-none">
            <ReactMarkdownNoSSR remarkPlugins={[remarkGfm]}>
              {description}
            </ReactMarkdownNoSSR>
          </div>
        </div>
      </Card>
    </div>
  );
}
