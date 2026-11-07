# DALI LIFE OS
## Product & Technical Specification for Claude Code

**Version:** 1.0  
**Date:** 5 November 2026  
**Status:** Product baseline approved; implementation details subject to repository audit and technical proof of concept  
**Product owner:** Dali  
**Working title:** Dali Life OS  

---

## 0. Instructions for the implementation agent

This document is the product and technical source of truth for the Dali Life OS project. Use it together with the existing repository. The repository is authoritative for the current state of the code; this document is authoritative for the target product direction.

### Non-negotiable working rules

1. **Inspect before changing.** Start by auditing the existing repository, package versions, architecture, routes, components, localStorage keys, data structures, integrations, deployment configuration and current git state.
2. **Do not rebuild blindly.** Preserve and reuse valuable existing components and features where they meet this specification. Identify what should be retained, refactored, migrated or retired, and explain why.
3. **Protect existing data.** Before modifying or replacing any persistence mechanism, implement and verify a complete export/backup of existing localStorage data. Never delete or overwrite user data as part of an unverified migration.
4. **Work in small, testable phases.** Do not attempt to implement every module in one pass. Complete the audit and proof of concept first, then deliver one working vertical slice at a time.
5. **No production changes without approval.** Do not deploy, alter production Supabase data, run destructive database migrations, change DNS, or push to the main branch unless the owner explicitly approves the exact action.
6. **Never expose secrets.** Do not print, commit, or place service-role keys, API keys, access tokens or secrets in client code, logs, screenshots or documentation. Do not read secret values aloud in progress reports.
7. **Test every meaningful change.** Run type checking, linting and relevant tests. Report exactly what passed, failed, was skipped, or could not be run.
8. **Do not invent integrations or capabilities.** Verify package compatibility and current official documentation before adding dependencies or promising support.
9. **Keep the app usable throughout development.** Avoid long-lived broken branches. Make changes reversible and keep a working build at the end of every phase.
10. **Ask only when blocked by a consequential decision.** Otherwise make a conservative, documented choice and keep moving.

### First response expected from Claude Code

Do not start implementing the entire product immediately. First return:

- a repository and architecture audit;
- a list of current features and where they live in the code;
- a list of current persistence keys and data shapes (never include private values);
- the current build/deploy process;
- a proposed migration map from current app to target app;
- a risk register;
- a PowerSync/Supabase Expo iOS + web proof-of-concept plan;
- a phased implementation plan with acceptance criteria.

After the audit, wait for approval before destructive or production-affecting actions. Safe local scaffolding and isolated experiments may proceed on a feature branch.

---

# 1. Product vision

Dali Life OS is a private, personal operating system that helps the user manage health, work, projects, home responsibilities and personal time from one coherent system.

It is not merely a task manager, habit tracker, fitness app or project dashboard. It is a connected personal command center that reduces the user's cognitive load, makes routines repeatable, and helps ensure that important parts of life are not neglected.

## 1.1 Approved product preferences

- **AI mode:** Integrated personal AI assistant.
- **Design direction:** Hybrid — premium minimal as the visual foundation, with detailed analytical views available when needed.
- **Primary platforms:** Web on Mac and iPad; native iOS on iPhone and iPad.
- **Architecture:** Local-first, offline-capable, multi-device synchronization.
- **Primary language:** German initially, with an architecture that supports English later.
- **Locale defaults:** `de-AT`, timezone `Europe/Vienna`, metric units, 24-hour time, EUR currency.
- **User model:** Private, single-owner personal workspace in v1. The schema should not prevent future household/shared workspaces, but multi-user collaboration is not a v1 requirement.

## 1.2 Core product promise

At any moment the user should be able to answer:

1. What matters today?
2. What is scheduled, and what is actually due?
3. Have I looked after my health today?
4. What is the next concrete action for each active project?
5. What food, shopping or preparation is needed?
6. What is slipping or at risk of being forgotten?
7. Have I protected time for recovery and personal life?

The product should make the next sensible action obvious without requiring the user to maintain the system all day.

## 1.3 Product principles

1. **User before productivity.** Health, recovery and personal time are first-class parts of the system, not leftover time.
2. **Weekly planning, daily execution.** The week is the main planning unit; each day is a manageable execution view.
3. **Capture once, reuse everywhere.** A task, meal, project or health event should be entered once and reused in all relevant views.
4. **One source of truth per data type.** Avoid duplicate task lists, duplicated calendars or competing project records.
5. **Low-friction tracking.** Prefer defaults, templates, device imports and one-tap completion over repetitive manual entry.
6. **Flexible rather than punitive.** Missed habits are data, not failure. No shame-based streaks or forced 100% scores.
7. **Explainable AI.** AI suggestions must state why they are being made and what data they used.
8. **Human approval for consequential actions.** AI may analyze and propose; external or irreversible actions require explicit approval.
9. **Privacy by design.** Personal, nutrition and health information must be protected and shared with AI only when the user has enabled that use.
10. **Progressive complexity.** The default interface stays calm. Advanced analytics and settings are available on demand.

## 1.4 Explicit non-goals for v1

- A public SaaS platform or multi-tenant marketplace.
- Team collaboration, employee management or client portals.
- Medical diagnosis, treatment recommendations or automated supplement dosing.
- Autonomous purchases, payments, messages or calendar changes.
- A full accounting or CRM product for Radl or AllesUni.
- A replacement for Capacities as the user's knowledge-management and long-form project context system.
- A replacement for a dedicated nutrition database/provider if validated nutrient data cannot be sourced reliably.
- Gamification that pressures the user into training or working when recovery is more appropriate.

---

# 2. User context and configurable defaults

Use these as initial configuration suggestions, not hard-coded assumptions:

