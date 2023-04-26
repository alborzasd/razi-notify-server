module.exports = (io) => {

    io.on('connection', (socket) => {
        // console.log(`socket id: ${socket.id} connected`);
    
        socket.on('request_to_join_room', ({channel_id})=>{
            // console.log(`socket ${socket.id} requested to join ${channel_id}`);
            socket.join(channel_id);
        })
    
        socket.on('disconnect', () => {
            // console.log(`socket id: ${socket.id} disconnected`);
        })
        socket.on("connect_error", (err) => {
            // console.log(`connect_error due to ${err.message}`);
        });
    });
    io.of("/").adapter.on("join-room", (room, id) => {
        // console.log(`socket ${id} has joined room ${room}`);
    });
    
}