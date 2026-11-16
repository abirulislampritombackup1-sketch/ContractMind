// Muslim (Sunni/Hanafi) inheritance for the common family: spouse, sons, daughters, father, mother.
// Not covered: grandchildren of a dead child, siblings, grandparents, debts/wills. The UI warns about this.
export type Fr = { n: number; d: number };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const fr = (n: number, d = 1): Fr => { const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const add = (a: Fr, b: Fr) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Fr, b: Fr) => fr(a.n * b.n, a.d * b.d);
const div = (a: Fr, b: Fr) => fr(a.n * b.d, a.d * b.n);
const sub = (a: Fr, b: Fr) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
export const fmt = (f: Fr) => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);

export type Input = { deceasedMale: boolean; spouses: number; sons: number; daughters: number; father: boolean; mother: boolean; siblings: number };
export type Row = { who: string; count: number; total: Fr; each: Fr; why: string };
export type Result = { ok: boolean; message?: string; rows: Row[]; notes: string[] };

export function faraid(i: Input): Result {
  const rows: Row[] = [], notes: string[] = [];
  const hasChild = i.sons + i.daughters > 0;
  if (i.spouses < 0 || i.sons < 0 || i.daughters < 0 || i.siblings < 0) return { ok: false, message: "সংখ্যা ঋণাত্মক হতে পারে না।", rows, notes };
  if (!hasChild && !i.father) return { ok: false, message: "সন্তান ও পিতা না থাকলে ভাই-বোন, দাদা-দাদি বা অন্য আত্মীয়ও ওয়ারিশ হতে পারেন। এই ক্ষেত্রে এই হিসাব কাজ করে না, ইউনিয়ন পরিষদ বা আইনজীবীর সাথে কথা বলুন।", rows, notes };
  if (!i.deceasedMale && i.spouses > 1) return { ok: false, message: "স্বামী একজনই হতে পারেন।", rows, notes };
  if (i.deceasedMale && i.spouses > 4) return { ok: false, message: "স্ত্রীর সংখ্যা ৪-এর বেশি হতে পারে না।", rows, notes };

  type S = { key: string; who: string; count: number; share: Fr; why: string; fixed: boolean };
  const list: S[] = [];
  const spouseShare = i.spouses ? (i.deceasedMale ? (hasChild ? fr(1, 8) : fr(1, 4)) : (hasChild ? fr(1, 4) : fr(1, 2))) : fr(0);
  if (i.spouses) list.push({ key: "sp", who: i.deceasedMale ? "স্ত্রী" : "স্বামী", count: i.spouses, share: spouseShare,
    why: i.deceasedMale ? (hasChild ? "সন্তান থাকলে স্ত্রীরা মিলে ১/৮" : "সন্তান না থাকলে স্ত্রীরা মিলে ১/৪") : (hasChild ? "সন্তান থাকলে স্বামী ১/৪" : "সন্তান না থাকলে স্বামী ১/২"), fixed: true });
  if (i.mother) {
    let m = fr(1, 6), why = "সন্তান বা দুই বা বেশি ভাই-বোন থাকলে মা ১/৬";
    if (!hasChild && i.siblings < 2) {
      if (i.father && i.spouses) { m = div(sub(fr(1), spouseShare), fr(3)); why = "পিতা ও স্বামী/স্ত্রী থাকলে স্বামী/স্ত্রীর অংশের পর বাকির ১/৩"; }
      else { m = fr(1, 3); why = "সন্তান নেই, ভাই-বোন ১ জনের বেশি নয়, তাই মা ১/৩"; }
    }
    list.push({ key: "mo", who: "মা", count: 1, share: m, why, fixed: true });
  }
  if (i.father) list.push({ key: "fa", who: "পিতা", count: 1, share: i.sons ? fr(1, 6) : i.daughters ? fr(1, 6) : fr(0),
    why: i.sons ? "ছেলে থাকলে পিতা ১/৬" : i.daughters ? "ছেলে না থাকলে ও মেয়ে থাকলে পিতা ১/৬ এবং বাকি অংশও" : "সন্তান না থাকলে পিতা বাকি সবটা", fixed: true });
  if (i.daughters && !i.sons) list.push({ key: "da", who: i.daughters === 1 ? "মেয়ে" : "মেয়েরা", count: i.daughters, share: i.daughters === 1 ? fr(1, 2) : fr(2, 3),
    why: i.daughters === 1 ? "একমাত্র মেয়ে ১/২" : "একাধিক মেয়ে মিলে ২/৩ (সমান ভাগে)", fixed: true });

  let fixed = fr(0); list.forEach(s => (fixed = add(fixed, s.share)));
  if (fixed.n > fixed.d) { // awl: shares exceed the whole, scale down proportionally
    list.forEach(s => (s.share = div(s.share, fixed)));
    notes.push("মোট নির্ধারিত অংশ ১-এর বেশি হওয়ায় সবার অংশ সমান অনুপাতে কমানো হয়েছে (আউল)।");
    fixed = fr(1);
  }
  let rest = sub(fr(1), fixed);
  const fa = list.find(s => s.key === "fa");
  const out: Row[] = [];
  const push = (s: S, total: Fr, why = s.why) => out.push({ who: s.who, count: s.count, total, each: div(total, fr(s.count)), why });

  if (i.sons) {
    // fixed sharers first, then sons and daughters split the rest 2:1
    const units = 2 * i.sons + i.daughters;
    list.forEach(s => push(s, s.share));
    const unit = div(rest, fr(units));
    out.push({ who: i.sons === 1 ? "ছেলে" : "ছেলেরা", count: i.sons, total: mul(unit, fr(2 * i.sons)), each: mul(unit, fr(2)), why: "ছেলে ও মেয়ে বাকি অংশ ২:১ অনুপাতে পান (ছেলে মেয়ের দ্বিগুণ)" });
    if (i.daughters) out.push({ who: i.daughters === 1 ? "মেয়ে" : "মেয়েরা", count: i.daughters, total: mul(unit, fr(i.daughters)), each: unit, why: "ছেলের সাথে থাকলে মেয়ে ছেলের অর্ধেক পান" });
  } else if (fa && rest.n > 0) {
    list.forEach(s => push(s, s.key === "fa" ? add(s.share, rest) : s.share, s.key === "fa" ? s.why + " (বাকি অংশসহ)" : s.why));
  } else {
    list.forEach(s => push(s, s.share));
  }
  if (!i.sons && !fa && rest.n > 0) { // daughters (and others) left a remainder, but no father: residuary relatives may exist
    out.push({ who: "অবশিষ্ট অংশ (অন্য আত্মীয়)", count: 1, total: rest, each: rest, why: "ভাই, দাদা, চাচা প্রমুখ ‘আসাবা’ আত্মীয় থাকলে তাঁরা পাবেন, না থাকলে অংশীদারদের মধ্যে ফেরত যায়" });
    notes.push("বাকি অংশ কার প্রাপ্য তা নির্ভর করে ভাই, দাদা বা চাচার মতো আত্মীয় জীবিত আছেন কিনা তার ওপর। আইনজীবীর সাথে মিলিয়ে নিন।");
  }
  return { ok: true, rows: out, notes };
}

