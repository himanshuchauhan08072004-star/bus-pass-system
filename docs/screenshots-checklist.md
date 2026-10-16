# Screenshots checklist

Capture at desktop width (about 1440 px) in **both** light and dark themes where marked (🌗), and at least one mobile-width capture of the landing page, route detail and ticket. Crop out browser bookmarks and any personal data.

## Public site
- [ ] Landing page: hero and route-search card 🌗
- [ ] Landing page: "Book in four steps" and "Built to be trusted" sections
- [ ] Routes page with results, filters and sorting
- [ ] Routes page "no routes match" empty state
- [ ] Route detail: stops timeline, fare structure and booking panel with live server-quoted fare
- [ ] Register page with a validation error shown
- [ ] Login page
- [ ] Verify page showing a valid ticket and an invalid one

## Passenger
- [ ] Dashboard: active pass, reminder banner, statistics, upcoming journeys 🌗
- [ ] Booking flow: payment dialog (demo payment notice) and declined-payment message
- [ ] Booking detail: digital ticket with QR, payment info, cancellation preview
- [ ] Booking detail: unpaid booking with hold countdown
- [ ] Cancellation confirmation showing the refund
- [ ] Bookings list with status filters
- [ ] Passes: "Apply for a pass" cards, application modal for a concession pass
- [ ] Passes: application tracking (pending → payment received → approved)
- [ ] Passes: active pass with QR and Renew button
- [ ] Profile and password change

## Administrator
- [ ] Overview: statistics, bookings by status, top routes, recent activity 🌗
- [ ] Routes tab, route stops editor, Fares tab, Stops tab, Buses tab
- [ ] Passes: pending application review (approve/reject) and pass types table
- [ ] Bookings table with admin cancel confirmation
- [ ] Payments table showing transaction references and refunds
- [ ] Users table with deactivate / role change confirmation
- [ ] Audit log showing admin actions
- [ ] Passenger trying `/admin` and seeing the access-denied page

## Engineering evidence
- [ ] `pytest` output (86 passed) on SQLite and on PostgreSQL
- [ ] `npm test`, `npm run lint`, `npm run build` output
- [ ] GitHub Actions run (green)
- [ ] `/docs` OpenAPI page (local only; disabled in production)
- [ ] AWS: ECR repositories, RDS instance (private, backups on), Secrets Manager entries (names only, never values), ECS services with healthy targets, scaling settings, CloudWatch logs and graphs
- [ ] Load-test output
