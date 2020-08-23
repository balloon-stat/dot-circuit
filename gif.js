'use strict';

const Gif = {
  lzwMin: 4,
  codes: [],
  codePos: 0,
  bitsEaten: 0,
  blockSize: 255,
  codeBlock: null,
  header: null,
  imageDescriptor: null,
  
  init(orgX, orgY, width, height, interval) {
      const part = i => [ i & 0xff, i >>> 8];
      const x = part(orgX);
      const y = part(orgY);
      const w = part(width);
      const h = part(height);
      const d = part(interval);
      const t = this.makeColorTable();
      this.setHeader(t, x, y, w, h, d);
  },
  createBlob(srcs) {
      this.blockSize = 255;
      this.codes = [this.header];
      for (let i = 0, max = srcs.length; i < max; i++) {
          this.codePos = 0;
          this.bitsEaten = 0;
          this.codes.push(this.imageDescriptor);
          this.codeBlock = new Uint8Array(this.blockSize - 1);
          this.encode(srcs[i]);
      }
      this.codes.push(Uint8Array.of(0x3b)); // GIF Trailer
      return new Blob(this.codes, {type: "image/gif"});
  },
  async blobToArray(blob) {
      this.bitsEaten = 0;
      this.blockSize = -1;
      const buf = await blob.arrayBuffer();
      this.codes = new Uint8Array(buf);
      this.codePos = this.header.length;
      return this.decode();
  },
  makeColorTable() {
      const color = Cuit.color;
      const cix = Cuit.colorIndex;
      const size = 1 << this.lzwMin;
      const table = new Uint8Array(size * 3);
      for (let i = 0; i < size; i++) {
          let ch = cix.get(i);
          if (!ch)
              ch = 66;  // 'B' dummy element
          const col = color[ch];
          const j = i * 3;
          table[j+0] = (col             ) >>> 24;
          table[j+1] = (col & 0x00ff0000) >>> 16;
          table[j+2] = (col & 0x0000ff00) >>>  8;
      }
      return table;
  },
  encode(src) {
      const CLR = 1 << this.lzwMin;      
      const END = CLR + 1;
      const ORG = CLR + 2;
      const BitWidth = this.lzwMin + 1;
      const CodeLenCap = CLR << 1;
      let table = [];
      let width = BitWidth;
      let cap = CodeLenCap;
      let j = 0;
      let prev = src[0];
      this.append(width, CLR);
      for (let i = 1, max = src.length; i < max; i++) {
          const xs = src.subarray(j, i+1);
          const n = table.findIndex(ys => this.compare(xs, ys));
          if (n != -1) {
              prev = ORG + n;
              continue;
          }
          this.append(width, prev);
          prev = src[i];
          j = i;

          const m = ORG + table.length;
          if (m >= 0xfff) {
              this.append(width, CLR);
              table = [];
              width = BitWidth;
              cap = CodeLenCap;
              continue;
          }
          if (m >= cap) {
              width++;
              cap <<= 1;
          }
          table.push(xs);
      }
      this.append(width, prev);
      this.append(width, END);

      let size = this.codePos;
      if (this.bitsEaten > 0)
          size++;
      this.codes.push(Uint8Array.of(size));
      this.codes.push(this.codeBlock.subarray(0, size));
      this.codes.push(Uint8Array.of(0));  // Terminator
      this.codeBlock = null;
  },
  compare(xs, ys) {
      if (ys.length != xs.length)
          return false;
      for(let k = 0, max = ys.length; k < max; k++) {
          if (ys[k] != xs[k])
              return false;
      }
      return true;
  },
  append(width, value) {
      const eaten = this.bitsEaten;
      const leavings = 8 - eaten;
      const size = this.blockSize - 1;

      if (width < 1 || width > 12)
          throw new Error("Gif.append() width range over");

      if (this.codePos >= size) {
          this.codes.push(Uint8Array.of(size));
          this.codes.push(this.codeBlock);
          this.codeBlock = new Uint8Array(size);
          this.codePos = 0;
      }

      const i = this.codePos;
      this.codeBlock[i] |= value << eaten;
      if (width < leavings)
          this.bitsEaten += width;
      else {
          this.bitsEaten = 0;
          this.codePos++;
          if (width > leavings)
              this.append(width - leavings, value >>> leavings);
      }
          
  },
  setHeader(colorTable, orgX, orgY, width, height, interval) {
      const sign = [..."GIF89a"].map(s=>s.charCodeAt(0));
      const nscape = [..."NETSCAPE2.0"].map(s=>s.charCodeAt(0));
      this.header = Uint8Array.of(
          // Header
          ...sign,
          // Logical Screen Descriptor
          ...width,   // Screen Width
          ...height,  // Screen Height
          0b11110011, // <Packed Fields>
                      //   Global Color Table Flag
                      //   | Color Resolution
                      //   | |   Sort Flag
                      //   | |   | Size of Global Color Table
                      //   1 111 0 xxx
          2,  // Background Color Index
          0,  // Pixel Aspect Ratio
          
          // Global Color Table
          ...colorTable,
        
          // Application Extension.
          0x21,           // Extension Introducer
          0xff,           // Extension Label
          11,             // Block Size
          ...nscape,      // Application Identifier
                          // Appl. Authentication Code
          3,              // Application Data Size
          1,              // data sub-block index (always 1)
          0, 0,           // unsigned number of repetitions
          0,              // Block Terminator
      );

      this.imageDescriptor = Uint8Array.of(
          // Graphic Control Extension.
          0x21,        // Extension Introducer
          0xf9,        // Graphic Control Label
          4,           // Block Size
          0,           // <Packed Fields>
                       //   Reserved
                       //   |   Disposal Method
                       //   |   |   User Input Flag
                       //   |   |   | Transparent Color Flag
                       //   000 000 0 0
          ...interval, // Delay Time (x 10ms)
          0,           // Transparent Color Index
          0,           // Block Terminator

          // Image Descriptor
          0x2c,        // Image Separator
          ...orgX,     // Image Left Position
          ...orgY,     // Image Top  Position
          ...width,    // Screen Width
          ...height,   // Screen Height
          0b00000000,  // <Packed Fields>
                       //   Local Color Table Flag
                       //   | Interlace Flag
                       //   | | Sort Flag
                       //   | | | Reserved
                       //   | | | |  Size of Local Color Table
                       //   0 0 0 00 000
        
          // Table Based Image Data. 
          this.lzwMin, // LZW Minimum Code Size
      );
  },
  decode() {
      const CLR = 1 << this.lzwMin;      
      const END = CLR + 1;
      const ORG = CLR + 2;
      const BitWidth = this.lzwMin + 1;
      const CodeLenCap = CLR << 1;
      let table = [];
      let width = BitWidth;
      let cap = CodeLenCap;
      let prev = [];
      let outputs = [];

      this.blockSize = this.codePos + 1;
      this.blockSize += this.codes[this.codePos];
      this.codePos++;
      for (;;) {
          let i = ORG + table.length;
          if (i >= cap) {
              width++;
              cap <<= 1;
              continue;
          }
          const data = this.readBits(width);
          switch (data) {
          case -1:
              throw new Error("gif format error");
          case CLR:
              table = [];
              width = BitWidth;
              cap = CodeLenCap;
              prev = [];
              continue;
          case END:
              return outputs;
          default:
              let xs = [data];
              if (data > CLR) {
                  if (data - ORG < table.length)
                      xs = table[data - ORG];
                  else
                      xs = prev.concat(prev[0]);
              }
              outputs.push(...xs);
              if (prev.length)
                  table.push(prev.concat(xs[0]));
              prev = xs;
          }
      }
  },
  readBits(bits) {
      let value = 0;
      let shift = 0;
      let cur = this.readCurByte();
      let eaten = this.bitsEaten;
      while (cur != null) {
          const data = cur >>> eaten;
          const foods = 8 - eaten;
          if (bits < foods) {
              this.bitsEaten = eaten + bits;
              return value | ((data & ((1 << bits) - 1)) << shift)
          }
          eaten = 0;
          this.codePos++;
          value |= (data << shift)
          if (bits == foods) {
              this.bitsEaten = 0;
              return value;
          }
          shift += foods;
          bits -= foods;
          cur = this.readCurByte();
      }
      this.bitsEaten = 0;
      return -1;
  },
  readCurByte() {
      const ix = this.codePos;
      const max = this.blockSize;
      if (ix >= max) {
          const size = this.codes[this.codePos];
          this.blockSize += size + 1;
          if (size == 0) return null;
          this.codePos++;
      }
      return this.codes[this.codePos];
  },
}

