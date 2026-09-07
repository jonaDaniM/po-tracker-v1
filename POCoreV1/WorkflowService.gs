function reqNumberPoV1_(record) {
  return normalizePoV1_(record && (record.Req_Number || record.Document_Number));
}

function poNumberPoV1_(record) {
  return normalizePoV1_(record && (record.PO_Number || record.Primary_PO_Number || record.Vendor_PO_Number));
}

function uniquePoNumbersPoV1_(lines, fallback) {
  const seen = {};
  const result = [];
  (Array.isArray(lines) ? lines : []).forEach(function (line) {
    const value = poNumberPoV1_(line);
    if (value && !seen[normalizeUpperPoV1_(value)]) {
      seen[normalizeUpperPoV1_(value)] = true;
      result.push(value);
    }
  });
  const fallbackValue = normalizePoV1_(fallback);
  if (!result.length && fallbackValue) result.push(fallbackValue);
  return result;
}

function cloudDriveNamePoV1_(reqNumber, poNumbers, description) {
  const req = normalizePoV1_(reqNumber) || 'REQ TBD';
  const po = Array.isArray(poNumbers) && poNumbers.length ? poNumbers.join(', ') : 'PO TBD';
  const desc = normalizePoV1_(description) || 'No description';
  return req + ' - ' + po + ' - ' + desc;
}

function calculateLineStatusPoV1_(line) {
  const open = Math.max(0, numberPoV1_(line.Qty_Open));
  if (open <= 0) return PO_V1.LINE_STATUSES.RECEIVED;
  if (numberPoV1_(line.Qty_Damaged_Open) > 0) return PO_V1.LINE_STATUSES.DAMAGED;
  if (numberPoV1_(line.Qty_Incorrect_Open) > 0) return PO_V1.LINE_STATUSES.INCORRECT_ITEM;
  if (numberPoV1_(line.Qty_Vendor_Backordered) > 0) return PO_V1.LINE_STATUSES.VENDOR_BACKORDER;
  const promised = dateKeyPoV1_(line.Promised_Date);
  if (!promised) return PO_V1.LINE_STATUSES.NEEDS_PROMISED_DATE;
  const today = todayKeyPoV1_();
  if (numberPoV1_(line.Qty_Not_Here_Open) > 0 || promised < today) return PO_V1.LINE_STATUSES.OVERDUE;
  if (promised === today) return PO_V1.LINE_STATUSES.DUE_TODAY;
  if (numberPoV1_(line.Qty_Received_Good) > 0) return PO_V1.LINE_STATUSES.PARTIALLY_RECEIVED;
  return PO_V1.LINE_STATUSES.OPEN;
}

function lineStatusPriorityPoV1_(status) {
  const order = ['DAMAGED', 'INCORRECT_ITEM', 'VENDOR_BACKORDER', 'OVERDUE', 'DUE_TODAY', 'NEEDS_PROMISED_DATE', 'PARTIALLY_RECEIVED', 'OPEN', 'RECEIVED'];
  const index = order.indexOf(normalizeUpperPoV1_(status));
  return index < 0 ? 999 : index;
}

function classifiedExceptionQuantityPoV1_(line) {
  return numberPoV1_(line.Qty_Damaged_Open) + numberPoV1_(line.Qty_Incorrect_Open) + numberPoV1_(line.Qty_Not_Here_Open);
}

function rebuildOperationalIndexPoV1_(procurementId, lines) {
  const existing = recordsByFieldPoV1_(PO_V1.SHEETS.OPERATIONAL_INDEX, 'Parent_ID', procurementId);
  const records = [];
  lines.filter(function (line) { return yesPoV1_(line.Active); }).forEach(function (line) {
    const status = calculateLineStatusPoV1_(line);
    function addIndex(key, type) {
      records.push({Index_Key: key, Index_Type: type, Entity_ID: line.Procurement_Line_ID, Parent_ID: procurementId,
        Row_Number: line._rowNumber, Secondary_Row_Number: '', Active: PO_V1.YES, Updated_At: nowPoV1_()});
    }
    addIndex('LINE_STATUS:' + status, 'LINE_STATUS');
    if (!dateKeyPoV1_(line.Promised_Date) && numberPoV1_(line.Qty_Open) > 0) {
      addIndex('MISSING_PROMISED_DATE', 'MISSING_PROMISED_DATE');
    }
    const promised = dateKeyPoV1_(line.Promised_Date);
    if (numberPoV1_(line.Qty_Open) > 0 && promised) addIndex('PROMISED_DATE:' + promised, 'PROMISED_DATE');
    if (numberPoV1_(line.Qty_Damaged_Open) > 0) addIndex('DAMAGED', 'DAMAGED');
    if (numberPoV1_(line.Qty_Incorrect_Open) > 0) addIndex('INCORRECT_ITEM', 'INCORRECT_ITEM');
    if (classifiedExceptionQuantityPoV1_(line) > 0) addIndex('OPEN_EXCEPTION', 'OPEN_EXCEPTION');
    if (numberPoV1_(line.Qty_Vendor_Backordered) > 0) addIndex('VENDOR_BACKORDER', 'VENDOR_BACKORDER');
  });
  const available = {};
  existing.forEach(function (row) {
    const key = normalizeUpperPoV1_(row.Index_Key) + '|' + normalizePoV1_(row.Entity_ID);
    if (!available[key]) available[key] = []; available[key].push(row);
  });
  const updates = [];
  const appends = [];
  records.forEach(function (record) {
    const key = normalizeUpperPoV1_(record.Index_Key) + '|' + normalizePoV1_(record.Entity_ID);
    const reusable = available[key] && available[key].shift();
    if (reusable) updates.push({rowNumber: reusable._rowNumber, patch: record});
    else appends.push(record);
  });
  Object.keys(available).forEach(function (key) {
    available[key].forEach(function (row) { if (yesPoV1_(row.Active)) updates.push({rowNumber: row._rowNumber, patch: {Active: PO_V1.NO, Updated_At: nowPoV1_()}}); });
  });
  updateRowObjectsPoV1_(PO_V1.SHEETS.OPERATIONAL_INDEX, updates);
  appendObjectsPoV1_(PO_V1.SHEETS.OPERATIONAL_INDEX, appends);
}

