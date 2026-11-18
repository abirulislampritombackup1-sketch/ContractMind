// Bangla display text for the built-in data (playbooks, samples, library) and for the
// fixed labels the AI returns (severity, status, party roles...). Display only: the
// English originals are still what is sent to the AI, so analysis behaviour is unchanged.

import { Playbook, PlaybookRule } from "../types";
import { DEFAULT_PLAYBOOKS } from "../data/playbooks";

/** Fixed labels → Bangla. Looked up by exact English value. */
export const TERMS_BN: Record<string, string> = {
  // Risk / severity
  Critical: "গুরুতর",
  High: "উচ্চ",
  Medium: "মাঝারি",
  Low: "কম",
  // Category status
  "Critical Deviation": "গুরুতর বিচ্যুতি",
  Warning: "সতর্কতা",
  Pass: "উত্তীর্ণ",
  Fail: "ব্যর্থ",
  Partial: "আংশিক",
  // Obligations
  Active: "সক্রিয়",
  Pending: "অপেক্ষমাণ",
  Completed: "সম্পন্ন",
  Vendor: "ভেন্ডর",
  Customer: "গ্রাহক",
  Mutual: "উভয় পক্ষ",
  Buyer: "ক্রেতা",
  Seller: "বিক্রেতা",
  Scheduled: "নির্ধারিত",
  Conditional: "শর্তসাপেক্ষ",
  Paid: "পরিশোধিত",
  Overdue: "বকেয়া",
  "One-time": "একবার",
  Monthly: "মাসিক",
  Quarterly: "ত্রৈমাসিক",
  Annually: "বার্ষিক",
  Annual: "বার্ষিক",
  Ongoing: "চলমান",
  "Trigger-based": "ঘটনা-নির্ভর",
  "Third Party": "তৃতীয় পক্ষ",
  "Pending Review": "পর্যালোচনা বাকি",
  Continuous: "চলমান",
  "Delivery & Milestones": "ডেলিভারি ও মাইলস্টোন",
  "Payment & Financial": "পেমেন্ট ও আর্থিক",
  "Reporting & Notice": "রিপোর্টিং ও নোটিশ",
  "Compliance & Security": "কমপ্লায়েন্স ও নিরাপত্তা",
  "Termination & Transition": "বাতিল ও হস্তান্তর",
  // Agents
  "In-House Counsel": "ইন-হাউস কাউন্সেল",
  "Opposing Counsel": "প্রতিপক্ষ আইনজীবী",
  "Commercial Dealmaker": "বাণিজ্যিক ডিলমেকার",
  // Playbook rule categories
  Indemnification: "ক্ষতিপূরণ",
  "Liability Cap": "দায়সীমা",
  Termination: "চুক্তি বাতিল",
  "IP Rights": "মেধাস্বত্ব",
  "Data Privacy": "ডেটা গোপনীয়তা",
  "Payment & Milestones": "পেমেন্ট ও মাইলস্টোন",
  // Library
  "SaaS & Cloud Agreement": "SaaS ও ক্লাউড চুক্তি",
  "Master Services Agreement (MSA)": "মাস্টার সার্ভিসেস চুক্তি (MSA)",
  "Asset Purchase (M&A)": "সম্পদ ক্রয় (একীভূতকরণ ও অধিগ্রহণ)",
  "Software License": "সফটওয়্যার লাইসেন্স",
  "Unilateral (Customer only)": "একতরফা (শুধু গ্রাহক)",
  Delaware: "ডেলাওয়্যার",
  "New York": "নিউ ইয়র্ক",
  Texas: "টেক্সাস",
  California: "ক্যালিফোর্নিয়া",
  Florida: "ফ্লোরিডা",
  Illinois: "ইলিনয়",
  "France (Paris Court of Appeal)": "ফ্রান্স (প্যারিস আপিল আদালত)",
  All: "সব",
};

