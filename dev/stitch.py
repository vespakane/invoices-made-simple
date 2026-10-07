# Stitch PNG screenshots side by side at half size: python3 dev/stitch.py out.png a b c   (names without .png, from dev/shots)
import zlib, struct, sys, os
D=os.path.join(os.path.dirname(__file__),'shots')
def read_png(path):
    data=open(path,'rb').read(); pos=8; idat=b''
    while pos<len(data):
        ln=struct.unpack('>I',data[pos:pos+4])[0]; typ=data[pos+4:pos+8]; body=data[pos+8:pos+8+ln]; pos+=12+ln
        if typ==b'IHDR': w,h,bd,ct=struct.unpack('>IIBB',body[:10])
        elif typ==b'IDAT': idat+=body
    raw=zlib.decompress(idat); bpp=4 if ct==6 else 3; stride=w*bpp; rows=[]; prev=bytearray(stride); p=0
    for y in range(h):
        f=raw[p]; p+=1; line=bytearray(raw[p:p+stride]); p+=stride
        for i in range(stride):
            a=line[i-bpp] if i>=bpp else 0; b=prev[i]; c=prev[i-bpp] if i>=bpp else 0
            if f==1: line[i]=(line[i]+a)&255
            elif f==2: line[i]=(line[i]+b)&255
            elif f==3: line[i]=(line[i]+(a+b)//2)&255
            elif f==4:
                pa=abs(b-c); pb=abs(a-c); pc=abs(a+b-2*c)
                pr=a if pa<=pb and pa<=pc else (b if pb<=pc else c); line[i]=(line[i]+pr)&255
        rows.append(bytes(line)); prev=line
    if bpp==3: rows=[b''.join(r[i:i+3]+b'\xff' for i in range(0,len(r),3)) for r in rows]
    return w,h,rows
def write_png(path,w,h,rows):
    raw=b''.join(b'\x00'+r for r in rows)
    def chunk(t,b): return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,6))+chunk(b'IEND',b''))
def sheet(out,names,scale=2):
    imgs=[read_png(os.path.join(D,n+'.png')) for n in names]
    w=sum(i[0]//scale for i in imgs)+8*(len(imgs)-1); h=max(i[1]//scale for i in imgs); rows=[]
    for y in range(h):
        line=bytearray()
        for k,(iw,ih,r) in enumerate(imgs):
            if k: line+=b'\x80\x80\x80\xff'*8
            sy=y*scale
            if sy<ih: src=r[sy]; line+=b''.join(src[x*scale*4:x*scale*4+4] for x in range(iw//scale))
            else: line+=b'\x00\x00\x00\xff'*(iw//scale)
        rows.append(bytes(line))
    write_png(os.path.join(D,out),w,h,rows)
sheet(sys.argv[1], sys.argv[2:])
