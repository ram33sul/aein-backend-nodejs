import Messages from '../model/messageSchema.js'
import jwt from 'jsonwebtoken';
import axios from 'axios';
import mongoose from 'mongoose';
import Mood from '../model/moodSchema.js';

export const sendMessage = ({from, to, content, mood}) => {
    return new Promise(async (resolve, reject) => {
        try {
            if(!(from && to && content)){
                reject({message: "Message data is not complete!"});
                return;
            }
            if(from === to){
                reject({message: "sender and reciever cannot be same!"});
                return;
            }
            from = new mongoose.Types.ObjectId(from);
            to = new mongoose.Types.ObjectId(to);
            const data = await Messages.create({
                from: from,
                to: to,
                content,
                mood,
                sendAt: new Date()
            })
            resolve(data);
        } catch (error) {
            reject({message: "Internal error occured at sendMessage!"})
        }
    })
}

export const getMoods = () => {
    return new Promise((resolve, reject) => {
        try {
            Mood.find().then(response => {
                resolve(response)
            }).catch({message: "Database error at getMoods"})
        } catch (error) {
            reject({message: "Internal error at getMoods"})
        }
    })
}

export const getMessages = ({from, to, markSeen}) => {
    return new Promise(async (resolve, reject) => {
        let fromUserId = from;
        let toUserId = to;
        let { viewedUser, sentUser } = markSeen;
        if(!(fromUserId && toUserId)){
            reject({message: "Both from and to is required"});
        }
        sentUser = new mongoose.Types.ObjectId(sentUser);
        viewedUser = new mongoose.Types.ObjectId(viewedUser);
        fromUserId = new mongoose.Types.ObjectId(fromUserId);
        toUserId = new mongoose.Types.ObjectId(toUserId);
        try {
            await Messages.updateMany({
                "from": sentUser,
                "to": viewedUser,
                "seen": false
            },{
                $set: {
                    seen: true
                }
            }).then(async () => {
                await Messages.aggregate([
                    {
                        $match: {
                            $or: [{
                                "from": fromUserId,
                                "to": toUserId,
                                deletedUsers: {
                                    $nin: [viewedUser]
                                }
                            },{
                                "from": toUserId,
                                "to": fromUserId,
                                deletedUsers: {
                                    $nin: [viewedUser]
                                }
                            }]
                        }
                    }, {
                        $sort: {
                            sendAt: 1
                        }
                    }
                ]).then((messagesData) => {
                    resolve(messagesData);
                }).catch((error) => {
                    reject({message: "Database error occured!", error})
                });
            }).catch((error) => {
                reject({message: "Database error occured while updating!", error});
            })
        } catch (error) {
            reject({message: "Internal error occured!", error});
        }
    })
}

