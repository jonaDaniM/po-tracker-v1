function createImportIssuePoV1_(severity, code, field, lineNumber, message, sourceValue) {
  return {
    severity: normalizeUpperPoV1_(severity),
    code: normalizeUpperPoV1_(code),
    field: normalizePoV1_(field),
    lineNumber: numberPoV1_(lineNumber),
    message: normalizePoV1_(message),
    sourceValue: sourceValue == null ? '' : String(sourceValue)
  };
}

function normalizeImportLabelPoV1_(value) {
  return normalizeUpperPoV1_(value).replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
}

function findLabelPositionPoV1_(displayValues, label, maxRows) {
  const target = normalizeImportLabelPoV1_(label);
  const limit = Math.min(displayValues.length, maxRows || 15);
  for (let row = 0; row < limit; row += 1) {
    for (let column = 0; column < (displayValues[row] || []).length; column += 1) {
      if (normalizeImportLabelPoV1_(displayValues[row][column]) === target) return {row: row, column: column};
    }
  }
  return null;
}

function extractLabeledValuePoV1_(displayValues, label) {
  const position = findLabelPositionPoV1_(displayValues, label, 15);
  if (!position) return '';
  const row = displayValues[position.row] || [];
  for (let column = position.column + 1; column < row.length; column += 1) {
    const value = normalizePoV1_(row[column]);
    if (value) return value;
  }
  return '';
}

function extractLabeledDisplayValuePoV1_(displayValues, label) {
  return extractLabeledValuePoV1_(displayValues, label);
}

function extractOrderNumberPoV1_(displayValues) {
  const position = findLabelPositionPoV1_(displayValues, 'ORDER NUMBER', 12);
  if (!position) return {number: '', suffix: ''};
  const values = [];
  const row = displayValues[position.row] || [];
  for (let column = position.column + 1; column < row.length && values.length < 2; column += 1) {
    const value = normalizePoV1_(row[column]);
    if (value) values.push(value);
  }
  return {number: values[0] || '', suffix: values[1] || ''};
}

function extractShipToPoV1_(displayValues) {
  const position = findLabelPositionPoV1_(displayValues, 'SHIP TO', 12);
  if (!position) return {address: '', contact: '', phone: ''};
  const collected = [];
  for (let row = position.row; row < Math.min(displayValues.length, position.row + 6); row += 1) {
    const values = displayValues[row] || [];
    for (let column = position.column + 1; column < values.length; column += 1) {
      const value = normalizePoV1_(values[column]);
      if (value) { collected.push(value); break; }
    }
  }
  let phone = '';
  const withoutPhone = collected.filter(function (value) {
    if (!phone && /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(value)) { phone = value; return false; }
    return true;
  });
  const contact = withoutPhone.length > 1 ? withoutPhone[1] : '';
  const addressParts = withoutPhone.filter(function (_, index) { return index !== 1; });
  return {address: addressParts.join(', '), contact: contact, phone: phone};
}

function findMaterialHeaderPoV1_(displayValues) {
  for (let rowIndex = 0; rowIndex < Math.min(displayValues.length, 30); rowIndex += 1) {
    const byHeader = {};
    (displayValues[rowIndex] || []).forEach(function (value, columnIndex) {
      const normalized = normalizeImportLabelPoV1_(value);
      if (normalized) byHeader[normalized] = columnIndex;
    });
    if (byHeader.LINE !== undefined && byHeader.ORDERED !== undefined && byHeader.UOM !== undefined && byHeader.DESCRIPTION !== undefined) {
      return {
        rowIndex: rowIndex,
        columns: {
          line: byHeader.LINE,
          quantity: byHeader.ORDERED,
          uom: byHeader.UOM,
          description: byHeader.DESCRIPTION,
          unitPrice: byHeader['UNIT PRICE'],
          extendedPrice: byHeader['EXT PRICE'],
          jobNumber: byHeader['JOB NUMBER'],
          objectAccount: byHeader['OBJ ACT'],
          subsidiary: byHeader.SUBSIDIARY,
          type: byHeader.TYPE,
          subledger: byHeader.SUBLEDGER,
          rentalDuration: byHeader['RENTAL DURATION'],
          requestDate: byHeader['REQUEST DATE'],
          revision: byHeader.REV,
          accountNumber: byHeader['ACCOUNT NUMBER']
        }
      };
    }
  }
  return null;
}

function sourceDatePoV1_(rawValues, displayValues, label) {
  const position = findLabelPositionPoV1_(displayValues, label, 15);
  if (!position) return null;
  const displayRow = displayValues[position.row] || [];
  const rawRow = rawValues[position.row] || [];
  for (let column = position.column + 1; column < displayRow.length; column += 1) {
    if (normalizePoV1_(displayRow[column])) return datePoV1_(rawRow[column]) || datePoV1_(displayRow[column]);
  }
  return null;
}

function parserSheetPoV1_(spreadsheet) {
  const candidates = spreadsheet.getSheets().filter(function (sheet) { return normalizeUpperPoV1_(sheet.getName()) !== 'XDO_METADATA'; });
  return candidates.find(function (sheet) {
    const values = sheet.getDataRange().getDisplayValues();
    const flattened = values.slice(0, 10).map(function (row) { return row.join(' '); }).join(' ').toUpperCase();
    return flattened.indexOf('R5543500') >= 0 && flattened.indexOf('REQUISITION') >= 0;
  }) || null;
}

