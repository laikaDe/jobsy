# Spec Delta

## Purpose

A Chrome extension that clips the job posting in the current tab into Jobsy, pre-filling what it can read from the page so a job is saved in two clicks without leaving the posting.

## ADDED Requirements

### Requirement: Pre-fill from the current page
Opening the popup SHALL read the active tab and pre-fill URL, Title and Company. Structured `JobPosting` data on the page SHALL take precedence, then page metadata (Open Graph title and site name), then the document title. Fields it cannot determine SHALL be left empty for the user to fill.

#### Scenario: Page with JobPosting data
- **GIVEN** the active tab has JSON-LD `JobPosting` data with title "Frontend Engineer" and hiring organization "Acme"
- **WHEN** the user opens the popup
- **THEN** Title is "Frontend Engineer", Company is "Acme" and URL is the tab's URL

#### Scenario: Page with only metadata
- **GIVEN** the active tab has no `JobPosting` data but has `og:title` "Backend Developer" and `og:site_name` "Globex Careers"
- **WHEN** the user opens the popup
- **THEN** Title is "Backend Developer" and Company is "Globex Careers"

#### Scenario: Page that cannot be read
- **GIVEN** the active tab is a page the extension cannot script, such as `chrome://extensions`
- **WHEN** the user opens the popup
- **THEN** the form opens with only the URL filled when it is http(s), and the user can still type the other fields

### Requirement: Save from the popup
The popup SHALL let the user edit Company, Title and URL, choose Status Wishlist (default) or Applied, add Notes, and save the job to the configured Jobsy instance. After a successful save it SHALL confirm and offer a link that opens the Jobsy board.

#### Scenario: Successful save
- **WHEN** the user fills Company and Title and clicks Save
- **THEN** the job is created in Jobsy and the popup shows "Saved" with an "Open board" link

#### Scenario: Save as Applied
- **WHEN** the user chooses Applied and saves
- **THEN** the job appears in the Applied column with today's Date Applied

### Requirement: Inline validation in the popup
The popup SHALL block saving when Company or Title is empty or the URL is not http(s), and SHALL show field errors returned by Jobsy inline next to the matching field.

#### Scenario: Empty title
- **WHEN** the user clears Title and clicks Save
- **THEN** nothing is sent, and Title shows an inline error

#### Scenario: Server-side field error
- **WHEN** Jobsy rejects the save with a field error on Title
- **THEN** the popup shows that message next to Title and keeps the user's input

### Requirement: Duplicate warning
When the popup opens on a URL that is already saved in Jobsy, it SHALL show the existing job's title, company and status with a link to the board, and SHALL require an explicit "Save anyway" to create another job for the same URL.

#### Scenario: Already saved
- **GIVEN** Jobsy has a job saved for the tab's URL
- **WHEN** the user opens the popup
- **THEN** the popup shows "Already in Jobsy" with that job's title, company and status, and the primary button reads "Save anyway"

#### Scenario: Lookup unavailable
- **WHEN** the duplicate lookup fails because Jobsy is unreachable
- **THEN** the popup still shows the form and reports the connection problem

### Requirement: Connection settings
The extension SHALL provide an options page that stores the Jobsy base URL (default `http://localhost:3000`) and an optional access password in extension storage. On save it SHALL request permission for that origin only, and it SHALL offer a "Test connection" check reporting success, wrong password, or unreachable.

#### Scenario: Configure a deployed instance
- **WHEN** the user enters `https://jobsy.example.app`, grants the permission prompt, and saves
- **THEN** later popup saves go to that origin

#### Scenario: Test with wrong password
- **GIVEN** Jobsy has an access password configured
- **WHEN** the user tests the connection with a different password
- **THEN** the options page reports "Wrong password"

#### Scenario: Invalid base URL
- **WHEN** the user enters `jobsy` (not an http(s) URL) and saves
- **THEN** the options page shows an error and keeps the previous settings

### Requirement: Connection and auth errors in the popup
The popup SHALL report an unreachable Jobsy, a rejected password and a missing origin permission as distinct messages, each with a link to the options page, and SHALL keep the user's input so they can retry.

#### Scenario: Jobsy not running
- **WHEN** the user saves while nothing answers at the configured URL
- **THEN** the popup shows "Can't reach Jobsy at <url>" with a link to the options, and the form keeps its values

#### Scenario: Wrong password
- **WHEN** Jobsy answers the save with 401
- **THEN** the popup shows "Jobsy rejected the password" with a link to the options

### Requirement: Minimal permissions
The extension SHALL read page content only for the active tab when the user opens the popup, and SHALL send data only to the configured Jobsy origin. It SHALL NOT request access to all websites.

#### Scenario: No background page access
- **WHEN** the user browses without opening the popup
- **THEN** the extension reads nothing from the pages visited and sends no requests
