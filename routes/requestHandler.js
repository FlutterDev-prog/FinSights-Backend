// Request Handeling api

const usersWithoutChat = require('../helpers/getUsers');
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/users/request-to-user/:id', async (req, res) => {
    try {
        const idParam = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(idParam)) {
            return res.status(400).send({ error: 'Invalid ObjectId format' });
        }
        const testObjectId = new mongoose.Types.ObjectId(idParam);
        console.log('Received ID:', testObjectId);
        const userList = await usersWithoutChat({ senderId: testObjectId });
        console.log('User List:', userList);
        if (!userList || userList.length === 0) {
            return res.status(404).send({ error: 'No users found without chat' });
        }
        res.status(200).send({ userList });
    } catch (e) {
        console.error('Error:', e);
        res.status(400).send({ error: e.message });
    }
});

module.exports = router;