/**
 * Regression tests for the orchestrator's JSON extraction (parseLastArray /
 * parseLastObject). The balanced-span scanner must skip JSON string literals:
 * worker/orchestrator responses routinely embed code snippets with UNMATCHED
 * brackets inside string values (e.g. a `context` field carrying half an
 * expression). A string-blind scanner desyncs its depth counter there and
 * returns null — the white-box pipeline then reports "no queries were
 * generated" even though the model answered correctly.
 */

import { describe, expect, it } from 'vitest';

import { parseLastArray, parseLastObject } from '../orchestration/orchestrator.js';

describe('parseLastArray', () => {
  it('parses a bare JSON array', () => {
    expect(parseLastArray('[{"query":"abcdefgh"}]')).toEqual([{ query: 'abcdefgh' }]);
  });

  it('parses a fenced array with a prose prefix', () => {
    const text = 'Hello via Bun!\n```json\n[{"query":"check auth gate","purpose":"x"}]\n```';
    expect(parseLastArray(text)).toEqual([{ query: 'check auth gate', purpose: 'x' }]);
  });

  it('ignores unmatched brackets inside string values', () => {
    const text =
      '```json\n[\n  {\n    "query": "inspect handler params",\n' +
      '    "context": "const u = new URL(req.url); items[0] && arr[i` weird ] tail"\n  }\n]\n```';
    const parsed = parseLastArray(text);
    expect(parsed).toHaveLength(1);
    expect((parsed![0] as Record<string, unknown>).query).toBe('inspect handler params');
  });

  it('handles escaped quotes inside strings', () => {
    const text = '[{"query":"uses \\"admin\\" role ] here","purpose":"y"}]';
    expect(parseLastArray(text)).toEqual([{ query: 'uses "admin" role ] here', purpose: 'y' }]);
  });

  it('returns null when there is no parseable array', () => {
    expect(parseLastArray('no json here [ at all')).toBeNull();
  });
});

describe('parseLastObject', () => {
  it('parses a fenced object with unmatched braces inside strings', () => {
    const text =
      'here is the synthesis:\n```json\n{"findings": [], "attackSurfaceModel": "brace } in string { here", "confidence": 0.3}\n```';
    const parsed = parseLastObject(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.attackSurfaceModel).toBe('brace } in string { here');
  });

  it('returns null when there is no parseable object', () => {
    expect(parseLastObject('just prose')).toBeNull();
  });
});
