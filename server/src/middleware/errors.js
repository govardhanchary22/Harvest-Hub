export function notFound(req, res) {
  res.status(404).json({ message: "The requested endpoint was not found." });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: "Please check the supplied information." });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  console.error(error);
  return res.status(error.status || 500).json({
    message: error.status ? error.message : "Something went wrong. Please try again.",
  });
}
