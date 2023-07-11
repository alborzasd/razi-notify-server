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

// how to use transactions in mongoose
// https://www.ultimateakash.com/blog-details/IiwzQGAKYAo=/How-to-implement-Transactions-in-Mongoose-&-Node.Js-(Express)

///////////////////////////////////////////////////////////////////////////////

const { model: DepartmentModel } = require('../../models/Department');
const { model: UserModel } = require('../../models/User');
const models = [
  require('../../models/Message').model,
  require('../../models/ChannelUserMembership').model,
  require('../../models/Channel').model,
  require('../../models/User').model,
  require('../../models/Department').model,
];

const mongoose = require('mongoose');
const {connect, disconnect} = require('../../mongoose-connection');
const chalk = require('chalk');

const {rootAdmin, defaultDepartment} = require('../../config');

const createDepartment = async(department) => {
    department.type = "default";
    return await DepartmentModel.create(department);
} 

const createRootAdmin = async(departmentId) => {
    rootAdmin.department_id = departmentId;
    return await UserModel.create(rootAdmin);
}

module.exports = {
  async up(db, client) {
    let session;
    try {
      await connect();
      console.log(chalk.green('Connected to db to migrate-up...'));
      // session = await mongoose.startSession();
      // console.log('Session started');
      // session.startTransaction();
      // console.log('Transaction started');


      await Promise.all(models.map(async model => {
        await model.init();
        console.log(chalk.green(model.collection.collectionName, 'collection and indexes created'));
      }));

      const newDepartment = await createDepartment(defaultDepartment);
      console.log(chalk.green('New Department created.'));
      const newRootAmin = await createRootAdmin(newDepartment._id);
      console.log(chalk.green('New Root Admin created.'));


      // await session.commitTransaction();
      // console.log('Transaction comitted');
    }
    catch(err) {
      // await session.abortTransaction();
      // console.log('Transaction aborted');
      console.log(chalk.bgRed('Error'), err);
      throw err;
    }
    finally {
      // await session.endSession();
      // console.log('Session closed.');
      await disconnect();
      console.log(chalk.bgBlue('Connection closed.'));
    }
  },

  async down(db, client) {
    let session;
    try {
      await connect();
      console.log(chalk.green('Connected to db to migrate-down...'));
      // session = await mongoose.startSession();
      // console.log('Session started');
      // session.startTransaction();
      // console.log('Transaction started');


      // for(let model of models) {
      //   const result = await model.collection.drop();
      //   console.log('result', result);
      //   console.log(chalk.yellow(model.collection.collectionName, 'indexes and collection removed'));
      // }
      await DepartmentModel.deleteMany();
      console.log(chalk.yellow('Departments data deleted'));
      await UserModel.deleteMany();
      console.log(chalk.yellow('Users data deleted'));


      // await session.commitTransaction();
      // console.log('Transaction comitted');
    }
    catch(err){
      // await session.abortTransaction();
      // console.log('Transaction aborted');
      console.log(chalk.bgRed('Error'), err);
      throw err;
    }
    finally {
      // await session.endSession();
      // console.log('Session closed.');
      await disconnect();
      console.log(chalk.bgBlue('Connection closed.'));
    }
  }
};
