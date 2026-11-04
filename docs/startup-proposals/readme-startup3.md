An AI-powered parking application similar to that helps drivers find nearby affordable parking while considering parking regulations, time restrictions, and walking distance.

Solves one problem extremely well
- Helps drivers find nearby legal and affordable parking without spending time driving around or manually checking parking restrictions.

You know its customers or have access to them
- Customers can be fellow UVA students who drive to classes or regularly struggle to find parking around Charlottesville.

You are familiar or can become familiar with most of the required infrastructure
- Can be developed as an iPhone app using Xcode/Swift.
- Uses existing LLM APIs, mapping services, public parking regulations, and available parking data.

You reimagine how it can be much better
- Instead of only showing nearby parking locations, the app recommends parking based on arrival time, parking duration, cost, and walking distance.
- Users can describe their parking needs in natural language, such as finding free parking within a 10-minute walk of a building for two hours.

An LLM/Generative model must be essential (no "Chatbot in a Sidebar")
- The LLM interprets complicated parking signs, local regulations, and user requests to identify suitable parking locations.
- Without an LLM, the app would rely on structured parking data and predefined filters rather than interpreting complex parking rules.

No LLM-generated artifact may reach user without passing through validator
- Parking recommendations are checked against verified regulations, time restrictions, and available location data.
- Recommendations with conflicting or unverifiable restrictions are not presented as confirmed legal parking options.

Validation errors must automatically feed back into the LLM to self-correct
- Invalid parking recommendations are returned to the LLM with feedback about conflicting regulations or missing information.
- The LLM automatically generates corrected recommendations and resubmits them for validation.

If you build it you will be able to deploy it
- Can initially be deployed as an iPhone app focused on parking around UVA and Charlottesville.
- Uses existing mapping infrastructure and available parking data
