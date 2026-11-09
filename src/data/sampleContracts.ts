export type SampleContract = {
  id: string;
  name: string;
  type: string;
  badge: string;
  description: string;
  expectedRisk: "High" | "Medium" | "Critical";
  text: string;
};

export const SAMPLE_CONTRACTS: SampleContract[] = [
  {
    id: "sample-edgar-cloud-msa",
    name: "EDGAR Enterprise Cloud SaaS Agreement (High Risk Traps)",
    type: "Cloud Master Services Agreement",
    badge: "EDGAR / SEC",
    expectedRisk: "Critical",
    description: "Real-world inspired SEC EDGAR filing with severe risks: one-sided customer indemnification, $1,000 liability cap, 5-day auto-acceptance, and non-negotiable auto-renewal.",
    text: `MASTER CLOUD SERVICES AND PLATFORM LICENSE AGREEMENT

This Master Cloud Services and Platform License Agreement ("Agreement") is entered into as of October 12, 2024 ("Effective Date"), by and between NEXUSTECH CLOUD ENTERPRISE INC., a Delaware corporation with its principal place of business at 100 Tech Horizon Blvd, San Jose, CA 95110 ("Provider" or "Vendor"), and APEX RETAIL VENTURES LLC, a California limited liability company ("Customer").

RECITALS
WHEREAS, Provider operates a proprietary enterprise resource and predictive cloud software platform; and
WHEREAS, Customer desires to license the platform and engage Provider for cloud hosting and professional implementation services.

NOW, THEREFORE, the parties agree as follows:

SECTION 1. DEFINITIONS AND LICENSE GRANT
1.1 License. Provider hereby grants to Customer a non-exclusive, non-transferable, revocable license to access and use the Cloud Platform solely for Customer's internal business operations during the Term.
1.2 Restrictions. Customer shall not reverse engineer, decompile, or create derivative works. Provider retains all right, title, and interest in and to the platform, including any custom scripts, configuration data, and improvements generated during the engagement.

SECTION 2. PROFESSIONAL SERVICES AND PAYMENT MILESTONE SCHEDULE
2.1 Milestones and Deliverables. Provider shall deliver the implementation phases in accordance with the following table:

[TABLE: IMPLEMENTATION AND PAYMENT MILESTONES]
| Milestone ID | Phase Description | Target Completion Date | Milestone Payment | Deliverable Acceptance Criteria |
| M-101 | Architecture Design & Schema Config | 30 Days Post-Effective Date | $35,000.00 | Technical blueprint sign-off or 5 days of delivery |
| M-102 | Data Migration & Core Integration | 60 Days Post-Effective Date | $55,000.00 | Successful ingestion of 100,000 historical customer records |
| M-103 | User Acceptance Testing (UAT) & Staging | 90 Days Post-Effective Date | $40,000.00 | Completion of test test scripts without Sev-1 defects |
| M-104 | Production Cutover & Go-Live | 120 Days Post-Effective Date | $50,000.00 | Successful system deployment and 48 hours stable uptime |
| M-105 | Post-Launch Warranty & Optimization | 150 Days Post-Effective Date | $20,000.00 | Final documentation delivery and administrator training |

2.2 Payment Terms. All invoices are due Net 15 days upon receipt. Any invoice unpaid after 15 days shall accrue interest at the maximum statutory rate of 2.0% per month compounded daily.
2.3 Deemed Acceptance. Any milestone deliverable submitted by Provider shall be deemed automatically and irrevocably accepted by Customer unless Customer delivers detailed written rejection within five (5) business days of delivery.

SECTION 3. TERM, TERMINATION, AND AUTO-RENEWAL
3.1 Term. The initial term of this Agreement shall be thirty-six (36) months from the Effective Date ("Initial Term").
3.2 Automatic Renewal. This Agreement shall automatically renew for successive twelve (12) month terms unless Customer provides written notice of non-renewal at least one hundred and twenty (120) days prior to the expiration of the then-current term.
3.3 Termination for Cause. Provider may terminate this Agreement immediately upon written notice if Customer fails to pay any sum within ten (10) days of the due date.
3.4 No Termination for Convenience. Customer expressly waives any right to terminate this Agreement for convenience. In the event Customer attempts early cancellation, all unpaid fees for the remainder of the 36-month term shall accelerate and become immediately due and payable as liquidated damages.

SECTION 4. INTELLECTUAL PROPERTY AND ARTIFICIAL INTELLIGENCE TRAINING
4.1 Ownership. Provider shall own all intellectual property rights in any custom software, algorithms, workflows, or integrations created under this Agreement.
4.2 Platform Telemetry and Model Ingestion. Customer grants Provider an irrevocable, perpetual, royalty-free, worldwide license to ingest, process, and use all Customer Data, input prompts, document contents, and transactional metadata to train, enhance, and commercialize Provider's machine learning, artificial intelligence, and automated legal reasoning models.

SECTION 5. INDEMNIFICATION (UNILATERAL)
5.1 Customer Indemnification. Customer shall defend, indemnify, and hold harmless Provider, its affiliates, directors, officers, and employees against any and all third-party claims, liabilities, losses, damages, legal fees, and regulatory penalties arising out of or related to: (a) Customer's use or misuse of the Cloud Platform; (b) any allegation that Customer Data infringes third-party rights; or (c) any violation of applicable laws by Customer.
5.2 Provider Indemnification Disclaimer. PROVIDER EXPRESSLY DISCLAIMS ANY OBLIGATION TO INDEMNIFY OR DEFEND CUSTOMER AGAINST THIRD-PARTY CLAIMS ALLEGING INTELLECTUAL PROPERTY INFRINGEMENT OR PATENT VIOLATIONS ARISING FROM THE CLOUD PLATFORM. CUSTOMER ASSUMES ALL RISK OF THIRD-PARTY INFRINGEMENT CLAIMS.

SECTION 6. LIMITATION OF LIABILITY AND DAMAGES EXCLUSION
6.1 Waiver of Consequential Damages. TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL PROVIDER BE LIABLE TO CUSTOMER FOR ANY SPECIAL, INDIRECT, INCIDENTAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES, LOSS OF PROFITS, LOSS OF REVENUE, OR DATA LOSS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH LOSS.
6.2 Token Aggregate Liability Cap. PROVIDER'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT UNDER ANY LEGAL THEORY (WHETHER IN CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE) SHALL BE STRICTLY LIMITED TO THE LESSER OF: (A) ONE THOUSAND DOLLARS ($1,000.00); OR (B) THE FEES ACTUALLY PAID BY CUSTOMER IN THE PRECEDING ONE (1) MONTH.
6.3 Customer Liability Uncapped. Customer's indemnification obligations under Section 5.1 and liability for breach of Section 1 or payment obligations shall remain completely uncapped and unlimited.

SECTION 7. DATA PRIVACY, SECURITY, AND AUDIT RIGHTS
7.1 Security Safeguards. Provider shall implement commercially reasonable technical measures. Provider does not warrant that the Cloud Platform will be error-free or immune from security incidents or ransomware attacks.
7.2 Security Incident Notice. In the event of a verified breach of Customer Data, Provider shall make reasonable efforts to inform Customer within twenty-one (21) calendar days following completion of Provider's internal forensic investigation.
7.3 No Audit Rights. Customer shall not have the right to audit Provider's systems, data centers, source code, or SOC 2 reports without Provider's prior written consent and payment of a $10,000 audit facilitation fee.

SECTION 8. GOVERNING LAW AND EXCLUSIVE JURISDICTION
8.1 Governing Law. This Agreement shall be governed by the laws of the State of Delaware, without regard to its conflict of law principles. Any dispute arising out of this Agreement shall be submitted to binding arbitration in San Jose, California under AAA rules, with each party bearing its own legal fees.

IN WITNESS WHEREOF, the parties hereto have executed this Agreement by their duly authorized representatives.

NEXUSTECH CLOUD ENTERPRISE INC.
By: /s/ Marcus Sterling
Name: Marcus Sterling
Title: Chief Commercial Officer

APEX RETAIL VENTURES LLC
By: /s/ Sarah Jenkins
Name: Sarah Jenkins
Title: Vice President of Technology`,
  },
  {
    id: "sample-maud-merger-asset",
    name: "MAUD M&A Asset Purchase & Milestone Earnout Agreement",
    type: "Asset Purchase & Earnout Agreement",
    badge: "MAUD / M&A",
    expectedRisk: "Medium",
    description: "Merger & Acquisition agreement featuring complex earnout milestone tables, working capital adjustments, escrow releases, and cross-border indemnity baskets.",
    text: `ASSET PURCHASE AND REVENUE MILESTONE EARNOUT AGREEMENT

This Asset Purchase and Revenue Milestone Earnout Agreement ("Agreement") is dated as of August 14, 2024, by and between BIOCARE PHARMACEUTICAL HOLDINGS CORP., a Delaware corporation ("Buyer"), and GENELABS DIAGNOSTICS INC., a Massachusetts corporation ("Seller").

RECITALS
WHEREAS, Seller owns proprietary bioinformatics clinical assets, intellectual property, and laboratory inventory; and
WHEREAS, Buyer desires to acquire said assets subject to conditional earnout payments tied to regulatory approvals and commercial milestones.

NOW, THEREFORE, the parties agree as follows:

ARTICLE 1. PURCHASE PRICE AND PAYMENT MILESTONE CALENDAR
1.1 Initial Cash Consideration. Buyer shall pay to Seller at Closing an initial cash sum of Twelve Million Five Hundred Thousand Dollars ($12,500,000.00), subject to post-closing working capital reconciliation.
1.2 Earnout Milestone Table. In addition to the Initial Cash Consideration, Buyer shall disburse conditional earnout payments upon verified completion of the following milestones:

[TABLE: EARNOUT AND REGULATORY MILESTONES]
| Milestone ID | Regulatory / Revenue Trigger Event | Target Deadline | Earnout Sum | Verification & Audit Requirement |
| EM-201 | FDA 510(k) Clearance for Diagnostic Chip | Within 9 Months of Closing | $3,500,000.00 | Formal FDA written clearance notice submission |
| EM-202 | CE Mark Certification for EU Distribution | Within 12 Months of Closing | $2,000,000.00 | EU Notified Body ISO 13485 certification audit |
| EM-203 | Cumulative Net Sales exceeding $20,000,000 | Within 24 Months of Closing | $4,500,000.00 | Independent certified auditor revenue statement |
| EM-204 | Successful Commercial Launch in Japan (PMDA) | Within 30 Months of Closing | $1,500,000.00 | First commercial invoice to Japanese distributor |

1.3 Dispute of Earnout Milestones. If Buyer determines in good faith that a Milestone Event has not been achieved, Buyer shall provide written notice within fifteen (15) days. An independent forensic accounting referee shall resolve any dispute within forty-five (45) days.

ARTICLE 2. INDEMNIFICATION BASKETS AND ESCROW HOLDBACK
2.1 Indemnity Escrow. At Closing, Buyer shall deposit One Million Two Hundred Fifty Thousand Dollars ($1,250,000.00) (the "Indemnity Escrow Fund") with JPMorgan Chase Bank, N.A. to secure Seller's indemnification obligations.
2.2 Deductible Basket. Seller shall not have any indemnification liability until the total aggregate losses incurred by Buyer exceed Two Hundred Thousand Dollars ($200,000.00) (the "Deductible Basket"), after which Seller shall be liable for all losses in excess of such amount.
2.3 Cap on Indemnification. Seller's aggregate indemnification liability for breach of non-fundamental representations shall be strictly limited to the Indemnity Escrow Fund. Breaches of Fundamental Representations (Title, Authority, Tax) shall be capped at the total Purchase Price.

ARTICLE 3. POST-CLOSING COVENANTS AND NON-SOLICITATION
3.1 Transition Services. Seller shall provide transitional IT and laboratory consulting services for ninety (90) days post-Closing at the agreed rate of $250 per hour.
3.2 Non-Solicitation. For a period of thirty-six (36) months post-Closing, Seller shall not solicit or hire any key research personnel transferred to Buyer under this Agreement.

IN WITNESS WHEREOF, Buyer and Seller have executed this Agreement as of the date first above written.`,
  },
  {
    id: "sample-cuad-vendor-standard",
    name: "CUAD Curated High-Exposure Vendor Statement of Work",
    type: "Vendor Statement of Work",
    badge: "CUAD v1 Dataset",
    expectedRisk: "High",
    description: "Curated from CUAD v1 benchmark: aggressive non-compete clauses, broad customer indemnity, unannounced rate inflation, and no right to audit.",
    text: `GLOBAL MASTER VENDOR STATEMENT OF WORK AND SERVICES CONTRACT

This Statement of Work ("SOW") is made effective May 3, 2024, between QUANTUM LOGIX PARTNERS LLC ("Vendor") and METRO ENTERPRISE SERVICES GROUP ("Client").

SECTION 1. ENGAGEMENT AND RATES
Vendor will provide enterprise architectural consulting and AI workflow integration. Rates are billed at $320 per hour. Vendor reserves the right to increase hourly billable rates by up to 15% annually without prior approval.

SECTION 2. PAYMENT OBLIGATIONS AND PENALTIES
Client shall remit payment within fourteen (14) calendar days of invoice date. Late payments accrue interest at 1.75% per month. If payment is delayed past 30 days, Vendor may immediately suspend all platform services and retain all client repository backups as collateral.

SECTION 3. INTELLECTUAL PROPERTY RIGHTS
Client acknowledges that all reusable frameworks, pipeline architecture, and system blueprints developed during this project remain the sole and exclusive property of Vendor. Client receives a non-exclusive revocable internal license conditioned upon zero outstanding invoice balances.

SECTION 4. RESTRICTIVE COVENANTS AND NON-COMPETITION
Client agrees that during the term of this contract and for a period of twenty-four (24) months following termination, Client shall not engage, hire, or partner with any competing service provider offering automated machine-learning pipeline consulting in North America.

SECTION 5. INDEMNIFICATION AND LIABILITY
Client agrees to defend, indemnify, and hold harmless Vendor against any third-party claims arising from deployment of deliverables. Vendor disclaims all express or implied warranties. Vendor aggregate liability shall not exceed the fees paid in the immediately preceding 30 days.`,
  },
];

