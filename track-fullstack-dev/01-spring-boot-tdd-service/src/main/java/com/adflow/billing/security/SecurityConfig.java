package com.adflow.billing.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain api(HttpSecurity http) throws Exception {
    var problems = new ProblemSecurityHandlers();
    http.csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers("/actuator/health/**", "/actuator/info")
                    .permitAll()
                    .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers("/actuator/**")
                    .hasRole("ADMIN")
                    .requestMatchers(HttpMethod.POST, "/v1/invoices/*/void")
                    .hasRole("ADMIN")
                    .requestMatchers(HttpMethod.GET, "/v1/**")
                    .hasAuthority("SCOPE_billing:read")
                    .requestMatchers(HttpMethod.POST, "/v1/**")
                    .hasAuthority("SCOPE_billing:write")
                    .anyRequest()
                    .denyAll())
        .oauth2ResourceServer(
            o ->
                o.jwt(j -> j.jwtAuthenticationConverter(new JwtAuthConverter()))
                    .authenticationEntryPoint(problems))
        .exceptionHandling(e -> e.accessDeniedHandler(problems).authenticationEntryPoint(problems));
    return http.build();
  }
}
