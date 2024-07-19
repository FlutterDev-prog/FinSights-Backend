const usersWithoutChat = async ({senderObjectId}) => {
    await Chats.aggregate([
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
                _id: 0,
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
        },
        {
            $lookup: {
                from: 'users',
                localField: 'uniqueUsers',
                foreignField: '_id',
                as: 'users'
            }
        },
        {
            $unwind: '$users'
        },
        {
            $limit: 10
        },
        {
            $group: {
                _id: null,
                users: {
                    $push: '$users'
                }
            }
        }
    ]);
}
module.exports = { addUser };