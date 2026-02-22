
class AAFFile {
    constructor(buffer) {
        this.buffer = buffer;
        this.glyphs = [];
        this.parse();
    }

    parse() {
        const view = new DataView(this.buffer);

        // Header (8 bytes, Big Endian)
        // 0x00: MaxHeight (2)
        // 0x02: HGap (2)
        // 0x04: SpaceWidth (2)
        // 0x06: VGap (2)

        if (this.buffer.byteLength < 8) {
            throw new Error("File too small to be a valid AAF file.");
        }

        this.maxHeight = view.getUint16(0, false);
        this.hGap = view.getUint16(2, false);
        this.spaceWidth = view.getUint16(4, false);
        this.vGap = view.getUint16(6, false);

        // Table starts at 0x08 (8)
        // 256 entries. Each entry: Width(2), Height(2), Offset(4)
        // Table size = 256 * 8 = 2048 bytes.
        // Data starts at 8 + 2048 = 2056.
        // Offsets in table are relative to the start of the data block.

        const tableStart = 8;
        const dataStart = tableStart + (256 * 8);

        for (let i = 0; i < 256; i++) {
            const entryOffset = tableStart + (i * 8);
            const width = view.getUint16(entryOffset, false);
            const height = view.getUint16(entryOffset + 2, false);
            const offset = view.getUint32(entryOffset + 4, false);

            const realOffset = dataStart + offset;
            const size = width * height;

            let data = new Uint8Array(0);
            if (size > 0 && realOffset + size <= this.buffer.byteLength) {
                data = new Uint8Array(this.buffer.slice(realOffset, realOffset + size));
            } else if (size > 0) {
                console.warn(`Glyph ${i} data out of bounds`);
                data = new Uint8Array(size); // Empty
            }

            this.glyphs.push({
                width: width,
                height: height,
                data: data
            });
        }
    }

    save() {
        // Calculate new offsets and total size
        let currentOffset = 0;
        const tableBytes = new Uint8Array(256 * 8);
        const tableView = new DataView(tableBytes.buffer);

        const dataChunks = [];

        let maxH = 0;

        for (let i = 0; i < 256; i++) {
            const g = this.glyphs[i];
            if (g.height > maxH) maxH = g.height;

            const size = g.width * g.height;
            // Ensure data size matches
            if (g.data.length !== size) {
                // Resize if needed (should be handled by editor, but safe check)
                const newData = new Uint8Array(size);
                newData.set(g.data.slice(0, size));
                g.data = newData;
            }

            // Set table entry (Big Endian)
            const entryOffset = i * 8;
            tableView.setUint16(entryOffset, g.width, false);
            tableView.setUint16(entryOffset + 2, g.height, false);
            tableView.setUint32(entryOffset + 4, currentOffset, false);

            dataChunks.push(g.data);
            currentOffset += size;
        }

        this.maxHeight = maxH; // Update max height

        // Header (8 bytes, Big Endian)
        const header = new Uint8Array(8);
        const headerView = new DataView(header.buffer);

        headerView.setUint16(0, this.maxHeight, false);
        headerView.setUint16(2, this.hGap, false);
        headerView.setUint16(4, this.spaceWidth, false);
        headerView.setUint16(6, this.vGap, false);

        // Combine all parts
        const totalSize = 8 + tableBytes.length + currentOffset;
        const result = new Uint8Array(totalSize);

        result.set(header, 0);
        result.set(tableBytes, 8);

        let writePos = 8 + tableBytes.length;
        for (const chunk of dataChunks) {
            result.set(chunk, writePos);
            writePos += chunk.length;
        }

        return result.buffer;
    }
}