- Seven initial projects: Radl Generalunternehmer, AllesUni, FROM, Lira, NIVO, Dali's Dashboard and LENS.
- The user works for a property-management organization twice per week for approximately three hours per shift. Weekdays and actual times must be configurable and confirmed in the calendar; do not hard-code days.
- Initial gym target: three planned sessions per week, with an optional fourth session.
- Steps, calorie targets, protein targets, water targets, supplement schedules, sleep goals and training loads must be user-configurable. Do not assume old targets are still medically or practically appropriate.
- Meal preferences and exclusions should be configurable in settings and used by recipe suggestions. The initial profile may include preferences the user explicitly confirms during onboarding; do not silently infer or add restrictions.
- Recovery and personal-time blocks should be treated as planned commitments.

All targets must be editable and have an optional start date, end date and source/note. The system must distinguish a target from an actual measurement.

---

# 3. Information architecture and navigation

## 3.1 Primary modules

1. **Home / Today** — personal command center.
2. **Plan** — calendar, tasks, time blocks, inbox and weekly planning.
3. **Health** — training, steps, nutrition summary, hydration, supplements, sleep and recovery.
4. **Projects** — portfolio, milestones, project tasks, reviews and next actions.
5. **Food** — foods, recipes, meal plans, meal logging, mealprep, pantry and shopping.
6. **Home Management** — cleaning, maintenance, household and personal administration.
7. **Insights** — weekly/monthly reviews, trends and balanced life-area summaries.
8. **Settings** — profile, targets, integrations, AI privacy, notifications, data export and backup status.

## 3.2 Navigation by platform

### Desktop web (Mac)

- Persistent left sidebar.
- Main content area with a responsive 12-column layout.
- Optional right-side detail panel for task/project/meal detail.
- Keyboard shortcuts for global search, quick capture, task creation and navigation.
- Dense tables and charts only in detailed views; Home remains calm and selective.

### iPhone

Five primary destinations:

- Today
- Plan
- Health
- Projects
- More

`More` contains Food, Home Management, Insights and Settings. A persistent global Quick Add action must be available without navigating through multiple screens.

### iPad

Use a hybrid layout with sidebar/navigation rail and multi-column content. Support useful split views, e.g. project list + project detail or calendar + day detail.

### Shared interaction requirements

- Responsive layouts; no desktop-only critical workflow.
- Native-feeling controls on iOS.
- Accessible labels and sufficient touch targets.
- Light and dark appearance.
- Reduced-motion support.
- Keyboard navigation on web.

---

# 4. Design system — Hybrid Premium Minimal

## 4.1 Visual direction

The interface should feel calm, precise, premium and editorial rather than like a gamified productivity dashboard.

- Generous spacing and restrained visual hierarchy.
- Neutral foundation with subtle accent colors by life area.
- Clear typography and consistent numeric alignment.
- Soft surfaces and restrained borders; avoid excessive cards.
- Charts should be legible and functional, not decorative.
- No unnecessary gradients, glowing effects, badges or visual noise.
- Use color to encode status or categories, never as the only indicator.

## 4.2 Design tokens

Create central design tokens for:

- Color: background, surface, elevated surface, text, muted text, border, focus, danger, warning, success and life-area accents.
- Typography: display, title, subtitle, body, caption, numeric and monospaced/tabular numeric styles.
- Spacing scale.
- Radius scale.
- Elevation/shadows.
- Motion duration and easing.
- Breakpoints and layout widths.

Do not hard-code colors, spacing or typography independently inside feature components.

## 4.3 Hybrid behavior

- Default views show a small number of meaningful metrics and actions.
- Detailed views expose tables, filters, trend charts, history and data provenance.
- A summary card must link to the underlying detailed record.
- User can hide, reorder or collapse selected Home widgets.

---

# 5. Home / Today command center

The Home screen is the highest-priority interface. It should answer “What matters today?” within a few seconds.

## 5.1 Default widget order

1. **Greeting and day context** — date, day, optional weather, sunrise/sunset if permission/provider is configured.
2. **Today at a glance** — due tasks, calendar commitments, planned workout, steps, hydration, sleep and meal status.
3. **Top priorities** — no more than three primary outcomes; allow one to be a personal/health priority.
4. **Today schedule** — actual events and reserved work/time blocks, clearly differentiated.
5. **Health snapshot** — exercise/steps, nutrition, water and recovery indicators.
6. **Project next actions** — relevant next actions from active projects; show missing next steps as a review warning.
7. **Meals and shopping** — next planned meal, mealprep status and items needed soon.
8. **Home and personal tasks** — only items due or deliberately scheduled.
9. **Personal time / recovery** — clearly visible, not hidden at the bottom of a long task list.

## 5.2 Home behavior

- Show only today's relevant tasks by default; allow expansion to all open tasks.
- Highlight overdue items without creating an alarm-like interface.
- Show tasks scheduled today separately from tasks merely due today.
- Indicate unsynced/offline state discreetly but clearly.
- Allow quick completion, reschedule, snooze, or open detail.
- Show the reason when AI suggests reprioritization.
- Avoid displaying fake progress or placeholder metrics as actual data.

## 5.3 Quick Add

Global Quick Add supports:

- Task
- Inbox idea
- Calendar event/time block
- Meal/food log
- Workout session
- Habit log
- Shopping item
- Household task

Quick Add should infer a suggested type from natural language only when confidence is high; otherwise ask the user to choose. It must not silently create calendar events or tasks with invented dates.

---

# 6. Core planning and project model

## 6.1 Task model

Tasks are the single shared task system for all life areas.

Required properties:

