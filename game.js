<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Herzrasen 💖</title>

  <style>
    body {
      margin: 0;
      background: #120c18;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      font-family: sans-serif;
    }

    canvas {
      image-rendering: pixelated;
      border: 4px solid #ff7ab6;
      border-radius: 12px;
      box-shadow: 0 0 30px rgba(255, 122, 182, 0.4);
    }
  </style>
</head>
<body>

<canvas id="game"></canvas>

<script type="module">

import kaboom from "https://unpkg.com/kaboom/dist/kaboom.mjs";

kaboom({
  global: true,
  canvas: document.querySelector("#game"),
  width: 384,
  height: 216,
  scale: 3,
  background: [26, 20, 35],
});

// Farben
const PINK = color(255, 122, 182);
const ROSE = color(255, 203, 230);
const GOLD = color(255, 222, 89);
const SKY  = color(170, 200, 255);

const SPEED = 130;
const JUMP = 360;
const GRAVITY = 980;

setGravity(GRAVITY);

// ------------------------------------
// PIXEL SPRITES
// ------------------------------------

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

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {

      const on = pat[y][x] === "1";
      const i = (y * 8 + x) * 4;

      g.data[i + 0] = on ? 255 : 0;
      g.data[i + 1] = on ? 80 : 0;
      g.data[i + 2] = on ? 130 : 0;
      g.data[i + 3] = on ? 255 : 0;
    }
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

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {

      const on = pat[y][x] === "1";
      const i = (y * 8 + x) * 4;

      g.data[i + 0] = on ? 255 : 0;
      g.data[i + 1] = on ? 220 : 0;
      g.data[i + 2] = on ? 120 : 0;
      g.data[i + 3] = on ? 255 : 0;
    }
  }

  return g;
}

function imgFromImageData(id) {

  const c = document.createElement("canvas");

  c.width = id.width;
  c.height = id.height;

  const ctx = c.getContext("2d");

  ctx.putImageData(id, 0, 0);

  return c.toDataURL();
}

loadSprite("heart8", imgFromImageData(heartSprite()));
loadSprite("spark", imgFromImageData(starSprite()));

// ------------------------------------
// EXTERNE SPRITES
// ------------------------------------

loadSprite("player", "https://i.imgur.com/Wb1qfhK.png");
loadSprite("foe", "https://i.imgur.com/6L89G7s.png");
loadSprite("rose", "https://i.imgur.com/u5KQ4hQ.png");

// ------------------------------------
// SOUND
// ------------------------------------

function blip(freq = 880, dur = 0.08, type = "square", vol = 0.05) {

  const AC = window.AudioContext || window.webkitAudioContext;

  if (!AC) return;

  const ac = new AC();

  const o = ac.createOscillator();
  const g = ac.createGain();

  o.type = type;
  o.frequency.value = freq;

  g.gain.value = vol;

  o.connect(g);
  g.connect(ac.destination);

  o.start();
  o.stop(ac.currentTime + dur);

  setTimeout(() => ac.close(), (dur + 0.05) * 1000);
}

const sfx = {

  jump: () => blip(520, 0.08, "square"),

  pick: () => blip(960, 0.06, "square"),

  hit: () => blip(200, 0.10, "sawtooth"),

  ok: () => {
    blip(700, 0.06);
    setTimeout(() => blip(900, 0.06), 70);
  },

  bad: () => {
    blip(200, 0.10, "triangle");
    setTimeout(() => blip(140, 0.12, "triangle"), 90);
  },
};

// ------------------------------------
// GAME STATE
// ------------------------------------

let stats = {
  hearts: 0,
  roses: 0,
  time: 0,
  lives: 3,
  level: 0,
};

// ------------------------------------
// LEVELS
// ------------------------------------

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

// ------------------------------------
// PARTICLES
// ------------------------------------

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

    s.onUpdate(() => {
      s.pos = s.pos.add(
        rand(-20, 20) * dt(),
        rand(-20, 20) * dt()
      );
    });
  }
}

// ------------------------------------
// HUD
// ------------------------------------

function drawHUD() {

  drawRect({
    width: width(),
    height: 20,
    pos: vec2(0, 0),
    color: rgb(40, 24, 50),
  });

  drawText({
    text: `❤ ${stats.hearts}   🌹 ${stats.roses}   ✨ Leben ${stats.lives}   ⏱ ${Math.floor(stats.time)}s`,
    size: 12,
    pos: vec2(6, 6),
    color: ROSE,
    font: "sink",
  });

  drawText({
    text: LEVELS[stats.level].name,
    size: 10,
    pos: vec2(width() - 200, 6),
    color: GOLD,
    font: "sink",
  });
}

