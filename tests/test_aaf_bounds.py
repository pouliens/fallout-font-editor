import os
from playwright.sync_api import sync_playwright

def test_aaf_out_of_bounds():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load app.js directly from disk into a blank page
        # This allows us to test the AAFFile class in isolation without a running server
        app_js_path = os.path.abspath("app.js")
        page.add_script_tag(path=app_js_path)

        # Capture console messages
        warnings = []
        page.on("console", lambda msg: warnings.append(msg.text) if msg.type == "warning" else None)

        # Execute JS to test AAFFile out of bounds
        result = page.evaluate("""() => {
            // Header (8 bytes)
            const headerSize = 8;
            const tableSize = 256 * 8;
            const buffer = new ArrayBuffer(headerSize + tableSize); // Header + Table, no data
            const view = new DataView(buffer);

            // Set some header values
            view.setUint16(0, 10, false); // maxHeight
            view.setUint16(2, 1, false);  // hGap
            view.setUint16(4, 4, false);  // spaceWidth
            view.setUint16(6, 2, false);  // vGap

            // Set glyph 0 to be out of bounds
            // Table entry: Width(2), Height(2), Offset(4)
            view.setUint16(8, 5, false);    // Width 5
            view.setUint16(10, 5, false);   // Height 5
            view.setUint32(12, 100, false); // Offset 100 relative to dataStart (8 + 2048)

            // dataStart = 2056.
            // realOffset = 2056 + 100 = 2156.
            // size = 5 * 5 = 25.
            // realOffset + size = 2181 > buffer.byteLength (2056).

            const aaf = new AAFFile(buffer);
            const glyph0 = aaf.glyphs[0];
            return {
                glyphCount: aaf.glyphs.length,
                glyph0: {
                    width: glyph0.width,
                    height: glyph0.height,
                    dataLength: glyph0.data.length,
                    isAllZeros: Array.from(glyph0.data).every(v => v === 0)
                }
            };
        }""")

        assert any("Glyph 0 data out of bounds" in w for w in warnings), f"Expected 'Glyph 0 data out of bounds' warning in {warnings}"
        assert result["glyphCount"] == 256
        assert result["glyph0"]["width"] == 5
        assert result["glyph0"]["height"] == 5
        assert result["glyph0"]["dataLength"] == 25
        assert result["glyph0"]["isAllZeros"] is True

        print("Test AAF out of bounds passed!")
        browser.close()

if __name__ == "__main__":
    test_aaf_out_of_bounds()
