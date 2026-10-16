# Demo video outline (about 6–8 minutes)

Record the screen at 1080p with your voice. Use the deployed URL if you have one; otherwise local. Have the admin and passenger accounts ready in two browser profiles.

| Time | Scene | Say / show |
|---|---|---|
| 0:00 | Intro | Name, internship, task: Cloud-Based Bus Pass System. Problem: lost or forged tickets, wrong prices, sites that fall over under traffic. |
| 0:30 | Landing page | Hero, search, theme toggle, responsive resize. |
| 1:00 | Route discovery | Search *Gurugram Bus Stand → IGI Airport T3*, sort by fare, open the route, show stops and fare structure. Mention: direction matters, empty states handled. |
| 1:45 | Booking | Pick date and time, passengers; show the live fare "calculated by the server". Confirm, show the 15-minute hold, pay. Show the declined payment once, then success. |
| 2:45 | Ticket | Digital ticket with QR; explain signed, personal-data-free QR. Open the Verify page and paste the token to show server-side validation; cancel the booking and verify again to show it now fails. Show the refund policy. |
| 3:45 | Duplicate protection | Try to book the same slot again and show the conflict message. Mention the database index behind it. |
| 4:15 | Passes | Apply for a Student pass (declaration), pay, switch to the admin profile, approve; show the active pass with QR. Show renewal rules. |
| 5:00 | Admin | Overview stats, edit a fare and show the new fare in the passenger quote, route stops editor, payments table, audit log of what you just did. |
| 5:45 | Security | CSRF/role checks, passenger blocked from `/admin`, Argon2id, rate limiting; show the test output (`pytest` 86 passed, `npm test`). |
| 6:30 | Cloud | Architecture diagram from `docs/architecture.md`; ECS service, RDS, Secrets Manager, health checks, autoscaling settings; show the load test and the task count rising if you measured it. State what is simulated (payments). |
| 7:30 | Close | GitHub repo `CodeAlpha_CloudBasedBusPassSystem`, README, docs folder. Thank CodeAlpha; tag @CodeAlpha. |

Post on LinkedIn with the GitHub link and tag @CodeAlpha. Do not show secrets, AWS account ids or real personal data on screen.