function parseR5543500RequisitionPoV1_(spreadsheet) {
  const issues = [];
  const sheet = parserSheetPoV1_(spreadsheet);
  if (!sheet) {
    return {header: {}, lines: [], issues: [createImportIssuePoV1_('ERROR', 'FORM_MARKER_MISSING', 'Worksheet', 0, 'No R5543500 Requisition worksheet was found.', '')]};
  }
  const range = sheet.getDataRange();
  const displayValues = range.getDisplayValues();
  const rawValues = range.getValues();
  const order = extractOrderNumberPoV1_(displayValues);
  const shipTo = extractShipToPoV1_(displayValues);
  const materialHeader = findMaterialHeaderPoV1_(displayValues);
  const header = {
    documentType: 'REQUISITION',
    documentNumber: normalizePoV1_(order.number),
    orderSuffix: normalizeUpperPoV1_(order.suffix),
    branchPlant: extractLabeledValuePoV1_(displayValues, 'BRANCH/PLANT'),
    shipFrom: extractLabeledValuePoV1_(displayValues, 'SHIPPED FROM'),
    shipToAddress: shipTo.address,
    shipToContact: shipTo.contact,
    shipToPhone: shipTo.phone,
    orderedDate: sourceDatePoV1_(rawValues, displayValues, 'ORDERED'),
    requestedDate: sourceDatePoV1_(rawValues, displayValues, 'REQUESTED'),
    importedDeliveryDate: sourceDatePoV1_(rawValues, displayValues, 'DELIVERY'),
    freight: extractLabeledValuePoV1_(displayValues, 'FREIGHT'),
    orderTakenBy: extractLabeledValuePoV1_(displayValues, 'ORDER TAKEN BY'),
    reference: extractLabeledValuePoV1_(displayValues, 'REFERENCE'),
    vendorName: '',
    vendorPoNumber: normalizePoV1_(order.number),
    worksheetName: sheet.getName()
  };
  if (!header.documentNumber) issues.push(createImportIssuePoV1_('ERROR', 'DOCUMENT_NUMBER_MISSING', 'Document Number', 0, 'Order Number is required.', ''));
  ['ORDERED', 'REQUESTED', 'DELIVERY'].forEach(function (label) {
    const displayed = extractLabeledDisplayValuePoV1_(displayValues, label);
    const field = label === 'ORDERED' ? 'orderedDate' : (label === 'REQUESTED' ? 'requestedDate' : 'importedDeliveryDate');
    if (displayed && !header[field]) issues.push(createImportIssuePoV1_('ERROR', 'DATE_INVALID', label + ' Date', 0, label + ' date could not be parsed.', displayed));
  });
  if (!materialHeader) issues.push(createImportIssuePoV1_('ERROR', 'MATERIAL_HEADER_MISSING', 'Material Table', 0, 'Line, Ordered, UOM, and Description headers were not found.', ''));
  const lines = [];
  const seenLines = {};
  if (materialHeader) {
    const columns = materialHeader.columns;
    for (let rowIndex = materialHeader.rowIndex + 1; rowIndex < displayValues.length; rowIndex += 1) {
      const displayRow = displayValues[rowIndex] || [];
      const rawRow = rawValues[rowIndex] || [];
      const lineNumber = normalizePoV1_(displayRow[columns.line]);
      const quantityDisplay = normalizePoV1_(displayRow[columns.quantity]);
      const description = normalizePoV1_(displayRow[columns.description]).replace(/\s+/g, ' ');
      if (!lineNumber && !quantityDisplay && !description) continue;
      if (!/^\d+(?:\.0+)?$/.test(lineNumber)) continue;
      const quantity = numberPoV1_(rawRow[columns.quantity] !== '' ? rawRow[columns.quantity] : quantityDisplay);
      const errors = [];
      if (quantity <= 0) errors.push('Ordered quantity must be greater than zero.');
      if (!normalizePoV1_(displayRow[columns.uom])) errors.push('UOM is required.');
      if (!description) errors.push('Description is required.');
      if (seenLines[lineNumber]) errors.push('Duplicate line number.');
      seenLines[lineNumber] = true;
      errors.forEach(function (message) {
        issues.push(createImportIssuePoV1_('ERROR', message === 'Duplicate line number.' ? 'DUPLICATE_LINE' : 'LINE_VALIDATION', 'Line', lineNumber, message, lineNumber));
      });
      const rawRequestDate = columns.requestDate === undefined ? '' : displayRow[columns.requestDate];
      const parsedRequestDate = columns.requestDate === undefined ? null : (datePoV1_(rawRow[columns.requestDate]) || datePoV1_(displayRow[columns.requestDate]));
      if (normalizePoV1_(rawRequestDate) && !parsedRequestDate) {
        errors.push('Request date could not be parsed.');
        issues.push(createImportIssuePoV1_('ERROR', 'DATE_INVALID', 'Request Date', lineNumber, 'Line request date could not be parsed.', rawRequestDate));
      }
      lines.push({
        sourceRowNumber: rowIndex + 1,
        lineNumber: String(Math.trunc(numberPoV1_(lineNumber))),
        qtyOrdered: quantity,
        uom: normalizeUpperPoV1_(displayRow[columns.uom]),
        materialDescription: description,
        unitPrice: columns.unitPrice === undefined ? 0 : numberPoV1_(rawRow[columns.unitPrice]),
        extendedPrice: columns.extendedPrice === undefined ? 0 : numberPoV1_(rawRow[columns.extendedPrice]),
        jobNumber: columns.jobNumber === undefined ? '' : normalizePoV1_(displayRow[columns.jobNumber]),
        objectAccount: columns.objectAccount === undefined ? '' : normalizePoV1_(displayRow[columns.objectAccount]),
        subsidiary: columns.subsidiary === undefined ? '' : normalizePoV1_(displayRow[columns.subsidiary]),
        type: columns.type === undefined ? '' : normalizePoV1_(displayRow[columns.type]),
        subledger: columns.subledger === undefined ? '' : normalizePoV1_(displayRow[columns.subledger]),
        rentalDuration: columns.rentalDuration === undefined ? '' : normalizePoV1_(displayRow[columns.rentalDuration]),
        requestDate: parsedRequestDate,
        revision: columns.revision === undefined ? '' : normalizePoV1_(displayRow[columns.revision]),
        accountNumber: columns.accountNumber === undefined ? '' : normalizePoV1_(displayRow[columns.accountNumber]),
        status: errors.length ? 'BLOCKED' : 'VALID',
        validationErrors: errors.join(' | ')
      });
    }
  }
  if (!lines.length) issues.push(createImportIssuePoV1_('ERROR', 'MATERIAL_LINES_MISSING', 'Material Table', 0, 'No material lines were detected.', ''));
  if (lines.length > PO_V1.LIMITS.MAX_LINES_PER_DOCUMENT) issues.push(createImportIssuePoV1_('ERROR', 'LINE_LIMIT_EXCEEDED', 'Material Table', 0, 'Document exceeds the configured line limit.', lines.length));
  const errorCount = issues.filter(function (issue) { return issue.severity === 'ERROR'; }).length;
  const warningCount = issues.filter(function (issue) { return issue.severity === 'WARNING'; }).length;
  const contentFingerprint = contentFingerprintPoV1_(jsonPoV1_({header: header, lines: lines}));
  return {header: header, lines: lines, issues: issues, errorCount: errorCount, warningCount: warningCount, contentFingerprint: contentFingerprint, status: errorCount ? 'BLOCKED' : (warningCount ? 'WARNING' : 'VALID')};
}

function createImportBatchPoV1_(userEmail, notes) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Import batch creation');
  const batchId = uuidPoV1_('BATCH');
  appendObjectPoV1_(PO_V1.SHEETS.BATCHES, {
    Batch_ID: batchId, Source_Type: 'UPLOAD', Source_File_Count: 0, Source_Fingerprint: '', Parser_Version: PO_V1.PARSER_VERSION,
    Staged_Document_Count: 0, Total_Line_Count: 0, Valid_Document_Count: 0, Warning_Document_Count: 0, Error_Document_Count: 0,
    Status: 'OPEN', Created_By: user.email, Created_At: nowPoV1_(), Updated_At: nowPoV1_(), Notes: normalizePoV1_(notes), Active: PO_V1.YES
  });
  appendAuditPoV1_('IMPORT_BATCH', batchId, 'IMPORT_BATCH_CREATED', user, uuidPoV1_('CORR'), {sourceInterface: 'ADMIN'});
  return {batchId: batchId, status: 'OPEN'};
}

