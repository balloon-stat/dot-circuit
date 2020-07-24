'use strict';

if (!Promise) {
    window.alert("this site needs modern browser");
    throw new Error("Promise object not found");
}

var Srv = {
  upload: function() {
      Srv.title = window.prompt("Input Title");
      if (!Srv.title)
          return;
      var canvas = document.getElementById('map');
      Cuit.mapto(canvas);
      Srv.map = Srv.toBlob(canvas);
      Srv.toThumb(Cuit.ctx).
          then(function() {
              var thm = document.getElementById('thumbnail');
              Srv.thm = Srv.toBlob(thm);
          })
          //.then(Srv.send)
          .then(function() { location.href = '/serve'; });
  },
  toBlob: function(canvas) {
      var dataURL = canvas.toDataURL();
      var base64 = dataURL.split(',')[1];
      var bstr = window.atob(base64);
      var arr = new Uint8Array(bstr.length);

      for (var i = 0, max = bstr.length; i < max; i++)
      {
          arr[i] = bstr.charCodeAt(i);
      }
      return new Blob([arr], {type: 'image/png'});
  },
  toThumb: function(ctx) {
      return new Promise((resolve,reject) => {
        var ratio = 0.5;
        var org = ctx.canvas;
        var thm = document.querySelector('#thumbnail');
        var image = new Image();
        image.onload = function() {
            var ofs = Cuit.offset;
            var sw = org.width - ofs.x;
            var sh = org.height - ofs.y;
            thm.width = sw * ratio;
            thm.height = sh * ratio;
            thm.getContext("2d").drawImage(image, ofs.x, ofs.y, sw, sh, 0, 0, thm.width, thm.height);
            resolve();
        }
        image.src = org.toDataURL();
      });
  },
};

