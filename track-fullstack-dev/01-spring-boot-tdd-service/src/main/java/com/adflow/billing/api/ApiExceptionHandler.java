package com.adflow.billing.api;

import com.adflow.billing.domain.InvalidInvoiceException;
import com.adflow.billing.domain.InvalidStateTransitionException;
import com.adflow.billing.domain.TaxServiceUnavailableException;
import com.adflow.billing.domain.UnknownRegionException;
import com.adflow.billing.service.NotFoundException;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Maps every failure to an RFC 7807 problem+json body. */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

  private static ProblemDetail problem(
      HttpStatus status, String slug, String title, String detail) {
    ProblemDetail p = ProblemDetail.forStatusAndDetail(status, detail);
    p.setTitle(title);
    p.setType(URI.create("https://adflow.example/problems/" + slug));
    return p;
  }

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ProblemDetail p =
        problem(
            HttpStatus.BAD_REQUEST, "validation", "Validation failed", "Request body is invalid");
    List<String> errors =
        ex.getBindingResult().getFieldErrors().stream()
            .map((FieldError f) -> f.getField() + ": " + f.getDefaultMessage())
            .sorted()
            .toList();
    p.setProperty("errors", errors);
    return ResponseEntity.badRequest().body(p);
  }

  @ExceptionHandler(InvalidInvoiceException.class)
  ProblemDetail invalid(InvalidInvoiceException ex) {
    return problem(HttpStatus.BAD_REQUEST, "invalid-invoice", "Invalid invoice", ex.getMessage());
  }

  @ExceptionHandler(ArithmeticException.class)
  ProblemDetail overflow(ArithmeticException ex) {
    return problem(
        HttpStatus.BAD_REQUEST, "amount-too-large", "Amount too large", "Monetary amount overflow");
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  ProblemDetail badParam(MethodArgumentTypeMismatchException ex) {
    return problem(
        HttpStatus.BAD_REQUEST,
        "bad-parameter",
        "Bad parameter",
        "Invalid value for " + ex.getName());
  }

  @ExceptionHandler(NotFoundException.class)
  ProblemDetail notFound(NotFoundException ex) {
    return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", ex.getMessage());
  }

  @ExceptionHandler(InvalidStateTransitionException.class)
  ProblemDetail conflict(InvalidStateTransitionException ex) {
    return problem(
        HttpStatus.CONFLICT, "invalid-state", "Invalid state transition", ex.getMessage());
  }

  @ExceptionHandler(UnknownRegionException.class)
  ProblemDetail unknownRegion(UnknownRegionException ex) {
    return problem(
        HttpStatus.UNPROCESSABLE_ENTITY, "unknown-region", "Unknown region", ex.getMessage());
  }

  @ExceptionHandler(TaxServiceUnavailableException.class)
  ProblemDetail taxDown(TaxServiceUnavailableException ex) {
    return problem(
        HttpStatus.SERVICE_UNAVAILABLE,
        "tax-service-unavailable",
        "Tax service unavailable",
        "Tax rate could not be determined; retry later");
  }
}