type PlaybookBn = { name: string; description: string; badge: string };
export const PLAYBOOKS_BN: Record<string, PlaybookBn> = {
  "buyer-defense": {
    name: "এন্টারপ্রাইজ ক্রেতা / গ্রাহক সুরক্ষা",
    badge: "ক্রেতা সুরক্ষা",
    description: "এন্টারপ্রাইজ ক্রেতাদের জন্য কঠোর ঝুঁকি নিয়ন্ত্রণ: দায়সীমা ফি-র ১–২ গুণ, পারস্পরিক বা ভেন্ডর-প্রধান ক্ষতিপূরণ, ৩০ দিনের নোটিশে ইচ্ছাধীন বাতিল এবং কঠোর মেধাস্বত্ব মালিকানা।",
  },
  "vendor-shield": {
    name: "ভেন্ডর / প্রোভাইডার বাণিজ্যিক সুরক্ষা",
    badge: "ভেন্ডর সুরক্ষা",
    description: "SaaS প্রোভাইডার ও এজেন্সির জন্য: মুনাফা রক্ষা, পরোক্ষ ক্ষতির দায় অস্বীকার, মেধাস্বত্ব ওয়ারেন্টি সীমিত এবং দ্রুত পেমেন্ট নিশ্চিত করে।",
  },
  "balanced-tech": {
    name: "ভারসাম্যপূর্ণ বাজার মান (প্রযুক্তি চুক্তি)",
    badge: "ভারসাম্যপূর্ণ",
    description: "শিল্পখাতের প্রচলিত নির্দেশিকা (ABA ও প্রযুক্তি চুক্তির সেরা চর্চা): ন্যায্য ঝুঁকি বণ্টন, পারস্পরিক ক্ষতিপূরণ এবং বাস্তবসম্মত শর্ত।",
  },
  "high-growth-saas": {
    name: "দ্রুত বর্ধনশীল এন্টারপ্রাইজ SaaS ও এআই নীতি",
    badge: "এআই ও ক্লাউড মান",
    description: "এআই-ভিত্তিক প্ল্যাটফর্ম, বড় এন্টারপ্রাইজ গ্রাহক ও মাল্টি-টেন্যান্ট ক্লাউডের জন্য: মডেল প্রশিক্ষণের অধিকার, অ্যালগরিদমের মেধাস্বত্ব, SLA এবং সাবপ্রসেসর কমপ্লায়েন্স নিয়ন্ত্রণ করে।",
  },
  "custom-playbook": {
    name: "কাস্টম এন্টারপ্রাইজ নেগোসিয়েশন নীতি",
    badge: "কাস্টম নীতি",
    description: "আপনার প্রতিষ্ঠানের জন্য ঝুঁকি সহনসীমা, দায়সীমা ও কমপ্লায়েন্স নিয়ম নিজের মতো সাজান।",
  },
};

