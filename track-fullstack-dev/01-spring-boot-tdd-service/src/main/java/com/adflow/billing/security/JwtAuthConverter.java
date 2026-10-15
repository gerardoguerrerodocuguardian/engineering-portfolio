package com.adflow.billing.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Maps the space-delimited {@code scope} claim to {@code SCOPE_*} and the {@code roles} array claim
 * to {@code ROLE_*} authorities.
 */
public class JwtAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {

  @Override
  public AbstractAuthenticationToken convert(Jwt jwt) {
    List<GrantedAuthority> authorities = new ArrayList<>();
    String scope = jwt.getClaimAsString("scope");
    if (scope != null && !scope.isBlank()) {
      for (String s : scope.trim().split("\\s+")) {
        authorities.add(new SimpleGrantedAuthority("SCOPE_" + s));
      }
    }
    Collection<String> roles = jwt.getClaimAsStringList("roles");
    if (roles != null) {
      roles.forEach(r -> authorities.add(new SimpleGrantedAuthority("ROLE_" + r.toUpperCase())));
    }
    return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
  }
}
