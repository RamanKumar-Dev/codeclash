"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    console.error(`Error ${statusCode}: ${message}`);
    console.error(err.stack);
    // Don't expose stack trace in production
    if (process.env.NODE_ENV === 'production') {
        res.status(statusCode).json({
            error: message,
            ...(statusCode === 500 && { details: 'Something went wrong' })
        });
    }
    else {
        res.status(statusCode).json({
            error: message,
            stack: err.stack
        });
    }
};
exports.errorHandler = errorHandler;
const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
};
exports.createError = createError;
//# sourceMappingURL=errorHandler.js.map