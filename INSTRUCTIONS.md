# Paid Challenge - October 31, 2025

You have 72 hours to build the following app. This app will be very challenging to build in that time frame. It’s very unlikely someone could build this without extensive use of AI, so make sure you are using AI to help as much as possible! I recommend using Cursor with a Pro subscription. Do not have other people help you. If other people help, the submission will not be accepted.

Please fully deploy the app (to Render or Fly.io or similar) and then submit the url to the app well as a link to your repo so we can see the code.

If you submit a fully deployed, working app that meets all the requirements below, I will pay you $3,000.

Please build an AI email sorting app. I should be able to sign in with Google, define some categories, with descriptions, that I want AI to sort my emails into. When I get a new email, it should use AI to sort it into a category and then also summarize it. Then, it should archive the email in Gmail. When I click on a category in your app, it should show me an AI summary of each email in that category and then have bulk actions I can take on the emails in the category.

Here’s how it should work:

- I can “Sign in with Google” via OAuth
- It asks for scopes related to email (This will be a dev app, on Google, you’ll need to add my Gmail as a test user in order for me to use the app because in order for apps with email scopes to be approved you have to do a security review which takes weeks. I’ll give you my Gmail if you submit a working app.)
- It shows me a page with 3 sections:
    - A way to connect other Gmail accounts so this works across multiple inboxes
    - A list of my custom categories
    - A button to add a new category
- When I add a new category, it has a form where I can give the category a name and a description
- [When new emails come in, it imports them into the app into the right category using AI and the category descriptioncomp](https://www.notion.so/1635ee0c36548048a1dfde394b86e554?pvs=21)
- After importing a new email, it archives (not deletes) it on Gmail
- When I click on a category in the app, it shows me all the emails imported to that category. Each email has an AI-summarized description. I can select specific emails or select all emails and either delete them or unsubscribe.
- If I select emails and click unsubscribe, it should look through each email for an “unsubscribe” link and act like an AI agent to go to that page and unsubscribe (filling out any form necessary, toggling the right selects, etc.)
- If I click on an email, I can read the original contents.

The app should have good tests (strongly recommended to have AI write them)

**Once completed, please reply to the email that sent you this challenge with the url to the app as well as a link to your repo. The deadline is Monday, November 3, at 11am MT (Denver).**

If you don’t quite finish, submit anyway, note a deployed app and access to repo is required for review. If no one finishes, I may still hire the best submission and pay that person $3,000.

Good luck! 

The Jump Hiring Team