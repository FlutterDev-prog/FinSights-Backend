const mongoose = require('mongoose');
const config = require('config');

const dbURI = config.get('mongoURI'); // Get the MongoDB URI from config

const connectDB = () => {
    return new Promise((resolve, reject) => {
        mongoose.connect(dbURI)
            .then(() => {
                console.log('MongoDB connected');
                resolve(mongoose.connection); // Resolve with the mongoose connection
            })
            .catch(err => {
                console.error('MongoDB connection error:', err);
                reject(err); // Reject with the error
            });
    });
}

module.exports = connectDB;