- `id` (UUID)
- `user_id`
- `title`
- `description` / notes
- `life_area_id`
- optional `project_id`
- optional `milestone_id`
- `status` (inbox, todo, in_progress, waiting, done, cancelled)
- `priority` (low, normal, high, urgent)
- optional `due_date` (local date)
- optional `scheduled_start_at` and `scheduled_end_at` via linked time block/event
- optional `estimated_minutes`
- optional `actual_minutes`
- optional `parent_task_id`
- optional recurrence/template reference
- `completed_at`
- `sort_order`
- common audit/sync fields

Rules:

- A task may exist without a project.
- A task can be completed without being scheduled.
- A due date is not the same as a scheduled time.
- Do not create duplicate task records to show the same task in multiple modules.
- Completing a task must preserve its history and completion timestamp.
- Recurrence creates a new instance; it must not reopen the previous completed instance.

## 6.2 Project portfolio

Seed the following seven project records on first setup, after confirmation:

1. Radl Generalunternehmer
2. AllesUni
3. FROM
4. Lira
5. NIVO
6. Dali's Dashboard
7. LENS

Project fields:

- name, description, category
- status: active, waiting, paused, completed, archived
- priority: low, medium, high, strategic
- quarterly objective
- monthly outcome
- weekly outcome
- next action summary
- next review date
- owner (self in v1)
- optional target date
- created/updated timestamps

Related entities:

- project milestones
- tasks
- project notes/links (or references to Capacities)
- project progress logs
- weekly/monthly reviews

Rules:

- Each active project must have a concrete next action or be explicitly marked waiting/paused.
- Do not distribute equal weekly hours by default.
- The weekly review should recommend two focus projects using urgency, strategic value, revenue potential, dependencies and staleness; the user confirms the selection.
- The product should ensure every active project is reviewed weekly, but not require equal work time for all projects.
- Progress percentage must be based on defined milestones or outcomes; never use arbitrary manual percentages as the only signal.

## 6.3 Weekly planning

Weekly planning is a first-class workflow, not a generic list.

The user should:

1. review the previous week;
2. check all active projects;
3. choose up to three weekly outcomes;
4. identify two focus projects;
5. confirm fixed work commitments;
6. place gym and recovery blocks;
7. plan project work blocks;
8. plan shopping, mealprep and household blocks;
9. protect personal/free time;
10. leave deliberate buffer time.

The system should warn when the user has scheduled more work than the available calendar capacity. Default planning guideline: leave approximately 25–30% of otherwise available discretionary time unallocated until the user changes this setting.

---

# 7. Calendar and recurring work

## 7.1 Distinguish data types

- **Task:** what needs to be done.
- **Event:** a fixed appointment or commitment.
- **Time block:** reserved time for a task or activity.
- **Habit schedule:** a recurring expectation, not necessarily a calendar appointment.

## 7.2 Calendar event fields

- id, user_id, title, description
- event type (appointment, work, workout, mealprep, personal, recovery, admin, other)
- start/end timestamp with timezone
- optional linked task/project
- source (local, Google Calendar, Apple Calendar, imported)
- external event ID when applicable
- sync status and audit fields

## 7.3 Recurrence

- Use a standards-based recurrence representation where possible (e.g. RRULE), with explicit timezone.
- Store the recurrence definition separately from generated instances.
- Use deterministic instance identity, e.g. recurrence ID + local date/time, to prevent duplicates across devices.
- Generate only a rolling near-future horizon; do not pre-create years of instances.
- Handle daylight-saving transitions in `Europe/Vienna` correctly.
- Preserve completed instances and exception dates.

## 7.4 External calendars

Google Calendar integration is a planned optional integration. Start with read-only import and linking. Add two-way synchronization only after conflict handling, event ownership and deletion behavior have been tested. Do not create duplicate events on repeated imports.

Apple Calendar is not a v1 dependency. Evaluate a native integration later if required.

---

# 8. Health OS

Health OS is a personal tracking and planning module, not a medical system.

## 8.1 Health dashboard

Show:

- planned vs completed workouts
- steps and daily movement
- nutrition summary
- hydration
- supplement schedule/completion
- sleep duration and subjective quality
- recovery/energy/muscle soreness notes
- weekly trend summaries

Targets are editable and should never be hard-coded based on historical user details.

## 8.2 Training

Entities:

- workout programs
- program days/templates
- exercise catalog
- workout sessions
- workout sets
- exercise notes / personal records

Record at minimum:

- exercise
- set order
- repetitions
- weight and unit
- duration/distance where relevant
- RPE or perceived exertion (optional)
- session date/time
- session duration
- notes

Requirements:

- User can create and edit programs.
- User can start a session from a program or create an ad-hoc session.
- A workout can be saved offline.
- Show progression over time without prescribing unsafe load increases.
- Rest days and recovery sessions are valid planned activities.
- Do not encourage training through pain, faintness, illness or unusual symptoms.

## 8.3 Steps and daily metrics

`daily_metrics` should support:

- local date
- steps
- distance (optional)
- active energy (optional, source dependent)
- water consumed
- energy/mood rating (optional)
- source and import metadata

Avoid double-counting device imports and manual entries. Preserve source provenance and allow correction.

## 8.4 Nutrition

Track:

- calories
- protein
- carbohydrates
- fat
- fiber
- selected micronutrients when reliable source data exists

Requirements:

- Distinguish target from actual intake.
- Allow foods, custom foods, recipes, portions and meal logs.
- Allow favorite/recent meals for fast logging.
- Calculate nutrient totals from ingredient quantities and authoritative source values.
- Store nutrient source and source version where available.
- Show when micronutrient data is incomplete or estimated.
- Never imply that a single day of food logs is a diagnosis or a complete picture of nutrient status.

## 8.5 Supplements

Store supplement catalog and user-defined schedule separately.