function recalculateProcurementPoV1_(procurementId, updatedByEmail) {
  const header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId);
  if (!header) throw new Error('Procurement record not found: ' + procurementId);
  const lines = recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', procurementId).filter(function (line) { return yesPoV1_(line.Active); });
  const statusUpdates = [];
  lines.forEach(function (line) {
    const status = calculateLineStatusPoV1_(line);
    const hasException = classifiedExceptionQuantityPoV1_(line) > 0 ? PO_V1.YES : PO_V1.NO;
    if (normalizeUpperPoV1_(line.Line_Status) !== status || normalizeUpperPoV1_(line.Has_Open_Exception) !== hasException) {
      statusUpdates.push({rowNumber: line._rowNumber, patch: {Line_Status: status, Has_Open_Exception: hasException, Updated_At: nowPoV1_()}});
      line.Line_Status = status;
      line.Has_Open_Exception = hasException;
    }
  });
  updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, statusUpdates);
  const sums = lines.reduce(function (result, line) {
    result.ordered += numberPoV1_(line.Qty_Ordered);
    result.received += numberPoV1_(line.Qty_Received_Good);
    result.open += numberPoV1_(line.Qty_Open);
    result.damaged += numberPoV1_(line.Qty_Damaged_Open);
    result.incorrect += numberPoV1_(line.Qty_Incorrect_Open);
    result.notHere += numberPoV1_(line.Qty_Not_Here_Open);
    result.backorder += numberPoV1_(line.Qty_Vendor_Backordered);
    return result;
  }, {ordered: 0, received: 0, open: 0, damaged: 0, incorrect: 0, notHere: 0, backorder: 0});
  const currentStatus = lines.length ? lines.map(function (line) { return calculateLineStatusPoV1_(line); }).sort(function (left, right) { return lineStatusPriorityPoV1_(left) - lineStatusPriorityPoV1_(right); })[0] : 'EMPTY';
  const poNumbers = uniquePoNumbersPoV1_(lines, header.Primary_PO_Number || header.Vendor_PO_Number);
  const reqNumber = reqNumberPoV1_(header);
  const primaryPo = poNumbers.length ? poNumbers[0] : normalizePoV1_(header.Primary_PO_Number || header.Vendor_PO_Number);
  const firstDescription = lines.length ? lines[0].Material_Description : '';
  updateRowObjectPoV1_(PO_V1.SHEETS.HEADERS, header._rowNumber, {
    Current_Status: currentStatus, Total_Lines: lines.length, Qty_Ordered: sums.ordered, Qty_Received_Good: sums.received, Qty_Open: sums.open,
    Qty_Damaged_Open: sums.damaged, Qty_Incorrect_Open: sums.incorrect, Qty_Not_Here_Open: sums.notHere, Qty_Vendor_Backordered: sums.backorder,
    Req_Number: reqNumber, Primary_PO_Number: primaryPo, Vendor_PO_Number: primaryPo, PO_Number_List: poNumbers.join(', '),
    Cloud_Drive_Name: cloudDriveNamePoV1_(reqNumber, poNumbers, firstDescription),
    Updated_By: normalizeEmailPoV1_(updatedByEmail), Updated_At: nowPoV1_(), Last_Activity_At: nowPoV1_()
  });
  rebuildOperationalIndexPoV1_(procurementId, lines);
  return findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId);
}

function serializeLinePoV1_(line, user) {
  const status = calculateLineStatusPoV1_(line);
  const promisedKey = dateKeyPoV1_(line.Promised_Date);
  const canSeeReq = Boolean(user && (user.canAdminManage || user.canOwnerEdit));
  const poNumber = poNumberPoV1_(line);
  return {
    id: line.Procurement_Line_ID, procurementId: line.Procurement_ID, lineNumber: line.Line_Number, documentNumber: canSeeReq ? line.Document_Number : poNumber,
    reqNumber: canSeeReq ? reqNumberPoV1_(line) : '', poNumber: poNumber, displayNumber: poNumber || (canSeeReq ? reqNumberPoV1_(line) : 'PO not assigned'),
    quantityOrdered: numberPoV1_(line.Qty_Ordered),
    quantityReceivedGood: numberPoV1_(line.Qty_Received_Good), quantityOpen: numberPoV1_(line.Qty_Open), quantityDamaged: numberPoV1_(line.Qty_Damaged_Open),
    quantityIncorrect: numberPoV1_(line.Qty_Incorrect_Open), quantityNotHere: numberPoV1_(line.Qty_Not_Here_Open),
    quantityVendorBackordered: numberPoV1_(line.Qty_Vendor_Backordered), uom: line.UOM,
    description: line.Material_Description, jobNumber: line.Job_Number, accountNumber: line.Account_Number, unitPrice: numberPoV1_(line.Unit_Price),
    extendedPrice: numberPoV1_(line.Extended_Price), importedDeliveryDate: dateKeyPoV1_(line.Imported_Delivery_Date), promisedDate: promisedKey,
    promisedDateKey: promisedKey, status: status, hasOpenException: yesPoV1_(line.Has_Open_Exception), active: yesPoV1_(line.Active),
    manualItem: yesPoV1_(line.Manual_Item), adminNotes: canSeeReq ? normalizePoV1_(line.Admin_Notes) : '',
    canReportNotHere: numberPoV1_(line.Qty_Open) > 0 && Boolean(promisedKey) && todayKeyPoV1_() >= promisedKey
  };
}

function noteLineContextPoV1_(lineById, lineId) {
  const line = lineById[normalizePoV1_(lineId)];
  if (!line) return {lineNumber: '', poNumber: '', description: ''};
  return {lineNumber: line.Line_Number, poNumber: poNumberPoV1_(line), description: line.Material_Description};
}

function procurementNotesForAdminPoV1_(procurementId, lineById) {
  return recordsByFieldPoV1_(PO_V1.SHEETS.PROCUREMENT_NOTES, 'Procurement_ID', procurementId).filter(function (row) {
    return yesPoV1_(row.Active);
  }).map(function (row) {
    const context = noteLineContextPoV1_(lineById || {}, row.Procurement_Line_ID);
    return {id: row.Note_ID, lineId: row.Procurement_Line_ID, type: row.Note_Type, text: row.Note_Text,
      lineNumber: context.lineNumber, poNumber: context.poNumber, description: context.description,
      createdByEmail: row.Created_By_Email, createdByName: row.Created_By_Name, createdAt: row.Created_At};
  });
}

