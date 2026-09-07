const PO_BOUND_PROPERTIES = Object.freeze({
  ACTIVE_ENVIRONMENT: 'PO_TRACKER_ACTIVE_ENVIRONMENT',
  TEST_DATABASE_ID: 'PO_TRACKER_TEST_DATABASE_ID',
  PRODUCTION_DATABASE_ID: 'PO_TRACKER_PRODUCTION_DATABASE_ID'
});

function configurePoTrackerEnvironment(spreadsheetId, environment) {
  const id = String(spreadsheetId || '').trim();
  const env = String(environment || 'TEST').trim().toUpperCase();
  if (!id) throw new Error('spreadsheetId is required.');
  if (['TEST', 'PRODUCTION'].indexOf(env) < 0) throw new Error('environment must be TEST or PRODUCTION.');
  const spreadsheet = SpreadsheetApp.openById(id);
  if (!spreadsheet.getSheetByName('Configuration') || !spreadsheet.getSheetByName('Procurement_Header')) {
    throw new Error('The selected spreadsheet is not a PO Tracker v1 database.');
  }
  const properties = PropertiesService.getScriptProperties();
  const configuredIds = [properties.getProperty(PO_BOUND_PROPERTIES.TEST_DATABASE_ID), properties.getProperty(PO_BOUND_PROPERTIES.PRODUCTION_DATABASE_ID)].filter(Boolean);
  if (configuredIds.length) {
    const activeEnvironment = properties.getProperty(PO_BOUND_PROPERTIES.ACTIVE_ENVIRONMENT) || 'TEST';
    const authorizationId = properties.getProperty(activeEnvironment === 'PRODUCTION' ? PO_BOUND_PROPERTIES.PRODUCTION_DATABASE_ID : PO_BOUND_PROPERTIES.TEST_DATABASE_ID) || configuredIds[0];
    const currentUser = POCoreV1.getPoTrackerBootstrap(authorizationId, authenticatedEmailPo_()).user;
    if (!currentUser.canOwnerEdit) throw new Error('System Owner access is required to change database mappings.');
  }
  properties.setProperty(env === 'TEST' ? PO_BOUND_PROPERTIES.TEST_DATABASE_ID : PO_BOUND_PROPERTIES.PRODUCTION_DATABASE_ID, id);
  properties.setProperty(PO_BOUND_PROPERTIES.ACTIVE_ENVIRONMENT, env);
  return {success: true, environment: env, spreadsheetId: id, spreadsheetName: spreadsheet.getName()};
}

function setPoTrackerActiveEnvironment(environment) {
  const env = String(environment || '').trim().toUpperCase();
  if (['TEST', 'PRODUCTION'].indexOf(env) < 0) throw new Error('environment must be TEST or PRODUCTION.');
  const properties = PropertiesService.getScriptProperties();
  const targetId = properties.getProperty(env === 'TEST' ? PO_BOUND_PROPERTIES.TEST_DATABASE_ID : PO_BOUND_PROPERTIES.PRODUCTION_DATABASE_ID);
  if (!targetId) throw new Error(env + ' database ID has not been configured.');
  const user = POCoreV1.getPoTrackerBootstrap(targetId, authenticatedEmailPo_()).user;
  if (!user.canOwnerEdit) throw new Error('System Owner access is required to switch environments.');
  properties.setProperty(PO_BOUND_PROPERTIES.ACTIVE_ENVIRONMENT, env);
  return {success: true, environment: env, spreadsheetId: targetId};
}

function bootstrapConfiguredPoTracker(environment) {
  const context = poBoundContext_(environment);
  return POCoreV1.bootstrapPoTrackerDatabase(context.databaseId, context.email, displayNamePo_(context.email), context.environment);
}

function poBoundContext_(environment) {
  const properties = PropertiesService.getScriptProperties();
  const env = String(environment || properties.getProperty(PO_BOUND_PROPERTIES.ACTIVE_ENVIRONMENT) || 'TEST').trim().toUpperCase();
  if (['TEST', 'PRODUCTION'].indexOf(env) < 0) throw new Error('Configured environment is invalid.');
  const databaseId = properties.getProperty(env === 'TEST' ? PO_BOUND_PROPERTIES.TEST_DATABASE_ID : PO_BOUND_PROPERTIES.PRODUCTION_DATABASE_ID);
  if (!databaseId) throw new Error(env + ' database ID is not configured. Run configurePoTrackerEnvironment from the Apps Script editor.');
  return {environment: env, databaseId: databaseId, email: authenticatedEmailPo_()};
}

function authenticatedEmailPo_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('Your Google account email is unavailable. Deploy the web app as the user accessing it and restrict access to your organization.');
  return email;
}

function displayNamePo_(email) { return String(email || '').split('@')[0].replace(/[._-]+/g, ' '); }