export const getOverallMessages = async (userId) => {
    return new Promise(async (resolve, reject) => {
        if(!userId){
            reject({message: "User id is required!"});
        }
        userId = new mongoose.Types.ObjectId(userId)
        try {
            await Messages.aggregate([
                {
                    $match: {
                        $or: [{
                            "from": userId,
                            deletedUsers: {
                                $nin: [userId]
                            }
                        },{
                            "to": userId,
                            deletedUsers: {
                                $nin: [userId]
                            }
                        }]
                    }
                }, {
                    $project: {
                        foreignId: {
                            $cond: [
                                {
                                    $eq: [
                                        "$from",
                                        userId
                                    ]
                                },
                                "$to",
                                "$from"
                            ]
                        },
                        content: 1,
                        mood: 1,
                        sendAt: 1,
                        seen: 1,
                        _id: 1,
                        to: 1,
                        from: 1,
                        type: 1,
                        isNewMessage: {
                            $cond: [
                                {
                                    $and: [
                                        {
                                            $eq: [
                                                "$to",
                                                userId
                                            ]
                                        },{
                                            $eq: [
                                                "$seen",
                                                false
                                            ]
                                        }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                },{
                    $sort: {
                        "sendAt": -1
                    }
                }, {
                    $group: {
                        _id: "$foreignId",
                        content: {
                            $first: "$content"
                        },
                        mood: {
                            $first: "$mood"
                        },
                        sendAt: {
                            $first: "$sendAt"
                        },
                        seen: {
                            $first: "$seen"
                        },
                        messageId: {
                            $first: "$_id"
                        },
                        to: {
                            $first: "$to"
                        },
                        from: {
                            $first: "$from"
                        },
                        newMessageCount: {
                            $sum: "$isNewMessage"
                        },
                        type: {
                            $first: "$type"
                        }
                    }
                }, {
                    $sort: {
                        _id: 1
                    }
                }
            ]).then(async (messageData) => {
                let foreignIds = [];
                messageData.forEach((message) => {
                    foreignIds[foreignIds.length] = message._id;
                })
                await axios.post(`${process.env.USER_SERVICE}/usersDetailsFromArray`, { usersList: foreignIds, userId }).then((response) => {
                    messageData = messageData.map((message, index) => {
                        return {...message, foreignUser: response.data[index]}
                    }).filter((message) => {
                        return message.foreignUser.blockedStatus === false;
                    }).sort((a,b) => {
                        return b.sendAt - a.sendAt
                    })
                    resolve(messageData);
                }).catch((error) => {
                    reject(error);
                })
            }).catch((error) => {
                reject({message: "Database error occured!"});
            });

        } catch (error) {
            reject({message: "Internal error occured!", error});
        }
    })
}

export const doMarkSeen = ({viewedUser, sentUser}) => {
    return new Promise(async (resolve, reject) => {
        try {
            if(!(viewedUser && sentUser)){
                reject({message: "Viewed and sent users are required!"});
                return;
            }
            sentUser = new mongoose.Types.ObjectId(sentUser);
            viewedUser = new mongoose.Types.ObjectId(viewedUser);
            await Messages.updateMany({
                "from": sentUser,
                "to": viewedUser,
                "seen": false
            },{
                $set: {
                    seen: true
                }
            }).then(async () => {
                await Messages.aggregate([
                    {
                        $match: {
                            $or: [{
                                "from": viewedUser,
                                "to": sentUser,
                                deletedUsers: {
                                    $nin: [sentUser]
                                }
                            },{
                                "from": sentUser,
                                "to": viewedUser,
                                deletedUsers: {
                                    $nin: [sentUser]
                                }
                            }]
                        }
                    }, {
                        $sort: {
                            sendAt: 1
                        }
                    }
                ]).then((messagesData) => {
                    resolve(messagesData);
                }).catch((error) => {
                    reject({message: "Database error occured!", error})
                }); 
            }).catch((error) => {
                reject({message: "Database error at doMarkSeen!"});
            })
        } catch (error) {
            reject({message: "Internal error occured at doMarkSeen!"});
        }
    }) 
}

export const verifyUserService = (cookie, queryToken) => {
    return new Promise(async (resolve, reject) => {
        try {
            let token = queryToken;
            if(cookie){
                function cookieToObject(cookieStr) {
                    const cookieArr = cookieStr.split("; ");
                    const cookieObj = {};
                
                    cookieArr.forEach((pair) => {
                    const [key, value] = pair.split("=");
                    cookieObj[key] = value;
                    });
                
                    return cookieObj;
                }
                let cookieAsObject = cookieToObject(cookie);
                token = cookieAsObject["aein-app-jwtToken"];
            }
            if(!token){
                reject(false);
                return;
            }
            jwt.verify(token, process.env.TOKEN_KEY, async (error, data) => {
                if(error) {
                    reject(false);
                } else {
                    resolve(data?.userId ?? data?.id);
                }
            });
        } catch (error) {
            reject(false);
        }
    })
}

export const deleteMessages = ({messages, userId}) => {
    return new Promise(async (resolve, reject) => {
        try {
            if(!messages){
                reject({message: "List of messages is missing!"});
                return;
            }
            messages = messages.map((message) => new mongoose.Types.ObjectId(message._id));
            userId = new mongoose.Types.ObjectId(userId)
            await Messages.updateMany({
                _id: {
                    $in: messages
                }
            },{
                $push: {
                    deletedUsers: userId
                }
            }).then(() => {
                resolve(true)
            }).catch((error) => {
                reject({message: "Database error occured!"})
            })
        } catch (error) {
            reject({message: "Internal error occured!"});
        }
    })
}

export const shareService = ({userId, toUserId, content, messageType}) => {
    return new Promise((resolve, reject) => {
        try {
            console.log(content, messageType, userId, toUserId);
            if(!(content && messageType && userId && toUserId)){
                reject({message: "data, userId and toUserId is required!"});
                return;
            }
            const from = new mongoose.Types.ObjectId(userId);
            const to = new mongoose.Types.ObjectId(toUserId);
            content = new mongoose.Types.ObjectId(content);
            Messages.create({
                from,
                to,
                content,
                type: messageType,
                sendAt: new Date()
            }).then((response) => {
                console.log(response);
                resolve(response)
            }).catch((error) => {
                reject({message: "Database error at shareService!"})
            })
        } catch (error) {
            console.log(error);
            reject({message: "Internal error at shareService!"})
        }
    })
}