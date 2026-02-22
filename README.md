# Fallout 1 AAF Font Editor

A web-based editor for Fallout 1 .AAF font files.

## Features

- **Glyph Viewing**: View all glyphs in the font file.
- **Pixel Editing**: Edit individual glyphs pixel by pixel.
- **Dimension Adjustment**: Adjust the width and height of each glyph.
- **Save Changes**: Download the modified .AAF file.

## Usage

1. Open `index.html` in a web browser (or serve it via a local server).
2. Upload a valid `.aaf` file (e.g., run `python3 create_dummy_aaf.py` to generate `test.aaf`).
3. Select a glyph from the sidebar.
4. Edit the glyph on the canvas.
5. Click "Save .aaf" to download the modified file.

## File Format

The AAF file format consists of an 8-byte header followed by a glyph table and the glyph data.
