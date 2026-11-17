
# Psychology Manager — Project Instructions

## Project purpose
Build a local-first psychology practice management application.
The application is for administrative and financial management only.
It must not store clinical notes, diagnoses, therapy records or sensitive
clinical content.

## Technology
- React
- TypeScript
- Vite
- Tailwind CSS
- Dexie.js / IndexedDB
- Web Crypto API
- React Router
- Recharts
- date-fns
- Zod

## Architecture
- Single-device application.
- No backend.
- No cloud database.
- No patient data sent to external services.
- IndexedDB is the persistent local data store.
- All personal records must be encrypted before persistence.
- Use a versioned database schema and migrations.
- Use a versioned, encrypted backup format.

## Security
- Never store passwords or encryption keys in plaintext.
- Use authenticated encryption.
- Never hardcode secrets or encryption keys.
- Never log patient information.
- Do not add analytics, tracking or advertising.
- Do not load third-party scripts or fonts from external CDNs.
- Do not include real patient information in tests or fixtures.
- Implement automatic locking.
- Validate imported backup files before restoring.
- Do not claim GDPR compliance without a proper review.

## Financial rules
- Store monetary values as integer cents.
- Support configurable psychologist and clinic percentages.
- Snapshot commission percentages on each appointment.
- Support partial payments.
- Distinguish appointment status from payment status.
- Never recalculate historical appointments using new commission rules.

## User interface
- Portuguese (Portugal).
- Currency: EUR.
- Date format: DD/MM/YYYY.
- 24-hour clock.
- Responsive design.
- Clean, minimalist and professional appearance.
- Accessible forms and clear validation messages.

## Development rules
- TypeScript strict mode.
- Use reusable components.
- Keep business logic separate from UI.
- Add tests for financial calculations and encryption.
- Run lint, tests and production build after meaningful changes.
- Never deploy untested changes automatically.
- Explain architectural decisions before major changes.