Fields include name, brand, form, dose text, unit, schedule/frequency, planned time, food instructions, start/end date, stock quantity, reorder threshold and optional notes.

Rules:

- The app records a schedule supplied/confirmed by the user; it does not decide dosage.
- AI must not prescribe, increase, combine or discontinue supplements.
- If the schedule is incomplete or contradictory, flag it for user review rather than guessing.
- Supplement stock reminders are operational reminders, not medical advice.

## 8.6 Sleep and recovery

Store sleep sessions, sleep duration, bedtime/wake time, subjective quality, energy and optional recovery notes.

Do not fabricate sleep stages or physiological metrics when the source does not provide them. Show imported Apple Health values with provenance.

## 8.7 Apple Health integration

Planned for a later phase. Use HealthKit through an appropriate native iOS integration/dev build. Request granular, optional permissions and explain each data type. Start with steps, workouts and sleep where technically and legally appropriate. Never assume permission is granted. Provide disconnect and data deletion controls. Do not make the web version pretend to have native HealthKit access.

---

# 9. Nutrition, recipes, meal planning and shopping

## 9.1 Food catalog

Food fields:

- id, name, brand (optional), category
- base quantity and unit (e.g. per 100 g)
- calories, protein, carbohydrates, fat, fiber
- micronutrient values where available
- source/provider, source ID, source date/version
- confidence/completeness marker

Allow custom foods with manual values. Clearly identify user-entered or estimated values.

## 9.2 Recipes

A recipe contains:

- title, description, servings
- prep time, cooking time
- instructions
- ingredients and quantities
- nutrition per serving, calculated from ingredients
- tags and meal type
- equipment/notes (optional)
- storage/freezing guidance (optional)

Recipe ingredient quantities must be normalized enough to calculate shopping requirements. Unit conversion must be explicit; do not guess between volume and weight without a known ingredient conversion.

## 9.3 Weekly meal plan

A meal plan groups entries by local date and meal type (breakfast, lunch, dinner, snack, optional pre/post workout).

The user can:

- reuse last week's plan;
- choose favorite recipes;
- adjust serving counts;
- swap meals;
- mark a meal as flexible/unplanned;
- log planned food as actually eaten with one action, then edit quantities.

Planned meals and actual food logs remain separate but linked.

## 9.4 Shopping list generation

Generation logic:

1. Collect recipe ingredient requirements for the selected planning window.
2. Multiply by servings.
3. Normalize compatible units.
4. Deduct available pantry quantities only when units and items match.
5. Group remaining items by shopping category.
6. Merge duplicates while preserving quantity and unit.
7. Allow manual items.
8. Mark purchased quantities and optionally update pantry stock.

Never silently deduct incompatible units or uncertain stock. Show a review step before the list is finalized.

## 9.5 Pantry and stock

Track item, quantity, unit, location, expiry date (optional), minimum stock and last updated. Support a simple mode that tracks only “in stock / low / out” for users who do not want precise quantities.

## 9.6 Mealprep

Support reusable mealprep plans with:

- preparation date/time;
- recipes and portions;
- expected meals/containers;
- storage location;
- prepared date;
- use-by date (user-confirmed; avoid automatic food-safety claims);
- links to shopping items.

Initial suggested cadence is configurable: one larger weekly preparation and one smaller refill. Do not hard-code Sunday/Wednesday if the user's schedule changes.

---

# 10. Home Management and personal administration

Use the shared task system. Add optional household-specific metadata:

- area/room
- task category (cleaning, laundry, maintenance, documents, errands, household purchase)
- recurrence/template
- estimated duration
- last completed date
- preferred cadence

Provide:

- daily 10–15 minute reset list;
- weekly cleaning blocks;
- monthly maintenance/admin review;
- recurring errands;
- household shopping items.

Avoid duplicating household shopping and food shopping. A shopping list can contain categories/contexts, but there should be one shared shopping-item model.

---

# 11. Reviews and insights

## 11.1 Weekly review

The weekly review should guide the user through:

### Health
- workouts planned/completed;
- steps and movement trends;
- nutrition consistency and data completeness;
- sleep and recovery trends;
- supplement schedule completion (without judging medical adequacy).

### Projects and work
- movement on all seven initial projects;
- milestone/task progress;
- project without a next action;
- waiting/blocking items;
- upcoming work commitments;
- focus projects for the next week.

### Home and personal
- household/admin backlog;
- shopping and mealprep readiness;
- personal time actually protected;
- recovery and social/leisure time.

End with:

1. up to three weekly outcomes;
2. up to two focus projects;
3. confirmed calendar commitments;
4. training/recovery plan;
5. meal/shopping/mealprep plan;
6. protected personal-time blocks.

## 11.2 Monthly review

Show trends and reflection prompts, not just a productivity score. Compare intended priorities with actual time/effort where data exists. Highlight patterns and ask the user to validate interpretations.

## 11.3 Balanced area indicators

Provide separate indicators for Health, Projects, Work, Home and Personal Life. Do not collapse them into one “life score” by default. If a combined score is ever offered, it must be optional, transparent and not value the user's worth or health.

---

# 12. Integrated AI assistant

## 12.1 Role

The integrated AI assistant is a planning and analysis partner. It should understand the user's structured Life OS data and provide context-aware recommendations while keeping the user in control.

It is not an autonomous agent with unrestricted access to the user's life.

## 12.2 Approved AI capabilities

