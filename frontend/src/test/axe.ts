import { expect } from 'vitest';
import { axe } from 'vitest-axe';

/** Runs axe on a rendered container and fails with the list of violations. Colour contrast needs real layout, so the browser tests check it instead. */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