function fieldNotesForAdminPoV1_(procurementId, lineById) {
  const notes = [];
  recordsByFieldPoV1_(PO_V1.SHEETS.EXCEPTIONS, 'Procurement_ID', procurementId).forEach(function (row) {
    const text = normalizePoV1_(row.Field_Notes);
    const context = noteLineContextPoV1_(lineById || {}, row.Procurement_Line_ID);
    if (text) notes.push({source: 'FIELD_EXCEPTION', lineId: row.Procurement_Line_ID, type: row.Exception_Type, text: text,
      lineNumber: context.lineNumber, poNumber: context.poNumber, description: context.description,
      createdByEmail: row.Reported_By_Email, createdByName: row.Reported_By_Name, createdAt: row.Reported_At});
  });
  recordsByFieldPoV1_(PO_V1.SHEETS.TRANSACTIONS, 'Procurement_ID', procurementId).forEach(function (row) {
    const text = normalizePoV1_(row.Notes);
    const context = noteLineContextPoV1_(lineById || {}, row.Procurement_Line_ID);
    if (text && normalizeUpperPoV1_(row.Source_Interface) === 'FIELD') notes.push({source: 'FIELD_TRANSACTION', lineId: row.Procurement_Line_ID, type: row.Transaction_Type, text: text,
      lineNumber: context.lineNumber, poNumber: context.poNumber, description: context.description,
      createdByEmail: row.Authenticated_Email, createdByName: row.Performed_By_Name, createdAt: row.Event_At});
  });
  return notes.slice(-100).reverse();
}

function serializeHeaderPoV1_(header, lines, documents, user) {
  const currentLines = lines || [];
  const liveStatus = currentLines.length ? currentLines.map(function (line) { return calculateLineStatusPoV1_(line); })
    .sort(function (left, right) { return lineStatusPriorityPoV1_(left) - lineStatusPriorityPoV1_(right); })[0] : header.Current_Status;
  const canSeeReq = Boolean(user && (user.canAdminManage || user.canOwnerEdit));
  const poNumbers = uniquePoNumbersPoV1_(currentLines, header.Primary_PO_Number || header.Vendor_PO_Number);
  const primaryPo = poNumbers.length ? poNumbers[0] : normalizePoV1_(header.Primary_PO_Number || header.Vendor_PO_Number);
  const reqNumber = reqNumberPoV1_(header);
  const displayNumber = primaryPo || (canSeeReq ? reqNumber : 'PO not assigned');
  const linePayload = currentLines.map(function (line) { return serializeLinePoV1_(line, user); });
  const lineById = {};
  currentLines.forEach(function (line) { lineById[normalizePoV1_(line.Procurement_Line_ID)] = line; });
  const adminNotes = canSeeReq ? procurementNotesForAdminPoV1_(header.Procurement_ID, lineById) : [];
  const fieldNotes = canSeeReq ? fieldNotesForAdminPoV1_(header.Procurement_ID, lineById) : [];
  return {
    id: header.Procurement_ID, documentType: header.Document_Type, documentNumber: canSeeReq ? header.Document_Number : displayNumber, reqNumber: canSeeReq ? reqNumber : '',
    poNumber: primaryPo, poNumbers: poNumbers, orderSuffix: canSeeReq ? header.Order_Suffix : '',
    displayNumber: displayNumber, cloudDriveName: canSeeReq ? normalizePoV1_(header.Cloud_Drive_Name) : '', branchPlant: header.Branch_Plant,
    shipFrom: header.Ship_From, shipToAddress: header.Ship_To_Address, shipToContact: header.Ship_To_Contact, shipToPhone: header.Ship_To_Phone,
    orderedDate: dateKeyPoV1_(header.Ordered_Date), requestedDate: dateKeyPoV1_(header.Requested_Date), importedDeliveryDate: dateKeyPoV1_(header.Imported_Delivery_Date),
    vendorName: header.Vendor_Name, vendorPoNumber: header.Vendor_PO_Number, status: liveStatus, totalLines: numberPoV1_(header.Total_Lines),
    quantityOrdered: numberPoV1_(header.Qty_Ordered), quantityReceivedGood: numberPoV1_(header.Qty_Received_Good), quantityOpen: numberPoV1_(header.Qty_Open),
    quantityDamaged: numberPoV1_(header.Qty_Damaged_Open), quantityIncorrect: numberPoV1_(header.Qty_Incorrect_Open),
    quantityNotHere: numberPoV1_(header.Qty_Not_Here_Open),
    quantityVendorBackordered: numberPoV1_(header.Qty_Vendor_Backordered), sourceRevision: numberPoV1_(header.Source_Revision),
    adminNotes: adminNotes, fieldNotes: fieldNotes, hasNotes: Boolean(adminNotes.length || fieldNotes.length || normalizePoV1_(header.Admin_Notes)),
    headerAdminNotes: canSeeReq ? normalizePoV1_(header.Admin_Notes) : '', lines: linePayload, documents: documents || []
  };
}

function serializeAdminDocumentSummaryPoV1_(header) {
  const reqNumber = reqNumberPoV1_(header);
  const primaryPo = normalizePoV1_(header.Primary_PO_Number || header.Vendor_PO_Number);
  return {
    id: header.Procurement_ID,
    documentType: header.Document_Type,
    documentNumber: header.Document_Number,
    reqNumber: reqNumber,
    poNumber: primaryPo,
    poNumbers: normalizePoV1_(header.PO_Number_List) ? normalizePoV1_(header.PO_Number_List).split(/\s*,\s*/).filter(Boolean) : (primaryPo ? [primaryPo] : []),
    orderSuffix: header.Order_Suffix,
    displayNumber: primaryPo || reqNumber,
    cloudDriveName: normalizePoV1_(header.Cloud_Drive_Name) || cloudDriveNamePoV1_(reqNumber, primaryPo ? [primaryPo] : [], ''),
    branchPlant: header.Branch_Plant,
    shipToAddress: header.Ship_To_Address,
    requestedDate: dateKeyPoV1_(header.Requested_Date),
    importedDeliveryDate: dateKeyPoV1_(header.Imported_Delivery_Date),
    vendorName: header.Vendor_Name,
    vendorPoNumber: header.Vendor_PO_Number,
    status: header.Current_Status,
    totalLines: numberPoV1_(header.Total_Lines),
    quantityOrdered: numberPoV1_(header.Qty_Ordered),
    quantityReceivedGood: numberPoV1_(header.Qty_Received_Good),
    quantityOpen: numberPoV1_(header.Qty_Open),
    quantityDamaged: numberPoV1_(header.Qty_Damaged_Open),
    quantityIncorrect: numberPoV1_(header.Qty_Incorrect_Open),
    quantityNotHere: numberPoV1_(header.Qty_Not_Here_Open),
    quantityVendorBackordered: numberPoV1_(header.Qty_Vendor_Backordered),
    hasNotes: Boolean(normalizePoV1_(header.Admin_Notes)) || recordsByFieldPoV1_(PO_V1.SHEETS.PROCUREMENT_NOTES, 'Procurement_ID', header.Procurement_ID).some(function (row) { return yesPoV1_(row.Active); }),
    updatedAt: header.Updated_At,
    lastActivityAt: header.Last_Activity_At
  };
}

