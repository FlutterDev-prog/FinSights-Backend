// appLinks.js

const express = require('express');
const AppInfo = require('../schema/appLinks');

const router = express.Router();
router.get('/apks', async (req, res) => {
    try {
        const result = await AppInfo.find().sort({ createdAt: -1 });
        if (!result) throw new Error("No Release Yet!!")
        res.status(200).send(result);
    } catch (e) {
        res.status(400).send({ error: e.message });
        console.log("Error1", e);
    }
}, (err, req, res, next) => {
    res.status(400).send({ error: err.message });
    console.log("Error2", err);
});

module.exports = router;
