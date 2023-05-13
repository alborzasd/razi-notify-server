// by default the .env config file will be loaded from current directory of the running script
// should specify full path so running migration scripts that are in another directory will not result to error
require('dotenv').config({path: __dirname+'/.env'});

module.exports = {
    allowedOrigins: process.env.ALLOWED_ORIGINS.split(' '),
    port: process.env.PORT,
    dbConnectionStr: process.env.DB_CONN_STR,
    JwtSecret: process.env.JWT_SECRET,

    // default deparment to associate with root admin
    defaultDepartment: {
        title: 'کامپیوتر'
    },
    rootAdmin: {
        username: process.env.ROOT_ADMIN_USERNAME,
        password: process.env.ROOT_ADMIN_PASSWORD,
        // some defaults that can be edited later by the user
        first_name: 'عبدالله',
        last_name: 'چاله چاله',
        system_role: 'root_admin', // except this, can not be edited
        lecturer_position: 'assistant professor',
        // student_position: 'bachelor',
        // employee_position: 'manager',
        department: null // get the _id of new created department from database
    }
}