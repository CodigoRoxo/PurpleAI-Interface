export interface DiffLine {
  type: ' ' | '+' | '-' | '@';
  text: string;
}

const MAX_LCS_CELLS = 4_000_000;
const CONTEXT_LINES = 3;
const MAX_OUTPUT_LINES = 400;

/**
 * Diff de linhas (LCS) entre dois textos, no formato de hunks com 3 linhas de contexto.
 * Prefixo e sufixo comuns são removidos antes, então edições pontuais em arquivos grandes são baratas.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : before.replace(/\r\n/g, '\n').split('\n');
  const b = after === '' ? [] : after.replace(/\r\n/g, '\n').split('\n');

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) suffix++;

  const midA = a.slice(prefix, a.length - suffix);
  const midB = b.slice(prefix, b.length - suffix);

  const ops: Array<{ type: ' ' | '+' | '-'; text: string; lineA: number }> = [];
  for (let i = 0; i < prefix; i++) ops.push({ type: ' ', text: a[i], lineA: i + 1 });

  if (midA.length * midB.length <= MAX_LCS_CELLS) {
    const n = midA.length;
    const m = midB.length;
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        ops.push({ type: ' ', text: midA[i], lineA: prefix + i + 1 });
        i++;
        j++;
      } else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) {
        // Remoções antes das adições, como no git diff
        ops.push({ type: '-', text: midA[i], lineA: prefix + i + 1 });
        i++;
      } else {
        ops.push({ type: '+', text: midB[j], lineA: prefix + i + 1 });
        j++;
      }
    }
  } else {
    midA.forEach((text, idx) => ops.push({ type: '-', text, lineA: prefix + idx + 1 }));
    midB.forEach(text => ops.push({ type: '+', text, lineA: prefix + midA.length + 1 }));
  }

  for (let i = a.length - suffix; i < a.length; i++) ops.push({ type: ' ', text: a[i], lineA: i + 1 });

  // Mantém só as mudanças e o contexto ao redor
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.type === ' ') return;
    for (let k = Math.max(0, idx - CONTEXT_LINES); k <= Math.min(ops.length - 1, idx + CONTEXT_LINES); k++) keep[k] = true;
  });

  const result: DiffLine[] = [];
  let previousKept = -2;
  for (let idx = 0; idx < ops.length; idx++) {
    if (!keep[idx]) continue;
    if (idx !== previousKept + 1) result.push({ type: '@', text: `linha ${ops[idx].lineA}` });
    result.push({ type: ops[idx].type, text: ops[idx].text });
    previousKept = idx;
    if (result.length >= MAX_OUTPUT_LINES) {
      result.push({ type: '@', text: '... diff truncado' });
      break;
    }
  }
  return result;
}

export function countChanges(diff: DiffLine[]): { added: number; removed: number } {
  return {
    added: diff.filter(l => l.type === '+').length,
    removed: diff.filter(l => l.type === '-').length,
  };
}
