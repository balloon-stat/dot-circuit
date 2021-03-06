'use strict';

if (!Promise) {
    window.alert("This site needs modern browser");
    throw new Error("Promise object not found");
}

const Srv = {
  async getMaps() {
      const step = document.getElementById('step').value;
      const interval = document.getElementById('interval').value;
      const pixels = document.getElementById('pixels').value;
      const max = parseInt(step, 10);
      const delta = parseInt(interval, 10);
      const magn = parseInt(pixels, 10);
      const c = Cuit.capture();
      const fn = x => Math.ceil(x / Cuit.dpp) * magn;
      const w = fn(c.width);
      const h = fn(c.height);
      const stretch = map => {
          const ret = new Uint8Array(map.byteLength * magn * magn);
          let jj = 0;
          for (let y = 0; y < h; y++) {
              let j = jj;
              for (let x = 0; x < w; x++) {
                  ret[x + y * w] = map[j];
                  if (x % magn == magn - 1)
                      j++;
              }
              if (y % magn == magn - 1)
                  jj = j;
          }
          return ret;
      }
      const maps = [stretch(c.map)];
      for (let i = 0; i < max; i++) {
          await new Promise(resolve => {
              setTimeout(()=> {
                  Cuit.step();
                  Cuit.show();
                  const capt = Cuit.capture();
                  maps.push(stretch(capt.map));
                  resolve();
              }, delta);
          });
      }
      return {w, h, delta, maps};
  },
  async record() {
      const link = document.createElement('a');
      const name = window.prompt("Input title for a download file");
      if (!name) return;
      link.download = name;
      const savedMode = Cuit.mode;
      Cuit.mode = "P";
      Cuit.isRun = false;
      Cuit.msg.textContent = "Recording in progress...";

      const m = await Srv.getMaps();
      Gif.init(0, 0, m.w, m.h, m.delta / 10);
      const blob = Gif.createBlob(m.maps);
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      Cuit.mode = savedMode;
      Cuit.msg.textContent = "Finished recording!";
  },
  write() {
      const link = document.createElement('a');
      const name = window.prompt("Input title for a download file");
      if (!name) return;
      link.download = name;
      
      const canvas = document.getElementById('map');
      Cuit.mapto(canvas);
      canvas.toBlob(blob => {
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
      });
  },
  read() {
      const i = document.createElement('input');
      i.setAttribute("type","file");
      i.setAttribute("accept","image/png");
      i.click();
      i.onchange = () => {
          const r = new FileReader();
          r.onload = () => Cuit.urlToMap(r.result);
          r.readAsDataURL(i.files[0]);
      };
  },
};

