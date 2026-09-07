function adminReasonPoV1_(value, label) {
  const reason = normalizePoV1_(value);
  if (reason.length < 8) throw new Error((label || 'Reason') + ' must be at least 8 characters.');
  return reason;
}

function activeProcurementHeaderPoV1_(procurementId) {
  const header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId);
  if (!header || !yesPoV1_(header.Active)) throw new Error('Active requisition not found.');
  return header;
}

function activeLinesForProcurementPoV1_(procurementId) {
  return recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', procurementId).filter(function (line) { return yesPoV1_(line.Active); });
}

function activeLinesByIdsPoV1_(procurementId, lineIds) {
  const wanted = {};
  (Array.isArray(lineIds) ? lineIds : []).forEach(function (id) { if (normalizePoV1_(id)) wanted[normalizePoV1_(id)] = true; });
  const ids = Object.keys(wanted);
  if (!ids.length) throw new Error('Select at least one active line.');
  const lines = activeLinesForProcurementPoV1_(procurementId).filter(function (line) { return wanted[normalizePoV1_(line.Procurement_Line_ID)]; });
  if (lines.length !== ids.length) throw new Error('One or more selected lines are not active on this requisition.');
  return lines;
}

function lineHasOperationalActivityPoV1_(line) {
  const lineId = normalizePoV1_(line.Procurement_Line_ID);
  if (numberPoV1_(line.Qty_Received_Good) || numberPoV1_(line.Qty_Damaged_Open) || numberPoV1_(line.Qty_Incorrect_Open) || numberPoV1_(line.Qty_Not_Here_Open) || numberPoV1_(line.Qty_Vendor_Backordered)) return true;
  return recordsByFieldPoV1_(PO_V1.SHEETS.TRANSACTIONS, 'Procurement_Line_ID', lineId).some(function (row) { return yesPoV1_(row.Active); });
}

function deletionRecordPoV1_(entityType, record, user, reason, correlationId) {
  return {
    Deletion_ID: uuidPoV1_('DEL'),
    Correlation_ID: correlationId,
    Entity_Type: normalizeUpperPoV1_(entityType),
    Entity_ID: normalizePoV1_(record.Procurement_Line_ID || record.Procurement_ID),
    Procurement_ID: normalizePoV1_(record.Procurement_ID),
    Procurement_Line_ID: normalizePoV1_(record.Procurement_Line_ID),
    Req_Number: reqNumberPoV1_(record),
    PO_Number: poNumberPoV1_(record),
    Document_Number: normalizePoV1_(record.Document_Number),
    Line_Number: normalizePoV1_(record.Line_Number),
    Deleted_By_Email: user.email,
    Deleted_By_Name: user.name,
    Deleted_At: nowPoV1_(),
    Reason: reason,
    Snapshot_JSON: jsonPoV1_(recordSnapshotPoV1_(record)),
    Active: PO_V1.YES
  };
}

function syncActiveOperationalLabelsForLinesPoV1_(lines, patchForLine) {
  const linePatchById = {};
  lines.forEach(function (line) {
    const patch = patchForLine(line);
    if (patch) linePatchById[normalizePoV1_(line.Procurement_Line_ID)] = patch;
  });
  [PO_V1.SHEETS.EXCEPTIONS, PO_V1.SHEETS.BACKORDERS].forEach(function (sheetName) {
    const updates = [];
    Object.keys(linePatchById).forEach(function (lineId) {
      recordsByFieldPoV1_(sheetName, 'Procurement_Line_ID', lineId).forEach(function (row) {
        if (yesPoV1_(row.Active)) updates.push({rowNumber: row._rowNumber, patch: linePatchById[lineId]});
      });
    });
    updateRowObjectsPoV1_(sheetName, updates);
  });
}

function nextManualLineNumberPoV1_(lines) {
  let max = 0;
  lines.forEach(function (line) {
    const numeric = numberPoV1_(line.Line_Number);
    if (numeric > max) max = numeric;
  });
  return String(max + 1);
}

