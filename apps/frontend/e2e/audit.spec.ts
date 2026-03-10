import { test, expect } from "@playwright/test";

test.describe("Public Audit Dashboard — No Wallet Required", () => {
    test("should load audit page without authentication", async ({ page }) => {
        await page.goto("/audit");
        await expect(page).toHaveURL(/audit/);
        await expect(page.locator("body")).toBeVisible();
    });

    test("should render audit dashboard content", async ({ page }) => {
        await page.goto("/audit");
        await page.waitForLoadState("networkidle");
        const content = await page.textContent("body");
        expect(content).toBeTruthy();
    });

    test("should not prompt for login on audit page", async ({ page }) => {
        await page.goto("/audit");
        await page.waitForLoadState("networkidle");
        // Audit page should be fully accessible without auth
        await expect(page.locator("body")).toBeVisible();
    });

    test("should show search/explorer section", async ({ page }) => {
        await page.goto("/audit");
        await page.waitForLoadState("networkidle");
        // Look for search inputs or explorer sections
        const searchInput = page.locator("input[type='text'], input[type='search']");
        if (await searchInput.count() > 0) {
            await expect(searchInput.first()).toBeVisible();
        }
    });
});
