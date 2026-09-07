function sheetPoV1_(sheetName) {
  let sheet = poV1Database_().getSheetByName(sheetName);
  if (!sheet && PO_V1_HEADERS[sheetName]) {
    sheet = poV1Database_().insertSheet(sheetName);
    sheet.getRange(1, 1, 1, PO_V1_HEADERS[sheetName].length).setValues([PO_V1_HEADERS[sheetName]]);
  }
  if (!sheet) throw new Error('Missing required sheet: ' + sheetName);
  return sheet;
}

function expectedHeadersPoV1_(sheetName) {
  const headers = PO_V1_HEADERS[sheetName];
  if (!headers) throw new Error('No header contract is defined for ' + sheetName + '.');
  return headers.slice();
}

function headerMapPoV1_(sheetName) {
  if (PO_V1_HEADER_MAP_CACHE_[sheetName]) return PO_V1_HEADER_MAP_CACHE_[sheetName];
  const expected = expectedHeadersPoV1_(sheetName);
  const sheet = sheetPoV1_(sheetName);
  let lastColumn = Math.max(1, sheet.getLastColumn());
  let actual = sheet.getRange(1, 1, 1, Math.max(expected.length, lastColumn)).getDisplayValues()[0].map(normalizePoV1_);
  expected.forEach(function (header, index) {
    if (actual[index] === header) return;
    const current = normalizePoV1_(actual[index]);
    const expectedCurrentLater = current && expected.indexOf(current) > index;
    const headerMissingFromActual = actual.indexOf(header) < 0;
    if (headerMissingFromActual && (expectedCurrentLater || !current || index >= lastColumn)) {
      if (index < lastColumn) {
        sheet.insertColumnBefore(index + 1);
        actual.splice(index, 0, header);
        lastColumn += 1;
      } else {
        actual[index] = header;
        lastColumn = Math.max(lastColumn, index + 1);
      }
      sheet.getRange(1, index + 1).setValue(header);
    } else if (actual[index] !== header) {
      throw new Error(sheetName + ' header mismatch at column ' + (index + 1) + '. Expected "' + header + '", found "' + actual[index] + '".');
    }
  });
  const indexByHeader = {};
  expected.forEach(function (header, index) { indexByHeader[header] = index; });
  const result = {headers: expected, indexByHeader: indexByHeader};
  PO_V1_HEADER_MAP_CACHE_[sheetName] = result;
  return result;
}

function ensureAppendCapacityPoV1_(sheet, count) {
  const required = Math.max(1, numberPoV1_(count));
  const needed = sheet.getLastRow() + required;
  const maximum = sheet.getMaxRows();
  if (needed > maximum) sheet.insertRowsAfter(maximum, Math.max(needed - maximum + 200, required));
}

function appendObjectPoV1_(sheetName, record) { return appendObjectsPoV1_(sheetName, [record])[0]; }

function appendObjectsPoV1_(sheetName, records) {
  const source = Array.isArray(records) ? records : [];
  if (!source.length) return [];
  const sheet = sheetPoV1_(sheetName);
  const contract = headerMapPoV1_(sheetName);
  ensureAppendCapacityPoV1_(sheet, source.length);
  const startRow = Math.max(2, sheet.getLastRow() + 1);
  const values = source.map(function (record) {
    return contract.headers.map(function (header) {
      return record && Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    });
  });
  sheet.getRange(startRow, 1, values.length, contract.headers.length).setValues(values);
  return values.map(function (_, index) { return startRow + index; });
}

function readRowObjectPoV1_(sheetName, rowNumber) {
  const row = numberPoV1_(rowNumber);
  if (row < 2) throw new Error('Invalid row ' + rowNumber + ' for ' + sheetName + '.');
  const contract = headerMapPoV1_(sheetName);
  const values = sheetPoV1_(sheetName).getRange(row, 1, 1, contract.headers.length).getValues()[0];
  const record = {_rowNumber: row};
  contract.headers.forEach(function (header, index) { record[header] = values[index]; });
  return record;
}

