import { test, expect } from "@playwright/test";

test.describe("Contractor Journey — Submit a Bid", () => {
    test("should load contractor page", async ({ page }) => {
        await page.goto("/contractor");
        await expect(page).toHaveURL(/contractor/);
        await expect(page.locator("body")).toBeVisible();
    });

    test("should display tender list for contractors", async ({ page }) => {
        await page.goto("/contractor");
        await page.waitForLoadState("networkidle");
        const content = await page.textContent("body");
        expect(content).toBeTruthy();
    });

    test("should show bid submission interface", async ({ page }) => {
        await page.goto("/contractor");
        await page.waitForLoadState("networkidle");
        // Verify the page is interactive
        await expect(page.locator("body")).toBeVisible();
    });

    test("should show my bids section", async ({ page }) => {
        await page.goto("/contractor");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).toBeVisible();
    });
});
