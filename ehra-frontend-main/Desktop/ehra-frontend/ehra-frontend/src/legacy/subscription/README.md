# Legacy subscription system (ARCHIVED, not part of the active app)

Preserved for audit, rollback or future reactivation. Nothing under `src/legacy/` may be imported by active code
(enforced by an ESLint `no-restricted-imports` rule). To reactivate: re-add a route to `pages/LegacyPricing.jsx`,
set `ehral.commercial.legacy-subscriptions.enabled=true` on the backend, and restore the dashboard plan badge.
