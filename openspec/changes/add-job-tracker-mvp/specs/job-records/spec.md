# Spec Delta

## Purpose

Lets the single user record, edit, and delete job applications and their companies, and keeps the stage timestamps that analytics depend on.

## ADDED Requirements

### Requirement: Job statuses
Every job SHALL have exactly one status from the fixed set: `WISHLIST`, `APPLIED`, `INTERVIEWING`, `OFFER`, `REJECTED`. New jobs SHALL default to `WISHLIST`.

#### Scenario: Default status
- **WHEN** a job is created without a status
- **THEN** its status is `WISHLIST`

#### Scenario: Unknown status rejected
- **WHEN** a create or update request supplies status `ARCHIVED`
- **THEN** the request is rejected with a validation error and nothing is saved

### Requirement: Create and edit a job
The user SHALL be able to create and edit a job through a single form with the fields Company (required), Title (required), URL (optional, valid http/https URL), Date Applied (optional date), Salary (optional free text), Status, and Notes (optional free text).

#### Scenario: Create a job
- **WHEN** the user submits the form with Company "Acme" and Title "Frontend Engineer"
- **THEN** a job is saved and appears on the board in the column for its status

#### Scenario: Missing required field
- **WHEN** the user submits the form with an empty Title
- **THEN** the form stays open, shows an inline error on Title, and nothing is saved

#### Scenario: Invalid URL
- **WHEN** the user enters `not-a-url` in URL and submits
- **THEN** the form shows an inline error on URL and nothing is saved

#### Scenario: Edit pre-fills values
- **WHEN** the user opens an existing job for editing
- **THEN** every field is pre-filled with the job's current values

### Requirement: Company reuse by name
Saving a job SHALL link it to an existing company whose name matches case-insensitively after trimming whitespace, and SHALL create the company only when no match exists.

#### Scenario: Existing company reused
- **GIVEN** a company named "Acme" exists
- **WHEN** the user saves a job with Company " acme "
- **THEN** the job is linked to the existing "Acme" company and no new company is created

### Requirement: Delete a job
The user SHALL be able to delete a job after confirming. Deleting a job SHALL delete its interviews. Companies SHALL NOT be deleted when their jobs are.

#### Scenario: Confirmed delete
- **WHEN** the user clicks Delete in the job form and confirms
- **THEN** the job and its interviews are removed and the job disappears from the board and dashboard counts

#### Scenario: Cancelled delete
- **WHEN** the user clicks Delete and cancels the confirmation
- **THEN** the job is unchanged

### Requirement: Stage timestamps
The system SHALL record, for each job, the time its status last changed, and the first time it left `APPLIED` and first reached `INTERVIEWING`. First-time timestamps SHALL NOT be overwritten by later moves.

#### Scenario: Leaving Applied
- **GIVEN** a job in `APPLIED` with no recorded exit time
- **WHEN** its status changes to `INTERVIEWING`
- **THEN** its Applied-exit time and first-interview time are set to now

#### Scenario: Moving back does not reset
- **GIVEN** a job that already left `APPLIED` on 2026-10-01
- **WHEN** it is moved back to `APPLIED` and later to `REJECTED`
- **THEN** its Applied-exit time remains 2026-10-01

#### Scenario: Status change time
- **WHEN** a job's status changes
- **THEN** its last-status-change time is set to now; editing other fields without changing status leaves it unchanged

### Requirement: Date Applied auto-fill
When a job moves to `APPLIED` (or any later stage) and has no Date Applied, the system SHALL set Date Applied to today.

#### Scenario: Auto-fill on move
- **GIVEN** a `WISHLIST` job with no Date Applied
- **WHEN** it is moved to `APPLIED`
- **THEN** its Date Applied is today's date

#### Scenario: Existing date kept
- **GIVEN** a job with Date Applied 2026-09-15
- **WHEN** it is moved to `APPLIED`
- **THEN** its Date Applied remains 2026-09-15

### Requirement: Optional access password
When an access password is configured, every page and server action SHALL require it via HTTP Basic auth. When none is configured, the app SHALL be open with no login.

#### Scenario: Password configured
- **GIVEN** an access password is configured
- **WHEN** a request arrives without valid credentials
- **THEN** the response is 401 with a Basic auth challenge

#### Scenario: No password configured
- **WHEN** no access password is configured and the user opens the app
- **THEN** the app loads without any login prompt
