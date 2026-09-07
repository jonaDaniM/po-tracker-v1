const PO_V1 = Object.freeze({
  VERSION: '1.2.0',
  SCHEMA_VERSION: '1.2.0',
  PARSER_VERSION: 'R5543500_REQUISITION_V1',
  YES: 'YES',
  NO: 'NO',
  SHEETS: Object.freeze({
    CONFIG: 'Configuration',
    USERS: 'Users',
    LISTS: 'Lists',
    BATCHES: 'Import_Batches',
    STAGING_HEADERS: 'Import_Staging_Header',
    STAGING_LINES: 'Import_Staging_Lines',
    IMPORT_ISSUES: 'Import_Issues',
    HEADERS: 'Procurement_Header',
    LINES: 'Procurement_Line_Items',
    DOCUMENTS: 'Document_Links',
    TRANSACTIONS: 'Material_Transactions',
    EXCEPTIONS: 'Delivery_Exceptions',
    BACKORDERS: 'Vendor_Backorders',
    PROCUREMENT_NOTES: 'Procurement_Notes',
    RECORD_DELETIONS: 'Record_Deletions',
    SEARCH_INDEX: 'Search_Index',
    OPERATIONAL_INDEX: 'Operational_Index',
    AUDIT: 'Audit_Log',
    HEALTH: 'Operational_Health_Log',
    BACKUPS: 'Backup_History',
    CORRECTIONS: 'Owner_Corrections',
    RECOVERY: 'Recovery_Actions'
  }),
  ACTIONS: Object.freeze({
    HERE: 'HERE',
    DAMAGED: 'DAMAGED',
    NOT_HERE: 'NOT_HERE',
    INCORRECT_ITEM: 'INCORRECT_ITEM'
  }),
  LINE_STATUSES: Object.freeze({
    RECEIVED: 'RECEIVED',
    DAMAGED: 'DAMAGED',
    INCORRECT_ITEM: 'INCORRECT_ITEM',
    VENDOR_BACKORDER: 'VENDOR_BACKORDER',
    OVERDUE: 'OVERDUE',
    DUE_TODAY: 'DUE_TODAY',
    PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
    OPEN: 'OPEN',
    NEEDS_PROMISED_DATE: 'NEEDS_PROMISED_DATE'
  }),
  LIMITS: Object.freeze({
    MAX_UPLOAD_BYTES: 8 * 1024 * 1024,
    MAX_LINES_PER_DOCUMENT: 500,
    MAX_SEARCH_RESULTS: 100,
    LOCK_TIMEOUT_MS: 30000
  }),
  ROLE_PROFILES: Object.freeze({
    READ_ONLY: Object.freeze({key: 'READ_ONLY', label: 'Read Only', canSearch: true, canFieldTransact: false, canAdminManage: false, canOwnerEdit: false}),
    FIELD: Object.freeze({key: 'FIELD', label: 'Field User', canSearch: true, canFieldTransact: true, canAdminManage: false, canOwnerEdit: false}),
    ADMIN_READ_ONLY: Object.freeze({key: 'ADMIN_READ_ONLY', label: 'Admin', canSearch: true, canFieldTransact: false, canAdminManage: true, canAdminEdit: false, canOwnerEdit: false}),
    ADMIN_EDITOR: Object.freeze({key: 'ADMIN_EDITOR', label: 'Admin Edit', canSearch: true, canFieldTransact: false, canAdminManage: true, canAdminEdit: true, canOwnerEdit: false}),
    ADMIN: Object.freeze({key: 'ADMIN', label: 'Material Admin', canSearch: true, canFieldTransact: false, canAdminManage: true, canAdminEdit: true, canOwnerEdit: false}),
    OWNER: Object.freeze({key: 'OWNER', label: 'System Owner', canSearch: true, canFieldTransact: true, canAdminManage: true, canAdminEdit: true, canOwnerEdit: true})
  })
});

