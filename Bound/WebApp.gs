function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.applicationTitle = 'PO Tracker';
  return template.evaluate().setTitle('PO Tracker').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function includePo_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function poBootstrap() { const c = poBoundContext_(); return POCoreV1.getPoTrackerBootstrap(c.databaseId, c.email); }

function poRecordAccess() {
  const c = poBoundContext_();
  return POCoreV1.getRecentPoTrackerAccess(c.databaseId, c.email);
}

function poSearch(query) { const c = poBoundContext_(); return POCoreV1.searchPoTracker(c.databaseId, c.email, query); }
function poDetail(procurementId) { const c = poBoundContext_(); return POCoreV1.getPoTrackerDetail(c.databaseId, c.email, procurementId); }
function poReceive(request) { const c = poBoundContext_(); return POCoreV1.performPoReceivingAction(c.databaseId, c.email, request); }
function poAdminDashboard() { const c = poBoundContext_(); return POCoreV1.getPoAdminDashboard(c.databaseId, c.email); }
function poAdminDocuments(request) { const c = poBoundContext_(); return POCoreV1.getPoAdminDocuments(c.databaseId, c.email, request); }
function poSavePromisedDates(updates) { const c = poBoundContext_(); return POCoreV1.savePoPromisedDates(c.databaseId, c.email, updates); }
function poSaveReqPromisedDate(procurementId, promisedDate) { const c = poBoundContext_(); return POCoreV1.savePoPromisedDateForProcurement(c.databaseId, c.email, procurementId, promisedDate); }
function poConfirmBackorder(request) { const c = poBoundContext_(); return POCoreV1.confirmPoVendorBackorder(c.databaseId, c.email, request); }
function poUpdateReqPoIdentifiers(request) { const c = poBoundContext_(); return POCoreV1.updatePoProcurementIdentifiers(c.databaseId, c.email, request); }
function poAssignLinesToPo(request) { const c = poBoundContext_(); return POCoreV1.assignPoLinesToPurchaseOrder(c.databaseId, c.email, request); }
function poAddReqLine(request) { const c = poBoundContext_(); return POCoreV1.addPoProcurementLine(c.databaseId, c.email, request); }
function poDeleteReqLines(request) { const c = poBoundContext_(); return POCoreV1.deletePoProcurementLines(c.databaseId, c.email, request); }
function poDeleteReq(request) { const c = poBoundContext_(); return POCoreV1.deletePoProcurement(c.databaseId, c.email, request); }
function poAddReqNote(request) { const c = poBoundContext_(); return POCoreV1.addPoProcurementNote(c.databaseId, c.email, request); }
function poCreateImportBatch(notes) { const c = poBoundContext_(); return POCoreV1.createPoImportBatch(c.databaseId, c.email, notes); }
function poUploadImportFile(payload) { const c = poBoundContext_(); return POCoreV1.uploadPoImportFile(c.databaseId, c.email, payload); }
function poImportBatch(batchId) { const c = poBoundContext_(); return POCoreV1.getPoImportBatch(c.databaseId, c.email, batchId); }
function poStagingDetail(stagingDocumentId) { const c = poBoundContext_(); return POCoreV1.getPoStagingDocumentDetail(c.databaseId, c.email, stagingDocumentId); }
function poPublishStaging(stagingDocumentId, allowWarnings) { const c = poBoundContext_(); return POCoreV1.publishPoStagingDocument(c.databaseId, c.email, stagingDocumentId, allowWarnings); }
function poSystemControl() { const c = poBoundContext_(); return POCoreV1.getPoSystemControl(c.databaseId, c.email); }
function poSaveSystemUser(request) { const c = poBoundContext_(); return POCoreV1.savePoSystemUser(c.databaseId, c.email, request); }
function poSaveConfiguration(updates) { const c = poBoundContext_(); return POCoreV1.savePoConfiguration(c.databaseId, c.email, updates); }
function poCreateBackup(notes) { const c = poBoundContext_(); return POCoreV1.createPoDatabaseBackup(c.databaseId, c.email, 'MANUAL', notes); }
function poRunHealth() { const c = poBoundContext_(); return POCoreV1.runPoOperationalHealth(c.databaseId, c.email); }
function poMigrateSchema() { const c = poBoundContext_(); return POCoreV1.migratePoTrackerSchema(c.databaseId, c.email); }
function poPreviewCorrection(transactionId, reason) { const c = poBoundContext_(); return POCoreV1.previewPoOwnerCorrection(c.databaseId, c.email, transactionId, reason); }
function poApplyCorrection(correctionId, verificationCode) { const c = poBoundContext_(); return POCoreV1.applyPoOwnerCorrection(c.databaseId, c.email, correctionId, verificationCode); }
