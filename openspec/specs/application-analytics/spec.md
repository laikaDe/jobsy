# application-analytics Specification

## Purpose

Turns the job list into a few at-a-glance numbers on the dashboard so the user can see pipeline volume, interview traction, and response speed.

## Requirements

### Requirement: Dashboard stat tiles
The dashboard SHALL show three tiles: Total Applied, Active Interviews, and Ghosted / Rejected, computed from current data on every page load.

#### Scenario: Empty database
- **WHEN** no jobs exist
- **THEN** all three tiles show 0 and a prompt to add the first job is shown

### Requirement: Total Applied count
Total Applied SHALL count every job with a Date Applied, regardless of current status. Wishlist jobs without a Date Applied SHALL NOT count.

#### Scenario: Rejected jobs still count as applied
- **GIVEN** jobs: 2 `WISHLIST` (no date), 3 `APPLIED`, 1 `INTERVIEWING`, 1 `REJECTED`, all non-wishlist with a Date Applied
- **WHEN** the dashboard loads
- **THEN** Total Applied shows 5

### Requirement: Active Interviews count
Active Interviews SHALL count jobs whose current status is `INTERVIEWING`.

#### Scenario: Only current interviews
- **GIVEN** 2 `INTERVIEWING` jobs and 1 `OFFER` job that previously interviewed
- **WHEN** the dashboard loads
- **THEN** Active Interviews shows 2

### Requirement: Ghosted rule
A job SHALL be ghosted when its status is `APPLIED` and its status has not changed for at least 30 days. The threshold SHALL be configurable at deploy time.

#### Scenario: Stale application
- **GIVEN** an `APPLIED` job whose status last changed 31 days ago
- **WHEN** the dashboard or board loads
- **THEN** the job is treated as ghosted

#### Scenario: Recent application
- **GIVEN** an `APPLIED` job whose status changed 10 days ago
- **WHEN** the dashboard loads
- **THEN** the job is not ghosted

### Requirement: Ghosted / Rejected count
Ghosted / Rejected SHALL equal the number of `REJECTED` jobs plus the number of ghosted jobs.

#### Scenario: Combined count
- **GIVEN** 2 `REJECTED` jobs and 1 ghosted `APPLIED` job
- **WHEN** the dashboard loads
- **THEN** Ghosted / Rejected shows 3

### Requirement: Application to interview conversion rate
The dashboard SHALL show the percentage of applied jobs (those with a Date Applied) that have ever reached `INTERVIEWING`, rounded to one decimal. With zero applied jobs it SHALL show "—" instead of a number.

#### Scenario: Conversion includes later outcomes
- **GIVEN** 10 applied jobs, of which 3 reached `INTERVIEWING` (one is now `OFFER`, one `REJECTED`)
- **WHEN** the dashboard loads
- **THEN** conversion shows 30.0%

#### Scenario: No applications
- **WHEN** no job has a Date Applied
- **THEN** conversion shows "—"

### Requirement: Average days in Applied
The dashboard SHALL show the mean number of days, to one decimal, between Date Applied and the first time a job left `APPLIED`, over jobs that have both. Jobs still in `APPLIED` SHALL be excluded. With no qualifying jobs it SHALL show "—".

#### Scenario: Mean of completed stages
- **GIVEN** three jobs that left Applied after 4, 10, and 7 days, and one job still in Applied
- **WHEN** the dashboard loads
- **THEN** average days in Applied shows 7.0

#### Scenario: Nothing has moved yet
- **WHEN** every applied job is still in `APPLIED`
- **THEN** average days in Applied shows "—"
