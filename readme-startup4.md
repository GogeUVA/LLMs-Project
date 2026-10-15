https://www.newsblur.com/

An AI-powered news reader that helps users understand a developing story by comparing articles and connecting each summary claim to its supporting source.

Solves one problem extremely well
- Helps users understand important news without manually reading and comparing several articles about the same event.

You know its customers or have access to them
- Customers can be fellow UVA students who follow news for classes, clubs, or personal interests.

You are familiar or can become familiar with most of the required infrastructure
- Can be developed as a web application using JavaScript/TypeScript and a Python backend.
- Uses existing LLM APIs, permitted RSS feeds, and user-provided article text.

You reimagine how it can be much better
- Our group can build a side-by-side briefing that helps students compare how different sources cover the same event.
- Each factual claim links to a supporting article passage, allowing users to inspect the evidence without reading every article in full.
- The app distinguishes shared reporting from conflicting accounts rather than combining everything into a single summary that hides those differences.

An LLM/Generative model must be essential
- The LLM compares differently worded reporting, identifies related claims, and generates a combined briefing with evidence references.
- Without an LLM, the application would primarily collect articles rather than synthesize their contents.

No LLM-generated artifact may reach user without passing through validator
- Generated briefings are checked for valid source references, matching quotations, and consistency of dates and numbers.
- A separate claim-support checker evaluates whether cited passages support each claim and any stated disagreement.
- All generated text remains hidden until these checks pass. The checker will be evaluated against human-labeled examples because it can also make mistakes.
- These checks establish support in the supplied articles rather than guaranteeing that the reporting is true.

Validation errors must automatically feed back into the LLM to self-correct
- If a briefing contains an invalid source reference, an inaccurate quotation, or an unsupported claim, the validator returns the affected claim, the specific error, and relevant article passages to the LLM.
- The LLM corrects or removes the claim and resubmits the complete briefing for validation.
- After three unsuccessful attempts, the app withholds the briefing and displays a predefined failure message with the original source links.

If you build it you will be able to deploy it
- Can initially be deployed as a web application comparing two to five English-language articles about one event.
- Uses hosted frontend, backend, and database infrastructure, with LLM API credentials stored on the server.
- The initial version uses permitted feed content or user-provided text rather than depending on access to paywalled articles.
