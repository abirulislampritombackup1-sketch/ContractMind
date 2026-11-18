// The three one-click samples on the Review page. They are real public contracts from the
// repository (their text is loaded from public/repository/texts when clicked).

export type RealSample = {
  id: string; // repository id
  name: string;
  nameBn: string;
  type: string;
  typeBn: string;
  badge: string;
  source: string; // where the contract was filed
  url: string; // dataset page
};

export const REAL_SAMPLES: RealSample[] = [
  {
    id: "CUAD-0242",
    name: "ASP & Outsourcing Agreement — E.piphany / High Speed Net Solutions",
    nameBn: "ASP ও আউটসোর্সিং চুক্তি — E.piphany / High Speed Net Solutions",
    type: "Hosted software (ASP / SaaS) order form · California law",
    typeBn: "হোস্টেড সফটওয়্যার (ASP / SaaS) অর্ডার ফর্ম · ক্যালিফোর্নিয়া আইন",
    badge: "EDGAR · CUAD",
    source: "SEC filing by OASYSMOBILE, Inc. (Exhibit 10.17, 2001), from CUAD v1",
    url: "https://www.atticusprojectai.org/cuad",
  },
  {
    id: "CUAD-0501",
    name: "Development Agreement — Cargill / BioAmber",
    nameBn: "ডেভেলপমেন্ট চুক্তি — Cargill / BioAmber",
    type: "Fees and milestones · Minnesota law",
    typeBn: "ফি ও মাইলস্টোন · মিনেসোটা আইন",
    badge: "EDGAR · CUAD",
    source: "SEC filing by BioAmber Inc. (Exhibit 10.34, 2013), from CUAD v1",
    url: "https://www.atticusprojectai.org/cuad",
  },
  {
    id: "MAUD-0055",
    name: "Merger Agreement — Five Prime Therapeutics acquired by Amgen",
    nameBn: "একীভূতকরণ চুক্তি — Five Prime Therapeutics, Amgen কর্তৃক অধিগ্রহণ",
    type: "Public-company merger (2021) · termination fee",
    typeBn: "পাবলিক কোম্পানি একীভূতকরণ (২০২১) · টার্মিনেশন ফি",
    badge: "EDGAR · MAUD",
    source: "Merger agreement filed with the SEC (2021), from MAUD",
    url: "https://github.com/TheAtticusProject/maud",
  },
];