// ------------------------------------
// STARTSCREEN
// ------------------------------------

scene("logo", () => {

  setBackground(SKY);

  add([
    text("HERZRASEN", { size: 32 }),
    pos(center().x, center().y - 30),
    anchor("center"),
    color(255,180,220),
  ]);

  add([
    text("Ein mega-kitschiges Date-Adventure", { size: 14 }),
    pos(center().x, center().y + 2),
    anchor("center"),
    color(255,220,240),
  ]);

  add([
    text("Enter starten", { size: 12 }),
    pos(center().x, center().y + 40),
    anchor("center"),
    color(255,240,255),
  ]);

  onKeyPress("enter", () => go("level"));
});

// ------------------------------------
// TILES
// ------------------------------------

function tileSolid(w = 16, h = 16, c = [90, 70, 120]) {

  return [
    rect(w, h),
    area(),
    body({ isStatic: true }),
    color(...c),
  ];
}

function tileCloud() {
  return [
    rect(16, 8),
    area(),
    color(200, 210, 255),
  ];
}

// ------------------------------------
// LEVEL BUILD
// ------------------------------------

function buildLevel(i) {

  const L = LEVELS[i];

  setBackground(rgb(...L.bg));

  addLevel(L.map, {

    tileWidth: 16,
    tileHeight: 16,

    tiles: {

      "=": () => tileSolid(16,16,[110,90,140]),

      "c": () => tileCloud(),

      "p": () => [
        sprite("player"),
        area(),
        body(),
        anchor("center"),
        "player",
      ],

      "h": () => [
        sprite("heart8"),
        area(),
        anchor("center"),
        "heart",
      ],

      "r": () => [
        sprite("rose"),
        area(),
        anchor("center"),
        "rose",
      ],

      "f": () => [
        sprite("foe"),
        area(),
        anchor("center"),
        "foe",
        { dir: 1 },
      ],

      " ": () => [],
    },
  });

  const player = get("player")[0];

  // Kamera + Zeit

  onUpdate(() => {

    camPos(
      vec2(
        clamp(player.pos.x, width()/2, 9999),
        height()/2
      )
    );

    stats.time += dt();
  });

  // Gegner

  onUpdate(() => {

    get("foe").forEach(f => {

      f.move(50 * f.dir, 0);

      if (rand(0,1) < 0.005) {
        f.dir *= -1;
      }
    });
  });

  // Steuerung

  onKeyDown("left", () => player.move(-SPEED, 0));
  onKeyDown("a", () => player.move(-SPEED, 0));

  onKeyDown("right", () => player.move(SPEED, 0));
  onKeyDown("d", () => player.move(SPEED, 0));

  onKeyPress("space", () => {

    if (player.isGrounded()) {

      player.jump(JUMP);

      sfx.jump();

      sparkleBurst(player.pos, 6);
    }
  });

  // Sammeln

  player.onCollide("heart", (c) => {

    destroy(c);

    stats.hearts += 1;

    sfx.pick();

    sparkleBurst(c.pos, 10);
  });

  player.onCollide("rose", (c) => {

    destroy(c);

    stats.roses += 1;

    sfx.ok();

    sparkleBurst(c.pos, 14);
  });

  // Gegnerkontakt

  player.onCollide("foe", (f) => {

    if (player.vel.y > 0) {

      destroy(f);

      player.jump(JUMP * 0.8);

      sfx.ok();

      sparkleBurst(f.pos, 12);

    } else {

      stats.lives -= 1;

      sfx.hit();

      sparkleBurst(player.pos, 16);

      if (stats.lives <= 0) {

        go("fail");

      } else {

        player.pos = player.pos.add(-20, -10);
      }
    }
  });

  // Levelende

  onUpdate(() => {

    if (player.pos.x > (L.map[0].length * 16) - 24) {

      go("dialog");
    }
  });

  onDraw(drawHUD);
}

// ------------------------------------
// LEVEL SCENE
// ------------------------------------

scene("level", () => {

  if (stats.level === 0) {

    stats.hearts = 0;
    stats.roses = 0;
    stats.time = 0;
    stats.lives = 3;
  }

  buildLevel(stats.level);
});

// ------------------------------------
// DIALOG OPTIONS
// ------------------------------------

