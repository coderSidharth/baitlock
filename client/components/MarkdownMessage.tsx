"use client";
import React from "react";

interface MarkdownMessageProps {
    content: string;
    isUser?: boolean;
}

export default function MarkdownMessage({ content, isUser = false }: MarkdownMessageProps) {
    if (!content) return null;
    if (isUser) {
        return <p className="whitespace-pre-wrap">{content}</p>;
    }

    const elements = parseMarkdown(content);
    return <div className="space-y-2.5 text-sm leading-relaxed text-zinc-100">{elements}</div>;
}

function parseMarkdown(text: string): React.ReactNode[] {
    const lines = text.split("\n");
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 1. Code Block (```)
        if (line.trim().startsWith("```")) {
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            nodes.push(
                <pre key={`code-${i}`} className="p-3 my-2 rounded-lg bg-black/60 border border-white/10 font-mono text-xs text-blue-200 overflow-x-auto">
                    <code>{codeLines.join("\n")}</code>
                </pre>
            );
            i++;
            continue;
        }

        // 2. Table detection (| col | col |)
        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
                tableLines.push(lines[i].trim());
                i++;
            }

            if (tableLines.length >= 2) {
                const headerCells = tableLines[0]
                    .slice(1, -1)
                    .split("|")
                    .map((c) => c.trim());
                
                // Check if second row is separator like |---|---|
                const hasSeparator = tableLines[1].replace(/[\s\-|:]/g, "").length === 0;
                const dataRowLines = hasSeparator ? tableLines.slice(2) : tableLines.slice(1);

                nodes.push(
                    <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-white/15 bg-black/30 shadow-md">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-blue-950/60 border-b border-white/15 text-white/90">
                                    {headerCells.map((h, idx) => (
                                        <th key={idx} className="py-2 px-3 font-semibold tracking-wider uppercase text-[11px] text-blue-300">
                                            {renderInline(h)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-inter">
                                {dataRowLines.map((rowStr, rIdx) => {
                                    const cells = rowStr
                                        .slice(1, -1)
                                        .split("|")
                                        .map((c) => c.trim());
                                    return (
                                        <tr key={rIdx} className="hover:bg-white/5 transition-colors even:bg-white/[0.02]">
                                            {cells.map((c, cIdx) => (
                                                <td key={cIdx} className="py-2 px-3 text-zinc-200">
                                                    {renderInline(c)}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
                continue;
            }
        }

        // 3. Headings
        if (line.startsWith("### ")) {
            nodes.push(
                <h4 key={`h3-${i}`} className="text-base font-bold text-blue-300 pt-2 pb-0.5 tracking-tight flex items-center gap-1.5">
                    {renderInline(line.slice(4))}
                </h4>
            );
            i++;
            continue;
        }
        if (line.startsWith("## ")) {
            nodes.push(
                <h3 key={`h2-${i}`} className="text-lg font-bold text-white pt-2.5 pb-1 border-b border-white/10 tracking-tight">
                    {renderInline(line.slice(3))}
                </h3>
            );
            i++;
            continue;
        }
        if (line.startsWith("# ")) {
            nodes.push(
                <h2 key={`h1-${i}`} className="text-xl font-bold text-white pt-3 pb-1 tracking-tight">
                    {renderInline(line.slice(2))}
                </h2>
            );
            i++;
            continue;
        }

        // 4. Bullet lists (- or * or numbered 1.)
        if (/^(\s*[-*]|\s*\d+\.)\s+/.test(line)) {
            const listItems: { text: string; isOrdered: boolean }[] = [];
            while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s+/.test(lines[i])) {
                const current = lines[i];
                const isOrdered = /^\s*\d+\.\s+/.test(current);
                const itemContent = current.replace(/^(\s*[-*]|\s*\d+\.)\s+/, "");
                listItems.push({ text: itemContent, isOrdered });
                i++;
            }

            nodes.push(
                <ul key={`list-${i}`} className="space-y-1.5 my-2 pl-4 list-none">
                    {listItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-zinc-200">
                            <span className="text-blue-400 mt-1 shrink-0 text-xs">{item.isOrdered ? `${idx + 1}.` : "•"}</span>
                            <span className="flex-1">{renderInline(item.text)}</span>
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // 5. Empty line
        if (!line.trim()) {
            i++;
            continue;
        }

        // 6. Regular Paragraph
        nodes.push(
            <p key={`p-${i}`} className="text-zinc-200 leading-relaxed">
                {renderInline(line)}
            </p>
        );
        i++;
    }

    return nodes;
}

function renderInline(text: string): React.ReactNode {
    if (!text) return null;

    // Pattern for inline elements: `code`, **bold**, *italic*, [link](url)
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
        if (!part) return null;

        // Code
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return (
                <code key={index} className="px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 font-mono text-xs border border-blue-500/30">
                    {part.slice(1, -1)}
                </code>
            );
        }

        // Bold
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return (
                <strong key={index} className="font-semibold text-white">
                    {part.slice(2, -2)}
                </strong>
            );
        }

        // Italic
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
                <em key={index} className="italic text-zinc-300">
                    {part.slice(1, -1)}
                </em>
            );
        }

        // Links [text](url)
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            return (
                <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition-colors">
                    {linkMatch[1]}
                </a>
            );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
}
