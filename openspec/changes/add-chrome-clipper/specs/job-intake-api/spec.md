# Spec Delta

## Purpose

Lets clients outside the web UI, such as the browser clipper, create jobs and look up saved jobs by URL over HTTP JSON, with the same rules as the Job Form.

## ADDED Requirements

### Requirement: Create a job over the API
`POST /api/jobs` SHALL accept a JSON body with the Job Form fields (company, title, url, dateApplied, salary, status, notes), apply the same validation, company reuse, Date Applied auto-fill and stage-timestamp rules as the Job Form, and respond `201` with the created job's id, title, company name and status.

#### Scenario: Valid job created
- **WHEN** a client posts `{"company": "Acme", "title": "Frontend Engineer", "url": "https://acme.dev/jobs/1"}`
- **THEN** the response is 201 with the new job's id, the job is saved with status `WISHLIST`, and it appears on the board and in the dashboard numbers on the next page load

#### Scenario: Created as Applied
- **WHEN** a client posts a valid job with status `APPLIED` and no dateApplied
- **THEN** the saved job's Date Applied is today, exactly as if it had been created through the Job Form

#### Scenario: Existing company reused
- **GIVEN** a company "Acme" exists
- **WHEN** a client posts a job with company " acme "
- **THEN** the job is linked to the existing "Acme" company

### Requirement: API validation errors
The API SHALL reject an invalid create request with `400` and a JSON body containing one message per invalid field, and SHALL save nothing.

#### Scenario: Missing title
- **WHEN** a client posts `{"company": "Acme"}`
- **THEN** the response is 400 with a `fieldErrors.title` message and no job is saved

#### Scenario: Malformed body
- **WHEN** a client posts a body that is not valid JSON
- **THEN** the response is 400 with an error message and no job is saved

### Requirement: Look up a job by URL
`GET /api/jobs?url=<url>` SHALL return the saved job whose URL matches the given URL after normalization, or report that none exists. Normalization SHALL ignore the fragment, a trailing slash, letter case in the host, and `utm_*` query parameters.

#### Scenario: Match after normalization
- **GIVEN** a saved job with URL `https://acme.dev/jobs/1`
- **WHEN** a client requests `GET /api/jobs?url=https://ACME.dev/jobs/1/?utm_source=x#apply`
- **THEN** the response is 200 with that job's id, title, company name and status

#### Scenario: No match
- **WHEN** a client looks up a URL no saved job has
- **THEN** the response is 200 with `{"job": null}`

#### Scenario: Missing or invalid url parameter
- **WHEN** a client requests `GET /api/jobs` without a valid http(s) `url` parameter
- **THEN** the response is 400 with an error message

### Requirement: API storage failures
When the database cannot be reached, the API SHALL respond `500` with a JSON error message rather than an HTML error page.

#### Scenario: Database unavailable
- **WHEN** a client posts a valid job and the database write fails
- **THEN** the response is 500 with a JSON `error` message and no partial job is saved