function updateProcurementIdentifiersPoV1_(userEmail, request) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Req/PO edit');
  const source = request || {};
  const procurementId = normalizePoV1_(source.procurementId);
  const nextReq = normalizePoV1_(source.reqNumber);
  const nextPo = normalizePoV1_(source.primaryPoNumber);
  const hasReqUpdate = Object.prototype.hasOwnProperty.call(source, 'reqNumber');
  const hasPoUpdate = Object.prototype.hasOwnProperty.call(source, 'primaryPoNumber');
  if (hasReqUpdate && !nextReq) throw new Error('Req number cannot be blank.');
  if (hasPoUpdate && !nextPo) throw new Error('PO number cannot be blank.');
  if (!hasReqUpdate && !hasPoUpdate) throw new Error('Req number or PO number is required.');
  const applyPoToLines = source.applyPoToLines !== false;
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const header = activeProcurementHeaderPoV1_(procurementId);
    const lines = activeLinesForProcurementPoV1_(procurementId);
    const before = recordSnapshotPoV1_(header);
    const correlationId = uuidPoV1_('CORR');
    const patch = {Updated_By: user.email, Updated_At: nowPoV1_()};
    if (hasReqUpdate && nextReq !== reqNumberPoV1_(header)) {
      const nextKey = documentKeyPoV1_(header.Document_Type, nextReq);
      const duplicate = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Document_Key', nextKey);
      if (duplicate && duplicate.Procurement_ID !== header.Procurement_ID && yesPoV1_(duplicate.Active)) throw new Error('Another active requisition already uses Req number ' + nextReq + '.');
      patch.Document_Number = nextReq;
      patch.Req_Number = nextReq;
      patch.Document_Key = nextKey;
    }
    if (hasPoUpdate) {
      patch.Primary_PO_Number = nextPo;
      patch.Vendor_PO_Number = nextPo;
    }
    const updatedHeader = updateRowObjectPoV1_(PO_V1.SHEETS.HEADERS, header._rowNumber, patch);
    const lineUpdates = [];
    lines.forEach(function (line) {
      const linePatch = {Updated_By: user.email, Updated_At: nowPoV1_()};
      if (hasReqUpdate) {
        linePatch.Document_Number = nextReq;
        linePatch.Req_Number = nextReq;
      }
      if (hasPoUpdate && applyPoToLines) linePatch.PO_Number = nextPo;
      if (Object.keys(linePatch).length > 2) lineUpdates.push({rowNumber: line._rowNumber, patch: linePatch});
    });
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, lineUpdates);
    const refreshedLines = activeLinesForProcurementPoV1_(procurementId);
    syncActiveOperationalLabelsForLinesPoV1_(refreshedLines, function (line) { return {Document_Number: line.Document_Number, Req_Number: reqNumberPoV1_(line), PO_Number: poNumberPoV1_(line), Updated_At: nowPoV1_()}; });
    recalculateProcurementPoV1_(procurementId, user.email);
    rebuildProcurementSearchIndexPoV1_(findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId), activeLinesForProcurementPoV1_(procurementId));
    appendAuditPoV1_('PROCUREMENT', procurementId, 'REQ_PO_IDENTIFIERS_UPDATED', user, correlationId, {sourceInterface: 'ADMIN', oldValue: jsonPoV1_(before), newValue: jsonPoV1_(recordSnapshotPoV1_(updatedHeader))});
    SpreadsheetApp.flush();
    return getProcurementDetailPoV1_(user.email, procurementId);
  } finally { lock.releaseLock(); }
}

