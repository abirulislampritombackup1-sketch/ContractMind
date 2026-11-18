# CUAD accuracy test — keyword baseline (regular expressions, no AI)

40 CUAD v1 contracts (seed 7), compared with the expert labels. Run 2026-11-18.

| | Precision | Recall | F1 |
| --- | --- | --- | --- |
| **All 12 clause types (micro)** | 77.2% | 65.2% | 70.7% |

- Governing law matches the label: **66.7%**
- Evidence quotes found verbatim in the contract: **100%**

| Clause type (CUAD) | Contracts with it | Precision | Recall | F1 |
| --- | --- | --- | --- | --- |
| Cap On Liability | 22 | 94.4% | 77.3% | 85% |
| Uncapped Liability | 10 | 57.1% | 40% | 47.1% |
| Termination For Convenience | 11 | 50% | 45.5% | 47.6% |
| Non-Compete | 11 | 100% | 36.4% | 53.3% |
| Exclusivity | 15 | 57.9% | 73.3% | 64.7% |
| Change Of Control | 11 | 60% | 54.5% | 57.1% |
| Anti-Assignment | 30 | 100% | 73.3% | 84.6% |
| Audit Rights | 15 | 100% | 73.3% | 84.6% |
| Ip Ownership Assignment | 16 | 87.5% | 43.8% | 58.3% |
| Insurance | 17 | 68% | 100% | 81% |
| Source Code Escrow | 1 | 0% | 0% | –% |
| Most Favored Nation | 2 | 100% | 50% | 66.7% |

Precision: of the clauses reported, how many CUAD's lawyers also labelled. Recall: of the labelled clauses, how many were found. "–" means there were no positive cases to measure.
