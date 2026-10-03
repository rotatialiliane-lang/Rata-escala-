# Oficina PDF AI service

A small Render web service for analyzing supplier quotation PDFs and extracting preliminary material lists from project PDFs with the OpenAI Responses API.

## Required Render environment variables

- `OPENAI_API_KEY`: an OpenAI API key, stored only in Render's secret environment settings.
- `CORS_ORIGIN`: `https://oficina-marcenaria-teste.onrender.com`
- Optional `OPENAI_MODEL`: defaults to `gpt-4.1-mini`.

Never add these values to source control or the browser JavaScript. Do not send the key in chat. A user must select the upload consent checkbox before the browser sends a PDF to this service. The service keeps the PDF in memory only for the request and does not write it to disk or log its contents. It asks the Responses API not to store the response (`store: false`). OpenAI API data handling and usage charges still apply.

## Deploy commands

From the repository root:

- Build: `cd marcenaria-teste/ai-service && npm install`
- Start: `cd marcenaria-teste/ai-service && npm start`

The service listens on `0.0.0.0:$PORT`. Health check: `/healthz`.

The endpoint limits PDF size to 10 MB, limits each source IP to 12 analyses per hour, accepts requests only from the test site origin, and requires the upload consent checkbox in the interface; access is limited to the public test-site origin.