function headerRecordFromValuesPoV1_(contract, values, rowNumber) {
  const record = {_rowNumber: rowNumber};
  contract.headers.forEach(function (header, index) { record[header] = values[index]; });
  return record;
}

function getRecentAdminDocumentPagePoV1_(pageSize, cursor) {
  const sheet = sheetPoV1_(PO_V1.SHEETS.HEADERS);
  const contract = headerMapPoV1_(PO_V1.SHEETS.HEADERS);
  const lastRow = sheet.getLastRow();
  let endRow = Math.min(lastRow, (numberPoV1_(cursor) || lastRow + 1) - 1);
  const documents = [];
  let nextCursor = '';
  while (documents.length < pageSize && endRow >= 2) {
    const rowCount = Math.min(200, endRow - 1);
    const startRow = endRow - rowCount + 1;
    const values = sheet.getRange(startRow, 1, rowCount, contract.headers.length).getValues();
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const rowNumber = startRow + index;
      const record = headerRecordFromValuesPoV1_(contract, values[index], rowNumber);
      if (normalizePoV1_(record.Procurement_ID) && yesPoV1_(record.Active)) documents.push(serializeAdminDocumentSummaryPoV1_(record));
      if (documents.length >= pageSize) {
        nextCursor = rowNumber > 2 ? String(rowNumber) : '';
        break;
      }
    }
    if (documents.length >= pageSize) break;
    endRow = startRow - 1;
  }
  return {mode: 'RECENT', query: '', pageSize: pageSize, nextCursor: nextCursor, hasMore: Boolean(nextCursor), documents: documents};
}

function getAdminDocumentSearchPagePoV1_(query, pageSize, cursor) {
  const offset = Math.max(0, numberPoV1_(cursor));
  const rowNumbers = [];
  searchCandidatesPoV1_(query).forEach(function (key) {
    findRowsByExactValuePoV1_(PO_V1.SHEETS.SEARCH_INDEX, 'Search_Key', key).forEach(function (rowNumber) { rowNumbers.push(rowNumber); });
  });
  const seen = {};
  const orderedIds = [];
  readRowObjectsPoV1_(PO_V1.SHEETS.SEARCH_INDEX, rowNumbers).forEach(function (row) {
    const procurementId = normalizePoV1_(row.Procurement_ID);
    if (yesPoV1_(row.Active) && procurementId && !seen[procurementId]) {
      seen[procurementId] = true;
      orderedIds.push(procurementId);
    }
  });
  const nextOffset = offset + pageSize;
  const documents = orderedIds.slice(offset, nextOffset).map(function (id) {
    const header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', id);
    return header && yesPoV1_(header.Active) ? serializeAdminDocumentSummaryPoV1_(header) : null;
  }).filter(Boolean);
  const nextCursor = nextOffset < orderedIds.length ? String(nextOffset) : '';
  return {mode: 'SEARCH', query: query, pageSize: pageSize, nextCursor: nextCursor, hasMore: Boolean(nextCursor), documents: documents};
}

function getAdminDocumentsPoV1_(userEmail, request) {
  assertAdminUserPoV1_(userEmail);
  const source = request || {};
  const pageSize = Math.min(50, Math.max(1, numberPoV1_(source.pageSize) || 20));
  const query = normalizePoV1_(source.query);
  if (query) return getAdminDocumentSearchPagePoV1_(query, pageSize, source.cursor);
  return getRecentAdminDocumentPagePoV1_(pageSize, source.cursor);
}

function documentLinksForUserPoV1_(procurementId, user) {
  if (!user.canAdminManage && !user.canOwnerEdit) return [];
  return recordsByFieldPoV1_(PO_V1.SHEETS.DOCUMENTS, 'Procurement_ID', procurementId).filter(function (row) { return yesPoV1_(row.Active); }).map(function (row) {
    return {id: row.Document_Link_ID, role: row.Document_Role, fileName: row.Drive_File_Name, mimeType: row.Mime_Type, url: row.Drive_URL, visibility: row.Visibility, uploadedAt: row.Uploaded_At};
  });
}

function getProcurementDetailPoV1_(userEmail, procurementId) {
  const user = assertSearchUserPoV1_(userEmail);
  const header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId);
  if (!header || !yesPoV1_(header.Active)) throw new Error('Procurement record not found.');
  const lines = recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', procurementId).filter(function (line) { return yesPoV1_(line.Active); });
  return serializeHeaderPoV1_(header, lines, documentLinksForUserPoV1_(procurementId, user), user);
}

function searchCandidatesPoV1_(query) {
  const raw = normalizeUpperPoV1_(query);
  if (!raw) return [];
  if (/^(DOC|ORDER|REQ|PO|VENDORPO|JOB|ACCOUNT|LINE):/.test(raw)) return [raw];
  const compact = raw.replace(/\s+[A-Z]{1,4}$/, '');
  return Array.from(new Set(['PO:' + raw, 'PO:' + compact, 'VENDORPO:' + raw, 'VENDORPO:' + compact, 'REQ:' + raw, 'REQ:' + compact,
    'ORDER:' + raw, 'ORDER:' + compact, 'JOB:' + raw, 'ACCOUNT:' + raw, 'LINE:' + raw, 'DOC:REQUISITION:' + raw, 'DOC:PURCHASE_ORDER:' + raw]));
}

function searchProcurementPoV1_(userEmail, query) {
  const user = assertSearchUserPoV1_(userEmail);
  const candidates = searchCandidatesPoV1_(query);
  if (!candidates.length) throw new Error('Search value is required.');
  const ids = {};
  candidates.forEach(function (key) {
    findRowsByExactValuePoV1_(PO_V1.SHEETS.SEARCH_INDEX, 'Search_Key', key).forEach(function (rowNumber) {
      const row = readRowObjectPoV1_(PO_V1.SHEETS.SEARCH_INDEX, rowNumber);
      if (yesPoV1_(row.Active)) ids[row.Procurement_ID] = true;
    });
  });
  const results = Object.keys(ids).slice(0, PO_V1.LIMITS.MAX_SEARCH_RESULTS).map(function (id) {
    const header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', id);
    const lines = recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', id).filter(function (line) { return yesPoV1_(line.Active); });
    return serializeHeaderPoV1_(header, lines, [], user);
  });
  return {query: query, resultCount: results.length, results: results, user: user};
}

