Feature: Input validation
  As an API consumer
  I want clear, machine-readable errors for bad input
  So that the dashboard can show helpful messages

  Background:
    Given I am signed in as an advertiser

  Scenario Outline: Invalid campaigns are rejected with a problem document
    When I submit a campaign with name "<name>", daily budget <budget> and max bid <bid>
    Then the response status is 400
    And the response is a problem document with status 400
    And the problem lists at least one validation error

    Examples:
      | name | budget | bid  |
      | ab   | 1000   | 10   |
      | Good | -5     | 10   |
      | Good | 1000   | 0    |
      | Good | 10.5   | 10   |

  Scenario: Unknown fields cannot be injected
    When I create a campaign with the extra field "ownerId" set to "someone-else"
    Then the response status is 400

  Scenario: A status outside the allowed set is rejected
    Given a campaign named "Status Check" exists
    When I update that campaign to status "RUNNING_WILD"
    Then the response status is 400

  Scenario: The page size is capped
    When I list campaigns with page size 101
    Then the response status is 400
