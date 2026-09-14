"""Reproducible code-drawn brand placeholders; no image dependencies."""
import struct, zlib
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'public'/'icons'
out.mkdir(parents=True,exist_ok=True)
def png(size,path):
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            u,v=x/size,y/size
            mark=(.34<=u<.46 and .26<=v<.74) or (.34<=u<.70 and .62<=v<.74)
            row.extend((180,219,102) if mark else (21,63,55))
        rows.append(row)
    def chunk(t,d):return struct.pack('!I',len(d))+t+d+struct.pack('!I',zlib.crc32(t+d)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
    path.write_bytes(data)
for size in [192,512]:png(size,out/f'icon-{size}.png')
png(512,out/'maskable-512.png')