function readRowObjectsPoV1_(sheetName, rowNumbers) {
  const sourceRows = (Array.isArray(rowNumbers) ? rowNumbers : []).map(numberPoV1_).filter(function (row) { return row >= 2; });
  if (!sourceRows.length) return [];
  const uniqueRows = [];
  const seen = {};
  sourceRows.forEach(function (row) {
    if (!seen[row]) { seen[row] = true; uniqueRows.push(row); }
  });
  uniqueRows.sort(function (left, right) { return left - right; });
  const contract = headerMapPoV1_(sheetName);
  const sheet = sheetPoV1_(sheetName);
  const byRow = {};
  let group = [];
  function flushGroup() {
    if (!group.length) return;
    const start = group[0];
    const values = sheet.getRange(start, 1, group.length, contract.headers.length).getValues();
    group.forEach(function (row, index) {
      const record = {_rowNumber: row};
      contract.headers.forEach(function (header, columnIndex) { record[header] = values[index][columnIndex]; });
      byRow[row] = record;
    });
    group = [];
  }
  uniqueRows.forEach(function (row) {
    if (!group.length || row === group[group.length - 1] + 1) group.push(row);
    else { flushGroup(); group.push(row); }
  });
  flushGroup();
  return sourceRows.map(function (row) { return byRow[row]; }).filter(Boolean);
}

function updateRowObjectPoV1_(sheetName, rowNumber, patch) {
  const record = readRowObjectPoV1_(sheetName, rowNumber);
  const contract = headerMapPoV1_(sheetName);
  Object.keys(patch || {}).forEach(function (field) {
    if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, field)) record[field] = patch[field];
  });
  const values = contract.headers.map(function (header) { return record[header]; });
  sheetPoV1_(sheetName).getRange(numberPoV1_(rowNumber), 1, 1, values.length).setValues([values]);
  return record;
}

function updateRowObjectsPoV1_(sheetName, updates) {
  const items = (Array.isArray(updates) ? updates : []).map(function (item, index) {
    return {rowNumber: numberPoV1_(item && (item.rowNumber || item.row || item._rowNumber)), patch: (item && item.patch) || {}, index: index};
  }).filter(function (item) { return item.rowNumber >= 2; });
  if (!items.length) return [];
  items.sort(function (left, right) { return left.rowNumber - right.rowNumber; });
  const contract = headerMapPoV1_(sheetName);
  const sheet = sheetPoV1_(sheetName);
  const byIndex = {};
  let group = [];
  function applyGroup() {
    if (!group.length) return;
    const start = group[0].rowNumber;
    const values = sheet.getRange(start, 1, group.length, contract.headers.length).getValues();
    group.forEach(function (item, rowOffset) {
      const record = {_rowNumber: item.rowNumber};
      contract.headers.forEach(function (header, columnIndex) { record[header] = values[rowOffset][columnIndex]; });
      Object.keys(item.patch || {}).forEach(function (field) {
        if (Object.prototype.hasOwnProperty.call(contract.indexByHeader, field)) record[field] = item.patch[field];
      });
      values[rowOffset] = contract.headers.map(function (header) { return record[header]; });
      byIndex[item.index] = record;
    });
    sheet.getRange(start, 1, values.length, contract.headers.length).setValues(values);
    group = [];
  }
  items.forEach(function (item) {
    if (!group.length || item.rowNumber === group[group.length - 1].rowNumber + 1) group.push(item);
    else { applyGroup(); group.push(item); }
  });
  applyGroup();
  return Object.keys(byIndex).sort(function (left, right) { return numberPoV1_(left) - numberPoV1_(right); }).map(function (key) { return byIndex[key]; });
}

function getUsedRowsPoV1_(sheetName) {
  const sheet = sheetPoV1_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const contract = headerMapPoV1_(sheetName);
  const values = sheet.getRange(2, 1, lastRow - 1, contract.headers.length).getValues();
  return values.map(function (rowValues, index) {
    const record = {_rowNumber: index + 2};
    contract.headers.forEach(function (header, columnIndex) { record[header] = rowValues[columnIndex]; });
    return record;
  }).filter(function (record) {
    return contract.headers.some(function (header) { return record[header] !== '' && record[header] !== null; });
  });
}

function findRowsByExactValuePoV1_(sheetName, fieldName, value) {
  const target = normalizePoV1_(value);
  if (!target) return [];
  const contract = headerMapPoV1_(sheetName);
  if (!Object.prototype.hasOwnProperty.call(contract.indexByHeader, fieldName)) throw new Error('Unknown field ' + fieldName + ' on ' + sheetName + '.');
  const sheet = sheetPoV1_(sheetName);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, contract.indexByHeader[fieldName] + 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(target).matchEntireCell(true).findAll().map(function (range) { return range.getRow(); });
}