class Editor {
    constructor() {
        this.aaf = null;
        this.currentGlyphIndex = -1;
        this.currentColor = 9;
        this.zoom = 20; // Pixels per font-pixel

        // DOM Elements
        this.fileInput = document.getElementById('file-input');
        this.downloadBtn = document.getElementById('download-btn');
        this.glyphList = document.getElementById('glyph-list');
        this.canvas = document.getElementById('glyph-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.widthInput = document.getElementById('glyph-width');
        this.heightInput = document.getElementById('glyph-height');
        this.palette = document.getElementById('palette');
        this.currentColorVal = document.getElementById('current-color-val');
        this.currentGlyphInfo = document.getElementById('current-glyph-info');

        this.init();
    }

    init() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.downloadBtn.addEventListener('click', () => this.handleDownload());

        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasDraw(e));
        this.canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) this.handleCanvasDraw(e);
        });

        this.widthInput.addEventListener('change', () => this.updateDimensions());
        this.heightInput.addEventListener('change', () => this.updateDimensions());

        this.createPalette();
    }

    createPalette() {
        const colors = [
            '#000', '#001a00', '#003300', '#004d00', '#006600',
            '#008000', '#009900', '#00b300', '#00cc00', '#00ff00'
        ];

        colors.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'palette-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.value = index;
            swatch.addEventListener('click', () => {
                this.currentColor = index;
                this.currentColorVal.textContent = index;
                document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
            });
            if (index === 9) swatch.classList.add('selected');
            this.palette.appendChild(swatch);
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.aaf = new AAFFile(e.target.result);
                this.renderGlyphList();
                this.selectGlyph(65); // Default to 'A' if possible, or 0
            } catch (err) {
                alert("Error parsing file: " + err.message);
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    renderGlyphList() {
        this.glyphList.innerHTML = '';
        this.aaf.glyphs.forEach((glyph, index) => {
            const item = document.createElement('div');
            item.className = 'glyph-item';

            // Show char if printable
            let label = index.toString();
            if (index >= 32 && index <= 126) {
                label = String.fromCharCode(index);
            }

            item.textContent = label;
            item.dataset.index = index;
            item.addEventListener('click', () => this.selectGlyph(index));
            this.glyphList.appendChild(item);
        });
    }

    selectGlyph(index) {
        if (!this.aaf) return;
        this.currentGlyphIndex = index;
        const glyph = this.aaf.glyphs[index];

        this.widthInput.value = glyph.width;
        this.heightInput.value = glyph.height;
        this.currentGlyphInfo.textContent = `Glyph ${index} (0x${index.toString(16).toUpperCase()})`;

        document.querySelectorAll('.glyph-item').forEach(el => el.classList.remove('selected'));
        const item = this.glyphList.children[index];
        if (item) {
            item.classList.add('selected');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        this.drawCanvas();
    }

    drawCanvas() {
        if (this.currentGlyphIndex === -1) return;
        const glyph = this.aaf.glyphs[this.currentGlyphIndex];

        this.canvas.width = glyph.width * this.zoom;
        this.canvas.height = glyph.height * this.zoom;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid background (optional, maybe just black)
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const colors = [
            '#000', '#001a00', '#003300', '#004d00', '#006600',
            '#008000', '#009900', '#00b300', '#00cc00', '#00ff00'
        ];

        for (let y = 0; y < glyph.height; y++) {
            for (let x = 0; x < glyph.width; x++) {
                const val = glyph.data[y * glyph.width + x];
                if (val > 0) {
                    this.ctx.fillStyle = colors[val] || '#fff';
                    this.ctx.fillRect(x * this.zoom, y * this.zoom, this.zoom, this.zoom);
                }
                // Grid lines
                this.ctx.strokeStyle = '#222';
                this.ctx.strokeRect(x * this.zoom, y * this.zoom, this.zoom, this.zoom);
            }
        }
    }

    handleCanvasDraw(e) {
        if (this.currentGlyphIndex === -1) return;
        const glyph = this.aaf.glyphs[this.currentGlyphIndex];

        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.zoom);
        const y = Math.floor((e.clientY - rect.top) / this.zoom);

        if (x >= 0 && x < glyph.width && y >= 0 && y < glyph.height) {
            glyph.data[y * glyph.width + x] = this.currentColor;
            this.drawCanvas();
        }
    }

    updateDimensions() {
        if (this.currentGlyphIndex === -1) return;
        const glyph = this.aaf.glyphs[this.currentGlyphIndex];

        const newW = parseInt(this.widthInput.value) || 0;
        const newH = parseInt(this.heightInput.value) || 0;

        if (newW === glyph.width && newH === glyph.height) return;

        const newData = new Uint8Array(newW * newH);

        // Copy old data
        const minW = Math.min(glyph.width, newW);
        const minH = Math.min(glyph.height, newH);

        for (let y = 0; y < minH; y++) {
            for (let x = 0; x < minW; x++) {
                newData[y * newW + x] = glyph.data[y * glyph.width + x];
            }
        }

        glyph.width = newW;
        glyph.height = newH;
        glyph.data = newData;

        this.drawCanvas();
    }

    handleDownload() {
        if (!this.aaf) return;
        const buffer = this.aaf.save();
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "modified.aaf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    new Editor();
});