function existingIdempotentTransactionPoV1_(key) {
  const normalized = normalizePoV1_(key);
  if (!normalized) return null;
  const rows = findRowsByExactValuePoV1_(PO_V1.SHEETS.TRANSACTIONS, 'Idempotency_Key', normalized);
  return rows.length ? readRowObjectPoV1_(PO_V1.SHEETS.TRANSACTIONS, rows[0]) : null;
}

function activeUnclassifiedQuantityPoV1_(line) {
  return Math.max(0, numberPoV1_(line.Qty_Open) - numberPoV1_(line.Qty_Damaged_Open) - numberPoV1_(line.Qty_Incorrect_Open) - numberPoV1_(line.Qty_Not_Here_Open) - numberPoV1_(line.Qty_Vendor_Backordered));
}

function resolveAllocationsForReceiptPoV1_(line, quantity, user) {
  let remaining = quantity;
  const mutations = [];
  const exceptions = recordsByFieldPoV1_(PO_V1.SHEETS.EXCEPTIONS, 'Procurement_Line_ID', line.Procurement_Line_ID)
    .filter(function (row) { return yesPoV1_(row.Active) && numberPoV1_(row.Qty_Active) > 0; });
  exceptions.forEach(function (exception) {
    if (remaining <= 0) return;
    const applied = Math.min(remaining, numberPoV1_(exception.Qty_Active));
    const before = recordSnapshotPoV1_(exception);
    const nextActive = numberPoV1_(exception.Qty_Active) - applied;
    const patch = {Qty_Resolved: numberPoV1_(exception.Qty_Resolved) + applied, Qty_Active: nextActive, Status: nextActive <= 0 ? 'RESOLVED' : 'OPEN',
      Resolved_By_Email: user.email, Resolved_At: nextActive <= 0 ? nowPoV1_() : '', Resolution: 'MATERIAL_RECEIVED', Active: nextActive <= 0 ? PO_V1.NO : PO_V1.YES, Updated_At: nowPoV1_()};
    const after = updateRowObjectPoV1_(PO_V1.SHEETS.EXCEPTIONS, exception._rowNumber, patch);
    mutations.push({sheet: PO_V1.SHEETS.EXCEPTIONS, row: exception._rowNumber, before: before, after: recordSnapshotPoV1_(after)});
    if (normalizeUpperPoV1_(exception.Exception_Type) === 'DAMAGED') line.Qty_Damaged_Open = Math.max(0, numberPoV1_(line.Qty_Damaged_Open) - applied);
    if (normalizeUpperPoV1_(exception.Exception_Type) === 'INCORRECT_ITEM') line.Qty_Incorrect_Open = Math.max(0, numberPoV1_(line.Qty_Incorrect_Open) - applied);
    if (normalizeUpperPoV1_(exception.Exception_Type) === 'NOT_HERE') line.Qty_Not_Here_Open = Math.max(0, numberPoV1_(line.Qty_Not_Here_Open) - applied);
    remaining -= applied;
  });
  const backorders = recordsByFieldPoV1_(PO_V1.SHEETS.BACKORDERS, 'Procurement_Line_ID', line.Procurement_Line_ID)
    .filter(function (row) { return yesPoV1_(row.Active) && numberPoV1_(row.Qty_Active) > 0; });
  backorders.forEach(function (backorder) {
    if (remaining <= 0) return;
    const applied = Math.min(remaining, numberPoV1_(backorder.Qty_Active));
    const before = recordSnapshotPoV1_(backorder);
    const nextActive = numberPoV1_(backorder.Qty_Active) - applied;
    const patch = {Qty_Resolved: numberPoV1_(backorder.Qty_Resolved) + applied, Qty_Active: nextActive,
      Status: nextActive <= 0 ? 'RESOLVED' : 'PARTIALLY_RESOLVED', Resolved_At: nextActive <= 0 ? nowPoV1_() : '', Active: nextActive <= 0 ? PO_V1.NO : PO_V1.YES, Updated_At: nowPoV1_()};
    const after = updateRowObjectPoV1_(PO_V1.SHEETS.BACKORDERS, backorder._rowNumber, patch);
    mutations.push({sheet: PO_V1.SHEETS.BACKORDERS, row: backorder._rowNumber, before: before, after: recordSnapshotPoV1_(after)});
    line.Qty_Vendor_Backordered = Math.max(0, numberPoV1_(line.Qty_Vendor_Backordered) - applied);
    remaining -= applied;
  });
  return mutations;
}

