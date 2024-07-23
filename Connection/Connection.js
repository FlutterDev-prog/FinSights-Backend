const mongoose = require('mongoose');
const config = require('config');

const connectDB = async () => {
    const dbURI = config.get('mongoURI'); // Ensure you have your MongoDB URI in your configuration file

    try {
        await mongoose.connect(dbURI);
        console.log('MongoDB connected successfully');
        return mongoose.connection; // Return the connection object
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
};

module.exports = connectDB;
