# Alya's — Yapin' anime trading-card bot

Backend: https://alyas-bot.revidue.workers.dev
Event webhook: https://alyas-bot.revidue.workers.dev/webhook

**Status:** Worker deployed and D1 schema installed. To go live in Yapin', add two encrypted secrets, set the webhook URL, and send the test event from the Yapin' developer portal.

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
| /roll | Roll randomly from AniList for 10 credits; card auto-kept |
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

An unlisted card's system-copy price is 4x the greater of the rarity reference floor or the median of up to 5 lowest live listings for the same AniList character and rarity. Selling instantly to the system returns 25% of the reference floor. This is a virtual-credit system only; no money purchases.

## Technology and deployment

* worker.js: complete deployed Cloudflare Worker for webhook verification, AniList queries, cooldowns, boosts, crates, market, and wallet/card management.
* schema.sql: D1 schema installed in alyas-db, available to Worker as DB.
* src/: earlier prototypes only, **not imported by the deployed Worker**.
* test/: smoke tests (run with npm test in Node 22).
* .github/workflows/test.yml: GitHub Actions test runner.

Only owned cards, their compact metadata snapshots and player assets are stored. **No character catalogue is imported.** When AniList returns an upstream 403, 429, 5xx, or network error, the Worker automatically tries Jikan's MyAnimeList API for on-demand anime and character data. Jikan IDs are stored as negative integers to avoid collisions with positive AniList IDs. Cloudflare caching reduces upstream pressure. A fallback is still unavailable if both providers fail. AniList queries are temporarily cached to limit traffic; imagery must be used in accordance with source and copyright permissions.

**Production note:** GitHub pushes do not auto-deploy yet. The Worker is currently deployed manually through Cloudflare's API. Future code edits require a redeploy or a configured Cloudflare Workers Builds integration. A valid bot token and webhook signing secret are still required to activate events.

## Upstream 403 troubleshooting

AniList's API documentation states that HTTP 403 may indicate temporarily suspended access or an IP restriction; it is not the normal HTTP 429 rate-limit response. The Worker now treats these as an upstream failure and tries the alternative Jikan/MyAnimeList public API. If the fallback is also unavailable, the bot reports the two provider failures without charging credits. No proxy is used to circumvent AniList access restrictions.
