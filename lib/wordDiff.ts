export type WordVerdict = {
  /** For speaking, the literal expected-sentence token (not a resolved vocabItem) — matches translationGrader's shape for shared rendering. */
  vocabWord: string;
  /** Same as vocabWord here (both already come from the literal sentence text) — used for inline highlighting. */
  sentenceText: string;
  userSaid: string | null;
  verdict: "correct" | "acceptable" | "wrong" | "missing";
  note: string | null;
};

function normalizeToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:"'()«»]/g, "");
}

type RawOp = { type: "equal"; e: string; t: string } | { type: "delete"; e: string } | { type: "insert"; t: string };

/** Word-level LCS diff over normalized tokens (accents/case/punctuation stripped for comparison only). */
function diffTokens(e: string[], t: string[]): RawOp[] {
  const ne = e.map(normalizeToken);
  const nt = t.map(normalizeToken);
  const n = e.length;
  const m = t.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = ne[i] === nt[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: RawOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ne[i] === nt[j]) {
      ops.push({ type: "equal", e: e[i], t: t[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "delete", e: e[i] });
      i++;
    } else {
      ops.push({ type: "insert", t: t[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "delete", e: e[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: "insert", t: t[j] });
    j++;
  }
  return ops;
}

/**
 * Aligns a transcript against the sentence it was supposed to reproduce
 * verbatim — speaking practice has no room for paraphrase, unlike writing/
 * listening, so a plain lexical diff (not an LLM's semantic judgment) is
 * the right tool here. An adjacent delete+insert pair is merged into one
 * "wrong" substitution rather than shown as separate missing/extra words;
 * a stray insert with no paired delete (an extra word with no expected
 * counterpart) has nothing to anchor to in this expected-anchored list and
 * is dropped.
 */
export function alignTranscriptToExpected(transcript: string, expected: string): WordVerdict[] {
  const e = expected.split(/\s+/).filter(Boolean);
  const t = transcript.split(/\s+/).filter(Boolean);
  const ops = diffTokens(e, t);

  const words: WordVerdict[] = [];
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.type === "equal") {
      words.push({ vocabWord: op.e, sentenceText: op.e, userSaid: op.t, verdict: "correct", note: null });
    } else if (op.type === "delete") {
      const next = ops[k + 1];
      if (next?.type === "insert") {
        words.push({ vocabWord: op.e, sentenceText: op.e, userSaid: next.t, verdict: "wrong", note: null });
        k++;
      } else {
        words.push({ vocabWord: op.e, sentenceText: op.e, userSaid: null, verdict: "missing", note: null });
      }
    }
  }
  return words;
}
