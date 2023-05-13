// When calling 'migrate-mongo up/down in CLI'
// the 'db' that is a connection object, is passed to up and down functions automatically
//
// Another approach is to call up and down functions in a js file
// const {database, up, down} = require('migrate-mongo')
// const { db, client } = await database.connect();
// const migrated = await up(db, client);
//
// In the second approach, we can pass mongoose connection to up/down functions
// instead of the connection created by 'migrate-mongo' module
// 
// We want to use mongoose model methods to edit database.
// This methods will execute only if there is a mongoose connection, not other connections
// So we want in both approaches use the mongoose connection that we create
//
// So we have to establish mongoose connection in each migration file
// and close it at the end of up/down methods
//
// As far as I know, there is no option in 'migrate-mongo-config.js' to pass mongoose connection
// when runnig 'migrate-mongo up/down' command in terminal

///////////////////////////////////////////////////////////////////////////////

const { model: DepartmentModel } = require('../../models/Department');
const { model: UserModel } = require('../../models/User');
const models = [
  require('../../models/Department').model,
  require('../../models/User').model,
  require('../../models/Channel').model,
  require('../../models/Message').model
];

const {connect, disconnect} = require('../../mongoose-connection');
const chalk = require('chalk');

const {rootAdmin, defaultDepartment} = require('../../config');

const createDepartment = async(department) => {
    return await DepartmentModel.create(department);
} 

const createRootAdmin = async(departmentId) => {
    rootAdmin.department = departmentId;
    return await UserModel.create(rootAdmin);
}

module.exports = {
  async up(db, client) {
    try {
      await connect();
      console.log(chalk.green('Connected to db to migrate-up...'));

      await Promise.all(models.map(async model => {
        await model.init();
        console.log(chalk.green(model.collection.collectionName, 'collection and indexes created'));
      }));

      const newDepartment = await createDepartment(defaultDepartment);
      console.log(chalk.green('New Department created.'));
      const newRootAmin = await createRootAdmin(newDepartment._id);
      console.log(chalk.green('New Root Admin created.'));

      await disconnect();
      console.log(chalk.bgBlue('Connection closed.'));
    }
    catch(err) {
      console.log(chalk.bgRed('Error'), err);
      throw err;
    }
  },

  async down(db, client) {   
    try {
      await connect();
      console.log(chalk.green('Connected to db to migrate-down...'));

      // DONT!!!
      // await Promise.all(models.map(async model => {
      //   await model.collection.drop();
      //   console.log(chalk.yellow(model.collection.collectionName, 'indexes and collection removed'));
      // }));

      // must drop collections sequentially (order doesn't matter as far as I know)
      // if we do that with promise.all, then some collections are remained in databse
      for(let model of models) {
        await model.collection.drop();
        console.log(chalk.yellow(model.collection.collectionName, 'indexes and collection removed'));
      }

      await disconnect();
      console.log(chalk.bgBlue('Connection closed.'));
    }
    catch(err){
      console.log(chalk.bgRed('Error'), err);
      throw err;
    }
  }
};