const Cuit = {
  mouseIsDown: false,
  dpp: 20,
  width: 600,
  height: 400,
  isRight: false,
  curElem: 67,
  selectedElem: 67,  // 'c' keycode
  mode: 'W',
  offset: { x: 100, y: 0 },
  origin: { x: 1, y: 1 },
  mouse: { x: 0, y: 0 },
  point: { begin: {}, end: {} },
  pos: null, // {x: 0, y: 0, rx: 0, ry: 0},
  timerInterval: 500,
  buttons: {},
  msg: null,
  dppElem: null,
  posElem: null,
  nStep: 0,
  nStepElem: null,
  strColor: {
      C: '#cdcdff',
      J: "#808080",
      I: "#aa00aa",
      O: "#008800",
      V: "#00ffff",
      W: "#ffffff",
      B: "#000000",
      C_on: "#fff88a",
      I_on: "#ff9900",
      O_on: "#ff0000"
  },
  color: {  // rgba
      67:  0xcdcdffff,   // 0100 0011
      74:  0x808080ff,   // 0100 1010
      73:  0xaa00aaff,   // 0100 1001
      79:  0x008800ff,   // 0100 1111
      86:  0x00ffffff,   // 0101 0110
      87:  0xffffffff,   // 0101 0111
      66:  0x00000000,   // 0101 0010
      195: 0xfff88aff,   // 1100 0011
      201: 0xff9900ff,   // 1100 1001
      207: 0xff0000ff    // 1100 1111
  },
  colorIndex:
      new Map([
         [ 0,  67],  // : C   
         [ 1,  74],  // : J   
         [ 2,  73],  // : I   
         [ 3,  79],  // : O   
         [ 4,  86],  // : V   
         [ 5,  87],  // : W   
         [ 6,  66],  // : B   
         [ 8, 195],  // : C_on
         [10, 201],  // : I_on
         [11, 207],  // : O_on
      ]),
  get isRun() {
      if (!Cuit.buttons)
          return false;
      return Cuit.buttons.S.ison;
  },
  set isRun(bool) {
      if (!Cuit.buttons)
          return;
      Cuit.buttons.S.ison = bool;
      Cuit.buttons.S.draw();
  },
  init(canvas) {
      Cuit.ctx = canvas.getContext("2d");
      Cuit.setEvents(canvas);
      Cuit.setButtons();
      Cuit.drawUI(Cuit.ctx);
      Cuit.drawSyms[Cuit.mode]();
  },
  setEvents(canvas) {
      document.onkeydown   = Cuit.keyDown;
      canvas.onmousedown   = Cuit.mouseDown;
      canvas.onmousemove   = Cuit.mouseMove;
      canvas.onmouseup     = Cuit.mouseUp;
      canvas.onmouseleave  = Cuit.mouseLeave;
      canvas.oncontextmenu = e => e.preventDefault();
      canvas.addEventListener('wheel', Cuit.mouseWheel, {passive: false});
  },
  setButtons() {
      const setMode = function() {
          Cuit.mode = this.name
          Cuit.drawSyms[this.name]();
      };
      const btns = [
          { name: 'S', color: "#ffcccc", fcolor: "#ffaa11", toggle: true, func: ()=>{}},
          { name: 'W', color: "#ccffcc", fcolor: "#448844", group: 1, on: true,  func: setMode },
          { name: 'E', color: "#ccffcc", fcolor: "#448844", group: 1, on: false, func: setMode },
          { name: 'R', color: "#ccffcc", fcolor: "#448844", group: 1, on: false, func: setMode },
          { name: '+', color: "#ccccff", fcolor: "#008800", func: Cuit.saveMap },
      ];
      for (let i = 0; i < btns.length; i++)
          Cuit.buttons[btns[i].name] = new Cuit.Button(btns[i]);
  },
  mapto(canvas, width=Cuit.width, height=Cuit.height) {
      canvas.width = width;
      canvas.height = height;
      const wh = canvas.width;
      const ht = canvas.height;
      const ctx = canvas.getContext("2d");
      const map = Cuit.map;
      let idata = ctx.getImageData(0, 0, wh, ht);
      let iarr = idata.data;
      let iview = new DataView(iarr.buffer);
      for (let y = 0; y < ht; y++)
      for (let x = 0; x < wh; x++)
      {
          const n = x + y * Cuit.width;
          const m = x + y * wh;
          const cell = map[n] & 0x007f;
          if (cell == 0)
              throw new Error("cell value is zero");
          iview.setUint32(4*m, this.color[cell]);
      }
      ctx.putImageData(idata, 0, 0);
  },
  async urlToMap(src, width=Cuit.width, height=Cuit.height) {
      return new Promise((resolve, reject) => {
        const canvas = document.getElementById('map');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        const color = Cuit.color;
        let img = new Image();
        img.src = src;
        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            const color = Cuit.color;
            let map = Cuit.newMap();
            let elem = {};
            for (let e in color)
            {
                elem[color[e]] = e;
            }
            let idata = ctx.getImageData(0, 0, width, height);
            let iarr = idata.data;
            let iview = new DataView(iarr.buffer);
            for (let y = 1, ymax = height - 1; y < ymax; y++)
            for (let x = 1, xmax = width - 1; x < xmax; x++)
            {
                const n = x + y * Cuit.width;
                const m = x + y * width;
                const cell = iview.getUint32(4*m);
                map[n] = elem[cell];
                if (map[n] === undefined)
                    throw new Error(`(${x}, ${y}): color is undefined`);
            }
            Cuit.nStep = 0;
            Cuit.map = map;
            resolve();
        };
        img.onerror = stuff => {
            console.log("image onerror:", stuff);
            reject();
        };
      });
  },
  capture() {
      const dpp = Cuit.dpp;
      const ofs = Cuit.offset;
      const cvs = Cuit.ctx.canvas;
      const width = cvs.width - ofs.x;
      const height = cvs.height - ofs.y;
      let idata = Cuit.ctx.getImageData(ofs.x, ofs.y, width, height);
      let iarr = idata.data;
      let iview = new DataView(iarr.buffer);
      let cells = [];
      for (let y = 0; y < height; y += dpp)
      for (let x = 0; x < width; x += dpp)
      {
          const n = x + y * width;
          cells.push(iview.getUint32(4*n));
      }
      const color = Cuit.color;
      const index = Cuit.colorIndex;
      const rev = {};
      for (let [ix, ch] of index)
          rev[color[ch]] = ix;
      const map = Uint8Array.from(cells, c => rev[c]);
      return {width, height, map};
  },
  saveMap() {
      Cuit.msg.textContent = "Circuit saved";
      const s = Uint8Array.from(Cuit.map, e => e & 0x7f);
      const strmap = new TextDecoder().decode(s);
      localStorage.setItem('CuitMap', strmap);

      const ofs = Cuit.offset;
      const cvs = Cuit.ctx.canvas;
      const p = Cuit.dpp;
      const o = Cuit.origin;
      const w = Math.ceil((cvs.width - ofs.x) / p);
      const h = Math.ceil((cvs.height - ofs.y) / p);
      const mapdata = Cuit.encodeStrMap(strmap, o.x, o.y, w, h);
      const params = new URLSearchParams({p, mapdata});
      if (o.x != 1)
          params.set("x", o.x);
      if (o.y != 1)
          params.set("y", o.y);
      history.pushState(null, "", "?" + params);
  },
  encodeStrMap(strmap, x0, y0, width, height) {
      const runLength = text => {
          let ret = "";
          let count = 0;
          for (let i = 0, max = text.length; i < max; i++) {
              const cur  = text[i];
              const next = text[i+1];
              if (cur == next)
                  count++;
              else {
                  if (count == 0)
                      ret += cur;
                  else
                      ret += cur + (count + 1);
                  count = 0;
              }
          }
          return ret;
      };
      const ys = []
      const wh = Cuit.width;
      for (let y = y0, max = y0 + height; y < max; y++) {
          const xs = strmap.substr(x0 + y * wh, width);
          ys.push("n" + runLength(xs) + "L");
      }
      return runLength(ys).substr(1);
  },
  decodeStrMap(data, x0=1, y0=1) {
      const map = Cuit.newMap();
      const dataMap = data.split("n");
      const nums = "0123456789";
      let y = 0;
      for (let yi= 0, max = dataMap.length; yi < max; yi++) {
          let [cip, yrepeat] = dataMap[yi].split("L");
          let yrep = 1;
          if (yrepeat)
              yrep = parseInt(yrepeat, 10);
          let x = 0;
          let xs = [];
          while (cip[x]) {
              const cell = cip[x].charCodeAt(0);
              x++;
              let dx = 0;
              while (nums.includes(cip[x + dx]))
                  dx++;
              let xrep = 1;
              if (dx != 0) {
                  xrep = parseInt(cip.substr(x, dx), 10);
              }
              for (let i = 0; i < xrep; i++)
                  xs.push(cell);
              x += dx;
          }
          for (let j = 0; j < yrep; j++) {
              let n = x0 + (y + y0 + j) * Cuit.width;
              for (let i = 0, max = xs.length; i < max; i++)
                  map[n+i] = xs[i];
          }
          y += yrep;
      }
      return map;
  },
  newMap() {
      const max = Cuit.width * Cuit.height;
      const map = new Uint16Array(max);
      map.fill('W'.charCodeAt(0));
      return map;
  },
  readMap(params) {
      if (params.has("mapdata")) {
          Cuit.msg.textContent = "Circuit read from URL";
          Cuit.dpp = parseInt(params.get("p"), 10);
          document.getElementById('wheel').textContent = "×" + Cuit.dpp;
          const x = parseInt(params.get("x") ?? "1", 10);
          const y = parseInt(params.get("y") ?? "1", 10);
          const data = params.get("mapdata");
          Cuit.origin = {x, y};
          return Cuit.decodeStrMap(data, x, y);
      }
      Cuit.msg.textContent = "Circuit read";
      const map = localStorage.getItem('CuitMap');
      if (!map)
          return Cuit.newMap();
      const uint8arr = new TextEncoder().encode(map);
      return new Uint16Array(uint8arr);
  },
  drawUI(ctx) {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, Cuit.offset.x, ctx.canvas.height);
      ctx.fillStyle = '#bdbdfd';
      ctx.fillRect(0, 0, 3, ctx.canvas.height);
      ctx.fillRect(Cuit.offset.x - 3, 0, 3, ctx.canvas.height);
      for (let k in Cuit.buttons)
          Cuit.buttons[k].draw();
  },
  update(interval) {
      if (Cuit.isRun)
          Cuit.step();
      setTimeout( () => Cuit.update(interval), interval);
  },
  show() {
      const dp = Cuit.dpp;
      const ox = Cuit.origin.x;
      const oy = Cuit.origin.y;
      const sx = Math.max(ox, 1);
      const sy = Math.max(oy, 1);
      const ofs = Cuit.offset;
      const wh = Cuit.width;
      const ht = Cuit.height;
      const ctx = Cuit.ctx;
      const cvs = ctx.canvas;
      const cw = cvs.width - ofs.x;
      const ch = cvs.height - ofs.y;
      const csize = cvs.width * cvs.height;
      const map = Cuit.map;
      const color = Cuit.color;

      if (ox < 1 || oy < 1 || ox + cw / dp > wh || oy + ch / dp > ht || (wh - 2) * dp < cvs.width || (ht - 2) * dp < cvs.height)
          ctx.clearRect(ofs.x, ofs.y, cw, ch);

      let idata = ctx.getImageData(ofs.x, ofs.y, cw, ch);
      let iarr = idata.data;
      for (let y = sy, ymax = ht - 1; y < ymax; y++)
      {
          const ry = (y - oy) * dp;
          if (ry >= ch)
              break;
          for (let x = sx, xmax = wh - 1; x < xmax; x++)
          {
              const rx = (x - ox) * dp;
              if (rx >= cw)
                  break;
              const cell = color[map[x + y * wh] & 0xff];
              for (let ny = 0; ny < dp; ny++)
              {
                  if (ry + ny >= ch)
                      break;
                  const ni = rx + (ry + ny) * cw;
                  for (let nx = 0; nx < dp; nx++)
                  {
                      if (rx + nx >= cw)
                          break;
                      const nix = 4 * (ni + nx);
                      iarr[nix+0] =  cell               >>> 24;
                      iarr[nix+1] = (cell & 0x00ff0000) >>> 16;
                      iarr[nix+2] = (cell & 0x0000ff00) >>>  8;
                      iarr[nix+3] =         0x000000ff;
                  }
              }
          }
      }
      ctx.putImageData(idata, ofs.x, ofs.y);
      switch (Cuit.mode) {
          case 'W': Cuit.drawCurPos();   break;
          case 'E': Cuit.drawEditRect(); break;
          case 'P': break;
      }
      Cuit.nStepElem.textContent = Cuit.nStep;
      requestAnimationFrame(Cuit.show);
  },
  step(ctx) {
      const wh = Cuit.width;
      const ht = Cuit.height;
      const delta = [ 1, wh, -1, -wh ]
      const rev_d = [ 2, 3, 0, 1 ]
      const org = Cuit.map;
      let nex = Cuit.newMap();
      const ec = 'C'.charCodeAt(0);
      const ej = 'J'.charCodeAt(0);
      const ei = 'I'.charCodeAt(0);
      const eo = 'O'.charCodeAt(0);
      const ev = 'V'.charCodeAt(0);
      const ew = 'W'.charCodeAt(0);
      const ec_on = 'C'.charCodeAt(0) + 128;
      const ei_on = 'I'.charCodeAt(0) + 128;
      const eo_on = 'O'.charCodeAt(0) + 128;

      for (let y = 1, ymax = ht - 1; y < ymax; y++)
      for (let x = 1, xmax = wh - 1; x < xmax; x++)
      {
          const i = x + y * wh;
          if (org[i] == ew || org[i] == ev || org[i] == ej) {
              nex[i] = org[i];
              continue;
          }
          if (org[i] == ec || (org[i] & 0xff) == ec_on) {
              let on = false;
              let j;
              for (j = 0; j < delta.length; j++)
              {
                  let neig = org[i + delta[j]];
                  if (neig == ew)
                      continue;
                  if (neig == ej) {
                      neig = org[i + 2 * delta[j]];
                  }
                  if (neig == ev || neig == eo_on || (neig & 0xff) == ec_on && (neig >> 8) != rev_d[j]) {
                      on = true;
                      break;
                  }
              }
              nex[i] = on ? ec_on + (j << 8) : ec;
              continue;
          }
          if (org[i] == ei || org[i] == ei_on) {
              let on = true;
              for (let j = 0; j < delta.length; j++)
              {
                  let neig = org[i + delta[j]];
                  if (neig == ec) {
                      on = false;
                      break;
                  }
              }
              nex[i] = on ? ei_on : ei;
              continue;
          }
          if (org[i] == eo || org[i] == eo_on) {
              let on = true;
              for (let j = 0; j < delta.length; j++)
              {
                  let neig = org[i + delta[j]];
                  if (neig == ei_on) {
                      on = false;
                      break;
                  }
              }
              nex[i] = on ? eo_on : eo;
              continue;
          }
          console.log(org[i-1])
          throw new Error(`(${x}, ${y}) '${org[i]}' :invalid cell access`);
      }
      Cuit.map = nex;
      Cuit.nStep++;
  },
  showPos(p) {
      if (!p) return;
      Cuit.posElem.textContent = ` ( ${p.x}, ${p.y} ) `;
  },
  drawEditRect() {
      const end = Cuit.point.end;
      const begin = Cuit.point.begin;
      const width = end.rx - begin.rx;
      const height = end.ry - begin.ry;
      Cuit.ctx.strokeStyle = '#ffff00';
      Cuit.ctx.strokeRect(begin.rx, begin.ry, width, height);
  },
  drawCurPos() {
      const dpp = Cuit.dpp;
      const p = Cuit.pos;
      if (!p || Cuit.mouseIsDown)
        return;
      Cuit.ctx.globalCompositeOperation = "multiply";
      Cuit.ctx.fillStyle = "#f0f0f0";
      Cuit.ctx.fillRect(p.rx, p.ry, dpp, dpp);
      Cuit.ctx.globalCompositeOperation = "source-over";
  },

  mouseMove(e) {
      if (Cuit.mode == "P") return;
      Cuit.msg.textContent = "";
      const px = e.offsetX;
      const py = e.offsetY;
      Cuit.mouse.x = px;
      Cuit.mouse.y = py;
      const p = Cuit.calcPos(px, py);
      Cuit.pos = p;
      if (!p) {
          const btns = Cuit.buttons;
          let isin = false;
          for (let k in btns) {
              if(btns[k].isin(px, py))
                  isin = true;
          }
          if (isin)
              Cuit.ctx.canvas.style.cursor = 'pointer';
          else
              Cuit.ctx.canvas.style.cursor = 'auto';
          return;
      }
      Cuit.showPos(p);
      if (Cuit.mouseIsDown) {
          switch (Cuit.mode) {
              case 'W': Cuit.putElem(p); break;
              case 'E': Cuit.updateEnd(p); break;
              case 'R': Cuit.moveOrigin(p.x, p.y); break;
              default: break;
          }
      }
  },
  calcPos(px, py) {
      const dp = Cuit.dpp;
      const ofs = Cuit.offset;
      const qx = px - ofs.x;
      const qy = py - ofs.y;
      if (qx < 0 || qy < 0)
        return null;
      const ox = qx - qx % dp;
      const oy = qy - qy % dp;
      const o = Cuit.origin;
      const x = ox / dp + o.x;
      const y = oy / dp + o.y;
      if (x >= Cuit.width - 1 || y >= Cuit.height - 1)
        return null;
      const rx = ox + ofs.x
      const ry = oy + ofs.y
      return {x: x, y: y, rx: rx, ry: ry};
  },
  putElem(p) {
      const wh = Cuit.width;
      const ht = Cuit.height;
      if (p.x <= 0 || p.x >= wh - 1 || p.y <= 0 || p.y >= ht - 1)
          return;
      const dp = Cuit.dpp;
      const ix = p.x + p.y * Cuit.width;
      const ch = String.fromCharCode(Cuit.selectedElem);
      Cuit.ctx.fillStyle = Cuit.strColor[ch];
      Cuit.ctx.fillRect(p.rx, p.ry, dp, dp);
      Cuit.map[ix] = Cuit.selectedElem;
  },
  updateEnd(pos) {
      Cuit.show();
      const p0 = Cuit.point.begin;
      const pm = Cuit.mouse;
      const tx = (1 + Math.sign(pm.x - p0.rx)) >>> 1;
      const ty = (1 + Math.sign(pm.y - p0.ry)) >>> 1;
      const p = Cuit.pos;
      const d = Cuit.dpp;
      Cuit.point.end = {x:p.x+tx, y:p.y+ty, rx:p.rx+tx*d, ry:p.ry+ty*d};
      Cuit.drawEditRect();
  },
  moveOrigin(x, y) {
      const begin = Cuit.point.begin;
      if (x != begin.x) {
          Cuit.origin.x += begin.x - x;
      }
      if (y != begin.y) {
          Cuit.origin.y += begin.y - y;
      }
      Cuit.show();
  },
  copy(isCut) {
      const begin = Cuit.point.begin;
      const end = Cuit.point.end;
      const map = Cuit.map;
      const wh = Cuit.width;
      const ew = 'W'.charCodeAt(0);
      let xi, yi, xf, yf;
      if (begin.x < end.x) {
          xi = begin.x;
          xf = end.x;
      }
      else {
          xf = begin.x;
          xi = end.x;
      }
      if (begin.y < end.y) {
          yi = begin.y;
          yf = end.y;
      }
      else {
          yf = begin.y;
          yi = end.y;
      }
      let copy = {};
      for (let y = yi, ymax = yf; y < ymax; y++)
      {
          copy[y] = {};
          for (let x = xi, xmax = xf; x < xmax; x++)
          {
              const i = x + y * wh;
              copy[y][x] = map[i];
              if (isCut)
                  map[i] = ew;
          }
      }
      Cuit.copydata = copy;
  },
  yank() {
      Cuit.copy(false);
      Cuit.msg.textContent = "yank";
  },
  cut() {
      Cuit.copy(true);
      Cuit.show();
      Cuit.msg.textContent = "cut";
  },
  paste(x, y) {
      const data = Cuit.copydata;
      const map = Cuit.map;
      const wh = Cuit.width;
      let dx = 0;
      let dy = 0;
      for (let iy in data)
      {
          const line = data[iy];
          const i = x + (y + dy) * wh
          for (let ix in line)
          {
              map[i + dx] = line[ix];
              dx++;
          }
          dx = 0;
          dy++;
      }
      Cuit.show();
      Cuit.msg.textContent = "paste";
  },
  setZeroStep() {
      Cuit.nStep = 0;
      const map = Cuit.map;
      for (let i = 0, max = map.length; i < max; i++)
          map[i] = map[i] & 0x007f;
  },
  keyDown(e) {
      if (Cuit.mode == "P") return;
      const kc = e.keyCode;
      const ch = String.fromCharCode(kc);
      switch (ch) {
          case 'S': case 'W': case 'E': case 'R':
              Cuit.buttons[ch].on();
              break;
          case ';': Cuit.buttons['+'].on(); break;
          case 'C': case 'J': case 'I': case 'O': case 'V':
              Cuit.selectedElem = kc;
              Cuit.curElem = kc;
              break;
          case 'Y': Cuit.yank(); break;
          case 'X': Cuit.cut(); break;
          case 'P':
              const p = Cuit.point.begin;
              Cuit.paste(p.x, p.y);
              break;
          case 'Z':
              Cuit.setZeroStep();
              Cuit.show();
              break;
          case 'G':
              Cuit.origin.x = 1;
              Cuit.origin.y = 1;
              Cuit.showPos();
              Cuit.show();
              break;
          case 'N':
              Cuit.map = Cuit.newMap();
              Cuit.msg.textContent = "New circuit";
              Cuit.show();
              break;
          default:
              break;
      }
      return false;
  },
  mouseWheel(e) {
      e.preventDefault();
      if (Cuit.mode == "P") return;
      let n = Cuit.dpp;
      n += Math.sign(e.deltaY);
      if (n >= 1 && n <= 40) {
          Cuit.dpp = n;
          Cuit.dppElem.textContent = "×" + n;
          Cuit.show();
          Cuit.showPos();
      }
  },
  mouseDown(e) {
      e.preventDefault();
      if (Cuit.mode == "P") return;
      Cuit.isRight = e.button == 2;
      if (Cuit.isRight)
          Cuit.selectedElem = 'W'.charCodeAt(0);
      Cuit.mouseIsDown = true;
      const m = Cuit.mouse;
      const ofs = Cuit.offset;
      if (m.x > ofs.x && m.y > ofs.y) {
          Cuit.point.begin = Cuit.pos;
          Cuit.point.end = Cuit.pos;
      }
      Cuit.mouseMove(e);
  },
  mouseUp() {
      if (Cuit.mode == "P") return;
      if (Cuit.isRight)
          Cuit.selectedElem = Cuit.curElem;
      Cuit.isRight = false;
      Cuit.mouseIsDown = false;
      const btns = Cuit.buttons;
      const pos = Cuit.mouse;
      const ofs = Cuit.offset;
      if (pos.x < ofs.x || pos.y < ofs.y) {
          for (let k in btns) {
              if(btns[k].isin(pos.x, pos.y))
                  btns[k].on();
          }
      }
      else {
          Cuit.ctx.canvas.style.cursor = 'auto';
      }
  },
  mouseLeave() {
      Cuit.pos = null;
      Cuit.mouse = {x:0, y:0};
      Cuit.posElem.textContent = " ( 0, 0 ) ";
  },
};