var Cuit = {
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
      1091: 0x00fffd8a,
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
      var setMode = function() {
          Cuit.mode = this.name
          Cuit.drawSyms[this.name]();
      };
      var btns = [
          { name: 'S', color: "#ffcccc", toggle: true, func: function(){}},
          { name: 'W', color: "#ccffcc", group: 1, on: true, func: setMode },
          { name: 'E', color: "#ccffcc", group: 1, func: setMode },
          { name: 'R', color: "#ccffcc", group: 1, func: setMode },
          { name: '+', color: "#ccccff", func: Cuit.save },
      ];
      for (var i = 0; i < btns.length; i++)
          Cuit.buttons[btns[i].name] = new Cuit.Button(btns[i]);
  },
  mapto: function(canvas) {
      canvas.width = Cuit.width;
      canvas.height = Cuit.height;
      var wh = canvas.width;
      var ht = canvas.height;
      var ctx = canvas.getContext("2d");
      var map = Cuit.map;
      var idata = ctx.getImageData(0, 0, wh, ht);
      var iarr = idata.data;
      var color = {};
      var el;
      for (var e in Cuit.color)
      {
          if (e < 1024)
              el = e;
          else
              el = e & 0x00ff;
          color[e] = Cuit.color[el];
      };
      for (var y = 0; y < ht; y++)
      for (var x = 0; x < wh; x++)
      {
          var n = x + y * wh;
          var ni = 4 * n;
          var cell = color[map[n] & 0x00ffff];
          iarr[ni+0] = (cell & 0x00ff0000) >> 16;
          iarr[ni+1] = (cell & 0x0000ff00) >> 8;
          iarr[ni+2] =  cell & 0x000000ff;
          iarr[ni+3] = 255;
      }
      ctx.putImageData(idata, 0, 0);
  },
  tomap: function(src) {
      return new Promise((resolve, reject) => {
        var canvas = document.getElementById('map');
        canvas.width = Cuit.width;
        canvas.height = Cuit.height;
        var wh = canvas.width;
        var ht = canvas.height;
        var ctx = canvas.getContext("2d");
        var color = Cuit.color;
        var img = new Image();
        img.src = src;
        img.onload = function() {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            var map = {};
            var color = Cuit.color;
            var elem = {};
            for (var c in color)
            {
                elem[color[c]] = c;
            }
            var idata = ctx.getImageData(0, 0, wh, ht);
            var iarr = idata.data;
            for (var y = 1, ymax = ht - 1; y < ymax; y++)
            for (var x = 1, xmax = wh - 1; x < ymax; x++)
            {
                var n = x + y * wh;
                var ni = 4 * n;
                var cell = iarr[ni] << 16 | iarr[ni+1] << 8 | iarr[ni+2];
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
      var map = Cuit.map;
      var strmap = "";
      for (var i = 0, max = map.length; i < max; i++)
          strmap += map[i] + ",";

      localStorage.setItem('CuitMap', strmap);
      Cuit.msg.textContent = "Circuit saved";
  },
  newMap: function() {
      Cuit.msg.textContent = "New Circuit";
      var w = 'W'.charCodeAt(0);
      var max = Cuit.width * Cuit.height;
      var map = new Int32Array(max);
      for (var i = 0; i < max; i++)
          map[i] = w;
      return map;
  },
  readMap: function() {
      Cuit.msg.textContent = "circuit read";
      var map = localStorage.getItem('CuitMap');
      if (!map)
          return Cuit.newMap();
      var max = Cuit.width * Cuit.height;
      var arr = new Int32Array(max);
      var a = map.split(",");
      for (var i = 0, max = arr.length; i < max; i++)
          arr[i] = a[i];
      return arr;
  },
  drawUI: function(ctx) {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, Cuit.offset.x, ctx.canvas.height);
      ctx.fillStyle = '#bdbdfd';
      ctx.fillRect(0, 0, 3, ctx.canvas.height);
      ctx.fillRect(Cuit.offset.x - 3, 0, Cuit.offset.x, ctx.canvas.height);
      for (var k in Cuit.buttons)
          Cuit.buttons[k].draw();
  },
  update: function(interval) {
      if (Cuit.isRun)
          Cuit.step();
      setTimeout(function() { Cuit.update(interval); }, interval);
  },
  show: function() {
      var dp = Cuit.dpp;
      var ox = Cuit.origin.x;
      var oy = Cuit.origin.y;
      var sx = Math.max(ox, 1);
      var sy = Math.max(oy, 1);
      var ofs = Cuit.offset;
      var wh = Cuit.width;
      var ht = Cuit.height;
      var ctx = Cuit.ctx;
      var cvs = ctx.canvas;
      var cw = cvs.width - ofs.x;
      var ch = cvs.height - ofs.y;
      var csize = cvs.width * cvs.height;
      var map = Cuit.map;
      var color = Cuit.color;

      if (ox < 1 || oy < 1 || ox + cw / dp > wh || oy + ch / dp > ht || (wh - 2) * dp < cvs.width || (ht - 2) * dp < cvs.height)
          ctx.clearRect(ofs.x, ofs.y, cw, ch);

      var idata = ctx.getImageData(ofs.x, ofs.y, cw, ch);
      var iarr = idata.data;
      for (var y = sy, ymax = ht - 1; y < ymax; y++)
      {
          var ry = (y - oy) * dp;
          for (var x = sx, xmax = wh - 1; x < xmax; x++)
          {
              var rx = (x - ox) * dp;
              if (rx > cw || ry > ch)
                  break;
              var cell = color[map[x + y * wh] & 0x00ffff];
              for (var ny = 0; ny < dp; ny++)
              {
                  var ni = rx + (ry + ny) * cw;
                  for (var nx = 0; nx < dp; nx++)
                  {
                      if (rx + nx >= cw)
                          break;
                      var nix = 4 * (ni + nx);
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
      requestAnimationFrame(Cuit.show);
  },
  step: function(ctx) {
      var wh = Cuit.width;
      var ht = Cuit.height;
      var delta = [ 1, wh, -1, -wh ]
      var rev_d = [ 2, 3, 0, 1 ]
      var org = Cuit.map;
      var nex = new Int32Array(wh * ht);
      var ec = 'C'.charCodeAt(0);
      var ej = 'J'.charCodeAt(0);
      var ei = 'I'.charCodeAt(0);
      var eo = 'O'.charCodeAt(0);
      var ev = 'V'.charCodeAt(0);
      var ew = 'W'.charCodeAt(0);
      var ec_on = 'C'.charCodeAt(0) + 1024;
      var ei_on = 'I'.charCodeAt(0) + 1024;
      var eo_on = 'O'.charCodeAt(0) + 1024;

      for (var y = 1, ymax = ht - 1; y < ymax; y++)
      for (var x = 1, xmax = wh - 1; x < xmax; x++)
      {
          var i = x + y * wh;
          if (org[i] == ew || org[i] == ev || org[i] == ej) {
              nex[i] = org[i];
              continue;
          }
          if (org[i] == ec || (org[i] & 0x00ffff) == ec_on) {
              var on = false;
              for (var j = 0; j < delta.length; j++)
              {
                  var neig = org[i + delta[j]];
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
              var on = true;
              for (var j = 0; j < delta.length; j++)
              {
                  var neig = org[i + delta[j]];
                  if (neig == ec) {
                      on = false;
                      break;
                  }
              }
              nex[i] = on ? ei_on : ei;
              continue;
          }
          if (org[i] == eo || org[i] == eo_on) {
              var on = true;
              for (var j = 0; j < delta.length; j++)
              {
                  var neig = org[i + delta[j]];
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
          var m = Cuit.mouse;
          p = Cuit.calcPos(m.x, m.y);
          if (!p)
              return;
      }
      var ctx = Cuit.ctx;
      var dp = Cuit.dpp;
      if (Cuit.mode == "W") {
          ctx.fillStyle = "#f0f0f0";
          ctx.fillRect(p.rx, p.ry, dp, dp);
      }

      let pos = document.getElementById('pos');
      pos.textContent = " ( " + p.x + ", " + p.y + " ) ";
  },
  drawEditRect: function() {
      var end = Cuit.point.end;
      var begin = Cuit.point.begin;
      var width = end.rx - begin.rx;
      var height = end.ry - begin.ry;
      Cuit.ctx.strokeStyle = '#ffff00';
      Cuit.ctx.strokeRect(begin.rx, begin.ry, width, height);
  },
  mouseMove: function(e) {
      Cuit.msg.textContent = "";
      var px = e.offsetX;
      var py = e.offsetY;
      Cuit.mouse.x = px;
      Cuit.mouse.y = py;
      var p = Cuit.calcPos(px, py);
      if (!p) {
          var btns = Cuit.buttons;
          var isin = false;
          for (var k in btns) {
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
      var dp = Cuit.dpp;
      var ofs = Cuit.offset;
      var qx = px - ofs.x;
      var qy = py - ofs.y;
      if (qx < 0 || qy < 0)
        return null;
      var ox = qx - qx % dp;
      var oy = qy - qy % dp;
      var o = Cuit.origin;
      var x = ox / dp + o.x;
      var y = oy / dp + o.y;
      var ix = x + y * Cuit.width;
      if (x >= Cuit.width - 1 || y >= Cuit.height - 1)
        return null;
      var rx = ox + ofs.x
      var ry = oy + ofs.y
      return {x: x, y: y, rx: rx, ry: ry};
  },
  putElem: function(p) {
      var wh = Cuit.width;
      var ht = Cuit.height;
      if (p.x <= 0 || p.x >= wh - 1 || p.y <= 0 || p.y >= ht - 1)
          return;
      var dp = Cuit.dpp;
      var ix = p.x + p.y * Cuit.width;
      var ch = String.fromCharCode(Cuit.selectedElem);
      Cuit.ctx.fillStyle = Cuit.strColor[ch];
      Cuit.ctx.fillRect(p.rx, p.ry, dp, dp);
      Cuit.map[ix] = Cuit.selectedElem;
  },
  updateEnd: function(pos) {
      Cuit.show();
      Cuit.point.end = pos;
      Cuit.drawEditRect();
  },
  moveOrigin: function(x, y) {
      var begin = Cuit.point.begin;
      if (x != begin.x) {
          Cuit.origin.x += begin.x - x;
      }
      if (y != begin.y) {
          Cuit.origin.y += begin.y - y;
      }
      Cuit.show();
  },
  copy: function(isCut) {
      var begin = Cuit.point.begin;
      var end = Cuit.point.end;
      var map = Cuit.map;
      var wh = Cuit.width;
      var ew = 'W'.charCodeAt(0);
      var xi, yi, xf, yf;
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
      var copy = {};
      for (var y = yi, ymax = yf; y < ymax; y++)
      {
          copy[y] = {};
          for (var x = xi, xmax = xf; x < xmax; x++)
          {
              var i = x + y * wh;
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
      var data = Cuit.copydata;
      var map = Cuit.map;
      var wh = Cuit.width;
      var dx = 0;
      var dy = 0;
      for (var iy in data)
      {
          var line = data[iy];
          var i = x + (y + dy) * wh
          for (var ix in line)
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
  keyDown: function(evt) {
      var kc;
      if (evt)
        kc = evt.keyCode;
      else
        kc = event.keyCode;

      var ch = String.fromCharCode(kc);
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
              var p = Cuit.point.begin;
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
      var n = Cuit.dpp;
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
      var m = Cuit.mouse;
      var ofs = Cuit.offset;
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
      var btns = Cuit.buttons;
      var pos = Cuit.mouse;
      var ofs = Cuit.offset;
      if (pos.x < ofs.x || pos.y < ofs.y) {
          for (var k in btns) {
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
  var xoffset = 30;
  var yoffset = 20;
  var margin = 20;
  var count = 0;
  var ctx = Cuit.ctx;

  Cuit.Button = function(btn) {
      this.name = btn.name;
      this.color = btn.color;
      this.group = btn.group;
      this.toggle = btn.toggle;
      this.func = btn.func;
      this.img = btn.img;
      this.x = xoffset;
      this.y = yoffset;

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
              var btns = Cuit.buttons;
              for (var k in btns)
              {
                  var b = btns[k];
                  if (b.group == this.group && b.name != this.name) {
                      btns[k].ison = false;
                      b.draw();
                  }
              }
          }
          else {
              var that = this;
              setTimeout(function() { that.ison = false; that.draw(); }, 500);
          }
      }
      var height = this.height;
      yoffset += height + margin;
      count++;
  };
  return new Cuit.Button(btn);
};

Cuit.drawSyms = {
  xoffset: 10, yoffset: 275, width: 8, height: 8, margin: 10,
  base: function() {
      var ctx = Cuit.ctx;
      ctx.fillStyle = 'white';
      ctx.fillRect(this.xoffset - 5, this.yoffset - 10, 90, 25);
  },
  W: function() {
      Cuit.drawSyms.base();
      var x = this.xoffset;
      var y = this.yoffset;
      var w = this.width;
      var r = this.width / 2;
      var m = this.margin;
      var pi2 = Math.PI * 2;
      var list = [ 'C', 'J', 'I', 'O', 'V' ];
      var ctx = Cuit.ctx;
      var col = Cuit.strColor;
      ctx.font = "italic bold 14px sans-serif";
      for (var i = 0, max = list.length; i < max; i++)
      {
          var el = list[i];
          ctx.fillStyle = col[el];
          ctx.beginPath();
          ctx.arc(x + 4, y + 10, r, 0, pi2, false);
          ctx.fill()
          ctx.fillStyle = 'gray';
          ctx.fillText(el, x - 3, y + 2);
          x += m + w;
      }
  },
  E: function() {
      var list = [ 'X', 'Y', 'P' ];
      Cuit.drawSyms.strings(list, 1);
  },
  R: function() {
      var list = [ 'G', 'N' ];
      Cuit.drawSyms.strings(list, 1.5);
  },
  strings: function(list, offset) {
      Cuit.drawSyms.base();
      var ctx = Cuit.ctx;
      ctx.fillStyle = 'gray';
      ctx.font = "italic bold 14px sans-serif";
      var x = this.xoffset;
      var y = this.yoffset;
      var w = this.width;
      var m = this.margin;
      x += (m + w) * offset;
      for (var i = 0, max = list.length; i < max; i++)
      {
          ctx.fillText(list[i], x - 3, y + 8);
          x += m + w;
      }
  },
};

////////////////////////////////////////////////////////////

let spanwheel = document.createElement('span');
let spanpos   = document.createElement('span');
let spanmsg   = document.createElement('span');
spanwheel.id = 'wheel';
spanpos  .id = 'pos';
spanmsg  .id = 'msg';
let divinfo = document.getElementById('info');
divinfo.appendChild(spanwheel);
divinfo.appendChild(spanpos);
divinfo.appendChild(spanmsg);
spanwheel.textContent = Cuit.dpp;
spanpos  .textContent = " ( 0, 0 ) ";
Cuit.msg = spanmsg;

document.getElementById('upload').addEventListener('click', Srv.upload);
document.getElementById('serve').addEventListener('click', () => {location.href = '/serve';});
if (init_origin != "")
    Cuit.origin = JSON.parse(init_origin);
if (init_dpp != "")
    Cuit.dpp = parseInt(init_dpp);
let canvas = document.getElementById('circuit');
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


