// Pixel-art dragon sprites — cute curled dragon that grows: baby (sleeping) ->
// young (+wing) -> adult (+flame) -> legendary (gold + sparkles). Traced from a
// reference and hand-tuned. Each char maps through PALETTE; renderer pads ragged
// rows. Add a new pet by adding a sprite set; nothing else changes.

export type Stage = "baby" | "young" | "adult" | "legendary";

export const PALETTE: Record<string, string | null> = {
  ".": null,
  K: "#16233a", // navy outline
  g: "#3fb24a", // body green
  G: "#297834", // green shadow
  l: "#96e06e", // green highlight
  y: "#f0c450", // gold body (legendary)
  Y: "#c4962c", // gold shadow
  m: "#ffe296", // gold highlight
  W: "#7856c4", // wing membrane
  w: "#aa8cdc", // wing highlight
  f: "#f5a623", // flame outer
  r: "#e34948", // flame core
  s: "#ffeca0", // sparkle
};

const baby = [
  "..............KKKKK..........",
  "..............KKggK..........",
  "..............KKKKggg........",
  "..............KKKKKKgg.......",
  "..........KK...KKKKKKggK.....",
  ".........gKK...KKKKK...g.....",
  ".......KgKK...KKKKKK.........",
  ".......KKK..ggKKgKKKg........",
  ".....KKKKKggggKKKggggggK.....",
  "...KKKgggKgggKKKggggggggKK...",
  "..gKgKKggggKKKKgggKKKggggKK..",
  "..KKKgKgglgggKKggKggggggggKK.",
  "..KKKKgggglgggKKKglggggggggK.",
  "..KKKgggggggggKKKggggggggggKK",
  ".KKKgggggggggggKggggggggggggK",
  ".KKggggggggggggKKKgggggKggggK",
  ".KKggggggggggKgKKKKggggKggggK",
  ".gggggKggKggggKKKgKgggKKgggg.",
  "KKKKgggKKKgglgggKKKKKKKgggggK",
  "KKKKKgggggggKgggKgKKKKglgggKK",
  "..KKKggggggggggKgKgggggggggK.",
  "..KgKKKgggggggKKKgggggggggK..",
  "..KKgggKgKKKKKKKggKgggggKK...",
  "..KKKgKgKgKKKKK.KKKKKKK......",
  "....KKKK..KKKK.......K.......",
];

const young = [
  "..............KKKKK..........",
  "..............KKggKKK........",
  "..............KKKKgWWK.......",
  "..............KKKKWWWwK......",
  ".........KKK...KKWWWWwgK.....",
  "........KgKK...KKKWWwKKgK....",
  ".......KgKK.KKKKKKKWwK.K.....",
  ".......KKKKKggKKgKKKgKK......",
  ".....KKKKKggggKKKggggggK.....",
  "..KKKKgggKgggKKKggggggggKK...",
  ".KgKgKKggggKKKKgggKKKggggKK..",
  "..KKKgKgglgggKKggKggggggggKK.",
  "..KKKKgggglgggKKKglggggggggK.",
  "..KKKgggggggggKKKggggggggggKK",
  ".KKKgggggggggggKggggggggggggK",
  ".KKggggggggggggKKKgggggKggggK",
  ".KKggggggggggKgKKKKggggKggggK",
  "KgggggKggKggggKKKgKgggKKggggK",
  "KKKKgggKKKgglgggKKKKKKKgggggK",
  "KKKKKgggggggKgggKgKKKKglgggKK",
  "..KKKggggggggggKgKgggggggggK.",
  "..KgKKKgggggggKKKgggggggggK..",
  "..KKgggKgKKKKKKKggKgggggKK...",
  "..KKKgKgKgKKKKK.KKKKKKKK.....",
  "....KKKK.KKKKK.......K.......",
];

const adult = [
  "..............KKKWWKK........",
  "..............KKWWWWwK.......",
  "..............KWWWWWWwK......",
  "..............KWWWWWWWwK.....",
  ".........KKK...KWWWWWwgK.....",
  "........KgKK...KKWWWwKKgK....",
  ".......KgKK.KKKKKKWWK..K.....",
  ".......KKKKKggKKgKKKgKK......",
  ".....KKKKKggggKKKggggggK.....",
  "..KKKKgggKgggKKKggggggggKK...",
  ".KgKgKKggggKKKKgggKKKggggKK..",
  "..KKKgKgglgggKKggKggggggggKK.",
  "..KKKKgggglgggKKKglggggggggK.",
  "..KKKgggggggggKKKggggggggggKK",
  ".KKKgggggggggggKggggggggggggK",
  ".KKggggggggggggKKKgggggKggggK",
  ".KKggggggggggKgKKKKggggKggggK",
  "KgggggKggKggggKKKgKgggKKggggK",
  "KKKKgggKKKgglgggKKKKKKKgggggK",
  "KfKKKgggggggKgggKgKKKKglgggKK",
  "ffKKKggggggggggKgKgggggggggK.",
  "rfKgKKKgggggggKKKgggggggggK..",
  "r.KKgggKgKKKKKKKggKgggggKK...",
  "..KKKgKgKgKKKKK.KKKKKKKK.....",
  "....KKKK.KKKKK.......K.......",
];

const legendary = [
  "..............KKKWWKK........",
  "..s...........KKWWWWwK...s...",
  ".s.s..........KWWWWWWwK.s.s..",
  "..s...........KWWWWWWWwK.s...",
  ".........KKK...KWWWWWwyK.....",
  "........KyKK...KKWWWwKKyK....",
  ".......KyKK.KKKKKKWWK..K.....",
  ".......KKKKKyyKKyKKKyKK......",
  ".....KKKKKyyyyKKKyyyyyyK.....",
  "..KKKKyyyKyyyKKKyyyyyyyyKK...",
  ".KyKyKKyyyyKKKKyyyKKKyyyyKK..",
  "..KKKyKyymyyyKKyyKyyyyyyyyKK.",
  "..KKKKyyyymyyyKKKymyyyyyyyyK.",
  "..KKKyyyyyyyyyKKKyyyyyyyyyyKK",
  ".KKKyyyyyyyyyyyKyyyyyyyyyyyyK",
  ".KKyyyyyyyyyyyyKKKyyyyyKyyyyK",
  ".KKyyyyyyyyyyKyKKKKyyyyKyyyyK",
  "KyyyyyKyyKyyyyKKKyKyyyKKyyyyK",
  "KKKKyyyKKKyymyyyKKKKKKKyyyyyK",
  "KfKKKyyyyyyyKyyyKyKKKKymyyyKK",
  "ffKKKyyyyyyyyyyKyKyyyyyyyyyK.",
  "rfKyKKKyyyyyyyKKKyyyyyyyyyK..",
  "r.KKyyyKyKKKKKKKyyKyyyyyKK...",
  "..KKKyKyKyKKKKK.KKKKKKKK.....",
  "....KKKK.KKKKK.......K.......",
];

export const DRAGONS: Record<Stage, string[]> = { baby, young, adult, legendary };

export const STAGE_LABEL: Record<Stage, string> = {
  baby: "Baby dragon",
  young: "Young dragon",
  adult: "Adult dragon",
  legendary: "Legendary dragon",
};