Cuit.Button = function(btn) {
  const xoffset = 30;
  const yoffset = 20;
  const margin = 20;
  const ctx = Cuit.ctx;
  const line_width = 2;
  const font_offset_x = 10;
  const font_offset_y = 8;
  const font_width  = 32;
  const font_height = 28;
  let btn_height = yoffset;
  let count = 0;

  Cuit.Button = function(btn) {
      this.name = btn.name;
      this.color = btn.color;
      this.group = btn.group;
      this.fcolor = btn.fcolor;
      this.toggle = btn.toggle;
      this.func = btn.func;
      this.img = btn.img;
      this.x = xoffset;
      this.y = btn_height;

      this.width = 40;
      this.height = 30;
      if (!btn.on)
          this.ison = false;
      else
          this.ison = true;
      if (!btn.img) {
          this.draw = function() {
              const lw = line_width;
              const ox = font_offset_x;
              const oy = font_offset_y;
              const fw = font_width;
              const fh = font_height;
              ctx.fillStyle = this.color;
              ctx.fillRect(this.x, this.y, this.width, this.height);
              if (this.ison) {
                  ctx.fillStyle = this.color;
              }
              else {
                  ctx.fillStyle = '#eee';
              }
              ctx.fillRect(this.x - ox, this.y - oy, fw, fh);
              if (this.group && !this.ison) {
                  ctx.fillStyle = '#f8f8f4';
              }
              else {
                  ctx.fillStyle = 'white';
              }
              ctx.fillRect(this.x - ox + lw, this.y - oy + lw, fw - 2*lw, fh - 2*lw);
              if (this.ison)
                  ctx.fillStyle = this.fcolor;
              else
                  ctx.fillStyle = '#aaa';
              ctx.font = "bold 21px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText(this.name, this.x + 6, this.y + 14);
          };
      }
      else {
          this.width = img.width;
          this.height = img.height;
          this.draw = function() {
              if (this.on)
                  ctx.drawImage(img.on, this.x, this.y, this.width, this.height);
              else
                  ctx.drawImage(img.off, this.x, this.y, this.width, this.height);
          };
      }
      this.isin = function(px, py) {
          return px > this.x && px < this.x + this.width && py > this.y && py < this.y + this.height;
      };
      this.on = function() {
          if (this.toggle) {
              this.ison = !this.ison;
              this.draw();
              if (this.ison)
                  this.func();
              return
          }
          this.ison = true;
          this.draw();
          this.func();
          if (this.group) {
              let btns = Cuit.buttons;
              for (let k in btns)
              {
                  let b = btns[k];
                  if (b.group == this.group && b.name != this.name) {
                      btns[k].ison = false;
                      b.draw();
                  }
              }
          }
          else {
              let that = this;
              setTimeout(function() { that.ison = false; that.draw(); }, 500);
          }
      }
      btn_height += this.height + margin;
      count++;
  };
  return new Cuit.Button(btn);
};

