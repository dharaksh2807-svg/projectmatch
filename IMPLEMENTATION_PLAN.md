# PROJECTMATCH — PRODUCTION IMPLEMENTATION PLAN
## Automated National-Level Hackathon Discovery, Ranking and Lifecycle Management

### ROLE

Act as a senior full-stack engineer, backend architect, database engineer and QA engineer working directly in the existing ProjectMatch codebase.

Your task is to transform the existing Hackathons section into a reliable, production-ready, API-driven hackathon discovery platform.

The existing website already contains a Hackathons page with event cards, search, filters and navigation. Preserve the existing UI wherever practical and integrate the new functionality into the existing architecture.

Assume the project may use Next.js, Vercel and Supabase, but inspect the actual repository and verify the stack before making decisions.

## NON-NEGOTIABLE REQUIREMENTS

1. Normal hackathon discovery must be fully automatic.
2. Do not require administrators or users to manually enter individual events.
3. Use authorized APIs or feeds from explicitly approved sources.
4. Never invent API endpoints, API credentials, access permissions or event data.
5. Display important and upcoming hackathons before less relevant opportunities.
6. Automatically exclude completed, cancelled and registration-closed events from the relevant default sections.
7. Never permanently delete historical event records merely because an event has ended.
8. Preserve authentication, messaging, applications, dashboards, profiles, projects and unrelated functionality.
9. Use actual source data and real integration tests; do not treat mock data as successful implementation.
10. Do not claim production readiness until the integration and deployment have been verified.

# PHASE 1 — AUDIT BEFORE CODING

Inspect the complete existing repository.

Examine:
- Framework, package manager and dependency versions.
- Existing Hackathons page and event card components.
- Search, filters, sorting and pagination.
- Existing event models, mock data and Supabase tables.
- Authentication, authorization and Row Level Security.
- Existing server actions, API routes and background jobs.
- Vercel deployment configuration and scheduled-job support.
- Environment variables and external integrations.
- Existing tests and build failures.

Identify exactly how hackathon cards currently receive their data.

Produce a concise audit report containing:
- Existing architecture.
- Components and files that can be reused.
- Required database and backend changes.
- API availability risks.
- Proposed implementation sequence.
- Any credentials or external access approvals required.

Do not replace the existing implementation before understanding it. Do not perform destructive migrations.

# PHASE 2 — API SOURCE DISCOVERY AND COVERAGE

Investigate approved sources for Indian national-level and internationally accessible student hackathons.

Candidate platforms include:
- Unstop.
- Devfolio.
- Devpost.
- Major League Hacking.
- Official government hackathon initiatives.
- Recognized university and institutional event platforms.
- Major corporate developer and innovation programs.

For each candidate source, determine:
1. Does an official, authorized API or usable feed exist?
2. What authentication and permissions are required?
3. What are the actual API endpoints and response schemas?
4. Can upcoming events and registration deadlines be retrieved?
5. Does the source expose national eligibility, location, participation mode, prizes and event status?
6. Are there pagination, quotas, rate limits, licensing or attribution requirements?
7. How frequently can the source be synchronized?
8. What coverage limitations exist?

Use official documentation or verifiable authorization evidence.

Do not confuse a public website, internal website endpoint or event listing with an officially available public API.

Do not use undocumented private endpoints, bypass access controls or invent credentials.

Create a source coverage matrix documenting confirmed access, missing fields, expected coverage and limitations.

Prioritize reliable APIs with broad event coverage. If a source does not provide authorized API access, mark it unsupported and report the limitation rather than silently introducing web crawling.

Do not claim all national hackathons can be covered. Define measurable coverage based on the sources actually integrated.

# PHASE 3 — NORMALIZED DATABASE DESIGN

Design or safely extend the Supabase PostgreSQL schema.

Each event should support these fields where available:

- Internal event ID.
- Canonical source identifier.
- Source name and source event ID.
- Event title and description.
- Organizer name and organizer credibility evidence.
- Official source URL and registration URL.
- Event start and end timestamps.
- Registration opening and closing timestamps.
- Explicit timezone or validated timezone information.
- Online, offline or hybrid participation.
- City, state and country.
- Eligibility requirements and team-size limits.
- Technology categories and themes.
- Prize amount and currency.
- Registration fee.
- Event image URL.
- National-level classification and evidence.
- Event lifecycle status.
- Registration status.
- Verification status.
- First-discovered timestamp.
- Last-successful-sync timestamp.
- Last-verified timestamp.
- Created and updated timestamps.

Use appropriate nullable fields when information is unavailable. Never fabricate missing values.

Create stable source identity constraints, suitable indexes and safe upsert behaviour.

Deduplicate events using source identifiers, canonical URLs and carefully validated matching logic. Similar titles alone must not cause unrelated events to be merged.

Use migrations that preserve existing data.

Configure RLS so public users can read only publishable event records, while only authorized server-side processes can perform privileged writes.

