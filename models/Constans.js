// utility functions
function getEnum(dataObj) {
  const result = {};
  for (let key in dataObj) {
    result[key] = dataObj?.[key]?.value;
  }
  return result;
}

function getEnumPersian(dataObj) {
  const result = {};
  for (let key in dataObj) {
    result[key] = dataObj?.[key]?.displayPersian;
  }
  return result;
}

function getArrayValues(dataObj) {
  return Object.values(dataObj)?.map(({ value }) => value);
}

function translateToPersian(strToTranslate, dataObj) {
  return dataObj?.[strToTranslate]?.displayPersian;
}

/////////////////////////////////////////////////////////////

// data objects
const systemRoles = {
  root_admin: { value: "root_admin", displayPersian: "مدیر سامانه" },
  channel_admin: { value: "channel_admin", displayPersian: "مدیر کانال" },
  user: { value: "user", displayPersian: "کاربر عادی" },
};

const systemRoleEnum = getEnum(systemRoles);

const systemRoleValues = getArrayValues(systemRoles);

function getSystemRolePersian(systemRoleValue) {
  return translateToPersian(systemRoleValue, systemRoles);
}

const systemRoleEnumPersian = getEnumPersian(systemRoles);

/////////////////////////////////////////////////////////////

const studentPositions = {
  bachelor: { value: "bachelor", displayPersian: "کارشناسی" },
  master: { value: "master", displayPersian: "ارشد" },
  doctoral: { value: "doctoral", displayPersian: "دکتری" },
};

const studentPositionValues = getArrayValues(studentPositions);

function getStudentPositionPersian(studentPositionValue) {
  return translateToPersian(studentPositionValue, studentPositions);
}

const studentPositionEnumPersian = getEnumPersian(studentPositions);

/////////////////////////////////////////////////////////////

const lecturerPositions = {
  "sessional instructor": {
    value: "sessional instructor",
    displayPersian: "حق التدریس",
  },
  instructor: { value: "instructor", displayPersian: "مربی" },
  "assistant professor": {
    value: "assistant professor",
    displayPersian: "استادیار",
  },
  "associate professor": {
    value: "associate professor",
    displayPersian: "دانشیار",
  },
  professor: { value: "professor", displayPersian: "استاد تمام" },
};

const lecturerPositionValues = getArrayValues(lecturerPositions);

function getLecturerPositionPersian(lecturerPositionValue) {
  return translateToPersian(lecturerPositionValue, lecturerPositions);
}

const lecturerPositionEnumPersian = getEnumPersian(lecturerPositions);

/////////////////////////////////////////////////////////////

const memberRoles = {
  member: { value: "member", displayPersian: "عضو عادی" },
  agent: { value: "agent", displayPersian: "نماینده" },
};

const memberRoleValues = getArrayValues(memberRoles);

function getMemberRolePersian(memberRoleValue) {
  return translateToPersian(memberRoleValue, memberRoles);
}

const memberRolesEnumPersian = getEnumPersian(memberRoles);

/////////////////////////////////////////////////////////////

const identifierNamingErrorMessage = `نحوه نام گذاری شناسه کانال:
- فقط شامل حروف انگلیسی، اعداد، کاراکتر '-'و '_'
- حداقل 4 کاراکتر
- شروع نام فقط با حروف`;

const phoneNumberErrorMessageCallback = (invalidPhone) =>
  "شماره همراه حتما باید در قالب 09123456789 باشد." +
  `شماره وارد شده: ${invalidPhone}`;

/////////////////////////////////////////////////////////////

/**
 * maybe later: model creators should use these constants as collection name
 */
const collectionNames = {
  Departments: "Departmnets",
  Channels: "Channels",
};

/////////////////////////////////////////////////////////////

module.exports = {
  systemRoleEnum,
  systemRoleValues,
  getSystemRolePersian,
  systemRoleEnumPersian,

  studentPositionValues,
  getStudentPositionPersian,
  studentPositionEnumPersian,

  lecturerPositionValues,
  getLecturerPositionPersian,
  lecturerPositionEnumPersian,

  memberRoleValues,
  getMemberRolePersian,
  memberRolesEnumPersian,

  identifierNamingErrorMessage,
  phoneNumberErrorMessageCallback,

  collectionNames,
};
