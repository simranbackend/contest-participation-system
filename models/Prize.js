const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: [true, 'Contest ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  prizeInfo: {
    type: String,
    required: [true, 'Prize information is required'],
    trim: true,
    maxlength: [200, 'Prize info cannot exceed 200 characters']
  },
  rank: {
    type: Number,
    required: [true, 'Rank is required'],
    min: [1, 'Rank must be at least 1']
  },
  score: {
    type: Number,
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative']
  },
  awardedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['PENDING', 'GRANTED', 'CLAIMED'],
    default: 'GRANTED'
  },
  contestName: {
    type: String,
    required: [true, 'Contest name is required']
  },
  userEmail: {
    type: String,
    required: [true, 'User email is required']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for better performance
prizeSchema.index({ userId: 1 });
prizeSchema.index({ contestId: 1 });
prizeSchema.index({ awardedAt: -1 });
prizeSchema.index({ status: 1 });

// Compound index to prevent duplicate prizes for same contest and user
prizeSchema.index({ contestId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Prize', prizeSchema);
