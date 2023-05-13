const http = require('http');
const express = require('express');
const {Server: SocketServer} = require('socket.io');
const chalk = require('chalk');

const mongoose = require('mongoose');
const {connect} = require('./mongoose-connection');

const cors = require('cors');
const coockieParser = require('cookie-parser');

const registerSocketHandler = require('./socket_handler/handler');
// require('dotenv').config();
const {allowedOrigins, port} = require('./config');

const {requireAuth} = require('./middlewares/authMiddleware');



const app = express();
// const port = process.env.PORT;
const server = http.createServer(app);
const io = new SocketServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["HEAD", "GET", "POST", "PUT", "PATCH", "DELTE"]
    }
});


// middlewares
// app.use((req, res, next) => {
//     req.io = io;
//     return next();
// })
app.set('socket_instance', io);
// TODO: use api to get messages files (image, pdf, ...) with proper http response headers (instead of using public folder)(the url route to get the file is not same as the address of where the file is stored in server) 
// app.use(express.static('public')); // TODO: use static for react build files?
app.use(express.json()); // use request json body
app.use(coockieParser()); // TODO: enable 'secure' and 'httpOnly' flag for jwt token coockie
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
// app.use(cors({
//     // origin: [process.env.CORS_FRONTEND_HOST]
//     origin: '*'
// }));

// router
app.use('/auth', require('./routes/auth'));
app.use('/users', requireAuth, require('./routes/users'));
app.use('/channels', requireAuth, require('./routes/channels'));

app.get('/', (req, res) => {    
    res.json({message: 'Razi Notify Api'});
});
// TODO: add 404 message for other routes


// TODO: open socket connection only if user authenticated
// socket
registerSocketHandler(io);



// connect to db then start listening
connect().then(
    () => {
        console.log(chalk.bgBlue('Connected to database'));
        server.listen(port, () => {
            console.log(chalk.bgBlue(`Server listening on port ${port}`));
        });
    },
    err => {console.log(chalk.bgRed('Initial connection error: '), err)}
);
mongoose.connection.on('error', (error) => console.log(chalk.bgRed("Mongoose connection Error"), error));
mongoose.connection.on('disconnected', () => console.log(chalk.bgRed("Mongoose disconnected ")));



