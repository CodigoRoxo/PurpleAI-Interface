import path from 'path';
import { SourceType } from '../types/knowledge.js';

export interface RawChunk {
  text: string;
  pageNumber?: number;
  chapter?: string;
  filePath?: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  chunkIndex?: number;
}

export class ChunkerService {
  private defaultChunkSize = 1500;
  private defaultOverlap = 200;

  detectLanguage(filePath?: string): string | undefined {
    if (!filePath) return undefined;
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.c': 'c',
      '.h': 'c',
      '.cpp': 'cpp',
      '.hpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.asm': 'assembly',
      '.s': 'assembly',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.ps1': 'powershell',
      '.sh': 'bash',
      '.bat': 'batch',
      '.cmd': 'batch',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.md': 'markdown',
      '.txt': 'text',
    };
    return map[ext] || undefined;
  }

  chunkText(
    text: string,
    meta: { pageNumber?: number; chapter?: string; filePath?: string; language?: string } = {},
    chunkSize = this.defaultChunkSize,
    overlap = this.defaultOverlap
  ): RawChunk[] {
    const cleaned = text.replace(/\r\n/g, '\n').trim();
    if (!cleaned) return [];

    const lang = meta.language || this.detectLanguage(meta.filePath);

    if (cleaned.length <= chunkSize) {
      return [{
        text: cleaned,
        pageNumber: meta.pageNumber,
        chapter: meta.chapter,
        filePath: meta.filePath,
        language: lang,
        chunkIndex: 0,
      }];
    }

    const chunks: RawChunk[] = [];
    const paragraphs = cleaned.split(/\n\s*\n/);
    let currentChunk = '';

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if ((currentChunk + '\n\n' + trimmedPara).length <= chunkSize) {
        currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedPara : trimmedPara;
      } else {
        if (currentChunk) {
          chunks.push({
            text: currentChunk,
            pageNumber: meta.pageNumber,
            chapter: meta.chapter,
            filePath: meta.filePath,
            language: lang,
            chunkIndex: chunks.length,
          });
          const overlapSlice = currentChunk.slice(-overlap);
          currentChunk = overlapSlice + '\n\n' + trimmedPara;
        } else {
          let start = 0;
          while (start < trimmedPara.length) {
            const end = Math.min(start + chunkSize, trimmedPara.length);
            chunks.push({
              text: trimmedPara.slice(start, end),
              pageNumber: meta.pageNumber,
              chapter: meta.chapter,
              filePath: meta.filePath,
              language: lang,
              chunkIndex: chunks.length,
            });
            start += chunkSize - overlap;
          }
          currentChunk = '';
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        pageNumber: meta.pageNumber,
        chapter: meta.chapter,
        filePath: meta.filePath,
        language: lang,
        chunkIndex: chunks.length,
      });
    }

    return chunks;
  }

  chunkPdfPages(pages: Array<{ pageNumber: number; text: string }>, filePath?: string): RawChunk[] {
    const allChunks: RawChunk[] = [];
    const lang = this.detectLanguage(filePath) || 'text';

    for (const page of pages) {
      const pageChunks = this.chunkText(page.text, {
        pageNumber: page.pageNumber,
        filePath,
        language: lang,
      });
      allChunks.push(...pageChunks);
    }

    return allChunks.map((chunk, idx) => ({
      ...chunk,
      chunkIndex: idx,
    }));
  }

  chunkMarkdown(content: string, filePath?: string): RawChunk[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const sections: Array<{ heading: string; text: string; startLine: number; endLine: number }> = [];
    let currentHeading = 'Introdução';
    let currentLines: string[] = [];
    let sectionStart = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          sections.push({
            heading: currentHeading,
            text: currentLines.join('\n'),
            startLine: sectionStart,
            endLine: i,
          });
          currentLines = [];
        }
        currentHeading = headingMatch[2].trim();
        sectionStart = i + 1;
      }
      currentLines.push(line);
    }

    if (currentLines.length > 0) {
      sections.push({
        heading: currentHeading,
        text: currentLines.join('\n'),
        startLine: sectionStart,
        endLine: lines.length,
      });
    }

    const allChunks: RawChunk[] = [];
    for (const sec of sections) {
      const chunks = this.chunkText(sec.text, {
        chapter: sec.heading,
        filePath,
        language: 'markdown',
      });
      for (const c of chunks) {
        c.startLine = sec.startLine;
        c.endLine = sec.endLine;
        allChunks.push(c);
      }
    }

    return allChunks.map((c, idx) => ({ ...c, chunkIndex: idx }));
  }

  chunkCode(content: string, filePath?: string): RawChunk[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const chunks: RawChunk[] = [];
    const linesPerChunk = 60;
    const overlapLines = 10;
    const lang = this.detectLanguage(filePath) || 'code';

    if (lines.length <= linesPerChunk) {
      return [{
        text: content,
        filePath,
        language: lang,
        startLine: 1,
        endLine: lines.length,
        chunkIndex: 0,
      }];
    }

    let i = 0;
    while (i < lines.length) {
      const startLine = i + 1;
      const endLine = Math.min(i + linesPerChunk, lines.length);
      const chunkLines = lines.slice(i, endLine);

      chunks.push({
        text: chunkLines.join('\n'),
        filePath,
        language: lang,
        startLine,
        endLine,
        chunkIndex: chunks.length,
      });

      if (endLine >= lines.length) break;
      i += (linesPerChunk - overlapLines);
    }

    return chunks;
  }

  process(
    content: string,
    type: SourceType,
    meta: { pageNumber?: number; chapter?: string; filePath?: string } = {}
  ): RawChunk[] {
    switch (type) {
      case 'markdown':
        return this.chunkMarkdown(content, meta.filePath);
      case 'code':
        return this.chunkCode(content, meta.filePath);
      default:
        return this.chunkText(content, meta);
    }
  }
}

export const chunkerService = new ChunkerService();