function decodedUploadPoV1_(payload) {
  const source = payload || {};
  const fileName = normalizePoV1_(source.fileName);
  if (!fileName || !/\.(xlsx|xls)$/i.test(fileName)) throw new Error('Upload must be an Excel .xlsx or .xls file.');
  const encoded = normalizePoV1_(source.base64Data).replace(/^data:[^,]+,/, '');
  if (!encoded) throw new Error('File data is required.');
  const bytes = Utilities.base64Decode(encoded);
  if (bytes.length > numberPoV1_(getPoV1Configuration_().MAX_UPLOAD_BYTES || PO_V1.LIMITS.MAX_UPLOAD_BYTES)) throw new Error('Upload exceeds the configured 8 MB limit.');
  const mimeType = normalizePoV1_(source.mimeType) || (/\.xls$/i.test(fileName) ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return {fileName: fileName, mimeType: mimeType, bytes: bytes, blob: Utilities.newBlob(bytes, mimeType, fileName)};
}

function openSpreadsheetWithRetryPoV1_(fileId) {
  let error = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { return SpreadsheetApp.openById(fileId); }
    catch (caught) { error = caught; Utilities.sleep(500 * (attempt + 1)); }
  }
  throw error || new Error('Converted spreadsheet could not be opened.');
}

function textBytesPoV1_(text) {
  return Utilities.newBlob(String(text == null ? '' : text)).getBytes();
}

function concatBytesPoV1_(byteArrays) {
  const output = [];
  byteArrays.forEach(function (bytes) {
    for (let index = 0; index < bytes.length; index += 1) output.push(bytes[index]);
  });
  return output;
}

function convertExcelUploadViaDriveRestPoV1_(convertedName, upload, folderId) {
  const boundary = 'po_tracker_v1_' + Utilities.getUuid().replace(/-/g, '');
  const metadata = {
    name: convertedName,
    mimeType: 'application/vnd.google-apps.spreadsheet',
    parents: [folderId]
  };
  const payload = concatBytesPoV1_([
    textBytesPoV1_('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n'),
    textBytesPoV1_('--' + boundary + '\r\nContent-Type: ' + upload.mimeType + '\r\n\r\n'),
    upload.bytes,
    textBytesPoV1_('\r\n--' + boundary + '--')
  ]);
  const response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime', {
    method: 'post',
    contentType: 'multipart/related; boundary=' + boundary,
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: payload,
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Drive conversion failed (' + code + '): ' + body.slice(0, 500));
  }
  const converted = JSON.parse(body);
  if (!converted.id) throw new Error('Drive conversion did not return a converted spreadsheet ID.');
  return converted;
}

function convertExcelUploadToSpreadsheetPoV1_(upload, folderId) {
  const convertedName = upload.fileName.replace(/\.(xlsx|xls)$/i, '') + ' - converted';
  if (typeof Drive !== 'undefined' && Drive && Drive.Files && typeof Drive.Files.create === 'function') {
    return Drive.Files.create({
      name: convertedName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    }, upload.blob, {supportsAllDrives: true, fields: 'id,name,mimeType,modifiedTime'});
  }
  return convertExcelUploadViaDriveRestPoV1_(convertedName, upload, folderId);
}

function updateImportBatchSummaryPoV1_(batchId) {
  const batch = findRecordByFieldPoV1_(PO_V1.SHEETS.BATCHES, 'Batch_ID', batchId);
  if (!batch) throw new Error('Import batch not found: ' + batchId);
  const documents = recordsByFieldPoV1_(PO_V1.SHEETS.STAGING_HEADERS, 'Batch_ID', batchId);
  const lineCount = documents.reduce(function (sum, row) { return sum + numberPoV1_(row.Parsed_Line_Count); }, 0);
  const errors = documents.filter(function (row) { return normalizeUpperPoV1_(row.Status) === 'BLOCKED'; }).length;
  const warnings = documents.filter(function (row) { return normalizeUpperPoV1_(row.Status) === 'WARNING'; }).length;
  const valid = documents.filter(function (row) { return ['VALID', 'PUBLISHED'].includes(normalizeUpperPoV1_(row.Status)); }).length;
  const allPublished = documents.length > 0 && documents.every(function (row) { return normalizeUpperPoV1_(row.Status) === 'PUBLISHED'; });
  const status = allPublished ? 'PUBLISHED' : (errors ? 'REVIEW' : (documents.length ? 'READY' : 'OPEN'));
  updateRowObjectPoV1_(PO_V1.SHEETS.BATCHES, batch._rowNumber, {
    Source_File_Count: documents.length,
    Staged_Document_Count: documents.length,
    Total_Line_Count: lineCount,
    Valid_Document_Count: valid,
    Warning_Document_Count: warnings,
    Error_Document_Count: errors,
    Status: status,
    Updated_At: nowPoV1_()
  });
  return getImportBatchPoV1_(batchId);
}