function performReceivingActionPoV1_(userEmail, request) {
  const user = assertFieldUserPoV1_(userEmail);
  assertWriteEnabledPoV1_('Field receiving action');
  const source = request || {};
  const action = normalizeUpperPoV1_(source.action);
  if (!Object.prototype.hasOwnProperty.call(PO_V1.ACTIONS, action)) throw new Error('Action must be HERE, DAMAGED, NOT_HERE, or INCORRECT_ITEM.');
  const idempotencyKey = normalizePoV1_(source.idempotencyKey);
  if (!idempotencyKey) throw new Error('idempotencyKey is required.');
  const prior = existingIdempotentTransactionPoV1_(idempotencyKey);
  if (prior) return {idempotentReplay: true, transactionId: prior.Transaction_ID, detail: getProcurementDetailPoV1_(user.email, prior.Procurement_ID)};
  const quantity = positiveNumberPoV1_(source.quantity, 'Quantity');
  const notes = normalizePoV1_(source.notes);
  if ((action === 'DAMAGED' || action === 'NOT_HERE' || action === 'INCORRECT_ITEM') && !notes) throw new Error('Notes are required for ' + action + '.');
  const lock = LockService.getScriptLock();
  lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const racedPrior = existingIdempotentTransactionPoV1_(idempotencyKey);
    if (racedPrior) return {idempotentReplay: true, transactionId: racedPrior.Transaction_ID, detail: getProcurementDetailPoV1_(user.email, racedPrior.Procurement_ID)};
    const line = findRecordByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_Line_ID', source.lineId);
    if (!line || !yesPoV1_(line.Active)) throw new Error('Active procurement line not found.');
    if (quantity > numberPoV1_(line.Qty_Open)) throw new Error('Quantity exceeds the open line quantity.');
    const before = recordSnapshotPoV1_(line);
    const correlationId = uuidPoV1_('CORR');
    const transactionId = uuidPoV1_('TXN');
    let exceptionId = '';
    let mutations = [];
    if (action === 'HERE') {
      mutations = resolveAllocationsForReceiptPoV1_(line, quantity, user);
      line.Qty_Received_Good = numberPoV1_(line.Qty_Received_Good) + quantity;
      line.Qty_Open = Math.max(0, numberPoV1_(line.Qty_Open) - quantity);
    } else {
      if (quantity > activeUnclassifiedQuantityPoV1_(line)) throw new Error('Quantity exceeds the unclassified open quantity.');
      if (action === 'NOT_HERE') {
        const promised = dateKeyPoV1_(line.Promised_Date);
        if (!promised) throw new Error('A promised date is required before reporting Not Here.');
        if (todayKeyPoV1_() < promised) throw new Error('Not Here cannot be recorded before the promised date.');
        line.Qty_Not_Here_Open = numberPoV1_(line.Qty_Not_Here_Open) + quantity;
      } else if (action === 'INCORRECT_ITEM') {
        line.Qty_Incorrect_Open = numberPoV1_(line.Qty_Incorrect_Open) + quantity;
      } else {
        line.Qty_Damaged_Open = numberPoV1_(line.Qty_Damaged_Open) + quantity;
      }
      exceptionId = uuidPoV1_('EXC');
      const exceptionRow = appendObjectPoV1_(PO_V1.SHEETS.EXCEPTIONS, {
        Exception_ID: exceptionId, Correlation_ID: correlationId, Procurement_ID: line.Procurement_ID, Document_Number: line.Document_Number,
        Procurement_Line_ID: line.Procurement_Line_ID, Exception_Type: action, Qty_Reported: quantity, Qty_Resolved: 0, Qty_Active: quantity,
        UOM: line.UOM, Promised_Date: line.Promised_Date,
        Reason: action === 'DAMAGED' ? 'DAMAGED_MATERIAL' : (action === 'INCORRECT_ITEM' ? 'WRONG_ITEM_RECEIVED' : 'NOT_RECEIVED_BY_PROMISED_DATE'),
        Field_Notes: notes,
        Reported_By_Email: user.email, Reported_By_Name: user.name, Reported_At: nowPoV1_(), Status: 'OPEN', Resolved_By_Email: '', Resolved_At: '',
        Resolution: '', Active: PO_V1.YES, Updated_At: nowPoV1_(), Req_Number: reqNumberPoV1_(line), PO_Number: poNumberPoV1_(line)
      });
      mutations.push({sheet: PO_V1.SHEETS.EXCEPTIONS, row: exceptionRow, before: null, after: recordSnapshotPoV1_(readRowObjectPoV1_(PO_V1.SHEETS.EXCEPTIONS, exceptionRow))});
    }
    line.Line_Status = calculateLineStatusPoV1_(line);
    line.Has_Open_Exception = classifiedExceptionQuantityPoV1_(line) > 0 ? PO_V1.YES : PO_V1.NO;
    line.Updated_By = user.email; line.Updated_At = nowPoV1_(); line.Last_Activity_At = nowPoV1_();
    const afterLine = updateRowObjectPoV1_(PO_V1.SHEETS.LINES, line._rowNumber, line);
    mutations.push({sheet: PO_V1.SHEETS.LINES, row: line._rowNumber, before: before, after: recordSnapshotPoV1_(afterLine)});
    appendObjectPoV1_(PO_V1.SHEETS.TRANSACTIONS, {
      Transaction_ID: transactionId, Idempotency_Key: idempotencyKey, Correlation_ID: correlationId, Procurement_ID: line.Procurement_ID,
      Document_Number: line.Document_Number, Procurement_Line_ID: line.Procurement_Line_ID, Transaction_Type: action === 'HERE' ? 'RECEIVED_GOOD' : action + '_REPORTED',
      Quantity: quantity, UOM: line.UOM, Authenticated_Email: user.email, Performed_By_Name: user.name, Event_At: nowPoV1_(), Promised_Date_Snapshot: line.Promised_Date,
      Delivery_Exception_ID: exceptionId, Vendor_Backorder_ID: '', Before_JSON: jsonPoV1_(before), After_JSON: jsonPoV1_(recordSnapshotPoV1_(afterLine)),
      Mutation_JSON: jsonPoV1_(mutations), Reverses_Transaction_ID: '', Source_Interface: 'FIELD', Notes: notes, Active: PO_V1.YES,
      Req_Number: reqNumberPoV1_(line), PO_Number: poNumberPoV1_(line)
    });
    recalculateProcurementPoV1_(line.Procurement_ID, user.email);
    appendAuditPoV1_('PROCUREMENT_LINE', line.Procurement_Line_ID, action, user, correlationId, {sourceInterface: 'FIELD', payload: {quantity: quantity, transactionId: transactionId}});
    SpreadsheetApp.flush();
    return {idempotentReplay: false, transactionId: transactionId, detail: getProcurementDetailPoV1_(user.email, line.Procurement_ID)};
  } finally { lock.releaseLock(); }
}

function savePromisedDatesPoV1_(userEmail, updates) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Promised date update');
  const items = Array.isArray(updates) ? updates : [];
  if (!items.length) throw new Error('At least one promised-date update is required.');
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const affected = {};
    const prepared = items.map(function (item) {
      const promised = datePoV1_(item.promisedDate);
      if (!promised) throw new Error('A valid promised date is required.');
      const line = findRecordByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_Line_ID', item.lineId);
      if (!line || !yesPoV1_(line.Active)) throw new Error('Active procurement line not found: ' + item.lineId);
      return {line: line, promised: promised};
    });
    const now = nowPoV1_();
    prepared.forEach(function (item) {
      affected[item.line.Procurement_ID] = true;
    });
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, prepared.map(function (item) {
      return {rowNumber: item.line._rowNumber, patch: {Promised_Date: item.promised, Promised_Date_Source: 'ADMIN_PROMISED',
        Promised_Date_Updated_By: user.email, Promised_Date_Updated_At: now, Updated_By: user.email, Updated_At: now}};
    }));
    appendAuditRecordsPoV1_(prepared.map(function (item) {
      return auditRecordPoV1_('PROCUREMENT_LINE', item.line.Procurement_Line_ID, 'PROMISED_DATE_UPDATED', user, uuidPoV1_('CORR'),
        {sourceInterface: 'ADMIN', oldValue: item.line.Promised_Date, newValue: item.promised});
    }));
    Object.keys(affected).forEach(function (id) { recalculateProcurementPoV1_(id, user.email); });
    SpreadsheetApp.flush();
    return {success: true, updatedCount: items.length};
  } finally { lock.releaseLock(); }
}