// Hindu (Dayabhaga) with the Hindu Women's Rights to Property Act 1937: only the common "sons exist" case is calculated.
export function hinduShares(i: { spouses: number; sons: number; daughters: number }): Result {
  const rows: Row[] = [], notes: string[] = [];
  if (i.sons < 1) return { ok: false, message: "ছেলে না থাকলে হিন্দু দায়ভাগ আইনে বিধবা ও মেয়েরা সাধারণত জীবনস্বত্ব পান, আর কার কতটা তা পরিস্থিতিভেদে আলাদা। এই ক্ষেত্রে আইনজীবীর সাথে কথা বলুন।", rows, notes };
  const w = i.spouses > 0 ? 1 : 0, unit = fr(1, i.sons + w);
  rows.push({ who: i.sons === 1 ? "ছেলে" : "ছেলেরা", count: i.sons, total: mul(unit, fr(i.sons)), each: unit, why: "ছেলেরা সমান ভাগ পান" });
  if (w) rows.push({ who: "বিধবা স্ত্রী", count: i.spouses, total: unit, each: div(unit, fr(i.spouses)), why: "১৯৩৭ সালের আইনে বিধবা একজন ছেলের সমান অংশ পান (একাধিক হলে মিলে এক অংশ), তবে এটা জীবনস্বত্ব, ইচ্ছেমতো বিক্রি করা যায় না" });
  if (i.daughters) rows.push({ who: i.daughters === 1 ? "মেয়ে" : "মেয়েরা", count: i.daughters, total: fr(0), each: fr(0), why: "দায়ভাগ আইনে ছেলে থাকলে মেয়েরা উত্তরাধিকার পান না। ভরণপোষণ বা বিয়ের খরচের দাবি থাকতে পারে, আইনজীবীকে জিজ্ঞেস করুন" });
  notes.push("২০২৬ সালের সম্পত্তি হস্তান্তর আইনের সংশোধনী উত্তরাধিকারের নিয়ম বদলায়নি। এটি শুধু জীবিত থাকতেই ভোগাধিকার রেখে দান করার সুযোগ দিয়েছে (প্রথম আলোর প্রতিবেদন)।");
  return { ok: true, rows, notes };
}

// Christians: Succession Act 1925. Only the "children exist" case is calculated.
export function christianShares(i: { spouses: number; sons: number; daughters: number }): Result {
  const rows: Row[] = [], notes: string[] = [], kids = i.sons + i.daughters;
  if (kids < 1) return { ok: false, message: "সন্তান না থাকলে বিধবা, বাবা-মা, ভাই-বোন ইত্যাদি আত্মীয়দের মধ্যে ভাগ আলাদা নিয়মে ঠিক হয়। এই ক্ষেত্রে আইনজীবীর সাথে কথা বলুন।", rows, notes };
  const w = i.spouses > 0, childTotal = w ? fr(2, 3) : fr(1), each = div(childTotal, fr(kids));
  if (w) rows.push({ who: "বিধবা স্ত্রী", count: 1, total: fr(1, 3), each: fr(1, 3), why: "সন্তান থাকলে বিধবা ১/৩ পান" });
  if (i.sons) rows.push({ who: i.sons === 1 ? "ছেলে" : "ছেলেরা", count: i.sons, total: mul(each, fr(i.sons)), each, why: "ছেলে-মেয়ে সমান ভাগ পান" });
  if (i.daughters) rows.push({ who: i.daughters === 1 ? "মেয়ে" : "মেয়েরা", count: i.daughters, total: mul(each, fr(i.daughters)), each, why: "ছেলে-মেয়ে সমান ভাগ পান" });
  notes.push("১৯২৫ সালের উত্তরাধিকার আইনের সাধারণ নিয়ম অনুযায়ী হিসাব। আইনজীবীর সাথে মিলিয়ে নিন।");
  return { ok: true, rows, notes };
}
