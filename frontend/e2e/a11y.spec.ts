import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TZ = 'America/Los_Angeles';
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ });
const demo = async (page: Page, who: 'Patient' | 'Receptionist' | 'Doctor' | 'Admin') => {
  await page.goto('/login');
  await page.getByRole('button', { name: who, exact: true }).click();
};

/** Real-browser scan, including colour contrast. Only serious and critical issues fail the build. */
async function scan(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  // Entrance animations fade content in; measure colours once everything has settled.
  test.use({ reducedMotion: 'reduce' });

  test('signed-out pages', async ({ page }) => {
    await page.goto('/login'); await scan(page, 'login');
    await page.goto('/register'); await scan(page, 'register');
  });

  test('patient pages', async ({ page }) => {
    await demo(page, 'Patient');
    await expect(page.getByRole('heading', { name: 'My care' })).toBeVisible();
    await scan(page, 'patient home');
    await page.getByRole('link', { name: 'Book an appointment' }).click();
    await expect(page.getByTestId('doctor-card').first()).toBeVisible();
    await scan(page, 'book: doctors');
    await page.getByTestId('doctor-card').first().click();
    await expect(page.getByRole('group', { name: 'Choose a day' })).toBeVisible();
    await scan(page, 'book: slots');
  });

  test('staff schedule, calendar and list', async ({ page }) => {
    await demo(page, 'Receptionist');
    await page.getByLabel('Date').fill(tomorrow);
    await expect(page.getByRole('group', { name: /Schedule for/ })).toBeVisible();
    await scan(page, 'reception calendar');
    await page.getByRole('radio', { name: 'List' }).click();
    await scan(page, 'reception list');
  });

  test('admin pages', async ({ page }) => {
    await demo(page, 'Admin');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan(page, 'admin users');
    await page.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await scan(page, 'audit log');
  });

  test('keyboard: skip link is the first stop and the view toggle works without a mouse', async ({ page }) => {
    await demo(page, 'Receptionist');
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to/i })).toBeFocused();
    await page.getByRole('radio', { name: 'Calendar' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'List' })).toBeChecked();
  });
});