Never expose Supabase service-role credentials to the browser.

# PHASE 4 — AUTOMATED INGESTION ENGINE

Implement a modular API adapter for each supported source.

Each adapter should:
- Authenticate securely when required.
- Fetch pages of results using documented pagination.
- Respect rate limits and source-specific quotas.
- Validate response schemas.
- Normalize dates, timezones, currencies, statuses and URLs.
- Handle missing fields and malformed records.
- Retry transient failures with bounded exponential backoff.
- Use idempotent database upserts.
- Record synchronization outcomes.
- Avoid duplicating events already stored.
- Preserve the last known good data when a source fails.

Create a scheduled server-side synchronization mechanism compatible with the actual deployment environment.

For example, use a supported Vercel Cron configuration if the deployed plan and project support it.

Start with a configurable 6–12-hour synchronization interval, adjusting it to source quotas and deadline sensitivity.

Support:
- Full initial import.
- Incremental updates where available.
- Per-source synchronization.
- Manual synchronization restricted to authorized administrators.
- Job locking or other overlap prevention.
- Per-source failure isolation.
- Safe retry behaviour.
- Sync logs and failure monitoring.

Do not fetch all external sources on every page request.

Do not use an AI model for tasks that deterministic validation can perform more reliably. AI-assisted classification may be added when justified, but must not be the sole authority for event dates, registration status or source legitimacy.

# PHASE 5 — EVENT STATUS AND AUTOMATIC REMOVAL

Implement separate event lifecycle and registration status logic.

Event lifecycle:
- Upcoming.
- Ongoing.
- Completed.
- Cancelled.
- Needs verification.

Registration status:
- Not yet open.
- Open.
- Closed.
- Unknown.

Use authoritative source status and verified timestamps wherever available.

Rules:

1. A registration deadline in the past closes registration, even when the hackathon itself is upcoming.
2. An event that has completed must not appear in the default upcoming feed.
3. Cancelled events must not be presented as actionable opportunities.
4. Events with future registration opening dates may appear in a separate upcoming-registration section.
5. Unknown deadlines must not automatically be treated as either open or expired.
6. Events with stale or contradictory information must be flagged and excluded from inappropriate high-confidence recommendations.
7. Preserve historical records and source identifiers.
8. Recalculate status at query time or through reliable scheduled maintenance so a delayed synchronization does not leave expired events visible indefinitely.
9. Correctly handle date boundaries and source timezones.
10. When organizers change dates or reopen registration, revalidate the source before changing the event's status.

The default listing must show current opportunities only.

Optionally provide a separate past-events view, but do not mix completed events into the main discovery experience.

# PHASE 6 — IMPORTANCE AND PRIORITY RANKING

Implement deterministic, configurable ranking.

Use the following initial proposed weighting:

- National importance and organizer credibility: 30%.
- Registration urgency: 25%.
- Relevance to students and technology: 20%.
- Verified prize value and learning opportunities: 15%.
- Eligibility and accessibility: 10%.

Normalize scores consistently and document the ranking logic.

Important requirements:
- Rank only eligible, publishable events.
- Never allow a recently imported event to receive priority solely because it is new.
- Never rank a closed-registration event as an actionable opportunity.
- Avoid giving disproportionate weight to large prize amounts alone.
- Do not penalize missing prize information so heavily that worthwhile events disappear.
- Use national-level evidence rather than assuming every event is national.
- Support stable tie-breaking by deadline and start date.
- Make weights configurable without requiring frontend changes.

Use four clear discovery sections:

1. Featured National Hackathons.
2. Registration Closing Soon.
3. Upcoming Hackathons.
4. Other Verified Opportunities.

Ensure that the same event is not repeated across sections on the same page.

The featured section should prioritize verified national competitions and meaningful student opportunities.

Create tests proving that high-priority events appear above lower-priority events under equivalent eligibility conditions.

# PHASE 7 — EXISTING HACKATHONS UI

Keep the existing ProjectMatch visual identity, layout and navigation.

Replace hardcoded event data with database-backed results.

Display verified information when available:
- Event title.
- Organizer.
- Registration status and deadline.
- Event dates.
- Participation mode and location.
- Technology tags.
- Eligibility.
- Prize information.
- Official event and registration links.
- Verification indicator.

Improve:
- Search.
- National-level filter.
- Online, offline and hybrid filters.
- Technology category filters.
- Registration-open filter.
- Deadline sorting.
- Start-date sorting.
- Loading states.
- Empty states.
- Error states.
- Responsive layout.
- Efficient pagination or incremental loading.

Clearly distinguish verified national-level events from other verified hackathons.

Do not present missing details as facts.

Ensure the UI does not show completed or cancelled events in its default discovery feed.

# PHASE 8 — AUTOMATION MONITORING AND ADMINISTRATION

Add an admin-only monitoring interface, reusing existing administration features if present.

