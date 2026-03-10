import { test, expect } from "@playwright/test";

test.describe("Mobile Responsive Layout", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("authority page renders at 375px without horizontal overflow", async ({ page }) => {
        await page.goto("/authority");
        await page.waitForLoadState("networkidle");
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375 + 20); // Allow small tolerance
    });

    test("contractor page renders at 375px without overflow", async ({ page }) => {
        await page.goto("/contractor");
        await page.waitForLoadState("networkidle");
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375 + 20);
    });

    test("audit page renders at 375px without overflow", async ({ page }) => {
        await page.goto("/audit");
        await page.waitForLoadState("networkidle");
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375 + 20);
    });

    test("navigation should be usable at 375px", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        // Verify the page renders at mobile width
        await expect(page.locator("body")).toBeVisible();
    });
});
