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
            },
            {
                $project: {
                    _id: 0,
                    uniqueUsers: 1
                }
            }
        ]);

        const uniqueChatUsers = chatUsers.length > 0 ? chatUsers[0].uniqueUsers : [];

        // Step 2: Find users who are not in the chat list and not the sender
        const usersList = await User.find({
            _id: { $nin: uniqueChatUsers.concat(senderObjectId) }
        })
        .limit(10)
        .select('_id');

        const userIds = usersList.map(user => user._id);

        // Step 3: Find users who have already been notified
        const notifiedUsers = await Notification.find({
            $or: [
                { senderId: senderObjectId, receiverId: { $in: userIds } },
                { receiverId: senderObjectId, senderId: { $in: userIds } }
            ]
        })
        .select('senderId receiverId');

        const notifiedUserIds = new Set();
        notifiedUsers.forEach(notification => {
            notifiedUserIds.add(notification.senderId.toString());
            notifiedUserIds.add(notification.receiverId.toString());
        });

        // Step 4: Filter out notified users from the user list
        const filteredUsers = usersList.filter(user => !notifiedUserIds.has(user._id.toString()));
        const uniqueUsers = await User.find({ _id: { $in: filteredUsers.map(user => user._id) } });

        return uniqueUsers;
    } catch (e) {
        console.error(e);
        throw new Error('Error during aggregation');
    }
};

module.exports = usersWithoutChat;
