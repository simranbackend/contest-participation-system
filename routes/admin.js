const express = require('express');
const { authenticate, adminOnly } = require('../middleware/auth');
const { validateCreateContest, validateUpdateContest, validateAddQuestion } = require('../middleware/validation');
const { createContest,getContest, getContestById, updateContest, deleteContest, addQuestion, editQuestion, deleteQuestion, getLeaderboard, changeStatus } = require('../services/adminService.js');

const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(authenticate);
router.use(adminOnly);

router.post('/contest/create', validateCreateContest, createContest);

router.get('/contests', getContest);

router.get('/contest/:id', getContestById);

router.put('/contest/:id/update', validateUpdateContest, updateContest);

router.delete('/contest/:id', deleteContest);

router.post('/contest/:id/question/add', validateAddQuestion, addQuestion);

router.put('/contest/:id/question/:questionIndex', validateAddQuestion, editQuestion);

router.delete('/contest/:id/question/:questionIndex', deleteQuestion);

router.get('/contest/:id/leaderboard', getLeaderboard);

router.put('/contest/:id/status', changeStatus);

module.exports = router;
