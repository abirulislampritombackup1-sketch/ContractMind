import { GoldStandardClause } from "../types";

export const GOLD_STANDARD_CLAUSES: GoldStandardClause[] = [
  {
    id: "GS-INDEM-01",
    category: "Indemnification",
    title: "Market Mutual IP & Third-Party Indemnification",
    marketSource: "ABA Business Law Section / Tech Contracts Model Agreement",
    rationale: "Provides symmetrical protection: Provider indemnifies against IP infringement of the service; Customer indemnifies for Customer Data or unauthorized modifications.",
    standardText: `(a) Provider Indemnification. Provider shall defend, indemnify, and hold harmless Customer and its officers, directors, and employees from and against any third-party claims, suits, or proceedings alleging that Customer's authorized use of the Services infringes any patent, copyright, trademark, or misappropriates any trade secret of a third party, and shall pay all settlements agreed to in writing or damages final-adjudicated by a court of competent jurisdiction.
(b) Customer Indemnification. Customer shall defend, indemnify, and hold harmless Provider against any third-party claims arising from Customer Data uploaded or transmitted in violation of Applicable Law or third-party proprietary rights.
(c) Procedure. The indemnified party shall provide prompt written notice of any claim, grant the indemnifying party sole control of defense and settlement (provided no settlement requires an admission of liability or payment of funds without prior consent), and provide reasonable assistance at the indemnifying party's expense.`,
  },
  {
    id: "GS-LIAB-01",
    category: "Limitation of Liability",
    title: "12-Month Trailing Aggregate Fee Cap with Balanced Super-Cap",
    marketSource: "NVCA Model Legal Documents / Standard Commercial SaaS",
    rationale: "Aligns potential financial exposure with commercial value realized over the prior 12 months, with reasonable super-cap carve-outs for data security and gross negligence.",
    standardText: `(a) Consequential Damages Waiver. Except for breaches of Section 7 (Confidentiality) or indemnification obligations under Section 9, neither party shall be liable to the other for any indirect, special, incidental, punitive, or consequential damages, or loss of profits, revenue, or business opportunity, arising out of or related to this Agreement, regardless of the theory of liability.
(b) General Aggregate Cap. Except for excluded claims, each party's maximum aggregate liability arising under or related to this Agreement shall be limited to the total fees actually paid or payable by Customer to Provider in the twelve (12) month period preceding the event giving rise to the claim.
(c) Super-Cap for Data Protection Breaches. Liability arising from a material breach of Section 8 (Data Security and Privacy) shall be capped at three times (3x) the aggregate fees paid or payable in the twelve (12) months preceding the breach.`,
  },
  {
    id: "GS-TERM-01",
    category: "Termination",
    title: "Mutual Termination for Cause and 30-Day Convenience Option",
    marketSource: "EDGAR Standard Cloud Master Services Agreement",
    rationale: "Guarantees a 30-day cure window for curable breaches and permits planned exit without excessive early cancellation penalties, ensuring pro-rata refund of unearned fees.",
    standardText: `(a) Termination for Cause. Either party may terminate this Agreement immediately upon written notice if the other party: (i) materially breaches this Agreement and fails to cure such breach within thirty (30) days following receipt of written notice detailing the breach; or (ii) becomes insolvent, files for bankruptcy, or is subject to receivership.
(b) Termination for Convenience. Customer may terminate this Agreement, in whole or in part, at any time without penalty by providing at least thirty (30) days prior written notice to Provider.
(c) Effect of Termination & Pro-Rata Refund. Upon any termination for convenience by Customer or termination for cause by Customer, Provider shall promptly issue a pro-rata refund of all prepaid, unearned fees calculated from the effective date of termination through the end of the paid term.`,
  },
  {
    id: "GS-IP-01",
    category: "IP Rights",
    title: "Customer Work Product Ownership & Non-Use of Customer Data for AI Training",
    marketSource: "Enterprise AI & Cloud Best Practice Guidelines",
    rationale: "Ensures custom work product belongs to customer as work made for hire while strictly prohibiting provider from training AI foundation models on customer prompts or confidential data.",
    standardText: `(a) Work Product. All custom deliverables, reports, workflows, and specifications developed specifically for Customer under an applicable Statement of Work ('Work Product') shall constitute 'work made for hire' and belong exclusively to Customer upon payment.
(b) Customer Data & AI Model Boundaries. Customer retains all right, title, and interest in and to Customer Data. Provider shall not use Customer Data (including prompts, inputs, documents, and generated outputs) to train, fine-tune, improve, or benchmark any generalized artificial intelligence, machine learning model, or large language model without Customer's express prior written consent.
(c) Feedback License. Any voluntary feedback provided regarding the Services may be used by Provider without restriction or obligation of confidentiality.`,
  },
  {
    id: "GS-SEC-01",
    category: "Data Privacy & Security",
    title: "SOC 2 Type II Security Covenants & 48-Hour Security Breach Notification",
    marketSource: "GDPR / CCPA Enterprise Standard Data Processing Addendum",
    rationale: "Protects sensitive corporate data through certified administrative, physical, and technical safeguards, with strict timeline obligations for incident notification.",
    standardText: `(a) Security Measures. Provider shall maintain administrative, physical, and technical safeguards designed to protect the security, confidentiality, and integrity of Customer Data, including maintaining active SOC 2 Type II and ISO/IEC 27001 certifications throughout the Term.
(b) Security Incident Notification. In the event of an actual or reasonably suspected unauthorized access, acquisition, disclosure, or destruction of Customer Data ('Security Incident'), Provider shall: (i) notify Customer in writing within forty-eight (48) hours of becoming aware; (ii) promptly take all reasonable remedial actions to mitigate the impact; and (iii) provide regular status reports and cooperate fully in any required regulatory filings.
(c) Data Return & Destruction. Within thirty (30) days following termination, Provider shall, at Customer's election, securely return or cryptographically erase all Customer Data in Provider's possession and provide written certification of compliance.`,
  },
  {
    id: "GS-PAY-01",
    category: "Payment & Milestones",
    title: "Net 30 Invoicing with Milestone Acceptance Signoff",
    marketSource: "Federal & Enterprise Commercial Standard Terms",
    rationale: "Prevents unfair automatic acceptance and provides reasonable payment terms tied to verified deliverables.",
    standardText: `(a) Invoicing and Payment. Provider shall invoice Customer in accordance with the Payment Schedule set forth in Exhibit A. All undisputed amounts shall be due and payable within thirty (30) days from the date of receipt of a valid itemized invoice ('Net 30').
(b) Acceptance Period. Customer shall have fifteen (15) business days following receipt of each Milestone Deliverable to evaluate and verify compliance with agreed specifications. Payment for milestone-based deliverables is conditioned upon Customer's written signoff or verified acceptance.
(c) Dispute Protocol. Customer may withhold payment of amounts disputed in good faith upon written notice specifying the disputed sums prior to the due date. The parties shall negotiate in good faith to resolve disputed invoices within twenty (20) business days.`,
  },
];