function assignLinesToPurchaseOrderPoV1_(userEmail, request) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('PO line split');
  const source = request || {};
  const procurementId = normalizePoV1_(source.procurementId);
  const poNumber = normalizePoV1_(source.poNumber);
  if (!poNumber) throw new Error('PO number is required.');
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    activeProcurementHeaderPoV1_(procurementId);
    const lines = activeLinesByIdsPoV1_(procurementId, source.lineIds);
    const correlationId = uuidPoV1_('CORR');
    const splitGroupId = uuidPoV1_('POSPLIT');
    const now = nowPoV1_();
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, lines.map(function (line) {
      return {rowNumber: line._rowNumber, patch: {PO_Number: poNumber, PO_Split_Group_ID: splitGroupId, Updated_By: user.email, Updated_At: now}};
    }));
    syncActiveOperationalLabelsForLinesPoV1_(activeLinesByIdsPoV1_(procurementId, source.lineIds), function (line) {
      return {PO_Number: poNumber, Req_Number: reqNumberPoV1_(line), Document_Number: line.Document_Number, Updated_At: nowPoV1_()};
    });
    recalculateProcurementPoV1_(procurementId, user.email);
    rebuildProcurementSearchIndexPoV1_(findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId), activeLinesForProcurementPoV1_(procurementId));
    appendAuditPoV1_('PROCUREMENT', procurementId, 'LINES_ASSIGNED_TO_PO', user, correlationId, {sourceInterface: 'ADMIN', payload: {poNumber: poNumber, lineCount: lines.length, splitGroupId: splitGroupId, lineIds: source.lineIds}});
    SpreadsheetApp.flush();
    return getProcurementDetailPoV1_(user.email, procurementId);
  } finally { lock.releaseLock(); }
}

function addProcurementLinePoV1_(userEmail, request) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Manual line add');
  const source = request || {};
  const procurementId = normalizePoV1_(source.procurementId);
  const quantity = positiveNumberPoV1_(source.quantityOrdered, 'Ordered quantity');
  const uom = normalizeUpperPoV1_(source.uom);
  const description = normalizePoV1_(source.description);
  if (!uom || !description) throw new Error('UOM and description are required.');
  const promised = normalizePoV1_(source.promisedDate) ? datePoV1_(source.promisedDate) : '';
  if (normalizePoV1_(source.promisedDate) && !promised) throw new Error('Promised date is invalid.');
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const header = activeProcurementHeaderPoV1_(procurementId);
    const lines = activeLinesForProcurementPoV1_(procurementId);
    const lineNumber = normalizePoV1_(source.lineNumber) || nextManualLineNumberPoV1_(lines);
    if (lines.some(function (line) { return normalizePoV1_(line.Line_Number) === lineNumber; })) throw new Error('Line number already exists on this requisition: ' + lineNumber);
    const now = nowPoV1_();
    const lineId = uuidPoV1_('LINE');
    appendObjectPoV1_(PO_V1.SHEETS.LINES, {
      Procurement_Line_ID: lineId, Procurement_ID: procurementId, Document_Type: header.Document_Type, Document_Number: reqNumberPoV1_(header),
      Line_Number: lineNumber, Qty_Ordered: quantity, UOM: uom, Material_Description: description, Unit_Price: numberPoV1_(source.unitPrice),
      Extended_Price: numberPoV1_(source.unitPrice) ? numberPoV1_(source.unitPrice) * quantity : numberPoV1_(source.extendedPrice),
      Job_Number: normalizePoV1_(source.jobNumber), Object_Account: normalizePoV1_(source.objectAccount), Subsidiary: normalizePoV1_(source.subsidiary),
      Type: normalizePoV1_(source.type), Subledger: normalizePoV1_(source.subledger), Rental_Duration: normalizePoV1_(source.rentalDuration),
      Request_Date: normalizePoV1_(source.requestDate) ? datePoV1_(source.requestDate) : '', Source_Revision: 'MANUAL', Account_Number: normalizePoV1_(source.accountNumber),
      Imported_Delivery_Date: '', Promised_Date: promised || '', Promised_Date_Source: promised ? 'ADMIN_MANUAL_LINE' : '', Promised_Date_Updated_By: promised ? user.email : '',
      Promised_Date_Updated_At: promised ? now : '', Qty_Received_Good: 0, Qty_Open: quantity, Qty_Damaged_Open: 0, Qty_Incorrect_Open: 0, Qty_Not_Here_Open: 0, Qty_Vendor_Backordered: 0,
      Line_Status: promised ? PO_V1.LINE_STATUSES.OPEN : PO_V1.LINE_STATUSES.NEEDS_PROMISED_DATE, Has_Open_Exception: PO_V1.NO, Active: PO_V1.YES, Source_Staging_Line_ID: '',
      Created_By: user.email, Created_At: now, Updated_By: user.email, Updated_At: now, Last_Activity_At: '', Notes: normalizePoV1_(source.notes),
      Req_Number: reqNumberPoV1_(header), PO_Number: normalizePoV1_(source.poNumber) || poNumberPoV1_(header), PO_Split_Group_ID: '', Manual_Item: PO_V1.YES,
      Admin_Notes: normalizePoV1_(source.adminNotes), Deleted_By_Email: '', Deleted_By_Name: '', Deleted_At: '', Deletion_Reason: ''
    });
    recalculateProcurementPoV1_(procurementId, user.email);
    rebuildProcurementSearchIndexPoV1_(findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId), activeLinesForProcurementPoV1_(procurementId));
    appendAuditPoV1_('PROCUREMENT_LINE', lineId, 'MANUAL_LINE_ADDED', user, uuidPoV1_('CORR'), {sourceInterface: 'ADMIN', payload: {procurementId: procurementId, lineNumber: lineNumber, quantity: quantity}});
    SpreadsheetApp.flush();
    return getProcurementDetailPoV1_(user.email, procurementId);
  } finally { lock.releaseLock(); }
}

