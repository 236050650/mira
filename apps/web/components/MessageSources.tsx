import { ChevronDown } from "lucide-react";
import { useState } from "react";

type MessageSource = {
  sourceId: string;
  scope: string;
  score: number;
  snippet: string;
};

export function MessageSources({ sources }: { sources: MessageSource[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  const scopeLabels: Record<string, string> = {
    persona: "知识",
    memory: "记忆",
    message: "历史",
  };

  return (
    <div className="message-sources">
      <details open={expanded} onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}>
        <summary>
          <ChevronDown
            size={14}
            style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
          />
          <span>引用来源 ({sources.length})</span>
        </summary>
        <div className="sources-list">
          {sources.map((source, idx) => (
            <div key={`${source.sourceId}-${idx}`} className="source-item">
              <div className="source-meta">
                <span className="source-scope" data-scope={source.scope}>
                  {scopeLabels[source.scope] || source.scope}
                </span>
                <span className="source-score">相关度: {(source.score * 100).toFixed(0)}%</span>
              </div>
              <div className="source-snippet">{source.snippet}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