function findRecordByFieldPoV1_(sheetName, fieldName, value) {
  const rows = findRowsByExactValuePoV1_(sheetName, fieldName, value);
  if (rows.length > 1) throw new Error('Duplicate ' + fieldName + ' values exist on ' + sheetName + ': ' + value);
  return rows.length ? readRowObjectPoV1_(sheetName, rows[0]) : null;
}

function recordsByFieldPoV1_(sheetName, fieldName, value) {
  return readRowObjectsPoV1_(sheetName, findRowsByExactValuePoV1_(sheetName, fieldName, value));
}

function getPoV1Configuration_() {
  if (PO_V1_CONFIGURATION_CACHE_) return PO_V1_CONFIGURATION_CACHE_;
  const cache = CacheService.getScriptCache();
  const key = 'po1:' + databaseFingerprintPoV1_() + ':configuration';
  const cached = cache.get(key);
  if (cached) {
    PO_V1_CONFIGURATION_CACHE_ = JSON.parse(cached);
    return PO_V1_CONFIGURATION_CACHE_;
  }
  const result = {};
  getUsedRowsPoV1_(PO_V1.SHEETS.CONFIG).forEach(function (row) {
    const setting = normalizeUpperPoV1_(row.Setting);
    if (setting) result[setting] = row.Value;
  });
  PO_V1_CONFIGURATION_CACHE_ = result;
  cache.put(key, JSON.stringify(result), 300);
  return result;
}

function invalidateConfigurationPoV1_() {
  PO_V1_CONFIGURATION_CACHE_ = null;
  if (PO_V1_DATABASE_ID_) CacheService.getScriptCache().remove('po1:' + databaseFingerprintPoV1_() + ':configuration');
}

function setConfigurationValuePoV1_(setting, value) {
  const target = normalizeUpperPoV1_(setting);
  const record = getUsedRowsPoV1_(PO_V1.SHEETS.CONFIG).find(function (row) { return normalizeUpperPoV1_(row.Setting) === target; });
  if (!record) throw new Error('Missing configuration setting: ' + target);
  sheetPoV1_(PO_V1.SHEETS.CONFIG).getRange(record._rowNumber, 2).setValue(value);
  invalidateConfigurationPoV1_();
}

function assertWriteEnabledPoV1_(operation) {
  const configuration = getPoV1Configuration_();
  if (normalizeUpperPoV1_(configuration.TRANSACTION_MODE || 'READ_ONLY') !== 'ENABLED') {
    const message = normalizePoV1_(configuration.MAINTENANCE_MESSAGE) || 'Transactions are currently read-only.';
    throw new Error((operation || 'Write') + ' is disabled. ' + message);
  }
}

function auditRecordPoV1_(entityType, entityId, action, user, correlationId, detail) {
  const source = detail || {};
  return {
    Audit_ID: uuidPoV1_('AUDIT'),
    Entity_Type: normalizeUpperPoV1_(entityType),
    Entity_ID: normalizePoV1_(entityId),
    Action: normalizeUpperPoV1_(action),
    Field_Name: normalizePoV1_(source.fieldName),
    Old_Value: source.oldValue == null ? '' : String(source.oldValue),
    New_Value: source.newValue == null ? '' : String(source.newValue),
    User_Email: normalizeEmailPoV1_(user && user.email),
    User_Name: normalizePoV1_(user && user.name),
    Timestamp: nowPoV1_(),
    Source_Interface: normalizeUpperPoV1_(source.sourceInterface || 'PORTAL'),
    Correlation_ID: normalizePoV1_(correlationId),
    Notes: source.notes ? normalizePoV1_(source.notes) : (source.payload ? jsonPoV1_(source.payload) : '')
  };
}

function appendAuditPoV1_(entityType, entityId, action, user, correlationId, detail) {
  return appendObjectPoV1_(PO_V1.SHEETS.AUDIT, auditRecordPoV1_(entityType, entityId, action, user, correlationId, detail));
}

function appendAuditRecordsPoV1_(records) {
  return appendObjectsPoV1_(PO_V1.SHEETS.AUDIT, records);
}

function recordSnapshotPoV1_(record) {
  const result = {};
  Object.keys(record || {}).forEach(function (key) { if (key !== '_rowNumber') result[key] = record[key]; });
  return result;
}
