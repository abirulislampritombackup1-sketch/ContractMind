# ContractMind: pitch notes

## Problem

Contract review is slow, expensive and inconsistent. A lawyer reads every clause, compares it with the company's negotiating position from memory, marks up the document by hand, and copies deadlines and payments into a spreadsheet. Non-lawyers cannot answer simple questions such as "which of our contracts have uncapped liability?" without asking legal.

## Solution

ContractMind turns a raw contract PDF into an explained, structured review:

1. **Risk score against your own playbook.** Every rule is judged with a verbatim quote that is checked against the contract, and the score is calculated in code, so it is explainable and repeatable.
2. **Redlines that explain themselves.** An Opposing Counsel agent finds one-sided clauses, and a Commercial Dealmaker agent writes counter-offers the other side can accept. Each change gives its reasoning and a negotiation script. Output: Word with tracked changes, PDF, or the full marked-up document.
3. **Obligations you can act on.** Schema-validated JSON, and a payment calendar built by a vision agent that reads complex payment tables as images.
4. **Benchmarking with RAG.** Every clause is compared with a Gold Standard library by similarity search; missing protections are flagged with the wording to add.
5. **Answers for non-lawyers.** Plain-language search over 650 real contracts, with cited answers.

## Why it is different

The brief names Ironclad, Luminance, Spellbook, Kira and LawGeex as examples. ContractMind's angle, to set against them in the pitch:

- **Open, editable playbooks** shared as plain JSON, not locked into a vendor.
- **An explainable score**: calculated in code from rule weights and quotes verified against the contract, not a model's guess.
- **A visible multi-agent hand-off**: Opposing Counsel → Commercial Dealmaker, with each redline naming the finding it answers.
- **Reasoning and a negotiation script for every redline**, enforced (incomplete ones are completed or removed).
- **Payment tables read as images** and turned into a calendar file.
- **Bangla** interface and explanations, for markets the big tools do not serve.
- **Low cost**: runs on a Gemini free tier, no per-seat licence.

Before presenting, check each competitor's current features on their own websites and adjust the wording; this document makes no claims about what they do or do not offer.

## Proof

- Real data: 650 contracts from CUAD v1 and MAUD (SEC filings), and real samples in the app.
- Measured accuracy on CUAD's expert labels (see `docs/eval/` and the How it works page), against a keyword baseline.
- 70+ automated tests. In an offline estimate on a synthetic 60-section contract, retrieval cut the document tokens sent per analysis by about 77% (`src/rag/payload.test.ts`); measure it on a real contract with `__contractmindTokens.totals()`.

## What's next

- Run the EDGAR import to grow the repository past 5,000 contracts.
- Semantic index for the repository (one script run).
- Team playbook library and approval workflow.
