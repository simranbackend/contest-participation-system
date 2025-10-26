const Joi = require('joi');

// Validation schemas
const schemas = {
  // User validation schemas
  register: Joi.object({
    name: Joi.string().trim().min(2).max(50).required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 50 characters'
      }),
    email: Joi.string().email().lowercase().required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please enter a valid email address'
      }),
    password: Joi.string().min(6).max(128).required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 6 characters',
        'string.max': 'Password cannot exceed 128 characters'
      }),
    role: Joi.string().valid('normal', 'vip').default('normal')
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please enter a valid email address'
      }),
    password: Joi.string().required()
      .messages({
        'string.empty': 'Password is required'
      })
  }),

  // Contest validation schemas
  createContest: Joi.object({
    name: Joi.string().trim().min(3).max(100).required()
      .messages({
        'string.empty': 'Contest name is required',
        'string.min': 'Contest name must be at least 3 characters',
        'string.max': 'Contest name cannot exceed 100 characters'
      }),
    description: Joi.string().trim().min(10).max(500).required()
      .messages({
        'string.empty': 'Contest description is required',
        'string.min': 'Description must be at least 10 characters',
        'string.max': 'Description cannot exceed 500 characters'
      }),
    type: Joi.string().valid('NORMAL', 'VIP').required()
      .messages({
        'any.only': 'Contest type must be either NORMAL or VIP'
      }),
    startTime: Joi.date().greater('now').required()
      .messages({
        'date.greater': 'Start time must be in the future'
      }),
    endTime: Joi.date().greater(Joi.ref('startTime')).required()
      .messages({
        'date.greater': 'End time must be after start time'
      }),
    prizeInfo: Joi.string().trim().min(5).max(200).required()
      .messages({
        'string.empty': 'Prize information is required',
        'string.min': 'Prize info must be at least 5 characters',
        'string.max': 'Prize info cannot exceed 200 characters'
      }),
    maxParticipants: Joi.number().integer().min(1).max(10000).default(1000)
  }),

  updateContest: Joi.object({
    name: Joi.string().trim().min(3).max(100),
    description: Joi.string().trim().min(10).max(500),
    type: Joi.string().valid('NORMAL', 'VIP'),
    startTime: Joi.date().greater('now'),
    endTime: Joi.date().greater(Joi.ref('startTime')),
    prizeInfo: Joi.string().trim().min(5).max(200),
    maxParticipants: Joi.number().integer().min(1).max(10000)
  }).min(1), // At least one field must be provided

  // Question validation schemas
  addQuestion: Joi.object({
    questionText: Joi.string().trim().min(10).max(500).required()
      .messages({
        'string.empty': 'Question text is required',
        'string.min': 'Question text must be at least 10 characters',
        'string.max': 'Question text cannot exceed 500 characters'
      }),
    type: Joi.string().valid('single-select', 'multi-select', 'true-false').required()
      .messages({
        'any.only': 'Question type must be single-select, multi-select, or true-false'
      }),
    options: Joi.array().items(
      Joi.object({
        option: Joi.string().trim().min(1).max(200).required()
          .messages({
            'string.empty': 'Option text is required',
            'string.max': 'Option text cannot exceed 200 characters'
          }),
        isCorrect: Joi.boolean().required()
      })
    ).min(2).max(10).required()
      .messages({
        'array.min': 'At least 2 options are required',
        'array.max': 'Maximum 10 options allowed'
      }),
    points: Joi.number().integer().min(1).max(10).default(1)
  }),

  // Answer submission validation schema
  submitAnswers: Joi.object({
    answers: Joi.array().items(
      Joi.object({
        questionIndex: Joi.number().integer().min(0).required(),
        selectedOptions: Joi.array().items(Joi.number().integer().min(0)).required()
      })
    ).required()
      .messages({
        'array.empty': 'Answers array cannot be empty'
      })
  })
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Show all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert types when possible
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Specific validation middlewares
const validateRegister = validate(schemas.register);
const validateLogin = validate(schemas.login);
const validateCreateContest = validate(schemas.createContest);
const validateUpdateContest = validate(schemas.updateContest);
const validateAddQuestion = validate(schemas.addQuestion);
const validateSubmitAnswers = validate(schemas.submitAnswers);

module.exports = {
  validate,
  validateRegister,
  validateLogin,
  validateCreateContest,
  validateUpdateContest,
  validateAddQuestion,
  validateSubmitAnswers,
  schemas
};
