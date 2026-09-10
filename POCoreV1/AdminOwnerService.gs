function getPoTrackerBootstrapInternal_(userEmail) {
  const user = assertSearchUserPoV1_(userEmail);
  const configuration = getPoV1Configuration_();

  return {
    version: PO_V1.VERSION,
    schemaVersion: PO_V1.SCHEMA_VERSION,
    parserVersion: PO_V1.PARSER_VERSION,
    databaseFingerprint: databaseFingerprintPoV1_(),
    environment: normalizeUpperPoV1_(configuration.ENVIRONMENT_NAME || 'TEST'),
    transactionMode: normalizeUpperPoV1_(configuration.TRANSACTION_MODE || 'READ_ONLY'),
    timezone: normalizePoV1_(configuration.TIMEZONE) || 'America/Indiana/Indianapolis',
    user: user
  };
}

function recentFieldTransactionsPoV1_(limit) {
  const rows = getUsedRowsPoV1_(PO_V1.SHEETS.TRANSACTIONS).filter(function (row) { return yesPoV1_(row.Active); });
  const latestRowByLine = {};
  rows.forEach(function (row) {
    const lineId = normalizePoV1_(row.Procurement_Line_ID);
    if (lineId) latestRowByLine[lineId] = row._rowNumber;
  });
  return rows.filter(function (row) { return normalizeUpperPoV1_(row.Source_Interface) === 'FIELD'; })
    .slice(-Math.max(1, numberPoV1_(limit) || 100)).reverse().map(function (row) {
      const transactionType = normalizeUpperPoV1_(row.Transaction_Type);
      const lineId = normalizePoV1_(row.Procurement_Line_ID);
      const canCorrect = transactionType.indexOf('REVERSAL_') !== 0 && latestRowByLine[lineId] === row._rowNumber;
      return {id: row.Transaction_ID, documentNumber: row.Document_Number, lineId: lineId, transactionType: row.Transaction_Type,
        quantity: numberPoV1_(row.Quantity), uom: row.UOM, performedByEmail: row.Authenticated_Email, performedByName: row.Performed_By_Name,
        eventAt: row.Event_At, promisedDateSnapshot: dateKeyPoV1_(row.Promised_Date_Snapshot), notes: row.Notes, canCorrect: canCorrect,
        correctionBlockedReason: canCorrect ? '' : 'Only the latest transaction on a line can be corrected safely.'};
    });
}

function getPoSystemControlPoV1_(userEmail) {
  const user = assertOwnerPoV1_(userEmail);
  const configuration = getUsedRowsPoV1_(PO_V1.SHEETS.CONFIG).map(function (row) {
    return {setting: row.Setting, value: row.Value, description: row.Description, editable: yesPoV1_(row.Editable)};
  });
  const users = getUsedRowsPoV1_(PO_V1.SHEETS.USERS).map(serializeUserPoV1_);
  const recovery = getUsedRowsPoV1_(PO_V1.SHEETS.RECOVERY).slice(-50).reverse().map(function (row) {
    return {id: row.Recovery_ID, actionType: row.Action_Type, documentNumber: row.Target_Document_Number, procurementId: row.Target_Procurement_ID,
      status: row.Status, appliedAt: row.Applied_At, appliedBy: row.Applied_By_Email, reason: row.Reason, error: row.Error_Message};
  });
  const deletions = getUsedRowsPoV1_(PO_V1.SHEETS.RECORD_DELETIONS).slice(-100).reverse().map(function (row) {
    return {id: row.Deletion_ID, entityType: row.Entity_Type, entityId: row.Entity_ID, procurementId: row.Procurement_ID, lineId: row.Procurement_Line_ID,
      reqNumber: row.Req_Number || row.Document_Number, poNumber: row.PO_Number, documentNumber: row.Document_Number, lineNumber: row.Line_Number,
      deletedByEmail: row.Deleted_By_Email, deletedByName: row.Deleted_By_Name, deletedAt: row.Deleted_At, reason: row.Reason};
  });
  const corrections = getUsedRowsPoV1_(PO_V1.SHEETS.CORRECTIONS).slice(-50).reverse().map(function (row) {
    return {id: row.Correction_ID, targetTransactionId: row.Target_Transaction_ID, documentNumber: row.Document_Number, status: row.Status,
      reason: row.Reason, previewedAt: row.Previewed_At, appliedAt: row.Applied_At, backupId: row.Backup_ID, reversalTransactionId: row.Reversal_Transaction_ID};
  });
  return {user: user, configuration: configuration, users: users, contract: inspectPoTrackerContractInternal_(), recovery: recovery, deletions: deletions,
    corrections: corrections, recentFieldTransactions: recentFieldTransactionsPoV1_(100)};
}

