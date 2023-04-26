const http = require('http');
const express = require('express');
const {Server: SocketServer} = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const coockieParse = require('cookie-parser');
const registerSocketHandler = require('./socket_handler/handler');
require('dotenv').config();

const {requireAuth} = require('./middlewares/authMiddleware');



const app = express();
const port = process.env.PORT;
const server = http.createServer(app);
const io = new SocketServer(server, {
    // TODO: split multiple allowed domains by space (in .env file) 
    cors: {
      origin: (process.env.ALLOWED_ORIGINS).split(' '),
      methods: ["HEAD", "GET", "POST", "PUT", "PATCH", "DELTE"]  // TODO: PUT, PATCH, DELETE
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
app.use(coockieParse()); // TODO: enable 'secure' and 'httpOnly' flag for jwt token coockie
app.use(cors({
    origin: (process.env.ALLOWED_ORIGINS).split(' '),
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
    res.json({message: 'Razi Informing Service'});
});
// TODO: add 404 message for other routes


// TODO: open socket connection only if user authenticated
// socket
registerSocketHandler(io);



// connect to db then start listening
mongoose.set('strictQuery', true);
mongoose.connect(process.env.DB_CONN_STR, {useNewUrlParser: true}).then(
    () => {
        console.log('connected to database');
        server.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });
    },
    err => {console.log('initial connection error: ', err)}
);
const db = mongoose.connection;
db.on('error', (error) => console.log("Error", error));



