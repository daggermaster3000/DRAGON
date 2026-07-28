// Modular pixel-art sprites. Each sprite is an array of rows; every character
// is one pixel mapped through PALETTE. The renderer pads ragged rows, but these
// are uniform per sprite. Add a new pet/dragon by adding a sprite set here;
// nothing else in the app changes.
//
// Sprites designed by a Fable pixel-art pass.

export type Stage = "baby" | "young" | "adult" | "legendary";

export const PALETTE: Record<string, string | null> = {
  ".": null, // transparent
  K: "#1a1a1a", // outline
  g: "#3fae5a", // green body
  G: "#2b7d40", // green shadow
  l: "#7fd89a", // green highlight
  b: "#f0e6c8", // cream belly
  W: "#7a5cc0", // wing membrane
  w: "#a98fd8", // wing highlight
  h: "#d8c48a", // horn / claw / spine (bone)
  e: "#ffffff", // eye white
  p: "#1a1a1a", // pupil
  f: "#f5a623", // flame outer
  r: "#e34948", // flame core
  y: "#f2c14e", // gold body (legendary)
  Y: "#c9962e", // gold shadow (legendary)
};

const baby = [
  ".....h....h.....",
  "....Kh....hK....",
  "....KKKKKKKK....",
  "...KggggggggK...",
  "..KggeeggeeggK..",
  "..KggppggppggK..",
  "...KggggggggK...",
  "....KggggggK....",
  ".....KggggK.....",
  "...KggggggggK...",
  "...KggbbbbggK...",
  "..KggbbbbbbggK..",
  "...KggbbbbggK...",
  "....KggggggK....",
  "......KggK......",
  "..Kb........bK..",
];

const young = [
  ".......h....h.......",
  "......Kh....hK......",
  "....KKKKKKKKKKKK....",
  "...KggggggggggggK...",
  "..KggeeggggggeeggK..",
  "..KggppggggggppggK..",
  "...KggggggggggggK...",
  "....KggggggggggK....",
  ".....KggggggggK.....",
  "...KggggggggggggK...",
  ".KWWKggbbbbbbggKWWK.",
  "KWWWKgbbbbbbbbgKWWWK",
  ".KwWKgbbbbbbbbgKWwK.",
  "..KWKgbbbbbbbbgKWK..",
  "...KggggggggggggK...",
  ".....Kgh....hgK.....",
  ".....KhhK..KhhK.....",
  "........KggK........",
];

const adult = [
  ".........h....h.........",
  "........Kh....hK........",
  "....KKKKKKKKKKKKKKKK....",
  "...KggggggggggggggggK...",
  "..KggeeggggggggggeeggK..",
  "..KggppggggggggggppggK..",
  "...KggggggggggggggggK...",
  "....KggggggggggggggK....",
  ".....KggggggggggggK.....",
  "....fr..KggKKggK..rf....",
  "......KggggggggggK......",
  ".....KggggggggggggK.....",
  "KWWwWKggggggggggggKWwWWK",
  ".KWwWKgbbbbbbbbbbgKWwWK.",
  "..KWwWKgbbbbbbbbgKWwWK..",
  "...KWwWKgbbbbbbgKWwWK...",
  "....KWKgbbbbbbbbgKWK....",
  ".....KWKgbbbbbbgKWK.....",
  "......KgbbbbbbbbgK......",
  ".......KggggggggK.......",
  ".....KhhK......KhhK.....",
  "..........KhhK..........",
];

const legendary = [
  "..........h......h..........",
  ".........Kh......hK.........",
  "........hKh......hKh........",
  "....KKKKKKKKKKKKKKKKKKKK....",
  "...KyyyyyyyyyyyyyyyyyyyyK...",
  "..KyyeeyyyyyyyyyyyyyyeeyyK..",
  "..KyyppyyyyyyyyyyyyyyppyyK..",
  "...KyyyyyyyyyyyyyyyyyyyyK...",
  "...hKyyyyyyyyyyyyyyyyyyKh...",
  "....KyyyyyyyyyyyyyyyyyyK....",
  ".....KyyyyyyyyyyyyyyyyK.....",
  "...........ffrrff...........",
  ".........fffrrrrfff.........",
  "..........ffrrrrff..........",
  "..........KyyyyyyK..........",
  ".........KyyyyyyyyK.........",
  "KWWWwWKyyyyyyyyyyyyyyKWwWWWK",
  ".KWWwWKybbbbbbbbbbbbyKWwWWK.",
  ".KhWwWKybbbbbbbbbbbbyKWwWhK.",
  "..KWwWKybbbbbbbbbbbbyKWwWK..",
  "...KWWKybbbbbbbbbbbbyKWWK...",
  "....KWKybbbbbbbbbbbbyKWK....",
  ".....KybbbbbbbbbbbbbbyK.....",
  "......KyyyyyyyyyyyyyyK......",
  "....KhhK...Kh..hK...KhhK....",
  "...KhhhK....KhhK....KhhhK...",
];

export const DRAGONS: Record<Stage, string[]> = { baby, young, adult, legendary };

export const STAGE_LABEL: Record<Stage, string> = {
  baby: "Baby dragon",
  young: "Young dragon",
  adult: "Adult dragon",
  legendary: "Legendary dragon",
};
