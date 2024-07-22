const mongoose = require('mongoose');
const Chats = require('../schema/Chats');
const Notification = require('../schema/notification'); // Assuming the Notifications schema
const User = require('../schema/users'); // Assuming you have a User schema

const usersWithoutChat = async ({ senderId }) => {
    try {
        const senderObjectId = new mongoose.Types.ObjectId(senderId);

        // Step 1: Find all unique users involved in chats with the sender
        const chatUsers = await Chats.aggregate([
            {
                $match: {
                    $or: [
                        { senderId: senderObjectId },
                        { receiverId: senderObjectId }
                    ]
                }
            },
            {
                $project: {
                    senderId: 1,
                    receiverId: 1
                }
            },
            {
                $group: {
                    _id: null,
                    uniqueUsers: {
                        $addToSet: {
                            $cond: {
                                if: { $eq: ['$senderId', senderObjectId] },
                                then: '$receiverId',
                                else: '$senderId'
                            }
                        }
                    }
                }
            }
        ]);

        const uniqueChatUsers = chatUsers.length > 0 ? chatUsers[0].uniqueUsers : [];

        const usersList = await User.find({
            _id: { $nin: uniqueChatUsers },
            _id: { $ne: senderObjectId }
        }).limit(10).select('_id');

        const userIds = usersList.map(user => user._id);
        const notifiedUsers = await Notification.find({
            $or: [
                { senderId: senderObjectId, receiverId: { $in: userIds } },
                { receiverId: senderObjectId, senderId: { $in: userIds } }
            ]
        }).select('senderId receiverId');
        const notifiedUserIds = notifiedUsers.reduce((ids, notification) => {
            ids.add(notification.senderId.toString());
            ids.add(notification.receiverId.toString());
            return ids;
        }, new Set());

        const filteredUsers = usersList.filter(user => !notifiedUserIds.has(user._id.toString()));
        const uniqueUsers = await User.find({ _id: { $in: filteredUsers.map(user => user._id) } });

        return uniqueUsers;
    } catch (e) {
        console.error(e);
        throw new Error('Error during aggregation');
    }
};

module.exports = usersWithoutChat;
