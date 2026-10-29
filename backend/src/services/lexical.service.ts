/**
 * Busca lexical BM25 em memória. Complementa a busca vetorial: embeddings são ótimos
 * para significado, mas fracos com identificadores exatos (IRP_MJ_CREATE, KeAcquireSpinLock,
 * artigos de lei, códigos de erro). O BM25 acerta esses casos pelo termo exato.
 */

const STOPWORDS = new Set([
  // português
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no',
  'nas', 'nos', 'por', 'pra', 'pro', 'para', 'com', 'sem', 'que', 'se', 'e', 'ou', 'mas', 'como',
  'qual', 'quais', 'quando', 'onde', 'porque', 'ao', 'aos', 'isso', 'isto', 'esse', 'essa', 'este',
  'esta', 'eu', 'voce', 'ele', 'ela', 'me', 'meu', 'minha', 'seu', 'sua', 'ser', 'ter', 'tem', 'foi',
  'era', 'sao', 'ja', 'nao', 'sim', 'mais', 'menos', 'muito', 'pode', 'posso', 'fazer', 'faz',
  'funciona', 'sobre', 'entre', 'ate', 'tambem', 'so', 'la', 'aqui', 'ai', 'tipo',
  // inglês
  'the', 'an', 'of', 'to', 'in', 'on', 'for', 'with', 'and', 'or', 'is', 'are', 'was', 'be', 'it',
  'this', 'that', 'how', 'what', 'which', 'when', 'where', 'why', 'do', 'does', 'can', 'by', 'as',
  'at', 'from', 'about', 'into', 'not', 'no', 'yes',
]);

export function tokenize(text: string): string[] {
  const normalized = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tokens: string[] = [];

  for (const raw of normalized.match(/[A-Za-z0-9_]+/g) || []) {
    const whole = raw.toLowerCase();
    if (whole.length < 2 || STOPWORDS.has(whole)) continue;
    tokens.push(whole);

    // Partes de snake_case e camelCase também viram termos (IRP_MJ_CREATE -> irp, mj, create)
    const parts = raw
      .split('_')
      .flatMap(p => p.split(/(?<=[a-z0-9])(?=[A-Z])/))
      .map(p => p.toLowerCase())
      .filter(p => p.length >= 2 && p !== whole && !STOPWORDS.has(p));
    tokens.push(...parts);
  }

  return tokens;
}

export interface LexicalDocument {
  id: string;
  text: string;
}

export class Bm25Index {
  private readonly k1 = 1.2;
  private readonly b = 0.75;
  private postings = new Map<string, Map<number, number>>();
  private docLengths: number[] = [];
  private docIds: string[] = [];
  private avgDocLength = 0;

  constructor(docs: LexicalDocument[]) {
    let totalLength = 0;
    docs.forEach((doc, idx) => {
      const tokens = tokenize(doc.text);
      this.docIds.push(doc.id);
      this.docLengths.push(tokens.length);
      totalLength += tokens.length;

      for (const token of tokens) {
        let posting = this.postings.get(token);
        if (!posting) {
          posting = new Map();
          this.postings.set(token, posting);
        }
        posting.set(idx, (posting.get(idx) || 0) + 1);
      }
    });
    this.avgDocLength = docs.length > 0 ? totalLength / docs.length : 0;
  }

  /** Retorna id -> pontuação BM25 para documentos com ao menos um termo da consulta. */
  search(query: string, allow?: (id: string) => boolean): Map<string, number> {
    const scores = new Map<string, number>();
    const n = this.docIds.length;
    const queryTerms = [...new Set(tokenize(query))];

    for (const term of queryTerms) {
      const posting = this.postings.get(term);
      if (!posting) continue;

      const idf = Math.log(1 + (n - posting.size + 0.5) / (posting.size + 0.5));
      for (const [docIdx, tf] of posting) {
        const id = this.docIds[docIdx];
        if (allow && !allow(id)) continue;

        const lengthNorm = 1 - this.b + this.b * (this.docLengths[docIdx] / (this.avgDocLength || 1));
        const termScore = idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * lengthNorm));
        scores.set(id, (scores.get(id) || 0) + termScore);
      }
    }

    return scores;
  }
}
