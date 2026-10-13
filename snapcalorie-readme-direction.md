https://www.snapcalorie.com/

Specifically improving the meal planner, can also integrate with UVA's dining options as additional recommendations.

Solves one problem extremely well
- Helps users find meals that support a specific fitness or health goal by inputting natural language, useful for those with no specialized knowledge of nutrition.

Know its customers or have access to them
- Customers can be fellow UVA students.

Familiar or can become familiar with most of the required infrastructure
- Can be an iPhone app built with Xcode/Swift.
- Uses existing LLM APIs and dining hall menu data.

Reimagine how it can be much better
- Users describe goals in natural language instead of being limited to selecting preset diets like vegan, keto, vegetarian.
- Recommendations can account for fitness goals, budget, timing, and available dining options rather than just calorie limit and manually setting nutritional goals.

LLM must be essential
- The LLM converts goals into personalized meal recommendations.
- Without an LLM, the app becomes a simple filter system.

No LLM-generated artifact may reach user without passing through validator
- Meal suggestions are checked against nutrition rules and menu availability.
- Invalid recommendations are never shown to users.

Validation errors must automatically feed back into the LLM to self-correct
- Failed recommendations are returned to the LLM with feedback.
- The LLM regenerates a corrected recommendation automatically.

If you build it you will be able to deploy it
- As an example, can be deployed as an iPhone app, no special hardware needed.