function savePoSystemUserPoV1_(userEmail, request) {
  const owner = assertOwnerPoV1_(userEmail);
  const source = request || {};
  const email = normalizeEmailPoV1_(source.email);
  const profileKey = normalizeUpperPoV1_(source.profile);
  const profile = PO_V1.ROLE_PROFILES[profileKey];
  if (!email || !profile) throw new Error('A valid email and role profile are required.');
  const active = source.active === false || normalizeUpperPoV1_(source.active) === PO_V1.NO ? PO_V1.NO : PO_V1.YES;
  const existing = findRecordByFieldPoV1_(PO_V1.SHEETS.USERS, 'Email', email);
  if (existing && yesPoV1_(existing.Can_Owner_Edit) && active === PO_V1.NO) {
    const activeOwners = getUsedRowsPoV1_(PO_V1.SHEETS.USERS).filter(function (row) { return yesPoV1_(row.Active) && yesPoV1_(row.Can_Owner_Edit); });
    if (activeOwners.length <= 1) throw new Error('The final active System Owner cannot be deactivated.');
  }
  const now = nowPoV1_();
  const patch = {Email: email, Display_Name: normalizePoV1_(source.displayName) || email, Role: profile.label,
    Can_Search: profile.canSearch ? PO_V1.YES : PO_V1.NO, Can_Field_Transact: profile.canFieldTransact ? PO_V1.YES : PO_V1.NO,
    Can_Admin_Manage: profile.canAdminManage ? PO_V1.YES : PO_V1.NO, Can_Owner_Edit: profile.canOwnerEdit ? PO_V1.YES : PO_V1.NO,
    Can_Admin_Edit: profile.canAdminEdit ? PO_V1.YES : PO_V1.NO,
    Active: active, Notes: normalizePoV1_(source.notes), Updated_By: owner.email, Updated_At: now,
    Deactivated_By: active === PO_V1.NO ? owner.email : '', Deactivated_At: active === PO_V1.NO ? now : ''};
  let record;
  if (existing) record = updateRowObjectPoV1_(PO_V1.SHEETS.USERS, existing._rowNumber, patch);
  else {
    patch.User_ID = uuidPoV1_('USER'); patch.Created_At = now;
    const row = appendObjectPoV1_(PO_V1.SHEETS.USERS, patch); record = readRowObjectPoV1_(PO_V1.SHEETS.USERS, row);
  }
  invalidateUserCachePoV1_(email);
  appendAuditPoV1_('USER', record.User_ID, existing ? 'USER_UPDATED' : 'USER_CREATED', owner, uuidPoV1_('CORR'), {sourceInterface: 'OWNER', payload: serializeUserPoV1_(record)});
  return serializeUserPoV1_(record);
}