function savePromisedDateForProcurementPoV1_(userEmail, procurementId, promisedDate) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Requisition promised date update');
  const promised = datePoV1_(promisedDate);
  if (!promised) throw new Error('A valid promised date is required.');
  const lock = LockService.getScriptLock(); lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId);
    if (!header || !yesPoV1_(header.Active)) throw new Error('Active procurement record not found.');
    const lines = recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', procurementId).filter(function (line) { return yesPoV1_(line.Active); });
    if (!lines.length) throw new Error('No active lines found for this requisition.');
    const now = nowPoV1_();
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, lines.map(function (line) {
      return {rowNumber: line._rowNumber, patch: {Promised_Date: promised, Promised_Date_Source: 'ADMIN_REQ_PROMISED',
        Promised_Date_Updated_By: user.email, Promised_Date_Updated_At: now, Updated_By: user.email, Updated_At: now}};
    }));
    appendAuditRecordsPoV1_(lines.map(function (line) {
      return auditRecordPoV1_('PROCUREMENT_LINE', line.Procurement_Line_ID, 'PROMISED_DATE_UPDATED', user, uuidPoV1_('CORR'),
        {sourceInterface: 'ADMIN', oldValue: line.Promised_Date, newValue: promised, payload: {procurementId: procurementId, documentNumber: header.Document_Number}});
    }));
    recalculateProcurementPoV1_(procurementId, user.email);
    appendAuditPoV1_('PROCUREMENT', procurementId, 'REQ_PROMISED_DATE_UPDATED', user, uuidPoV1_('CORR'),
      {sourceInterface: 'ADMIN', newValue: promised, payload: {updatedCount: lines.length, documentNumber: header.Document_Number}});
    SpreadsheetApp.flush();
    return {success: true, procurementId: procurementId, documentNumber: header.Document_Number, updatedCount: lines.length};
  } finally { lock.releaseLock(); }
}

function resolveSourceExceptionForBackorderPoV1_(line, exceptionId, quantity, user) {
  if (!exceptionId) return [];
  const exception = findRecordByFieldPoV1_(PO_V1.SHEETS.EXCEPTIONS, 'Exception_ID', exceptionId);
  if (!exception || exception.Procurement_Line_ID !== line.Procurement_Line_ID || !yesPoV1_(exception.Active)) throw new Error('Active source exception was not found for this line.');
  if (quantity > numberPoV1_(exception.Qty_Active)) throw new Error('Backorder quantity exceeds the source exception quantity.');
  const before = recordSnapshotPoV1_(exception);
  const nextActive = numberPoV1_(exception.Qty_Active) - quantity;
  const after = updateRowObjectPoV1_(PO_V1.SHEETS.EXCEPTIONS, exception._rowNumber, {Qty_Resolved: numberPoV1_(exception.Qty_Resolved) + quantity, Qty_Active: nextActive,
    Status: nextActive <= 0 ? 'RESOLVED' : 'OPEN', Resolved_By_Email: user.email, Resolved_At: nextActive <= 0 ? nowPoV1_() : '',
    Resolution: 'CONVERTED_TO_VENDOR_BACKORDER', Active: nextActive <= 0 ? PO_V1.NO : PO_V1.YES, Updated_At: nowPoV1_()});
  if (normalizeUpperPoV1_(exception.Exception_Type) === 'DAMAGED') line.Qty_Damaged_Open = Math.max(0, numberPoV1_(line.Qty_Damaged_Open) - quantity);
  if (normalizeUpperPoV1_(exception.Exception_Type) === 'INCORRECT_ITEM') line.Qty_Incorrect_Open = Math.max(0, numberPoV1_(line.Qty_Incorrect_Open) - quantity);
  if (normalizeUpperPoV1_(exception.Exception_Type) === 'NOT_HERE') line.Qty_Not_Here_Open = Math.max(0, numberPoV1_(line.Qty_Not_Here_Open) - quantity);
  return [{sheet: PO_V1.SHEETS.EXCEPTIONS, row: exception._rowNumber, before: before, after: recordSnapshotPoV1_(after)}];
}

