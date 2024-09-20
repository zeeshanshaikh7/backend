class ApiError extends Error {
  constructor(
    statusCode,
    message = "something went wrong",
    errors = [],
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    // Ensure Error.captureStackTrace is supported
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ApiError); // Changed `this.constructor` to `ApiError`
    } else {
      this.stack = new Error().stack; // Fallback for environments that don't support captureStackTrace
    }
  }
}

export { ApiError };
