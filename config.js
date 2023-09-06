// by default the .env config file will be loaded from current directory of the starter point script
// should specify full path so running migration scripts that are in another directory will not result to error
// because migration scripts will be run from command line (not from importing it in app.js)
require("dotenv").config({ path: __dirname + "/.env" });

const path = require("path");

module.exports = {
  allowedOrigins: process.env.ALLOWED_ORIGINS.split(" "),
  port: process.env.PORT,
  dbConnectionStr: process.env.DB_CONN_STR,
  JwtSecret: process.env.JWT_SECRET,
  // set expire date for jwt and cookie
  // by default is 1 month
  authTokenExpireSeconds:
    parseInt(process.env.AUTH_TOKEN_EXPIRE_SECONDS) || 2592000,

  // default deparment to associate with root admin
  defaultDepartment: {
    title: "کامپیوتر",
  },
  rootAdmin: {
    username: process.env.ROOT_ADMIN_USERNAME,
    password: process.env.ROOT_ADMIN_PASSWORD,
    // some defaults that can be edited later by the user
    first_name: "مدیر",
    last_name: "سامانه",
    system_role: "root_admin", // except this, can not be edited
    lecturer_position: "assistant professor",
    // student_position: 'bachelor',
    // employee_position: 'manager',
    department: null, // get the _id of new created department from database
  },

  smsApiConfig: {
    apiUrl: process.env.SMS_API_URL,
    apiKey: process.env.SMS_API_KEY,
    sendFromNumber: process.env.SMS_SEND_FROM_NUMBER,
  },

  profileImageFileSizeInMB: process.env.PROFILE_IMAGE_FILE_SIZE_IN_MB,
  /* export a constant object to specify path
   * for each uploaded file type
   * relative path from root of the project (app.js __dirname or projectRootDir)
   */
  availableUploadPath: {
    departmentsImage: "/static/uploads/images/departments/",
    channelsImage: "/static/uploads/images/channels/",
  },

  // absolute filesystem path to the directory containing app.js
  // if config file moves to another folder, this value must be updated
  projectRootDir: path.join(__dirname),
};