Show:
- Supported sources.
- Last successful synchronization.
- Next scheduled synchronization, when known.
- Records discovered, inserted, updated and deduplicated.
- Failed API requests.
- Rate-limit errors.
- Stale events.
- Verification failures.
- Unusually large changes in event counts.

Allow administrators to enable or disable approved sources and inspect integration status.

Do not require manual approval of every ordinary event as the normal workflow. Use automated validation and reserve human review for ambiguous or suspicious cases.

Do not silently publish fabricated or unverified details.

# PHASE 9 — SECURITY AND RELIABILITY

Implement:
- Server-only API credentials.
- Secure authorization for scheduled and administrative endpoints.
- Input validation.
- URL and redirect validation where relevant.
- SSRF protection for any server-side URL fetching.
- Rate limiting where appropriate.
- Safe error handling.
- Structured logs.
- Bounded retries.
- Database query limits and indexes.
- Caching that does not keep expired opportunities visible.
- Appropriate source attribution.
- Source quota and terms compliance.

A source failure must not make the entire Hackathons page unavailable.

Do not delete existing verified data after a failed API request.

# PHASE 10 — TESTING AND ACCEPTANCE CRITERIA

Write automated tests for:

1. Initial import of valid API records.
2. Correct mapping of API fields to the database schema.
3. Duplicate prevention.
4. Updating existing events.
5. Handling missing and malformed dates.
6. Registration closure at the correct timezone boundary.
7. Automatic removal from upcoming results after completion.
8. Correct treatment of cancelled events.
9. Upcoming events whose registration has not opened.
10. Reopened registration after source revalidation.
11. Failed source requests and retries.
12. Rate-limit handling.
13. Preservation of known good records during source failures.
14. Correct ranking and stable sorting.
15. No repeated event across discovery sections.
16. Unauthorized writes being rejected.
17. Existing authentication, messaging, projects and dashboards continuing to work.
18. Mobile responsiveness and empty states.
19. Scheduled-job execution in the deployed environment.
20. Real API ingestion and database persistence.

Use fixtures for deterministic unit tests, but separately verify at least one genuine authorized API integration in the target environment.

Never mark a test as passed unless it was actually executed.

# REQUIRED DELIVERABLES

Provide:
1. Repository audit and architecture summary.
2. Verified API source coverage matrix.
3. Database migrations.
4. API adapters and ingestion service.
5. Scheduler and secure endpoint configuration.
6. Event lifecycle and ranking engine.
7. Updated Hackathons UI.
8. Monitoring and administration functionality.
9. Automated tests and their actual results.
10. Required environment variable names.
11. Deployment instructions.
12. Outstanding limitations, API access requirements and production verification results.

## EXECUTION RULES

Work in small, testable stages.

Begin with the audit and API access investigation. Do not start implementation against unverified APIs.

After the audit, proceed with the core implementation using existing project conventions.

Preserve unrelated features. Run linting, type checks, tests and production build checks where available.

If a real API credential or external approval is missing, implement the adapter interface and report the blocker honestly. Do not fabricate successful ingestion.

Do not claim the system is fully operational until the real ingestion pipeline, database updates, scheduled synchronization and deployed frontend have been verified.

Project task	Primary agent	Second agent	Reason
1. Audit existing code and dependencies	Gemini 3.8 Flash	Sonnet 4.6	Efficient repository exploration; Sonnet checks for overlooked dependencies.
2. Verify API availability and source coverage	Gemini 3.8 Flash	Sonnet 4.6	Economical research and structured comparison; Sonnet checks assumptions and missing requirements.
3. Design database schema and architecture	Sonnet 4.6	Opus 4.6	Sonnet develops the implementation plan; Opus reviews data integrity and architectural risks.
4. Implement API adapters and event normalization	Gemini 3.8 Flash	Sonnet 4.6	Flash handles repetitive integration work; Sonnet checks edge cases and source-specific behaviour.
5. Build scheduled synchronization and deduplication	Sonnet 4.6	Opus 4.6	Reliability, retries, idempotency and failure recovery need stronger reasoning.
6. Build ranking and automatic event expiry	Sonnet 4.6	Opus 4.6	More careful handling of deadlines, timezones, status transitions and ranking rules.
7. Integrate the existing frontend	Gemini 3.8 Flash	Sonnet 4.6	Efficient component changes; Sonnet checks data integration and regression risks.
8. Write automated tests	Sonnet 4.6	Gemini 3.8 Flash	Sonnet designs meaningful integration and edge-case tests; Flash adds routine unit tests.
9. Review security and database permissions	Opus 4.6	Sonnet 4.6	Highest-risk area: secrets, authorization, database writes, scheduler endpoints and migrations.
10. Final integration audit and bug fixing	Opus 4.6	Sonnet 4.6	Opus reviews cross-component failures; Sonnet implements focused fixes and reruns checks.
