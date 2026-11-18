// Dip Hunter: a flat-by-default mean-reversion bot for cbBTC on 1-minute bars.
//
// What the dev window actually shows: the price snaps back fast after a sharp
// short drop, while longer trends mostly reverse and short rises fade. So the
// bot sits in cash almost all day and buys only on one confirmed signal -- a
// sharp 10-minute drop whose fall has just paused -- then exits quickly with
// a take-profit, a stop-loss, a trailing stop or a time exit. It never holds
// through chop, never chases a rise, and never buys while the price is still
// falling. One position at a time, full size, a short cooldown after every
// exit, and no new entries in the last 30 bars (an entry that late would only
// pay the final flatten). Long only, no leverage, deterministic: the same bars
// give the same orders on every run.
//
// Signals are measured on closes only, in basis points, with plain float64
// arithmetic (the same operations in the same order every run, so the result
// is bit-identical run after run). Orders fill at the next bar's open, so the
// entry decision is always made on the close just seen and the exit on the
// position's cost as the harness reports it (cost already includes the buy
// fee, and the quantity received already reflects slippage and impact).

import { runBars, type BarsState, type Batch } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";

/** A reversal buy: the close has fallen this far over the last REV_WIN bars,
 *  and the fall has paused over the last TURN_WIN bars (that return at or
 *  above zero). Both must hold on the same close. */
const REV_WIN = 10;
const REV_BPS = 60;
const TURN_WIN = 2;
const TURN_BPS = 0;
/** Exit when the position is worth this much over its cost (bps). */
const TAKE_BPS = 120;
/** Exit when the position is worth this much under its cost (bps). */
const STOP_BPS = 80;
/** Exit when the position has fallen this far from its peak value (bps). */
const TRAIL_BPS = 50;
/** Exit after this many bars held, whatever the price. */
const MAX_HOLD = 15;
/** Bars to stay flat after an exit before any new entry. */
const COOLDOWN = 10;
/** No new entries on or after this batch (the window has 1440 bars). */
const NO_ENTRY_AFTER = 1410;
/** Slippage cap on every order, measured from the latest close. One-minute
 *  moves on this market stay well under this, so fills are rarely refused. */
const MAX_SLIP = 150;

/** Closes seen so far, oldest first, as plain numbers (raw price units). */
const closes: number[] = [];
/** Bars since the last exit; 0 means free to enter. */
let cooldown = 0;
/** Bars held of the current position, and its peak value while held. */
let heldBars = 0;
let peakValue = 0n;

/** Return of the close now versus the close `win` bars back, in bps. */
function retBps(win: number): number | null {
  const n = closes.length;
  if (n <= win) return null;
  const then = closes[n - 1 - win];
  const now = closes[n - 1];
  if (then <= 0) return null;
  return ((now - then) * 10000) / then;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c));
    }
    if (closes.length === 0) return [];
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      heldBars += 1;
      const value = state.value(SYMBOL, held.qty);
      if (value > peakValue) peakValue = value;
      const cost = held.cost;
      // Take profit, stop loss, trailing stop, time exit -- whichever first.
      const take = value * 10000n >= cost * BigInt(10000 + TAKE_BPS);
      const stop = value * 10000n <= cost * BigInt(10000 - STOP_BPS);
      const trail =
        peakValue > 0n && value * 10000n <= peakValue * BigInt(10000 - TRAIL_BPS);
      const stale = heldBars >= MAX_HOLD;
      if (take || stop || trail || stale) {
        cooldown = COOLDOWN;
        heldBars = 0;
        peakValue = 0n;
        return [{ side: "sell", symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP }];
      }
      return [];
    }

    heldBars = 0;
    peakValue = 0n;
    if (cooldown > 0) {
      cooldown -= 1;
      return [];
    }
    if (state.seq >= NO_ENTRY_AFTER) return [];

    const drop = retBps(REV_WIN);
    const turn = retBps(TURN_WIN);
    const reversal =
      drop !== null && turn !== null && drop <= -REV_BPS && turn >= TURN_BPS;
    if (!reversal) return [];

    let notional = state.cash;
    const room = state.weightRoom(SYMBOL);
    if (notional > room) notional = room;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    heldBars = 0;
    peakValue = 0n;
    return [{ side: "buy", symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIP }];
  },
});
