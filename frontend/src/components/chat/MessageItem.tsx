import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, Sparkles } from 'lucide-react';
import { ChatMessage, ChatSourceCitation } from '../../types/chat';
import { CodeBlock } from './CodeBlock';
import { FileActionCard } from './FileActionCard';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onViewContext?: (sources: ChatSourceCitation[]) => void;
  activeProjectId?: string | null;
}

export const MessageItem: React.FC<MessageItemProps> = memo(({ message, isStreaming, onViewContext, activeProjectId }) => {
  const isUser = message.role === 'user';
  const [copiedMessage, setCopiedMessage] = React.useState(false);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
    }
  };

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="w-full flex justify-end px-2 sm:px-4 md:px-6 my-3 group">
        <div className="flex flex-row-reverse items-start gap-2.5 max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]">
          <div className="flex-shrink-0 pt-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6d28d9] to-[#a855f7] flex items-center justify-center text-white shadow-md shadow-purple-900/40">
              <User className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex flex-col items-end min-w-0">
            <div className="flex items-center gap-2 mb-1 px-1">
              <button
                onClick={handleCopyText}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity p-0.5 rounded"
                title="Copiar texto"
              >
                {copiedMessage ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <span className="text-[11px] font-mono text-slate-500">{formattedTime}</span>
              <span className="text-xs font-semibold text-purple-300">Você</span>
            </div>

            <div className="relative rounded-2xl rounded-tr-sm bg-gradient-to-br from-[#271447] via-[#20113b] to-[#170c2c] border border-[#532b9b]/60 px-4 py-3 shadow-lg shadow-purple-950/30 text-slate-100">
              <div className="whitespace-pre-wrap font-sans text-[14.5px] leading-relaxed break-words selection:bg-purple-800 selection:text-white">
                {message.content}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-start px-2 sm:px-4 md:px-6 my-4 group">
      <div className="flex flex-row items-start gap-3 max-w-[95%] sm:max-w-[90%] lg:max-w-[85%]">
        <div className="flex-shrink-0 pt-1">
          <div className="w-8 h-8 rounded-lg bg-[#121024] border border-[#2e2954] flex items-center justify-center text-purple-vivid shadow-md shadow-purple-950/50">
            <Bot className="w-4 h-4 text-purple-accent" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Assistente</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
                IA
              </span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">{formattedTime}</span>
            <button
              onClick={handleCopyText}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity p-0.5 rounded ml-auto"
              title="Copiar resposta inteira"
            >
              {copiedMessage ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {message.sources && message.sources.length > 0 && (
            <div className="mb-3 p-2.5 rounded-xl bg-[#110f24] border border-[#2f2858] flex flex-wrap items-center justify-between gap-2 text-xs select-none">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-purple-300 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-purple-accent" />
                  <span>Conhecimento utilizado:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {message.sources.map((src, i) => (
                    <span
                      key={src.id || i}
                      className="px-2 py-0.5 rounded-md bg-[#1b1736] border border-[#3a3169] text-[11px] font-mono text-slate-300 inline-flex items-center gap-1.5"
                    >
                      <span className="font-sans font-medium text-slate-200">{src.sourceTitle}</span>
                      {src.pageNumber && <span className="text-purple-300">p.{src.pageNumber}</span>}
                      {src.startLine && <span className="text-purple-300">L{src.startLine}-{src.endLine}</span>}
                      {src.language && (
                        <span className="px-1 py-0.2 rounded bg-purple-900/60 text-[9px] text-purple-300 uppercase font-mono">
                          {src.language}
                        </span>
                      )}
                      {src.score !== undefined && (
                        <span className="text-emerald-400 text-[10px] font-mono">
                          {Math.round(src.score * 100)}%
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => onViewContext?.(message.sources!)}
                className="text-[11px] font-semibold text-purple-accent hover:text-purple-glow hover:underline transition-colors ml-auto"
              >
                Ver contexto ({message.sources.length})
              </button>
            </div>
          )}

          <div className="rounded-2xl rounded-tl-sm bg-[#0e0d1c] border border-[#232042] px-5 py-4 shadow-xl shadow-black/40 text-slate-200">
            <div className="prose-dark text-[14.5px] leading-relaxed break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-([^\s]+)/.exec(className || '');
                    const rawTag = match ? match[1] : '';
                    let codeString = String(children).replace(/\n$/, '');

                    let detectedFilePath: string | null = null;
                    let detectedLang: string | undefined = undefined;

                    if (rawTag.startsWith('file:')) {
                      detectedFilePath = rawTag.slice(5).trim();
                    } else if (rawTag.includes(':')) {
                      const [lang, ...rest] = rawTag.split(':');
                      detectedLang = lang;
                      detectedFilePath = rest.join(':').trim();
                    } else {
                      detectedLang = rawTag || undefined;
                      const firstLineMatch = codeString.match(/^(?:\/\/|#|\/\*)\s*(?:file|filepath|path):\s*([^\r\n*]+)(?:\*\/)?(?:\r?\n|$)/i);
                      if (firstLineMatch) {
                        detectedFilePath = firstLineMatch[1].trim();
                        codeString = codeString.slice(firstLineMatch[0].length);
                      }
                    }

                    if (!inline && detectedFilePath) {
                      return (
                        <FileActionCard
                          filePath={detectedFilePath}
                          language={detectedLang}
                          code={codeString}
                          activeProjectId={activeProjectId}
                        />
                      );
                    }

                    if (!inline && (match || codeString.includes('\n'))) {
                      return (
                        <CodeBlock
                          language={detectedLang}
                          value={codeString}
                        />
                      );
                    }

                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  a({ href, children, ...props }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>

              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-purple-accent animate-pulse align-middle" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
