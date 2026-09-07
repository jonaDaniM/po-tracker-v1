function inspectPoTrackerContractInternal_() {
  const errors = [];
  const warnings = [];
  const spreadsheet = poV1Database_();
  Object.keys(PO_V1_HEADERS).forEach(function (sheetName) {
    const sheet = sheetPoV1_(sheetName);
    headerMapPoV1_(sheetName);
    const expected = PO_V1_HEADERS[sheetName];
    const actual = sheet.getRange(1, 1, 1, Math.max(expected.length, sheet.getLastColumn())).getDisplayValues()[0].map(normalizePoV1_);
    expected.forEach(function (header, index) {
      if (actual[index] !== header) errors.push(sheetName + ' column ' + (index + 1) + ' must be "' + header + '".');
    });
    const unexpected = actual.slice(expected.length).filter(Boolean);
    if (unexpected.length) warnings.push(sheetName + ' has columns outside the v1 contract: ' + unexpected.join(', '));
  });
  const schemaVersion = normalizePoV1_(getPoV1Configuration_().SCHEMA_VERSION);
  if (schemaVersion && schemaVersion !== PO_V1.SCHEMA_VERSION) warnings.push('Configuration SCHEMA_VERSION is ' + schemaVersion + '; Core expects ' + PO_V1.SCHEMA_VERSION + '. Run migratePoTrackerSchema after updating the library.');
  return {passed: errors.length === 0, schemaVersion: PO_V1.SCHEMA_VERSION, errors: errors, warnings: warnings};
}

function migratePoTrackerSchemaPoV1_(userEmail) {
  const owner = assertOwnerPoV1_(userEmail);
  Object.keys(PO_V1_HEADERS).forEach(function (sheetName) {
    sheetPoV1_(sheetName);
    headerMapPoV1_(sheetName);
  });
  const userUpdates = [];
  getUsedRowsPoV1_(PO_V1.SHEETS.USERS).forEach(function (row) {
    if (!normalizePoV1_(row.Can_Admin_Edit)) {
      userUpdates.push({rowNumber: row._rowNumber, patch: {Can_Admin_Edit: adminEditFlagPoV1_(row) ? PO_V1.YES : PO_V1.NO, Updated_By: owner.email, Updated_At: nowPoV1_()}});
    }
  });
  updateRowObjectsPoV1_(PO_V1.SHEETS.USERS, userUpdates);
  const headerUpdates = getUsedRowsPoV1_(PO_V1.SHEETS.HEADERS).filter(function (row) {
    return normalizePoV1_(row.Procurement_ID) && !normalizePoV1_(row.Qty_Incorrect_Open);
  }).map(function (row) { return {rowNumber: row._rowNumber, patch: {Qty_Incorrect_Open: 0, Updated_By: owner.email, Updated_At: nowPoV1_()}}; });
  const lineUpdates = getUsedRowsPoV1_(PO_V1.SHEETS.LINES).filter(function (row) {
    return normalizePoV1_(row.Procurement_Line_ID) && !normalizePoV1_(row.Qty_Incorrect_Open);
  }).map(function (row) { return {rowNumber: row._rowNumber, patch: {Qty_Incorrect_Open: 0, Updated_By: owner.email, Updated_At: nowPoV1_()}}; });
  updateRowObjectsPoV1_(PO_V1.SHEETS.HEADERS, headerUpdates);
  updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, lineUpdates);
  try { setConfigurationValuePoV1_('SCHEMA_VERSION', PO_V1.SCHEMA_VERSION); } catch (ignoredSchemaVersionUpdateError) { /* Contract inspection will report if unavailable. */ }
  try { setConfigurationValuePoV1_('APP_VERSION', PO_V1.VERSION); } catch (ignoredAppVersionUpdateError) { /* Older templates still remain usable. */ }
  appendAuditPoV1_('SYSTEM', databaseFingerprintPoV1_(), 'SCHEMA_MIGRATED', owner, uuidPoV1_('CORR'), {sourceInterface: 'OWNER', payload: {schemaVersion: PO_V1.SCHEMA_VERSION, updatedUsers: userUpdates.length, updatedHeaders: headerUpdates.length, updatedLines: lineUpdates.length}});
  SpreadsheetApp.flush();
  return inspectPoTrackerContractInternal_();
}

