const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Contest name is required'],
    trim: true,
    maxlength: [100, 'Contest name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Contest description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['NORMAL', 'VIP'],
    required: [true, 'Contest type is required']
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required'],
    validate: {
      validator: function(endTime) {
        return endTime > this.startTime;
      },
      message: 'End time must be after start time'
    }
  },
  prizeInfo: {
    type: String,
    required: [true, 'Prize information is required'],
    trim: true,
    maxlength: [200, 'Prize info cannot exceed 200 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'ONGOING', 'ENDED'],
    default: 'UPCOMING'
  },
  questions: [{
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      maxlength: [500, 'Question text cannot exceed 500 characters']
    },
    type: {
      type: String,
      enum: ['single-select', 'multi-select', 'true-false'],
      required: [true, 'Question type is required']
    },
    options: [{
      option: {
        type: String,
        required: [true, 'Option text is required'],
        trim: true,
        maxlength: [200, 'Option text cannot exceed 200 characters']
      },
      isCorrect: {
        type: Boolean,
        required: [true, 'isCorrect flag is required']
      }
    }],
    points: {
      type: Number,
      default: 1,
      min: [1, 'Points must be at least 1']
    }
  }],
  maxParticipants: {
    type: Number,
    default: 1000,
    min: [1, 'Max participants must be at least 1']
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for better performance
contestSchema.index({ startTime: 1, endTime: 1 });
contestSchema.index({ type: 1 });
contestSchema.index({ status: 1 });
contestSchema.index({ createdBy: 1 });

// Virtual for checking if contest is currently active
contestSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return now >= this.startTime && now <= this.endTime && this.status === 'ONGOING';
});

// Method to update contest status based on time
contestSchema.methods.updateStatus = function() {
  const now = new Date();
  
  if (now < this.startTime) {
    this.status = 'UPCOMING';
  } else if (now >= this.startTime && now <= this.endTime) {
    this.status = 'ONGOING';
  } else {
    this.status = 'ENDED';
  }
  
  return this.save();
};

// Pre-save middleware to validate questions
contestSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.questions.forEach((question, index) => {
      // Validate that there's at least one correct option
      const correctOptions = question.options.filter(option => option.isCorrect);
      if (correctOptions.length === 0) {
        return next(new Error(`Question ${index + 1} must have at least one correct option`));
      }
      
      // For single-select, ensure only one correct option
      if (question.type === 'single-select' && correctOptions.length > 1) {
        return next(new Error(`Question ${index + 1} (single-select) can only have one correct option`));
      }
      
      // For true-false, ensure exactly 2 options with one correct
      if (question.type === 'true-false') {
        if (question.options.length !== 2) {
          return next(new Error(`Question ${index + 1} (true-false) must have exactly 2 options`));
        }
        if (correctOptions.length !== 1) {
          return next(new Error(`Question ${index + 1} (true-false) must have exactly one correct option`));
        }
      }
    });
  }
  next();
});

module.exports = mongoose.model('Contest', contestSchema);