function uploadImportFilePoV1_(userEmail, payload) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Import upload');
  const upload = decodedUploadPoV1_(payload);
  const batchId = normalizePoV1_(payload && payload.batchId) || createImportBatchPoV1_(user.email, payload && payload.notes).batchId;
  const sourceFingerprint = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, upload.bytes)).replace(/=+$/g, '');
  const duplicate = getUsedRowsPoV1_(PO_V1.SHEETS.STAGING_HEADERS).find(function (row) { return normalizePoV1_(row.Source_Fingerprint) === sourceFingerprint && yesPoV1_(row.Selected); });
  if (duplicate) return {duplicate: true, batchId: duplicate.Batch_ID, stagingDocumentId: duplicate.Staging_Document_ID, message: 'This exact file was already staged.'};
  const configuration = getPoV1Configuration_();
  const folderId = normalizePoV1_(configuration.IMPORT_SOURCE_FOLDER_ID);
  if (!folderId) throw new Error('IMPORT_SOURCE_FOLDER_ID must be configured before uploads.');
  const folder = DriveApp.getFolderById(folderId);
  const sourceFile = folder.createFile(upload.blob);
  const converted = convertExcelUploadToSpreadsheetPoV1_(upload, folderId);
  let parsed;
  try {
    parsed = parseR5543500RequisitionPoV1_(openSpreadsheetWithRetryPoV1_(converted.id));
  } finally {
    try { DriveApp.getFileById(converted.id).setTrashed(true); } catch (ignoredTrashError) { /* Temporary conversion can be cleaned by folder retention policy. */ }
  }
  const stagingId = uuidPoV1_('STGDOC');
  const documentKey = parsed.header.documentNumber ? documentKeyPoV1_(parsed.header.documentType, parsed.header.documentNumber) : '';
  const existing = documentKey ? findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Document_Key', documentKey) : null;
  const now = nowPoV1_();
  appendObjectPoV1_(PO_V1.SHEETS.STAGING_HEADERS, {
    Staging_Document_ID: stagingId, Batch_ID: batchId, Source_File_ID: sourceFile.getId(), Source_File_Name: upload.fileName,
    Source_Mime_Type: upload.mimeType, Source_Fingerprint: sourceFingerprint, Source_Modified_At: datePoV1_(payload && payload.modifiedAt) || sourceFile.getLastUpdated(), Converted_File_ID: converted.id,
    Parser_Profile: PO_V1.PARSER_VERSION, Document_Type: parsed.header.documentType, Document_Number: parsed.header.documentNumber,
    Order_Suffix: parsed.header.orderSuffix, Document_Key: documentKey, Branch_Plant: parsed.header.branchPlant, Ship_From: parsed.header.shipFrom,
    Ship_To_Address: parsed.header.shipToAddress, Ship_To_Contact: parsed.header.shipToContact, Ship_To_Phone: parsed.header.shipToPhone,
    Ordered_Date: parsed.header.orderedDate || '', Requested_Date: parsed.header.requestedDate || '', Imported_Delivery_Date: parsed.header.importedDeliveryDate || '',
    Freight: parsed.header.freight, Order_Taken_By: parsed.header.orderTakenBy, Reference: parsed.header.reference, Vendor_Name: '', Vendor_PO_Number: '',
    Parsed_Line_Count: parsed.lines.length, Content_Fingerprint: parsed.contentFingerprint || '', Source_Header_JSON: jsonPoV1_(parsed.header), Status: parsed.status || 'BLOCKED',
    Error_Count: parsed.errorCount == null ? parsed.issues.length : parsed.errorCount, Warning_Count: parsed.warningCount || 0, Selected: PO_V1.YES,
    Existing_Procurement_ID: existing ? existing.Procurement_ID : '', Published_Procurement_ID: '', Created_By: user.email, Created_At: now, Updated_At: now,
    Published_At: '', Validation_Errors: parsed.issues.filter(function (issue) { return issue.severity === 'ERROR'; }).map(function (issue) { return issue.message; }).join(' | '), Notes: ''
  });
  const stagingLines = parsed.lines.map(function (line) {
    return {
      Staging_Line_ID: uuidPoV1_('STGLINE'), Staging_Document_ID: stagingId, Batch_ID: batchId, Source_Row_Number: line.sourceRowNumber,
      Line_Number: line.lineNumber, Qty_Ordered: line.qtyOrdered, UOM: line.uom, Material_Description: line.materialDescription,
      Unit_Price: line.unitPrice, Extended_Price: line.extendedPrice, Job_Number: line.jobNumber, Object_Account: line.objectAccount,
      Subsidiary: line.subsidiary, Type: line.type, Subledger: line.subledger, Rental_Duration: line.rentalDuration,
      Request_Date: line.requestDate || '', Revision: line.revision, Account_Number: line.accountNumber, Status: line.status,
      Validation_Errors: line.validationErrors, Created_At: now, Updated_At: now, Published_Line_ID: '', Notes: ''
    };
  });
  appendObjectsPoV1_(PO_V1.SHEETS.STAGING_LINES, stagingLines);
  appendObjectsPoV1_(PO_V1.SHEETS.IMPORT_ISSUES, parsed.issues.map(function (issue) {
    return {Import_Issue_ID: uuidPoV1_('ISSUE'), Batch_ID: batchId, Staging_Document_ID: stagingId, Source_File_Name: upload.fileName,
      Severity: issue.severity, Issue_Code: issue.code, Field_Name: issue.field, Line_Number: issue.lineNumber || '', Message: issue.message,
      Source_Value: issue.sourceValue, Resolution_Value: '', Resolved: PO_V1.NO, Resolved_By: '', Resolved_At: '', Created_At: now, Notes: ''};
  }));
  appendObjectPoV1_(PO_V1.SHEETS.DOCUMENTS, {
    Document_Link_ID: uuidPoV1_('DOC'), Procurement_ID: '', Procurement_Line_ID: '', Staging_Document_ID: stagingId,
    Document_Role: 'SOURCE_REQUISITION', Drive_File_ID: sourceFile.getId(), Drive_File_Name: sourceFile.getName(), Mime_Type: upload.mimeType,
    Drive_URL: sourceFile.getUrl(), Visibility: 'ADMIN_OWNER', Uploaded_By_Email: user.email, Uploaded_By_Name: user.name,
    Uploaded_At: now, Active: PO_V1.YES, Updated_At: now, Notes: 'Original uploaded source file.'
  });
  appendAuditPoV1_('IMPORT_DOCUMENT', stagingId, 'IMPORT_FILE_PARSED', user, uuidPoV1_('CORR'), {sourceInterface: 'ADMIN', payload: {fileName: upload.fileName, lines: parsed.lines.length, status: parsed.status}});
  SpreadsheetApp.flush();
  return {duplicate: false, stagingDocumentId: stagingId, batch: updateImportBatchSummaryPoV1_(batchId)};
}

function serializeStagingHeaderPoV1_(row) {
  return {id: row.Staging_Document_ID, batchId: row.Batch_ID, fileName: row.Source_File_Name, documentType: row.Document_Type,
    documentNumber: row.Document_Number, orderSuffix: row.Order_Suffix, lineCount: numberPoV1_(row.Parsed_Line_Count), status: row.Status,
    errorCount: numberPoV1_(row.Error_Count), warningCount: numberPoV1_(row.Warning_Count), existingProcurementId: row.Existing_Procurement_ID,
    publishedProcurementId: row.Published_Procurement_ID, validationErrors: row.Validation_Errors};
}

function serializeStagingLinePoV1_(row) {
  return {id: row.Staging_Line_ID, sourceRowNumber: numberPoV1_(row.Source_Row_Number), lineNumber: row.Line_Number,
    quantityOrdered: numberPoV1_(row.Qty_Ordered), uom: row.UOM, description: row.Material_Description, unitPrice: numberPoV1_(row.Unit_Price),
    extendedPrice: numberPoV1_(row.Extended_Price), jobNumber: row.Job_Number, objectAccount: row.Object_Account, subsidiary: row.Subsidiary,
    type: row.Type, subledger: row.Subledger, rentalDuration: row.Rental_Duration, requestDate: dateKeyPoV1_(row.Request_Date),
    revision: row.Revision, accountNumber: row.Account_Number, status: row.Status, validationErrors: row.Validation_Errors,
    publishedLineId: row.Published_Line_ID};
}

function serializeImportIssuePoV1_(row) {
  return {id: row.Import_Issue_ID, severity: row.Severity, code: row.Issue_Code, fieldName: row.Field_Name,
    lineNumber: row.Line_Number, message: row.Message, sourceValue: row.Source_Value, resolved: yesPoV1_(row.Resolved),
    resolutionValue: row.Resolution_Value, notes: row.Notes};
}

