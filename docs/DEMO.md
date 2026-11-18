# ContractMind: 3-minute demo script

Before recording: set `GEMINI_API_KEY` in Vercel, open the live site in a fresh browser window, and run the first sample once so its index is warm. Keep the browser at 100% zoom.

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | Home page | "Legal teams still review contracts clause by clause. ContractMind turns a raw PDF into a scored, redlined, structured review in under a minute, using six cooperating AI agents." |
| 0:15 | Click the **Cargill / BioAmber** sample (a real SEC filing). Point at step 2. | "This is a real development agreement filed with the SEC. We score it against a playbook, our company's negotiating rules." |
| 0:25 | **Playbooks** → Duplicate the Buyer playbook → change one rule's weight → back to Review | "Playbooks are fully custom: every rule, weight and tolerance, shareable as JSON." |
| 0:40 | **Analyze contract**. Stay on the analysing screen. | "Six agents run as a pipeline. The Risk Auditor hands its failed rules to Opposing Counsel, who hands one-sided clauses to the Dealmaker. Obligations, a Table Vision agent and the Gold Standard benchmark run in parallel." |
| 1:00 | **Overview** → scorecard → one failing rule | "The score is not the model's guess. Each rule is judged with a verbatim quote, verified in the contract, and the maths is fixed. Here is what to do about it." |
| 1:15 | **Overview** → *How this analysis ran* | "RAG means each agent read only the sections it needed: you can see how many sections each one read, and its tokens." (Read the real numbers off the screen.) |
| 1:25 | **Redlines** → Opposing Counsel findings → a redline → expand the reasoning | "Every change says which finding it answers, and why: the other side's argument, the business risk, the legal rationale, and what to say." |
| 1:45 | **Redlines → Full document**, click a change; then **Download Word redline** | "The whole contract with every change in place, and a Word file with tracked changes for the other side's lawyers." |
| 2:00 | **Obligations → Milestones** → Calendar → **Add to calendar (.ics)** | "Payment tables are read as images by the vision agent, so nested phases survive. Dates are calculated and exported to your calendar." |
| 2:15 | **Obligations → Structured JSON** (green Valid badge) | "Obligations as JSON, validated against a published schema." |
| 2:25 | **Benchmarks** → Missing protections | "30 Gold Standard clauses are matched by similarity search; protections the contract lacks are flagged, with the wording to add." |
| 2:40 | **Library** → type: *uncapped liability under Delaware law* | "And for non-lawyers: plain-language search over 650 real contracts from CUAD and MAUD, with a cited answer." |
| 2:55 | Switch **EN → বাংলা** | "It works in English and Bangla. ContractMind." |

## Backup plan

- If the AI is slow, open a contract analysed earlier: finished analyses are saved in the browser and open instantly.
- If the network fails, the Library, playbooks, calendar and exports still work; only new AI calls need the network.
