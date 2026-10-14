# Beta Domain And Email Stack

This document captures the agreed first-beta ownership and email-provider
choices so rollout stories can build on one stable baseline.

## Current State

- `solartracker.app` was registered through Cloudflare on 2026-05-20.
- Cloudflare is the DNS source of truth for the beta domain.
- Zoho Mail domain ownership and DNS mapping are verified for `solartracker.app`.
- Resend domain verification is complete for `solartracker.app`.

## Chosen Stack

- **Domain registrar and DNS home:** Cloudflare
- **Human mailbox provider:** Zoho Mail
- **App / transactional email provider:** Resend

## Intended First-Beta Shape

- Canonical root domain: `solartracker.app`
- Canonical public host: `www.solartracker.app`
- Apex host: keep `solartracker.app` as the owned root domain and redirect or
  attach it consistently with the `www` host during deploy setup
- Human mailboxes live in Zoho Mail
- App-sent emails use Resend

## Mailbox Roles

- `support@solartracker.app`
  - Human support mailbox
  - Read and reply through Zoho Mail
- `john@solartracker.app`
  - Human/operator mailbox
  - Exists in Zoho Mail but is not required for the first beta support flow
- `noreply@solartracker.app`
  - Default app-sent transactional address
  - Sent through Resend, not treated as a human mailbox

## DNS And Verification State

The following responsibilities are now established:

- **Zoho Mail**
  - root-domain MX records for inbound mail
  - Zoho SPF at the root domain for Zoho-sent human mail
  - Zoho DKIM for the configured mailbox domain
  - Zoho verification TXT record
- **Resend**
  - Resend DKIM at `resend._domainkey.solartracker.app`
  - sending-domain support via the `send.solartracker.app` DNS entries shown by
    Resend
  - DMARC published at `_dmarc.solartracker.app`
- **Cloudflare**
  - all DNS records above are managed from one place

## What P-085 Establishes For Later Stories

- Subsequent rollout work should assume `www.solartracker.app` is the canonical
  public app host.
- Human support mail should use `support@solartracker.app`.
- Transactional app mail should send from `noreply@solartracker.app` through
  Resend.
- The root domain already has working mailbox DNS through Zoho, so later email
  changes must avoid overwriting existing MX records or creating duplicate SPF
  records.

## Explicit Follow-On Work

The following still belongs to later rollout stories rather than this one:

- attach `www.solartracker.app` and the apex domain in Vercel
- configure Google OAuth authorized domain and exact redirect URIs for the
  deployed hosts
- document production env vars and final callback URLs in `P-079`
- update app email configuration so sender and reply-to values are explicitly
  env-driven if needed

## Why This Split

- Cloudflare gives one clear DNS home for domain ownership, DNS records, and
  later service verification.
- Zoho Mail keeps real human inboxes available at low cost without forcing the
  beta onto a personal address.
- Resend remains the dedicated app-email provider already assumed by the
  current rewrite.

## Follow-On Implications

- `P-085` should treat Cloudflare as the source of truth for DNS changes and
  ownership verification.
- `P-079` should document the exact DNS, callback, sender, and verification
  steps using this provider split.
- Human reply flows should point users at `support@solartracker.app`.
- App-driven approval/invite/notification flows should continue to use Resend.
