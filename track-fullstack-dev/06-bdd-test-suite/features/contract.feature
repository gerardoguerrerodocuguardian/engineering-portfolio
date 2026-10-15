Feature: API contract conformance
  As a consumer team (dashboard, agent)
  I want real responses to match the shared OpenAPI contract
  So that generated clients keep working

  Scenario: Create, read, list, update and report responses match the contract
    Given I am signed in as an admin
    When I create a campaign named "Contract Check" with a daily budget of 2000 cents and a max bid of 15 cents
    Then the response conforms to the OpenAPI contract
    When I fetch that campaign
    Then the response conforms to the OpenAPI contract
    When I list campaigns with page size 5
    Then the response conforms to the OpenAPI contract
    When I update that campaign to status "ACTIVE" and daily budget 3000 cents
    Then the response conforms to the OpenAPI contract
    When I request the report for that campaign
    Then the response conforms to the OpenAPI contract
    When I delete that campaign
    Then the response conforms to the OpenAPI contract

  Scenario: Error responses match the problem schema
    Given I am signed in as an advertiser
    When I submit a campaign with name "x", daily budget 1 and max bid 1
    Then the response conforms to the OpenAPI contract
    When I fetch the campaign with id "000000000000000000000000"
    Then the response conforms to the OpenAPI contract
