# Mamta Care — Evergreen Holiday and Awareness-Day Automation

**14 November 2026 implementation register.** This is a website-opening greeting system, not SMS/phone push notifications. All dates are calculated in **Asia/Kolkata (IST)** from 00:00 until the next midnight.

## Behaviour

- The correct occasion and its premium themed artwork are automatically selected by calendar date and shown when the website is opened.
- The original Mamta Care logo is always its existing, separate **src/assets/mamta-care-logo.jpeg** image, never generated or changed.
- Each named occasion has its own artwork identity, palette, message, motif and decorative composition. Children's Day retains the approved special layout; Christmas has a separate photographic illustration without a logo baked in.
- Close, Continue to Website and Register to Donate Hair remain functional; registration uses the existing feature gate and fallback.
- Only one greeting opens when holidays coincide. Public/national holidays take priority; related days can appear as a secondary note. A visitor can dismiss the popup for the session.
- No website-open data API is required; published dates are compiled into the website.

## Fixed annual events (recur every year automatically)

| Month | Days and occasions |
| --- | --- |
| January | 1 New Year; 14 Makar Sankranti; 15 Pongal; 23 Netaji Jayanti; 26 Republic Day |
| February | 4 World Cancer Day; 15 International Childhood Cancer Day |
| March | 8 Women's Day; 22 World Water Day |
| April | 7 World Health Day; 14 Ambedkar Jayanti; 22 Earth Day |
| May | 1 Workers' Day; 12 Nurses Day |
| June | 5 Environment Day; 14 Blood Donor Day; 21 International Yoga Day |
| July | 1 National Doctors' Day |
| August | 12 Youth Day; 15 Independence Day |
| September | 1 Childhood Cancer Awareness Month; 5 Teachers' Day; 8 Literacy Day; 14 Hindi Diwas |
| October | 1 Breast Cancer Awareness Month; 2 Gandhi Jayanti; 11 International Day of the Girl Child; 19 Breast Cancer Awareness Day; 31 Unity Day |
| November | 14 Children's Day |
| December | 3 Persons with Disabilities Day; 5 Volunteer Day; 24 Christmas Eve; 25 Christmas Day |

**Important:** NGO awareness days and regional festivals are not necessarily nationwide gazetted holidays.

## Date-specific movable festivities, 2026

Jan 23 Basant Panchami; Feb 15 Maha Shivaratri; Mar 4 Holi; Mar 21 Eid-ul-Fitr; Mar 26 Ram Navami; Mar 31 Mahavir Jayanti; Apr 3 Good Friday; Apr 5 Easter; Apr 14 Vaisakhi; May 1 Buddha Purnima; May 27 Eid-ul-Adha; Jun 26 Muharram; Jul 16 Rath Yatra; Aug 26 Milad-un-Nabi; Sep 4 Janmashtami; Sep 14 Ganesh Chaturthi; Oct 20 Dussehra; Nov 8 Diwali; Nov 9 Govardhan Puja; Nov 24 Guru Nanak Jayanti.

## Date-specific movable festivities, 2027

Mar 6 Maha Shivaratri; Mar 10 Eid-ul-Fitr; Mar 23 Holi (central government; local calendars may differ); Mar 26 Good Friday; Mar 28 Easter; Apr 7 Ugadi/Gudi Padwa; Apr 14 Vaisakhi/Vishu/Tamil New Year; Apr 15 Ram Navami/Bengali New Year; Apr 19 Mahavir Jayanti; May 17 Eid-ul-Adha; May 20 Buddha Purnima; Jun 16 Muharram; Jul 5 Rath Yatra; Aug 15 Milad-un-Nabi alongside Independence Day; Aug 17 Raksha Bandhan; Aug 25 Janmashtami; Sep 4 Ganesh Chaturthi; Sep 12 Onam; Oct 6 Durga Puja; Oct 9 Dussehra; Oct 18 Karva Chauth; Oct 28 Naraka Chaturdashi; Oct 29 Diwali; Oct 30 Govardhan Puja; Oct 31 Bhai Dooj; Nov 4 Chhath Puja; Nov 14 Guru Nanak Jayanti alongside Children's Day.

## Automatic years 2028 onward

A GitHub Actions workflow runs when first installed and monthly afterward. It uses a pinned date-holidays rule engine, generates an immutable local JSON date cache for **six years ahead** including India and supported regions, runs the full tests and Vite build, and commits **only changes**. Vercel automatically deploys the resulting calendar. This uses no paid API key and does not require changing artwork or manually activating a greeting each festival.

**Limitation:** Some lunar festivals are based on moon sighting and some holidays are changed by official/state notification. Predicted future dates can be one or more days different. Special authoritative corrections may still be necessary; absolute accuracy for every state and future holiday cannot be guaranteed without authoritative notifications. Scheduled GitHub Actions also require repository write permissions and enabled schedules; verify the first execution succeeds.

## Source references

- India central government 2026 holiday schedule: https://cag.gov.in/en/pages/single/page-defence-new-delhi-holidaylist
- 2027 central holiday list and regional variations: https://www.nfc.gov.in/holidays-hyd-2027.html
- date-holidays library: https://www.npmjs.com/package/date-holidays

## Safety

The official logo is not edited or embedded in artwork. Children's Day custom design stays intact; no Donor Desk, Cloudflare D1, Google Sheet, certificate or existing registration workflow is modified. The actual source-of-truth master schedule and artwork identity list is in **src/lib/occasionCatalog.js**. The automatic generator is **scripts/generate-occasion-dates.mjs** and scheduled workflow is **.github/workflows/india-holiday-calendar.yml**. Tests cover IST boundaries, recurrence, overlap, logo safety, and the absence of unknown dates.