const PO_V1_HEADERS = Object.freeze({
  Configuration: ['Setting', 'Value', 'Description', 'Editable'],
  Users: ['User_ID', 'Email', 'Display_Name', 'Role', 'Can_Search', 'Can_Field_Transact', 'Can_Admin_Manage', 'Can_Owner_Edit', 'Active', 'Created_At', 'Notes', 'Updated_By', 'Updated_At', 'Last_Login_At', 'Last_Interface', 'Deactivated_By', 'Deactivated_At', 'Can_Admin_Edit'],
  Lists: ['List_Name', 'Value', 'Sort_Order', 'Active'],
  Import_Batches: ['Batch_ID', 'Source_Type', 'Source_File_Count', 'Source_Fingerprint', 'Parser_Version', 'Staged_Document_Count', 'Total_Line_Count', 'Valid_Document_Count', 'Warning_Document_Count', 'Error_Document_Count', 'Status', 'Created_By', 'Created_At', 'Updated_At', 'Notes', 'Active'],
  Import_Staging_Header: ['Staging_Document_ID', 'Batch_ID', 'Source_File_ID', 'Source_File_Name', 'Source_Mime_Type', 'Source_Fingerprint', 'Source_Modified_At', 'Converted_File_ID', 'Parser_Profile', 'Document_Type', 'Document_Number', 'Order_Suffix', 'Document_Key', 'Branch_Plant', 'Ship_From', 'Ship_To_Address', 'Ship_To_Contact', 'Ship_To_Phone', 'Ordered_Date', 'Requested_Date', 'Imported_Delivery_Date', 'Freight', 'Order_Taken_By', 'Reference', 'Vendor_Name', 'Vendor_PO_Number', 'Parsed_Line_Count', 'Content_Fingerprint', 'Source_Header_JSON', 'Status', 'Error_Count', 'Warning_Count', 'Selected', 'Existing_Procurement_ID', 'Published_Procurement_ID', 'Created_By', 'Created_At', 'Updated_At', 'Published_At', 'Validation_Errors', 'Notes'],
  Import_Staging_Lines: ['Staging_Line_ID', 'Staging_Document_ID', 'Batch_ID', 'Source_Row_Number', 'Line_Number', 'Qty_Ordered', 'UOM', 'Material_Description', 'Unit_Price', 'Extended_Price', 'Job_Number', 'Object_Account', 'Subsidiary', 'Type', 'Subledger', 'Rental_Duration', 'Request_Date', 'Revision', 'Account_Number', 'Status', 'Validation_Errors', 'Created_At', 'Updated_At', 'Published_Line_ID', 'Notes'],
  Import_Issues: ['Import_Issue_ID', 'Batch_ID', 'Staging_Document_ID', 'Source_File_Name', 'Severity', 'Issue_Code', 'Field_Name', 'Line_Number', 'Message', 'Source_Value', 'Resolution_Value', 'Resolved', 'Resolved_By', 'Resolved_At', 'Created_At', 'Notes'],
  Procurement_Header: ['Procurement_ID', 'Document_Type', 'Document_Number', 'Order_Suffix', 'Document_Key', 'Branch_Plant', 'Ship_From', 'Ship_To_Address', 'Ship_To_Contact', 'Ship_To_Phone', 'Ordered_Date', 'Requested_Date', 'Imported_Delivery_Date', 'Vendor_Name', 'Vendor_PO_Number', 'Current_Status', 'Total_Lines', 'Qty_Ordered', 'Qty_Received_Good', 'Qty_Open', 'Qty_Damaged_Open', 'Qty_Incorrect_Open', 'Qty_Not_Here_Open', 'Qty_Vendor_Backordered', 'Source_Staging_ID', 'Source_Revision', 'Source_Fingerprint', 'Active', 'Created_By', 'Created_At', 'Updated_By', 'Updated_At', 'Last_Activity_At', 'Notes', 'Req_Number', 'Primary_PO_Number', 'PO_Number_List', 'Cloud_Drive_Name', 'Admin_Notes', 'Deleted_By_Email', 'Deleted_By_Name', 'Deleted_At', 'Deletion_Reason'],
  Procurement_Line_Items: ['Procurement_Line_ID', 'Procurement_ID', 'Document_Type', 'Document_Number', 'Line_Number', 'Qty_Ordered', 'UOM', 'Material_Description', 'Unit_Price', 'Extended_Price', 'Job_Number', 'Object_Account', 'Subsidiary', 'Type', 'Subledger', 'Rental_Duration', 'Request_Date', 'Source_Revision', 'Account_Number', 'Imported_Delivery_Date', 'Promised_Date', 'Promised_Date_Source', 'Promised_Date_Updated_By', 'Promised_Date_Updated_At', 'Qty_Received_Good', 'Qty_Open', 'Qty_Damaged_Open', 'Qty_Incorrect_Open', 'Qty_Not_Here_Open', 'Qty_Vendor_Backordered', 'Line_Status', 'Has_Open_Exception', 'Active', 'Source_Staging_Line_ID', 'Created_By', 'Created_At', 'Updated_By', 'Updated_At', 'Last_Activity_At', 'Notes', 'Req_Number', 'PO_Number', 'PO_Split_Group_ID', 'Manual_Item', 'Admin_Notes', 'Deleted_By_Email', 'Deleted_By_Name', 'Deleted_At', 'Deletion_Reason'],
  Document_Links: ['Document_Link_ID', 'Procurement_ID', 'Procurement_Line_ID', 'Staging_Document_ID', 'Document_Role', 'Drive_File_ID', 'Drive_File_Name', 'Mime_Type', 'Drive_URL', 'Visibility', 'Uploaded_By_Email', 'Uploaded_By_Name', 'Uploaded_At', 'Active', 'Updated_At', 'Notes'],
  Material_Transactions: ['Transaction_ID', 'Idempotency_Key', 'Correlation_ID', 'Procurement_ID', 'Document_Number', 'Procurement_Line_ID', 'Transaction_Type', 'Quantity', 'UOM', 'Authenticated_Email', 'Performed_By_Name', 'Event_At', 'Promised_Date_Snapshot', 'Delivery_Exception_ID', 'Vendor_Backorder_ID', 'Before_JSON', 'After_JSON', 'Mutation_JSON', 'Reverses_Transaction_ID', 'Source_Interface', 'Notes', 'Active', 'Req_Number', 'PO_Number'],
  Delivery_Exceptions: ['Exception_ID', 'Correlation_ID', 'Procurement_ID', 'Document_Number', 'Procurement_Line_ID', 'Exception_Type', 'Qty_Reported', 'Qty_Resolved', 'Qty_Active', 'UOM', 'Promised_Date', 'Reason', 'Field_Notes', 'Reported_By_Email', 'Reported_By_Name', 'Reported_At', 'Status', 'Resolved_By_Email', 'Resolved_At', 'Resolution', 'Active', 'Updated_At', 'Req_Number', 'PO_Number'],
  Vendor_Backorders: ['Backorder_ID', 'Correlation_ID', 'Procurement_ID', 'Document_Number', 'Procurement_Line_ID', 'Source_Exception_ID', 'Qty_Confirmed', 'Qty_Resolved', 'Qty_Active', 'UOM', 'Vendor_Name', 'Vendor_Confirmation_Date', 'Revised_Promised_Date', 'Vendor_Reference', 'Admin_Notes', 'Confirmed_By_Email', 'Confirmed_By_Name', 'Confirmed_At', 'Status', 'Resolved_At', 'Active', 'Updated_At', 'Req_Number', 'PO_Number'],
  Procurement_Notes: ['Note_ID', 'Procurement_ID', 'Procurement_Line_ID', 'Note_Type', 'Note_Text', 'Created_By_Email', 'Created_By_Name', 'Created_At', 'Active', 'Updated_By_Email', 'Updated_At'],
  Record_Deletions: ['Deletion_ID', 'Correlation_ID', 'Entity_Type', 'Entity_ID', 'Procurement_ID', 'Procurement_Line_ID', 'Req_Number', 'PO_Number', 'Document_Number', 'Line_Number', 'Deleted_By_Email', 'Deleted_By_Name', 'Deleted_At', 'Reason', 'Snapshot_JSON', 'Active'],
  Search_Index: ['Search_Key', 'Search_Type', 'Procurement_ID', 'Document_Number', 'Procurement_Line_ID', 'Header_Row', 'Line_Row', 'Active', 'Index_Version', 'Updated_At', 'Req_Number', 'PO_Number'],
  Operational_Index: ['Index_Key', 'Index_Type', 'Entity_ID', 'Parent_ID', 'Row_Number', 'Secondary_Row_Number', 'Active', 'Updated_At'],
  Audit_Log: ['Audit_ID', 'Entity_Type', 'Entity_ID', 'Action', 'Field_Name', 'Old_Value', 'New_Value', 'User_Email', 'User_Name', 'Timestamp', 'Source_Interface', 'Correlation_ID', 'Notes'],
  Operational_Health_Log: ['Health_Run_ID', 'Environment', 'Database_Fingerprint', 'Overall_Status', 'Schema_Status', 'Integrity_Status', 'Active_Users', 'Published_Documents', 'Material_Lines', 'Open_Exceptions', 'Active_Backorders', 'Last_Backup_Status', 'Last_Backup_At', 'Run_By_Email', 'Run_At', 'Details_JSON'],
  Backup_History: ['Backup_ID', 'Backup_File_ID', 'Backup_File_Name', 'Database_Fingerprint', 'Environment', 'Trigger_Type', 'Status', 'Created_By_Email', 'Created_By_Name', 'Created_At', 'Completed_At', 'File_Size_Bytes', 'Folder_Fingerprint', 'Retention_Expires_At', 'Error_Message', 'Notes', 'Active'],
  Owner_Corrections: ['Correction_ID', 'Target_Transaction_ID', 'Procurement_ID', 'Document_Number', 'Procurement_Line_ID', 'Correction_Type', 'Reason', 'Verification_Code', 'Status', 'Previewed_By', 'Previewed_At', 'Applied_By', 'Applied_At', 'Backup_ID', 'Before_JSON', 'After_JSON', 'Reversal_Transaction_ID', 'Error_Message', 'Notes'],
  Recovery_Actions: ['Recovery_ID', 'Correlation_ID', 'Action_Type', 'Target_Document_Number', 'Target_Procurement_ID', 'Status', 'Previewed_By_Email', 'Previewed_At', 'Applied_By_Email', 'Applied_At', 'Reason', 'Backup_ID', 'Before_JSON', 'After_JSON', 'Error_Message']
});

