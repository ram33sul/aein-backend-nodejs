import express from 'express';
import auth from '../authentication/auth.js';
import {
    addPost,
    doDislikePost,
    doLikePost,
    doSendReply,
    doUndislikePost,
    doUnlikePost,
    getComments,
    getExplorePosts,
    getPostDetails,
    getPosts,
    getPostsByUser,
    getPostsCount,
    getReplies,
    postComment
} from '../controllers/postController.js';

const router = express.Router();

router.use(auth);

router.post('/addPost', addPost);

router.get('/getPosts', getPosts);

router.get('/getExplorePosts', getExplorePosts);

router.get('/getPostsByUser', getPostsByUser);

router.patch('/likePost', doLikePost);

router.patch('/unlikePost', doUnlikePost);

router.patch('/dislikePost', doDislikePost);

router.patch('/undislikePost', doUndislikePost);

router.get('/postDetails', getPostDetails);

router.get('/comments', getComments);

router.post('/comment', postComment);

router.get('/replies', getReplies);

router.post('/sendReply', doSendReply)

router.get('/postsCount', getPostsCount);

export default router;