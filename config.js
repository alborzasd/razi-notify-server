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
        title: 'دانشکده کامپیوتر'
    },
    rootAdmin: {
        username: process.env.ROOT_ADMIN_USERNAME,
        password: process.env.ROOT_ADMIN_PASSWORD,
        // some defaults that can be edited later by the user
        first_name: 'admin',
        last_name: 'admin',
        system_role: 'root_admin', // except this, can not be edited
        organization_role: 'professor',
        departmentId: null // get the _id of new created department from database
    }
}