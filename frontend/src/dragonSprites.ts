// Modular pixel-art sprites. Each sprite is an array of rows; every character
// is one pixel mapped through PALETTE. Rows may be ragged — the renderer pads to
// the widest row. Add a new pet/dragon by adding a palette + a
// { baby, young, adult, legendary } sprite set; nothing else changes.

export type Stage = "baby" | "young" | "adult" | "legendary";

export const PALETTE: Record<string, string | null> = {
  ".": null, // transparent
  o: "#1f6f3f", // dark outline
  g: "#3fae5a", // body green
  l: "#6fd587", // light green highlight
  b: "#e9f7d0", // belly
  e: "#0b0b0b", // eye
  w: "#7a5cc0", // wing (young/adult)
  y: "#f2c14e", // gold body (legendary)
  Y: "#c9962e", // gold shadow
  f: "#e34948", // fire / flame
};

// 14x12 hatchling
const baby = [
  "......oo......",
  ".....ollo.....",
  "....ogggo.....",
  "...oglllgo....",
  "...ogeggego...",
  "...oglllgo....",
  "..ogggggggo...",
  "..oglbbblgo...",
  "..ogglllggo...",
  "...og...go....",
  "...oo...oo....",
  "..............",
];

// 16x14
const young = [
  ".......oo.......",
  "......ollo......",
  ".....ogggo..w...",
  "....oglllgo.ww..",
  "....ogeggego.www",
  "....oglllgo.ww..",
  "...oggggggggo...",
  "...oglbbbblgo...",
  "..oggglllgggo...",
  "..oggggggggggo..",
  "..ogg.....ggo...",
  "...oo.....oo....",
  "...............",
  "...............",
];

// 18x16 — wings out, first flame
const adult = [
  "........oo........",
  ".w.....ollo.....w.",
  "www...ogggo...www.",
  "wwww.oglllgo.wwww.",
  ".www.ogeggego.www.",
  "wwww.oglllgo.wwww.",
  "www.oggggggggo.ww.",
  "....oglbbbblgo....",
  "...oggglllgggo....",
  "...ogggggggggo....",
  "..oggogggggoggo...",
  "..oo.o.....o.oo...",
  ".....oo...oo......",
  ".......ff.........",
  ".......f..........",
  "..................",
];

// 20x18 — legendary gold, big wings, flame breath
const legendary = [
  "..........oo..........",
  ".w.......oYYo.......w..",
  "www.....oyYYyo.....www.",
  "wwww...oyyllyyo...wwww.",
  "wwwww..oyeyyyeyo.wwwww.",
  "wwww...oyyllyyo...wwww.",
  "www...oyyyyyyyyo...www.",
  "w....oyyybbbbyyo....w..",
  ".....oyyylllyyyo.......",
  "....oyyyyyyyyyyyo......",
  "....oyYyyyyyyyYyo......",
  "...oyyo.oyyyo.oyyo.....",
  "...oo....oyo....oo.....",
  "........offfo.........",
  "........offo..........",
  ".........ff...........",
  ".........f............",
  "......................",
];

export const DRAGONS: Record<Stage, string[]> = { baby, young, adult, legendary };

export const STAGE_LABEL: Record<Stage, string> = {
  baby: "Baby dragon",
  young: "Young dragon",
  adult: "Adult dragon",
  legendary: "Legendary dragon",
};
