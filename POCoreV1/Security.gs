function userCacheKeyPoV1_(email) {
  return 'po1:' + databaseFingerprintPoV1_() + ':user:' + contentFingerprintPoV1_(normalizeEmailPoV1_(email)).slice(0, 24);
}

function invalidateUserCachePoV1_(email) {
  CacheService.getScriptCache().remove(userCacheKeyPoV1_(email));
}

function inferRoleProfilePoV1_(record) {
  const flags = {
    canSearch: yesPoV1_(record.Can_Search),
    canFieldTransact: yesPoV1_(record.Can_Field_Transact),
    canAdminManage: yesPoV1_(record.Can_Admin_Manage),
    canAdminEdit: adminEditFlagPoV1_(record),
    canOwnerEdit: yesPoV1_(record.Can_Owner_Edit)
  };
  const match = Object.keys(PO_V1.ROLE_PROFILES).find(function (key) {
    const profile = PO_V1.ROLE_PROFILES[key];
    return profile.canSearch === flags.canSearch &&
      profile.canFieldTransact === flags.canFieldTransact &&
      profile.canAdminManage === flags.canAdminManage &&
      Boolean(profile.canAdminEdit) === flags.canAdminEdit &&
      profile.canOwnerEdit === flags.canOwnerEdit;
  });
  return match || 'CUSTOM';
}

function adminEditFlagPoV1_(record) {
  if (yesPoV1_(record.Can_Owner_Edit)) return true;
  const explicit = normalizeUpperPoV1_(record.Can_Admin_Edit);
  if (explicit === PO_V1.YES) return true;
  if (explicit === PO_V1.NO) return false;
  const role = normalizeUpperPoV1_(record.Role);
  return yesPoV1_(record.Can_Admin_Manage) && ['MATERIAL ADMIN', 'ADMIN EDIT', 'ADMIN EDITOR'].indexOf(role) >= 0;
}

function serializeUserPoV1_(record) {
  return {
    id: normalizePoV1_(record.User_ID),
    email: normalizeEmailPoV1_(record.Email),
    name: normalizePoV1_(record.Display_Name),
    role: normalizePoV1_(record.Role),
    profile: inferRoleProfilePoV1_(record),
    canSearch: yesPoV1_(record.Can_Search),
    canFieldTransact: yesPoV1_(record.Can_Field_Transact),
    canAdminManage: yesPoV1_(record.Can_Admin_Manage),
    canAdminEdit: adminEditFlagPoV1_(record),
    canOwnerEdit: yesPoV1_(record.Can_Owner_Edit),
    active: yesPoV1_(record.Active)
  };
}

function getUserPoV1_(email) {
  const normalized = normalizeEmailPoV1_(email);
  if (!normalized) throw new Error('Authenticated Google account email is unavailable.');
  const cache = CacheService.getScriptCache();
  const key = userCacheKeyPoV1_(normalized);
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const record = findRecordByFieldPoV1_(PO_V1.SHEETS.USERS, 'Email', normalized);
  if (!record || !yesPoV1_(record.Active)) throw new Error('Unauthorized user: ' + normalized);
  const user = serializeUserPoV1_(record);
  cache.put(key, JSON.stringify(user), 900);
  return user;
}

function assertSearchUserPoV1_(email) {
  const user = getUserPoV1_(email);
  if (!user.canSearch) throw new Error(user.role + ' cannot search procurement records.');
  return user;
}

function assertFieldUserPoV1_(email) {
  const user = getUserPoV1_(email);
  if (!user.canFieldTransact) throw new Error(user.role + ' cannot perform Field receiving actions.');
  return user;
}

function assertAdminUserPoV1_(email) {
  const user = getUserPoV1_(email);
  if (!user.canAdminManage) throw new Error(user.role + ' cannot access the Admin dashboard.');
  return user;
}

function assertAdminEditorPoV1_(email) {
  const user = getUserPoV1_(email);
  if (!user.canAdminEdit && !user.canOwnerEdit) throw new Error(user.role + ' cannot edit procurement records.');
  return user;
}

function assertOwnerPoV1_(email) {
  const user = getUserPoV1_(email);
  if (!user.canOwnerEdit) throw new Error('System Owner access is required.');
  return user;
}