function confirmVendorBackorderPoV1_(userEmail, request) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Vendor backorder confirmation');
  const source = request || {};
  const quantity = positiveNumberPoV1_(source.quantity, 'Backorder quantity');
  const vendorName = normalizePoV1_(source.vendorName);
  const confirmationDate = datePoV1_(source.vendorConfirmationDate);
  const revisedDate = datePoV1_(source.revisedPromisedDate);
  if (!vendorName || !confirmationDate || !revisedDate) throw new Error('Vendor name, vendor confirmation date, and revised promised date are required.');
  const idempotencyKey = normalizePoV1_(source.idempotencyKey);
  if (!idempotencyKey) throw new Error('idempotencyKey is required.');
  const prior = existingIdempotentTransactionPoV1_(idempotencyKey);
  if (prior) return {idempotentReplay: true, backorderId: prior.Vendor_Backorder_ID, detail: getProcurementDetailPoV1_(user.email, prior.Procurement_ID)};
  const lock = LockService.getScriptLock();
  lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  try {
    const racedPrior = existingIdempotentTransactionPoV1_(idempotencyKey);
    if (racedPrior) return {idempotentReplay: true, backorderId: racedPrior.Vendor_Backorder_ID, detail: getProcurementDetailPoV1_(user.email, racedPrior.Procurement_ID)};
    const line = findRecordByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_Line_ID', source.lineId);
    if (!line || !yesPoV1_(line.Active)) throw new Error('Active procurement line not found.');
    if (quantity > numberPoV1_(line.Qty_Open) - numberPoV1_(line.Qty_Vendor_Backordered)) throw new Error('Backorder quantity exceeds the available open quantity.');
    if (!source.sourceExceptionId && quantity > activeUnclassifiedQuantityPoV1_(line)) throw new Error('Backorder quantity exceeds the unclassified open quantity. Select a source exception or reduce quantity.');
    const before = recordSnapshotPoV1_(line);
    const mutations = resolveSourceExceptionForBackorderPoV1_(line, normalizePoV1_(source.sourceExceptionId), quantity, user);
    const correlationId = uuidPoV1_('CORR');
    const backorderId = uuidPoV1_('BO');
    const backorderRow = appendObjectPoV1_(PO_V1.SHEETS.BACKORDERS, {
      Backorder_ID: backorderId, Correlation_ID: correlationId, Procurement_ID: line.Procurement_ID, Document_Number: line.Document_Number,
      Procurement_Line_ID: line.Procurement_Line_ID, Source_Exception_ID: normalizePoV1_(source.sourceExceptionId), Qty_Confirmed: quantity,
      Qty_Resolved: 0, Qty_Active: quantity, UOM: line.UOM, Vendor_Name: vendorName, Vendor_Confirmation_Date: confirmationDate,
      Revised_Promised_Date: revisedDate, Vendor_Reference: normalizePoV1_(source.vendorReference), Admin_Notes: normalizePoV1_(source.notes),
      Confirmed_By_Email: user.email, Confirmed_By_Name: user.name, Confirmed_At: nowPoV1_(), Status: 'CONFIRMED', Resolved_At: '', Active: PO_V1.YES,
      Updated_At: nowPoV1_(), Req_Number: reqNumberPoV1_(line), PO_Number: poNumberPoV1_(line)
    });
    mutations.push({sheet: PO_V1.SHEETS.BACKORDERS, row: backorderRow, before: null, after: recordSnapshotPoV1_(readRowObjectPoV1_(PO_V1.SHEETS.BACKORDERS, backorderRow))});
    line.Qty_Vendor_Backordered = numberPoV1_(line.Qty_Vendor_Backordered) + quantity;
    line.Promised_Date = revisedDate; line.Promised_Date_Source = 'VENDOR_BACKORDER'; line.Promised_Date_Updated_By = user.email; line.Promised_Date_Updated_At = nowPoV1_();
    line.Line_Status = PO_V1.LINE_STATUSES.VENDOR_BACKORDER; line.Updated_By = user.email; line.Updated_At = nowPoV1_(); line.Last_Activity_At = nowPoV1_();
    const afterLine = updateRowObjectPoV1_(PO_V1.SHEETS.LINES, line._rowNumber, line);
    mutations.push({sheet: PO_V1.SHEETS.LINES, row: line._rowNumber, before: before, after: recordSnapshotPoV1_(afterLine)});
    const transactionId = uuidPoV1_('TXN');
    appendObjectPoV1_(PO_V1.SHEETS.TRANSACTIONS, {
      Transaction_ID: transactionId, Idempotency_Key: idempotencyKey, Correlation_ID: correlationId, Procurement_ID: line.Procurement_ID,
      Document_Number: line.Document_Number, Procurement_Line_ID: line.Procurement_Line_ID, Transaction_Type: 'VENDOR_BACKORDER_CONFIRMED', Quantity: quantity,
      UOM: line.UOM, Authenticated_Email: user.email, Performed_By_Name: user.name, Event_At: nowPoV1_(), Promised_Date_Snapshot: revisedDate,
      Delivery_Exception_ID: normalizePoV1_(source.sourceExceptionId), Vendor_Backorder_ID: backorderId, Before_JSON: jsonPoV1_(before),
      After_JSON: jsonPoV1_(recordSnapshotPoV1_(afterLine)), Mutation_JSON: jsonPoV1_(mutations), Reverses_Transaction_ID: '', Source_Interface: 'ADMIN',
      Notes: normalizePoV1_(source.notes), Active: PO_V1.YES, Req_Number: reqNumberPoV1_(line), PO_Number: poNumberPoV1_(line)
    });
    recalculateProcurementPoV1_(line.Procurement_ID, user.email);
    appendAuditPoV1_('VENDOR_BACKORDER', backorderId, 'VENDOR_BACKORDER_CONFIRMED', user, correlationId, {sourceInterface: 'ADMIN', payload: {quantity: quantity, vendor: vendorName, transactionId: transactionId}});
    SpreadsheetApp.flush();
    return {idempotentReplay: false, backorderId: backorderId, transactionId: transactionId, detail: getProcurementDetailPoV1_(user.email, line.Procurement_ID)};
  } finally { lock.releaseLock(); }
}

function getAdminDashboardPoV1_(userEmail) {
  const user = assertAdminUserPoV1_(userEmail);
  const lines = getUsedRowsPoV1_(PO_V1.SHEETS.LINES).filter(function (line) { return yesPoV1_(line.Active); });
  const lineByRow = {};
  lines.forEach(function (line) { lineByRow[line._rowNumber] = line; });
  const queues = {missingDate: [], dueToday: [], overdue: [], damaged: [], incorrectItem: [], vendorBackorder: []};
  const keyToQueue = {MISSING_PROMISED_DATE: 'missingDate', DAMAGED: 'damaged', INCORRECT_ITEM: 'incorrectItem', VENDOR_BACKORDER: 'vendorBackorder'};
  const seen = {};
  getUsedRowsPoV1_(PO_V1.SHEETS.OPERATIONAL_INDEX).filter(function (row) {
    return yesPoV1_(row.Active) && (keyToQueue[normalizeUpperPoV1_(row.Index_Key)] || normalizeUpperPoV1_(row.Index_Type) === 'PROMISED_DATE');
  }).forEach(function (indexRow) {
    let queue = keyToQueue[normalizeUpperPoV1_(indexRow.Index_Key)];
    if (normalizeUpperPoV1_(indexRow.Index_Type) === 'PROMISED_DATE') {
      const promised = normalizePoV1_(indexRow.Index_Key).replace(/^PROMISED_DATE:/i, '');
      queue = promised < todayKeyPoV1_() ? 'overdue' : (promised === todayKeyPoV1_() ? 'dueToday' : '');
    }
    if (!queue) return;
    const entityId = normalizePoV1_(indexRow.Entity_ID);
    const dedupeKey = queue + ':' + entityId;
    if (seen[dedupeKey]) return;
    seen[dedupeKey] = true;
    const line = lineByRow[numberPoV1_(indexRow.Row_Number)];
    if (line && yesPoV1_(line.Active) && normalizePoV1_(line.Procurement_Line_ID) === entityId) queues[queue].push(serializeLinePoV1_(line, user));
  });
  const queueCounts = {};
  Object.keys(queues).forEach(function (key) { queueCounts[key] = queues[key].length; queues[key] = queues[key].slice(0, 200); });
  return {
    user: user,
    kpis: {
      documents: getUsedRowsPoV1_(PO_V1.SHEETS.HEADERS).filter(function (row) { return yesPoV1_(row.Active); }).length,
      lines: lines.length,
      quantityOrdered: lines.reduce(function (sum, line) { return sum + numberPoV1_(line.Qty_Ordered); }, 0),
      quantityReceived: lines.reduce(function (sum, line) { return sum + numberPoV1_(line.Qty_Received_Good); }, 0),
      quantityOpen: lines.reduce(function (sum, line) { return sum + numberPoV1_(line.Qty_Open); }, 0),
      missingPromisedDate: queueCounts.missingDate, overdue: queueCounts.overdue, damaged: queueCounts.damaged,
      incorrectItem: queueCounts.incorrectItem, vendorBackorder: queueCounts.vendorBackorder
    },
    queues: queues,
    recentImports: getRecentImportBatchesPoV1_(10)
  };
}
