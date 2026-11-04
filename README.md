# Alya's — Yapin' anime card bot

A standalone virtual-credit anime card collector. Character metadata is fetched on demand from AniList GraphQL; **no complete character catalogue is imported**.

## Commands
- `/roll` — random anime character
- `/roll <anime>` — character from an anime; keeping costs 100× the normal credit price
- `/credits` — wallet
- `/collection` and `/card <uid>` — owned cards and card detail
- `/sell <uid> <price>` — list owned card
- `/buy <uid>` — buy an active player listing; system full-price sales require a defined pricing policy
- `/market` — browse listings
- `/boosts`, `/boosts apply <boost>` — boosts
- `/open <crate>` — crate rewards

## Design rules
- Global card UIDs begin at #0001 and are never reused.
- Mint serial = the Nth copy of the same AniList character; mint serials are permanent.
- Rarity is locked at creation. The supplied weights sum to slightly over 100%; sampling uses proportional normalization.
- D1 stores **only** owned cards, wallets, listings, boost inventory, crates, and transactional history.
- Card records keep an AniList character ID and a minimal display snapshot to survive upstream downtime.
- Virtual currency only; no real-money purchasing.
- Use cryptographically secure randomness for tier rolls; store weights as integer units to avoid floating point drift.
- Treat marketplace purchases, balances, mint allocation, and ownership changes as atomic operations.
- Rate-limit interactions and validate Yapin' webhook signatures before processing commands.
- Respect AniList API rate limits and image licensing.

## Status
Initial project scaffold. No production bot is deployed, and Yapin' application credentials, callback format and credit economy still need configuration.