function inspectPoTrackerIntegrityInternal_() {
  const errors = [];
  const warnings = [];
  const tolerance = 0.000001;
  const headers = getUsedRowsPoV1_(PO_V1.SHEETS.HEADERS).filter(function (row) { return yesPoV1_(row.Active); });
  const lines = getUsedRowsPoV1_(PO_V1.SHEETS.LINES).filter(function (row) { return yesPoV1_(row.Active); });
  const transactions = getUsedRowsPoV1_(PO_V1.SHEETS.TRANSACTIONS).filter(function (row) { return yesPoV1_(row.Active); });
  const exceptions = getUsedRowsPoV1_(PO_V1.SHEETS.EXCEPTIONS).filter(function (row) { return yesPoV1_(row.Active); });
  const backorders = getUsedRowsPoV1_(PO_V1.SHEETS.BACKORDERS).filter(function (row) { return yesPoV1_(row.Active); });
  const lineById = {};
  const linesByProcurement = {};
  const goodLedgerByLine = {}; const damageByLine = {}; const incorrectByLine = {}; const notHereByLine = {}; const backorderByLine = {};
  function addTo(map, key, value) { map[key] = numberPoV1_(map[key]) + numberPoV1_(value); }
  lines.forEach(function (line) {
    const lineId = normalizePoV1_(line.Procurement_Line_ID); const procurementId = normalizePoV1_(line.Procurement_ID);
    lineById[lineId] = line; if (!linesByProcurement[procurementId]) linesByProcurement[procurementId] = []; linesByProcurement[procurementId].push(line);
  });
  transactions.forEach(function (row) {
    if (['RECEIVED_GOOD', 'REVERSAL_RECEIVED_GOOD'].includes(normalizeUpperPoV1_(row.Transaction_Type))) addTo(goodLedgerByLine, normalizePoV1_(row.Procurement_Line_ID), row.Quantity);
  });
  exceptions.forEach(function (row) {
    const type = normalizeUpperPoV1_(row.Exception_Type);
    const target = type === 'DAMAGED' ? damageByLine : (type === 'INCORRECT_ITEM' ? incorrectByLine : notHereByLine);
    addTo(target, normalizePoV1_(row.Procurement_Line_ID), row.Qty_Active);
  });
  backorders.forEach(function (row) { addTo(backorderByLine, normalizePoV1_(row.Procurement_Line_ID), row.Qty_Active); });

  lines.forEach(function (line) {
    const lineId = normalizePoV1_(line.Procurement_Line_ID);
    const ordered = numberPoV1_(line.Qty_Ordered);
    const received = numberPoV1_(line.Qty_Received_Good);
    const open = numberPoV1_(line.Qty_Open);
    const damage = numberPoV1_(line.Qty_Damaged_Open);
    const incorrect = numberPoV1_(line.Qty_Incorrect_Open);
    const notHere = numberPoV1_(line.Qty_Not_Here_Open);
    const vendorBackorder = numberPoV1_(line.Qty_Vendor_Backordered);
    if (Math.abs(ordered - received - open) > tolerance) errors.push('Line ' + lineId + ' does not satisfy ordered = good received + open.');
    if (damage + incorrect + notHere + vendorBackorder - open > tolerance) errors.push('Line ' + lineId + ' classifies more open quantity than exists.');
    const goodLedger = numberPoV1_(goodLedgerByLine[lineId]);
    if (Math.abs(received - goodLedger) > tolerance) errors.push('Line ' + lineId + ' good-received summary does not reconcile to the immutable ledger.');
    const activeDamage = numberPoV1_(damageByLine[lineId]);
    const activeIncorrect = numberPoV1_(incorrectByLine[lineId]);
    const activeNotHere = numberPoV1_(notHereByLine[lineId]);
    const activeBackorder = numberPoV1_(backorderByLine[lineId]);
    if (Math.abs(damage - activeDamage) > tolerance) errors.push('Line ' + lineId + ' damaged quantity does not reconcile to active exceptions.');
    if (Math.abs(incorrect - activeIncorrect) > tolerance) errors.push('Line ' + lineId + ' Incorrect Item quantity does not reconcile to active exceptions.');
    if (Math.abs(notHere - activeNotHere) > tolerance) errors.push('Line ' + lineId + ' Not Here quantity does not reconcile to active exceptions.');
    if (Math.abs(vendorBackorder - activeBackorder) > tolerance) errors.push('Line ' + lineId + ' vendor-backordered quantity does not reconcile to active backorders.');
  });
  exceptions.concat(backorders).forEach(function (row) {
    if (!lineById[normalizePoV1_(row.Procurement_Line_ID)]) errors.push('Active operational record references missing line ' + row.Procurement_Line_ID + '.');
  });

  headers.forEach(function (header) {
    const related = linesByProcurement[normalizePoV1_(header.Procurement_ID)] || [];
    const sums = related.reduce(function (result, line) {
      result.ordered += numberPoV1_(line.Qty_Ordered); result.received += numberPoV1_(line.Qty_Received_Good); result.open += numberPoV1_(line.Qty_Open);
      result.damage += numberPoV1_(line.Qty_Damaged_Open); result.incorrect += numberPoV1_(line.Qty_Incorrect_Open);
      result.notHere += numberPoV1_(line.Qty_Not_Here_Open); result.backorder += numberPoV1_(line.Qty_Vendor_Backordered); return result;
    }, {ordered: 0, received: 0, open: 0, damage: 0, incorrect: 0, notHere: 0, backorder: 0});
    if (related.length !== numberPoV1_(header.Total_Lines)) errors.push('Header ' + header.Procurement_ID + ' line count is stale.');
    [['Qty_Ordered', 'ordered'], ['Qty_Received_Good', 'received'], ['Qty_Open', 'open'], ['Qty_Damaged_Open', 'damage'], ['Qty_Incorrect_Open', 'incorrect'], ['Qty_Not_Here_Open', 'notHere'], ['Qty_Vendor_Backordered', 'backorder']].forEach(function (mapping) {
      if (Math.abs(numberPoV1_(header[mapping[0]]) - sums[mapping[1]]) > tolerance) errors.push('Header ' + header.Procurement_ID + ' has a stale ' + mapping[0] + ' aggregate.');
    });
  });

  return {passed: errors.length === 0, errors: errors, warnings: warnings, counts: {documents: headers.length, lines: lines.length, transactions: transactions.length, openExceptions: exceptions.length, activeBackorders: backorders.length}};
}

