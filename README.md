# Alya's — Yapin' anime trading-card bot

Backend: https://alyas-bot.revidue.workers.dev
Event webhook: https://alyas-bot.revidue.workers.dev/webhook

**Status (4 Nov 2026):** Worker deployed, D1 schema installed, both Cloudflare secrets present, and Cloudflare `/health` returns `configured: true`. Successful signed Yapin' event delivery has been observed previously. The full Kitsu fetch-and-card-mint flow was tested separately using a temporary test database.

## Connect your existing Yapin' application

1. Open **Cloudflare Dashboard → Workers & Pages → alyas-bot → Settings → Variables and Secrets**.
2. Add an encrypted secret named **YAPIN_BOT_TOKEN** with the bot token from **Yapin' → Settings → Developer → Alya's → Token**.
3. Add an encrypted secret named **YAPIN_WEBHOOK_SECRET** with the event webhook signing secret found in **Yapin' → Settings → Developer → Alya's → Advanced**.
4. Under **Yapin' → Settings → Developer → Alya's → Advanced**, enter **https://alyas-bot.revidue.workers.dev/webhook** as the event webhook URL.
5. In that Advanced page, click **Send test event**. A verified event triggers synchronization of all 9 commands; it is repeated at most daily as events arrive.
6. Add Alya's to your own server and test /credits, /roll and /open.

**Never share or commit credentials.** The Worker checks Yapin's X-Yapper-Signature header (HMAC-SHA256 over the raw event body). Optional plain variable YAPIN_BOT_ID also validates the X-Yapper-Bot header.

## Commands

| Command | Meaning |
| --- | --- |
| /roll | Roll randomly from Kitsu's on-demand anime-character catalogue for 10 credits; card auto-kept |
| /roll Naruto | Preview a random Naruto character; costs 1,000 credits (100x) only if you click Keep |
| /credits | Show virtual credits |
| /collection | Show the latest 20 cards in your collection |
| /card #0001 | View a card's art, UID and mint number |
| /sell #0001 | Instantly sell a card to the system |
| /sell #0001 500 | List or reprice a card for 500 credits |
| /sell #0001 cancel | Unlist that card |
| /buy #0001 | Buy a live player listing; if not listed, purchase a newly minted copy for 4x the market reference value |
| /market | See latest 20 marketplace listings |
| /boosts | Show inventory and active boosts |
| /boosts apply luck | 1 hour of double Rare+ rarity weights |
| /boosts apply credits | 1 hour of double system-sell credits |
| /open crate | Open a basic crate for credits, boost or a card |

Starter players get 1,000 **virtual** credits and one basic crate. /roll cooldown 30 seconds, target-preview expiration 15 minutes. Normal rolls have a 2% chance of awarding a crate. Basic crate rewards: 25% card, 35% boost, 40% 50–500 credits.

**Mint** means which copy of a specific character this is: mint #0001 is the first copy of that character ever claimed. Card **UID** is the global card number and starts at #0001. Rarity, UID, and mint are permanent once claimed. The supplied tier weights are proportionally normalized because they sum to slightly over 100%.

An unlisted card's system-copy price is 4x the greater of the rarity reference floor or the median of up to 5 lowest live listings for the same character and rarity. Selling instantly to the system returns 25% of the reference floor. This is a virtual-credit system only; no money purchases.

## Technology and deployment

* worker.js: complete deployed Cloudflare Worker for webhook verification, Kitsu character queries (AniList/Jikan emergency backups), cooldowns, boosts, crates, market, and wallet/card management.
* schema.sql: D1 schema installed in alyas-db, available to Worker as DB.
* src/: earlier prototypes only, **not imported by the deployed Worker**.
* test/: smoke tests (run with npm test in Node 22).
* .github/workflows/test.yml: GitHub Actions test runner.

Only owned cards, their compact metadata snapshots and player assets are stored. **No character catalogue is imported.** Kitsu is the primary live catalogue (required HTTP `Accept: application/vnd.api+json`). Generic rolls use randomly sampled anime-character relationship records with `include=character,media` and filter out manga/nonillustrated entries; named anime rolls search the anime title and fetch its illustrated cast. Response image URLs use `media.kitsu.app`; if Yapin rejects the external image host, messages retry without an inline embed image and include a clickable artwork link. AniList and Jikan remain emergency fallback providers; their availability is not guaranteed. Repeated/matched MAL character IDs share mint counters where Kitsu exposes the original MAL ID. Respect anime artwork copyright and source terms.

**Production note:** GitHub pushes do not auto-deploy yet. The Worker is currently deployed manually through Cloudflare's API. Future code edits require a redeploy or a configured Cloudflare Workers Builds integration. The currently configured bot token and webhook signing secret remain stored only as Cloudflare secrets.

## Verified Cloudflare integration checks (4 November 2026)

Kitsu was tested directly from Cloudflare Worker execution, not merely from documentation or a desktop computer. Initial six-source checks returned:
- Four random anime/character lookups: 4/4 succeeded, yielding illustrations.
- Named anime lookups for Naruto and Attack on Titan: both succeeded.
- Naruto character image: HTTP 200.

Then we cloned the **exact deployed production Worker** into a short-lived isolated test Worker and checked:
- Random character: Allen Walker (D.Gray-man Hallow), Kitsu image HTTP 200.
- Random character: Kazuko Hosogawa (Tsurezure Children), Kitsu image HTTP 200.
- Naruto: Hiruzen Sarutobi, Kitsu image HTTP 200.
- Attack on Titan: Dennis Eibringer, Kitsu image HTTP 200.

Finally, the same Worker code was run against a new **isolated temporary D1 database**:
- Random roll: minted UID #0001, mint 1 and debited 10 credits (1000 → 990).
- Targeted Naruto roll: minted UID #0002, mint 1 and debited 1000 credits (1000 → 0).
Both full-flow tests passed. The temporary diagnostic Worker and test database were deleted after testing. **The real player's database was not modified by these tests.**

A successful upstream test cannot guarantee future availability or that the Yapin image proxy accepts all CDN hosts. The Worker includes timeouts and gracefully degrades when embed images are disallowed.