let PO_V1_DATABASE_ID_ = '';
let PO_V1_SPREADSHEET_ = null;
let PO_V1_HEADER_MAP_CACHE_ = {};
let PO_V1_CONFIGURATION_CACHE_ = null;

function setPoV1DatabaseContext_(databaseId) {
  const nextId = normalizePoV1_(databaseId);
  if (!nextId) throw new Error('databaseId is required.');
  if (nextId !== PO_V1_DATABASE_ID_) {
    PO_V1_DATABASE_ID_ = nextId;
    PO_V1_SPREADSHEET_ = null;
    PO_V1_HEADER_MAP_CACHE_ = {};
    PO_V1_CONFIGURATION_CACHE_ = null;
  }
}

function poV1Database_() {
  if (!PO_V1_DATABASE_ID_) throw new Error('PO Tracker database context is not initialized.');
  if (!PO_V1_SPREADSHEET_) PO_V1_SPREADSHEET_ = SpreadsheetApp.openById(PO_V1_DATABASE_ID_);
  return PO_V1_SPREADSHEET_;
}

function normalizePoV1_(value) { return String(value == null ? '' : value).trim(); }
function normalizeUpperPoV1_(value) { return normalizePoV1_(value).toUpperCase(); }
function normalizeEmailPoV1_(value) { return normalizePoV1_(value).toLowerCase(); }
function yesPoV1_(value) { return normalizeUpperPoV1_(value) === PO_V1.YES; }
function numberPoV1_(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function positiveNumberPoV1_(value, label) { const parsed = numberPoV1_(value); if (parsed <= 0) throw new Error((label || 'Quantity') + ' must be greater than zero.'); return parsed; }
function nowPoV1_() { return new Date(); }
function uuidPoV1_(prefix) { return normalizeUpperPoV1_(prefix || 'ID') + '-' + Utilities.getUuid().toUpperCase(); }
function documentKeyPoV1_(type, number) { const t = normalizeUpperPoV1_(type); const n = normalizeUpperPoV1_(number); if (!t || !n) throw new Error('Document type and number are required.'); return t + ':' + n; }
function databaseFingerprintPoV1_() {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, PO_V1_DATABASE_ID_, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, 12);
}
function contentFingerprintPoV1_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value == null ? '' : value), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}
function datePoV1_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = normalizePoV1_(value);
  if (!text) return null;
  const formats = [/^\d{4}-\d{2}-\d{2}$/, /^\d{1,2}\/\d{1,2}\/\d{4}$/];
  if (formats[0].test(text)) {
    try { return Utilities.parseDate(text, timezonePoV1_(), 'yyyy-MM-dd'); } catch (ignoredIsoDateError) { /* Fall through to generic parsing. */ }
  }
  if (formats[1].test(text)) {
    try { return Utilities.parseDate(text, timezonePoV1_(), 'M/d/yyyy'); } catch (ignoredUsDateError) { /* Fall through to generic parsing. */ }
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function dateKeyPoV1_(value) {
  const date = datePoV1_(value);
  if (!date) return '';
  return Utilities.formatDate(date, timezonePoV1_(), 'yyyy-MM-dd');
}
function todayKeyPoV1_() { return Utilities.formatDate(nowPoV1_(), timezonePoV1_(), 'yyyy-MM-dd'); }
function timezonePoV1_() {
  try { return normalizePoV1_(getPoV1Configuration_().TIMEZONE) || 'America/Indiana/Indianapolis'; }
  catch (error) { return 'America/Indiana/Indianapolis'; }
}
function jsonPoV1_(value) { return JSON.stringify(value == null ? null : value); }
