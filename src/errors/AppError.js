class AppError extends Error {
  constructor(message, statusCode = 500, extras = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.extras = extras;
  }
}

module.exports = { AppError };
