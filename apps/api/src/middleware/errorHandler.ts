import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
  } else {
    res.status(statusCode).json({
      error: message,
      stack: err.stack
    });
  }
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
