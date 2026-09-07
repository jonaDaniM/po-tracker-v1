function poV1PublicValue_(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(poV1PublicValue_);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).forEach(function (key) { result[key] = poV1PublicValue_(value[key]); });
    return result;
  }
  return value;
}

function poV1Call_(databaseId, callback) { setPoV1DatabaseContext_(databaseId); return poV1PublicValue_(callback()); }

function getPoTrackerVersion() { return {version: PO_V1.VERSION, schemaVersion: PO_V1.SCHEMA_VERSION, parserVersion: PO_V1.PARSER_VERSION}; }
function bootstrapPoTrackerDatabase(databaseId, authenticatedEmail, displayName, environment) { return poV1PublicValue_(bootstrapPoTrackerDatabaseInternal_(databaseId, authenticatedEmail, displayName, environment)); }
function getPoTrackerBootstrap(databaseId, authenticatedEmail) { return poV1Call_(databaseId, function () { return getPoTrackerBootstrapInternal_(authenticatedEmail); }); }
function searchPoTracker(databaseId, authenticatedEmail, query) { return poV1Call_(databaseId, function () { return searchProcurementPoV1_(authenticatedEmail, query); }); }
function getPoTrackerDetail(databaseId, authenticatedEmail, procurementId) { return poV1Call_(databaseId, function () { return getProcurementDetailPoV1_(authenticatedEmail, procurementId); }); }
function performPoReceivingAction(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return performReceivingActionPoV1_(authenticatedEmail, request); }); }
function createPoImportBatch(databaseId, authenticatedEmail, notes) { return poV1Call_(databaseId, function () { return createImportBatchPoV1_(authenticatedEmail, notes); }); }
function uploadPoImportFile(databaseId, authenticatedEmail, payload) { return poV1Call_(databaseId, function () { return uploadImportFilePoV1_(authenticatedEmail, payload); }); }
function getPoImportBatch(databaseId, authenticatedEmail, batchId) { return poV1Call_(databaseId, function () { assertAdminUserPoV1_(authenticatedEmail); return getImportBatchPoV1_(batchId); }); }
function getPoStagingDocumentDetail(databaseId, authenticatedEmail, stagingDocumentId) { return poV1Call_(databaseId, function () { return getStagingDocumentDetailPoV1_(authenticatedEmail, stagingDocumentId); }); }
function getRecentPoImportBatches(databaseId, authenticatedEmail, limit) { return poV1Call_(databaseId, function () { assertAdminUserPoV1_(authenticatedEmail); return getRecentImportBatchesPoV1_(limit); }); }
function publishPoStagingDocument(databaseId, authenticatedEmail, stagingDocumentId, allowWarnings) { return poV1Call_(databaseId, function () { return publishStagingDocumentPoV1_(authenticatedEmail, stagingDocumentId, allowWarnings); }); }
function getPoAdminDashboard(databaseId, authenticatedEmail) { return poV1Call_(databaseId, function () { return getAdminDashboardPoV1_(authenticatedEmail); }); }
function getPoAdminDocuments(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return getAdminDocumentsPoV1_(authenticatedEmail, request); }); }
function savePoPromisedDates(databaseId, authenticatedEmail, updates) { return poV1Call_(databaseId, function () { return savePromisedDatesPoV1_(authenticatedEmail, updates); }); }
function savePoPromisedDateForProcurement(databaseId, authenticatedEmail, procurementId, promisedDate) { return poV1Call_(databaseId, function () { return savePromisedDateForProcurementPoV1_(authenticatedEmail, procurementId, promisedDate); }); }
function confirmPoVendorBackorder(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return confirmVendorBackorderPoV1_(authenticatedEmail, request); }); }
function updatePoProcurementIdentifiers(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return updateProcurementIdentifiersPoV1_(authenticatedEmail, request); }); }
function assignPoLinesToPurchaseOrder(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return assignLinesToPurchaseOrderPoV1_(authenticatedEmail, request); }); }
function addPoProcurementLine(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return addProcurementLinePoV1_(authenticatedEmail, request); }); }
function deletePoProcurementLines(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return deleteProcurementLinesPoV1_(authenticatedEmail, request); }); }
function deletePoProcurement(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return deleteProcurementPoV1_(authenticatedEmail, request); }); }
function addPoProcurementNote(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return addProcurementNotePoV1_(authenticatedEmail, request); }); }
function getPoSystemControl(databaseId, authenticatedEmail) { return poV1Call_(databaseId, function () { return getPoSystemControlPoV1_(authenticatedEmail); }); }
function savePoSystemUser(databaseId, authenticatedEmail, request) { return poV1Call_(databaseId, function () { return savePoSystemUserPoV1_(authenticatedEmail, request); }); }
function savePoConfiguration(databaseId, authenticatedEmail, updates) { return poV1Call_(databaseId, function () { return savePoConfigurationPoV1_(authenticatedEmail, updates); }); }
function createPoDatabaseBackup(databaseId, authenticatedEmail, triggerType, notes) { return poV1Call_(databaseId, function () { return createPoDatabaseBackupPoV1_(authenticatedEmail, triggerType, notes); }); }
function migratePoTrackerSchema(databaseId, authenticatedEmail) { return poV1Call_(databaseId, function () { return migratePoTrackerSchemaPoV1_(authenticatedEmail); }); }
function inspectPoTrackerContract(databaseId, authenticatedEmail) { return poV1Call_(databaseId, function () { assertOwnerPoV1_(authenticatedEmail); return inspectPoTrackerContractInternal_(); }); }
function inspectPoTrackerIntegrity(databaseId, authenticatedEmail) { return poV1Call_(databaseId, function () { assertOwnerPoV1_(authenticatedEmail); return inspectPoTrackerIntegrityInternal_(); }); }
function runPoOperationalHealth(databaseId, authenticatedEmail) { return poV1Call_(databaseId, function () { return runPoOperationalHealthInternal_(authenticatedEmail); }); }
function previewPoOwnerCorrection(databaseId, authenticatedEmail, targetTransactionId, reason) { return poV1Call_(databaseId, function () { return previewPoOwnerCorrectionPoV1_(authenticatedEmail, targetTransactionId, reason); }); }
function applyPoOwnerCorrection(databaseId, authenticatedEmail, correctionId, verificationCode) { return poV1Call_(databaseId, function () { return applyPoOwnerCorrectionPoV1_(authenticatedEmail, correctionId, verificationCode); }); }
