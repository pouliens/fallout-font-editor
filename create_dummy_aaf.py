import struct

def create_dummy_aaf(filename):
    # Header (8 bytes, Big Endian)
    # MaxHeight (2)
    # HGap (2)
    # SpaceWidth (2)
    # VGap (2)

    max_height = 10
    h_gap = 1
    space_width = 4
    v_gap = 2

    # Pack header (Big Endian >)
    header = struct.pack(">HHHH", max_height, h_gap, space_width, v_gap)

    # Table & Data
    entries = []
    glyph_data = bytearray()
    current_offset = 0

    for i in range(256):
        if i == 65: # 'A'
            w, h = 5, 5
            # Simple 5x5 block of brightness 9
            data = b'\x09' * (w * h)
            glyph_data.extend(data)
            entries.append((w, h, current_offset))
            current_offset += len(data)
        elif i == 66: # 'B'
            w, h = 4, 6
            data = b'\x05' * (w * h)
            glyph_data.extend(data)
            entries.append((w, h, current_offset))
            current_offset += len(data)
        else:
            entries.append((0, 0, current_offset))

    # Pack table entries: Width(H), Height(H), Offset(L) -> 8 bytes (Big Endian)
    table_bytes = bytearray()
    for w, h, off in entries:
        table_bytes.extend(struct.pack(">HHL", w, h, off))

    with open(filename, "wb") as f:
        f.write(header)
        f.write(table_bytes)
        f.write(glyph_data)

    print(f"Created {filename} with size {len(header) + len(table_bytes) + len(glyph_data)}")

if __name__ == "__main__":
    create_dummy_aaf("test.aaf")
