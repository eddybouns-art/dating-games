// Herzrasen: Kitsch-Quest — super-kitschiger Dating-Plattformer
// Steuerung: Links/Rechts (Pfeile oder A/D), Space = Sprung, Enter = Auswahl, R = Neustart

import kaboom from "https://unpkg.com/kaboom/dist/kaboom.mjs";

kaboom({
  global: true,
  canvas: document.querySelector("#game"),
  width: 384,
  height: 216,
  scale: 3,
  background: [26, 20, 35],
});

// Farben + Effekte
const PINK = color(255, 122, 182);
const ROSE = color(255, 203, 230);
const GOLD = color(255, 222, 89);
const SKY  = color(170, 200, 255);

const SPEED = 130;
const JUMP = 360;
const GRAVITY = 980;
setGravity(GRAVITY);

// Minimalsprites (Pixel-Herz & Stern)
function heartSprite() {
  const g = new ImageData(8, 8);
  const pat = [
    "00100100",
    "01111110",
    "11111111",
    "11111111",
    "11111111",
    "01111110",
    "00111100",
    "00011000",
  ];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const on = pat[y][x] === "1";
    const i = (y * 8 + x) * 4;
    g.data[i + 0] = on ? 255 : 0;
    g.data[i + 1] = on ? 80 : 0;
    g.data[i + 2] = on ? 130 : 0;
    g.data[i + 3] = on ? 255 : 0;
  }
  return g;
}
function starSprite() {
  const g = new ImageData(8, 8);
  const pat = [
    "00010000",
    "00010000",
    "11111111",
    "00010000",
    "00010000",
    "00111000",
    "00010000",
    "00000000",
  ];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const on = pat[y][x] === "1";
    const i = (y * 8 + x) * 4;
    g.data[i + 0] = on ? 255 : 255;
    g.data[i + 1] = on ? 220 : 255;
    g.data[i + 2] = on ? 120 : 255;
    g.data[i + 3] = on ? 255 : 0;
  }
  return g;
}
function imgFromImageData(id) {
  const c = document.createElement("canvas");
  c.width = id.width; c.height = id.height;
  const ctx = c.getContext("2d");
  ctx.putImageData(id, 0, 0);
  return c.toDataURL();
}
loadSprite("heart8", imgFromImageData(heartSprite()));
loadSprite("spark", imgFromImageData(starSprite()));

// Einfache Tiles (solid ersetzt durch statische body-Physik)
function tileSolid(w = 16, h = 16, c = [90, 70, 120]) {
  return [rect(w, h), area(), body({ isStatic: true }), color(...c)];
}
function tileCloud() { return [rect(16, 8), area(), color(200, 210, 255)]; }

// Platzhalter-Sprites (kannst du später ersetzen)
loadSprite("player", "[i.imgur.com](https://i.imgur.com/Wb1qfhK.png)");
loadSprite("foe",    "[i.imgur.com](https://i.imgur.com/6L89G7s.png)");
loadSprite("rose",   "[i.imgur.com](https://i.imgur.com/u5KQ4hQ.png)");

// Mini-SFX
function blip(freq = 880, dur = 0.08, type = "square", vol = 0.05) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ac = new AC();
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur);
  setTimeout(() => ac.close(), (dur + 0.05) * 1000);
}
const sfx = {
  jump: () => blip(520, 0.08, "square"),
  pick: () => blip(960, 0.06, "square"),
  hit:  () => blip(200, 0.10, "sawtooth"),
  ok:   () => { blip(700,0.06); setTimeout(()=>blip(900,0.06),70); },
  bad:  () => { blip(200,0.10,"triangle"); setTimeout(()=>blip(140,0.12,"triangle"),90); },
};

// Spielzustand
let stats = { hearts: 0, roses: 0, time: 0, lives: 3, level: 0 };

const LEVELS = [
  {
    name: "Level 1 — Zuckerwatte-Wiese",
    bg: [26,20,35],
    map: [
      "==============================",
      "=            h      r      ==",
      "=         ===          ==   =",
      "=    r         h            =",
      "=                 ==     f  =",
      "= p      ==           r     =",
      "==============================",
    ],
  },
  {
    name: "Level 2 — Regenbogen-Brücke",
    bg: [18,16,30],
    map: [
      "==============================",
      "= c   ===      r     h     ==",
      "=   r      ===      f      =",
      "=      h         ===       =",
      "=   f        r             =",
      "= p      ==        r    h  =",
      "==============================",
    ],
  },
  {
    name: "Level 3 — Glitzer-Garten",
    bg: [16,12,24],
    map: [
      "==============================",
      "= r  h   f     r   h     r ==",
      "=    ===      ===      === =",
      "=     r     f      r       =",
      "=   h      ===   h     f   =",
      "= p   ==      r       h    =",
      "==============================",
    ],
  },
];