- Generate a concise daily briefing from today's calendar, tasks, priorities and health plan.
- Prepare weekly review summaries.
- Identify overdue, blocked or stale tasks/projects.
- Detect calendar overload and suggest realistic rescheduling.
- Recommend which projects deserve focus based on user-selected criteria.
- Identify a missing next action for active projects.
- Suggest meal plans using saved recipes, preferences and available pantry items.
- Generate a shopping-list draft from a meal plan.
- Summarize workout, steps, sleep and recovery history descriptively.
- Detect inconsistencies or missing data (e.g. supplement schedule incomplete, duplicate calendar item, unlinked task).
- Convert natural-language capture into a draft task, event or shopping item.
- Answer questions about the user's own records with references to the records used.

## 12.3 AI actions requiring confirmation

The assistant may draft but must ask for explicit approval before:

- creating or moving calendar events;
- changing task due dates or priorities in bulk;
- marking records complete;
- changing recurring schedules;
- modifying meal plans or shopping lists beyond a draft;
- adding/removing integrations;
- deleting or archiving records;
- sending external messages or triggering purchases (not a v1 capability).

## 12.4 AI actions that are prohibited

- Diagnosing medical conditions.
- Giving individualized medical treatment advice.
- Prescribing or changing supplement dosages.
- Encouraging training despite concerning symptoms or significant pain.
- Making financial, legal or medical decisions on the user's behalf.
- Silently changing plans or data.

## 12.5 AI architecture

- All model calls must run server-side (e.g. Supabase Edge Function or a dedicated trusted API), never directly from the client with a private API key.
- Use a provider-agnostic adapter so the model/vendor can be changed without changing product features.
- Model name and provider are environment/configuration controlled, not hard-coded in UI components.
- Tool functions should be typed and narrowly scoped.
- Separate read tools from write/proposal tools.
- Use user-authenticated context and enforce authorization for every tool call.
- Keep an audit trail of AI proposals and user approvals.
- Use idempotency keys for write actions.
- Set sensible input/output limits, timeouts, retry behavior and cost controls.
- AI must not receive every health or personal record by default. Build data minimization and category-level consent into settings.

## 12.6 AI proposal workflow

1. User asks a question or receives an opt-in briefing.
2. Server identifies the minimum required data.
3. Server fetches authorized records for that user.
4. Model returns a structured proposal with rationale, source record IDs and confidence/limitations.
5. UI renders a preview.
6. User approves, edits or dismisses.
7. Approved action is executed through the normal application service layer.
8. Result and approval are logged.

AI should never bypass normal business rules, RLS or data validation.

## 12.7 AI privacy controls

Provide settings for:

- AI enabled/disabled;
- categories allowed for AI context (projects, calendar, health, nutrition, household);
- whether health/nutrition data may be included;
- retention/clear conversation history;
- explanation of what data is shared with the configured AI provider.

Default sensitive-category sharing to off until the user explicitly enables it. Never state that an external model provider does not retain or use data unless verified from the active provider contract/settings.

---

# 13. Data architecture and database model

## 13.1 Recommended architecture

**Preferred target:** Expo + React Native Web/iOS, Supabase PostgreSQL/Auth/Edge Functions, and PowerSync for local-first sync.

Use a platform-specific PowerSync database adapter behind a common application data interface:

- Native iOS: `@powersync/react-native` with a supported SQLite adapter (verify current official compatibility; currently documented setup uses `@op-engineering/op-sqlite`).
- Web: `@powersync/web` with worker assets and browser-compatible SQLite/WASM storage.
- Shared app logic: common repositories/services and shared PowerSync schema.
- Backend: Supabase PostgreSQL with RLS, migrations and authenticated write path.

PowerSync is preferred over writing a bespoke sync engine because it handles local SQLite, queued writes and synchronization. However, the official React Native Web support documentation currently labels the cross-platform setup beta. A proof of concept must verify iOS + Expo web builds, persistent storage, worker hosting, authentication, sync, offline writes, reconnect and conflict handling before adopting it for production. If the POC fails, present and evaluate a fallback; do not quietly substitute a custom sync implementation.

### Why this architecture

The user needs local responsiveness and access when offline, with changes becoming available on the user's other devices after synchronization. PowerSync provides a Postgres-to-SQLite sync layer and local write queue, while Supabase provides PostgreSQL, authentication and authorization. The native and web clients need separate PowerSync implementations behind a shared interface.

## 13.2 Expo and dependency policy

- Use the latest **stable** Expo SDK compatible with the repository and target platforms at implementation time.
- Do not use Canary, beta or release-candidate SDKs in the production branch.
- Use `npx expo install` for Expo-managed native dependencies.
- Commit the lockfile and use the exact resolved package versions in CI.
- Run Expo Doctor and check New Architecture compatibility before adding native dependencies.
- Confirm current PowerSync web/native compatibility before selecting versions.
- Do not assume `expo-sqlite` and PowerSync can be mixed as interchangeable database layers. PowerSync owns the synced local database for synced entities.
- Do not add Drizzle ORM by default. First confirm it is officially compatible with the selected PowerSync adapters and query model. Use SQL migrations for Postgres and a typed repository layer. Add an ORM only if it demonstrably simplifies both native and web implementations.

## 13.3 Database conventions

- Primary keys: UUID.
- Timestamps: UTC `timestamptz`.
- Calendar grouping and date-only values: local date in the user's configured timezone.
- User-facing timezone default: `Europe/Vienna`.
- Every user-owned record includes `user_id`.
- Common fields for syncable mutable records: `id`, `user_id`, `created_at`, `updated_at`, `deleted_at` (nullable soft delete), and where useful `version`/`source`.
- Activity/log records additionally include `occurred_at` and `local_date`.
- Use enums/check constraints for statuses and units where appropriate.
- Add indexes for `user_id`, status, due date, project, date/time ranges and foreign keys used by common screens.
- Set foreign-key delete behavior explicitly. Avoid cascading deletion of health logs or project history by default.
- Store user-entered values separately from calculated values when auditability matters.

## 13.4 Canonical table groups

