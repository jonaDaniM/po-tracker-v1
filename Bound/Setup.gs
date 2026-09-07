function setupPoTrackerTest() {
  const spreadsheetId = 'PASTE_TEST_SPREADSHEET_ID_HERE';
  if (spreadsheetId.indexOf('PASTE_') === 0) throw new Error('Paste the native TEST Google Sheet ID into Bound/Setup.gs first.');
  const configured = configurePoTrackerEnvironment(spreadsheetId, 'TEST');
  const bootstrapped = bootstrapConfiguredPoTracker('TEST');
  return {configured: configured, bootstrapped: bootstrapped};
}

function setupPoTrackerProduction() {
  const spreadsheetId = 'PASTE_PRODUCTION_SPREADSHEET_ID_HERE';
  if (spreadsheetId.indexOf('PASTE_') === 0) throw new Error('Paste the native PRODUCTION Google Sheet ID into Bound/Setup.gs first.');
  const configured = configurePoTrackerEnvironment(spreadsheetId, 'PRODUCTION');
  const bootstrapped = bootstrapConfiguredPoTracker('PRODUCTION');
  return {configured: configured, bootstrapped: bootstrapped};
}

function migrateActivePoTrackerSchema() {
  const context = poBoundContext_();
  return POCoreV1.migratePoTrackerSchema(context.databaseId, context.email);
}