// Partikel
function sparkleBurst(p, n = 8) {
  for (let i = 0; i < n; i++) {
    const s = add([
      sprite("spark"),
      pos(p.add(rand(-6, 6), rand(-6, 6))),
      anchor("center"),
      scale(rand(0.8, 1.4)),
      lifespan(0.4, { fade: 0.2 }),
      color(255, 230, 140),
    ]);
    s.onUpdate(() => s.pos = s.pos.add(rand(-20, 20) * dt(), rand(-20, 20) * dt()));
  }
}

// HUD
function drawHUD() {
  drawRect({ width: width(), height: 20, pos: vec2(0, 0), color: rgb(40, 24, 50) });
  drawText({ text: `❤ ${stats.hearts}   🌹 ${stats.roses}   ✨ Leben ${stats.lives}   ⏱ ${Math.floor(stats.time)}s`, size: 12, pos: vec2(6, 6), color: ROSE, font: "sink" });
  drawText({ text: LEVELS[stats.level].name, size: 10, pos: vec2(width() - 200, 6), color: GOLD, font: "sink" });
}

// Startscreen
scene("logo", () => {
  setBackground(SKY);
  add([text("HERZRASEN", { size: 32 }), pos(center().x, center().y - 30), anchor("center"), color(255,180,220)]);
  add([text("Ein mega-kitschiges Date-Adventure", { size: 14 }), pos(center().x, center().y + 2), anchor("center"), color(255,220,240)]);
  add([text("Enter starten", { size: 12 }), pos(center().x, center().y + 40), anchor("center"), color(255,240,255)]);
  onKeyPress("enter", () => go("level"));
  onKeyPress("r", () => go("level"));
});

function buildLevel(i) {
  const L = LEVELS[i];
  setBackground(rgb(...L.bg));

  addLevel(L.map, {
    tileWidth: 16,
    tileHeight: 16,
    tiles: {
      "=": () => tileSolid(16,16,[110,90,140]),
      "c": () => tileCloud(),
      "_": () => [rect(16, 2), area(), "oneway"],
      "p": () => [sprite("player"), area({ shape: new Rect(vec2(0), 12,14) }), body(), anchor("center"), "player"],
      "h": () => [sprite("heart8"), area(), anchor("center"), "heart"],
      "r": () => [sprite("rose"), area(), anchor("center"), "rose"],
      "f": () => [sprite("foe"), area({ shape: new Rect(vec2(0), 12,10) }), anchor("center"), "foe", { dir: 1 }],
      " ": () => [],
    },
  });

  const player = get("player")[0];

  // Kamera + Zeit
  onUpdate(() => {
    camPos(vec2(clamp(player.pos.x, width()/2, 9999), height()/2));
    stats.time += dt();
  });

  // Gegner-Patrouillen
  onUpdate(() => {
    get("foe").forEach(f => {
      f.move(50 * f.dir, 0);
      if (rand(0,1) < 0.005) f.dir *= -1;
    });
  });

  // Steuerung
  onKeyDown("left",  () => player.move(-SPEED, 0));
  onKeyDown("a",     () => player.move(-SPEED, 0));
  onKeyDown("right", () => player.move(SPEED, 0));
  onKeyDown("d",     () => player.move(SPEED, 0));
  onKeyPress("space", () => {
    if (player.isGrounded()) { player.jump(JUMP); sfx.jump(); sparkleBurst(player.pos, 6); }
  });

  // Sammeln
  player.onCollide("heart", (c) => { destroy(c); stats.hearts += 1; sfx.pick(); sparkleBurst(c.pos, 10); });
  player.onCollide("rose",  (c) => { destroy(c); stats.roses  += 1; sfx.ok(); sparkleBurst(c.pos, 14); });

  // Gegnerkontakt
  player.onCollide("foe", (f) => {
    if (player.vel.y > 0) {
      destroy(f);
      player.jump(JUMP * 0.8);
      sfx.ok(); sparkleBurst(f.pos, 12);
    } else {
      sfx.hit(); sparkleBurst(player.pos, 16);
      player.color = rgb(255,80,120);
      wait(0.1, () => player.color = rgb(255,255,255));
      stats.lives -= 1;
      if (stats.lives <= 0) {
        go("fail");
      } else {
        player.pos = player.pos.add(-20, -10);
      }
    }
  });

  // Levelende rechts
  onUpdate(() => {
    if (player.pos.x > (L.map[0].length * 16) - 24) go("dialog");
  });

  onDraw(drawHUD);
}

scene("level", () => {
  if (stats.level === 0) { stats.hearts = 0; stats.roses = 0; stats.time = 0; stats.lives = 3; }
  buildLevel(stats.level);
});

function dialogOptions() {
  const generous = stats.hearts >= 4 || stats.roses >= 2;
  const mid = stats.hearts >= 2 || stats.roses >= 1;
  if (generous) {
    return [
      { text: "Ein Gedicht über deine Sommersprossen vortragen 💖", good: true },
      { text: "Einhand-Kuchen backen & Kerze wünschen 🎂", good: true },
      { text: "Sofort Heiratsurkunde aus dem Nichts zücken 💍", good: false },
    ];
  } else if (mid) {
    return [
      { text: "Charmanten Witz erzählen 😌", good: true },
      { text: "Ehrlich über Hobbys sprechen 🎨", good: true },
      { text: "Nur über Highscores reden 🎮", good: false },
    ];
  }
  return [
    { text: "Smalltalk über Wetter ☁️", good: false },
    { text: "Peinliche Stille akzeptieren 😶", good: false },
    { text: "Unsicheres Kompliment stammeln 🌹", good: true },
  ];
}

