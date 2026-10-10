// "New for you" count in the student sidebar (P6-T2, F-21): LIVE postings shown after the student's
// last visit to the jobs page, with the same rule as the New badge (publishedAt, else firstSeenAt),
// and only the ones "Eligible for me" lets through when the student has a roll number.
import { z } from 'zod';
import { CareersError } from '../errors.js';

const SKEW_MS = 5 * 60 * 1000; // a browser clock a little ahead is fine

// Pure. Returns { since: Date }; throws a 400 for a missing, invalid or future value.
export function newCountQuery(query, now = Date.now()) {
    const parsed = z.object({ since: z.coerce.number().int().positive() }).safeParse(query ?? {});
    if (!parsed.success || parsed.data.since > now + SKEW_MS) {
        throw new CareersError(400, 'VALIDATION_ERROR', 'since must be the time of your last visit, in milliseconds.');
    }
    return { since: new Date(parsed.data.since) };
}

// Pure. eligibility: from eligibilityWhere(profile), or null.
export function newSinceWhere(since, eligibility) {
    return {
        AND: [
            { status: 'LIVE' },
            { OR: [{ publishedAt: { gt: since } }, { publishedAt: null, firstSeenAt: { gt: since } }] },
            ...(eligibility ? [eligibility] : []),
        ],
    };
}