Cuit.drawSyms = {
  xoffset: 10, yoffset: 275, width: 8, height: 8, margin: 10,
  base() {
      const ctx = Cuit.ctx;
      ctx.textAlign = "left";
      ctx.fillStyle = 'white';
      ctx.fillRect(this.xoffset - 5, this.yoffset - 10, 90, 25);
  },
  W() {
      Cuit.drawSyms.base();
      const x = this.xoffset;
      const y = this.yoffset;
      const w = this.width;
      const r = this.width / 2;
      const m = this.margin;
      const pi2 = Math.PI * 2;
      const list = [ 'C', 'J', 'I', 'O', 'V' ];
      const ctx = Cuit.ctx;
      const col = Cuit.strColor;
      ctx.font = "italic bold 14px sans-serif";
      let sx = x;
      for (let i = 0, max = list.length; i < max; i++)
      {
          const el = list[i];
          ctx.fillStyle = col[el];
          ctx.beginPath();
          ctx.arc(sx + 4, y + 10, r, 0, pi2, false);
          ctx.fill()
          ctx.fillStyle = 'gray';
          ctx.fillText(el, sx - 3, y + 2);
          sx += m + w;
      }
  },
  E() {
      const list = [ 'X', 'Y', 'P' ];
      Cuit.drawSyms.strings(list, 1);
  },
  R() {
      const list = [ 'Z', 'G', 'N' ];
      Cuit.drawSyms.strings(list, 1);
  },
  strings(list, offset) {
      Cuit.drawSyms.base();
      const ctx = Cuit.ctx;
      ctx.fillStyle = 'gray';
      ctx.font = "italic bold 14px sans-serif";
      const x = this.xoffset;
      const y = this.yoffset;
      const w = this.width;
      const m = this.margin;
      let sx = x;
      sx += (m + w) * offset;
      for (let i = 0, max = list.length; i < max; i++)
      {
          ctx.fillText(list[i], sx - 3, y + 8);
          sx += m + w;
      }
  },
};

////////////////////////////////////////////////////////////

Cuit.dppElem   = document.getElementById("dpp");
Cuit.posElem   = document.getElementById("pos");
Cuit.msg       = document.getElementById("msg");
Cuit.nStepElem = document.getElementById("nStep");

document.getElementById('write' ).onclick = Srv.write;
document.getElementById('read'  ).onclick = Srv.read;
document.getElementById('record').onclick = Srv.record;

Cuit.init(document.getElementById('circuit'))
Cuit.isRun = true;
const params = (new URL(location)).searchParams;
Cuit.map = Cuit.readMap(params);
Cuit.update(Cuit.timerInterval);
requestAnimationFrame(Cuit.show);

