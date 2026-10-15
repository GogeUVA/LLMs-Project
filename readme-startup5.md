https://www.byteask.ai/

An AI-powered debugging tool that helps student developers repair small Python bugs by generating a reproducible test, a targeted fix, and verified test results.

Solves one problem extremely well
- Helps developers fix a reported bug without relying on AI-generated changes that only appear correct.
- Produces a regression test that demonstrates the bug before the fix and passes afterward.

You know its customers or have access to them
- Customers can be fellow UVA CS students building personal, club, or course projects where AI assistance is permitted.

You are familiar or can become familiar with most of the required infrastructure
- Can be developed as a web application with a Python backend.
- Uses existing LLM APIs, pytest, Git diff tools, and isolated code execution workers.
- Initially supports small Python projects with existing tests and explicitly defined expected behavior.

You reimagine how it can be much better
- Our group can build a focused debugging workflow for small Python projects that student teams can use without configuring a general-purpose coding agent.
- Each accepted fix includes a regression test that reproduces the original bug and passes after the repair, making the change easier for teammates to review.
- The app limits changes to selected files and preserves existing tests, helping students avoid unrelated changes while fixing one problem.

An LLM/Generative model must be essential
- The LLM interprets bug reports and relevant code to generate a regression test and targeted repair.
- It uses execution feedback to revise unsuccessful fixes rather than only offering debugging suggestions.

No LLM-generated artifact may reach user without passing through validator
- Generated tests and patches remain hidden until validation succeeds.
- The regression test must match the user's specified expected behavior, fail on the original code for the reported reason rather than a syntax or import error, and pass after the fix.
- Existing tests must also pass, and the patch cannot modify baseline tests, disable checks, or change files outside the allowed scope.
- Explanations use predefined templates populated with verified execution results. Passing tests demonstrates the checked behavior rather than guaranteeing complete correctness.

Validation errors must automatically feed back into the LLM to self-correct
- If the generated test does not reproduce the reported bug, the patch fails a test, or the model changes a prohibited file, the validator returns the specific failure, traceback, and allowed editing scope to the LLM.
- The LLM revises the test or patch as appropriate. The backend checks the regression test against the original and repaired code and reruns the unchanged existing tests.
- After three unsuccessful attempts, generated artifacts remain withheld and the app displays a predefined failure message.

If you build it you will be able to deploy it
- Can initially be deployed as a web application supporting small Python projects and a restricted dependency list.
- Submitted code runs in disposable isolated workers with no network access or host credentials and with enforced time and resource limits.
- Automatic commits and support for arbitrary repositories are outside the initial scope.
