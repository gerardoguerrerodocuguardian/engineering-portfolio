Feature: Campaign performance report
  As an advertiser
  I want an aggregated report for a campaign
  So that I can see impressions, clicks, spend and click-through rate

  Scenario: A brand new campaign has an empty report
    Given I am signed in as an advertiser
    And a campaign named "Fresh Campaign" exists
    When I request the report for that campaign
    Then the response status is 200
    And the report shows 0 impressions, 0 clicks and 0 cents spent
    And the click-through rate is 0

  Scenario: The report of an unknown campaign is not found
    Given I am signed in as an advertiser
    When I request the report for the campaign with id "000000000000000000000000"
    Then the response status is 404
