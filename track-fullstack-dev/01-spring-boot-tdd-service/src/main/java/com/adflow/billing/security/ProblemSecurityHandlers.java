package com.adflow.billing.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

/** 401/403 as RFC 7807 problem+json, matching the shared Problem schema. */
public class ProblemSecurityHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

  @Override
  public void commence(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException ex)
      throws IOException {
    response.setHeader("WWW-Authenticate", "Bearer");
    write(response, HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid bearer token required");
  }

  @Override
  public void handle(
      HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex)
      throws IOException {
    write(response, HttpStatus.FORBIDDEN, "Forbidden", "Insufficient scope or role");
  }

  private static void write(
      HttpServletResponse response, HttpStatus status, String title, String detail)
      throws IOException {
    response.setStatus(status.value());
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    response
        .getWriter()
        .write(
            "{\"type\":\"https://adflow.example/problems/%s\",\"title\":\"%s\",\"status\":%d,\"detail\":\"%s\"}"
                .formatted(title.toLowerCase(), title, status.value(), detail));
  }
}
