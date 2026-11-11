import { expect, test, type Browser, type Page } from '@playwright/test';

const TZ = 'America/Los_Angeles';
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ });
const newUser = async (browser: Browser) => (await browser.newContext()).newPage();
const demo = async (page: Page, who: 'Patient' | 'Receptionist' | 'Doctor' | 'Admin') => {
  await page.goto('/login');
  await page.getByRole('button', { name: who, exact: true }).click();
};

test.describe.serial('ClinicQ end-to-end', () => {
  let p1: Page, p2: Page;

  test('patient books the first open time with the first doctor', async ({ browser }) => {
    p1 = await newUser(browser);
    await demo(p1, 'Patient');
    await expect(p1.getByRole('heading', { name: 'My care' })).toBeVisible();
    await p1.getByRole('link', { name: 'Book an appointment' }).click();
    await p1.getByTestId('doctor-card').first().click();
    await p1.getByRole('button', { name: /^\d{1,2}:\d{2} [AP]M$/ }).first().click();
    await p1.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(p1.getByTestId('appointment')).toHaveCount(1);
  });

  test('a second patient registers and joins the waitlist', async ({ browser }) => {
    p2 = await newUser(browser);
    await p2.goto('/register');
    await p2.getByLabel('Full name').fill('Wendy Waiting');
    await p2.getByLabel('Email').fill(`wendy${Date.now()}@e2e.dev`);
    await p2.getByLabel(/Password/).fill('Passw0rd!e2e');
    await p2.getByRole('button', { name: 'Create account' }).click();
    await expect(p2.getByRole('heading', { name: 'My care' })).toBeVisible();
    await p2.getByRole('link', { name: 'Book an appointment' }).click();
    await p2.getByTestId('doctor-card').first().click();
    await p2.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(p2.getByRole('status')).toContainText("You're on the waitlist");
    await p2.getByRole('link', { name: 'My care' }).click();
    await expect(p2.getByTestId('waitlist-entry')).toHaveCount(1);
  });

  test('reception cancels, the waitlisted patient is offered the slot and books it', async ({ browser }) => {
    const rec = await newUser(browser);
    await demo(rec, 'Receptionist');
    await rec.getByLabel('Date').fill(tomorrow);
    const row = rec.getByTestId('schedule-row').filter({ hasText: 'Pat Patient' });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Cancel' }).click();
    await row.getByRole('button', { name: 'Confirm cancel' }).click();
    await expect(rec.getByRole('status')).toContainText('next person on the waitlist');

    await expect(p2.getByTestId('offer')).toBeVisible({ timeout: 20_000 });   // home polls offers every 5s
    await expect(p2.getByTestId('offer')).toContainText('Offer held for');
    await p2.getByRole('button', { name: 'Book it' }).click();
    await expect(p2.getByTestId('appointment')).toHaveCount(1, { timeout: 15_000 });
    await expect(p2.getByTestId('offer')).toHaveCount(0);

    await p1.reload();
    await expect(p1.getByText('No upcoming appointments.')).toBeVisible();
  });

  test('doctor opens the record, saves notes and completes the visit', async ({ browser }) => {
    await p2.getByRole('link', { name: 'My details' }).click();
    await p2.getByLabel('Phone').fill('415-555-0199');
    await p2.getByLabel('Notes for your doctor').fill('Prefers morning visits');
    await p2.getByRole('button', { name: 'Save' }).click();
    await expect(p2.getByRole('status')).toContainText('Saved');

    const doc = await newUser(browser);
    await demo(doc, 'Doctor');
    await doc.getByLabel('Date').fill(tomorrow);
    await doc.getByTestId('doctor-row').filter({ hasText: 'Wendy Waiting' }).click();
    await expect(doc.getByText('415-555-0199')).toBeVisible();
    await doc.getByLabel('Notes', { exact: true }).fill('Follow up in two weeks');
    await doc.getByRole('button', { name: 'Save notes' }).click();
    await expect(doc.getByRole('status')).toContainText('Notes saved');
    await doc.getByRole('button', { name: 'Mark visit complete' }).click();
    await expect(doc.getByText('completed')).toBeVisible();

    const admin = await newUser(browser);
    await demo(admin, 'Admin');
    await admin.getByRole('link', { name: 'Audit log' }).click();
    await expect(admin.getByText('VIEW_PATIENT_RECORD').first()).toBeVisible();
    await expect(admin.getByText('ACCEPT_OFFER').first()).toBeVisible();
    await expect(admin.getByText('415-555-0199')).toHaveCount(0);   // audit never shows patient data
  });

  test('role guards: patients cannot reach staff pages; signed-out users go to login', async ({ browser }) => {
    await p1.goto('/admin');
    await expect(p1).toHaveURL(/\/home$/);
    await p1.goto('/doctor');
    await expect(p1).toHaveURL(/\/home$/);
    const anon = await newUser(browser);
    await anon.goto('/home');
    await expect(anon).toHaveURL(/\/login$/);
  });
});
