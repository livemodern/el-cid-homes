// ─── lib/lead-utils.ts — lead-pipeline helpers ────────────────────────
//
// The survivors of src/lib/fub.ts, extracted when Follow Up Boss was
// deleted from the consumer sites (Patrick 2026-07-23). Nothing here
// touches FUB — this is the bot filter that gates every form submission.

// ─── Bot filter — identity plausibility ───────────────────────────────
//
// Mirror of mlg-admin `lib/lead-identity.ts`. This is the free local gate; the
// central classifier at /api/leads/spam-check runs the identical logic plus
// keyword + Claude layers. Change one, change both.
//
// WHY IT LOOKS LIKE THIS (2026-07-31). "Epoxquq Cvdwjrhm /
// a.fa.g.efa413@gmail.com / (492) 927-1939" landed as a real lead on
// livemodern.com and paged an agent. Its only signal under the old scoring was
// 3 dots in the email local part (+30) against a 50 threshold — and it carried
// an EMPTY message, so every message-based layer downstream waved it through
// too. The identity itself was the tell: a surname with no vowels at all, an
// eight-letter consonant run, a dot-aliased throwaway gmail, and area code 492,
// which is not an assigned NANP code — that phone can never ring.
//
// CALIBRATION: scored against all 338 rows of `leads` and 20,000 real contacts.
// At threshold 50 it rejects known junk and ZERO real leads. Do not raise a
// weight without re-running that. Rules deliberately EXCLUDED because they
// flagged real people: vowel-ratio (Schwartz, Fleschner), q-not-followed-by-u
// (Farooq, Iqbal, Qiao), consonant-run of 5 (Armstrong, Gottschalk), and
// email-local/name mismatch (eva11370@yahoo.com is a real Palm Beach renter).

const VOWELS = 'aeiouy';

/** Max points the phone alone may contribute — must stay below the 50 reject line. */
const PHONE_MAX = 40;

// Honorifics, generational suffixes and credentials — stripped before name
// analysis so "Susan Stern, LCSW" isn't read as a vowel-less surname and
// "Clayton Parsons III" isn't read as a repeated letter.
const NAME_SUFFIXES = new Set([
  'jr', 'sr', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'mr', 'mrs', 'ms', 'dr', 'arq',
  'md', 'do', 'dds', 'dmd', 'esq', 'cpa', 'pa', 'pc', 'phd', 'mba', 'rn',
  'lcsw', 'cfp', 'clu', 'chfc', 'dvm', 'jd', 'llc', 'pllc', 'inc', 'realtor',
]);

