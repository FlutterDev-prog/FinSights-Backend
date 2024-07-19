const Chats = require("../schema/Chats");
const { v4: uuidV4 } = require("uuid");
const mongoose = require('mongoose');

const addUser = ({ receiverId, senderId }, socket) => {
    if (!senderId || !receiverId) {
        return {
            error: "You tried to add zero chat"
        };
    }
    const users = { receiverId, senderId };
    console.log(users);

    // Convert string IDs to ObjectId
    const senderObjectId = new mongoose.Types.ObjectId(senderId);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

    Chats.aggregate([
        {
            $match: {
                $or: [
                    { senderId: senderObjectId, receiverId: receiverObjectId },
                    { senderId: receiverObjectId, receiverId: senderObjectId }
                ]
            }
        }
    ]).then((chat) => {
        if (chat.length > 0) {
            // If chat exists, return the existing chat
            socket.emit('openChat', { ...chat[0] });
        } else {
            // If no chat found, create a new chat room
            const newRoomId = uuidV4();
            const newChat = {
                senderId: senderObjectId,
                receiverId: receiverObjectId,
                roomId: newRoomId,
                updatedAt: Date.now() // Ensure updatedAt is set
            };

            socket.emit('openChat', { ...newChat });
            new Chats(newChat).save().catch((error) => {
                console.error('Error saving new chat:', error);
            });
        }
    }).catch((error) => {
        console.error('Error adding user to chat:', error);
    });
};

module.exports = { addUser };
