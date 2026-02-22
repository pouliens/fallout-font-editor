import os
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the editor
        page.goto("http://localhost:8000/index.html")

        # Verify title
        expect(page).to_have_title("Fallout 1 AAF Font Editor")

        # Upload file
        # Playwright file chooser
        with page.expect_file_chooser() as fc_info:
            page.click("#file-input")
        file_chooser = fc_info.value
        file_chooser.set_files("test.aaf")

        # Wait for glyph list to populate
        # Glyph 65 should be 'A'
        # The list items are .glyph-item with text 'A' (char code 65)
        # Wait for .glyph-item to exist
        page.wait_for_selector(".glyph-item")

        # Click Glyph 65 ('A')
        # Find element with data-index="65"
        glyph_a = page.locator(".glyph-item[data-index='65']")
        expect(glyph_a).to_be_visible()
        glyph_a.click()

        # Verify canvas is drawn
        # We can check if dimensions input updated to 5x5
        expect(page.locator("#glyph-width")).to_have_value("5")
        expect(page.locator("#glyph-height")).to_have_value("5")

        # Draw something
        # Click on canvas at some position
        canvas = page.locator("#glyph-canvas")
        box = canvas.bounding_box()
        # Click in the middle (2,2)
        # Zoom is 20. 2*20 + 10 = 50.
        page.mouse.click(box['x'] + 50, box['y'] + 50)

        # Take screenshot
        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/editor_screenshot.png")

        print("Verification complete. Screenshot saved.")

        browser.close()

if __name__ == "__main__":
    run()
