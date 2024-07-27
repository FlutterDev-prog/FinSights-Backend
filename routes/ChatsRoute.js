const Chats = require('../schema/Chats');
const Messages = require('../schema/Messages');
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();

router.post('/fetch/chats/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      console.log('Fetching chats for userId:', userId);
  
      const chatRooms = await Chats.aggregate([
        {
          $match: {
            $or: [
              { senderId: new mongoose.Types.ObjectId(userId) },
              { receiverId: new mongoose.Types.ObjectId(userId) }
            ]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'senderId',
            foreignField: '_id',
            as: 'senderDetails'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'receiverId',
            foreignField: '_id',
            as: 'receiverDetails'
          }
        },
        {
          $addFields: {
            otherUserDetails: {
              $cond: {
                if: { $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] },
                then: { $arrayElemAt: ['$receiverDetails', 0] },
                else: { $arrayElemAt: ['$senderDetails', 0] }
              }
            }
          }
        },
        {
          $lookup: {
            from: 'messages',
            let: { roomId: '$roomId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$roomId', '$$roomId'] },
                      { $eq: ['$receiverId', new mongoose.Types.ObjectId(userId)] },
                      { $eq: ['$read', false] }
                    ]
                  }
                }
              }
            ],
            as: 'unreadMessages'
          }
        },
        {
          $addFields: {
            unreadMessageCount: { $size: '$unreadMessages' }
          }
        },
        {
          $project: {
            _id: 1,
            roomId: 1,
            senderId: 1,
            receiverId: 1,
            updatedAt: 1,
            lastMessage: 1,
            otherUserDetails: {
              _id: '$otherUserDetails._id',
              firstName: '$otherUserDetails.firstName',
              userName: '$otherUserDetails.userName',
              email: '$otherUserDetails.email',
              phone: '$otherUserDetails.phone',
              isActive: '$otherUserDetails.isActive',
              isGoogleAccount: '$otherUserDetails.isGoogleAccount',
              blockedUsers: '$otherUserDetails.blockedUsers',
              createdAt: '$otherUserDetails.createdAt',
              updatedAt: '$otherUserDetails.updatedAt',
              __v: '$otherUserDetails.__v'
            },
            unreadMessageCount: {
              $cond: {
                if: { $eq: ['$receiverId', new mongoose.Types.ObjectId(userId)] },
                then: '$unreadMessageCount',
                else: 0
              }
            }
          }
        },
        {
          $sort: { updatedAt: -1 }
        }
      ]);
  
      console.log('Aggregated chat rooms:', JSON.stringify(chatRooms, null, 2));
  
      if (!chatRooms) return res.status(400).send([]);
  
      res.status(200).send(chatRooms);
    } catch (e) {
      res.status(500).send(e.message);
      console.error(e);
    }
  });
  
  module.exports = router