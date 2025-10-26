const mongoose = require('mongoose');

const participationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: [true, 'Contest ID is required']
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date,
    default: null
  },
  answers: [{
    questionIndex: {
      type: Number,
      required: [true, 'Question index is required'],
      min: [0, 'Question index must be non-negative']
    },
    selectedOptions: [{
      type: Number,
      min: [0, 'Option index must be non-negative']
    }],
    isCorrect: {
      type: Boolean,
      default: false
    },
    pointsEarned: {
      type: Number,
      default: 0
    }
  }],
  score: {
    type: Number,
    default: 0,
    min: [0, 'Score cannot be negative']
  },
  totalQuestions: {
    type: Number,
    required: [true, 'Total questions count is required']
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  wrongAnswers: {
    type: Number,
    default: 0
  },
  rank: {
    type: Number,
    default: null
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to ensure one participation per user per contest
participationSchema.index({ userId: 1, contestId: 1 }, { unique: true });

// Indexes for better performance
participationSchema.index({ contestId: 1, score: -1, submittedAt: 1 });
participationSchema.index({ userId: 1 });
participationSchema.index({ submittedAt: 1 });

// Method to calculate score
participationSchema.methods.calculateScore = function(contestQuestions) {
  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  
  this.answers.forEach((answer, index) => {
    const question = contestQuestions[answer.questionIndex];
    if (!question) return;
    
    let isCorrect = false;
    
    if (question.type === 'single-select') {
      // For single-select, check if the selected option is correct
      const selectedOption = question.options[answer.selectedOptions[0]];
      isCorrect = selectedOption && selectedOption.isCorrect;
    } else if (question.type === 'multi-select') {
      // For multi-select, check if all correct options are selected and no incorrect ones
      const correctOptions = question.options
        .map((option, index) => ({ index, isCorrect: option.isCorrect }))
        .filter(option => option.isCorrect)
        .map(option => option.index);
      
      const selectedOptions = answer.selectedOptions.sort();
      const correctOptionsSorted = correctOptions.sort();
      
      isCorrect = selectedOptions.length === correctOptionsSorted.length &&
                 selectedOptions.every((option, index) => option === correctOptionsSorted[index]);
    } else if (question.type === 'true-false') {
      // For true-false, check if the selected option is correct
      const selectedOption = question.options[answer.selectedOptions[0]];
      isCorrect = selectedOption && selectedOption.isCorrect;
    }
    
    answer.isCorrect = isCorrect;
    answer.pointsEarned = isCorrect ? question.points : 0;
    
    totalScore += answer.pointsEarned;
    if (isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });
  
  this.score = totalScore;
  this.correctAnswers = correctCount;
  this.wrongAnswers = wrongCount;
  this.isCompleted = true;
  this.submittedAt = new Date();
  
  return {
    score: totalScore,
    correctAnswers: correctCount,
    wrongAnswers: wrongCount
  };
};

// Method to calculate time spent
participationSchema.methods.calculateTimeSpent = function() {
  if (this.submittedAt && this.joinedAt) {
    this.timeSpent = Math.floor((this.submittedAt - this.joinedAt) / 1000);
  }
  return this.timeSpent;
};

module.exports = mongoose.model('Participation', participationSchema);
