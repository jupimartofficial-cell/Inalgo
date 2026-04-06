# PR Checklist (Required)

Use this checklist for every PR in this repository. It mirrors the required sections in `.github/PULL_REQUEST_TEMPLATE.md`.

## Required Sections
- Summary
- Why
- How Validated
- Risks & Rollback
- Follow-ups
- Handoff
- Default Skills Applied (Codex)
- PR Checklist
- Public Release Safety when files, docs, artifacts, screenshots, scripts, or deployment instructions may become public

## Default Skills Applied (Codex)
- `$enterprise-delivery-defaults`
- `$enterprise-coding-standards`
- `$structured-change-documentation`
- `$spring-boot-react-postgresql-production-gate`

If a default skill is skipped, record the justification in the PR body.

## PR Checklist
- What changed is clearly summarized.
- Why the change is needed is stated.
- Validation commands and results are recorded.
- Risks and rollback plan are captured.
- Follow-ups are listed or explicitly marked as none.
- Required default skills are checked or justified.
- API/interface changes documented (if applicable).
- New/changed config documented with defaults (if applicable).
- Tenant scope/authZ validated where data is touched (if applicable).
- Input validation added for new external/user inputs (if applicable).
- Query pagination or bounded reads reviewed (if applicable).
- Token-budget gate checked for code changes (`scripts/check-source-token-budget.sh`).
- Screenshot artifact attached for UI-visible changes (if applicable).
- Public-release docs updated when contributor setup, feature behavior, scripts, license, security, or launch instructions changed.
- Secret exposure reviewed for docs, screenshots, reports, artifacts, `.env` files, and provider/broker tokens.
- License impact reviewed when adding dependencies, copied code, fixtures, assets, or third-party snippets.
