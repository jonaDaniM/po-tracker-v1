# PO Tracker v1

PO Tracker is a Google Apps Script application for tracking requisitions, purchase orders, and material receiving against a Google Sheets database.

The program is designed for material operations teams that receive requisition exports, normalize them into a controlled workbook, and need a simple field/admin workflow for answering practical questions:

- What has arrived?
- What is damaged?
- What arrived but is the incorrect item?
- What should have arrived but is not here?
- What has the vendor confirmed as backordered?
- Which requisition lines still need promised dates, PO assignment, notes, or admin review?

## What this repository contains

This repository contains only the source needed to deploy the Apps Script application:

- `POCoreV1/` — the versioned core library. It owns the sheet contracts, repositories, import parser, role enforcement, receiving workflow, admin-edit workflow, audit logging, diagnostics, backup helpers, and public API.
- `Bound/` — the thin bound web app. It owns the UI, Apps Script web adapters, environment setup helpers, and the manifest that references the deployed `POCoreV1` library.

The Google Sheets database workbook is intentionally not committed. Production spreadsheet IDs, deployment IDs, source requisition files, exports, and operational history should stay outside version control.

## Roles

PO Tracker uses role-based access in both the UI and the Core library.

- Field User: search assigned material and record receiving outcomes.
- Admin: view the admin dashboard, import/publish requisitions, inspect queues, and review operational status.
- Admin Edit: all Admin rights plus editing requisition/PO identifiers, assigning selected lines to POs, adding line-level admin notes, adding line items, deleting line items, and deleting requisitions.
- System Owner: all capabilities plus user/configuration management, migrations, backups, diagnostics, owner corrections, and deletion/correction review.

## Field workflow

Field users search by requisition, PO, job/account, description, or line identifiers. For each line item, they can record:

- Here — good material received.
- Damaged — material received but unusable; notes are required.
- Incorrect Item — material received does not match the ordered item; notes are required.
- Not Here — material expected by the promised date but not present; notes are required and the action is blocked before the promised date.

Receiving actions use idempotency keys, script locks, append-only transactions, summary recalculation, index refreshes, and audit records so retries do not create duplicate transactions.

## Admin workflow

Admins import normalized requisition files through a staged upload/publish flow. The import process preserves source file metadata, parses the requisition layout, validates required fields, and publishes canonical header and line records only after review.

The admin dashboard is designed to avoid heavy startup loads. It shows summary metrics and operational queues first, then loads document details on demand. Admin users can expand a requisition to view line status, notes, quantities, promised dates, exceptions, and PO assignments.

Admin Edit users can:

- Set promised dates for an entire requisition or selected lines.
- Edit requisition and PO identifiers when corporate values change.
- Assign selected line items to a PO number, supporting one requisition split across multiple POs.
- Add line-level admin notes that stay tied to the selected item.
- Add missing line items to an already published requisition.
- Soft-delete selected line items.
- Soft-delete an entire requisition.
- Confirm vendor backorders with vendor name, confirmation date, revised promised date, optional reference, and notes.

Deleted records are not physically removed from the workbook. They are marked inactive and audited so System Owners can see who deleted what and why.

## Core data model

The database is a Google Sheets workbook with strict tabs for:

- configuration and users;
- import batches, staging headers, staging lines, and issues;
- canonical procurement headers and line items;
- document links;
- material transactions;
- delivery exceptions;
- vendor backorders;
- procurement notes;
- search/operational indexes;
- audit, health, backup, owner correction, and recovery history.

Ordered, received, and open quantities are canonical totals. Damaged, incorrect-item, not-here, and vendor-backorder records classify open quantity; they are not separate ordered quantities.

## Deployment overview

1. Create the Google Sheets database from the PO Tracker workbook template.
2. Create a standalone Apps Script project for `POCoreV1`.
3. Paste the files from `POCoreV1/` into that project.
4. Enable the required Apps Script services and deploy a versioned library.
5. Create the bound Apps Script web app.
6. Paste the files from `Bound/` into the bound project.
7. Replace `REPLACE_WITH_POCORE_LIBRARY_ID` in `Bound/appsscript.json` with the deployed Core library ID and pin it to the intended immutable version.
8. Configure TEST and PRODUCTION spreadsheet IDs using the setup helpers in `Bound/Setup.gs`.
9. Run the bootstrap/setup function for TEST first.
10. Smoke-test imports, dashboard loading, roles, receiving actions, admin edits, owner diagnostics, and backups before configuring PRODUCTION.

Do not hard-code production IDs throughout the source. The Bound app reads the selected environment from Apps Script properties so TEST and PRODUCTION stay isolated.

## Order-number default and cancellation policy

For R5543500 requisition imports, PO Tracker uses the parsed numeric `ORDER NUMBER`
as the initial PO value when the requisition is first staged/published. Admin Edit
users can still replace the Primary PO later or split selected lines across multiple POs.

Admin soft-delete protects records with evidence that material was physically received:
`RECEIVED_GOOD`, `DAMAGED_REPORTED`, and `INCORRECT_ITEM_REPORTED`.

`NOT_HERE` and `VENDOR_BACKORDER_CONFIRMED` do not by themselves prove physical receipt.
Those records may be cancelled while transaction, audit, and deletion history remains traceable.

## Safety model

PO Tracker is intentionally conservative:

- Core re-checks permissions for every public call.
- Mutating workflows use script locks.
- Field and backorder transactions use idempotency keys.
- Transaction history is append-only.
- Owner corrections create compensating transactions instead of editing history.
- Deletions are soft deletes with audit records.
- Indexes are refreshed after mutations so dashboard and search screens avoid ledger scans.
- Production IDs and operational files are excluded from source control.

## Current scope

V1 tracks receiving, delivery exceptions, backorders, requisition/PO identity changes, line-level admin notes, soft deletion, and owner correction workflows.

It does not generate purchasing documents, handle purchasing approvals, invoice matching, payments, RMAs, vendor scoring, automated email notification, or vendor-portal integrations. Vendor PO metadata and document links are retained so document viewing can be added later once sharing rules are finalized.

