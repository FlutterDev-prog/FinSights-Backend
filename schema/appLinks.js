// db/models/appLinks.js

const mongoose = require('mongoose');

const applinksSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    fileId: { type: String, unique: true, required: true },
    platformName: { type: String, default: 'Android' },
    downloadLink: { type: String, required: true }
}, { timestamps: true });

const AppLinks = mongoose.model('applinks', applinksSchema);

module.exports = AppLinks;