function deleteProcurementLinesPoV1_(userEmail, request) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Line delete');
  const source = request || {};
  const procurementId = normalizePoV1_(source.procurementId);
  const reason = adminReasonPoV1_(source.reason, 'Line deletion reason');
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    activeProcurementHeaderPoV1_(procurementId);
    const lines = activeLinesByIdsPoV1_(procurementId, source.lineIds);
    const blocked = lines.filter(lineHasOperationalActivityPoV1_);
    if (blocked.length) throw new Error('Line(s) with receiving, exception, or backorder activity cannot be deleted by Admin. Correct the activity first: ' + blocked.map(function (line) { return line.Line_Number; }).join(', '));
    const now = nowPoV1_();
    const correlationId = uuidPoV1_('CORR');
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, lines.map(function (line) {
      return {rowNumber: line._rowNumber, patch: {Active: PO_V1.NO, Qty_Open: 0, Deleted_By_Email: user.email, Deleted_By_Name: user.name,
        Deleted_At: now, Deletion_Reason: reason, Updated_By: user.email, Updated_At: now}};
    }));
    appendObjectsPoV1_(PO_V1.SHEETS.RECORD_DELETIONS, lines.map(function (line) { return deletionRecordPoV1_('PROCUREMENT_LINE', line, user, reason, correlationId); }));
    recalculateProcurementPoV1_(procurementId, user.email);
    rebuildProcurementSearchIndexPoV1_(findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId), activeLinesForProcurementPoV1_(procurementId));
    appendAuditPoV1_('PROCUREMENT', procurementId, 'LINES_DELETED', user, correlationId, {sourceInterface: 'ADMIN', payload: {lineCount: lines.length, reason: reason}});
    SpreadsheetApp.flush();
    return getProcurementDetailPoV1_(user.email, procurementId);
  } finally { lock.releaseLock(); }
}