function dialogOptions() {

  const generous =
    stats.hearts >= 4 ||
    stats.roses >= 2;

  const mid =
    stats.hearts >= 2 ||
    stats.roses >= 1;

  if (generous) {

    return [
      {
        text: "Ein Gedicht über deine Sommersprossen vortragen 💖",
        good: true,
      },

      {
        text: "Einhand-Kuchen backen 🎂",
        good: true,
      },

      {
        text: "Sofort Heiratsurkunde zücken 💍",
        good: false,
      },
    ];
  }

  if (mid) {

    return [
      {
        text: "Charmanten Witz erzählen 😌",
        good: true,
      },

      {
        text: "Über Hobbys sprechen 🎨",
        good: true,
      },

      {
        text: "Nur über Games reden 🎮",
        good: false,
      },
    ];
  }

  return [
    {
      text: "Smalltalk über Wetter ☁️",
      good: false,
    },

    {
      text: "Peinliche Stille 😶",
      good: false,
    },

    {
      text: "Unsicheres Kompliment 🌹",
      good: true,
    },
  ];
}

// ------------------------------------
// DIALOG SCENE
// ------------------------------------

scene("dialog", () => {

  setBackground(rgb(30,18,40));

  add([
    rect(width()-40, height()-60),
    pos(20,30),
    color(40,24,50),
    outline(2, PINK),
  ]);

  add([
    text("Date-Time! 💞", { size: 20 }),
    pos(32,40),
    color(ROSE),
  ]);

  const opts = dialogOptions();

  let idx = 0;

  function drawOpts() {

    destroyAll("opt");

    opts.forEach((o, i) => {

      add([
        text(
          (i === idx ? "> " : "  ") + o.text,
          { size: 14 }
        ),

        pos(40, 90 + i * 22),

        color(i === idx ? PINK : ROSE),

        "opt",
      ]);
    });
  }

  drawOpts();

  onKeyPress("up", () => {
    idx = (idx + opts.length - 1) % opts.length;
    drawOpts();
  });

  onKeyPress("down", () => {
    idx = (idx + 1) % opts.length;
    drawOpts();
  });

  onKeyPress("enter", () => {

    const ok = opts[idx].good;

    if (ok) sfx.ok();
    else sfx.bad();

    go("result", { ok });
  });
});

// ------------------------------------
// RESULT
// ------------------------------------

scene("result", ({ ok }) => {

  setBackground(ok
    ? rgb(40,18,50)
    : rgb(18,10,16)
  );

  add([
    text(
      ok
        ? "Perfect Match ❤️❤️❤️"
        : "Vielleicht nächstes Mal 💔",

      { size: 22 }
    ),

    pos(center()),

    anchor("center"),

    color(ok ? ROSE : PINK),
  ]);

  add([
    text("Enter = Weiter", { size: 12 }),

    pos(center().x, center().y + 40),

    anchor("center"),

    color(GOLD),
  ]);

  onKeyPress("enter", () => {

    if (ok) {

      if (stats.level < LEVELS.length - 1) {

        stats.level++;

        go("level");

      } else {

        go("finale");
      }

    } else {

      go("level");
    }
  });
});

// ------------------------------------
// FAIL
// ------------------------------------

scene("fail", () => {

  setBackground(rgb(24,8,14));

  add([
    text("GAME OVER 💔", { size: 26 }),
    pos(center()),
    anchor("center"),
    color(PINK),
  ]);

  add([
    text("R = Neustart", { size: 12 }),
    pos(center().x, center().y + 40),
    anchor("center"),
    color(ROSE),
  ]);

  onKeyPress("r", () => {

    stats = {
      hearts: 0,
      roses: 0,
      time: 0,
      lives: 3,
      level: 0,
    };

    go("level");
  });
});

// ------------------------------------
// FINALE
// ------------------------------------

scene("finale", () => {

  setBackground(rgb(45,16,50));

  add([
    text("ULTRA MATCH 💞💍", { size: 28 }),
    pos(center().x, 60),
    anchor("center"),
    color(ROSE),
  ]);

  add([
    text("Kitsch-Overdrive aktiviert!", { size: 14 }),
    pos(center().x, 100),
    anchor("center"),
    color(GOLD),
  ]);

  sparkleBurst(center(), 50);

  add([
    text("Enter = Neustart", { size: 12 }),
    pos(center().x, height() - 40),
    anchor("center"),
    color(ROSE),
  ]);

  onKeyPress("enter", () => {

    stats = {
      hearts: 0,
      roses: 0,
      time: 0,
      lives: 3,
      level: 0,
    };

    go("level");
  });
});

// ------------------------------------
// START
// ------------------------------------

go("logo");

</script>

</body>
</html>
