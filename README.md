# Dip Hunter — a mean-reversion bot for cbBTC

[![make.fun](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/tuyulsembilanenam672-cell/dip-hunter-cbbtc/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/tuyulsembilanenam672-cell/dip-hunter-cbbtc/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)

An entry for the [make.fun bounty "Race a BTC trading bot live for 24 hours"](https://make.fun/bounty/btc-race-24h-20261118-1444) ($250 USDC in prizes). The bot trades Coinbase Wrapped BTC (cbBTC) against USDC, one minute at a time, starting with $1,000 of paper money.

## Strategy

Dip Hunter sits in cash almost all day and only buys on one confirmed signal: the close has fallen at least 60 bps over the last 10 minutes **and** the fall has just paused (the last 2-minute return is at or above zero). It never buys while the price is still falling, never chases a rise, and never holds through chop.

Once in, it exits on whichever comes first:

- take-profit at +120 bps over cost,
- stop-loss at −80 bps under cost,
- trailing stop 50 bps below the position's peak value,
- time exit after 15 bars held.

One position at a time, full size, a 10-bar cooldown after every exit, and no new entries in the last 30 bars of the window.

## Dev-window result

Graded locally with the kit (`grade-local --driver process`) on the published 24-hour dev window (1,440 one-minute bars):

| | Dip Hunter | Best baseline (momentum) |
|---|---|---|
| Net PnL | **+$16.10** | −$23.87 |
| Trades | 4 (win rate 100%) | 1 |
| Max drawdown | 0.23% | 3.24% |
| Fees | $1.61 | $0.79 |

It also stays positive (+$14.48) with every fee doubled, and makes exactly $0 on the three quarters of the window that hold no sharp drop — it does not bleed when there is nothing to trade.

## Run it

You need the competition kit (download it from the [bounty page](https://make.fun/bounty/btc-race-24h-20261118-1444)) and Node 22+:

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot <this repo> --driver process
```

The bot is `main.ts` at the repository root (Node 22, standard library only, plus the kit's `vendor/makefun-bars.ts` protocol shim, copied byte for byte). It speaks `agent-fun/bars-replay/v1`: one JSON line per minute in, one reply out. Deterministic — two runs on the same bars produce the same orders.

## Files

- `main.ts` — the bot
- `vendor/makefun-bars.ts` — the kit's protocol shim (unchanged)
- `.makefun/owner.json` — the make.fun claim file for this entry

## License

MIT — see [LICENSE](LICENSE).

---

Built for [make.fun](https://make.fun/bounty/btc-race-24h-20261118-1444?ref=sq78y28z)