function runPoOperationalHealthInternal_(userEmail) {
  const user = assertOwnerPoV1_(userEmail);
  const contract = inspectPoTrackerContractInternal_();
  const integrity = inspectPoTrackerIntegrityInternal_();
  const activeUsers = getUsedRowsPoV1_(PO_V1.SHEETS.USERS).filter(function (row) { return yesPoV1_(row.Active); }).length;
  const backups = getUsedRowsPoV1_(PO_V1.SHEETS.BACKUPS).filter(function (row) { return yesPoV1_(row.Active); });
  const lastBackup = backups.length ? backups[backups.length - 1] : null;
  const status = contract.passed && integrity.passed ? 'PASS' : 'FAIL';
  const healthRunId = uuidPoV1_('HEALTH');
  appendObjectPoV1_(PO_V1.SHEETS.HEALTH, {
    Health_Run_ID: healthRunId, Environment: normalizeUpperPoV1_(getPoV1Configuration_().ENVIRONMENT_NAME || 'TEST'), Database_Fingerprint: databaseFingerprintPoV1_(),
    Overall_Status: status, Schema_Status: contract.passed ? 'PASS' : 'FAIL', Integrity_Status: integrity.passed ? 'PASS' : 'FAIL', Active_Users: activeUsers,
    Published_Documents: integrity.counts.documents, Material_Lines: integrity.counts.lines, Open_Exceptions: integrity.counts.openExceptions,
    Active_Backorders: integrity.counts.activeBackorders, Last_Backup_Status: lastBackup ? lastBackup.Status : 'NONE', Last_Backup_At: lastBackup ? lastBackup.Completed_At : '',
    Run_By_Email: user.email, Run_At: nowPoV1_(), Details_JSON: jsonPoV1_({contract: contract, integrity: integrity})
  });
  return {healthRunId: healthRunId, status: status, contract: contract, integrity: integrity};
}