function stagingDiffPoV1_(staging) {
  if (!normalizePoV1_(staging.Existing_Procurement_ID)) return {revision: false, added: numberPoV1_(staging.Parsed_Line_Count), changed: 0, removed: 0, changes: []};
  const current = recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', staging.Existing_Procurement_ID).filter(function (line) { return yesPoV1_(line.Active); });
  const incoming = recordsByFieldPoV1_(PO_V1.SHEETS.STAGING_LINES, 'Staging_Document_ID', staging.Staging_Document_ID);
  const currentByNumber = {}; const incomingByNumber = {};
  current.forEach(function (line) { currentByNumber[normalizePoV1_(line.Line_Number)] = line; });
  incoming.forEach(function (line) { incomingByNumber[normalizePoV1_(line.Line_Number)] = line; });
  const changes = [];
  Object.keys(incomingByNumber).forEach(function (lineNumber) {
    const next = incomingByNumber[lineNumber]; const prior = currentByNumber[lineNumber];
    if (!prior) { changes.push({lineNumber: lineNumber, type: 'ADDED', quantityBefore: 0, quantityAfter: numberPoV1_(next.Qty_Ordered)}); return; }
    const priorComparable = [numberPoV1_(prior.Qty_Ordered), normalizeUpperPoV1_(prior.UOM), normalizePoV1_(prior.Material_Description), numberPoV1_(prior.Unit_Price),
      numberPoV1_(prior.Extended_Price), normalizePoV1_(prior.Job_Number), normalizePoV1_(prior.Object_Account), normalizePoV1_(prior.Subsidiary),
      normalizePoV1_(prior.Type), normalizePoV1_(prior.Subledger), normalizePoV1_(prior.Rental_Duration), dateKeyPoV1_(prior.Request_Date),
      normalizePoV1_(prior.Source_Revision), normalizePoV1_(prior.Account_Number)];
    const nextComparable = [numberPoV1_(next.Qty_Ordered), normalizeUpperPoV1_(next.UOM), normalizePoV1_(next.Material_Description), numberPoV1_(next.Unit_Price),
      numberPoV1_(next.Extended_Price), normalizePoV1_(next.Job_Number), normalizePoV1_(next.Object_Account), normalizePoV1_(next.Subsidiary),
      normalizePoV1_(next.Type), normalizePoV1_(next.Subledger), normalizePoV1_(next.Rental_Duration), dateKeyPoV1_(next.Request_Date),
      normalizePoV1_(next.Revision), normalizePoV1_(next.Account_Number)];
    const changed = jsonPoV1_(priorComparable) !== jsonPoV1_(nextComparable);
    if (changed) changes.push({lineNumber: lineNumber, type: 'CHANGED', quantityBefore: numberPoV1_(prior.Qty_Ordered), quantityAfter: numberPoV1_(next.Qty_Ordered)});
  });
  Object.keys(currentByNumber).forEach(function (lineNumber) {
    if (!incomingByNumber[lineNumber]) changes.push({lineNumber: lineNumber, type: 'REMOVED', quantityBefore: numberPoV1_(currentByNumber[lineNumber].Qty_Ordered), quantityAfter: 0});
  });
  return {revision: true, added: changes.filter(function (change) { return change.type === 'ADDED'; }).length,
    changed: changes.filter(function (change) { return change.type === 'CHANGED'; }).length,
    removed: changes.filter(function (change) { return change.type === 'REMOVED'; }).length, changes: changes.slice(0, 200)};
}

function getImportBatchPoV1_(batchId) {
  const batch = findRecordByFieldPoV1_(PO_V1.SHEETS.BATCHES, 'Batch_ID', batchId);
  if (!batch) throw new Error('Import batch not found: ' + batchId);
  return {batchId: batch.Batch_ID, status: batch.Status, sourceFileCount: numberPoV1_(batch.Source_File_Count), totalLineCount: numberPoV1_(batch.Total_Line_Count),
    validCount: numberPoV1_(batch.Valid_Document_Count), warningCount: numberPoV1_(batch.Warning_Document_Count), errorCount: numberPoV1_(batch.Error_Document_Count),
    documents: recordsByFieldPoV1_(PO_V1.SHEETS.STAGING_HEADERS, 'Batch_ID', batchId).map(function (row) {
      const serialized = serializeStagingHeaderPoV1_(row); serialized.diff = stagingDiffPoV1_(row); return serialized;
    })};
}

function getStagingDocumentDetailPoV1_(userEmail, stagingDocumentId) {
  assertAdminUserPoV1_(userEmail);
  const staging = findRecordByFieldPoV1_(PO_V1.SHEETS.STAGING_HEADERS, 'Staging_Document_ID', stagingDocumentId);
  if (!staging) throw new Error('Staged document not found: ' + stagingDocumentId);
  const document = serializeStagingHeaderPoV1_(staging);
  document.diff = stagingDiffPoV1_(staging);
  return {
    document: document,
    lines: recordsByFieldPoV1_(PO_V1.SHEETS.STAGING_LINES, 'Staging_Document_ID', stagingDocumentId).map(serializeStagingLinePoV1_),
    issues: recordsByFieldPoV1_(PO_V1.SHEETS.IMPORT_ISSUES, 'Staging_Document_ID', stagingDocumentId).map(serializeImportIssuePoV1_)
  };
}

function getRecentImportBatchesPoV1_(limit) {
  return getUsedRowsPoV1_(PO_V1.SHEETS.BATCHES).filter(function (row) { return yesPoV1_(row.Active); }).slice(-Math.max(1, numberPoV1_(limit) || 20)).reverse().map(function (row) {
    return {batchId: row.Batch_ID, status: row.Status, fileCount: numberPoV1_(row.Source_File_Count), lineCount: numberPoV1_(row.Total_Line_Count), createdAt: row.Created_At, createdBy: row.Created_By};
  });
}

function deactivateSearchIndexPoV1_(procurementId) {
  const now = nowPoV1_();

  const updates = recordsByFieldPoV1_(
    PO_V1.SHEETS.SEARCH_INDEX,
    'Procurement_ID',
    procurementId
  )
    .filter(function (row) {
      return yesPoV1_(row.Active);
    })
    .map(function (row) {
      return {
        rowNumber: row._rowNumber,
        patch: {
          Active: PO_V1.NO,
          Updated_At: now
        }
      };
    });

  updateRowObjectsPoV1_(
    PO_V1.SHEETS.SEARCH_INDEX,
    updates
  );
}