### Core

- `profiles`
- `life_areas`
- `tasks`
- `task_dependencies`
- `task_templates`
- `task_recurrence_instances`
- `calendar_events`
- `inbox_items`
- `attachments` (metadata; file bytes in storage)

### Projects

- `projects`
- `project_milestones`
- `project_progress_logs`
- `project_reviews`
- `project_links` (external/document links, including Capacities references)

### Habits and health

- `habit_definitions`
- `habit_schedules`
- `habit_logs`
- `daily_metrics`
- `workout_programs`
- `workout_program_days`
- `exercise_catalog`
- `workout_sessions`
- `workout_session_exercises`
- `workout_sets`
- `sleep_logs`
- `recovery_logs`
- `supplements`
- `supplement_schedules`
- `supplement_logs`

### Nutrition and shopping

- `foods`
- `recipes`
- `recipe_ingredients`
- `meal_plan_weeks`
- `meal_plan_entries`
- `food_logs`
- `pantry_items`
- `shopping_lists`
- `shopping_items`
- `mealprep_sessions`
- `mealprep_items`

### Household and reviews

- `home_areas`
- `weekly_reviews`
- `weekly_goals`
- `monthly_reviews`
- `notification_preferences`

### AI and integrations

- `ai_conversations`
- `ai_messages`
- `ai_action_proposals`
- `ai_action_audit`
- `external_integrations`
- `external_sync_mappings`

Create tables only when a module is implemented; do not create unused speculative tables simply to make the schema look complete. Keep this list as the target domain model.

## 13.5 Relationship rules

- `tasks.project_id` is optional; one task belongs to at most one project in v1.
- `tasks.milestone_id` is optional and must belong to the same project as the task.
- A calendar event can link to a task, project or both, but a task is not itself a calendar event.
- A meal plan entry references a recipe or food item and is distinct from actual food logs.
- Recipe ingredients reference foods and have explicit quantity/unit.
- Shopping items may reference a food/recipe ingredient or remain free-form.
- Habit logs reference a habit definition and a local date/occurrence.
- Workout logs are actual events; program templates are planned structures.
- External calendar IDs are stored in a mapping table with provider and account context.
- AI proposals reference source record IDs and do not duplicate the source data.

## 13.6 RLS and authorization