scene("dialog", () => {
  setBackground(rgb(30, 18, 40));
  add([rect(width() - 40, height() - 60), pos(20,30), color(40,24,50), outline(2, PINK), area()]);
  add([text("Date-Time! 💞", { size: 20 }), pos(32, 40), color(ROSE)]);
  add([text(`Hearts: ${stats.hearts}  |  Roses: ${stats.roses}  |  Time: ${Math.floor(stats.time)}s`, { size: 12 }), pos(32, 66), color(GOLD)]);

  const lines = [
    "Vor dir steht die funkelnde Person deiner Träume.",
    "Die Luft riecht nach Zuckerwatte. Ein Regenbogen applaudiert leise.",
    "Was tust du?",
  ];
  lines.forEach((t,i)=> add([text(t, { size: 12 }), pos(32, 90 + i*16), color(ROSE)]));

  const opts = dialogOptions();
  let idx = 0;

  function drawOpts() {
    destroyAll("opt");
    opts.forEach((o, i) => {
      add([text((i===idx?"> ":"  ")+o.text, { size: 14 }), pos(40, 160 + i*18), color(i===idx?PINK:ROSE), "opt"]);
    });
  }
  drawOpts();

  onKeyPress("up",   () => { idx = (idx + opts.length - 1) % opts.length; drawOpts(); });
  onKeyPress("down", () => { idx = (idx + 1) % opts.length; drawOpts(); });
  onKeyPress("enter", () => { const ok = opts[idx].good; if (ok) sfx.ok(); else sfx.bad(); go("result", { ok }); });
  onKeyPress("r", () => go("level"));
});

scene("result", ({ ok }) => {
  setBackground(ok ? rgb(40, 18, 50) : rgb(18, 10, 16));
  const msg = ok ? "Perfect Match! ❤️❤️❤️" : "Uff... vielleicht nächstes Mal. 💔";
  const sub = ok
    ? "Ihr lacht, funkt, und es regnet Konfetti aus rosa Sternen!"
    : "Der Regenbogen seufzt. Eine Taube reicht dir Schokolade tröstend.";

  add([text(msg, { size: 22 }), pos(center().x, center().y - 24), anchor("center"), color(ok?ROSE:PINK)]);
  add([text(sub, { size: 12 }), pos(center().x, center().y + 2), anchor("center"), color(GOLD)]);
  add([text("Enter = Weiter  •  R = Neustart", { size: 12 }), pos(center().x, center().y + 28), anchor("center"), color(ROSE)]);

  sparkleBurst(center(), 24);

  onKeyPress("enter", () => {
    if (ok) {
      if (stats.level < LEVELS.length - 1) { stats.level += 1; go("level"); }
      else { go("finale"); }
    } else {
      go("level");
    }
  });
  onKeyPress("r", () => { stats.level = 0; go("level"); });
});

scene("fail", () => {
  setBackground(rgb(24, 8, 14));
  add([text("Oh nein! Alle Leben weg. 💔", { size: 20 }), pos(center().x, center().y - 10), anchor("center"), color(PINK)]);
  add([text("R = Neustart", { size: 12 }), pos(center().x, center().y + 14), anchor("center"), color(ROSE)]);
  onKeyPress("r", () => { stats = { hearts:0, roses:0, time:0, lives:3, level:0 }; go("level"); });
});

scene("finale", () => {
  setBackground(rgb(45, 16, 50));
  add([text("ULTRA MATCH 💞💍", { size: 26 }), pos(center().x, 40), anchor("center"), color(ROSE)]);
  add([text("Kitsch-Overdrive aktiviert!", { size: 14 }), pos(center().x, 70), anchor("center"), color(GOLD)]);
  const bars = [];
  for (let i=0;i<10;i++) bars.push(add([rect(width(), 8), pos(0, 100 + i*10), color(hsl2rgb(rand(0,1), 0.8, 0.6)), "bar"]));
  onUpdate(()=> bars.forEach((b,i)=> { b.pos.x = (b.pos.x - (20+i*2)*dt()) % width(); }));
  sparkleBurst(center(), 40);
  add([text("Danke fürs Spielen! Enter = New Game", { size: 12 }), pos(center().x, height()-40), anchor("center"), color(ROSE)]);
  onKeyPress("enter", () => { stats = { hearts:0, roses:0, time:0, lives:3, level:0 }; go("level"); });
  onKeyPress("r", () => { stats = { hearts:0, roses:0, time:0, lives:3, level:0 }; go("level"); });
});

// Start
go("logo");