function rebuildProcurementSearchIndexPoV1_(header, lines) {
  const existing = recordsByFieldPoV1_(PO_V1.SHEETS.SEARCH_INDEX, 'Procurement_ID', header.Procurement_ID);
  const version = normalizePoV1_(getPoV1Configuration_().SEARCH_INDEX_VERSION || '1');
  const records = [];
  const reqNumber = reqNumberPoV1_(header);
  function add(key, type, line) {
    if (!normalizePoV1_(key)) return;
    const poNumber = line ? poNumberPoV1_(line) : poNumberPoV1_(header);
    records.push({Search_Key: normalizeUpperPoV1_(key), Search_Type: type, Procurement_ID: header.Procurement_ID, Document_Number: header.Document_Number,
      Procurement_Line_ID: line ? line.Procurement_Line_ID : '', Header_Row: header._rowNumber, Line_Row: line ? line._rowNumber : '', Active: PO_V1.YES,
      Index_Version: version, Updated_At: nowPoV1_(), Req_Number: reqNumber, PO_Number: poNumber});
  }
  add('DOC:' + header.Document_Key, 'DOCUMENT', null);
  add('ORDER:' + header.Document_Number, 'ORDER', null);
  add('REQ:' + reqNumber, 'REQ', null);
  if (header.Primary_PO_Number || header.Vendor_PO_Number) add('PO:' + (header.Primary_PO_Number || header.Vendor_PO_Number), 'PO', null);
  if (header.Vendor_PO_Number) add('VENDORPO:' + header.Vendor_PO_Number, 'VENDOR_PO', null);
  lines.filter(function (line) { return yesPoV1_(line.Active); }).forEach(function (line) {
    add('LINE:' + line.Procurement_Line_ID, 'LINE', line);
    if (line.PO_Number) add('PO:' + line.PO_Number, 'PO', line);
    if (line.PO_Number) add('VENDORPO:' + line.PO_Number, 'VENDOR_PO', line);
    if (line.Job_Number) add('JOB:' + line.Job_Number, 'JOB', line);
    if (line.Account_Number) add('ACCOUNT:' + line.Account_Number, 'ACCOUNT', line);
  });
  const available = {};
  existing.forEach(function (row) {
    const key = normalizeUpperPoV1_(row.Search_Key) + '|' + normalizePoV1_(row.Procurement_Line_ID);
    if (!available[key]) available[key] = []; available[key].push(row);
  });
  const updates = [];
  const appends = [];
  records.forEach(function (record) {
    const key = normalizeUpperPoV1_(record.Search_Key) + '|' + normalizePoV1_(record.Procurement_Line_ID);
    const reusable = available[key] && available[key].shift();
    if (reusable) updates.push({rowNumber: reusable._rowNumber, patch: record});
    else appends.push(record);
  });
  Object.keys(available).forEach(function (key) {
    available[key].forEach(function (row) {
      if (yesPoV1_(row.Active)) updates.push({rowNumber: row._rowNumber, patch: {Active: PO_V1.NO, Updated_At: nowPoV1_()}});
    });
  });
  updateRowObjectsPoV1_(PO_V1.SHEETS.SEARCH_INDEX, updates);
  appendObjectsPoV1_(PO_V1.SHEETS.SEARCH_INDEX, appends);
}

function capturePublicationStatePoV1_(staging, procurementId) {
  const sheetNames = [PO_V1.SHEETS.BATCHES, PO_V1.SHEETS.HEADERS, PO_V1.SHEETS.LINES, PO_V1.SHEETS.STAGING_HEADERS, PO_V1.SHEETS.STAGING_LINES,
    PO_V1.SHEETS.DOCUMENTS, PO_V1.SHEETS.SEARCH_INDEX, PO_V1.SHEETS.OPERATIONAL_INDEX, PO_V1.SHEETS.AUDIT];
  const state = {lastRows: {}, snapshots: []};
  sheetNames.forEach(function (sheetName) { state.lastRows[sheetName] = sheetPoV1_(sheetName).getLastRow(); });
  const batch = findRecordByFieldPoV1_(PO_V1.SHEETS.BATCHES, 'Batch_ID', staging.Batch_ID);
  if (batch) state.snapshots.push({sheet: PO_V1.SHEETS.BATCHES, row: batch._rowNumber, record: recordSnapshotPoV1_(batch)});
  state.snapshots.push({sheet: PO_V1.SHEETS.STAGING_HEADERS, row: staging._rowNumber, record: recordSnapshotPoV1_(staging)});
  recordsByFieldPoV1_(PO_V1.SHEETS.STAGING_LINES, 'Staging_Document_ID', staging.Staging_Document_ID).forEach(function (row) {
    state.snapshots.push({sheet: PO_V1.SHEETS.STAGING_LINES, row: row._rowNumber, record: recordSnapshotPoV1_(row)});
  });
  recordsByFieldPoV1_(PO_V1.SHEETS.DOCUMENTS, 'Staging_Document_ID', staging.Staging_Document_ID).forEach(function (row) {
    state.snapshots.push({sheet: PO_V1.SHEETS.DOCUMENTS, row: row._rowNumber, record: recordSnapshotPoV1_(row)});
  });
  if (procurementId) {
    const header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId);
    if (header) state.snapshots.push({sheet: PO_V1.SHEETS.HEADERS, row: header._rowNumber, record: recordSnapshotPoV1_(header)});
    [PO_V1.SHEETS.LINES, PO_V1.SHEETS.OPERATIONAL_INDEX].forEach(function (sheetName) {
      recordsByFieldPoV1_(sheetName, sheetName === PO_V1.SHEETS.LINES ? 'Procurement_ID' : 'Parent_ID', procurementId).forEach(function (row) {
        state.snapshots.push({sheet: sheetName, row: row._rowNumber, record: recordSnapshotPoV1_(row)});
      });
    });
    recordsByFieldPoV1_(PO_V1.SHEETS.SEARCH_INDEX, 'Procurement_ID', procurementId).forEach(function (row) {
      if (!state.snapshots.some(function (item) { return item.sheet === PO_V1.SHEETS.SEARCH_INDEX && item.row === row._rowNumber; })) {
        state.snapshots.push({sheet: PO_V1.SHEETS.SEARCH_INDEX, row: row._rowNumber, record: recordSnapshotPoV1_(row)});
      }
    });
  }
  return state;
}

function rollbackPublicationPoV1_(state) {
  Object.keys(state.lastRows).forEach(function (sheetName) {
    const sheet = sheetPoV1_(sheetName); const beforeLast = state.lastRows[sheetName]; const currentLast = sheet.getLastRow();
    if (currentLast > beforeLast) sheet.getRange(beforeLast + 1, 1, currentLast - beforeLast, expectedHeadersPoV1_(sheetName).length).clearContent();
  });
  state.snapshots.forEach(function (snapshot) { updateRowObjectPoV1_(snapshot.sheet, snapshot.row, snapshot.record); });
  SpreadsheetApp.flush();
}