function savePoConfigurationPoV1_(userEmail, updates) {
  const owner = assertOwnerPoV1_(userEmail);
  const items = Array.isArray(updates) ? updates : [];
  if (!items.length) throw new Error('At least one configuration update is required.');
  items.forEach(function (item) {
    const setting = normalizeUpperPoV1_(item.setting);
    const row = getUsedRowsPoV1_(PO_V1.SHEETS.CONFIG).find(function (candidate) { return normalizeUpperPoV1_(candidate.Setting) === setting; });
    if (!row) throw new Error('Unknown setting: ' + setting);
    if (!yesPoV1_(row.Editable)) throw new Error(setting + ' is not editable.');
    if (setting === 'TRANSACTION_MODE' && !['READ_ONLY', 'ENABLED'].includes(normalizeUpperPoV1_(item.value))) throw new Error('TRANSACTION_MODE must be READ_ONLY or ENABLED.');
    if (setting === 'ENVIRONMENT_NAME' && !['TEST', 'PRODUCTION'].includes(normalizeUpperPoV1_(item.value))) throw new Error('ENVIRONMENT_NAME must be TEST or PRODUCTION.');
    if (setting === 'TIMEZONE') {
      try { Utilities.formatDate(nowPoV1_(), normalizePoV1_(item.value), 'yyyy-MM-dd'); } catch (error) { throw new Error('TIMEZONE must be a valid IANA timezone.'); }
    }
    if (setting === 'MAX_UPLOAD_BYTES' && (numberPoV1_(item.value) <= 0 || numberPoV1_(item.value) > 50 * 1024 * 1024)) throw new Error('MAX_UPLOAD_BYTES must be between 1 and 52428800.');
    const oldValue = row.Value;
    setConfigurationValuePoV1_(setting, item.value);
    appendAuditPoV1_('CONFIGURATION', setting, 'CONFIGURATION_UPDATED', owner, uuidPoV1_('CORR'), {sourceInterface: 'OWNER', fieldName: setting, oldValue: oldValue, newValue: item.value});
  });
  return getPoTrackerBootstrapInternal_(owner.email);
}

function createPoDatabaseBackupPoV1_(userEmail, triggerType, notes) {
  const owner = assertOwnerPoV1_(userEmail);
  const configuration = getPoV1Configuration_();
  const folderId = normalizePoV1_(configuration.BACKUP_FOLDER_ID);
  if (!folderId) throw new Error('Configure BACKUP_FOLDER_ID before creating a backup.');
  const backupId = uuidPoV1_('BACKUP');
  const timestamp = Utilities.formatDate(nowPoV1_(), timezonePoV1_(), 'yyyyMMdd-HHmmss');
  const name = 'PO_Tracker_' + normalizeUpperPoV1_(configuration.ENVIRONMENT_NAME || 'TEST') + '_' + timestamp + '_' + databaseFingerprintPoV1_();
  const createdAt = nowPoV1_();
  try {
    SpreadsheetApp.flush();
    const copy = DriveApp.getFileById(PO_V1_DATABASE_ID_).makeCopy(name, DriveApp.getFolderById(folderId));
    appendObjectPoV1_(PO_V1.SHEETS.BACKUPS, {Backup_ID: backupId, Backup_File_ID: copy.getId(), Backup_File_Name: copy.getName(), Database_Fingerprint: databaseFingerprintPoV1_(),
      Environment: normalizeUpperPoV1_(configuration.ENVIRONMENT_NAME || 'TEST'), Trigger_Type: normalizeUpperPoV1_(triggerType || 'MANUAL'), Status: 'COMPLETED',
      Created_By_Email: owner.email, Created_By_Name: owner.name, Created_At: createdAt, Completed_At: nowPoV1_(), File_Size_Bytes: copy.getSize(),
      Folder_Fingerprint: contentFingerprintPoV1_(folderId).slice(0, 12), Retention_Expires_At: '', Error_Message: '', Notes: normalizePoV1_(notes), Active: PO_V1.YES});
    appendAuditPoV1_('BACKUP', backupId, 'BACKUP_COMPLETED', owner, uuidPoV1_('CORR'), {sourceInterface: 'OWNER', payload: {fileId: copy.getId(), triggerType: triggerType}});
    return {backupId: backupId, fileId: copy.getId(), fileName: copy.getName(), url: copy.getUrl(), status: 'COMPLETED'};
  } catch (error) {
    appendObjectPoV1_(PO_V1.SHEETS.BACKUPS, {Backup_ID: backupId, Backup_File_ID: '', Backup_File_Name: name, Database_Fingerprint: databaseFingerprintPoV1_(),
      Environment: normalizeUpperPoV1_(configuration.ENVIRONMENT_NAME || 'TEST'), Trigger_Type: normalizeUpperPoV1_(triggerType || 'MANUAL'), Status: 'FAILED',
      Created_By_Email: owner.email, Created_By_Name: owner.name, Created_At: createdAt, Completed_At: nowPoV1_(), File_Size_Bytes: '',
      Folder_Fingerprint: contentFingerprintPoV1_(folderId).slice(0, 12), Retention_Expires_At: '', Error_Message: error.message, Notes: normalizePoV1_(notes), Active: PO_V1.YES});
    throw error;
  }
}