function deleteProcurementPoV1_(userEmail, request) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Req delete');
  const source = request || {};
  const procurementId = normalizePoV1_(source.procurementId);
  const reason = adminReasonPoV1_(source.reason, 'Req deletion reason');
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const header = activeProcurementHeaderPoV1_(procurementId);
    const lines = activeLinesForProcurementPoV1_(procurementId);
    const blocked = lines.filter(lineHasOperationalActivityPoV1_);
    if (blocked.length) throw new Error('This req has receiving, exception, or backorder activity and cannot be deleted by Admin. Correct activity first or ask an Owner to review.');
    const now = nowPoV1_();
    const correlationId = uuidPoV1_('CORR');
    updateRowObjectPoV1_(PO_V1.SHEETS.HEADERS, header._rowNumber, {Active: PO_V1.NO, Qty_Open: 0, Deleted_By_Email: user.email, Deleted_By_Name: user.name,
      Deleted_At: now, Deletion_Reason: reason, Updated_By: user.email, Updated_At: now});
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, lines.map(function (line) {
      return {rowNumber: line._rowNumber, patch: {Active: PO_V1.NO, Qty_Open: 0, Deleted_By_Email: user.email, Deleted_By_Name: user.name,
        Deleted_At: now, Deletion_Reason: reason, Updated_By: user.email, Updated_At: now}};
    }));
    const deletionRows = [deletionRecordPoV1_('PROCUREMENT', header, user, reason, correlationId)].concat(lines.map(function (line) { return deletionRecordPoV1_('PROCUREMENT_LINE', line, user, reason, correlationId); }));
    appendObjectsPoV1_(PO_V1.SHEETS.RECORD_DELETIONS, deletionRows);
    deactivateSearchIndexPoV1_(procurementId);
    updateRowObjectsPoV1_(PO_V1.SHEETS.OPERATIONAL_INDEX, recordsByFieldPoV1_(PO_V1.SHEETS.OPERATIONAL_INDEX, 'Parent_ID', procurementId).map(function (row) {
      return {rowNumber: row._rowNumber, patch: {Active: PO_V1.NO, Updated_At: now}};
    }));
    appendAuditPoV1_('PROCUREMENT', procurementId, 'REQ_DELETED', user, correlationId, {sourceInterface: 'ADMIN', payload: {lineCount: lines.length, reason: reason}});
    SpreadsheetApp.flush();
    return {success: true, procurementId: procurementId, deletedLineCount: lines.length};
  } finally { lock.releaseLock(); }
}

function addProcurementNotePoV1_(userEmail, request) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Line item note');
  const source = request || {};
  const procurementId = normalizePoV1_(source.procurementId);
  const noteText = normalizePoV1_(source.noteText);
  if (noteText.length < 2) throw new Error('Note text is required.');
  const lineIds = Array.isArray(source.lineIds) ? source.lineIds.map(normalizePoV1_).filter(Boolean) : (normalizePoV1_(source.lineId) ? [normalizePoV1_(source.lineId)] : []);
  if (!lineIds.length) throw new Error('Select at least one line item before adding an Admin note.');
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    activeProcurementHeaderPoV1_(procurementId);
    const lines = activeLinesByIdsPoV1_(procurementId, lineIds);
    const now = nowPoV1_();
    const noteRows = lines.map(function (line) {
      return {Note_ID: uuidPoV1_('NOTE'), Procurement_ID: procurementId, Procurement_Line_ID: line.Procurement_Line_ID,
      Note_Type: 'ADMIN_LINE', Note_Text: noteText, Created_By_Email: user.email, Created_By_Name: user.name,
      Created_At: now, Active: PO_V1.YES, Updated_By_Email: user.email, Updated_At: now};
    });
    appendObjectsPoV1_(PO_V1.SHEETS.PROCUREMENT_NOTES, noteRows);
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, lines.map(function (line) {
      return {rowNumber: line._rowNumber, patch: {Admin_Notes: noteText, Updated_By: user.email, Updated_At: now}};
    }));
    appendAuditRecordsPoV1_(noteRows.map(function (noteRow) {
      return auditRecordPoV1_('PROCUREMENT_NOTE', noteRow.Note_ID, 'ADMIN_LINE_NOTE_ADDED', user, uuidPoV1_('CORR'), {sourceInterface: 'ADMIN', payload: {procurementId: procurementId, lineId: noteRow.Procurement_Line_ID}});
    }));
    SpreadsheetApp.flush();
    return getProcurementDetailPoV1_(user.email, procurementId);
  } finally { lock.releaseLock(); }
}
