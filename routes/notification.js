const Notify = require('../schema/notification');
const Chats = require('../schema/Chats');
const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidV4 } = require("uuid");
const router = express.Router();

router.post('/notify/user', async (req, res) => {
    try {
        console.log(req.body);
        const notification = await Notify.createNotification(req.body.type, req.body.title, req.body.senderId, req.body.receiverId, req.body.message, false);
        if (!notification) return res.status(400).send('Request failed');
        res.status(201).send(notification);
    } catch (e) {
        res.status(500).send(e.message);
        console.log(e)
    }
});

router.get('/getNotications/:id', async (req, res) => {
    try {
        const notifications = await Notify.find({ receiverId: req.params.id });
        if (!notifications) return res.status(400).send('No notifications');
        res.status(200).send(notifications);
    } catch (e) {
        res.status(500).send(e.message);
        console.log(e)
    }
});

router.post('/request/decline/:id', async (req, res) => {
    try {
        const notifications = await Notify.findByIdAndDelete({ _id: req.params.id });
        if (!notifications) return res.status(400).send('No notifications');
        res.status(200).send({ notifications });
    } catch (e) {
        res.status(500).send(e.message);
        console.log(e)
    }
});

router.post('/request/accept/:id', async (req, res) => {
    try {
        const notification = await Notify.findByIdAndUpdate({ _id: req.params.id }, { status: true });
        await Notify.findByIdAndDelete({ _id: req.params.id });
        if (!notification) return res.status(400).send('Cannot Update');
        const senderObjectId = new mongoose.Types.ObjectId(notification.senderId);
        const receiverObjectId = new mongoose.Types.ObjectId(notification.receiverId);

        const roomId = uuidV4();
        const chat = await new Chats({
            receiverId: senderObjectId,
            senderId: receiverObjectId,
            roomId: roomId,
        }).save();
        if (!chat) return res.status(400).send('Chat not created');
        res.status(201).send(notification);
    } catch (e) {
        res.status(500).send(e.message);
        console.log(e)
    }
});

router.get('/request/clear/:id', async (req, res) => {
    try {
        const notification = await Notify.deleteMany({ receiverId: req.params.id })
        if (!notification) return res.status(400).send('Already cleared');
        res.status(200).send('Notifications Cleared');
    } catch (e) {
        res.status(500).send(e.message);
        console.log(e)
    }
});

module.exports = router;