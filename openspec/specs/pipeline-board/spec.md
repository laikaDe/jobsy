# pipeline-board Specification

## Purpose

Shows every job on a four-column Kanban board and lets the user move jobs between pipeline stages with immediate visual feedback.

## Requirements

### Requirement: Column layout
The board SHALL show four columns in order: Wishlist (`WISHLIST`), Applied (`APPLIED`), Interviewing (`INTERVIEWING`), Offer / Rejected (`OFFER` and `REJECTED`). Each column header SHALL show its job count.

#### Scenario: Final column groups two statuses
- **GIVEN** one `OFFER` job and two `REJECTED` jobs
- **WHEN** the user opens the board
- **THEN** the Offer / Rejected column shows three cards with header count 3, with `OFFER` cards listed before `REJECTED` cards

#### Scenario: Ordering within a column
- **WHEN** a column has several cards
- **THEN** they are ordered by most recent status change first

### Requirement: Card content
Each card SHALL show company name, job title, and days in current stage. Cards in the final column SHALL show an Offer or Rejected badge. Cards flagged as ghosted SHALL show a Ghosted badge.

#### Scenario: Card details
- **GIVEN** an `APPLIED` job at "Acme" titled "Frontend Engineer" whose status changed 5 days ago
- **WHEN** the board renders
- **THEN** its card shows "Acme", "Frontend Engineer", and "5d"

### Requirement: Move by drag and drop
The user SHALL be able to drag a card onto another column to change its status. Dropping on the Offer / Rejected column SHALL set status `OFFER` unless the user picks Rejected from the prompt shown on drop.

#### Scenario: Drag to Interviewing
- **WHEN** the user drags an Applied card onto the Interviewing column
- **THEN** the card appears in Interviewing immediately and the job's status is saved as `INTERVIEWING`

#### Scenario: Drop on the same column
- **WHEN** the user drops a card on the column it came from
- **THEN** nothing is saved

### Requirement: Move by click
Each card SHALL have a "Move to…" menu listing all five statuses except the current one, so moves work without dragging (keyboard and touch).

#### Scenario: Click to reject
- **WHEN** the user picks "Rejected" from an Interviewing card's Move menu
- **THEN** the card moves to the Offer / Rejected column with a Rejected badge and the status is saved as `REJECTED`

### Requirement: Optimistic move with rollback
A move SHALL update the board instantly, before the server confirms. If saving fails, the card SHALL return to its previous column and an error message SHALL be shown.

#### Scenario: Save fails
- **GIVEN** the database is unreachable
- **WHEN** the user moves a card from Applied to Interviewing
- **THEN** the card first appears in Interviewing, then returns to Applied, and an error toast says the move was not saved

#### Scenario: Persisted after reload
- **WHEN** a move succeeds and the user reloads the page
- **THEN** the card is in its new column

### Requirement: Open and add jobs from the board
Clicking a card SHALL open the job form for editing that job. An "Add job" button SHALL open an empty job form, and each column SHALL offer an add button that pre-selects that column's status.

#### Scenario: Add from a column
- **WHEN** the user clicks the add button on the Applied column
- **THEN** the job form opens with Status pre-set to `APPLIED`