type RuleBn = { title: string; targetStandard: string; unacceptableTerms: string[] };
export const RULES_BN: Record<string, RuleBn> = {
  "R-INDEM-01": {
    title: "ভেন্ডরের মেধাস্বত্ব ও লঙ্ঘনজনিত ক্ষতিপূরণ",
    targetStandard: "তৃতীয় পক্ষের মেধাস্বত্ব লঙ্ঘন, ডেটা লঙ্ঘন ও গুরুতর অবহেলার জন্য ভেন্ডর নিঃশর্তভাবে গ্রাহককে ক্ষতিপূরণ দেবে, কোনো ঊর্ধ্বসীমা ছাড়া।",
    unacceptableTerms: ["পণ্য ব্যবহারের জন্য গ্রাহক ভেন্ডরকে ক্ষতিপূরণ দেবে", "গ্রাহকের সীমাহীন দায়", "ভেন্ডর মেধাস্বত্ব ক্ষতিপূরণ অস্বীকার করে"],
  },
  "R-LIAB-01": {
    title: "সমান দায়সীমা",
    targetStandard: "মোট দায় ১২ মাসে পরিশোধিত ফি পর্যন্ত সীমিত; মেধাস্বত্ব, গোপনীয়তা ও ডেটা লঙ্ঘনের জন্য প্রচলিত সীমাহীন ব্যতিক্রম।",
    unacceptableTerms: ["শুধু ভেন্ডরের জন্য সীমাহীন দায়ের ব্যতিক্রম", "নামমাত্র দায়সীমা ($৫,০০০ বা ১ মাসের ফি)", "সব প্রত্যক্ষ ক্ষতির দায় অস্বীকার"],
  },
  "R-TERM-01": {
    title: "ইচ্ছাধীন ও কারণবশত চুক্তি বাতিল",
    targetStandard: "গ্রাহক ৩০ দিনের লিখিত নোটিশে ইচ্ছাধীন বাতিল করতে পারবে এবং অগ্রিম ফি-র আনুপাতিক অংশ ফেরত পাবে।",
    unacceptableTerms: ["ইচ্ছাধীন বাতিলের সুযোগ নেই", "৬০ দিনের অনুস্মারক ছাড়া স্বয়ংক্রিয় নবায়ন", "আগাম বাতিলে সব অগ্রিম ফি বাজেয়াপ্ত"],
  },
  "R-IP-01": {
    title: "গ্রাহকের কাজের মালিকানা",
    targetStandard: "সব কাস্টম ডেলিভারেবল ও গ্রাহকের ডেটা 'Work Made for Hire' হিসেবে শুধু গ্রাহকের সম্পত্তি থাকবে।",
    unacceptableTerms: ["গ্রাহকের ডেটা বা তা থেকে তৈরি বিশ্লেষণের মালিক ভেন্ডর", "সম্মতি ছাড়া গ্রাহকের ট্রেডমার্ক দিয়ে বিপণনের ব্যাপক লাইসেন্স"],
  },
  "R-PRIV-01": {
    title: "নিরাপত্তা ও ২৪ ঘণ্টায় লঙ্ঘনের নোটিশ",
    targetStandard: "নিরাপত্তা লঙ্ঘন হলে ভেন্ডর ২৪–৪৮ ঘণ্টার মধ্যে গ্রাহককে জানাবে এবং SOC 2 Type II / ISO 27001 মেনে চলবে।",
    unacceptableTerms: ["সময়সীমা ছাড়া 'বাণিজ্যিকভাবে সম্ভব হলে' নোটিশ", "ডেটা হারানো বা র‍্যানসমওয়্যারের দায় অস্বীকার"],
  },
  "R-PAY-01": {
    title: "গ্রহণযোগ্যতা-ভিত্তিক মাইলস্টোন ও নেট ৪৫",
    targetStandard: "মাইলস্টোন সম্পন্ন যাচাই ও লিখিত অনুমোদনের পর ৪৫ দিনের মধ্যে পেমেন্ট।",
    unacceptableTerms: ["অফেরতযোগ্য অগ্রিম পেমেন্ট", "৫ দিনের মধ্যে স্বয়ংক্রিয় গ্রহণ ধরে নেওয়া", "অতিরিক্ত বিলম্ব সুদ (মাসে ১.৫%-এর বেশি)"],
  },
  "R-V-LIAB-01": {
    title: "গত ১২ মাসের ফি-ভিত্তিক দৃঢ় দায়সীমা",
    targetStandard: "ভেন্ডরের মোট দায় আগের ১২ মাসে প্রকৃত প্রাপ্ত অর্থ পর্যন্ত সীমিত; পরোক্ষ ক্ষতির দায় সম্পূর্ণ মওকুফ।",
    unacceptableTerms: ["ভেন্ডরের সীমাহীন দায়", "হারানো মুনাফার ক্ষতিপূরণ", "এমন ব্যতিক্রম যা দায়সীমাকেই অকার্যকর করে"],
  },
  "R-V-INDEM-01": {
    title: "সীমিত পরিসরের মেধাস্বত্ব ক্ষতিপূরণ",
    targetStandard: "দ্রুত নোটিশ, প্রতিরক্ষার একক নিয়ন্ত্রণ ও সফটওয়্যার বদলানো/সংশোধনের অধিকার সাপেক্ষে ভেন্ডর লঙ্ঘনের দাবি মোকাবিলা করবে।",
    unacceptableTerms: ["গ্রাহকের শিল্পখাতের নিয়ম মানা পর্যন্ত বিস্তৃত ক্ষতিপূরণ", "ভেন্ডরের সম্মতি ছাড়া গ্রাহকের মীমাংসার অধিকার"],
  },
  "R-V-TERM-01": {
    title: "প্রতিশ্রুত মেয়াদ ও স্বয়ংক্রিয় নবায়ন",
    targetStandard: "প্রাথমিক মেয়াদে ইচ্ছাধীন বাতিল করা যাবে না; নবায়নের ৩০ দিন আগে নোটিশ না দিলে স্বয়ংক্রিয় নবায়ন।",
    unacceptableTerms: ["সাবস্ক্রিপশন ফি ফেরতসহ তাৎক্ষণিক ইচ্ছাধীন বাতিল", "গ্রাহকের একতরফা স্থগিতের অধিকার"],
  },
  "R-V-IP-01": {
    title: "ভেন্ডরের SaaS মেধাস্বত্ব ও সমষ্টিগত ব্যবহার-তথ্য",
    targetStandard: "সফটওয়্যার এবং পরিচয়হীন সমষ্টিগত ব্যবহার-বিশ্লেষণের সব অধিকার ভেন্ডরের থাকবে।",
    unacceptableTerms: ["প্ল্যাটফর্ম কোড বা API মডেলের মালিক গ্রাহক", "গুরুতর দেউলিয়াত্বের শর্ত ছাড়া সোর্স কোড এসক্রো"],
  },
  "R-V-PAY-01": {
    title: "দ্রুত নেট ৩০ ও সেবা স্থগিতের অধিকার",
    targetStandard: "৩০ দিনে পেমেন্ট; নোটিশের পর ইনভয়েস ১৫ দিন বকেয়া থাকলে সেবা স্থগিতের অধিকার।",
    unacceptableTerms: ["মধ্যস্থতা ছাড়াই বিতর্কিত ফি আটকে রাখার অধিকার", "৯০ দিনের দীর্ঘ পেমেন্ট মেয়াদ"],
  },
  "R-B-INDEM-01": {
    title: "মেধাস্বত্ব ও গুরুতর অবহেলায় পারস্পরিক ক্ষতিপূরণ",
    targetStandard: "মেধাস্বত্ব লঙ্ঘনে ভেন্ডর গ্রাহককে, গ্রাহকের ডেটার জন্য গ্রাহক ভেন্ডরকে ক্ষতিপূরণ দেবে; গুরুতর অবহেলায় পারস্পরিক ক্ষতিপূরণ।",
    unacceptableTerms: ["একতরফা, অপারস্পরিক ক্ষতিপূরণ", "সাধারণ অবহেলার জন্য ক্ষতিপূরণ"],
  },
  "R-B-LIAB-01": {
    title: "পারস্পরিক ১২ মাসের দায়সীমা ও ভারসাম্যপূর্ণ উচ্চসীমা",
    targetStandard: "সাধারণ দায়সীমা ১২ মাসের পরিশোধিত ফি; গোপনীয়তা ও ডেটা সুরক্ষা লঙ্ঘনে ফি-র ২ গুণ উচ্চসীমা।",
    unacceptableTerms: ["সীমাহীন একতরফা ঝুঁকি", "গোপনীয়তা লঙ্ঘনের দায় সম্পূর্ণ অস্বীকার"],
  },
  "R-B-TERM-01": {
    title: "পারস্পরিক ৬০ দিনের নোটিশ ও গুরুতর লঙ্ঘন সংশোধন",
    targetStandard: "গুরুতর লঙ্ঘন সংশোধনে ৩০ দিন; ইচ্ছাধীন বাতিলে ৬০ দিনের নোটিশ ও আনুপাতিক নিষ্পত্তি।",
    unacceptableTerms: ["সংশোধনযোগ্য লঙ্ঘনে সংশোধনের সময় না দেওয়া", "বের হওয়ার উপায় ছাড়া স্থায়ী বাধ্যবাধকতা"],
  },
  "R-B-PRIV-01": {
    title: "প্রচলিত SOC2 / GDPR মান অনুসরণ",
    targetStandard: "প্রচলিত ডেটা প্রসেসিং চুক্তি (DPA); ৪৮ ঘণ্টায় নিরাপত্তা ঘটনার নোটিশ; চাইলে বার্ষিক SOC 2 Type II অডিট রিপোর্ট।",
    unacceptableTerms: ["ডেটা প্রসেসিং চুক্তি নেই", "তৃতীয় পক্ষের অডিট সনদ দিতে অস্বীকৃতি"],
  },
  "R-B-PAY-01": {
    title: "প্রচলিত নেট ৩০ শর্ত",
    targetStandard: "ইনভয়েসের তারিখ থেকে ৩০ দিনের মধ্যে পরিশোধ; বিতর্কিত অর্থ সরল বিশ্বাসে রেখে দ্রুত নিষ্পত্তি।",
    unacceptableTerms: ["নোটিশ ছাড়া একবার দেরিতে পেমেন্টেই তাৎক্ষণিক বাতিল"],
  },
  "R-AI-01": {
    title: "এআই প্রশিক্ষণ ও মডেল ডেটার সীমা",
    targetStandard: "ভেন্ডর স্পষ্টভাবে অঙ্গীকার করবে যে লিখিত অনুমতি ছাড়া গ্রাহকের ডেটা কখনো সাধারণ ফাউন্ডেশন মডেল প্রশিক্ষণে ব্যবহার হবে না।",
    unacceptableTerms: ["সাধারণ মডেল প্রশিক্ষণে গ্রাহকের গোপন প্রম্পট ব্যবহারের ব্যাপক লাইসেন্স", "গ্রাহকের প্রম্পটের ফলাফলের মালিক ভেন্ডর"],
  },
  "R-AI-02": {
    title: "উচ্চ প্রাপ্যতার SLA ও আপটাইম অঙ্গীকার",
    targetStandard: "মাসিক ৯৯.৯% আপটাইমের নিশ্চয়তা, সাথে ধাপে ধাপে বাড়া সার্ভিস ক্রেডিট (১০% থেকে ৫০%)।",
    unacceptableTerms: ["আর্থিক ক্রেডিট ছাড়া 'সর্বোচ্চ চেষ্টা' প্রাপ্যতা", "একমাত্র প্রতিকার ফেরত ছাড়া চুক্তি বাতিল"],
  },
  "R-AI-03": {
    title: "ডেটা/মেধাস্বত্ব দাবির জন্য এন্টারপ্রাইজ উচ্চসীমা",
    targetStandard: "প্রচলিত দায়সীমা বার্ষিক আয়ের ১ গুণ; গুরুতর অবহেলা, ইচ্ছাকৃত অসদাচরণ ও নিরাপত্তা লঙ্ঘনে ৩ গুণ উচ্চসীমা।",
    unacceptableTerms: ["কোটি টাকার প্রকল্পে মাত্র $১০,০০০ দায়সীমা", "ইচ্ছাকৃত ডেটা ফাঁসেও পরোক্ষ ক্ষতির দায় সম্পূর্ণ মওকুফ"],
  },
  "R-AI-04": {
    title: "সাবপ্রসেসর স্বচ্ছতা ও ২৪ ঘণ্টায় ঘটনা মোকাবিলা",
    targetStandard: "সাবপ্রসেসরের প্রকাশ্য তালিকা ও পরিবর্তনের ৩০ দিন আগে নোটিশ; ২৪ ঘণ্টার মধ্যে নিরাপত্তা ঘটনার নোটিশ।",
    unacceptableTerms: ["গ্রাহকের আপত্তির সুযোগ ছাড়া তৃতীয় পক্ষ সাবপ্রসেসরে অবাধ দায়িত্ব হস্তান্তর"],
  },
  "R-AI-05": {
    title: "বার্ষিক অগ্রিম বা মাইলস্টোন-ভিত্তিক বিলিং",
    targetStandard: "নেট ৩০ শর্তে বার্ষিক অগ্রিম পেমেন্ট, অথবা বাস্তবায়ন সেবার জন্য স্পষ্ট ধাপভিত্তিক মাইলস্টোন পেমেন্ট।",
    unacceptableTerms: ["আইনি সীমার বেশি কঠোর বিলম্ব ফি"],
  },
};