// In-service NANP area codes (NANPA 2024-03 snapshot + codes placed in service
// since). An unlisted code is suspicious but not fatal alone — new overlays are
// assigned a few times a year and this list will lag them. Measured against
// 13,279 real 10-digit contact phones: 195 (1.5%) fall outside it, and those
// spot-check as 555/123/000/111/492 and de-prefixed foreign numbers.
// NOTE the outer parentheses: without them `.split()` binds to the LAST string
// literal only and the whole set silently becomes garbage.
const IN_SERVICE_NPA = new Set(
  (
    '201 202 203 204 205 206 207 208 209 210 212 213 214 215 216 217 218 219 220 223 224 ' +
    '225 226 227 228 229 231 234 235 236 239 240 242 246 248 249 250 251 252 253 254 256 ' +
    '260 262 263 264 267 268 269 270 272 274 276 279 281 283 284 289 301 302 303 304 305 ' +
    '306 307 308 309 310 312 313 314 315 316 317 318 319 320 321 323 324 325 326 327 329 ' +
    '330 331 332 334 336 337 339 340 341 343 345 346 347 350 351 352 353 354 360 361 363 ' +
    '364 365 367 368 369 380 382 385 386 401 402 403 404 405 406 407 408 409 410 412 413 ' +
    '414 415 416 417 418 419 423 424 425 428 430 431 432 434 435 436 437 438 440 441 442 ' +
    '443 445 447 448 450 458 462 463 464 468 469 470 472 473 474 475 478 479 480 484 500 ' +
    '501 502 503 504 505 506 507 508 509 510 512 513 514 515 516 517 518 519 520 521 522 ' +
    '523 524 525 526 527 528 529 530 531 533 534 539 540 541 544 548 551 557 559 561 562 ' +
    '563 564 566 567 570 571 572 573 574 575 577 579 580 581 582 584 585 586 587 588 600 ' +
    '601 602 603 604 605 606 607 608 609 610 612 613 614 615 616 617 618 619 620 621 622 ' +
    '623 624 625 626 627 628 629 630 631 633 636 639 640 641 645 646 647 649 650 651 656 ' +
    '657 658 659 660 661 662 664 667 669 670 671 672 678 680 681 682 683 684 686 689 700 ' +
    '701 702 703 704 705 706 707 708 709 710 712 713 714 715 716 717 718 719 720 721 724 ' +
    '725 726 727 728 729 730 731 732 734 737 740 742 743 747 752 753 754 757 758 760 762 ' +
    '763 765 767 769 770 771 772 773 774 775 778 779 780 781 782 784 785 786 787 800 801 ' +
    '802 803 804 805 806 807 808 809 810 812 813 814 815 816 817 818 819 820 825 826 828 ' +
    '829 830 831 832 833 835 836 837 838 839 840 843 844 845 847 848 849 850 854 855 856 ' +
    '857 858 859 860 861 862 863 864 865 866 867 868 869 870 872 873 876 877 878 879 888 ' +
    '900 901 902 903 904 905 906 907 908 909 910 912 913 914 915 916 917 918 919 920 925 ' +
    '928 929 930 931 934 935 936 937 938 939 940 941 942 943 945 947 948 949 951 952 954 ' +
    '956 959 970 971 972 973 975 978 979 980 983 984 985 986 989'
  )
    .split(' ')
    .filter(Boolean),
);

