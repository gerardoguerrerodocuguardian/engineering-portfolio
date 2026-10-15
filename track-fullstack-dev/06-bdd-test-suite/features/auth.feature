Feature: Authentication and roles
  As a platform owner
  I want only authenticated users with the right role to use the Campaign API
  So that advertiser data is protected

  Scenario: Requests without a token are rejected
    When an anonymous user lists campaigns
    Then the response status is 401
    And the response is a problem document with status 401

  Scenario: A malformed token is rejected
    When a user with an invalid token lists campaigns
    Then the response status is 401

  Scenario: Wrong credentials do not yield a token
    When someone logs in as "advertiser@adflow.test" with password "wrong-password"
    Then the response status is 401

  Scenario: An advertiser can read and create campaigns
    Given I am signed in as an advertiser
    When I list campaigns
    Then the response status is 200
    When I create a campaign named "Roles Smoke" with a daily budget of 1000 cents and a max bid of 10 cents
    Then the response status is 201

  Scenario: An advertiser cannot delete a campaign
    Given I am signed in as an advertiser
    And a campaign named "Protected Campaign" exists
    When I delete that campaign
    Then the response status is 403
    And the response is a problem document with status 403

  Scenario: A refresh token is single use
    Given I hold a fresh token pair
    When I refresh with my refresh token
    Then the response status is 200
    When I refresh again with the same, already used, refresh token
    Then the response status is 401