export const SAMPLES_BN: Record<string, { name: string; type: string }> = {
  "sample-edgar-cloud-msa": { name: "EDGAR এন্টারপ্রাইজ ক্লাউড SaaS চুক্তি (উচ্চ ঝুঁকির ফাঁদ)", type: "ক্লাউড মাস্টার সার্ভিসেস চুক্তি" },
  "sample-maud-merger-asset": { name: "MAUD সম্পদ ক্রয় ও মাইলস্টোন আর্নআউট চুক্তি", type: "সম্পদ ক্রয় ও আর্নআউট চুক্তি" },
  "sample-cuad-vendor-standard": { name: "CUAD বাছাই করা উচ্চ ঝুঁকির ভেন্ডর স্টেটমেন্ট অব ওয়ার্ক", type: "ভেন্ডর স্টেটমেন্ট অব ওয়ার্ক" },
};


/** Bangla view of a playbook (for display only). */
export function playbookText(pb: Playbook, bn: boolean): PlaybookBn {
  const t = bn ? PLAYBOOKS_BN[pb.id] : undefined;
  return t ?? { name: pb.name, description: pb.description, badge: pb.badge };
}

export function ruleText(rule: PlaybookRule, bn: boolean): RuleBn {
  const t = bn ? RULES_BN[rule.id] : undefined;
  return t ?? { title: rule.title, targetStandard: rule.targetStandard, unacceptableTerms: rule.unacceptableTerms };
}

/** Bangla name for a built-in playbook named in a result (other names are shown as is). */
export function playbookLabel(name: string, bn: boolean): string {
  const pb = DEFAULT_PLAYBOOKS.find((p) => p.name === name);
  return pb ? playbookText(pb, bn).name : name;
}