function nameWords(first?: string | null, last?: string | null): string[] {
  const out: string[] = [];
  for (const field of [first, last]) {
    if (!field) continue;
    for (const raw of String(field).split(/[\s,\-'.]+/)) {
      const w = raw.trim();
      if (!w) continue;
      if (NAME_SUFFIXES.has(w.toLowerCase().replace(/[^a-z]/g, ''))) continue;
      out.push(w);
    }
  }
  return out;
}

/** Longest run of consecutive non-vowel letters (y counts as a vowel). */
function longestConsonantRun(word: string): number {
  let best = 0;
  let cur = 0;
  // Indexed, not for..of — iterating a string requires downlevelIteration on
  // the older tsconfig targets still in the fleet, and this file ships to all
  // of them unchanged.
  for (let i = 0; i < word.length; i += 1) {
    const ch = word.charAt(i);
    if (/[a-z]/.test(ch) && !VOWELS.includes(ch)) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

export function botScore(data: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  message?: string;
}): number {
  let score = 0;
  const add = (points: number) => { score += points; };

  // ─── Name ───────────────────────────────────────────────────────────
  // Long-word scores once per submission, not per word: "Anita Bhattacharjee"
  // and "Shriram Radhakrishnan" are real people in our contact table, and a
  // per-word tally would put a name over the line on length alone.
  let longWordScored = false;
  for (const word of nameWords(data.firstName, data.lastName)) {
    const core = word.toLowerCase().replace(/[^a-z]/g, '');

    if (word.length > 12 && !longWordScored) { longWordScored = true; add(30); }
    // Random-case mash ("SjQUQrqalipgafyAplU"), NOT shouty typing. A word with
    // no lowercase at all is someone holding shift — "JOHN MCKENNA" was
    // rejected on 2026-08-01 for exactly this (40 + 40 = 80), a real buyer on
    // mlg-site, lost silently. Requires a lowercase letter to fire.
    if (/[a-z]/.test(word) && (word.slice(1).match(/[A-Z]/g) || []).length >= 3) add(40);
    if (/\d/.test(word)) add(40);

    // A Latin-script name with no vowel at all. Five letters or more is the
    // signature of keyboard mash ("Cvdwjrhm", "Bsbsbsbdh", "Kjvbsjkbf"); four
    // is ambiguous enough (initialisms, "Smth") to only be a partial.
    const hasVowel = /[aeiouy]/.test(core);
    if (!hasVowel && core.length >= 5) add(50);
    else if (!hasVowel && core.length === 4) add(30);

    // Seven consonants in a row does not occur in a real name in our corpus.
    // Six does, barely (Brahmbhtt, Kohlschreiber), so six is a partial.
    const run = longestConsonantRun(core);
    if (run >= 7) add(50);
    else if (run === 6) add(25);

    if (/(.)\1\1/.test(core)) add(40); // "Hhhh", "Jjjjjj", "Frrr"
  }

  // ─── Email ──────────────────────────────────────────────────────────
  // Gmail ignores dots entirely, so a farm sprays one mailbox across many
  // dotted spellings. Real people type at most one or two.
  const email = String(data.email ?? '').trim().toLowerCase();
  if (email.includes('@')) {
    const dots = (email.split('@')[0].match(/\./g) || []).length;
    if (dots >= 4) add(50);
    else if (dots === 3) add(30);
  }

  // ─── Phone ──────────────────────────────────────────────────────────
  // A phone can only ever CORROBORATE — its total contribution is capped below
  // the reject threshold, so an odd number can never reject on its own.
  //
  // Why (2026-08-04, found in lead_spam_log): 27 of 20,000 real clients scored
  // 80 on phone signals ALONE — plausible name, real email, rejected for the
  // number. Two populations, both real buyers:
  //   • placeholder phones typed into a required field — 5555555555,
  //     9999999999, 777-777-7777 (Amelia De Oliveira Gama, Félix J. González,
  //     Elizabeth Hogan). Declining to hand over a phone is not fraud.
  //   • foreign numbers entered without the trunk prefix or country code:
  //     Oliver Amdrup-Chamby (+45 Denmark), a concordcollege.org.uk student on
  //     a UK mobile, kevin@ncsc.nl, Mexican 449/55 numbers. The leading-0/1
  //     exemption below misses these — they start 2-9, so they look NANP.
  //     Overseas luxury buyers are the entire point of LiveModern.
  //
  // NANP structural rules only apply to a number CLAIMING to be North
  // American; a leading 0 or 1 is a foreign national number and is exempt.
  const raw = String(data.phone ?? '').trim();
  if (raw) {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);

    let phonePoints = 0;
    const addPhone = (points: number) => { phonePoints += points; };

    if (digits.length !== 10) {
      addPhone(20);
    } else {
      if (new Set(digits.split('')).size <= 2) addPhone(40);
      if ('01234567890'.includes(digits) || '09876543210'.includes(digits)) addPhone(40);

      const looksNanp = !'01'.includes(digits[0]);
      if (looksNanp) {
        const npa = digits.slice(0, 3);
        const nxx = digits.slice(3, 6);
        // N11 (411, 611, 911…) is reserved for services — never an area code.
        if (npa[1] === '1' && npa[2] === '1') addPhone(40);
        else if (!IN_SERVICE_NPA.has(npa)) addPhone(40);
        // A central-office code may not begin with 0 or 1 — what makes
        // "772-114-2049" impossible rather than merely unfamiliar.
        if (nxx[0] === '0' || nxx[0] === '1') addPhone(40);
      }
    }

    add(Math.min(phonePoints, PHONE_MAX));
  }

  // ─── Message ────────────────────────────────────────────────────────
  // Non-Latin SCRIPT only. The old rule flagged ANY non-ASCII byte at +40,
  // which fired on 13 of 338 real leads: every iPhone curly apostrophe
  // ("I’m interesting to rent one bedroom apartment"), and every message our
  // OWN building forms prefill with an em-dash and a middle dot
  // ("[Re: Shorecrest — Under Construction · $3.02M – $9.58M+]"). That rule
  // sat one 30-point signal away from silently dropping real buyers.
  if (/[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(String(data.message ?? ''))) {
    add(25);
  }

  return score;
}

export function isBot(data: Parameters<typeof botScore>[0]): boolean {
  return botScore(data) >= 50;
}