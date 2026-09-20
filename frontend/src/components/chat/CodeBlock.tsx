import React, { useState, useMemo } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import hljs from 'highlight.js';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const cleanLang = useMemo(() => {
    if (!language) return 'text';
    const l = language.toLowerCase().trim();
    if (l === 'asm' || l === 'assembly' || l === 'nasm' || l === 'masm' || l === 'x86' || l === 'x64') {
      return 'x86asm';
    }
    if (l === 'c++') return 'cpp';
    if (l === 'c#') return 'csharp';
    if (l === 'js') return 'javascript';
    if (l === 'ts') return 'typescript';
    if (l === 'py') return 'python';
    if (l === 'sh') return 'bash';
    if (l === 'ps1') return 'powershell';
    return l;
  }, [language]);

  const highlightedCode = useMemo(() => {
    const codeToHighlight = value.replace(/\n$/, '');
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        return hljs.highlight(codeToHighlight, { language: cleanLang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(codeToHighlight).value;
    } catch {
      return codeToHighlight
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [value, cleanLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-[#272445] bg-[#090814] shadow-lg group">
      <div className="flex items-center justify-between px-4 py-2 bg-[#121024] border-b border-[#221e3f] select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-purple-accent" />
          <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">
            {cleanLang || 'código'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded transition-all duration-150 ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-100 hover:bg-[#1e1b38] border border-transparent'
          }`}
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>

      <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed selection:bg-purple-900/60 selection:text-white">
        <pre className="m-0 p-0">
          <code
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            className={`hljs language-${cleanLang}`}
          />
        </pre>
      </div>
    </div>
  );
};
