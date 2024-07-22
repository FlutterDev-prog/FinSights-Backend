const mongoose = require("mongoose");
const User = require("../schema/users");
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    type: {
        type: String,
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true
    },
    senderName: {
        type: String,
        required: true
    },
    receiverName: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    status: {
        type: Boolean,
        default: false,
    },
    senderTokens: [
        {
            type: String,
            required: true
        }
    ],
    receiverTokens: [
        {
            type: String,
            required: true
        }
    ]
}, { timestamps: true });

NotificationSchema.statics.createNotification = async (type, title, senderId, receiverId, message, status) => {
    try {
        // Fetch sender and receiver user details
        const sender = await User.findById(senderId).select('firstName tokens');
        const receiver = await User.findById(receiverId).select('firstName tokens');

        // Check if sender and receiver are found
        if (!sender) {
            throw new Error(`Sender with ID ${senderId} not found`);
        }
        if (!receiver) {
            throw new Error(`Receiver with ID ${receiverId} not found`);
        }

        // Create the notification
        const senderDeviceTokens = [...new Set(sender.tokens.map(tokenObj => tokenObj.deviceToken))];
        const receiverDeviceTokens = [...new Set(receiver.tokens.map(tokenObj => tokenObj.deviceToken))];

        // Create the notification
        const notification = new Notification({
            type,
            senderId,
            receiverId,
            title,
            message,
            senderName: sender.firstName,
            receiverName: receiver.firstName,
            status: status,
            senderTokens: senderDeviceTokens,
            receiverTokens: receiverDeviceTokens
        });

        // Save the notification
        const savedNotification = await notification.save();
        console.log('Notification created:', savedNotification);
        return savedNotification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;
