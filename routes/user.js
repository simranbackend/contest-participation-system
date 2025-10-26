const express = require('express');
const { authenticate, optionalAuth, userOrAbove } = require('../middleware/auth');
const { validateSubmitAnswers } = require('../middleware/validation');
const { allContest, contestById, joinContest, submitContest, contestLeaderboard, history,prizes } = require('../services/userService.js');

const router = express.Router();

router.get('/contest/all', optionalAuth, allContest);

router.get('/contest/:id', optionalAuth, contestById);

router.post('/contest/:id/join', authenticate, userOrAbove, joinContest);

router.post('/contest/:id/submit', authenticate, userOrAbove, validateSubmitAnswers, submitContest);

router.get('/contest/:id/leaderboard', optionalAuth, contestLeaderboard);

router.get('/history', authenticate, history);

router.get('/prizes', authenticate, prizes);

module.exports = router;
