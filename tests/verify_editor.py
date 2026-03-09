import os
from playwright.sync_api import sync_playwright, expect

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the editor
        page.goto("http://localhost:8000/index.html")

        # --- Test: Invalid AAF parsing ---

        # Test Case 1: Unit Test AAFFile with empty buffer
        print("Testing AAFFile with 0-byte buffer...")
        error_msg = page.evaluate("""() => {
            try {
                new AAFFile(new ArrayBuffer(0));
                return null;
            } catch (e) {
                return e.message;
            }
        }""")
        assert error_msg == "File too small to be a valid AAF file."

        # Test Case 2: Unit Test AAFFile with 4-byte buffer
        print("Testing AAFFile with 4-byte buffer...")
        error_msg = page.evaluate("""() => {
            try {
                new AAFFile(new ArrayBuffer(4));
                return null;
            } catch (e) {
                return e.message;
            }
        }""")
        assert error_msg == "File too small to be a valid AAF file."

        # Test Case 3: UI Upload of empty file
        print("Testing UI upload of empty.aaf...")
        with page.expect_event("dialog") as dialog_info:
            with page.expect_file_chooser() as fc_info:
                page.click("#file-input")
            file_chooser = fc_info.value
            file_chooser.set_files("tests/fixtures/empty.aaf")

        dialog = dialog_info.value
        assert dialog.type == "alert"
        assert "Error parsing file: File too small to be a valid AAF file." in dialog.message
        dialog.dismiss()

        # --- Test: Valid AAF editing ---

        # Verify title
        expect(page).to_have_title("Fallout 1 AAF Font Editor")

        # Upload file
        # Playwright file chooser
        with page.expect_file_chooser() as fc_info:
            page.click("#file-input")
        file_chooser = fc_info.value
        file_chooser.set_files("tests/fixtures/test.aaf")

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
    run_tests()
