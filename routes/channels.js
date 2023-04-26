const express = require('express');
const {model: ChannelModel} = require('../models/Channel');
const {model: MessageModel} = require('../models/Message');
const router = express.Router();

// get all channels
router.get('/', async (req, res) => {
    try {
        const channels = await ChannelModel.find();
        res.send(channels);
        // setTimeout(() => res.send(channels), 5000); // TODO: remove timeout for production server
        // setTimeout(() => res.json([]), 5000); // empty response handling in front-end
    }
    catch (err) {
        res.status(500).json({message: err.message});
    }
});

// get one channel
router.get('/:id', getChannel, (req, res) => {
    res.send(res.channel);
});

// create one channel
router.post('/', async (req, res) => {
    const channel = new ChannelModel({
        identifier: req.body.identifier,
        title: req.body.title,
        description: req.body.description,
        profile_image_url: req.body.profile_image_url
    })
    try {
        const newChannel = await channel.save();
        res.status(201).json(newChannel); // 201: successfully created object
    }
    catch(err) {
        res.status(400).json({message: err.message}); // user has sent bad data (ie: required validation error)
    }
});

// update one channel
router.patch('/:id', getChannel, async (req, res) => {
    // console.log(req.body.identifier); // TODO: WTF undefined !== undefined
    if(req.body.identifier !== null && req.body.identifier !== undefined){
        res.channel.identifier = req.body.identifier;
    }
    if(req.body.title !== null && req.body.title !== undefined){
        res.channel.title = req.body.title;
    }
    if(req.body.description !== null && req.body.description !== undefined){
        res.channel.description = req.body.description;
    }
    if(req.body.profile_image_url !== null && req.body.profile_image_url !== undefined){
        res.channel.profile_image_url = req.body.profile_image_url;
    }

    try {
        const updatedChannel = await res.channel.save();
        res.json(updatedChannel);
    }
    catch(err) {
        res.status(400).json({message: err.message});
    }
});

// delete one channel
router.delete('/:id', getChannel, async (req, res) => {
    try {
        await res.channel.remove();
        res.json({message: 'Channel deleted successfully'});
    }
    catch(err) {
        res.status(500).json({message: err.message});
    }
});


async function getChannel (req, res, next) {
    let channel;
    try {
        channel = await ChannelModel.findById(req.params.id);
        if(channel == null) {
            // return do not excute top level catch ?  
            return res.status(404).json({message: `There is no channel with id: ${req.params.id}`})
        }
    }
    catch(err) {
        return res.status(500).json({message: err.message});
    }

    res.channel = channel;
    next();
};



// message routes

// get all meesages from one channel (by descending createdAt order)
// if cursor id is given in query parameters: get all messages before cursor id
// if limit is given in query parameters: get all meesages with limit value
router.get('/:id/messages', getChannel, async(req, res) => {
    try {
        let messages = MessageModel.find({channel_id: req.params.id});
        if(req.query.cursor) {
            messages = messages.where({_id: {$lt: req.query.cursor}});
        }
        if(req.query.limit) {
            messages = messages.limit(req.query.limit);
        }
        messages = await messages.sort({createdAt: -1});
        res.send(messages);
        // setTimeout(() => res.send(messages), 4000); // TODO: remove timeout 4000, 10000
        // setTimeout(() => res.send([]), 4000); // TODO: remove
    }
    catch (err) {
        res.status(500).json({message: err.message});
    }
})


// creaet one message for one channel
router.post('/:id/messages', getChannel, async(req, res) => {
    const message = new MessageModel({
        body: req.body.body,
        channel_id: req.params.id
    });
    try {
        const newMessage = await message.save();
        let io = req.app.get('socket_instance');
        io.to(req.params.id).emit('new_message_from_server', newMessage);
        res.status(201).json(newMessage);
        // setTimeout(() => {
        //     let io = req.app.get('socket_instance');
        //     io.to(req.params.id).emit('new_message_from_server', newMessage);
        //     // req.io.to(req.params.id).emit('new_message_from_server', newMessage);
        //     res.status(201).json(newMessage)
        // }, 5000); // TODO: remove timeout
    }
    catch (err) {
        res.status(400).json({message: err.message});
    }
});



module.exports = router;
