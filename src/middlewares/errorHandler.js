const errorHandler = (err, req, res, next) => {
  console.error(err);
  
  if (err.code === 'P2002') {
    return res.status(409).json({ 
      success: false, 
      error: "Unique constraint failed. This record or reservation already exists." 
    });
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({ 
      success: false, 
      error: "Record not found." 
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
};

module.exports = errorHandler;