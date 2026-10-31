const { ZodError } = require('zod');

const validate = (schema, source = 'body') => (req, res, next) => {
  try {
    const input = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    const parsed = schema.parse(input);
    if (source === 'query') {
      req.validatedQuery = parsed;
    } else if (source === 'params') {
      req.params = parsed;
    } else {
      req.body = parsed;
    }
  } catch (error) {
    if (!(error instanceof ZodError)) {
      return next(error);
    }

    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: error.issues.map(err => ({ field: err.path.join('.'), message: err.message }))
    });
  }
  return next();
};

module.exports = validate;