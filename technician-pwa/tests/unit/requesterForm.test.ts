import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

it('uses Vue-controlled submission and explicit button types', () => {
  const source = readFileSync(new URL('../../src/components/requester/NewRequest.vue', import.meta.url), 'utf8');
  expect(source).toContain('@submit.stop.prevent="submit"');
  const buttons = [...source.matchAll(/<button\b([^>]*)>/g)].map(match => match[1]);
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons.every(attributes => /\btype="(?:button|submit)"/.test(attributes))).toBe(true);
  expect(buttons.filter(attributes => /type="submit"/.test(attributes))).toHaveLength(1);
});
