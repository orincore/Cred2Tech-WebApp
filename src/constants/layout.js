// Shared layout constants for the case-journey wizards.

/**
 * The single content width for every step of the case journey.
 *
 * Each step used to keep whatever width it happened to have before these pages
 * were folded into one wizard (steps 1-3: 880, 4: 960, 5: 980, 6: 1040, 7: full
 * bleed), and the salaried entry wizard hard-coded its own 880. Because the
 * stepper and page header sit inside this same column, the whole page visibly
 * jumped wider at each step, then ran edge-to-edge on step 7 — the gutters were
 * never the same twice, and a salaried case jumped again when it handed off to
 * the shared wizard at step 4.
 *
 * 1040 is the widest of the previous fixed values, so nothing that had a fixed
 * width gets narrower. Both wizards import this so they cannot drift apart
 * again.
 */
export const WIZARD_MAX_WIDTH = 1040;
