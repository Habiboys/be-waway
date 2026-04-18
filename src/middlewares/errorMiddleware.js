module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'test') {
    console.error('[ERROR]', {
      path: req.originalUrl,
      method: req.method,
      message,
      stack: err.stack
    });
  }

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
  });
};