function userAccessTouchCacheKeyPoV1_(email) {
  return 'po1:' +
    databaseFingerprintPoV1_() +
    ':access-touch:' +
    contentFingerprintPoV1_(normalizeEmailPoV1_(email)).slice(0, 24);
}

function recordUserAccessPoV1_(email, interfaceName) {
  const normalizedEmail = normalizeEmailPoV1_(email);
  if (!normalizedEmail) return {recorded: false, reason: 'NO_EMAIL'};

  const cache = CacheService.getScriptCache();
  const cacheKey = userAccessTouchCacheKeyPoV1_(normalizedEmail);

  if (cache.get(cacheKey)) {
    return {recorded: false, reason: 'RATE_LIMITED'};
  }

  const rows = findRowsByExactValuePoV1_(
    PO_V1.SHEETS.USERS,
    'Email',
    normalizedEmail
  );

  if (rows.length !== 1) {
    return {recorded: false, reason: 'USER_ROW_NOT_UNIQUE'};
  }

  updateRowObjectPoV1_(
    PO_V1.SHEETS.USERS,
    rows[0],
    {
      Last_Login_At: nowPoV1_(),
      Last_Interface: normalizeUpperPoV1_(interfaceName || 'PORTAL')
    }
  );

  cache.put(cacheKey, '1', 1800);
  return {recorded: true};
}

function bootstrapPoTrackerDatabaseInternal_(databaseId, email, displayName, environment) {
  setPoV1DatabaseContext_(databaseId);
  const contract = inspectPoTrackerContractInternal_();
  if (!contract.passed) throw new Error('Database schema validation failed: ' + contract.errors.join(' | '));
  const normalizedEmail = normalizeEmailPoV1_(email);
  if (!normalizedEmail) throw new Error('Authenticated owner email is required.');
  const users = getUsedRowsPoV1_(PO_V1.SHEETS.USERS);
  let owner;
  if (!users.length) {
    const configuredOwner = normalizeEmailPoV1_(getPoV1Configuration_().OWNER_EMAIL);
    if (configuredOwner && configuredOwner !== normalizedEmail) throw new Error('The configured OWNER_EMAIL does not match the executing account.');
    setConfigurationValuePoV1_('OWNER_EMAIL', normalizedEmail);
    appendObjectPoV1_(PO_V1.SHEETS.USERS, {
      User_ID: uuidPoV1_('USER'),
      Email: normalizedEmail,
      Display_Name: normalizePoV1_(displayName) || normalizedEmail,
      Role: PO_V1.ROLE_PROFILES.OWNER.label,
      Can_Search: PO_V1.YES,
      Can_Field_Transact: PO_V1.YES,
      Can_Admin_Manage: PO_V1.YES,
      Can_Admin_Edit: PO_V1.YES,
      Can_Owner_Edit: PO_V1.YES,
      Active: PO_V1.YES,
      Created_At: nowPoV1_(),
      Notes: 'Initial owner created by bootstrapPoTracker.',
      Updated_By: normalizedEmail,
      Updated_At: nowPoV1_()
    });
    invalidateUserCachePoV1_(normalizedEmail);
    owner = getUserPoV1_(normalizedEmail);
  } else {
    owner = assertOwnerPoV1_(normalizedEmail);
  }
  const normalizedEnvironment = normalizeUpperPoV1_(environment || 'TEST');
  if (!['TEST', 'PRODUCTION'].includes(normalizedEnvironment)) throw new Error('Environment must be TEST or PRODUCTION.');
  setConfigurationValuePoV1_('ENVIRONMENT_NAME', normalizedEnvironment);
  appendAuditPoV1_('SYSTEM', databaseFingerprintPoV1_(), 'DATABASE_BOOTSTRAPPED', owner, uuidPoV1_('CORR'), {
    sourceInterface: 'SETUP', payload: {environment: normalizedEnvironment, schemaVersion: PO_V1.SCHEMA_VERSION}
  });
  SpreadsheetApp.flush();
  return {
    success: true,
    version: PO_V1.VERSION,
    schemaVersion: PO_V1.SCHEMA_VERSION,
    databaseFingerprint: databaseFingerprintPoV1_(),
    environment: normalizedEnvironment,
    transactionMode: normalizeUpperPoV1_(getPoV1Configuration_().TRANSACTION_MODE || 'READ_ONLY'),
    owner: owner
  };
}