function canonicalSnapshotPoV1_(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalSnapshotPoV1_);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).sort().forEach(function (key) { result[key] = canonicalSnapshotPoV1_(value[key]); });
    return result;
  }
  return value;
}

function snapshotsEqualPoV1_(left, right) { return JSON.stringify(canonicalSnapshotPoV1_(left)) === JSON.stringify(canonicalSnapshotPoV1_(right)); }

function previewPoOwnerCorrectionPoV1_(userEmail, targetTransactionId, reason) {
  const owner = assertOwnerPoV1_(userEmail);
  assertWriteEnabledPoV1_('Owner correction preview');
  const normalizedReason = normalizePoV1_(reason);
  if (normalizedReason.length < 10) throw new Error('A correction reason of at least 10 characters is required.');
  const target = findRecordByFieldPoV1_(PO_V1.SHEETS.TRANSACTIONS, 'Transaction_ID', targetTransactionId);
  if (!target) throw new Error('Target transaction not found.');
  if (normalizeUpperPoV1_(target.Transaction_Type).indexOf('REVERSAL_') === 0) throw new Error('A reversal transaction cannot be reversed.');
  const later = getUsedRowsPoV1_(PO_V1.SHEETS.TRANSACTIONS).filter(function (row) {
    return normalizePoV1_(row.Procurement_Line_ID) === normalizePoV1_(target.Procurement_Line_ID) && row._rowNumber > target._rowNumber;
  });
  if (later.length) throw new Error('Only the latest transaction on a material line can be corrected safely.');
  const verificationCode = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  const correctionId = uuidPoV1_('CORRECTION');
  const before = {targetTransaction: recordSnapshotPoV1_(target), mutations: JSON.parse(normalizePoV1_(target.Mutation_JSON) || '[]')};
  appendObjectPoV1_(PO_V1.SHEETS.CORRECTIONS, {Correction_ID: correctionId, Target_Transaction_ID: target.Transaction_ID, Procurement_ID: target.Procurement_ID,
    Document_Number: target.Document_Number, Procurement_Line_ID: target.Procurement_Line_ID, Correction_Type: 'COMPENSATING_REVERSAL', Reason: normalizedReason,
    Verification_Code: verificationCode, Status: 'PREVIEWED', Previewed_By: owner.email, Previewed_At: nowPoV1_(), Applied_By: '', Applied_At: '', Backup_ID: '',
    Before_JSON: jsonPoV1_(before), After_JSON: '', Reversal_Transaction_ID: '', Error_Message: '', Notes: ''});
  return {correctionId: correctionId, verificationCode: verificationCode, targetTransactionId: target.Transaction_ID, transactionType: target.Transaction_Type,
    quantity: numberPoV1_(target.Quantity), documentNumber: target.Document_Number, lineId: target.Procurement_Line_ID, reason: normalizedReason,
    warning: 'Applying this correction creates a backup and a compensating transaction. The original ledger row remains unchanged.'};
}

function reverseMutationPoV1_(mutation, owner) {
  const sheetName = normalizePoV1_(mutation.sheet);
  const rowNumber = numberPoV1_(mutation.row);
  const current = recordSnapshotPoV1_(readRowObjectPoV1_(sheetName, rowNumber));
  if (!snapshotsEqualPoV1_(current, mutation.after)) throw new Error('Correction aborted because ' + sheetName + ' row ' + rowNumber + ' changed after the target transaction.');
  if (mutation.before) return {sheet: sheetName, row: rowNumber, before: current, after: recordSnapshotPoV1_(updateRowObjectPoV1_(sheetName, rowNumber, mutation.before))};
  const contract = headerMapPoV1_(sheetName);
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, 'Active')) patch.Active = PO_V1.NO;
  if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, 'Qty_Active')) patch.Qty_Active = 0;
  if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, 'Status')) patch.Status = 'REVERSED';
  if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, 'Updated_At')) patch.Updated_At = nowPoV1_();
  if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, 'Resolved_By_Email')) patch.Resolved_By_Email = owner.email;
  if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, 'Resolved_At')) patch.Resolved_At = nowPoV1_();
  return {sheet: sheetName, row: rowNumber, before: current, after: recordSnapshotPoV1_(updateRowObjectPoV1_(sheetName, rowNumber, patch))};
}

