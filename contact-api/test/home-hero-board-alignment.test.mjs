import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../maintenance-site/assets/home-owner-next-approved-20261122.css', import.meta.url), 'utf8');

test('compact desktop hero balances the square board against the adjacent console panel', () => {
  const compact = css.match(/@media \(min-width: 1181px\) and \(max-height: 870px\) \{([\s\S]*?)\n\}/);
  assert.ok(compact, 'compact desktop rules exist');
  assert.match(compact[1], /\.owner-console-body \{[^}]*grid-template-columns: minmax\(0, 1\.12fr\) minmax\(0, 0\.9fr\)/);
  assert.match(compact[1], /\.owner-console-board \{[^}]*aspect-ratio: 1/);
  assert.match(css, /\/\* PR920[^]*?\.owner-console-board \{\s*position: relative;\s*top: 0;/);
  assert.doesNotMatch(compact[1], /grid-template-columns: minmax\(0, min\(60%/);
});
