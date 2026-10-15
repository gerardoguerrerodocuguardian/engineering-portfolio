Feature: Campaign management
  As an advertiser
  I want to create, review, change and remove campaigns
  So that I can control what ads are served

  Scenario: Creating a campaign starts it as a draft
    Given I am signed in as an advertiser
    When I create a campaign named "Autumn Sale" with a daily budget of 50000 cents and a max bid of 120 cents
    Then the response status is 201
    And the campaign has status "DRAFT"
    And the campaign has the name "Autumn Sale"

  Scenario: A created campaign can be fetched by id
    Given I am signed in as an advertiser
    And a campaign named "Winter Promo" exists
    When I fetch that campaign
    Then the response status is 200
    And the campaign has the name "Winter Promo"

  Scenario: Listing campaigns is paginated
    Given I am signed in as an advertiser
    And 3 campaigns exist
    When I list campaigns with page size 2
    Then the response status is 200
    And the page contains 2 campaigns
    And the page size is 2
    And the total is at least 3

  Scenario: Campaigns can be filtered by status
    Given I am signed in as an advertiser
    And a campaign named "To Activate" exists
    And I activate that campaign
    When I list campaigns with status "ACTIVE"
    Then the response status is 200
    And every listed campaign has status "ACTIVE"
    And the listing includes that campaign

  Scenario: An advertiser updates the budget and status
    Given I am signed in as an advertiser
    And a campaign named "Spring Launch" exists
    When I update that campaign to status "PAUSED" and daily budget 75000 cents
    Then the response status is 200
    And the campaign has status "PAUSED"
    And the campaign has a daily budget of 75000 cents

  Scenario: An admin deletes a campaign
    Given I am signed in as an admin
    And a campaign named "Short Lived" exists
    When I delete that campaign
    Then the response status is 204
    When I fetch that campaign
    Then the response status is 404
    And the response is a problem document with status 404

  Scenario: Fetching an unknown campaign
    Given I am signed in as an advertiser
    When I fetch the campaign with id "000000000000000000000000"
    Then the response status is 404
