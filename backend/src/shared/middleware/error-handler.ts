import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const errorType =
    typeof error === "object" &&
    error !== null &&
    "type" in error
      ? error.type
      : undefined;

  if (errorType === "entity.parse.failed") {
    res.status(400).json({
      message: "The request body must contain valid JSON.",
    });
    return;
  }

  if (errorType === "entity.too.large") {
    res.status(413).json({
      message: "The request body is too large.",
    });
    return;
  }

  if (
    errorType === "charset.unsupported" ||
    errorType === "encoding.unsupported"
  ) {
    res.status(415).json({
      message: "Unsupported request encoding.",
    });
    return;
  }

  console.error("Unhandled request failure:", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });

  res.status(500).json({
    message: "Something went wrong. Please try again later.",
  });
};