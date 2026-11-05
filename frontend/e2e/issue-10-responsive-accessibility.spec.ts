import { expect, test, type Page } from "@playwright/test";

const request = "Find a high-protein meal at The Halal Shack.";
const meal = {
  id: "fixture-chicken",
  name: "Fixture Chicken",
  location: "Fixture Dining",
  nutrition: { protein_g: 47 },
};

async function mockReply(page: Page, reply: object) {
  await page.route("**/api/requests/interpret", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: [
        JSON.stringify({ type: "progress" }),
        JSON.stringify({ type: "reply", reply }),
        "",
      ].join("\n"),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
}

test.describe("issue #10 responsive and keyboard-accessible workflow", () => {
  test("keeps request progress readable and prevents another submission", async ({
    page,
  }) => {
    let releaseResponse!: () => void;
    await page.route("**/api/requests/interpret", async (route) => {
      await new Promise<void>((resolve) => {
        releaseResponse = resolve;
      });
      await route.abort();
    });
    await page.goto("/#home");
    await page.getByLabel("Describe your meal").fill(request);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Sending" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Stop response" }),
    ).toBeVisible();
    await expect(page.getByLabel("Describe your meal")).toHaveAttribute(
      "readonly",
      "",
    );
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Stop response" }).click();
    releaseResponse();
  });

  test("completes request and selection by keyboard without horizontal overflow", async ({
    page,
  }) => {
    await mockReply(page, {
      status: "recommended",
      meal,
      explanation: "Verified high-protein match.",
    });
    await page.goto("/#home");

    const input = page.getByLabel("Describe your meal");
    await expect(input).toBeVisible();
    const visibleLabel = page.locator('label[for="meal-description"]');
    await expect(visibleLabel).toBeVisible();
    const labelBox = await visibleLabel.boundingBox();
    expect(labelBox?.width).toBeGreaterThan(80);
    expect(labelBox?.height).toBeGreaterThan(16);
    await input.focus();
    await page.keyboard.type(request);
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("article", {
        name: "Recommendation details for Fixture Chicken",
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Shift+Tab");
    const select = page.getByRole("button", { name: "Select Fixture Chicken" });
    await expect(select).toBeFocused();
    await expect(select).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status", { name: "Meal selection" }),
    ).toContainText("Selected Fixture Chicken");
  });

  test("keeps missing-data details readable without overflow", async ({
    page,
  }) => {
    await mockReply(page, {
      status: "recommended",
      meal: { id: meal.id, name: meal.name, location: meal.location },
      explanation: "Verified menu match with limited details.",
    });
    await page.goto("/#home");
    await page.getByLabel("Describe your meal").fill(request);
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByText("Full nutrition information").click();

    await expect(page.getByText("Not available").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("keeps failure recovery readable without overflow", async ({ page }) => {
    await mockReply(page, {
      status: "recommendation_failed",
      reason: "no_match",
    });
    await page.goto("/#home");
    await page.getByLabel("Describe your meal").fill(request);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(
      page.getByText(/verify a meal that meets your requirements/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit request" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
