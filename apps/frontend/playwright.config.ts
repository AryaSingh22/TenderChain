import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    timeout: 30000,
    retries: 1,
    reporter: [["verbose"]],
    use: {
        baseURL: "http://localhost:3000",
        headless: true,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 10000,
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "desktop-chrome",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "mobile",
            use: {
                ...devices["iPhone 13"],
                viewport: { width: 375, height: 812 },
            },
        },
    ],
    webServer: {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 60000,
    },
});
