'use strict';

if (!Promise) {
    window.alert("this site needs modern browser");
    throw new Error("Promise object not found");
}

const Srv = {
  write: function() {
  },
  read: function() {
  },
  upload: function() {
      Srv.title = window.prompt("Input Title");
      if (!Srv.title)
          return;
      const canvas = document.getElementById('map');
      Cuit.mapto(canvas);
      //Srv.map = canvas.toBlob();
      Srv.toThumb(Cuit.ctx).
          then(function() {
              const thm = document.getElementById('thumbnail');
              //Srv.thm = thm.toBlob();
          })
          //.then(Srv.send)
          //.then(function() { location.href = '/serve'; });
  },
  toThumb: function(ctx) {
      return new Promise((resolve,reject) => {
        const ratio = 0.5;
        const org = ctx.canvas;
        const thm = document.querySelector('#thumbnail');
        let image = new Image();
        image.onload = function() {
            const ofs = Cuit.offset;
            const sw = org.width - ofs.x;
            const sh = org.height - ofs.y;
            thm.width = sw * ratio;
            thm.height = sh * ratio;
            thm.getContext("2d").drawImage(image, ofs.x, ofs.y, sw, sh, 0, 0, thm.width, thm.height);
            resolve();
        }
        image.src = org.toDataURL();
      });
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
  timerInterval: 500,
  buttons: {},
  msg: {},
  strColor: {
      C: '#cdcdff',
      J: "#808080",
      I: "#aa00aa",
      O: "#008800",
      V: "#00ffff",
      W: "#ffffff",
      C_on: "#fff88a",
      I_on: "#ff9900",
      O_on: "#ff0000"
  },
  color: {
      67: 0x00cdcdff,
      74: 0x00808080,
      73: 0x00aa00aa,
      79: 0x00008800,
      86: 0x0000ffff,
      87: 0x00ffffff,
      1091: 0x00fff88a,
      1097: 0x00ff9900,
      1103: 0x00ff0000
  },
  get isRun() {
      if (!Cuit.buttons)
          return false;
      return Cuit.buttons.S.ison;
  },
  set isRun(bool) {
      if (!Cuit.buttons)
          return;
      Cuit.buttons.S.ison = bool;
  },
  init: function(canvas) {
      Cuit.ctx = canvas.getContext("2d");
      Cuit.setEvents(canvas);
      Cuit.setButtons();
      Cuit.drawUI(Cuit.ctx);
      Cuit.drawSyms[Cuit.mode]();
  },
  setEvents: function(canvas) {
      document.onkeydown   = Cuit.keyDown;
      canvas.onmousedown   = Cuit.mouseDown;
      canvas.onmousemove   = Cuit.mouseMove;
      canvas.onmouseup     = Cuit.mouseUp;
      canvas.onmouseleave  = Cuit.mouseLeave;
      canvas.oncontextmenu = function(e) { e.preventDefault(); };
      canvas.addEventListener('wheel', Cuit.mouseWheel, {passive: false});
  },
  setButtons: function() {
      const setMode = function() {
          Cuit.mode = this.name
          Cuit.drawSyms[this.name]();
      };
      const btns = [
          { name: 'S', color: "#ffcccc", toggle: true, func: function(){}},
          { name: 'W', color: "#ccffcc", group: 1, on: true, func: setMode },
          { name: 'E', color: "#ccffcc", group: 1, func: setMode },
          { name: 'R', color: "#ccffcc", group: 1, func: setMode },
          { name: '+', color: "#ccccff", func: Cuit.save },
      ];
      for (let i = 0; i < btns.length; i++)
          Cuit.buttons[btns[i].name] = new Cuit.Button(btns[i]);
  },
  mapto: function(canvas) {
      canvas.width = Cuit.width;
      canvas.height = Cuit.height;
      const wh = canvas.width;
      const ht = canvas.height;
      const ctx = canvas.getContext("2d");
      const map = Cuit.map;
      let idata = ctx.getImageData(0, 0, wh, ht);
      let iarr = idata.data;
      let color = {};
      let el;
      for (let e in Cuit.color)
      {
          if (e < 1024)
              el = e;
          else
              el = e & 0x00ff;
          color[e] = Cuit.color[el];
      };
      for (let y = 0; y < ht; y++)
      for (let x = 0; x < wh; x++)
      {
          const n = x + y * wh;
          const ni = 4 * n;
          const cell = color[map[n] & 0x00ffff];
          iarr[ni+0] = (cell & 0x00ff0000) >> 16;
          iarr[ni+1] = (cell & 0x0000ff00) >> 8;
          iarr[ni+2] =  cell & 0x000000ff;
          iarr[ni+3] = 255;
      }
      ctx.putImageData(idata, 0, 0);
  },
  tomap: function(src) {
      return new Promise((resolve, reject) => {
        const canvas = document.getElementById('map');
        canvas.width = Cuit.width;
        canvas.height = Cuit.height;
        const wh = canvas.width;
        const ht = canvas.height;
        const ctx = canvas.getContext("2d");
        const color = Cuit.color;
        let img = new Image();
        img.src = src;
        img.onload = function() {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const color = Cuit.color;
            let map = [];
            let elem = {};
            for (let e in color)
            {
                elem[color[e]] = e;
            }
            let idata = ctx.getImageData(0, 0, wh, ht);
            let iarr = idata.data;
            for (let y = 1, ymax = ht - 1; y < ymax; y++)
            for (let x = 1, xmax = wh - 1; x < ymax; x++)
            {
                const n = x + y * wh;
                const ni = 4 * n;
                const cell = iarr[ni] << 16 | iarr[ni+1] << 8 | iarr[ni+2];
                map[n] = elem[cell];
                if (map[n] === undefined)
                    throw new Error("( " + x + ", " + y + " ) color not defined");
            }
            Cuit.map = map;
            resolve();
        };
        img.onerror = function(stuff) {
            console.log("img onerror:", stuff);
            reject();
        };
      });
  },
  save: function() {
      const map = Cuit.map;
      let strmap = "";
      for (let i = 0, max = map.length; i < max; i++)
          strmap += map[i] + ",";

      localStorage.setItem('CuitMap', strmap);
      Cuit.msg.textContent = "Circuit saved";
  },
  newMap: function() {
      Cuit.msg.textContent = "New Circuit";
      const w = 'W'.charCodeAt(0);
      const max = Cuit.width * Cuit.height;
      let map = new Int32Array(max);
      for (let i = 0; i < max; i++)
          map[i] = w;
      return map;
  },
  readMap: function() {
      Cuit.msg.textContent = "circuit read";
      const map = localStorage.getItem('CuitMap');
      if (!map)
          return Cuit.newMap();
      const a = map.split(",");
      const max = Cuit.width * Cuit.height;
      let arr = new Int32Array(max);
      for (let i = 0, max = arr.length; i < max; i++)
          arr[i] = a[i];
      return arr;
  },
  drawUI: function(ctx) {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, Cuit.offset.x, ctx.canvas.height);
      ctx.fillStyle = '#bdbdfd';
      ctx.fillRect(0, 0, 3, ctx.canvas.height);
      ctx.fillRect(Cuit.offset.x - 3, 0, Cuit.offset.x, ctx.canvas.height);
      for (let k in Cuit.buttons)
          Cuit.buttons[k].draw();
  },
  update: function(interval) {
      if (Cuit.isRun)
          Cuit.step();
      setTimeout(function() { Cuit.update(interval); }, interval);
  },
  show: function() {
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
          for (let x = sx, xmax = wh - 1; x < xmax; x++)
          {
              const rx = (x - ox) * dp;
              if (rx > cw || ry > ch)
                  break;
              const cell = color[map[x + y * wh] & 0x00ffff];
              for (let ny = 0; ny < dp; ny++)
              {
                  const ni = rx + (ry + ny) * cw;
                  for (let nx = 0; nx < dp; nx++)
                  {
                      if (rx + nx >= cw)
                          break;
                      const nix = 4 * (ni + nx);
                      iarr[nix+0] = cell >> 16;
                      iarr[nix+1] = (cell & 0x0000ff00) >> 8;
                      iarr[nix+2] =  cell & 0x000000ff;
                      iarr[nix+3] = 255;
                  }
              }
          }
      }
      ctx.putImageData(idata, ofs.x, ofs.y);
      if (Cuit.mode == 'E')
          Cuit.drawEditRect();
      if (Cuit.mode == 'W')
          Cuit.drawCurPos();
      requestAnimationFrame(Cuit.show);
  },
  step: function(ctx) {
      const wh = Cuit.width;
      const ht = Cuit.height;
      const delta = [ 1, wh, -1, -wh ]
      const rev_d = [ 2, 3, 0, 1 ]
      const org = Cuit.map;
      let nex = new Int32Array(wh * ht);
      const ec = 'C'.charCodeAt(0);
      const ej = 'J'.charCodeAt(0);
      const ei = 'I'.charCodeAt(0);
      const eo = 'O'.charCodeAt(0);
      const ev = 'V'.charCodeAt(0);
      const ew = 'W'.charCodeAt(0);
      const ec_on = 'C'.charCodeAt(0) + 1024;
      const ei_on = 'I'.charCodeAt(0) + 1024;
      const eo_on = 'O'.charCodeAt(0) + 1024;

      for (let y = 1, ymax = ht - 1; y < ymax; y++)
      for (let x = 1, xmax = wh - 1; x < xmax; x++)
      {
          const i = x + y * wh;
          if (org[i] == ew || org[i] == ev || org[i] == ej) {
              nex[i] = org[i];
              continue;
          }
          if (org[i] == ec || (org[i] & 0x00ffff) == ec_on) {
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
                  if (neig == ev || neig == eo_on || (neig & 0x00ffff) == ec_on && (neig >> 16) != rev_d[j]) {
                      on = true;
                      break;
                  }
              }
              nex[i] = on ? ec_on + (j << 16) : ec;
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
          nex[i] = ew;
      }
      Cuit.map = nex;
  },
  showPos: function(p) {
      if (!p) {
          const m = Cuit.mouse;
          p = Cuit.calcPos(m.x, m.y);
          if (!p)
              return;
      }
      const ctx = Cuit.ctx;
      const pos = document.getElementById('pos');
      pos.textContent = " ( " + p.x + ", " + p.y + " ) ";
  },
  drawEditRect: function() {
      const end = Cuit.point.end;
      const begin = Cuit.point.begin;
      const width = end.rx - begin.rx;
      const height = end.ry - begin.ry;
      Cuit.ctx.strokeStyle = '#ffff00';
      Cuit.ctx.strokeRect(begin.rx, begin.ry, width, height);
  },
  drawCurPos: function() {
      const dpp = Cuit.dpp;
      const p = Cuit.pos;
      if (!p || Cuit.mouseIsDown)
        return;
      Cuit.ctx.globalCompositeOperation = "multiply";
      Cuit.ctx.fillStyle = "#f0f0f0";
      Cuit.ctx.fillRect(p.rx, p.ry, dpp, dpp);
      Cuit.ctx.globalCompositeOperation = "source-over";
  },

  mouseMove: function(e) {
      Cuit.msg.textContent = "";
      const px = e.offsetX;
      const py = e.offsetY;
      Cuit.mouse.x = px;
      Cuit.mouse.y = py;
      const p = Cuit.calcPos(px, py);
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
      Cuit.pos = p;
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
  calcPos: function(px, py) {
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
      const ix = x + y * Cuit.width;
      if (x >= Cuit.width - 1 || y >= Cuit.height - 1)
        return null;
      const rx = ox + ofs.x
      const ry = oy + ofs.y
      return {x: x, y: y, rx: rx, ry: ry};
  },
  putElem: function(p) {
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
  updateEnd: function(pos) {
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
  moveOrigin: function(x, y) {
      const begin = Cuit.point.begin;
      if (x != begin.x) {
          Cuit.origin.x += begin.x - x;
      }
      if (y != begin.y) {
          Cuit.origin.y += begin.y - y;
      }
      Cuit.show();
  },
  copy: function(isCut) {
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
  yank: function() {
      Cuit.copy(false);
      Cuit.msg.textContent = "yank";
  },
  cut: function() {
      Cuit.copy(true);
      Cuit.show();
      Cuit.msg.textContent = "cut";
  },
  paste: function(x, y) {
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
  keyDown: function(e) {
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
          case 'G':
              Cuit.origin.x = 1;
              Cuit.origin.y = 1;
              Cuit.showPos();
              Cuit.show();
              break;
          case 'N':
              Cuit.map = Cuit.newMap();
              Cuit.show();
              break;
          default:
              break;
      }
      return false;
  },
  mouseWheel: function(e) {
      e.preventDefault();
      const n = Cuit.dpp;
      n += Math.sign(e.deltaY);
      if (n >= 1 && n <= 40) {
          Cuit.dpp = n;
          document.getElementById('wheel').textContent = n;
          Cuit.show();
          Cuit.showPos();
      }
  },
  mouseDown: function(e) {
      e.preventDefault();
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
  mouseUp: function() {
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
          document.getElementById('circuit').style.cursor = 'auto';
      }
  },
  mouseLeave: function() {
      Cuit.mouse = {x:0, y:0};
      document.getElementById('pos').textContent = " ( 0, 0 ) ";
  },
};

Cuit.Button = function(btn) {
  const xoffset = 30;
  const yoffset = 20;
  const margin = 20;
  const ctx = Cuit.ctx;
  let btnheight = yoffset;
  let count = 0;

  Cuit.Button = function(btn) {
      this.name = btn.name;
      this.color = btn.color;
      this.group = btn.group;
      this.toggle = btn.toggle;
      this.func = btn.func;
      this.img = btn.img;
      this.x = xoffset;
      this.y = btnheight;

      this.width = 40;
      this.height = 30;
      if (!btn.on)
          this.ison = false;
      else
          this.ison = true;
      if (!btn.img) {
          this.draw = function() {
              ctx.fillStyle = this.color;
              ctx.fillRect(this.x, this.y, this.width, this.height);
              if (this.ison) {
                  ctx.fillStyle = this.color;
              }
              else {
                  ctx.fillStyle = '#eee';
              }
              ctx.fillRect(this.x - 10, this.y - 8, 26, 26);
              if (this.group && !this.ison) {
                  ctx.fillStyle = '#f8f8f4';
              }
              else {
                  ctx.fillStyle = 'white';
              }
              ctx.fillRect(this.x - 8, this.y - 6, 22, 22);
              if (this.ison)
                  ctx.fillStyle = 'black';
              else
                  ctx.fillStyle = '#aaa';
              ctx.font = "bold 21px sans-serif";
              ctx.fillText(this.name, this.x - 4, this.y + 12);
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
      btnheight += this.height + margin;
      count++;
  };
  return new Cuit.Button(btn);
};

Cuit.drawSyms = {
  xoffset: 10, yoffset: 275, width: 8, height: 8, margin: 10,
  base: function() {
      const ctx = Cuit.ctx;
      ctx.fillStyle = 'white';
      ctx.fillRect(this.xoffset - 5, this.yoffset - 10, 90, 25);
  },
  W: function() {
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
  E: function() {
      const list = [ 'X', 'Y', 'P' ];
      Cuit.drawSyms.strings(list, 1);
  },
  R: function() {
      const list = [ 'G', 'N' ];
      Cuit.drawSyms.strings(list, 1.5);
  },
  strings: function(list, offset) {
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

const spanwheel = document.createElement('span');
const spanpos   = document.createElement('span');
const spanmsg   = document.createElement('span');
spanwheel.id = 'wheel';
spanpos  .id = 'pos';
spanmsg  .id = 'msg';
const divinfo = document.getElementById('info');
divinfo.appendChild(spanwheel);
divinfo.appendChild(spanpos);
divinfo.appendChild(spanmsg);
spanwheel.textContent = Cuit.dpp;
spanpos  .textContent = " ( 0, 0 ) ";
Cuit.msg = spanmsg;

document.getElementById('write').addEventListener('click', Srv.write);
document.getElementById('read').addEventListener('click', Srv.read);
if (init_origin != "")
    Cuit.origin = JSON.parse(init_origin);
if (init_dpp != "")
    Cuit.dpp = parseInt(init_dpp);
const canvas = document.getElementById('circuit');
Cuit.init(canvas)
Cuit.buttons.S.on();
if (mapkey == "") {
    Cuit.map = Cuit.readMap();
    Cuit.update(Cuit.timerInterval);
}
else {
    Cuit.tomap("/blob?key=" + mapkey).then(function() {
        Cuit.update(Cuit.timerInterval);
    });
}

requestAnimationFrame(Cuit.show);


