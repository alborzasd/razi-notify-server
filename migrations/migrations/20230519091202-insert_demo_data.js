const { model: UserModel } = require('../../models/User');
const { model: ChannelModel } = require('../../models/Channel');
const { model: MessageModel } = require('../../models/Message');
const { model: DepartmentModel } = require('../../models/Department');
const { model: ChannelUserMembershipModel } = require('../../models/ChannelUserMembership');

const mongoose = require('mongoose');
const {connect, disconnect} = require('../../mongoose-connection');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

module.exports = {
  async up(db, client) {
    let session;
    try {
      await connect();
      console.log(chalk.green('Connected to db to migrate-up...'));
      session = await mongoose.startSession();
      console.log('Session started');
      session.startTransaction();
      console.log('Transaction started');


      const rootAdmin = await UserModel.findOne({system_role: 'root_admin'});
      if(!rootAdmin){
        throw new Error('Root admin does not exist');
      }
      const defaultDepartment = await DepartmentModel.findOne({type: "default"});
      if(!defaultDepartment){
        throw new Error('There is no default department.');
      }


      const demoData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../seed_data/seed_data.json'))
      );

      // Departments
      const departments = await DepartmentModel.create(demoData.Departments, {session});
      console.log(chalk.green('Demo departments created.'));

      // Users
      demoData.Users.forEach((user) => user.department_id = defaultDepartment._id);
      const users = await UserModel.create(demoData.Users, {session});
      console.log(chalk.green('Demo users created.'));

      // Channels
      demoData.Channels.forEach((channel) => {
        if(channel.owner_id === "rootAdmin"){
          channel.owner_id = rootAdmin._id;
        } else {
          // get index of the demoUser that has the same id with channel owner_id
          const index = demoData.Users.findIndex((user) => user.id === channel.owner_id);
          // assign the _id of the actual user stored in db to channel owner_id
          channel.owner_id = users[index]._id;
        }
      });
      const channels = await ChannelModel.create(demoData.Channels, {session});
      console.log(chalk.green('Demo channels created.'));

      // ChannelUserMembership
      demoData.ChannelUserMembership.forEach((membership) => {
        let index;
        index = demoData.Users.findIndex((user) => user.id === membership.user_id);
        membership.user_id = users[index]._id;
        index = demoData.Channels.findIndex((channel) => channel.id === membership.channel_id);
        membership.channel_id = channels[index]._id;
      });
      const channelUserMemberships = 
        await ChannelUserMembershipModel.create(demoData.ChannelUserMembership, {session});
      console.log(chalk.green('Demo channel-user-memberships created.'));

      // Messages
      demoData.Messages.forEach((message) => {
        let index;
        index = demoData.Channels.findIndex((channel) => channel.id === message.channel_id);
        message.channel_id = channels[index]._id;
        if(message.sent_by_user_id) {
          index = demoData.Users.findIndex((user) => user.id === message.sent_by_user_id);
          message.sent_by_user_id = users[index]._id;
        }
      });
      const messages = await MessageModel.create(demoData.Messages, {session});
      console.log(chalk.green('Demo messages created.'));
  
      await session.commitTransaction();
      console.log('Transaction comitted');
    }
    catch(err) {
      await session.abortTransaction();
      console.log('Transaction aborted');
      console.log(chalk.bgRed('Error'), err);
      throw err;
    }
    finally {
      await session.endSession();
      console.log('Session closed.');
      await disconnect();
      console.log(chalk.bgBlue('Connection closed.'));
    }
  },

  async down(db, client) {
    let session
    try {
      await connect();
      console.log(chalk.green('Connected to db to migrate-down...'));
      session = await mongoose.startSession();
      console.log('Session started');
      session.startTransaction();
      console.log('Transaction started');


      await DepartmentModel.deleteMany({type: {$ne: 'default'}}, {session});
      console.log(chalk.yellow('Demo departments removed.'));
      await UserModel.deleteMany({system_role: {$ne: 'root_admin'}}, {session});
      console.log(chalk.yellow('Demo users removed.'));
      await ChannelModel.deleteMany({}, {session});
      console.log(chalk.yellow('Demo channels removed.'));
      await ChannelUserMembershipModel.deleteMany({}, {session});
      console.log(chalk.yellow('Demo channel-user-memberships removed.'));
      await MessageModel.deleteMany({}, {session});
      console.log(chalk.yellow('Demo messages removed.'));


      await session.commitTransaction();
      console.log('Transaction comitted');
    }
    catch(err) {
      await session.abortTransaction();
      console.log('Transaction aborted');
      console.log(chalk.bgRed('Error'), err);
      throw err;
    }
    finally {
      await session.endSession();
      console.log('Session closed.');
      await disconnect();
      console.log(chalk.bgBlue('Connection closed.'));
    }
  }
};
