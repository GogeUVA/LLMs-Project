An AI-powered shopping agent that helps users maximize savings by combining credit card rewards, cashback apps, store promotions, and individual coupons.

Solves one problem extremely well
- Helps users find the cheapest way to make a purchase without manually comparing credit card rewards, cashback apps, and store coupons.

You know its customers or have access to them
- Customers can be fellow UVA students and people who regularly shop online or use credit card rewards.

You are familiar or can become familiar with most of the required infrastructure
- Can be developed as a web application or browser extension using JavaScript/TypeScript.
- Uses existing LLM APIs, coupon databases, and available cashback or credit card offer integrations.

You reimagine how it can be much better
- Instead of checking multiple apps like Rakuten, Honey, and credit card portals, users can find discounts in one place.
- Automatically identifies which offers can be stacked together to maximize savings rather than simply suggesting individual coupons.

An LLM/Generative model must be essential (no "Chatbot in a Sidebar")
- The LLM interprets promotional terms, credit card benefits, and coupon restrictions to identify compatible discounts.
- Without an LLM, the application would rely on manually defined rules for each promotion and retailer.

No LLM-generated artifact may reach user without passing through validator
- Recommendations are checked against available offer terms, expiration dates, and stacking restrictions.
- Discounts that cannot be verified are not presented as confirmed savings.

Validation errors must automatically feed back into the LLM to self-correct
- Invalid coupon combinations are returned to the LLM with the specific reason they failed.
- The LLM generates another combination until it passes validation or no valid combination can be found.

If you build it you will be able to deploy it
- Can initially be deployed as a web application or Chrome extension supporting a limited number of retailers and cashback programs.
