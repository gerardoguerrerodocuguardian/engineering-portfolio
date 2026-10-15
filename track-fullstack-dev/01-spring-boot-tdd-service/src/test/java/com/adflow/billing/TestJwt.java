package com.adflow.billing;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/** Local RSA key pair: mints signed JWTs and provides the matching JwtDecoder (no network). */
public final class TestJwt {

  private static final RSAKey KEY = generate();

  private TestJwt() {}

  private static RSAKey generate() {
    try {
      return new RSAKeyGenerator(2048).keyID("test-key").generate();
    } catch (JOSEException e) {
      throw new IllegalStateException(e);
    }
  }

  public static JwtDecoder decoder() {
    try {
      return NimbusJwtDecoder.withPublicKey(KEY.toRSAPublicKey()).build();
    } catch (JOSEException e) {
      throw new IllegalStateException(e);
    }
  }

  public static String token(String scope, String... roles) {
    return token(scope, Instant.now().plusSeconds(300), roles);
  }

  public static String token(String scope, Instant expiry, String... roles) {
    try {
      var claims =
          new JWTClaimsSet.Builder()
              .subject("user-1")
              .issueTime(Date.from(Instant.now().minusSeconds(10)))
              .expirationTime(Date.from(expiry))
              .claim("scope", scope)
              .claim("roles", List.of(roles))
              .build();
      var jwt =
          new SignedJWT(
              new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(), claims);
      jwt.sign(new RSASSASigner(KEY));
      return jwt.serialize();
    } catch (JOSEException e) {
      throw new IllegalStateException(e);
    }
  }
}
