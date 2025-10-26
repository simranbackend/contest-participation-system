const Contest = require("../models/Contest.js");
const Participation = require("../models/Participation.js");
const Prize = require("../models/Prize.js");

async function allContest(req, res) {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;

    // Build filter based on user role
    let filter = { isActive: true };

    if (status) filter.status = status;

    // Role-based contest type filtering
    if (type) {
      if (req.user) {
        // Authenticated users can see contests based on their role
        if (req.user.role === "admin") {
          filter.type = type; // Admin can see all types
        } else if (req.user.role === "vip") {
          filter.type = type; // VIP users can see all types
        } else if (req.user.role === "normal") {
          filter.type = type === "VIP" ? "NORMAL" : type; // Normal users can only see NORMAL contests
        }
      } else {
        // Guest users can only see NORMAL contests
        filter.type = type === "VIP" ? "NORMAL" : type;
      }
    } else {
      // If no type specified, filter based on user role
      if (!req.user || req.user.role === "normal") {
        filter.type = "NORMAL"; // Normal users and guests can only see NORMAL contests
      }
      // VIP users and admins can see all contests
    }

    const contests = await Contest.find(filter)
      .select("-questions") // Don't include questions in list view
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contest.countDocuments(filter);

    // Add participation status for authenticated users
    if (req.user) {
      const contestIds = contests.map((contest) => contest._id);
      const participations = await Participation.find({
        userId: req.user._id,
        contestId: { $in: contestIds },
      });

      const participationMap = {};
      participations.forEach((participation) => {
        participationMap[participation.contestId.toString()] = {
          hasJoined: true,
          isCompleted: participation.isCompleted,
          score: participation.score,
          rank: participation.rank,
        };
      });

      contests.forEach((contest) => {
        contest.participationStatus = participationMap[
          contest._id.toString()
        ] || {
          hasJoined: false,
          isCompleted: false,
          score: null,
          rank: null,
        };
      });
    }

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
    console.log("allContest Error", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function contestById(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found",
      });
    }

    if (!contest.isActive) {
      return res.status(400).json({
        success: false,
        message: "Contest is not active",
      });
    }

    // Check access based on user role and contest type
    if (contest.type === "VIP") {
      if (!req.user || (req.user.role !== "vip" && req.user.role !== "admin")) {
        return res.status(400).json({
          success: false,
          message:
            "Access denied. VIP contests are only available to VIP users",
        });
      }
    }

    // Check if user has already participated
    let participation = null;
    if (req.user) {
      participation = await Participation.findOne({
        userId: req.user._id,
        contestId: contest._id,
      });
    }

    // Don't include questions if contest hasn't started or user hasn't joined
    const now = new Date();
    const contestData = {
      id: contest._id,
      name: contest.name,
      description: contest.description,
      type: contest.type,
      startTime: contest.startTime,
      endTime: contest.endTime,
      prizeInfo: contest.prizeInfo,
      status: contest.status,
      maxParticipants: contest.maxParticipants,
      currentParticipants: contest.currentParticipants,
      createdAt: contest.createdAt,
    };

    // Include questions only if:
    // 1. User has joined the contest, OR
    // 2. Contest has ended (for viewing results)
    if (participation || now > contest.endTime) {
      contestData.questions = contest.questions;
      contestData.totalQuestions = contest.questions.length;
    }

    if (participation) {
      contestData.participation = {
        hasJoined: true,
        joinedAt: participation.joinedAt,
        submittedAt: participation.submittedAt,
        isCompleted: participation.isCompleted,
        score: participation.score,
        rank: participation.rank,
        answers: participation.answers,
      };
    } else {
      contestData.participation = {
        hasJoined: false,
        canJoin:
          now >= contest.startTime &&
          now <= contest.endTime &&
          contest.status === "ONGOING",
      };
    }

    res.json({
      success: true,
      data: { contest: contestData },
    });
  } catch (error) {
    console.log("contestById Error", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function joinContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found",
      });
    }

    if (!contest.isActive) {
      return res.status(400).json({
        success: false,
        message: "Contest is not active",
      });
    }

    // Check access based on user role and contest type
    if (
      contest.type === "VIP" &&
      req.user.role !== "vip" &&
      req.user.role !== "admin"
    ) {
      return res.status(400).json({
        success: false,
        message: "Access denied. VIP contests are only available to VIP users",
      });
    }

    // Check if user has already joined
    const existingParticipation = await Participation.findOne({
      userId: req.user._id,
      contestId: contest._id,
    });

    if (existingParticipation) {
      return res.status(400).json({
        success: false,
        message: "You have already joined this contest",
      });
    }

    // Check contest timing
    const now = new Date();
    // console.log("nowwwwww", now);
    // console.log("contest.startTime", contest.startTime);
    if (now < contest.startTime) {
      return res.status(400).json({
        success: false,
        message: "Contest has not started yet",
      });
    }

    if (now > contest.endTime) {
      return res.status(400).json({
        success: false,
        message: "Contest has already ended",
      });
    }

    if (contest.status !== "ONGOING") {
      return res.status(400).json({
        success: false,
        message: "Contest is not currently active",
      });
    }

    // Check if contest is full
    if (contest.currentParticipants >= contest.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: "Contest is full",
      });
    }

    // Create participation
    const participation = await Participation.create({
      userId: req.user._id,
      contestId: contest._id,
      totalQuestions: contest.questions.length,
    });

    // Update contest participant count
    contest.currentParticipants += 1;
    await contest.save();

    res.status(201).json({
      success: true,
      message: "Successfully joined the contest",
      data: {
        participation: {
          id: participation._id,
          joinedAt: participation.joinedAt,
          contestId: participation.contestId,
          totalQuestions: participation.totalQuestions,
        },
      },
    });
  } catch (error) {
    console.log("allContest Error", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function submitContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found",
      });
    }

    // Check if user has joined the contest
    const participation = await Participation.findOne({
      userId: req.user._id,
      contestId: contest._id,
    });

    if (!participation) {
      return res.status(400).json({
        success: false,
        message: "You must join the contest before submitting answers",
      });
    }

    if (participation.isCompleted) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted your answers",
      });
    }

    // Check contest timing
    const now = new Date();
    if (now > contest.endTime) {
      return res.status(400).json({
        success: false,
        message: "Contest has ended. Cannot submit answers",
      });
    }

    // Validate answers
    const { answers } = req.body;

    if (answers.length !== contest.questions.length) {
      return res.status(400).json({
        success: false,
        message: `You must answer all ${contest.questions.length} questions`,
      });
    }

    // Validate each answer
    answers.forEach((answer, index) => {
      const question = contest.questions[answer.questionIndex];
      if (!question) {
        return res.status(400).json({
          success: false,
          message: `Invalid question index: ${answer.questionIndex}`,
        });
      }

      // Validate selected options
      answer.selectedOptions.forEach((optionIndex) => {
        if (optionIndex < 0 || optionIndex >= question.options.length) {
          return res.status(400).json({
            success: false,
            message: `Invalid option index ${optionIndex} for question ${
              index + 1
            }`,
          });
        }
      });

      // Validate answer format based on question type
      if (
        question.type === "single-select" &&
        answer.selectedOptions.length !== 1
      ) {
        return res.status(400).json({
          success: false,
          message: `Question ${index + 1} requires exactly one answer`,
        });
      }

      if (
        question.type === "true-false" &&
        answer.selectedOptions.length !== 1
      ) {
        return res.status(400).json({
          success: false,
          message: `Question ${index + 1} requires exactly one answer`,
        });
      }
    });

    // Calculate score
    const scoreResult = participation.calculateScore(contest.questions);
    participation.calculateTimeSpent();

    // Save participation
    await participation.save();

    res.json({
      success: true,
      message: "Answers submitted successfully",
      data: {
        score: scoreResult.score,
        correctAnswers: scoreResult.correctAnswers,
        wrongAnswers: scoreResult.wrongAnswers,
        totalQuestions: contest.questions.length,
        submittedAt: participation.submittedAt,
        timeSpent: participation.timeSpent,
      },
    });
  } catch (error) {
    console.log("allContest Error", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function contestLeaderboard(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);

    if (!contest) {
      return res.status(400).json({
        success: false,
        message: "Contest not found",
      });
    }

    // Check access for VIP contests
    if (contest.type === "VIP") {
      if (!req.user || (req.user.role !== "vip" && req.user.role !== "admin")) {
        return res.status(400).json({
          success: false,
          message:
            "Access denied. VIP contest leaderboards are only available to VIP users",
        });
      }
    }

    const leaderboard = await Participation.find({
      contestId: contest._id,
      isCompleted: true,
    })
      .populate("userId", "name")
      .sort({ score: -1, submittedAt: 1 })
      .select("userId score correctAnswers wrongAnswers submittedAt timeSpent")
      .limit(100); // Limit to top 100

    // Add rank to each participant
    leaderboard.forEach((participant, index) => {
      participant.rank = index + 1;
    });

    // Find user's position if authenticated
    let userRank = null;
    if (req.user) {
      const userParticipation = await Participation.findOne({
        userId: req.user._id,
        contestId: contest._id,
        isCompleted: true,
      });

      if (userParticipation) {
        const userRankResult = await Participation.countDocuments({
          contestId: contest._id,
          isCompleted: true,
          $or: [
            { score: { $gt: userParticipation.score } },
            {
              score: userParticipation.score,
              submittedAt: { $lt: userParticipation.submittedAt },
            },
          ],
        });
        userRank = userRankResult + 1;
      }
    }

    res.json({
      success: true,
      data: {
        contest: {
          id: contest._id,
          name: contest.name,
          status: contest.status,
          endTime: contest.endTime,
        },
        leaderboard,
        userRank,
      },
    });
  } catch (error) {
    console.log("allContest Error", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function history(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const participations = await Participation.find({ userId: req.user._id })
      .populate(
        "contestId",
        "name description type startTime endTime prizeInfo status"
      )
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Participation.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        participations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.log("allContest Error", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function prizes(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const prizes = await Prize.find({ userId: req.user._id })
      .populate("contestId", "name")
      .sort({ awardedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Prize.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        prizes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.log("allContest Error", error);
    return res.json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  allContest,
  contestById,
  joinContest,
  submitContest,
  contestLeaderboard,
  history,
  prizes,
};
