/**
 * The yarn colours used across the shop. Each has CSS tokens in src/styles/global.css:
 * --<colour> (dark enough for text), --<colour>-bright (stitches and decoration) and
 * --<colour>-soft (backgrounds). Add the class `yarn-<colour>` to colour an element and what's inside it.
 */
export const yarnColours = ['berry', 'coral', 'marigold', 'mint', 'teal', 'lilac'] as const;

export type YarnColour = (typeof yarnColours)[number];