function applyPoOwnerCorrectionPoV1_(userEmail, correctionId, verificationCode) {
  const owner = assertOwnerPoV1_(userEmail);
  assertWriteEnabledPoV1_('Owner correction');
  const correction = findRecordByFieldPoV1_(PO_V1.SHEETS.CORRECTIONS, 'Correction_ID', correctionId);
  if (!correction || normalizeUpperPoV1_(correction.Status) !== 'PREVIEWED') throw new Error('A pending correction preview is required.');
  if (normalizeUpperPoV1_(verificationCode) !== normalizeUpperPoV1_(correction.Verification_Code)) throw new Error('Verification code does not match the preview.');
  const backup = createPoDatabaseBackupPoV1_(owner.email, 'OWNER_CORRECTION', 'Before correction ' + correctionId + '.');
  const target = findRecordByFieldPoV1_(PO_V1.SHEETS.TRANSACTIONS, 'Transaction_ID', correction.Target_Transaction_ID);
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const mutations = JSON.parse(normalizePoV1_(target.Mutation_JSON) || '[]');
    const reversed = mutations.slice().reverse().map(function (mutation) { return reverseMutationPoV1_(mutation, owner); });
    const correlationId = uuidPoV1_('CORR');
    const reversalId = uuidPoV1_('TXN');
    appendObjectPoV1_(PO_V1.SHEETS.TRANSACTIONS, {Transaction_ID: reversalId, Idempotency_Key: 'CORRECTION:' + correctionId, Correlation_ID: correlationId,
      Procurement_ID: target.Procurement_ID, Document_Number: target.Document_Number, Procurement_Line_ID: target.Procurement_Line_ID,
      Transaction_Type: 'REVERSAL_' + normalizeUpperPoV1_(target.Transaction_Type), Quantity: -numberPoV1_(target.Quantity), UOM: target.UOM,
      Authenticated_Email: owner.email, Performed_By_Name: owner.name, Event_At: nowPoV1_(), Promised_Date_Snapshot: target.Promised_Date_Snapshot,
      Delivery_Exception_ID: target.Delivery_Exception_ID, Vendor_Backorder_ID: target.Vendor_Backorder_ID,
      Before_JSON: target.After_JSON, After_JSON: target.Before_JSON, Mutation_JSON: jsonPoV1_(reversed), Reverses_Transaction_ID: target.Transaction_ID,
      Source_Interface: 'OWNER', Notes: correction.Reason, Active: PO_V1.YES, Req_Number: target.Req_Number, PO_Number: target.PO_Number});
    recalculateProcurementPoV1_(target.Procurement_ID, owner.email);
    const detail = getProcurementDetailPoV1_(owner.email, target.Procurement_ID);
    updateRowObjectPoV1_(PO_V1.SHEETS.CORRECTIONS, correction._rowNumber, {Status: 'APPLIED', Applied_By: owner.email, Applied_At: nowPoV1_(), Backup_ID: backup.backupId,
      After_JSON: jsonPoV1_({reversalTransactionId: reversalId, detail: detail}), Reversal_Transaction_ID: reversalId, Error_Message: ''});
    appendAuditPoV1_('OWNER_CORRECTION', correctionId, 'COMPENSATING_CORRECTION_APPLIED', owner, correlationId, {sourceInterface: 'OWNER', payload: {targetTransactionId: target.Transaction_ID, reversalTransactionId: reversalId, backupId: backup.backupId}});
    SpreadsheetApp.flush();
    return {success: true, correctionId: correctionId, reversalTransactionId: reversalId, backup: backup, detail: detail};
  } catch (error) {
    updateRowObjectPoV1_(PO_V1.SHEETS.CORRECTIONS, correction._rowNumber, {Status: 'FAILED', Applied_By: owner.email, Applied_At: nowPoV1_(), Backup_ID: backup.backupId, Error_Message: error.message});
    throw error;
  } finally { lock.releaseLock(); }
}
