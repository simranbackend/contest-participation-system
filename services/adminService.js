const Contest = require('../models/Contest.js');
const Participation = require('../models/Participation.js');

async function createContest(req, res) {
  try {
    const contestData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const contest = await Contest.create(contestData);

    res.status(201).json({
      success: true,
      message: "Contest created successfully",
      data: {
        contest: {
          id: contest._id,
          name: contest.name,
          description: contest.description,
          type: contest.type,
          startTime: contest.startTime,
          endTime: contest.endTime,
          prizeInfo: contest.prizeInfo,
          status: contest.status,
          maxParticipants: contest.maxParticipants,
          createdAt: contest.createdAt,
        },
      },
    });
  } catch (error) {
    console.log("Create Contest Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getContest(req, res) {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const contests = await Contest.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contest.countDocuments(filter);

    res.json({
      success: true,
      data: {
        contests,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.log("Get Contest Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getContestById(req, res) {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("questions");

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    // Get participation statistics
    const participationStats = await Participation.aggregate([
      { $match: { contestId: contest._id } },
      {
        $group: {
          _id: null,
          totalParticipants: { $sum: 1 },
          completedSubmissions: { $sum: { $cond: ["$isCompleted", 1, 0] } },
          averageScore: { $avg: "$score" },
          highestScore: { $max: "$score" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        contest,
        statistics: participationStats[0] || {
          totalParticipants: 0,
          completedSubmissions: 0,
          averageScore: 0,
          highestScore: 0,
        },
      },
    });
  } catch (error) {
    console.log("Get Contest By Id Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function updateContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    // Check if contest has started and prevent certain updates
    const now = new Date();
    if (now >= contest.startTime) {
      // If contest has started, only allow certain fields to be updated
      const allowedUpdates = ["description", "prizeInfo", "maxParticipants"];
      const updates = {};

      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
        success: false,
        message: "Cannot update contest after it has started"
      });
      }

      Object.assign(contest, updates);
    } else {
      // Contest hasn't started, allow all updates
      Object.assign(contest, req.body);
    }

    await contest.save();

    res.json({
      success: true,
      message: "Contest updated successfully",
      data: { contest },
    });
  } catch (error) {
    console.log("Create Contest Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function deleteContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    // Check if contest has participants
    const participationCount = await Participation.countDocuments({
      contestId: contest._id,
    });
    if (participationCount > 0) {
      return res.status(400).json({
        success: false,
        message: 
        "Cannot delete contest with existing participants"
      });
    }

    await Contest.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Contest deleted successfully",
    });
  } catch (error) {
    console.log("Delete Contest Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function addQuestion(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    // Check if contest has started
    const now = new Date();
    if (now >= contest.startTime) {
      return res.status(400).json({
        success: false,
        message: 
        "Cannot add questions to contest after it has started"
    });
    }

    // Validate question based on type
    const { questionText, type, options, points } = req.body;

    if (type === "true-false" && options.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 
        "True/False questions must have exactly 2 options"
    });
    }

    if (
      type === "single-select" &&
      options.filter((opt) => opt.isCorrect).length !== 1
    ) {
      return res.status(400).json({
        success: false,
        message: 
        "Single-select questions must have exactly one correct option"
    });
    }

    if (options.filter((opt) => opt.isCorrect).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Question must have at least one correct option"
    });
    }

    // Add question to contest
    contest.questions.push({
      questionText,
      type,
      options,
      points: points || 1,
    });

    await contest.save();

    const addedQuestion = contest.questions[contest.questions.length - 1];

    res.status(201).json({
      success: true,
      message: "Question added successfully",
      data: {
        question: addedQuestion,
        totalQuestions: contest.questions.length,
      },
    });
  } catch (error) {
    console.log("Add Question Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function editQuestion(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);
    const questionIndex = parseInt(req.params.questionIndex);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    if (questionIndex < 0 || questionIndex >= contest.questions.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid question index"
    });
    }

    // Check if contest has started
    const now = new Date();
    if (now >= contest.startTime) {
      return res.status(400).json({
        success: false,
        message: "Cannot update questions after contest has started"
    });
    }

    // Update question
    contest.questions[questionIndex] = {
      questionText: req.body.questionText,
      type: req.body.type,
      options: req.body.options,
      points: req.body.points || 1,
    };

    await contest.save();

    res.json({
      success: true,
      message: "Question updated successfully",
      data: {
        question: contest.questions[questionIndex],
      },
    });
  } catch (error) {
    console.log("Edit Question Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function deleteQuestion(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);
    const questionIndex = parseInt(req.params.questionIndex);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    if (questionIndex < 0 || questionIndex >= contest.questions.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid question index"
    });
    }

    // Check if contest has started
    const now = new Date();
    if (now >= contest.startTime) {
      return res.status(400).json({
        success: false,
        message: 
        "Cannot delete questions after contest has started"
    });
    }

    // Remove question
    contest.questions.splice(questionIndex, 1);
    await contest.save();

    res.json({
      success: true,
      message: "Question deleted successfully",
      data: {
        totalQuestions: contest.questions.length,
      },
    });
  } catch (error) {
    console.log("Create Contest Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getLeaderboard(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    const leaderboard = await Participation.find({ contestId: contest._id })
      .populate("userId", "name email")
      .sort({ score: -1, submittedAt: 1 })
      .select("userId score correctAnswers wrongAnswers submittedAt timeSpent");

    // Add rank to each participant
    leaderboard.forEach((participant, index) => {
      participant.rank = index + 1;
    });

    res.json({
      success: true,
      data: {
        contest: {
          id: contest._id,
          name: contest.name,
          status: contest.status,
        },
        leaderboard,
      },
    });
  } catch (error) {
    console.log("Get Leaderboard Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function changeStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ["UPCOMING", "ONGOING", "ENDED"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 
        "Invalid status. Must be UPCOMING, ONGOING, or ENDED"
    });
    }

    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found"
    });
    }

    contest.status = status;
    await contest.save();

    res.json({
      success: true,
      message: "Contest status updated successfully",
      data: { contest },
    });
  } catch (error) {
    console.log("Create Contest Error: ", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

module.exports = {
    createContest,
    getContest,
    getContestById,
    updateContest,
    deleteContest,
    addQuestion,
    editQuestion,
    deleteQuestion,
    getLeaderboard,
    changeStatus
}
