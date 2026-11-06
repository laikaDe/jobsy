# Spec Delta

## MODIFIED Requirements

### Requirement: Optional access password
When an access password is configured, every page, server action and JSON API endpoint SHALL require it via HTTP Basic auth. Pages and server actions SHALL answer missing or wrong credentials with a Basic auth challenge; API endpoints SHALL answer with a JSON 401 and no challenge, so no browser login dialog appears. When none is configured, the app SHALL be open with no login.

#### Scenario: Password configured
- **GIVEN** an access password is configured
- **WHEN** a request for a page arrives without valid credentials
- **THEN** the response is 401 with a Basic auth challenge

#### Scenario: API request without valid credentials
- **GIVEN** an access password is configured
- **WHEN** a request to `/api/jobs` arrives without valid credentials
- **THEN** the response is 401 with a JSON error body and no `WWW-Authenticate` header

#### Scenario: API request with valid credentials
- **GIVEN** an access password is configured
- **WHEN** a request to `/api/jobs` carries Basic auth with that password
- **THEN** the request is handled normally

#### Scenario: No password configured
- **WHEN** no access password is configured and the user opens the app
- **THEN** the app loads without any login prompt