- Enable Row Level Security on all user-owned tables.
- Authenticated user may read/write only rows whose `user_id = auth.uid()`.
- Add explicit ownership checks for linked records (a task cannot reference another user's project, etc.).
- Do not expose Supabase service-role credentials to the client.
- Edge Functions must validate the user's JWT and enforce the same ownership rules.
- Static shared catalog rows (if any) must be deliberately separated from private user data.
- Add automated RLS tests for user isolation.

## 13.7 Sync and conflict handling

- POC must cover offline create/update/delete, reconnection and multi-device sync.
- Prefer PowerSync's managed upload queue and sync streams/appropriate current sync configuration.
- Apply user authorization on every uploaded mutation. Avoid a service-role write path that bypasses user permissions.
- Use soft deletes for synced entities unless there is a documented reason otherwise.
- Use append-only semantics for actual activity logs where possible; correcting a log should create an auditable update rather than silently replacing history.
- For mutable planning records, define field-level conflict policy. At minimum, do not silently overwrite simultaneous edits without surfacing or logging the conflict.
- Verify browser persistence and worker asset hosting for web deployments.
- Show last sync time, offline state, pending changes and sync errors in Settings/diagnostics; avoid intrusive global banners for normal short offline periods.

---

# 14. Integrations

## 14.1 Supabase

Use Supabase for:

- PostgreSQL database;
- Auth with Magic Link initially;
- Row Level Security;
- Edge Functions for trusted AI/API operations;
- Storage for user attachments if needed;
- optional Realtime for non-PowerSync events where appropriate.

Do not use Realtime as a substitute for a local-first sync engine.

## 14.2 Capacities

Capacities remains the knowledge-management/project context system. Dali Life OS remains the execution and daily planning system.

For v1:

- store optional Capacities object/page URLs on projects;
- allow opening the linked Capacities context;
- do not attempt a two-way sync until an official, stable API and conflict model are verified;
- do not duplicate long-form notes unnecessarily.

## 14.3 Google Calendar

Optional later integration. Start read-only. If two-way sync is considered, implement external ID mapping, idempotency, conflict policy, permission revocation and deletion behavior first.

## 14.4 Apple Health

Later native iOS integration only, permission-based and granular. Import provenance and duplicate prevention are mandatory.

## 14.5 Weather and sunrise/sunset

Optional Home widget. Weather is not a core dependency. If location permission is not granted, allow manual city configuration or hide the widget. Never block app use on location access.

---

# 15. Notifications and reminders

- Reminders must be user-configurable by category and quiet hours.
- Default to a small number of meaningful reminders.
- Daily briefing may be in-app first; push notifications can be added later.
- Recurring task reminders must not generate duplicate notifications after sync.
- Do not notify for every habit completion.
- Provide snooze, dismiss and completion actions where supported.
- Respect iOS notification permissions and web notification permission.

---

# 16. Search, capture and data portability

## 16.1 Search

Global search should cover tasks, projects, recipes, foods, notes/links, shopping items and reviews. Search results must respect RLS and local sync scope.

## 16.2 Inbox

One central inbox for unprocessed tasks, ideas and quick captures. Inbox entries can be converted into tasks, project notes, shopping items or calendar drafts. Conversion should preserve the original capture reference or audit link.

## 16.3 Export and deletion

Provide:

- full user data export in machine-readable JSON;
- CSV export for tasks, projects, food logs, workouts and reviews;
- attachment export where feasible;
- account/data deletion workflow with confirmation;
- clear explanation of what is deleted locally, in Supabase and at AI providers (subject to provider controls).

Do not ship the first production release without a verified data export path.

---

# 17. Performance, accessibility and reliability

- Home should render quickly from local data without waiting for network requests.
- Use pagination or bounded queries for long histories.
- Avoid loading all workouts, food logs or tasks into memory on app start.
- Add loading, empty, offline and error states to every data-driven screen.
- Use optimistic UI for local-first edits, with visible rollback/error handling when a write cannot sync.
- Support Dynamic Type/font scaling where practical.
- Provide accessible names and states for controls.
- Support keyboard navigation and focus indicators on web.
- Respect reduced motion and system appearance settings.
- Use crash/error monitoring only after privacy review and with sensitive payloads redacted.

---

# 18. Testing and acceptance criteria

## 18.1 Required test layers

- Unit tests for calculations, recurrence expansion, shopping list merging, nutrition totals and AI action validation.
- Repository/service tests for CRUD and ownership rules.
- RLS tests proving one user cannot read or mutate another user's records.
- Integration tests for Supabase Auth and backend calls.
- Sync tests for offline, reconnect, duplicate mutation, deletion, multi-device update and conflict cases.
- UI tests for the core daily workflows.
- Accessibility checks for key screens.
- Smoke tests for web production build and native iOS development/production builds.

## 18.2 Core acceptance scenarios

### Scenario A — Capture and complete a task

- User creates a task from Quick Add.
- It appears in Inbox or selected life area.
- User assigns a project and due date.
- It appears once in Today/Plan/Project views.
- User completes it offline.
- After reconnect, completion syncs to the other device without duplication.

### Scenario B — Weekly planning

- User reviews last week.
- All seven active projects are visible.
- Projects with no next action are flagged.
- User chooses focus projects and up to three weekly outcomes.
- Fixed commitments and personal time are protected.
- System warns about calendar overload.

### Scenario C — Gym session

- User starts a planned or ad-hoc workout.
- Records exercises, sets, reps and weights offline.
- Saves the session.
- Session appears in Health history after sync.
- No fabricated device data is added.

### Scenario D — Meal plan to shopping list

- User adds recipes and serving counts to a week.
- Ingredient requirements are calculated.
- Matching pantry stock is deducted only when units/items are compatible.
- Shopping list is generated with manual review.
- Purchased items can update pantry stock.

### Scenario E — AI weekly review

- AI receives only the data categories enabled by the user.
- It produces a summary with record references and explicit uncertainty.
- It proposes changes but does not apply them.
- User can approve, edit or dismiss each proposal.
- Approved actions are executed through standard application services and audited.

### Scenario F — Cross-platform persistence

- User makes changes on iPhone offline.
- Web app remains usable with its local dataset.
- After network restoration, both devices converge.
- Browser refresh/restart does not erase the local web database.
- User sign-out does not expose the previous user's local data to the next user.

## 18.3 Definition of done for each phase

A phase is complete only when:

- stated acceptance criteria pass;
- TypeScript has no new errors;
- lint and format checks pass;
- relevant tests pass;
- migrations are documented and reversible where feasible;
- no secrets are committed;
- web and native builds remain healthy;
- documentation and changelog are updated;
- known limitations are reported.

---

# 19. Phased delivery roadmap

## Phase 0 — Repository audit and backup

Deliverables:

- repository map;
- current feature inventory;
- localStorage/data inventory;
- current route/component map;
- dependencies and deployment audit;
- localStorage export/backup procedure;
- migration plan;
- risk register.

Exit criteria: owner understands what exists and how existing data will be protected.

## Phase 1 — Platform and sync proof of concept

Build a deliberately small isolated prototype:

- one Expo app running web and iOS;
- Magic Link auth;
- one private test table with RLS;
- PowerSync native adapter;
- PowerSync web adapter and worker assets;
- create/update/delete test item;
- offline operation and reconnect;
- multi-device convergence;
- browser persistence after refresh;
- logout/user isolation;
- deploy test to the proposed web host.

Exit criteria: signed-off technical evidence that both target platforms work reliably, or a documented fallback recommendation.

## Phase 2 — Core foundation and Command Center

- design tokens and responsive shell;
- profiles and life areas;
- tasks, inbox, projects and milestones;
- calendar/time blocks;
- recurrence engine;
- Home dashboard;
- basic search;
- export/backup baseline.

Exit criteria: daily task and weekly planning scenarios pass on web and iOS.

## Phase 3 — Health OS

- habits and schedules;
- workout programs and logs;
- steps/manual daily metrics;
- water tracking;
- supplements and schedules;
- sleep and recovery logs;
- health dashboard and trends.

Exit criteria: workout and daily health tracking scenarios pass offline and sync.

## Phase 4 — Nutrition and meal operations

- food catalog and nutrient provenance;
- recipes and ingredient quantities;
- meal plans and actual food logs;
- pantry stock;
- generated shopping lists;
- mealprep workflow.

Exit criteria: planned meals can produce a reviewed shopping list without incorrect unit conversions or duplicate items.

## Phase 5 — Home Management and reviews

- home task templates;
- recurring cleaning/admin workflows;
- weekly and monthly reviews;
- balanced life-area insights.

Exit criteria: recurring tasks do not duplicate and weekly review covers every active life area.

## Phase 6 — Integrated AI assistant

Start read-only and proposal-only:

- daily briefing;
- weekly review summary;
- project next-action analysis;
- overload/stale-task detection;
- meal plan suggestions from saved recipes;
- task/event draft generation;
- user consent controls and audit log.

Only after these are reliable should approved write tools be introduced.

Exit criteria: AI uses only allowed data, cites source records in the UI, cannot bypass permissions, and never executes consequential changes without confirmation.

## Phase 7 — External integrations and refinement

- Google Calendar (read-only first);
- Apple Health/HealthKit;
- weather/sunrise widgets;
- Capacities deep links;
- push notifications;
- advanced insights.

Each integration requires a separate compatibility, privacy and permissions review.

---

# 20. Proposed codebase structure

Adapt to the existing repository if its structure is sound; do not impose this tree mechanically.

```text
app/
  (tabs)/
    index.tsx                 # Today
    plan.tsx
    health.tsx
    projects.tsx
    more.tsx
  food/
  home/
  insights/
  settings/
  auth/

src/
  components/
  design-system/
  features/
    dashboard/
    inbox/
    tasks/
    calendar/
    projects/
    habits/
    workouts/
    health/
    nutrition/
    shopping/
    mealprep/
    home-management/
    reviews/
    ai/
  data/
    database/
    repositories/
    sync/
    migrations/
  services/
  integrations/
  hooks/
  types/
  utils/

supabase/
  migrations/
  functions/
  tests/

docs/
  DALI_LIFE_OS_PRODUCT_TECH_SPEC.md
  architecture-decisions/
  migration/
  operations/
```

Feature modules should not query the database directly from UI components. Use typed repositories/services and shared domain types. Keep UI presentation separate from persistence, sync and AI orchestration.

---

# 21. Operational and project management rules for Claude Code

For every implementation task:

1. Restate the specific deliverable and phase.
2. Inspect relevant existing files before editing.
3. Describe the intended change briefly.
4. Implement the smallest complete vertical slice.
5. Run tests/typecheck/lint/build relevant to that slice.
6. Inspect the diff for accidental changes and secrets.
7. Update documentation and a short implementation log.
8. Report files changed, tests run, result, limitations and next recommended step.

Maintain these documents in the repository:

- `docs/IMPLEMENTATION_STATUS.md` — current phase, completed work, blockers and next tasks.
- `docs/ARCHITECTURE_DECISIONS.md` — decisions, alternatives and rationale.
- `docs/DATA_MIGRATION.md` — backup, import mapping, validation and rollback steps.
- `docs/TEST_MATRIX.md` — platforms and scenarios tested.

Do not claim a feature is complete merely because a screen renders. It is complete only when its data, offline behavior, validation, permissions and acceptance scenario work.

---

# 22. Technical references to verify during implementation

Use current official documentation at the time of implementation; do not rely solely on this document or model memory.

- Expo SDK reference: https://docs.expo.dev/versions/latest/
- Expo local-first architecture guide: https://docs.expo.dev/guides/local-first/
- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo + Supabase guide: https://docs.expo.dev/guides/using-supabase/
- Supabase Expo React Native quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
- Supabase Auth React Native quickstart: https://supabase.com/docs/guides/auth/quickstarts/react-native
- PowerSync + Supabase partner overview: https://supabase.com/partners/catalog/powersync
- PowerSync React Native Web support: https://docs.powersync.com/client-sdks/frameworks/react-native-web-support
- PowerSync React Native SDK: https://github.com/powersync-ja/powersync-js/tree/main/packages/react-native
- PowerSync Web SDK release notes: https://releases.powersync.com/announcements/powersync-js-web-client-sdk

**Compatibility note:** As of this specification date, Expo's current docs show SDK 58 as the latest stable SDK line, and PowerSync's React Native Web docs describe the cross-platform support as beta. Verify the stable release, adapter compatibility, web worker requirements and hosting configuration when beginning implementation. Use the latest stable compatible versions, not automatically the highest version number of each independent package.

---

# 23. Initial Claude Code kickoff prompt

Paste the following prompt into Claude Code after placing this specification at `docs/DALI_LIFE_OS_PRODUCT_TECH_SPEC.md` in the repository:

> Read `docs/DALI_LIFE_OS_PRODUCT_TECH_SPEC.md` completely. Treat it as the approved product and technical baseline for Dali Life OS.
>
> Do not implement the whole product yet. Start with Phase 0: audit the existing repository and document the current architecture, routes, components, persistence/localStorage keys and data shapes, integrations, build scripts and deployment process. Do not reveal secret values. Check git status and do not overwrite uncommitted user work.
>
> Identify which current dashboard features should be preserved, refactored, migrated or retired. Design a safe export and backup plan for all existing localStorage data before proposing any migration. Do not delete, reset or replace current user data.
>
> Then prepare a technical proof-of-concept plan for Expo web + iOS, Supabase Auth/RLS and PowerSync with platform-specific native and web clients. Verify current official compatibility, the beta status of React Native Web support, worker configuration, browser persistence, hosting headers/assets and the full offline/reconnect/multi-device scenarios. Do not assume compatibility without testing.
>
> Create or update `docs/IMPLEMENTATION_STATUS.md`, `docs/ARCHITECTURE_DECISIONS.md`, `docs/DATA_MIGRATION.md` and `docs/TEST_MATRIX.md` with the audit findings and proposed plan. Work on a feature branch for any code changes. Do not deploy, push to main, run destructive migrations or alter production data.
>
> Report the audit, migration risks, POC steps, recommended dependency versions and the first small implementation slice. Wait for approval before any destructive or production-affecting action.

---

## Final product decision summary

Dali Life OS is approved as a **hybrid premium-minimal, AI-assisted, local-first personal operating system**. The app's first responsibility is to give the user a reliable daily and weekly command center. Its second responsibility is to connect health, projects, work, food, household and personal time through one coherent data model. Its third responsibility is to provide an integrated AI assistant that analyzes and proposes while the user remains in control.

The implementation must begin with repository discovery, data protection and a cross-platform sync proof of concept — not with a blind rewrite.
