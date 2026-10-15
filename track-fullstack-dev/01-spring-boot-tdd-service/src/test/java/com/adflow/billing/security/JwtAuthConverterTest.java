package com.adflow.billing.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class JwtAuthConverterTest {

  private final JwtAuthConverter converter = new JwtAuthConverter();

  private static Jwt.Builder base() {
    return Jwt.withTokenValue("t")
        .header("alg", "none")
        .subject("u1")
        .issuedAt(Instant.now())
        .expiresAt(Instant.now().plusSeconds(60));
  }

  @Test
  void mapsScopesAndRolesToAuthorities() {
    var jwt =
        base()
            .claim("scope", "billing:read  billing:write")
            .claim("roles", List.of("admin"))
            .build();

    var auth = converter.convert(jwt);

    assertThat(auth.getAuthorities())
        .extracting(Object::toString)
        .containsExactlyInAnyOrder("SCOPE_billing:read", "SCOPE_billing:write", "ROLE_ADMIN");
    assertThat(auth.getName()).isEqualTo("u1");
  }

  @Test
  void missingClaimsYieldNoAuthorities() {
    assertThat(converter.convert(base().claim("x", "y").build()).getAuthorities()).isEmpty();
    assertThat(converter.convert(base().claim("scope", "   ").build()).getAuthorities()).isEmpty();
  }
}