function publishStagingDocumentPoV1_(userEmail, stagingDocumentId, allowWarnings) {
  const user = assertAdminEditorPoV1_(userEmail);
  assertWriteEnabledPoV1_('Import publication');
  const staging = findRecordByFieldPoV1_(PO_V1.SHEETS.STAGING_HEADERS, 'Staging_Document_ID', stagingDocumentId);
  if (!staging) throw new Error('Staged document not found: ' + stagingDocumentId);
  const status = normalizeUpperPoV1_(staging.Status);
  if (status === 'BLOCKED' || numberPoV1_(staging.Error_Count) > 0) throw new Error('Blocked document cannot be published.');
  if (status === 'WARNING' && !allowWarnings) throw new Error('Document has warnings; explicit approval is required.');
  if (status === 'PUBLISHED') return {alreadyPublished: true, procurementId: staging.Published_Procurement_ID};
  const sourceLines = recordsByFieldPoV1_(PO_V1.SHEETS.STAGING_LINES, 'Staging_Document_ID', stagingDocumentId);
  if (!sourceLines.length) throw new Error('Staged document has no material lines.');
  const lock = LockService.getScriptLock();
  lock.waitLock(PO_V1.LIMITS.LOCK_TIMEOUT_MS);
  let publicationState = null;
  try {
    let header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Document_Key', staging.Document_Key);
    publicationState = capturePublicationStatePoV1_(staging, header ? header.Procurement_ID : '');
    const revision = header ? numberPoV1_(header.Source_Revision) + 1 : 1;
    const now = nowPoV1_();
    const stagedReqNumber = normalizePoV1_(staging.Document_Number);
    const stagedPoNumber = normalizePoV1_(staging.Vendor_PO_Number);
    let procurementId;
    if (!header) {
      procurementId = uuidPoV1_('PROC');
      const headerRow = appendObjectPoV1_(PO_V1.SHEETS.HEADERS, {
        Procurement_ID: procurementId, Document_Type: staging.Document_Type, Document_Number: staging.Document_Number, Order_Suffix: staging.Order_Suffix,
        Document_Key: staging.Document_Key, Branch_Plant: staging.Branch_Plant, Ship_From: staging.Ship_From, Ship_To_Address: staging.Ship_To_Address,
        Ship_To_Contact: staging.Ship_To_Contact, Ship_To_Phone: staging.Ship_To_Phone, Ordered_Date: staging.Ordered_Date, Requested_Date: staging.Requested_Date,
        Imported_Delivery_Date: staging.Imported_Delivery_Date, Vendor_Name: staging.Vendor_Name, Vendor_PO_Number: staging.Vendor_PO_Number,
        Current_Status: PO_V1.LINE_STATUSES.NEEDS_PROMISED_DATE, Total_Lines: sourceLines.length, Qty_Ordered: 0, Qty_Received_Good: 0, Qty_Open: 0,
        Qty_Damaged_Open: 0, Qty_Incorrect_Open: 0, Qty_Not_Here_Open: 0, Qty_Vendor_Backordered: 0, Source_Staging_ID: stagingDocumentId, Source_Revision: revision,
        Source_Fingerprint: staging.Content_Fingerprint, Active: PO_V1.YES, Created_By: user.email, Created_At: now, Updated_By: user.email, Updated_At: now,
        Last_Activity_At: now, Notes: '', Req_Number: stagedReqNumber, Primary_PO_Number: stagedPoNumber, PO_Number_List: stagedPoNumber,
        Cloud_Drive_Name: cloudDriveNamePoV1_(stagedReqNumber, stagedPoNumber ? [stagedPoNumber] : [], sourceLines[0] ? sourceLines[0].Material_Description : ''),
        Admin_Notes: '', Deleted_By_Email: '', Deleted_By_Name: '', Deleted_At: '', Deletion_Reason: ''
      });
      header = readRowObjectPoV1_(PO_V1.SHEETS.HEADERS, headerRow);
    } else {
      procurementId = header.Procurement_ID;
      if (normalizePoV1_(header.Source_Fingerprint) === normalizePoV1_(staging.Content_Fingerprint)) {
        updateRowObjectPoV1_(PO_V1.SHEETS.STAGING_HEADERS, staging._rowNumber, {Status: 'PUBLISHED', Published_Procurement_ID: procurementId, Published_At: now, Updated_At: now});
        updateImportBatchSummaryPoV1_(staging.Batch_ID);
        return {alreadyPublished: true, procurementId: procurementId, identicalRevision: true};
      }
      updateRowObjectPoV1_(PO_V1.SHEETS.HEADERS, header._rowNumber, {
        Order_Suffix: staging.Order_Suffix, Branch_Plant: staging.Branch_Plant, Ship_From: staging.Ship_From, Ship_To_Address: staging.Ship_To_Address,
        Ship_To_Contact: staging.Ship_To_Contact, Ship_To_Phone: staging.Ship_To_Phone, Ordered_Date: staging.Ordered_Date,
        Requested_Date: staging.Requested_Date, Imported_Delivery_Date: staging.Imported_Delivery_Date, Vendor_Name: staging.Vendor_Name,
        Vendor_PO_Number: stagedPoNumber || header.Vendor_PO_Number, Req_Number: header.Req_Number || stagedReqNumber,
        Primary_PO_Number: header.Primary_PO_Number || stagedPoNumber, Source_Staging_ID: stagingDocumentId, Source_Revision: revision,
        Source_Fingerprint: staging.Content_Fingerprint, Updated_By: user.email, Updated_At: now
      });
      header = readRowObjectPoV1_(PO_V1.SHEETS.HEADERS, header._rowNumber);
    }
    const existingLines = recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', procurementId);
    const byLine = {};
    existingLines.forEach(function (line) { byLine[normalizePoV1_(line.Line_Number)] = line; });
    const publishedIds = {};
    const existingLineUpdates = [];
    const newLineRecords = [];
    sourceLines.forEach(function (sourceLine) {
      const lineNumber = normalizePoV1_(sourceLine.Line_Number);
      const existingLine = byLine[lineNumber];
      if (existingLine) {
        const accounted = numberPoV1_(existingLine.Qty_Received_Good) + numberPoV1_(existingLine.Qty_Damaged_Open) +
          numberPoV1_(existingLine.Qty_Incorrect_Open) + numberPoV1_(existingLine.Qty_Not_Here_Open) + numberPoV1_(existingLine.Qty_Vendor_Backordered);
        if (numberPoV1_(sourceLine.Qty_Ordered) < accounted) throw new Error('Revision line ' + lineNumber + ' reduces ordered quantity below accounted activity.');
        existingLineUpdates.push({rowNumber: existingLine._rowNumber, patch: {
          Qty_Ordered: sourceLine.Qty_Ordered, UOM: sourceLine.UOM, Material_Description: sourceLine.Material_Description, Unit_Price: sourceLine.Unit_Price,
          Extended_Price: sourceLine.Extended_Price, Job_Number: sourceLine.Job_Number, Object_Account: sourceLine.Object_Account, Subsidiary: sourceLine.Subsidiary,
          Type: sourceLine.Type, Subledger: sourceLine.Subledger, Rental_Duration: sourceLine.Rental_Duration, Request_Date: sourceLine.Request_Date,
          Source_Revision: sourceLine.Revision || revision, Account_Number: sourceLine.Account_Number, Imported_Delivery_Date: staging.Imported_Delivery_Date,
          Qty_Open: Math.max(0, numberPoV1_(sourceLine.Qty_Ordered) - numberPoV1_(existingLine.Qty_Received_Good)), Active: PO_V1.YES,
          Req_Number: existingLine.Req_Number || stagedReqNumber, PO_Number: existingLine.PO_Number || stagedPoNumber, Manual_Item: existingLine.Manual_Item || PO_V1.NO,
          Source_Staging_Line_ID: sourceLine.Staging_Line_ID, Updated_By: user.email, Updated_At: now
        }});
        publishedIds[sourceLine.Staging_Line_ID] = existingLine.Procurement_Line_ID;
      } else {
        const lineId = uuidPoV1_('LINE');
        newLineRecords.push({stagingLineId: sourceLine.Staging_Line_ID, record: {
          Procurement_Line_ID: lineId, Procurement_ID: procurementId, Document_Type: staging.Document_Type, Document_Number: staging.Document_Number,
          Line_Number: lineNumber, Qty_Ordered: sourceLine.Qty_Ordered, UOM: sourceLine.UOM, Material_Description: sourceLine.Material_Description,
          Unit_Price: sourceLine.Unit_Price, Extended_Price: sourceLine.Extended_Price, Job_Number: sourceLine.Job_Number, Object_Account: sourceLine.Object_Account,
          Subsidiary: sourceLine.Subsidiary, Type: sourceLine.Type, Subledger: sourceLine.Subledger, Rental_Duration: sourceLine.Rental_Duration,
          Request_Date: sourceLine.Request_Date, Source_Revision: sourceLine.Revision || revision, Account_Number: sourceLine.Account_Number,
          Imported_Delivery_Date: staging.Imported_Delivery_Date, Promised_Date: '', Promised_Date_Source: '', Promised_Date_Updated_By: '', Promised_Date_Updated_At: '',
          Qty_Received_Good: 0, Qty_Open: sourceLine.Qty_Ordered, Qty_Damaged_Open: 0, Qty_Incorrect_Open: 0, Qty_Not_Here_Open: 0, Qty_Vendor_Backordered: 0,
          Line_Status: PO_V1.LINE_STATUSES.NEEDS_PROMISED_DATE, Has_Open_Exception: PO_V1.NO, Active: PO_V1.YES,
          Source_Staging_Line_ID: sourceLine.Staging_Line_ID, Created_By: user.email, Created_At: now, Updated_By: user.email, Updated_At: now, Last_Activity_At: '', Notes: '',
          Req_Number: stagedReqNumber, PO_Number: stagedPoNumber, PO_Split_Group_ID: '', Manual_Item: PO_V1.NO, Admin_Notes: '',
          Deleted_By_Email: '', Deleted_By_Name: '', Deleted_At: '', Deletion_Reason: ''
        }});
        publishedIds[sourceLine.Staging_Line_ID] = lineId;
      }
    });
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, existingLineUpdates);
    appendObjectsPoV1_(PO_V1.SHEETS.LINES, newLineRecords.map(function (item) { return item.record; }));
    const incomingNumbers = {};
    sourceLines.forEach(function (line) { incomingNumbers[normalizePoV1_(line.Line_Number)] = true; });
    const removedLineUpdates = [];
    existingLines.forEach(function (line) {
      if (!incomingNumbers[normalizePoV1_(line.Line_Number)] && yesPoV1_(line.Active)) {
        if (yesPoV1_(line.Manual_Item)) return;
        const activity = numberPoV1_(line.Qty_Received_Good) + numberPoV1_(line.Qty_Damaged_Open) + numberPoV1_(line.Qty_Incorrect_Open) + numberPoV1_(line.Qty_Not_Here_Open) + numberPoV1_(line.Qty_Vendor_Backordered);
        if (activity > 0) throw new Error('Revision removes line ' + line.Line_Number + ' after operational activity.');
        removedLineUpdates.push({rowNumber: line._rowNumber, patch: {Active: PO_V1.NO, Qty_Open: 0, Updated_By: user.email, Updated_At: now}});
      }
    });
    updateRowObjectsPoV1_(PO_V1.SHEETS.LINES, removedLineUpdates);
    updateRowObjectsPoV1_(PO_V1.SHEETS.STAGING_LINES, sourceLines.map(function (line) {
      return {rowNumber: line._rowNumber, patch: {Published_Line_ID: publishedIds[line.Staging_Line_ID], Status: 'PUBLISHED', Updated_At: now}};
    }));
    updateRowObjectPoV1_(PO_V1.SHEETS.STAGING_HEADERS, staging._rowNumber, {Status: 'PUBLISHED', Published_Procurement_ID: procurementId, Published_At: now, Updated_At: now});
    updateRowObjectsPoV1_(PO_V1.SHEETS.DOCUMENTS, recordsByFieldPoV1_(PO_V1.SHEETS.DOCUMENTS, 'Staging_Document_ID', stagingDocumentId).map(function (document) {
      return {rowNumber: document._rowNumber, patch: {Procurement_ID: procurementId, Updated_At: now}};
    }));
    recalculateProcurementPoV1_(procurementId, user.email);
    header = findRecordByFieldPoV1_(PO_V1.SHEETS.HEADERS, 'Procurement_ID', procurementId);
    const currentLines = recordsByFieldPoV1_(PO_V1.SHEETS.LINES, 'Procurement_ID', procurementId);
    rebuildProcurementSearchIndexPoV1_(header, currentLines);
    appendAuditPoV1_('PROCUREMENT', procurementId, 'STAGED_DOCUMENT_PUBLISHED', user, uuidPoV1_('CORR'), {sourceInterface: 'ADMIN', payload: {stagingDocumentId: stagingDocumentId, revision: revision}});
    updateImportBatchSummaryPoV1_(staging.Batch_ID);
    SpreadsheetApp.flush();
    return {alreadyPublished: false, procurementId: procurementId, revision: revision, lineCount: currentLines.filter(function (line) { return yesPoV1_(line.Active); }).length};
  } catch (error) {
    if (publicationState) {
      try {
        rollbackPublicationPoV1_(publicationState);
        appendObjectPoV1_(PO_V1.SHEETS.RECOVERY, {Recovery_ID: uuidPoV1_('RECOVERY'), Correlation_ID: uuidPoV1_('CORR'), Action_Type: 'PUBLISH_ROLLBACK',
          Target_Document_Number: staging.Document_Number, Target_Procurement_ID: staging.Existing_Procurement_ID, Status: 'COMPLETED', Previewed_By_Email: user.email,
          Previewed_At: nowPoV1_(), Applied_By_Email: user.email, Applied_At: nowPoV1_(), Reason: error.message, Backup_ID: '', Before_JSON: '', After_JSON: '', Error_Message: ''});
      } catch (rollbackError) {
        appendObjectPoV1_(PO_V1.SHEETS.RECOVERY, {Recovery_ID: uuidPoV1_('RECOVERY'), Correlation_ID: uuidPoV1_('CORR'), Action_Type: 'PUBLISH_ROLLBACK',
          Target_Document_Number: staging.Document_Number, Target_Procurement_ID: staging.Existing_Procurement_ID, Status: 'FAILED', Previewed_By_Email: user.email,
          Previewed_At: nowPoV1_(), Applied_By_Email: user.email, Applied_At: nowPoV1_(), Reason: error.message, Backup_ID: '', Before_JSON: '', After_JSON: '', Error_Message: rollbackError.message});
        throw new Error(error.message + ' Rollback also failed: ' + rollbackError.message);
      }
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}
