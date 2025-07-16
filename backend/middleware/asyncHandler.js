/**
 * Async handler middleware to wrap async route handlers and catch errors
 * This eliminates the need for try/catch blocks in route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;