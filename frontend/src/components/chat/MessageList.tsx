import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatMessage, ChatSourceCitation } from '../../types/chat';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onViewContext?: (sources: ChatSourceCitation[]) => void;
  activeProjectId?: string | null;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  onViewContext,
  activeProjectId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    userScrolledUpRef.current = scrollHeight - (scrollTop + clientHeight) > 150;
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      userScrolledUpRef.current = false;
    }
    if (!userScrolledUpRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
        <div className="max-w-md w-full">
          <div className="w-16 h-16 rounded-2xl bg-[#141228] border border-[#2e2954] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-purple-950/30">
            <Sparkles className="w-8 h-8 text-purple-accent" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2 tracking-tight">
            PurpleAI Interface
          </h2>
          <p className="text-sm text-slate-400 mb-2 leading-relaxed">
            Interface para modelos locais de IA conectados via Ollama, com suporte a RAG e base de conhecimento personalizada.
          </p>
          <p className="text-xs text-slate-500">
            Selecione um modelo no topo e envie uma mensagem para iniciar uma conversa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto w-full flex flex-col"
    >
      <div className="max-w-4xl w-full mx-auto py-4 px-2 sm:px-4 flex flex-col flex-1">
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          return (
            <MessageItem
              key={message.id}
              message={message}
              isStreaming={isLast && isStreaming && message.role === 'assistant'}
              onViewContext={onViewContext}
              activeProjectId={activeProjectId}
            />
          );
        })}
        <div ref={bottomRef} className="h-4 flex-shrink-0" />
      </div>
    </div>
  );
};
