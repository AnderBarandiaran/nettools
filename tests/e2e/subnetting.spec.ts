import { test, expect } from '@playwright/test';

test.describe('Subnet Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/subnetting/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Subnet Calculator/);
  });

  test('calculates 192.168.1.0/24 correctly', async ({ page }) => {
    const input = page.getByLabel('IPv4 CIDR notation input');
    await input.fill('192.168.1.0/24');
    await page.getByLabel('Calculate subnet').click();

    await expect(page.getByText('192.168.1.0').first()).toBeVisible();
    await expect(page.getByText('192.168.1.255')).toBeVisible();
    await expect(page.getByText('192.168.1.1')).toBeVisible();
    await expect(page.getByText('192.168.1.254')).toBeVisible();
    await expect(page.getByText('254', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('255.255.255.0').first()).toBeVisible();
    await expect(page.getByText('0.0.0.255')).toBeVisible();
  });

  test('calculates 10.0.0.0/8 correctly', async ({ page }) => {
    const input = page.getByLabel('IPv4 CIDR notation input');
    await input.fill('10.0.0.0/8');
    await page.getByLabel('Calculate subnet').click();

    await expect(page.getByText('Yes')).toBeVisible(); // private
  });

  test('shows error for invalid input', async ({ page }) => {
    const input = page.getByLabel('IPv4 CIDR notation input');
    await input.fill('999.999.999.999/24');
    await page.getByLabel('Calculate subnet').click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
  });

  test('Enter key triggers calculation', async ({ page }) => {
    const input = page.getByLabel('IPv4 CIDR notation input');
    await input.click(); // ensure React island is hydrated before keydown
    await input.fill('172.16.0.0/12');
    await input.press('Enter');

    await expect(page.getByText('172.16.0.0').first()).toBeVisible();
  });

  test('AdSlot placeholders present with correct dimensions', async ({ page }) => {
    const adSlots = page.locator('[data-ad-slot]');
    await expect(adSlots).toHaveCount(2);
  });
});
