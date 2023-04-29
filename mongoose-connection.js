const mongoose = require('mongoose');
const {dbConnectionStr} = require('./config');

mongoose.set('strictQuery', true);

const connect = () => {
    return mongoose.connect(dbConnectionStr, {
        useNewUrlParser: true, 
        useUnifiedTopology: true
    });
};
const disconnect = () => mongoose.disconnect();

module.exports = {
    connect,
    disconnect
}